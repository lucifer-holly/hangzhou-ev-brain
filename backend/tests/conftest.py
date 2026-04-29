"""Shared pytest fixtures.

We seed a *small* test DB once per test session into a tempfile so the FastAPI
endpoints have realistic data without paying the cost of a 72k-row seed.
"""

from __future__ import annotations

import os
import tempfile
from collections.abc import Generator
from pathlib import Path

import pytest


@pytest.fixture(scope="session", autouse=True)
def _setup_env() -> Generator[None, None, None]:
    """Point Pydantic Settings at an isolated SQLite file with tiny seed sizes."""
    tmp_dir = Path(tempfile.mkdtemp(prefix="hzev-test-"))
    db_path = tmp_dir / "test.db"
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"
    os.environ["SYNC_DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["PILE_COUNT"] = "100"
    # Tiny history so tests stay fast (1 day vs 30).
    os.environ["HISTORY_DAYS"] = "1"
    os.environ["RNG_SEED"] = "42"
    # Slow ticker so it doesn't fight us during tests.
    os.environ["REALTIME_TICK_SECONDS"] = "5"

    # Reset cached settings so the new env is picked up.
    from api.config import get_settings

    get_settings.cache_clear()
    yield
    # Best-effort cleanup.
    try:
        if db_path.exists():
            db_path.unlink()
        tmp_dir.rmdir()
    except OSError:
        pass


@pytest.fixture(scope="session")
def seeded_db(_setup_env) -> None:
    """Seed the test DB synchronously once."""
    from db.seed import seed

    seed(force=True)
