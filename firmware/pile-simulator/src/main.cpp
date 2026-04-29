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
//
// Phase B wires sensors + PID + fuzzy.  Phases C/D bolt on anomaly +
// MQTT in later commits.

#include <Arduino.h>

#include "config.h"
#include "fuzzy_logic.h"
#include "pid_controller.h"
#include "sensor_reader.h"
#include "status_indicator.h"

using namespace hzev;

namespace {

// Two PIDs share the same GPIO output but track different setpoints — only
// one is "active" depending on the charging stage.  Keeping them as separate
// objects means each retains its own integrator across stage transitions.
PidController g_pid_current(PID_KP, PID_KI, PID_KD);
PidController g_pid_voltage(0.10f, 0.40f, 0.005f);
FuzzyController g_fuzzy;

// Cloud-broadcast grid pressure (system/grid/alert).  Stays at 0 until
// the MQTT subscriber lands in Phase D.
float g_grid_pressure = 0.0f;

unsigned long g_last_control_ms = 0;
unsigned long g_last_telemetry_ms = 0;

// Latest control output (0..1 duty).  Published to telemetry and printed.
float g_last_duty = 0.0f;
float g_last_fuzzy_k = 1.0f;
PileMode g_mode = PileMode::Idle;

PileMode classify(const SensorData& s, float fuzzy_k) {
  if (!s.plug_inserted)            return PileMode::Idle;
  if (fuzzy_k < 0.85f)             return PileMode::Throttled;
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
  Serial.println(F("[main] init complete; entering control loop."));
}

void loop() {
  const unsigned long now = millis();

  // -------- 10 Hz inner loop: sensors → control law -----------------------
  if (now - g_last_control_ms >= CONTROL_PERIOD_MS) {
    g_last_control_ms = now;

    const SensorData s = sensor_read();

    // CC vs CV stage selection: voltage > threshold → switch to CV.
    const bool in_cv_stage = s.voltage_v > CV_TRANSITION_V;
    float pid_out = 0.0f;
    if (s.plug_inserted) {
      if (in_cv_stage) {
        pid_out = g_pid_voltage.compute(CV_TARGET_VOLTAGE_V, s.voltage_v);
      } else {
        // CC: scale measured/target into [0,1] so PID gains stay sane.
        pid_out = g_pid_current.compute(CC_TARGET_CURRENT_A / CURRENT_FULL_SCALE,
                                        s.current_a / CURRENT_FULL_SCALE);
      }
    } else {
      g_pid_current.reset();
      g_pid_voltage.reset();
    }

    const float fuzzy_k = g_fuzzy.computePowerCoefficient(
        s.cable_temp_c, s.cabinet_temp_c, g_grid_pressure);
    float duty = pid_out * fuzzy_k;
    if (duty < 0.0f) duty = 0.0f;
    if (duty > 1.0f) duty = 1.0f;

    g_last_duty   = duty;
    g_last_fuzzy_k = fuzzy_k;
    g_mode = classify(s, fuzzy_k);
    status_update(g_mode, s.plug_inserted);
  }

  // -------- 1 Hz outer loop: human-readable serial trace ------------------
  if (now - g_last_telemetry_ms >= TELEMETRY_PERIOD_MS) {
    g_last_telemetry_ms = now;
    const SensorData s = sensor_read();
    Serial.printf(
        "[t=%6lu] V=%6.1f I=%5.1f Tcab=%5.1f Tcab2=%5.1f acc=%4.2f g | "
        "duty=%4.1f%% k=%4.2f mode=%d plug=%d\n",
        s.ts_ms, s.voltage_v, s.current_a, s.cable_temp_c, s.cabinet_temp_c,
        s.accel_mag, g_last_duty * 100.0f, g_last_fuzzy_k,
        static_cast<int>(g_mode), s.plug_inserted ? 1 : 0);
  }

  delay(5);
}
