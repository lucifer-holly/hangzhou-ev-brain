"""Per-pile autoencoder for anomaly detection (spec §7.4 / §4.5).

Architecture:

    input  : (batch, NUM_CHANNELS=8, SEQ_LEN=32) flattened to (batch, 256)
    encoder: 256 → 256 → ReLU → 16 → ReLU       (bottleneck)
    decoder: 16 → 256 → ReLU → 256              (reconstruction)

Anomaly score = reconstruction MSE per window.  Threshold is the 99-th
percentile of training-set scores, which we persist alongside the
weights so inference can tag windows without recomputing it.

The 8 channels are:
    0  voltage (normalised: V / 500)
    1  current (normalised: I / 400)
    2  power (normalised: kW / 250)
    3  occupancy_rate (already in [0, 1])
    4  energy_delivered_kwh (normalised: kWh / 250)
    5  V_diff (delta voltage between consecutive steps)
    6  I_diff (delta current)
    7  status_encoded (idle=0, charging=0.33, occupied=0.66, fault/offline=1.0)
"""

from __future__ import annotations

import torch
from torch import nn

NUM_CHANNELS: int = 8
SEQ_LEN: int = 32
AE_INPUT_DIM: int = NUM_CHANNELS * SEQ_LEN  # 256
AE_LATENT_DIM: int = 16


class PileAutoencoder(nn.Module):
    """Symmetric 256→256→16→256→256 autoencoder."""

    def __init__(
        self,
        input_dim: int = AE_INPUT_DIM,
        latent_dim: int = AE_LATENT_DIM,
    ) -> None:
        super().__init__()
        self.input_dim = input_dim
        self.latent_dim = latent_dim
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Linear(256, latent_dim),
            nn.ReLU(),
        )
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 256),
            nn.ReLU(),
            nn.Linear(256, input_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Accepts (batch, C, T) or (batch, C*T) — returns the same shape."""
        original_shape = x.shape
        if x.dim() == 3:
            flat = x.flatten(1)
        else:
            flat = x
        z = self.encoder(flat)
        out = self.decoder(z)
        return out.view(original_shape) if x.dim() == 3 else out

    def reconstruction_error(self, x: torch.Tensor) -> torch.Tensor:
        """Per-sample MSE.  Shape: (batch,)."""
        flat = x.flatten(1) if x.dim() == 3 else x
        recon = self.forward(flat)
        return ((recon - flat) ** 2).mean(dim=1)
