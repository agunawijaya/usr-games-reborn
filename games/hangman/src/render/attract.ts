import { createRng, type Rng } from '@usr-games/kit';
import { ALL_DECKS } from '../decks/decks';
import { guess, newRound, revealed, type Round } from '../engine/round';
import { BY_FREQUENCY } from '../engine/letters';
import { fitsPattern } from '../bots/solver';
import { BeachView } from './beach-view';
import { WASH_ORDER } from './castle-model';
import { BeachDirector } from './director';
import { beachLayout, type BeachLayout } from './layout';
import { type Look, paletteFor } from './palette';
import { paintSandWord } from './sand-word';

/**
 * The Hall's attract mode: the beach playing itself. A model player guesses a word in the sand
 * letter by letter (fairly well, but not perfectly), the castle gains windows and loses
 * sections, and a new word follows. Silent, and asleep while off-screen.
 */
const SECONDS_PER_GUESS = 1.3;
const SECONDS_BETWEEN_WORDS = 3.5;

export class AttractLoop {
  private readonly view = new BeachView(1);
  private readonly director: BeachDirector;
  private layout: BeachLayout;
  private readonly rng: Rng;
  private readonly vocabulary: string[];
  private round: Round;
  private clock = 0;
  private nextAt = 1.2;
  private last: number | null = null;
  private frame = 0;
  private visible = true;

  constructor(
    readonly element: HTMLElement,
    private look: Look,
    reducedMotion: boolean,
    seed: number,
  ) {
    this.rng = createRng(seed);
    this.vocabulary = ALL_DECKS.flatMap((deck) => deck.words);
    this.round = this.newWord();
    this.layout = this.measure();
    this.director = new BeachDirector(reducedMotion, this.layout);
    this.director.settle(0, 0);
    element.append(this.view.element);
    this.frame = requestAnimationFrame((now) => this.tick(now));
  }

  private newWord(): Round {
    const pool = this.vocabulary.filter((word) => word.length >= 5 && word.length <= 9);
    return newRound(pool[this.rng.int(0, pool.length - 1)]!);
  }

  private measure(): BeachLayout {
    const width = Math.max(200, this.element.clientWidth);
    const height = Math.max(120, this.element.clientHeight);
    return beachLayout(width, height, this.round.word.length, { compact: true });
  }

  resize() {
    this.layout = this.measure();
    this.director.setLayout(this.layout);
  }

  setLook(look: Look, reducedMotion: boolean) {
    this.look = look;
    this.director.reducedMotion = reducedMotion;
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.last = null;
  }

  /** Mostly the best letter for the words that still fit; now and then a hopeful guess. */
  private chooseLetter(): string {
    const round = this.round;
    const fits = this.vocabulary.filter((word) => fitsPattern(word, round));
    const untried = BY_FREQUENCY.filter((letter) => !round.tried.includes(letter));
    if (this.rng.chance(0.3)) return untried[this.rng.int(0, Math.min(8, untried.length - 1))]!;
    let best = untried[0]!;
    let bestCount = -1;
    for (const letter of untried) {
      const count = fits.filter((word) => word.includes(letter)).length;
      if (count > bestCount) {
        best = letter;
        bestCount = count;
      }
    }
    return best;
  }

  private step() {
    if (this.round.status !== 'playing') {
      this.round = this.newWord();
      this.layout = this.measure();
      this.director.setLayout(this.layout);
      this.director.rebuild(this.clock);
      this.nextAt = this.clock + 1.5;
      return;
    }
    const outcome = guess(this.round, this.chooseLetter());
    if (outcome.kind !== 'hit' && outcome.kind !== 'miss') return;
    this.round = outcome.round;
    if (outcome.kind === 'hit') {
      const found = new Set(this.round.tried.filter((l) => this.round.word.includes(l))).size;
      this.director.carve(found - 1, this.clock);
    } else if (this.round.status === 'lost') {
      this.director.lose(7, this.clock);
    } else {
      this.director.wave(WASH_ORDER[this.round.waves - 1]!, this.round.waves, this.clock);
    }
    if (this.round.status === 'won') this.director.win(this.clock);
    this.nextAt =
      this.clock + (this.round.status === 'playing' ? SECONDS_PER_GUESS : SECONDS_BETWEEN_WORDS);
  }

  private tick(now: number) {
    if (this.visible) {
      if (this.last !== null) this.clock += Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (this.clock >= this.nextAt) this.step();
      const palette = paletteFor(this.look);
      const letters = revealed(this.round);
      const shown = this.round.status === 'lost' ? [...this.round.word] : letters;
      this.view.render(
        this.layout,
        palette,
        this.director.frame(this.clock, { wordPatch: false, gauge: false, wavesAllowed: 7 }),
        (ctx) => paintSandWord(ctx, this.layout, palette, shown),
      );
    }
    this.frame = requestAnimationFrame((time) => this.tick(time));
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.view.destroy();
  }
}
