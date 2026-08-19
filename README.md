# Autonomous Surface Vessel Project — Version 1 (ASV v1)

Control system for a twin-pontoon autonomous surface vessel (ASV) built for
waterway debris collection. This repo contains the two software layers built
on top of the existing, unmodified hardware/firmware, plus documentation for
the physical build.

License: [MIT](LICENSE)

```
iOS App (app/)
   ↓ WiFi, WebSocket (JSON, port 8765)
Raspberry Pi 4 bridge (pi-bridge/)
   ↓ USB serial, /dev/ttyUSB0 @ 115200 baud, "L:xxxx,R:xxxx\n"
ESP32 (esp32-firmware/ -- reference only, DO NOT MODIFY)
   ↓ PWM, GPIO 25 (left ESC) / GPIO 26 (right ESC)
2x ESCs -> 2x ApisQueen U2 Mini Thrusters
```

**The ESP32 firmware is not touched by this project.** It has no
comms-loss failsafe of its own by design; the Pi bridge forces neutral
after 300ms of app silence, and that watchdog is the only thing that
reverts the thrusters to neutral if the app or WiFi link drops (see
`pi-bridge/bridge.py`).

---

## Documentation

| | |
|---|---|
| [`docs/software/`](docs/software/README.md) | Architecture, setup guides (Pi bridge, iOS app, ESP32 firmware), WebSocket protocol, safety summary |
| [`docs/hardware/`](docs/hardware/README.md) | Hull/pontoons, propulsion (thrusters + ESCs + calibration), electronics, and power system -- with photos |

## Repo layout

```
esp32-firmware/   reference copy of the existing, unmodified ESP32 sketch
pi-bridge/        Python 3 WebSocket <-> serial bridge, runs on the Pi
app/              React Native (TypeScript) iOS app
docs/software/    architecture + setup docs for the three components above
docs/hardware/    hull, propulsion, electronics, and power documentation
```

## Quick start

- Pi bridge setup: [`docs/software/pi-bridge/README.md`](docs/software/pi-bridge/README.md)
- iOS app setup: [`docs/software/ios-app/README.md`](docs/software/ios-app/README.md)
- ESP32 firmware (reference only): [`docs/software/esp32-firmware/README.md`](docs/software/esp32-firmware/README.md)
- Hardware build, wiring, and ESC calibration: [`docs/hardware/README.md`](docs/hardware/README.md)
