// NAVIGATION STUB — replace this whole executor once GPS is installed.
// This implementation has no feedback (no GPS, no compass, no IMU), so it
// will drift and is only meant to prove the plumbing (path -> commands ->
// boat) works end-to-end. Swap in a closed-loop GPS/heading-based
// controller behind the same PathExecutor interface later.

import type { Waypoint, Leg } from '../types/path';
import { computeDrivePwm, type InvertFlags, type PwmRange } from './driveMixing';

// All crude, uncalibrated guesses -- there is no compass/IMU feedback to
// tune these against yet. Revisit once real sensors exist.
const TURN_RATE_DEG_PER_SEC = 45;
const FORWARD_THROTTLE = 0.5; // [-1, 1]
const TURN_STRENGTH = 0.5; // [-1, 1] differential strength while turning
const INTER_LEG_PAUSE_SEC = 0.5;
const CANCEL_POLL_MS = 50;

/** Converts a waypoint list into {headingDegrees, durationSeconds} legs.
 * Heading convention: 0deg = "up" (toward -y in grid/screen space),
 * increasing clockwise like a compass, matching WaypointGridCanvas's visual
 * layout. Distance is scaled by unitsPerSecond (from Settings) since there
 * is no real speed calibration yet. */
export function computeLegs(waypoints: Waypoint[], unitsPerSecond: number): Leg[] {
  const legs: Leg[] = [];
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    let headingDegrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (headingDegrees < 0) headingDegrees += 360;
    const durationSeconds = unitsPerSecond > 0 ? distance / unitsPerSecond : 0;
    legs.push({ headingDegrees, durationSeconds });
  }
  return legs;
}

function normalizeAngleDelta(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export interface PathExecutor {
  run(waypoints: Waypoint[]): Promise<void>;
  stop(): void;
}

export interface PathExecutorDeps {
  /** Same underlying send path the Drive screen uses (BoatConnection.sendDrive). */
  sendDrive: (leftPwm: number, rightPwm: number) => void;
  getPwmRange: () => PwmRange;
  getInvert: () => InvertFlags;
  getUnitsPerSecond: () => number;
}

/**
 * Open-loop dead-reckoning executor:
 *   for each leg in path:
 *     turn the boat to approximately headingDegrees (fixed differential
 *       turn command for an estimated turn duration -- intentionally crude)
 *     drive both thrusters at a fixed forward throttle for durationSeconds
 *     stop briefly between legs
 */
export class DeadReckoningExecutor implements PathExecutor {
  private cancelled = false;
  private deps: PathExecutorDeps;

  constructor(deps: PathExecutorDeps) {
    this.deps = deps;
  }

  async run(waypoints: Waypoint[]): Promise<void> {
    this.cancelled = false;
    const legs = computeLegs(waypoints, this.deps.getUnitsPerSecond());
    let currentHeading = 0; // assumes the boat starts pointed at heading 0 ("up")

    for (const leg of legs) {
      if (this.cancelled) break;

      const delta = normalizeAngleDelta(leg.headingDegrees - currentHeading);
      const turnDurationSec = Math.abs(delta) / TURN_RATE_DEG_PER_SEC;
      const turnSign = delta >= 0 ? 1 : -1;

      if (turnDurationSec > 0.02) {
        this.drive(turnSign * TURN_STRENGTH, -turnSign * TURN_STRENGTH);
        await this.sleep(turnDurationSec * 1000);
        if (this.cancelled) break;
      }
      currentHeading = leg.headingDegrees;

      this.drive(FORWARD_THROTTLE, FORWARD_THROTTLE);
      await this.sleep(leg.durationSeconds * 1000);
      if (this.cancelled) break;

      this.drive(0, 0);
      await this.sleep(INTER_LEG_PAUSE_SEC * 1000);
    }

    this.drive(0, 0);
  }

  stop(): void {
    this.cancelled = true;
    this.drive(0, 0);
  }

  private drive(rawLeft: number, rawRight: number): void {
    const { leftPwm, rightPwm } = computeDrivePwm(
      rawLeft,
      rawRight,
      this.deps.getInvert(),
      this.deps.getPwmRange(),
    );
    this.deps.sendDrive(leftPwm, rightPwm);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      const start = Date.now();
      const check = () => {
        if (this.cancelled || Date.now() - start >= ms) {
          resolve();
          return;
        }
        setTimeout(check, CANCEL_POLL_MS);
      };
      check();
    });
  }
}
