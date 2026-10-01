import { HARBOUR_LIGHTS } from '../arenas/harbour-lights';
import { CLASSIC_ARENAS } from '../arenas/classic';
import { OUR_ARENAS } from '../arenas/library';
import type { Arena } from '../engine/arena';
import { groundTexture } from '../render/ground';
import { type LookId, lookFor } from '../render/look';
import { DAILY_QUARTER_TICKS, DAILY_QUARTERS, type DailySky } from '../modes/daily';
import { PUZZLES, type Puzzle } from '../modes/puzzles';
import { SHIFTS, type ShiftDefinition } from '../modes/shifts';
import { AutoSky } from '../play/auto-sky';
import { h, icon } from '../ui/dom';
import type { Campaign, DailyRecord, EndlessRecord } from './saves';

/**
 * The menus before a sky: the title with a live sky behind it, the shift map, the arena picker,
 * the Daily Sky and the puzzles.
 */

const STAR = 'M12 2.6l2.8 6.1 6.6.7-4.9 4.5 1.4 6.5L12 17.1l-5.9 3.3 1.4-6.5-4.9-4.5 6.6-.7z';

export interface Screen {
  element: HTMLElement;
  /** The control that should take focus when the screen opens. */
  focus?: HTMLElement;
  setLook?(look: LookId): void;
  destroy?(): void;
}

function page(title: string, subtitle: string, onBack: () => void, ...body: Node[]): Screen {
  const back = h('button', { class: 'sk-button sk-back', type: 'button' }, '← Game menu');
  back.addEventListener('click', onBack);
  const element = h(
    'section',
    { class: 'sk-page', 'aria-label': title },
    h(
      'header',
      { class: 'sk-page__head' },
      h('div', {}, h('h1', {}, title), h('p', {}, subtitle)),
      back,
    ),
    h('div', { class: 'sk-page__body' }, ...body),
  );
  return { element, focus: back };
}

function stars(count: number, of = 3): HTMLElement {
  const row = h('span', { class: 'sk-map__stars', 'aria-label': `${count} of ${of} stars` });
  for (let i = 0; i < of; i++) row.append(icon(STAR, { stroke: i >= count }));
  return row;
}

// —— title ——

export interface TitleActions {
  continueLabel: string;
  continue(): void;
  shifts(): void;
  endless(): void;
  daily(): void;
  puzzles(): void;
  tutorial(): void;
  logbook(): void;
  records(): void;
  help(): void;
  settings(): void;
}

export interface TitleFacts {
  stars: number;
  dailyNumber: number;
  dailyArena: string;
  dailyDone: DailyRecord | undefined;
  pages: number;
  puzzlesSolved: number;
}

