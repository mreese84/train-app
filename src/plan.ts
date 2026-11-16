/**
 * THE TRAINING PLAN — edit this file to change the schedule.
 *
 * How it works
 * - Weeks run Monday–Sunday. Week 1 is the Mon–Sun week containing the plan
 *   start date (Settings → Plan start date, default 2026-11-16).
 * - PHASES are laid end to end. Each phase has a length in weeks; the last one
 *   may be open-ended (`weeks: null`) and simply continues forever.
 * - Each phase's `week(n)` function returns that week's plan: the strength set
 *   count, notes, and the items for each day (index 0 = Monday ... 6 = Sunday).
 *
 * Adding the half-marathon phase (starts Mon July 12, 2027)
 * - Jan 4 → Jul 12, 2027 is 27 weeks, so set the Strength build phase to
 *   `weeks: 27` and append a new phase object after it with its own `week(n)`
 *   (see `strengthBuildPhase` below for a template). Nothing else needs to change.
 */
import type { Exercise, SessionId } from './data/exercises';
import { addDays, daysBetween, mondayOf, weekdayMon0, type ISODate } from './lib/dates';

export const DEFAULT_PLAN_START: ISODate = '2026-11-16';

export type CardioKind = 'run' | 'bike' | 'swim' | 'other';
export const CARDIO_KINDS: CardioKind[] = ['run', 'bike', 'swim', 'other'];
export const CARDIO_LABEL: Record<CardioKind, string> = { run: 'Run', bike: 'Bike', swim: 'Swim', other: 'Other' };

export type PlanItem =
  | { kind: 'strength'; session: 'A' | 'B' }
  | { kind: 'mobility'; minutes: number; optional?: boolean }
  | {
      kind: 'cardio';
      label: string;
      /** Allowed types; the first one is preselected in the cardio log. */
      kinds: CardioKind[];
      minutes: number;
      note?: string;
    }
  | { kind: 'rest' };

/** Overrides the dose for the first `count` exercises of each strength session. */
export type HeavyFirst = { count: number; sets: number; targetMin: number; targetMax: number };

export type WeekPlan = {
  /** Sets for every strength exercise (capped by the exercise's own `sets`). */
  strengthSets: number;
  deload: boolean;
  heavyFirst?: HeavyFirst;
  note?: string;
  /** days[0] = Monday ... days[6] = Sunday */
  days: PlanItem[][];
};

type PhaseDef = {
  name: string;
  /** Length in weeks, or null for open-ended (must be the last phase). */
  weeks: number | null;
  week(weekInPhase: number): WeekPlan;
};

/* ------------------------------------------------------------------ */
/* Rest times (seconds) and progression steps                          */
/* ------------------------------------------------------------------ */

/** Rest between sets. Mobility moves are 0 (no rest timer). */
export const REST_SECONDS: Record<string, number> = {
  TrapBarDeadlift: 120,
  DBBenchPress: 90,
  SplitSquat: 90,
  CableChop: 60,
  DBRow: 60,
  PallofPress: 60,
  CalfRaise: 45,
  GobletSquat: 120,
  LatPulldown: 90,
  RomanianDeadlift: 90,
  LandminePress: 60,
  LateralLunge: 60,
  MedBallToss: 90,
  SuitcaseCarry: 60,
};
export const restSecondsFor = (exerciseId: string) => REST_SECONDS[exerciseId] ?? 0;

/**
 * Weight increase suggested by the "Ready to go up" hint. Presses, rows and
 * pulldowns go up 2.5 lb; everything else in lb goes up 5 lb; kg goes up 1 kg.
 */
const SMALL_STEP_LB = new Set(['DBBenchPress', 'PallofPress', 'LandminePress', 'DBRow', 'LatPulldown']);
export function progressionStep(ex: Pick<Exercise, 'id' | 'load'>): number | null {
  if (ex.load === 'kg') return 1;
  if (ex.load === 'lb') return SMALL_STEP_LB.has(ex.id) ? 2.5 : 5;
  return null; // bodyweight / band: no weight progression
}

/** −/+ stepper increments for the weight field. */
export const LOAD_STEP = { lb: 5, kg: 2 } as const;

