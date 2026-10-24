import type { GameContext, PauseMenuItem } from '@usr-games/kit';
import type { CardId } from '@usr-games/kit/cards';
import type { Level } from '../engine/ai/minds';
import { dailyPuzzle, dailyShareText, type DailyVerdict } from '../engine/daily';
import {
  type MatchEvent,
  type MatchState,
  other,
  type Seat,
  startMatch,
  YOU,
} from '../engine/match';
import { addToAlbum, albumFrom } from '../modes/album';
import {
  type GameSummary,
  PACKAGES,
  packagesForGame,
  packagesForMoment,
  xpEventsFor,
} from '../modes/packages';
import { DailyRun } from '../play/daily-run';
import { Director, type Moment, NO_TALLIES, type Tallies } from '../play/director';
import { createTableSound, type TableSound } from '../play/sound';
import { TrainerRun, type TrainerMode, type TrainerResult } from '../play/trainer-run';
import { backdropScene } from '../render/backdrop';
import { lookFor, type Look } from '../render/look';
import { TableView } from '../render/scene';
import { cardChips, h } from '../ui/dom';
import { Hud } from '../ui/hud';
import { type ResultsAction, resultsCard, type ResultsModel } from '../ui/results';
import {
  albumScreen,
  COUNTING_NAMES,
  dailyScreen,
  helpScreen,
  LEVEL_NAMES,
  newGameScreen,
  type Screen,
  settingsScreen,
  titleScreen,
  trainerScreen,
} from './menus';
import {
  dailyFrom,
  openSaves,
  type Prefs,
  prefsFrom,
  type Records,
  recordsFrom,
  type Saves,
  savedGameFrom,
} from './saves';

/**
 * Fifteen-Two inside the Hall: the table always behind, the game menu and its pages over it, a
 * game run by the director (or a trainer round, or the Daily Discard), and the results card at
 * the end. Everything the game tells the Hall goes through the context: the title screen, pause
 * items, results, packages and the Daily's share line.
 */

/** What the browser tests may reach while the game runs on a development server. */
export interface CribbageTestHook {
  phase(): string;
  choices(): CardId[];
  best(): CardId[];
  act(cards: CardId[]): void;
  claim(value: number): void;
  trueCount(): number | null;
  next(): void;
  fast(times: number): void;
  trainerAnswer(): number | null;
  trainerSubmit(value: number): void;
  dailyChoose(cards: CardId[]): void;
  dailyHand(): CardId[];
  nextSeed(seed: string): void;
  state(): MatchState | null;
  rig(you: number, rival: number): void;
}

declare global {
  interface Window {
    __ft?: CribbageTestHook;
  }
}

function randomSeed(): string {
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);
  return `${words[0]!.toString(36)}${words[1]!.toString(36)}`;
}

const PACE = { relaxed: 1, brisk: 1.7 } as const;

export class CribbageApp {
  private readonly root: HTMLElement;
  private readonly view: TableView;
  private readonly hud = new Hud();
  private readonly live = h('div', {
    class: 'ft-sr',
    'aria-live': 'polite',
    'data-testid': 'ft-live',
  });
  private readonly veil = h('div', { class: 'ft-veil', hidden: true });
  private readonly saves: Saves;
  private readonly sound: TableSound;
  private readonly offered = new Set<string>();
  private readonly stops: (() => void)[] = [];
  private screen: Screen | null = null;
  private rerender: (() => Screen) | null = null;
  private results: HTMLElement | null = null;
  private director: Director | null = null;
  private trainer: TrainerRun | null = null;
  private daily: DailyRun | null = null;
  private backdropFrame = 0;
  private startedAt = 0;
  private lastGame: { level: Level; loser: Seat } | null = null;
  private lastTrainer: TrainerMode = 'sprint';
  /** The pegs behind the menus: home in the start holes, or where the last game ended. */
  private backdropPegs: { scores: [number, number]; names: [string, string] } = {
    scores: [0, 0],
    names: ['You', 'Opponent'],
  };
  private testSpeed = 1;
  private testSeed: string | null = null;

