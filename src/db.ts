/**
 * IndexedDB storage (via Dexie). Everything the app records lives here, on the
 * phone. Every write happens immediately, so an in-progress workout survives
 * the app being closed or the phone locking.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { LoadKind, SessionId, Unit } from './data/exercises';
import type { CardioKind } from './plan';
import type { ISODate } from './lib/dates';

export type SessionRec = {
  id: string;
  date: ISODate;
  type: SessionId;
  startedAt: number;
  finishedAt: number | null;
  note: string;
  /** For a golf-mobility warm-up: the strength session it belongs to. */
  warmupFor?: string;
};

export type SetRec = {
  /** `${sessionId}:${exerciseId}:${setIndex}` so a row is always upserted in place. */
  id: string;
  sessionId: string;
  exerciseId: string;
  setIndex: number;
  /** Weight (or added weight for bodyweight moves); null when none. */
  load: number | null;
  loadUnit: 'lb' | 'kg' | null;
  isBodyweight: boolean;
  isBand: boolean;
  /** Reps, seconds or meters, in `unit`. */
  value: number;
  unit: Unit;
  done: boolean;
  doneAt: number | null;
  /** The plan at the time: used for the progression hint. */
  plannedSets: number;
  targetMax: number;
  updatedAt: number;
};

export type CardioRec = {
  id: string;
  date: ISODate;
  kind: CardioKind;
  plannedMin: number | null;
  actualMin: number;
  distanceMi: number | null;
  effort: number | null;
  note: string;
  savedAt: number;
};

export type ExerciseNoteRec = {
  /** `${sessionId}:${exerciseId}` */
  id: string;
  sessionId: string;
  exerciseId: string;
  note: string;
  updatedAt: number;
};

export type MetaRec = { key: string; value: unknown };

export type Settings = { planStart: ISODate };

class TrainDB extends Dexie {
  sessions!: EntityTable<SessionRec, 'id'>;
  sets!: EntityTable<SetRec, 'id'>;
  cardio!: EntityTable<CardioRec, 'id'>;
  exerciseNotes!: EntityTable<ExerciseNoteRec, 'id'>;
  meta!: EntityTable<MetaRec, 'key'>;

  constructor() {
    super('train');
    this.version(1).stores({
      sessions: 'id, date, type, finishedAt, warmupFor',
      sets: 'id, sessionId, exerciseId, [sessionId+exerciseId], doneAt',
      cardio: 'id, date',
      exerciseNotes: 'id, sessionId, exerciseId',
      meta: 'key',
    });
  }
}

export const db = new TrainDB();

export const TABLES = ['sessions', 'sets', 'cardio', 'exerciseNotes', 'meta'] as const;

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const setId = (sessionId: string, exerciseId: string, setIndex: number) =>
  `${sessionId}:${exerciseId}:${setIndex}`;
export const noteId = (sessionId: string, exerciseId: string) => `${sessionId}:${exerciseId}`;

export function loadUnitFor(load: LoadKind): 'lb' | 'kg' | null {
  return load === 'lb' || load === 'kg' ? load : null;
}
