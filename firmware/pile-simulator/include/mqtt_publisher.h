// MQTT publisher — wraps PubSubClient + ArduinoJson.
//
// Schemas come straight from contracts/asyncapi.yaml; we publish:
//   - pile/{id}/telemetry  (1 Hz)
//   - pile/{id}/event      (on anomaly trip)
// We subscribe to:
//   - pile/{id}/command       (cloud commands; not implemented in MVP)
//   - system/grid/alert       (fleet-wide grid pressure broadcast)
//
// Uptime resilience: each publish call returns false if WiFi or MQTT is
// down; the caller can decide whether to drop the frame or back-off.
// The reconnect handshake itself runs out of `mqtt_loop()` and uses an
// exponential delay capped at 30 s.

#pragma once

#include <Arduino.h>

namespace hzev {

struct SensorData;
struct AnomalyResult;

void mqtt_init();

// Drives the WiFi/MQTT state machine.  Call from loop() once per tick.
void mqtt_loop();

// Publishes a 1 Hz telemetry frame conforming to PileTelemetryPayload.
// Returns true if the frame was handed off to PubSubClient successfully.
bool mqtt_publish_telemetry(const SensorData& s, float duty, float fuzzy_k,
                            float energy_kwh, const char* status);

// Publishes a discrete fault event (PileEventPayload).
bool mqtt_publish_event(const AnomalyResult& a);

// Latest grid-pressure value parsed from system/grid/alert (0..1).  Stays
// at zero until the first message arrives.  Reading is lock-free; callers
// should treat it as a best-effort hint.
float mqtt_grid_pressure();

bool mqtt_connected();

}  // namespace hzev