/* ------------------------------------------------------------------ */
/* Phase 0: Base phase (weeks 1–7, Nov 16 – Jan 3)                     */
/* ------------------------------------------------------------------ */

type BaseRow = {
  sets: number;
  deload?: boolean;
  tueRun: number;
  wedSwimBike: number;
  satLongRun: number;
  note?: string;
  tueNote?: string;
  satNote?: string;
};

const STRIDES = 'Add 4–6 strides at the end';

const BASE_WEEKS: BaseRow[] = [
  /* 1 Nov 16–22 */ { sets: 2, tueRun: 25, wedSwimBike: 30, satLongRun: 30, note: 'Light weights: find your starting weights' },
  /* 2 Nov 23–29 */ { sets: 3, tueRun: 25, wedSwimBike: 30, satLongRun: 35, note: 'Thanksgiving: move the long run if needed', satNote: 'Thanksgiving week: move the long run if needed' },
  /* 3 Nov 30–Dec 6 */ { sets: 3, tueRun: 30, wedSwimBike: 40, satLongRun: 40, note: 'Start adding weight. Add 4–6 strides after Tuesday runs', tueNote: STRIDES },
  /* 4 Dec 7–13 */ { sets: 3, tueRun: 30, wedSwimBike: 45, satLongRun: 45, tueNote: STRIDES },
  /* 5 Dec 14–20 */ { sets: 2, deload: true, tueRun: 25, wedSwimBike: 30, satLongRun: 35, note: 'Recovery week: same weights, fewer sets', tueNote: STRIDES },
  /* 6 Dec 21–27 */ { sets: 3, tueRun: 30, wedSwimBike: 40, satLongRun: 45, note: 'Christmas: 3 sessions counts as a win', tueNote: STRIDES },
  /* 7 Dec 28–Jan 3 */ { sets: 3, tueRun: 35, wedSwimBike: 45, satLongRun: 50, note: 'Benchmarks Jan 2–3: 5K time trial and note working weights', tueNote: STRIDES, satNote: 'Benchmark: 5K time trial (Jan 2–3). Note your working weights this week.' },
];

