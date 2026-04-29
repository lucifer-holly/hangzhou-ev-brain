// HZ-EV Brain · Pile Simulator — entry point.
//
// Wokwi-runnable ESP32-S3 firmware that simulates a single DC fast-charging
// pile.  Pipeline (10 Hz inner loop, 1 Hz telemetry):
//
//   sensors → PID(CC|CV) → ×fuzzy_k → PWM duty %
//                              ↓
//   sensors → anomaly detector → event publish
//                              ↓
//   1 Hz: MQTT telemetry → pile/{id}/telemetry

#include <Arduino.h>

#include "anomaly_detector.h"
#include "config.h"
#include "fuzzy_logic.h"
#include "mqtt_publisher.h"
#include "pid_controller.h"
#include "sensor_reader.h"
#include "status_indicator.h"

using namespace hzev;

namespace {

PidController g_pid_current(PID_KP, PID_KI, PID_KD);
PidController g_pid_voltage(0.10f, 0.40f, 0.005f);
FuzzyController g_fuzzy;
AnomalyDetector g_anomaly;

unsigned long g_last_control_ms   = 0;
unsigned long g_last_telemetry_ms = 0;
unsigned long g_last_anomaly_clear_ms = 0;

// Latest control output (0..1 duty).
float g_last_duty = 0.0f;
float g_last_fuzzy_k = 1.0f;
float g_session_energy_kwh = 0.0f;
bool  g_anomaly_latched = false;
PileMode g_mode = PileMode::Idle;

const char* mode_to_status(PileMode m, bool anomaly) {
  if (anomaly)                       return "fault";
  switch (m) {
    case PileMode::Idle:     return "idle";
    case PileMode::Charging: return "charging";
    case PileMode::Throttled:return "occupied";   // de-rated but still serving
    case PileMode::Anomaly:  return "fault";
  }
  return "idle";
}

PileMode classify(const SensorData& s, float fuzzy_k, bool anomaly) {
  if (anomaly)             return PileMode::Anomaly;
  if (!s.plug_inserted)    return PileMode::Idle;
  if (fuzzy_k < 0.85f)     return PileMode::Throttled;
  return PileMode::Charging;
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(200);

  Serial.println();
  Serial.println(F("==========================================="));
  Serial.println(F("HZ-EV Brain · Pile Simulator"));
  Serial.print(F("  pile_id : ")); Serial.println(F(HZEV_PILE_ID));
  Serial.print(F("  firmware: ")); Serial.println(F(HZEV_FIRMWARE_VERSION));
  Serial.println(F("==========================================="));

  sensor_init();
  status_init();
  g_anomaly.begin();
  mqtt_init();
  Serial.println(F("[main] init complete; entering control loop."));
}

void loop() {
  mqtt_loop();
  const unsigned long now = millis();

  // -------- 10 Hz inner loop: sensors → control law → anomaly -------------
  if (now - g_last_control_ms >= CONTROL_PERIOD_MS) {
    const float dt_s = (now - g_last_control_ms) / 1000.0f;
    g_last_control_ms = now;

    const SensorData s = sensor_read();

    // Stage selection.
    const bool in_cv_stage = s.voltage_v > CV_TRANSITION_V;
    float pid_out = 0.0f;
    if (s.plug_inserted) {
      if (in_cv_stage) {
        pid_out = g_pid_voltage.compute(CV_TARGET_VOLTAGE_V, s.voltage_v);
      } else {
        pid_out = g_pid_current.compute(CC_TARGET_CURRENT_A / CURRENT_FULL_SCALE,
                                        s.current_a / CURRENT_FULL_SCALE);
      }
    } else {
      g_pid_current.reset();
      g_pid_voltage.reset();
      // Forget any latched anomaly once the user unplugs and replugs.
      if (g_anomaly_latched && (now - g_last_anomaly_clear_ms) > 3000) {
        g_anomaly_latched = false;
        g_anomaly.reset();
      }
    }

    // Fuzzy de-rate gate.
    const float fuzzy_k = g_fuzzy.computePowerCoefficient(
        s.cable_temp_c, s.cabinet_temp_c, mqtt_grid_pressure());
    float duty = pid_out * fuzzy_k;
    if (duty < 0.0f) duty = 0.0f;
    if (duty > 1.0f) duty = 1.0f;

    g_last_duty    = duty;
    g_last_fuzzy_k = fuzzy_k;

    // Anomaly check on the same sample.
    AnomalyResult anomaly = g_anomaly.check(s);
    if (anomaly.is_anomaly) {
      g_anomaly_latched = true;
      g_last_anomaly_clear_ms = now;
      mqtt_publish_event(anomaly);
      status_beep(300);
      Serial.printf("[anomaly] type=%s score=%.2f msg=\"%s\"\n",
                    anomaly.type_str, anomaly.score, anomaly.message);
    }

    g_mode = classify(s, fuzzy_k, g_anomaly_latched);
    status_update(g_mode, s.plug_inserted);

    // Energy accumulator (Wh = V × A × dt_h / 1000).
    if (s.plug_inserted) {
      g_session_energy_kwh += (s.voltage_v * s.current_a * dt_s / 3600.0f) / 1000.0f;
    } else if (g_session_energy_kwh > 0.0f && !s.plug_inserted) {
      g_session_energy_kwh = 0.0f;
    }
  }

  // -------- 1 Hz outer loop: telemetry publish + serial trace --------------
  if (now - g_last_telemetry_ms >= TELEMETRY_PERIOD_MS) {
    g_last_telemetry_ms = now;
    const SensorData s = sensor_read();
    const char* status_str = mode_to_status(g_mode, g_anomaly_latched);
    bool ok = mqtt_publish_telemetry(s, g_last_duty, g_last_fuzzy_k,
                                     g_session_energy_kwh, status_str);
    const unsigned long inf_us = g_anomaly.last_inference_us();
    Serial.printf(
        "[t=%6lu] V=%6.1f I=%5.1f Tcab=%5.1f Tcab2=%5.1f acc=%4.2fg | "
        "duty=%4.1f%% k=%4.2f mode=%s mqtt=%s ai=%s inf=%luµs\n",
        s.ts_ms, s.voltage_v, s.current_a, s.cable_temp_c, s.cabinet_temp_c,
        s.accel_mag, g_last_duty * 100.0f, g_last_fuzzy_k,
        status_str, ok ? "ok" : (mqtt_connected() ? "?" : "down"),
        g_anomaly.using_tflite() ? "TFLM" : "z3σ", inf_us);
  }

  delay(5);
}
