import type { GameContext, GameResult } from '@usr-games/kit';
import type { Level } from '../ai/players';
import { type Length, type MatchState, TARGETS, newMatch, nextHand } from '../engine/match';
import { dailyRoute, dailyShareText } from '../modes/daily';
import { STOPS, openRoutes, recordHand, routeForHand, stopOf } from '../modes/journal';
import { PACKAGES, packagesForGame, packagesForHand } from '../modes/packages';
import { Backdrop } from '../render/backdrop';
import { paintJournalMap } from '../render/journal-map';
import { type Look, lookFor } from '../render/look';
import { ROUTES, type Route, type RouteId } from '../render/routes';
import { DriverClient } from '../play/driver-client';
import { type TableSound, createTableSound } from '../play/sound';
import { Table } from '../play/table';
import { confirmDialog } from '../ui/dialogs';
import { formatPoints, h } from '../ui/dom';
import {
  type Screen,
  type SetupChoices,
  dailyScreen,
  helpScreen,
  journalScreen,
  optionsScreen,
  setupScreen,
  titleScreen,
} from '../ui/screens';
import { type Card, type ResultsAction, resultsCard, scoreSheet } from '../ui/sheets';
import {
  type Current,
  DEFAULT_PREFS,
  EMPTY_RECORDS,
  type ModeId,
  type Prefs,
  type Records,
  type Saves,
  openSaves,
  withDefaults,
} from './saves';

/**
 * Detour inside the Hall: the game menu and its pages, the games themselves, and everything the
 * game tells the Hall (the title screen, pause items, packages, results).
 */

interface Run {
  mode: ModeId;
  rival: Level;
  length: Length;
}

const NAMES: Record<ModeId, string> = {
  quick: 'Quick hand',
  game: 'Full game',
  teams: 'Teams',
  daily: 'Daily Road',
};

function randomSeed(): string {
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);
  return `${words[0]!.toString(36)}${words[1]!.toString(36)}`;
}

function handTitle(won: boolean, tied: boolean, teams: boolean): string {
  if (tied) return 'A dead heat';
  if (won) return teams ? 'Your team takes the hand' : 'You take the hand';
  return teams ? 'The rivals take the hand' : 'Your rival takes the hand';
}

export class DetourApp {
  private readonly root: HTMLElement;
  private readonly saves: Saves;
  private readonly sound: TableSound;
  private readonly drivers = new DriverClient();
  private readonly backdrop: Backdrop;
  private screen: Screen | null = null;
  private table: Table | null = null;
  private card: Card | null = null;
  private current: Current | null = null;
  private run: Run | null = null;
  private cardKeys: ((event: KeyboardEvent) => void) | null = null;
  private readonly stops: (() => void)[] = [];

  constructor(
    host: HTMLElement,
    private readonly context: GameContext,
  ) {
    this.saves = openSaves(context);
    this.sound = createTableSound(context.audio, () => this.prefs().sound);
    this.backdrop = new Backdrop(this.look(), ROUTES.coast, () => this.reducedMotion());
    this.root = h('div', { class: 'dt-app', 'data-look': this.look().name }, this.backdrop.canvas);
    host.append(this.root);
    this.stops.push(
      context.onAppearanceChange(() => this.onLook()),
      context.onSettingsChange(() => context.audio.refresh()),
      context.onPause(() => this.table?.pause()),
      context.onResume(() => this.table?.resume()),
    );
    this.showTitle();
  }

  destroy(): void {
    this.clear();
    this.backdrop.stop();
    for (const stop of this.stops) stop();
    this.drivers.dispose();
    this.sound.stop();
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
    return withDefaults(this.saves.prefs.load(), DEFAULT_PREFS);
  }

  private records(): Records {
    return withDefaults(this.saves.records.load(), EMPTY_RECORDS);
  }

  private onLook(): void {
    this.root.dataset.look = this.look().name;
    this.backdrop.set(this.look(), this.backdropRoute());
    this.table?.setLook();
    if (this.screen) this.backdrop.start();
  }

  private backdropRoute(): Route {
    const open = openRoutes(this.saves.journal.load());
    return ROUTES[open[open.length - 1] ?? 'coast'];
  }

  // —— pages ——

  private show(screen: Screen): void {
    this.clear();
    this.screen = screen;
    this.root.append(screen.element);
    this.root.classList.toggle('is-page', !screen.isTitle);
    this.context.setOnTitleScreen(screen.isTitle);
    this.context.pauseMenuItems([]);
    this.backdrop.canvas.hidden = false;
    this.backdrop.set(this.look(), this.backdropRoute());
    this.backdrop.start();
    screen.focus();
  }

