import type {
  AppearanceState,
  GameContext,
  GameResult,
  PauseMenuItem,
  ResultReceipt,
} from '@usr-games/kit';
import { Sounds } from '../audio/sounds';
import type { PackageId } from '../game/packages';
import { openSaves, type Saves } from '../game/saves';
import { AtomWorld } from '../render/atom/atom-world';
import type { Layout, LayoutKind } from '../render/layout';
import type { Look, ThemeId } from '../render/look';
import { SprintWorld } from '../render/sprint/sprint-world';
import { Stage } from '../render/stage';
import type { World, WorldCue, WorldScene } from '../render/world';
import { h } from './dom';
import type { Nav } from './flow';

/**
 * The game's shell: the theme's world on a canvas, one screen at a time over it, and the bridges
 * to the Hall (appearance, pause, saves, results, packages). Screens never talk to the Hall
 * directly, and never hold the world: the player can change theme under any screen.
 */
export interface Screen {
  readonly element: HTMLElement;
  /** Which layout the world and the interface share. */
  readonly layout: LayoutKind;
  /** True on the game menu, where Escape takes the player back to the Hall. */
  readonly onTitle?: boolean;
  readonly pauseItems?: readonly PauseMenuItem[];
  /** Returns true when the key was used. */
  onKey?(event: KeyboardEvent): boolean;
  onLayout?(layout: Layout): void;
  onPause?(): void;
  onResume?(): void;
  focus?(): void;
  destroy?(): void;
}

export type ScreenFactory = (app: App) => Screen;

export function makeWorld(look: Look, reducedMotion: boolean, scale: number): World {
  return look.theme === 'atom'
    ? new AtomWorld(look, reducedMotion, scale)
    : new SprintWorld(look, reducedMotion, scale);
}

export class App {
  readonly root: HTMLElement;
  readonly layer: HTMLElement;
  readonly saves: Saves;
  readonly sounds: Sounds;
  readonly stage: Stage;
  look: Look;
  reducedMotion: boolean;
  /** Screens register here (see index.ts) so modules never import each other in circles. */
  go!: Nav;
  private screen: Screen | null = null;
  private scene: WorldScene = { kind: 'quiet' };
  private readonly stops: (() => void)[] = [];
  private paused = false;

  constructor(
    readonly host: HTMLElement,
    readonly context: GameContext,
  ) {
    const appearance = context.appearance();
    this.saves = openSaves(context);
    const theme = this.saves.prefs.load().theme ?? 'sprint';
    this.look = { theme, dark: appearance.appearance === 'dark' };
    this.reducedMotion = appearance.reducedMotion;
    this.sounds = new Sounds(context.audio);
    this.sounds.theme = theme;
    this.root = h('div', { class: 'ns', 'data-testid': 'ns-root' });
    this.layer = h('div', { class: 'ns-layer' });
    host.append(this.root);
    const scale = Math.min(2, window.devicePixelRatio || 1);
    this.stage = new Stage(this.root, makeWorld(this.look, this.reducedMotion, scale), scale);
    this.root.append(this.layer);
    this.applyLook();
    this.stage.start();

    const onKey = (event: KeyboardEvent) => this.onKey(event);
    const onVisibility = () => this.stage.setVisible(!document.hidden && !this.paused);
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    this.stops.push(
      () => window.removeEventListener('keydown', onKey),
      () => document.removeEventListener('visibilitychange', onVisibility),
      this.stage.onLayout((layout) => {
        this.root.style.setProperty('--s', String(layout.s));
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
    this.root.style.setProperty('--s', String(this.stage.layout.s));
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get layout(): Layout {
    return this.stage.layout;
  }

  /** Seconds on the world's clock. */
  now(): number {
    return this.stage.now();
  }

  show(factory: ScreenFactory) {
    this.screen?.destroy?.();
    this.layer.replaceChildren();
    const screen = factory(this);
    this.screen = screen;
    this.stage.setKind(screen.layout);
    this.root.style.setProperty('--s', String(this.stage.layout.s));
    this.layer.append(screen.element);
    this.context.setOnTitleScreen(screen.onTitle === true);
    this.context.pauseMenuItems([...(screen.pauseItems ?? [])]);
    screen.onLayout?.(this.stage.layout);
    requestAnimationFrame(() => {
      if (this.screen === screen) {
        screen.onLayout?.(this.stage.layout);
        screen.focus?.();
      }
    });
  }

  /** Re-sends the pause items after a screen changed them. */
  refreshPauseItems() {
    this.context.pauseMenuItems([...(this.screen?.pauseItems ?? [])]);
  }

  /** What the world shows; kept here so a theme change can show it again. */
  setScene(scene: WorldScene) {
    this.scene = scene;
    this.stage.current.show(scene, this.now());
  }

  cue(cue: WorldCue) {
    this.stage.current.cue(cue, this.now());
  }

  /** The player picked the other theme: a new world, the same screen. */
  setTheme(theme: ThemeId) {
    this.saves.prefs.update((prefs) => ({ ...prefs, theme }));
    if (theme === this.look.theme) return;
    this.look = { ...this.look, theme };
    this.sounds.theme = theme;
    this.stage.setWorld(makeWorld(this.look, this.reducedMotion, this.stage.pixelRatio));
    this.stage.current.show(this.scene, this.now());
    this.applyLook();
  }

  install(earned: readonly PackageId[]) {
    for (const id of new Set(earned)) this.context.installPackage(id);
  }

  report(result: Omit<GameResult, 'presentation'>): ResultReceipt {
    return this.context.reportResult({ ...result, presentation: 'game' });
  }

  private applyLook() {
    this.root.dataset.theme = this.look.theme;
    this.root.dataset.look = this.look.dark ? 'night' : 'day';
    this.root.dataset.motion = this.reducedMotion ? 'reduce' : 'full';
  }

  private onAppearance(state: AppearanceState) {
    this.look = { ...this.look, dark: state.appearance === 'dark' };
    this.reducedMotion = state.reducedMotion;
    this.applyLook();
    this.stage.setLook(this.look, this.reducedMotion);
  }

  private onKey(event: KeyboardEvent) {
    if (this.paused || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
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