  constructor(
    host: HTMLElement,
    private readonly context: GameContext,
  ) {
    this.saves = openSaves(context);
    this.sound = createTableSound(context.audio);
    this.root = h('div', { class: 'ft-app', 'data-testid': 'ft-app', tabindex: '-1' });
    this.view = new TableView(this.look());
    this.root.append(this.view.canvas, this.hud.sheet, this.veil, this.live);
    host.append(this.root);
    this.root.dataset.look = this.look().id;
    this.stops.push(
      context.onAppearanceChange(() => this.onLook()),
      context.onSettingsChange(() => context.audio.refresh()),
      context.onPause(() => this.pause()),
      context.onResume(() => this.resume()),
    );
    const resize = new ResizeObserver(() => this.onResize());
    resize.observe(this.root);
    this.stops.push(() => resize.disconnect());
    const keys = (event: KeyboardEvent) => this.onKey(event);
    this.root.addEventListener('keydown', keys);
    this.stops.push(() => this.root.removeEventListener('keydown', keys));
    this.onResize();
    this.showTitle();
    if (import.meta.env.DEV) this.exposeTestHook();
  }

  destroy(): void {
    this.clear();
    cancelAnimationFrame(this.backdropFrame);
    this.sound.stop();
    for (const stop of this.stops) stop();
    this.root.remove();
  }

  // —— looks, sizes, saves ——

  private look(): Look {
    return lookFor(this.context.appearance().appearance === 'dark');
  }

  private reducedMotion(): boolean {
    return this.context.appearance().reducedMotion;
  }

  private prefs(): Prefs {
    return prefsFrom(this.saves.prefs.load());
  }

  private records(): Records {
    return recordsFrom(this.saves.records.load());
  }

  private onLook(): void {
    const look = this.look();
    this.root.dataset.look = look.id;
    this.view.setLook(look);
    this.sound.fireside(look.dark && this.director !== null);
    if (this.screen && this.rerender) this.rerenderScreen();
    if (!this.director && !this.trainer && !this.daily) this.runBackdrop();
  }

  private onResize(): void {
    const box = this.root.getBoundingClientRect();
    if (box.width === 0) return;
    this.view.resize(box.width, box.height, window.devicePixelRatio || 1);
    this.hud.place(this.view.currentFrame);
    const unit = Math.max(0.8, Math.min(1.3, Math.min(box.width / 1920, box.height / 1080)));
    this.root.style.setProperty('--ft-u', unit.toFixed(3));
    // Below the design size the sheet's small print would shrink too far; it grows back a little.
    const scale = this.view.currentFrame.scale;
    this.root.style.setProperty('--ft-text-boost', scale < 0.8 ? (0.8 / scale).toFixed(3) : '1');
    if (!this.director && !this.trainer && !this.daily) this.runBackdrop();
  }

  private announce = (text: string): void => {
    // Cleared first, so the same words twice in a row are still read out.
    this.live.textContent = '';
    requestAnimationFrame(() => (this.live.textContent = text));
  };

  private pause(): void {
    this.director?.pause();
    this.trainer?.pause();
    this.daily?.pause();
    this.sound.fireside(false);
  }

  private resume(): void {
    this.director?.resume();
    this.trainer?.resume();
    this.daily?.resume();
  }

  // —— the table behind the menus ——

  private runBackdrop(): void {
    cancelAnimationFrame(this.backdropFrame);
    const started = performance.now();
    const frame = () => {
      if (this.director || this.trainer || this.daily) return;
      const still = this.reducedMotion();
      const { scores, names } = this.backdropPegs;
      this.view.render(
        backdropScene(
          this.look(),
          still ? 2 : (performance.now() - started) / 1000,
          still,
          scores,
          names,
        ),
      );
      if (!still) this.backdropFrame = requestAnimationFrame(frame);
    };
    frame();
  }

  // —— screens ——

