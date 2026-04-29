"""Application settings, loaded from environment variables / .env file.

The Pydantic BaseSettings reads from ``.env`` (relative to the working dir)
and falls back to defaults baked in here.  All settings are immutable at
runtime - tests should construct their own ``Settings()`` instance instead
of mutating the module-level singleton.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Database ---
    database_url: str = Field(
        default="sqlite+aiosqlite:///./data/hzev.db",
        description="SQLAlchemy async URL for the embedded DB.",
    )
    sync_database_url: str = Field(
        default="sqlite:///./data/hzev.db",
        description="Sync SQLAlchemy URL used by the seed script.",
    )

    # --- MQTT ---
    mqtt_broker: str = Field(default="localhost", description="MQTT broker hostname.")
    mqtt_port: int = Field(default=1883, description="MQTT broker port.")
    mqtt_topic_prefix: str = Field(default="hzev/", description="MQTT topic prefix for piles.")

    # --- Synth generator ---
    pile_count: int = Field(default=100, ge=1, description="Total number of synthetic piles.")
    history_days: int = Field(default=30, ge=1, description="Days of history to seed.")
    realtime_tick_seconds: float = Field(
        default=1.0, gt=0, description="Interval (s) for live telemetry generation."
    )
    rng_seed: int = Field(
        default=42,
        description="Master RNG seed for reproducible synthesis.",
    )

    # --- API ---
    api_title: str = "HZ-EV Brain Backend"
    api_version: str = "0.1.0"
    cors_origins: list[str] = Field(
        default=["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"],
        description="Allowed origins for CORS (frontend dev servers).",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached settings singleton."""
    return Settings()
