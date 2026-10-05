import type { Sounds } from '../audio/sounds';
import { BeachView } from '../render/beach-view';
import { type BeachExtras, BeachDirector } from '../render/director';
import { beachLayout, type BeachLayout, type LayoutOptions } from '../render/layout';
import { type Look, paletteFor } from '../render/palette';

/**
 * The living beach behind every screen: one water canvas, one castle canvas and one director,
 * kept for the whole visit so moving between screens never rebuilds them. The stage runs its
 * own clock, which stops while the Hall pauses the game or the tab is hidden, so moments
 * resume exactly where they were.
 */
const BREATH_SECONDS = 7;

export class BeachStage {
  readonly view = new BeachView();
  readonly director: BeachDirector;
  layout: BeachLayout;
  private look: Look;
  private wordLength = 10;
  private options: LayoutOptions = {};
  private extras: BeachExtras = { wordPatch: false, gauge: false, wavesAllowed: 7 };
  private frameId = 0;
  private clock = 0;
  private last: number | null = null;
  private running = false;
  private visible = true;
  private nextBreath = 2.6;
  private nextGull = 9;
  private readonly listeners = new Set<(layout: BeachLayout) => void>();

  constructor(
    private readonly host: HTMLElement,
    look: Look,
    reducedMotion: boolean,
    private readonly sounds: Sounds | null,
  ) {
    this.look = look;
    this.layout = this.measure();
    this.director = new BeachDirector(reducedMotion, this.layout);
    host.prepend(this.view.element);
  }

  /** Seconds on the stage clock: the time every beach event is stamped with. */
  get now(): number {
    return this.clock;
  }

  private measure(): BeachLayout {
    const width = Math.max(320, this.host.clientWidth);
    const height = Math.max(240, this.host.clientHeight);
    return beachLayout(width, height, this.wordLength, this.options);
  }

  /** Re-lays the beach for a new word length or screen; tells the interface where things are. */
  relayout(wordLength = this.wordLength, options = this.options) {
    this.wordLength = wordLength;
    this.options = options;
    this.layout = this.measure();
    this.director.setLayout(this.layout);
    for (const listener of this.listeners) listener(this.layout);
    this.draw();
  }

  onLayout(listener: (layout: BeachLayout) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setExtras(extras: Partial<BeachExtras>) {
    this.extras = { ...this.extras, ...extras };
  }

  setLook(look: Look, reducedMotion: boolean) {
    this.look = look;
    this.director.reducedMotion = reducedMotion;
    this.draw();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = null;
    const tick = (now: number) => {
      if (!this.running) return;
      if (this.last !== null && this.visible) this.advance(Math.min(0.1, (now - this.last) / 1000));
      this.last = now;
      if (this.visible) this.draw();
      this.frameId = requestAnimationFrame(tick);
    };
    this.frameId = requestAnimationFrame(tick);
  }

  private advance(seconds: number) {
    this.clock += seconds;
    if (!this.sounds || this.director.reducedMotion) return;
    // The surf breaks once per breath of the sea, as the shader's breaker reaches the shore.
    if (this.clock >= this.nextBreath) {
      this.sounds.surf();
      this.nextBreath += BREATH_SECONDS;
    }
    if (this.look === 'midday' && this.clock >= this.nextGull) {
      this.sounds.gull();
      this.nextGull += 17 + (Math.sin(this.clock) + 1) * 9;
    }
  }

  /** Stops time and drawing (the Hall's pause, a hidden tab); resumes where it left off. */
  setVisible(visible: boolean) {
    this.visible = visible;
    this.last = null;
  }

  draw() {
    this.view.render(
      this.layout,
      paletteFor(this.look),
      this.director.frame(this.clock, this.extras),
    );
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.view.destroy();
  }
}