  private clear(): void {
    this.stopCardKeys();
    this.card?.element.remove();
    this.card = null;
    this.table?.destroy();
    this.table = null;
    this.screen?.element.remove();
    this.screen = null;
  }

  showTitle(): void {
    const current = this.saves.current.load();
    const records = this.records();
    const journal = this.saves.journal.load();
    const today = this.saves.daily.load()[this.context.daily.dateKey()];
    const route = ROUTES[dailyRoute(this.context.daily.seed())];
    this.show(
      titleScreen(
        {
          continueLine: current ? this.describe(current) : null,
          dailyNumber: this.context.daily.number(),
          dailyLine: today
            ? `Today: ${formatPoints(today.score)} points along the ${route.name}`
            : `Today’s road: the ${route.name}, one deck for everyone`,
          journalLine: `${openRoutes(journal).length} of ${STOPS.length} routes open · ${journal.stickers.length} sticker${journal.stickers.length === 1 ? '' : 's'}`,
          recordLine:
            records.games > 0
              ? `${records.gamesWon} of ${records.games} games won · best hand ${formatPoints(records.bestHand)} · ${records.coups} coup${records.coups === 1 ? '' : 's'} fourré${records.coups === 1 ? '' : 's'}`
              : 'A card road race from the Berkeley games of 1982.',
        },
        {
          resume: () => this.resume(),
          quick: () => this.setup('quick'),
          game: () => this.setup('game'),
          teams: () => this.setup('teams'),
          daily: () => this.showDaily(),
          journal: () => this.showJournal(),
          help: () => this.show(helpScreen({ back: () => this.showTitle() })),
          options: () => this.showOptions(),
        },
      ),
    );
  }

  private describe(current: Current): string {
    const m = current.match;
    const level = (m.config.drivers[1] ?? 'classic') as Level;
    const hand =
      m.config.length === 'single'
        ? 'one hand'
        : `hand ${m.handNo + 1}, to ${formatPoints(TARGETS[m.config.length]!)}`;
    return `${NAMES[current.mode]} against ${level[0]!.toUpperCase()}${level.slice(1)} · ${hand} · ${formatPoints(m.totals[0])}–${formatPoints(m.totals[1])}`;
  }

  private setup(mode: Exclude<ModeId, 'daily'>): void {
    const prefs = this.prefs();
    const lengths: Length[] =
      mode === 'quick'
        ? ['single']
        : mode === 'game'
          ? ['short', 'full']
          : ['single', 'short', 'full'];
    const length =
      mode === 'quick'
        ? 'single'
        : mode === 'game'
          ? prefs.length === 'single'
            ? 'full'
            : prefs.length
          : prefs.teamLength;
    this.show(
      setupScreen(
        {
          title: NAMES[mode],
          lead:
            mode === 'quick'
              ? 'One hand: the first to exactly 700 miles ends it, and the score sheet settles who won.'
              : mode === 'game'
                ? 'Hand after hand until a side passes the target; the first turn passes back and forth.'
                : 'You and a partner share one car and one set of piles against two rivals. A hand is 1000 miles, with no extension, and either partner may parry a hazard.',
          lengths,
          choices: { rival: prefs.rival, length, helper: prefs.helper },
        },
        {
          start: (choices) => void this.startNew(mode, choices),
          back: () => this.showTitle(),
        },
      ),
    );
  }

  private showDaily(): void {
    const key = this.context.daily.dateKey();
    const record = this.saves.daily.load()[key];
    this.show(
      dailyScreen(
        {
          number: this.context.daily.number(),
          dateLabel: new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
          route: dailyRoute(this.context.daily.seed()),
          record,
          played: Object.keys(this.saves.daily.load()).length,
        },
        {
          play: () =>
            void this.startNew('daily', {
              rival: 'classic',
              length: 'single',
              helper: this.prefs().helper,
            }),
          share: () => record && void this.context.share(dailyShareText(key, record)),
          back: () => this.showTitle(),
        },
      ),
    );
  }

  private showJournal(): void {
    const journal = this.saves.journal.load();
    this.show(
      journalScreen(journal, { back: () => this.showTitle() }, (canvas) =>
        paintJournalMap(canvas, journal, this.look()),
      ),
    );
  }

  private showOptions(): void {
    this.show(
      optionsScreen(this.prefs(), {
        change: (patch) => {
          this.saves.prefs.update((p) => ({ ...withDefaults(p, DEFAULT_PREFS), ...patch }));
          if ('sound' in patch && !patch.sound) this.sound.stop();
        },
        hallSettings: () => this.context.openSettings(),
        forget: () => void this.context.forgetData().then((forgot) => forgot && this.showTitle()),
        back: () => this.showTitle(),
      }),
    );
  }

