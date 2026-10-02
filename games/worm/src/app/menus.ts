import { type Board, parseBoard } from '../engine/board';
import type { Cell } from '../engine/geometry';
import { TEMPO_MULTIPLIER, TEMPOS, type Tempo } from '../engine/tempo';
import { ATTRACT, GARDENS, type GardenSpec } from '../gardens/gardens';
import { type FillPuzzle, PUZZLES } from '../gardens/puzzles';
import { dailySquares, DAILY_CHAIN_TARGET, DAILY_LENGTH_TARGET } from '../modes/daily';
import { AutoGarden } from '../play/auto';
import { drawBedPreview } from '../render/preview';
import type { Look } from '../render/look';
import { h } from '../ui/dom';
import { createTitleScreen, type MenuEntry } from '../ui/title-screen';
import type {
  Counters,
  DailyRecord,
  EndlessKey,
  EndlessRecord,
  GameSettings,
  Progress,
} from './saves';

/**
 * The screens around a run: the game menu over the attract garden, the garden map, the fill
 * puzzles, the Daily Garden, records, how to play and settings.
 */

export interface Screen {
  element: HTMLElement;
  /** The control that should take focus when the screen opens. */
  focus?: () => void;
  /** Called once the element is in the page, for anything that needs its size. */
  mounted?(): void;
  setLook?(look: Look): void;
  destroy?(): void;
}

const STAR = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z';

function starRow(count: number, of = 3): HTMLElement {
  const row = h('span', {
    class: 'nn-starrow',
    role: 'img',
    'aria-label': `${count} of ${of} stars`,
  });
  const ns = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < of; i++) {
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', `nn-star${i < count ? ' is-earned' : ''}`);
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', STAR);
    svg.append(path);
    row.append(svg);
  }
  return row;
}

function page(
  look: Look,
  kicker: string,
  title: string,
  onBack: () => void,
  ...body: (Node | null)[]
): Screen {
  const back = h(
    'button',
    { class: 'nn-button', type: 'button', onclick: onBack },
    '← Game menu',
    h('kbd', {}, 'Esc'),
  );
  const element = h(
    'section',
    { class: 'nn-app nn-page', 'aria-label': title, 'data-look': look.id },
    h(
      'header',
      { class: 'nn-page__head' },
      back,
      h(
        'div',
        {},
        h('p', { class: 'nn-page__kicker' }, kicker),
        h('h1', { class: 'nn-page__title' }, title),
      ),
    ),
    h('div', { class: 'nn-page__body' }, ...body),
  );
  return {
    element,
    focus: () => back.focus(),
    setLook(next) {
      element.dataset.look = next.id;
    },
  };
}

interface Preview {
  canvas: HTMLCanvasElement;
  board: Board;
  start: readonly Cell[];
}

/** A page whose cards show their beds: drawn once the page has its size, and again in a new look. */
function withPreviews(screen: Screen, look: Look, previews: readonly Preview[]): Screen {
  let current = look;
  const draw = () => previews.forEach((p) => drawBedPreview(p.canvas, p.board, current, p.start));
  return {
    ...screen,
    mounted() {
      draw();
    },
    setLook(next) {
      current = next;
      screen.setLook?.(next);
      draw();
    },
  };
}

function previewCanvas(className = 'nn-tile__preview'): HTMLCanvasElement {
  return h('canvas', { class: className, 'aria-hidden': 'true' });
}

// —— the game menu ——

export interface TitleFacts {
  continueLabel: string;
  gardenStars: number;
  puzzlesFilled: number;
  endlessBest: number;
  dailyNumber: number;
  dailyName: string;
  dailyDone: DailyRecord | undefined;
  longest: number;
  tempo: Tempo;
}

export interface TitleActions {
  continue(): void;
  gardens(): void;
  puzzles(): void;
  endless(): void;
  daily(): void;
  tutorial(): void;
  records(): void;
  help(): void;
  settings(): void;
  /** Only off the Hall: inside it the Hall shows its own way back. */
  hall?(): void;
}

const TEMPO_WORDS: Record<Tempo, string> = {
  creep: 'Creep',
  stroll: 'Stroll',
  rush: 'Rush',
  zoom: 'Zoom',
};

