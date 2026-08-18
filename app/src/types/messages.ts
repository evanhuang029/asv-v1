/**
 * Shared WebSocket protocol types for the app <-> pi-bridge link.
 *
 * Keep this file in sync with the JSON schema documented in
 * pi-bridge/bridge.py / README.md. The bridge does no math on drive
 * commands -- left/right are already-mixed, already-inverted PWM
 * microsecond values in the configured min/max range.
 */

// ---------------------------------------------------------------- App -> Pi

export interface DriveMessage {
  type: 'drive';
  left: number;
  right: number;
  seq: number;
}

export interface StopMessage {
  type: 'stop';
}

export interface PingMessage {
  type: 'ping';
}

/** Sent instead of `drive` when the control hasn't changed, just to keep the
 * bridge's activity timer fed at the expected ~150ms cadence. */
export interface HeartbeatMessage {
  type: 'heartbeat';
  left: number;
  right: number;
}

export type AppToPiMessage = DriveMessage | StopMessage | PingMessage | HeartbeatMessage;

// ---------------------------------------------------------------- Pi -> App

export interface ConnectedMessage {
  type: 'connected';
  boatId: string;
}

export interface LogMessage {
  type: 'log';
  line: string;
}

export interface FailsafeTrippedMessage {
  type: 'failsafe_tripped';
}

export interface PongMessage {
  type: 'pong';
}

export type PiToAppMessage =
  | ConnectedMessage
  | LogMessage
  | FailsafeTrippedMessage
  | PongMessage;

export function isPiToAppMessage(value: unknown): value is PiToAppMessage {
  if (typeof value !== 'object' || value === null) return false;
  const t = (value as { type?: unknown }).type;
  return (
    t === 'connected' || t === 'log' || t === 'failsafe_tripped' || t === 'pong'
  );
}
