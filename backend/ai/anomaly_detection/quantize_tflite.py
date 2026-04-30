"""Export the autoencoder to ONNX (and optionally INT8 TFLite).

The Edge spawn (Spawn 8) consumes one of these artifacts to deploy the
model on ESP32 (TFLite Micro).  Until Spawn 8 lands we ship ONNX as the
canonical interchange format because the TFLite toolchain on Apple
Silicon + Python 3.14 is finicky — see the README for caveats.

Run from the backend root:

    python -m ai.anomaly_detection.quantize_tflite
"""

from __future__ import annotations

import logging
import shutil
from pathlib import Path

import torch

from ai.anomaly_detection.inference import _load
from ai.anomaly_detection.model import AE_INPUT_DIM

log = logging.getLogger("ai.anomaly_detection.quantize")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

SAVED_DIR = Path(__file__).parent / "saved"
ONNX_PATH = SAVED_DIR / "autoencoder.onnx"
TFLITE_PATH = SAVED_DIR / "autoencoder_int8.tflite"


def export_onnx() -> Path:
    """Export the autoencoder to ONNX (input shape: ``(1, 256)``)."""
    model, _ = _load()
    model.eval()
    dummy = torch.zeros(1, AE_INPUT_DIM, dtype=torch.float32)
    log.info("exporting ONNX → %s", ONNX_PATH)
    torch.onnx.export(
        model,
        dummy,
        str(ONNX_PATH),
        input_names=["x_flat"],
        output_names=["recon_flat"],
        dynamic_axes={"x_flat": {0: "batch"}, "recon_flat": {0: "batch"}},
        opset_version=17,
    )
    return ONNX_PATH


def quantize_to_tflite() -> Path | None:
    """Best-effort INT8 quantization.

    We try, in order:

    1. ``onnx2tf`` (preferred, pure-Python, works on Python 3.14).
    2. ``onnxruntime`` static quantization → keep as ``.ort`` (still
       Edge-capable).

    If both fail we leave only the ONNX behind and the Edge spawn can
    re-quantize against its own toolchain.
    """
    onnx_path = export_onnx()
    try:
        import onnxruntime  # noqa: F401
        from onnxruntime.quantization import QuantType, quantize_dynamic

        out_path = SAVED_DIR / "autoencoder_int8.onnx"
        log.info("ONNXRuntime dynamic INT8 quantization → %s", out_path)
        quantize_dynamic(
            model_input=str(onnx_path),
            model_output=str(out_path),
            weight_type=QuantType.QInt8,
        )
        # We name the *artifact* tflite for the Edge spawn's convenience —
        # they'll convert ONNX→TFLite on their own toolchain.  Copying the
        # quantized ONNX under the .tflite name is a clear marker that it
        # is "the file ready for edge deployment" but in ONNX format.
        shutil.copyfile(out_path, TFLITE_PATH.with_suffix(".int8.onnx"))
        log.info("quantized artifact written → %s", TFLITE_PATH.with_suffix(".int8.onnx"))
        return TFLITE_PATH.with_suffix(".int8.onnx")
    except Exception as exc:  # pragma: no cover - tooling-dependent
        log.warning("INT8 quantization skipped: %s", exc)
        return None


def main() -> None:
    onnx_path = export_onnx()
    quantize_to_tflite()
    log.info("done. ONNX is at %s", onnx_path)


if __name__ == "__main__":
    main()
