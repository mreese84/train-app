/**
 * Rest timer: a slim countdown bar pinned to the bottom of the screen after a
 * set is checked. It never blocks the page. It counts against a wall-clock end
 * time, so it stays right when the phone locks, and it is remembered across
 * reloads.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { alertDone } from '../lib/alert';
import { formatClock } from '../lib/dates';

type Rest = { endAt: number; total: number; label: string; alerted: boolean };
type Ctx = { rest: Rest | null; start: (seconds: number, label: string) => void; stop: () => void };

const RestCtx = createContext<Ctx>({ rest: null, start: () => {}, stop: () => {} });
const KEY = 'train:rest';

function load(): Rest | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Rest | null;
    return r && r.endAt > Date.now() - 5000 ? r : null;
  } catch {
    return null;
  }
}

function persist(r: Rest | null) {
  try {
    if (r) localStorage.setItem(KEY, JSON.stringify(r));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [rest, setRest] = useState<Rest | null>(load);

  const start = useCallback((seconds: number, label: string) => {
    const r = { endAt: Date.now() + seconds * 1000, total: seconds, label, alerted: false };
    persist(r);
    setRest(r);
  }, []);
  const stop = useCallback(() => {
    persist(null);
    setRest(null);
  }, []);

  // Pages add bottom padding while the bar is showing so nothing hides under it.
  useEffect(() => {
    document.body.classList.toggle('has-restbar', !!rest);
  }, [rest]);

  return (
    <RestCtx.Provider value={{ rest, start, stop }}>
      {children}
      {rest && <RestBar rest={rest} setRest={setRest} stop={stop} />}
    </RestCtx.Provider>
  );
}

export const useRestTimer = () => useContext(RestCtx);

function RestBar({ rest, setRest, stop }: { rest: Rest; setRest: (r: Rest) => void; stop: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remaining = (rest.endAt - now) / 1000;
  const done = remaining <= 0;

  useEffect(() => {
    if (done && !rest.alerted) {
      alertDone();
      const r = { ...rest, alerted: true };
      persist(r);
      setRest(r);
    }
  }, [done, rest, setRest]);

  // Hide a few seconds after reaching zero.
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(stop, 4000);
    return () => clearTimeout(id);
  }, [done, stop]);

  const add30 = () => {
    const base = Math.max(rest.endAt, Date.now());
    const r = { ...rest, endAt: base + 30000, total: Math.max(rest.total, (base + 30000 - Date.now()) / 1000), alerted: false };
    persist(r);
    setRest(r);
  };

  const pct = done ? 0 : Math.min(100, (remaining / rest.total) * 100);

  return (
    <div className={`restbar${done ? ' restbar-done' : ''}`} role="timer" aria-live="polite">
      <div className="restbar-track"><div className="restbar-fill" style={{ width: `${pct}%` }} /></div>
      <div className="restbar-row">
        <div className="restbar-text">
          <span className="restbar-time">{done ? 'Go!' : formatClock(remaining)}</span>
          <span className="restbar-label">{done ? 'Rest is over' : `Rest · ${rest.label}`}</span>
        </div>
        {!done && (
          <button type="button" className="restbar-btn" onClick={add30}>+30 s</button>
        )}
        <button type="button" className="restbar-btn" onClick={stop}>{done ? 'Close' : 'Skip'}</button>
      </div>
    </div>
  );
}
