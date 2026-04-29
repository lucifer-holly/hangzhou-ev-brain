#include "pid_controller.h"

namespace hzev {

PidController::PidController(float kp, float ki, float kd,
                             float out_min, float out_max)
    : kp_(kp), ki_(ki), kd_(kd), out_min_(out_min), out_max_(out_max) {}

float PidController::compute(float setpoint, float measured) {
  const unsigned long now = millis();
  float dt = (prev_ms_ == 0) ? 0.05f : (now - prev_ms_) / 1000.0f;
  if (dt <= 0.0f) dt = 0.001f;
  prev_ms_ = now;

  const float error = setpoint - measured;
  integral_ += error * dt;

  // Anti-windup: clamp the integrator against the unscaled output bounds so
  // saturation can recover without an unbounded wind-up tail.
  const float i_max = (ki_ > 0.0f) ? (out_max_ - out_min_) / ki_ : 0.0f;
  if (integral_ >  i_max) integral_ =  i_max;
  if (integral_ < -i_max) integral_ = -i_max;

  const float derivative = (error - prev_error_) / dt;
  prev_error_ = error;

  float u = kp_ * error + ki_ * integral_ + kd_ * derivative;
  if (u < out_min_) u = out_min_;
  if (u > out_max_) u = out_max_;
  return u;
}

void PidController::reset() {
  integral_   = 0.0f;
  prev_error_ = 0.0f;
  prev_ms_    = 0;
}

}  // namespace hzev
