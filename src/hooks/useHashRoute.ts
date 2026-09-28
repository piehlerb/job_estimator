import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_ROUTE, formatRoute, parseRoute, type Route } from '../lib/routes';

/**
 * Each history entry the app creates records its depth, so "back" inside the
 * app can tell whether the previous entry is one of ours (safe to go back to)
 * or a page outside the app / nothing at all.
 */
function historyDepth(): number {
  const state = window.history.state as { appDepth?: unknown } | null;
  return typeof state?.appDepth === 'number' ? state.appDepth : 0;
}

function currentRoute(): Route {
  return parseRoute(window.location.hash) ?? DEFAULT_ROUTE;
}

/**
 * Give an empty or unknown app hash a canonical URL. Hashes that aren't app
 * routes at all (e.g. auth callback fragments) are left alone.
 */
function canonicalizeUrl() {
  const hash = window.location.hash;
  if (hash === '' || hash === '#' || (hash.startsWith('#/') && !parseRoute(hash))) {
    window.history.replaceState({ appDepth: historyDepth() }, '', formatRoute(currentRoute()));
  }
}

/**
 * The current screen, kept in the URL hash (see lib/routes.ts). navigate()
 * pushes a history entry, or replaces the current one with `replace`.
 */
export function useHashRoute() {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    canonicalizeUrl();

    // Back/forward buttons and manually edited URLs
    const sync = () => {
      canonicalizeUrl();
      setRoute(currentRoute());
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  const navigate = useCallback((next: Route, options?: { replace?: boolean }) => {
    const hash = formatRoute(next);
    if (hash === window.location.hash) return;
    if (options?.replace) {
      window.history.replaceState({ appDepth: historyDepth() }, '', hash);
    } else {
      window.history.pushState({ appDepth: historyDepth() + 1 }, '', hash);
    }
    // pushState/replaceState don't fire hashchange, so update directly
    setRoute(currentRoute());
  }, []);

  /** True when the previous history entry is a screen of this app */
  const canGoBack = useCallback(() => historyDepth() > 0, []);

  return { route, navigate, canGoBack };
}
