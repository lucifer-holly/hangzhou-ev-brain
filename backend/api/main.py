"""FastAPI app entry-point.

Lifespan:

1. Seed the database (idempotent — skipped if already populated).
2. Start the realtime ticker.
3. On shutdown, stop the ticker.

Run ``uvicorn api.main:app --reload`` for local dev, or ``docker-compose up``.
"""

from __future__ import annotations

import os

# Cap OpenMP / MKL threads to 1 — multiple libraries (PyTorch, XGBoost,
# ONNXRuntime) link OpenMP from different runtimes on Apple Silicon and
# can segfault when their thread pools collide.  AI inference here is
# tiny and single-threaded is plenty fast.  Set BEFORE numpy / torch
# imports trigger.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.config import get_settings
from api.realtime import ticker
from api.routers import ai as ai_router
from api.routers import events, grid, health, operators, piles, regions, stats
from api.ws import router as ws_router

log = logging.getLogger("api.main")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[no-untyped-def]
    """Bootstrap the DB + start the realtime ticker."""
    # Local import so test fixtures can avoid running seed if they want to.
    from db.seed import seed

    log.info("startup: seeding DB if needed")
    seed(force=False)

    log.info("startup: starting realtime ticker")
    await ticker.start()

    try:
        yield
    finally:
        log.info("shutdown: stopping ticker")
        await ticker.stop()


def create_app() -> FastAPI:
    """Build the FastAPI app — factory used by tests + uvicorn alike."""
    settings = get_settings()
    app = FastAPI(
        title=settings.api_title,
        version=settings.api_version,
        lifespan=lifespan,
        description=(
            "HZ-EV Brain backend.  100% synthetic data, 100 piles across "
            "杭州未来科技城 + 钱塘新区, 30-day history + 1 Hz live ticks."
        ),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(piles.router)
    app.include_router(operators.router)
    app.include_router(regions.router)
    app.include_router(events.router)
    app.include_router(stats.router)
    app.include_router(ai_router.router)
    app.include_router(grid.router)
    app.include_router(ws_router)

    return app


app = create_app()
