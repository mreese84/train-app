import { describe, expect, it } from 'vitest';
import type { CardioRec, SessionRec } from '../db';
import { getDayItems } from '../plan';
import { dayStatus } from './progress';

const sess = (p: Partial<SessionRec>): SessionRec => ({ id: 'x', date: '2026-11-16', type: 'A', startedAt: 1, finishedAt: 2, note: '', ...p });
const cardio = (date: string): CardioRec => ({ id: date, date, kind: 'run', plannedMin: 25, actualMin: 25, distanceMi: null, effort: null, note: '', savedAt: 1 });
const S = '2026-11-16';

describe('day status', () => {
  it('marks a strength day done only when the session is finished', () => {
    const items = getDayItems(S, '2026-11-16');
    expect(dayStatus(items, '2026-11-16', [sess({})], [])).toBe('done');
    expect(dayStatus(items, '2026-11-16', [sess({ finishedAt: null })], [])).toBe('none');
  });
  it('needs both cardio and mobility on Wednesday', () => {
    const d = '2026-11-18';
    const items = getDayItems(S, d);
    expect(dayStatus(items, d, [], [cardio(d)])).toBe('partial');
    expect(dayStatus(items, d, [sess({ date: d, type: 'M' })], [cardio(d)])).toBe('done');
  });
  it('treats an optional-only day as done when logged', () => {
    const d = '2026-11-20';
    expect(dayStatus(getDayItems(S, d), d, [], [])).toBe('none');
    expect(dayStatus(getDayItems(S, d), d, [sess({ date: d, type: 'M' })], [])).toBe('done');
  });
  it('shows rest days as rest', () => {
    expect(dayStatus(getDayItems(S, '2026-11-22'), '2026-11-22', [], [])).toBe('rest');
  });
});
