#include "status_indicator.h"

#include <Arduino.h>
#include <ESP32Servo.h>

#include "config.h"

namespace hzev {

namespace {

Servo g_lock_servo;
unsigned long g_buzzer_off_ms = 0;
bool g_buzzer_active = false;

// Common-cathode RGB LED: HIGH on a colour pin lights it.
void set_rgb(bool r, bool g, bool b) {
  digitalWrite(PIN_LED_R, r ? HIGH : LOW);
  digitalWrite(PIN_LED_G, g ? HIGH : LOW);
  digitalWrite(PIN_LED_B, b ? HIGH : LOW);
}

}  // namespace

void status_init() {
  pinMode(PIN_LED_R, OUTPUT);
  pinMode(PIN_LED_G, OUTPUT);
  pinMode(PIN_LED_B, OUTPUT);
  set_rgb(false, false, false);

  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  g_lock_servo.attach(PIN_SERVO_LOCK, 500, 2400);
  g_lock_servo.write(0);  // unlocked at boot
}

void status_update(PileMode mode, bool plug_inserted) {
  switch (mode) {
    case PileMode::Idle:      set_rgb(false, false, true);  break;  // blue
    case PileMode::Charging:  set_rgb(false, true,  false); break;  // green
    case PileMode::Throttled: set_rgb(true,  true,  false); break;  // yellow
    case PileMode::Anomaly:   set_rgb(true,  false, false); break;  // red
  }

  // Servo: lock the connector while plugged in (90°), unlock otherwise (0°).
  g_lock_servo.write(plug_inserted ? 90 : 0);

  if (g_buzzer_active && millis() >= g_buzzer_off_ms) {
    digitalWrite(PIN_BUZZER, LOW);
    g_buzzer_active = false;
  }
}

void status_beep(unsigned int duration_ms) {
  digitalWrite(PIN_BUZZER, HIGH);
  g_buzzer_off_ms = millis() + duration_ms;
  g_buzzer_active = true;
}

}  // namespace hzev
