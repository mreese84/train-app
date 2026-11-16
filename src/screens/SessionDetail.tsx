/** One past session: duration, note, and every set per exercise. */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { SESSIONS } from '../data/exercises';
import { formatDuration, formatLong } from '../lib/dates';
import { formatLoad, summarizeSets } from '../lib/logic';
import { navigate } from '../lib/router';
import { deleteSession } from '../lib/store';
import { ChevronLeft } from '../components/Icons';

export function SessionDetail({ sessionId }: { sessionId: string }) {
  const data = useLiveQuery(async () => {
    const session = await db.sessions.get(sessionId);
    const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
    const notes = await db.exerciseNotes.where('sessionId').equals(sessionId).toArray();
    const warmup = await db.sessions.where('warmupFor').equals(sessionId).first();
    return { session, sets, notes, warmup };
  }, [sessionId]);
  const [confirm, setConfirm] = useState(false);

  if (!data) return <main className="page with-tabbar" />;
  const { session, sets, notes, warmup } = data;
  if (!session) {
    return (
      <main className="page with-tabbar">
        <p className="empty">This session no longer exists.</p>
        <button type="button" className="btn" onClick={() => navigate('/history', { replace: true })}>Back to history</button>
      </main>
    );
  }
  const def = SESSIONS[session.type];
  const noteFor = (id: string) => notes.find((n) => n.exerciseId === id)?.note;

  return (
    <main className="page with-tabbar">
      <nav className="topnav">
        <button type="button" className="navbtn" onClick={() => navigate('/history')}><ChevronLeft size={18} />History</button>
        <span />
        <span />
      </nav>
      <header className="stack" style={{ gap: 4 }}>
        <span className="tag">{formatLong(session.date)}</span>
        <h1>{def.name}{session.warmupFor ? ' (warm-up)' : ''}</h1>
      </header>

      <dl className="card kv">
        <dt>Time</dt>
        <dd>{session.finishedAt !== null ? formatDuration(session.finishedAt - session.startedAt) : 'Not finished'}</dd>
        {warmup && (<><dt>Warm-up</dt><dd>{warmup.finishedAt !== null ? 'Golf mobility done' : 'Started'}</dd></>)}
        {session.note && (<><dt>Note</dt><dd>{session.note}</dd></>)}
      </dl>

      <section className="stack">
        {def.exercises.map((ex) => {
          const exSets = sets.filter((s) => s.exerciseId === ex.id && s.done).sort((a, b) => a.setIndex - b.setIndex);
          const note = noteFor(ex.id);
          if (!exSets.length && !note) return null;
          return (
            <div key={ex.id} className="card">
              <button type="button" className="linkbtn" style={{ padding: 0, color: 'var(--ink)', textAlign: 'left' }} onClick={() => navigate(`/history/exercise/${ex.id}`)}>
                <h3>{ex.name}</h3>
              </button>
              {exSets.length > 0 && <p className="muted small">{summarizeSets(exSets)}</p>}
              <ul className="setlist">
                {exSets.map((s) => (
                  <li key={s.id}>
                    <span className="muted">Set {s.setIndex + 1}</span>
                    <span>{formatLoad(s)} × {s.value}{s.unit === 'seconds' ? ' s' : s.unit === 'meters' ? ' m' : ''}</span>
                  </li>
                ))}
              </ul>
              {note && <p className="small" style={{ marginTop: 6 }}><span className="muted">Note:</span> {note}</p>}
            </div>
          );
        })}
        {!sets.some((s) => s.done) && <p className="empty">No sets were checked in this session.</p>}
      </section>

      <button type="button" className="btn btn-block" onClick={() => navigate(`/session/${session.id}`)}>Open session to edit</button>
      {confirm ? (
        <div className="card confirm-box stack">
          <p>Delete this session and its sets? This can't be undone.</p>
          <div className="row">
            <button type="button" className="btn btn-danger grow" onClick={async () => { await deleteSession(session.id); navigate('/history', { replace: true }); }}>Delete</button>
            <button type="button" className="btn grow" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className="linkbtn" style={{ color: 'var(--muted)' }} onClick={() => setConfirm(true)}>Delete session</button>
      )}
    </main>
  );
}
