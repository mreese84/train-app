/**
 * Session overview, laid out like the printed overview cards: tag, title,
 * blurb, green warm-up banner, numbered exercise list with doses and done
 * indicators. Start walks through the exercises; Finish saves the session.
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SessionRec, type SetRec } from '../db';
import { isStrength, SESSIONS, type SessionDef } from '../data/exercises';
import { doseText, getWeek, prescribe, type WeekInfo } from '../plan';
import { formatDuration, formatShort } from '../lib/dates';
import { useNow } from '../lib/hooks';
import { navigate } from '../lib/router';
import { deleteSession, finishSession, openSession, updateSessionNote, useSettings } from '../lib/store';
import { ExerciseAnimation } from '../components/ExerciseAnimation';
import { CheckIcon, ChevronLeft } from '../components/Icons';

export function SessionOverview({ sessionId }: { sessionId: string }) {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const sets = useLiveQuery(() => db.sets.where('sessionId').equals(sessionId).toArray(), [sessionId]);
  const { planStart } = useSettings();

  if (session === undefined || sets === undefined) return <main className="page" />;
  if (!session) return <Missing />;

  const def = SESSIONS[session.type];
  const week = getWeek(planStart, session.date);
  return <Overview session={session} def={def} sets={sets} week={week} />;
}

function Missing() {
  return (
    <main className="page">
      <p className="empty">This session no longer exists.</p>
      <button type="button" className="btn btn-primary" onClick={() => navigate('/', { replace: true })}>Go to Today</button>
    </main>
  );
}

/** Done/planned sets per exercise for this session. */
export function exerciseProgress(def: SessionDef, week: WeekInfo, sets: SetRec[]) {
  return def.exercises.map((ex, i) => {
    const rx = prescribe(ex, def.id, i, week);
    const done = sets.filter((s) => s.exerciseId === ex.id && s.done && s.setIndex < rx.sets).length;
    return { ex, rx, done: Math.min(done, rx.sets), complete: done >= rx.sets };
  });
}