  private show(screen: Screen, render?: () => Screen): void {
    this.clear();
    this.screen = screen;
    this.rerender = render ?? null;
    this.veil.hidden = screen.isTitle === true;
    this.hud.sheet.hidden = true;
    this.root.dataset.mode = screen.isTitle ? 'title' : 'page';
    this.root.append(screen.element);
    this.context.setOnTitleScreen(screen.isTitle === true);
    this.context.pauseMenuItems([]);
    this.runBackdrop();
    screen.focus();
  }

  private rerenderScreen(): void {
    if (!this.rerender || !this.screen) return;
    const fresh = this.rerender();
    this.screen.element.replaceWith(fresh.element);
    this.screen = fresh;
    fresh.focus();
  }

  private clear(): void {
    this.results?.remove();
    this.results = null;
    this.director?.stop();
    this.director = null;
    this.trainer?.stop();
    this.trainer = null;
    this.daily?.stop();
    this.daily = null;
    this.screen?.element.remove();
    this.screen = null;
    this.rerender = null;
    this.hud.setLedger(null);
    this.hud.setPrompt(null);
    this.sound.fireside(false);
  }

  showTitle(): void {
    this.backdropPegs = { scores: [0, 0], names: ['You', 'Opponent'] };
    const prefs = this.prefs();
    const records = this.records();
    const saved = savedGameFrom(this.saves.game.load());
    const today = dailyFrom(this.saves.daily.load())[this.context.daily.dateKey()];
    const album = albumFrom(this.saves.album.load());
    this.show(
      titleScreen(
        {
          continueLine: saved
            ? `Hand ${saved.state.hand} · you ${saved.state.scores[0]}, ${LEVEL_NAMES[saved.level]} ${saved.state.scores[1]} · to ${saved.state.options.length}`
            : null,
          newGameLine: `${LEVEL_NAMES[prefs.level]} · to ${prefs.length} · ${COUNTING_NAMES[prefs.counting]} counting`,
          trainerLine:
            records.bestSprint > 0
              ? `Best sprint: ${records.bestSprint} hands right`
              : 'Count hands against the clock',
          dailyNumber: this.context.daily.number(),
          dailyLine: today
            ? `Laid away today: ${today.percent}% of the best`
            : 'The same six cards for everyone today',
          albumLine:
            album.length > 0
              ? `Best: ${album[0]!.total} points · ${album.length} hands kept`
              : 'Your best hands, and a slot for the 29',
        },
        {
          continueGame: () => this.continueGame(),
          newGame: () => this.showNewGame(),
          trainer: () => this.showTrainer(),
          daily: () => this.showDaily(),
          album: () =>
            this.show(
              albumScreen(albumFrom(this.saves.album.load()), this.look(), () => this.showTitle()),
              () =>
                albumScreen(albumFrom(this.saves.album.load()), this.look(), () =>
                  this.showTitle(),
                ),
            ),
          help: () => this.show(helpScreen(() => this.showTitle())),
          settings: () => this.showSettings(),
        },
      ),
    );
  }

  private changePrefs(patch: Partial<Prefs>): void {
    this.saves.prefs.update((p) => ({ ...prefsFrom(p), ...patch }));
    this.rerenderScreen();
  }

  private showNewGame(): void {
    const render = () =>
      newGameScreen(this.prefs(), this.records(), {
        change: (patch) => this.changePrefs(patch),
        start: () => this.newGame(),
        back: () => this.showTitle(),
      });
    this.show(render(), render);
  }

  private showSettings(): void {
    const render = () =>
      settingsScreen(this.prefs(), {
        change: (patch) => this.changePrefs(patch),
        hallSettings: () => this.context.openSettings(),
        forget: () => void this.context.forgetData().then((forgot) => forgot && this.showTitle()),
        back: () => this.showTitle(),
      });
    this.show(render(), render);
  }

  // —— a game ——

  private newGame(firstDealer?: Seat): void {
    const prefs = this.prefs();
    const seed = this.testSeed ?? randomSeed();
    this.testSeed = null;
    const step = startMatch({ length: prefs.length, counting: prefs.counting, firstDealer }, seed);
    this.beginGame(prefs.level, seed, step.state, step.events, NO_TALLIES());
  }

