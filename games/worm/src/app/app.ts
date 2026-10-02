import type { GameContext, GameResult } from '@usr-games/kit';
import { GARDENS, type GardenSpec } from '../gardens/gardens';
import { type FillPuzzle, PUZZLES, secondStarMoves } from '../gardens/puzzles';
import { endingText } from '../modes/copy';
import { dailyGarden, dailyName, dailyOutcome, dailyShareText, dailySquares } from '../modes/daily';
import { gardenStars, puzzleStars, starCount } from '../modes/gardens-play';
import { packagesAtTheEnd, PACKAGES } from '../modes/packages';
import { type PlayMode, PlaySession, type Summary } from '../play/session';
import { createNoodleSound, type NoodleSound } from '../play/sound';
import { GARDEN_BED, GLOW_SOIL, type Look } from '../render/look';
import type { ResultsAction, ResultsModel } from '../ui/cards';
import { h } from '../ui/dom';
import {
  dailyScreen,
  gardensScreen,
  helpScreen,
  isGardenOpen,
  isPuzzleOpen,
  puzzlesScreen,
  recordsScreen,
  type Screen,
  settingsScreen,
  titleScreen,
} from './menus';
import {
  emptyEndlessRecord,
  emptyGardenRecord,
  emptyPuzzleRecord,
  type EndlessKey,
  type GameSettings,
  openSaves,
  type Saves,
  settingsFrom,
} from './saves';

/**
 * Noodle Nine inside the Hall: the screens before and after a run, the run itself, and
 * everything the game tells the Hall (title screen, pause items, results, packages).
 */

export class NoodleApp {
  private readonly root: HTMLElement;
  private readonly saves: Saves;
  private readonly sound: NoodleSound;
  private screen: Screen | null = null;
  private session: PlaySession | null = null;
  private lastMode: PlayMode | null = null;
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
    this.sound = createNoodleSound(context.audio, () => this.settings().sound);
    this.root = h('div', { class: `nn-root${inHall ? ' is-in-hall' : ''}` });
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

  // —— look and settings ——