export function titleScreen(
  look: Look,
  facts: TitleFacts,
  actions: TitleActions,
  reducedMotion: boolean,
  inHall: boolean,
): Screen {
  const entries: MenuEntry[] = [
    { label: 'Continue', meta: facts.continueLabel, primary: true, run: actions.continue },
    {
      label: 'Gardens',
      meta: `${facts.gardenStars} of ${GARDENS.length * 3} stars`,
      run: actions.gardens,
    },
    {
      label: 'Fill puzzles',
      meta: `${facts.puzzlesFilled} of ${PUZZLES.length} filled`,
      run: actions.puzzles,
    },
    {
      label: 'Endless',
      meta: facts.endlessBest > 0 ? `best ${facts.endlessBest}` : 'the 1980 rules',
      run: actions.endless,
    },
    {
      label: 'Daily Garden',
      meta: facts.dailyDone
        ? `#${facts.dailyNumber} · length ${facts.dailyDone.length}`
        : `#${facts.dailyNumber} · ${facts.dailyName}`,
      run: actions.daily,
    },
    { label: 'Tutorial', meta: 'under a minute', run: actions.tutorial },
    {
      label: 'Records',
      meta: facts.longest > 0 ? `longest ${facts.longest}` : 'scores and stars',
      run: actions.records,
    },
    { label: 'How to play', meta: 'keys and rules', run: actions.help },
    {
      label: 'Settings',
      meta: `tempo ${TEMPO_WORDS[facts.tempo].toLowerCase()}, grid, sound`,
      run: actions.settings,
    },
  ];
  if (actions.hall) entries.push({ label: '← Back to the Hall', meta: 'Esc', run: actions.hall });
  const holder = h('div', { class: 'nn-app nn-title-holder', 'data-look': look.id });
  const screen = createTitleScreen(holder, look.id, entries, { hallChrome: inHall });
  const auto = new AutoGarden(screen.view, { kind: 'garden', spec: ATTRACT }, look, 'attract', {
    reducedMotion,
  });
  const onResize = () => {
    screen.fit();
    auto.draw();
  };
  return {
    element: holder,
    focus: () => screen.focus(),
    mounted() {
      screen.fit();
      auto.draw();
      if (!reducedMotion) auto.start();
      window.addEventListener('resize', onResize);
    },
    setLook(next) {
      holder.dataset.look = next.id;
      screen.setLook(next.id);
      auto.setLook(next);
    },
    destroy() {
      auto.stop();
      window.removeEventListener('resize', onResize);
    },
  };
}

// —— the garden map ——

export function isGardenOpen(progress: Progress, index: number): boolean {
  if (index === 0) return true;
  return (progress.gardens[GARDENS[index - 1]!.id]?.stars ?? 0) > 0;
}

export function gardensScreen(
  look: Look,
  progress: Progress,
  play: (garden: GardenSpec) => void,
  back: () => void,
): Screen {
  const previews: Preview[] = [];
  const cards = GARDENS.map((garden, i) => {
    const record = progress.gardens[garden.id];
    const open = isGardenOpen(progress, i);
    const canvas = previewCanvas();
    previews.push({ canvas, board: parseBoard(garden.map), start: garden.start });
    return h(
      'li',
      {},
      h(
        'button',
        {
          type: 'button',
          class: `nn-tile${open ? '' : ' is-locked'}`,
          disabled: !open,
          onclick: () => play(garden),
          'aria-label': open
            ? `Garden ${garden.number}, ${garden.title}: ${record?.stars ?? 0} of 3 stars`
            : `Garden ${garden.number}, ${garden.title}: grow the garden before it to open`,
        },
        canvas,
        h('span', { class: 'nn-tile__number' }, String(garden.number)),
        h('span', { class: 'nn-tile__title' }, garden.title),
        h(
          'span',
          { class: 'nn-tile__idea' },
          open ? garden.idea : 'Grow the garden before this one.',
        ),
        h(
          'span',
          { class: 'nn-tile__foot' },
          starRow(record?.stars ?? 0),
          h('small', {}, `grow to ${garden.goal} · chain ×${garden.chainTarget}`),
        ),
      ),
    );
  });
  const screen = page(
    look,
    'Gardens',
    'Twelve beds, one new idea each',
    back,
    h(
      'p',
      { class: 'nn-page__lede' },
      'Grow each garden to its length. Stars: grow it, reach its chain, and grow it without a dash.',
    ),
    h('ol', { class: 'nn-tiles', 'aria-label': 'Gardens' }, ...cards),
  );
  return withPreviews(screen, look, previews);
}

