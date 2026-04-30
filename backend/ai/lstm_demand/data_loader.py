"""Build LSTM training tensors directly from the seeded SQLite database.

Strategy:

* Pull 30 days × 100 piles of hourly telemetry (≈72k rows) into a Pandas
  DataFrame, sorted by ``(pile_id, ts)``.
* Pre-compute 5 km neighbours per pile so the 8-th feature
  (``neighbor_avg_occupancy``) is the mean occupancy of nearby piles
  *for the same hour*.
* Slide a 24-hour window: the window is the input ``X`` and the next
  hour's ``occupancy_rate`` is the label ``y``.
* Time-based split: oldest 70 % → train, next 15 % → val, last 15 %
  → test.  We split on the per-window ``label_ts`` rather than randomly
  shuffling so the test set is always strictly *after* the training
  data — which is the only meaningful evaluation for forecasting.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import NamedTuple

import numpy as np
import pandas as pd
from sqlalchemy import select

from ai.lstm_demand.model import INPUT_DIM, SEQ_LEN
from api import models
from api.database import SyncSession

_FUTURE_TECH_REGION_ID = "future_tech_city"
_NEIGHBOR_RADIUS_KM = 5.0


class TensorBundle(NamedTuple):
    """Numpy splits ready to be turned into torch tensors."""

    x_train: np.ndarray
    y_train: np.ndarray
    x_val: np.ndarray
    y_val: np.ndarray
    x_test: np.ndarray
    y_test: np.ndarray


@dataclass(frozen=True, slots=True)
class _PileMeta:
    pile_id: str
    region_id: str
    capacity_kw: float
    lat: float
    lng: float


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r_earth = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r_earth * math.asin(math.sqrt(a))


def _load_pile_meta() -> list[_PileMeta]:
    with SyncSession() as session:
        rows = session.execute(
            select(
                models.Pile.id,
                models.Pile.region_id,
                models.Pile.capacity_kw,
                models.Pile.lat,
                models.Pile.lng,
            )
        ).all()
    return [_PileMeta(r[0], r[1], r[2], r[3], r[4]) for r in rows]


def _load_telemetry_df() -> pd.DataFrame:
    """Pull all hourly telemetry into a tidy DataFrame.

    Columns: pile_id · ts · occupancy_rate · power · capacity_kw · region_id
    """
    with SyncSession() as session:
        rows = session.execute(
            select(
                models.Telemetry.pile_id,
                models.Telemetry.ts,
                models.Telemetry.occupancy_rate,
                models.Telemetry.power,
                models.Pile.capacity_kw,
                models.Pile.region_id,
                models.Pile.lat,
                models.Pile.lng,
            ).join(models.Pile, models.Telemetry.pile_id == models.Pile.id)
        ).all()
    df = pd.DataFrame(
        rows,
        columns=[
            "pile_id",
            "ts",
            "occupancy_rate",
            "power",
            "capacity_kw",
            "region_id",
            "lat",
            "lng",
        ],
    )
    df["ts"] = pd.to_datetime(df["ts"])
    df = df.sort_values(["pile_id", "ts"]).reset_index(drop=True)
    return df


def _build_neighbor_map(meta: list[_PileMeta], radius_km: float) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for a in meta:
        neighbors: list[str] = []
        for b in meta:
            if a.pile_id == b.pile_id:
                continue
            if _haversine_km(a.lat, a.lng, b.lat, b.lng) <= radius_km:
                neighbors.append(b.pile_id)
        out[a.pile_id] = neighbors
    return out


def _augment_features(df: pd.DataFrame, neighbors: dict[str, list[str]]) -> pd.DataFrame:
    """Add the 8 model features to the long-form DataFrame."""
    df = df.copy()
    df["power_normalized"] = (df["power"] / df["capacity_kw"]).clip(0.0, 1.0)
    hours = df["ts"].dt.hour
    df["hour_sin"] = np.sin(2 * np.pi * hours / 24.0)
    df["hour_cos"] = np.cos(2 * np.pi * hours / 24.0)
    df["is_weekend"] = (df["ts"].dt.weekday >= 5).astype(np.float32)
    df["is_holiday"] = 0.0
    df["region_one_hot"] = (df["region_id"] == _FUTURE_TECH_REGION_ID).astype(np.float32)

    # Neighbor avg occupancy at each ts: pivot by ts so we can average per group.
    pivot = df.pivot_table(index="ts", columns="pile_id", values="occupancy_rate", aggfunc="mean")
    neighbor_means: list[float] = []
    for _, row in df[["pile_id", "ts"]].iterrows():
        peers = neighbors.get(row["pile_id"], [])
        if not peers:
            neighbor_means.append(0.0)
            continue
        try:
            vals = pivot.loc[row["ts"], peers].dropna()
        except KeyError:
            neighbor_means.append(0.0)
            continue
        neighbor_means.append(float(vals.mean()) if len(vals) else 0.0)
    df["neighbor_avg_occupancy"] = neighbor_means
    return df


def _build_windows(df: pd.DataFrame, seq_len: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Slide ``seq_len``-step windows per pile, return (X, y, label_ts)."""
    feature_cols = [
        "occupancy_rate",
        "power_normalized",
        "hour_sin",
        "hour_cos",
        "is_weekend",
        "is_holiday",
        "region_one_hot",
        "neighbor_avg_occupancy",
    ]
    xs: list[np.ndarray] = []
    ys: list[float] = []
    label_ts: list[pd.Timestamp] = []
    for _, group in df.groupby("pile_id"):
        arr = group[feature_cols].to_numpy(dtype=np.float32)
        targets = group["occupancy_rate"].to_numpy(dtype=np.float32)
        ts_arr = group["ts"].to_numpy()
        n = len(arr)
        if n <= seq_len:
            continue
        for i in range(n - seq_len):
            xs.append(arr[i : i + seq_len])
            ys.append(targets[i + seq_len])
            label_ts.append(ts_arr[i + seq_len])
    return (
        np.stack(xs).astype(np.float32),
        np.asarray(ys, dtype=np.float32),
        np.asarray(label_ts),
    )