  private look(): Look {
    return this.context.appearance().appearance === 'dark' ? GLOW_SOIL : GARDEN_BED;
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

  // —— screens ——

  private show(screen: Screen, onTitle = false): void {
    this.clear();
    this.screen = screen;
    this.root.append(screen.element);
    screen.mounted?.();
    this.context.setOnTitleScreen(onTitle);
    this.context.pauseMenuItems([]);
    screen.focus?.();
  }

  private clear(): void {
    this.stopResultsKeys();
    this.session?.destroy();
    this.session = null;
    this.screen?.destroy?.();
    this.screen?.element.remove();
    this.screen = null;
  }

  /** Escape on a page goes back to the game menu; on the game menu itself the Hall takes it. */
  private onEscape(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || this.session || !this.screen || event.defaultPrevented) return;
    if (this.screen.element.classList.contains('nn-title-holder')) {
      if (!this.inHall) this.context.navigate('hall');
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    this.showTitle();
  }

  showTitle(): void {
    const progress = this.saves.progress.load();
    const nextIndex = GARDENS.findIndex(
      (g, i) => isGardenOpen(progress, i) && !(progress.gardens[g.id]?.stars ?? 0),
    );
    const next = GARDENS[nextIndex < 0 ? GARDENS.length - 1 : nextIndex]!;
    const endless = this.saves.endless.load();
    const counters = this.saves.counters.load();
    const settings = this.settings();
    this.show(
      titleScreen(
        this.look(),
        {
          continueLabel: progress.tutorialDone
            ? `Garden ${next.number} · ${next.title}`
            : 'Start with the tutorial',
          gardenStars: Object.values(progress.gardens).reduce((sum, r) => sum + r.stars, 0),
          puzzlesFilled: PUZZLES.filter((p) => (progress.puzzles[p.id]?.stars ?? 0) > 0).length,
          endlessBest: Math.max(0, ...Object.values(endless).map((r) => r?.bestScore ?? 0)),
          dailyNumber: this.context.daily.number(),
          dailyName: dailyName(this.context.daily.seed()),
          dailyDone: this.saves.daily.load()[this.context.daily.dateKey()],
          longest: counters.longest,
          tempo: settings.tempo,
        },
        {
          continue: () =>
            this.play(
              progress.tutorialDone ? { kind: 'garden', garden: next } : { kind: 'tutorial' },
            ),
          gardens: () => this.showGardens(),
          puzzles: () => this.showPuzzles(),
          endless: () => this.play({ kind: 'endless' }),
          daily: () => this.showDaily(),
          tutorial: () => this.play({ kind: 'tutorial' }),
          records: () =>
            this.show(
              recordsScreen(
                this.look(),
                this.saves.progress.load(),
                this.saves.endless.load(),
                this.saves.counters.load(),
                this.saves.daily.load(),
                () => this.showTitle(),
              ),
            ),
          help: () => this.show(helpScreen(this.look(), () => this.showTitle())),
          settings: () => this.showSettings(),
          hall: this.inHall ? undefined : () => this.context.navigate('hall'),
        },
        this.reducedMotion(),
        this.inHall,
      ),
      true,
    );
  }

  private showGardens(): void {
    this.show(
      gardensScreen(
        this.look(),
        this.saves.progress.load(),
        (garden) => this.play({ kind: 'garden', garden }),
        () => this.showTitle(),
      ),
    );
  }

  private showPuzzles(): void {
    this.show(
      puzzlesScreen(
        this.look(),
        this.saves.progress.load(),
        (puzzle) => this.play({ kind: 'puzzle', puzzle }),
        () => this.showTitle(),
      ),
    );
  }

  private showSettings(): void {
    this.show(
      settingsScreen(
        this.look(),
        this.settings(),
        (next) => this.saves.settings.save(next),
        {
          openSettings: () => this.context.openSettings(),
          forgetData: () =>
            void this.context.forgetData().then((forgot) => forgot && this.showTitle()),
        },
        () => this.showTitle(),
      ),
    );
  }

  private dailyMode(): Extract<PlayMode, { kind: 'daily' }> {
    const seed = this.context.daily.seed();
    const number = this.context.daily.number();
    return {
      kind: 'daily',
      seed,
      number,
      dateKey: this.context.daily.dateKey(),
      garden: dailyGarden(seed, number),
    };
  }

  private showDaily(): void {
    const mode = this.dailyMode();
    const history = this.saves.daily.load();
    const record = history[mode.dateKey];
    this.show(
      dailyScreen(
        this.look(),
        { number: mode.number, name: mode.garden.title, garden: mode.garden, record, history },
        {
          play: () => this.play(mode),
          share: () => record && void this.context.share(dailyShareText(record.number, record)),
        },
        () => this.showTitle(),
      ),
    );
  }

  // —— a run ——

  play(mode: PlayMode): void {
    // Starting a run is a click or a key press: the moment to wake the audio, so the first bite
    // does not stall while it starts up.
    void this.context.audio.resume();
    this.clear();
    this.lastMode = mode;
    this.context.setOnTitleScreen(false);
    this.session = new PlaySession(this.root, mode, {
      look: () => this.look(),
      reducedMotion: () => this.reducedMotion(),
      settings: () => this.settings(),
      sound: this.sound,
      ownPause: !this.inHall,
      onEnd: (summary) => this.finish(summary),
      onPackages: (ids) => ids.forEach((id) => this.install(id)),
      onGameMenu: () => void this.leaveRun(),
      onPause: () => this.session?.pause(),
      onClassicChange: (classic) => {
        this.updateSettings({ classicTempo: classic });
        this.refreshPauseItems();
      },
    });
    this.refreshPauseItems();
  }

  /** The game's own items in the Hall's pause menu. */
  private refreshPauseItems(): void {
    const settings = this.settings();
    const mode = this.lastMode;
    const items = [];
    if (mode?.kind === 'endless')
      items.push({
        id: 'classic',
        label: settings.classicTempo ? 'Classic tempo: on' : 'Classic tempo: off',
        shortcut: 'Space',
        run: () => {
          this.updateSettings({ classicTempo: !this.settings().classicTempo });
          this.refreshPauseItems();
        },
      });
    items.push({
      id: 'grid',
      label: settings.grid ? 'Grid lines: on' : 'Grid lines: off',
      run: () => {
        this.updateSettings({ grid: !this.settings().grid });
        this.refreshPauseItems();
      },
    });
    if (mode?.kind === 'puzzle')
      items.push({ id: 'restart', label: 'Start the puzzle again', run: () => this.play(mode) });
    this.context.pauseMenuItems(items);
  }

  private async leaveRun(): Promise<void> {
    const session = this.session;
    if (!session) return;
    if (session.isOver || session.game.status === 'waiting') {
      this.showTitle();
      return;
    }
    session.pause();
    const leave = await session.confirm({
      title: 'Leave this run?',
      body: 'The noodle stops here and this run will not count.',
      confirm: 'Leave',
      cancel: 'Keep playing',
    });
    if (this.session !== session) return;
    if (leave) this.showTitle();
    else session.resume();
  }

  // —— the end of a run ——

  private finish(summary: Summary): void {
    const session = this.session;
    if (!session) return;
    const { game, mode } = summary;
    this.saves.counters.update((c) => ({
      runs: c.runs + 1,
      bites: c.bites + game.bites,
      dailies:
        c.dailies + (mode.kind === 'daily' && !this.saves.daily.load()[mode.dateKey] ? 1 : 0),
      longest: Math.max(c.longest, game.body.length + game.growing),
      bestChain: Math.max(c.bestChain, game.bestChain),
    }));
    let model: ResultsModel;
    let outcome: GameResult['outcome'] = game.status === 'lost' ? 'loss' : 'win';
    let daily = false;
    const xp: { id: string; xp: number }[] = [];
    let threeStars = false;
    switch (mode.kind) {
      case 'garden': {
        const stars = gardenStars(mode.garden, game);
        const count = starCount(stars);
        threeStars = count === 3;
        let best = false;
        this.saves.progress.update((p) => {
          const before = p.gardens[mode.garden.id] ?? emptyGardenRecord();
          best = game.score > before.bestScore;
          return {
            ...p,
            gardens: {
              ...p.gardens,
              [mode.garden.id]: {
                stars: Math.max(before.stars, count),
                bestScore: Math.max(before.bestScore, game.score),
                bestChain: Math.max(before.bestChain, game.bestChain),
                tries: before.tries + 1,
              },
            },
          };
        });
        if (stars.grown) xp.push({ id: 'grown', xp: 10 });
        if (count > 0) xp.push({ id: 'stars', xp: count * 3 });
        model = this.gardenResults(summary, mode.garden, stars, best);
        break;
      }
      case 'puzzle': {
        const stars = puzzleStars(mode.puzzle, game);
        this.saves.progress.update((p) => {
          const before = p.puzzles[mode.puzzle.id] ?? emptyPuzzleRecord();
          const filled = game.status === 'filled';
          return {
            ...p,
            puzzles: {
              ...p.puzzles,
              [mode.puzzle.id]: {
                stars: Math.max(before.stars, stars),
                fewestMoves: filled
                  ? Math.min(before.fewestMoves ?? Infinity, game.moves)
                  : before.fewestMoves,
                tries: before.tries + 1,
              },
            },
          };
        });
        if (stars > 0) xp.push({ id: 'filled', xp: 10 }, { id: 'stars', xp: stars * 3 });
        model = this.puzzleResults(summary, mode.puzzle, stars);
        break;
      }
      case 'endless': {
        outcome = game.status === 'filled' ? 'win' : 'complete';
        const key: EndlessKey = summary.classicThroughout ? 'classic' : summary.baseTempo;
        let best = false;
        this.saves.endless.update((all) => {
          const before = all[key] ?? emptyEndlessRecord();
          best = game.score > before.bestScore;
          return {
            ...all,
            [key]: {
              bestScore: Math.max(before.bestScore, game.score),
              longest: Math.max(before.longest, game.body.length + game.growing),
              bestChain: Math.max(before.bestChain, game.bestChain),
              runs: before.runs + 1,
            },
          };
        });
        xp.push({ id: 'chain', xp: Math.min(12, game.bestChain * 2) });
        model = this.openResults(
          summary,
          'Endless',
          best ? `Score ${game.score}: a new best for this tempo.` : null,
        );
        break;
      }
      case 'daily': {
        outcome = game.status === 'filled' ? 'win' : 'complete';
        const history = this.saves.daily.load();
        const outcomeOfDay = dailyOutcome(game);
        if (!history[mode.dateKey]) {
          daily = true;
          this.saves.daily.save({
            ...history,
            [mode.dateKey]: {
              number: mode.number,
              name: mode.garden.title,
              score: game.score,
              ...outcomeOfDay,
            },
          });
        }
        const hits = dailySquares(outcomeOfDay).filter((s) => s === 'hit').length;
        xp.push({ id: 'daily-squares', xp: hits * 4 });
        model = this.openResults(
          summary,
          `Daily Garden #${mode.number} · ${mode.garden.title}`,
          daily
            ? 'Your run for today is in. Share it below.'
            : 'A replay: your first run of the day is the one that counts.',
        );
        break;
      }
      case 'tutorial': {
        outcome = 'complete';
        this.saves.progress.update((p) => ({ ...p, tutorialDone: true }));
        model = this.tutorialResults();
        break;
      }
    }
    const progress = this.saves.progress.load();
    for (const id of packagesAtTheEnd({
      game,
      gardenId: mode.kind === 'garden' ? mode.garden.id : null,
      threeStars,
      fastestTempo: summary.fastestTempo,
      growingTempo: summary.lastBiteTempo,
      puzzlesFilled: PUZZLES.filter((p) => (progress.puzzles[p.id]?.stars ?? 0) > 0).length,
      puzzleCount: PUZZLES.length,
      dailiesPlayed: Object.keys(this.saves.daily.load()).length,
    }))
      this.install(id);
    const receipt = this.context.reportResult({
      outcome,
      score: game.score,
      stats: {
        bites: game.bites,
        length: game.body.length + game.growing,
        bestChain: game.bestChain,
        grown: game.status === 'grown' ? 1 : 0,
        filled: game.status === 'filled' ? 1 : 0,
      },
      xpEvents: xp.filter((e) => e.xp > 0),
      daily,
      durationSeconds: summary.durationSeconds,
      presentation: 'game',
    });
    if (receipt.xpGained > 0)
      model = { ...model, footnotes: [...(model.footnotes ?? []), `+${receipt.xpGained} XP`] };
    session.showResults(model);
    this.listenForResultsKeys();
  }

  private install(id: string): void {
    if (this.offered.has(id) || !PACKAGES.some((p) => p.id === id)) return;
    this.offered.add(id);
    this.context.installPackage(id);
  }

  private baseActions(): ResultsAction[] {
    return [
      { label: 'Play again', key: 'R', primary: true, run: () => this.playAgain() },
      { label: 'Game menu', run: () => this.showTitle() },
      { label: 'Back to the Hall', key: 'H', run: () => this.context.navigate('hall') },
    ];
  }

  private stats(summary: Summary): ResultsModel['stats'] {
    const { game } = summary;
    return [
      { label: 'Length', value: String(game.body.length + game.growing) },
      { label: 'Score', value: game.score.toLocaleString('en-GB') },
      { label: 'Best chain', value: game.bestChain >= 2 ? `×${game.bestChain}` : '—' },
      { label: 'Moves', value: String(game.moves) },
    ];
  }

  private gardenResults(
    summary: Summary,
    garden: GardenSpec,
    stars: ReturnType<typeof gardenStars>,
    best: boolean,
  ): ResultsModel {
    const { game } = summary;
    const text = endingText(game.status, game.loss?.kind ?? null);
    const actions = this.baseActions();
    const next = this.nextGarden(garden);
    if (next)
      actions.push({
        label: `Next: ${next.title}`,
        key: 'N',
        run: () => this.play({ kind: 'garden', garden: next }),
      });
    return {
      kicker: `Garden ${garden.number} · ${garden.title}`,
      title: text.title,
      story: text.story,
      stars: [
        { earned: stars.grown, label: `Grow to ${garden.goal}` },
        { earned: stars.chain, label: `A chain of ${garden.chainTarget}` },
        { earned: stars.noDash, label: 'Grown without a dash' },
      ],
      stats: this.stats(summary),
      footnotes: best && game.score > 0 ? [`Score ${game.score}: a new best for this garden.`] : [],
      mood: stars.grown ? 'won' : 'lost',
      actions,
    };
  }

  private puzzleResults(summary: Summary, puzzle: FillPuzzle, stars: number): ResultsModel {
    const { game } = summary;
    const text = endingText(game.status, game.loss?.kind ?? null);
    const actions = this.baseActions();
    if (this.session?.canTakeBack)
      actions.splice(1, 0, { label: 'Take that move back', key: 'Z', run: () => this.takeBack() });
    const index = PUZZLES.indexOf(puzzle);
    const next = PUZZLES[index + 1];
    if (next && stars > 0 && isPuzzleOpen(this.saves.progress.load(), index + 1))
      actions.push({
        label: `Next: ${next.title}`,
        key: 'N',
        run: () => this.play({ kind: 'puzzle', puzzle: next }),
      });
    return {
      kicker: `Fill puzzle ${puzzle.number} · ${puzzle.title}`,
      title: text.title,
      story: text.story,
      stars: [
        { earned: stars >= 1, label: 'Fill the box' },
        { earned: stars >= 2, label: `In ${secondStarMoves(puzzle)} moves or fewer` },
        { earned: stars >= 3, label: `At par: ${puzzle.par} moves or fewer` },
      ],
      stats: [
        { label: 'Moves', value: String(game.moves) },
        { label: 'Par', value: String(puzzle.par) },
        { label: 'Filled', value: `${game.body.length + game.growing}/${game.board.openCount}` },
        { label: 'Best chain', value: game.bestChain >= 2 ? `×${game.bestChain}` : '—' },
      ],
      mood: stars > 0 ? 'won' : 'lost',
      actions,
    };
  }

  private openResults(summary: Summary, kicker: string, note: string | null): ResultsModel {
    const { game, mode } = summary;
    const text = endingText(game.status, game.loss?.kind ?? null);
    const actions = this.baseActions();
    if (mode.kind === 'daily') {
      const record = this.saves.daily.load()[mode.dateKey];
      if (record)
        actions.push({
          label: 'Share',
          run: () => void this.context.share(dailyShareText(record.number, record)),
        });
    }
    return {
      kicker,
      title: text.title,
      story: text.story,
      stats: this.stats(summary),
      footnotes: note ? [note] : [],
      mood: game.status === 'filled' ? 'won' : 'lost',
      actions,
    };
  }

  private tutorialResults(): ResultsModel {
    const actions = this.baseActions();
    actions.push({
      label: `Next: ${GARDENS[0]!.title}`,
      key: 'N',
      run: () => this.play({ kind: 'garden', garden: GARDENS[0]! }),
    });
    return {
      kicker: 'Tutorial',
      title: 'Ready for the garden',
      story:
        'Steer, dash, chain: that is all there is to it. Left alone the noodle creeps; speed it up and every bite is worth more.',
      stats: [],
      mood: 'won',
      actions,
    };
  }

  private takeBack(): void {
    this.stopResultsKeys();
    this.session?.takeBack();
  }

  private nextGarden(garden: GardenSpec): GardenSpec | null {
    const index = GARDENS.findIndex((g) => g.id === garden.id);
    const next = GARDENS[index + 1];
    return next && isGardenOpen(this.saves.progress.load(), index + 1) ? next : null;
  }

  /** R, H, N and Z on the results card, as the Hall's own results screen would take them. */
  private listenForResultsKeys(): void {
    this.stopResultsKeys();
    const shownAt = performance.now();
    this.resultsKeys = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      const key = event.key.toLowerCase();
      // Keys held from the last moment of play must not land on the card as it appears.
      if (performance.now() - shownAt < 600) {
        if (key.startsWith('arrow') || key === ' ' || key === 'enter') {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }
      const run = (action: () => void) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        action();
      };
      if (key === 'r') run(() => this.playAgain());
      else if (key === 'h') run(() => this.context.navigate('hall'));
      else if (key === 'escape') run(() => this.showTitle());
      else if (key === 'z' && this.session?.canTakeBack) run(() => this.takeBack());
      else if (key === 'n') {
        const next = this.root.querySelector<HTMLButtonElement>(
          '.nn-results__button[data-action^="Next"]',
        );
        if (next) run(() => next.click());
      }
    };
    window.addEventListener('keydown', this.resultsKeys, true);
  }

  private stopResultsKeys(): void {
    if (this.resultsKeys) window.removeEventListener('keydown', this.resultsKeys, true);
    this.resultsKeys = null;
  }

  /** Play again from the Hall or the card: straight into the same kind of run. */
  playAgain(): void {
    if (this.lastMode?.kind === 'daily') this.play(this.dailyMode());
    else if (this.lastMode) this.play(this.lastMode);
    else this.showTitle();
  }

  destroy(): void {
    this.clear();
    for (const stop of this.stops) stop();
    this.root.remove();
  }
}
