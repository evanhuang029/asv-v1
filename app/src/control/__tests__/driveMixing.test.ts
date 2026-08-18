import { clamp, computeDrivePwm, mixJoystick, normalizedToPwm } from '../driveMixing';

const RANGE = { min: 1000, neutral: 1500, max: 2000 };

describe('clamp', () => {
  it('clamps within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('normalizedToPwm', () => {
  it('maps -1, 0, 1 to min/neutral/max', () => {
    expect(normalizedToPwm(1, RANGE)).toBe(2000);
    expect(normalizedToPwm(0, RANGE)).toBe(1500);
    expect(normalizedToPwm(-1, RANGE)).toBe(1000);
  });

  it('maps midpoints proportionally on each side of neutral', () => {
    expect(normalizedToPwm(0.5, RANGE)).toBe(1750);
    expect(normalizedToPwm(-0.5, RANGE)).toBe(1250);
  });

  it('respects an asymmetric range around neutral', () => {
    const asym = { min: 1100, neutral: 1550, max: 1900 };
    expect(normalizedToPwm(1, asym)).toBe(1900);
    expect(normalizedToPwm(-1, asym)).toBe(1100);
  });
});

describe('mixJoystick', () => {
  it('pure forward drives both sides equally', () => {
    expect(mixJoystick(1, 0)).toEqual({ rawLeft: 1, rawRight: 1 });
  });

  it('pure right turn drives left forward, right reverse', () => {
    expect(mixJoystick(0, 1)).toEqual({ rawLeft: 1, rawRight: -1 });
  });

  it('pure left turn drives right forward, left reverse', () => {
    expect(mixJoystick(0, -1)).toEqual({ rawLeft: -1, rawRight: 1 });
  });

  it('clamps combined throttle+turn to [-1, 1]', () => {
    const { rawLeft, rawRight } = mixJoystick(0.8, 0.8);
    expect(rawLeft).toBe(1);
    expect(rawRight).toBeCloseTo(0);
  });
});

describe('computeDrivePwm', () => {
  const noInvert = { invertLeft: false, invertRight: false };

  it('full forward on both sides maps to max PWM', () => {
    const { leftPwm, rightPwm } = computeDrivePwm(1, 1, noInvert, RANGE);
    expect(leftPwm).toBe(2000);
    expect(rightPwm).toBe(2000);
  });

  it('neutral stick maps to neutral PWM', () => {
    const { leftPwm, rightPwm } = computeDrivePwm(0, 0, noInvert, RANGE);
    expect(leftPwm).toBe(1500);
    expect(rightPwm).toBe(1500);
  });

  it('inverting one motor flips only that motor\'s output', () => {
    const { leftPwm, rightPwm } = computeDrivePwm(1, 1, { invertLeft: true, invertRight: false }, RANGE);
    expect(leftPwm).toBe(1000); // inverted: full forward command -> reverse PWM
    expect(rightPwm).toBe(2000); // untouched
  });

  it('inverting both motors mirrors both outputs', () => {
    const { leftPwm, rightPwm } = computeDrivePwm(1, -1, { invertLeft: true, invertRight: true }, RANGE);
    expect(leftPwm).toBe(1000);
    expect(rightPwm).toBe(2000);
  });
});
