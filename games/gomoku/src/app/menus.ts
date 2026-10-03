import type { Rules } from '../engine/game';
import { OPPONENTS, type OpponentId } from '../engine/opponents';
import type { Look } from '../render/look';
import { SceneryView } from '../render/scenery';
import { BANDS, type Puzzle, puzzleGame, PUZZLES } from '../modes/puzzles';
import { BoardView } from '../render/view';
import { opponentById } from '../engine/opponents';
import { h, icon } from '../ui/dom';
import { createLadderScreen, type LadderModel } from '../ui/ladder-screen';
import { portraitSvg } from '../ui/portraits';
import type { DailyRecord, GameSettings, LeagueSpeed, PuzzleRecord } from './saves';

/**
 * The screens around a game: the game menu over the garden or the lake, the ladder, the puzzles,
 * the Daily Puzzle, a game for two, the Bot League, how to play and settings.
 */

export interface Screen {
  element: HTMLElement;
  /** The control that should take focus when the screen opens. */
  focus?: () => void;
  /** Called once the element is in the page, for anything that needs its size. */
  mounted?(): void;
  setLook?(look: Look): void;
  destroy?(): void;
  /** Marks the game menu, where Escape leaves for the Hall. */
  isTitle?: boolean;
}

const BACK_ICON = 'M15 6l-6 6 6 6';

/** Keeps a scenery canvas sized and moving (or still, with reduced motion) behind a screen. */
function scenery(
  root: HTMLElement,
  canvas: HTMLCanvasElement,
  look: Look,
  reducedMotion: boolean,
  motif: 'five' | null = null,
): Pick<Screen, 'mounted' | 'destroy' | 'setLook'> {
  const view = new SceneryView(canvas, look, motif);
  const started = performance.now();
  let frame = 0;
  const draw = () => view.draw((performance.now() - started) / 1000);
  const loop = () => {
    draw();
    frame = requestAnimationFrame(loop);
  };
  const observer = new ResizeObserver(() => {
    const box = root.getBoundingClientRect();
    if (box.width === 0) return;
    view.resize(box.width, box.height, window.devicePixelRatio || 1);
    draw();
  });
  return {
    mounted() {
      observer.observe(root);
      if (!reducedMotion) loop();
    },
    setLook(next) {
      root.dataset.look = next.id;
      view.setLook(next);
      draw();
    },
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
    },
  };
}

function backButton(onBack: () => void): HTMLButtonElement {
  return h(
    'button',
    { class: 'ff-button', type: 'button', onclick: onBack },
    icon(BACK_ICON, { stroke: true }),
    'Game menu',
    h('kbd', {}, 'Esc'),
  );
}

/** A page over the scenery: a head with the way back and a title, then the body. */
function page(
  look: Look,
  reducedMotion: boolean,
  inHall: boolean,
  head: { kicker: string; title: string; lede?: string },
  onBack: () => void,
  ...body: (Node | null)[]
): Screen {
  const canvas = h('canvas', { class: 'ff-canvas', 'aria-hidden': 'true' });
  const back = backButton(onBack);
  const element = h(
    'div',
    { class: `ff-root${inHall ? ' is-in-hall' : ''}`, 'data-look': look.id },
    canvas,
    h(
      'section',
      { class: 'ff-page', 'aria-label': head.title },
      h(
        'header',
        { class: 'ff-page__head' },
        h('div', {}, back),
        h(
          'div',
          { class: 'ff-page__titles' },
          h('p', { class: 'ff-kicker' }, `Fivefold · ${head.kicker}`),
          h('h1', { class: 'ff-page__title' }, head.title),
          head.lede ? h('p', { class: 'ff-page__lede' }, head.lede) : null,
        ),
        h('div', {}),
      ),
      h('div', { class: 'ff-page__body' }, ...body),
    ),
  );
  return { element, focus: () => back.focus(), ...scenery(element, canvas, look, reducedMotion) };
}

