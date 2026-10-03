import type { GameContext, GameResult, PauseMenuItem } from '@usr-games/kit';
import { opponentById, OPPONENTS, type OpponentId } from '../engine/opponents';
import { packagesForGame, packagesForPuzzles, PACKAGES } from '../modes/packages';
import { dailyPuzzle, PUZZLES } from '../modes/puzzles';
import { type GameMode, GameSession, type GameSummary, rulesLabel } from '../play/session';
import { LeagueSession, type LeagueMatch, type LeagueOutcome } from '../play/league';
import { PuzzleSession, type PuzzleOutcome, type PuzzleRun } from '../play/puzzle-session';
import { ReplaySession } from '../play/replay';
import { createFivefoldSound, type FivefoldSound } from '../play/sound';
import { TutorialSession } from '../play/tutorial';
import { lookFor, type Look } from '../render/look';
import type { CardAction, ResultsModel } from '../ui/cards';
import { h } from '../ui/dom';
import { isOpen, WINS_TO_CLIMB } from '../ui/ladder-screen';
import { dailyShareText } from '../modes/daily';
import {
  dailyScreen,
  helpScreen,
  ladderScreen,
  leagueScreen,
  localScreen,
  puzzlesScreen,
  type Screen,
  settingsScreen,
  titleScreen,
} from './menus';
import {
  type GameSettings,
  type Ladder,
  ladderFrom,
  openSaves,
  type Saves,
  settingsFrom,
} from './saves';

/**
 * Fivefold inside the Hall: the screens before and after a game, the games themselves, and
 * everything the game tells the Hall (title screen, pause items, results, packages).
 */

type Session = GameSession | PuzzleSession | TutorialSession | LeagueSession | ReplaySession;

type Again =
  | { kind: 'game'; mode: GameMode }
  | { kind: 'puzzle'; run: PuzzleRun }
  | { kind: 'league'; match: LeagueMatch }
  | { kind: 'tutorial' };

export class FivefoldApp {
  private readonly root: HTMLElement;
  private readonly saves: Saves;
  private readonly sound: FivefoldSound;
  private screen: Screen | null = null;
  private session: Session | null = null;
  /** The finished game, hidden behind its replay, with its results card still on it. */
  private parked: GameSession | null = null;
  private again: Again | null = null;
  /** The last results, to come back to from the replay. */
  private lastResults: { model: ResultsModel; summary: GameSummary } | null = null;
  /** Packages already offered to the Hall in this visit; the Hall keeps the real record. */
  private readonly offered = new Set<string>();
  private readonly stops: (() => void)[] = [];
  private resultsKeys: ((event: KeyboardEvent) => void) | null = null;
  private readonly escape = (event: KeyboardEvent) => this.onEscape(event);

  constructor(
    host: HTMLElement,
    private readonly context: GameContext,
    private readonly inHall = true,
  ) {
    this.saves = openSaves(context);
    this.sound = createFivefoldSound(context.audio, () => this.settings().sound);
    this.root = h('div', { class: `ff-app${inHall ? ' is-in-hall' : ''}` });
    host.append(this.root);
    this.stops.push(
      context.onAppearanceChange(() => {
        this.screen?.setLook?.(this.look());
        this.session?.setLook(this.look());
      }),
      context.onSettingsChange(() => context.audio.refresh()),
      context.onPause(() => this.session?.pause()),
      context.onResume(() => this.session?.resume()),
    );
    window.addEventListener('keydown', this.escape, true);
    this.stops.push(() => window.removeEventListener('keydown', this.escape, true));
    this.showTitle();
  }

  // —— look, settings, saves ——

  private look(): Look {
    return lookFor(this.context.appearance().appearance === 'dark');
  }

  private reducedMotion(): boolean {
    return this.context.appearance().reducedMotion;
  }

  private settings(): GameSettings {
    return settingsFrom(this.saves.settings.load());
  }

  private updateSettings(patch: Partial<GameSettings>): void {
    this.saves.settings.update((s) => ({ ...settingsFrom(s), ...patch }));
  }

  private ladder(): Ladder {
    return ladderFrom(this.saves.ladder.load());
  }