  // —— games ——

  private async startNew(mode: ModeId, choices: SetupChoices): Promise<void> {
    void this.context.audio.resume();
    const existing = this.saves.current.load();
    if (existing) {
      const sure = await confirmDialog(this.root, {
        title: 'Start a new game?',
        body: `The game in progress (${this.describe(existing)}) will be left behind.`,
        confirm: 'Start afresh',
        cancel: 'Keep it',
      });
      if (!sure) return;
    }
    this.saves.prefs.update((p) => {
      const prefs = withDefaults(p, DEFAULT_PREFS);
      if (mode === 'daily') return { ...prefs, helper: choices.helper };
      return {
        ...prefs,
        helper: choices.helper,
        rival: choices.rival,
        ...(mode === 'game' ? { length: choices.length } : {}),
        ...(mode === 'teams' ? { teamLength: choices.length } : {}),
      };
    });
    const teams = mode === 'teams';
    const seed = mode === 'daily' ? this.context.daily.seed() : randomSeed();
    const rival = mode === 'daily' ? 'classic' : choices.rival;
    const match = newMatch({
      teams,
      length: mode === 'quick' || mode === 'daily' ? 'single' : choices.length,
      seed,
      drivers: teams ? [null, rival, 'classic', rival] : [null, rival],
      // The workbench and its tests can stack the first deal.
      firstDeal: import.meta.env.DEV
        ? (window as { __dtFirstDeal?: number[] }).__dtFirstDeal
        : undefined,
    });
    const open = openRoutes(this.saves.journal.load());
    this.run = { mode, rival, length: match.config.length };
    this.current = {
      mode,
      match,
      routeOffset: Math.floor(Math.random() * open.length),
      dailyRoute: mode === 'daily' ? dailyRoute(seed) : null,
      startedAt: Date.now(),
      playedMs: 0,
    };
    this.saves.current.save(this.current);
    this.openTable();
  }

  private resume(): void {
    const current = this.saves.current.load();
    if (!current) return this.showTitle();
    this.current = current;
    this.run = {
      mode: current.mode,
      rival: (current.match.config.drivers[1] ?? 'classic') as Level,
      length: current.match.config.length,
    };
    this.openTable();
  }

  private routeOf(handNo: number): Route {
    const current = this.current;
    if (current?.dailyRoute) return ROUTES[current.dailyRoute as RouteId];
    const open = openRoutes(this.saves.journal.load());
    return ROUTES[routeForHand(open, current?.routeOffset ?? 0, handNo)];
  }

  private openTable(): void {
    const current = this.current!;
    this.clear();
    this.backdrop.stop();
    this.backdrop.canvas.hidden = true;
    this.root.classList.remove('is-page');
    this.context.setOnTitleScreen(false);
    const teams = current.match.config.teams;
    let since = performance.now();
    this.table = new Table(this.root, current.match, {
      look: () => this.look(),
      reducedMotion: () => this.reducedMotion(),
      helper: () => this.prefs().helper,
      route: (handNo) => this.routeOf(handNo),
      names: teams ? ['You', 'Rival 1', 'Partner', 'Rival 2'] : ['You', 'Rival'],
      modeLine: () => this.modeLine(),
      sound: this.sound,
      drivers: this.drivers,
      onProgress: (match) => {
        const now = performance.now();
        current.playedMs += now - since;
        since = now;
        current.match = match;
        this.saves.current.save(current);
      },
      onHandOver: (match) => this.handOver(match),
    });
    this.refreshPauseItems();
    this.table.focus();
    if (import.meta.env.DEV) (window as { __dtTable?: Table }).__dtTable = this.table;
  }

  private modeLine(): string {
    const current = this.current;
    if (!current) return '';
    const m = current.match;
    if (current.mode === 'daily') return `Daily Road #${this.context.daily.number()}`;
    const level = (m.config.drivers[1] ?? 'classic') as Level;
    const who = `against ${level[0]!.toUpperCase()}${level.slice(1)}`;
    if (m.config.length === 'single') return `${NAMES[current.mode]} ${who}`;
    return `Hand ${m.handNo + 1} · to ${formatPoints(TARGETS[m.config.length]!)} ${who}`;
  }