export function titleScreen(
  look: LookId,
  facts: TitleFacts,
  actions: TitleActions,
  reducedMotion: boolean,
): Screen {
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const sky = new AutoSky(canvas, {
    arena: HARBOUR_LIGHTS,
    seed: `title:${new Date().toDateString()}`,
    look,
    tickSeconds: 1.6,
    tilt: 0.55,
    warmUp: 40,
    reducedMotion,
  });
  const entry = (label: string, note: string, run: () => void, primary = false) => {
    const button = h('button', { type: 'button' }, h('span', {}, label), h('small', {}, note));
    button.addEventListener('click', run);
    return h('li', { class: primary ? 'is-primary' : undefined }, button);
  };
  const menu = h(
    'ul',
    { class: 'sk-menu', 'aria-label': 'Game menu' },
    entry('Continue', actions.continueLabel, actions.continue, true),
    entry('Shifts', `${facts.stars} of 36 stars`, actions.shifts),
    entry('Endless', `${CLASSIC_ARENAS.length + OUR_ARENAS.length} skies`, actions.endless),
    entry(
      'Daily Sky',
      facts.dailyDone
        ? `#${facts.dailyNumber} · ${facts.dailyDone.safe} safe`
        : `#${facts.dailyNumber} · ${facts.dailyArena}`,
      actions.daily,
    ),
    entry('Puzzles', `${facts.puzzlesSolved} of ${PUZZLES.length} solved`, actions.puzzles),
    entry('Tutorial', 'about two minutes', actions.tutorial),
    entry('Logbook', facts.pages === 1 ? '1 page' : `${facts.pages} pages`, actions.logbook),
    entry('Records', 'best skies', actions.records),
    entry('How to play', 'controls and rules', actions.help),
    entry('Settings', 'speed, help, sound', actions.settings),
  );
  const element = h(
    'section',
    { class: 'sk-titlescreen', 'aria-label': 'Skyloom' },
    canvas,
    h('div', { class: 'sk-titlescreen__veil' }),
    h(
      'div',
      { class: 'sk-titlescreen__column' },
      h('h1', { class: 'sk-titlescreen__mark' }, 'Sky', h('span', {}, 'loom')),
      h('p', { class: 'sk-titlescreen__tagline' }, 'Weave the sky. Land them all.'),
      menu,
      h('p', { class: 'sk-titlescreen__credit' }, 'Inspired by atc, Ed James, UC Berkeley, 1986.'),
    ),
  );
  const fit = () => {
    const box = element.getBoundingClientRect();
    sky.resize(box.width, box.height, window.devicePixelRatio || 1);
  };
  const observer = new ResizeObserver(fit);
  observer.observe(element);
  if (reducedMotion) requestAnimationFrame(() => (fit(), sky.draw()));
  else sky.start();
  // Arrow keys walk the menu as well as Tab does.
  menu.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = [...menu.querySelectorAll('button')];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      buttons[(at + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length];
    next?.focus();
    event.preventDefault();
  });
  return {
    element,
    focus: menu.querySelector('button') ?? undefined,
    setLook: (next) => sky.setLook(next),
    destroy() {
      observer.disconnect();
      sky.stop();
    },
  };
}

// —— the shift map ——

/** Where each shift sits on the map, as shares of its width and height: a route by night. */
const STOPS: readonly [number, number][] = [
  [0.07, 0.8],
  [0.15, 0.62],
  [0.24, 0.72],
  [0.32, 0.52],
  [0.41, 0.6],
  [0.49, 0.42],
  [0.57, 0.52],
  [0.65, 0.34],
  [0.73, 0.44],
  [0.8, 0.27],
  [0.87, 0.4],
  [0.93, 0.18],
];

/** The country under the route: Harbour Lights' scenery, wider and with no airspace drawn on it. */
const MAP_COUNTRY: Arena = {
  ...HARBOUR_LIGHTS,
  id: 'shift-map',
  width: 44,
  height: 21,
  gates: [],
  beacons: [],
  runways: [],
  airways: [],
};

export function shiftMapScreen(
  look: LookId,
  campaign: Campaign,
  onChoose: (shift: ShiftDefinition) => void,
  onBack: () => void,
): Screen {
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const map = h('div', { class: 'sk-map' }, canvas);
  let unlocked = true;
  // The furthest stop the route has reached: the first shift not yet cleared.
  let reached = SHIFTS.length - 1;
  SHIFTS.forEach((shift, i) => {
    const record = campaign.shifts[shift.id];
    const [x, y] = STOPS[i]!;
    const isNext = unlocked && !record;
    if (isNext) reached = Math.min(reached, i);
    const stop = h(
      'button',
      {
        type: 'button',
        class: `sk-map__stop${record ? ' is-cleared' : ''}${isNext ? ' is-next' : ''}`,
        style: `left:${x * 100}%;top:${y * 100}%`,
        'aria-label': `Shift ${shift.number}, ${shift.title}${record ? `, ${record.stars} stars` : ''}`,
        disabled: !unlocked,
      },
      h('span', { class: 'sk-map__dot' }, String(shift.number)),
      h('span', { class: 'sk-map__name' }, shift.title),
      stars(record?.stars ?? 0),
    );
    stop.addEventListener('click', () => onChoose(shift));
    map.append(stop);
    unlocked = Boolean(record);
  });
  const draw = () => drawRoute(canvas, look, reached);
  const observer = new ResizeObserver(draw);
  observer.observe(map);
  const screen = page(
    'Shifts',
    'Twelve shifts, one idea each. Clear one to open the next.',
    onBack,
    map,
  );
  return {
    ...screen,
    focus:
      (map.querySelector('button:not(:disabled):last-of-type') as HTMLElement | null) ??
      screen.focus,
    setLook: () => draw(),
    destroy: () => observer.disconnect(),
  };
}