function segmented<T extends string | number | boolean>(
  label: string,
  value: T,
  choices: [T, string][],
  pick: (value: T) => void,
): HTMLElement {
  const group = h('div', { class: 'ff-segmented', role: 'group', 'aria-label': label });
  const buttons = choices.map(([v, text]) => {
    const button = h('button', { type: 'button', 'aria-pressed': String(v === value) }, text);
    button.addEventListener('click', () => {
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === button));
      pick(v);
    });
    return button;
  });
  group.append(...buttons);
  return h('div', { class: 'ff-choice' }, h('span', {}, label), group);
}

// —— the game menu ——

export interface TitleFacts {
  nextOpponent: string;
  nextRung: string;
  puzzlesSolved: number;
  dailyNumber: number;
  daily: { moves: number; solved: boolean };
  tutorialDone: boolean;
}

export interface TitleActions {
  ladder(): void;
  puzzles(): void;
  daily(): void;
  tutorial(): void;
  local(): void;
  league(): void;
  help(): void;
  settings(): void;
  /** Only off the Hall: inside it the Hall shows its own way back. */
  hall?(): void;
}

export function titleScreen(
  look: Look,
  facts: TitleFacts,
  actions: TitleActions,
  reducedMotion: boolean,
  inHall: boolean,
): Screen {
  const entries: { label: string; meta: string; run: () => void; primary?: boolean }[] = [
    facts.tutorialDone
      ? {
          label: 'Ladder',
          meta: `Up next: ${facts.nextOpponent} · ${facts.nextRung}`,
          run: actions.ladder,
          primary: true,
        }
      : {
          label: 'Start with the tutorial',
          meta: '90 seconds',
          run: actions.tutorial,
          primary: true,
        },
    facts.tutorialDone
      ? { label: 'Tutorial', meta: '90 seconds', run: actions.tutorial }
      : { label: 'Ladder', meta: `First up: ${facts.nextOpponent}`, run: actions.ladder },
    {
      label: 'Puzzles',
      meta: `${facts.puzzlesSolved} of ${PUZZLES.length} solved`,
      run: actions.puzzles,
    },
    {
      label: `Daily Puzzle #${facts.dailyNumber}`,
      meta: facts.daily.solved ? 'Solved today ✓' : `Win in ${facts.daily.moves}`,
      run: actions.daily,
    },
    { label: 'Two players', meta: 'One board, one device', run: actions.local },
    { label: 'Bot League', meta: 'Watch two minds play', run: actions.league },
    { label: 'How to play', meta: 'Rules, keys, modes', run: actions.help },
    { label: 'Settings', meta: 'Board, rules, sound', run: actions.settings },
  ];
  const buttons = entries.map((entry) =>
    h(
      'button',
      {
        type: 'button',
        class: `ff-menu__item${entry.primary ? ' is-primary' : ''}`,
        onclick: entry.run,
      },
      h('span', { class: 'ff-menu__label' }, entry.label),
      h('span', { class: 'ff-menu__meta' }, entry.meta),
    ),
  );
  const canvas = h('canvas', { class: 'ff-canvas', 'aria-hidden': 'true' });
  const element = h(
    'div',
    {
      class: `ff-root ff-titlescreen${inHall ? ' is-in-hall' : ''}`,
      'data-look': look.id,
    },
    canvas,
    h(
      'section',
      { class: 'ff-titlescreen__column', 'aria-label': 'Fivefold game menu' },
      h('p', { class: 'ff-kicker' }, '/usr/games/board · since 1994'),
      h('h1', { class: 'ff-titlescreen__mark' }, 'Fivefold'),
      h(
        'p',
        { class: 'ff-titlescreen__tagline' },
        'Five in a row. Read the threats before they read you.',
      ),
      h('nav', { class: 'ff-menu', 'aria-label': 'Game menu' }, ...buttons),
      actions.hall
        ? h(
            'button',
            { class: 'ff-button ff-titlescreen__hall', type: 'button', onclick: actions.hall },
            icon(BACK_ICON, { stroke: true }),
            'Back to the Hall',
            h('kbd', {}, 'Esc'),
          )
        : null,
    ),
  );
  // Up and down move between the menu's items.
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = (at + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[at < 0 ? 0 : next]!.focus();
    event.preventDefault();
  });
  return {
    element,
    isTitle: true,
    focus: () => buttons[0]!.focus(),
    ...scenery(element, canvas, look, reducedMotion, 'five'),
  };
}

