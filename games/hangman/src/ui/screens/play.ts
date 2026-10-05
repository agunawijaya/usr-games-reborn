import type { PauseMenuItem, ResultReceipt } from '@usr-games/kit';
import { deckById, noteFor } from '../../decks/decks';
import { dailyShareLine } from '../../engine/daily';
import { duelLeader, duelTotals } from '../../engine/duel';
import { revealed, type Round } from '../../engine/round';
import { average, averageWithWordInPlay, formatAverage } from '../../engine/score';
import { CASTLE_SECTIONS, RUN_LENGTH } from '../../engine/tide-run';
import {
  type Mode,
  recordBeach,
  recordDaily,
  recordDuel,
  recordRun,
  recordWord,
} from '../../game/records';
import type { TierChoice } from '../../game/saves';
import { Session, type WordResult } from '../../game/session';
import { WASH_ORDER } from '../../render/castle-model';
import type { BeachLayout } from '../../render/layout';
import type { App, Screen, ScreenFactory } from '../app';
import { h } from '../dom';
import {
  gaugeLabel,
  keyboard,
  type KeyState,
  lighthouseButton,
  scorePanel,
  type ScoreView,
  type SlotState,
  wordRow,
} from '../hud';

/**
 * The play screen for every mode. The session holds the rules; this screen turns each key into
 * a moment on the beach (a chime and a carved window, or a wave and a fallen section), shows
 * the word in the sand and the shells, and handles what comes between words: the word's card,
 * a Duel's privacy screens, and the results at the end.
 */
export interface PlaySpec {
  mode: Mode;
  deckId?: string;
  tier?: TierChoice;
  duel?: { names: [string, string]; turnsEach: number };
}

type View = 'playing' | 'moment' | 'card' | 'secret' | 'results';

const TITLE = 'Before the Tide';

export function playScreen(spec: PlaySpec): ScreenFactory {
  return (app) => new PlayScreen(app, spec);
}

class PlayScreen implements Screen {
  readonly element = h('div', { class: 'bt-play', 'data-testid': 'bt-play' });
  private readonly session: Session;
  private view: View = 'playing';
  private fresh = new Set<number>();
  private status = '';
  private statusTimer = 0;
  private momentTimer = 0;
  private layout: BeachLayout;
  private reported = false;
  private receipt: ResultReceipt | null = null;
  private dailyFirst = false;
  /** Castle sections already gone when the word in play began (only a Tide run carries any). */
  private lostAtStart = 0;
  private readonly name: string;

  constructor(
    private readonly app: App,
    private readonly spec: PlaySpec,
  ) {
    const prefs = app.saves.prefs.load();
    const records = app.saves.records.load();
    this.session = new Session({
      mode: spec.mode,
      deckId: spec.deckId ?? (spec.mode === 'run' ? 'core' : prefs.deck),
      tier: spec.tier ?? 'any',
      seed: `${spec.mode}:${app.context.daily.dateKey()}:${Date.now() % 1_000_000}`,
      dailyNumber: app.context.daily.number(),
      recent: records.recent,
      duel: spec.duel,
    });
    this.name = modeName(spec.mode);
    this.layout = app.stage.layout;
    app.stage.setExtras({ wordPatch: true, gauge: true, wavesAllowed: CASTLE_SECTIONS });
    app.stage.relayout(this.session.round.word.length, {});
    app.stage.director.rebuild(app.stage.now);
    exposeTestHook(this);
    if (this.session.phase === 'secret') this.showSecret();
    else this.render();
  }

  get pauseItems(): PauseMenuItem[] {
    if (
      (this.session.mode === 'beach' || this.session.mode === 'classic') &&
      this.session.words.length > 0
    ) {
      return [
        {
          id: 'home',
          label: 'Head home and see your beach',
          shortcut: '',
          run: () => this.headHome(),
        },
      ];
    }
    return [];
  }

  // ——— input ———

