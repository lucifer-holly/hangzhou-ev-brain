"""Sliding-window dataset for the anomaly autoencoder.

Per spec §7.4 we train on *normal* windows only.  We mark a (pile, hour)
as anomalous if it falls inside any fault event window in the ``events``
table — those windows go into the eval set as positives.  Communication-
loss events are excluded since they zero out telemetry and would dominate
the reconstruction error trivially.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from sqlalchemy import select

from ai.anomaly_detection.model import NUM_CHANNELS, SEQ_LEN
from api import models
from api.database import SyncSession

_EXCLUDE_EVENT_TYPES = ("communication_loss", "charging_start", "charging_end")
_FAULT_EVENT_TYPES = ("voltage_anomaly", "thermal_fault", "vibration_event", "cable_fault")

_STATUS_MAP = {"idle": 0.0, "charging": 0.33, "occupied": 0.66, "fault": 1.0, "offline": 1.0}


@dataclass(frozen=True, slots=True)
class WindowSet:
    """Normal training windows + injected anomaly + clean evaluation windows."""

    normal: np.ndarray  # (n_train, C, T)
    fault_eval: np.ndarray  # (n_fault_eval, C, T)
    normal_eval: np.ndarray  # (n_normal_eval, C, T)


def _load_telemetry_with_status() -> pd.DataFrame:
    with SyncSession() as session:
        rows = session.execute(
            select(
                models.Telemetry.pile_id,
                models.Telemetry.ts,
                models.Telemetry.voltage,
                models.Telemetry.current,
                models.Telemetry.power,
                models.Telemetry.occupancy_rate,
                models.Telemetry.energy_delivered_kwh,
                models.Telemetry.status,
            )
        ).all()
    df = pd.DataFrame(
        rows,
        columns=[
            "pile_id",
            "ts",
            "voltage",
            "current",
            "power",
            "occupancy_rate",
            "energy_delivered_kwh",
            "status",
        ],
    )
    df["ts"] = pd.to_datetime(df["ts"])
    df = df.sort_values(["pile_id", "ts"]).reset_index(drop=True)
    return df


def _load_fault_intervals() -> dict[str, list[tuple[datetime, datetime]]]:
    """Return ``pile_id → [(start, end)]`` for fault events."""
    with SyncSession() as session:
        rows = session.execute(
            select(
                models.Event.pile_id,
                models.Event.ts,
                models.Event.duration_minutes,
                models.Event.type,
            ).where(models.Event.type.in_(_FAULT_EVENT_TYPES))
        ).all()
    intervals: dict[str, list[tuple[datetime, datetime]]] = {}
    for pile_id, ts, dur, _typ in rows:
        end = ts + timedelta(minutes=float(dur))
        intervals.setdefault(pile_id, []).append((ts, end))
    return intervals


def _to_channels(df_pile: pd.DataFrame) -> np.ndarray:
    """Build the 8-channel time series for a single pile (T, 8)."""
    voltage = df_pile["voltage"].to_numpy(dtype=np.float32) / 500.0
    current = df_pile["current"].to_numpy(dtype=np.float32) / 400.0
    power = df_pile["power"].to_numpy(dtype=np.float32) / 250.0
    occupancy = df_pile["occupancy_rate"].to_numpy(dtype=np.float32)
    energy = df_pile["energy_delivered_kwh"].to_numpy(dtype=np.float32) / 250.0
    v_diff = np.diff(voltage, prepend=voltage[:1]).astype(np.float32)
    i_diff = np.diff(current, prepend=current[:1]).astype(np.float32)
    status = np.asarray(
        [_STATUS_MAP.get(s, 0.0) for s in df_pile["status"].tolist()],
        dtype=np.float32,
    )
    return np.stack([voltage, current, power, occupancy, energy, v_diff, i_diff, status], axis=1)


def build_dataset(
    seq_len: int = SEQ_LEN,
    anomaly_per_pile_cap: int = 5,
    seed: int = 42,
    min_fault_overlap_steps: int = 4,
) -> WindowSet:
    """Construct training and eval window sets from the seeded DB.

    A window is treated as a *fault example* only if at least
    ``min_fault_overlap_steps`` of its 32 hourly steps fall inside a fault
    interval — otherwise the window is mostly normal and shouldn't dilute
    the positive class.  Windows with a smaller overlap are discarded
    from both classes (to keep the negative class clean).
    """
    df = _load_telemetry_with_status()
    fault_intervals = _load_fault_intervals()
    rng = np.random.default_rng(seed)

    # Pre-compute per-pile timestamp → fault flag arrays for fast lookup.
    fault_flag_by_pile: dict[str, np.ndarray] = {}
    for pile_id, group in df.groupby("pile_id"):
        ts = group["ts"].to_numpy()
        flag = np.zeros(len(ts), dtype=bool)
        for s, e in fault_intervals.get(pile_id, []):
            s_np = np.datetime64(s.replace(tzinfo=None))
            e_np = np.datetime64(e.replace(tzinfo=None))
            flag |= (ts >= s_np) & (ts <= e_np)
        fault_flag_by_pile[pile_id] = flag

    normal_windows: list[np.ndarray] = []
    fault_windows: list[np.ndarray] = []

    for pile_id, group in df.groupby("pile_id"):
        if len(group) < seq_len:
            continue
        flags = fault_flag_by_pile[pile_id]
        channels = _to_channels(group)  # (T, 8)
        if channels.shape[0] < seq_len:
            continue

        per_pile_anom = 0
        for start in range(0, channels.shape[0] - seq_len, 1):
            window = channels[start : start + seq_len].T  # (8, T)
            overlap = int(flags[start : start + seq_len].sum())
            if overlap == 0:
                normal_windows.append(window)
            elif overlap >= min_fault_overlap_steps and per_pile_anom < anomaly_per_pile_cap:
                fault_windows.append(window)
                per_pile_anom += 1
            # else: partial-overlap windows are dropped to keep classes clean.

    normal = (
        np.stack(normal_windows).astype(np.float32)
        if normal_windows
        else np.empty((0, NUM_CHANNELS, seq_len), dtype=np.float32)
    )
    faults = (
        np.stack(fault_windows).astype(np.float32)
        if fault_windows
        else np.empty((0, NUM_CHANNELS, seq_len), dtype=np.float32)
    )

    n_normal_eval = (
        min(len(faults), len(normal) // 4) if len(faults) else min(200, len(normal) // 4)
    )
    if len(normal) and n_normal_eval > 0:
        idx = rng.choice(len(normal), size=n_normal_eval, replace=False)
        normal_eval = normal[idx]
        keep = np.ones(len(normal), dtype=bool)
        keep[idx] = False
        normal = normal[keep]
    else:
        normal_eval = normal[:0]

    return WindowSet(
        normal=normal,
        fault_eval=faults,
        normal_eval=normal_eval,
    )


def latest_window_for_pile(pile_id: str) -> np.ndarray | None:
    """Return the most recent (8, 32) window for a pile, normalised."""
    df = _load_telemetry_with_status()
    pile_df = df[df["pile_id"] == pile_id].sort_values("ts")
    if len(pile_df) < SEQ_LEN:
        return None
    channels = _to_channels(pile_df)
    return channels[-SEQ_LEN:].T.astype(np.float32)
