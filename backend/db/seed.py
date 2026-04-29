"""Database seeding script.

Idempotent: if the SQLite file already exists and the ``piles`` table has
``settings.pile_count`` rows, the script is a no-op.  Otherwise it drops &
recreates all tables and inserts:

* 4 operator rows
* 2 region rows
* ``settings.pile_count`` pile rows
* ``settings.pile_count * 24 * settings.history_days`` telemetry rows
* All injected fault + communication-loss events

For 100 piles × 30 days that's ~72k telemetry rows + a few hundred events,
which fits comfortably in SQLite and seeds in seconds.

Run from the CLI: ``python -m db.seed``.
"""

from __future__ import annotations

import logging
import time
from contextlib import closing

from sqlalchemy import select
from sqlalchemy.orm import Session

from api import models
from api.config import get_settings
from api.database import SyncSession, init_db_sync, reset_db_sync
from synth.generator import generate_history
from synth.geography import REGIONS, generate_pile_locations
from synth.operators import OPERATORS

log = logging.getLogger("db.seed")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def _operator_count(session: Session) -> int:
    return session.scalar(select(models.Operator.id).limit(1).with_only_columns(models.Operator.id)) is not None


def seed(force: bool = False) -> None:
    """Populate the database.  Re-runs are safe and a no-op when seeded."""
    settings = get_settings()
    log.info("seed: pile_count=%d history_days=%d", settings.pile_count, settings.history_days)

    if not force and _is_seeded():
        log.info("seed: database already seeded — skipping. (run with force=True to reset)")
        return

    log.info("seed: (re)creating schema")
    reset_db_sync()

    with closing(SyncSession()) as session:
        _insert_static(session)
        session.commit()

    pile_locations = generate_pile_locations(seed=settings.rng_seed, total=settings.pile_count)

    with closing(SyncSession()) as session:
        for loc in pile_locations:
            session.add(
                models.Pile(
                    id=loc.id,
                    operator_id=loc.operator_id,
                    region_id=loc.region_id,
                    lat=loc.lat,
                    lng=loc.lng,
                    capacity_kw=loc.capacity_kw,
                    connector_type=loc.connector_type,
                    installed_at=loc.installed_at.replace(tzinfo=None),
                    subsidy_amount=loc.subsidy_amount,
                    subsidy_group=loc.subsidy_group,
                )
            )
        session.commit()
    log.info("seed: inserted %d piles", len(pile_locations))

    t0 = time.time()
    bundle = generate_history(
        piles=pile_locations,
        history_days=settings.history_days,
        seed=settings.rng_seed + 1,
    )
    log.info(
        "seed: synthesised %d telemetry rows + %d events in %.1fs",
        len(bundle.telemetry),
        len(bundle.events),
        time.time() - t0,
    )

    t0 = time.time()
    with closing(SyncSession()) as session:
        # Bulk insert telemetry in chunks to keep memory + transaction size sane.
        chunk = 5000
        rows = [
            {
                "pile_id": t.pile_id,
                "ts": t.ts.replace(tzinfo=None),
                "voltage": t.voltage,
                "current": t.current,
                "power": t.power,
                "occupancy_rate": t.occupancy_rate,
                "energy_delivered_kwh": t.energy_delivered_kwh,
                "status": t.status,
            }
            for t in bundle.telemetry
        ]
        for i in range(0, len(rows), chunk):
            session.bulk_insert_mappings(models.Telemetry, rows[i : i + chunk])
            session.commit()

        ev_rows = [
            {
                "pile_id": e.pile_id,
                "ts": e.ts.replace(tzinfo=None),
                "type": e.type,
                "severity": e.severity,
                "message": e.message,
                "duration_minutes": e.duration_minutes,
                "resolved": int(bool(e.resolved)),
            }
            for e in bundle.events
        ]
        for i in range(0, len(ev_rows), chunk):
            session.bulk_insert_mappings(models.Event, ev_rows[i : i + chunk])
            session.commit()

    log.info(
        "seed: bulk-inserted telemetry + events in %.1fs", time.time() - t0
    )


def _is_seeded() -> bool:
    """True iff piles table has at least ``pile_count`` rows."""
    settings = get_settings()
    init_db_sync()  # create tables if missing — does nothing if they exist
    with closing(SyncSession()) as session:
        n = session.query(models.Pile).count()
        return n >= settings.pile_count


def _insert_static(session: Session) -> None:
    """Insert operators + regions (idempotent within a fresh session)."""
    for op in OPERATORS:
        session.merge(
            models.Operator(
                id=op.id,
                name_zh=op.name_zh,
                name_en=op.name_en,
                market_share=op.market_share,
                color=op.color,
            )
        )
    for region in REGIONS.values():
        session.merge(
            models.Region(
                id=region.id,
                name_zh=region.name_zh,
                name_en=region.name_en,
                center_lat=region.center_lat,
                center_lng=region.center_lng,
                radius_km=region.radius_km,
                description=region.description,
            )
        )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed the HZ-EV Brain SQLite database.")
    parser.add_argument("--force", action="store_true", help="Drop & recreate even if seeded.")
    args = parser.parse_args()
    seed(force=args.force)