  onKey(event: KeyboardEvent): boolean {
    if (this.view === 'results') {
      if (event.code === 'KeyR') return this.click('[data-choice="again"]');
      if (event.code === 'KeyH') return this.click('[data-choice="hall"]');
      return false;
    }
    if (this.view === 'card' || this.view === 'moment') {
      if (event.key === 'Enter') {
        if (this.view === 'moment') this.showCardNow();
        else this.click('[data-choice="next"]');
        return true;
      }
      return false;
    }
    if (this.view !== 'playing') return false;
    if (event.key === '?' || event.key === '/') {
      this.useLighthouse();
      return true;
    }
    if (event.key.length === 1) {
      this.guess(event.key);
      return true;
    }
    return false;
  }

  private click(selector: string): boolean {
    const button = this.element.querySelector<HTMLButtonElement>(selector);
    if (!button) return false;
    button.click();
    return true;
  }

  guess(input: string) {
    if (this.view !== 'playing') return;
    const outcome = this.session.guess(input);
    const time = this.app.stage.now;
    switch (outcome.kind) {
      case 'not-a-letter':
        this.say(`${input === ' ' ? 'A space' : `“${input}”`} is not a letter. No wave.`);
        this.app.sounds.tap();
        return;
      case 'repeat':
        this.say(`${outcome.letter.toUpperCase()} is in the sand already. No wave.`);
        this.app.sounds.tap();
        return;
      case 'over':
        return;
      case 'hit': {
        this.fresh = new Set(outcome.positions);
        const found = distinctFound(outcome.round);
        this.app.sounds.chime(found);
        this.app.stage.director.carve(found - 1, time);
        this.say(
          `${outcome.letter.toUpperCase()}: ${outcome.positions.length === 1 ? 'one' : outcome.positions.length} in the word.`,
        );
        break;
      }
      case 'miss':
        this.fresh = new Set();
        this.say(`No ${outcome.letter.toUpperCase()}. A wave comes in.`);
        this.waveFor(outcome.round, time);
        break;
    }
    this.afterMove();
  }

  useLighthouse() {
    if (this.view !== 'playing' || !this.session.lighthouseAllowed) return;
    const outcome = this.session.lighthouse();
    if (!outcome) {
      this.say('The Lighthouse rests: one more wave would bring the castle down.');
      this.app.sounds.tap();
      return;
    }
    const time = this.app.stage.now;
    this.fresh = new Set(outcome.positions);
    this.app.sounds.lighthouse();
    this.app.stage.director.shine(time);
    this.app.stage.director.carve(distinctFound(outcome.round) - 1, time);
    this.say(`The Lighthouse shows ${outcome.letter.toUpperCase()}, and a wave comes in for it.`);
    this.waveFor(outcome.round, time);
    this.afterMove();
  }

  /** Sends the wave for the round's newest wave, or the tide if that was the last one. */
  private waveFor(after: Round, time: number) {
    if (after.status === 'lost') return;
    const lost = this.lostAtStart + after.waves;
    const section = WASH_ORDER[Math.min(WASH_ORDER.length - 1, lost - 1)]!;
    this.app.sounds.whoosh();
    this.app.stage.director.wave(section, lost, time);
  }

  private afterMove() {
    const round = this.session.round;
    if (round.status === 'playing') {
      this.render();
      return;
    }
    this.wordEnded();
  }

  // ——— the end of a word ———

  private wordEnded() {
    const result = this.session.words[this.session.words.length - 1]!;
    const time = this.app.stage.now;
    let pause: number;
    if (result.won) {
      this.app.sounds.win();
      this.app.stage.director.win(time);
      pause = this.app.reducedMotion ? 600 : 1800;
      this.say(winLine(result));
    } else {
      this.app.sounds.lose();
      const allSections = CASTLE_SECTIONS;
      const lasts = this.app.stage.director.lose(allSections, time);
      pause = (lasts + 0.6) * 1000;
      this.say('The tide takes the castle.');
      // The retreating water writes the word in the sand.
      window.setTimeout(
        () => {
          if (this.view === 'moment') this.renderWord(true);
        },
        Math.max(0, (lasts - 0.6) * 1000),
      );
    }
    this.keepWord(result);
    this.view = 'moment';
    this.renderWord(false);
    this.renderKeys();
    this.renderScore();
    this.element.querySelector('.bt-lighthouse')?.remove();
    this.element.querySelector('.bt-gauge')?.remove();
    const lostNow = result.won ? this.wavesShown() : CASTLE_SECTIONS;
    this.element.append(gaugeLabel(lostNow, CASTLE_SECTIONS, this.layout));
    window.clearTimeout(this.momentTimer);
    this.momentTimer = window.setTimeout(() => this.showCardNow(), pause);
  }

