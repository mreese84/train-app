import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import type { SetRec } from '../db';
import { buildSetRows, formatLoad, lastLoad, previousSessionSets, progressionHint, summarizeSets } from './logic';

const set = (p: Partial<SetRec>): SetRec => ({
  id: `${p.sessionId ?? 's1'}:${p.exerciseId ?? 'TrapBarDeadlift'}:${p.setIndex ?? 0}`,
  sessionId: 's1', exerciseId: 'TrapBarDeadlift', setIndex: 0,
  load: 95, loadUnit: 'lb', isBodyweight: false, isBand: false,
  value: 8, unit: 'reps', done: true, doneAt: 1, plannedSets: 3, targetMax: 8, updatedAt: 1,
  ...p,
});

const dl = EXERCISES.TrapBarDeadlift;
const rx3 = { sets: 3, targetMin: 6, targetMax: 8 };

describe('set prefill', () => {
  it('starts empty with targets when never done', () => {
    const rows = buildSetRows(dl, rx3, [], []);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.load === null && r.value === 8 && !r.done && !r.saved)).toBe(true);
  });

  it('prefills last time’s working (heaviest) weight', () => {
    const prev = [set({ setIndex: 0, load: 90 }), set({ setIndex: 1, load: 95 }), set({ setIndex: 2, load: 95, value: 6 })];
    expect(lastLoad(prev)).toBe(95);
    expect(buildSetRows(dl, rx3, [], prev).map((r) => r.load)).toEqual([95, 95, 95]);
  });

  it('carries an edited weight down to the unsaved rows below', () => {
    const saved = [set({ sessionId: 'now', setIndex: 0, load: 100, done: false })];
    const rows = buildSetRows(dl, rx3, saved, [set({ load: 95 })]);
    expect(rows.map((r) => r.load)).toEqual([100, 100, 100]);
    expect(rows[0].saved).toBe(true);
    expect(rows[1].saved).toBe(false);
  });

  it('keeps saved values exactly', () => {
    const saved = [set({ sessionId: 'now', setIndex: 1, load: 80, value: 5, done: true })];
    const rows = buildSetRows(dl, rx3, saved, []);
    expect(rows[1]).toMatchObject({ load: 80, value: 5, done: true });
    expect(rows[2].load).toBe(80);
  });

  it('shows bodyweight and band rows', () => {
    const calf = EXERCISES.CalfRaise;
    const rows = buildSetRows(calf, { sets: 2, targetMin: 15, targetMax: 15 }, [], []);
    expect(rows.every((r) => r.isBodyweight && r.load === null && r.value === 15)).toBe(true);
    const band = EXERCISES.BandPullApart;
    expect(buildSetRows(band, { sets: 1, targetMin: 15, targetMax: 15 }, [], [])[0].isBand).toBe(true);
  });

  it('uses seconds targets for timed holds', () => {
    const hf = EXERCISES.HipFlexorStretch;
    expect(buildSetRows(hf, { sets: 1, targetMin: 30, targetMax: 30 }, [], [])[0].value).toBe(30);
  });
});

describe('previous session', () => {
  it('picks the most recent other session with done sets', () => {
    const hist = [
      set({ sessionId: 'old', setIndex: 0, load: 80 }),
      set({ sessionId: 'mid', setIndex: 1, load: 90 }),
      set({ sessionId: 'mid', setIndex: 0, load: 90 }),
      set({ sessionId: 'mid', setIndex: 2, load: 90, done: false }),
      set({ sessionId: 'cur', setIndex: 0, load: 100 }),
    ];
    const start: Record<string, number> = { old: 1, mid: 2, cur: 3 };
    const prev = previousSessionSets(hist, 'cur', (id) => start[id]);
    expect(prev.map((s) => [s.sessionId, s.setIndex])).toEqual([['mid', 0], ['mid', 1]]);
  });
});

describe('progression hint', () => {
  const full = [0, 1, 2].map((i) => set({ setIndex: i }));
  it('suggests +5 lb after all planned sets at targetMax', () => {
    expect(progressionHint(dl, full)?.text).toBe('Ready to go up: try +5 lb');
  });
  it('uses +2.5 lb for presses, rows and pulldowns, +1 kg for kg', () => {
    const bench = full.map((s) => ({ ...s, exerciseId: 'DBBenchPress', targetMax: 10, value: 10 }));
    expect(progressionHint(EXERCISES.DBBenchPress, bench)?.text).toBe('Ready to go up: try +2.5 lb');
    const ball = full.map((s) => ({ ...s, exerciseId: 'MedBallToss', loadUnit: 'kg' as const, load: 4, targetMax: 5, value: 5 }));
    expect(progressionHint(EXERCISES.MedBallToss, ball)?.text).toBe('Ready to go up: try +1 kg');
  });
  it('does not suggest when a set fell short or was missed', () => {
    expect(progressionHint(dl, [full[0], full[1], { ...full[2], value: 7 }])).toBeNull();
    expect(progressionHint(dl, full.slice(0, 2))).toBeNull();
    expect(progressionHint(dl, [])).toBeNull();
  });
  it('respects the planned set count of that session (week 1: 2 sets)', () => {
    const two = full.slice(0, 2).map((s) => ({ ...s, plannedSets: 2 }));
    expect(progressionHint(dl, two)).not.toBeNull();
  });
  it('never suggests for bodyweight moves', () => {
    const lunge = full.map((s) => ({ ...s, exerciseId: 'LateralLunge', isBodyweight: true, load: null }));
    expect(progressionHint(EXERCISES.LateralLunge, lunge)).toBeNull();
  });
});

describe('summaries', () => {
  it('formats "3 × 8 @ 95 lb"', () => {
    expect(summarizeSets([0, 1, 2].map((i) => set({ setIndex: i })))).toBe('3 × 8 @ 95 lb');
  });
  it('lists differing reps and weights', () => {
    expect(summarizeSets([set({ value: 8 }), set({ setIndex: 1, value: 6 })])).toBe('8, 6 @ 95 lb');
    expect(summarizeSets([set({ load: 95 }), set({ setIndex: 1, load: 100 })])).toBe('8 @ 95 lb, 8 @ 100 lb');
  });
  it('handles bodyweight, seconds and meters', () => {
    expect(summarizeSets([set({ isBodyweight: true, load: null, loadUnit: null, value: 15 })])).toBe('1 × 15 @ BW');
    expect(formatLoad({ isBodyweight: true, isBand: false, load: 20, loadUnit: 'lb' })).toBe('BW + 20 lb');
    expect(summarizeSets([set({ unit: 'seconds', isBodyweight: true, load: null, value: 30 })])).toBe('1 × 30 s @ BW');
    expect(summarizeSets([set({ unit: 'meters', load: 50, value: 30 })])).toBe('1 × 30 m @ 50 lb');
  });
});
