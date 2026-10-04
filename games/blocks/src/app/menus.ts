import { DIVES, type DiveSpec, starLabels } from '../dives/dives';
import { bubbleString, DAILY_SINKERS } from '../modes/daily';
import { AutoTank } from '../play/auto';
import type { Look } from '../render/look';
import { drawDivePreview, drawSinkerRow } from '../render/preview';
import { bubbleIcon, starIcon } from '../ui/cards';
import { h } from '../ui/dom';
import { createTitleScreen, type MenuEntry } from '../ui/title-screen';
import type { Counters, DailyRecord, GameSettings, LevelRecords, Progress } from './saves';

/**
 * The screens around a run: the game menu over the attract tank, the dives, Marathon and Classic
 * 1992 with their starting levels and champions, the Daily Dive, records, how to play and
 * settings.
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

function starRow(count: number, of = 3): HTMLElement {
  const row = h('span', {
    class: 'snk-starrow',
    role: 'img',
    'aria-label': `${count} of ${of} stars`,
  });
  for (let i = 0; i < of; i++) row.append(starIcon(i < count));
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
    { class: 'snk-button', type: 'button', onclick: onBack },
    '← Game menu',
    h('kbd', {}, 'Esc'),
  );
  const element = h(
    'section',
    { class: 'snk-app snk-page', 'aria-label': title, 'data-look': look.id },
    h(
      'header',
      { class: 'snk-page__head' },
      back,
      h(
        'div',
        {},
        h('p', { class: 'snk-page__kicker' }, kicker),
        h('h1', { class: 'snk-page__title' }, title),
      ),
    ),
    h('div', { class: 'snk-page__body' }, ...body),
  );
  return {
    element,
    focus: () => back.focus(),
    setLook(next) {
      element.dataset.look = next.id;
    },
  };
}

// —— the game menu ——

export interface TitleFacts {
  continueLabel: string;
  diveStars: number;
  marathonBest: number;
  classicBest: number;
  dailyNumber: number;
  dailyName: string;
  dailyDone: DailyRecord | undefined;
  bestCombo: number;
  sonar: boolean;
}

export interface TitleActions {
  continue(): void;
  dives(): void;
  marathon(): void;
  classic(): void;
  daily(): void;
  tutorial(): void;
  records(): void;
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
  const entries: MenuEntry[] = [
    { label: 'Continue', meta: facts.continueLabel, primary: true, run: actions.continue },
    { label: 'Dives', meta: `${facts.diveStars} of ${DIVES.length * 3} stars`, run: actions.dives },
    {
      label: 'Marathon',
      meta:
        facts.marathonBest > 0
          ? `best ${facts.marathonBest.toLocaleString('en-GB')}`
          : 'levels 1 to 9, and on',
      run: actions.marathon,
    },
    {
      label: 'Classic 1992',
      meta:
        facts.classicBest > 0
          ? `best ${facts.classicBest.toLocaleString('en-GB')}`
          : 'the original rules',
      run: actions.classic,
    },
    {
      label: 'Daily Dive',
      meta: facts.dailyDone
        ? `#${facts.dailyNumber} · ${facts.dailyDone.score.toLocaleString('en-GB')} ${bubbleString(facts.dailyDone.bubbles)}`
        : `#${facts.dailyNumber} · ${facts.dailyName}`,
      run: actions.daily,
    },
    { label: 'Tutorial', meta: 'about a minute', run: actions.tutorial },
    {
      label: 'Records',
      meta: facts.bestCombo >= 2 ? `deepest combo ×${facts.bestCombo}` : 'champions by level',
      run: actions.records,
    },
    { label: 'How to play', meta: 'keys and scoring', run: actions.help },
    {
      label: 'Settings',
      meta: `sonar ${facts.sonar ? 'on' : 'off'}, sound`,
      run: actions.settings,
    },
  ];
  if (actions.hall) entries.push({ label: '← Back to the Hall', meta: 'Esc', run: actions.hall });
  const holder = h('div', { class: 'snk-app snk-title-holder', 'data-look': look.id });
  const screen = createTitleScreen(holder, look.id, entries, { hallChrome: inHall });
  const auto = new AutoTank(screen.view, look, 'attract', { reducedMotion });
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

// —— the dives ——

export function isDiveOpen(progress: Progress, index: number): boolean {
  if (index === 0) return true;
  return (progress.dives[DIVES[index - 1]!.id]?.stars ?? 0) > 0;
}

export function divesScreen(
  look: Look,
  progress: Progress,
  play: (dive: DiveSpec) => void,
  back: () => void,
): Screen {
  const previews: { canvas: HTMLCanvasElement; dive: DiveSpec }[] = [];
  const tiles = DIVES.map((dive, i) => {
    const record = progress.dives[dive.id];
    const open = isDiveOpen(progress, i);
    const canvas = h('canvas', { class: 'snk-tile__preview', 'aria-hidden': 'true' });
    previews.push({ canvas, dive });
    const [goal] = starLabels(dive);
    return h(
      'li',
      {},
      h(
        'button',
        {
          type: 'button',
          class: `snk-tile${open ? '' : ' is-locked'}`,
          disabled: !open,
          onclick: () => play(dive),
          'aria-label': open
            ? `Dive ${dive.number}, ${dive.title}: ${record?.stars ?? 0} of 3 stars`
            : `Dive ${dive.number}, ${dive.title}: finish the dive before it to open`,
        },
        canvas,
        h('span', { class: 'snk-tile__number' }, String(dive.number)),
        h('span', { class: 'snk-tile__title' }, dive.title),
        h(
          'span',
          { class: 'snk-tile__idea' },
          open ? dive.idea : 'Finish the dive before this one.',
        ),
        h(
          'span',
          { class: 'snk-tile__foot' },
          starRow(record?.stars ?? 0),
          h('small', {}, `${goal} · level ${dive.level}`),
        ),
      ),
    );
  });
  const screen = page(
    look,
    'Dives',
    'Twelve tanks, one idea each',
    back,
    h(
      'p',
      { class: 'snk-page__lede' },
      'Each dive asks for a number of rows, or for every piece of coral cleared. The first star is the goal; the other two are for a high score, or for clearing the coral with few sinkers.',
    ),
    h('ol', { class: 'snk-tiles', 'aria-label': 'Dives' }, ...tiles),
  );
  let current = look;
  const draw = () => previews.forEach((p) => drawDivePreview(p.canvas, p.dive, current));
  return {
    ...screen,
    mounted: draw,
    setLook(next) {
      current = next;
      screen.setLook?.(next);
      draw();
    },
  };
}

// —— Marathon and Classic 1992 ——

export interface LevelPageText {
  kicker: string;
  title: string;
  lede: string;
  /** The start button's verb: "Dive at level 3". Levels past 9 come only by playing on. */
  start: string;
  scoreLabel: string;
}

