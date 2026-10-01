import type { Route, Router } from '../../../router';
import type { HallSnapshot, HallStore } from '../../../store/hall-store';
import type { ThemeState } from '../../../core/palette';
import type { PreviewManager } from '../ui/previews';

/** What every screen receives from the shell. */
export interface ScreenContext {
  store: HallStore;
  router: Router;
  route: Route;
  snapshot: HallSnapshot;
  theme: ThemeState;
  previews: PreviewManager;
  /** Screenshot scenes pin clocks and animations so frames are reproducible. */
  frozen: boolean;
}

/** A rendered screen plus the prompt it puts in the console header. */
export interface Screen {
  element: HTMLElement;
  /** Accessible page title, also used for document.title. */
  title: string;
  cwd: string;
  command: string;
  /**
   * The screen follows the store itself (the settings panel, the closet's canvas), so a change
   * of state refreshes only the header around it instead of rebuilding it under the player's
   * cursor.
   */
  keepsItself?: boolean;
  destroy?(): void;
}
