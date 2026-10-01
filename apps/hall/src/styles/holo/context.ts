import type { Appearance } from '@usr-games/kit';
import type { CatalogEntry } from '../../catalog/catalog';
import { type MountedPoster, mountPoster } from '../../core/art/art';
import type { ThemeState } from '../../core/palette';
import type { Route, Router } from '../../router';
import type { HallSnapshot, HallStore } from '../../store/hall-store';
import type { AlbumSort } from './model';
import type { TiltController } from './tilt';

/** Screenshot scenes pin every poster to this moment. */
export const FROZEN_POSTER_TIME = 2.6;

export type Popover = 'quests' | 'look' | null;

/** Small interface state the shell keeps across re-renders. */
export interface HoloUiState {
  albumSort: AlbumSort;
  popover: Popover;
}

/** Keeps every poster a screen mounts, so the screen can release them all at once. */
export interface PosterBag {
  mount(host: HTMLElement, entry: CatalogEntry, options?: { className?: string }): MountedPoster;
  destroy(): void;
}

export function createPosterBag(options: {
  appearance: Appearance;
  reducedMotion: boolean;
  frozen: boolean;
}): PosterBag {
  const mounted: MountedPoster[] = [];
  return {
    mount(host, entry, extra = {}) {
      const poster = mountPoster(host, entry, {
        appearance: options.appearance,
        animate: false,
        reducedMotion: options.reducedMotion,
        ...(options.frozen ? { frozenAt: FROZEN_POSTER_TIME } : {}),
        className: extra.className ?? 'hc-poster',
      });
      mounted.push(poster);
      return poster;
    },
    destroy() {
      for (const poster of mounted.splice(0)) poster.destroy();
    },
  };
}

export interface HoloContext {
  store: HallStore;
  router: Router;
  route: Route;
  snapshot: HallSnapshot;
  theme: ThemeState;
  frozen: boolean;
  /** False for the style picker's still preview: no listeners, no animation. */
  interactive: boolean;
  posters: PosterBag;
  tilt: TiltController;
  ui: HoloUiState;
  /**
   * Asks the shell to re-render after a change that lives only in the interface state: just the
   * header (a popover opening) or the whole screen (the album sort).
   */
  refresh(scope?: 'header' | 'screen'): void;
}

export interface HoloScreen {
  element: HTMLElement;
  title: string;
  destroy?(): void;
  /**
   * Screens that follow the store themselves (the settings panel, the closet's live canvas)
   * answer 'keep', so a change does not rebuild them under the player's pointer or focus.
   * Without this hook every change rebuilds the screen.
   */
  onStateChange?(next: HallSnapshot, previous: HallSnapshot): 'keep' | 'rebuild';
}