// —— the ladder ——

export function ladderScreen(
  look: Look,
  model: LadderModel,
  actions: { play(model: LadderModel): void; change(model: LadderModel): void },
  onBack: () => void,
  reducedMotion: boolean,
  inHall: boolean,
): Screen {
  const host = h('div', { class: 'ff-screen-host' });
  const screen = createLadderScreen(host, look, { inHall });
  screen.onBack(onBack);
  screen.onPlay(actions.play);
  screen.onChange(actions.change);
  screen.update(model);
  const element = screen.root;
  const view = scenery(element, screen.canvas, look, reducedMotion);
  return {
    element,
    focus: () => element.querySelector<HTMLElement>('.ff-button--primary')?.focus(),
    mounted: view.mounted,
    destroy: view.destroy,
    setLook(next) {
      screen.setLook(next);
      view.setLook?.(next);
    },
  };
}

// —— puzzles ——

export function puzzlesScreen(
  look: Look,
  records: Record<string, PuzzleRecord>,
  onPick: (puzzle: Puzzle) => void,
  onBack: () => void,
  reducedMotion: boolean,
  inHall: boolean,
): Screen {
  const solved = PUZZLES.filter((p) => records[p.id]?.solved).length;
  const bands = BANDS.map((band) => {
    const list = PUZZLES.filter((p) => p.band === band.id);
    return h(
      'section',
      { class: 'ff-band', 'aria-label': `${band.name} puzzles` },
      h(
        'header',
        { class: 'ff-band__head' },
        h('h2', {}, band.name),
        h('p', {}, band.lede),
        h(
          'p',
          { class: 'ff-band__count' },
          `${list.filter((p) => records[p.id]?.solved).length} of ${list.length}`,
        ),
      ),
      h(
        'ol',
        { class: 'ff-puzzles' },
        ...list.map((puzzle) => {
          const record = records[puzzle.id];
          return h(
            'li',
            {},
            h(
              'button',
              {
                type: 'button',
                class: `ff-puzzle${record?.solved ? ' is-solved' : ''}`,
                'data-puzzle': puzzle.id,
                'aria-label': `Puzzle ${puzzle.number}, win in ${puzzle.moves}${record?.solved ? ', solved' : ''}`,
                onclick: () => onPick(puzzle),
              },
              h('span', { class: 'ff-puzzle__number' }, String(puzzle.number)),
              h('span', { class: 'ff-puzzle__moves' }, `in ${puzzle.moves}`),
              record?.solved
                ? h('span', { class: 'ff-puzzle__done', 'aria-hidden': 'true' }, '✓')
                : null,
            ),
          );
        }),
      ),
    );
  });
  return page(
    look,
    reducedMotion,
    inHall,
    {
      kicker: 'Puzzles',
      title: 'Win in a few',
      lede: `Each has one way to force five in the moves given. ${solved} of ${PUZZLES.length} solved.`,
    },
    onBack,
    h('div', { class: 'ff-bands' }, ...bands),
  );
}

// —— the Daily Puzzle ——

/** A still picture of a position: the board as it is drawn in play, small. */
function boardPreview(
  look: Look,
  moves: readonly number[],
  size: number,
  side: number,
): {
  element: HTMLElement;
  draw(look: Look): void;
} {
  const canvas = h('canvas', {
    class: 'ff-preview',
    'aria-hidden': 'true',
    style: `width:${side}px;height:${side}px`,
  });
  const view = new BoardView(canvas, look);
  const scale = window.devicePixelRatio || 1;
  view.resize(side, side, scale, { x: 0, y: 0, width: side, height: side }, 0, size);
  const draw = (next: Look) => {
    view.setLook(next);
    view.draw({
      size,
      pieces: moves.map((point, i) => ({ point, side: (i % 2) as 0 | 1, placedAt: -10 })),
      last: moves.at(-1) ?? null,
      threats: [],
      cursor: null,
      ghost: null,
      win: null,
      time: 0,
      motion: false,
    });
  };
  draw(look);
  return { element: canvas, draw };
}

