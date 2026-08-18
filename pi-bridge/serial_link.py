"""
Thin wrapper around pyserial for talking to the boat's ESP32 motor
controller.

Handles opening the port, waiting (async) for the "Armed and ready" boot
line the firmware prints (or a timeout), writing "L:xxxx,R:xxxx\\n" PWM
commands, and streaming back whatever lines the ESP32 prints -- no protocol
parsing beyond splitting on newlines, per the bridge spec.

Serial reads are blocking, so they happen on a small background thread; read
lines are handed to the asyncio event loop via a thread-safe queue. Writes
are short (a handful of bytes at 115200 baud) and done synchronously from the
event loop thread, which is fine at the write rates this app produces
(commands every ~150ms).
"""
import asyncio
import logging
import threading
import time
from typing import Optional

import serial

logger = logging.getLogger("trashboat.serial")


class SerialLink:
    def __init__(self, port: str, baud_rate: int, pwm_min: int, pwm_neutral: int, pwm_max: int):
        self.port = port
        self.baud_rate = baud_rate
        self.pwm_min = pwm_min
        self.pwm_neutral = pwm_neutral
        self.pwm_max = pwm_max

        self._ser: Optional[serial.Serial] = None
        self._read_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._line_queue: "asyncio.Queue[str]" = asyncio.Queue()
        self._write_lock = threading.Lock()

    def open(self) -> None:
        logger.info("Opening serial port %s @ %d baud", self.port, self.baud_rate)
        # Opening the port toggles DTR on most USB-serial adapters, which
        # resets the ESP32 and restarts its boot/arm sequence (see
        # esp32-firmware/motor_controller.ino) -- this is expected.
        self._ser = serial.Serial(self.port, self.baud_rate, timeout=0.2)

    def close(self) -> None:
        self._stop_event.set()
        if self._read_thread is not None:
            self._read_thread.join(timeout=2)
        if self._ser is not None and self._ser.is_open:
            try:
                self.write_neutral()
            except Exception:
                pass
            self._ser.close()
            logger.info("Serial port closed.")

    def start_reader(self, loop: asyncio.AbstractEventLoop) -> None:
        """Start the background thread that reads lines off the serial port
        and pushes them onto an asyncio queue for the event loop to consume."""
        self._loop = loop
        self._read_thread = threading.Thread(target=self._read_loop, daemon=True)
        self._read_thread.start()

    def _read_loop(self) -> None:
        assert self._ser is not None
        while not self._stop_event.is_set():
            try:
                raw = self._ser.readline()
            except serial.SerialException as exc:
                logger.error("Serial read error: %s", exc)
                time.sleep(0.5)
                continue
            if not raw:
                continue
            line = raw.decode(errors="ignore").strip()
            if not line:
                continue
            if self._loop is not None:
                self._loop.call_soon_threadsafe(self._line_queue.put_nowait, line)

    async def next_line(self) -> str:
        """Await the next line read from the ESP32."""
        return await self._line_queue.get()

    async def wait_for_armed(self, ready_substring: str, timeout_sec: float) -> bool:
        """Block (async) until a line containing ready_substring is read, or
        timeout_sec elapses. Returns True if the armed line was seen.

        Any lines seen while waiting are logged here (not forwarded to an
        app -- no app is connected yet at this point in startup)."""
        deadline = time.monotonic() + timeout_sec
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return False
            try:
                line = await asyncio.wait_for(self.next_line(), timeout=remaining)
            except asyncio.TimeoutError:
                return False
            logger.info("[esp32 boot] %s", line)
            if ready_substring in line:
                return True

    def clamp(self, value: int) -> int:
        return max(self.pwm_min, min(self.pwm_max, int(value)))

    def write_pwm(self, left: int, right: int) -> None:
        left = self.clamp(left)
        right = self.clamp(right)
        line = f"L:{left},R:{right}\n"
        with self._write_lock:
            if self._ser is not None and self._ser.is_open:
                self._ser.write(line.encode())

    def write_neutral(self) -> None:
        self.write_pwm(self.pwm_neutral, self.pwm_neutral)