  private continueGame(): void {
    const saved = savedGameFrom(this.saves.game.load());
    if (!saved) return this.showTitle();
    this.beginGame(saved.level, saved.seed, saved.state, [], {
      ...NO_TALLIES(),
      claims: saved.claims,
      rightClaims: saved.rightClaims,
    });
  }

  private beginGame(
    level: Level,
    seed: string,
    state: MatchState,
    opening: MatchEvent[],
    tallies: Tallies,
  ): void {
    void this.context.audio.resume();
    this.clear();
    cancelAnimationFrame(this.backdropFrame);
    this.veil.hidden = true;
    this.hud.sheet.hidden = false;
    this.root.dataset.mode = 'play';
    this.startedAt = performance.now();
    this.context.setOnTitleScreen(false);
    const names: [string, string] = ['You', LEVEL_NAMES[level]];
    const director = new Director({
      root: this.root,
      view: this.view,
      hud: this.hud,
      sound: this.sound,
      look: () => this.look(),
      reducedMotion: () => this.reducedMotion(),
      pace: () => PACE[this.prefs().pace],
      coach: () => this.prefs().coach,
      level,
      names,
      seed,
      state,
      opening,
      tallies,
      hooks: {
        announce: this.announce,
        onStep: (next, running) => this.keepGame(level, seed, next, running),
        onMoment: (moment) => this.onMoment(moment, level),
        onEnd: (summary, final) => this.finishGame(summary, final),
      },
    });
    this.director = director;
    director.testSpeed = this.testSpeed;
    this.refreshPauseItems();
    this.sound.fireside(this.look().dark);
    director.start();
    this.root.focus({ preventScroll: true });
  }

  private keepGame(level: Level, seed: string, state: MatchState, tallies: Tallies): void {
    if (state.phase === 'game-over') {
      this.saves.game.save(null);
      return;
    }
    this.saves.game.save({
      level,
      state,
      coach: this.prefs().coach,
      claims: tallies.claims,
      rightClaims: tallies.rightClaims,
      seed,
      savedAt: new Date().toISOString(),
    });
  }

  private refreshPauseItems(): void {
    if (!this.director) return;
    const coach = this.prefs().coach;
    const items: PauseMenuItem[] = [
      {
        id: 'coach',
        label: coach ? 'Coach off' : 'Coach on',
        shortcut: 'C',
        run: () => this.toggleCoach(),
      },
    ];
    this.context.pauseMenuItems(items);
  }

  private toggleCoach(): void {
    const coach = !this.prefs().coach;
    this.saves.prefs.update((p) => ({ ...prefsFrom(p), coach }));
    this.director?.toggleCoach(coach);
    this.refreshPauseItems();
    this.announce(coach ? 'Coach on.' : 'Coach off.');
  }

  private onMoment(moment: Moment, level: Level): void {
    if (moment.kind === 'thirty-one') this.install(packagesForMoment({ thirtyOne: true }));
    else if (moment.kind === 'his-heels') this.install(packagesForMoment({ hisHeels: true }));
    else {
      this.install(packagesForMoment({ handTotal: moment.total }));
      this.saves.album.update(
        (value) =>
          addToAlbum(albumFrom(value), {
            hand: moment.hand,
            starter: moment.starter,
            isCrib: moment.isCrib,
            total: moment.total,
            date: this.context.daily.dateKey(),
            opponent: level,
          }).album,
      );
    }
  }

  private install(ids: readonly string[]): string[] {
    const fresh: string[] = [];
    for (const id of ids) {
      if (this.offered.has(id) || !PACKAGES.some((p) => p.id === id)) continue;
      this.offered.add(id);
      if (this.context.installPackage(id)) fresh.push(id);
    }
    return fresh;
  }

