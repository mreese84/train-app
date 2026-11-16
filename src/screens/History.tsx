/** History: sessions and cardio (newest first), or a per-exercise index. */
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CardioRec, type SessionRec } from '../db';
import { library, SESSIONS } from '../data/exercises';
import { CARDIO_LABEL } from '../plan';
import { formatDuration, formatShort, parseISODate } from '../lib/dates';
import { bestLoad } from '../lib/logic';
import { navigate } from '../lib/router';
import { ChevronRight } from '../components/Icons';

type Entry =
  | { kind: 'session'; date: string; time: number; s: SessionRec; doneSets: number }
  | { kind: 'cardio'; date: string; time: number; c: CardioRec };

export function History({ view }: { view: 'sessions' | 'exercises' }) {
  return (
    <main className="page with-tabbar">
      <h1>History</h1>
      <div className="tabs2" role="group" aria-label="History view">
        <button type="button" aria-pressed={view === 'sessions'} onClick={() => navigate('/history', { replace: true })}>Sessions</button>
        <button type="button" aria-pressed={view === 'exercises'} onClick={() => navigate('/history/exercises', { replace: true })}>Exercises</button>
      </div>
      {view === 'sessions' ? <SessionList /> : <ExerciseIndex />}
    </main>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function SessionList() {
  const entries = useLiveQuery(async () => {
    const [sessions, sets, cardio] = await Promise.all([db.sessions.toArray(), db.sets.toArray(), db.cardio.toArray()]);
    const doneBySession = new Map<string, number>();
    for (const s of sets) if (s.done) doneBySession.set(s.sessionId, (doneBySession.get(s.sessionId) ?? 0) + 1);
    const list: Entry[] = [
      ...sessions
        .filter((s) => s.finishedAt !== null || doneBySession.has(s.id))
        .map((s) => ({ kind: 'session' as const, date: s.date, time: s.startedAt, s, doneSets: doneBySession.get(s.id) ?? 0 })),
      ...cardio.map((c) => ({ kind: 'cardio' as const, date: c.date, time: c.savedAt, c })),
    ];
    return list.sort((a, b) => (a.date === b.date ? b.time - a.time : a.date < b.date ? 1 : -1));
  }, []);

  if (!entries) return null;
  if (!entries.length) return <p className="empty">Nothing logged yet. Finished sessions and cardio show up here.</p>;

  let lastMonth = '';
  const out: React.ReactNode[] = [];
  for (const e of entries) {
    const d = parseISODate(e.date);
    const month = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (month !== lastMonth) {
      out.push(<li key={`m-${month}`} className="section-title month">{month}</li>);
      lastMonth = month;
    }
    if (e.kind === 'session') {
      const s = e.s;
      const title = `${SESSIONS[s.type].name}${s.warmupFor ? ' (warm-up)' : ''}`;
      const sets = `${e.doneSets} set${e.doneSets === 1 ? '' : 's'}`;
      const sub = s.finishedAt !== null ? `${formatDuration(s.finishedAt - s.startedAt)} · ${sets}` : `Not finished · ${sets}`;
      out.push(
        <li key={s.id}>
          <button type="button" className="list-item" onClick={() => navigate(`/history/session/${s.id}`)}>
            <span className="grow">
              <span style={{ display: 'block', fontWeight: 600 }}>{title}</span>
              <span className="muted small">{formatShort(s.date)} · {sub}</span>
            </span>
            <span className="chev"><ChevronRight /></span>
          </button>
        </li>,
      );
    } else {
      const c = e.c;
      const bits = [`${c.actualMin} min`, c.distanceMi ? `${c.distanceMi} mi` : '', c.effort ? `effort ${c.effort}` : ''].filter(Boolean);
      out.push(
        <li key={c.id}>
          <button type="button" className="list-item" onClick={() => navigate(`/cardio/${c.id}`)}>
            <span className="grow">
              <span style={{ display: 'block', fontWeight: 600 }}>{CARDIO_LABEL[c.kind]}</span>
              <span className="muted small">{formatShort(c.date)} · {bits.join(' · ')}</span>
            </span>
            <span className="chev"><ChevronRight /></span>
          </button>
        </li>,
      );
    }
  }
  return <ul className="list">{out}</ul>;
}

function ExerciseIndex() {
  const stats = useLiveQuery(async () => {
    const sets = (await db.sets.toArray()).filter((s) => s.done);
    const m = new Map<string, { sessions: Set<string>; best: number | null }>();
    for (const s of sets) {
      const e = m.get(s.exerciseId) ?? { sessions: new Set(), best: null };
      e.sessions.add(s.sessionId);
      m.set(s.exerciseId, e);
    }
    for (const [id, e] of m) e.best = bestLoad(sets.filter((s) => s.exerciseId === id));
    return m;
  }, []);
  if (!stats) return null;

  return (
    <div className="stack">
      {library.sessions.map((def) => (
        <section key={def.id} className="stack" style={{ gap: 8 }}>
          <p className="section-title">{def.name}</p>
          <ul className="list">
            {def.exercises.map((ex) => {
              const st = stats.get(ex.id);
              const unit = ex.load === 'kg' ? 'kg' : 'lb';
              return (
                <li key={ex.id}>
                  <button type="button" className="list-item" onClick={() => navigate(`/history/exercise/${ex.id}`)}>
                    <span className="grow">
                      <span style={{ display: 'block', fontWeight: 600 }}>{ex.name}</span>
                      <span className="muted small">
                        {st ? `${st.sessions.size} session${st.sessions.size > 1 ? 's' : ''}${st.best ? ` · best ${st.best} ${unit}` : ''}` : 'Not logged yet'}
                      </span>
                    </span>
                    <span className="chev"><ChevronRight /></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