  /** The highest open opponent not yet beaten twice, or Campbell. */
  private nextOpponent(ladder = this.ladder()): OpponentId {
    const next = OPPONENTS.find(
      (o) =>
        o.id !== 'referee' &&
        isOpen(ladder.records, o) &&
        ladder.records[o.id].wins < WINS_TO_CLIMB,
    );
    return next?.id ?? (isOpen(ladder.records, opponentById('referee')) ? 'referee' : 'campbell');
  }

  // —— screens ——

  private show(screen: Screen): void {
    this.clear();
    this.screen = screen;
    this.root.append(screen.element);
    screen.mounted?.();
    this.context.setOnTitleScreen(screen.isTitle === true);
    this.context.pauseMenuItems([]);
    screen.focus?.();
  }

  private clear(): void {
    this.stopResultsKeys();
    this.session?.destroy();
    this.session = null;
    this.parked?.destroy();
    this.parked = null;
    this.screen?.destroy?.();
    this.screen?.element.remove();
    this.screen = null;
  }

  /** Escape on a page goes back to the game menu; on the game menu itself the Hall takes it. */
  private onEscape(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || this.session || !this.screen || event.defaultPrevented) return;
    if (this.screen.isTitle) {
      if (!this.inHall) this.context.navigate('hall');
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    this.showTitle();
  }

  showTitle(): void {
    const ladder = this.ladder();
    const next = opponentById(this.nextOpponent(ladder));
    const puzzles = this.saves.puzzles.load();
    const counters = this.saves.counters.load();
    const daily = this.saves.daily.load()[this.context.daily.dateKey()];
    this.show(
      titleScreen(
        this.look(),
        {
          nextOpponent: next.name,
          nextRung: next.id === 'referee' ? 'beyond the ladder' : `rung ${next.rung}`,
          puzzlesSolved: PUZZLES.filter((p) => puzzles[p.id]?.solved).length,
          dailyNumber: this.context.daily.number(),
          daily: {
            moves: dailyPuzzle(this.context.daily.number()).moves,
            solved: daily?.solved ?? false,
          },
          tutorialDone: counters.tutorialDone,
        },
        {
          ladder: () => this.showLadder(),
          puzzles: () => this.showPuzzles(),
          daily: () => this.showDaily(),
          tutorial: () => this.playTutorial(),
          local: () => this.showLocal(),
          league: () => this.showLeague(),
          help: () =>
            this.show(
              helpScreen(this.look(), () => this.showTitle(), this.reducedMotion(), this.inHall),
            ),
          settings: () => this.showSettings(),
          hall: this.inHall ? undefined : () => this.context.navigate('hall'),
        },
        this.reducedMotion(),
        this.inHall,
      ),
    );
  }

  private showLadder(): void {
    const ladder = this.ladder();
    const settings = this.settings();
    const chosen = isOpen(ladder.records, opponentById(ladder.chosen))
      ? ladder.chosen
      : this.nextOpponent(ladder);
    this.show(
      ladderScreen(
        this.look(),
        {
          records: ladder.records,
          chosen,
          size: settings.size,
          rules: settings.rules,
          moveFirst: settings.moveFirst,
          ranked: settings.ranked,
        },
        {
          change: (model) => {
            this.saves.ladder.update((l) => ({ ...ladderFrom(l), chosen: model.chosen }));
            this.updateSettings({
              size: model.size,
              rules: model.rules,
              moveFirst: model.moveFirst,
              ranked: model.ranked,
            });
          },
          play: (model) =>
            this.playGame({
              kind: 'ladder',
              opponent: model.chosen,
              ranked: model.ranked,
              size: model.size,
              rules: model.rules,
              youFirst: model.moveFirst,
              seed: `${Date.now()}`,
            }),
        },
        () => this.showTitle(),
        this.reducedMotion(),
        this.inHall,
      ),
    );
  }

  private showPuzzles(): void {
    this.show(
      puzzlesScreen(
        this.look(),
        this.saves.puzzles.load(),
        (puzzle) => this.playPuzzle({ puzzle, daily: null }),
        () => this.showTitle(),
        this.reducedMotion(),
        this.inHall,
      ),
    );
  }

  private dailyRun(): PuzzleRun {
    const number = this.context.daily.number();
    return { puzzle: dailyPuzzle(number), daily: { number } };
  }

