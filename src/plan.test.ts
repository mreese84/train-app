import { describe, expect, it } from 'vitest';
import { EXERCISES, SESSIONS } from './data/exercises';
import {
  DEFAULT_PLAN_START, doseText, getDayItems, getWeek, prescribe, progressionStep, restSecondsFor,
  strengthBuildLongRun, weekLabel,
} from './plan';

const S = DEFAULT_PLAN_START; // 2026-11-16, a Monday

describe('schedule', () => {
  it('starts week 1 on the plan start date', () => {
    const w = getWeek(S, '2026-11-16');
    expect(w.weekNumber).toBe(1);
    expect(w.beforeStart).toBe(false);
    expect(weekLabel(w)).toBe('Base phase · Week 1 of 7');
    expect(w.strengthSets).toBe(2);
  });

  it('marks dates before the start and previews week 1', () => {
    const w = getWeek(S, '2026-11-15');
    expect(w.beforeStart).toBe(true);
    expect(w.weekNumber).toBe(1);
    expect(w.monday).toBe('2026-11-16');
  });

  it('follows the base phase table', () => {
    expect(weekLabel(getWeek(S, '2026-12-02'))).toBe('Base phase · Week 3 of 7');
    const w5 = getWeek(S, '2026-12-14');
    expect(w5.weekInPhase).toBe(5);
    expect(w5.deload).toBe(true);
    expect(w5.strengthSets).toBe(2);
    const w7sat = getDayItems(S, '2027-01-02');
    expect(w7sat[0]).toMatchObject({ kind: 'cardio', minutes: 50 });
  });

  it('has the weekly pattern', () => {
    const kinds = (d: string) => getDayItems(S, d).map((i) => i.kind);
    expect(getDayItems(S, '2026-11-16')).toEqual([{ kind: 'strength', session: 'A' }]);
    expect(getDayItems(S, '2026-11-17')[0]).toMatchObject({ kind: 'cardio', kinds: ['run'], minutes: 25 });
    expect(kinds('2026-11-18')).toEqual(['cardio', 'mobility']);
    expect(getDayItems(S, '2026-11-19')).toEqual([{ kind: 'strength', session: 'B' }]);
    expect(getDayItems(S, '2026-11-20')[0]).toMatchObject({ kind: 'mobility', optional: true });
    expect(getDayItems(S, '2026-11-21')[0]).toMatchObject({ kind: 'cardio', minutes: 30 });
    expect(kinds('2026-11-22')).toEqual(['rest']);
  });

  it('adds strides to Tuesday runs from week 3', () => {
    expect(getDayItems(S, '2026-11-24')[0]).not.toHaveProperty('note', expect.any(String));
    expect(getDayItems(S, '2026-12-01')[0]).toMatchObject({ note: 'Add 4–6 strides at the end' });
  });

  it('switches to the strength build phase on Jan 4, 2027', () => {
    const w = getWeek(S, '2027-01-04');
    expect(w.phaseName).toBe('Strength build');
    expect(w.weekInPhase).toBe(1);
    expect(weekLabel(w)).toBe('Strength build · Week 1');
    expect(w.heavyFirst).toEqual({ count: 2, sets: 4, targetMin: 4, targetMax: 6 });
  });

  it('deloads every 4th strength-build week (Jan 25, Feb 22, Mar 22)', () => {
    for (const d of ['2027-01-25', '2027-02-22', '2027-03-22']) {
      const w = getWeek(S, d);
      expect(w.deload, d).toBe(true);
      expect(w.strengthSets).toBe(2);
    }
    expect(getWeek(S, '2027-02-01').deload).toBe(false);
  });

  it('builds the long run 55 → 75 holding each 4th week', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 12].map(strengthBuildLongRun)).toEqual([55, 60, 65, 65, 70, 75, 75, 75, 75]);
    expect(getDayItems(S, '2027-01-09')[0]).toMatchObject({ kind: 'cardio', minutes: 55 });
  });

  it('moves everything when the plan start changes', () => {
    const w = getWeek('2026-12-07', '2026-12-07');
    expect(w.weekNumber).toBe(1);
    // A mid-week start date still counts its whole Mon–Sun week as week 1.
    expect(getWeek('2026-11-18', '2026-11-16').weekNumber).toBe(1);
  });
});

describe('prescription', () => {
  const A = SESSIONS.A.exercises;
  it('uses the week set count, capped by the exercise (calf raise stays 2)', () => {
    const w3 = getWeek(S, '2026-11-30');
    expect(prescribe(A[0], 'A', 0, w3)).toEqual({ sets: 3, targetMin: 6, targetMax: 8 });
    const calf = A.find((e) => e.id === 'CalfRaise')!;
    expect(prescribe(calf, 'A', 6, w3).sets).toBe(2);
    expect(prescribe(A[0], 'A', 0, getWeek(S, '2026-11-16')).sets).toBe(2);
  });

  it('always gives mobility 1 round', () => {
    const m = SESSIONS.M.exercises[0];
    expect(prescribe(m, 'M', 0, getWeek(S, '2026-11-30')).sets).toBe(1);
  });

  it('uses 4 × 4–6 for the first two lifts in strength build', () => {
    const w = getWeek(S, '2027-01-04');
    expect(prescribe(A[0], 'A', 0, w)).toEqual({ sets: 4, targetMin: 4, targetMax: 6 });
    expect(prescribe(A[1], 'A', 1, w)).toEqual({ sets: 4, targetMin: 4, targetMax: 6 });
    expect(prescribe(A[2], 'A', 2, w)).toEqual({ sets: 3, targetMin: 8, targetMax: 8 });
    expect(doseText(A[0], prescribe(A[0], 'A', 0, w))).toBe('4 × 4–6');
  });

  it('rewrites dose text with today’s set count', () => {
    const w1 = getWeek(S, '2026-11-16');
    expect(doseText(A[0], prescribe(A[0], 'A', 0, w1))).toBe('2 × 6–8');
    const carry = EXERCISES.SuitcaseCarry;
    expect(doseText(carry, prescribe(carry, 'B', 6, w1))).toBe('2 × 30 m / side');
    const cat = EXERCISES.CatCow;
    expect(doseText(cat, prescribe(cat, 'M', 0, w1))).toBe(cat.doseText);
  });

  it('has rest times and progression steps', () => {
    expect(restSecondsFor('TrapBarDeadlift')).toBe(120);
    expect(restSecondsFor('CatCow')).toBe(0);
    expect(progressionStep(EXERCISES.TrapBarDeadlift)).toBe(5);
    expect(progressionStep(EXERCISES.DBBenchPress)).toBe(2.5);
    expect(progressionStep(EXERCISES.LatPulldown)).toBe(2.5);
    expect(progressionStep(EXERCISES.MedBallToss)).toBe(1);
    expect(progressionStep(EXERCISES.LateralLunge)).toBeNull();
  });
});
