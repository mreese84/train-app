import { describe, expect, it } from 'vitest';
import { library } from '../data/exercises';
import { circleCenter, ease, nearestKeyframe, phaseAt, polylinePoints, segmentAt } from './anim';

describe('animation timing', () => {
  const t = [1000, 400, 1400, 600] as const;
  it('eases 0 → 1, holds, eases back, holds, loops', () => {
    expect(phaseAt(t, 0)).toBe(0);
    expect(phaseAt(t, 500)).toBeCloseTo(0.5);
    expect(phaseAt(t, 1000)).toBe(1);
    expect(phaseAt(t, 1300)).toBe(1);
    expect(phaseAt(t, 1400 + 700)).toBeCloseTo(0.5);
    expect(phaseAt(t, 2800 + 100)).toBe(0);
    expect(phaseAt(t, 3400 + 500)).toBeCloseTo(0.5); // second loop
  });
  it('handles zero-length holds', () => {
    expect(phaseAt([600, 0, 600, 0], 600)).toBe(1);
    expect(phaseAt([600, 0, 600, 0], 900)).toBeCloseTo(0.5);
  });
  it('uses cosine easing', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.25)).toBeCloseTo(0.5 - 0.5 * Math.cos(Math.PI / 4));
  });
});

describe('keyframe interpolation', () => {
  it('maps s across k keyframes', () => {
    expect(segmentAt(2, 0.5)).toEqual({ i: 0, t: 0.5 });
    expect(segmentAt(3, 0.75)).toEqual({ i: 1, t: 0.5 });
    expect(segmentAt(3, 1)).toEqual({ i: 1, t: 1 });
    expect(nearestKeyframe(3, 0.8)).toBe(2);
  });
  it('interpolates polylines and circles linearly', () => {
    const kf = [
      [{ type: 'polyline' as const, points: [[0, 0], [10, 10]] as [number, number][], stroke: '#000', width: 2 }, { type: 'circle' as const, c: [0, 0] as [number, number], r: 3, fill: '#000' }],
      [{ type: 'polyline' as const, points: [[10, 0], [20, 30]] as [number, number][], stroke: '#000', width: 2 }, { type: 'circle' as const, c: [10, 20] as [number, number], r: 3, fill: '#000' }],
    ];
    expect(polylinePoints(kf, 0, 0.5)).toBe('5,0 15,20');
    expect(circleCenter(kf, 1, 0.5)).toEqual([5, 10]);
  });
  it('every exercise has matching keyframe shapes', () => {
    for (const s of library.sessions) for (const ex of s.exercises) {
      const kfs = ex.animation.keyframes;
      expect(kfs.length, ex.id).toBeGreaterThanOrEqual(2);
      for (const k of kfs) expect(k.map((e) => e.type), ex.id).toEqual(kfs[0].map((e) => e.type));
    }
  });
});
