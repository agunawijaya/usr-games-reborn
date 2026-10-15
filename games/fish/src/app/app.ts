import type { GameContext, GameResult, PauseMenuItem } from '@usr-games/kit';
import type { Rank } from '@usr-games/kit/cards';
import type { Table } from '../engine/table';
import {
  dailySetup,
  dailyShareText,
  isValidSetup,
  type MatchSetup,
  RIVALS,
  TOURNAMENT_ROUNDS,
  TOURNAMENT_WINS_NEEDED,
  tableFor,
  tournamentSetup,
} from '../modes/match';
import { type GameSummary, PACKAGES, packagesForGame, xpEventsFor } from '../modes/packages';
import { Director, type Moment } from '../play/director';
import { createPondSound, type PondSound } from '../play/sound';
import { speciesFor } from '../render/fish/species';
import { lookFor, type Look } from '../render/look';
import { type PondScene, PondView } from '../render/pond-view';
import { applyLook, h } from '../ui/dom';
import { Hud } from '../ui/hud';
import { type ResultsAction, resultsCard, type ResultsModel } from '../ui/results';
import {
  albumScreen,
  dailyScreen,
  helpScreen,
  quickScreen,
  RULE_NAMES,
  type Screen,
  settingsScreen,
  titleScreen,
  tournamentScreen,
} from './menus';
import {
  albumFrom,
  catchInto,
  type DailyHistory,
  openSaves,
  type Prefs,
  prefsFrom,
  type Records,
  recordsFrom,
  type RoundResult,
  type Saves,
  tournamentFrom,
} from './saves';

/**
 * Gone Fishing inside the Hall: the pond always behind, the game menu and its pages over it,
 * a game played by the director, and the results card after the last fish has swum its lap.
 * Everything the game tells the Hall goes through the context: the title screen, pause items,
 * results, packages and the Daily's share line.
 */

/** What the browser tests may reach while the game runs on a development server. */
export interface FishTestHook {
  phase(): 'menu' | 'your-turn' | 'playing' | 'over' | 'results';
  fast(times: number): void;
  askAny(): boolean;
  askSmart(): boolean;
  setup(): MatchSetup | null;
  /** The next Quick game deals from this seed, so documentation pictures show the same game. */
  nextSeed(seed: string): void;
}

declare global {
  interface Window {
    __gf?: FishTestHook;
  }
}

function randomSeed(): string {
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);
  return `${words[0]!.toString(36)}${words[1]!.toString(36)}`;
}

const PACE = { relaxed: 1, brisk: 1.6 } as const;

export class FishApp {
  private readonly root: HTMLElement;
  private readonly view: PondView;
  private readonly live = h('div', {
    class: 'gf-live',
    'aria-live': 'polite',
    'data-testid': 'gf-live',
  });
  private readonly veil = h('div', { class: 'gf-dim', hidden: true });
  private readonly saves: Saves;
  private readonly sound: PondSound;
  private readonly offered = new Set<string>();
  private readonly stops: (() => void)[] = [];
  private screen: Screen | null = null;
  private director: Director | null = null;
  private hud: Hud | null = null;
  private results: { element: HTMLElement } | null = null;
  private confirm: HTMLElement | null = null;
  private setup: MatchSetup | null = null;
  private startedAt = 0;
  private backdropFrame = 0;

  constructor(
    host: HTMLElement,
    private readonly context: GameContext,
  ) {
    this.saves = openSaves(context);
    this.sound = createPondSound(context.audio, () => this.prefs().sound);
    this.root = h('div', { class: 'gf-app', 'data-testid': 'gf-app' });
    this.view = new PondView(this.look());
    this.root.append(this.view.element, this.veil, this.live);
    host.append(this.root);
    applyLook(this.root, this.look());
    this.stops.push(
      context.onAppearanceChange(() => this.onLook()),
      context.onSettingsChange(() => context.audio.refresh()),
      context.onPause(() => this.director?.pause()),
      context.onResume(() => this.director?.resume()),
    );
    const resize = new ResizeObserver(() => this.onResize());
    resize.observe(this.root);
    this.stops.push(() => resize.disconnect());
    this.onResize();
    this.showTitle();
    if (import.meta.env.DEV) this.exposeTestHook();
  }

