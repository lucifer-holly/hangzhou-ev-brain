// Sensor reader — abstracts ADC + I2C reads behind a single struct.
//
// The Wokwi simulator drives the same GPIOs as real hardware would, so this
// module is hardware-truthful even though we are running in a browser.

#pragma once

#include <Arduino.h>

namespace hzev {

struct SensorData {
  float voltage_v;        // 0-1000 V DC (from pot_voltage)
  float current_a;        // 0-300 A DC (from pot_current)
  float cable_temp_c;     // °C (from temp_cable NTC)
  float cabinet_temp_c;   // °C (from temp_cabinet NTC)
  float accel_x;          // g (MPU6050)
  float accel_y;
  float accel_z;
  float accel_mag;        // sqrt(x²+y²+z²) — pre-computed for anomaly check
  float gyro_x;           // rad/s
  float gyro_y;
  float gyro_z;
  float imu_temp_c;
  bool  plug_inserted;    // btn_plug pressed
  bool  impact_pressed;   // btn_impact pressed (manual anomaly trigger)
  unsigned long ts_ms;
};

void sensor_init();
SensorData sensor_read();

// Returns true if the I2C IMU is present.  Set during sensor_init();
// downstream consumers can degrade gracefully if Wokwi launches without an
// IMU part wired.
bool sensor_imu_ok();

}  // namespace hzev
