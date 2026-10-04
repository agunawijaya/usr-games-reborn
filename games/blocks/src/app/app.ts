import type { GameContext, GameResult } from '@usr-games/kit';
import { finalScore, type Game } from '../engine/game';
import { DIVES, type DiveSpec, diveStars, starLabels } from '../dives/dives';
import { ENDINGS, type EndingText } from '../modes/copy';
import {
  dailyBubbles,
  dailyName,
  dailyFirstSinkers,
  dailyPar,
  type DailyOutcome,
  dailyShareText,
} from '../modes/daily';
import { packagesAtTheEnd, PACKAGES } from '../modes/packages';
import { type PlayMode, PlaySession, type Summary } from '../play/session';
import { createSinkerSound, type SinkerSound } from '../play/sound';
import { lookFor, type Look } from '../render/look';
import type { ResultsAction, ResultsModel } from '../ui/cards';
import { h } from '../ui/dom';
import {
  dailyScreen,
  divesScreen,
  helpScreen,
  isDiveOpen,
  levelScreen,
  recordsScreen,
  type Screen,
  settingsScreen,
  titleScreen,
} from './menus';
import {
  emptyDiveRecord,
  type GameSettings,
  type LevelRecords,
  openSaves,
  type Saves,
  settingsFrom,
  withRun,
} from './saves';

/**
 * Sinkers inside the Hall: the screens before and after a run, the run itself, and everything the
 * game tells the Hall (title screen, pause items, results, packages).
 */

export class SinkersApp {
  private readonly root: HTMLElement;
  private readonly saves: Saves;
  private readonly sound: SinkerSound;
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
    this.sound = createSinkerSound(context.audio, () => this.settings().sound);
    this.root = h('div', { class: `snk-root${inHall ? ' is-in-hall' : ''}` });
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
    if (this.screen.element.classList.contains('snk-title-holder')) {
      if (!this.inHall) this.context.navigate('hall');
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    this.showTitle();
  }

  private nextDive(): DiveSpec {
    const progress = this.saves.progress.load();
    const index = DIVES.findIndex(
      (d, i) => isDiveOpen(progress, i) && !(progress.dives[d.id]?.stars ?? 0),
    );
    return DIVES[index < 0 ? DIVES.length - 1 : index]!;
  }

