import type { MatchSetup } from '../modes/match';
import { tableFor } from '../modes/match';
import type { Look } from '../render/look';
import { PondView } from '../render/pond-view';
import { Director } from './director';
import { SILENT } from './sound';

/**
 * The Hall's attract mode: the pond playing itself. All three rivals and a careful stand-in in
 * your seat play Standard at a brisk pace, silently; when a game ends another begins. It
 * pauses when the Hall says it is out of sight.
 */
export class DemoPond {
  readonly element: HTMLDivElement;
  private readonly view: PondView;
  private director: Director | null = null;
  private games = 0;
  private visible = true;
  private restartTimer = 0;

  constructor(
    private readonly seed: string,
    private look: Look,
    private reducedMotion: boolean,
  ) {
    this.view = new PondView(look);
    this.element = this.view.element;
  }

  resize(width: number, height: number, dpr: number): void {
    this.view.resize(width, height, dpr);
  }

  setLook(look: Look, reducedMotion: boolean): void {
    this.look = look;
    this.reducedMotion = reducedMotion;
    this.view.setLook(look);
  }

  start(): void {
    if (!this.director) this.newGame();
    else this.director.resume();
  }

  stop(): void {
    this.director?.pause();
    window.clearTimeout(this.restartTimer);
  }

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    if (visible) this.start();
    else this.stop();
  }

  destroy(): void {
    window.clearTimeout(this.restartTimer);
    this.director?.stop();
    this.director = null;
  }

  private newGame(): void {
    this.director?.stop();
    const setup: MatchSetup = {
      kind: 'quick',
      rules: 'standard',
      rivals: ['otto', 'hazel', 'miso'],
      seed: `${this.seed}/demo/${this.games++}`,
    };
    const director = new Director({
      setup,
      table: tableFor(setup, 'miso'),
      view: this.view,
      hud: null,
      root: this.element,
      look: () => this.look,
      reducedMotion: () => this.reducedMotion,
      pace: () => 1.8,
      notebookOpen: false,
      sound: SILENT,
      status: { title: 'Gone Fishing', mode: '' },
      announce: () => {},
      onMoment: () => {},
      onNotebook: () => {},
      onEnd: () => {
        this.restartTimer = window.setTimeout(() => {
          if (this.visible) this.newGame();
        }, 1500);
      },
    });
    this.director = director;
    director.start();
  }
}
