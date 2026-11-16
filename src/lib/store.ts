/**
 * Data actions and live queries. Screens call these instead of touching
 * Dexie directly, so storage rules live in one place.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId, noteId, setId, TABLES, type CardioRec, type SessionRec, type SetRec, type Settings } from '../db';
import type { SessionId } from '../data/exercises';
import { DEFAULT_PLAN_START } from '../plan';
import { todayISO, type ISODate } from './dates';

/* ---------------- settings & meta ---------------- */

export const DEFAULT_SETTINGS: Settings = { planStart: DEFAULT_PLAN_START };

export function useSettings(): Settings {
  const rec = useLiveQuery(() => db.meta.get('settings'), []);
  return { ...DEFAULT_SETTINGS, ...((rec?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = ((await db.meta.get('settings'))?.value as Partial<Settings>) ?? {};
  await db.meta.put({ key: 'settings', value: { ...DEFAULT_SETTINGS, ...cur, ...patch } });
}

/** Returns how many times form tips were shown before, then counts this view. */
export async function bumpFormTipsView(exerciseId: string): Promise<number> {
  const key = `formTipsViewCount:${exerciseId}`;
  return db.transaction('rw', db.meta, async () => {
    const prev = ((await db.meta.get(key))?.value as number) ?? 0;
    await db.meta.put({ key, value: prev + 1 });
    return prev;
  });
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}
export const setMeta = (key: string, value: unknown) => db.meta.put({ key, value });

/* ---------------- sessions ---------------- */

/**
 * Opens a session of `type` for `date`: resumes an unfinished one of the same
 * type and date if it exists, otherwise creates a new one.
 */
export async function openSession(type: SessionId, date: ISODate = todayISO(), warmupFor?: string): Promise<string> {
  return db.transaction('rw', db.sessions, async () => {
    const existing = await db.sessions
      .where('date')
      .equals(date)
      .filter((s) => s.type === type && s.finishedAt === null && (s.warmupFor ?? null) === (warmupFor ?? null))
      .first();
    if (existing) return existing.id;
    const rec: SessionRec = { id: newId(), date, type, startedAt: Date.now(), finishedAt: null, note: '', warmupFor };
    await db.sessions.add(rec);
    return rec.id;
  });
}

export async function finishSession(id: string, note: string) {
  await db.sessions.update(id, { finishedAt: Date.now(), note });
}

export async function updateSessionNote(id: string, note: string) {
  await db.sessions.update(id, { note });
}

/** Deletes a session with its sets and notes (and its warm-up, if any). */
export async function deleteSession(id: string) {
  await db.transaction('rw', db.sessions, db.sets, db.exerciseNotes, async () => {
    const warmups = await db.sessions.where('warmupFor').equals(id).primaryKeys();
    for (const sid of [id, ...warmups]) {
      await db.sets.where('sessionId').equals(sid).delete();
      await db.exerciseNotes.where('sessionId').equals(sid).delete();
      await db.sessions.delete(sid);
    }
  });
}

/* ---------------- sets ---------------- */

export async function saveSet(rec: Omit<SetRec, 'id' | 'updatedAt'>) {
  await db.sets.put({ ...rec, id: setId(rec.sessionId, rec.exerciseId, rec.setIndex), updatedAt: Date.now() });
}

export async function saveExerciseNote(sessionId: string, exerciseId: string, note: string) {
  const id = noteId(sessionId, exerciseId);
  if (!note.trim()) await db.exerciseNotes.delete(id);
  else await db.exerciseNotes.put({ id, sessionId, exerciseId, note, updatedAt: Date.now() });
}

/* ---------------- cardio ---------------- */

export async function saveCardio(rec: Omit<CardioRec, 'id' | 'savedAt'> & { id?: string }): Promise<string> {
  const id = rec.id ?? newId();
  await db.cardio.put({ ...rec, id, savedAt: Date.now() });
  return id;
}

export const deleteCardio = (id: string) => db.cardio.delete(id);

/* ---------------- backup ---------------- */

export type Backup = {
  app: 'train';
  version: 1;
  exportedAt: string;
  data: Record<(typeof TABLES)[number], unknown[]>;
};

export async function exportAll(): Promise<Backup> {
  const data = {} as Backup['data'];
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  return { app: 'train', version: 1, exportedAt: new Date().toISOString(), data };
}

export function validateBackup(x: unknown): x is Backup {
  if (!x || typeof x !== 'object') return false;
  const b = x as Partial<Backup>;
  return b.app === 'train' && !!b.data && TABLES.every((t) => Array.isArray(b.data![t] ?? []));
}

/** Replaces everything with the backup's contents. */
export async function importAll(b: Backup) {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      const rows = b.data[t] ?? [];
      if (rows.length) await db.table(t).bulkPut(rows);
    }
  });
}

export async function resetAll() {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) await db.table(t).clear();
  });
}

/** Ask the browser not to evict our data (best effort; iOS may ignore it). */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