// —— the fill puzzles ——

export function isPuzzleOpen(progress: Progress, index: number): boolean {
  const filled = PUZZLES.filter((p) => (progress.puzzles[p.id]?.stars ?? 0) > 0).length;
  return index < filled + 3;
}

export function puzzlesScreen(
  look: Look,
  progress: Progress,
  play: (puzzle: FillPuzzle) => void,
  back: () => void,
): Screen {
  const previews: Preview[] = [];
  const tiles = PUZZLES.map((puzzle, i) => {
    const record = progress.puzzles[puzzle.id];
    const open = isPuzzleOpen(progress, i);
    const board = parseBoard(puzzle.map);
    const canvas = previewCanvas();
    previews.push({ canvas, board, start: puzzle.start });
    return h(
      'li',
      {},
      h(
        'button',
        {
          type: 'button',
          class: `nn-tile nn-tile--puzzle${open ? '' : ' is-locked'}`,
          disabled: !open,
          onclick: () => play(puzzle),
          'aria-label': open
            ? `Fill puzzle ${puzzle.number}, ${puzzle.title}: ${record?.stars ?? 0} of 3 stars`
            : `Fill puzzle ${puzzle.number}, ${puzzle.title}: fill an earlier puzzle to open`,
        },
        canvas,
        h('span', { class: 'nn-tile__number' }, String(puzzle.number)),
        h('span', { class: 'nn-tile__title' }, puzzle.title),
        h(
          'span',
          { class: 'nn-tile__idea' },
          `${board.width} × ${board.height} · ${board.openCount} cells · par ${puzzle.par}`,
        ),
        h(
          'span',
          { class: 'nn-tile__foot' },
          starRow(record?.stars ?? 0),
          h(
            'small',
            {},
            record?.fewestMoves
              ? `best ${record.fewestMoves} moves`
              : open
                ? 'not filled yet'
                : 'locked',
          ),
        ),
      ),
    );
  });
  const screen = page(
    look,
    'Fill puzzles',
    'Cover every cell with noodle',
    back,
    h(
      'p',
      { class: 'nn-page__lede' },
      'Each box comes with its numbers, always the same and always in the same places. Eat them all and fill every cell. The noodle waits for you; Z takes a move back.',
    ),
    h('ol', { class: 'nn-tiles', 'aria-label': 'Fill puzzles' }, ...tiles),
  );
  return withPreviews(screen, look, previews);
}

// —— the Daily Garden ——

export interface DailyFacts {
  number: number;
  name: string;
  garden: GardenSpec;
  record: DailyRecord | undefined;
  history: Record<string, DailyRecord>;
}

export function dailyScreen(
  look: Look,
  facts: DailyFacts,
  actions: { play(): void; share(): void },
  back: () => void,
): Screen {
  const square = { hit: '🟩', near: '🟨', empty: '⬜' } as const;
  const played = facts.record;
  const recent = Object.entries(facts.history)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 7)
    .map(([date, r]) =>
      h(
        'li',
        {},
        h('span', {}, `#${r.number} · ${r.name}`),
        h(
          'span',
          { class: 'nn-mono' },
          dailySquares(r)
            .map((s) => square[s])
            .join(''),
        ),
        h('small', {}, `length ${r.length}, chain ×${r.bestChain} · ${date}`),
      ),
    );
  const play = h(
    'button',
    { type: 'button', class: 'nn-button is-primary', onclick: actions.play },
    played ? 'Play it again (does not count)' : 'Play today’s garden',
  );
  const share = played
    ? h('button', { type: 'button', class: 'nn-button', onclick: actions.share }, 'Share')
    : null;
  const preview = previewCanvas('nn-daily__preview');
  const screen = page(
    look,
    `Daily Garden #${facts.number}`,
    facts.name,
    back,
    preview,
    h(
      'p',
      { class: 'nn-page__lede' },
      `The same bed and the same numbers for everyone today. Play until you bonk. Squares: length ${DAILY_LENGTH_TARGET}, a chain of ${DAILY_CHAIN_TARGET}, no dash. Your first run of the day is the one that counts.`,
    ),
    played
      ? h(
          'p',
          { class: 'nn-daily__today' },
          `Today: length ${played.length}, best chain ×${played.bestChain}, score ${played.score} `,
          h(
            'span',
            { class: 'nn-mono' },
            dailySquares(played)
              .map((s) => square[s])
              .join(''),
          ),
        )
      : null,
    h('div', { class: 'nn-row' }, play, share),
    recent.length > 0 ? h('h2', { class: 'nn-page__section' }, 'Recent days') : null,
    recent.length > 0 ? h('ul', { class: 'nn-list' }, ...recent) : null,
  );
  return {
    ...withPreviews(screen, look, [
      { canvas: preview, board: parseBoard(facts.garden.map), start: facts.garden.start },
    ]),
    focus: () => play.focus(),
  };
}

