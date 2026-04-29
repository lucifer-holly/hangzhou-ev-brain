"""FastAPI shared dependencies."""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from api.database import async_session


async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield an async DB session, scoped to a single request."""
    async with async_session() as session:
        yield session
