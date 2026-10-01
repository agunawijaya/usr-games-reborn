import type { ThemeState } from '../../core/palette';
import type { Router } from '../../router';
import type { HallSnapshot, HallStore } from '../../store/hall-store';

/** Everything a Console Home screen needs, handed down by the shell on every render. */
export interface ConsoleContext {
  store: HallStore;
  router: Router;
  snapshot: HallSnapshot;
  theme: ThemeState;
  /** Screenshot scenes pin the hero art to this moment. */
  frozenAt: number | undefined;
  /** False in the style picker's still preview: nothing listens, nothing opens. */
  interactive: boolean;
  /** Where sheets and menus mount, above the screen. */
  overlays: HTMLElement;
}

/** Game pages live at #/game/<id> in the plain-word styles. */
export function goTo(hash: string): void {
  window.location.hash = hash;
}