def _time_split(x: np.ndarray, y: np.ndarray, ts: np.ndarray) -> TensorBundle:
    """70/15/15 split sorted by label timestamp (no leakage)."""
    order = np.argsort(ts)
    x = x[order]
    y = y[order]
    n = len(y)
    n_train = int(n * 0.70)
    n_val = int(n * 0.85)
    return TensorBundle(
        x_train=x[:n_train],
        y_train=y[:n_train],
        x_val=x[n_train:n_val],
        y_val=y[n_train:n_val],
        x_test=x[n_val:],
        y_test=y[n_val:],
    )


def build_dataset() -> TensorBundle:
    """End-to-end builder used by :mod:`ai.lstm_demand.train`."""
    meta = _load_pile_meta()
    if not meta:
        raise RuntimeError(
            "no piles in DB — run `python -m db.seed` first to populate synthetic data"
        )
    neighbors = _build_neighbor_map(meta, _NEIGHBOR_RADIUS_KM)
    df = _load_telemetry_df()
    df = _augment_features(df, neighbors)
    if INPUT_DIM != 8:  # keep the file self-consistent
        raise AssertionError("feature engineering is hard-coded to 8 dims")
    x, y, label_ts = _build_windows(df, SEQ_LEN)
    return _time_split(x, y, label_ts)


def latest_window_for_pile(pile_id: str) -> np.ndarray | None:
    """Return the most recent (24, 8) window for ``pile_id``, or None.

    Used by :mod:`ai.lstm_demand.inference` to score live predictions.
    """
    meta = _load_pile_meta()
    if not meta:
        return None
    neighbors = _build_neighbor_map(meta, _NEIGHBOR_RADIUS_KM)
    df = _load_telemetry_df()
    df = _augment_features(df, neighbors)
    pile_df = df[df["pile_id"] == pile_id].sort_values("ts")
    if len(pile_df) < SEQ_LEN:
        return None
    feature_cols = [
        "occupancy_rate",
        "power_normalized",
        "hour_sin",
        "hour_cos",
        "is_weekend",
        "is_holiday",
        "region_one_hot",
        "neighbor_avg_occupancy",
    ]
    return pile_df[feature_cols].to_numpy(dtype=np.float32)[-SEQ_LEN:]
