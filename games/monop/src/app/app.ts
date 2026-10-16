import type { GameContext } from '@usr-games/kit';
import { Vector3 } from 'three';
import { BOARD_IDS, BOARDS, SEAT_COLOURS, type BoardId } from '../boards/themes';
import {
  TITLES,
  earnedExtras,
  emptyCareer,
  nextTitle,
  openTokens,
  recordGame,
  scenariosWon,
  titleOf,
  tokenFor,
  type Career,
  type Extra,
  type GameSummary,
} from '../career/career';
import { PACKAGES, packagesFor } from '../career/packages';
import { turningPoint } from '../engine/coach';
import { PERSONALITIES, type PersonalityId } from '../engine/rivals';
import { HOUSE_RULE_NAMES, quickRounds } from '../engine/rules';
import { netWorth, ownsGroup } from '../engine/state';
import type { GameState, HouseRules } from '../engine/types';
import type { PlaySession } from '../play/session';
import { who } from '../play/words';
import { ART } from '../render/boards/arts';
import { CameraRig } from '../render/world/camera';
import { BoardWorld, type CameraShot, type Honours } from '../render/world/world';
import { SCENARIOS, scenarioById, type Scenario } from '../scenarios/catalogue';
import { dailyDeal, dailyScenario, dailyShareText, type DailyRecord } from '../scenarios/daily';
import { TRANSIT_WORDS, describeGoal, met } from '../scenarios/goals';
import { renderCareer } from '../ui/career';
import { renderDaily } from '../ui/daily';
import { renderMenu } from '../ui/menu';
import { element } from '../ui/parts';
import { renderResults } from '../ui/results';
import { renderScenarios, type ScenarioCard } from '../ui/scenarios';
import { renderSetup } from '../ui/setup';
import { renderSettings } from '../ui/settings';
import { renderHelp } from '../ui/help';
import { TableSound } from '../sound/table';
import { customGame, dailySpec, quickGame, scenarioSpec, type GameSpec } from './games';
import type { SavedPlay } from '../play/session';
import { PlayScreen } from './play';
import {
  DEFAULT_PREFS,
  openSaves,
  withDefaults,
  type Prefs,
  type Saves,
  type SeatChoice,
  type TableChoices,
} from './saves';
import { showcaseTown } from './showcase';

/**
 * Deeds & Dice as the Hall runs it. The game menu sits over the chosen board's town; its doors
 * lead to a table of your own, the scenarios, the Daily Deal and your career, and every game
 * ends in a recap that counts for the career. The world stays up the whole time and only its
 * picture changes, except when the board changes and a new town is built.
 */

/** Workbench and test overrides; the Hall never sets them. */
export interface DevOptions {
  readonly seed?: string;
  readonly rounds?: number;
  /** Plays everything faster (tests and recordings). */
  readonly pace?: number;
  readonly coach?: boolean;
  /** A rival plays the person's seat (recordings and soak tests). */
  readonly autopilot?: boolean;
  /** Sets the table up after the deal (staged recordings of a Quick game). */
  readonly prepare?: (state: GameState) => void;
  /** Opens on this board instead of the one last chosen. */
  readonly board?: BoardId;
  /** Shows every career touch, earned or not (screenshots). */
  readonly honours?: boolean;
}

/** The two rivals across the table in the menu's Quick game: one who trades, one who builds. */
const RIVALS: readonly PersonalityId[] = ['dealmaker', 'builder'];

const EXTRA_WORDS: Readonly<Record<Extra, { name: string; detail: string }>> = {
  pennants: { name: 'Gold pennants', detail: 'A gold pennant flies over every flag of yours.' },
  statue: { name: 'Your statue', detail: 'Your token, cast large, stands in the middle of town.' },
  goldBase: { name: 'Golden base', detail: 'Your token stands on gold.' },
  gilded: { name: 'Gilded', detail: 'Your statue and flagpoles turn to gold.' },
};

type Screen =
  'menu' | 'setup' | 'scenarios' | 'daily' | 'career' | 'settings' | 'help' | 'play' | 'results';

export class DeedsApp {
  private readonly root = element('div', 'dd-app');
  private readonly stageHost = element('div', 'dd-stage');
  world!: BoardWorld;
  private rig!: CameraRig;
  private stopOrbit: () => void = () => {};
  private worldBoard: BoardId | null = null;
  private play: PlayScreen | null = null;
  private page: HTMLElement | null = null;
  private screen: Screen = 'menu';
  private readonly saves: Saves;
  private spec: GameSpec | null = null;
  /** Where the scenarios page was left: a chapter and a scenario in it. */
  private picked: Scenario = SCENARIOS[0]!;
  private readonly unsubscribe: (() => void)[] = [];
  private orbitStart = performance.now();
  private paused = false;
  private lastResult: { share?: () => void } = {};
  /** Until when a second press starts a fresh game over the one in progress. */
  private confirmUntil = 0;
  private readonly sound: TableSound;

