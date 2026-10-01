import type { StyleId } from '@usr-games/kit';
import type { HallSnapshot } from '../store/hall-store';
import { HOME, type Route } from '../router';
import type { StyleDeps, StyleInstance, StyleModule } from './style-module';

/**
 * Keeps exactly one thing running on the page root: the player's Hall style, or one of the
 * style-neutral screens that take the whole page (the login, the style picker and the player
 * that runs a game). It loads each on demand and walks a new player through the first visit:
 * login first, then the style picker.
 */

export type StyleLoaders = Record<StyleId, () => Promise<StyleModule>>;

/** A whole-page screen that belongs to no style. */
export type ScreenLoader = () => Promise<Pick<StyleModule, 'start'>>;

export type FullPageScreen = 'login' | 'picker' | 'player';

export interface HostDeps extends StyleDeps {
  loaders: StyleLoaders;
  screens: Record<FullPageScreen, ScreenLoader>;
}

type MountKey = StyleId | FullPageScreen;

/** Where a first visit must go before anything else, or null once it is done. */
export function firstVisitStep(snapshot: HallSnapshot, route: Route): Route | null {
  const signedIn = snapshot.profile.username !== null || snapshot.profile.guest;
  if (!signedIn) return route.name === 'login' ? null : { name: 'login' };
  if (!snapshot.profile.styleChosen && route.name !== 'welcome') return { name: 'welcome' };
  // The login is for the first visit only (and after Forget my data); a signed-in player who
  // lands on it, from an old bookmark or the Back button, goes on to Home.
  if (route.name === 'login') return HOME;
  return null;
}

export function mountKeyFor(route: Route, style: StyleId): MountKey {
  if (route.name === 'login') return 'login';
  if (route.name === 'welcome') return 'picker';
  if (route.name === 'run') return 'player';
  return style;
}

export function startStyleHost(root: HTMLElement, deps: HostDeps): void {
  const { store, router } = deps;
  let mounted: { key: MountKey; instance: StyleInstance } | null = null;
  let generation = 0;

  async function sync() {
    const route = router.current();
    const snapshot = store.snapshot();
    const detour = firstVisitStep(snapshot, route);
    if (detour) {
      router.go(detour, { replace: true });
      return;
    }
    const key = mountKeyFor(route, snapshot.settings.style);
    if (mounted?.key === key) return;
    const ticket = ++generation;
    const module =
      key === 'login' || key === 'picker' || key === 'player'
        ? await deps.screens[key]()
        : await deps.loaders[key]();
    // A newer change arrived while this one was loading; let that one win.
    if (ticket !== generation) return;
    mounted?.instance.destroy();
    document.documentElement.dataset.style = key;
    mounted = { key, instance: module.start(root, deps) };
  }

  router.subscribe(() => void sync());
  store.subscribe((_, change) => {
    if (change === 'settings' || change === 'profile' || change === 'reset') void sync();
  });
  void sync();
}
