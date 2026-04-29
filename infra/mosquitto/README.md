# Mosquitto MQTT Broker (infra)

Local Mosquitto broker for the HZ-EV Brain demo.

## What it does

Brokers MQTT messages between:

- **Wokwi ESP32 pile firmware** (Spawn 8) — publishes telemetry on
  `hzev/pile/<pile_id>/telemetry` and subscribes to commands on
  `hzev/pile/<pile_id>/cmd`.
- **Backend MQTT subscriber** (Spawn 1, stub for now) — currently just opens
  the connection and logs; real ingestion will land in a later spawn.

## Ports

| Port | Protocol      | Used by                                    |
| ---- | ------------- | ------------------------------------------ |
| 1883 | MQTT          | Wokwi simulator + backend                  |
| 9001 | MQTT over WS  | Browser debug tools (e.g. MQTT Explorer)   |

## Anonymous access

Anonymous access is **enabled** because this is a local-only demo:

```
allow_anonymous true
```

Do **not** expose port 1883 / 9001 to the public internet.

## Verifying the broker

```bash
# in a second shell after `docker-compose up`
docker exec -it hz-ev-brain-mosquitto-1 \
  mosquitto_pub -h localhost -t hzev/test -m "ping"

docker exec -it hz-ev-brain-mosquitto-1 \
  mosquitto_sub -h localhost -t 'hzev/#' -v
```
