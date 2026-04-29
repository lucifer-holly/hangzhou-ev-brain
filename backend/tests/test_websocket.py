"""WebSocket smoke test using Starlette's synchronous TestClient.

We can't reliably wait 1 second for a real ticker frame inside a unit test
(it would slow the suite), so we cover two narrower contracts:

1. ``/ws`` accepts the connection and immediately sends a ``hello`` frame.
2. Manually broadcasting through the connection manager fans out to every
   connected client.
"""

from __future__ import annotations

import json

from fastapi.testclient import TestClient


def test_ws_hello_frame(seeded_db):  # noqa: ARG001  (fixture used for its side-effect)
    from api.main import create_app

    app = create_app()
    with TestClient(app) as client:  # `with` fires the lifespan
        with client.websocket_connect("/ws") as ws:
            raw = ws.receive_text()
            msg = json.loads(raw)
            assert msg["type"] == "tick"
            assert "timestamp" in msg
            assert msg["data"]["hello"] == "hz-ev-brain"


def test_ws_broadcast_fans_out(seeded_db):  # noqa: ARG001
    """A direct call to manager.broadcast should reach every open client."""
    import asyncio

    from api.main import create_app
    from api.ws import manager

    app = create_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            ws.receive_text()  # consume hello

            async def _send():
                await manager.broadcast(
                    {"type": "tick", "timestamp": "2026-04-30T00:00:00Z", "data": {"x": 1}}
                )

            asyncio.run(_send())
            raw = ws.receive_text()
            msg = json.loads(raw)
            assert msg["data"] == {"x": 1}
