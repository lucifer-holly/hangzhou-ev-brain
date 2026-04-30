# Plan A → Plan B Decision Record

## Context

`docs/spec.md` §4.5 / §7.4 specifies an INT8-quantised TFLite Micro
Autoencoder running on the ESP32 to score reconstruction error against
a 99-percentile threshold from training. The backend training pipeline produced the model
(`backend/ai/anomaly_detection/saved/autoencoder.{pt,onnx}`) but did
**not** produce a `.tflite` artifact.

## Why Plan A was deferred

1. **Conversion toolchain instability.** The backend's
   `quantize_tflite.py` already documents the brittleness:

   > "the TFLite toolchain on Apple Silicon + Python 3.14 is finicky"

   Its current best-effort fallback writes an `autoencoder.int8.onnx`
   instead of a `.tflite` because neither `onnx2tf` nor the
   `onnx-tf → tf.lite.TFLiteConverter` path completes cleanly on the
   developer machine.

2. **Runtime library decay.** `TensorFlowLite_ESP32` (the PlatformIO
   library bound for the v0.9.0 release) last published in 2021 and
   has compatibility breakage against current Arduino-ESP32 cores.

3. **Diminishing demo return.** This firmware is portfolio evidence,
   not a productionised inference path. Plan B keeps the architectural
   shape (multi-channel ring buffer, channel→fault-type classifier,
   MQTT event schema) so a future Plan A integration is a one-file
   swap.

## Plan B summary

`AnomalyDetector::check()` keeps a 32-sample ring buffer over 5
channels (V, I, T_cable, T_cabinet, |accel|). Per-tick we score each
channel as `|x − μ| / σ` against the rolling stats *prior to* writing
the new sample (so a spike does not pollute its own σ). If any channel
exceeds 3 σ (after a 4-sample warmup) we publish a fault event whose
`type` is determined by which channel scored highest.

## Reactivating Plan A in the future

Recipe (untested in this submission, recorded for the next maintainer):

```bash
python3.10 -m venv .venv-tflite
source .venv-tflite/bin/activate
pip install "tensorflow==2.13.*" "onnx==1.15.*" "onnx2tf==1.17.*"

cd backend/ai/anomaly_detection/saved
onnx2tf -i autoencoder.onnx -o tf_savedmodel/ -coion
python -c "
import tensorflow as tf
c = tf.lite.TFLiteConverter.from_saved_model('tf_savedmodel')
c.optimizations = [tf.lite.Optimize.DEFAULT]
c.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
c.inference_input_type = tf.int8
c.inference_output_type = tf.int8
c.representative_dataset = lambda: ([np.random.randn(1, 256).astype(np.float32)] for _ in range(100))
open('autoencoder_int8.tflite', 'wb').write(c.convert())
"
xxd -i autoencoder_int8.tflite > ../../../../firmware/pile-simulator/models/anomaly_model_data.cc
```

Then in `firmware/pile-simulator/`:

1. Add `tensorflow/TensorFlowLite_ESP32 @ ^0.9.0` to `lib_deps` in
   `platformio.ini` (or a maintained fork — see e.g.
   `https://github.com/atomic14/esp32-tflite-micro`).
2. Replace the body of `AnomalyDetector::check()` with a TFLite Micro
   inference call: feed the 256-D vector (5 channels padded to 8 +
   v_diff/i_diff/status_encoded), read reconstruction MSE, compare
   against the persisted threshold.
3. Keep the channel→fault-type classifier — it is orthogonal to the
   model itself.
