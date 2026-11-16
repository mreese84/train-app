/**
 * The exercise screen (the core of the app): animated figure, then one row
 * per planned set with prefilled load and reps, a big check button
 * that saves immediately, then form tips, timers, the progression hint and notes.
 */
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, loadUnitFor, noteId, setId, type SessionRec, type SetRec } from '../db';
import { SESSIONS, type Exercise } from '../data/exercises';
import { doseText, getWeek, LOAD_STEP, prescribe, restSecondsFor, type Prescription } from '../plan';
import { alertDone, unlockAudio } from '../lib/alert';
import { formatClock, formatShort } from '../lib/dates';
import { useAutosave } from '../lib/hooks';
import { buildSetRows, previousSessionSets, progressionHint, summarizeSets, type SetRow } from '../lib/logic';
import { navigate } from '../lib/router';
import { bumpFormTipsView, saveExerciseNote, saveSet, useSettings } from '../lib/store';
import { ExerciseAnimation } from '../components/ExerciseAnimation';
import { NumberStepper } from '../components/NumberStepper';
import { useRestTimer } from '../components/RestTimer';
import { CheckIcon, ChevronDown, ChevronLeft, ChevronRight, TimerIcon } from '../components/Icons';

export function ExerciseScreen({ sessionId, index }: { sessionId: string; index: number }) {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const { planStart } = useSettings();
  if (session === undefined) return <main className="page" />;
  const def = session ? SESSIONS[session.type] : null;
  const ex = def?.exercises[index];
  if (!session || !def || !ex) {
    return (
      <main className="page">
        <p className="empty">Exercise not found.</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/', { replace: true })}>Go to Today</button>
      </main>
    );
  }
  const rx = prescribe(ex, def.id, index, getWeek(planStart, session.date));
  return <ExerciseView session={session} ex={ex} index={index} total={def.exercises.length} rx={rx} />;
}

type ViewProps = { session: SessionRec; ex: Exercise; index: number; total: number; rx: Prescription };

