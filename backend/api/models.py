"""SQLAlchemy ORM models.

Schema is intentionally simple — synthetic data only, no migrations.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Operator(Base):
    """A charging operator (国网/特来电/星星/蔚来)."""

    __tablename__ = "operators"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name_zh: Mapped[str] = mapped_column(String(64), nullable=False)
    name_en: Mapped[str] = mapped_column(String(64), nullable=False)
    market_share: Mapped[float] = mapped_column(Float, nullable=False)
    color: Mapped[str] = mapped_column(String(16), nullable=False, default="#4A9EFF")

    piles: Mapped[list[Pile]] = relationship(back_populates="operator_ref")


class Region(Base):
    """A geographic region in Hangzhou."""

    __tablename__ = "regions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name_zh: Mapped[str] = mapped_column(String(64), nullable=False)
    name_en: Mapped[str] = mapped_column(String(64), nullable=False)
    center_lat: Mapped[float] = mapped_column(Float, nullable=False)
    center_lng: Mapped[float] = mapped_column(Float, nullable=False)
    radius_km: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    piles: Mapped[list[Pile]] = relationship(back_populates="region_ref")


class Pile(Base):
    """A charging pile."""

    __tablename__ = "piles"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    operator_id: Mapped[str] = mapped_column(ForeignKey("operators.id"), index=True)
    region_id: Mapped[str] = mapped_column(ForeignKey("regions.id"), index=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    capacity_kw: Mapped[float] = mapped_column(Float, nullable=False)
    connector_type: Mapped[str] = mapped_column(String(32), nullable=False, default="GB/T")
    installed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    subsidy_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    subsidy_group: Mapped[str] = mapped_column(String(16), nullable=False, default="control")

    # Live snapshot — updated by realtime ticker.  Latest values only.
    current_status: Mapped[str] = mapped_column(String(16), nullable=False, default="idle")
    current_voltage: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    current_current: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    current_power: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    current_occupancy: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)

    operator_ref: Mapped[Operator] = relationship(back_populates="piles")
    region_ref: Mapped[Region] = relationship(back_populates="piles")


class Telemetry(Base):
    """Time-series telemetry, one row per pile per hour for history,
    one row per pile per realtime tick during live phase.
    """

    __tablename__ = "telemetry"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pile_id: Mapped[str] = mapped_column(ForeignKey("piles.id"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    voltage: Mapped[float] = mapped_column(Float, nullable=False)
    current: Mapped[float] = mapped_column(Float, nullable=False)
    power: Mapped[float] = mapped_column(Float, nullable=False)
    occupancy_rate: Mapped[float] = mapped_column(Float, nullable=False)
    energy_delivered_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)

    __table_args__ = (Index("ix_telemetry_pile_ts", "pile_id", "ts"),)


class Event(Base):
    """Event log: faults, communication losses, charging starts, etc."""

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pile_id: Mapped[str] = mapped_column(ForeignKey("piles.id"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="info")
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    duration_minutes: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    resolved: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
