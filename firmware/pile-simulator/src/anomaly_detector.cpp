#include "anomaly_detector.h"

#include <math.h>

#include "sensor_reader.h"

namespace hzev {

namespace {

constexpr float Z_TRIP_THRESHOLD = 3.0f;          // 3σ trip rule (spec §7.4 echo)
constexpr float MIN_STDDEV       = 1e-3f;         // floor to avoid div-by-zero
constexpr unsigned long REFRACTORY_MS = 2000;      // de-bounce repeat trips

// Channel index mnemonics matching AnomalyDetector::kCh layout.
constexpr size_t CH_VOLTAGE = 0;
constexpr size_t CH_CURRENT = 1;
constexpr size_t CH_T_CABLE = 2;
constexpr size_t CH_T_CABIN = 3;
constexpr size_t CH_ACCEL   = 4;

// Map "which channel tripped hardest" → asyncapi PileFaultType.
struct TypeMap {
  AnomalyType type;
  const char* str;
  const char* message;
};

TypeMap classify_channel(size_t ch) {
  switch (ch) {
    case CH_VOLTAGE:
      return { AnomalyType::VoltageAnomaly, "voltage_anomaly",
               "Output voltage deviates from rolling mean (>3σ)." };
    case CH_CURRENT:
      return { AnomalyType::CableFault, "cable_fault",
               "Output current spike — possible contact resistance." };
    case CH_T_CABLE:
      return { AnomalyType::ThermalFault, "thermal_fault",
               "Cable temperature trending hot." };
    case CH_T_CABIN:
      return { AnomalyType::ThermalFault, "thermal_fault",
               "Cabinet temperature trending hot." };
    case CH_ACCEL:
      return { AnomalyType::VibrationEvent, "vibration_event",
               "Acceleration spike — possible impact / tamper." };
    default:
      return { AnomalyType::None, "none", "" };
  }
}

}  // namespace

void AnomalyDetector::stats(size_t ch, float* mean, float* stddev) const {
  if (filled_ < 4) {
    *mean = 0.0f;
    *stddev = MIN_STDDEV;
    return;
  }
  double sum = 0.0;
  for (size_t i = 0; i < filled_; ++i) sum += buf_[ch][i];
  const double mu = sum / filled_;
  double var = 0.0;
  for (size_t i = 0; i < filled_; ++i) {
    const double d = buf_[ch][i] - mu;
    var += d * d;
  }
  var /= filled_;
  *mean   = static_cast<float>(mu);
  *stddev = max(MIN_STDDEV, static_cast<float>(sqrt(var)));
}

void AnomalyDetector::reset() {
  head_ = 0;
  filled_ = 0;
  last_trip_ms_ = 0;
  for (size_t c = 0; c < kCh; ++c)
    for (size_t i = 0; i < kWin; ++i)
      buf_[c][i] = 0.0f;
}

AnomalyResult AnomalyDetector::check(const SensorData& s) {
  AnomalyResult out;

  // Push the newest reading first so stats reflect it.  We compute the
  // z-score *against the buffer prior to* this sample by holding back
  // the head advance until after scoring — a small but important detail
  // (otherwise the latest spike pollutes its own σ).
  const size_t scoring_filled = filled_;
  // Compute scores against the pre-write buffer.
  float worst_z = 0.0f;
  size_t worst_ch = 0;

  if (scoring_filled >= 4) {
    const float xs[kCh] = {
        s.voltage_v, s.current_a,
        s.cable_temp_c, s.cabinet_temp_c,
        s.accel_mag,
    };
    for (size_t c = 0; c < kCh; ++c) {
      float mu = 0.0f, sd = MIN_STDDEV;
      stats(c, &mu, &sd);
      const float z = fabsf(xs[c] - mu) / sd;
      if (z > worst_z) { worst_z = z; worst_ch = c; }
    }
  }

  // Now write the newest sample into the rolling buffer.
  push(CH_VOLTAGE, s.voltage_v);
  push(CH_CURRENT, s.current_a);
  push(CH_T_CABLE, s.cable_temp_c);
  push(CH_T_CABIN, s.cabinet_temp_c);
  push(CH_ACCEL,   s.accel_mag);
  advance();

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