  private keepWord(result: WordResult) {
    const records = this.app.saves.records.load();
    const update = recordWord(records, {
      mode: this.session.mode,
      deckId: result.deckId,
      word: result.word,
      won: result.won,
      waves: result.waves,
      wavesAllowed: result.wavesAllowed,
      lighthouseUses: result.lighthouseUses,
      score: result.score,
    });
    this.app.keep(update.records, update.earned);
    this.app.refreshPauseItems();
  }

  private showCardNow() {
    window.clearTimeout(this.momentTimer);
    if (this.view !== 'moment') return;
    if (this.session.phase === 'over') this.showResults();
    else this.showWordCard();
  }

  /** Between words: what the word was, how it went, and the way on. */
  private showWordCard() {
    this.view = 'card';
    const result = this.session.words[this.session.words.length - 1]!;
    const run = this.session.run;
    // A clean word in a Tide run mends the section the tide took last.
    const repaired = run !== null && result.won && result.waves === 0 && this.lostAtStart > 0;
    if (repaired) {
      const section = WASH_ORDER[this.lostAtStart - 1]!;
      this.app.stage.director.repair(section, this.lostAtStart - 1, this.app.stage.now);
      this.app.sounds.repair();
    }
    const note = noteFor(deckById(result.deckId === 'duel' ? 'core' : result.deckId), result.word);
    const lines: (HTMLElement | null)[] = [
      h(
        'p',
        { class: 'bt-card__headline' },
        result.won ? winLine(result) : 'The tide took this one.',
      ),
      h(
        'p',
        { class: 'bt-card__word' },
        h('strong', {}, result.word.toUpperCase()),
        ` · ${result.won ? `${result.waves} ${result.waves === 1 ? 'wave' : 'waves'}` : 'scores 9'}`,
      ),
      note ? h('p', { class: 'bt-card__note' }, note) : null,
      repaired
        ? h('p', { class: 'bt-card__note' }, 'Not a wave: the castle mends a section.')
        : null,
    ];
    if (this.session.duel) lines.push(this.duelScoreboard());
    const next = this.session.duel
      ? 'Next turn'
      : run
        ? `Word ${run.index + 1} of ${RUN_LENGTH}`
        : 'Next word';
    const buttons = h(
      'div',
      { class: 'bt-card__actions' },
      h(
        'button',
        {
          class: 'bt-button bt-button--primary',
          type: 'button',
          'data-choice': 'next',
          onclick: () => this.nextWord(),
        },
        next,
        h('kbd', { class: 'bt-kbd' }, 'Enter'),
      ),
      this.session.mode === 'beach' || this.session.mode === 'classic'
        ? h(
            'button',
            {
              class: 'bt-button',
              type: 'button',
              'data-choice': 'home',
              onclick: () => this.headHome(),
            },
            'Head home',
          )
        : null,
    );
    this.showCard(
      h(
        'section',
        { class: 'bt-card bt-card--between', 'aria-label': 'Word over', 'data-testid': 'bt-card' },
        h('div', { class: 'bt-card__text' }, ...lines),
        buttons,
      ),
    );
  }

  private nextWord() {
    if (this.view !== 'card') return;
    this.session.next();
    this.fresh = new Set();
    this.status = '';
    if (this.session.phase === 'secret') {
      this.showSecret();
      return;
    }
    this.startWord();
  }

  private startWord() {
    this.view = 'playing';
    const run = this.session.run;
    this.lostAtStart = run ? CASTLE_SECTIONS - run.standing : 0;
    this.app.stage.relayout(this.session.round.word.length);
    this.app.stage.director.rebuild(this.app.stage.now, this.lostAtStart);
    this.render();
    this.focus();
  }

  private headHome() {
    if (this.session.words.length === 0) {
      this.app.go.title();
      return;
    }
    window.clearTimeout(this.momentTimer);
    this.session.finish();
    this.showResults();
  }

  // ——— a Duel's privacy screens ———