  showTitle(): void {
    const progress = this.saves.progress.load();
    const next = this.nextDive();
    const best = (records: LevelRecords) =>
      Math.max(0, ...Object.values(records).map((r) => r?.bestScore ?? 0));
    const settings = this.settings();
    this.show(
      titleScreen(
        this.look(),
        {
          continueLabel: progress.tutorialDone
            ? `Dive ${next.number} · ${next.title}`
            : 'Start with the tutorial',
          diveStars: Object.values(progress.dives).reduce((sum, r) => sum + r.stars, 0),
          marathonBest: best(this.saves.marathon.load()),
          classicBest: best(this.saves.classic.load()),
          dailyNumber: this.context.daily.number(),
          dailyName: dailyName(this.context.daily.seed()),
          dailyDone: this.saves.daily.load()[this.context.daily.dateKey()],
          bestCombo: this.saves.counters.load().bestCombo,
          sonar: settings.sonar,
        },
        {
          continue: () =>
            this.play(progress.tutorialDone ? { kind: 'dive', dive: next } : { kind: 'tutorial' }),
          dives: () => this.showDives(),
          marathon: () => this.showMarathon(),
          classic: () => this.showClassic(),
          daily: () => this.showDaily(),
          tutorial: () => this.play({ kind: 'tutorial' }),
          records: () =>
            this.show(
              recordsScreen(
                this.look(),
                this.saves.progress.load(),
                this.saves.marathon.load(),
                this.saves.classic.load(),
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

  private showDives(): void {
    this.show(
      divesScreen(
        this.look(),
        this.saves.progress.load(),
        (dive) => this.play({ kind: 'dive', dive }),
        () => this.showTitle(),
      ),
    );
  }

  private showMarathon(): void {
    this.show(
      levelScreen(
        this.look(),
        {
          kicker: 'Marathon',
          title: 'As deep as you can go',
          lede: 'One tank, no goal: play until it fills. Start at any level from 1 to 9, as the 1992 program let you; every ten rows takes you a level deeper. Each starting level keeps its own champion.',
          start: 'Dive',
          scoreLabel: 'Best score',
        },
        this.settings().marathonLevel,
        this.saves.marathon.load(),
        {
          choose: (level) => this.updateSettings({ marathonLevel: level }),
          start: (level) => this.play({ kind: 'marathon', level }),
        },
        () => this.showTitle(),
      ),
    );
  }

  private showClassic(): void {
    this.show(
      levelScreen(
        this.look(),
        {
          kicker: 'Classic 1992',
          title: 'The original rules',
          lede: 'Ten wide and twenty deep. Turns go left only, rows clear for nothing, every landing and every row a dropped sinker falls scores a point, and the level multiplies it all at the end. The clock quickens a hair with every tick.',
          start: 'Play',
          scoreLabel: 'Best score',
        },
        this.settings().classicLevel,
        this.saves.classic.load(),
        {
          choose: (level) => this.updateSettings({ classicLevel: level }),
          start: (level) => this.play({ kind: 'classic', level }),
        },
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
    return {
      kind: 'daily',
      seed,
      number: this.context.daily.number(),
      dateKey: this.context.daily.dateKey(),
      name: dailyName(seed),
      par: dailyPar(seed),
    };
  }

  private showDaily(): void {
    const mode = this.dailyMode();
    const history = this.saves.daily.load();
    const record = history[mode.dateKey];
    this.show(
      dailyScreen(
        this.look(),
        {
          number: mode.number,
          name: mode.name,
          par: mode.par,
          first: dailyFirstSinkers(mode.seed, 8),
          record,
          history,
        },
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
    // Starting a run is a click or a key press: the moment to wake the audio.
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
      onPause: () => this.pauseFromGame(),
    });
    this.refreshPauseItems();
  }

  /**
   * P (or the workbench's own button) asks for the Hall's pause as Escape would: the kit has no
   * call for it, so an Escape key event is sent from the focused element, bubbling as a real one.
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
    const mode = this.lastMode;
    const items = [
      {
        id: 'sonar',
        label: this.settings().sonar ? 'Sonar: on' : 'Sonar: off',
        run: () => {
          this.updateSettings({ sonar: !this.settings().sonar });
          this.refreshPauseItems();
        },
      },
    ];
    if (mode?.kind === 'dive')
      items.push({ id: 'restart', label: 'Start the dive again', run: () => this.play(mode) });
    this.context.pauseMenuItems(items);
  }

  private async leaveRun(): Promise<void> {
    const session = this.session;
    if (!session) return;
    if (session.isOver) {
      this.showTitle();
      return;
    }
    session.pause();
    const leave = await session.confirm({
      title: 'Leave this dive?',
      body: 'The tank empties and this run will not count.',
      confirm: 'Leave',
      cancel: 'Keep diving',
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
    const today = this.context.daily.dateKey();
    this.saves.counters.update((c) => ({
      runs: c.runs + 1,
      rowsBurst: c.rowsBurst + game.rowsCleared,
      fourRowBursts: c.fourRowBursts + game.fourRowBursts,
      bestCombo: Math.max(c.bestCombo, game.bestCombo),
    }));
    let model: ResultsModel;
    let outcome: GameResult['outcome'] = 'complete';
    let daily = false;
    const xp: { id: string; xp: number }[] = [];
    let diveFinish: Parameters<typeof packagesAtTheEnd>[0]['dive'] = null;
    switch (mode.kind) {
      case 'dive': {
        const stars = diveStars(mode.dive, game);
        const won = summary.ending === 'won';
        outcome = won ? 'win' : 'loss';
        let best = false;
        this.saves.progress.update((p) => {
          const before = p.dives[mode.dive.id] ?? emptyDiveRecord();
          best = won && game.points > before.bestScore;
          return {
            ...p,
            dives: {
              ...p.dives,
              [mode.dive.id]: {
                stars: Math.max(before.stars, stars),
                bestScore: won ? Math.max(before.bestScore, game.points) : before.bestScore,
                fewestSinkers:
                  won && mode.dive.goal.kind === 'coral'
                    ? Math.min(before.fewestSinkers ?? Infinity, game.landings)
                    : before.fewestSinkers,
                tries: before.tries + 1,
              },
            },
          };
        });
        if (won) xp.push({ id: 'dive', xp: 10 }, { id: 'stars', xp: stars * 3 });
        diveFinish = { id: mode.dive.id, won, stars, seaweedLeft: session.seaweedLeft };
        model = this.diveResults(summary, mode.dive, stars, best);
        break;
      }
      case 'marathon':
      case 'classic': {
        const slot = mode.kind === 'marathon' ? this.saves.marathon : this.saves.classic;
        const score = finalScore(game);
        let best = false;
        slot.update((records) => {
          const next = withRun(records, mode.level, {
            score,
            rows: game.rowsCleared,
            bestCombo: game.bestCombo,
            date: today,
          });
          best = next.best && score > 0;
          return next.records;
        });
        xp.push({ id: 'rows', xp: Math.min(15, Math.floor(game.rowsCleared / 4)) });
        model = this.levelResults(summary, best);
        break;
      }
      case 'daily': {
        const history = this.saves.daily.load();
        const outcomeOfDay: DailyOutcome = {
          score: game.points,
          bestCombo: game.bestCombo,
          rows: game.rowsCleared,
          bubbles: dailyBubbles(game.points, mode.par),
        };
        if (!history[mode.dateKey]) {
          daily = true;
          this.saves.daily.save({
            ...history,
            [mode.dateKey]: {
              number: mode.number,
              name: mode.name,
              par: mode.par,
              ...outcomeOfDay,
            },
          });
        }
        xp.push({ id: 'daily-bubbles', xp: outcomeOfDay.bubbles * 4 });
        model = this.dailyResults(summary, outcomeOfDay, daily);
        break;
      }
      case 'tutorial': {
        this.saves.progress.update((p) => ({ ...p, tutorialDone: true }));
        model = this.tutorialResults();
        break;
      }
    }
    const marathon = this.saves.marathon.load();
    for (const id of packagesAtTheEnd({
      game,
      dive: diveFinish,
      classicLevel: mode.kind === 'classic' ? mode.level : null,
      marathonLevelsWithRecords: [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => marathon[n]).length,
      dailiesPlayed: Object.keys(this.saves.daily.load()).length,
    }))
      this.install(id);
    const receipt = this.context.reportResult({
      outcome,
      score: finalScore(game),
      stats: {
        rows: game.rowsCleared,
        plunged: game.rowsPlunged,
        sinkers: game.landings,
        bestCombo: game.bestCombo,
        fourRowBursts: game.fourRowBursts,
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

  private stats(game: Game): ResultsModel['stats'] {
    return [
      { label: 'Score', value: finalScore(game).toLocaleString('en-GB') },
      { label: 'Rows', value: String(game.rowsCleared) },
      { label: 'Sinkers', value: String(game.landings) },
      { label: 'Deepest combo', value: game.bestCombo >= 2 ? `×${game.bestCombo}` : '—' },
    ];
  }

  private diveResults(
    summary: Summary,
    dive: DiveSpec,
    stars: number,
    best: boolean,
  ): ResultsModel {
    const { game } = summary;
    const won = summary.ending === 'won';
    const text: EndingText = won
      ? dive.goal.kind === 'rows'
        ? ENDINGS.diveRows
        : ENDINGS.diveCoral
      : ENDINGS.tankFull;
    const actions = this.baseActions();
    const index = DIVES.indexOf(dive);
    const next = DIVES[index + 1];
    if (next && isDiveOpen(this.saves.progress.load(), index + 1))
      actions.push({
        label: `Next: ${next.title}`,
        key: 'N',
        run: () => this.play({ kind: 'dive', dive: next }),
      });
    const labels = starLabels(dive);
    return {
      kicker: `Dive ${dive.number} · ${dive.title}`,
      title: text.title,
      story: text.story,
      stars: labels.map((label, i) => ({ earned: stars > i, label })),
      stats: this.stats(game),
      footnotes: best ? [`${game.points.toLocaleString('en-GB')}: a new best for this dive.`] : [],
      mood: won ? 'won' : 'lost',
      actions,
    };
  }

  private levelResults(summary: Summary, best: boolean): ResultsModel {
    const { game, mode } = summary;
    const classic = mode.kind === 'classic';
    const text = classic ? ENDINGS.classic : ENDINGS.marathon;
    const stats = classic
      ? [
          { label: 'Points', value: game.points.toLocaleString('en-GB') },
          { label: 'Level', value: String(game.level) },
          { label: 'Score', value: finalScore(game).toLocaleString('en-GB') },
          { label: 'Rows', value: String(game.rowsCleared) },
        ]
      : [
          { label: 'Score', value: game.points.toLocaleString('en-GB') },
          { label: 'Rows', value: String(game.rowsCleared) },
          { label: 'Level reached', value: String(game.level) },
          { label: 'Deepest combo', value: game.bestCombo >= 2 ? `×${game.bestCombo}` : '—' },
        ];
    return {
      kicker: classic
        ? `Classic 1992 · level ${game.startLevel}`
        : `Marathon · from level ${game.startLevel}`,
      title: text.title,
      story: text.story,
      stats,
      footnotes: best ? [`A new champion for level ${game.startLevel}.`] : [],
      mood: best ? 'won' : 'lost',
      actions: this.baseActions(),
    };
  }

  private dailyResults(summary: Summary, outcome: DailyOutcome, counted: boolean): ResultsModel {
    const { game, mode } = summary;
    if (mode.kind !== 'daily') throw new Error('Not a daily dive');
    const text = summary.ending === 'lost' ? ENDINGS.tankFull : ENDINGS.daily;
    const actions = this.baseActions();
    const record = this.saves.daily.load()[mode.dateKey];
    if (record)
      actions.push({
        label: 'Share',
        run: () => void this.context.share(dailyShareText(record.number, record)),
      });
    return {
      kicker: `Daily Dive #${mode.number} · ${mode.name}`,
      title: text.title,
      story: text.story,
      bubbles: { earned: outcome.bubbles, par: mode.par },
      stats: this.stats(game),
      footnotes: [
        counted
          ? 'Your dive for today is in. Share it below.'
          : 'A replay: your first dive of the day is the one that counts.',
      ],
      mood: outcome.bubbles > 0 ? 'won' : 'lost',
      actions,
    };
  }

  private tutorialResults(): ResultsModel {
    const actions = this.baseActions();
    const first = DIVES[0]!;
    actions.push({
      label: `Next: ${first.title}`,
      key: 'N',
      run: () => this.play({ kind: 'dive', dive: first }),
    });
    return {
      kicker: 'Tutorial',
      title: ENDINGS.tutorial.title,
      story: ENDINGS.tutorial.story,
      stats: [],
      mood: 'won',
      actions,
    };
  }

  /** R, H and N on the results card, as the Hall's own results screen would take them. */
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
      else if (key === 'n') {
        const next = this.root.querySelector<HTMLButtonElement>(
          '.snk-results__button[data-action^="Next"]',
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
