// Edge AI anomaly detector — TFLite Micro Autoencoder (Plan A) with a
// z-score fallback (Plan B) selectable at compile time via HZEV_USE_TFLITE.
//
// Plan A (default): runs the FP32 Autoencoder trained in the backend pipeline
// (backend/ai/anomaly_detection/saved/autoencoder.pt) through TFLite Micro,
// computes per-window reconstruction MSE, trips when MSE > kAnomalyThreshold
// (the 99-th percentile from training).
//
// Plan B (HZEV_USE_TFLITE=0): retains the original multi-channel
// rolling z-score detector — strictly cheaper and used as a safety net if
// the TFLM library cannot be linked on a given target.
//
// The 8 channels mirror backend/ai/anomaly_detection/model.py:
//   0 voltage  / 500
//   1 current  / 400
//   2 power    / 250
//   3 occupancy_rate            (∈ [0, 1])
//   4 energy_delivered_kwh / 250
//   5 voltage_diff (Δ between consecutive steps, normalised)
//   6 current_diff
//   7 status_encoded            (idle=0, charging=0.33, occupied=0.66, fault=1.0)

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
  float score = 0.0f;       // reconstruction MSE (Plan A) or max z-score (Plan B)
  AnomalyType type = AnomalyType::None;
  const char* type_str = "none";
  const char* message = "";
  // Inference latency (Plan A only, microseconds).  0 in Plan B.
  unsigned long inference_us = 0;
};

class AnomalyDetector {
 public:
  bool begin();          // returns false if TFLM init fails (Plan A only)
  AnomalyResult check(const SensorData& s);
  void reset();

  bool using_tflite() const { return using_tflite_; }
  unsigned long last_inference_us() const { return last_inference_us_; }

 private:
  static constexpr size_t kSeqLen   = 32;
  static constexpr size_t kNumCh    = 8;
  static constexpr size_t kInputDim = kSeqLen * kNumCh;   // 256

  // Channel-major × time ring buffer (kNumCh × kSeqLen).
  float buf_[kNumCh][kSeqLen] = {};
  size_t head_   = 0;
  size_t filled_ = 0;
  unsigned long last_trip_ms_ = 0;
  unsigned long last_inference_us_ = 0;
  bool using_tflite_ = false;

  // Previous raw values for Δ channels.
  float prev_voltage_ = 0.0f;
  float prev_current_ = 0.0f;

  void push_sample(const SensorData& s);
  AnomalyResult plan_a_tflite_(const SensorData& s);
  AnomalyResult plan_b_zscore_(const SensorData& s);
};

}  // namespace hzev