  private finishGame(summary: GameSummary, state: MatchState): void {
    this.saves.game.save(null);
    const won = summary.outcome === 'win';
    const records = this.saves.records.update((value) => {
      const r = recordsFrom(value);
      const byLevel = { ...r.byLevel };
      byLevel[summary.level] = {
        games: byLevel[summary.level].games + 1,
        wins: byLevel[summary.level].wins + (won ? 1 : 0),
      };
      return {
        ...r,
        games: r.games + 1,
        wins: r.wins + (won ? 1 : 0),
        byLevel,
        skunks: r.skunks + (won && summary.skunk !== 'none' ? 1 : 0),
        thirtyOnes: r.thirtyOnes + summary.thirtyOnes,
        bestCount: Math.max(r.bestCount, summary.bestCount),
      };
    });
    const installed = this.install(packagesForGame(summary));
    const receipt = this.context.reportResult({
      outcome: won ? 'win' : 'loss',
      score: summary.scores[0],
      stats: {
        games: 1,
        wins: won ? 1 : 0,
        thirtyOnes: summary.thirtyOnes,
        bigHands: summary.bestCount >= 20 ? 1 : 0,
      },
      xpEvents: xpEventsFor(summary),
      durationSeconds: Math.round((performance.now() - this.startedAt) / 1000),
      presentation: 'game',
    });
    this.lastGame = { level: summary.level, loser: won ? other(YOU) : YOU };
    this.backdropPegs = { scores: [...state.scores], names: ['You', LEVEL_NAMES[summary.level]] };
    const name = LEVEL_NAMES[summary.level];
    const skunkWords =
      summary.skunk === 'double-skunk'
        ? ': a double skunk'
        : summary.skunk === 'skunk'
          ? ': a skunk'
          : '';
    const footnotes = this.receiptLines(receipt.xpGained, [
      ...installed,
      ...receipt.packagesInstalled,
    ]);
    if (summary.bestCount >= 20)
      footnotes.push(`Your ${summary.bestCount} is in your hand records.`);
    const stats = [
      { label: 'Hands dealt', value: String(summary.hands) },
      { label: 'Pegged in the play', value: String(summary.pegged) },
      { label: 'Counted in the show', value: String(summary.shown) },
      { label: 'Best hand', value: summary.bestCount > 0 ? String(summary.bestCount) : '—' },
      { label: 'Thirty-ones', value: String(summary.thirtyOnes) },
    ];
    if (summary.claims > 0)
      stats.push({ label: 'Counted right', value: `${summary.rightClaims} of ${summary.claims}` });
    stats.push({
      label: `Games won against ${name}`,
      value: `${records.byLevel[summary.level].wins} of ${records.byLevel[summary.level].games}`,
    });
    this.showResults({
      kicker: `${name} · to ${summary.length} · ${COUNTING_NAMES[summary.counting]} counting`,
      title: won
        ? summary.skunk === 'double-skunk'
          ? 'You win, with a double skunk!'
          : summary.skunk === 'skunk'
            ? 'You win, with a skunk!'
            : 'You win!'
        : `${name} wins`,
      story: `${state.scores[0]} to ${state.scores[1]}${won ? skunkWords : summary.skunk !== 'none' ? `, ${skunkWords.slice(2)} for ${name}` : ''}.`,
      mood: won ? 'won' : 'lost',
      figure: { value: String(state.scores[0]), label: 'your pegs' },
      stats,
      footnotes,
      actions: this.standardActions(() => this.playAgain()),
    });
  }

  private receiptLines(xp: number, packages: readonly string[]): string[] {
    const lines: string[] = [];
    if (xp > 0) lines.push(`+${xp} XP`);
    for (const id of new Set(packages)) {
      const pkg = PACKAGES.find((p) => p.id === id);
      if (pkg) lines.push(`Package installed: ${pkg.title}`);
    }
    return lines;
  }

  private standardActions(again: () => void, againLabel = 'Play again'): ResultsAction[] {
    return [
      { id: 'again', label: againLabel, key: 'R', primary: true, run: again },
      { id: 'menu', label: 'Game menu', run: () => this.showTitle() },
      { id: 'hall', label: 'Back to the Hall', key: 'H', run: () => this.context.navigate('hall') },
    ];
  }

