import { createSynth, type GameContext, type GameResult, localDateKey } from '@usr-games/kit';
import type { Arena } from '../engine/arena';
import type { LookId } from '../render/look';
import { dailyQuarters, dailySky } from '../modes/daily';
import { emojiGrid } from '@usr-games/kit';
import type { Puzzle } from '../modes/puzzles';
import { SHIFTS, type ShiftDefinition, starCount, starsFor, type Stars } from '../modes/shifts';
import { createSkySound, type SkySound } from '../play/sound';
import { PlaySession, type SkyMode, type SkySummary } from '../play/session';
import { logbookPage } from '../play/history';
import { TUTORIAL_TEXT } from '../modes/tutorial';
import { h } from '../ui/dom';
import { packagesAtTheEnd, packagesInTheAir, type SkyProgress } from '../modes/packages';
import { createSkyKeys, type SkyKeys } from '../play/keys';
import { askToConfirm, type ConfirmText } from '../ui/confirm';
import type { CardAction } from '../ui/results';
import {
  type Card,
  dailyCardFor,
  endlessCardFor,
  lossCardFor,
  puzzleCardFor,
  shiftCardFor,
  tutorialCardFor,
} from './cards';
import {
  arenaPickerScreen,
  dailyScreen,
  puzzlesScreen,
  type Screen,
  shiftMapScreen,
  titleScreen,
} from './menus';
import { helpScreen, logbookScreen, recordsScreen, settingsScreen } from './pages';
import { beats, type GameSettings, LOGBOOK_PAGES, openSaves, type Saves } from './saves';

/**
 * Skyloom inside the Hall: the screens before and after a sky, the sky itself, and everything the
 * game tells the Hall (title screen, pause items, results, packages).
 */

const LEAVE_SKY: ConfirmText = {
  title: 'Leave this sky?',
  body: 'It ends here and does not count.',
  confirm: 'Leave',
  cancel: 'Keep flying',
};

export class SkyloomApp {
  private readonly root: HTMLElement;
  private readonly saves: Saves;
  private readonly sound: SkySound;
  private screen: Screen | null = null;
  private session: PlaySession | null = null;
  private card: Card | null = null;
  private lastMode: SkyMode | null = null;
  /** Packages already offered to the Hall in this visit; the Hall keeps the real record. */
  private readonly offered = new Set<string>();
  /** The remappable keys, rebuilt whenever the Hall's bindings change. */
  private keys: SkyKeys;
  private readonly stops: (() => void)[] = [];
  private readonly escape = (event: KeyboardEvent) => this.onEscape(event);

  constructor(
    host: HTMLElement,
    private readonly context: GameContext,
    private readonly inHall = true,
  ) {
    this.saves = openSaves(context);
    this.keys = createSkyKeys(context.settings().bindings.atc);
    this.sound = createSkySound(context.audio, () => this.settings().sound);
    this.root = h('div', {
      class: `sk-app${inHall ? ' is-in-hall' : ''}`,
      'data-look': this.look(),
    });
    host.append(this.root);
    this.stops.push(
      context.onAppearanceChange(() => this.applyLook()),
      context.onSettingsChange(() => {
        context.audio.refresh();
        this.keys = createSkyKeys(context.settings().bindings.atc);
        this.session?.refreshKeys();
      }),
      context.onPause(() => this.session?.pause()),
      context.onResume(() => this.session?.resume()),
    );
    window.addEventListener('keydown', this.escape, true);
    this.stops.push(() => window.removeEventListener('keydown', this.escape, true));
    this.showTitle();
  }

  // —— look and settings ——

  private look(): LookId {
    return this.context.appearance().appearance === 'dark' ? 'scope' : 'chart';
  }

  private reducedMotion(): boolean {
    return this.context.appearance().reducedMotion;
  }

  private settings(): GameSettings {
    return this.saves.settings.load();
  }

  private applyLook(): void {
    const look = this.look();
    this.root.dataset.look = look;
    this.screen?.setLook?.(look);
    this.session?.setLook(look);
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
    this.card?.destroy();
    this.card?.element.remove();
    this.card = null;
    this.session?.destroy();
    this.session = null;
    this.screen?.destroy?.();
    this.screen?.element.remove();
    this.screen = null;
  }

  /** Escape on a page goes back to the game menu; on the title the Hall takes it. */
  private onEscape(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || this.session || !this.screen || event.defaultPrevented) return;
    if (this.screen.element.classList.contains('sk-titlescreen')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.showTitle();
  }

