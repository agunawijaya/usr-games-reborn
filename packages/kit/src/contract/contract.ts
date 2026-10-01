import type { PackageDefinition } from '../achievements/packages';
import type { Synth } from '../audio/synth';
import type { SaveSlot, Migration } from '../storage/storage';
import type { Appearance, PaletteId, Settings, StyleId } from '../settings/settings';
import type { ShareInput, ShareOutcome } from '../share/share';
import type { ThemeTokens } from '../tokens/themes';

/**
 * The contract between the Hall and a native game. A game module exports `mount`, `demo` and
 * `achievements`; the Hall hands `mount` a context with everything the game may touch.
 * Games never reach into the Hall or into each other; this file is the whole surface.
 */

export type Outcome = 'win' | 'loss' | 'draw' | 'complete' | 'quit';

/** A milestone inside a session; the Hall clamps and caps these (see progression rules). */
export interface XpEvent {
  id: string;
  xp: number;
}

export interface GameResult {
  outcome: Outcome;
  score?: number;
  /** Counters for stats and cron goals, e.g. `{ planesLanded: 12 }`. */
  stats?: Record<string, number>;
  xpEvents?: XpEvent[];
  /** True when this session was the daily challenge. */
  daily?: boolean;
  durationSeconds?: number;
  /** `game` when the game draws its own results screen; `hall` asks the Hall to show one. */
  presentation: 'hall' | 'game';
}

export interface RankChange {
  from: string;
  to: string;
}

/** What the Hall tells the game after a result, so its own results screen can show it. */
export interface ResultReceipt {
  xpGained: number;
  packagesInstalled: string[];
  rankChange: RankChange | null;
  cronJobsCompleted: string[];
}

export interface PauseMenuItem {
  id: string;
  label: string;
  /** Shown next to the label, e.g. `R`. */
  shortcut?: string;
  run(): void;
}

export interface AppearanceState {
  appearance: Appearance;
  /** The Hall style the player chose. */
  style: StyleId;
  /** The palette painting the Hall: a Machine Room palette or a style's signature palette. */
  theme: PaletteId;
  tokens: ThemeTokens;
  /** The game's manifest accent, adjusted to be legible on this theme. */
  accent: string;
  reducedMotion: boolean;
}

export interface GameContext {
  gameId: string;
  settings(): Settings;
  appearance(): AppearanceState;
  /** Fires on theme, appearance, palette or motion changes; returns an unsubscribe function. */
  onAppearanceChange(listener: (state: AppearanceState) => void): () => void;
  onSettingsChange(listener: (settings: Settings) => void): () => void;
  audio: Synth;
  /** A versioned save slot scoped to this game. */
  save<T>(options: {
    key: string;
    version: number;
    defaults: () => T;
    migrations?: Record<number, Migration>;
  }): SaveSlot<T>;
  daily: { number(): number; seed(): string; dateKey(): string };
  reportResult(result: GameResult): ResultReceipt;
  /** Installs one of this game's packages mid-session; no-op if already installed. */
  installPackage(id: string): boolean;
  share(input: ShareInput | string): Promise<ShareOutcome>;
  /** Items shown between Resume and How to play in the Hall's pause menu. */
  pauseMenuItems(items: PauseMenuItem[]): void;
  onPause(listener: () => void): () => void;
  onResume(listener: () => void): () => void;
  /** Lets the Hall know the game is on its own title screen, where Escape leaves. */
  setOnTitleScreen(onTitle: boolean): void;
  openSettings(): void;
  /** Asks the player to confirm, then removes this game's saves. */
  forgetData(): Promise<boolean>;
  navigate(to: 'game-menu' | 'hall'): void;
}

export interface GameInstance {
  /** Called when the player leaves; release loops, listeners and audio. */
  unmount(): void;
  /**
   * Optional: start a fresh round straight from the Hall's results screen, skipping the title
   * screen. Without it, Play again remounts the game.
   */
  playAgain?(): void;
}

/** A silent, self-running preview for the Hall's attract mode. */
export interface DemoHandle {
  element: HTMLElement;
  setAppearance(state: AppearanceState): void;
  /** The Hall pauses demos that scroll off-screen or lose hover. */
  setVisible(visible: boolean): void;
  destroy(): void;
}

export interface PosterOptions {
  seed: string;
  appearance: Appearance;
  /** Size in CSS pixels; the canvas is already sized for the device pixel ratio. */
  width: number;
  height: number;
  /** Animate until stopped; otherwise draw one frame and return. */
  animate: boolean;
}

export interface PosterHandle {
  stop(): void;
}

export interface GameModule {
  mount(host: HTMLElement, context: GameContext): GameInstance | Promise<GameInstance>;
  demo(seed: string, appearance: AppearanceState): DemoHandle;
  /**
   * Key art for Console Home and Holo Collection, drawn by the game's own renderer: a poster
   * frame, animated when asked. Optional; the Hall falls back to `demo`, then to a procedural
   * poster made from the emblem and accent.
   */
  poster?(canvas: HTMLCanvasElement, options: PosterOptions): PosterHandle | void;
  achievements: readonly PackageDefinition[];
}
