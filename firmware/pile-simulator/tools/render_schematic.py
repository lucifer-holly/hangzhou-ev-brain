"""Render a static SVG/PNG of the Wokwi diagram for the README.

Wokwi itself doesn't expose a server-side renderer for diagram.json so we
draw a stylised but faithful representation: parts shown as labelled boxes
in their actual top/left positions, connections as colour-coded lines.

Output: firmware/pile-simulator/docs/schematic.png
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt

REPO_ROOT  = Path(__file__).resolve().parents[3]
DIAGRAM    = REPO_ROOT / "firmware/pile-simulator/diagram.json"
OUT_PNG    = REPO_ROOT / "firmware/pile-simulator/docs/schematic.png"

# Approx pixel width × height per Wokwi part type (best-effort, for layout).
PART_SIZES = {
    "board-esp32-s3-devkitc-1": (160, 200),
    "wokwi-potentiometer":       (90, 60),
    "wokwi-ntc-temperature-sensor": (90, 60),
    "wokwi-pushbutton":          (70, 60),
    "wokwi-rgb-led":             (70, 60),
    "wokwi-servo":               (90, 60),
    "wokwi-buzzer":              (70, 60),
    "board-mpu6050":             (110, 70),
}

# Friendly labels.
PART_LABELS = {
    "board-esp32-s3-devkitc-1": "ESP32-S3\nDevKitC-1",
    "wokwi-potentiometer": "POT",
    "wokwi-ntc-temperature-sensor": "NTC",
    "wokwi-pushbutton": "BTN",
    "wokwi-rgb-led": "RGB",
    "wokwi-servo": "SERVO",
    "wokwi-buzzer": "BUZ",
    "board-mpu6050": "MPU6050\nIMU",
}

# Custom labels per id where helpful.
ID_LABELS = {
    "esp": "ESP32-S3\nDevKitC-1",
    "pot_voltage":   "POT\nvoltage\n(GPIO 1)",
    "pot_current":   "POT\ncurrent\n(GPIO 2)",
    "temp_cable":    "NTC\ncable T\n(GPIO 3)",
    "temp_cabinet":  "NTC\ncabinet T\n(GPIO 4)",
    "btn_plug":      "BTN\nPLUG\n(GPIO 5)",
    "btn_impact":    "BTN\nIMPACT\n(GPIO 6)",
    "led_status":    "RGB LED\n(17/18/19)",
    "servo_lock":    "SERVO\nlock\n(GPIO 10)",
    "buzzer":        "BUZZER\n(GPIO 11)",
    "imu":           "MPU6050\nI²C 8/9",
}


def main() -> int:
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    diagram = json.loads(DIAGRAM.read_text())

    fig, ax = plt.subplots(figsize=(13, 8), dpi=140)
    ax.set_facecolor("#0F1218")

    parts = {p["id"]: p for p in diagram["parts"]}

    # Build a quick anchor-point lookup from a part id.  Hand-tuned offsets
    # so labels don't collide.
    anchors = {}
    custom_offset = {
        "esp":          (-30, -100),  # board sits in the middle-bottom area
    }
    for p in diagram["parts"]:
        ptype = p["type"]
        w, h = PART_SIZES.get(ptype, (60, 60))
        x = float(p.get("left", 0))
        y = -float(p.get("top", 0))
        ox, oy = custom_offset.get(p["id"], (0, 0))
        anchors[p["id"]] = (x + ox, y + oy, w, h)

    # Draw connections first (under the boxes).
    palette = {
        "red":     "#E53935",
        "black":   "#444",
        "green":   "#43A047",
        "yellow":  "#FBC02D",
        "orange":  "#FB8C00",
        "blue":    "#1E88E5",
        "cyan":    "#00ACC1",
        "magenta": "#D81B60",
        "purple":  "#8E24AA",
    }
    for conn in diagram["connections"]:
        if len(conn) < 3:
            continue
        a, b, color = conn[0], conn[1], conn[2]
        a_id = a.split(":", 1)[0]
        b_id = b.split(":", 1)[0]
        if a_id not in anchors or b_id not in anchors:
            continue
        ax_, ay_, aw, ah = anchors[a_id]
        bx_, by_, bw, bh = anchors[b_id]
        ax_c, ay_c = ax_ + aw / 2, ay_
        bx_c, by_c = bx_ + bw / 2, by_
        ax.plot([ax_c, bx_c], [ay_c, by_c],
                color=palette.get(color, "#888"),
                linewidth=1.0, alpha=0.55, zorder=1)

    # Draw boxes.
    for pid, (x, y, w, h) in anchors.items():
        ptype = parts[pid]["type"]
        is_main = ptype == "board-esp32-s3-devkitc-1"
        face = "#1E2533" if is_main else "#283042"
        edge = "#00D4FF" if is_main else "#A0B0CC"
        rect = mpatches.FancyBboxPatch(
            (x, y), w, h,
            boxstyle="round,pad=0,rounding_size=8",
            linewidth=1.5,
            edgecolor=edge,
            facecolor=face,
            zorder=2,
        )
        ax.add_patch(rect)
        label = ID_LABELS.get(pid, PART_LABELS.get(ptype, pid))
        ax.text(x + w / 2, y + h / 2, label,
                ha="center", va="center",
                color="#FFFFFF", fontsize=8.5,
                fontweight="bold" if is_main else "normal",
                zorder=3)

    # Title.
    ax.text(0.5, 1.02,
            "HZ-EV Brain · Wokwi Schematic — 11 parts, 29 connections",
            transform=ax.transAxes, ha="center", va="bottom",
            color="#FFFFFF", fontsize=13, fontweight="bold")
    ax.text(0.5, 0.985,
            "ESP32-S3 + 2 pots + 2 NTC + 2 buttons + RGB LED + servo + buzzer + MPU6050",
            transform=ax.transAxes, ha="center", va="bottom",
            color="#A0B0CC", fontsize=9)

    ax.set_xlim(-260, 380)
    ax.set_ylim(-420, 220)
    ax.set_aspect("equal")
    ax.axis("off")
    plt.savefig(OUT_PNG, facecolor="#0F1218")
    plt.close()
    print(f"[schematic] wrote {OUT_PNG}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