  private refreshPauseItems(): void {
    if (!this.table) {
      this.context.pauseMenuItems([]);
      return;
    }
    const helper = this.prefs().helper;
    this.context.pauseMenuItems([
      {
        id: 'helper',
        label: helper ? 'Turn the helper off' : 'Turn the helper on',
        run: () => {
          this.saves.prefs.update((p) => ({ ...withDefaults(p, DEFAULT_PREFS), helper: !helper }));
          this.refreshPauseItems();
        },
      },
    ]);
  }

  private install(ids: readonly string[]): string[] {
    const fresh: string[] = [];
    for (const id of ids) {
      if (!PACKAGES.some((p) => p.id === id)) continue;
      if (this.context.installPackage(id)) fresh.push(PACKAGES.find((p) => p.id === id)!.title);
    }
    return fresh;
  }

  /** A hand is scored: journal, records, packages, then its score sheet. */
  private handOver(match: MatchState): void {
    const current = this.current!;
    const record = match.history.at(-1)!;
    const mine = record.scores[0];
    const theirs = record.scores[1];
    const won = mine.total > theirs.total;
    const route = this.routeOf(match.handNo);
    const notes: string[] = [];
    const update = recordHand(this.saves.journal.load(), route.id, won);
    this.saves.journal.save(update.journal);
    if (update.newSticker)
      notes.push(`New sticker for your journal: ${stopOf(update.newSticker).sticker}.`);
    for (const id of update.newlyOpen) notes.push(`A new road opens: the ${ROUTES[id].name}.`);
    this.saves.records.update((r) => {
      const records = withDefaults(r, EMPTY_RECORDS);
      return {
        ...records,
        hands: records.hands + 1,
        handsWon: records.handsWon + (won ? 1 : 0),
        coups: records.coups + mine.coups / 300,
        miles: records.miles + mine.milestones,
        bestHand: Math.max(records.bestHand, mine.total),
      };
    });
    for (const title of this.install(packagesForHand(record, 0)))
      notes.push(`Package installed: ${title}.`);
    current.match = match;
    this.saves.current.save(current);
    const finisher = record.finisher;
    const story =
      finisher === null
        ? 'Nobody finished the trip: the deck ran out with both cars still on the road.'
        : finisher === 0
          ? match.config.teams
            ? 'Your team completed the trip.'
            : 'You completed the trip.'
          : match.config.teams
            ? 'The rivals completed the trip.'
            : 'Your rival completed the trip.';
    const target = TARGETS[match.config.length];
    this.card = scoreSheet({
      kicker: `${this.modeLine()} · ${route.name}`,
      title: handTitle(won, mine.total === theirs.total, match.config.teams),
      story,
      names: match.config.teams ? ['Your team', 'Rivals'] : ['You', 'Rival'],
      scores: [mine, theirs],
      totals: match.config.length === 'single' ? null : match.totals,
      target,
      explain: this.prefs().helper,
      notes,
      next: match.over
        ? { label: 'See the result', key: 'Enter', run: () => this.finishGame(match) }
        : { label: 'Next hand', key: 'Enter', run: () => this.dealNext(match) },
    });
    this.root.append(this.card.element);
    this.listenForCardKeys([
      {
        label: '',
        key: 'Enter',
        run: () => (match.over ? this.finishGame(match) : this.dealNext(match)),
      },
    ]);
    this.context.pauseMenuItems([]);
    this.card.focus();
  }

  private dealNext(match: MatchState): void {
    this.stopCardKeys();
    this.card?.element.remove();
    this.card = null;
    nextHand(match);
    const current = this.current!;
    current.match = match;
    this.saves.current.save(current);
    this.table?.newHand(match);
    this.refreshPauseItems();
    this.table?.focus();
  }

