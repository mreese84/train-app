/**
 * Typed access to exercises.json (repo root), the single source of truth for
 * exercise text, set/rep targets, animation timing and figure drawings.
 * Nothing here rewrites that content; it only adds types and lookups.
 */
import raw from '../../exercises.json';

export type Unit = 'reps' | 'seconds' | 'meters';
export type LoadKind = 'lb' | 'kg' | 'bodyweight' | 'band';
export type SessionId = 'A' | 'B' | 'M';

export type Point = [number, number];

export type AnimPolyline = { type: 'polyline'; points: Point[]; stroke: string; width: number };
export type AnimCircle = { type: 'circle'; c: Point; r: number; fill: string };
export type AnimRaw = { type: 'raw'; svg: string };
export type AnimElement = AnimPolyline | AnimCircle | AnimRaw;

export type Animation = {
  timingMs: [number, number, number, number];
  scale: number | null;
  ground: boolean;
  alt: string;
  keyframes: AnimElement[][];
};

export type Exercise = {
  id: string;
  name: string;
  doseText: string;
  restText: string;
  sets: number;
  targetMin: number;
  targetMax: number;
  unit: Unit;
  load: LoadKind;
  perSide: boolean;
  why: string;
  cues: string[];
  avoid: string;
  labels: [string, string];
  view: string | null;
  animation: Animation;
};

export type SessionDef = {
  id: SessionId;
  name: string;
  tag: string;
  blurb: string;
  warmup: string;
  footer: string;
  exercises: Exercise[];
};

type Library = {
  colors: Record<string, string>;
  fonts: Record<string, string>;
  sessions: SessionDef[];
};

export const library = raw as unknown as Library;

export const SESSIONS: Record<SessionId, SessionDef> = Object.fromEntries(
  library.sessions.map((s) => [s.id, s]),
) as Record<SessionId, SessionDef>;

/** Every exercise, keyed by id, with the session it belongs to. */
export const EXERCISES: Record<string, Exercise & { sessionId: SessionId }> = Object.fromEntries(
  library.sessions.flatMap((s) => s.exercises.map((e) => [e.id, { ...e, sessionId: s.id }])),
);

export const isStrength = (id: SessionId) => id === 'A' || id === 'B';
