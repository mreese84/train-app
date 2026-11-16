/** Today (home): date, phase/week, today's plan, the week at a glance, manual starts. */
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SessionRec } from '../db';
import { SESSIONS, type SessionId } from '../data/exercises';
import { getWeek, weekLabel, type PlanItem } from '../plan';
import { addDays, formatLong, formatMonthDay, formatShort, WEEKDAY_SHORT, weekdayMon0, type ISODate } from '../lib/dates';
import { useToday } from '../lib/hooks';
import { dayStatus, itemDone, itemShort } from '../lib/progress';
import { navigate } from '../lib/router';
import { openSession, useSettings } from '../lib/store';
import { CheckIcon, ChevronRight } from '../components/Icons';

/** Opens the screen for a planned item on a given date. */
export async function startItem(item: PlanItem, date: ISODate) {
  if (item.kind === 'strength') navigate(`/session/${await openSession(item.session, date)}`);
  else if (item.kind === 'mobility') navigate(`/session/${await openSession('M', date)}`);
  else if (item.kind === 'cardio') {
    const existing = await db.cardio.where('date').equals(date).first();
    navigate(existing ? `/cardio/${existing.id}` : `/cardio?date=${date}`);
  }
}

export function Today() {
  const today = useToday();
  const { planStart } = useSettings();
  const week = getWeek(planStart, today);
  const monday = week.monday;
  const sunday = addDays(monday, 6);

  const sessions = useLiveQuery(() => db.sessions.where('date').between(monday, sunday, true, true).toArray(), [monday, sunday]) ?? [];
  const cardio = useLiveQuery(() => db.cardio.where('date').between(monday, sunday, true, true).toArray(), [monday, sunday]) ?? [];
  const unfinished = useLiveQuery(
    () => db.sessions.filter((s) => s.finishedAt === null && !s.warmupFor).reverse().sortBy('startedAt'),
    [],
  );
  const lastBackup = useLiveQuery(() => db.meta.get('lastBackupAt'), []);
  const hasData = useLiveQuery(() => db.sets.count(), []) ?? 0;

  const todayItems = week.beforeStart ? [] : week.days[weekdayMon0(today)];
  const actionable = todayItems.filter((i) => i.kind !== 'rest');
  const next = actionable.find((i) => !itemDone(i, today, sessions, cardio));
  const resume = unfinished?.[0];
  const backupAge = lastBackup ? (Date.now() - (lastBackup.value as number)) / 86400000 : Infinity;

  return (
    <main className="page with-tabbar">
      <header className="stack" style={{ gap: 4 }}>
        <p className="today-date">{formatLong(today)}</p>
        <h1>Today</h1>
        <p className="phase">
          {week.beforeStart ? `Plan starts ${formatShort(planStart)}` : weekLabel(week)}
          {week.deload && !week.beforeStart ? ' · Deload' : ''}
        </p>
      </header>

      {week.note && <p className="weeknote">{week.beforeStart ? `Week 1: ${week.note}` : week.note}</p>}

      {resume && <ResumeCard session={resume} />}

      <section className="card plan-card stack" aria-labelledby="plan-h">
        <p className="section-title" id="plan-h">Today's plan</p>
        {week.beforeStart && <p>Nothing scheduled yet. Week 1 starts {formatShort(planStart)}. You can still open any session below.</p>}
        {!week.beforeStart && actionable.length === 0 && (
          <>
            <h2>Rest day</h2>
            <p className="muted">Recover. Walk if you feel like it.</p>
          </>
        )}
        {actionable.map((item, i) => {
          const done = itemDone(item, today, sessions, cardio);
          return (
            <div key={i} className="stack" style={{ gap: 4 }}>
              <div className="spread">
                <h2>{itemTitle(item)}</h2>
                {done && <span className="plan-item-done"><CheckIcon size={18} /> Done</span>}
              </div>
              <p className="muted small">{itemSub(item)}</p>
              {item.kind === 'cardio' && item.note && <p className="small" style={{ fontWeight: 600 }}>{item.note}</p>}
              {item === next ? (
                <button type="button" className="btn btn-primary btn-big" style={{ marginTop: 8 }} onClick={() => startItem(item, today)}>
                  {startLabel(item, resume, today)}
                </button>
              ) : (
                <button type="button" className="btn btn-block" style={{ marginTop: 4 }} onClick={() => startItem(item, today)}>
                  {done ? 'View' : 'Open'}
                </button>
              )}
            </div>
          );
        })}
      </section>

      <section className="card" aria-labelledby="week-h">
        <div className="spread" style={{ marginBottom: 6 }}>
          <p className="section-title" id="week-h">{week.beforeStart ? 'Week 1' : 'This week'}</p>
          <p className="muted small">{formatMonthDay(monday)} – {formatMonthDay(sunday)}</p>
        </div>
        <ul className="week-list">
          {week.days.map((items, d) => {
            const date = addDays(monday, d);
            const status = dayStatus(items, date, sessions, cardio);
            const isRest = items.every((i) => i.kind === 'rest');
            const tappable = date <= today && !isRest;
            const first = items.find((i) => i.kind !== 'rest' && !itemDone(i, date, sessions, cardio)) ?? items[0];
            const content = (
              <>
                <span className="week-day-name">{WEEKDAY_SHORT[d]}<small>{formatMonthDay(date).split(' ')[1]}</small></span>
                <span className="week-day-plan">{items.map(itemShort).join(' + ')}</span>
                <span className={`daycheck ${status === 'done' ? 'done' : status === 'partial' ? 'partial' : ''}`} aria-label={status === 'done' ? 'Completed' : status === 'partial' ? 'Partly done' : undefined}>
                  {status === 'done' && <CheckIcon size={16} />}
                </span>
              </>
            );
            const cls = `week-day${date === today ? ' is-today' : ''}${isRest ? ' is-rest' : ''}`;
            return (
              <li key={d}>
                {tappable ? (
                  <button type="button" className={cls} onClick={() => startItem(first, date)}>{content}</button>
                ) : (
                  <div className={cls}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="stack" aria-labelledby="any-h">
        <p className="section-title" id="any-h">Open any session</p>
        <div className="quick-grid">
          {(['A', 'B', 'M'] as SessionId[]).map((id) => (
            <button key={id} type="button" className="btn" onClick={async () => navigate(`/session/${await openSession(id, today)}`)}>
              {SESSIONS[id].name}
            </button>
          ))}
          <button type="button" className="btn" onClick={() => navigate(`/cardio?date=${today}`)}>Log cardio</button>
        </div>
      </section>

      {hasData > 0 && backupAge > 14 && (
        <button type="button" className="banner-warn" style={{ border: 0, textAlign: 'left', minHeight: 44 }} onClick={() => navigate('/settings')}>
          {lastBackup ? `Last backup ${Math.floor(backupAge)} days ago.` : 'No backup yet.'} Tap to export your data.
        </button>
      )}
    </main>
  );
}

function itemTitle(item: PlanItem): string {
  if (item.kind === 'strength') return SESSIONS[item.session].name;
  if (item.kind === 'mobility') return item.optional ? 'Golf mobility (optional)' : 'Golf mobility';
  if (item.kind === 'cardio') return item.label;
  return 'Rest';
}

function itemSub(item: PlanItem): string {
  if (item.kind === 'strength') {
    const s = SESSIONS[item.session];
    return `Warm-up: golf mobility (10 min) · ${s.exercises.length} exercises`;
  }
  if (item.kind === 'mobility') return `${SESSIONS.M.exercises.length} moves · about ${item.minutes} min`;
  if (item.kind === 'cardio') return `${item.minutes} min planned`;
  return '';
}

function startLabel(item: PlanItem, resume: SessionRec | undefined, today: ISODate): string {
  const sessionType = item.kind === 'strength' ? item.session : item.kind === 'mobility' ? 'M' : null;
  if (sessionType && resume && resume.type === sessionType && resume.date === today) return `Resume ${SESSIONS[sessionType].name}`;
  if (item.kind === 'cardio') return `Log ${item.label.toLowerCase()}`;
  return `Start ${itemTitle(item)}`;
}

function ResumeCard({ session }: { session: SessionRec }) {
  return (
    <button type="button" className="card resume-card list-item" onClick={() => navigate(`/session/${session.id}`)}>
      <span className="grow">
        <span className="tag">In progress</span>
        <span style={{ display: 'block', fontWeight: 600, fontSize: 17 }}>{SESSIONS[session.type].name}</span>
        <span className="muted small">Started {formatShort(session.date)} · tap to resume</span>
      </span>
      <span className="chev"><ChevronRight /></span>
    </button>
  );
}
