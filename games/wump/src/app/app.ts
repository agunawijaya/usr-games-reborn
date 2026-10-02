import type { GameContext, GameResult } from '@usr-games/kit';
import { CAMPAIGN, type CaveDefinition, scoreFor, starsFor, TUTORIAL } from '../engine/campaign';
import { dailyTemplate } from '../engine/daily';
import { endingText } from '../modes/copy';
import { packagesAtTheEnd } from '../modes/packages';
import { dailyShareText } from '../modes/share';
import { type ExpeditionMode, PlaySession, type Summary } from '../play/session';
import { type CaveSound, createCaveSound } from '../play/sound';
import { LANTERN_DARK, type Look, SCRAP_PAPER } from '../render/look';
import { askToConfirm } from '../ui/confirm';
import { h } from '../ui/dom';
import type { ResultsAction, ResultsModel } from '../ui/results-card';
import {
  customScreen,
  dailyScreen,
  helpScreen,
  isUnlocked,
  recordsScreen,
  type Screen,
  settingsScreen,
  titleScreen,
  trailScreen,
} from './menus';
import { emptyRecord, type GameSettings, openSaves, type Saves, settingsFrom } from './saves';

/**
 * Hush the Wumpus inside the Hall: the screens before and after an expedition, the expedition
 * itself, and everything the game tells the Hall (title screen, pause items, results, packages).
 */

export class WumpApp {
  private readonly root: HTMLElement;
  private readonly saves: Saves;
  private readonly sound: CaveSound;
  private screen: Screen | null = null;
  private session: PlaySession | null = null;
  private lastMode: ExpeditionMode | null = null;
  /** Classic carries the wumpus's temper from one expedition to the next, for this sitting only. */
  private classicTemper: number | undefined;
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
    this.sound = createCaveSound(context.audio, () => this.settings().sound);
    this.root = h('div', { class: `hw-app${inHall ? ' is-in-hall' : ''}` });
    host.append(this.root);
    this.stops.push(
      context.onAppearanceChange(() => this.screen?.setLook?.(this.look())),
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
    return this.context.appearance().appearance === 'dark' ? LANTERN_DARK : SCRAP_PAPER;
  }

  private reducedMotion(): boolean {
    return this.context.appearance().reducedMotion;
  }

  private settings(): GameSettings {
    return settingsFrom(this.saves.settings.load());
  }

  // —— screens ——

  private show(screen: Screen, onTitle = false): void {
    this.clear();
    this.screen = screen;
    this.root.append(screen.element);
    this.context.setOnTitleScreen(onTitle);
    this.context.pauseMenuItems([]);
    (screen.focus ?? screen.element).focus?.();
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
    if (this.screen.element.classList.contains('hw-titlescreen')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.showTitle();
  }

  showTitle(): void {
    const progress = this.saves.progress.load();
    const nextIndex = CAMPAIGN.findIndex((cave) => !(progress.caves[cave.id]?.hushes ?? 0));
    const next = CAMPAIGN[nextIndex < 0 ? CAMPAIGN.length - 1 : nextIndex]!;
    const seed = this.context.daily.seed();
    const today = this.saves.daily.load()[this.context.daily.dateKey()];
    const stars = Object.values(progress.caves).reduce((sum, r) => sum + r.stars, 0);
    this.show(
      titleScreen(
        this.look(),
        {
          stars,
          dailyNumber: this.context.daily.number(),
          dailyName: dailyTemplate(seed).name,
          dailyDone: today,
          rules: this.settings().rules,
        },
        {
          continueLabel: progress.tutorialDone
            ? `Expedition ${next.number} · ${next.name}`
            : 'Start with the tutorial',
          continue: () =>
            this.play(progress.tutorialDone ? { kind: 'cave', cave: next } : { kind: 'tutorial' }),
          trail: () => this.showTrail(),
          daily: () => this.showDaily(),
          custom: () => this.showCustom(),
          tutorial: () => this.play({ kind: 'tutorial' }),
          records: () =>
            this.show(
              recordsScreen(
                this.look(),
                this.saves.progress.load(),
                this.saves.daily.load(),
                this.saves.counters.load(),
                () => this.showTitle(),
              ),
            ),
          help: () => this.show(helpScreen(this.look(), () => this.showTitle())),
          settings: () =>
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
            ),
          hall: this.inHall ? undefined : () => this.context.navigate('hall'),
        },
        this.reducedMotion(),
      ),
      true,
    );
  }