export function levelScreen(
  look: Look,
  text: LevelPageText,
  chosen: number,
  records: LevelRecords,
  actions: { choose(level: number): void; start(level: number): void },
  back: () => void,
): Screen {
  let level = chosen;
  const chips = h('div', {
    class: 'snk-chips',
    role: 'radiogroup',
    'aria-label': 'Starting level',
  });
  const start = h(
    'button',
    {
      type: 'button',
      class: 'snk-button is-primary snk-start',
      onclick: () => actions.start(level),
    },
    '',
  );
  const renderChips = () => {
    chips.replaceChildren(
      ...Array.from({ length: 9 }, (_, i) => i + 1).map((n) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': n === level ? 'true' : 'false',
            class: `snk-chip${n === level ? ' is-on' : ''}`,
            onclick: () => {
              level = n;
              actions.choose(n);
              renderChips();
            },
          },
          `Level ${n}`,
        ),
      ),
    );
    start.textContent = `${text.start} at level ${level}`;
  };
  chips.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    level = Math.min(9, Math.max(1, level + (event.key === 'ArrowRight' ? 1 : -1)));
    actions.choose(level);
    renderChips();
    chips.querySelector<HTMLButtonElement>('.is-on')?.focus();
  });
  renderChips();
  const rows = Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
    const record = records[n];
    return h(
      'tr',
      {},
      h('th', { scope: 'row' }, `Level ${n}`),
      h('td', {}, record ? record.bestScore.toLocaleString('en-GB') : '—'),
      h('td', {}, record ? String(record.rows) : '—'),
      h('td', {}, record && record.bestCombo >= 2 ? `×${record.bestCombo}` : '—'),
      h('td', {}, record ? record.date : '—'),
    );
  });
  const screen = page(
    look,
    text.kicker,
    text.title,
    back,
    h('p', { class: 'snk-page__lede' }, text.lede),
    chips,
    h('div', { class: 'snk-row' }, start),
    h('h2', { class: 'snk-page__section' }, 'Champions by starting level'),
    h(
      'table',
      { class: 'snk-table' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          ...['Level', text.scoreLabel, 'Rows', 'Deepest combo', 'Set on'].map((t) =>
            h('th', { scope: 'col' }, t),
          ),
        ),
      ),
      h('tbody', {}, ...rows),
    ),
  );
  return { ...screen, focus: () => start.focus() };
}