  private showSecret() {
    this.view = 'secret';
    const turn = this.session.duelTurn!;
    const names = this.session.duel!.names;
    const setter = names[turn.setter];
    const guesser = names[turn.guesser];
    const cover = h('div', { class: 'bt-privacy', 'data-testid': 'bt-privacy' });
    const handOver = (who: string, look: string, then: () => void, label: string) => {
      cover.replaceChildren(
        h(
          'section',
          { class: 'bt-card bt-card--privacy', 'aria-label': 'Pass the device' },
          h('p', { class: 'bt-card__headline' }, `Pass the device to ${who}.`),
          h('p', { class: 'bt-card__note' }, look),
          h(
            'div',
            { class: 'bt-card__actions' },
            h(
              'button',
              {
                class: 'bt-button bt-button--primary',
                type: 'button',
                'data-choice': 'ready',
                onclick: then,
              },
              label,
            ),
          ),
        ),
      );
      cover.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    };
    const askSecret = () => {
      const input = h('input', {
        class: 'bt-input',
        type: 'password',
        autocomplete: 'off',
        spellcheck: 'false',
        maxlength: 14,
        'aria-label': 'Secret word',
        'data-testid': 'bt-secret',
      });
      const problem = h('p', { class: 'bt-card__problem', role: 'alert' });
      const show = h(
        'button',
        {
          class: 'bt-link',
          type: 'button',
          onclick: () => {
            input.type = input.type === 'password' ? 'text' : 'password';
            show.textContent = input.type === 'password' ? 'Show it' : 'Hide it';
          },
        },
        'Show it',
      );
      const submit = (event: Event) => {
        event.preventDefault();
        const outcome = this.session.setSecret(input.value);
        if (!outcome.ok) {
          problem.textContent = secretProblem(outcome.problem);
          input.focus({ preventScroll: true });
          return;
        }
        handOver(
          guesser,
          `${setter}, look away now: ${guesser} has seven waves to find your word.`,
          () => {
            cover.remove();
            this.startWord();
          },
          `I am ${guesser}. Let me guess`,
        );
      };
      cover.replaceChildren(
        h(
          'form',
          {
            class: 'bt-card bt-card--privacy',
            'aria-label': 'Write a secret word',
            onsubmit: submit,
          },
          h('p', { class: 'bt-card__headline' }, `${setter}, write a word in the sand.`),
          h(
            'p',
            { class: 'bt-card__note' },
            `3 to 14 letters, no spaces. ${guesser} must not see it.`,
          ),
          h('div', { class: 'bt-secret-row' }, input, show),
          problem,
          h(
            'div',
            { class: 'bt-card__actions' },
            h(
              'button',
              { class: 'bt-button bt-button--primary', type: 'submit', 'data-choice': 'hide' },
              'Hide it in the sand',
            ),
          ),
        ),
      );
      input.focus({ preventScroll: true });
    };
    handOver(
      setter,
      `${guesser}, look away while ${setter} writes a word.`,
      askSecret,
      `I am ${setter}. I'm ready`,
    );
    this.element.replaceChildren(cover);
  }

  private duelScoreboard(): HTMLElement {
    const duel = this.session.duel!;
    const totals = duelTotals(duel);
    return h(
      'p',
      { class: 'bt-card__duel' },
      ...duel.names.map((name, i) => h('span', {}, `${name} `, h('strong', {}, String(totals[i])))),
      h('span', { class: 'bt-card__hint' }, 'waves · lower wins'),
    );
  }

  // ——— results ———

