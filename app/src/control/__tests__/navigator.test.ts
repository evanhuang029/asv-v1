import { computeLegs } from '../navigator';

describe('computeLegs', () => {
  it('produces no legs for fewer than 2 waypoints', () => {
    expect(computeLegs([], 1)).toEqual([]);
    expect(computeLegs([{ id: 'a', x: 0, y: 0 }], 1)).toEqual([]);
  });

  it('heading 0 (up) for a point directly above (negative y)', () => {
    const legs = computeLegs(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 0, y: -5 },
      ],
      1,
    );
    expect(legs).toHaveLength(1);
    expect(legs[0].headingDegrees).toBeCloseTo(0);
    expect(legs[0].durationSeconds).toBeCloseTo(5);
  });

  it('heading 90 (right) for a point directly to the right', () => {
    const legs = computeLegs(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 5, y: 0 },
      ],
      1,
    );
    expect(legs[0].headingDegrees).toBeCloseTo(90);
  });

  it('heading 180 (down) for a point directly below', () => {
    const legs = computeLegs(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 0, y: 5 },
      ],
      1,
    );
    expect(legs[0].headingDegrees).toBeCloseTo(180);
  });

  it('heading 270 (left) for a point directly to the left', () => {
    const legs = computeLegs(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: -5, y: 0 },
      ],
      1,
    );
    expect(legs[0].headingDegrees).toBeCloseTo(270);
  });

  it('scales duration by unitsPerSecond', () => {
    const legs = computeLegs(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 0, y: -10 },
      ],
      2,
    );
    expect(legs[0].durationSeconds).toBeCloseTo(5);
  });
});
