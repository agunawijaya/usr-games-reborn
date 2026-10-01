import { ENDLESS_ARENAS, arenaById } from '../arenas/library';
import type { LookId } from '../render/look';
import { drawTapestry } from '../render/tapestry';
import { decodeThread } from '../play/history';
import { h } from '../ui/dom';
import type { Screen } from './menus';
import type {
  Counters,
  DailyRecord,
  EndlessRecord,
  GameSettings,
  LogbookPage,
  Speed,
} from './saves';

/**
 * The pages behind the menu: records, the logbook, settings and the manual.
 */

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

// —— records ——

export function recordsScreen(
  endless: Record<string, EndlessRecord>,
  daily: Record<string, DailyRecord>,
  onBack: () => void,
): Screen {
  const rows = ENDLESS_ARENAS.map((arena) => {
    const best = endless[arena.id];
    return h(
      'tr',
      {},
      h('td', {}, arena.name),
      h('td', {}, best ? String(best.safe) : '—'),
      h('td', {}, best ? String(best.ticks) : '—'),
      h('td', {}, best?.dateKey ?? ''),
    );
  });
  const days = Object.entries(daily)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 30)
    .map(([dateKey, record]) =>
      h(
        'tr',
        {},
        h('td', {}, `#${record.number}`),
        h('td', {}, dateKey),
        h('td', {}, String(record.safe)),
        h('td', {}, record.squares),
        h('td', {}, `×${record.longestString}`),
      ),
    );
  return page(
    'Records',
    'Your best skies on this device.',
    onBack,
    h(
      'p',
      { class: 'sk-note' },
      'Skies are ranked by planes brought home safely, and a tie goes to the shorter sky. The 1986 game’s manual said the same, but its code kept your record by how long you lasted and broke ties in favour of the longer game; Skyloom ranks the way the manual promised.',
    ),
    h('h2', { class: 'sk-section-title' }, 'Endless'),
    h(
      'table',
      { class: 'sk-table' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', {}, 'Sky'),
          h('th', {}, 'Safe'),
          h('th', {}, 'Ticks'),
          h('th', {}, 'Flown'),
        ),
      ),
      h('tbody', {}, ...rows),
    ),
    h('h2', { class: 'sk-section-title' }, 'Daily Skies'),
    days.length
      ? h(
          'table',
          { class: 'sk-table' },
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              h('th', {}, 'Sky'),
              h('th', {}, 'Day'),
              h('th', {}, 'Safe'),
              h('th', {}, 'Quarters'),
              h('th', {}, 'String'),
            ),
          ),
          h('tbody', {}, ...days),
        )
      : h('p', {}, 'No Daily Sky flown yet.'),
  );
}

// —— the logbook ——

/** Cosmetic ratings for the logbook's cover: they only ever describe what has been flown. */
const RATINGS: readonly { from: number; title: string }[] = [
  { from: 0, title: 'Trainee' },
  { from: 25, title: 'Assistant controller' },
  { from: 100, title: 'Controller' },
  { from: 250, title: 'Senior controller' },
  { from: 600, title: 'Tower chief' },
  { from: 1500, title: 'Keeper of the sky' },
];

export function ratingFor(planesSafe: number): string {
  return [...RATINGS].reverse().find((r) => planesSafe >= r.from)!.title;
}

