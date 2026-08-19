# ESP32 firmware (reference only)

**This firmware is not touched by this project.** `esp32-firmware/motor_controller.ino`
is included purely so the Pi bridge and app developers have the
authoritative source for the serial protocol, pin assignments, and
boot/arm timing. Do not modify, restructure, or "clean up" that file.

The Pi bridge (`pi-bridge/`) is responsible for its own connection-loss
safety net (forcing neutral after 300ms of silence from the app)
independently of this firmware -- the firmware has no comms-loss failsafe
timeout by design and should not be given one.

For the physical ESP32 board, its enclosure, and how it's wired to the Pi
and ESCs, see
[`docs/hardware/electronics/README.md`](../../hardware/electronics/README.md)
and
[`docs/hardware/propulsion/README.md`](../../hardware/propulsion/README.md).

## Serial protocol

ASCII lines of the form `L:xxxx,R:xxxx\n`, where `xxxx` is a PWM value in
microseconds, clamped to 1000-2000 by the firmware.

- Port/baud (set on the Pi side): `/dev/ttyUSB0` @ 115200.
- ESC signal pins: GPIO 25 (left / `esc1`), GPIO 26 (right / `esc2`).

## Boot / arm sequence

1. 1s delay
2. Attach ESCs (GPIO 25, 26)
3. Write neutral (1500us) to both
4. Hold 3s
5. Print `"=== Armed and ready. Waiting for commands. ==="`

Opening the serial port typically toggles DTR and resets the ESP32,
restarting this sequence -- this is why the Pi bridge waits for the armed
line after opening the port rather than assuming the ESP32 is immediately
ready.
