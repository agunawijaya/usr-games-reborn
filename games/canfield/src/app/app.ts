import type { GameContext, GameResult, PauseMenuItem } from '@usr-games/kit';
import {
  cardsHome,
  type DealSource,
  type Game,
  isWon,
  pointsOf,
  startGame,
  statementOfGame,
} from '../engine/game';
import {
  addStatements,
  emptyStatement,
  netOf,
  type Scoring,
  type Statement,
} from '../engine/ledger';
import { shuffledDeal } from '../engine/deals';
import type { RuleSet } from '../engine/rules';
import {
  type Challenge,
  CHALLENGES,
  conditionsMet,
  goalText,
  metBeforeTheEnd,
} from '../modes/challenges';
import { dailyShareText } from '../modes/daily';
import { PACKAGES, packagesForDeal, reserveCleared } from '../modes/packages';
import { TUTORIAL_DEAL, Tutor } from '../modes/tutorial';
import { formatTime } from '../play/clock';
import { DealTable } from '../play/deal-table';
import { SolverClient } from '../play/solver-client';
import { createTableSound, type TableSound } from '../play/sound';
import { lookFor, type Look } from '../render/look';
import { PosterPainter, posterLayout } from '../render/poster';
import { h } from '../ui/dom';
import { confirmDialog, money } from '../ui/panels';
import {
  type ResultsAction,
  type ResultsCard,
  resultsCard,
  type ResultsModel,
} from '../ui/results';
import {
  challengesScreen,
  dailyScreen,
  dealScreen,
  helpScreen,
  recordsScreen,
  type Screen,
  settingsScreen,
  titleScreen,
} from './menus';
import {
  bankFrom,
  type BankBook,
  currentFrom,
  DEFAULT_BANK,
  openSaves,
  type Prefs,
  prefsFrom,
  type Records,
  recordsFrom,
  type RulesRecord,
  type Saves,
} from './saves';

/**
 * Thirteen Down inside the Hall: the game menu and its pages, the deals themselves, and
 * everything the game tells the Hall (title screen, pause items, results, packages).
 */

type Run =
  | { kind: 'deal'; rules: RuleSet; scoring: Scoring; winnable: boolean }
  | { kind: 'daily' }
  | { kind: 'challenge'; challenge: Challenge }
  | { kind: 'tutorial' };

function randomSeed(): string {
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);
  return `${words[0]!.toString(36)}${words[1]!.toString(36)}`;
}

export class ThirteenApp {
  private readonly root: HTMLElement;
  private readonly saves: Saves;
  private readonly sound: TableSound;
  private readonly solver = new SolverClient();
  private readonly backdrop = h('canvas', { class: 'td-backdrop-art', 'aria-hidden': 'true' });
  private painter: PosterPainter;
  private backdropFrame = 0;
  private screen: Screen | null = null;
  private table: DealTable | null = null;
  private tutor: Tutor | null = null;
  private run: Run | null = null;
  private results: ResultsCard | null = null;
  /** A page shown over a paused deal (How to play), closed with its button or Escape. */
  private overlay: { element: HTMLElement; close: () => void } | null = null;
  private resultsKeys: ((event: KeyboardEvent) => void) | null = null;
  /** The Bank deals finished this visit: the original's "Game" column. */
  private sitting: Statement = emptyStatement();
  private readonly offered = new Set<string>();
  private readonly stops: (() => void)[] = [];
  private readonly escape = (event: KeyboardEvent) => this.onEscape(event);

  constructor(
    host: HTMLElement,
    private readonly context: GameContext,
    private readonly inHall = true,
  ) {
    this.saves = openSaves(context);
    this.sound = createTableSound(context.audio, () => this.prefs().sound);
    this.painter = new PosterPainter(this.look());
    this.root = h(
      'div',
      { class: `td-app${inHall ? ' is-in-hall' : ''}`, 'data-look': this.look().name },
      this.backdrop,
    );
    host.append(this.root);
    this.stops.push(
      context.onAppearanceChange(() => this.onLook()),
      context.onSettingsChange(() => context.audio.refresh()),
      context.onPause(() => this.table?.pause()),
      context.onResume(() => this.table?.resume()),
    );
    window.addEventListener('keydown', this.escape);
    this.stops.push(() => window.removeEventListener('keydown', this.escape));
    const resize = new ResizeObserver(() => this.paintBackdrop());
    resize.observe(this.root);
    this.stops.push(() => resize.disconnect());
    this.showTitle();
  }

