#include "sensor_reader.h"

#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>

#include "config.h"

namespace hzev {

namespace {

Adafruit_MPU6050 g_mpu;
bool g_imu_ok = false;

float adc_to_unit(int raw, float full_scale) {
  return (static_cast<float>(raw) / ADC_MAX) * full_scale;
}

// Wokwi's NTC part outputs an analog voltage that mirrors the user-set
// temperature.  We expose the slider value linearly between TEMP_MIN..MAX so
// the demo can sweep the full range with one dial.
float adc_to_temperature(int raw, float t_min, float t_max) {
  float frac = static_cast<float>(raw) / ADC_MAX;
  return t_min + frac * (t_max - t_min);
}

}  // namespace

void sensor_init() {
  // ADC pins — ESP32-Arduino keeps them in input mode by default; analogRead
  // configures attenuation to 11 dB so 0-3.3 V maps to 0-4095.
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  pinMode(PIN_BTN_PLUG, INPUT_PULLUP);
  pinMode(PIN_BTN_IMPACT, INPUT_PULLUP);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  g_imu_ok = g_mpu.begin();
  if (g_imu_ok) {
    g_mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
    g_mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    g_mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println(F("[sensor] MPU6050 initialised."));
  } else {
    Serial.println(F("[sensor] MPU6050 not found — accel/gyro will be zero."));
  }
}

SensorData sensor_read() {
  SensorData s{};
  s.ts_ms = millis();

  s.voltage_v      = adc_to_unit(analogRead(PIN_POT_VOLTAGE), VOLTAGE_FULL_SCALE);
  s.current_a      = adc_to_unit(analogRead(PIN_POT_CURRENT), CURRENT_FULL_SCALE);
  s.cable_temp_c   = adc_to_temperature(analogRead(PIN_TEMP_CABLE),
                                        CABLE_TEMP_MIN, CABLE_TEMP_MAX);
  s.cabinet_temp_c = adc_to_temperature(analogRead(PIN_TEMP_CABINET),
                                        CABINET_TEMP_MIN, CABINET_TEMP_MAX);

  s.plug_inserted  = digitalRead(PIN_BTN_PLUG)   == LOW;  // pull-up + button to GND
  s.impact_pressed = digitalRead(PIN_BTN_IMPACT) == LOW;

  if (g_imu_ok) {
    sensors_event_t a, g, t;
    g_mpu.getEvent(&a, &g, &t);
    constexpr float G = 9.80665f;
    s.accel_x   = a.acceleration.x / G;
    s.accel_y   = a.acceleration.y / G;
    s.accel_z   = a.acceleration.z / G;
    s.gyro_x    = g.gyro.x;
    s.gyro_y    = g.gyro.y;
    s.gyro_z    = g.gyro.z;
    s.imu_temp_c = t.temperature;
  }
  // IMPACT button injects two anomaly signatures simultaneously:
  //   - a 4 g accel-X spike (visible in MPU6050 channels, matches the
  //     accel-based anomaly story even when no IMU is wired)
  //   - a 60 V voltage spike on top of whatever the pot is reading
  //     (this one feeds the cloud Autoencoder's V channel and triggers
  //     reconstruction-error anomalies even without IMU coupling).
  if (s.impact_pressed) {
    s.accel_x   += 4.0f;
    s.voltage_v += 60.0f;
  }
  s.accel_mag = sqrtf(s.accel_x * s.accel_x +
                      s.accel_y * s.accel_y +
                      s.accel_z * s.accel_z);
  return s;
}

bool sensor_imu_ok() { return g_imu_ok; }

}  // namespace hzev