  private showResults(model: ResultsModel, extra?: HTMLElement): void {
    this.clear();
    this.veil.hidden = false;
    this.hud.sheet.hidden = true;
    this.root.dataset.mode = 'results';
    this.context.setOnTitleScreen(false);
    this.context.pauseMenuItems([]);
    const card = resultsCard(model, () => this.showTitle());
    if (extra) card.element.querySelector('.ft-results-actions')!.before(extra);
    this.results = card.element;
    this.root.append(card.element);
    this.runBackdrop();
    card.focus();
  }

  playAgain(): void {
    if (this.lastGame) {
      // As in the original, the loser of the last game deals first.
      const loser = this.lastGame.loser;
      this.lastGame = null;
      return this.newGame(loser);
    }
    if (this.results?.dataset.kind === 'trainer') return this.beginTrainer(this.lastTrainer);
    this.newGame();
  }

  // —— the counting trainer ——

  private showTrainer(): void {
    const render = () =>
      trainerScreen(this.records(), {
        sprint: () => this.beginTrainer('sprint'),
        relaxed: () => this.beginTrainer('relaxed'),
        back: () => this.showTitle(),
      });
    this.show(render(), render);
  }

  private beginTrainer(mode: TrainerMode): void {
    void this.context.audio.resume();
    this.clear();
    cancelAnimationFrame(this.backdropFrame);
    this.lastGame = null;
    this.lastTrainer = mode;
    this.veil.hidden = true;
    this.hud.sheet.hidden = false;
    this.root.dataset.mode = 'play';
    this.startedAt = performance.now();
    this.context.setOnTitleScreen(false);
    this.context.pauseMenuItems([]);
    const trainer = new TrainerRun({
      view: this.view,
      hud: this.hud,
      look: () => this.look(),
      reducedMotion: () => this.reducedMotion(),
      sound: this.sound,
      announce: this.announce,
      mode,
      seed: this.testSeed ?? randomSeed(),
      onEnd: (result) => this.finishTrainer(result),
    });
    this.testSeed = null;
    this.trainer = trainer;
    trainer.start();
  }

  private finishTrainer(result: TrainerResult): void {
    const records = this.saves.records.update((value) => {
      const r = recordsFrom(value);
      return {
        ...r,
        trainerRight: r.trainerRight + result.right,
        trainerRounds: r.trainerRounds + 1,
        bestSprint: result.mode === 'sprint' ? Math.max(r.bestSprint, result.right) : r.bestSprint,
      };
    });
    const installed = this.install(records.trainerRight >= 50 ? ['trainer-50'] : []);
    const receipt = this.context.reportResult({
      outcome: 'complete',
      score: result.right,
      stats: { trainerRight: result.right },
      xpEvents:
        result.right > 0
          ? [{ id: 'counted', xp: Math.min(15, Math.round(result.right * 1.5)) }]
          : [],
      durationSeconds: Math.round((performance.now() - this.startedAt) / 1000),
      presentation: 'game',
    });
    const footnotes = this.receiptLines(receipt.xpGained, [
      ...installed,
      ...receipt.packagesInstalled,
    ]);
    footnotes.push(`Hands counted right in the trainer, all told: ${records.trainerRight}.`);
    this.showResults({
      kicker:
        result.mode === 'sprint'
          ? 'Counting trainer · two-minute sprint'
          : 'Counting trainer · ten hands',
      title:
        result.right === result.hands && result.hands > 0
          ? 'Every one right!'
          : `${result.right} counted right`,
      story: `${result.right} of ${result.hands} ${result.hands === 1 ? 'hand' : 'hands'}, ${result.points} points pegged.`,
      mood: 'done',
      figure: { value: String(result.right), label: 'right' },
      stats: [
        { label: 'Hands counted', value: String(result.hands) },
        { label: 'Points pegged', value: String(result.points) },
        { label: 'Best sprint', value: records.bestSprint > 0 ? String(records.bestSprint) : '—' },
      ],
      footnotes,
      actions: this.standardActions(() => this.beginTrainer(this.lastTrainer)),
    });
    if (this.results) this.results.dataset.kind = 'trainer';
  }

  // —— the Daily Discard ——

