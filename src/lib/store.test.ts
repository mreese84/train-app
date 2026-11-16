import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { exportAll, importAll, openSession, finishSession, resetAll, saveSet, validateBackup } from './store';

beforeEach(async () => {
  await resetAll();
});

describe('sessions', () => {
  it('resumes an unfinished session of the same type and day', async () => {
    const a = await openSession('A', '2026-11-16');
    expect(await openSession('A', '2026-11-16')).toBe(a);
    expect(await openSession('B', '2026-11-16')).not.toBe(a);
    await finishSession(a, 'good');
    expect(await openSession('A', '2026-11-16')).not.toBe(a);
  });

  it('keeps warm-ups separate from a standalone mobility session', async () => {
    const parent = await openSession('A', '2026-11-16');
    const warm = await openSession('M', '2026-11-16', parent);
    expect(await openSession('M', '2026-11-16')).not.toBe(warm);
    expect(await openSession('M', '2026-11-16', parent)).toBe(warm);
  });
});

describe('sets', () => {
  it('upserts one row per set index', async () => {
    const sid = await openSession('A', '2026-11-16');
    const base = { sessionId: sid, exerciseId: 'TrapBarDeadlift', setIndex: 0, load: 95, loadUnit: 'lb' as const, isBodyweight: false, isBand: false, value: 8, unit: 'reps' as const, done: true, doneAt: 1, plannedSets: 2, targetMax: 8 };
    await saveSet(base);
    await saveSet({ ...base, value: 7 });
    const rows = await db.sets.where('sessionId').equals(sid).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(7);
  });
});

describe('backup', () => {
  it('round-trips through export and import', async () => {
    const sid = await openSession('B', '2026-11-19');
    await db.cardio.add({ id: 'c1', date: '2026-11-17', kind: 'run', plannedMin: 25, actualMin: 27, distanceMi: 2.5, effort: 4, note: '', savedAt: 1 });
    const backup = JSON.parse(JSON.stringify(await exportAll()));
    expect(validateBackup(backup)).toBe(true);
    await resetAll();
    expect(await db.sessions.count()).toBe(0);
    await importAll(backup);
    expect((await db.sessions.get(sid))?.type).toBe('B');
    expect((await db.cardio.get('c1'))?.actualMin).toBe(27);
  });

  it('rejects files that are not backups', () => {
    expect(validateBackup({ foo: 1 })).toBe(false);
    expect(validateBackup(null)).toBe(false);
  });
});
