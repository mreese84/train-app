/**
 * Local-calendar date helpers. Dates are stored as 'YYYY-MM-DD' strings in the
 * phone's local time zone, so "today" always means the day on the wall.
 */

export type ISODate = string; // 'YYYY-MM-DD'

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from a to b (b - a), robust to DST changes. */
export function daysBetween(a: ISODate, b: ISODate): number {
  const da = parseISODate(a);
  const db = parseISODate(b);
  return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) -
    Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86400000);
}

/** Day of week with Monday = 0 ... Sunday = 6. */
export function weekdayMon0(s: ISODate): number {
  return (parseISODate(s).getDay() + 6) % 7;
}

/** The Monday on or before the given date. */
export function mondayOf(s: ISODate): ISODate {
  return addDays(s, -weekdayMon0(s));
}

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon, Nov 16" */
export function formatShort(s: ISODate): string {
  const d = parseISODate(s);
  return `${WEEKDAY_SHORT[weekdayMon0(s)]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "Monday, November 16" style but compact: "Monday, Nov 16, 2026" */
export function formatLong(s: ISODate): string {
  const d = parseISODate(s);
  return `${WEEKDAY_LONG[weekdayMon0(s)]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "Nov 16" */
export function formatMonthDay(s: ISODate): string {
  const d = parseISODate(s);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "52 min" or "1 h 05 min" */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 60) return `${totalMin} min`;
  return `${Math.floor(totalMin / 60)} h ${pad(totalMin % 60)} min`;
}

/** "1:30" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}
