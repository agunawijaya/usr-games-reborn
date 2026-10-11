import type { Deal } from '../../engine/deal';
import { foundBy, type HunterFind, HUNTERS, planHunt } from '../../engine/hunter';
import {
  type FoundWord,
  newRound,
  type RoundState,
  submitPath,
  submitTyped,
  type Verdict,
} from '../../engine/round';
import { comboTimeLeft, multiplierFor, wordScore } from '../../engine/score';
import { modeLabel, type RoundPlan, ruleLine } from '../../game/modes';
import { packagesForFind, type RoundOutcome } from '../../game/records';
import type { Palette } from '../../render/palette';
import type { App, Screen, ScreenFactory } from '../app';
import { BoardInput, chainLetters, type ChainView } from '../board-input';
import { h, text } from '../dom';
import { PlayView } from '../play-view';
import { confirmDialog } from '../confirm';
import { Coach } from './coach';
import { revealScreen } from './reveal';

/**
 * One round: deal the board, shake the cubes in, run the clock, judge every word, and hand the
 * finished round to the reveal. The engine decides; this screen only shows and plays.
 */

type Phase = 'dealing' | 'shaking' | 'playing' | 'over';

export interface PassTurn {
  /** 0 for the first player, 1 for the second. */
  turn: 0 | 1;
  deal?: Deal;
  first?: RoundOutcome;
}

const FEEDBACK_SECONDS = 1.6;
const LONG_WORD = 7;

export function playScreen(plan: RoundPlan, pass?: PassTurn): ScreenFactory {
  return (app) => new PlayScreen(app, plan, pass);
}

class PlayScreen implements Screen {
  readonly element: HTMLElement;
  pauseItems = [
    { id: 'new-board', label: 'New board', run: () => void this.askNewBoard() },
    { id: 'show-board', label: 'Reveal the board now', run: () => this.finish() },
  ];
  private readonly view: PlayView;
  private readonly input: BoardInput;
  private readonly claimButton: HTMLButtonElement;
  private readonly feedback: HTMLElement;
  private readonly hunterCard: HTMLElement | null = null;
  private readonly finishButton: HTMLButtonElement | null = null;
  private readonly coach: Coach | null = null;
  private phase: Phase = 'dealing';
  private deal: Deal | null = null;
  private state: RoundState | null = null;
  private elapsed = 0;
  private lastFrame = 0;
  private frame = 0;
  private paused = false;
  private bestChain = 1;
  private hunt: HunterFind[] = [];
  private hunterShown = 0;
  private lastTick = -1;
  private feedbackUntil = 0;
  private destroyed = false;
  /** Packages already handed to the Hall this round, so a find never asks twice. */
  private readonly installed = new Set<string>();

  constructor(
    private readonly app: App,
    private readonly plan: RoundPlan,
    private readonly pass?: PassTurn,
  ) {
    this.view = new PlayView(app.board, app.palette, app.reducedMotion);
    this.view.rule.update(this.headline(), ruleLine(plan));
    this.claimButton = h(
      'button',
      {
        class: 'chl-claim',
        type: 'button',
        'data-testid': 'chl-claim',
        onclick: () => this.input.claim(),
      },
      'Claim',
      h('kbd', {}, 'Enter'),
    );
    this.feedback = h('p', { class: 'chl-feedback', role: 'status', 'aria-live': 'polite' });
    this.view.current.element.append(this.claimButton);
    this.view.current.element.after(this.feedback);
    const slot = this.view.element.querySelector<HTMLElement>('.chl-play__board')!;
    this.input = new BoardInput(app.board, slot, app.root, {
      change: (view) => this.showChain(view),
      step: (index) => app.sounds.letter(index),
      claimPath: (cells) => this.judge((state, at) => submitPath(state, cells, at)),
      claimTyped: (typed, shown) => this.judge((state, at) => submitTyped(state, typed, at, shown)),
    });
    this.view.element.append(this.input.layer);
    const hud = this.view.element.querySelector<HTMLElement>('.chl-play__hud')!;
    if (plan.mode === 'duel') {
      this.hunterCard = h('section', {
        class: 'chl-hunter chl-card',
        'aria-label': 'The hunter',
        'data-testid': 'chl-hunter',
      });
      hud.insertBefore(this.hunterCard, this.view.best.element);
    }
    if (plan.seconds === null) {
      this.finishButton = h(
        'button',
        { class: 'chl-button chl-finish', type: 'button', onclick: () => this.finish() },
        'Finish the board',
      );
      hud.insertBefore(this.finishButton, this.view.best.element);
    }
    if (plan.mode === 'tutorial') {
      const side = this.view.element.querySelector<HTMLElement>('.chl-play__side')!;
      this.coach = new Coach(app, side);
    }
    this.element = this.view.element;
    this.element.dataset.testid = 'chl-play';
    this.view.onPlaced = () => this.input.layout();
    this.view.wall.set([]);
    this.view.best.update(null, 0, 0);
    this.updateHud();
    this.loop = this.loop.bind(this);
    void this.start();
  }

