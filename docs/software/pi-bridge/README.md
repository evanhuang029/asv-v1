# Pi bridge setup

Requires Python 3.9+ and the ESP32 connected via USB (`/dev/ttyUSB0`). See
[`docs/hardware/electronics/README.md`](../../hardware/electronics/README.md)
for how the Pi and ESP32 are physically wired together.

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
placeholder, not a calibrated value. See
[ESC calibration](../../hardware/propulsion/README.md#esc-calibration) for
the procedure.

On startup the bridge opens the serial port (which resets the ESP32, since
opening the port toggles DTR on most USB-serial adapters) and waits for the
`"=== Armed and ready. Waiting for commands. ==="` line (or a 5s timeout)
before starting the WebSocket server -- so the app can never show
"Connected" before the ESCs are actually armed.

## Run on boot (systemd)

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

## Manual protocol smoke test

The bridge was verified end-to-end during development using a `socat`
virtual serial pair standing in for the ESP32 (boot/arm timing, `drive`
commands reaching serial as `L:xxxx,R:xxxx`, the 300ms silence watchdog
forcing neutral and emitting `failsafe_tripped`, STOP forcing neutral, and a
second client connection dropping the first) -- see `bridge.py` /
`serial_link.py` for the implementation this exercised.
