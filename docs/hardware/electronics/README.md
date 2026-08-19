# Electronics: ESP32 & Raspberry Pi

The two compute boards that carry the control chain
(app → Pi → ESP32 → ESCs, see
[`docs/software/README.md`](../../software/README.md)).

## Boards

| | |
|---|---|
| Main controller | ESP32, TODO (exact board/module, e.g. ESP32-WROOM-32 devkit) |
| Bridge computer | Raspberry Pi 4, TODO (RAM size, model) |
| Connection | USB serial, `/dev/ttyUSB0` @ 115200 baud |
| ESP32 GPIO 25 | Left ESC signal (`esc1`) |
| ESP32 GPIO 26 | Right ESC signal (`esc2`) |

Opening the serial port from the Pi toggles DTR on most USB-serial
adapters, which resets the ESP32 and restarts its boot/arm sequence -- this
is expected behavior, not a fault. See
[`docs/software/esp32-firmware/README.md`](../../software/esp32-firmware/README.md)
for the full boot/arm timing.

## Enclosure

TODO: describe the enclosure/waterproofing for the ESP32 + Pi (box type,
material, IP rating, cable glands, ventilation).

## Networking

The Pi hosts a WiFi hotspot the iOS app connects to directly (WebSocket,
port 8765). Hotspot setup (`hostapd`/`dnsmasq`) is a one-time OS
configuration step -- TODO: document the actual hotspot config used, or
link to it if kept elsewhere.

---

## Photos needed

Save to `docs/hardware/electronics/images/`:

- [ ] `enclosure-exterior.jpg` -- enclosure as mounted on the boat, closed
- [ ] `enclosure-interior.jpg` -- enclosure open, ESP32 + Pi + wiring visible
- [ ] `esp32-board.jpg` -- close-up of the ESP32 board/module itself
- [ ] `raspberry-pi-board.jpg` -- close-up of the Raspberry Pi
- [ ] `usb-connection.jpg` -- the USB cable connecting Pi to ESP32
- [ ] `gpio-wiring.jpg` -- close-up of GPIO 25/26 wiring to the ESC signal leads