  private finishGame(match: MatchState): void {
    this.stopCardKeys();
    this.card?.element.remove();
    this.card = null;
    const current = this.current!;
    const run = this.run!;
    this.saves.current.save(null);
    const single = match.config.length === 'single';
    const last = match.history.at(-1)!;
    const mineTotal = single ? last.scores[0].total : match.totals[0];
    const theirTotal = single ? last.scores[1].total : match.totals[1];
    const won = match.winner === 0;
    const tied = match.winner === null;
    const coups = match.history.reduce((sum, r) => sum + r.scores[0].coups / 300, 0);
    const miles = match.history.reduce((sum, r) => sum + r.scores[0].milestones, 0);
    const handsWon = match.history.filter((r) => r.scores[0].total > r.scores[1].total).length;
    // The Daily Road: the first drive of the day is the one that counts.
    let dailyFirst = false;
    if (current.mode === 'daily') {
      const key = this.context.daily.dateKey();
      this.saves.daily.update((days) => {
        if (days[key]) return days;
        dailyFirst = true;
        return {
          ...days,
          [key]: {
            number: this.context.daily.number(),
            score: mineTotal,
            coups,
            miles: last.scores[0].milestones,
            won,
          },
        };
      });
    }
    const records = this.saves.records.update((r) => {
      const before = withDefaults(r, EMPTY_RECORDS);
      return {
        ...before,
        games: before.games + 1,
        gamesWon: before.gamesWon + (won ? 1 : 0),
        wonAgainst: {
          ...before.wonAgainst,
          [run.rival]: before.wonAgainst[run.rival] + (won ? 1 : 0),
        },
      };
    });
    const journal = this.saves.journal.load();
    const installed = this.install(
      packagesForGame({
        won,
        teams: match.config.teams,
        length: match.config.length,
        rival: run.rival,
        routesDriven: journal.driven.length,
        routesTotal: STOPS.length,
        dailiesPlayed: Object.keys(this.saves.daily.load()).length,
      }),
    );
    const xpEvents = [
      ...(coups > 0 ? [{ id: 'coup-fourre', xp: Math.min(18, coups * 8) }] : []),
      ...(match.history.some((r) => r.scores[0].trip > 0) ? [{ id: 'trip', xp: 6 }] : []),
      ...(match.history.some((r) => r.scores[0].shutOut > 0) ? [{ id: 'shut-out', xp: 10 }] : []),
    ];
    const outcome: GameResult['outcome'] = tied ? 'draw' : won ? 'win' : 'loss';
    const receipt = this.context.reportResult({
      outcome,
      score: mineTotal,
      stats: { wins: won ? 1 : 0, hands: match.history.length, handsWon, coups, miles },
      xpEvents,
      daily: dailyFirst,
      durationSeconds: Math.round(current.playedMs / 1000),
      presentation: 'game',
    });
    const notes: string[] = [];
    if (receipt.xpGained > 0) notes.push(`+${receipt.xpGained} XP`);
    for (const title of installed) notes.push(`Package installed: ${title}.`);
    if (current.mode === 'daily' && !dailyFirst)
      notes.push('Your first drive of the day is the one that counts.');
    const actions: ResultsAction[] = [
      { label: 'Play again', key: 'R', primary: true, run: () => this.playAgain() },
      { label: 'Game menu', run: () => this.showTitle() },
      { label: 'Back to the Hall', key: 'H', run: () => this.context.navigate('hall') },
    ];
    if (current.mode === 'daily') {
      const record = this.saves.daily.load()[this.context.daily.dateKey()];
      if (record)
        actions.push({
          label: 'Share',
          key: 'S',
          run: () => void this.context.share(dailyShareText(this.context.daily.dateKey(), record)),
        });
    }
    this.card = resultsCard({
      kicker: this.modeLine(),
      title: tied
        ? 'A dead heat'
        : won
          ? match.config.teams
            ? 'Your team wins!'
            : 'You win!'
          : match.config.teams
            ? 'The rivals win'
            : 'Your rival wins',
      story: single
        ? `${formatPoints(mineTotal)} to ${formatPoints(theirTotal)} on the ${this.routeOf(match.handNo).name}.`
        : `${formatPoints(mineTotal)} to ${formatPoints(theirTotal)} after ${match.history.length} hands.`,
      mood: tied ? 'level' : won ? 'won' : 'lost',
      stats: [
        { label: 'Hands won', value: `${handsWon} of ${match.history.length}` },
        { label: 'Miles', value: formatPoints(miles) },
        { label: 'Coups fourrés', value: String(coups) },
        { label: 'Games won', value: `${records.gamesWon} of ${records.games}` },
      ],
      notes,
      actions,
    });
    this.root.append(this.card.element);
    this.context.pauseMenuItems([]);
    this.listenForCardKeys(actions);
    this.card.focus();
  }

  playAgain(): void {
    const run = this.run;
    if (!run) return this.showTitle();
    void this.startNew(run.mode, {
      rival: run.rival,
      length: run.length,
      helper: this.prefs().helper,
    });
  }

  private listenForCardKeys(actions: readonly ResultsAction[]): void {
    this.stopCardKeys();
    const shownAt = performance.now();
    this.cardKeys = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      // Keys still held from play must not land on the card as it appears.
      if (performance.now() - shownAt < 600) return;
      const action = actions.find((a) => a.key?.toLowerCase() === event.key.toLowerCase());
      if (!action) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      action.run();
    };
    window.addEventListener('keydown', this.cardKeys, true);
  }

  private stopCardKeys(): void {
    if (this.cardKeys) window.removeEventListener('keydown', this.cardKeys, true);
    this.cardKeys = null;
  }
}
