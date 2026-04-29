// PID controller for the CC-CV charging loop (spec §4.3).
//
// Designed to be reused for both the CC stage (track current) and the CV
// stage (track voltage) — caller decides which setpoint to feed in.

#pragma once

#include <Arduino.h>

namespace hzev {

class PidController {
 public:
  PidController(float kp, float ki, float kd,
                float out_min = 0.0f, float out_max = 1.0f);

  // Computes a new control output given the desired setpoint and a fresh
  // measurement.  Internally tracks dt from millis().
  float compute(float setpoint, float measured);

  // Resets integrator + derivative state — call when switching CC↔CV stage.
  void reset();

  float last_error() const { return prev_error_; }
  float integral()   const { return integral_; }

 private:
  const float kp_;
  const float ki_;
  const float kd_;
  const float out_min_;
  const float out_max_;
  float integral_      = 0.0f;
  float prev_error_    = 0.0f;
  unsigned long prev_ms_ = 0;
};

}  // namespace hzev
