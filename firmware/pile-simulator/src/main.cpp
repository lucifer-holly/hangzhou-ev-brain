// HZ-EV Brain · Pile Simulator — entry point.
//
// Wokwi-runnable ESP32-S3 firmware that simulates a single DC fast-charging
// pile.  See README.md and docs/spec.md §4 for the design.
//
// Phase A scaffold: setup() proves the toolchain works.  Phase B/C/D fill in
// the actual control + AI + MQTT logic.

#include <Arduino.h>

#include "config.h"

void setup() {
  Serial.begin(115200);
  // Some Wokwi USB-CDC instances need a moment for the host to attach.
  delay(200);

  Serial.println();
  Serial.println(F("==========================================="));
  Serial.println(F("HZ-EV Brain · Pile Simulator"));
  Serial.print(F("  pile_id : ")); Serial.println(F(HZEV_PILE_ID));
  Serial.print(F("  firmware: ")); Serial.println(F(HZEV_FIRMWARE_VERSION));
  Serial.println(F("==========================================="));

  // GPIO directions are owned by the per-module init functions in later
  // phases.  Phase A keeps setup() empty so the binary is link-tested.
}

void loop() {
  static unsigned long last_heartbeat = 0;
  if (millis() - last_heartbeat >= 1000) {
    last_heartbeat = millis();
    Serial.print(F("[heartbeat] uptime_s=")); Serial.println(millis() / 1000);
  }
  delay(50);
}
