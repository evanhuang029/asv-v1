#!/usr/bin/env python3
"""
trashboat pi-bridge -- WebSocket <-> serial bridge for the trash-collecting
boat.

Runs on the Raspberry Pi 4. Hosts a WebSocket server on the Pi's WiFi
hotspot, receives JSON drive commands from the iOS app, writes the
corresponding "L:xxxx,R:xxxx\\n" line to the ESP32 over USB serial, and
relays ESP32 serial output back to the app as `log` messages for its debug
console.

Safety notes:
  - This bridge independently forces neutral if the app goes silent for
    `client_silence_timeout_sec` (default 300ms). That is a software safety
    net on top of, not a replacement for, the ESP32 firmware's own 500ms
    serial-silence failsafe. The firmware is not modified by this bridge.
  - On explicit client disconnect (including STOP+disconnect from the app),
    neutral is forced immediately.
  - Only one app connection is served at a time -- a new connection drops
    the previous one (single-operator boat).

Usage:
    python3 bridge.py [path/to/config.json]

In production this runs under systemd -- see trashboat-bridge.service.
"""
import asyncio
import json
import logging
import signal
import sys
import time
from pathlib import Path
from typing import Any, Optional

import websockets

from serial_link import SerialLink

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("trashboat.bridge")


def load_config(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


class Bridge:
    def __init__(self, config: dict):
        self.config = config
        self.serial = SerialLink(
            port=config["serial_port"],
            baud_rate=config["baud_rate"],
            pwm_min=config["pwm_min"],
            pwm_neutral=config["pwm_neutral"],
            pwm_max=config["pwm_max"],
        )
        self.active_client: Optional[Any] = None
        self.last_msg_time: float = 0.0
        self.last_left = config["pwm_neutral"]
        self.last_right = config["pwm_neutral"]
        self.failsafe_active = False

    # ---------------------------------------------------------------- serial

    async def start_serial(self) -> None:
        loop = asyncio.get_running_loop()
        self.serial.open()
        self.serial.start_reader(loop)
        logger.info("Waiting for ESP32 to boot and arm...")
        armed = await self.serial.wait_for_armed(
            self.config["arm_ready_line"], self.config["arm_wait_timeout_sec"]
        )
        if armed:
            logger.info("ESP32 reported armed and ready.")
        else:
            logger.warning(
                "Timed out waiting for '%s' after %.1fs -- proceeding anyway "
                "(boat may not actually be armed yet).",
                self.config["arm_ready_line"],
                self.config["arm_wait_timeout_sec"],
            )

    async def serial_log_pump(self) -> None:
        """Continuously forward ESP32 serial lines to the active client."""
        while True:
            line = await self.serial.next_line()
            logger.info("[esp32] %s", line)
            await self.broadcast({"type": "log", "line": line})

    async def silence_watchdog(self) -> None:
        """Force neutral if the app goes silent for client_silence_timeout_sec
        -- independent of, and in addition to, the ESP32's own 500ms
        serial-silence failsafe."""
        timeout = self.config["client_silence_timeout_sec"]
        interval = self.config["silence_check_interval_sec"]
        while True:
            await asyncio.sleep(interval)
            if self.active_client is None:
                continue
            silence = time.monotonic() - self.last_msg_time
            if silence > timeout and not self.failsafe_active:
                logger.warning(
                    "No message from app for %.0fms (> %.0fms) -- forcing neutral.",
                    silence * 1000,
                    timeout * 1000,
                )
                self.serial.write_neutral()
                self.last_left = self.config["pwm_neutral"]
                self.last_right = self.config["pwm_neutral"]
                self.failsafe_active = True
                await self.broadcast({"type": "failsafe_tripped"})
                await self.broadcast(
                    {
                        "type": "log",
                        "line": f"[bridge] failsafe: {silence * 1000:.0f}ms of app silence, forced neutral",
                    }
                )

    # ------------------------------------------------------------ websocket

    async def broadcast(self, message: dict) -> None:
        if self.active_client is None:
            return
        try:
            await self.active_client.send(json.dumps(message))
        except websockets.ConnectionClosed:
            pass

    async def handle_client(self, websocket, path=None) -> None:
        # Single-operator boat: a new connection immediately replaces
        # whatever was active before.
        if self.active_client is not None and self.active_client is not websocket:
            logger.info("New client connected -- dropping previous client.")
            old = self.active_client
            self.active_client = None
            try:
                await old.close(reason="replaced by new connection")
            except Exception:
                pass

        self.active_client = websocket
        self.last_msg_time = time.monotonic()
        self.failsafe_active = False
        peer = getattr(websocket, "remote_address", "?")
        logger.info("Client connected: %s", peer)

        await websocket.send(
            json.dumps({"type": "connected", "boatId": self.config["boat_id"]})
        )

        try:
            async for raw in websocket:
                await self._handle_message(raw)
        except websockets.ConnectionClosed:
            pass
        finally:
            if self.active_client is websocket:
                logger.info("Client disconnected: %s -- forcing neutral.", peer)
                self.serial.write_neutral()
                self.last_left = self.config["pwm_neutral"]
                self.last_right = self.config["pwm_neutral"]
                self.active_client = None

    async def _handle_message(self, raw: str) -> None:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Ignoring malformed message: %r", raw)
            return

        msg_type = msg.get("type")
        self.last_msg_time = time.monotonic()

        if msg_type in ("drive", "heartbeat"):
            left = msg.get("left", self.last_left)
            right = msg.get("right", self.last_right)
            self.serial.write_pwm(left, right)
            self.last_left, self.last_right = left, right
            if self.failsafe_active:
                self.failsafe_active = False
                logger.info("App resumed sending commands -- failsafe cleared.")

        elif msg_type == "stop":
            logger.info("STOP received -- forcing neutral.")
            self.serial.write_neutral()
            self.last_left = self.config["pwm_neutral"]
            self.last_right = self.config["pwm_neutral"]
            # The app is expected to close the connection right after STOP;
            # if it doesn't, we just sit at neutral until it does (or until
            # the silence watchdog would fire anyway).

        elif msg_type == "ping":
            await self.active_client.send(json.dumps({"type": "pong"}))

        else:
            logger.warning("Unknown message type: %r", msg_type)

    # -------------------------------------------------------------- run loop

    async def run(self) -> None:
        await self.start_serial()

        background_tasks = [
            asyncio.create_task(self.serial_log_pump()),
            asyncio.create_task(self.silence_watchdog()),
        ]

        host = self.config["websocket_host"]
        port = self.config["websocket_port"]
        logger.info("Starting WebSocket server on %s:%d", host, port)

        # ping_interval disabled: the `websockets` library's own
        # protocol-level ping/pong keepalive is unreliable with React
        # Native's WebSocket client (pings are frequently not answered at
        # the native layer), which otherwise causes the server to close the
        # connection as unresponsive every ping_interval+ping_timeout
        # seconds -- seen from the app as spurious connect/disconnect
        # flicker even though the link is healthy. Liveness is already
        # covered independently by the app's ~150ms drive/heartbeat
        # messages and this bridge's own silence_watchdog, so the
        # library-level ping/pong is both redundant and actively harmful
        # here.
        async with websockets.serve(self.handle_client, host, port, ping_interval=None):
            stop_event = asyncio.Event()

            def _handle_signal() -> None:
                logger.info("Shutdown signal received.")
                stop_event.set()

            loop = asyncio.get_running_loop()
            for sig in (signal.SIGINT, signal.SIGTERM):
                try:
                    loop.add_signal_handler(sig, _handle_signal)
                except NotImplementedError:
                    # Signal handlers aren't available on some platforms
                    # (e.g. Windows) -- fine for dev use, Pi is Linux.
                    pass

            await stop_event.wait()

        for t in background_tasks:
            t.cancel()
        self.serial.close()


def main() -> None:
    config_path = sys.argv[1] if len(sys.argv) > 1 else str(
        Path(__file__).with_name("config.json")
    )
    config = load_config(config_path)
    bridge = Bridge(config)
    try:
        asyncio.run(bridge.run())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
