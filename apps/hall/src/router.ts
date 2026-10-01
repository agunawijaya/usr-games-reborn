import { CATEGORIES, type Category } from '@usr-games/kit/manifest';

/**
 * Hash routes, so the site works from any static host (GitHub Pages included) and the browser's
 * Back button walks the player's own path through the room.
 */

export type SortMode = 'recommended' | 'recent' | 'az';
export const SORT_MODES: readonly SortMode[] = ['recommended', 'recent', 'az'];

export type Route =
  | { name: 'home'; dir: Category | null; sort: SortMode }
  | { name: 'man'; id: string }
  | { name: 'run'; id: string }
  | { name: 'profile' }
  | { name: 'settings' }
  | { name: 'about' }
  | { name: 'closet' }
  | { name: 'login' }
  | { name: 'welcome' };

export const HOME: Route = { name: 'home', dir: null, sort: 'recommended' };

function parseSort(query: URLSearchParams): SortMode {
  const sort = query.get('sort');
  return SORT_MODES.includes(sort as SortMode) ? (sort as SortMode) : 'recommended';
}

export function parseRoute(hash: string): Route {
  const [path = '', queryString = ''] = hash.replace(/^#/, '').split('?');
  const query = new URLSearchParams(queryString);
  const parts = path.split('/').filter(Boolean);
  const [first, second] = parts;
  switch (first) {
    case undefined:
      return { name: 'home', dir: null, sort: parseSort(query) };
    case 'games':
      return {
        name: 'home',
        dir: CATEGORIES.includes(second as Category) ? (second as Category) : null,
        sort: parseSort(query),
      };
    // Game pages: the Machine Room calls them man pages, the other styles just game pages.
    case 'man':
    case 'game':
      return second ? { name: 'man', id: second } : HOME;
    case 'run':
      return second ? { name: 'run', id: second } : HOME;
    case 'home':
      return { name: 'profile' };
    case 'settings':
    case 'about':
    case 'closet':
    case 'login':
    case 'welcome':
      return { name: first };
    default:
      return HOME;
  }
}

export function formatRoute(route: Route): string {
  switch (route.name) {
    case 'home': {
      const path = route.dir ? `#/games/${route.dir}` : '#/';
      return route.sort === 'recommended' ? path : `${path}?sort=${route.sort}`;
    }
    case 'man':
      return `#/man/${route.id}`;
    case 'run':
      return `#/run/${route.id}`;
    case 'profile':
      return '#/home';
    default:
      return `#/${route.name}`;
  }
}

export interface Router {
  current(): Route;
  go(route: Route, options?: { replace?: boolean }): void;
  subscribe(listener: (route: Route) => void): () => void;
}

export function createRouter(win: Window = window): Router {
  const listeners = new Set<(route: Route) => void>();
  const current = () => parseRoute(win.location.hash);
  win.addEventListener('hashchange', () => {
    const route = current();
    for (const listener of listeners) listener(route);
  });
  return {
    current,
    go(route, options = {}) {
      const hash = formatRoute(route);
      if (hash === win.location.hash || (hash === '#/' && win.location.hash === '')) return;
      if (options.replace) win.location.replace(hash);
      else win.location.hash = hash;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
