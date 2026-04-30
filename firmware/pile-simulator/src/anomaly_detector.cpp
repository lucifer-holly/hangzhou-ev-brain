#include "anomaly_detector.h"

#include <math.h>

#include "sensor_reader.h"

#if HZEV_USE_TFLITE
#  include "autoencoder_meta.h"
#  include "autoencoder_model.h"
#  include "tensorflow/lite/micro/all_ops_resolver.h"
#  include "tensorflow/lite/micro/micro_interpreter.h"
#  include "tensorflow/lite/micro/micro_log.h"
#  include "tensorflow/lite/micro/system_setup.h"
#  include "tensorflow/lite/schema/schema_generated.h"
#endif

namespace hzev {

// ---------------------------------------------------------------------------
// Common channel labelling (used by classifier output).
// ---------------------------------------------------------------------------
namespace {

constexpr float Z_TRIP_THRESHOLD = 3.0f;
constexpr float MIN_STDDEV       = 1e-3f;
constexpr unsigned long REFRACTORY_MS = 2000;

constexpr size_t CH_VOLTAGE = 0;
constexpr size_t CH_CURRENT = 1;
constexpr size_t CH_POWER   = 2;
constexpr size_t CH_OCC     = 3;
constexpr size_t CH_ENERGY  = 4;
constexpr size_t CH_VDIFF   = 5;
constexpr size_t CH_IDIFF   = 6;
constexpr size_t CH_STATUS  = 7;

struct TypeMap {
  AnomalyType type;
  const char* str;
  const char* message;
};

TypeMap classify_channel(size_t ch) {
  switch (ch) {
    case CH_VOLTAGE: case CH_VDIFF:
      return { AnomalyType::VoltageAnomaly, "voltage_anomaly",
               "Output voltage deviates from learned manifold." };
    case CH_CURRENT: case CH_IDIFF:
      return { AnomalyType::CableFault, "cable_fault",
               "Output current spike — possible contact resistance." };
    case CH_POWER:
      return { AnomalyType::CableFault, "cable_fault",
               "Power excursion — possible contactor fault." };
    case CH_ENERGY: case CH_OCC: case CH_STATUS:
      return { AnomalyType::VoltageAnomaly, "voltage_anomaly",
               "State transition outside learned distribution." };
    default:
      return { AnomalyType::None, "none", "" };
  }
}

// Status string → encoded scalar (matches model.py kStatusEncoding).
float status_encoded(bool plug, bool anomaly_latched) {
  if (anomaly_latched) return 1.0f;        // fault/offline
  if (!plug)           return 0.0f;        // idle
  return 0.33f;                            // charging (we do not yet have an
                                           // 'occupied' notion in firmware)
}

}  // namespace

// ---------------------------------------------------------------------------
// TFLite Micro state (Plan A only)
// ---------------------------------------------------------------------------
#if HZEV_USE_TFLITE

namespace {

// 32 KB tensor arena — comfortable for our 4-Dense-layer 256→16→256 net.
constexpr size_t kTensorArenaSize = 32 * 1024;
alignas(16) uint8_t g_tensor_arena[kTensorArenaSize];

const tflite::Model* g_model            = nullptr;
tflite::MicroInterpreter* g_interpreter = nullptr;
TfLiteTensor* g_input                   = nullptr;
TfLiteTensor* g_output                  = nullptr;

// Resolver lifetime: the interpreter holds a pointer, so the resolver must
// outlive the interpreter.  Static is fine for a single-instance detector.
tflite::AllOpsResolver* g_resolver = nullptr;

bool init_tflite() {
  g_model = tflite::GetModel(autoencoder_model_data);
  if (g_model->version() != TFLITE_SCHEMA_VERSION) {
    Serial.printf("[tflite] schema mismatch: model=%lu lib=%d\n",
                  (unsigned long)g_model->version(), TFLITE_SCHEMA_VERSION);
    return false;
  }

  static tflite::AllOpsResolver resolver;
  g_resolver = &resolver;

  static tflite::MicroInterpreter interp(
      g_model, *g_resolver, g_tensor_arena, kTensorArenaSize);
  g_interpreter = &interp;

  if (g_interpreter->AllocateTensors() != kTfLiteOk) {
    Serial.println(F("[tflite] AllocateTensors failed."));
    return false;
  }
  g_input  = g_interpreter->input(0);
  g_output = g_interpreter->output(0);
  Serial.printf("[tflite] arena used: %u / %u bytes\n",
                (unsigned)g_interpreter->arena_used_bytes(),
                (unsigned)kTensorArenaSize);
  Serial.printf("[tflite] input: %d dims, output: %d dims, threshold=%.6f\n",
                g_input->dims->size, g_output->dims->size, kAnomalyThreshold);
  return true;
}

}  // namespace

#endif  // HZEV_USE_TFLITE

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
bool AnomalyDetector::begin() {
#if HZEV_USE_TFLITE
  using_tflite_ = init_tflite();
  if (using_tflite_) {
    Serial.println(F("[anomaly] Plan A active — TFLite Micro Autoencoder."));
  } else {
    Serial.println(F("[anomaly] Plan A init failed → falling back to Plan B."));
  }
#else
  using_tflite_ = false;
  Serial.println(F("[anomaly] Plan B active — multi-channel z-score."));
#endif
  return true;
}

void AnomalyDetector::reset() {
  head_ = filled_ = 0;
  last_trip_ms_ = 0;
  last_inference_us_ = 0;
  prev_voltage_ = prev_current_ = 0.0f;
  for (size_t c = 0; c < kNumCh; ++c)
    for (size_t t = 0; t < kSeqLen; ++t)
      buf_[c][t] = 0.0f;
}

void AnomalyDetector::push_sample(const SensorData& s) {
  // Normalisations match backend/ai/anomaly_detection/model.py docstring.
  const float v   = s.voltage_v / 500.0f;
  const float i   = s.current_a / 400.0f;
  const float p   = (s.voltage_v * s.current_a / 1000.0f) / 250.0f;
  const float occ = s.plug_inserted ? 1.0f : 0.0f;
  // We do not track session energy here; pass occupancy as a proxy.
  const float e   = occ;
  const float vd  = (s.voltage_v - prev_voltage_) / 500.0f;
  const float id_ = (s.current_a - prev_current_) / 400.0f;
  const float st  = status_encoded(s.plug_inserted, false);
  prev_voltage_ = s.voltage_v;
  prev_current_ = s.current_a;

  buf_[CH_VOLTAGE][head_] = v;
  buf_[CH_CURRENT][head_] = i;
  buf_[CH_POWER  ][head_] = p;
  buf_[CH_OCC    ][head_] = occ;
  buf_[CH_ENERGY ][head_] = e;
  buf_[CH_VDIFF  ][head_] = vd;
  buf_[CH_IDIFF  ][head_] = id_;
  buf_[CH_STATUS ][head_] = st;

  head_ = (head_ + 1) % kSeqLen;
  if (filled_ < kSeqLen) ++filled_;
}

AnomalyResult AnomalyDetector::check(const SensorData& s) {
  push_sample(s);
  if (using_tflite_) {
    return plan_a_tflite_(s);
  }
  return plan_b_zscore_(s);
}

// ---------------------------------------------------------------------------
// Plan A: TFLite Micro reconstruction-error
// ---------------------------------------------------------------------------
AnomalyResult AnomalyDetector::plan_a_tflite_(const SensorData& s) {
  AnomalyResult out;
#if HZEV_USE_TFLITE
  if (g_interpreter == nullptr || filled_ < kSeqLen) return out;

  // Flatten ring buffer into the input tensor, channel-major then time.
  // Index = ch * kSeqLen + t, with t aligned so the most recent sample is
  // at the end of the window (matches training layout).
  float* dst = tflite::GetTensorData<float>(g_input);
  const size_t start = head_;  // oldest sample sits at head_
  for (size_t c = 0; c < kNumCh; ++c) {
    for (size_t t = 0; t < kSeqLen; ++t) {
      const size_t idx = (start + t) % kSeqLen;
      dst[c * kSeqLen + t] = buf_[c][idx];
    }
  }

  const unsigned long t0 = micros();
  if (g_interpreter->Invoke() != kTfLiteOk) {
    Serial.println(F("[tflite] Invoke failed."));
    return out;
  }
  const unsigned long t1 = micros();
  last_inference_us_ = t1 - t0;
  out.inference_us = last_inference_us_;

  // Reconstruction MSE.
  const float* recon = tflite::GetTensorData<float>(g_output);
  float mse = 0.0f;
  size_t worst_ch = 0;
  float worst_ch_err = 0.0f;
  for (size_t c = 0; c < kNumCh; ++c) {
    float ch_err = 0.0f;
    for (size_t t = 0; t < kSeqLen; ++t) {
      const float d = dst[c * kSeqLen + t] - recon[c * kSeqLen + t];
      ch_err += d * d;
    }
    ch_err /= kSeqLen;
    if (ch_err > worst_ch_err) { worst_ch_err = ch_err; worst_ch = c; }
    mse += ch_err;
  }
  mse /= kNumCh;
  out.score = mse;

  if (mse > kAnomalyThreshold &&
      (millis() - last_trip_ms_) > REFRACTORY_MS) {
    last_trip_ms_ = millis();
    const TypeMap m = classify_channel(worst_ch);
    out.is_anomaly = true;
    out.type       = m.type;
    out.type_str   = m.str;
    out.message    = m.message;
  }
#endif  // HZEV_USE_TFLITE
  return out;
}

// ---------------------------------------------------------------------------
// Plan B: per-channel z-score on raw physical units (cheaper, fallback)
// ---------------------------------------------------------------------------
namespace {
void zscore_stats(const float* col, size_t n, float* mean, float* sd) {
  if (n < 4) { *mean = 0.0f; *sd = MIN_STDDEV; return; }
  double sum = 0.0;
  for (size_t i = 0; i < n; ++i) sum += col[i];
  const double mu = sum / n;
  double var = 0.0;
  for (size_t i = 0; i < n; ++i) { const double d = col[i] - mu; var += d * d; }
  var /= n;
  *mean = static_cast<float>(mu);
  *sd   = max(MIN_STDDEV, static_cast<float>(sqrt(var)));
}
}  // namespace

AnomalyResult AnomalyDetector::plan_b_zscore_(const SensorData& s) {
  AnomalyResult out;
  if (filled_ < 4) return out;

  // Score the just-pushed sample on V, I, V_diff, I_diff (the channels that
  // actually move at our 10 Hz tick).  Matching the original z-score path logic
  // but driven by the new flat ring buffer.
  const struct { size_t ch; float val; } targets[] = {
      { CH_VOLTAGE, s.voltage_v / 500.0f },
      { CH_CURRENT, s.current_a / 400.0f },
      { CH_VDIFF,   buf_[CH_VDIFF][(head_ - 1 + kSeqLen) % kSeqLen] },
      { CH_IDIFF,   buf_[CH_IDIFF][(head_ - 1 + kSeqLen) % kSeqLen] },
  };
  float worst_z = 0.0f;
  size_t worst_ch = 0;
  for (auto& t : targets) {
    float mu = 0.0f, sd = MIN_STDDEV;
    zscore_stats(buf_[t.ch], filled_, &mu, &sd);
    const float z = fabsf(t.val - mu) / sd;
    if (z > worst_z) { worst_z = z; worst_ch = t.ch; }
  }
  out.score = worst_z;
  if (worst_z > Z_TRIP_THRESHOLD &&
      (millis() - last_trip_ms_) > REFRACTORY_MS) {
    last_trip_ms_ = millis();
    const TypeMap m = classify_channel(worst_ch);
    out.is_anomaly = true;
    out.type       = m.type;
    out.type_str   = m.str;
    out.message    = m.message;
  }
  return out;
}

}  // namespace hzev