  destroy(): void {
    this.clear();
    cancelAnimationFrame(this.backdropFrame);
    for (const stop of this.stops) stop();
    this.solver.dispose();
    this.root.remove();
  }

  // —— looks and saves ——

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

  private bank(): BankBook {
    return bankFrom(this.saves.bank.load());
  }

  private onLook(): void {
    const look = this.look();
    this.root.dataset.look = look.name;
    this.painter.setLook(look);
    this.paintBackdrop();
    this.table?.setLook();
  }

  // —— the backdrop behind the menus: the key art, alive ——

  private paintBackdrop(): void {
    cancelAnimationFrame(this.backdropFrame);
    if (this.table) return;
    const box = this.root.getBoundingClientRect();
    const width = Math.max(320, Math.round(box.width));
    const height = Math.max(320, Math.round(box.height));
    const scale = window.devicePixelRatio || 1;
    this.backdrop.width = Math.round(width * scale);
    this.backdrop.height = Math.round(height * scale);
    const ctx = this.backdrop.getContext('2d');
    if (!ctx) return;
    const layout = {
      ...posterLayout(width, height),
      x: width * 0.68,
      cardH: Math.min(height * 0.42, width * 0.2),
    };
    const started = performance.now() / 1000;
    const frame = () => {
      const time = performance.now() / 1000 - started;
      // The lotus opens a petal a second, rests in full bloom, then begins again.
      const cycle = time % 20;
      const bloom = this.reducedMotion() ? 9 : Math.min(13, 3 + cycle);
      this.painter.paint(ctx, width, height, scale, {
        time: this.reducedMotion() ? 0 : time,
        bloom,
        layout,
        motion: !this.reducedMotion(),
      });
      if (!this.reducedMotion() && !this.table) this.backdropFrame = requestAnimationFrame(frame);
    };
    frame();
  }

  // —— screens ——

  private show(screen: Screen): void {
    this.clear();
    this.screen = screen;
    this.root.append(screen.element);
    this.backdrop.hidden = false;
    this.root.classList.toggle('is-page', !screen.isTitle);
    this.context.setOnTitleScreen(screen.isTitle === true);
    this.context.pauseMenuItems([]);
    this.paintBackdrop();
    screen.focus();
  }

  private clear(): void {
    this.overlay?.element.remove();
    this.overlay = null;
    this.stopResultsKeys();
    this.results?.element.remove();
    this.results = null;
    this.tutor?.destroy();
    this.tutor = null;
    this.table?.destroy();
    this.table = null;
    this.screen?.element.remove();
    this.screen = null;
  }

  /** Escape on a page goes back to the game menu; on the game menu itself the Hall takes it. */
  private onEscape(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (this.overlay) {
      event.preventDefault();
      this.overlay.close();
      return;
    }
    if (this.results) {
      event.preventDefault();
      this.showTitle();
      return;
    }
    if (this.table || !this.screen) return;
    if (this.screen.isTitle) {
      if (!this.inHall) this.context.navigate('hall');
      return;
    }
    event.preventDefault();
    this.showTitle();
  }

  showTitle(): void {
    const current = currentFrom(this.saves.current.load());
    const prefs = this.prefs();
    const records = this.records();
    const challenges = this.saves.challenges.load();
    const today = this.saves.daily.load()[this.context.daily.dateKey()];
    this.show(
      titleScreen(
        {
          continueLine: current ? this.describeCurrent(current.game, current.elapsedMs) : null,
          dailyNumber: this.context.daily.number(),
          dailyLine: today
            ? today.won
              ? `In full bloom in ${formatTime(today.ms)}`
              : `${today.cardsHome} home today`
            : 'The same proven deal for everyone today',
          challengesDone: CHALLENGES.filter((c) => challenges[c.id]?.done).length,
          challengesTotal: CHALLENGES.length,
          tutorialDone: records.tutorialDone,
          scoring: prefs.scoring,
          rules: prefs.rules,
          balance: this.bank().balance,
        },
        {
          resume: () => this.resume(),
          newDeal: () => this.showDealSetup(),
          daily: () => this.showDaily(),
          challenges: () => this.showChallenges(),
          tutorial: () => void this.begin({ kind: 'tutorial' }),
          help: () => this.show(helpScreen(() => this.showTitle())),
          settings: () => this.showSettings(),
          records: () =>
            this.show(recordsScreen(this.records(), this.bank(), () => this.showTitle())),
        },
      ),
    );
  }