  private showTrail(): void {
    this.show(
      trailScreen(
        this.look(),
        this.saves.progress.load(),
        (cave) => this.play({ kind: 'cave', cave }),
        () => this.showTitle(),
      ),
    );
  }

  private dailyMode(): Extract<ExpeditionMode, { kind: 'daily' }> {
    return {
      kind: 'daily',
      seed: this.context.daily.seed(),
      number: this.context.daily.number(),
      dateKey: this.context.daily.dateKey(),
    };
  }

  private showDaily(): void {
    const mode = this.dailyMode();
    const history = this.saves.daily.load();
    const template = dailyTemplate(mode.seed);
    this.show(
      dailyScreen(
        this.look(),
        {
          number: mode.number,
          name: template.name,
          recipe: template.recipe,
          record: history[mode.dateKey],
          history,
        },
        {
          play: () => this.play(mode),
          share: () => {
            const record = history[mode.dateKey];
            if (!record) return;
            void this.context.share(
              [
                `Hush the Wumpus #${record.number}`,
                record.hushed
                  ? `hushed in ${record.moves} moves`
                  : `fled after ${record.moves} moves`,
                `🎯${record.dartsThrown}`,
                `🦇${record.batRides}`,
                record.hushed ? '💤' : '💨',
              ].join(' · '),
            );
          },
        },
        () => this.showTitle(),
      ),
    );
  }

  private showCustom(): void {
    this.show(
      customScreen(
        this.look(),
        this.saves.custom.load(),
        this.settings().rules,
        {
          dig: (recipe) => this.play({ kind: 'custom', recipe }),
          save: (recipe) => this.saves.custom.save(recipe),
        },
        () => this.showTitle(),
      ),
    );
  }

  // —— an expedition ——

  play(mode: ExpeditionMode): void {
    this.clear();
    this.lastMode = mode;
    this.context.setOnTitleScreen(false);
    this.session = new PlaySession(this.root, mode, {
      look: () => this.look(),
      reducedMotion: () => this.reducedMotion(),
      settings: () => this.settings(),
      sound: this.sound,
      ownPause: !this.inHall,
      classicTemper: this.classicTemper,
      onEnd: (summary) => this.finish(summary),
      onPackages: (ids) => ids.forEach((id) => this.install(id)),
      onGameMenu: () => void this.leaveExpedition(),
      onPause: () => this.session?.pause(),
    });
    this.refreshPauseItems();
  }

  /** The game's own items in the Hall's pause menu. */
  private refreshPauseItems(): void {
    const settings = this.settings();
    this.context.pauseMenuItems([
      {
        id: 'rules',
        label:
          settings.rules === 'standard'
            ? 'Next expedition: Classic rules'
            : 'Next expedition: Standard rules',
        run: () => {
          this.saves.settings.update((s) => ({
            ...settingsFrom(s),
            rules: settingsFrom(s).rules === 'standard' ? 'classic' : 'standard',
          }));
          this.refreshPauseItems();
        },
      },
      {
        id: 'scout',
        label: settings.scout ? 'Scout assist off' : 'Scout assist on',
        run: () => {
          this.saves.settings.update((s) => ({
            ...settingsFrom(s),
            scout: !settingsFrom(s).scout,
          }));
          this.refreshPauseItems();
        },
      },
    ]);
  }

  private async leaveExpedition(): Promise<void> {
    const session = this.session;
    if (!session) return;
    if (session.isOver) {
      this.showTitle();
      return;
    }
    session.pause();
    const leave = await askToConfirm(session.screen.element, {
      title: 'Leave this expedition?',
      body: 'The cave will not keep: this expedition ends here and does not count.',
      confirm: 'Leave',
      cancel: 'Keep exploring',
    });
    if (this.session !== session) return;
    if (leave) this.showTitle();
    else session.resume();
  }

  // —— the end of an expedition ——

