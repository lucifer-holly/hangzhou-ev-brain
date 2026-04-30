"""WebSocket fan-out.

A single global :class:`ConnectionManager` accepts connections at ``/ws`` and
holds their send-coroutines.  The realtime ticker calls
:meth:`ConnectionManager.broadcast` once per generated tick.

Messages follow :class:`api.schemas.WSMessage`:

```
{ "type": "telemetry"|"event"|"tick",
  "pile_id": "pile-001-...",
  "timestamp": "2026-04-30T01:23:45Z",
  "data": {...} }
```
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

log = logging.getLogger("api.ws")

router = APIRouter()


class ConnectionManager:
    """Tracks live WebSocket connections and broadcasts JSON messages."""

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)
        log.info("ws: client connected — total=%d", len(self._connections))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(ws)
        log.info("ws: client disconnected — total=%d", len(self._connections))

    @property
    def connection_count(self) -> int:
        return len(self._connections)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        """Send ``payload`` (already JSON-serialisable) to every connected client.

        Failed sockets are silently dropped.
        """
        if not self._connections:
            return
        msg = json.dumps(payload, default=_json_default)
        async with self._lock:
            sockets = list(self._connections)
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_text(msg)
            except Exception as exc:  # noqa: BLE001 - any send failure → drop
                log.debug("ws: drop dead socket: %s", exc)
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._connections.discard(ws)


def _json_default(obj: Any) -> Any:
    if isinstance(obj, datetime):
        if obj.tzinfo is None:
            obj = obj.replace(tzinfo=UTC)
        return obj.isoformat()
    raise TypeError(f"not JSON serialisable: {type(obj).__name__}")


# Singleton — imported by the realtime ticker and by the WS endpoint.
manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    """Accept a client and keep the connection open until it disconnects."""
    await manager.connect(ws)
    try:
        await ws.send_text(
            json.dumps(
                {
                    "type": "tick",
                    "timestamp": datetime.now(UTC).isoformat(),
                    "data": {"hello": "hz-ev-brain"},
                }
            )
        )
        # Hold the connection open: read whatever the client sends (we ignore
        # it) so disconnects propagate cleanly.
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(ws)