/** The night flight over a dim chart: flown solid as far as the next shift, dashed beyond it. */
function drawRoute(canvas: HTMLCanvasElement, look: LookId, reached: number): void {
  const box = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(box.width * dpr);
  canvas.height = Math.round(box.height * dpr);
  const ctx = canvas.getContext('2d')!;
  const palette = lookFor(look === 'scope');
  const ground = groundTexture(MAP_COUNTRY, palette, 24, { x: 0, y: 0 });
  ctx.drawImage(ground.canvas, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = look === 'scope' ? 'rgba(2, 12, 12, 0.35)' : 'rgba(240, 232, 214, 0.3)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const points = STOPS.map(([x, y]) => ({ x: x * canvas.width, y: y * canvas.height }));
  ctx.strokeStyle = palette.route;
  ctx.lineCap = 'round';
  ctx.lineWidth = 4 * dpr;
  traceSpline(ctx, points, 0, reached);
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2.5 * dpr;
  ctx.setLineDash([2 * dpr, 9 * dpr]);
  traceSpline(ctx, points, reached, points.length - 1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

/** A Catmull-Rom curve through the stops from one index to another, as cubic Béziers. */
function traceSpline(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  from: number,
  to: number,
): void {
  ctx.beginPath();
  ctx.moveTo(points[from]!.x, points[from]!.y);
  for (let i = from; i < to; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p0 = points[i - 1] ?? p1;
    const p3 = points[i + 2] ?? p2;
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6,
      p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6,
      p2.y - (p3.y - p1.y) / 6,
      p2.x,
      p2.y,
    );
  }
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

// —— the arena picker ——

function thumbnail(arena: Arena, look: LookId): HTMLCanvasElement {
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  requestAnimationFrame(() => {
    const box = canvas.getBoundingClientRect();
    if (box.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    const cell = Math.max(4, Math.floor(canvas.width / arena.width));
    const ground = groundTexture(arena, lookFor(look === 'scope'), cell, { x: 0, y: 0 });
    canvas.getContext('2d')!.drawImage(ground.canvas, 0, 0, canvas.width, canvas.height);
  });
  return canvas;
}

export function arenaPickerScreen(
  look: LookId,
  records: Record<string, EndlessRecord>,
  onChoose: (arena: Arena) => void,
  onBack: () => void,
): Screen {
  const tiles = (arenas: readonly Arena[]) =>
    h(
      'ul',
      { class: 'sk-grid' },
      ...arenas.map((arena) => {
        const best = records[arena.id];
        const tile = h(
          'button',
          { type: 'button', class: 'sk-tile' },
          thumbnail(arena, look),
          h('span', { class: 'sk-tile__title' }, arena.name),
          h(
            'span',
            { class: 'sk-tile__meta' },
            h('span', {}, `${arena.tickSeconds} s a tick`),
            h(
              'span',
              {},
              `${plural(arena.gates.length, 'gate')} · ${plural(arena.runways.length, 'runway')}`,
            ),
            h('span', {}, best ? `best ${best.safe} safe` : 'not flown yet'),
          ),
        );
        tile.addEventListener('click', () => onChoose(arena));
        return h('li', {}, tile);
      }),
    );
  return page(
    'Endless',
    'Pick a sky and keep it as long as you can. The classic speed is the 1986 game’s own.',
    onBack,
    h('h2', { class: 'sk-section-title' }, 'From 1986'),
    tiles(CLASSIC_ARENAS),
    h('h2', { class: 'sk-section-title' }, 'Skyloom’s own'),
    tiles(OUR_ARENAS),
  );
}

// —— the Daily Sky ——

export function dailyScreen(
  look: LookId,
  sky: DailySky,
  history: Record<string, DailyRecord>,
  onStart: () => void,
  onBack: () => void,
): Screen {
  const today = history[sky.dateKey];
  const start = h(
    'button',
    { type: 'button', class: 'sk-button sk-button--primary' },
    today ? 'Fly it again' : 'Fly today’s sky',
  );
  start.addEventListener('click', onStart);
  const { arena } = sky;
  const quarters = h(
    'ol',
    {
      class: 'sk-daily__quarters',
      'aria-label': `${DAILY_QUARTERS} quarters of ${DAILY_QUARTER_TICKS} ticks`,
    },
    ...Array.from({ length: DAILY_QUARTERS }, (_, q) =>
      h(
        'li',
        {},
        h('strong', {}, String(q + 1)),
        h('span', {}, `ticks ${q * DAILY_QUARTER_TICKS + 1}–${(q + 1) * DAILY_QUARTER_TICKS}`),
      ),
    ),
  );
  const recent = Object.entries(history)
    .filter(([key]) => key !== sky.dateKey)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 5);
  const screen = page(
    `Daily Sky #${sky.number}`,
    'One sky a day, the same arena and the same traffic for everyone.',
    onBack,
    h(
      'div',
      { class: 'sk-daily' },
      h('figure', { class: 'sk-daily__map' }, thumbnail(arena, look)),
      h(
        'div',
        { class: 'sk-daily__side' },
        h('h2', {}, arena.name),
        h(
          'p',
          { class: 'sk-tile__meta' },
          h('span', {}, plural(arena.gates.length, 'gate')),
          h('span', {}, plural(arena.runways.length, 'runway')),
          h('span', {}, `${arena.tickSeconds} s a tick`),
        ),
        quarters,
        h(
          'p',
          {},
          'Each quarter becomes a square in what you share: green when it was flown cleanly, yellow with a near-miss. Pausing draws the blinds, so a break cannot be used to plan.',
        ),
        today
          ? h(
              'p',
              { class: 'sk-daily__today' },
              `Flown today: ${today.safe} safe · ${today.squares}`,
            )
          : null,
        start,
        recent.length
          ? h(
              'div',
              { class: 'sk-daily__recent' },
              h('h3', {}, 'Recent days'),
              h(
                'ul',
                {},
                ...recent.map(([, record]) =>
                  h(
                    'li',
                    {},
                    h('span', {}, `#${record.number}`),
                    h('span', {}, `${record.safe} safe`),
                    h('span', {}, record.squares),
                  ),
                ),
              ),
            )
          : null,
      ),
    ),
  );
  return { ...screen, focus: start };
}

// —— puzzles ——

export function puzzlesScreen(
  look: LookId,
  solved: Record<string, number>,
  onChoose: (puzzle: Puzzle) => void,
  onBack: () => void,
): Screen {
  const list = h(
    'ul',
    { class: 'sk-grid' },
    ...PUZZLES.map((puzzle) => {
      const best = solved[puzzle.id];
      const tile = h(
        'button',
        { type: 'button', class: 'sk-tile' },
        thumbnail(puzzle.arena, look),
        h('span', { class: 'sk-tile__title' }, puzzle.title),
        h('span', {}, puzzle.brief),
        h(
          'span',
          { class: 'sk-tile__meta' },
          h('span', {}, `par ${puzzle.par}`),
          h('span', {}, best === undefined ? 'unsolved' : `best ${best} clearances`),
        ),
      );
      tile.addEventListener('click', () => onChoose(puzzle));
      return h('li', {}, tile);
    }),
  );
  return page(
    'Clearance puzzles',
    'Time stands still while you plan. Every route, height or hold is one clearance: can you make par?',
    onBack,
    list,
  );
}