function ExerciseView({ session, ex, index, total, rx }: ViewProps) {
  const sessionId = session.id;
  const saved = useLiveQuery(
    () => db.sets.where('[sessionId+exerciseId]').equals([sessionId, ex.id]).toArray(),
    [sessionId, ex.id],
  );

  // Most recent earlier session that included this exercise.
  const prevData = useLiveQuery(async () => {
    const all = await db.sets.where('exerciseId').equals(ex.id).filter((s) => s.done && s.sessionId !== sessionId).toArray();
    const ids = [...new Set(all.map((s) => s.sessionId))];
    const sessions = (await db.sessions.bulkGet(ids)).filter((s): s is SessionRec => !!s && s.startedAt < session.startedAt);
    const start = new Map(sessions.map((s) => [s.id, s.startedAt]));
    const prev = previousSessionSets(all.filter((s) => start.has(s.sessionId)), sessionId, (id) => start.get(id) ?? 0);
    return { prev, date: prev.length ? sessions.find((s) => s.id === prev[0].sessionId)?.date : undefined };
  }, [ex.id, sessionId, session.startedAt]);

  // Wrapped so `undefined` means "still loading" rather than "no note".
  const savedNote = useLiveQuery(async () => ({ rec: await db.exerciseNotes.get(noteId(sessionId, ex.id)) }), [sessionId, ex.id]);

  // Form tips start open the first 3 times an exercise is opened.
  const [tipsOpen, setTipsOpen] = useState<boolean | null>(null);
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    bumpFormTipsView(ex.id).then((prevViews) => setTipsOpen(prevViews < 3));
  }, [ex.id]);

  const rest = useRestTimer();

  // Optimistic copies of rows written in this visit. Writes are async, so
  // without these a quick second tap could build on a stale row.
  const [local, setLocal] = useState<Map<number, SetRec>>(() => new Map());

  if (saved === undefined || prevData === undefined || savedNote === undefined) return <main className="page" />;

  const prev = prevData.prev;
  const merged = [...saved.filter((s) => !local.has(s.setIndex)), ...local.values()];
  const rows = buildSetRows(ex, rx, merged, prev);
  const savedByIndex = new Map(merged.map((s) => [s.setIndex, s]));
  const hint = progressionHint(ex, prev);
  const lastTime = summarizeSets(prev);
  const restSec = restSecondsFor(ex.id);
  const allDone = rows.slice(0, rx.sets).every((r) => r.done);
  const isLast = index >= total - 1;

  const persist = (row: SetRow, patch: Partial<SetRow>, doneAt?: number | null) => {
    const r = { ...row, ...patch };
    const rec: Omit<SetRec, 'id' | 'updatedAt'> = {
      sessionId,
      exerciseId: ex.id,
      setIndex: r.setIndex,
      load: r.isBand ? null : r.load,
      // Added weight on bodyweight moves is recorded in lb.
      loadUnit: loadUnitFor(ex.load) ?? (r.load !== null ? 'lb' : null),
      isBodyweight: r.isBodyweight,
      isBand: r.isBand,
      value: r.value,
      unit: ex.unit,
      done: r.done,
      doneAt: doneAt !== undefined ? doneAt : (savedByIndex.get(r.setIndex)?.doneAt ?? null),
      plannedSets: rx.sets,
      targetMax: rx.targetMax,
    };
    setLocal((m) => new Map(m).set(r.setIndex, { ...rec, id: setId(sessionId, ex.id, r.setIndex), updatedAt: Date.now() }));
    void saveSet(rec);
  };

  const toggle = (row: SetRow) => {
    unlockAudio();
    const done = !row.done;
    persist(row, { done }, done ? Date.now() : null);
    const isFinalSet = row.setIndex >= rows.length - 1;
    if (done && !isFinalSet && restSec > 0) rest.start(restSec, ex.name);
  };

  const goNext = () => navigate(isLast ? `/session/${sessionId}` : `/session/${sessionId}/ex/${index + 1}`);

  return (
    <main className="page">
      <nav className="topnav" aria-label="Exercise navigation">
        <button type="button" className="navbtn" onClick={() => navigate(index > 0 ? `/session/${sessionId}/ex/${index - 1}` : `/session/${sessionId}`)}>
          <ChevronLeft size={18} />Back
        </button>
        <span className="topnav-center">{index + 1} of {total}</span>
        <button type="button" className="navbtn" onClick={goNext}>
          {isLast ? 'Done' : 'Next'}<ChevronRight size={18} />
        </button>
      </nav>

      <header className="ex-title">
        <h1>{ex.name}</h1>
        <div className="chips">
          <span className="chip chip-green">{doseText(ex, rx)}</span>
          <span className="chip">{ex.restText}</span>
        </div>
      </header>

      <ExerciseAnimation key={ex.id} exercise={ex} />

      <section className="sets" aria-label="Sets">
        {rows.map((row) => (
          <SetRowView key={row.setIndex} ex={ex} row={row} onChange={(patch) => persist(row, patch)} onToggle={() => toggle(row)} />
        ))}
      </section>

      <section className="stack" style={{ gap: 8 }}>
        <button type="button" className="btn tips-toggle" aria-expanded={!!tipsOpen} onClick={() => setTipsOpen((o) => !o)}>
          <span>Form tips</span>
          <span style={{ transform: tipsOpen ? 'rotate(180deg)' : undefined, display: 'inline-flex' }}><ChevronDown /></span>
        </button>
        {tipsOpen && (
          <div className="card stack">
            <p className="why">{ex.why}</p>
            <ol className="cues">
              {ex.cues.map((c, i) => (
                <li key={i}><span className="num">{i + 1}</span><span>{c}</span></li>
              ))}
            </ol>
            <div className="avoid"><strong>AVOID</strong>{ex.avoid}</div>
          </div>
        )}
      </section>

      {(lastTime || hint) && (
        <section className="stack" style={{ gap: 8 }}>
          {lastTime && (
            <p className="lasttime">Last time{prevData.date ? ` (${formatShort(prevData.date)})` : ''}: <b>{lastTime}</b></p>
          )}
          {hint && <p className="hint">↑ {hint.text}</p>}
        </section>
      )}

      <NoteField initial={savedNote.rec?.note ?? ''} onSave={(v) => saveExerciseNote(sessionId, ex.id, v)} />

      <button type="button" className={`btn btn-big ${allDone ? 'btn-primary' : ''}`} onClick={goNext}>
        {isLast ? 'Back to overview' : `Next: ${SESSIONS[session.type].exercises[index + 1].name}`}
      </button>
    </main>
  );
}

