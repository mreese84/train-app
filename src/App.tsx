/**
 * App shell: hash routes, bottom tab bar, rest timer, and "resume where I
 * left off" when the app is reopened mid-workout.
 */
import { useEffect, useState } from 'react';
import { db } from './db';
import { RestTimerProvider } from './components/RestTimer';
import { ClockIcon, GearIcon, HomeIcon } from './components/Icons';
import { lastRoute, navigate, rememberRoute, useRoute } from './lib/router';
import { Today } from './screens/Today';
import { SessionOverview } from './screens/SessionOverview';
import { ExerciseScreen } from './screens/ExerciseScreen';
import { CardioLog } from './screens/CardioLog';
import { History } from './screens/History';
import { SessionDetail } from './screens/SessionDetail';
import { ExerciseHistory } from './screens/ExerciseHistory';
import { SettingsScreen } from './screens/Settings';

export function App() {
  const route = useRoute();
  const [booted, setBooted] = useState(false);

  // On launch at the home route, jump back into an unfinished session.
  useEffect(() => {
    (async () => {
      const atHome = route.parts.length === 0;
      const last = lastRoute();
      const m = last && /^\/session\/([^/?]+)/.exec(last);
      if (atHome && m) {
        const s = await db.sessions.get(m[1]).catch(() => undefined);
        if (s && s.finishedAt === null) navigate(last!, { replace: true });
      }
      setBooted(true);
    })();
    // Run once at startup only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (booted) rememberRoute(route.path + (route.query.toString() ? `?${route.query}` : ''));
  }, [booted, route]);

  const [p0, p1, p2, p3] = route.parts;
  let screen: React.ReactNode;
  let tab: 'today' | 'history' | 'settings' | null = null;

  if (!booted) screen = null;
  else if (p0 === 'session' && p1 && p2 === 'ex' && p3 !== undefined) screen = <ExerciseScreen key={`${p1}-${p3}`} sessionId={p1} index={Number(p3)} />;
  else if (p0 === 'session' && p1) screen = <SessionOverview key={p1} sessionId={p1} />;
  else if (p0 === 'cardio') screen = <CardioLog key={p1 ?? route.query.toString()} cardioId={p1} date={route.query.get('date') ?? undefined} />;
  else if (p0 === 'history' && p1 === 'session' && p2) { screen = <SessionDetail sessionId={p2} />; tab = 'history'; }
  else if (p0 === 'history' && p1 === 'exercise' && p2) { screen = <ExerciseHistory exerciseId={p2} />; tab = 'history'; }
  else if (p0 === 'history') { screen = <History view={p1 === 'exercises' ? 'exercises' : 'sessions'} />; tab = 'history'; }
  else if (p0 === 'settings') { screen = <SettingsScreen />; tab = 'settings'; }
  else { screen = <Today />; tab = 'today'; }

  useEffect(() => {
    document.body.classList.toggle('has-tabbar', tab !== null);
  }, [tab]);

  return (
    <RestTimerProvider>
      <div className="app">{screen}</div>
      {tab && <TabBar active={tab} />}
    </RestTimerProvider>
  );
}

function TabBar({ active }: { active: 'today' | 'history' | 'settings' }) {
  const tabs = [
    { id: 'today', label: 'Today', path: '/', Icon: HomeIcon },
    { id: 'history', label: 'History', path: '/history', Icon: ClockIcon },
    { id: 'settings', label: 'Settings', path: '/settings', Icon: GearIcon },
  ] as const;
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-inner">
        {tabs.map(({ id, label, path, Icon }) => (
          <button key={id} type="button" className={`tab${active === id ? ' active' : ''}`} aria-current={active === id ? 'page' : undefined} onClick={() => navigate(path)}>
            <Icon />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
