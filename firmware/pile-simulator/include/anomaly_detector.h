// Statistical anomaly detector — Plan B fallback for the Edge AI loop.
//
// Original spec (§7.4) calls for an INT8-quantised Autoencoder running under
// TensorFlow Lite Micro.  The trained model lives at
// backend/ai/anomaly_detection/saved/autoencoder.onnx but the ONNX→TFLite
// INT8 path is not stable on Apple Silicon + Python 3.14 (see backend
// quantize_tflite.py docstring) and the TensorFlowLite_ESP32 PlatformIO
// library has been unmaintained since 2021.
//
// This implementation keeps the architectural shape (multi-channel ring
// buffer → per-channel scoring → fused trip decision) so swapping in TFLite
// later is a drop-in replacement.  The score is a multi-channel Mahalanobis-
// like z-score: max |x - μ| / σ over a rolling window.

#pragma once

#include <Arduino.h>

#include "config.h"

namespace hzev {

struct SensorData;

// Mirrors PileFaultType in contracts/asyncapi.yaml.
enum class AnomalyType {
  None,
  VoltageAnomaly,
  ThermalFault,
  VibrationEvent,
  CableFault,
};

struct AnomalyResult {
  bool is_anomaly = false;
  float score = 0.0f;       // max z-score across channels
  AnomalyType type = AnomalyType::None;
  const char* type_str = "none";
  const char* message = "";
};

class AnomalyDetector {
 public:
  // Called once per control tick (10 Hz).  Mutates internal ring buffers,
  // returns the verdict for the latest sample.
  AnomalyResult check(const SensorData& s);

  // Resets the rolling stats — useful after a long offline period or when a
  // fault has been cleared by the cloud.
  void reset();

 private:
  static constexpr size_t kWin = ANOMALY_WINDOW_LEN;  // 32
  static constexpr size_t kCh  = 5;                   // V, I, T_cable, T_cabinet, |a|

  float buf_[kCh][kWin] = {};
  size_t head_ = 0;
  size_t filled_ = 0;
  unsigned long last_trip_ms_ = 0;

  void push(size_t ch, float x) {
    buf_[ch][head_] = x;
  }
  void advance() {
    head_ = (head_ + 1) % kWin;
    if (filled_ < kWin) ++filled_;
  }
  void stats(size_t ch, float* mean, float* stddev) const;
};

}  // namespace hzev