function NoteField({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [value, setValue] = useAutosave(initial, onSave);
  return (
    <div>
      <label className="label" htmlFor="exnote">Note</label>
      <textarea id="exnote" className="field" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Optional: seat height, how it felt…" />
    </div>
  );
}

const unitLabel = (ex: Exercise) =>
  `${ex.unit === 'reps' ? 'Reps' : ex.unit === 'seconds' ? 'Sec' : 'Meters'}${ex.perSide ? ' / side' : ''}`;
const valueStep = (ex: Exercise) => (ex.unit === 'reps' ? 1 : 5);

function SetRowView({ ex, row, onChange, onToggle }: { ex: Exercise; row: SetRow; onChange: (p: Partial<SetRow>) => void; onToggle: () => void }) {
  const unit = loadUnitFor(ex.load);
  const [addingWeight, setAddingWeight] = useState(false);
  const showAddedWeight = row.isBodyweight && (addingWeight || (row.load !== null && row.load > 0));

  let loadField: React.ReactNode;
  if (row.isBand) {
    loadField = <div className="static-load">Band</div>;
  } else if (row.isBodyweight && !showAddedWeight) {
    loadField = (
      <div className="static-load">
        <span>Bodyweight</span>
        <button type="button" className="addweight" onClick={() => setAddingWeight(true)}>+ add weight</button>
      </div>
    );
  } else {
    const u = unit ?? 'lb';
    loadField = (
      <NumberStepper
        label={`Set ${row.setIndex + 1} weight in ${u}`}
        value={row.load}
        step={LOAD_STEP[u]}
        decimal
        placeholder={u}
        onChange={(v) => {
          if (row.isBodyweight && v === null) setAddingWeight(false);
          onChange({ load: v });
        }}
      />
    );
  }

  return (
    <div className={`setrow${row.done ? ' done' : ''}`}>
      <div className="setrow-fields">
        <div className="setrow-head">Set {row.setIndex + 1}</div>
        {row.isBand || (row.isBodyweight && !showAddedWeight) ? (
          // No weight to enter: the label spans the whole line.
          <div className="field-line field-line-full">{loadField}</div>
        ) : (
          <div className="field-line">
            <span className="field-label">{row.isBodyweight ? `BW + ${unit ?? 'lb'}` : `Weight ${unit}`}</span>
            {loadField}
          </div>
        )}
        <div className="field-line">
          <span className="field-label">{unitLabel(ex)}</span>
          <NumberStepper
            label={`Set ${row.setIndex + 1} ${unitLabel(ex).toLowerCase()}`}
            value={row.value}
            step={valueStep(ex)}
            onChange={(v) => onChange({ value: v ?? 0 })}
          />
        </div>
        {ex.unit === 'seconds' && <SetTimer seconds={row.value} />}
      </div>
      <button
        type="button"
        className={`check${row.done ? ' on' : ''}`}
        aria-pressed={row.done}
        aria-label={row.done ? `Set ${row.setIndex + 1} done. Tap to undo` : `Mark set ${row.setIndex + 1} done`}
        onClick={onToggle}
      >
        <CheckIcon />
      </button>
    </div>
  );
}

/** Countdown for timed holds: vibrates and beeps at zero. */
function SetTimer({ seconds }: { seconds: number }) {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endAt === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endAt) {
        alertDone();
        setEndAt(null);
      }
    }, 200);
    return () => clearInterval(id);
  }, [endAt]);

  if (endAt === null) {
    return (
      <button type="button" className="timer-btn" onClick={() => { unlockAudio(); setNow(Date.now()); setEndAt(Date.now() + seconds * 1000); }}>
        <TimerIcon size={18} /> Start timer · {formatClock(seconds)}
      </button>
    );
  }
  return (
    <button type="button" className="timer-btn running" onClick={() => setEndAt(null)} aria-live="polite">
      {formatClock((endAt - now) / 1000)} · Stop
    </button>
  );
}