// —— records ——

const ENDLESS_KEYS: readonly EndlessKey[] = [...TEMPOS, 'classic'];

export function recordsScreen(
  look: Look,
  progress: Progress,
  endless: Partial<Record<EndlessKey, EndlessRecord>>,
  counters: Counters,
  dailies: Record<string, DailyRecord>,
  back: () => void,
): Screen {
  const gardenStars = Object.values(progress.gardens).reduce((sum, r) => sum + r.stars, 0);
  const puzzleStars = Object.values(progress.puzzles).reduce((sum, r) => sum + r.stars, 0);
  const rows = ENDLESS_KEYS.map((key) => {
    const record = endless[key];
    const label =
      key === 'classic'
        ? 'Classic tempo'
        : `${TEMPO_WORDS[key]} (×${TEMPO_MULTIPLIER[key]} and up)`;
    return h(
      'tr',
      {},
      h('th', { scope: 'row' }, label),
      h('td', {}, record ? String(record.bestScore) : '—'),
      h('td', {}, record ? String(record.longest) : '—'),
      h('td', {}, record ? `×${record.bestChain}` : '—'),
      h('td', {}, record ? String(record.runs) : '0'),
    );
  });
  return page(
    look,
    'Records',
    'Your best noodling',
    back,
    h(
      'dl',
      { class: 'nn-facts' },
      ...[
        ['Longest noodle', String(counters.longest)],
        ['Best chain', counters.bestChain >= 2 ? `×${counters.bestChain}` : '—'],
        ['Garden stars', `${gardenStars} of ${GARDENS.length * 3}`],
        ['Fill puzzle stars', `${puzzleStars} of ${PUZZLES.length * 3}`],
        ['Daily Gardens', String(Object.keys(dailies).length)],
        ['Numbers eaten', String(counters.bites)],
      ].map(([label, value]) => h('div', {}, h('dt', {}, label!), h('dd', {}, value!))),
    ),
    h('h2', { class: 'nn-page__section' }, 'Endless, by starting tempo'),
    h(
      'table',
      { class: 'nn-table' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          ...['Tempo', 'Best score', 'Longest', 'Best chain', 'Runs'].map((t) =>
            h('th', { scope: 'col' }, t),
          ),
        ),
      ),
      h('tbody', {}, ...rows),
    ),
  );
}

// —— how to play ——

export function helpScreen(look: Look, back: () => void): Screen {
  const keys: [string, string][] = [
    ['Arrow keys, W A S D or H J K L', 'Turn and take a step'],
    ['Hold a direction', 'Keep going, faster: the tempo rises'],
    ['Shift + direction', 'Dash: nine cells across, five up or down, stopping at a number'],
    ['Click a cell in line with the head', 'Dash towards it'],
    ['Space (Endless)', 'Classic tempo on or off'],
    ['Z or Backspace (fill puzzles)', 'Take a move back'],
    ['Esc', 'Pause'],
  ];
  return page(
    look,
    'How to play',
    'Eat the numbers. Chain the bites. Fill the box.',
    back,
    h(
      'div',
      { class: 'nn-help' },
      h('h2', { class: 'nn-page__section' }, 'Keys'),
      h(
        'table',
        { class: 'nn-table' },
        h(
          'tbody',
          {},
          ...keys.map(([k, what]) => h('tr', {}, h('th', { scope: 'row' }, k), h('td', {}, what))),
        ),
      ),
      h('h2', { class: 'nn-page__section' }, 'Growing'),
      h(
        'p',
        {},
        'Eat a number and the noodle grows by that many cells, one cell a move, from the tail end. Bump into the edge, a rock or yourself and the run is over. Turning straight back is refused with a soft bump.',
      ),
      h('h2', { class: 'nn-page__section' }, 'Chains'),
      h(
        'p',
        {},
        'Each bite scores everything the noodle still has to grow, not just the number. Bite again while you are still digesting (you can see the bulges travel down the body) and that is a chain: a 9 then a 5 two moves later scores 9, then 12.',
      ),
      h('h2', { class: 'nn-page__section' }, 'Tempo'),
      h(
        'p',
        {},
        'Left alone the noodle creeps. Press or hold the keys to speed it up. Creep scores ×1, Stroll ×1.5, Rush ×2, Zoom ×3. Classic tempo in Endless is the 1980 clock: a step a second, no multiplier.',
      ),
      h('h2', { class: 'nn-page__section' }, 'Gardens and puzzles'),
      h(
        'p',
        {},
        'Gardens bring rocks, roots you can chew through (they grow back, and a mouthful ends a chain), sticky mud, one-way soil and tunnels. Fill puzzles ask for every cell of a small box: their numbers come in a fixed order, and the noodle waits for you.',
      ),
    ),
  );
}