  private testSpeed = 1;
  private testSeed: string | null = null;

  private exposeTestHook(): void {
    window.__gf = {
      phase: () =>
        this.results
          ? 'results'
          : !this.director
            ? 'menu'
            : this.director.isYourTurn
              ? 'your-turn'
              : this.director.isOver
                ? 'over'
                : 'playing',
      fast: (times) => {
        this.testSpeed = times;
        if (this.director) this.director.testSpeed = times;
      },
      askAny: () => {
        const ask = this.director?.firstLegalAsk();
        if (!ask || !this.director) return false;
        this.director.chooseRival(ask.rival);
        this.director.ask(ask.rank);
        return true;
      },
      askSmart: () => {
        const ask = this.director?.bestAsk();
        if (!ask || !this.director) return false;
        this.director.chooseRival(ask.rival);
        this.director.ask(ask.rank);
        return true;
      },
      setup: () => this.setup,
      nextSeed: (seed) => {
        this.testSeed = seed;
      },
    };
    this.stops.push(() => delete window.__gf);
  }

  destroy(): void {
    this.clear();
    cancelAnimationFrame(this.backdropFrame);
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
    applyLook(this.root, look);
    this.view.setLook(look);
    if (this.screen) this.rerenderScreen();
  }

  private onResize(): void {
    const box = this.root.getBoundingClientRect();
    if (box.width === 0) return;
    const s = Math.min(box.width / 1920, box.height / 1080);
    const unit = Math.max(0.85, Math.min(1.3, s));
    this.root.style.setProperty('--gf-u', unit.toFixed(3));
    const options =
      this.layoutMode === 'menu' ? { poster: true, left: (56 + 560 + 24) * unit } : {};
    this.view.resize(
      Math.round(box.width),
      Math.round(box.height),
      window.devicePixelRatio || 1,
      options,
    );
    if (!this.director) this.runBackdrop();
  }

  private announce = (text: string): void => {
    // Cleared first, so the same words twice in a row are still read out.
    this.live.textContent = '';
    requestAnimationFrame(() => (this.live.textContent = text));
  };

  // —— the pond behind the menus ——

  private menuScene(time: number): PondScene {
    return {
      time,
      rivals: (['otto', 'hazel', 'miso'] as const).map((id) => ({
        kind: RIVALS[id].kind,
        mood: 'idle' as const,
        moodAge: 5,
        cards: 0,
      })),
      pond: 52,
      hand: [],
      bucket: [],
      hideBucket: true,
      ripples: [],
      motion: this.reducedMotion() ? 0 : 1,
    };
  }

  /** The pond behind menus moves right of the game menu's card; in play it fills its place. */
  private useLayout(mode: 'menu' | 'play'): void {
    if (this.layoutMode === mode) return;
    this.layoutMode = mode;
    this.onResize();
  }

  private layoutMode: 'menu' | 'play' = 'menu';

  private runBackdrop(): void {
    cancelAnimationFrame(this.backdropFrame);
    const started = performance.now();
    const frame = () => {
      if (this.director) return;
      this.view.draw(this.menuScene((performance.now() - started) / 1000));
      if (!this.reducedMotion()) this.backdropFrame = requestAnimationFrame(frame);
    };
    frame();
  }

  // —— screens ——

  private show(screen: Screen, render?: () => Screen): void {
    this.clear();
    this.screen = screen;
    this.rerender = render ?? null;
    this.veil.hidden = screen.isTitle === true;
    this.root.append(screen.element);
    this.context.setOnTitleScreen(screen.isTitle === true);
    this.context.pauseMenuItems([]);
    this.useLayout('menu');
    this.runBackdrop();
    screen.focus();
  }

  private rerender: (() => Screen) | null = null;

  /** A page changed (a setting, the look): drawn again in place, focus on its heading. */
  private rerenderScreen(): void {
    if (!this.rerender || !this.screen) return;
    const fresh = this.rerender();
    this.screen.element.replaceWith(fresh.element);
    this.screen = fresh;
    fresh.focus();
  }

  private clear(): void {
    this.confirm?.remove();
    this.confirm = null;
    this.results?.element.remove();
    this.results = null;
    this.director?.stop();
    this.director = null;
    this.hud?.element.remove();
    this.hud = null;
    this.screen?.element.remove();
    this.screen = null;
    this.rerender = null;
  }

