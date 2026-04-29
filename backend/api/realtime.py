"""Realtime ticker — runs as an asyncio background task on FastAPI startup.

Each tick:

1. Calls :func:`synth.generator.generate_tick` to produce one snapshot per pile
   plus any newly-fired event.
2. Updates the live snapshot columns on :class:`api.models.Pile`.
3. Inserts the new event rows into :class:`api.models.Event`.
4. Broadcasts both telemetry and events over the WebSocket fan-out.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import closing
from dataclasses import asdict
from datetime import datetime, timezone

from sqlalchemy import select

from api import models
from api.config import get_settings
from api.database import SyncSession
from api.ws import manager
from synth.generator import (
    GeneratedEvent,
    TelemetryPoint,
    TickerState,
    generate_tick,
    make_ticker_state,
)
from synth.geography import PileLocation

log = logging.getLogger("api.realtime")


def _piles_from_db() -> list[PileLocation]:
    """Pull the persisted pile fleet back into PileLocation tuples for the ticker."""
    with closing(SyncSession()) as session:
        rows = session.execute(select(models.Pile)).scalars().all()
        return [
            PileLocation(
                id=p.id,
                operator_id=p.operator_id,
                region_id=p.region_id,
                lat=p.lat,
                lng=p.lng,
                capacity_kw=p.capacity_kw,
                connector_type=p.connector_type,
                installed_at=p.installed_at,
                subsidy_amount=p.subsidy_amount,
                subsidy_group=p.subsidy_group,
            )
            for p in rows
        ]


def _persist_tick(points: list[TelemetryPoint], events: list[GeneratedEvent]) -> None:
    """Update live snapshot on Pile rows + append events.

    We do *not* write a Telemetry row per tick — that would hit ~360k rows/hour
    on a fleet of 100.  Instead the live snapshot lives on the Pile row, and
    history-grade rows are only the hourly ones from seed.
    """
    if not points and not events:
        return
    with closing(SyncSession()) as session:
        if points:
            mappings = [
                {
                    "id": p.pile_id,
                    "current_status": p.status,
                    "current_voltage": p.voltage,
                    "current_current": p.current,
                    "current_power": p.power,
                    "current_occupancy": p.occupancy_rate,
                    "last_seen_at": p.ts.replace(tzinfo=None)
                    if p.ts.tzinfo is not None
                    else p.ts,
                }
                for p in points
            ]
            session.bulk_update_mappings(models.Pile, mappings)
        for ev in events:
            session.add(
                models.Event(
                    pile_id=ev.pile_id,
                    ts=ev.ts.replace(tzinfo=None) if ev.ts.tzinfo is not None else ev.ts,
                    type=ev.type,
                    severity=ev.severity,
                    message=ev.message,
                    duration_minutes=ev.duration_minutes,
                    resolved=int(bool(ev.resolved)),
                )
            )
        session.commit()


async def _broadcast_tick(points: list[TelemetryPoint], events: list[GeneratedEvent]) -> None:
    if manager.connection_count == 0:
        return
    now_iso = datetime.now(timezone.utc).isoformat()
    # Send a single aggregated frame so 100 piles don't equal 100 socket writes.
    await manager.broadcast(
        {
            "type": "telemetry",
            "timestamp": now_iso,
            "data": {
                "piles": [asdict(p) for p in points],
            },
        }
    )
    for ev in events:
        await manager.broadcast(
            {
                "type": "event",
                "pile_id": ev.pile_id,
                "timestamp": now_iso,
                "data": asdict(ev),
            }
        )


class RealtimeTicker:
    """Owns the background asyncio task that drives live data."""

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._state: TickerState = make_ticker_state(seed=get_settings().rng_seed + 7)
        self._piles: list[PileLocation] = []
        self._stop = asyncio.Event()

    async def start(self) -> None:
        if self._task is not None:
            return
        self._piles = await asyncio.to_thread(_piles_from_db)
        if not self._piles:
            log.warning("realtime: no piles in DB — ticker idle")
            return
        log.info("realtime: starting ticker for %d piles", len(self._piles))
        self._task = asyncio.create_task(self._run(), name="realtime-ticker")

    async def stop(self) -> None:
        self._stop.set()
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None
        log.info("realtime: ticker stopped")

    async def _run(self) -> None:
        interval = get_settings().realtime_tick_seconds
        while not self._stop.is_set():
            try:
                points, events = await asyncio.to_thread(
                    generate_tick, self._piles, self._state, datetime.now(timezone.utc)
                )
                await asyncio.to_thread(_persist_tick, points, events)
                await _broadcast_tick(points, events)
            except Exception:  # noqa: BLE001 - keep ticker alive
                log.exception("realtime: tick failed")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=interval)
            except asyncio.TimeoutError:
                pass


ticker = RealtimeTicker()
