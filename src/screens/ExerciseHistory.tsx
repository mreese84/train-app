/** Per-exercise history: best-weight trend sparkline and every past session's sets. */
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SetRec } from '../db';
import { EXERCISES } from '../data/exercises';
import { formatShort } from '../lib/dates';
import { bestLoad, summarizeSets } from '../lib/logic';
import { navigate } from '../lib/router';
import { ChevronLeft } from '../components/Icons';
import { Sparkline } from '../components/Sparkline';

export function ExerciseHistory({ exerciseId }: { exerciseId: string }) {
  const ex = EXERCISES[exerciseId];
  const data = useLiveQuery(async () => {
    const sets = await db.sets.where('exerciseId').equals(exerciseId).filter((s) => s.done).toArray();
    const ids = [...new Set(sets.map((s) => s.sessionId))];
    const sessions = (await db.sessions.bulkGet(ids)).filter((s) => !!s);
    return sessions
      .map((s) => ({ session: s, sets: sets.filter((x) => x.sessionId === s.id).sort((a, b) => a.setIndex - b.setIndex) }))
      .sort((a, b) => (a.session.date === b.session.date ? a.session.startedAt - b.session.startedAt : a.session.date < b.session.date ? -1 : 1));
  }, [exerciseId]);

  if (!ex) return <main className="page with-tabbar"><p className="empty">Unknown exercise.</p></main>;

  const weighted = ex.load === 'lb' || ex.load === 'kg';
  const unit = ex.load === 'kg' ? 'kg' : 'lb';
  const metric = (sets: SetRec[]) => (weighted ? bestLoad(sets) : Math.max(...sets.map((s) => s.value)));
  const points = (data ?? []).map((d) => ({ label: formatShort(d.session.date), value: metric(d.sets) })).filter((p): p is { label: string; value: number } => p.value !== null && Number.isFinite(p.value));
  const metricName = weighted ? `Best weight (${unit})` : `Best ${ex.unit === 'reps' ? 'reps' : ex.unit}`;
  const best = points.length ? Math.max(...points.map((p) => p.value)) : null;

  return (
    <main className="page with-tabbar">
      <nav className="topnav">
        <button type="button" className="navbtn" onClick={() => navigate('/history/exercises')}><ChevronLeft size={18} />Exercises</button>
        <span />
        <span />
      </nav>
      <h1>{ex.name}</h1>

      <section className="card stack" style={{ gap: 8 }}>
        <div className="spread">
          <p className="section-title">{metricName}</p>
          {best !== null && <p style={{ fontWeight: 700, fontFamily: 'var(--font-head)', fontSize: 20 }}>{best}{weighted ? ` ${unit}` : ''}</p>}
        </div>
        {points.length >= 2 ? (
          <Sparkline values={points.map((p) => p.value)} label={`${metricName} trend`} />
        ) : (
          <p className="muted small">{points.length ? 'Log one more session to see a trend.' : 'No sets logged yet.'}</p>
        )}
        {points.length >= 2 && (
          <div className="spread muted small"><span>{points[0].label}</span><span>{points[points.length - 1].label}</span></div>
        )}
      </section>

      {data && data.length > 0 && (
        <ul className="list">
          {[...data].reverse().map(({ session, sets }) => (
            <li key={session.id}>
              <button type="button" className="list-item" onClick={() => navigate(`/history/session/${session.id}`)}>
                <span className="grow">
                  <span style={{ display: 'block', fontWeight: 600 }}>{formatShort(session.date)}</span>
                  <span className="muted small">{summarizeSets(sets)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