  private showResults() {
    this.view = 'results';
    this.finishSession();
    const s = this.session;
    const rows: [string, string][] = [];
    let headline: string;
    let share: HTMLElement | null = null;
    if (s.mode === 'beach' || s.mode === 'classic') {
      const places = s.mode === 'classic' ? 3 : 2;
      rows.push(
        ['Tide average', formatAverage(average(s.tally), places)],
        ['Words', `${s.foundCount} found of ${s.words.length}`],
        ['Without a wave', String(s.cleanCount)],
        ['All time', formatAverage(average(this.app.saves.records.load().lifetime))],
      );
      headline =
        s.mode === 'classic' ? 'The Berkeley beach, closed for today' : 'Home from the beach';
    } else if (s.mode === 'daily') {
      const word = s.words[0]!;
      headline = word.won ? 'The castle stands!' : 'The tide took it';
      rows.push(
        ['Word', word.word.toUpperCase()],
        ['Waves', word.won ? String(word.waves) : 'all seven'],
      );
      const line = dailyShareLine(
        TITLE,
        this.app.context.daily.number(),
        s.round,
        this.app.context.settings().colorBlindPalette,
      );
      share = h(
        'div',
        { class: 'bt-share' },
        h('p', { class: 'bt-share__line', 'data-testid': 'bt-share-line' }, line),
        h(
          'button',
          {
            class: 'bt-button',
            type: 'button',
            'data-choice': 'share',
            onclick: () => void this.app.context.share(line),
          },
          'Share',
        ),
        h(
          'p',
          { class: 'bt-card__note' },
          this.dailyFirst
            ? 'Your Daily Word for today: this one counts.'
            : 'Today’s Daily Word was already played; this one was for fun.',
        ),
      );
    } else if (s.mode === 'run') {
      const run = s.run!;
      headline =
        run.status === 'complete'
          ? 'Ten before the tide!'
          : `The tide won on word ${run.found + 1}`;
      rows.push(
        ['Words found', `${run.found} of ${RUN_LENGTH}`],
        ['Clean words', String(run.cleanWords)],
        ['Repairs', String(run.repairs)],
        ['Best run', String(this.app.saves.records.load().bestRun)],
      );
    } else if (s.mode === 'duel') {
      const duel = s.duel!;
      const leader = duelLeader(duel);
      const totals = duelTotals(duel);
      headline = leader === null ? 'A draw on the sand' : `${duel.names[leader]} wins the duel`;
      rows.push([duel.names[0], `${totals[0]} waves`], [duel.names[1], `${totals[1]} waves`]);
    } else {
      headline = 'You know the beach now';
      rows.push(['Next', 'Try a Beach day or the Daily Word']);
    }
    const xp = this.receipt?.xpGained ?? 0;
    const card = h(
      'section',
      { class: 'bt-card bt-card--results', 'aria-label': 'Results', 'data-testid': 'bt-results' },
      h('p', { class: 'bt-card__eyebrow' }, this.name),
      h('h2', { class: 'bt-card__title' }, headline),
      h(
        'dl',
        { class: 'bt-card__rows' },
        ...rows.flatMap(([term, value]) => [h('dt', {}, term), h('dd', {}, value)]),
      ),
      share,
      xp > 0 ? h('p', { class: 'bt-card__xp' }, `+${xp} XP`) : null,
      h(
        'div',
        { class: 'bt-card__actions' },
        h(
          'button',
          {
            class: 'bt-button bt-button--primary',
            type: 'button',
            'data-choice': 'again',
            onclick: () => this.playAgain(),
          },
          'Play again',
          h('kbd', { class: 'bt-kbd' }, 'R'),
        ),
        h(
          'button',
          {
            class: 'bt-button',
            type: 'button',
            'data-choice': 'menu',
            onclick: () => this.app.go.title(),
          },
          'Game menu',
        ),
        h(
          'button',
          {
            class: 'bt-button',
            type: 'button',
            'data-choice': 'hall',
            onclick: () => this.app.context.navigate('hall'),
          },
          'Back to the Hall',
          h('kbd', { class: 'bt-kbd' }, 'H'),
        ),
      ),
    );
    this.app.refreshPauseItems();
    for (const selector of ['.bt-score', '.bt-gauge', '.bt-status', '.bt-coach']) {
      this.element.querySelector(selector)?.remove();
    }
    this.showCard(h('div', { class: 'bt-results-veil' }, card));
    card.querySelector<HTMLButtonElement>('[data-choice="again"]')?.focus({ preventScroll: true });
  }