const basePhase: PhaseDef = {
  name: 'Base phase',
  weeks: BASE_WEEKS.length,
  week(n) {
    const r = BASE_WEEKS[n - 1];
    return {
      strengthSets: r.sets,
      deload: !!r.deload,
      note: r.note,
      days: [
        /* Mon */ [{ kind: 'strength', session: 'A' }],
        /* Tue */ [{ kind: 'cardio', label: 'Easy run', kinds: ['run'], minutes: r.tueRun, note: r.tueNote }],
        /* Wed */ [
          { kind: 'cardio', label: 'Swim or bike (easy)', kinds: ['swim', 'bike'], minutes: r.wedSwimBike },
          { kind: 'mobility', minutes: 10 },
        ],
        /* Thu */ [{ kind: 'strength', session: 'B' }],
        /* Fri */ [{ kind: 'mobility', minutes: 10, optional: true }],
        /* Sat */ [{ kind: 'cardio', label: 'Long easy run', kinds: ['run'], minutes: r.satLongRun, note: r.satNote }],
        /* Sun */ [{ kind: 'rest' }],
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Phase 1: Strength build (from Jan 4, 2027, open-ended)              */
/* ------------------------------------------------------------------ */

/** Long run: 55 min, +5 min each week, each 4th week held flat, capped at 75. */
export function strengthBuildLongRun(n: number): number {
  const increments = n - 1 - Math.floor(n / 4);
  return Math.min(75, 55 + 5 * increments);
}

const strengthBuildPhase: PhaseDef = {
  name: 'Strength build',
  weeks: null, // "until I change it" — set a number here when the next phase is added
  week(n) {
    const deload = n % 4 === 0; // Jan 25, Feb 22, Mar 22, ...
    return {
      strengthSets: deload ? 2 : 3,
      deload,
      heavyFirst: { count: 2, sets: deload ? 2 : 4, targetMin: 4, targetMax: 6 },
      note: deload ? 'Deload week: 2 sets of everything' : undefined,
      days: [
        /* Mon */ [{ kind: 'strength', session: 'A' }],
        /* Tue */ [{ kind: 'cardio', label: 'Easy run + strides', kinds: ['run'], minutes: 35, note: STRIDES }],
        /* Wed */ [{ kind: 'cardio', label: 'Easy run (or bike)', kinds: ['run', 'bike'], minutes: 30 }],
        /* Thu */ [{ kind: 'strength', session: 'B' }],
        /* Fri */ [{ kind: 'mobility', minutes: 10, optional: true }],
        /* Sat */ [{ kind: 'cardio', label: 'Long easy run', kinds: ['run'], minutes: strengthBuildLongRun(n) }],
        /* Sun */ [{ kind: 'rest' }],
      ],
    };
  },
};

export const PHASES: PhaseDef[] = [basePhase, strengthBuildPhase];

/* ------------------------------------------------------------------ */
/* Lookups used by the app                                             */
/* ------------------------------------------------------------------ */

export type WeekInfo = WeekPlan & {
  phaseName: string;
  phaseIndex: number;
  weekInPhase: number;
  phaseWeeks: number | null;
  /** Week number counted from the plan start (1-based). */
  weekNumber: number;
  /** Monday of this week. */
  monday: ISODate;
  /** True when the date is before the plan starts (week 1 is shown as a preview). */
  beforeStart: boolean;
};

export function weekNumberFor(planStart: ISODate, date: ISODate): number {
  return Math.floor(daysBetween(mondayOf(planStart), date) / 7) + 1;
}

export function getWeek(planStart: ISODate, date: ISODate): WeekInfo {
  const raw = weekNumberFor(planStart, date);
  const beforeStart = raw < 1;
  const weekNumber = Math.max(1, raw);
  let remaining = weekNumber;
  for (let i = 0; i < PHASES.length; i++) {
    const p = PHASES[i];
    if (p.weeks === null || remaining <= p.weeks) {
      return {
        ...p.week(remaining),
        phaseName: p.name,
        phaseIndex: i,
        weekInPhase: remaining,
        phaseWeeks: p.weeks,
        weekNumber,
        monday: addDays(mondayOf(planStart), (weekNumber - 1) * 7),
        beforeStart,
      };
    }
    remaining -= p.weeks;
  }
  throw new Error('The last phase in PHASES must be open-ended (weeks: null).');
}

/** "Base phase · Week 3 of 7" / "Strength build · Week 2" */
export function weekLabel(w: WeekInfo): string {
  return `${w.phaseName} · Week ${w.weekInPhase}${w.phaseWeeks ? ` of ${w.phaseWeeks}` : ''}`;
}

export function getDayItems(planStart: ISODate, date: ISODate): PlanItem[] {
  return getWeek(planStart, date).days[weekdayMon0(date)];
}

export type Prescription = { sets: number; targetMin: number; targetMax: number };

/**
 * Today's dose for one exercise: the week's set count (never more than the
 * exercise's own `sets`, so the calf raise stays at 2), the heavy-first
 * override for phase 1, and always 1 round for mobility moves.
 */
export function prescribe(ex: Exercise, session: SessionId, index: number, week: WeekPlan): Prescription {
  if (session === 'M') return { sets: 1, targetMin: ex.targetMin, targetMax: ex.targetMax };
  const hf = week.heavyFirst;
  if (hf && index < hf.count) return { sets: hf.sets, targetMin: hf.targetMin, targetMax: hf.targetMax };
  return { sets: Math.min(ex.sets, week.strengthSets), targetMin: ex.targetMin, targetMax: ex.targetMax };
}

/**
 * Dose chip text built from the exercise's own doseText, with today's set
 * count swapped in ("3 × 6–8" → "2 × 6–8"; heavy-first → "4 × 4–6").
 */
export function doseText(ex: Exercise, rx: Prescription): string {
  const m = /^(\d+) × (.*)$/.exec(ex.doseText);
  if (!m) return ex.doseText; // mobility style ("8 slow reps", "30 sec / side")
  let rest = m[2];
  if (rx.targetMin !== ex.targetMin || rx.targetMax !== ex.targetMax) {
    const range = rx.targetMin === rx.targetMax ? `${rx.targetMax}` : `${rx.targetMin}–${rx.targetMax}`;
    rest = rest.replace(/^\d+(–\d+)?/, range);
  }
  return `${rx.sets} × ${rest}`;
}