  private headline(): string {
    if (this.pass) {
      const players = this.plan.players ?? ['Player 1', 'Player 2'];
      return `${modeLabel(this.plan)} · ${players[this.pass.turn]}`;
    }
    return modeLabel(this.plan);
  }

  private async start() {
    const plan = this.plan;
    const deal =
      this.pass?.deal ??
      (plan.mode === 'daily'
        ? await this.app.solver.daily(plan.seed)
        : await this.app.solver.deal({
            size: plan.size,
            rule: plan.rule,
            seed: plan.seed,
            minLetters: plan.minLetters,
          }));
    if (this.destroyed) return;
    this.deal = deal;
    this.state = newRound(
      { size: plan.size, rule: plan.rule, minLetters: plan.minLetters, seconds: plan.seconds },
      deal.roll.board,
      deal.words,
    );
    this.app.board.setRoll(deal.roll, seedNumber(plan.seed), true);
    this.app.board.setDimmed(0.14);
    this.input.setBoard(deal.roll.board, plan.rule);
    this.view.placeBoard();
    if (plan.mode === 'duel' && plan.seconds !== null) {
      this.hunt = planHunt(deal.words, plan.strength ?? 3, plan.seconds, plan.seed);
    }
    this.phase = 'shaking';
    this.updateHud();
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame(this.loop);
  }