// —— the Daily Dive ——

export interface DailyFacts {
  number: number;
  name: string;
  par: number;
  /** The day's first sinkers, shown on the page. */
  first: readonly number[];
  record: DailyRecord | undefined;
  history: Record<string, DailyRecord>;
}

export function dailyScreen(
  look: Look,
  facts: DailyFacts,
  actions: { play(): void; share(): void },
  back: () => void,
): Screen {
  const played = facts.record;
  const recent = Object.entries(facts.history)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 7)
    .map(([date, r]) =>
      h(
        'li',
        {},
        h('span', {}, `#${r.number} · ${r.name}`),
        h('span', { class: 'snk-mono' }, bubbleString(r.bubbles)),
        h(
          'small',
          {},
          `${r.score.toLocaleString('en-GB')} points, deepest combo ${r.bestCombo >= 2 ? `×${r.bestCombo}` : '—'} · ${date}`,
        ),
      ),
    );
  const play = h(
    'button',
    { type: 'button', class: 'snk-button is-primary', onclick: actions.play },
    played ? 'Dive it again (does not count)' : 'Dive today’s tank',
  );
  const share = played
    ? h('button', { type: 'button', class: 'snk-button', onclick: actions.share }, 'Share')
    : null;
  const row = h('canvas', { class: 'snk-daily__row', 'aria-hidden': 'true' });
  const marks = [0.5, 0.75, 1].map((share, i) =>
    h(
      'li',
      {},
      ...[0, 1, 2].map((k) => bubbleIcon(k <= i)),
      h('span', {}, Math.round(facts.par * share).toLocaleString('en-GB')),
    ),
  );
  const screen = page(
    look,
    `Daily Dive #${facts.number}`,
    facts.name,
    back,
    h(
      'p',
      { class: 'snk-page__lede' },
      `The same ${DAILY_SINKERS} sinkers in the same order for everyone today, at level 3. Your first dive of the day is the one that counts.`,
    ),
    played
      ? h(
          'p',
          { class: 'snk-daily__today' },
          `Today: ${played.score.toLocaleString('en-GB')} points `,
          ...[0, 1, 2].map((i) => bubbleIcon(i < played.bubbles)),
        )
      : null,
    h('div', { class: 'snk-row' }, play, share),
    h('h2', { class: 'snk-page__section' }, 'Today’s first sinkers'),
    row,
    h('h2', { class: 'snk-page__section' }, 'Bubbles'),
    h(
      'p',
      { class: 'snk-page__lede' },
      `The house diver dived today first and scored ${facts.par.toLocaleString('en-GB')}: that is par. Half of par earns a bubble, three quarters two, par itself all three.`,
    ),
    h(
      'ul',
      { class: 'snk-marks', 'aria-label': 'Scores for one, two and three bubbles' },
      ...marks,
    ),
    recent.length > 0 ? h('h2', { class: 'snk-page__section' }, 'Recent days') : null,
    recent.length > 0 ? h('ul', { class: 'snk-list' }, ...recent) : null,
  );
  let current = look;
  const draw = () => drawSinkerRow(row, facts.first, current);
  return {
    ...screen,
    focus: () => play.focus(),
    mounted: draw,
    setLook(next) {
      current = next;
      screen.setLook?.(next);
      draw();
    },
  };
}