  showTitle(): void {
    const campaign = this.saves.campaign.load();
    const next = SHIFTS.find((s) => !campaign.shifts[s.id]) ?? SHIFTS[SHIFTS.length - 1]!;
    const sky = dailySky(localDateKey());
    const today = this.saves.daily.load()[sky.dateKey];
    const totalStars = Object.values(campaign.shifts).reduce((sum, r) => sum + r.stars, 0);
    this.show(
      titleScreen(
        this.look(),
        {
          stars: totalStars,
          dailyNumber: sky.number,
          dailyArena: sky.arena.name,
          dailyDone: today,
          pages: this.saves.logbook.load().length,
          puzzlesSolved: Object.keys(this.saves.puzzles.load()).length,
        },
        {
          continueLabel: campaign.tutorialDone
            ? `Shift ${next.number} · ${next.title}`
            : 'Start with the tutorial',
          continue: () =>
            campaign.tutorialDone
              ? this.play({ kind: 'shift', shift: next })
              : this.play({ kind: 'tutorial' }),
          shifts: () => this.showShiftMap(),
          endless: () =>
            this.show(
              arenaPickerScreen(
                this.look(),
                this.saves.endless.load(),
                (arena) => this.play({ kind: 'endless', arena }),
                () => this.showTitle(),
              ),
            ),
          daily: () =>
            this.show(
              dailyScreen(
                this.look(),
                sky,
                this.saves.daily.load(),
                () => this.play({ kind: 'daily', sky }),
                () => this.showTitle(),
              ),
            ),
          puzzles: () =>
            this.show(
              puzzlesScreen(
                this.look(),
                this.saves.puzzles.load(),
                (puzzle) => this.play({ kind: 'puzzle', puzzle }),
                () => this.showTitle(),
              ),
            ),
          tutorial: () => this.play({ kind: 'tutorial' }),
          logbook: () =>
            this.show(
              logbookScreen(
                this.look(),
                this.saves.logbook.load(),
                this.saves.counters.load(),
                () => this.showTitle(),
              ),
            ),
          records: () =>
            this.show(
              recordsScreen(this.saves.endless.load(), this.saves.daily.load(), () =>
                this.showTitle(),
              ),
            ),
          help: () => this.show(helpScreen(() => this.showTitle())),
          settings: () =>
            this.show(
              settingsScreen(
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
        },
        this.reducedMotion(),
      ),
      true,
    );
  }

  private showShiftMap(): void {
    this.show(
      shiftMapScreen(
        this.look(),
        this.saves.campaign.load(),
        (shift) => this.play({ kind: 'shift', shift }),
        () => this.showTitle(),
      ),
    );
  }

  // —— playing a sky ——

  play(mode: SkyMode): void {
    this.clear();
    this.lastMode = mode;
    this.context.setOnTitleScreen(false);
    this.session = new PlaySession(this.root, mode, {
      look: () => this.look(),
      reducedMotion: () => this.reducedMotion(),
      settings: () => this.settings(),
      sound: this.sound,
      hallChrome: this.inHall,
      onEnd: (summary) => this.finish(summary),
      onProgress: (progress) => this.awardInTheAir(progress),
      keys: () => this.keys,
      onExit: () => void this.leaveSky(),
      onShell: () => this.context.installPackage('shell-escape'),
      onTutorialStep: (step, session, pair) => this.tutorialStep(step, session, pair),
    });
    this.refreshPauseItems();
    this.session.screen.radar.canvas.focus();
  }

  /** The game's own items in the Hall's pause menu; the prediction label follows its setting. */
  private refreshPauseItems(): void {
    const session = this.session;
    this.context.pauseMenuItems([
      {
        id: 'prediction',
        label: this.settings().prediction ? 'Prediction off' : 'Prediction on',
        run: () => {
          this.saves.settings.update((s) => ({ ...s, prediction: !s.prediction }));
          this.refreshPauseItems();
        },
      },
      {
        id: 'terminal',
        label: 'Terminal mode',
        shortcut: '`',
        run: () => session?.toggleTerminal(!session.terminalOn),
      },
    ]);
  }

  /** The Game menu button during play: a finished sky goes straight back, a live one asks first. */
  private async leaveSky(): Promise<void> {
    const session = this.session;
    if (!session) return;
    if (session.isEnded) {
      this.showTitle();
      return;
    }
    session.pause();
    const leave = await askToConfirm(session.screen.root, LEAVE_SKY);
    if (this.session !== session) return;
    if (leave) this.showTitle();
    else session.resume();
  }

  private tutorialStep(
    step: (typeof TUTORIAL_TEXT)[number]['step'],
    session: PlaySession,
    pair: string,
  ): void {
    const found = TUTORIAL_TEXT.find((t) => t.step === step);
    if (!found) return;
    const text = { ...found, body: found.body.replace('{pair}', pair) };
    if (step === 'conflict') {
      session.showBanner(text.title, text.body, {
        label: 'Next',
        run: () => session.tutorialNext(),
      });
    } else session.showBanner(text.title, text.body);
  }

  // —— the end of a sky ——

  private finish(summary: SkySummary): void {
    if (!this.session) return;
    const counters = this.saves.counters.update((c) => ({
      ...c,
      planesSafe: c.planesSafe + summary.safe,
      landings: c.landings + summary.landings,
      terminalOrders: c.terminalOrders + summary.terminalOrders,
      dailiesFlown: c.dailiesFlown + (summary.mode.kind === 'daily' ? 1 : 0),
      puzzlesSolved:
        c.puzzlesSolved + (summary.mode.kind === 'puzzle' && summary.outcome === 'solved' ? 1 : 0),
    }));
    let stars: Stars | null = null;
    const title = this.titleOf(summary.mode);
    if (summary.mode.kind === 'shift') {
      stars = starsFor(summary.mode.shift, {
        completed: summary.outcome === 'completed',
        safe: summary.safe,
        nearMisses: summary.nearMisses,
        fuelLeft: summary.fuelLeft,
      });
      this.recordShift(summary.mode.shift, summary.safe, stars);
    }
    const page = this.keepPage(summary, title, stars);
    this.awardPackages(summary, stars, counters);
    this.report(summary, stars);
    this.showCard(summary, stars, page);
  }

  private titleOf(mode: SkyMode): string {
    switch (mode.kind) {
      case 'shift':
        return `Shift ${mode.shift.number} · ${mode.shift.title}`;
      case 'daily':
        return `Daily Sky #${mode.sky.number}`;
      case 'endless':
        return `Endless · ${mode.arena.name}`;
      case 'puzzle':
        return `Puzzle · ${mode.puzzle.title}`;
      case 'tutorial':
        return 'Tutorial';
    }
  }

  private recordShift(shift: ShiftDefinition, safe: number, stars: Stars): void {
    if (!stars.target) return;
    this.saves.campaign.update((c) => {
      const before = c.shifts[shift.id];
      return {
        ...c,
        shifts: {
          ...c.shifts,
          [shift.id]: {
            stars: Math.max(before?.stars ?? 0, starCount(stars)),
            bestSafe: Math.max(before?.bestSafe ?? 0, safe),
          },
        },
      };
    });
  }

  /** Every finished sky but the tutorial is woven into the logbook; returns its page number. */
  private keepPage(summary: SkySummary, title: string, stars: Stars | null): number {
    if (summary.mode.kind === 'tutorial') return 0;
    const entry = logbookPage(
      {
        mode: summary.mode.kind,
        title,
        arenaId: summary.world.arena.id,
        safe: summary.safe,
        stars: stars ? starCount(stars) : null,
      },
      summary.flights,
      summary.knots,
    );
    const pages = this.saves.logbook.update((all) => [entry, ...all].slice(0, LOGBOOK_PAGES));
    return pages.length;
  }

  /** Packages earned in the air install as they happen; each is offered to the Hall once. */
  private awardInTheAir(progress: SkyProgress): void {
    for (const id of packagesInTheAir(progress)) this.install(id);
  }

  private awardPackages(
    summary: SkySummary,
    stars: Stars | null,
    counters: { terminalOrders: number; dailiesFlown: number },
  ): void {
    const ids = packagesAtTheEnd({
      starsEarned: stars ? starCount(stars) : null,
      shiftId: summary.mode.kind === 'shift' ? summary.mode.shift.id : null,
      targetMet: stars?.target === true,
      terminalOrders: counters.terminalOrders,
      dailiesFlown: counters.dailiesFlown,
    });
    for (const id of ids) this.install(id);
    if (summary.mode.kind === 'tutorial' && summary.outcome === 'solved')
      this.saves.campaign.update((c) => ({ ...c, tutorialDone: true }));
  }

  private install(id: string): void {
    if (this.offered.has(id)) return;
    this.offered.add(id);
    this.context.installPackage(id);
  }

  /** What the Hall hears: an honest outcome, the planes safe as the score, and small XP events. */
  private report(summary: SkySummary, stars: Stars | null): void {
    const mode = summary.mode;
    const outcome: GameResult['outcome'] =
      mode.kind === 'shift'
        ? summary.outcome === 'lost'
          ? 'loss'
          : stars?.target
            ? 'win'
            : 'complete'
        : mode.kind === 'daily'
          ? summary.outcome === 'lost'
            ? 'loss'
            : 'win'
          : mode.kind === 'endless'
            ? summary.safe >= 10
              ? 'win'
              : 'loss'
            : mode.kind === 'puzzle'
              ? summary.outcome === 'solved'
                ? 'win'
                : 'loss'
              : 'complete';
    const xpEvents = [
      { id: 'planes-safe', xp: Math.min(12, Math.floor(summary.safe / 2)) },
      { id: 'string', xp: Math.min(9, Math.max(0, summary.longestString - 1) * 3) },
      { id: 'stars', xp: stars ? starCount(stars) * 4 : 0 },
      { id: 'medical', xp: Math.min(6, summary.medicalLanded * 2) },
    ].filter((e) => e.xp > 0);
    this.context.reportResult({
      outcome,
      score: summary.safe,
      stats: {
        planesSafe: summary.safe,
        landings: summary.landings,
        exits: summary.exits,
        ticks: summary.ticks,
        longestString: summary.longestString,
        nearMisses: summary.nearMisses,
      },
      xpEvents,
      daily: mode.kind === 'daily',
      durationSeconds: summary.durationSeconds,
      presentation: 'game',
    });
  }

  private showCard(summary: SkySummary, stars: Stars | null, page: number): void {
    const context = {
      look: this.look(),
      reducedMotion: this.reducedMotion(),
      onAction: (action: CardAction) => this.cardAction(action, summary),
    };
    const mode = summary.mode;
    let card: Card;
    if (mode.kind === 'daily') {
      card = dailyCardFor(summary, mode.sky, context, this.context.settings().colorBlindPalette);
      const result = {
        safe: summary.safe,
        lostAt: summary.outcome === 'lost' ? summary.ticks : null,
        nearMissTicks: summary.nearMissTicks,
        longestString: summary.longestString,
      };
      this.saves.daily.update((all) =>
        all[mode.sky.dateKey]
          ? all
          : {
              ...all,
              [mode.sky.dateKey]: {
                number: mode.sky.number,
                safe: summary.safe,
                squares: emojiGrid([dailyQuarters(result)]),
                longestString: summary.longestString,
              },
            },
      );
    } else if (summary.outcome === 'lost' && mode.kind !== 'puzzle') {
      card = lossCardFor(summary, this.titleOf(mode), context, this.bestText(summary));
    } else if (mode.kind === 'shift') {
      card = shiftCardFor(summary, mode.shift, stars!, page, context);
    } else if (mode.kind === 'puzzle') {
      if (summary.outcome === 'solved') {
        this.saves.puzzles.update((all) => ({
          ...all,
          [mode.puzzle.id]: Math.min(all[mode.puzzle.id] ?? Infinity, summary.orders),
        }));
      }
      card = puzzleCardFor(summary, mode.puzzle as Puzzle, context);
    } else if (mode.kind === 'tutorial') {
      card = tutorialCardFor(summary, context);
    } else {
      const record = this.keepEndless(mode.arena, summary);
      card = endlessCardFor(summary, record, this.bestText(summary), context);
    }
    if (mode.kind === 'endless' && summary.outcome === 'lost')
      this.keepEndless(mode.arena, summary);
    this.card = card;
    this.session!.screen.root.append(card.element);
    card.focus?.focus();
  }

  private keepEndless(arena: Arena, summary: SkySummary): boolean {
    const best = this.saves.endless.load()[arena.id];
    const run = { safe: summary.safe, ticks: summary.ticks };
    if (!beats(run, best)) return false;
    this.saves.endless.update((all) => ({
      ...all,
      [arena.id]: { ...run, dateKey: localDateKey() },
    }));
    return true;
  }

  private bestText(summary: SkySummary): string {
    const best = this.saves.endless.load()[summary.world.arena.id];
    return best ? `${best.safe} safe` : '—';
  }

  private cardAction(action: CardAction, summary: SkySummary): void {
    switch (action) {
      case 'hall':
        this.context.navigate('hall');
        break;
      case 'game-menu':
        this.showTitle();
        break;
      case 'play-again':
        if (this.lastMode) this.play(this.lastMode);
        break;
      case 'next': {
        // After the tutorial the way on is the first shift; after a shift, the one that follows.
        const number = summary.mode.kind === 'shift' ? summary.mode.shift.number : 0;
        const next = SHIFTS[number];
        if (next && (summary.mode.kind === 'shift' || summary.mode.kind === 'tutorial'))
          this.play({ kind: 'shift', shift: next });
        break;
      }
      case 'share':
        if (summary.mode.kind === 'daily') {
          const sky = summary.mode.sky;
          const result = {
            safe: summary.safe,
            lostAt: summary.outcome === 'lost' ? summary.ticks : null,
            nearMissTicks: summary.nearMissTicks,
            longestString: summary.longestString,
          };
          void import('../modes/daily').then(({ dailyShareText }) =>
            this.context.share(
              dailyShareText(sky, result, this.context.settings().colorBlindPalette),
            ),
          );
        }
        break;
    }
  }

  /** Play again from the Hall: straight into the same kind of sky. */
  playAgain(): void {
    if (this.lastMode) this.play(this.lastMode);
    else this.showTitle();
  }

  destroy(): void {
    this.clear();
    for (const stop of this.stops) stop();
    this.root.remove();
  }
}

/** The synth for a context-less host, such as the workbench. */
export function standaloneSynth() {
  return createSynth({ getVolume: () => 0.35, isMuted: () => false });
}
