"""Pydantic v2 request / response schemas.

These drive the auto-generated OpenAPI document at ``/docs``.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PileStatus = Literal["idle", "charging", "occupied", "fault", "offline"]
EventType = Literal[
    "voltage_anomaly",
    "thermal_fault",
    "vibration_event",
    "cable_fault",
    "communication_loss",
    "charging_start",
    "charging_end",
]


class _OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Operator ---


class OperatorOut(_OrmModel):
    id: str = Field(..., description="Operator slug, e.g. 'state_grid'.")
    name_zh: str
    name_en: str
    market_share: float = Field(..., ge=0, le=1)
    color: str
    pile_count: int | None = Field(default=None, description="Number of piles owned.")


# --- Region ---


class RegionOut(_OrmModel):
    id: str
    name_zh: str
    name_en: str
    center_lat: float
    center_lng: float
    radius_km: float
    description: str
    pile_count: int | None = None


# --- Pile ---


class PileOut(_OrmModel):
    id: str
    operator_id: str
    region_id: str
    lat: float
    lng: float
    capacity_kw: float
    connector_type: str
    installed_at: datetime
    subsidy_amount: float
    subsidy_group: Literal["treatment", "control"]
    current_status: PileStatus
    current_voltage: float
    current_current: float
    current_power: float
    current_occupancy: float = Field(..., ge=0, le=1)
    last_seen_at: datetime


class PileSummary24h(BaseModel):
    avg_occupancy: float = Field(..., ge=0, le=1)
    peak_occupancy: float = Field(..., ge=0, le=1)
    total_energy_kwh: float
    fault_count: int
    sample_count: int


class PileDetail(PileOut):
    summary_24h: PileSummary24h


# --- Telemetry ---


class TelemetryPoint(_OrmModel):
    ts: datetime
    voltage: float
    current: float
    power: float
    occupancy_rate: float = Field(..., ge=0, le=1)
    energy_delivered_kwh: float
    status: PileStatus


# --- Event ---


class EventOut(_OrmModel):
    id: int
    pile_id: str
    ts: datetime
    type: EventType
    severity: Literal["info", "warning", "critical"]
    message: str
    duration_minutes: float
    resolved: bool

    @classmethod
    def model_validate_orm(cls, obj):  # type: ignore[override]
        # SQLAlchemy stores resolved as int; coerce.
        data = {
            "id": obj.id,
            "pile_id": obj.pile_id,
            "ts": obj.ts,
            "type": obj.type,
            "severity": obj.severity,
            "message": obj.message,
            "duration_minutes": obj.duration_minutes,
            "resolved": bool(obj.resolved),
        }
        return cls.model_validate(data)


# --- WebSocket envelope ---


class WSMessage(BaseModel):
    type: Literal["telemetry", "event", "tick"]
    pile_id: str | None = None
    timestamp: datetime
    data: dict