// —— records ——

export function recordsScreen(
  look: Look,
  progress: Progress,
  marathon: LevelRecords,
  classic: LevelRecords,
  counters: Counters,
  dailies: Record<string, DailyRecord>,
  back: () => void,
): Screen {
  const stars = Object.values(progress.dives).reduce((sum, r) => sum + r.stars, 0);
  const table = (records: LevelRecords) =>
    h(
      'table',
      { class: 'snk-table' },
      h(
        'thead',
        {},
        h('tr', {}, ...['Level', 'Best', 'Rows', 'Runs'].map((t) => h('th', { scope: 'col' }, t))),
      ),
      h(
        'tbody',
        {},
        ...Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
          const r = records[n];
          return h(
            'tr',
            {},
            h('th', { scope: 'row' }, `Level ${n}`),
            h('td', {}, r ? r.bestScore.toLocaleString('en-GB') : '—'),
            h('td', {}, r ? String(r.rows) : '—'),
            h('td', {}, r ? String(r.runs) : '0'),
          );
        }),
      ),
    );
  return page(
    look,
    'Records',
    'Your deepest dives',
    back,
    h(
      'dl',
      { class: 'snk-facts' },
      ...[
        ['Rows burst', counters.rowsBurst.toLocaleString('en-GB')],
        ['Four at once', String(counters.fourRowBursts)],
        ['Deepest combo', counters.bestCombo >= 2 ? `×${counters.bestCombo}` : '—'],
        ['Dive stars', `${stars} of ${DIVES.length * 3}`],
        ['Daily Dives', String(Object.keys(dailies).length)],
        ['Runs', String(counters.runs)],
      ].map(([label, value]) => h('div', {}, h('dt', {}, label!), h('dd', {}, value!))),
    ),
    h(
      'div',
      { class: 'snk-columns' },
      h(
        'section',
        {},
        h('h2', { class: 'snk-page__section' }, 'Marathon, by starting level'),
        table(marathon),
      ),
      h(
        'section',
        {},
        h('h2', { class: 'snk-page__section' }, 'Classic 1992, by level'),
        table(classic),
      ),
    ),
  );
}

// —— how to play ——

