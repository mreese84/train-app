/** Which planned items are done on a given day (pure; unit-tested). */
import type { CardioRec, SessionRec } from '../db';
import type { PlanItem } from '../plan';
import { SESSIONS } from '../data/exercises';
import type { ISODate } from './dates';

export function itemDone(item: PlanItem, date: ISODate, sessions: SessionRec[], cardio: CardioRec[]): boolean {
  switch (item.kind) {
    case 'strength':
      return sessions.some((s) => s.date === date && s.type === item.session && s.finishedAt !== null);
    case 'mobility':
      return sessions.some((s) => s.date === date && s.type === 'M' && s.finishedAt !== null);
    case 'cardio':
      return cardio.some((c) => c.date === date);
    case 'rest':
      return false;
  }
}

export type DayStatus = 'done' | 'partial' | 'none' | 'rest';

/**
 * done: every required item is done (optional items don't count unless the
 * day only has optional items). partial: something was logged.
 */
export function dayStatus(items: PlanItem[], date: ISODate, sessions: SessionRec[], cardio: CardioRec[]): DayStatus {
  const anyLogged =
    sessions.some((s) => s.date === date && s.finishedAt !== null) || cardio.some((c) => c.date === date);
  if (items.every((i) => i.kind === 'rest')) return anyLogged ? 'done' : 'rest';
  const required = items.filter((i) => !(i.kind === 'mobility' && i.optional));
  const toCheck = required.length ? required : items;
  const done = toCheck.filter((i) => itemDone(i, date, sessions, cardio)).length;
  if (done === toCheck.length) return 'done';
  return done > 0 || anyLogged ? 'partial' : 'none';
}

/** Short text for the week list: "Swim or bike (easy) 30 min + Golf mobility". */
export function itemShort(item: PlanItem): string {
  switch (item.kind) {
    case 'strength':
      return SESSIONS[item.session].name;
    case 'mobility':
      return item.optional ? `Golf mobility (optional, ${item.minutes} min)` : 'Golf mobility';
    case 'cardio':
      return `${item.label} · ${item.minutes} min`;
    case 'rest':
      return 'Rest';
  }
}
