import { useEffect, useRef, useState } from 'react';
import { todayISO } from './dates';

/** Today's date; refreshes when the app comes back to the foreground. */
export function useToday(): string {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const on = () => setToday(todayISO());
    document.addEventListener('visibilitychange', on);
    window.addEventListener('focus', on);
    const id = setInterval(on, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', on);
      window.removeEventListener('focus', on);
      clearInterval(id);
    };
  }, []);
  return today;
}

/** Current time, re-rendering every `ms`. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/**
 * Text field state that saves after typing pauses (and on unmount), so notes
 * are stored without a Save button.
 */
export function useAutosave(initial: string, save: (v: string) => void, delay = 500) {
  const [value, setValue] = useState(initial);
  const latest = useRef({ value: initial, saved: initial, save });
  latest.current.save = save;
  latest.current.value = value;

  useEffect(() => {
    if (value === latest.current.saved) return;
    const id = setTimeout(() => {
      latest.current.saved = value;
      latest.current.save(value);
    }, delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  useEffect(() => {
    const ref = latest.current;
    return () => {
      if (ref.value !== ref.saved) ref.save(ref.value);
    };
  }, []);

  return [value, setValue] as const;
}