export function helpScreen(look: Look, back: () => void): Screen {
  const keys: [string, string][] = [
    ['← → or A D', 'Slide the sinker; hold to keep sliding'],
    ['↑, W or X', 'Turn it clockwise'],
    ['Z', 'Turn it counter-clockwise'],
    ['↓ or S', 'Sink faster (hold)'],
    ['Space', 'Plunge: straight to the bottom'],
    ['P or Esc', 'Pause'],
    ['Classic 1992', '← → or J L slide, ↑ K or Z turn left, Space drops, Q leaves'],
  ];
  const sinkers = h('canvas', { class: 'snk-daily__row', 'aria-hidden': 'true' });
  const screen = page(
    look,
    'How to play',
    'Drop deep. Fill the row. Ride the bubbles.',
    back,
    h(
      'div',
      { class: 'snk-help' },
      h('h2', { class: 'snk-page__section' }, 'Keys'),
      h(
        'table',
        { class: 'snk-table' },
        h(
          'tbody',
          {},
          ...keys.map(([k, what]) => h('tr', {}, h('th', { scope: 'row' }, k), h('td', {}, what))),
        ),
      ),
      h('h2', { class: 'snk-page__section' }, 'The sinkers'),
      sinkers,
      h(
        'p',
        {},
        'Seven shapes, each with its own mark etched in its glass: a wave, a chevron, a ring, a star, a spiral, a cross and three little bubbles, so they can be told apart without colour. The colour says how deep a sinker came to rest: pale near the surface, deep at the bottom.',
      ),
      h('h2', { class: 'snk-page__section' }, 'Sinking'),
      h(
        'p',
        {},
        'A sinker sinks a row at a time, faster at every level. Resting on something it waits a moment, so you can still slide it into place, then settles. The dotted outline on the water below is the sonar: where it will land if you plunge now.',
      ),
      h('h2', { class: 'snk-page__section' }, 'Scoring'),
      h(
        'p',
        {},
        'A landing scores 1 to 3 times the level, more the deeper it settles. A plunge scores twice the rows it falls, times the level. Fill a row from wall to wall and it bursts: 10 for one row, 30 for two, 60 for three, 100 for four, times the depth combo and the level.',
      ),
      h('h2', { class: 'snk-page__section' }, 'The depth combo'),
      h(
        'p',
        {},
        'Every plunge in a row adds one to the depth combo; a sinker that settles on its own starts it over. A burst cashes it in: plunge three times and burst four rows with the third, and that burst is worth 100 × 3.',
      ),
      h('h2', { class: 'snk-page__section' }, 'Classic 1992'),
      h(
        'p',
        {},
        'The original rules in a ten-wide tank: turns to the left only, a point for each landing and for each row a sinker is dropped, nothing at all for clearing rows, and everything multiplied by the level at the end. A dropped sinker can still be slid until the next tick, as it could then.',
      ),
    ),
  );
  let current = look;
  const draw = () => drawSinkerRow(sinkers, [0, 1, 2, 3, 4, 5, 6], current);
  return {
    ...screen,
    mounted: draw,
    setLook(next) {
      current = next;
      screen.setLook?.(next);
      draw();
    },
  };
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
  const body = h('div', { class: 'snk-settings' });
  const toggle = (label: string, note: string, key: 'sonar' | 'sound') =>
    h(
      'label',
      { class: 'snk-setting' },
      h('span', {}, h('strong', {}, label), h('small', {}, note)),
      h('input', {
        type: 'checkbox',
        class: 'snk-switch',
        role: 'switch',
        checked: current[key],
        onchange: (event: Event) => {
          current = { ...current, [key]: (event.target as HTMLInputElement).checked };
          save(current);
        },
      }),
    );
  body.append(
    toggle(
      'Sonar',
      'A dotted outline where the sinker will land, and a ping running down to it.',
      'sonar',
    ),
    toggle('Sound', 'Bubbles, thuds and chimes, all quiet.', 'sound'),
    h(
      'div',
      { class: 'snk-setting' },
      h(
        'span',
        {},
        h('strong', {}, 'Motion, volume and keys'),
        h('small', {}, 'Reduced motion and the volume follow the Hall’s settings.'),
      ),
      h(
        'button',
        { type: 'button', class: 'snk-button', onclick: actions.openSettings },
        'Hall settings',
      ),
    ),
    h(
      'div',
      { class: 'snk-setting' },
      h(
        'span',
        {},
        h('strong', {}, 'Forget my data'),
        h('small', {}, 'Stars, records and daily history for Sinkers, on this device.'),
      ),
      h('button', { type: 'button', class: 'snk-button', onclick: actions.forgetData }, 'Forget…'),
    ),
  );
  return page(look, 'Settings', 'Sinkers', back, body);
}