  constructor(
    host: HTMLElement,
    private readonly context: GameContext,
    private readonly dev: DevOptions = {},
  ) {
    this.saves = openSaves(context);
    this.sound = new TableSound(context.audio, () => ({
      effects: this.prefs.effects,
      music: this.prefs.music,
    }));
    this.sound.setLive(true);
    const dark = this.dark;
    this.root.dataset.look = dark ? 'dark' : 'light';
    host.append(this.root);
    this.root.append(this.stageHost);
    if (dev.board) this.savePrefs({ board: dev.board });
    this.useBoard(this.prefs.board);
    this.unsubscribe.push(
      context.onAppearanceChange((state) => {
        this.world.still = state.reducedMotion;
        this.setDark(state.appearance === 'dark');
      }),
      context.onPause(() => this.pause(true)),
      context.onResume(() => this.pause(false)),
      context.onSettingsChange(() => context.audio.refresh()),
    );
    // Capture, so the game can claim Escape for its own panels before the Hall pauses.
    window.addEventListener('keydown', this.onKey, { capture: true });
    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('change', this.onChange);
    this.showMenu();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey, { capture: true });
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener('change', this.onChange);
    for (const off of this.unsubscribe) off();
    this.play?.destroy();
    this.sound.destroy();
    this.stopOrbit();
    this.rig.dispose();
    this.world.dispose();
    this.root.remove();
  }

  playAgain(): void {
    if (this.spec) this.startGame(this.again(this.spec));
    else this.startGame(this.quickSpec());
  }

  // —— saved things ——

  private get prefs(): Prefs {
    return withDefaults(this.saves.prefs.load(), DEFAULT_PREFS);
  }

  private savePrefs(patch: Partial<Prefs>): void {
    this.saves.prefs.save({ ...this.prefs, ...patch });
  }

  /** The saved career over its defaults, as a copy the caller may change and save. */
  private get career(): Career {
    const saved = withDefaults(this.saves.career.load(), emptyCareer);
    return structuredClone(saved);
  }

  private get dark(): boolean {
    return this.context.appearance().appearance === 'dark';
  }

  private get reducedMotion(): boolean {
    return this.context.appearance().reducedMotion;
  }

  // —— the world ——

  /** Builds the board's town, unless it is the one already standing. */
  private useBoard(board: BoardId): void {
    this.root.dataset.board = board;
    this.sound.setBoard(board);
    if (board === this.worldBoard) return;
    if (this.worldBoard !== null) {
      this.stopOrbit();
      this.rig.dispose();
      this.world.dispose();
    }
    this.worldBoard = board;
    this.world = new BoardWorld(this.stageHost, ART[board](), this.dark);
    this.world.still = this.reducedMotion;
    this.world.stage.setQuality(
      this.prefs.quality === 'light' || this.lightened ? 'light' : 'full',
    );
    this.rig = new CameraRig(this.world, this.menuShot(0));
    this.stopOrbit = this.world.stage.onTick((seconds) => {
      this.orbit();
      this.watchFrames(seconds);
    });
    if (!this.paused) this.world.stage.start();
    if (window.__ddDev) window.__ddWorld = this.world;
  }

  /** The career's touches on the board, for the player in seat 0. */
  private honours(token: string): Honours {
    const extras = new Set<Extra>(
      this.dev.honours
        ? ['pennants', 'statue', 'goldBase', 'gilded']
        : earnedExtras(this.career).filter((e) => !this.career.hidden.includes(e)),
    );
    return {
      seat: 0,
      token,
      colour: SEAT_COLOURS[0],
      pennants: extras.has('pennants'),
      statue: extras.has('statue'),
      goldBase: extras.has('goldBase'),
      gilded: extras.has('gilded'),
    };
  }

  /** The menu's town: the chosen board some forty turns in, with the player's own touches. */
  private showTown(board: BoardId): void {
    this.useBoard(board);
    const token = tokenFor(this.career, board);
    this.world.setHonours(this.honours(token));
    this.world.show(showcaseTown(board, token), true);
    // The menu's town in the middle of a fine day.
    this.world.setProgress(0.2, 0);
  }

  private frames = { count: 0, seconds: 0, slow: 0 };
  /** Auto quality has already stepped down this visit. */
  private lightened = false;

  /**
   * Auto quality: during play, if the town draws under 40 frames a second for two stretches of
   * four seconds running, it switches to light graphics for the rest of the visit.
   */
  private watchFrames(seconds: number): void {
    const stage = this.world.stage;
    if (this.prefs.quality !== 'auto' || stage.quality === 'light') return;
    if (this.screen !== 'play' || !stage.drawing || this.paused) return;
    this.frames.count += 1;
    this.frames.seconds += seconds;
    if (this.frames.seconds < 4) return;
    const fps = this.frames.count / this.frames.seconds;
    this.frames = { count: 0, seconds: 0, slow: fps < 40 ? this.frames.slow + 1 : 0 };
    if (this.frames.slow < 2) return;
    this.lightened = true;
    stage.setQuality('light');
  }

  private setDark(dark: boolean): void {
    this.root.dataset.look = dark ? 'dark' : 'light';
    this.world.setDark(dark);
    if (this.play) this.play.director.draw(this.play.session);
  }

  private pause(paused: boolean): void {
    this.paused = paused;
    this.sound.setPaused(paused);
    this.play?.setPaused(paused);
    if (paused) this.world.stage.stop();
    else this.world.stage.start();
  }

  private menuShot(seconds: number): CameraShot {
    return {
      target: new Vector3(0, 2, 0),
      distance: 96,
      elevation: 0.62,
      azimuth: 0.35 + seconds * 0.035,
    };
  }

  /** The camera drifts slowly round the town behind the menu pages and the recap. */
  private orbit(): void {
    if (this.screen === 'play' || this.reducedMotion) return;
    this.rig.aim(this.menuShot((performance.now() - this.orbitStart) / 1000), 0.6);
  }

  // —— pages ——

  private clearPage(): void {
    this.page?.remove();
    this.page = null;
  }

  /** Puts a page up in place of the last, keeping focus on the same control when it is redrawn. */
  private showPage(
    screen: Screen,
    render: () => HTMLElement,
    focus = '[data-act="start"], [data-act="play"]',
  ): void {
    const active = document.activeElement as HTMLElement | null;
    const keep =
      this.screen === screen && active && this.page?.contains(active) ? selectorFor(active) : null;
    this.play?.destroy();
    this.play = null;
    this.clearPage();
    if (this.screen === 'play' || this.screen === 'results' || screen !== this.screen)
      this.orbitStart = performance.now();
    if (screen !== this.screen && this.page) {
      if (screen === 'menu') this.sound.back();
      else this.sound.select();
    }
    this.screen = screen;
    this.page = render();
    this.context.setOnTitleScreen(true);
    this.context.pauseMenuItems([]);
    const target =
      (keep && this.page.querySelector<HTMLElement>(keep)) ||
      this.page.querySelector<HTMLElement>(focus);
    target?.focus();
  }

  private showMenu(): void {
    const board = this.prefs.board;
    this.showTown(board);
    const theme = BOARDS[board];
    const career = this.career;
    const daily = this.context.daily;
    const record = career.dailies[daily.dateKey()];
    const today = dailyScenario(daily.number());
    const next = nextTitle(career);
    const won = scenariosWon(career);
    const saved = this.saves.game.load();
    this.showPage(
      'menu',
      () =>
        renderMenu(this.root, {
          board,
          boards: BOARD_IDS.map((id) => ({ id, name: BOARDS[id].name })),
          boardName: theme.name,
          tagline: theme.tagline,
          rivals: RIVALS.map((id) => PERSONALITIES[id]),
          minutes: 30,
          daily: {
            number: daily.number(),
            line: record
              ? record.won
                ? `Won in ${record.turns} turns: share it`
                : 'Not today: play it again for fun'
              : `Today: ${today.title}, on ${BOARDS[today.board].name}`,
          },
          scenariosLine:
            won > 0
              ? `${won} of ${SCENARIOS.length} won`
              : `${SCENARIOS.length} puzzles, gentle to fierce`,
          careerLine: `${titleOf(career).name} · ${career.wins} win${career.wins === 1 ? '' : 's'}${next ? ` · next: ${next.name}` : ''}`,
          ...(saved ? { continueLine: saved.line } : {}),
        }),
      saved ? '[data-act="continue"]' : undefined,
    );
  }

  private chooseBoard(board: BoardId): void {
    if (this.screen === 'setup') return this.changeTable({ board });
    this.savePrefs({ board });
    this.showMenu();
  }

  // —— New game ——

  private showSetup(): void {
    const table = this.prefs.table;
    this.showTown(table.board);
    const career = this.career;
    const open = openTokens(career, table.board);
    const chosen = tokenFor(career, table.board);
    this.showPage('setup', () =>
      renderSetup(this.root, {
        table,
        boards: BOARD_IDS.map((id) => ({ id, name: BOARDS[id].name })),
        personalities: Object.values(PERSONALITIES).map((p) => ({
          id: p.id,
          name: p.name,
          title: p.title,
        })),
        colours: SEAT_COLOURS,
        tokens: BOARDS[table.board].tokens.map((t, i) => ({
          id: t.id,
          name: t.name,
          open: open.includes(t.id),
          chosen: t.id === chosen,
          ...(open.includes(t.id)
            ? {}
            : { unlock: `opens at ${TITLES.find((title) => title.tokens > i)!.name}` }),
        })),
        quickRounds: quickRounds(table.seats.length),
      }),
    );
  }

  private changeTable(patch: Partial<TableChoices>): void {
    this.savePrefs({ table: { ...this.prefs.table, ...patch } });
    this.showSetup();
  }

  private changeSeat(index: number, choice: SeatChoice): void {
    const seats = [...this.prefs.table.seats];
    seats[index] = choice;
    this.changeTable({ seats });
  }

  private addSeat(): void {
    const seats = [...this.prefs.table.seats];
    if (seats.length >= 6) return;
    const taken = new Set(seats.flatMap((s) => (s.kind === 'rival' ? [s.personality] : [])));
    const personality =
      (Object.keys(PERSONALITIES) as PersonalityId[]).find((id) => !taken.has(id)) ?? 'steady';
    seats.push({ kind: 'rival', personality, difficulty: 'medium' });
    this.changeTable({ seats });
  }

  private removeSeat(index: number): void {
    const seats = this.prefs.table.seats.filter((_, i) => i !== index);
    if (seats.length < 2 || index === 0) return;
    this.changeTable({ seats });
  }

  private chooseToken(board: BoardId, token: string): void {
    const career = this.career;
    if (!openTokens(career, board).includes(token)) return;
    career.tokens[board] = token;
    this.saves.career.save(career);
    if (this.screen === 'career') this.showCareer();
    else this.showSetup();
  }

  // —— scenarios ——

  private scenarioCard(scenario: Scenario): ScenarioCard {
    const house = Object.entries(scenario.house ?? {})
      .filter(([, on]) => on)
      .map(([key]) => HOUSE_RULE_NAMES[key as keyof HouseRules].label);
    const [, transits] = TRANSIT_WORDS[scenario.board];
    const rules = [
      ...(scenario.preset === 'berkeley' ? ['Berkeley 1980 rules: the bank lends to anyone.'] : []),
      ...(scenario.restrictions?.includes('noStreets')
        ? [`No streets for you: ${transits} and utilities only.`]
        : []),
      ...(scenario.restrictions?.includes('noTrades') ? ['No trading.'] : []),
      ...house,
    ];
    return {
      id: scenario.id,
      number: scenario.number,
      title: scenario.title,
      brief: scenario.brief,
      goals: scenario.goals.map((g) => describeGoal(g, scenario.board)),
      rounds: scenario.rounds,
      rivals: scenario.rivals.map((r) => ({
        personality: r.personality,
        name: PERSONALITIES[r.personality].name,
        title: PERSONALITIES[r.personality].title,
        difficulty: r.difficulty,
      })),
      rules,
      status: this.career.scenarios[scenario.id] ?? null,
    };
  }

  private showScenarios(): void {
    const chapter = this.picked.board;
    this.showTown(chapter);
    const career = this.career;
    this.showPage(
      'scenarios',
      () =>
        renderScenarios(this.root, {
          chapter,
          chapters: BOARD_IDS.map((id) => ({
            id,
            name: BOARDS[id].name,
            won: SCENARIOS.filter((s) => s.board === id && career.scenarios[s.id]?.won).length,
            total: SCENARIOS.filter((s) => s.board === id).length,
          })),
          list: SCENARIOS.filter((s) => s.board === chapter).map((s) => this.scenarioCard(s)),
          selected: this.picked.id,
        }),
      `[data-act="pick"][data-id="${this.picked.id}"]`,
    );
  }

  private pickChapter(board: BoardId): void {
    const chapter = SCENARIOS.filter((s) => s.board === board);
    this.picked = chapter.find((s) => !this.career.scenarios[s.id]?.won) ?? chapter[0]!;
    this.showScenarios();
  }

  private pickScenario(id: string): void {
    this.picked = scenarioById(id) ?? this.picked;
    this.showScenarios();
  }

  private stepScenario(direction: number): void {
    const chapter = SCENARIOS.filter((s) => s.board === this.picked.board);
    const at = chapter.indexOf(this.picked);
    this.picked = chapter[(at + direction + chapter.length) % chapter.length]!;
    this.showScenarios();
  }

  // —— the Daily Deal ——

  private showDaily(): void {
    const daily = this.context.daily;
    const scenario = dailyScenario(daily.number());
    this.showTown(scenario.board);
    const career = this.career;
    const key = daily.dateKey();
    this.showPage(
      'daily',
      () =>
        renderDaily(this.root, {
          number: daily.number(),
          dateLabel: new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
          boardName: BOARDS[scenario.board].name,
          card: this.scenarioCard(scenario),
          record: career.dailies[key] ?? null,
          played: Object.keys(career.dailies).length,
        }),
      career.dailies[key] ? '[data-act="share"]' : '[data-act="start"]',
    );
  }

  private shareDaily(): void {
    const key = this.context.daily.dateKey();
    const record = this.career.dailies[key];
    if (record) void this.context.share(dailyShareText(key, record));
  }

  // —— career ——

  private showCareer(): void {
    const career = this.career;
    const title = titleOf(career);
    const next = nextTitle(career);
    const earned = earnedExtras(career);
    const reached = TITLES.indexOf(title);
    this.showTown(this.prefs.board);
    this.showPage(
      'career',
      () =>
        renderCareer(this.root, {
          title: { name: title.name, line: title.line },
          next: next
            ? {
                name: next.name,
                wins: { have: career.wins, need: next.wins },
                worth: { have: career.bestWorth, need: next.worth },
              }
            : null,
          stats: [
            { label: 'Games', value: String(career.games) },
            { label: 'Wins', value: String(career.wins) },
            { label: 'Best worth', value: career.bestWorth.toLocaleString('en-GB') },
            { label: 'Scenarios won', value: `${scenariosWon(career)} of ${SCENARIOS.length}` },
            { label: 'Daily Deals', value: String(Object.keys(career.dailies).length) },
          ],
          ladder: TITLES.map((t, i) => ({
            name: t.name,
            line: t.line,
            reached: i <= reached,
            needs:
              t.worth > 0
                ? `${t.wins} wins and a best worth of ${t.worth.toLocaleString('en-GB')}`
                : `${t.wins} win${t.wins === 1 ? '' : 's'}`,
          })),
          colour: SEAT_COLOURS[0],
          boards: BOARD_IDS.map((id) => {
            const open = openTokens(career, id);
            const chosen = tokenFor(career, id);
            return {
              id,
              name: BOARDS[id].name,
              tokens: BOARDS[id].tokens.map((t, i) => ({
                id: t.id,
                name: t.name,
                open: open.includes(t.id),
                chosen: t.id === chosen,
                ...(open.includes(t.id)
                  ? {}
                  : { unlock: `opens at ${TITLES.find((x) => x.tokens > i)!.name}` }),
              })),
            };
          }),
          extras: TITLES.flatMap((t) =>
            t.extra
              ? [
                  {
                    id: t.extra,
                    name: EXTRA_WORDS[t.extra].name,
                    detail: earned.includes(t.extra)
                      ? EXTRA_WORDS[t.extra].detail
                      : `${EXTRA_WORDS[t.extra].detail} Opens at ${t.name}.`,
                    earned: earned.includes(t.extra),
                    on: earned.includes(t.extra) && !career.hidden.includes(t.extra),
                  },
                ]
              : [],
          ),
          packages: PACKAGES.map((p) => ({
            title: p.title,
            description: p.description,
            earned: career.packages.includes(p.id),
          })),
        }),
      '.dd-back',
    );
  }

  private toggleExtra(extra: Extra, on: boolean): void {
    const career = this.career;
    career.hidden = on ? career.hidden.filter((e) => e !== extra) : [...career.hidden, extra];
    this.saves.career.save(career);
    this.showCareer();
  }

  // —— settings and help ——

  private showSettings(): void {
    const prefs = this.prefs;
    this.showPage(
      'settings',
      () =>
        renderSettings(this.root, {
          effects: prefs.effects,
          music: prefs.music,
          cinematics: prefs.cinematics,
          mapView: prefs.mapView,
          quality: prefs.quality,
          coach: prefs.table.coach,
          reducedMotion: this.reducedMotion,
        }),
      '.dd-back',
    );
  }

  private changeSetting(input: HTMLInputElement): void {
    const on = input.checked;
    switch (input.dataset.field) {
      case 'effects':
      case 'music':
      case 'cinematics':
      case 'mapView':
        this.savePrefs({ [input.dataset.field]: on });
        break;
      case 'coach':
        this.savePrefs({ coach: on, table: { ...this.prefs.table, coach: on } });
        break;
      case 'quality': {
        const quality = input.value as Prefs['quality'];
        this.savePrefs({ quality });
        this.lightened = false;
        this.world.stage.setQuality(quality === 'light' ? 'light' : 'full');
        break;
      }
      default:
        return;
    }
    this.sound.refresh();
    this.showSettings();
  }

  private showHelp(): void {
    this.showPage('help', () => renderHelp(this.root), '.dd-back');
  }

  // —— play ——

  private quickSpec(): GameSpec {
    const board = this.prefs.board;
    return quickGame(board, tokenFor(this.career, board), this.prefs.coach, this.dev.seed);
  }

  /** The same game afresh: new dice, except the Daily Deal, whose dice are the day's. */
  private again(spec: GameSpec): GameSpec {
    const token = tokenFor(this.career, spec.board);
    switch (spec.kind) {
      case 'quick':
        return spec.seats.length === 3 && spec.rules.preset === 'standard'
          ? quickGame(spec.board, token, this.prefs.coach)
          : customGame(this.prefs.table, token);
      case 'classic':
        return customGame(this.prefs.table, token);
      case 'scenario':
        return scenarioSpec(spec.scenario!, token, this.prefs.coach);
      case 'daily':
        return { ...spec };
    }
  }

  private startDaily(): void {
    const daily = this.context.daily;
    const deal = dailyDeal(daily.seed(), daily.number());
    this.startFresh(
      dailySpec(deal.scenario, deal.seed, tokenFor(this.career, deal.scenario.board), {
        number: daily.number(),
        dateKey: daily.dateKey(),
      }),
    );
  }

  private label(spec: GameSpec): string {
    switch (spec.kind) {
      case 'quick':
        return 'Quick game';
      case 'classic':
        return 'Classic';
      case 'scenario':
        return `Scenario ${spec.scenario!.number} · ${spec.scenario!.title}`;
      case 'daily':
        return `Daily Deal #${spec.daily!.number}`;
    }
  }

  /** A fresh game replaces one in progress only on a second press, so nothing is lost by a slip. */
  private startFresh(spec: GameSpec): void {
    const saved = this.saves.game.load();
    const now = performance.now();
    if (saved && now > this.confirmUntil) {
      this.confirmUntil = now + 4000;
      this.notice(
        `${saved.line} is still in progress. Press again to start a new game in its place.`,
      );
      return;
    }
    this.confirmUntil = 0;
    this.saves.game.save(null);
    this.startGame(spec);
  }

  /** A short line over the page, for a moment. */
  private notice(text: string): void {
    this.page?.querySelector('.dd-page-notice')?.remove();
    const note = element('p', 'dd-panel dd-notice dd-page-notice', text);
    note.setAttribute('role', 'status');
    this.page?.append(note);
    setTimeout(() => note.remove(), 4000);
  }

  /** Picks up the saved game where it stopped. */
  private continueGame(): void {
    const saved = this.saves.game.load();
    if (!saved) return;
    const scenario = saved.scenario ? scenarioById(saved.scenario) : undefined;
    this.startGame(
      {
        kind: saved.kind,
        board: saved.board,
        seed: saved.seed,
        rules: saved.rules,
        seats: saved.seats,
        coach: saved.coach,
        ...(scenario ? { scenario } : {}),
        ...(saved.daily ? { daily: saved.daily } : {}),
      },
      saved.play,
    );
  }

  /** Saves the game whenever it waits for a person. */
  private saveGame(session: PlaySession): void {
    const spec = this.spec;
    if (!spec) return;
    const round = session.state.round + 1;
    const where = BOARDS[spec.board].name;
    const line =
      spec.kind === 'classic'
        ? `Classic on ${where}, round ${round}`
        : spec.scenario
          ? `${this.label(spec)}, turn ${session.ledger.turns} of ${spec.scenario.rounds}`
          : `Quick game on ${where}, round ${round} of ${spec.rules.rounds}`;
    this.saves.game.save({
      kind: spec.kind,
      board: spec.board,
      seed: spec.seed,
      rules: spec.rules,
      seats: spec.seats,
      coach: spec.coach,
      ...(spec.scenario ? { scenario: spec.scenario.id } : {}),
      ...(spec.daily ? { daily: spec.daily } : {}),
      play: session.saved(),
      line,
    });
  }

  private startGame(spec: GameSpec, resume?: SavedPlay): void {
    this.play?.destroy();
    this.play = null;
    this.clearPage();
    this.screen = 'play';
    // Workbench overrides apply to the menu's Quick game only.
    const quick = spec.kind === 'quick';
    const rules =
      quick && this.dev.rounds ? { ...spec.rules, rounds: this.dev.rounds } : spec.rules;
    this.spec = { ...spec, rules };
    this.useBoard(spec.board);
    this.world.setHonours(this.honours(spec.seats[0]!.token));
    const prepare = spec.prepare ?? (quick ? this.dev.prepare : undefined);
    this.play = new PlayScreen(this.root, this.world, this.rig, {
      ...(resume ? { resume } : {}),
      onSettle: (session) => this.saveGame(session),
      board: spec.board,
      seed: spec.seed,
      rules,
      seats: spec.seats,
      coach: spec.kind === 'daily' ? false : (this.dev.coach ?? spec.coach),
      pace: this.dev.pace ?? 1,
      autopilot: this.dev.autopilot ?? false,
      ...(prepare ? { prepare } : {}),
      framing: {
        label: this.label(spec),
        ...(spec.scenario ? { goals: spec.scenario.goals } : {}),
        ...(spec.scenario?.restrictions ? { restrictions: spec.scenario.restrictions } : {}),
      },
      ...(spec.scenario ? { scenario: spec.scenario } : {}),
      reducedMotion: () => this.reducedMotion,
      cinematics: () => this.prefs.cinematics,
      sound: this.sound,
      mapView: this.prefs.mapView,
      onMapView: (on) => {
        this.savePrefs({ mapView: on });
        this.pauseItems();
      },
      onOver: (session) => this.showResults(session),
    });
    this.context.setOnTitleScreen(false);
    this.pauseItems();
    this.play.start();
  }

  private toggleCoach(): void {
    if (!this.play || this.spec?.kind === 'daily') return;
    const coach = !this.play.coach;
    this.savePrefs({ coach });
    this.play.setCoach(coach);
    this.pauseItems();
  }

  private pauseItems(): void {
    if (this.screen !== 'play' || !this.spec) return;
    const items = [];
    if (this.spec.kind !== 'daily')
      items.push({
        id: 'coach',
        label: `Coach: ${this.play?.coach ? 'on' : 'off'}`,
        shortcut: 'C',
        run: () => this.toggleCoach(),
      });
    items.push({
      id: 'map',
      label: `Map view: ${this.play?.mapView ? 'on' : 'off'}`,
      shortcut: 'V',
      run: () => {
        const on = !this.play?.mapView;
        this.play?.setMapView(on);
        this.savePrefs({ mapView: on });
        this.pauseItems();
      },
    });
    items.push({
      id: 'music',
      label: `Music: ${this.prefs.music ? 'on' : 'off'}`,
      run: () => {
        this.savePrefs({ music: !this.prefs.music });
        this.pauseItems();
      },
    });
    items.push({
      id: 'restart',
      label: this.spec.kind === 'scenario' ? 'Restart the scenario' : 'New game (this one ends)',
      run: () => this.startGame(this.again(this.spec!)),
    });
    this.context.pauseMenuItems(items);
  }

  // —— the recap ——

  private showResults(session: PlaySession): void {
    const spec = this.spec!;
    this.saves.game.save(null);
    const { state, chronicle, ledger } = session;
    const person = session.owner;
    const scenario = spec.scenario;
    const verdict = session.verdict;
    const won = scenario ? verdict?.won === true : state.winner === person;
    const worths = state.seats.map((_, seat) => netWorth(state, seat));
    const order = state.seats
      .map((_, i) => i)
      .sort(
        (a, b) =>
          worths[b]! - worths[a]! || Number(state.seats[a]!.out) - Number(state.seats[b]!.out),
      );
    const point = turningPoint(chronicle, state);
    // A person who went broke has finished, even while the rivals could play on.
    const ruin = chronicle.moments.find((m) => m.kind === 'resign' && m.seat === person);
    const name = (seat: number) => who(state, seat);
    const landmarks = state.deeds.filter((d) => d && d.owner === person && d.level === 5).length;
    const towers = state.deeds.filter((d) => d && d.owner === person && d.level > 0).length;
    const districts = Array.from({ length: 8 }, (_, g) => g).filter((g) =>
      ownsGroup(state, person, g),
    ).length;
    const deals = ledger.trades;
    const seconds = Math.round((Date.now() - session.startedAt) / 1000);
    const turns = verdict?.turns ?? Math.max(1, ledger.turns);

    // The career, the day's record and the packages.
    const before = this.career;
    const summary: GameSummary = {
      kind: spec.kind,
      board: spec.board,
      preset: state.rules.preset,
      won,
      worth: worths[person]!,
      coached: this.play?.everCoached ?? spec.coach,
      ledger,
      ...(scenario ? { scenario: scenario.id } : {}),
      turns,
    };
    let after = recordGame(before, summary);
    let dailyFirst = false;
    if (spec.daily && !before.dailies[spec.daily.dateKey]) {
      dailyFirst = true;
      const record: DailyRecord = {
        number: spec.daily.number,
        scenario: scenario!.id,
        won,
        turns,
        towers,
        deals,
      };
      after = { ...after, dailies: { ...after.dailies, [spec.daily.dateKey]: record } };
    }
    const fresh: string[] = [];
    for (const id of packagesFor(summary, after)) {
      if (after.packages.includes(id)) continue;
      this.context.installPackage(id);
      after.packages.push(id);
      fresh.push(PACKAGES.find((p) => p.id === id)!.title);
    }
    this.saves.career.save(after);

    const xpEvents = [
      ...(landmarks > 0 ? [{ id: 'landmark', xp: Math.min(16, landmarks * 8) }] : []),
      ...(districts > 0 ? [{ id: 'district', xp: Math.min(10, districts * 5) }] : []),
      ...(scenario && won ? [{ id: 'scenario-won', xp: 12 }] : []),
    ];
    const receipt = this.context.reportResult({
      outcome: won ? 'win' : 'loss',
      score: Math.max(0, Math.round(worths[person]!)),
      stats: {
        games: 1,
        wins: won ? 1 : 0,
        netWorth: Math.max(0, Math.round(worths[person]!)),
        landmarks,
        districts,
        deals,
        ...(scenario ? { scenariosWon: won ? 1 : 0 } : {}),
      },
      xpEvents,
      daily: dailyFirst,
      durationSeconds: seconds,
      presentation: 'game',
    });
    const notes: string[] = [];
    if (receipt.xpGained > 0) notes.push(`+${receipt.xpGained} XP`);
    const titleBefore = titleOf(before);
    const titleAfter = titleOf(after);
    if (titleAfter !== titleBefore) notes.push(`New title: ${titleAfter.name}. ${titleAfter.line}`);
    for (const title of fresh) notes.push(`Package installed: ${title}.`);
    if (spec.daily && !dailyFirst) notes.push('Your first try of the day is the one that counts.');

    this.play?.destroy();
    this.play = null;
    this.screen = 'results';
    this.orbitStart = performance.now();
    this.page = element('div', 'dd-results-page');
    this.root.append(this.page);
    const lead = worths[order[0]!]! - worths[order[1]!]!;
    const where = BOARDS[state.board].name;
    const kicker = scenario
      ? spec.daily
        ? `Daily Deal #${spec.daily.number} · ${scenario.title} · ${where}`
        : `Scenario ${scenario.number} · ${scenario.title} · ${where}`
      : `${this.label(spec)} · ${where} · ${state.round} rounds`;
    const title = scenario
      ? won
        ? spec.daily
          ? 'Daily Deal won!'
          : 'Scenario complete!'
        : 'Not this time'
      : won
        ? state.seats.filter((s) => s.kind === 'human').length > 1
          ? `${name(person)} wins!`
          : 'You win!'
        : state.winner !== null
          ? `${name(state.winner)} wins`
          : ruin
            ? 'Out of coins'
            : `${name(order[0]!)} wins`;
    const story = scenario
      ? won
        ? `Done in ${turns} turn${turns === 1 ? '' : 's'} of ${scenario.rounds}. ${point?.text ?? ''}`.trim()
        : `${verdict?.reason ?? 'The rounds ran out first.'} Try another line: every scenario can be won.`
      : ruin
        ? `You ran out of coins on turn ${ruin.turn + 1}${ruin.partner !== undefined ? `, owing ${name(ruin.partner)}` : ''}. ${name(order[0]!)} was the richest at the table.`
        : `${point?.text ?? 'A close game all the way.'} ${won ? `You finished ${Math.round(lead).toLocaleString('en-GB')} ahead.` : ''}`.trim();
    renderResults(this.page, {
      kicker,
      title,
      story,
      standings: order.map((seat) => ({
        name: name(seat),
        colour: SEAT_COLOURS[seat]!,
        ...(state.seats[seat]!.personality ? { portrait: state.seats[seat]!.personality } : {}),
        token: state.seats[seat]!.token,
        worth: Math.round(worths[seat]!),
        you: seat === person,
        out: state.seats[seat]!.out,
      })),
      series: chronicle.worth,
      colours: state.seats.map((_, i) => SEAT_COLOURS[i]!),
      // A scenario that was not won has no turning point worth marking.
      turningPoint:
        point && (!scenario || won) ? Math.min(chronicle.worth.length - 1, point.turn) : null,
      facts: [
        ...(scenario ? [{ label: 'Your turns', value: `${turns} of ${scenario.rounds}` }] : []),
        { label: 'Districts finished', value: String(districts) },
        { label: 'Landmarks', value: String(landmarks) },
        { label: 'Deals made', value: String(deals) },
        { label: 'Time', value: seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min` },
      ],
      won,
      ...(scenario
        ? {
            goals: scenario.goals.map((g) => ({
              text: describeGoal(g, scenario.board),
              done: met(g, state, ledger),
            })),
          }
        : {}),
      notes,
      share: Boolean(spec.daily && this.career.dailies[spec.daily.dateKey]),
    });
    this.lastResult = spec.daily ? { share: () => this.shareDaily() } : {};
    this.context.pauseMenuItems([]);
    this.page.querySelector<HTMLElement>('[data-act="again"]')?.focus();
  }

  // —— input ——

  private readonly onClick = (event: MouseEvent): void => {
    this.sound.wake();
    if (this.screen === 'play') return;
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target || (target as HTMLButtonElement).disabled) return;
    this.choose(target.dataset.act!, target.dataset);
  };

  private readonly onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    if (this.screen === 'career' && input.dataset.field === 'extra')
      return this.toggleExtra(input.value as Extra, (input as HTMLInputElement).checked);
    if (this.screen === 'settings') return this.changeSetting(input as HTMLInputElement);
    if (this.screen !== 'setup') return;
    const table = this.prefs.table;
    const seat = Number(input.dataset.seat);
    switch (input.dataset.field ?? input.name) {
      case 'seat':
        return this.changeSeat(
          seat,
          input.value === 'guest'
            ? { kind: 'guest', name: '' }
            : {
                kind: 'rival',
                personality: input.value.slice(6) as PersonalityId,
                difficulty: 'medium',
              },
        );
      case 'difficulty': {
        const choice = table.seats[seat];
        if (choice?.kind === 'rival')
          this.changeSeat(seat, {
            ...choice,
            difficulty: input.value as 'easy' | 'medium' | 'hard',
          });
        return;
      }
      case 'mode':
        return this.changeTable({ mode: input.value as 'quick' | 'classic' });
      case 'preset':
        return this.changeTable({ preset: input.value as 'standard' | 'berkeley' });
      case 'house':
        return this.changeTable({
          house: { ...table.house, [input.value]: (input as HTMLInputElement).checked },
        });
      case 'coach':
        return this.changeTable({ coach: (input as HTMLInputElement).checked });
      default:
        return;
    }
  };

  private choose(act: string, data: DOMStringMap = {}): void {
    switch (act) {
      case 'play':
        return this.startFresh(this.quickSpec());
      case 'continue':
        return this.continueGame();
      case 'again':
        return this.playAgain();
      case 'board':
        return this.chooseBoard(data.board as BoardId);
      case 'setup':
        return this.showSetup();
      case 'scenarios':
        return this.showScenarios();
      case 'daily':
        return this.showDaily();
      case 'career':
        return this.showCareer();
      case 'menu':
        return this.showMenu();
      case 'hall':
        return this.context.navigate('hall');
      case 'help':
        return this.showHelp();
      case 'settings':
        return this.showSettings();
      case 'hall-settings':
        return this.context.openSettings();
      case 'share':
        return this.screen === 'daily' ? this.shareDaily() : this.lastResult.share?.();
      case 'token':
        return this.chooseToken(
          (data.board as BoardId | undefined) ?? this.prefs.table.board,
          data.token!,
        );
      case 'add':
        return this.addSeat();
      case 'remove':
        return this.removeSeat(Number(data.seat));
      case 'chapter':
        return this.pickChapter(data.board as BoardId);
      case 'pick':
        return this.pickScenario(data.id!);
      case 'start':
        return this.startFromPage();
      default:
        return;
    }
  }

  private startFromPage(): void {
    if (this.screen === 'setup') {
      const table = this.prefs.table;
      return this.startFresh(customGame(table, tokenFor(this.career, table.board), this.dev.seed));
    }
    if (this.screen === 'scenarios')
      return this.startFresh(
        scenarioSpec(this.picked, tokenFor(this.career, this.picked.board), this.prefs.coach),
      );
    if (this.screen === 'daily') return this.startDaily();
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    this.sound.wake();
    if (this.paused || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey)
      return;
    if (this.screen === 'play') {
      if (this.play?.handleKey(event)) event.preventDefault();
      return;
    }
    const key = event.key;
    const lower = key.toLowerCase();
    const focused = document.activeElement as HTMLElement | null;
    const onButton = focused instanceof HTMLButtonElement && this.root.contains(focused);
    const inField = focused instanceof HTMLSelectElement || focused instanceof HTMLInputElement;
    const handled = (): void => event.preventDefault();
    if (this.screen !== 'menu' && this.screen !== 'results' && key === 'Escape') {
      handled();
      return this.showMenu();
    }
    if (
      /^[1-3]$/.test(key) &&
      !inField &&
      (this.screen === 'menu' || this.screen === 'setup' || this.screen === 'scenarios')
    ) {
      const board = BOARD_IDS[Number(key) - 1]!;
      handled();
      return this.screen === 'scenarios' ? this.pickChapter(board) : this.chooseBoard(board);
    }
    switch (this.screen) {
      case 'menu': {
        const doors: Record<string, string> = {
          n: 'setup',
          s: 'scenarios',
          d: 'daily',
          c: 'career',
          o: 'settings',
          '?': 'help',
        };
        if (key === 'Enter' && !onButton) {
          handled();
          return this.choose(this.saves.game.load() ? 'continue' : 'play');
        }
        if (doors[lower]) {
          handled();
          return this.choose(doors[lower]!);
        }
        return;
      }
      case 'setup':
        if (key === 'Enter' && !onButton && !(focused instanceof HTMLSelectElement)) {
          handled();
          return this.startFromPage();
        }
        if (key === '+' && !inField) {
          handled();
          return this.addSeat();
        }
        return;
      case 'scenarios':
        if (key === 'ArrowDown' || key === 'ArrowUp') {
          handled();
          return this.stepScenario(key === 'ArrowDown' ? 1 : -1);
        }
        if (key === 'Enter' && !(onButton && focused?.dataset.act !== 'pick')) {
          handled();
          return this.startFromPage();
        }
        return;
      case 'daily':
        if (key === 'Enter' && !onButton) {
          handled();
          return this.startDaily();
        }
        if (lower === 's') {
          handled();
          return this.shareDaily();
        }
        return;
      case 'results':
        if (lower === 'r') return (handled(), this.playAgain());
        if (lower === 'h') return (handled(), this.choose('hall'));
        if (lower === 's' && this.lastResult.share) return (handled(), this.lastResult.share());
        return;
      default:
        return;
    }
  };
}

/** A selector that finds a control again after its page is drawn anew. */
function selectorFor(node: HTMLElement): string | null {
  const data = Object.entries(node.dataset);
  if (data.length === 0)
    return node.getAttribute('name')
      ? `[name="${node.getAttribute('name')}"][value="${(node as HTMLInputElement).value}"]`
      : null;
  return data
    .map(
      ([key, value]) => `[data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${value}"]`,
    )
    .join('');
}
