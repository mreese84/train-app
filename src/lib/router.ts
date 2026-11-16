/**
 * Tiny hash router (#/path?query). Hash URLs work on GitHub Pages without
 * server rewrites and inside the installed home-screen app.
 */
import { useEffect, useState } from 'react';

export type Route = { path: string; parts: string[]; query: URLSearchParams };

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const url = `#${path}`;
  if (opts.replace) {
    history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = path;
  }
  window.scrollTo(0, 0);
}

export const LAST_ROUTE_KEY = 'train:lastRoute';

export function rememberRoute(path: string) {
  try {
    localStorage.setItem(LAST_ROUTE_KEY, path);
  } catch {
    /* storage unavailable: resume just won't happen */
  }
}

export function lastRoute(): string | null {
  try {
    return localStorage.getItem(LAST_ROUTE_KEY);
  } catch {
    return null;
  }
}
