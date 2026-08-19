import type { ConnectionStatus } from '../state/useBoatStore';
import type { DriveMessage, PingMessage, StopMessage } from '../types/messages';
import { isPiToAppMessage } from '../types/messages';

const HEARTBEAT_INTERVAL_MS = 150;
const RECONNECT_BASE_DELAY_MS = 500;
const RECONNECT_MAX_DELAY_MS = 8000;

/** How often to ping the bridge to measure link round-trip time for the
 * signal-bars indicator. Separate from the 150ms drive heartbeat -- that
 * cadence is about feeding the bridge's silence watchdog, this one is
 * about a human-readable signal reading, so 1s is plenty. */
const SIGNAL_PING_INTERVAL_MS = 1000;

/** RTT (ms) upper bound for each bar count, strongest first. iOS doesn't
 * expose real WiFi RSSI to third-party apps, so round-trip time over the
 * actual control link is used as the signal proxy instead -- arguably more
 * useful anyway, since it reflects whether commands are actually getting
 * through rather than raw radio strength. Thresholds are a rough starting
 * point (fast local WiFi hotspot should mostly sit at 8-10 bars); tune
 * against real on-water readings once you have them. */
const RTT_BAR_THRESHOLDS_MS = [50, 90, 130, 180, 240, 320, 420, 550, 700, 900];

function rttToBars(rttMs: number): number {
  for (let i = 0; i < RTT_BAR_THRESHOLDS_MS.length; i++) {
    if (rttMs <= RTT_BAR_THRESHOLDS_MS[i]) return RTT_BAR_THRESHOLDS_MS.length - i;
  }
  return 0;
}

export interface BoatConnectionHandlers {
  onStatusChange?: (status: ConnectionStatus) => void;
  onBoatId?: (boatId: string) => void;
  onLog?: (line: string) => void;
  onFailsafe?: () => void;
  /** 0-10 link-quality reading, see rttToBars. Fired roughly once per
   * second while connected, and once with 0 on disconnect. */
  onSignal?: (bars: number) => void;
}

/**
 * WebSocket client for the app <-> pi-bridge link.
 *
 * Owns reconnect-with-backoff (only for unexpected drops -- never after an
 * explicit STOP/disconnect) and the 150ms drive-heartbeat loop that keeps
 * the bridge's 300ms silence watchdog -- the only comms-loss failsafe in
 * this system, since the ESP32 firmware has none of its own -- from
 * tripping during normal operation.
 */
export class BoatConnection {
  private ws: WebSocket | null = null;
  private ip = '';
  private port = 8765;
  private seq = 0;
  private lastLeft = 1500;
  private lastRight = 1500;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private explicitDisconnect = false;
  private handlers: BoatConnectionHandlers = {};
  private signalTimer: ReturnType<typeof setInterval> | null = null;
  private pingOutstanding = false;
  private lastPingSentAt = 0;

  setHandlers(handlers: BoatConnectionHandlers): void {
    this.handlers = handlers;
  }

  connect(ip: string, port: number): void {
    this.ip = ip;
    this.port = port;
    this.explicitDisconnect = false;
    this.reconnectAttempt = 0;
    this.openSocket();
  }

  /** STOP + disconnect: send stop immediately, then close the connection
   * entirely. Reconnecting after this requires the user to explicitly tap
   * Connect again -- no auto-reconnect. */
  stop(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const msg: StopMessage = { type: 'stop' };
        this.ws.send(JSON.stringify(msg));
      } catch {
        // socket already going away, nothing more to do
      }
    }
    this.disconnect();
  }

  /** Deliberate disconnect with no auto-reconnect (used by STOP and by
   * leaving the app in a clean state). */
  disconnect(): void {
    this.explicitDisconnect = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.stopSignalMonitor();
    this.handlers.onSignal?.(0);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.handlers.onStatusChange?.('disconnected');
  }

  /** Called by the Drive/PathPlan screens whenever the commanded PWM values
   * change (e.g. joystick moved, slider dragged). Sends immediately; the
   * 150ms heartbeat loop keeps resending these same values afterward so the
   * bridge never sees more than ~150ms of silence during normal use. */
  sendDrive(left: number, right: number): void {
    this.lastLeft = left;
    this.lastRight = right;
    this.sendDriveRaw();
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ------------------------------------------------------------- internals

  private openSocket(): void {
    this.clearReconnectTimer();
    this.handlers.onStatusChange?.('connecting');

    const url = `ws://${this.ip}:${this.port}`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch (err) {
      this.handlers.onLog?.(`[app] failed to open socket: ${String(err)}`);
      this.scheduleReconnect();
      return;
    }
    this.ws = socket;

    socket.onmessage = event => this.handleMessage(String(event.data));

    socket.onerror = () => {
      this.handlers.onLog?.('[app] websocket error');
    };

    socket.onclose = () => {
      this.stopHeartbeat();
      this.stopSignalMonitor();
      this.handlers.onSignal?.(0);
      this.ws = null;
      this.handlers.onStatusChange?.('disconnected');
      if (!this.explicitDisconnect) {
        this.handlers.onLog?.('[app] connection lost, retrying...');
        this.scheduleReconnect();
      }
    };
  }

  private handleMessage(data: string): void {
    let msg: unknown;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (!isPiToAppMessage(msg)) return;

    switch (msg.type) {
      case 'connected':
        this.reconnectAttempt = 0;
        this.handlers.onBoatId?.(msg.boatId);
        this.handlers.onStatusChange?.('connected');
        this.startHeartbeat();
        this.startSignalMonitor();
        break;
      case 'log':
        this.handlers.onLog?.(msg.line);
        break;
      case 'failsafe_tripped':
        this.handlers.onFailsafe?.();
        this.handlers.onStatusChange?.('failsafe');
        break;
      case 'pong':
        if (this.pingOutstanding) {
          this.pingOutstanding = false;
          const rtt = Date.now() - this.lastPingSentAt;
          this.handlers.onSignal?.(rttToBars(rtt));
        }
        break;
    }
  }

  private scheduleReconnect(): void {
    if (this.explicitDisconnect) return;
    this.reconnectAttempt += 1;
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempt - 1),
      RECONNECT_MAX_DELAY_MS,
    );
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => this.sendDriveRaw(), HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startSignalMonitor(): void {
    this.stopSignalMonitor();
    this.pingOutstanding = false;
    this.signalTimer = setInterval(() => this.signalTick(), SIGNAL_PING_INTERVAL_MS);
  }

  private stopSignalMonitor(): void {
    if (this.signalTimer) {
      clearInterval(this.signalTimer);
      this.signalTimer = null;
    }
    this.pingOutstanding = false;
  }

  private signalTick(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.pingOutstanding) {
      // Previous ping never got a pong back within one interval -- treat
      // that as a dropped/very weak link rather than waiting indefinitely.
      this.handlers.onSignal?.(0);
    }
    this.pingOutstanding = true;
    this.lastPingSentAt = Date.now();
    const msg: PingMessage = { type: 'ping' };
    this.ws.send(JSON.stringify(msg));
  }

  private sendDriveRaw(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.seq += 1;
    const msg: DriveMessage = {
      type: 'drive',
      left: this.lastLeft,
      right: this.lastRight,
      seq: this.seq,
    };
    this.ws.send(JSON.stringify(msg));
  }
}

/** Single shared connection instance used by the whole app -- there is only
 * ever one boat and one operator, so a module-level singleton is simplest. */
export const boatConnection = new BoatConnection();