  private showDaily(): void {
    const dateKey = this.context.daily.dateKey();
    const render = () => {
      const history = dailyFrom(this.saves.daily.load());
      return dailyScreen(
        {
          number: this.context.daily.number(),
          dateLabel: new Date(`${dateKey}T12:00:00`).toLocaleDateString('en', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
          today: history[dateKey],
          days: Object.keys(history).length,
        },
        {
          play: () => this.beginDaily(),
          share: () => this.shareDaily(),
          back: () => this.showTitle(),
        },
      );
    };
    this.show(render(), render);
  }

  private beginDaily(): void {
    void this.context.audio.resume();
    this.clear();
    cancelAnimationFrame(this.backdropFrame);
    this.lastGame = null;
    this.veil.hidden = true;
    this.hud.sheet.hidden = false;
    this.root.dataset.mode = 'play';
    this.context.setOnTitleScreen(false);
    this.context.pauseMenuItems([]);
    const today = dailyFrom(this.saves.daily.load())[this.context.daily.dateKey()];
    const daily = new DailyRun({
      root: this.root,
      view: this.view,
      hud: this.hud,
      look: () => this.look(),
      reducedMotion: () => this.reducedMotion(),
      sound: this.sound,
      announce: this.announce,
      number: this.context.daily.number(),
      puzzle: dailyPuzzle(this.context.daily.seed()),
      made: today ? today.thrown : null,
      onVerdict: (verdict, fresh) => this.finishDaily(verdict, fresh),
    });
    this.daily = daily;
    daily.start();
    this.root.focus({ preventScroll: true });
  }

  private finishDaily(verdict: DailyVerdict, fresh: boolean): void {
    const dateKey = this.context.daily.dateKey();
    let footnotes: string[] = [];
    if (fresh) {
      const history = this.saves.daily.update((days) => ({
        ...dailyFrom(days),
        [dateKey]: {
          number: this.context.daily.number(),
          thrown: [...verdict.chosen.thrown],
          percent: verdict.percent,
          place: verdict.place,
        },
      }));
      const installed = this.install(Object.keys(history).length >= 7 ? ['daily-regular'] : []);
      const receipt = this.context.reportResult({
        outcome: 'complete',
        score: verdict.percent,
        stats: { dailies: 1 },
        xpEvents: [
          { id: 'daily-discard', xp: verdict.place === 1 ? 10 : verdict.percent >= 90 ? 6 : 3 },
        ],
        daily: true,
        presentation: 'game',
      });
      footnotes = this.receiptLines(receipt.xpGained, [...installed, ...receipt.packagesInstalled]);
    }
    const best = verdict.options[0]!;
    const crib = dailyPuzzle(this.context.daily.seed()).ownCrib ? 'your crib' : 'their crib';
    const actions: ResultsAction[] = [
      { id: 'again', label: 'Play a game', key: 'R', primary: true, run: () => this.newGame() },
      { id: 'menu', label: 'Game menu', run: () => this.showTitle() },
      { id: 'hall', label: 'Back to the Hall', key: 'H', run: () => this.context.navigate('hall') },
      { id: 'share', label: 'Share', key: 'S', run: () => this.shareDaily() },
    ];
    this.showResults(
      {
        kicker: `Daily Discard #${this.context.daily.number()} · ${crib}`,
        title: verdict.place === 1 ? 'The best throw there is' : `${verdict.percent}% of the best`,
        story:
          verdict.place === 1
            ? h(
                'span',
                {},
                cardChips(verdict.chosen.thrown),
                ` to the crib: ${verdict.chosen.value.toFixed(2)} points on average.`,
              )
            : h(
                'span',
                {},
                'You threw ',
                cardChips(verdict.chosen.thrown),
                ` (${verdict.chosen.value.toFixed(2)}); the best was `,
                cardChips(best.thrown),
                ` (${best.value.toFixed(2)}).`,
              ),
        mood: 'done',
        figure: { value: `${verdict.percent}%`, label: 'of the best' },
        stats: [
          { label: 'Your throw ranks', value: `${verdict.place} of 15` },
          { label: 'Kept hand, on average', value: verdict.chosen.handAverage.toFixed(2) },
          {
            label: `Crib, on average`,
            value: `${crib === 'your crib' ? '+' : '−'}${verdict.chosen.cribAverage.toFixed(2)}`,
          },
        ],
        footnotes,
        actions,
      },
      rankingTable(verdict, crib === 'your crib'),
    );
  }

  private shareDaily(): void {
    const today = dailyFrom(this.saves.daily.load())[this.context.daily.dateKey()];
    if (today) void this.context.share(dailyShareText(this.context.daily.dateKey(), today.percent));
  }

  // —— keys ——

  private onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    if ((event.target as HTMLElement).closest('input, textarea, select')) return;
    if (this.director && (event.key === 'c' || event.key === 'C')) {
      event.preventDefault();
      this.toggleCoach();
      return;
    }
    if (this.trainer && event.key === 'Enter') {
      event.preventDefault();
      this.trainer.next();
    }
  }

