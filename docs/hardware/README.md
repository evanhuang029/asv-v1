# Hardware documentation

Physical build documentation for the ASV v1 hull, propulsion, electronics,
and power system. For the software that runs on top of this hardware, see
[`docs/software/`](../software/README.md).

> **This documentation is a work in progress.** Sections marked `TODO` need
> specs filled in, and each subfolder lists the photos still needed --
> see [Photos needed](#photos-needed) below.

---

## System overview

```
                    ┌───────────────────────────┐
                    │        Hull / pontoons     │
                    │  (twin-pontoon catamaran)  │
                    └──────────────┬──────────────┘
                                   │ mounts
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
┌───────┴────────┐        ┌────────┴────────┐        ┌────────┴────────┐
│  Electronics    │  USB   │   Power system   │        │   Propulsion     │
│  enclosure:     │◄──────►│   battery,       │───────►│   2x ESC ->      │
│  ESP32 + Pi 4   │ serial │   distribution,  │  power │   2x ApisQueen   │
│                 │        │   switch/fuse    │        │   U2 Mini        │
└─────────────────┘        └──────────────────┘        └──────────────────┘
```

See [`docs/software/README.md`](../software/README.md) for the data/control
flow (app → Pi bridge → ESP32 → ESCs) layered on top of this physical
system.

## Subsystems

| Subsystem | Guide | Covers |
|---|---|---|
| Hull & pontoons | [`hull-and-pontoons/README.md`](hull-and-pontoons/README.md) | Hull material, dimensions, pontoon layout, mounting points |
| Propulsion | [`propulsion/README.md`](propulsion/README.md) | Thrusters, ESCs, mounting, wiring, **ESC calibration procedure** |
| Electronics | [`electronics/README.md`](electronics/README.md) | ESP32 + Raspberry Pi mounting, enclosure, USB/GPIO wiring |
| Power | [`power/README.md`](power/README.md) | Battery, power distribution, switches/fuses |

## Bill of materials

| Component | Spec | Notes |
|---|---|---|
| Hull | TODO (material, dimensions) | Twin-pontoon catamaran layout |
| Thrusters | 2x ApisQueen U2 Mini | See [`propulsion/README.md`](propulsion/README.md) |
| ESCs | 2x, TODO (make/model) | Signal from ESP32 GPIO 25 (left), GPIO 26 (right) |
| Main controller | ESP32, TODO (exact board/module) | Reference-only firmware, see [`docs/software/esp32-firmware/README.md`](../software/esp32-firmware/README.md) |
| Bridge computer | Raspberry Pi 4, TODO (RAM size) | Runs `pi-bridge/`, connects to ESP32 via USB |
| Battery | TODO (chemistry, voltage, capacity) | No voltage/current telemetry installed yet |
| Wiring / connectors | TODO | |
| Enclosure | TODO | Waterproofing for ESP32 + Pi |

Fill in the `TODO` fields as the build is finalized -- they're placeholders,
not guesses.

---

## Photos needed

General/overview shots (add to `docs/hardware/images/`):

- [ ] Full boat, front-on
- [ ] Full boat, side profile
- [ ] Full boat, top-down (both pontoons + electronics enclosure visible)

Each subsystem below has its own more specific list -- see the linked
README for exactly which close-ups are useful and where to save them.
