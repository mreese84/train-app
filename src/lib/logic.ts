/**
 * Pure logic for the logging screens: set prefill, "last time" summaries and
 * the progression hint. No DOM or database access here, so it's unit-tested.
 */
import type { Exercise } from '../data/exercises';
import type { Prescription } from '../plan';
import { progressionStep } from '../plan';
import type { SetRec } from '../db';

/** What one set row shows (whether or not it has been saved yet). */
export type SetRow = {
  setIndex: number;
  load: number | null;
  isBodyweight: boolean;
  isBand: boolean;
  value: number;
  done: boolean;
  /** True when this row exists in the database (was edited or checked). */
  saved: boolean;
};

/**
 * The done sets of the most recent *other* session that included this
 * exercise, sorted by set number. `history` is every saved set for the
 * exercise; `sessionOrder` gives each session's start time for ordering.
 */
export function previousSessionSets(
  history: SetRec[],
  currentSessionId: string | null,
  sessionStart: (sessionId: string) => number,
): SetRec[] {
  const bySession = new Map<string, SetRec[]>();
  for (const s of history) {
    if (!s.done || s.sessionId === currentSessionId) continue;
    const list = bySession.get(s.sessionId) ?? [];
    list.push(s);
    bySession.set(s.sessionId, list);
  }
  let best: string | null = null;
  let bestTime = -Infinity;
  for (const id of bySession.keys()) {
    const t = sessionStart(id);
    if (t > bestTime) {
      bestTime = t;
      best = id;
    }
  }
  return best ? bySession.get(best)!.sort((a, b) => a.setIndex - b.setIndex) : [];
}

/** The working weight last time: the heaviest done set. Null if none recorded. */
export function lastLoad(prev: SetRec[]): number | null {
  const loads = prev.map((s) => s.load).filter((l): l is number => l !== null);
  return loads.length ? Math.max(...loads) : null;
}

/**
 * Builds the rows for the exercise screen.
 * - Saved rows show exactly what was saved.
 * - An unsaved row copies the weight of the row above it (so changing set 1
 *   carries down), and set 1 starts from last time's weight.
 * - Reps/seconds/meters start at the target (targetMax).
 */
export function buildSetRows(ex: Exercise, rx: Prescription, saved: SetRec[], prev: SetRec[]): SetRow[] {
  const byIndex = new Map(saved.map((s) => [s.setIndex, s]));
  const maxSaved = saved.reduce((m, s) => Math.max(m, s.setIndex + 1), 0);
  const count = Math.max(rx.sets, maxSaved);
  const rows: SetRow[] = [];
  const startLoad = ex.load === 'band' ? null : lastLoad(prev);
  for (let i = 0; i < count; i++) {
    const rec = byIndex.get(i);
    if (rec) {
      rows.push({
        setIndex: i,
        load: rec.load,
        isBodyweight: rec.isBodyweight,
        isBand: rec.isBand,
        value: rec.value,
        done: rec.done,
        saved: true,
      });
      continue;
    }
    const above = rows[i - 1];
    rows.push({
      setIndex: i,
      load: above ? above.load : startLoad,
      isBodyweight: ex.load === 'bodyweight',
      isBand: ex.load === 'band',
      value: rx.targetMax,
      done: false,
      saved: false,
    });
  }
  return rows;
}

export type ProgressionHint = { step: number; unit: 'lb' | 'kg'; text: string };

/**
 * "Ready to go up" when, last time, every planned set of a weighted exercise
 * was completed at targetMax (or more).
 */
export function progressionHint(ex: Exercise, prev: SetRec[]): ProgressionHint | null {
  const step = progressionStep(ex);
  if (step === null || prev.length === 0) return null;
  const unit = ex.load as 'lb' | 'kg';
  const planned = prev[0].plannedSets;
  const target = prev[0].targetMax;
  const planSets = prev.filter((s) => s.setIndex < planned && s.done);
  if (planSets.length < planned) return null;
  if (!planSets.every((s) => s.value >= target)) return null;
  if (!planSets.some((s) => s.load !== null && s.load > 0)) return null;
  return { step, unit, text: `Ready to go up: try +${step} ${unit}` };
}

const unitSuffix = (s: Pick<SetRec, 'unit'>) => (s.unit === 'seconds' ? ' s' : s.unit === 'meters' ? ' m' : '');

/** Weight part of a set: "95 lb", "BW", "BW + 20 lb", "Band". */
export function formatLoad(s: Pick<SetRec, 'load' | 'loadUnit' | 'isBodyweight' | 'isBand'>): string {
  const w = s.load !== null && s.load > 0 ? `${s.load} ${s.loadUnit ?? 'lb'}` : '';
  if (s.isBand) return 'Band';
  if (s.isBodyweight) return w ? `BW + ${w}` : 'BW';
  return w || '—';
}

/**
 * Summary of a session's sets for one exercise, e.g. "3 × 8 @ 95 lb",
 * "8, 8, 6 @ 95 lb", or "8 @ 95 lb, 8 @ 100 lb".
 */
export function summarizeSets(sets: SetRec[]): string {
  const done = sets.filter((s) => s.done);
  if (!done.length) return '';
  const loads = new Set(done.map(formatLoad));
  const values = new Set(done.map((s) => s.value));
  const suffix = unitSuffix(done[0]);
  const loadPart = (s: SetRec) => {
    const l = formatLoad(s);
    return l === '—' ? '' : ` @ ${l}`;
  };
  if (loads.size === 1) {
    const valuePart = values.size === 1 ? `${done.length} × ${done[0].value}${suffix}` : done.map((s) => s.value).join(', ') + suffix;
    return valuePart + loadPart(done[0]);
  }
  return done.map((s) => `${s.value}${suffix}${loadPart(s)}`).join(', ');
}

/** Best (heaviest) load in a list of sets, or null. */
export function bestLoad(sets: SetRec[]): number | null {
  return lastLoad(sets.filter((s) => s.done));
}