  private finish(summary: Summary): void {
    const session = this.session;
    if (!session) return;
    const { expedition, mode } = summary;
    const hushed = expedition.ending?.kind === 'hushed';
    if (expedition.rules === 'classic') this.classicTemper = expedition.temper;
    const cave = mode.kind === 'cave' ? mode.cave : mode.kind === 'tutorial' ? TUTORIAL : null;
    const stars = cave ? starsFor(cave, expedition) : null;
    const score = scoreFor(expedition);
    let record = false;
    if (cave) {
      this.saves.progress.update((p) => {
        const before = p.caves[cave.id] ?? emptyRecord();
        const earned = stars ? [stars.hushed, stars.quick, stars.third].filter(Boolean).length : 0;
        record = hushed && score > before.bestScore;
        return {
          ...p,
          tutorialDone: p.tutorialDone || (cave.id === TUTORIAL.id && hushed),
          caves: {
            ...p.caves,
            [cave.id]: {
              stars: Math.max(before.stars, earned),
              bestScore: Math.max(before.bestScore, score),
              fewestMoves: hushed
                ? Math.min(before.fewestMoves ?? Infinity, expedition.moves)
                : before.fewestMoves,
              tries: before.tries + 1,
              hushes: before.hushes + (hushed ? 1 : 0),
            },
          },
        };
      });
    }
    let dailyCounted = false;
    if (mode.kind === 'daily') {
      const history = this.saves.daily.load();
      if (!history[mode.dateKey]) {
        dailyCounted = true;
        this.saves.daily.save({
          ...history,
          [mode.dateKey]: {
            number: mode.number,
            hushed,
            moves: expedition.moves,
            dartsThrown: summary.dartsThrown,
            batRides: expedition.batRides,
          },
        });
      }
    }
    const counters = this.saves.counters.update((c) => ({
      hushes: c.hushes + (hushed ? 1 : 0),
      expeditions: c.expeditions + 1,
      dailies: c.dailies + (dailyCounted ? 1 : 0),
      roomsSeen: c.roomsSeen + expedition.visited.length,
    }));
    for (const id of packagesAtTheEnd({
      expedition,
      caveId: cave?.id ?? null,
      scout: summary.scout,
      dartsThrown: summary.dartsThrown,
      lastFlight: summary.lastFlight,
      dailiesPlayed: counters.dailies,
    })) {
      this.install(id);
    }
    // The tutorial shows no stars, so it earns none.
    const starCount =
      stars && cave?.id !== TUTORIAL.id
        ? [stars.hushed, stars.quick, stars.third].filter(Boolean).length
        : 0;
    const receipt = this.report(summary, starCount, score, dailyCounted);
    session.showResults(this.resultsFor(summary, cave, stars, score, record, receipt.xpGained));
    this.listenForResultsKeys();
  }

  private install(id: string): void {
    if (this.offered.has(id)) return;
    this.offered.add(id);
    this.context.installPackage(id);
  }

  /** What the Hall hears: an honest outcome, the score, counters for weekly goals, small XP events. */
  private report(summary: Summary, stars: number, score: number, daily: boolean) {
    const { expedition } = summary;
    const hushed = expedition.ending?.kind === 'hushed';
    const outcome: GameResult['outcome'] = hushed ? 'win' : 'loss';
    const xpEvents = [
      { id: 'hushed', xp: hushed ? 10 : 0 },
      { id: 'stars', xp: stars * 3 },
      { id: 'darts-left', xp: hushed ? Math.min(6, expedition.darts * 2) : 0 },
    ].filter((e) => e.xp > 0);
    return this.context.reportResult({
      outcome,
      score,
      stats: {
        hushed: hushed ? 1 : 0,
        moves: expedition.moves,
        dartsLeft: expedition.darts,
        batRides: expedition.batRides,
        roomsSeen: expedition.visited.length,
      },
      xpEvents,
      daily,
      durationSeconds: summary.durationSeconds,
      presentation: 'game',
    });
  }

