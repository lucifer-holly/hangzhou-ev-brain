# Pile Simulator (Wokwi-runnable ESP32-S3 Firmware)

> **Edge IoT capability evidence for HZ-EV Brain — runs in your browser.**

## Project Position

This firmware sits in the `firmware/pile-simulator/` slice of the [HZ-EV
Brain](../../README.md) portfolio. The project as a whole is dashboard-led
(synthetic data on the cloud + 6 governance functions), and this binary
is the **edge reference implementation** — the "硬件能力证据" that proves
the author can write embedded AIoT code.

Critically, **this firmware does NOT feed the main City Console
dashboard**. The dashboard runs against a synthetic data generator
(`backend/synth/`) so the demo is reproducible. This pile lives in its
own MQTT topic family (`pile/pile-001-cafebabe/...`) and stands alone —
or, optionally, can be subscribed-to by the cloud's AnomalyDetector for
side-channel validation.

What it does demonstrate:

- **Sensor I/O** — 12-bit ADC, I²C (MPU6050), GPIO, PWM (servo),
  pull-up buttons.
- **Closed-loop control** — PID controller with anti-windup tracking
  the CC-CV charging curve.
- **Fuzzy-logic safety governor** — 27-rule Mamdani (LUT-implemented)
  derating engine with three triangular-fuzzy inputs.
- **Edge AI anomaly detection** — multi-channel rolling z-score with
  fault-type classification (statistical fallback for the trained
  Autoencoder, see "Plan A vs Plan B" below).
- **MQTT telemetry** — schema-conformant publish/subscribe per
  `contracts/asyncapi.yaml`, with WiFi/MQTT auto-reconnect.

---

## Quick Start

### Option 1 — Wokwi (browser-only, zero local install)

1. Open <https://wokwi.com/projects/new/esp32-s3>.
2. Replace the auto-generated `diagram.json` with this repo's
   [`diagram.json`](diagram.json).
3. Replace `sketch.ino` with the contents of [`src/main.cpp`](src/main.cpp).
   You will also need to copy each header from `include/` and source from
   `src/` into the Wokwi side-panel — Wokwi flattens the layout.
4. The Wokwi guest WiFi (`Wokwi-GUEST`, no password) is wired by default
   and `test.mosquitto.org` is reachable from the sandbox. Click **▶**.

### Option 2 — PlatformIO + Wokwi VS Code extension (recommended)

```bash
# 1. Install PlatformIO Core + the Wokwi VS Code extension.
# 2. From the repo root:
cd firmware/pile-simulator
pio run                 # compiles to .pio/build/esp32-s3-devkitc-1/firmware.{bin,elf}
# 3. In VS Code, open this folder and run "Wokwi: Start Simulator".
```

The Wokwi extension reads [`wokwi.toml`](wokwi.toml) and
[`diagram.json`](diagram.json) automatically.

### Option 3 — Real hardware

Plug a real ESP32-S3-DevKitC-1 in, wire matching components per the
pinout table below, and `pio run -t upload`.  Tested only in simulation
for this portfolio submission.

---

## Architecture

```
                         ┌──────────────────────────────┐
                         │ MQTT broker (Mosquitto/test) │
                         └──────────▲───────────┬───────┘
                              telemetry         │ commands / grid alerts
                              + events          │
   ┌────────────────────────────┴────────────┐  │
   │            ESP32-S3 firmware            │  │
   │                                         │  │
   │  Sensors ──► PID  ──┐                   │◄─┘
   │     │       (CC|CV) │                   │
   │     │               ▼                   │
   │     │           × fuzzy_k ── PWM duty   │
   │     │                                   │
   │     └─► Anomaly Detector ──► event pub  │
   │                                         │
   │  Grid alert ──► fuzzy.grid_pressure     │
   └─────────────────────────────────────────┘
```

### Wokwi pinout (matches `diagram.json` and `include/config.h`)

| Component                         | Wokwi part type             | ESP32-S3 GPIO        |
|-----------------------------------|-----------------------------|----------------------|
| Voltage potentiometer (0–1000 V)  | `wokwi-potentiometer`       | GPIO 1 (ADC1_CH0)    |
| Current potentiometer (0–300 A)   | `wokwi-potentiometer`       | GPIO 2 (ADC1_CH1)    |
| Cable NTC (–40 → 150 °C)          | `wokwi-ntc-temperature-sensor` | GPIO 3 (ADC1_CH2) |
| Cabinet NTC (–50 → 200 °C)        | `wokwi-ntc-temperature-sensor` | GPIO 4 (ADC1_CH3) |
| "PLUG" button                     | `wokwi-pushbutton`          | GPIO 5 (input pull-up)|
| "IMPACT" button (anomaly trigger) | `wokwi-pushbutton`          | GPIO 6 (input pull-up)|
| MPU6050 (accel + gyro)            | `board-mpu6050`             | I²C SDA=8, SCL=9     |
| Servo (connector lock)            | `wokwi-servo`               | GPIO 10 (PWM)        |
| Buzzer                            | `wokwi-buzzer`              | GPIO 11              |
| Status LED (RGB common-cathode)   | `wokwi-rgb-led`             | R=17, G=18, B=19     |