  private showDaily(): void {
    const run = this.dailyRun();
    const history = this.saves.daily.load();
    const record = history[this.context.daily.dateKey()];
    this.show(
      dailyScreen(
        this.look(),
        {
          number: run.daily!.number,
          puzzle: run.puzzle,
          record,
          solvedDays: Object.values(history).filter((r) => r.solved).length,
        },
        {
          play: () => this.playPuzzle(run),
          share: () => record?.solved && void this.context.share(dailyShareText(record)),
        },
        () => this.showTitle(),
        this.reducedMotion(),
        this.inHall,
      ),
    );
  }

  private showLocal(): void {
    this.show(
      localScreen(
        this.look(),
        this.settings(),
        {
          start: (size, rules) => this.playGame({ kind: 'local', size, rules }),
          change: (patch) => this.updateSettings(patch),
        },
        () => this.showTitle(),
        this.reducedMotion(),
        this.inHall,
      ),
    );
  }

  private showLeague(): void {
    const settings = this.settings();
    this.show(
      leagueScreen(
        this.look(),
        { first: 'heron', second: 'campbell', speed: settings.leagueSpeed },
        {
          start: (choice) =>
            this.playLeague({
              first: choice.first,
              second: choice.second,
              speed: choice.speed,
              size: settings.size,
              rules: settings.rules,
            }),
          change: (speed) => this.updateSettings({ leagueSpeed: speed }),
        },
        () => this.showTitle(),
        this.reducedMotion(),
        this.inHall,
      ),
    );
  }

  private showSettings(): void {
    this.show(
      settingsScreen(
        this.look(),
        this.settings(),
        (patch) => this.updateSettings(patch),
        {
          openSettings: () => this.context.openSettings(),
          forgetData: () =>
            void this.context.forgetData().then((forgot) => forgot && this.showTitle()),
        },
        () => this.showTitle(),
        this.reducedMotion(),
        this.inHall,
      ),
    );
  }

  // —— sessions ——

  private common() {
    return {
      look: () => this.look(),
      reducedMotion: () => this.reducedMotion(),
      sound: this.sound,
      ownPause: !this.inHall,
      inHall: this.inHall,
      onGameMenu: () => void this.leaveSession(),
      onPause: () => this.pauseFromGame(),
    };
  }

  private begin(session: Session, again: Again | null): void {
    // Starting is a click or a key press: the moment to wake the audio.
    void this.context.audio.resume();
    this.session = session;
    if (again) this.again = again;
    this.context.setOnTitleScreen(false);
    this.refreshPauseItems();
  }

  playGame(mode: GameMode): void {
    this.clear();
    const session = new GameSession(this.root, mode, {
      ...this.common(),
      settings: () => this.settings(),
      updateSettings: (patch) => this.updateSettings(patch),
      record: (id) => {
        const r = this.ladder().records[id];
        return { wins: r.wins, needed: WINS_TO_CLIMB, star: r.star };
      },
      onEnd: (summary) => this.finishGame(summary),
      onReadChanged: () => this.refreshPauseItems(),
    });
    this.begin(session, { kind: 'game', mode });
  }

  private playPuzzle(run: PuzzleRun): void {
    this.clear();
    const index = PUZZLES.findIndex((p) => p.id === run.puzzle.id);
    const next = !run.daily && index >= 0 ? PUZZLES[index + 1] : undefined;
    const session = new PuzzleSession(this.root, run, {
      ...this.common(),
      settings: () => this.settings(),
      updateSettings: (patch) => this.updateSettings(patch),
      onSolved: (outcome) => this.finishPuzzle(outcome),
      onNext: next ? () => this.playPuzzle({ puzzle: next, daily: null }) : undefined,
    });
    this.begin(session, { kind: 'puzzle', run });
  }

  private playTutorial(): void {
    this.clear();
    const session = new TutorialSession(this.root, {
      ...this.common(),
      onDone: () => this.finishTutorial(),
    });
    this.begin(session, { kind: 'tutorial' });
  }

  private playLeague(match: LeagueMatch): void {
    this.clear();
    const session = new LeagueSession(this.root, match, {
      ...this.common(),
      onEnd: (outcome) => this.finishLeague(outcome),
    });
    this.begin(session, { kind: 'league', match });
  }

