"""Train the LSTM demand model and persist a checkpoint.

Run from the backend root:

    python -m ai.lstm_demand.train

The script:

1. Loads tensors via :func:`ai.lstm_demand.data_loader.build_dataset`.
2. Trains for 20 epochs with Adam(lr=1e-3) on CPU (≈ 5 min on a laptop).
3. Saves ``saved/checkpoint.pt`` plus a training-loss PNG.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # headless: no GUI backend
import matplotlib.pyplot as plt
import numpy as np
import torch
from torch import nn, optim
from torch.utils.data import DataLoader, TensorDataset

from ai.lstm_demand.data_loader import build_dataset
from ai.lstm_demand.model import DemandLSTM

log = logging.getLogger("ai.lstm_demand.train")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

EPOCHS = 20
BATCH_SIZE = 256
LR = 1e-3
SAVED_DIR = Path(__file__).parent / "saved"
CHECKPOINT_PATH = SAVED_DIR / "checkpoint.pt"
LOSS_PLOT_PATH = SAVED_DIR / "training_loss.png"


def _to_loader(x: np.ndarray, y: np.ndarray, shuffle: bool) -> DataLoader:
    ds = TensorDataset(torch.from_numpy(x), torch.from_numpy(y).unsqueeze(1))
    return DataLoader(ds, batch_size=BATCH_SIZE, shuffle=shuffle, num_workers=0)


def main() -> None:
    SAVED_DIR.mkdir(parents=True, exist_ok=True)
    log.info("loading dataset from SQLite")
    bundle = build_dataset()
    log.info(
        "dataset shapes: x_train=%s x_val=%s x_test=%s",
        bundle.x_train.shape,
        bundle.x_val.shape,
        bundle.x_test.shape,
    )

    train_loader = _to_loader(bundle.x_train, bundle.y_train, shuffle=True)
    val_loader = _to_loader(bundle.x_val, bundle.y_val, shuffle=False)

    torch.manual_seed(42)
    model = DemandLSTM()
    opt = optim.Adam(model.parameters(), lr=LR)
    loss_fn = nn.MSELoss()

    train_losses: list[float] = []
    val_losses: list[float] = []

    for epoch in range(1, EPOCHS + 1):
        t0 = time.time()
        model.train()
        running = 0.0
        n_seen = 0
        for xb, yb in train_loader:
            opt.zero_grad()
            pred = model(xb)
            loss = loss_fn(pred, yb)
            loss.backward()
            opt.step()
            running += float(loss.item()) * xb.size(0)
            n_seen += xb.size(0)
        train_loss = running / max(n_seen, 1)

        model.eval()
        v_running = 0.0
        v_seen = 0
        with torch.no_grad():
            for xb, yb in val_loader:
                pred = model(xb)
                loss = loss_fn(pred, yb)
                v_running += float(loss.item()) * xb.size(0)
                v_seen += xb.size(0)
        val_loss = v_running / max(v_seen, 1)
        train_losses.append(train_loss)
        val_losses.append(val_loss)
        log.info(
            "epoch %02d/%02d train=%.5f val=%.5f (%.1fs)",
            epoch,
            EPOCHS,
            train_loss,
            val_loss,
            time.time() - t0,
        )

    log.info("saving checkpoint → %s", CHECKPOINT_PATH)
    torch.save(
        {
            "state_dict": model.state_dict(),
            "config": {
                "input_dim": model.input_dim,
                "hidden_dim": model.hidden_dim,
                "num_layers": model.num_layers,
            },
            "train_losses": train_losses,
            "val_losses": val_losses,
        },
        CHECKPOINT_PATH,
    )

    fig, ax = plt.subplots(figsize=(7, 4), dpi=110)
    ax.plot(range(1, EPOCHS + 1), train_losses, label="train MSE")
    ax.plot(range(1, EPOCHS + 1), val_losses, label="val MSE")
    ax.set_xlabel("epoch")
    ax.set_ylabel("MSE loss")
    ax.set_title("LSTM demand model training")
    ax.grid(True, alpha=0.3)
    ax.legend()
    fig.tight_layout()
    fig.savefig(LOSS_PLOT_PATH)
    plt.close(fig)
    log.info("loss curve → %s", LOSS_PLOT_PATH)


if __name__ == "__main__":
    main()
