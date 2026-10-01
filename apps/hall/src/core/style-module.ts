import type { Appearance, StyleId, ThemeId } from '@usr-games/kit';
import type { Router } from '../router';
import type { HallStore } from '../store/hall-store';

/**
 * A Hall style: a complete way of presenting the collection over the shared data layer. The
 * host loads the chosen style lazily, starts it on the page root, and destroys it before
 * starting another. Styles never talk to each other; everything they share lives in core/,
 * the store, the router and the kit.
 */
export interface StyleDeps {
  store: HallStore;
  router: Router;
  /** Screenshot scenes pin clocks and animations so frames are reproducible. */
  frozen: boolean;
}

export interface StyleInstance {
  destroy(): void;
}

export interface PreviewOptions {
  store: HallStore;
  appearance: Appearance;
  /** The Machine Room palette to show; other styles have one signature palette. */
  theme?: ThemeId;
}

export interface StyleModule {
  id: StyleId;
  start(root: HTMLElement, deps: StyleDeps): StyleInstance;
  /**
   * Draws this style's real Home, still and non-interactive, into `frame` at desktop size;
   * the style picker scales the frame down. Returns a cleanup function.
   */
  preview(frame: HTMLElement, options: PreviewOptions): () => void;
}

/** Plain names and one-line pitches, shared by the style picker and Settings. */
export const STYLE_COPY: Record<StyleId, { name: string; pitch: string }> = {
  console: {
    name: 'Console Home',
    pitch: 'Big living art for every game, one row to browse, one button to play.',
  },
  holo: {
    name: 'Holo Collection',
    pitch: 'Every game and achievement as a holographic card to collect.',
  },
  'machine-room': {
    name: 'Machine Room',
    pitch: 'A Unix machine at night, humming. For those who like a prompt.',
  },
};
