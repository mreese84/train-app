/** Settings: plan start date, backup export/import, storage status, reset. */
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { DEFAULT_PLAN_START, getWeek, weekLabel } from '../plan';
import { formatLong, formatShort, todayISO } from '../lib/dates';
import { exportAll, importAll, resetAll, saveSettings, setMeta, useSettings, validateBackup } from '../lib/store';

export function SettingsScreen() {
  const { planStart } = useSettings();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ name: string; data: Parameters<typeof importAll>[0] } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastBackup = useLiveQuery(() => db.meta.get('lastBackupAt'), []);
  const counts = useLiveQuery(async () => ({ sessions: await db.sessions.count(), sets: await db.sets.count(), cardio: await db.cardio.count() }), []);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const doExport = async () => {
    const backup = await exportAll();
    const name = `train-backup-${todayISO()}.json`;
    const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    try {
      // iOS: the share sheet lets you save to Files, AirDrop or mail it.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Train backup' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      await setMeta('lastBackupAt', Date.now());
      setMsg(`Exported ${name}.`);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMsg(`Export failed: ${(e as Error).message}`);
    }
  };

  const onPickFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!validateBackup(data)) throw new Error('This file is not a Train backup.');
      setPendingImport({ name: f.name, data });
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const week = getWeek(planStart, todayISO());

  return (
    <main className="page with-tabbar">
      <h1>Settings</h1>

      {msg && <p className="weeknote" role="status">{msg}</p>}

      <section className="card stack">
        <h2>Plan</h2>
        <div>
          <label className="label" htmlFor="start">Plan start date (week 1)</label>
          <input
            id="start"
            type="date"
            className="text-input"
            value={planStart}
            onChange={(e) => e.target.value && saveSettings({ planStart: e.target.value })}
          />
        </div>
        <p className="muted small">
          Weeks run Monday to Sunday; week 1 is the week containing {formatShort(planStart)}.
          {' '}{week.beforeStart ? 'The plan has not started yet.' : `Today: ${weekLabel(week)}.`}
        </p>
        {planStart !== DEFAULT_PLAN_START && (
          <button type="button" className="btn btn-block" onClick={() => saveSettings({ planStart: DEFAULT_PLAN_START })}>Reset to {formatShort(DEFAULT_PLAN_START)}</button>
        )}
      </section>

      <section className="card stack">
        <h2>Backup</h2>
        <p className="muted small">
          Your data lives only on this phone. Export a backup now and then and keep it in Files or iCloud Drive.
          {' '}{lastBackup ? `Last export: ${formatLong(todayISO(new Date(lastBackup.value as number)))}.` : 'No export yet.'}
        </p>
        <button type="button" className="btn btn-primary btn-block" onClick={doExport}>Export data (JSON)</button>
        <button type="button" className="btn btn-block" onClick={() => fileRef.current?.click()}>Import from JSON…</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={(e) => onPickFile(e.target.files?.[0])} />
        {pendingImport && (
          <div className="card confirm-box stack">
            <p>Replace all current data with <b>{pendingImport.name}</b>? ({pendingImport.data.data.sessions.length} sessions, {pendingImport.data.data.cardio.length} cardio entries)</p>
            <div className="row">
              <button type="button" className="btn btn-danger grow" onClick={async () => { await importAll(pendingImport.data); setPendingImport(null); setMsg('Import complete.'); }}>Replace</button>
              <button type="button" className="btn grow" onClick={() => setPendingImport(null)}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      <section className="card stack">
        <h2>Storage</h2>
        <dl className="kv">
          <dt>Sessions</dt><dd>{counts?.sessions ?? '…'}</dd>
          <dt>Sets</dt><dd>{counts?.sets ?? '…'}</dd>
          <dt>Cardio</dt><dd>{counts?.cardio ?? '…'}</dd>
          <dt>Protected</dt>
          <dd>{persisted === null ? 'Unknown' : persisted ? 'Yes (persistent storage)' : 'Not guaranteed. Add to Home Screen and export backups.'}</dd>
        </dl>
      </section>

      <section className="card stack">
        <h2>Reset</h2>
        {confirmReset ? (
          <div className="stack confirm-box card">
            <p><b>Delete everything?</b> All sessions, sets, cardio, notes and settings will be erased from this phone. This can't be undone. Export first if unsure.</p>
            <div className="row">
              <button type="button" className="btn btn-danger grow" onClick={async () => { await resetAll(); setConfirmReset(false); setMsg('All data deleted.'); }}>Delete all</button>
              <button type="button" className="btn grow" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirmReset(true)}>Reset all data…</button>
        )}
      </section>

      <p className="muted small" style={{ textAlign: 'center' }}>Train v{__APP_VERSION__} · works offline · data stays on this device</p>
    </main>
  );
}