  private showReplay(): void {
    const last = this.lastResults;
    const finished = this.session;
    if (!last || !(finished instanceof GameSession)) return;
    const { summary } = last;
    this.stopResultsKeys();
    // The finished game waits, hidden, with its results card, for the way back.
    this.parked = finished;
    finished.stage.screen.root.hidden = true;
    const opponent = summary.mode.kind === 'ladder' ? summary.mode.opponent : null;
    const session = new ReplaySession(
      this.root,
      {
        size: summary.game.size,
        moves: summary.game.moves,
        weighings: summary.weighings,
        opponent,
        you: summary.you,
        ending: this.endingLine(summary),
      },
      {
        ...this.common(),
        onBack: () => this.backToResults(),
      },
    );
    this.begin(session, null);
  }

  /** From the replay, back to the finished game and its results. */
  private backToResults(): void {
    const parked = this.parked;
    if (!parked) return this.showTitle();
    this.parked = null;
    this.session?.destroy();
    this.session = parked;
    parked.stage.screen.root.hidden = false;
    this.refreshPauseItems();
    parked.stage.screen.root.querySelector<HTMLElement>('.ff-results h2')?.focus();
    this.listenForResultsKeys();
  }

  /**
   * The game's Pause button asks for the Hall's pause as Escape would: the kit has no call for
   * it, so an Escape key event is sent from the focused element, bubbling as a real one.
   */
  private pauseFromGame(): void {
    const from =
      document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
    from.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
    );
  }

  /** The game's own items in the Hall's pause menu. */
  private refreshPauseItems(): void {
    const session = this.session;
    const items: PauseMenuItem[] = [];
    if (session instanceof GameSession) {
      if (session.readAllowed)
        items.push({
          id: 'read',
          label: session.isReadOn ? 'Read the board: on' : 'Read the board: off',
          shortcut: 'T',
          run: () => session.setRead(!session.isReadOn),
        });
      if (session.mode.kind === 'local' || !session.mode.ranked)
        items.push({
          id: 'take-back',
          label: 'Take back a move',
          shortcut: 'Z',
          run: () => session.takeBack(),
        });
    } else if (session instanceof PuzzleSession) {
      items.push(
        { id: 'try-again', label: 'Try again', shortcut: 'R', run: () => session.tryAgain() },
        {
          id: 'show-me',
          label: 'Show me the answer',
          shortcut: 'S',
          run: () => void session.showMe(),
        },
      );
    } else if (session instanceof LeagueSession) {
      items.push({
        id: 'thinking',
        label: 'Show or hide their thinking',
        shortcut: 'W',
        run: () => session.toggleThoughts(),
      });
    } else if (session instanceof ReplaySession) {
      items.push({ id: 'results', label: 'Back to the results', run: () => this.backToResults() });
    }
    this.context.pauseMenuItems(items);
  }

  private async leaveSession(): Promise<void> {
    const session = this.session;
    if (!session) return;
    if (!(session instanceof GameSession) || session.isOver) {
      this.showTitle();
      return;
    }
    session.pause();
    const leave = await session.confirm({
      title: 'Leave this game?',
      body: 'The board clears and this game will not count.',
      confirm: 'Leave',
      cancel: 'Keep playing',
    });
    if (this.session !== session) return;
    if (leave) this.showTitle();
    else session.resume();
  }

  // —— endings ——

  private install(ids: readonly string[]): void {
    for (const id of ids) {
      if (this.offered.has(id) || !PACKAGES.some((p) => p.id === id)) continue;
      this.offered.add(id);
      this.context.installPackage(id);
    }
  }

  private report(result: Omit<GameResult, 'presentation'>): string[] {
    const receipt = this.context.reportResult({ ...result, presentation: 'game' });
    return receipt.xpGained > 0 ? [`+${receipt.xpGained} XP`] : [];
  }

  private baseActions(again: () => void, againLabel = 'Play again'): CardAction[] {
    return [
      { label: againLabel, key: 'R', primary: true, run: again },
      { label: 'Game menu', run: () => this.showTitle() },
      { label: 'Back to the Hall', key: 'H', run: () => this.context.navigate('hall') },
    ];
  }

  private endingLine(summary: GameSummary): string {
    const { game } = summary;
    if (game.draw) return 'The board filled with no five: a draw.';
    const look = this.look();
    const line = game.winningLine!;
    const size = game.size;
    const name = (p: number) => `${'ABCDEFGHJKLMNOPQRST'[p % size]}${size - Math.floor(p / size)}`;
    const who =
      summary.mode.kind === 'ladder'
        ? game.winner === (summary.you === 0 ? 'black' : 'white')
          ? 'Your'
          : `${opponentById(summary.mode.opponent).name}’s`
        : `${look.pieces[game.winner === 'black' ? 0 : 1]!.name}’s`;
    return `${who} five, ${name(line[0]!)} to ${name(line[line.length - 1]!)}, on move ${game.moves.length}.`;
  }

  private finishGame(summary: GameSummary): void {
    const session = this.session;
    if (!(session instanceof GameSession)) return;
    const { game, mode } = summary;
    const yourStone = summary.you === 0 ? 'black' : 'white';
    const won = game.winner === yourStone;
    const yourMoves = game.moves.filter((_, i) => i % 2 === summary.you).length;
    const minutes = Math.floor(summary.durationSeconds / 60);
    const seconds = summary.durationSeconds % 60;
    const stats = [
      { label: 'Moves', value: String(game.moves.length) },
      { label: 'Time', value: `${minutes}:${String(seconds).padStart(2, '0')}` },
      { label: 'Board', value: `${game.size} × ${game.size}` },
      { label: 'Rules', value: rulesLabel(game.rules) },
    ];
    this.saves.counters.update((c) => ({ ...c, games: c.games + 1, wins: c.wins + (won ? 1 : 0) }));
    let model: ResultsModel;
    if (mode.kind === 'local') {
      const look = this.look();
      const winner = game.winner ? look.pieces[game.winner === 'black' ? 0 : 1]!.name : null;
      model = {
        kicker: `Two players · ${rulesLabel(mode.rules)}`,
        title: winner ? `${winner} wins` : 'A full board',
        story: this.endingLine(summary),
        stats,
        mood: winner ? 'won' : 'drawn',
        actions: [
          ...this.baseActions(() => this.playAgain()),
          { label: 'Watch the replay', key: 'W', run: () => this.showReplay() },
        ],
        footnotes: this.report({
          outcome: 'complete',
          durationSeconds: summary.durationSeconds,
          stats: { games: 1 },
        }),
      };
      this.install(packagesForGame({ ...this.facts(summary, won, yourMoves), opponent: null }));
    } else {
      const opponent = opponentById(mode.opponent);
      let climbed = false;
      let starNew = false;
      if (won)
        this.saves.ladder.update((l) => {
          const ladder = ladderFrom(l);
          const beaten = ladder.beaten.includes(opponent.id)
            ? ladder.beaten
            : [...ladder.beaten, opponent.id];
          if (!mode.ranked) return { ...ladder, beaten };
          const before = ladder.records[opponent.id];
          const wins = before.wins + 1;
          climbed = before.wins < WINS_TO_CLIMB && wins >= WINS_TO_CLIMB;
          starNew = summary.you === 1 && !before.star;
          return {
            ...ladder,
            beaten,
            records: {
              ...ladder.records,
              [opponent.id]: {
                ...before,
                wins,
                star: before.star || summary.you === 1,
                games: before.games + 1,
              },
            },
          };
        });
      else if (mode.ranked)
        this.saves.ladder.update((l) => {
          const ladder = ladderFrom(l);
          const before = ladder.records[opponent.id];
          return {
            ...ladder,
            records: { ...ladder.records, [opponent.id]: { ...before, games: before.games + 1 } },
          };
        });
      const ladder = this.ladder();
      const record = ladder.records[opponent.id];
      const nextUp = OPPONENTS.find((o) => o.rung === opponent.rung + 1);
      const footnotes: string[] = [];
      if (climbed && nextUp)
        footnotes.push(`${opponent.name} is beaten twice: ${nextUp.name} is waiting.`);
      if (starNew) footnotes.push(`A star for beating ${opponent.name} moving second.`);
      if (!mode.ranked) footnotes.push('A practice game: it does not count on the ladder.');
      const actions: CardAction[] = [
        ...this.baseActions(() => this.playAgain()),
        { label: 'Watch the replay', key: 'W', run: () => this.showReplay() },
      ];
      if (nextUp && isOpen(ladder.records, nextUp) && record.wins >= WINS_TO_CLIMB)
        actions.push({
          label: `Next: ${nextUp.name}`,
          key: 'N',
          run: () => {
            this.saves.ladder.update((l) => ({ ...ladderFrom(l), chosen: nextUp.id }));
            this.playGame({ ...mode, opponent: nextUp.id, seed: `${Date.now()}` });
          },
        });
      const xp = won ? [{ id: 'win', xp: 8 + opponent.rung * 3 }] : [{ id: 'game', xp: 3 }];
      footnotes.push(
        ...this.report({
          outcome: game.draw ? 'draw' : won ? 'win' : 'loss',
          durationSeconds: summary.durationSeconds,
          stats: { games: 1, wins: won ? 1 : 0, moves: yourMoves },
          xpEvents: mode.ranked ? xp : [{ id: 'practice', xp: 2 }],
        }),
      );
      model = {
        kicker: `${mode.ranked ? 'Ladder' : 'Practice'} · ${opponent.name}`,
        title: game.draw ? 'A full board' : won ? 'Five in a row' : `${opponent.name} wins`,
        story: `“${game.draw ? opponent.afterDraw : won ? opponent.afterLoss : opponent.afterWin}” ${this.endingLine(summary)}`,
        stats,
        record: mode.ranked
          ? { name: opponent.name, wins: record.wins, needed: WINS_TO_CLIMB, star: record.star }
          : null,
        footnotes,
        mood: game.draw ? 'drawn' : won ? 'won' : 'lost',
        actions,
      };
      this.install(packagesForGame(this.facts(summary, won, yourMoves)));
    }
    this.lastResults = { model, summary };
    session.showResults(model);
    this.listenForResultsKeys();
  }

  private facts(summary: GameSummary, won: boolean, yourMoves: number) {
    return {
      opponent: summary.mode.kind === 'ladder' ? summary.mode.opponent : null,
      won,
      second: summary.you === 1,
      rules: summary.game.rules,
      yourMoves,
      readTheBoard: summary.readEverOn,
      fourFour: summary.fourFour,
      beaten: this.ladder().beaten,
    };
  }

  private finishPuzzle(outcome: PuzzleOutcome): void {
    const session = this.session;
    if (!(session instanceof PuzzleSession)) return;
    const { run } = outcome;
    const daily = run.daily;
    let countedDaily = false;
    if (daily) {
      const key = this.context.daily.dateKey();
      this.saves.daily.update((history) => {
        const before = history[key];
        if (before?.solved) return history;
        countedDaily = outcome.solved;
        return {
          ...history,
          [key]: {
            number: daily.number,
            solved: outcome.solved,
            tries: (before?.tries ?? 0) + outcome.tries,
            moves: outcome.solved ? outcome.moves : 0,
          },
        };
      });
    } else
      this.saves.puzzles.update((records) => {
        const before = records[run.puzzle.id];
        if (before?.solved) return records;
        return {
          ...records,
          [run.puzzle.id]: { solved: outcome.solved, tries: (before?.tries ?? 0) + outcome.tries },
        };
      });
    if (!outcome.solved) return;
    const puzzles = this.saves.puzzles.load();
    const solvedCount = PUZZLES.filter((p) => puzzles[p.id]?.solved).length;
    const dailies = Object.values(this.saves.daily.load()).filter((r) => r.solved).length;
    this.install(packagesForPuzzles(solvedCount, dailies));
    const footnotes = this.report({
      outcome: 'win',
      stats: { puzzles: 1 },
      xpEvents: [{ id: 'puzzle', xp: 3 + run.puzzle.moves * 2 }],
      daily: countedDaily,
    });
    const index = PUZZLES.findIndex((p) => p.id === run.puzzle.id);
    const next = !daily && index >= 0 ? PUZZLES[index + 1] : undefined;
    const actions: CardAction[] = this.baseActions(() => this.playAgain(), 'Play it again');
    if (next)
      actions.push({
        label: `Next: puzzle ${next.number}`,
        key: 'N',
        run: () => this.playPuzzle({ puzzle: next, daily: null }),
      });
    const record = daily ? this.saves.daily.load()[this.context.daily.dateKey()] : undefined;
    if (record?.solved)
      actions.push({ label: 'Share', run: () => void this.context.share(dailyShareText(record)) });
    session.showResults({
      kicker: daily ? `Daily Puzzle #${daily.number}` : `Puzzle ${run.puzzle.number}`,
      title: 'Solved',
      story: `Five in a row in ${outcome.moves} move${outcome.moves === 1 ? '' : 's'}${outcome.tries > 1 ? `, on try ${outcome.tries}` : ', first try'}.`,
      stats: daily
        ? []
        : [{ label: 'Puzzles solved', value: `${solvedCount} of ${PUZZLES.length}` }],
      footnotes: [
        ...(daily
          ? [
              countedDaily
                ? 'Today’s puzzle is in. Share it below.'
                : 'Played again: your first solve is the one that counts.',
            ]
          : []),
        ...footnotes,
      ],
      mood: 'won',
      actions,
    });
    this.listenForResultsKeys();
  }

  private finishTutorial(): void {
    const session = this.session;
    if (!(session instanceof TutorialSession)) return;
    this.saves.counters.update((c) => ({ ...c, tutorialDone: true }));
    this.report({ outcome: 'complete', xpEvents: [{ id: 'tutorial', xp: 5 }] });
    const actions = this.baseActions(() => this.playAgain(), 'Do it again');
    actions.push({
      label: 'Play Pebble',
      key: 'N',
      run: () =>
        this.playGame({
          kind: 'ladder',
          opponent: 'pebble',
          ranked: true,
          size: this.settings().size,
          rules: this.settings().rules,
          youFirst: true,
          seed: `${Date.now()}`,
        }),
    });
    session.showResults({
      kicker: 'Tutorial',
      title: 'Ready to play',
      story:
        'Five wins, fours must be answered, open threes become open fours — and Read the board shows them all. Pebble is waiting at the bottom of the ladder.',
      stats: [],
      mood: 'won',
      actions,
    });
    this.listenForResultsKeys();
  }

  private finishLeague(outcome: LeagueOutcome): void {
    const session = this.session;
    if (!(session instanceof LeagueSession)) return;
    this.saves.counters.update((c) => ({ ...c, leagueMatches: c.leagueMatches + 1 }));
    this.install(['league-fan']);
    const [a, b] = [opponentById(outcome.match.first), opponentById(outcome.match.second)];
    const [sa, sb] = outcome.score;
    const winner = sa === sb ? null : sa > sb ? a : b;
    session.showResults({
      kicker: 'Bot League',
      title: winner ? `${winner.name} takes the match` : 'The match ends level',
      story: `${a.name} ${sa} – ${sb} ${b.name}, over ${outcome.games} games.`,
      stats: [],
      footnotes: this.report({
        outcome: 'complete',
        stats: { leagueMatches: 1 },
        xpEvents: [{ id: 'league', xp: 4 }],
      }),
      mood: 'won',
      actions: this.baseActions(() => this.playAgain(), 'Watch another'),
    });
    this.listenForResultsKeys();
  }

  /** R, H, N and W on a results card, as the Hall's own results screen would take them. */
  private listenForResultsKeys(): void {
    this.stopResultsKeys();
    const shownAt = performance.now();
    this.resultsKeys = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      if (!this.root.querySelector('.ff-results')) return;
      const key = event.key.toLowerCase();
      // Keys held from the last moment of play must not land on the card as it appears.
      if (performance.now() - shownAt < 600) return;
      const press = (label: string) => {
        const button = this.root.querySelector<HTMLButtonElement>(
          `.ff-results button[data-action^="${label}"]`,
        );
        if (!button) return false;
        event.preventDefault();
        event.stopImmediatePropagation();
        button.click();
        return true;
      };
      if (key === 'r') {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.playAgain();
      } else if (key === 'h') {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.context.navigate('hall');
      } else if (key === 'n') press('Next');
      else if (key === 'w') press('Watch the replay');
      else if (key === 'escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.showTitle();
      }
    };
    window.addEventListener('keydown', this.resultsKeys, true);
  }

  private stopResultsKeys(): void {
    if (this.resultsKeys) window.removeEventListener('keydown', this.resultsKeys, true);
    this.resultsKeys = null;
  }

  /** Play again from the Hall or the card: straight into the same kind of game. */
  playAgain(): void {
    const again = this.again;
    if (!again) return this.showTitle();
    switch (again.kind) {
      case 'game':
        return this.playGame(
          again.mode.kind === 'ladder' ? { ...again.mode, seed: `${Date.now()}` } : again.mode,
        );
      case 'puzzle':
        return this.playPuzzle(again.run.daily ? this.dailyRun() : again.run);
      case 'league':
        return this.playLeague(again.match);
      case 'tutorial':
        return this.playTutorial();
    }
  }

  destroy(): void {
    this.clear();
    for (const stop of this.stops) stop();
    this.root.remove();
  }
}
