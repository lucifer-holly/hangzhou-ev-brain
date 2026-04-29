"""LSTM demand prediction network.

Architecture (per spec §7.2):
    Input  : (batch, 24, 8)         past 24 hours × 8 features
    LSTM   : hidden=64, layers=2
    FC     : 64 → 32 → 1 → Sigmoid
    Output : (batch, 1)             expected occupancy in next hour ∈ [0, 1]

Feature ordering (kept in sync with :mod:`ai.lstm_demand.data_loader`):
    0. occupancy_rate        ∈ [0, 1]
    1. power_normalized      = current_power / capacity_kw      ∈ [0, 1]
    2. hour_sin              = sin(2π · hour / 24)              ∈ [-1, 1]
    3. hour_cos              = cos(2π · hour / 24)              ∈ [-1, 1]
    4. is_weekend            ∈ {0, 1}
    5. is_holiday            ∈ {0, 1}    (always 0 in synth data)
    6. region_one_hot        ∈ {0, 1}    (1 = future_tech_city)
    7. neighbor_avg_occupancy ∈ [0, 1]
"""

from __future__ import annotations

import torch
from torch import nn

INPUT_DIM: int = 8
SEQ_LEN: int = 24
HIDDEN_DIM: int = 64
NUM_LAYERS: int = 2


class DemandLSTM(nn.Module):
    """Two-layer LSTM with a small MLP head producing a sigmoid scalar."""

    def __init__(
        self,
        input_dim: int = INPUT_DIM,
        hidden_dim: int = HIDDEN_DIM,
        num_layers: int = NUM_LAYERS,
    ) -> None:
        super().__init__()
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
        )
        self.head = nn.Sequential(
            nn.Linear(hidden_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:  # (B, T, F) → (B, 1)
        _, (h, _) = self.lstm(x)
        return self.head(h[-1])