  // —— the browser tests' hook ——

  private exposeTestHook(): void {
    window.__ft = {
      phase: () =>
        this.results
          ? 'results'
          : this.director
            ? this.director.isOver
              ? 'over'
              : (this.director.waitingFor ?? 'busy')
            : this.trainer
              ? 'trainer'
              : this.daily
                ? 'daily'
                : 'menu',
      choices: () => this.director?.choices() ?? [],
      best: () => this.director?.bestMove() ?? [],
      act: (cards) => {
        const director = this.director;
        if (!director) return;
        if (director.waitingFor === 'lay-away') director.layAwayCards(cards);
        else if (director.waitingFor === 'play') director.playYour(cards[0]!);
      },
      claim: (value) => this.director?.claim(value),
      trueCount: () => this.director?.trueCount() ?? null,
      next: () => this.director?.dealNext(),
      fast: (times) => {
        this.testSpeed = times;
        if (this.director) this.director.testSpeed = times;
      },
      trainerAnswer: () => this.trainer?.expected ?? null,
      trainerSubmit: (value) => {
        const input = this.root.querySelector<HTMLInputElement>('[data-testid="ft-claim-input"]');
        if (!input) return;
        input.value = String(value);
        input.form?.requestSubmit();
      },
      dailyChoose: (cards) => this.daily?.choose(cards),
      dailyHand: () => dailyPuzzle(this.context.daily.seed()).hand,
      nextSeed: (seed) => {
        this.testSeed = seed;
      },
      state: () => this.director?.current ?? null,
      rig: (you, rival) => this.director?.rig([you, rival]),
    };
    this.stops.push(() => delete window.__ft);
  }
}

/** All fifteen throws, best first, yours marked: the Daily's answer sheet. */
function rankingTable(verdict: DailyVerdict, ownCrib: boolean): HTMLElement {
  const rows = verdict.options.map((option, i) => {
    const yours = option === verdict.chosen;
    return h(
      'tr',
      { class: yours ? 'is-yours' : i === 0 ? 'is-best' : '' },
      h('td', {}, String(i + 1)),
      h('th', { scope: 'row' }, cardChips(option.thrown)),
      h('td', {}, option.handAverage.toFixed(2)),
      h('td', {}, `${ownCrib ? '+' : '−'}${option.cribAverage.toFixed(2)}`),
      h('td', {}, option.value.toFixed(2)),
      h('td', { class: 'ft-ranking-note' }, yours ? 'yours' : i === 0 ? 'best' : ''),
    );
  });
  return h(
    'div',
    { class: 'ft-ranking', tabindex: '0', 'aria-label': 'All fifteen throws, best first' },
    h(
      'table',
      {},
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', { scope: 'col' }, '#'),
          h('th', { scope: 'col' }, 'Throw'),
          h('th', { scope: 'col' }, 'Hand'),
          h('th', { scope: 'col' }, 'Crib'),
          h('th', { scope: 'col' }, 'Total'),
          h('th', { scope: 'col' }, ''),
        ),
      ),
      h('tbody', {}, ...rows),
    ),
  );
}