function pageTapestry(entry: LogbookPage, look: LookId, canvas: HTMLCanvasElement): void {
  const arena = arenaById(entry.arenaId);
  if (!arena) return;
  const flights = entry.threads.map(decodeThread).filter((f) => f !== null);
  requestAnimationFrame(() => {
    const box = canvas.getBoundingClientRect();
    if (box.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    drawTapestry(canvas, {
      arena,
      flights,
      knots: entry.knots.map(([x, y]) => ({ x, y })),
      dark: look === 'scope',
      caption: `${entry.title} · ${entry.safe} home safely`,
      seed: entry.id,
    });
  });
}

export function logbookScreen(
  look: LookId,
  pages: readonly LogbookPage[],
  counters: Counters,
  onBack: () => void,
): Screen {
  const viewer = h('div', { class: 'sk-logbook-viewer' });
  const open = (entry: LogbookPage) => {
    const canvas = h('canvas', {
      class: 'sk-tapestry',
      role: 'img',
      'aria-label': `Tapestry of ${entry.title}`,
    });
    viewer.replaceChildren(
      h('h2', { class: 'sk-section-title' }, `${entry.title} · ${entry.dateKey}`),
      canvas,
    );
    pageTapestry(entry, look, canvas);
    viewer.scrollIntoView({ block: 'start' });
  };
  const grid = h(
    'ul',
    { class: 'sk-grid' },
    ...pages.map((entry) => {
      const canvas = h('canvas', { 'aria-hidden': 'true', style: 'aspect-ratio:32/26' });
      const tile = h(
        'button',
        { type: 'button', class: 'sk-tile' },
        canvas,
        h('span', { class: 'sk-tile__title' }, entry.title),
        h(
          'span',
          { class: 'sk-tile__meta' },
          h('span', {}, entry.dateKey),
          h('span', {}, `${entry.safe} safe`),
          entry.stars === null ? null : h('span', {}, `${entry.stars}★`),
        ),
      );
      tile.addEventListener('click', () => open(entry));
      pageTapestry(entry, look, canvas);
      return h('li', {}, tile);
    }),
  );
  return page(
    'Logbook',
    `${ratingFor(counters.planesSafe)} · ${counters.planesSafe} planes home safely · ${counters.landings} landings`,
    onBack,
    pages.length ? grid : h('p', {}, 'Every sky you finish is woven into a page here.'),
    viewer,
  );
}

// —— settings ——

export function settingsScreen(
  settings: GameSettings,
  onChange: (next: GameSettings) => void,
  hall: { openSettings(): void; forgetData(): void },
  onBack: () => void,
): Screen {
  let current = { ...settings };
  const set = (patch: Partial<GameSettings>) => {
    current = { ...current, ...patch };
    onChange(current);
  };
  const segmented = <T extends string>(
    label: string,
    hint: string,
    options: readonly [T, string][],
    value: T,
    apply: (v: T) => void,
  ) => {
    const group = h('div', { class: 'sk-segmented', role: 'group', 'aria-label': label });
    const buttons = options.map(([v, text]) => {
      const button = h('button', { type: 'button', 'aria-pressed': String(v === value) }, text);
      button.addEventListener('click', () => {
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
        apply(v);
      });
      return button;
    });
    group.append(...buttons);
    return h(
      'div',
      { class: 'sk-field' },
      h('span', { class: 'sk-field__label' }, label),
      group,
      h('span', { class: 'sk-field__hint' }, hint),
    );
  };
  const toggle = (label: string, hint: string, value: boolean, apply: (v: boolean) => void) =>
    segmented(
      label,
      hint,
      [
        ['on', 'On'],
        ['off', 'Off'],
      ] as const,
      value ? 'on' : 'off',
      (v) => apply(v === 'on'),
    );
  const hallSettings = h(
    'button',
    { type: 'button', class: 'sk-button' },
    'Hall settings: volume, keys, motion',
  );
  hallSettings.addEventListener('click', () => hall.openSettings());
  const forget = h('button', { type: 'button', class: 'sk-button' }, 'Forget my Skyloom data');
  forget.addEventListener('click', () => hall.forgetData());
  return page(
    'Settings',
    'Skyloom’s own settings. Volume, motion and key bindings live in the Hall’s settings.',
    onBack,
    h(
      'div',
      { class: 'sk-form' },
      segmented<Speed>(
        'Speed',
        'How long a tick lasts, against the 1986 game’s own interval for each sky.',
        [
          ['relaxed', 'Relaxed'],
          ['classic', 'Classic'],
          ['fast', 'Fast'],
        ],
        current.speed,
        (speed) => set({ speed }),
      ),
      toggle(
        'Prediction',
        'Dashed paths three ticks ahead, and the ring that counts down to a conflict.',
        current.prediction,
        (prediction) => set({ prediction }),
      ),
      toggle(
        'Route snapping',
        'A drawn route snaps to beacons, gates and runways near the pointer.',
        current.snapping,
        (snapping) => set({ snapping }),
      ),
      toggle(
        'Shape cues',
        'Extra shapes on rings and strips, for telling colours apart less easily.',
        current.shapes,
        (shapes) => set({ shapes }),
      ),
      toggle(
        'Terminal mode at the start',
        'Open every sky with the typed command line.',
        current.terminalByDefault,
        (terminalByDefault) => set({ terminalByDefault }),
      ),
      toggle(
        'Sound',
        'Skyloom’s sounds; the Hall’s volume still applies.',
        current.sound,
        (sound) => set({ sound }),
      ),
      h('div', { class: 'sk-actions' }, hallSettings, forget),
    ),
  );
}

// —— how to play ——

export function helpScreen(onBack: () => void): Screen {
  const row = (action: string, mouse: string, keys: string) =>
    h('tr', {}, h('td', {}, action), h('td', {}, mouse), h('td', {}, keys));
  return page(
    'How to play',
    'Keep every plane apart; land the ones bound for a runway; send the rest out at 9 000 ft.',
    onBack,
    h(
      'div',
      { class: 'sk-help' },
      h('h2', {}, 'The rules'),
      h(
        'ul',
        {},
        h('li', {}, 'Jets move one cell every tick; props (capital letters) every other tick.'),
        h('li', {}, 'A plane turns at most 90° a move and changes height by 1 000 ft a move.'),
        h(
          'li',
          {},
          'Two planes within one cell and 1 000 ft of each other lose separation, and the sky is lost.',
        ),
        h(
          'li',
          {},
          'Land at 0 ft on the runway, flying along its arrow. Leave by your own gate at exactly 9 000 ft.',
        ),
        h(
          'li',
          {},
          'Fuel lasts the width plus the height of the sky in moves. A plane may not come down anywhere but its runway.',
        ),
      ),
      h('h2', {}, 'Controls'),
      h(
        'table',
        { class: 'sk-table' },
        h(
          'thead',
          {},
          h('tr', {}, h('th', {}, 'Action'), h('th', {}, 'Mouse'), h('th', {}, 'Keyboard')),
        ),
        h(
          'tbody',
          {},
          row(
            'Select a plane',
            'Click it or its strip',
            'Its letter (Shift + letter while another is selected)',
          ),
          row('Draw a route', 'Drag from the plane through beacons to a gate, runway or cell', '—'),
          row('Clear a plane from its strip', 'Drag the strip onto a runway or gate', '—'),
          row('Cancel a route being drawn', 'Right button, or Escape', 'Escape'),
          row(
            'Set a heading',
            'Hold the click: Direct to…',
            'w e d c x z a q (north, then clockwise)',
          ),
          row('Climb or descend', 'Scroll over the plane', '0–9 thousand feet'),
          row('Hold left / right', 'Hold the click: Hold left or right', '[ and ]'),
          row('Most urgent plane next', '—', 'Tab (on the radar)'),
          row('Next tick now', '—', 'Space'),
          row('Altitude Tilt', 'Hold the right button; scroll leans in', 'Hold T'),
          row('Terminal mode', '—', '`'),
          row('Pause', 'The Hall’s Pause button', 'Esc'),
        ),
      ),
      h(
        'p',
        { class: 'sk-field__hint' },
        'Space, Tab, T, `, [ and ] are the defaults; change them in the Hall’s settings.',
      ),
      h('h2', {}, 'Terminal mode'),
      h(
        'p',
        {},
        'Type the 1986 orders: a plane’s letter, then ',
        h('kbd', {}, 'a'),
        ' altitude (a digit, or + / − and a step), ',
        h('kbd', {}, 't'),
        ' heading (w e d c x z a q, l or r and an angle, L or R for 90°, or t and b, e or a with a number to head for a beacon, gate or runway), ',
        h('kbd', {}, 'c'),
        ' hold (cl left, cr right), and ',
        h('kbd', {}, 'm u i'),
        ' to mark, unmark or ignore. Add ',
        h('kbd', {}, '@b'),
        ' and a beacon number to wait for that beacon. Enter gives the order; Enter alone moves on a tick; ? lists what can come next.',
      ),
      h('h2', {}, 'Modes'),
      h(
        'ul',
        {},
        h(
          'li',
          {},
          'Shifts: twelve skies, each with a target and three stars: the target, no near-misses, fuel to spare.',
        ),
        h('li', {}, 'Endless: any of 25 skies for as long as you can keep it.'),
        h('li', {}, 'Daily Sky: the same sky for everyone today, in four quarters.'),
        h('li', {}, 'Puzzles: time waits while you plan; finish in as few clearances as par.'),
      ),
    ),
  );
}