  private loop(now: number) {
    if (this.destroyed) return;
    // A long gap means the tab slept; it never eats into the round.
    const dt = Math.min(0.25, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (this.phase === 'shaking' && this.app.board.tumbleRemaining() <= 0) this.begin();
    if (this.phase === 'playing' && !this.paused && !(this.coach?.holdsClock ?? false)) {
      this.elapsed += dt;
      this.tickDown();
      this.revealHunter();
      if (this.plan.seconds !== null && this.elapsed >= this.plan.seconds) this.finish();
    }
    if (this.feedbackUntil && now / 1000 > this.feedbackUntil) {
      this.feedbackUntil = 0;
      text(this.feedback, '');
    }
    this.updateHud();
    this.frame = requestAnimationFrame(this.loop);
  }

  private begin() {
    this.phase = 'playing';
    this.input.enable(true);
    this.input.layout();
    this.coach?.start(this.deal!, this.plan);
  }

  private tickDown() {
    if (this.plan.seconds === null) return;
    const left = Math.ceil(this.plan.seconds - this.elapsed);
    if (left <= 5 && left > 0 && left !== this.lastTick) {
      this.lastTick = left;
      this.app.sounds.tick(left === 1);
    }
  }

  private revealHunter() {
    if (this.hunt.length === 0) return;
    const count = foundBy(this.hunt, this.elapsed).length;
    if (count !== this.hunterShown) this.hunterShown = count;
  }

  private showChain(view: ChainView) {
    const board = this.deal?.roll.board;
    if (!board) return;
    const letters = chainLetters(board, view);
    this.app.board.setTrace(view.cells, view.tail);
    const resting = view.cells.length === 0 && view.hints.length === 0;
    this.app.board.setHints(view.hints);
    this.app.board.setGuide(resting ? (this.coach?.hints() ?? null) : null);
    const level = this.state ? this.nextComboLevel() : 0;
    this.view.current.update(
      letters,
      letters.length >= this.plan.minLetters ? wordScore(letters, level) : null,
      view.typed.length > 0,
    );
    this.view.current.element.dataset.stray = String(view.stray);
    this.claimButton.hidden = letters.length === 0;
  }

  /** The chain level the next word would reach, for the points preview. */
  private nextComboLevel(): number {
    const combo = this.state!.combo;
    return comboTimeLeft(combo, this.elapsed) > 0 ? Math.min(3, combo.level + 1) : 0;
  }

  private judge(
    submit: (state: RoundState, at: number) => { state: RoundState; verdict: Verdict },
  ) {
    if (this.phase !== 'playing' || !this.state) return;
    const { state, verdict } = submit(this.state, this.elapsed);
    this.state = state;
    this.publish();
    this.input.clear();
    this.react(verdict);
    this.coach?.onVerdict(verdict, state);
  }

  private react(verdict: Verdict) {
    const board = this.app.board;
    const sounds = this.app.sounds;
    switch (verdict.kind) {
      case 'found': {
        const entry = verdict.entry;
        this.bestChain = Math.max(this.bestChain, multiplierFor(entry.comboLevel));
        if (entry.word.length >= LONG_WORD) board.pop(entry.path);
        else board.flash(entry.path);
        sounds.word(entry.word.length);
        this.addTag(entry);
        const chain = entry.comboLevel > 0 ? ` · ×${multiplierFor(entry.comboLevel)} chain` : '';
        this.say(`${entry.word.toUpperCase()} +${entry.points}${chain}`, 'good');
        for (const id of packagesForFind(entry, this.deal!.roll.board.faces)) {
          if (this.installed.has(id)) continue;
          this.installed.add(id);
          this.app.context.installPackage(id);
        }
        this.noteRareFind(entry);
        break;
      }
      case 'again':
        board.again(verdict.path);
        sounds.again();
        this.pulseTag(verdict.word);
        this.say(`${verdict.word.toUpperCase()} is on your wall already`, 'quiet');
        break;
      case 'not-a-word':
        board.shake(verdict.path);
        sounds.miss();
        this.say(`${verdict.word.toUpperCase()} is not in the dictionary`, 'quiet');
        break;
      case 'too-short':
        sounds.miss();
        this.say(`Words need ${this.plan.minLetters} letters or more`, 'quiet');
        break;
      case 'not-on-board':
        sounds.miss();
        this.say(`${verdict.word.toUpperCase()} cannot be traced on this board`, 'quiet');
        break;
    }
  }

  private say(message: string, tone: 'good' | 'quiet') {
    this.feedback.dataset.tone = tone;
    text(this.feedback, message);
    this.feedbackUntil = performance.now() / 1000 + FEEDBACK_SECONDS;
  }

  /**
   * The found word flies from the word chips into its place on the wall. A copy makes the
   * flight above everything (the wall itself clips), and the tag appears when it lands.
   */
  private addTag(entry: FoundWord) {
    const tag = this.view.wall.add({ word: entry.word, points: entry.points, tier: entry.tier });
    const long = entry.word.length >= LONG_WORD;
    if (long) tag.dataset.stamp = 'true';
    if (this.app.reducedMotion) return;
    const frame = this.element.getBoundingClientRect();
    const from = this.view.current.element.getBoundingClientRect();
    const to = tag.getBoundingClientRect();
    if (to.width === 0) return;
    const flyer = tag.cloneNode(true) as HTMLElement;
    flyer.classList.add('chl-tag--flying');
    flyer.style.left = `${to.left - frame.left}px`;
    flyer.style.top = `${to.top - frame.top}px`;
    this.element.append(flyer);
    tag.style.visibility = 'hidden';
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const flight = flyer.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(1.7) rotate(-6deg)`, opacity: 0.4 },
        {
          transform: `translate(${dx * 0.35}px, ${dy * 0.55}px) scale(1.3) rotate(5deg)`,
          opacity: 1,
          offset: 0.5,
        },
        { transform: 'translate(0, 0) scale(1) rotate(var(--tilt, 0deg))', opacity: 1 },
      ],
      { duration: long ? 760 : 540, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
    flight.onfinish = () => {
      flyer.remove();
      tag.style.visibility = '';
      if (long)
        tag.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], {
          duration: 320,
          easing: 'ease-out',
        });
    };
  }

  private pulseTag(word: string) {
    const tag = [...this.view.wall.list.children].find(
      (child) => child.querySelector('.chl-tag__word')?.textContent === word.toUpperCase(),
    );
    if (!tag || this.app.reducedMotion) return;
    (tag as HTMLElement).animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
      {
        duration: 420,
        iterations: 2,
      },
    );
  }

  /** A word new to the book in the very rare tier gets its own little moment. */
  private noteRareFind(entry: FoundWord) {
    if (entry.tier < 3) return;
    const book = this.app.book();
    if (book.words[entry.word] !== undefined) return;
    this.app.sounds.sparkle();
    this.say(`${entry.word.toUpperCase()}: a very rare word for your book`, 'good');
  }

  /** Keeps the workbench's view of the round current. */
  private publish() {
    this.app.live = { plan: this.plan, deal: this.deal, state: this.state, phase: this.phase };
  }

  private updateHud() {
    const state = this.state;
    this.publish();
    const seconds = this.plan.seconds;
    this.view.clock.update(
      seconds === null ? null : Math.max(0, seconds - this.elapsed),
      seconds,
      this.elapsed,
    );
    if (!state) {
      this.view.cover.update(0, 0, null);
      this.view.score.update(0, 0, 0);
      return;
    }
    const comboLeft = comboTimeLeft(state.combo, this.elapsed);
    this.view.score.update(state.score, state.combo.level, comboLeft);
    const level = this.app.records();
    this.view.cover.update(
      state.found.length,
      state.answers.size,
      level.level.boards >= 3 ? level.level.found / Math.max(1, level.level.total) : null,
    );
    const longest = state.found.reduce<string | null>(
      (best, entry) => (!best || entry.word.length > best.length ? entry.word : best),
      null,
    );
    this.view.best.update(
      longest,
      state.found.filter((entry) => entry.tier === 2).length,
      state.found.filter((entry) => entry.tier === 3).length,
    );
    if (this.hunterCard) this.drawHunter(state);
  }

  private drawHunter(state: RoundState) {
    const profile = HUNTERS[this.plan.strength ?? 3];
    const share = state.answers.size === 0 ? 0 : this.hunterShown / state.answers.size;
    this.hunterCard!.replaceChildren(
      h('h2', { class: 'chl-card__label' }, `Hunter · ${profile.name}`),
      h(
        'p',
        { class: 'chl-hunter__count' },
        `${this.hunterShown} ${this.hunterShown === 1 ? 'word' : 'words'}`,
      ),
      h(
        'span',
        { class: 'chl-hunter__bar', 'aria-hidden': 'true' },
        h('i', { style: `transform:scaleX(${share.toFixed(3)})` }),
      ),
    );
  }

  private finish() {
    if (this.phase === 'over' || !this.state || !this.deal) return;
    this.phase = 'over';
    this.input.enable(false);
    this.app.board.setTrace([]);
    this.app.board.setHints([]);
    this.app.sounds.bell();
    const outcome = this.outcome();
    const deal = this.deal;
    const delay = this.app.reducedMotion ? 200 : 900;
    this.say(
      this.plan.seconds !== null && this.elapsed >= this.plan.seconds ? 'Time!' : 'Board revealed',
      'good',
    );
    window.setTimeout(() => {
      if (this.destroyed) return;
      if (this.pass && this.pass.turn === 0) {
        this.app.show(handoff(this.plan, deal, outcome));
      } else {
        this.app.show(revealScreen(this.plan, deal, outcome, this.pass?.first));
      }
    }, delay);
  }

  private outcome(): RoundOutcome {
    const state = this.state!;
    const bandTotals: [number, number, number] = [0, 0, 0];
    for (const word of state.answers.values())
      bandTotals[word.word.length <= 4 ? 0 : word.word.length <= 6 ? 1 : 2]++;
    const outcome: RoundOutcome = {
      plan: this.plan,
      found: state.found,
      total: state.answers.size,
      score: state.score,
      bestChain: this.bestChain,
      bandTotals,
      elapsed: this.elapsed,
    };
    if (this.plan.mode === 'duel') {
      const finds = foundBy(this.hunt, this.elapsed);
      outcome.hunter = { finds, score: hunterScore(finds), strength: this.plan.strength ?? 3 };
    }
    return outcome;
  }

  private async askNewBoard() {
    const found = this.state?.found.length ?? 0;
    if (found > 0 && this.phase === 'playing') {
      this.paused = true;
      const sure = await confirmDialog(this.element, {
        title: 'Start a new board?',
        body: `The ${found} ${found === 1 ? 'word' : 'words'} on your wall will not count.`,
        confirm: 'New board',
        cancel: 'Keep playing',
      });
      this.paused = false;
      this.lastFrame = performance.now();
      if (!sure || this.destroyed) return;
    }
    this.newBoard();
  }

  private newBoard() {
    const fresh: RoundPlan = { ...this.plan, seed: `${this.plan.seed}+` };
    if (this.plan.mode === 'daily' || this.plan.mode === 'tutorial') {
      this.app.show(playScreen(this.plan, this.pass));
      return;
    }
    this.app.show(playScreen(fresh, this.pass ? { turn: 0 } : undefined));
  }

  onKey(event: KeyboardEvent): boolean {
    if (this.phase !== 'playing') return false;
    return this.input.onKey(event);
  }

  onLook(palette: Palette, reducedMotion: boolean) {
    this.view.setLook(palette, reducedMotion);
  }

  onPause() {
    this.paused = true;
  }

  onResume() {
    this.paused = false;
    this.lastFrame = performance.now();
  }

  /** The board's space takes focus, so typing works at once and no cube shows a ring. */
  focus() {
    this.element.querySelector<HTMLElement>('.chl-play__board')?.focus({ preventScroll: true });
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.input.destroy();
    this.coach?.destroy();
    this.view.destroy();
  }
}

/** The hunter scores like a player: points by length, chained when its finds come quickly. */
export function hunterScore(finds: readonly HunterFind[]): number {
  let level = 0;
  let last: number | null = null;
  let score = 0;
  for (const find of finds) {
    level = last !== null && find.at - last <= 4 ? Math.min(3, level + 1) : 0;
    last = find.at;
    score += wordScore(find.word, level);
  }
  return score;
}

function seedNumber(seed: string): number {
  let value = 0;
  for (const char of seed) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value % 997;
}

/** Between the two turns of Pass and play: the board waits, the first player's words hidden. */
function handoff(plan: RoundPlan, deal: Deal, first: RoundOutcome): ScreenFactory {
  return (app: App) => {
    const players = plan.players ?? ['Player 1', 'Player 2'];
    const go = () => app.show(playScreen(plan, { turn: 1, deal, first }));
    const button = h(
      'button',
      {
        class: 'chl-button chl-button--primary',
        type: 'button',
        'data-testid': 'chl-handoff-go',
        onclick: go,
      },
      `${players[1]}, start`,
      h('kbd', {}, 'Enter'),
    );
    const element = h(
      'div',
      { class: 'chl-screen chl-handoff', 'data-testid': 'chl-handoff' },
      h(
        'section',
        { class: 'chl-handoff__card chl-card' },
        h('h1', {}, `Over to ${players[1]}`),
        h(
          'p',
          {},
          `${players[0]} found ${first.found.length} ${first.found.length === 1 ? 'word' : 'words'}. Same cubes, same clock; ${players[0]}'s words stay hidden until the end.`,
        ),
        button,
      ),
    );
    app.board.setTrace([]);
    return {
      element,
      onKey: (event) => {
        if (event.key !== 'Enter') return false;
        go();
        return true;
      },
      focus: () => button.focus(),
    };
  };
}