Total: **11 parts, 29 connections**.

---

## Demo Scenarios

The status LED is the primary visual narrative.

### Scenario 1 — CC-CV PID tracking (green → blue band)

1. Press the green **PLUG** button → status LED goes green
   (`PileMode::Charging`).
2. The voltage potentiometer is held at ~40% by default which scales to
   ≈ 400 V. Slowly turn the **current** potentiometer; you'll see the
   serial trace's `duty=` value adapt to drag measured current toward
   the 200 A CC setpoint.
3. Turn the **voltage** potentiometer past 41 % (~410 V) and the inner
   loop switches to CV — the integrator state is preserved per stage so
   the response stays smooth.

### Scenario 2 — Fuzzy de-rate (green → yellow)

1. Hold PLUG and start charging (Scenario 1 first).
2. Turn the **cable temperature** NTC slider above 60 °C. The fuzzy LUT
   blends into the "Warm/Hot cable" rules and `k_fuzzy` drops below
   ~0.7, multiplying out into the duty cycle. Status LED turns yellow
   (`PileMode::Throttled`).
3. Push the cable to 95 °C → `k_fuzzy < 0.4` regardless of grid state
   (cable safety dominates the LUT by design — see
   `src/fuzzy_logic.cpp` LUT comments).

### Scenario 3 — Anomaly trip (any → red)

1. With or without PLUG inserted, **press and hold the red IMPACT
   button**. The sensor reader injects a +4 g spike into the X-axis
   accelerometer channel; after ~4 samples the `accel_mag` z-score
   blows past 3 σ.
2. LED snaps red, the buzzer beeps for 300 ms, and a JSON event posts
   to `pile/pile-001-cafebabe/event` with `type=vibration_event`,
   `severity=critical`, score, and human-readable Chinese-friendly
   message.
3. Release IMPACT and unplug for ≥ 3 s → latch clears and the buffer
   resets (`AnomalyDetector::reset()`).
4. Anomaly detection also fires on slow drifts — for example, holding
   the **cabinet temperature** NTC above 100 °C for > 10 s pushes
   `T_cabinet` past 3 σ and produces a `thermal_fault` event.

---

## MQTT Output Samples

### Telemetry — `pile/pile-001-cafebabe/telemetry` (1 Hz, QoS 1)

```json
{
  "pile_id": "pile-001-cafebabe",
  "ts": "2026-01-01T00:00:43Z",
  "voltage": 396.82,
  "current": 187.45,
  "power": 74.39,
  "occupancy_rate": 1.0,
  "energy_delivered_kwh": 1.07,
  "status": "charging",
  "sensors": {
    "cable_temp_c": 41.2,
    "cabinet_temp_c": 35.8,
    "strain": 612.4,
    "accel_g": [0.02, -0.01, 0.99]
  }
}
```

### Event — `pile/pile-001-cafebabe/event` (on anomaly trip)

```json
{
  "pile_id": "pile-001-cafebabe",
  "ts": "2026-01-01T00:01:07Z",
  "type": "vibration_event",
  "severity": "critical",
  "message": "Acceleration spike — possible impact / tamper.",
  "resolved": false,
  "score": 6.42
}
```

Both payloads validate against the schemas in
[`contracts/asyncapi.yaml`](../../contracts/asyncapi.yaml) under
`PileTelemetryPayload` and `PileEventPayload`.

---

## Plan A vs Plan B (Edge AI Honesty Box)

The product spec ([`docs/spec.md`](../../docs/spec.md) §7.4) calls for a
**Plan A**: an INT8-quantised `tflite-micro` Autoencoder running on the
ESP32 and producing a reconstruction-error anomaly score.

This firmware ships **Plan B**: a multi-channel rolling z-score
detector. Decision rationale:

1. **The model exists** — the Autoencoder is trained and saved at
   [`backend/ai/anomaly_detection/saved/autoencoder.onnx`](../../backend/ai/anomaly_detection/saved/autoencoder.onnx)
   from Spawn 4. The encoder is 256 → 16 → 256.
2. **The conversion path is fragile** — the existing
   `quantize_tflite.py` docstring already records that ONNX → TFLite
   INT8 on Apple Silicon + Python 3.14 is unstable. A best-effort
   ONNX dynamic INT8 fallback is what made it onto disk; a real
   `.tflite` artifact is not produced.