  /** Records the session and reports it to the Hall, once. */
  private finishSession() {
    if (this.reported) return;
    this.reported = true;
    const s = this.session;
    let records = this.app.saves.records.load();
    const earn = (update: { records: typeof records; earned: readonly string[] }) => {
      records = update.records;
      this.app.keep(records, update.earned as never);
    };
    if (s.mode === 'tutorial') {
      this.app.saves.prefs.update((prefs) => ({ ...prefs, tutorialDone: true }));
      return;
    }
    if (s.mode === 'beach' || s.mode === 'classic') earn(recordBeach(records, s.tally));
    if (s.mode === 'run') earn(recordRun(records, s.run!.found, s.run!.status === 'complete'));
    if (s.mode === 'duel') earn(recordDuel(records));
    if (s.mode === 'daily') {
      const word = s.words[0]!;
      const update = recordDaily(records, this.app.context.daily.dateKey(), {
        waves: word.won ? word.waves : null,
      });
      this.dailyFirst = update.first;
      earn(update);
    }
    if (s.words.length === 0) return;
    const found = s.foundCount;
    const outcome =
      s.mode === 'daily'
        ? s.words[0]!.won
          ? 'win'
          : 'loss'
        : s.mode === 'run'
          ? s.run!.status === 'complete'
            ? 'win'
            : 'loss'
          : 'complete';
    this.receipt = this.app.report({
      outcome,
      score: found,
      stats: {
        wordsFound: found,
        cleanWords: s.cleanCount,
        wordsPlayed: s.words.length,
      },
      xpEvents: [
        ...(s.cleanCount > 0 ? [{ id: 'clean-words', xp: Math.min(15, s.cleanCount * 3) }] : []),
        ...(s.words.some((w) => w.won && w.word.length >= 10) ? [{ id: 'long-word', xp: 5 }] : []),
      ],
      daily: s.mode === 'daily' && this.dailyFirst,
      durationSeconds: Math.round((Date.now() - s.startedAt) / 1000),
    });
  }

  private playAgain() {
    const go = this.app.go;
    const again: Record<Mode, () => void> = {
      tutorial: go.tutorial,
      beach: () => this.app.show(playScreen(this.spec)),
      daily: go.daily,
      classic: go.classic,
      run: go.run,
      duel: () => this.app.show(playScreen(this.spec)),
    };
    again[this.session.mode]();
  }

  // ——— drawing the interface ———

  private showCard(card: HTMLElement) {
    this.element.querySelector('.bt-keys')?.remove();
    this.element.querySelector('.bt-card, .bt-results-veil')?.remove();
    this.element.append(card);
    this.positionCard();
    card.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }

  private positionCard() {
    const card = this.element.querySelector<HTMLElement>('.bt-card--between');
    if (!card) return;
    const { keyboard: area, height } = this.layout;
    card.style.left = `${area.x + area.width / 2}px`;
    card.style.bottom = `${Math.max(12, height - area.y - area.height)}px`;
    card.style.width = `${Math.max(area.width, 560)}px`;
  }

  private render() {
    this.element.replaceChildren();
    this.renderScore();
    this.renderWord(false);
    this.renderKeys();
    this.element.append(gaugeLabel(this.wavesShown(), CASTLE_SECTIONS, this.layout));
    if (this.session.lighthouseAllowed && this.view === 'playing') {
      const button = lighthouseButton(this.lighthouseOpen(), this.layout, () =>
        this.useLighthouse(),
      );
      button.dataset.testid = 'bt-lighthouse';
      this.element.append(button);
    }
    this.renderStatus();
    if (this.session.mode === 'tutorial') this.renderCoach();
  }

  private lighthouseOpen(): boolean {
    const round = this.session.round;
    return round.status === 'playing' && round.waves + 1 < round.wavesAllowed;
  }

  /** Waves on the gauge: this word's, plus those a Tide run carried in. */
  private wavesShown(): number {
    return this.lostAtStart + this.session.round.waves;
  }

  private renderScore() {
    this.element.querySelector('.bt-score')?.remove();
    this.element.prepend(scorePanel(this.scoreView()));
  }