export interface DailyFacts {
  number: number;
  puzzle: Puzzle;
  record: DailyRecord | undefined;
  solvedDays: number;
}

export function dailyScreen(
  look: Look,
  facts: DailyFacts,
  actions: { play(): void; share(): void },
  onBack: () => void,
  reducedMotion: boolean,
  inHall: boolean,
): Screen {
  const record = facts.record;
  const side = facts.puzzle.position.length % 2 === 0 ? 0 : 1;
  const play = h(
    'button',
    { class: 'ff-button ff-button--primary ff-button--big', type: 'button', onclick: actions.play },
    record?.solved ? 'Play it again' : record ? 'Try again' : 'Play today’s puzzle',
    h('kbd', {}, 'Enter'),
  );
  const game = puzzleGame(facts.puzzle);
  const preview = boardPreview(look, game.moves, game.size, 360);
  const card = h(
    'section',
    { class: 'ff-card ff-daily' },
    preview.element,
    h(
      'div',
      { class: 'ff-daily__text' },
      h('p', { class: 'ff-kicker' }, `Daily Puzzle #${facts.number}`),
      h('h2', { class: 'ff-daily__title' }, `Win in ${facts.puzzle.moves}`),
      h(
        'p',
        { class: 'ff-daily__line' },
        `You play ${look.pieces[side]!.name}. ${facts.puzzle.threes ? 'Fours and threes' : 'Fours alone'} will do it, and only one first move wins this fast.`,
      ),
      record?.solved
        ? h(
            'p',
            { class: 'ff-daily__done' },
            `Solved in ${record.moves} moves${record.tries > 1 ? `, on try ${record.tries}` : ''}.`,
          )
        : record
          ? h('p', { class: 'ff-daily__line' }, `Tries so far: ${record.tries}.`)
          : null,
      h(
        'div',
        { class: 'ff-daily__actions' },
        play,
        record?.solved
          ? h('button', { class: 'ff-button', type: 'button', onclick: actions.share }, 'Share')
          : null,
      ),
      h(
        'p',
        { class: 'ff-daily__foot' },
        `A new puzzle every day. Daily puzzles solved here: ${facts.solvedDays}.`,
      ),
    ),
  );
  const screen = page(
    look,
    reducedMotion,
    inHall,
    { kicker: 'Daily Puzzle', title: 'Today’s puzzle' },
    onBack,
    card,
  );
  return {
    ...screen,
    focus: () => play.focus(),
    setLook(next) {
      screen.setLook?.(next);
      preview.draw(next);
    },
  };
}

// —— two players ——

export function localScreen(
  look: Look,
  settings: GameSettings,
  actions: { start(size: 15 | 19, rules: Rules): void; change(patch: Partial<GameSettings>): void },
  onBack: () => void,
  reducedMotion: boolean,
  inHall: boolean,
): Screen {
  let size = settings.size;
  let rules = settings.rules;
  const start = h(
    'button',
    {
      class: 'ff-button ff-button--primary ff-button--big',
      type: 'button',
      onclick: () => actions.start(size, rules),
    },
    'Start the game',
    h('kbd', {}, 'Enter'),
  );
  const screen = page(
    look,
    reducedMotion,
    inHall,
    {
      kicker: 'Two players',
      title: 'One board, two players',
      lede: `${look.pieces[0]!.name} moves first. Take turns with the mouse or the arrow keys and Enter; Z takes a move back.`,
    },
    onBack,
    h(
      'section',
      { class: 'ff-card ff-setup' },
      segmented(
        'Board',
        size,
        [
          [15, '15 × 15'],
          [19, '19 × 19'],
        ],
        (v) => {
          size = v;
          actions.change({ size: v });
        },
      ),
      segmented(
        'Rules',
        rules,
        [
          ['freestyle', 'Freestyle'],
          ['exact', 'Exactly five'],
        ],
        (v) => {
          rules = v;
          actions.change({ rules: v });
        },
      ),
      start,
    ),
  );
  return { ...screen, focus: () => start.focus() };
}

