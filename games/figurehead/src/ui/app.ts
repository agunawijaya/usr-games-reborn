import type {
  AppearanceState,
  GameContext,
  GameResult,
  PauseMenuItem,
  ResultReceipt,
} from '@usr-games/kit';
import { Sounds } from '../audio/sounds';
import { type Mode, openSaves, type Saves } from '../game/saves';
import type { Look } from '../render/palette';
import type { ChapterOutcome } from '../voyage/life';
import type { Battle } from '../engine';
import { h } from './dom';

/**
 * The game's shell: one root element, one screen at a time, and the bridges to the Hall
 * (appearance, pause, saves, results, packages). Screens never talk to the Hall directly.
 */

export interface Screen {
  readonly element: HTMLElement;
  /** True on the game menu, where Escape takes the player back to the Hall. */
  readonly onTitle?: boolean;
  readonly pauseItems?: readonly PauseMenuItem[];
  /** Returns true when the key was used. */
  onKey?(event: KeyboardEvent): boolean;
  onLook?(look: Look, reducedMotion: boolean): void;
  onPause?(): void;
  onResume?(): void;
  focus?(): void;
  destroy?(): void;
}

export interface Ending {
  mode: Mode;
  outcome: ChapterOutcome;
  battle: Battle;
  durationSeconds: number;
}

export interface Navigator {
  title(): void;
  launch(): void;
  voyage(): void;
  briefing(mode: Mode): void;
  battle(mode: Mode, resume?: boolean): void;
  aftermath(ending: Ending): void;
  dockyard(): void;
  epilogue(): void;
  log(): void;
  daily(): void;
  open(): void;
  help(): void;
}

export type ScreenFactory = (app: App) => Screen;

export function lookOf(state: Pick<AppearanceState, 'appearance'>): Look {
  return state.appearance === 'dark' ? 'night' : 'day';
}

export class App {
  readonly root: HTMLElement;
  readonly saves: Saves;
  readonly sounds: Sounds;
  look: Look;
  reducedMotion: boolean;
  /** Screens register themselves here (see index.ts) so modules do not import in circles. */
  go!: Navigator;
  private screen: Screen | null = null;
  private stops: (() => void)[] = [];
  private paused = false;

  constructor(
    readonly host: HTMLElement,
    readonly context: GameContext,
  ) {
    const appearance = context.appearance();
    this.look = lookOf(appearance);
    this.reducedMotion = appearance.reducedMotion;
    this.saves = openSaves(context);
    this.sounds = new Sounds(context.audio);
    this.root = h('div', { class: 'fh-root', dataset: { look: this.look, testid: 'fh-root' } });
    this.applyMotion();
    host.append(this.root);
    const onKey = (event: KeyboardEvent) => this.onKey(event);
    window.addEventListener('keydown', onKey);
    this.stops.push(
      () => window.removeEventListener('keydown', onKey),
      context.onAppearanceChange((state) => this.onAppearance(state)),
      context.onPause(() => {
        this.paused = true;
        this.screen?.onPause?.();
      }),
      context.onResume(() => {
        this.paused = false;
        this.screen?.onResume?.();
      }),
    );
  }

  get isPaused(): boolean {
    return this.paused;
  }

  show(factory: ScreenFactory): void {
    this.screen?.destroy?.();
    this.root.replaceChildren();
    const screen = factory(this);
    this.screen = screen;
    this.root.append(screen.element);
    this.context.setOnTitleScreen(screen.onTitle === true);
    this.context.pauseMenuItems([...(screen.pauseItems ?? [])]);
    requestAnimationFrame(() => {
      if (this.screen === screen) screen.focus?.();
    });
  }

  refreshPauseItems(): void {
    this.context.pauseMenuItems([...(this.screen?.pauseItems ?? [])]);
  }

  install(id: string): void {
    this.context.installPackage(id);
  }

  report(result: Omit<GameResult, 'presentation'>): ResultReceipt {
    return this.context.reportResult({ ...result, presentation: 'game' });
  }

  private applyMotion(): void {
    this.root.dataset.motion = this.reducedMotion ? 'reduce' : 'full';
  }

  private onAppearance(state: AppearanceState): void {
    this.look = lookOf(state);
    this.reducedMotion = state.reducedMotion;
    this.root.dataset.look = this.look;
    this.applyMotion();
    this.screen?.onLook?.(this.look, this.reducedMotion);
  }

  private onKey(event: KeyboardEvent): void {
    if (this.paused || event.defaultPrevented) return;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    )
      return;
    if (this.screen?.onKey?.(event)) event.preventDefault();
  }

  destroy(): void {
    this.screen?.destroy?.();
    this.screen = null;
    for (const stop of this.stops) stop();
    this.root.remove();
  }
}