  private scoreView(): ScoreView {
    const s = this.session;
    const records = this.app.saves.records.load();
    const inPlay = s.phase === 'playing' ? s.round.waves : 0;
    const playing = s.phase === 'playing';
    const wordNumber = s.words.length + (playing ? 1 : 0);
    switch (s.mode) {
      case 'classic':
        return {
          label: 'Current average',
          hint: 'lower is better',
          value: formatAverage(
            playing ? averageWithWordInPlay(s.tally, inPlay) : average(s.tally),
            3,
          ),
          details: [
            ['Overall', formatAverage(average(s.tally), 3)],
            ['Word', String(wordNumber)],
          ],
          context: 'Classic · the 1983 rules',
        };
      case 'daily':
        return {
          label: `Daily Word #${this.app.context.daily.number()}`,
          value: `${s.round.status === 'lost' ? 7 : s.round.waves}`,
          hint: 'waves so far',
          details: [['All time', formatAverage(average(records.lifetime))]],
          context: 'One word for everyone today',
        };
      case 'run': {
        const run = s.run!;
        return {
          label: 'Tide run',
          hint: 'how far before the tide?',
          value: `${run.found} / ${RUN_LENGTH}`,
          details: [
            [
              'Castle',
              `${Math.max(0, CASTLE_SECTIONS - this.wavesShown())} of ${CASTLE_SECTIONS} standing`,
            ],
            ['Best run', String(records.bestRun)],
          ],
          context: `${deckById(s.spec.deckId).title} · word ${Math.min(RUN_LENGTH, run.index + 1)} of ${RUN_LENGTH}`,
        };
      }
      case 'duel': {
        const duel = s.duel!;
        const totals = duelTotals(duel);
        const turn = s.duelTurn;
        const guesser = turn
          ? duel.names[playing ? (turn.setter === 0 ? 1 : 0) : turn.guesser]
          : duel.names[0];
        return {
          label: `${guesser} guesses`,
          hint: 'lower wins',
          value: String(inPlay),
          details: duel.names.map((name, i) => [name, String(totals[i])] as const),
          context: `Duel · turn ${Math.min(duel.turns.length + 1, duel.turnsEach * 2)} of ${duel.turnsEach * 2}`,
        };
      }
      case 'tutorial':
        return {
          label: 'Tide average',
          hint: 'lower is better',
          value: String(inPlay),
          details: [],
          context: 'Tutorial · waves this word',
        };
      default:
        return {
          label: 'Tide average',
          hint: 'lower is better',
          value: formatAverage(playing ? averageWithWordInPlay(s.tally, inPlay) : average(s.tally)),
          details: [
            ['This beach', formatAverage(average(s.tally))],
            ['All time', formatAverage(average(records.lifetime))],
          ],
          context: `Beach day · ${deckById(s.spec.deckId).title} · word ${wordNumber}`,
        };
    }
  }

  /** The word in the sand; at a loss, the sea writes in the letters that were missing. */
  private renderWord(seaWrites: boolean) {
    this.element.querySelector('.bt-word')?.remove();
    const round = this.session.round;
    const shown = revealed(round);
    const letters = shown.map((letter, i) => letter ?? (seaWrites ? round.word[i]! : null));
    const states: SlotState[] = shown.map((letter, i) => {
      if (letter === null) return seaWrites ? 'sea' : 'hidden';
      return this.fresh.has(i) ? 'fresh' : 'found';
    });
    const row = wordRow(letters, states, this.layout);
    row.dataset.testid = 'bt-word';
    const score = this.element.querySelector('.bt-score');
    if (score) score.after(row);
    else this.element.prepend(row);
  }

  private renderKeys() {
    this.element.querySelector('.bt-keys')?.remove();
    if (this.view !== 'playing' && this.view !== 'moment') return;
    const states: Record<string, KeyState> = {};
    for (const letter of this.session.round.tried) {
      states[letter] = this.session.round.word.includes(letter) ? 'right' : 'wrong';
    }
    const keys = keyboard(states, this.layout, (letter) => this.guess(letter));
    keys.dataset.testid = 'bt-keys';
    this.element.querySelector('.bt-word')?.after(keys);
  }

  private say(text: string) {
    this.status = text;
    this.renderStatus();
    window.clearTimeout(this.statusTimer);
    this.statusTimer = window.setTimeout(() => {
      this.status = '';
      this.renderStatus();
    }, 3200);
  }

  private renderStatus() {
    let line = this.element.querySelector<HTMLElement>('.bt-status');
    if (!line) {
      line = h('p', {
        class: 'bt-status',
        role: 'status',
        'aria-live': 'polite',
        'data-testid': 'bt-status',
      });
      this.element.append(line);
    }
    line.textContent = this.status;
    line.dataset.empty = this.status ? 'false' : 'true';
    line.style.left = `${this.layout.word.x + this.layout.word.width / 2}px`;
    line.style.top = `${this.layout.word.y - 44 * this.layout.scale}px`;
  }

