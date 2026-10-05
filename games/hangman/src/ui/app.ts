import type {
  AppearanceState,
  GameContext,
  GameResult,
  PauseMenuItem,
  ResultReceipt,
} from '@usr-games/kit';
import { Sounds } from '../audio/sounds';
import type { PackageId } from '../game/packages';
import type { Records } from '../game/records';
import { openSaves, type Saves } from '../game/saves';
import type { BeachLayout } from '../render/layout';
import type { Look } from '../render/palette';
import { h } from './dom';
import { BeachStage } from './stage';

/**
 * The game's shell: the living beach, one screen at a time over it, and the bridges to the
 * Hall (appearance, pause, saves, results, packages). Screens never talk to the Hall directly.
 */
export interface Screen {
  readonly element: HTMLElement;
  /** True on the game menu, where Escape takes the player back to the Hall. */
  readonly onTitle?: boolean;
  readonly pauseItems?: readonly PauseMenuItem[];
  /** Returns true when the key was used. */
  onKey?(event: KeyboardEvent): boolean;
  onLayout?(layout: BeachLayout): void;
  onLook?(look: Look, reducedMotion: boolean): void;
  onPause?(): void;
  onResume?(): void;
  focus?(): void;
  destroy?(): void;
}

export interface Navigator {
  title(): void;
  tutorial(): void;
  beach(): void;
  chooseDeck(): void;
  daily(): void;
  classic(): void;
  run(): void;
  duel(): void;
  records(): void;
  help(): void;
  settings(): void;
}

export type ScreenFactory = (app: App) => Screen;

export function lookOf(state: Pick<AppearanceState, 'appearance'>): Look {
  return state.appearance === 'dark' ? 'moonlit' : 'midday';
}

export class App {
  readonly root: HTMLElement;
  readonly layer: HTMLElement;
  readonly saves: Saves;
  readonly sounds: Sounds;
  readonly stage: BeachStage;
  look: Look;
  reducedMotion: boolean;
  /** Screens register themselves here (see index.ts) so modules do not import in circles. */
  go!: Navigator;
  private screen: Screen | null = null;
  private readonly stops: Array<() => void> = [];
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
    this.root = h('div', { class: 'bt', 'data-look': this.look, 'data-testid': 'bt-root' });
    this.layer = h('div', { class: 'bt-overlay' });
    this.root.append(this.layer);
    host.append(this.root);
    this.stage = new BeachStage(this.root, this.look, this.reducedMotion, this.sounds);
    this.applyLook();
    this.stage.start();

    const onKey = (event: KeyboardEvent) => this.onKey(event);
    const onVisibility = () => this.stage.setVisible(!document.hidden && !this.paused);
    const observer = new ResizeObserver(() => this.stage.relayout());
    observer.observe(this.root);
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    this.stops.push(
      () => window.removeEventListener('keydown', onKey),
      () => document.removeEventListener('visibilitychange', onVisibility),
      () => observer.disconnect(),
      this.stage.onLayout((layout) => {
        this.root.style.setProperty('--s', String(layout.scale));
        this.screen?.onLayout?.(layout);
      }),
      context.onAppearanceChange((state) => this.onAppearance(state)),
      context.onPause(() => {
        this.paused = true;
        this.stage.setVisible(false);
        this.screen?.onPause?.();
      }),
      context.onResume(() => {
        this.paused = false;
        this.stage.setVisible(!document.hidden);
        this.screen?.onResume?.();
      }),
    );
    this.root.style.setProperty('--s', String(this.stage.layout.scale));
  }

  get isPaused(): boolean {
    return this.paused;
  }

  show(factory: ScreenFactory) {
    this.screen?.destroy?.();
    this.layer.replaceChildren();
    const screen = factory(this);
    this.screen = screen;
    this.layer.append(screen.element);
    this.context.setOnTitleScreen(screen.onTitle === true);
    this.context.pauseMenuItems([...(screen.pauseItems ?? [])]);
    screen.onLayout?.(this.stage.layout);
    requestAnimationFrame(() => {
      if (this.screen === screen) screen.focus?.();
    });
  }

  /** Re-sends the pause items after a screen changed them. */
  refreshPauseItems() {
    this.context.pauseMenuItems([...(this.screen?.pauseItems ?? [])]);
  }

  /** Saves new records and installs whatever they earned. */
  keep(records: Records, earned: readonly PackageId[]) {
    this.saves.records.save(records);
    for (const id of earned) this.context.installPackage(id);
  }

  report(result: Omit<GameResult, 'presentation'>): ResultReceipt {
    return this.context.reportResult({ ...result, presentation: 'game' });
  }

  private applyLook() {
    this.root.dataset.look = this.look;
    this.root.dataset.motion = this.reducedMotion ? 'reduce' : 'full';
  }

  private onAppearance(state: AppearanceState) {
    this.look = lookOf(state);
    this.reducedMotion = state.reducedMotion;
    this.applyLook();
    this.stage.setLook(this.look, this.reducedMotion);
    this.screen?.onLook?.(this.look, this.reducedMotion);
  }

  private onKey(event: KeyboardEvent) {
    if (this.paused || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return;
    }
    if (this.screen?.onKey?.(event)) event.preventDefault();
  }

  destroy() {
    this.screen?.destroy?.();
    this.screen = null;
    for (const stop of this.stops) stop();
    this.stage.destroy();
    this.root.remove();
  }
}