  private resultsFor(
    summary: Summary,
    cave: CaveDefinition | null,
    stars: ReturnType<typeof starsFor> | null,
    score: number,
    record: boolean,
    xp: number,
  ): ResultsModel {
    const { expedition, mode } = summary;
    const text = endingText(expedition.ending!);
    const hushed = expedition.ending?.kind === 'hushed';
    const footnotes: string[] = [];
    if (hushed) footnotes.push(`Score ${score}${record ? ': a new best for this cave' : ''}.`);
    if (xp > 0) footnotes.push(`+${xp} XP`);
    if (expedition.rules === 'classic') {
      footnotes.push(
        'Classic rules: the wumpus’s temper carries on into your next Classic expedition.',
      );
      if (expedition.pits[expedition.start] || expedition.bats[expedition.start]) {
        footnotes.push(
          'You started on top of a hazard and it never noticed, as the original allowed.',
        );
      }
    }
    const actions: ResultsAction[] = [
      { label: 'Play again', key: 'R', primary: true, run: () => this.playAgain() },
      { label: 'Game menu', run: () => this.showTitle() },
      { label: 'Back to the Hall', key: 'H', run: () => this.context.navigate('hall') },
    ];
    const nextCave = this.nextCave(mode);
    if (nextCave)
      actions.push({
        label: `Next: ${nextCave.name}`,
        key: 'N',
        run: () => this.play({ kind: 'cave', cave: nextCave }),
      });
    if (mode.kind === 'daily') {
      actions.push({
        label: 'Share',
        run: () =>
          void this.context.share(dailyShareText(mode.number, expedition, summary.dartsThrown)),
      });
    }
    return {
      kicker:
        mode.kind === 'daily'
          ? `Daily Cave #${mode.number}`
          : mode.kind === 'cave'
            ? `Expedition ${mode.cave.number} · ${mode.cave.name}`
            : mode.kind === 'tutorial'
              ? 'Tutorial'
              : 'Custom cave',
      title: text.title,
      story: text.story,
      stars:
        cave && stars && cave.id !== TUTORIAL.id
          ? [
              { earned: stars.hushed, label: 'Hushed the wumpus' },
              { earned: stars.quick, label: `In ${cave.moveTarget} moves or fewer` },
              {
                earned: stars.third,
                label:
                  cave.thirdStar === 'no-bat-rides'
                    ? 'Without a bat ride'
                    : `With half the darts or more to spare`,
              },
            ]
          : undefined,
      stats: [
        { label: 'Moves', value: String(expedition.moves) },
        { label: 'Darts left', value: `${expedition.darts} of ${expedition.recipe.darts}` },
        { label: 'Bat rides', value: String(expedition.batRides) },
        { label: 'Rooms seen', value: `${expedition.visited.length}/${expedition.cave.size}` },
      ],
      footnotes,
      mood: hushed ? 'hushed' : 'lost',
      actions,
    };
  }

  private nextCave(mode: ExpeditionMode): CaveDefinition | null {
    const progress = this.saves.progress.load();
    if (mode.kind === 'tutorial') return progress.tutorialDone ? CAMPAIGN[0]! : null;
    if (mode.kind !== 'cave') return null;
    const index = CAMPAIGN.findIndex((c) => c.id === mode.cave.id);
    const next = CAMPAIGN[index + 1];
    return next && isUnlocked(progress, index + 1) ? next : null;
  }

  /** R, H and N on the results card, as the Hall's own results screen would take them. */
  private listenForResultsKeys(): void {
    this.stopResultsKeys();
    const shownAt = performance.now();
    this.resultsKeys = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      const key = event.key.toLowerCase();
      // A Space meant to skip the ending must not land on the card's first button as it appears.
      if ((key === ' ' || key === 'enter') && performance.now() - shownAt < 700) {
        event.preventDefault();
        event.stopImmediatePropagation();
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
      else if (key === 'n' && this.lastMode) {
        const next = this.nextCave(this.lastMode);
        if (next) run(() => this.play({ kind: 'cave', cave: next }));
      }
    };
    window.addEventListener('keydown', this.resultsKeys, true);
  }

  private stopResultsKeys(): void {
    if (this.resultsKeys) window.removeEventListener('keydown', this.resultsKeys, true);
    this.resultsKeys = null;
  }

  /** Play again from the Hall or the card: straight into the same kind of expedition. */
  playAgain(): void {
    if (this.lastMode?.kind === 'daily') this.play(this.dailyMode());
    else if (this.lastMode) this.play(this.lastMode);
    else this.showTitle();
  }

  destroy(): void {
    this.clear();
    this.sound.stopAmbience();
    for (const stop of this.stops) stop();
    this.root.remove();
  }
}
