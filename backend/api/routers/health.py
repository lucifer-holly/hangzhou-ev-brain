"""Liveness / readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from api.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness probe")
async def health() -> dict[str, str]:
    """Return ``{"status": "ok"}`` when the process is alive."""
    return {"status": "ok"}


@router.get("/version", summary="Version metadata")
async def version() -> dict[str, str]:
    settings = get_settings()
    return {
        "name": settings.api_title,
        "version": settings.api_version,
    }
