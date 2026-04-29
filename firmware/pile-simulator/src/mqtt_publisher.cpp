#include "mqtt_publisher.h"

#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFi.h>

#include "anomaly_detector.h"
#include "config.h"
#include "sensor_reader.h"

namespace hzev {

namespace {

WiFiClient g_tcp;
PubSubClient g_mqtt(g_tcp);

float g_grid_pressure = 0.0f;
unsigned long g_last_reconnect_ms = 0;
unsigned long g_reconnect_backoff_ms = 1000;

// Build an ISO-8601 timestamp.  We do NOT have a real-time clock or NTP in
// the Wokwi sandbox, so we use `2026-01-01T00:00:00Z + uptime_seconds` as a
// monotonic stand-in.  The cloud subscriber is happy as long as it parses.
void format_iso8601(char* out, size_t out_len, unsigned long ms) {
  // 2026-01-01 00:00:00 UTC = 1767225600 epoch.
  const unsigned long epoch = 1767225600UL + (ms / 1000UL);
  // Rough date math — good enough for telemetry tagging in a demo.
  // We delegate to gmtime() via time_t.
  time_t t = static_cast<time_t>(epoch);
  struct tm* g = gmtime(&t);
  if (g == nullptr) {
    snprintf(out, out_len, "1970-01-01T00:00:00Z");
    return;
  }
  snprintf(out, out_len,
           "%04d-%02d-%02dT%02d:%02d:%02dZ",
           1900 + g->tm_year, 1 + g->tm_mon, g->tm_mday,
           g->tm_hour, g->tm_min, g->tm_sec);
}

void on_message(char* topic, byte* payload, unsigned int len) {
  // Only system/grid/alert is consumed in the MVP.
  if (strcmp(topic, HZEV_TOPIC_GRID) != 0) return;

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, payload, len) != DeserializationError::Ok) return;

  // Schema: GridAlertPayload — uses {level, recommended_kfactor}.  We invert
  // recommended_kfactor (1 = full power) to "pressure" (0 = no pressure).
  float k = 1.0f;
  if (doc.containsKey("recommended_kfactor")) {
    k = doc["recommended_kfactor"].as<float>();
  } else if (doc.containsKey("level")) {
    const char* lvl = doc["level"].as<const char*>();
    if      (strcmp(lvl, "elevated") == 0) k = 0.8f;
    else if (strcmp(lvl, "high") == 0)     k = 0.5f;
    else if (strcmp(lvl, "critical") == 0) k = 0.2f;
  }
  if (k < 0.0f) k = 0.0f;
  if (k > 1.0f) k = 1.0f;
  g_grid_pressure = 1.0f - k;
  Serial.printf("[mqtt] grid alert: pressure=%.2f (k=%.2f)\n",
                g_grid_pressure, k);
}

void connect_wifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("[wifi] connecting to '%s'...\n", HZEV_WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(HZEV_WIFI_SSID, HZEV_WIFI_PASS);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 8000) {
    delay(200);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(F("[wifi] up. IP=")); Serial.println(WiFi.localIP());
  } else {
    Serial.println(F("[wifi] connect timed out — will retry."));
  }
}

bool connect_mqtt() {
  if (g_mqtt.connected()) return true;
  if (millis() - g_last_reconnect_ms < g_reconnect_backoff_ms) return false;
  g_last_reconnect_ms = millis();

  if (WiFi.status() != WL_CONNECTED) return false;

  String client_id = String("hzev-pile-") + HZEV_PILE_ID;
  Serial.printf("[mqtt] connecting to %s:%d as %s\n",
                HZEV_MQTT_HOST, HZEV_MQTT_PORT, client_id.c_str());
  if (g_mqtt.connect(client_id.c_str())) {
    g_mqtt.subscribe(HZEV_TOPIC_GRID);
    g_mqtt.subscribe(HZEV_TOPIC_COMMAND);
    g_reconnect_backoff_ms = 1000;
    Serial.println(F("[mqtt] connected."));
    return true;
  }
  // Exponential backoff capped at 30 s.
  g_reconnect_backoff_ms = min<unsigned long>(g_reconnect_backoff_ms * 2, 30000);
  Serial.printf("[mqtt] connect failed rc=%d backoff=%lums\n",
                g_mqtt.state(), g_reconnect_backoff_ms);
  return false;
}

}  // namespace

void mqtt_init() {
  g_mqtt.setServer(HZEV_MQTT_HOST, HZEV_MQTT_PORT);
  g_mqtt.setCallback(on_message);
  g_mqtt.setBufferSize(1024);  // bigger than the default 256 for telemetry
  connect_wifi();
}

void mqtt_loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connect_wifi();
  } else if (!g_mqtt.connected()) {
    connect_mqtt();
  } else {
    g_mqtt.loop();
  }
}

bool mqtt_connected() { return g_mqtt.connected(); }
float mqtt_grid_pressure() { return g_grid_pressure; }

bool mqtt_publish_telemetry(const SensorData& s, float duty, float fuzzy_k,
                            float energy_kwh, const char* status) {
  if (!g_mqtt.connected()) return false;

  // PileTelemetryPayload — see contracts/asyncapi.yaml.
  StaticJsonDocument<512> doc;
  doc["pile_id"] = HZEV_PILE_ID;
  char ts[32];
  format_iso8601(ts, sizeof(ts), s.ts_ms);
  doc["ts"] = ts;
  doc["voltage"] = round(s.voltage_v * 100.0f) / 100.0f;
  doc["current"] = round(s.current_a * 100.0f) / 100.0f;
  doc["power"]   = round((s.voltage_v * s.current_a / 1000.0f) * 100.0f) / 100.0f;
  doc["occupancy_rate"] = s.plug_inserted ? 1.0f : 0.0f;
  doc["energy_delivered_kwh"] = round(energy_kwh * 100.0f) / 100.0f;
  doc["status"] = status;
  JsonObject sensors = doc["sensors"].to<JsonObject>();
  sensors["cable_temp_c"]   = round(s.cable_temp_c * 10.0f) / 10.0f;
  sensors["cabinet_temp_c"] = round(s.cabinet_temp_c * 10.0f) / 10.0f;
  sensors["strain"] = duty * 1000.0f * fuzzy_k;  // proxy: PWM-driven force
  JsonArray accel = sensors["accel_g"].to<JsonArray>();
  accel.add(round(s.accel_x * 100.0f) / 100.0f);
  accel.add(round(s.accel_y * 100.0f) / 100.0f);
  accel.add(round(s.accel_z * 100.0f) / 100.0f);

  char payload[640];
  const size_t n = serializeJson(doc, payload, sizeof(payload));
  return g_mqtt.publish(HZEV_TOPIC_TELEMETRY, reinterpret_cast<const uint8_t*>(payload), n, false);
}

bool mqtt_publish_event(const AnomalyResult& a) {
  if (!a.is_anomaly) return false;
  if (!g_mqtt.connected()) return false;

  StaticJsonDocument<384> doc;
  doc["pile_id"] = HZEV_PILE_ID;
  char ts[32];
  format_iso8601(ts, sizeof(ts), millis());
  doc["ts"] = ts;
  doc["type"] = a.type_str;
  doc["severity"] = (a.score > 5.0f) ? "critical" : "warning";
  doc["message"] = a.message;
  doc["resolved"] = false;
  doc["score"] = round(a.score * 100.0f) / 100.0f;

  char payload[400];
  const size_t n = serializeJson(doc, payload, sizeof(payload));
  return g_mqtt.publish(HZEV_TOPIC_EVENT, reinterpret_cast<const uint8_t*>(payload), n, false);
}

}  // namespace hzev
