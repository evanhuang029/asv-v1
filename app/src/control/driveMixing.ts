/**
 * Differential drive mixing shared by both Joystick mode and Tank Slider
 * mode, so the two control styles always produce identical PWM output for
 * the same effective left/right intent.
 */

export interface PwmRange {
  min: number;
  neutral: number;
  max: number;
}

export interface InvertFlags {
  invertLeft: boolean;
  invertRight: boolean;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Joystick mode: throttle/turn in [-1, 1] -> raw per-side values in [-1, 1]. */
export function mixJoystick(throttle: number, turn: number): { rawLeft: number; rawRight: number } {
  const rawLeft = clamp(throttle + turn, -1, 1);
  const rawRight = clamp(throttle - turn, -1, 1);
  return { rawLeft, rawRight };
}

/** Maps a normalized value in [-1, 1] to a PWM microsecond value, using the
 * configured neutral as the pivot so asymmetric min/neutral/max ranges (from
 * ESC calibration) map correctly on both sides of neutral. */
export function normalizedToPwm(value: number, range: PwmRange): number {
  const v = clamp(value, -1, 1);
  const span = v >= 0 ? range.max - range.neutral : range.neutral - range.min;
  return Math.round(range.neutral + v * span);
}

export interface DriveOutput {
  leftPwm: number;
  rightPwm: number;
}

/** Full pipeline: raw per-side [-1,1] values -> inversion -> PWM.
 * Both Joystick mode (via mixJoystick) and Tank Slider mode (raw values come
 * directly from the two sliders) funnel through this single function. */
export function computeDrivePwm(
  rawLeftIn: number,
  rawRightIn: number,
  invert: InvertFlags,
  range: PwmRange,
): DriveOutput {
  let rawLeft = clamp(rawLeftIn, -1, 1);
  let rawRight = clamp(rawRightIn, -1, 1);

  if (invert.invertLeft) rawLeft = -rawLeft;
  if (invert.invertRight) rawRight = -rawRight;

  return {
    leftPwm: normalizedToPwm(rawLeft, range),
    rightPwm: normalizedToPwm(rawRight, range),
  };
}
