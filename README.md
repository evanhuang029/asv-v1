# Trashboat Control

Control app for an autonomous trash-collecting boat (twin-pontoon catamaran).
This repo contains the two layers built on top of the existing, unmodified
hardware/firmware:

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
software safety net on top of that (see `pi-bridge/bridge.py`).

---

## Repo layout

```
esp32-firmware/   reference copy of the existing, unmodified ESP32 sketch
pi-bridge/        Python 3 WebSocket <-> serial bridge, runs on the Pi
app/              React Native (TypeScript) iOS app
```

---

## 1. Pi bridge setup

Requires Python 3.9+ and the ESP32 connected via USB (`/dev/ttyUSB0`).

```bash
cd pi-bridge
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 bridge.py            # uses config.json in this directory
```

`config.json` holds the serial port, baud rate, WebSocket port, and PWM
min/neutral/max. **Update `pwm_neutral` once the boat's ESC calibration
process determines the true neutral point** -- 1500 is only a firmware
placeholder, not a calibrated value.

On startup the bridge opens the serial port (which resets the ESP32, since
opening the port toggles DTR on most USB-serial adapters) and waits for the
`"=== Armed and ready. Waiting for commands. ==="` line (or a 5s timeout)
before starting the WebSocket server -- so the app can never show
"Connected" before the ESCs are actually armed.

### Run on boot (systemd)

```bash
sudo cp pi-bridge/trashboat-bridge.service /etc/systemd/system/
sudo usermod -aG dialout pi          # so the service can open /dev/ttyUSB0
sudo systemctl daemon-reload
sudo systemctl enable --now trashboat-bridge
journalctl -u trashboat-bridge -f    # tail logs
```

Adjust `WorkingDirectory`/`ExecStart`/`User` in the unit file to match where
you clone this repo on the Pi. If the Pi hosts its own WiFi hotspot (e.g.
via `hostapd`/`dnsmasq`), uncomment the `After=`/`Wants=` lines so the
bridge starts once the hotspot is up -- hotspot setup itself is a separate,
one-time OS configuration step not covered by this repo.

### Manual protocol smoke test

The bridge was verified end-to-end during development using a `socat`
virtual serial pair standing in for the ESP32 (boot/arm timing, `drive`
commands reaching serial as `L:xxxx,R:xxxx`, the 300ms silence watchdog
forcing neutral and emitting `failsafe_tripped`, STOP forcing neutral, and a
second client connection dropping the first) -- see `bridge.py` /
`serial_link.py` for the implementation this exercised.

---

## 2. iOS app setup

The app is a standard React Native CLI project (TypeScript, iOS only --
Android scaffolding was intentionally removed).

### Prerequisites (do this once)

1. Install Xcode from the Mac App Store, then open it once to accept the
   license and let it install additional components.
2. Install the Command Line Tools: `xcode-select --install`
3. Install CocoaPods: `sudo gem install cocoapods` (or `brew install cocoapods`)
4. Node.js 22+ and npm (already required to have gotten this far).

### Install & run

```bash
cd app
npm install            # already done if you're reading this after the initial build
cd ios && pod install && cd ..
npm run ios             # boots the iOS Simulator and builds/runs the app
```

To run on a physical iPhone: open `ios/app.xcworkspace` in Xcode, select
your device as the run target, and press Run. A physical device is
strongly recommended for testing the joystick/tank-slider gesture feel --
the Simulator's mouse-based touch emulation doesn't fully match real touch
input.

### Where things live

```
app/src/
  screens/        ConnectScreen, DriveScreen, PathPlanScreen, SettingsScreen
  navigation/      AppNavigator.tsx (React Navigation native-stack)
  networking/      BoatConnection.ts -- WebSocket client, reconnect/backoff, 150ms heartbeat
  control/         driveMixing.ts (joystick/tank -> PWM math), navigator.ts (dead-reckoning stub)
  state/           useBoatStore.ts -- Zustand store, persisted via AsyncStorage
  components/      Joystick, TankSliders, MotorBar, DebugConsole, StopButton, WaypointGridCanvas
  types/           messages.ts (WS protocol, kept in sync with pi-bridge/bridge.py), path.ts
```

State management: **Zustand** (chosen over plain Context) -- less
boilerplate for persistence via its middleware, and avoids re-rendering the
whole component tree on every ~150ms telemetry/heartbeat tick the way a
naive single Context value would.

---

## 3. WebSocket protocol (app <-> bridge)

Kept in sync between `pi-bridge/bridge.py` and `app/src/types/messages.ts`.

App -> Pi:
```json
{ "type": "drive", "left": 1500, "right": 1500, "seq": 123 }
{ "type": "stop" }
{ "type": "ping" }
```
`left`/`right` are already-mixed, already-inverted PWM microsecond values --
the bridge does no math, it only forwards them to serial as `L:xxxx,R:xxxx`.

Pi -> App:
```json
{ "type": "connected", "boatId": "trashboat-01" }
{ "type": "log", "line": "raw text from ESP32 or bridge status" }
{ "type": "failsafe_tripped" }
{ "type": "pong" }
```

---

## 4. What's stubbed / explicitly out of scope

- **GPS / autonomous navigation**: no GPS module installed yet. Path
  Planning is a full UI + data model, but `control/navigator.ts`'s
  `DeadReckoningExecutor` is an open-loop, no-feedback stub -- see the
  comment block at the top of that file. Swap in a closed-loop
  GPS/heading-based controller behind the same `PathExecutor` interface
  later.
- **Battery telemetry**: no voltage/current sensor installed yet. The
  Drive screen has the UI slot wired to a static mock value in
  `useBoatStore.ts` (search for the `TODO` comment there).
- **Motor direction**: unconfirmed which thruster(s) need inverting --
  that's exactly what the Invert Left/Right toggles on the Drive screen
  (and mirrored in Settings) are for.
- **ESC neutral calibration**: `pwm_neutral` in `pi-bridge/config.json`
  and the PWM Neutral field in the app's Settings screen are both
  placeholders (1500) until the boat's own ESC calibration process
  produces a real value.

---

## 5. Safety summary

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