// —— the Bot League ——

export interface LeagueChoice {
  first: OpponentId;
  second: OpponentId;
  speed: LeagueSpeed;
}

export function leagueScreen(
  look: Look,
  initial: LeagueChoice,
  actions: { start(choice: LeagueChoice): void; change(speed: LeagueSpeed): void },
  onBack: () => void,
  reducedMotion: boolean,
  inHall: boolean,
): Screen {
  const choice = { ...initial };
  const matchup = h('div', { class: 'ff-matchup', 'aria-live': 'polite' });
  const showMatchup = () => {
    const face = (id: OpponentId, side: 0 | 1) => {
      const portrait = h('span', {});
      portrait.innerHTML = portraitSvg(id, look.dark, 150);
      return h(
        'div',
        { class: 'ff-matchup__player' },
        portrait,
        h('strong', {}, opponentById(id).name),
        h('span', {}, `${look.pieces[side]!.name} in game one`),
      );
    };
    matchup.replaceChildren(
      face(choice.first, 0),
      h('p', { class: 'ff-matchup__vs' }, 'versus'),
      face(choice.second, 1),
      h('p', { class: 'ff-matchup__note' }, 'First to two wins. Sides swap every game.'),
    );
  };
  showMatchup();
  const picker = (label: string, key: 'first' | 'second') => {
    const group = h('div', { class: 'ff-picker', role: 'radiogroup', 'aria-label': label });
    const buttons = OPPONENTS.map((o) => {
      const portrait = h('span', {});
      portrait.innerHTML = portraitSvg(o.id, look.dark, 64);
      const button = h(
        'button',
        {
          type: 'button',
          role: 'radio',
          class: 'ff-picker__item',
          'aria-checked': String(choice[key] === o.id),
          'data-opponent': o.id,
        },
        portrait,
        h('span', {}, o.name),
      );
      button.addEventListener('click', () => {
        choice[key] = o.id;
        for (const b of buttons) b.setAttribute('aria-checked', String(b === button));
        showMatchup();
      });
      return button;
    });
    group.append(...buttons);
    return h(
      'div',
      { class: 'ff-picker__row' },
      h('h2', { class: 'ff-picker__label' }, label),
      group,
    );
  };
  const start = h(
    'button',
    {
      class: 'ff-button ff-button--primary ff-button--big',
      type: 'button',
      onclick: () => actions.start(choice),
    },
    'Start the match',
    h('kbd', {}, 'Enter'),
  );
  const screen = page(
    look,
    reducedMotion,
    inHall,
    {
      kicker: 'Bot League',
      title: 'Two minds, three games',
      lede: 'The 1994 program was made for tournaments run by a referee program. Here you are the audience: pick two players and watch them play a match, first to two wins.',
    },
    onBack,
    h(
      'section',
      { class: 'ff-card ff-setup ff-setup--league' },
      matchup,
      picker(`${look.pieces[0]!.name} in game one`, 'first'),
      picker(`${look.pieces[1]!.name} in game one`, 'second'),
      segmented(
        'Pace',
        choice.speed,
        [
          ['calm', 'Calm'],
          ['brisk', 'Brisk'],
          ['swift', 'Swift'],
        ],
        (v) => {
          choice.speed = v;
          actions.change(v);
        },
      ),
      start,
    ),
  );
  return { ...screen, focus: () => start.focus() };
}

// —— how to play ——

