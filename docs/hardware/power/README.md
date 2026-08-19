# Power system

Powers the ESP32, Raspberry Pi, and both ESCs/thrusters.

## Specs

| | |
|---|---|
| Battery chemistry | TODO (e.g. LiPo, LiFePO4, SLA) |
| Voltage | TODO |
| Capacity | TODO |
| Distribution | TODO (single bus vs. separate rails for logic vs. thrusters, BEC/regulator if any) |
| Switch / disconnect | TODO (main power switch or breaker location) |
| Fusing | TODO (fuse ratings and locations) |
| Charging | TODO (onboard vs. removable battery, connector type) |

**No voltage/current telemetry is installed yet.** The app's Drive screen
has a UI slot for battery level wired to a static mock value (see the
`TODO` comment in `app/src/state/useBoatStore.ts`) -- wiring in a real
sensor is future work, see
[`docs/software/README.md`](../../software/README.md#whats-stubbed--explicitly-out-of-scope).

## Safety

- Always have a way to cut power immediately (physical switch or unplugging
  the battery) -- this is required before doing any
  [ESC calibration](../propulsion/README.md#esc-calibration).
- TODO: note any low-voltage cutoff behavior, if the ESCs or a BMS provide one.

---

## Photos needed

Save to `docs/hardware/power/images/`:

- [ ] `battery-mounted.jpg` -- battery in its mounting location
- [ ] `power-distribution.jpg` -- distribution block/terminal wiring to Pi, ESP32, and ESCs
- [ ] `main-switch.jpg` -- main power switch/breaker
- [ ] `fuses.jpg` -- fuse holder(s)/ratings, if present
- [ ] `charging-port.jpg` -- charging connector, if onboard charging is used