// —— settings ——

export interface SettingsActions {
  openSettings(): void;
  forgetData(): void;
}

export function settingsScreen(
  look: Look,
  settings: GameSettings,
  save: (next: GameSettings) => void,
  actions: SettingsActions,
  back: () => void,
): Screen {
  let current = { ...settings };
  const update = (patch: Partial<GameSettings>) => {
    current = { ...current, ...patch };
    save(current);
    render();
  };
  const body = h('div', { class: 'nn-settings' });
  const toggle = (label: string, note: string, key: 'classicTempo' | 'grid' | 'shapes' | 'sound') =>
    h(
      'label',
      { class: 'nn-setting' },
      h('span', {}, h('strong', {}, label), h('small', {}, note)),
      h('input', {
        type: 'checkbox',
        class: 'nn-switch',
        role: 'switch',
        checked: current[key],
        onchange: (event: Event) => update({ [key]: (event.target as HTMLInputElement).checked }),
      }),
    );
  const render = () => {
    const tempos = h(
      'div',
      { class: 'nn-chips', role: 'radiogroup', 'aria-label': 'Starting tempo' },
      ...TEMPOS.map((t) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': current.tempo === t ? 'true' : 'false',
            class: `nn-chip${current.tempo === t ? ' is-on' : ''}`,
            onclick: () => update({ tempo: t }),
          },
          `${TEMPO_WORDS[t]} ×${TEMPO_MULTIPLIER[t]}`,
        ),
      ),
    );
    body.replaceChildren(
      h(
        'div',
        { class: 'nn-setting nn-setting--stack' },
        h(
          'span',
          {},
          h('strong', {}, 'Starting tempo'),
          h(
            'small',
            {},
            'How fast the noodle goes when you leave it alone. Quicker scores more, and leaves less time to think.',
          ),
        ),
        tempos,
      ),
      toggle(
        'Classic tempo in Endless',
        'The 1980 clock: a step a second, no multiplier. Space switches it during a run.',
        'classicTempo',
      ),
      toggle('Grid lines', 'Faint lines between the cells of the bed.', 'grid'),
      toggle(
        'Number shapes',
        'Each fruit has as many bumps as its value, so colour is never the only clue.',
        'shapes',
      ),
      toggle('Sound', 'Pops, chimes and the odd bonk, all quiet.', 'sound'),
      h(
        'div',
        { class: 'nn-setting' },
        h(
          'span',
          {},
          h('strong', {}, 'Motion and volume'),
          h('small', {}, 'Reduced motion and the volume follow the Hall’s settings.'),
        ),
        h(
          'button',
          { type: 'button', class: 'nn-button', onclick: actions.openSettings },
          'Hall settings',
        ),
      ),
      h(
        'div',
        { class: 'nn-setting' },
        h(
          'span',
          {},
          h('strong', {}, 'Forget my data'),
          h('small', {}, 'Stars, records and daily history for Noodle Nine, on this device.'),
        ),
        h('button', { type: 'button', class: 'nn-button', onclick: actions.forgetData }, 'Forget…'),
      ),
    );
  };
  render();
  return page(look, 'Settings', 'Noodle Nine', back, body);
}