export function helpScreen(
  look: Look,
  onBack: () => void,
  reducedMotion: boolean,
  inHall: boolean,
): Screen {
  const keys: [string, string][] = [
    ['Mouse', 'Point to see where your piece will go; click to place it.'],
    ['← ↑ → ↓', 'Move the cursor on the board.'],
    ['Enter or Space', 'Place a piece at the cursor.'],
    ['T', 'Read the board on or off (where it is allowed).'],
    ['Z', 'Take a move back (practice and two-player games).'],
    ['Esc', 'Pause; on the game menu, back to the Hall.'],
    ['R · H', 'On the results: play again · back to the Hall.'],
    ['← → in a replay', 'Step through the game, move by move.'],
  ];
  return page(
    look,
    reducedMotion,
    inHall,
    { kicker: 'How to play', title: 'Five in a row' },
    onBack,
    h(
      'div',
      { class: 'ff-help' },
      h(
        'section',
        { class: 'ff-card' },
        h('h2', {}, 'The game'),
        h(
          'p',
          {},
          `Two players place pieces in turn on the points where the lines cross, ${look.pieces[0]!.name.toLowerCase()} first. The first to make an unbroken line of five — across, down or on a slant — wins. A full board with no five is a draw.`,
        ),
        h(
          'p',
          {},
          'Freestyle counts five or more, as the 1994 program did. Under Exactly five, six or more in a row counts for nothing.',
        ),
        h('h2', {}, 'Reading the board'),
        h(
          'p',
          {},
          'A four is one move from five: answer it or lose. An open three is three in a row with room at both ends: one more move makes an open four, which no single move can stop. Read the board draws them for you — solid lines for fours, dashed lines for open threes, rings where they complete — in practice, puzzles and two-player games. Ranked ladder games and the Daily Puzzle leave the reading to you.',
        ),
      ),
      h(
        'section',
        { class: 'ff-card' },
        h('h2', {}, 'Keys'),
        h(
          'dl',
          { class: 'ff-keys' },
          ...keys.map(([key, text]) =>
            h('div', {}, h('dt', {}, h('kbd', {}, key)), h('dd', {}, text)),
          ),
        ),
        h('h2', {}, 'Modes'),
        h(
          'p',
          {},
          'The Ladder: beat each opponent twice to meet the next; a win moving second earns a star. Puzzles: sixty positions with one way to win in a few moves. The Daily Puzzle: one a day, to share. Two players: one board, one device. The Bot League: watch two opponents play a match.',
        ),
      ),
    ),
  );
}

// —— settings ——

export function settingsScreen(
  look: Look,
  settings: GameSettings,
  change: (patch: Partial<GameSettings>) => void,
  actions: { openSettings(): void; forgetData(): void },
  onBack: () => void,
  reducedMotion: boolean,
  inHall: boolean,
): Screen {
  return page(
    look,
    reducedMotion,
    inHall,
    { kicker: 'Settings', title: 'Board and sound' },
    onBack,
    h(
      'section',
      { class: 'ff-card ff-setup' },
      segmented(
        'Board for new games',
        settings.size,
        [
          [15, '15 × 15'],
          [19, '19 × 19 (the original)'],
        ],
        (size) => change({ size }),
      ),
      segmented(
        'Rules',
        settings.rules,
        [
          ['freestyle', 'Freestyle'],
          ['exact', 'Exactly five'],
        ],
        (rules) => change({ rules }),
      ),
      segmented(
        'Read the board when allowed',
        settings.readBoard,
        [
          [true, 'On'],
          [false, 'Off'],
        ],
        (readBoard) => change({ readBoard }),
      ),
      segmented(
        'Sound',
        settings.sound,
        [
          [true, 'On'],
          [false, 'Off'],
        ],
        (sound) => change({ sound }),
      ),
      h(
        'div',
        { class: 'ff-setup__row' },
        h(
          'button',
          { class: 'ff-button', type: 'button', onclick: actions.openSettings },
          'Hall settings: look, volume, motion',
        ),
        h(
          'button',
          { class: 'ff-button', type: 'button', onclick: actions.forgetData },
          'Forget my Fivefold progress',
        ),
      ),
    ),
  );
}