  private describeCurrent(game: Game, ms: number): string {
    const what =
      game.source.kind === 'daily'
        ? `Daily Deal #${game.source.daily}`
        : game.source.kind === 'challenge'
          ? `Challenge ${CHALLENGES.find((c) => c.id === game.source.challenge)?.number ?? ''}`
          : `${game.rules === 'standard' ? 'Standard' : 'Relaxed'} · ${game.scoring === 'bank' ? 'Bank' : 'Points'}`;
    return `${what} · ${cardsHome(game)} home · ${formatTime(ms)}`;
  }

  private showDealSetup(): void {
    this.show(
      dealScreen(this.prefs(), this.bank(), {
        change: (patch) => this.saves.prefs.update((p) => ({ ...prefsFrom(p), ...patch })),
        deal: () => {
          const prefs = this.prefs();
          void this.begin({
            kind: 'deal',
            rules: prefs.rules,
            scoring: prefs.scoring,
            winnable: prefs.winnableOnly,
          });
        },
        back: () => this.showTitle(),
      }),
    );
  }

  private showDaily(): void {
    const dateKey = this.context.daily.dateKey();
    const record = this.saves.daily.load()[dateKey];
    const records = this.records();
    this.show(
      dailyScreen(
        {
          number: this.context.daily.number(),
          dateLabel: new Date(`${dateKey}T12:00:00`).toLocaleDateString('en', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
          record,
          played: records.dailies,
          won: records.dailyWins,
        },
        {
          play: () => void this.begin({ kind: 'daily' }),
          share: () => record && void this.context.share(dailyShareText(record)),
          back: () => this.showTitle(),
        },
      ),
    );
  }

  private showChallenges(): void {
    this.show(
      challengesScreen(CHALLENGES, this.saves.challenges.load(), {
        play: (challenge) => void this.begin({ kind: 'challenge', challenge }),
        back: () => this.showTitle(),
      }),
    );
  }

  private showSettings(): void {
    this.show(
      settingsScreen(this.prefs(), this.bank(), {
        change: (patch) => {
          this.saves.prefs.update((p) => ({ ...prefsFrom(p), ...patch }));
          if ('fourColour' in patch) this.table?.setLook();
        },
        resetBank: () => void this.resetBank(),
        hallSettings: () => this.context.openSettings(),
        forget: () => void this.context.forgetData().then((forgot) => forgot && this.showTitle()),
        back: () => this.showTitle(),
      }),
    );
  }

  private async resetBank(): Promise<void> {
    const sure = await confirmDialog(this.root, {
      title: 'Reset the account?',
      body: 'The balance goes back to $500 of play money and the account book starts again. It costs nothing.',
      confirm: 'Reset',
      cancel: 'Keep it',
    });
    if (!sure) return;
    this.saves.bank.save(DEFAULT_BANK());
    this.sitting = emptyStatement();
    this.showSettings();
  }

  // —— deals ——

  private modeLine(game: Game): string {
    const source = game.source;
    if (source.kind === 'daily') return `Daily Deal #${source.daily}`;
    if (source.kind === 'tutorial') return 'Tutorial';
    if (source.kind === 'challenge') {
      const challenge = CHALLENGES.find((c) => c.id === source.challenge);
      return challenge ? `Challenge ${challenge.number} · ${challenge.title}` : 'Challenge';
    }
    return `${game.rules === 'standard' ? 'Standard' : 'Relaxed'} · ${game.scoring === 'bank' ? 'Bank' : 'Points'}`;
  }

  /** A deal left unfinished is ended before another begins; a Bank deal's charges stand. */
  private settleAbandoned(): void {
    const current = currentFrom(this.saves.current.load());
    if (!current) return;
    this.saves.current.save(null);
    if (current.game.scoring === 'bank') this.commitBank(statementOfGame(current.game));
  }

  private commitBank(statement: Statement): void {
    this.sitting = addStatements(this.sitting, statement);
    this.saves.bank.update((b) => {
      const book = bankFrom(b);
      return {
        balance: book.balance + netOf(statement),
        lifetime: addStatements(book.lifetime, statement),
        deals: book.deals + 1,
      };
    });
  }

  private async dealFor(
    run: Run,
  ): Promise<{ deal: number[]; source: DealSource; rules: RuleSet; scoring: Scoring }> {
    switch (run.kind) {
      case 'deal': {
        const seed = randomSeed();
        if (!run.winnable)
          return {
            deal: shuffledDeal(seed),
            source: { kind: 'random', seed },
            rules: run.rules,
            scoring: run.scoring,
          };
        const found = await this.solver.winnable(seed, run.rules);
        return {
          deal: found.deal,
          source: { kind: 'winnable', seed: found.seed },
          rules: run.rules,
          scoring: run.scoring,
        };
      }
      case 'daily': {
        const dateKey = this.context.daily.dateKey();
        const found = await this.solver.daily(dateKey);
        return {
          deal: found.deal,
          source: { kind: 'daily', seed: found.seed, daily: this.context.daily.number() },
          rules: 'standard',
          scoring: 'points',
        };
      }
      case 'challenge':
        return {
          deal: run.challenge.deal,
          source: { kind: 'challenge', seed: run.challenge.id, challenge: run.challenge.id },
          rules: run.challenge.rules,
          scoring: 'points',
        };
      case 'tutorial':
        return {
          deal: TUTORIAL_DEAL,
          source: { kind: 'tutorial', seed: 'tutorial' },
          rules: 'standard',
          scoring: 'points',
        };
    }
  }

  private async begin(run: Run): Promise<void> {
    // Starting is a click or a key press: the moment to wake the audio.
    void this.context.audio.resume();
    this.settleAbandoned();
    this.run = run;
    this.clear();
    const waiting = h(
      'p',
      { class: 'td-shuffling', role: 'status' },
      run.kind === 'deal' && run.winnable ? 'Shuffling for a deal that can be won…' : 'Shuffling…',
    );
    this.root.append(waiting);
    this.sound.shuffle();
    const found = await this.dealFor(run);
    waiting.remove();
    if (this.run !== run) return;
    const { game } = startGame(found.source, found.deal, found.rules, found.scoring);
    this.openTable(game, 0);
  }

  private resume(): void {
    const current = currentFrom(this.saves.current.load());
    if (!current) return this.showTitle();
    const source = current.game.source;
    const challenge =
      source.kind === 'challenge' ? CHALLENGES.find((c) => c.id === source.challenge) : undefined;
    this.run =
      source.kind === 'daily'
        ? { kind: 'daily' }
        : challenge
          ? { kind: 'challenge', challenge }
          : {
              kind: 'deal',
              rules: current.game.rules,
              scoring: current.game.scoring,
              winnable: source.kind === 'winnable',
            };
    this.clear();
    this.openTable(current.game, current.elapsedMs);
  }

  private openTable(game: Game, elapsedMs: number): void {
    cancelAnimationFrame(this.backdropFrame);
    this.backdrop.hidden = true;
    this.root.classList.remove('is-page');
    this.context.setOnTitleScreen(false);
    const tutorial = game.source.kind === 'tutorial';
    const challenge = this.run?.kind === 'challenge' ? this.run.challenge : null;
    let announced = false;
    // The hooks run from inside the table's constructor too: read the game through this.
    let live: DealTable | null = null;
    const now = () => live?.current ?? game;
    const table = new DealTable(
      this.root,
      { game, elapsedMs },
      {
        look: () => this.look(),
        reducedMotion: () => this.reducedMotion(),
        fourColour: () => this.prefs().fourColour,
        sound: this.sound,
        solver: this.solver,
        bank: () => {
          if (now().scoring !== 'bank') return null;
          const book = this.bank();
          return { balance: book.balance, sitting: this.sitting, lifetime: book.lifetime };
        },
        modeLine: () => this.modeLine(now()),
        onProgress: (g, ms) => {
          if (!tutorial) this.saves.current.save({ game: g, elapsedMs: ms });
        },
        onEnd: (g, ms) => this.finishDeal(g, ms),
        onHelp: () => this.showHelpOverTable(),
        onStep: (g, events) => {
          this.tutor?.step(g, events);
          if (reserveCleared(g)) this.install(['reserve-cleared']);
          if (
            challenge &&
            !announced &&
            metBeforeTheEnd(challenge.conditions) &&
            conditionsMet(challenge.conditions, g, this.table?.elapsedMs() ?? 0)
          ) {
            announced = true;
            this.markChallenge(challenge, g);
          }
        },
      },
    );
    live = table;
    this.table = table;
    if (tutorial) this.tutor = new Tutor(this.root, table, () => this.reducedMotion());
    this.refreshPauseItems();
    table.element.focus();
  }

  /** How to play, over the paused deal; closing it returns to the same moment. */
  private showHelpOverTable(): void {
    const table = this.table;
    if (!table || this.overlay) return;
    table.pause();
    const close = () => {
      this.overlay?.element.remove();
      this.overlay = null;
      this.root.classList.remove('is-page');
      table.resume();
      table.element.focus();
    };
    const help = helpScreen(close, '← Back to the deal');
    this.overlay = { element: help.element, close };
    this.root.classList.add('is-page');
    this.root.append(help.element);
    help.focus();
  }

  /** The game's own items in the Hall's pause menu. */
  private refreshPauseItems(): void {
    const table = this.table;
    if (!table) {
      this.context.pauseMenuItems([]);
      return;
    }
    const items: PauseMenuItem[] = [
      { id: 'undo', label: 'Take back a move', shortcut: 'Z', run: () => table.undo() },
      { id: 'hint', label: 'Hint', shortcut: 'H', run: () => void table.askHint() },
      {
        id: 'insight',
        label: 'Insight on or off',
        shortcut: 'C',
        run: () => table.toggleInsight(),
      },
      { id: 'end', label: 'End this deal', run: () => void table.quit() },
    ];
    this.context.pauseMenuItems(items);
  }

  // —— the end of a deal ——

  private install(ids: readonly string[]): string[] {
    const fresh: string[] = [];
    for (const id of ids) {
      if (this.offered.has(id) || !PACKAGES.some((p) => p.id === id)) continue;
      this.offered.add(id);
      if (this.context.installPackage(id)) fresh.push(id);
    }
    return fresh;
  }

  private markChallenge(challenge: Challenge, game: Game): boolean {
    let firstTime = false;
    this.saves.challenges.update((records) => {
      const before = records[challenge.id];
      firstTime = !before?.done;
      return {
        ...records,
        [challenge.id]: { done: true, best: Math.max(before?.best ?? 0, cardsHome(game)) },
      };
    });
    return firstTime;
  }

  private updateRecords(
    game: Game,
    ms: number,
    won: boolean,
    points: number,
  ): { record: RulesRecord; newBest: boolean; fastest: boolean } {
    let newBest = false;
    let fastest = false;
    const updated = this.saves.records.update((value) => {
      const records = recordsFrom(value);
      const before = records[game.rules];
      const counted = game.counters.moves > 0;
      newBest = game.scoring === 'points' && points > before.bestScore && counted;
      fastest = won && (before.bestMs === 0 || ms < before.bestMs);
      const run = won ? before.run + 1 : 0;
      const record: RulesRecord = {
        deals: before.deals + (counted ? 1 : 0),
        wins: before.wins + (won ? 1 : 0),
        bestScore: newBest ? points : before.bestScore,
        bestMs: fastest ? ms : before.bestMs,
        run,
        bestRun: Math.max(before.bestRun, run),
        cardsHome: before.cardsHome + cardsHome(game),
      };
      const isDaily = game.source.kind === 'daily';
      return {
        ...records,
        [game.rules]: record,
        tutorialDone: records.tutorialDone || game.source.kind === 'tutorial',
        dailies: records.dailies + (isDaily ? 1 : 0),
        dailyWins: records.dailyWins + (isDaily && won ? 1 : 0),
      };
    });
    return { record: recordsFrom(updated)[game.rules], newBest, fastest };
  }

  private finishDeal(game: Game, ms: number): void {
    const table = this.table;
    if (!table) return;
    this.saves.current.save(null);
    const won = isWon(game);
    const home = cardsHome(game);
    const points = pointsOf(game, ms);
    const statement = statementOfGame(game);
    const bank = game.scoring === 'bank';
    const source = game.source;
    if (bank) this.commitBank(statement);

    // The Daily: the first finish of the day is the one that counts.
    let dailyFirst = false;
    if (source.kind === 'daily') {
      const key = this.context.daily.dateKey();
      this.saves.daily.update((days) => {
        if (days[key]) return days;
        dailyFirst = true;
        return {
          ...days,
          [key]: {
            number: source.daily ?? 0,
            won,
            cardsHome: home,
            ms,
            insight: game.listed.length,
            score: points.total,
          },
        };
      });
    }
    const { record, newBest, fastest } =
      source.kind === 'daily' && !dailyFirst
        ? { record: this.records()[game.rules], newBest: false, fastest: false }
        : this.updateRecords(game, ms, won, points.total);

    const challenge = this.run?.kind === 'challenge' ? this.run.challenge : null;
    const challengeMet = challenge ? conditionsMet(challenge.conditions, game, ms) : false;
    const challengeNew = challenge && challengeMet ? this.markChallenge(challenge, game) : false;
    const challengesDone = CHALLENGES.filter(
      (c) => this.saves.challenges.load()[c.id]?.done,
    ).length;
    const records = this.records();

    const earned = packagesForDeal({
      game,
      won,
      elapsedMs: ms,
      totalWins: records.standard.wins + records.relaxed.wins,
      winRun: record.run,
      dailies: records.dailies,
      challengesDone,
      sittingNet: bank ? netOf(this.sitting) : null,
    });
    this.install(earned);

    const outcome: GameResult['outcome'] =
      source.kind === 'tutorial'
        ? 'complete'
        : won
          ? 'win'
          : game.counters.moves === 0
            ? 'quit'
            : 'loss';
    const xpEvents = [
      ...(won ? [{ id: 'bloom', xp: 18 }] : []),
      ...(home >= 26 ? [{ id: 'half-home', xp: 6 }] : []),
      ...(challengeNew ? [{ id: 'challenge', xp: 10 }] : []),
    ];
    const receipt = this.context.reportResult({
      outcome,
      score: bank ? home * 5 : points.total,
      stats: { deals: 1, wins: won ? 1 : 0, cardsHome: home },
      xpEvents,
      daily: dailyFirst,
      durationSeconds: Math.round(ms / 1000),
      presentation: 'game',
    });

    const footnotes: string[] = [];
    if (receipt.xpGained > 0) footnotes.push(`+${receipt.xpGained} XP`);
    for (const id of receipt.packagesInstalled) {
      const pkg = PACKAGES.find((p) => p.id === id);
      if (pkg) footnotes.push(`Package installed: ${pkg.title}`);
    }
    if (newBest) footnotes.push('A new best score.');
    if (fastest) footnotes.push('Your fastest win yet.');
    if (won && record.run > 1) footnotes.push(`${record.run} wins in a row.`);
    if (challenge)
      footnotes.push(
        challengeMet
          ? challengeNew
            ? 'Challenge done.'
            : 'Challenge done again.'
          : `The goal: ${goalText(challenge.conditions)}`,
      );
    if (source.kind === 'daily' && !dailyFirst)
      footnotes.push('Today’s first finish is the one that counts.');

    this.showResults(game, ms, {
      won,
      home,
      points,
      statement,
      footnotes,
      challenge,
      challengeMet,
      dailyFirst,
    });
  }

  private resultsTitle(
    game: Game,
    won: boolean,
    home: number,
  ): { title: string; story: string; mood: ResultsModel['mood'] } {
    if (won)
      return {
        title: 'In full bloom',
        story: `All fifty-two home in ${game.layout.run === 1 ? 'a single pass' : `${game.layout.run} passes`}.`,
        mood: 'won',
      };
    switch (game.ending) {
      case 'stalled':
        return {
          title: `${home} cards home`,
          story:
            'The talon went round four times in a row without a card moving, which ends a Standard deal, as it always did at Berkeley.',
          mood: 'lost',
        };
      case 'walked-away':
        return {
          title: 'Walked away',
          story:
            game.layout.stage === 'dealt'
              ? 'You looked at the deal and let it go.'
              : 'You inspected the deal and let it go.',
          mood: 'ended',
        };
      default:
        return { title: `${home} cards home`, story: 'You ended the deal there.', mood: 'ended' };
    }
  }

  private showResults(
    game: Game,
    ms: number,
    facts: {
      won: boolean;
      home: number;
      points: ReturnType<typeof pointsOf>;
      statement: Statement;
      footnotes: string[];
      challenge: Challenge | null;
      challengeMet: boolean;
      dailyFirst: boolean;
    },
  ): void {
    const { won, home, points, statement } = facts;
    const words = this.resultsTitle(game, won, home);
    const breakdown =
      game.scoring === 'bank'
        ? [
            {
              label: 'Costs',
              value: money(
                -(
                  statement.deals +
                  statement.inspections +
                  statement.games +
                  statement.runs +
                  statement.information +
                  statement.thinkTime +
                  statement.undo +
                  statement.hints
                ),
              ),
            },
            { label: 'Cards home', value: money(statement.winnings) },
            { label: 'This deal', value: money(netOf(statement)), total: true },
            { label: 'Balance', value: money(this.bank().balance), total: true },
          ]
        : [
            { label: 'Cards home', value: `+${points.cards}` },
            ...(won
              ? [
                  { label: 'The bloom', value: `+${points.winBonus}` },
                  { label: 'Time', value: `+${points.timeBonus}` },
                ]
              : []),
            ...(points.charges > 0
              ? [{ label: 'Passes, Insight, undo, hints', value: `−${points.charges}` }]
              : []),
            { label: 'Score', value: String(points.total), total: true },
          ];
    const actions: ResultsAction[] = [
      { id: 'again', label: 'Play again', key: 'R', primary: true, run: () => this.playAgain() },
      { id: 'menu', label: 'Game menu', run: () => this.showTitle() },
      { id: 'hall', label: 'Back to the Hall', key: 'H', run: () => this.context.navigate('hall') },
    ];
    if (game.source.kind === 'daily') {
      const today = this.saves.daily.load()[this.context.daily.dateKey()];
      if (today)
        actions.push({
          id: 'share',
          label: 'Share',
          key: 'S',
          run: () => void this.context.share(dailyShareText(today)),
        });
    }
    if (facts.challenge && facts.challengeMet) {
      const next = CHALLENGES.find((c) => c.number === facts.challenge!.number + 1);
      if (next)
        actions.push({
          id: 'next',
          label: `Next: ${next.title}`,
          key: 'N',
          run: () => void this.begin({ kind: 'challenge', challenge: next }),
        });
    }
    const model: ResultsModel = {
      kicker: `${this.modeLine(game)} · Base ${['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][game.layout.baseRank]}`,
      title: words.title,
      story: words.story,
      mood: words.mood,
      stats: [
        { label: 'Cards home', value: `${home}/52` },
        { label: 'Time', value: formatTime(ms) },
        { label: 'Passes', value: String(game.layout.run) },
        { label: 'Insight', value: `${game.listed.length} cards` },
        { label: 'Undo · hints', value: `${game.counters.undos} · ${game.counters.hints}` },
      ],
      breakdown,
      verdict:
        !won && game.source.kind !== 'tutorial'
          ? 'Could this deal have been won? Asking the solver…'
          : null,
      footnotes: facts.footnotes,
      actions,
    };
    const card = resultsCard(model);
    this.results = card;
    this.root.append(card.element);
    card.focus();
    this.context.pauseMenuItems([]);
    this.listenForResultsKeys(actions);
    if (model.verdict)
      void this.solver.dealVerdict(game.deal, game.rules).then((verdict) => {
        if (this.results !== card) return;
        card.setVerdict(
          verdict.result === 'winnable'
            ? `This deal could have been won: the solver found a way through in ${verdict.line.filter((m) => m.kind !== 'deal').length} moves.`
            : verdict.result === 'unwinnable'
              ? 'No one could have won this deal: there was no way through.'
              : 'Too tangled to settle: the solver could not decide in time.',
        );
      });
  }

  private listenForResultsKeys(actions: readonly ResultsAction[]): void {
    this.stopResultsKeys();
    const shownAt = performance.now();
    this.resultsKeys = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      // Keys held from the last moment of play must not land on the card as it appears.
      if (performance.now() - shownAt < 600) return;
      const action = actions.find((a) => a.key?.toLowerCase() === event.key.toLowerCase());
      if (!action) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      action.run();
    };
    window.addEventListener('keydown', this.resultsKeys, true);
  }

  private stopResultsKeys(): void {
    if (this.resultsKeys) window.removeEventListener('keydown', this.resultsKeys, true);
    this.resultsKeys = null;
  }

  playAgain(): void {
    const run = this.run;
    if (!run || run.kind === 'tutorial') {
      const prefs = this.prefs();
      void this.begin({
        kind: 'deal',
        rules: prefs.rules,
        scoring: prefs.scoring,
        winnable: prefs.winnableOnly,
      });
      return;
    }
    // A new deal takes the scoring chosen now: a change in Settings applies from the next deal.
    if (run.kind === 'deal') {
      const prefs = this.prefs();
      void this.begin({
        ...run,
        scoring: prefs.scoring,
        rules: prefs.rules,
        winnable: prefs.winnableOnly,
      });
      return;
    }
    void this.begin(run);
  }
}