  private renderCoach() {
    this.element.querySelector('.bt-coach')?.remove();
    if (this.view !== 'playing') return;
    const round = this.session.round;
    const wrong = round.tried.filter((letter) => !round.word.includes(letter)).length;
    const text =
      round.tried.length === 0
        ? 'A word is hidden in the sand. Type a letter, or click a shell. Try E.'
        : wrong === 0
          ? 'Right letters write themselves into the sand, and the castle grows a window or a shell. Now try a letter that is not there, like Z.'
          : round.lighthouseUses === 0
            ? 'A wrong letter sends a wave: it takes part of the castle and lifts the float on the gauge. Seven waves and the tide wins. Stuck? The Lighthouse shows a letter for one wave: press ? or its button.'
            : 'Now finish the word. Fewer waves make a lower tide average, and lower is better, like golf.';
    this.element.append(
      h('p', { class: 'bt-coach', role: 'status', 'data-testid': 'bt-coach' }, text),
    );
  }

  onLayout(layout: BeachLayout) {
    this.layout = layout;
    if (this.view === 'playing' || this.view === 'moment') {
      this.render();
      if (this.view === 'moment') this.element.querySelector('.bt-lighthouse')?.remove();
    } else if (this.view === 'card') {
      for (const selector of ['.bt-score', '.bt-word'])
        this.element.querySelector(selector)?.remove();
      this.renderScore();
      this.renderWord(!this.session.words[this.session.words.length - 1]?.won);
      this.positionCard();
    }
  }

  focus() {
    const target =
      this.element.querySelector<HTMLElement>(
        '.bt-card button, .bt-privacy button, .bt-privacy input',
      ) ?? this.element.querySelector<HTMLElement>('.bt-key:not([aria-disabled])');
    target?.focus({ preventScroll: true });
  }

  destroy() {
    window.clearTimeout(this.statusTimer);
    window.clearTimeout(this.momentTimer);
    if (testHook?.screen === this) testHook = null;
  }

  /** For the browser tests: the session, and a way to finish a word without guessing. */
  get forTests() {
    return {
      session: this.session,
      view: this.view,
      word: this.session.round.word,
      /** What the beach shows right now: the swell, the castle's sections. */
      beach: () => {
        const frame = this.app.stage.director.frame(this.app.stage.now, {
          wordPatch: true,
          gauge: true,
          wavesAllowed: 7,
        });
        return {
          swell: frame.sea.swell,
          surge: frame.sea.surge,
          still: frame.still,
          sections: frame.castle.sections,
        };
      },
      solve: () => {
        for (const letter of new Set(this.session.round.word)) this.guess(letter);
      },
      lose: () => {
        for (const letter of 'zqxjkvbwyfgpmucdlhrsnioate') {
          if (this.session.round.status !== 'playing') break;
          if (!this.session.round.word.includes(letter)) this.guess(letter);
        }
      },
    };
  }
}

function modeName(mode: Mode): string {
  return {
    tutorial: 'Tutorial',
    beach: 'Beach day',
    daily: 'Daily Word',
    classic: 'Classic',
    run: 'Tide run',
    duel: 'Duel',
  }[mode];
}

function distinctFound(round: Round): number {
  return new Set(round.tried.filter((letter) => round.word.includes(letter))).size;
}

function winLine(result: WordResult): string {
  if (result.waves === 0) return 'Not a single wave!';
  if (result.waves === result.wavesAllowed - 1) return 'One wave short of the tide!';
  return 'The castle stands!';
}

function secretProblem(problem: string): string {
  switch (problem) {
    case 'too-short':
      return 'A little longer, please: at least three letters.';
    case 'too-long':
      return 'That one is too long for the sand: fourteen letters at most.';
    case 'not-letters':
      return 'Letters only, please: no spaces, numbers or marks.';
    default:
      return 'Let’s keep the beach friendly for everyone: try another word.';
  }
}

let testHook: { screen: PlayScreen } | null = null;

/** `window.__bt`: the play screen's state for Playwright. */
function exposeTestHook(screen: PlayScreen) {
  testHook = { screen };
  (window as unknown as { __bt: unknown }).__bt = {
    play: () => testHook?.screen.forTests ?? null,
  };
}
