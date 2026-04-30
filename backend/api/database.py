"""SQLAlchemy engine + session factories.

Two engines are exported:

* ``engine`` / ``async_session`` — async, used by FastAPI route handlers.
* ``sync_engine`` / ``SyncSession`` — sync, used by the bootstrap ``db.seed``
  script and by the synth generator's bulk inserts (much simpler than
  threading async sessions through APScheduler jobs).
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from api.config import get_settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def _ensure_data_dir(url: str) -> None:
    """If the URL is a sqlite file path, create the parent directory."""
    if "sqlite" not in url:
        return
    path_part = url.split("///", 1)[-1]
    if not path_part or path_part == ":memory:":
        return
    Path(path_part).parent.mkdir(parents=True, exist_ok=True)


_settings = get_settings()
_ensure_data_dir(_settings.sync_database_url)

# Sync engine (seed + synth bulk inserts).
sync_engine = create_engine(
    _settings.sync_database_url,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False} if "sqlite" in _settings.sync_database_url else {},
)
SyncSession = sessionmaker(bind=sync_engine, autoflush=False, expire_on_commit=False)

# Async engine (FastAPI endpoints).
engine = create_async_engine(
    _settings.database_url,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False} if "sqlite" in _settings.database_url else {},
)
async_session = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding an async session."""
    async with async_session() as session:
        yield session


def init_db_sync() -> None:
    """Create all tables synchronously (used by seed)."""
    # Local import to avoid circular: models depend on Base.
    from api import models  # noqa: F401

    Base.metadata.create_all(bind=sync_engine)


def reset_db_sync() -> None:
    """Drop and recreate all tables (used by reset script + tests)."""
    from api import models  # noqa: F401

    Base.metadata.drop_all(bind=sync_engine)
    Base.metadata.create_all(bind=sync_engine)


def db_file_exists() -> bool:
    """Return True iff the on-disk SQLite file already exists."""
    url = _settings.sync_database_url
    if "sqlite" not in url:
        return False
    path_part = url.split("///", 1)[-1]
    return os.path.isfile(path_part) and os.path.getsize(path_part) > 0
