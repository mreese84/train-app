/** Cardio log: type, minutes (prefilled from the plan), distance, effort, note. */
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CardioRec } from '../db';
import { CARDIO_KINDS, CARDIO_LABEL, getDayItems, getWeek, type CardioKind, type PlanItem } from '../plan';
import { formatLong, todayISO, type ISODate } from '../lib/dates';
import { navigate } from '../lib/router';
import { deleteCardio, saveCardio, useSettings } from '../lib/store';
import { NumberStepper } from '../components/NumberStepper';
import { CheckIcon, ChevronLeft } from '../components/Icons';

export function CardioLog({ cardioId, date }: { cardioId?: string; date?: ISODate }) {
  const existing = useLiveQuery(async () => ({ rec: cardioId ? await db.cardio.get(cardioId) : undefined }), [cardioId]);
  const { planStart } = useSettings();
  if (existing === undefined) return <main className="page" />;
  if (cardioId && !existing.rec) {
    return (
      <main className="page">
        <p className="empty">This entry no longer exists.</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/', { replace: true })}>Go to Today</button>
      </main>
    );
  }
  const d = existing.rec?.date ?? date ?? todayISO();
  const planned = getWeek(planStart, d).beforeStart
    ? undefined
    : getDayItems(planStart, d).find((i): i is Extract<PlanItem, { kind: 'cardio' }> => i.kind === 'cardio');
  return <CardioForm initial={existing.rec} date={d} planned={planned} />;
}

type Planned = Extract<PlanItem, { kind: 'cardio' }> | undefined;

function CardioForm({ initial, date, planned }: { initial?: CardioRec; date: ISODate; planned: Planned }) {
  const [id, setId] = useState<string | undefined>(initial?.id);
  const [kind, setKind] = useState<CardioKind>(initial?.kind ?? planned?.kinds[0] ?? 'run');
  const [minutes, setMinutes] = useState<number | null>(initial?.actualMin ?? planned?.minutes ?? 30);
  const [distance, setDistance] = useState<number | null>(initial?.distanceMi ?? null);
  const [effort, setEffort] = useState<number | null>(initial?.effort ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saving = useRef(false);

  const record = () => ({
    id,
    date,
    kind,
    plannedMin: initial?.plannedMin ?? planned?.minutes ?? null,
    actualMin: minutes ?? 0,
    distanceMi: distance,
    effort,
    note: note.trim(),
  });

  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    setId(await saveCardio(record()));
    saving.current = false;
  };

  // Once saved, later edits save automatically.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (!id) return;
    const t = setTimeout(() => void saveCardio(record()), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, minutes, distance, effort, note]);

  return (
    <main className="page">
      <nav className="topnav">
        <button type="button" className="navbtn" onClick={() => history.length > 1 ? history.back() : navigate('/')}><ChevronLeft size={18} />Back</button>
        <span className="topnav-center">Cardio</span>
        <span />
      </nav>

      <header className="stack" style={{ gap: 4 }}>
        <span className="tag">{formatLong(date)}</span>
        <h1>{planned ? planned.label : 'Cardio log'}</h1>
        {planned && <p className="muted">Planned: {planned.minutes} min{planned.kinds.length > 1 ? ` · ${planned.kinds.map((k) => CARDIO_LABEL[k]).join(' or ')}` : ''}</p>}
      </header>

      {planned?.note && <p className="weeknote">{planned.note}</p>}

      <section className="card stack">
        <div>
          <span className="label" id="kind-l">Type</span>
          <div className="seg" role="group" aria-labelledby="kind-l">
            {CARDIO_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{CARDIO_LABEL[k]}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Minutes</span>
          <NumberStepper label="Minutes" value={minutes} step={5} onChange={setMinutes} max={600} />
        </div>
        <div>
          <span className="label">Distance (mi, optional)</span>
          <NumberStepper label="Distance in miles" value={distance} step={0.5} decimal placeholder="mi" onChange={setDistance} max={200} />
        </div>
        <div>
          <span className="label" id="effort-l">Effort (1 easy – 10 max)</span>
          <div className="effort" role="group" aria-labelledby="effort-l">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" aria-pressed={effort === n} onClick={() => setEffort(effort === n ? null : n)}>{n}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="cnote">Note</label>
          <textarea id="cnote" className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional: route, how it felt…" />
        </div>
      </section>

      <div className="save-row card">
        <button type="button" className={`check${id ? ' on' : ''}`} aria-pressed={!!id} aria-label={id ? 'Saved' : 'Save cardio'} onClick={save}>
          <CheckIcon />
        </button>
        <div className="grow">
          <p style={{ fontWeight: 600 }}>{id ? 'Saved' : 'Tap to save'}</p>
          <p className="muted small">{id ? 'Changes save automatically.' : 'Saves this workout to your log.'}</p>
        </div>
      </div>

      {id && <button type="button" className="btn btn-primary btn-big" onClick={() => navigate('/')}>Back to Today</button>}

      {id && (confirmDelete ? (
        <div className="card confirm-box stack">
          <p>Delete this cardio entry?</p>
          <div className="row">
            <button type="button" className="btn btn-danger grow" onClick={async () => { await deleteCardio(id); navigate('/', { replace: true }); }}>Delete</button>
            <button type="button" className="btn grow" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className="linkbtn" style={{ color: 'var(--muted)' }} onClick={() => setConfirmDelete(true)}>Delete entry</button>
      ))}
    </main>
  );
}
