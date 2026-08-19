# Software documentation

Three components, each in its own top-level folder, talking to each other in
a fixed chain:

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
comms-loss failsafe of its own beyond its 500ms serial-silence hold; the Pi
bridge independently forces neutral after 300ms of app silence as a
software safety net on top of that.

For the physical build (hull, thrusters, ESCs, wiring, power), see
[`docs/hardware/`](../hardware/README.md).

---

## Setup guides

| Component | Guide |
|---|---|
| Raspberry Pi bridge | [`pi-bridge/README.md`](pi-bridge/README.md) |
| iOS app | [`ios-app/README.md`](ios-app/README.md) |
| ESP32 firmware (reference only) | [`esp32-firmware/README.md`](esp32-firmware/README.md) |

---

## WebSocket protocol (app ↔ bridge)

Kept in sync between `pi-bridge/bridge.py` and `app/src/types/messages.ts`.

App → Pi:
```json
{ "type": "drive", "left": 1500, "right": 1500, "seq": 123 }
{ "type": "stop" }
{ "type": "ping" }
```
`left`/`right` are already-mixed, already-inverted PWM microsecond values --
the bridge does no math, it only forwards them to serial as `L:xxxx,R:xxxx`.

Pi → App:
```json
{ "type": "connected", "boatId": "trashboat-01" }
{ "type": "log", "line": "raw text from ESP32 or bridge status" }
{ "type": "failsafe_tripped" }
{ "type": "pong" }
```

---

## What's stubbed / explicitly out of scope

- **GPS / autonomous navigation**: no GPS module installed yet. Path
  Planning is a full UI + data model, but `control/navigator.ts`'s
  `DeadReckoningExecutor` is an open-loop, no-feedback stub -- see the
  comment block at the top of that file. Swap in a closed-loop
  GPS/heading-based controller behind the same `PathExecutor` interface
  later.
- **Battery telemetry**: no voltage/current sensor installed yet. The
  Drive screen has the UI slot wired to a static mock value in
  `useBoatStore.ts` (search for the `TODO` comment there). See
  [`docs/hardware/power/README.md`](../hardware/power/README.md).
- **Motor direction**: unconfirmed which thruster(s) need inverting --
  that's exactly what the Invert Left/Right toggles on the Drive screen
  (and mirrored in Settings) are for.
- **ESC neutral calibration**: `pwm_neutral` in `pi-bridge/config.json`
  and the PWM Neutral field in the app's Settings screen are both
  placeholders (1500) until the boat's own ESC calibration process
  produces a real value -- see
  [`docs/hardware/propulsion/README.md`](../hardware/propulsion/README.md)
  for the calibration procedure.

---

## Safety summary

- App sends a `drive` message every 150ms (and immediately on every
  control change) -- comfortably inside the ESP32's 500ms failsafe window.
- Bridge independently forces neutral if the app goes silent for 300ms,
  before the ESP32's own failsafe would ever trigger.
- STOP button on the Drive screen sends `stop`, then closes the WebSocket
  entirely; reconnecting requires the user to explicitly return to the
  Connect screen and tap Connect again -- no auto-reconnect after an
  intentional stop.
- The bridge also forces neutral on any client disconnect (including
  unexpected drops), and drops (with a forced-neutral write) any
  previously active client when a new one connects, since this is a
  single-operator boat.
- Nothing in the app or bridge suppresses or delays the ESP32's own
  500ms serial-silence failsafe -- that remains the last line of defense
  if WiFi is lost entirely.
