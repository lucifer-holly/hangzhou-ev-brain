// HZ-EV Brain · Pile Simulator — compile-time configuration.
//
// Centralised pin map + tunables.  Anything that might change between Wokwi
// and real hardware lives here.

#pragma once

#include <Arduino.h>

// -----------------------------------------------------------------------------
// Pile identity
// -----------------------------------------------------------------------------
// Wokwi-issued demo pile id; matches the asyncapi.yaml regex
// ^pile-[0-9]{3}-[0-9a-f]{8}$
#ifndef HZEV_PILE_ID
#define HZEV_PILE_ID "pile-001-cafebabe"
#endif

#ifndef HZEV_FIRMWARE_VERSION
#define HZEV_FIRMWARE_VERSION "0.1.0"
#endif

// -----------------------------------------------------------------------------
// Pin map (matches diagram.json)
// -----------------------------------------------------------------------------
constexpr uint8_t PIN_POT_VOLTAGE   = 1;   // ADC1_CH0
constexpr uint8_t PIN_POT_CURRENT   = 2;   // ADC1_CH1
constexpr uint8_t PIN_TEMP_CABLE    = 3;   // ADC1_CH2
constexpr uint8_t PIN_TEMP_CABINET  = 4;   // ADC1_CH3
constexpr uint8_t PIN_BTN_PLUG      = 5;
constexpr uint8_t PIN_BTN_IMPACT    = 6;
constexpr uint8_t PIN_I2C_SDA       = 8;
constexpr uint8_t PIN_I2C_SCL       = 9;
constexpr uint8_t PIN_SERVO_LOCK    = 10;
constexpr uint8_t PIN_BUZZER        = 11;
constexpr uint8_t PIN_LED_R         = 17;
constexpr uint8_t PIN_LED_G         = 18;
constexpr uint8_t PIN_LED_B         = 19;

// -----------------------------------------------------------------------------
// Sensor scaling (ADC 0-4095 → physical units)
// -----------------------------------------------------------------------------
constexpr float ADC_MAX            = 4095.0f;
constexpr float VOLTAGE_FULL_SCALE = 1000.0f;  // 0-1000 V DC
constexpr float CURRENT_FULL_SCALE = 300.0f;   // 0-300 A DC
constexpr float CABLE_TEMP_MIN     = -40.0f;
constexpr float CABLE_TEMP_MAX     = 150.0f;
constexpr float CABINET_TEMP_MIN   = -50.0f;
constexpr float CABINET_TEMP_MAX   = 200.0f;

// -----------------------------------------------------------------------------
// Control loop targets
// -----------------------------------------------------------------------------
constexpr float CC_TARGET_CURRENT_A = 200.0f;  // CC stage setpoint
constexpr float CV_TARGET_VOLTAGE_V = 410.0f;  // CV stage setpoint

// CC → CV transition: switch to CV when measured voltage > 405 V
constexpr float CV_TRANSITION_V     = 405.0f;

// PID coefficients (Z-N tuned, see spec §4.3)
constexpr float PID_KP = 0.5f;
constexpr float PID_KI = 2.0f;
constexpr float PID_KD = 0.01f;

// -----------------------------------------------------------------------------
// Loop cadence
// -----------------------------------------------------------------------------
constexpr unsigned long CONTROL_PERIOD_MS  = 100;   // 10 Hz inner loop
constexpr unsigned long TELEMETRY_PERIOD_MS = 1000; // 1 Hz publish (per asyncapi)
constexpr unsigned long ANOMALY_WINDOW_LEN = 32;    // ring buffer size

// -----------------------------------------------------------------------------
// MQTT / WiFi (Wokwi guest network)
// -----------------------------------------------------------------------------
#ifndef HZEV_WIFI_SSID
#define HZEV_WIFI_SSID "Wokwi-GUEST"
#endif
#ifndef HZEV_WIFI_PASS
#define HZEV_WIFI_PASS ""
#endif

#ifndef HZEV_MQTT_HOST
#define HZEV_MQTT_HOST "test.mosquitto.org"
#endif
#ifndef HZEV_MQTT_PORT
#define HZEV_MQTT_PORT 1883
#endif

// Topic templates (filled by mqtt_publisher with HZEV_PILE_ID).
#define HZEV_TOPIC_TELEMETRY "pile/" HZEV_PILE_ID "/telemetry"
#define HZEV_TOPIC_EVENT     "pile/" HZEV_PILE_ID "/event"
#define HZEV_TOPIC_COMMAND   "pile/" HZEV_PILE_ID "/command"
#define HZEV_TOPIC_GRID      "system/grid/alert"
