# Power system

Powers the ESP32, Raspberry Pi, and both ESCs/thrusters.

## Specs

| | |
|---|---|
| Battery chemistry | Likely LiPo -- not confirmed by a legible battery label, but inferred from (a) both ESCs' own spec printed as "2-4S LiPo" input, and (b) the bench charger being an iSDT smart charger (a LiPo/LiHV-focused charger family). TODO confirm directly off the battery's label. |
| Voltage / cell count | TODO -- ESCs support 2-4S LiPo (7.4-16.8V nominal range), but the pack's actual S-count isn't confirmed |
| Capacity | TODO -- battery label not legible in available photos |
| Distribution | XT60 connectors off the battery feed the switch/ESC wiring; each ESC has its own integrated SBEC (5.5V/4A) plus a separate standalone UBEC module also on the board -- see photo below. Full distribution topology (what the UBEC vs. the SBECs each power) still TODO. |
| Switch / disconnect | 3x SPDT toggle switches (ON/OFF bat-handle style) wired inline in the enclosure -- which switch is main power vs. arm/aux per-thruster is still TODO |
| Fusing | No fuse holder visible in any photographed wiring -- TODO confirm whether fusing exists elsewhere in the harness |
| Charging | Off-board: battery is charged with an iSDT smart charger (T2-series unit, seen with its retail box) rather than an onboard charge port |

![Wiring close-up: switches, ESCs, and a UBEC](images/wiring-switches-escs-closeup.jpg)

Close-up of the switch/distribution wiring: 3 toggle switches, XT60
connectors, both ESCs (Diamond Hobby Python 20A, each with an integrated
"SBEC 5.5V 4A"), and a separate small blue board labeled "UBEC ... 5A" in
its own static bag -- a second, standalone regulator distinct from the
ESCs' built-in SBECs. TODO confirm which toggle is main power vs.
arm/aux, and which loads the standalone UBEC feeds vs. the ESCs' SBECs.

![Battery pack and iSDT charger on the bench](../electronics/images/enclosure-interior-bench.jpg)

A battery pack (label mostly obscured, wrapped in bubble wrap) and an
iSDT smart charger with its retail box, shown during bench setup rather
than mounted on the boat -- TODO confirm battery spec directly and
photograph it in its actual mounted location.

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

- [x] `wiring-switches-escs-closeup.jpg` -- switches, ESCs, XT60 connectors, UBEC
- [x] battery + charger (bench, not mounted) -- see `../electronics/images/enclosure-interior-bench.jpg` (embedded above)
- [ ] `battery-mounted.jpg` -- battery in its actual mounting location on the boat
- [ ] `power-distribution.jpg` -- distribution block/terminal wiring to Pi, ESP32, and ESCs
- [ ] `fuses.jpg` -- fuse holder(s)/ratings, if present
- [ ] `charging-port.jpg` -- charging connector, if onboard charging is used