  showTitle(): void {
    const prefs = this.prefs();
    const tournament = tournamentFrom(this.saves.tournament.load());
    const album = albumFrom(this.saves.album.load());
    const today = this.saves.daily.load()[this.context.daily.dateKey()];
    const caught = album.filter((entry) => entry.first).length;
    const golden = album.filter((entry) => entry.goldenFirst).length;
    const quickRivals = prefs.rules === 'classic' ? prefs.rivals.slice(0, 1) : prefs.rivals;
    this.show(
      titleScreen(
        {
          quickLine: `${listNames(quickRivals.map((id) => RIVALS[id].name))} · ${RULE_NAMES[prefs.rules]}`,
          tournamentLine: tournamentLine(tournament),
          dailyNumber: this.context.daily.number(),
          dailyLine: today
            ? `${today.books.length} ${today.books.length === 1 ? 'book' : 'books'} today`
            : 'The same pond for everyone today',
          albumLine: `${caught} of 13 species${golden > 0 ? ` · ${golden} golden` : ''}`,
        },
        {
          quick: () => this.showQuick(),
          tournament: () => this.showTournament(),
          daily: () => this.showDaily(),
          album: () => this.showAlbum(),
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

  private showQuick(): void {
    const render = () =>
      quickScreen(this.prefs(), this.look(), {
        change: (patch) => this.changePrefs(patch),
        start: () => this.startQuick(),
        back: () => this.showTitle(),
      });
    this.show(render(), render);
  }

  private startQuick(): void {
    const prefs = this.prefs();
    const rivals =
      prefs.rules === 'classic'
        ? [prefs.rivals.find((id) => id !== 'miso') ?? 'otto']
        : prefs.rivals;
    const seed = this.testSeed ?? randomSeed();
    this.testSeed = null;
    this.begin({ kind: 'quick', rules: prefs.rules, rivals, seed });
  }

  private showTournament(): void {
    const render = () =>
      tournamentScreen(tournamentFrom(this.saves.tournament.load()), {
        play: () => this.playTournamentRound(),
        restart: () => void this.restartTournament(),
        back: () => this.showTitle(),
      });
    this.show(render(), render);
  }

  private playTournamentRound(): void {
    let progress = tournamentFrom(this.saves.tournament.load());
    if (!progress || progress.results.length >= TOURNAMENT_ROUNDS.length) {
      progress = { seed: randomSeed(), results: [] };
      this.saves.tournament.save(progress);
    }
    this.begin(tournamentSetup(progress.seed, progress.results.length));
  }

  private async restartTournament(): Promise<void> {
    const progress = tournamentFrom(this.saves.tournament.load());
    const underway =
      progress && progress.results.length > 0 && progress.results.length < TOURNAMENT_ROUNDS.length;
    if (underway) {
      const sure = await this.ask({
        title: 'Start the tournament over?',
        body: 'The rounds played so far are set aside and round one begins again.',
        confirm: 'Start over',
        cancel: 'Keep going',
      });
      if (!sure) return;
    }
    this.saves.tournament.save({ seed: randomSeed(), results: [] });
    this.showTournament();
  }

  private showDaily(): void {
    const dateKey = this.context.daily.dateKey();
    const setup = dailySetup(this.context.daily.seed(), this.context.daily.number());
    const render = () => {
      const history = this.saves.daily.load();
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
          rivals: setup.rivals,
        },
        {
          play: () => this.begin(setup),
          share: () => this.shareDaily(),
          back: () => this.showTitle(),
        },
      );
    };
    this.show(render(), render);
  }

  private shareDaily(): void {
    const dateKey = this.context.daily.dateKey();
    const today = this.saves.daily.load()[dateKey];
    if (today) void this.context.share(dailyShareText(dateKey, today.books, today.notebookUsed));
  }

  private showAlbum(): void {
    const render = () =>
      albumScreen(albumFrom(this.saves.album.load()), this.look(), () => this.showTitle());
    this.show(render(), render);
  }

  private showSettings(): void {
    const render = () =>
      settingsScreen(this.prefs(), this.records(), {
        change: (patch) => this.changePrefs(patch),
        hallSettings: () => this.context.openSettings(),
        forget: () => void this.context.forgetData().then((forgot) => forgot && this.showTitle()),
        back: () => this.showTitle(),
      });
    this.show(render(), render);
  }

  /** A small question over the page; resolves true for the confirming answer. */
  private ask(words: {
    title: string;
    body: string;
    confirm: string;
    cancel: string;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      const close = (answer: boolean) => {
        dialog.remove();
        this.confirm = null;
        resolve(answer);
        this.screen?.focus();
      };
      const yes = h(
        'button',
        { type: 'button', class: 'gf-button is-primary', onclick: () => close(true) },
        words.confirm,
      );
      const no = h(
        'button',
        { type: 'button', class: 'gf-button', onclick: () => close(false) },
        words.cancel,
      );
      const dialog = h(
        'div',
        {
          class: 'gf-confirm gf-panel',
          role: 'alertdialog',
          'aria-modal': 'true',
          'aria-labelledby': 'gf-confirm-title',
          onkeydown: (event: Event) => {
            if ((event as KeyboardEvent).key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              close(false);
            }
          },
        },
        h('h2', { id: 'gf-confirm-title' }, words.title),
        h('p', {}, words.body),
        h('div', { class: 'gf-page-actions' }, yes, no),
      );
      this.confirm = dialog;
      this.root.append(dialog);
      no.focus();
    });
  }

  // —— a game ——

  private modeLine(setup: MatchSetup): string {
    if (setup.kind === 'daily') return `Daily Pond #${setup.daily ?? this.context.daily.number()}`;
    if (setup.kind === 'tournament') return `Tournament · Round ${(setup.round ?? 0) + 1} of 5`;
    return `Quick game · ${RULE_NAMES[setup.rules]}`;
  }

  begin(setup: MatchSetup): void {
    if (!isValidSetup(setup)) return;
    void this.context.audio.resume();
    this.clear();
    cancelAnimationFrame(this.backdropFrame);
    this.veil.hidden = true;
    this.setup = setup;
    this.startedAt = performance.now();
    this.context.setOnTitleScreen(false);
    this.useLayout('play');
    const hud = new Hud({
      chooseRival: (index) => this.director?.chooseRival(index),
      ask: (rank) => this.director?.ask(rank),
      toggleNotebook: () => this.director?.toggleNotebook(),
    });
    this.hud = hud;
    this.root.insertBefore(hud.element, this.veil);
    const prefs = this.prefs();
    const director = new Director({
      setup,
      table: tableFor(setup),
      view: this.view,
      hud,
      root: this.root,
      look: () => this.look(),
      reducedMotion: () => this.reducedMotion(),
      pace: () => PACE[this.prefs().speed],
      notebookOpen: prefs.notebook,
      sound: this.sound,
      status: { title: 'Gone Fishing', mode: this.modeLine(setup) },
      announce: this.announce,
      onMoment: (moment) => this.onMoment(moment),
      onNotebook: (open) => this.saves.prefs.update((p) => ({ ...prefsFrom(p), notebook: open })),
      onEnd: (summary, table) => this.finish(summary, table),
    });
    this.director = director;
    director.testSpeed = this.testSpeed;
    this.refreshPauseItems();
    director.start();
    this.view.element.focus({ preventScroll: true });
  }

  private refreshPauseItems(): void {
    const director = this.director;
    if (!director || !this.setup) return;
    const items: PauseMenuItem[] = [
      {
        id: 'notebook',
        label: 'Notebook open or closed',
        shortcut: 'N',
        run: () => director.toggleNotebook(),
      },
    ];
    if (this.setup.rules === 'classic') {
      items.push({
        id: 'pro',
        label: 'Pro mode for your rival',
        shortcut: 'P',
        run: () => director.switchToPro(),
      });
    }
    this.context.pauseMenuItems(items);
  }

  private onMoment(moment: Moment): void {
    const ids: Record<Moment['kind'], string | null> = {
      'first-book': 'first-book',
      golden: 'golden-catch',
      'three-in-turn': 'three-books-one-turn',
      'lucky-three': 'lucky-cast',
      'pro-mode': null,
    };
    const id = ids[moment.kind];
    if (id) this.install([id]);
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

  // —— the end of a game ——

  private finish(summary: GameSummary, table: Table): void {
    const setup = summary.setup;
    const today = this.context.daily.dateKey();
    const result: RoundResult = summary.outcome;

    // The album: first catches dated, goldens counted.
    let newSpecies: number[] = [];
    let newGolden: number[] = [];
    this.saves.album.update((value) => {
      const caught = catchInto(albumFrom(value), summary.books, today);
      newSpecies = caught.newSpecies;
      newGolden = caught.newGolden;
      return caught.album;
    });

    // The Daily: the first finish of the day is the one that counts.
    let dailyFirst = false;
    let history: DailyHistory = this.saves.daily.load();
    if (setup.kind === 'daily' && !history[today]) {
      dailyFirst = true;
      history = this.saves.daily.update((days) => ({
        ...days,
        [today]: {
          number: setup.daily ?? this.context.daily.number(),
          books: summary.books.map((b) => ({ rank: b.rank, golden: b.golden })),
          notebookUsed: summary.notebookUsed,
          outcome: result,
        },
      }));
    }

    // The Tournament: this round's result, and the cup when three are won.
    let cupNow = false;
    let tournamentWins = 0;
    if (setup.kind === 'tournament') {
      this.saves.tournament.update((value) => {
        const progress = tournamentFrom(value);
        if (!progress || progress.results.length !== setup.round) return progress;
        const results = [...progress.results, result];
        const winsBefore = progress.results.filter((r) => r === 'win').length;
        tournamentWins = results.filter((r) => r === 'win').length;
        cupNow = winsBefore < TOURNAMENT_WINS_NEEDED && tournamentWins >= TOURNAMENT_WINS_NEEDED;
        return { ...progress, results };
      });
    }

    const records = this.saves.records.update((value) => {
      const r = recordsFrom(value);
      const won = result === 'win';
      const beaten = { ...r.beaten };
      if (won) for (const id of setup.rivals) beaten[id] += 1;
      return {
        games: r.games + 1,
        wins: r.wins + (won ? 1 : 0),
        draws: r.draws + (result === 'draw' ? 1 : 0),
        books: r.books + summary.books.length,
        goldens: r.goldens + summary.books.filter((b) => b.golden).length,
        beaten,
        bestBooks: Math.max(r.bestBooks, summary.books.length),
        tournamentsWon: r.tournamentsWon + (cupNow ? 1 : 0),
      };
    });

    const installed = this.install(
      packagesForGame(summary, { dailyDays: Object.keys(history).length, tournamentWon: cupNow }),
    );
    const outcome: GameResult['outcome'] = result;
    const durationSeconds = Math.round((performance.now() - this.startedAt) / 1000);
    const receipt = this.context.reportResult({
      outcome,
      score: summary.books.length,
      stats: {
        games: 1,
        wins: result === 'win' ? 1 : 0,
        books: summary.books.length,
        goldens: summary.books.filter((b) => b.golden).length,
      },
      xpEvents: xpEventsFor(summary),
      daily: dailyFirst,
      durationSeconds,
      presentation: 'game',
    });

    const footnotes: string[] = [];
    if (receipt.xpGained > 0) footnotes.push(`+${receipt.xpGained} XP`);
    for (const id of new Set([...installed, ...receipt.packagesInstalled])) {
      const pkg = PACKAGES.find((p) => p.id === id);
      if (pkg) footnotes.push(`Package installed: ${pkg.title}`);
    }
    for (const rank of newSpecies) footnotes.push(`New in your album: ${speciesName(rank)}.`);
    for (const rank of newGolden)
      footnotes.push(`A golden ${speciesName(rank).toLowerCase()} for the album!`);
    if (summary.outcome === 'win' && !summary.notebookUsed)
      footnotes.push('Won from memory: the notebook stayed closed.');
    if (setup.kind === 'tournament') {
      footnotes.push(
        cupNow
          ? 'Three rounds won: the cup is yours!'
          : `${tournamentWins} of ${TOURNAMENT_WINS_NEEDED} round wins for the cup.`,
      );
    }
    if (setup.kind === 'daily' && !dailyFirst)
      footnotes.push('Today’s first catch is the one that counts.');
    this.showResults(summary, table, footnotes, records);
  }

  private showResults(
    summary: GameSummary,
    table: Table,
    footnotes: string[],
    records: Records,
  ): void {
    const setup = summary.setup;
    const books = table.state.seats.map((seat) => seat.books);
    const names = ['You', ...setup.rivals.map((id) => RIVALS[id].name)];
    const best = Math.max(...books.map((b) => b.length));
    const winners = books.flatMap((b, seat) => (b.length === best ? [seat] : []));
    const title =
      summary.outcome === 'win'
        ? 'You win!'
        : summary.outcome === 'draw'
          ? 'A tie at the top'
          : winners.length === 1
            ? `${names[winners[0]!]} wins`
            : `${listNames(winners.map((seat) => names[seat]!))} share it`;
    const others = books.slice(1).map((b) => b.length);
    const story =
      summary.outcome === 'win'
        ? `${summary.books.length} books to ${listNames(others.map(String))}.`
        : summary.outcome === 'draw'
          ? `${summary.books.length} books each at the top.`
          : `${best} books to your ${summary.books.length}.`;
    const actions: ResultsAction[] = [];
    if (setup.kind === 'tournament') {
      const progress = tournamentFrom(this.saves.tournament.load());
      const finished = !progress || progress.results.length >= TOURNAMENT_ROUNDS.length;
      actions.push({
        id: 'again',
        label: finished
          ? 'New tournament'
          : `Next round (${(progress?.results.length ?? 0) + 1} of 5)`,
        key: 'R',
        primary: true,
        run: () => this.playAgain(),
      });
    } else {
      actions.push({
        id: 'again',
        label: 'Play again',
        key: 'R',
        primary: true,
        run: () => this.playAgain(),
      });
    }
    actions.push(
      { id: 'menu', label: 'Game menu', run: () => this.showTitle() },
      { id: 'hall', label: 'Back to the Hall', key: 'H', run: () => this.context.navigate('hall') },
    );
    if (setup.kind === 'daily')
      actions.push({ id: 'share', label: 'Share', key: 'S', run: () => this.shareDaily() });
    const model: ResultsModel = {
      kicker: this.modeLine(setup),
      title,
      story,
      mood: summary.outcome === 'win' ? 'won' : summary.outcome === 'draw' ? 'tied' : 'lost',
      catches: books.map((b, seat) => ({
        name: names[seat]!,
        books: b,
        winner: winners.includes(seat),
      })),
      stats: [
        { label: 'Your books', value: String(summary.books.length) },
        { label: 'Lucky casts', value: String(summary.luckyCasts) },
        { label: 'Notebook', value: summary.notebookUsed ? 'Used' : 'Closed' },
        { label: 'Games won', value: `${records.wins} of ${records.games}` },
      ],
      footnotes,
      actions,
    };
    this.director?.stop();
    this.director = null;
    this.hud?.element.remove();
    this.hud = null;
    this.veil.hidden = false;
    this.context.pauseMenuItems([]);
    const card = resultsCard(model, () => this.showTitle());
    this.results = card;
    this.root.append(card.element);
    this.listenForResultsKeys(card.element, actions);
    this.runBackdrop();
    card.focus();
  }

  private listenForResultsKeys(element: HTMLElement, actions: readonly ResultsAction[]): void {
    const shownAt = performance.now();
    element.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      // Keys still held from the last moment of play must not land on the card.
      if (performance.now() - shownAt < 600) return;
      const action = actions.find((a) => a.key?.toLowerCase() === event.key.toLowerCase());
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      action.run();
    });
  }

  playAgain(): void {
    const setup = this.setup;
    if (!setup || setup.kind === 'quick') return this.startQuick();
    if (setup.kind === 'daily')
      return this.begin(dailySetup(this.context.daily.seed(), this.context.daily.number()));
    this.playTournamentRound();
  }
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function tournamentLine(progress: ReturnType<typeof tournamentFrom>): string {
  if (!progress || progress.results.length === 0) return 'Five rounds, rivals growing smarter';
  const wins = progress.results.filter((r) => r === 'win').length;
  if (progress.results.length >= TOURNAMENT_ROUNDS.length) {
    return wins >= TOURNAMENT_WINS_NEEDED
      ? `Cup won, ${wins} of 5 · start another`
      : `${wins} of 5 won · start another`;
  }
  return `Round ${progress.results.length + 1} of 5 next · ${wins} won`;
}

function speciesName(rank: number): string {
  return speciesFor(rank as Rank).name;
}