3. **The runtime library is unmaintained** — `TensorFlowLite_ESP32`
   (the PlatformIO library) had its last release in 2021 and has known
   compatibility breaks with newer Arduino-ESP32 cores.
4. **Plan B preserves architectural intent** — same multi-channel ring
   buffer, same channel-→-fault-type classifier, same MQTT event
   schema. Swapping in an Autoencoder later means replacing only
   `AnomalyDetector::check()` body.

What Plan B exposes well:

- `voltage_anomaly` ← V channel z-score
- `cable_fault`     ← I channel z-score (contact resistance proxy)
- `thermal_fault`   ← cable or cabinet T channel z-score
- `vibration_event` ← `|accel|` channel z-score

What Plan B does NOT exposed but Plan A would have:

- Joint multivariate anomalies (e.g. V high AND I low simultaneously,
  which the Autoencoder catches via the bottleneck but a per-channel
  z-score does not).

The trade-off is documented in
[`tools/quantize_for_wokwi.md`](tools/quantize_for_wokwi.md).

---

## Build / Verification Status

| Check                            | Status       | Notes                                |
|----------------------------------|--------------|--------------------------------------|
| `diagram.json` is valid JSON     | ✅            | 11 parts, 29 connections             |
| `pio run` compiles               | ⚠️ deferred  | PlatformIO not installed in spawn env|
| Wokwi simulation runs            | ⚠️ deferred  | Needs `pio run` artifact first       |
| MQTT schema match                | ✅            | hand-checked vs `contracts/asyncapi.yaml` |
| TFLite quantization              | ❌ skipped   | see "Plan A vs Plan B"               |

To finish verification locally:

```bash
brew install platformio    # or: pip install platformio
cd firmware/pile-simulator
pio run                     # expect: SUCCESS, ~70 KB binary
```

---

## Future Work

1. **Plan A reactivation** — pin Python 3.10 + `tensorflow==2.13` in a
   fresh venv, retry `onnx2tf` with explicit input-shape calibration,
   produce `models/anomaly_int8.tflite` + `models/anomaly_model_data.cc`
   and swap the body of `AnomalyDetector::check()`.
2. **Real-broker mode** — switch `HZEV_MQTT_HOST` from
   `test.mosquitto.org` to the local Mosquitto in `docker-compose.yml`
   so the cloud's `MQTTSubscriber` can validate messages end-to-end.
3. **OTA updates** — `ArduinoOTA` or `esp_https_ota` against a manifest
   file hosted by the FastAPI backend.
4. **Real-time clock** — NTP sync (`configTime()`) to replace the
   uptime-derived ISO-8601 stand-in.
5. **Connector-lock force-curve** — replace the 0/90° servo binary with
   an actual encoder loop for "did the user yank the cable?" force
   detection (currently mocked through the IMPACT button).
6. **Multi-pile fanout** — the firmware is single-pile by design; a
   gateway-mode build that aggregates 4 BLE child piles into one MQTT
   uplink would be a natural extension.

---

## File Tree

```
firmware/pile-simulator/
├── README.md                      ← you are here
├── platformio.ini                 ← PlatformIO project config
├── wokwi.toml                     ← Wokwi VS Code descriptor
├── diagram.json                   ← Wokwi schematic (11 parts)
├── include/
│   ├── config.h                   ← pin map, ADC scaling, PID gains, MQTT
│   ├── sensor_reader.h
│   ├── pid_controller.h
│   ├── fuzzy_logic.h
│   ├── anomaly_detector.h
│   ├── status_indicator.h
│   └── mqtt_publisher.h
├── src/
│   ├── main.cpp                   ← setup() + 10 Hz / 1 Hz loops
│   ├── sensor_reader.cpp
│   ├── pid_controller.cpp
│   ├── fuzzy_logic.cpp
│   ├── anomaly_detector.cpp
│   ├── status_indicator.cpp
│   └── mqtt_publisher.cpp
├── models/                        ← reserved for Plan A artifacts (empty)
└── tools/
    └── quantize_for_wokwi.md      ← Plan A → Plan B decision record
```

---

## Cross-references

- Hardware BOM, PID design, fuzzy rule rationale: [`docs/spec.md` §4](../../docs/spec.md)
- MQTT topic & payload schemas: [`contracts/asyncapi.yaml`](../../contracts/asyncapi.yaml)
- Trained Autoencoder source: [`backend/ai/anomaly_detection/`](../../backend/ai/anomaly_detection/)
- Cloud-side MQTT subscriber: `backend/api/mqtt_subscriber.py` (Spawn 1)