function Overview({ session, def, sets, week }: { session: SessionRec; def: SessionDef; sets: SetRec[]; week: WeekInfo }) {
  const now = useNow(15000);
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [note, setNote] = useState(session.note);
  const strength = isStrength(def.id);

  const warmups = useLiveQuery(
    () => (strength ? db.sessions.where('date').equals(session.date).filter((s) => s.type === 'M').toArray() : Promise.resolve([] as SessionRec[])),
    [session.date, strength],
  ) ?? [];
  const warmupDone = warmups.some((w) => w.finishedAt !== null);

  const progress = exerciseProgress(def, week, sets);
  const allDone = progress.every((p) => p.complete);
  const anyDone = sets.some((s) => s.done);
  const firstOpen = progress.findIndex((p) => !p.complete);
  const finished = session.finishedAt !== null;
  const elapsed = (session.finishedAt ?? now) - session.startedAt;
  const remaining = progress.filter((p) => !p.complete).length;

  const back = () => navigate(session.warmupFor ? `/session/${session.warmupFor}` : '/');

  /** The clock starts when the workout actually starts, not when the screen was opened. */
  const restartClockIfUnused = async (id: string) => {
    const hasDone = (await db.sets.where('sessionId').equals(id).filter((s) => s.done).count()) > 0;
    if (!hasDone) await db.sessions.update(id, { startedAt: Date.now() });
  };

  const start = async () => {
    if (!anyDone) await restartClockIfUnused(session.id);
    navigate(`/session/${session.id}/ex/${Math.max(0, firstOpen)}`);
  };

  const openWarmup = async () => {
    if (!anyDone && !warmupDone) await restartClockIfUnused(session.id);
    const existing = warmups.find((w) => w.warmupFor === session.id) ?? warmups.find((w) => w.finishedAt !== null);
    navigate(`/session/${existing ? existing.id : await openSession('M', session.date, session.id)}`);
  };

  const finish = async () => {
    await finishSession(session.id, note.trim());
    navigate(session.warmupFor ? `/session/${session.warmupFor}` : '/', { replace: true });
  };

  return (
    <main className="page">
      <nav className="topnav">
        <button type="button" className="navbtn" onClick={back}><ChevronLeft size={18} />{session.warmupFor ? 'Strength' : 'Today'}</button>
        <span className="topnav-center">{formatShort(session.date)}</span>
        <span />
      </nav>

      <header className="ov-head">
        <span className="tag">{session.warmupFor ? 'Warm-up · 10 min' : def.tag}</span>
        <h1>{def.name}</h1>
        <p className="muted">{def.blurb}</p>
      </header>

      <div className="warmup-banner"><strong>Warm-up</strong>{def.warmup}</div>

      {finished && (
        <div className="finished-banner">
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><CheckIcon size={18} /> Finished · {formatDuration(elapsed)}</span>
        </div>
      )}

      <ol className="ex-list" aria-label="Exercises">
        {strength && (
          <li>
            <button type="button" className="ex-item warmup-step" onClick={openWarmup}>
              <span className="num" aria-hidden="true">W</span>
              <span className="grow">
                <span className="ex-name" style={{ display: 'block' }}>Warm-up: Golf mobility (10 min)</span>
                <span className="ex-dose">{SESSIONS.M.exercises.length} moves, then 1–2 light sets</span>
              </span>
              <span className={`status${warmupDone ? ' done' : ''}`} aria-label={warmupDone ? 'Done' : 'Not done'}>{warmupDone && <CheckIcon size={16} />}</span>
            </button>
          </li>
        )}
        {progress.map(({ ex, rx, done, complete }, i) => (
          <li key={ex.id}>
            <button type="button" className="ex-item" onClick={() => navigate(`/session/${session.id}/ex/${i}`)}>
              <span className="num" aria-hidden="true">{i + 1}</span>
              <span className="thumb"><ExerciseAnimation exercise={ex} thumbnail /></span>
              <span className="grow">
                <span className="ex-name" style={{ display: 'block' }}>{ex.name}</span>
                <span className="ex-dose">{doseText(ex, rx)}</span>
              </span>
              <span className={`status${complete ? ' done' : done > 0 ? ' partial' : ''}`} aria-label={complete ? 'Done' : `${done} of ${rx.sets} sets done`}>
                {complete ? <CheckIcon size={16} /> : done > 0 ? `${done}/${rx.sets}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <p className="footer-note">{def.footer}</p>

      {finished ? (
        <section className="card stack">
          <label className="label" htmlFor="snote">Session note</label>
          <textarea id="snote" className="field" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => updateSessionNote(session.id, note.trim())} placeholder="Optional" />
          <button type="button" className="btn btn-primary btn-block" onClick={back}>Done</button>
        </section>
      ) : finishing ? (
        <section className="card stack finish-sheet" aria-labelledby="fin-h">
          <h2 id="fin-h">Finish session</h2>
          <p><span className="muted">Total time:</span> <b>{formatDuration(elapsed)}</b></p>
          {remaining > 0 && <p className="banner-warn">{remaining} exercise{remaining > 1 ? 's' : ''} not finished. That's OK, it will be saved as is.</p>}
          <label className="label" htmlFor="snote">Session note (optional)</label>
          <textarea id="snote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="How did it feel?" />
          <button type="button" className="btn btn-primary btn-big" onClick={finish}>Save &amp; finish</button>
          <button type="button" className="btn btn-block" onClick={() => setFinishing(false)}>Keep going</button>
        </section>
      ) : (
        <>
          <div className="sticky-cta stack" style={{ gap: 8 }}>
            {allDone ? (
              <button type="button" className="btn btn-primary btn-big" onClick={() => setFinishing(true)}>Finish session</button>
            ) : (
              <button type="button" className="btn btn-primary btn-big" onClick={start}>{anyDone ? 'Continue' : 'Start'}</button>
            )}
          </div>
          {!allDone && (
            <button type="button" className="btn btn-block" onClick={() => setFinishing(true)}>Finish session</button>
          )}
          {anyDone && <p className="muted small" style={{ textAlign: 'center' }}>Elapsed {formatDuration(elapsed)}</p>}
          {confirmDiscard ? (
            <div className="card confirm-box stack">
              <p>Discard this session and everything logged in it?</p>
              <div className="row">
                <button type="button" className="btn btn-danger grow" onClick={async () => { await deleteSession(session.id); navigate(session.warmupFor ? `/session/${session.warmupFor}` : '/', { replace: true }); }}>Discard</button>
                <button type="button" className="btn grow" onClick={() => setConfirmDiscard(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" className="linkbtn" style={{ color: 'var(--muted)' }} onClick={() => setConfirmDiscard(true)}>Discard session</button>
          )}
        </>
      )}
    </main>
  );
}
