import { createRng } from '@usr-games/kit';
import { CAMPAIGN, type CaveDefinition, TUTORIAL } from '../engine/campaign';
import { type Cave, caveProblem, digCave } from '../engine/cave';
import { population, populationProblem } from '../engine/expedition';
import { randomFrom, scripted } from '../engine/random';
import { CLASSIC_RECIPE, type CaveRecipe } from '../engine/rules';
import { REFUSALS, RULES_TEXT } from '../modes/copy';
import { drawKeyArt } from '../play/auto';
import type { Point } from '../render/hand';
import { layoutCave } from '../render/layout';
import type { Look } from '../render/look';
import { drawMap } from '../render/map';
import { fitCanvas, h, keycap } from '../ui/dom';
import type { CaveRecord, CustomRecipe, DailyRecord, GameSettings, Progress } from './saves';

/**
 * The screens around an expedition: the game menu with the sleeping wumpus behind it, the trail
 * of expeditions, the Daily Cave, the custom cave, records, settings and how to play.
 */

export interface Screen {
  element: HTMLElement;
  /** The control that should take focus when the screen opens. */
  focus?: HTMLElement;
  setLook?(look: Look): void;
  destroy?(): void;
}

const STAR = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z';

function starRow(count: number, of = 3): HTMLElement {
  const row = h('span', {
    class: 'hw-stars',
    role: 'img',
    'aria-label': `${count} of ${of} stars`,
  });
  const ns = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < of; i++) {
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', `hw-star${i < count ? ' is-earned' : ''}`);
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
  title: string,
  subtitle: string,
  onBack: () => void,
  ...body: (Node | null)[]
): Screen {
  const back = h('button', { class: 'hw-pill', type: 'button', onclick: onBack }, '← Game menu');
  const element = h(
    'section',
    { class: 'hw-screen hw-page', 'aria-label': title, dataset: { look: look.name } },
    h(
      'header',
      { class: 'hw-page__head' },
      back,
      h(
        'div',
        { class: 'hw-page__titles' },
        h('h1', { class: 'hw-page__title' }, title),
        h('p', { class: 'hw-page__lede' }, subtitle),
      ),
    ),
    h('div', { class: 'hw-page__body' }, ...body),
  );
  return {
    element,
    focus: back,
    setLook(next) {
      element.dataset.look = next.name;
    },
  };
}

// —— the game menu ——

export interface TitleActions {
  continueLabel: string;
  continue(): void;
  trail(): void;
  daily(): void;
  custom(): void;
  tutorial(): void;
  records(): void;
  help(): void;
  settings(): void;
  hall?(): void;
}

export interface TitleFacts {
  stars: number;
  dailyNumber: number;
  dailyName: string;
  dailyDone: DailyRecord | undefined;
  rules: GameSettings['rules'];
}

export function titleScreen(
  look: Look,
  facts: TitleFacts,
  actions: TitleActions,
  reducedMotion: boolean,
): Screen {
  const art = h('canvas', { class: 'hw-title-art', 'aria-hidden': 'true' });
  const entry = (label: string, note: string, run: () => void, primary = false) =>
    h(
      'li',
      { class: primary ? 'is-primary' : undefined },
      h('button', { type: 'button', onclick: run }, h('span', {}, label), h('small', {}, note)),
    );
  const menu = h(
    'ul',
    { class: 'hw-menu', 'aria-label': 'Game menu' },
    entry('Continue', actions.continueLabel, actions.continue, true),
    entry('Expeditions', `${facts.stars} of ${CAMPAIGN.length * 3} stars`, actions.trail),
    entry(
      'Daily Cave',
      facts.dailyDone
        ? `#${facts.dailyNumber} · ${facts.dailyDone.hushed ? `hushed in ${facts.dailyDone.moves}` : 'explored'}`
        : `#${facts.dailyNumber} · ${facts.dailyName}`,
      actions.daily,
    ),
    entry('Custom Cave', 'the original’s options', actions.custom),
    entry('Tutorial', 'about a minute', actions.tutorial),
    entry('Records', 'stars, scores, dailies', actions.records),
    entry('How to play', 'senses, darts, notebook', actions.help),
    entry(
      'Settings',
      facts.rules === 'standard' ? 'Standard rules' : 'Classic rules',
      actions.settings,
    ),
  );
  const back = actions.hall
    ? h(
        'button',
        { type: 'button', class: 'hw-pill hw-title-back', onclick: actions.hall },
        '← Back to the Hall',
      )
    : null;
  const element = h(
    'section',
    {
      class: 'hw-screen hw-titlescreen',
      'aria-label': 'Hush the Wumpus',
      dataset: { look: look.name },
    },
    art,
    back,
    h(
      'div',
      { class: 'hw-title-panel' },
      h('h1', { class: 'hw-title-logo' }, 'Hush the ', h('em', {}, 'Wumpus')),
      h('p', { class: 'hw-title-tagline' }, 'Follow the stink. Steer the dart. Let it sleep.'),
      menu,
      h(
        'p',
        { class: 'hw-title-credit' },
        'After Gregory Yob’s Hunt the Wumpus (1973) and the BSD wump.',
      ),
    ),
  );
  let currentLook = look;
  let frame = 0;
  const started = performance.now();
  const draw = () => {
    const width = art.clientWidth;
    const height = art.clientHeight;
    if (width === 0 || height === 0) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    art.width = Math.round(width * ratio);
    art.height = Math.round(height * ratio);
    const ctx = art.getContext('2d')!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawKeyArt(ctx, currentLook, width, height, (performance.now() - started) / 1000);
  };
  // The sleeping wumpus breathes slowly; a few frames a second are plenty.
  const tick = () => {
    draw();
    frame = window.setTimeout(() => requestAnimationFrame(tick), 120);
  };
  const resize = new ResizeObserver(() => draw());
  resize.observe(art);
  if (!reducedMotion) requestAnimationFrame(tick);
  else requestAnimationFrame(draw);
  const first = menu.querySelector('button')!;
  return {
    element,
    focus: first,
    setLook(next) {
      currentLook = next;
      element.dataset.look = next.name;
      draw();
    },
    destroy() {
      window.clearTimeout(frame);
      resize.disconnect();
    },
  };
}

// —— the trail of expeditions ——

export function isUnlocked(progress: Progress, index: number): boolean {
  if (index === 0) return true;
  const previous = progress.caves[CAMPAIGN[index - 1]!.id];
  return Boolean(previous && (previous.hushes > 0 || previous.tries >= 3));
}

export function trailScreen(
  look: Look,
  progress: Progress,
  onPlay: (cave: CaveDefinition) => void,
  onBack: () => void,
): Screen {
  const items = CAMPAIGN.map((cave, index) => {
    const record: CaveRecord | undefined = progress.caves[cave.id];
    const open = isUnlocked(progress, index);
    const lit = Boolean(record && record.hushes > 0);
    const button = h(
      'button',
      {
        type: 'button',
        class: `hw-trail__stop${lit ? ' is-lit' : ''}${open ? '' : ' is-locked'}`,
        disabled: !open,
        onclick: () => onPlay(cave),
        'aria-label': `Expedition ${cave.number}: ${cave.name}. ${open ? cave.idea : 'Hush the one before, or try it three times, to open this one.'}`,
      },
      h('span', { class: 'hw-trail__lamp', 'aria-hidden': 'true' }, String(cave.number)),
      h(
        'span',
        { class: 'hw-trail__text' },
        h('strong', {}, cave.name),
        h('small', {}, open ? cave.idea : 'Not lit yet'),
      ),
      starRow(record?.stars ?? 0),
    );
    return h('li', { class: 'hw-trail__item' }, button);
  });
  const screen = page(
    look,
    'Expeditions',
    'Twelve caves, deeper and stranger as you go. Hush a cave, or try it three times, to light the way to the next.',
    onBack,
    h('ol', { class: 'hw-trail' }, ...items),
  );
  const firstOpen = screen.element.querySelector<HTMLButtonElement>(
    '.hw-trail__stop:not([disabled])',
  );
  if (firstOpen) screen.focus = firstOpen;
  return screen;
}

// —— the Daily Cave ——

export interface DailyFacts {
  number: number;
  name: string;
  recipe: CaveRecipe;
  record: DailyRecord | undefined;
  history: Record<string, DailyRecord>;
}

function caveFacts(recipe: CaveRecipe): HTMLElement {
  const fact = (label: string, value: string | number) =>
    h('div', { class: 'hw-facts__item' }, h('dt', {}, label), h('dd', {}, String(value)));
  return h(
    'dl',
    { class: 'hw-facts' },
    fact('Rooms', recipe.rooms),
    fact('Tunnels a room', recipe.tunnelsPerRoom),
    fact('Pits', recipe.pits),
    fact('Bat roosts', recipe.bats),
    fact('Sleep darts', recipe.darts),
    recipe.magicTunnels ? fact('Shimmering', recipe.magicTunnels) : null,
  );
}

export function dailyScreen(
  look: Look,
  facts: DailyFacts,
  actions: { play(): void; share(): void },
  onBack: () => void,
): Screen {
  const done = facts.record;
  const body: HTMLElement[] = done
    ? [
        h(
          'p',
          { class: 'hw-daily__result' },
          done.hushed
            ? `You hushed today’s wumpus in ${done.moves} moves.`
            : `Today’s cave got the better of you after ${done.moves} moves.`,
        ),
        h(
          'div',
          { class: 'hw-row' },
          h(
            'button',
            { type: 'button', class: 'hw-button is-primary', onclick: actions.share },
            'Share your result',
          ),
          h(
            'button',
            { type: 'button', class: 'hw-button', onclick: actions.play },
            'Explore it again (not counted)',
          ),
        ),
      ]
    : [
        h(
          'button',
          { type: 'button', class: 'hw-button is-primary', onclick: actions.play },
          'Explore today’s cave',
        ),
      ];
  body.unshift(caveFacts(facts.recipe));
  const recent = Object.entries(facts.history)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 10)
    .map(([key, record]) =>
      h(
        'li',
        {},
        h('span', { class: 'hw-mono' }, `#${record.number}`),
        ` ${key} · `,
        record.hushed ? `hushed in ${record.moves}` : 'fled',
        ` · 🎯${record.dartsThrown} 🦇${record.batRides}`,
      ),
    );
  const screen = page(
    look,
    `Daily Cave #${facts.number}`,
    `${facts.name}. One cave a day, the same for everyone, always under Standard rules.`,
    onBack,
    ...body,
    recent.length > 0 ? h('h2', { class: 'hw-heading' }, 'Your recent caves') : null,
    recent.length > 0 ? h('ul', { class: 'hw-list' }, ...recent) : null,
  );
  screen.focus =
    screen.element.querySelector<HTMLButtonElement>('.hw-button.is-primary') ?? screen.focus;
  return screen;
}

// —— the custom cave ——

export function customScreen(
  look: Look,
  recipe: CustomRecipe,
  rules: GameSettings['rules'],
  actions: { dig(recipe: CustomRecipe): void; save(recipe: CustomRecipe): void },
  onBack: () => void,
): Screen {
  const state = { ...recipe };
  const sketch = caveSketch(look, rules);
  const refusal = h('p', { class: 'hw-refusal', role: 'status' });
  const dig = h(
    'button',
    { type: 'button', class: 'hw-button is-primary', onclick: () => actions.dig({ ...state }) },
    'Dig this cave',
  );
  const check = () => {
    const full = {
      ...CLASSIC_RECIPE,
      rooms: state.rooms,
      tunnelsPerRoom: state.tunnels,
      bats: state.bats,
      pits: state.pits,
      darts: state.darts,
      hard: false,
    };
    // The hard level adds at least one more of each; check the gentlest case it could produce.
    const counts = state.hard
      ? population({ ...full, hard: true }, 'standard', scripted([0]))
      : { bats: state.bats, pits: state.pits };
    const problem = populationProblem(full, counts, rules);
    refusal.textContent = problem
      ? REFUSALS[problem]
      : state.hard
        ? 'The hard level will add more bats and pits on top of these.'
        : '';
    refusal.classList.toggle('is-refusing', problem !== null);
    dig.disabled = problem !== null;
    sketch.show(
      caveProblem(state.rooms, state.tunnels)
        ? null
        : { rooms: state.rooms, tunnels: state.tunnels },
    );
    actions.save({ ...state });
  };
  const slider = (
    key: Exclude<keyof CustomRecipe, 'hard'>,
    label: string,
    min: number,
    max: number,
  ) => {
    const output = h('output', { class: 'hw-mono' }, String(state[key]));
    const input = h('input', {
      type: 'range',
      min: String(min),
      max: String(max),
      value: String(state[key]),
      'aria-label': label,
      oninput: (event: Event) => {
        state[key] = Number((event.target as HTMLInputElement).value);
        output.textContent = String(state[key]);
        check();
      },
    });
    return h('label', { class: 'hw-field' }, h('span', {}, label), input, output);
  };
  const hard = h('input', {
    type: 'checkbox',
    checked: state.hard,
    onchange: (event: Event) => {
      state.hard = (event.target as HTMLInputElement).checked;
      check();
    },
  });
  const screen = page(
    look,
    'Custom Cave',
    `The original’s options, with the same limits. ${RULES_TEXT[rules]}`,
    onBack,
    h(
      'div',
      { class: 'hw-columns hw-custom' },
      h(
        'div',
        { class: 'hw-custom__options' },
        h(
          'div',
          { class: 'hw-fields' },
          slider('rooms', 'Rooms', 10, 250),
          slider('tunnels', 'Tunnels from each room', 2, 25),
          slider('bats', 'Rooms with bats', 0, 125),
          slider('pits', 'Rooms with pits', 0, 125),
          slider('darts', 'Sleep darts', 1, 9),
          h(
            'label',
            { class: 'hw-field hw-field--check' },
            hard,
            h('span', {}, 'Hard level: extra bats and pits, and a start out of smelling range'),
          ),
        ),
        refusal,
        dig,
      ),
      sketch.element,
    ),
  );
  check();
  screen.setLook = (next) => {
    screen.element.dataset.look = next.name;
    sketch.setLook(next);
  };
  screen.destroy = () => sketch.destroy();
  return screen;
}

/**
 * One cave the custom options could dig, sketched as a map, redrawn a moment after the options
 * settle. Every expedition digs its own; this only shows the shape of such a cave.
 */
function caveSketch(look: Look, rules: GameSettings['rules']) {
  const canvas = h('canvas', { class: 'hw-custom__map', role: 'img' });
  const area = h('div', { class: 'hw-custom__area' }, canvas);
  const element = h(
    'figure',
    { class: 'hw-custom__sketch' },
    area,
    h(
      'figcaption',
      { class: 'hw-note' },
      'One cave these options could dig. Every expedition digs a new one.',
    ),
  );
  let current = look;
  let recipe: { rooms: number; tunnels: number } | null = null;
  let timer = 0;
  let drawn: { cave: Cave; layout: Point[]; aspect: number } | null = null;
  const draw = () => {
    const width = area.clientWidth;
    const height = area.clientHeight;
    if (width === 0 || height === 0) return;
    const ctx = fitCanvas(canvas, width, height);
    ctx.clearRect(0, 0, width, height);
    if (!recipe) return;
    const aspect = width / height;
    if (!drawn || Math.abs(drawn.aspect - aspect) > 0.05) {
      const cave = digCave(
        { size: recipe.rooms, tunnelsPerRoom: recipe.tunnels, allowLoops: rules === 'classic' },
        randomFrom(createRng(`custom:${recipe.rooms}:${recipe.tunnels}`)),
      );
      drawn = { cave, layout: layoutCave(cave, { aspect }), aspect };
    }
    const rooms = Array.from({ length: drawn.cave.size }, (_, i) => i + 1);
    const none = new Array<boolean>(drawn.cave.size + 1).fill(false);
    drawMap(
      ctx,
      {
        cave: drawn.cave,
        layout: drawn.layout,
        here: 1,
        visited: rooms,
        sensed: new Map(),
        marks: new Map(),
        rules,
        reveal: { pits: none, bats: none, wumpus: 0, origin: 1, progress: 1, mood: 'hushed' },
        time: 0,
      },
      current,
      { x: 0, y: 0, w: width, h: height },
    );
  };
  const resize = new ResizeObserver(() => draw());
  resize.observe(area);
  return {
    element,
    /** Sketches a cave of this size, or none when the options would not dig one. */
    show(next: { rooms: number; tunnels: number } | null) {
      if (next?.rooms !== recipe?.rooms || next?.tunnels !== recipe?.tunnels) drawn = null;
      recipe = next;
      canvas.setAttribute(
        'aria-label',
        next
          ? `A sketch of a cave of ${next.rooms} rooms with ${next.tunnels} tunnels each`
          : 'No cave: these options would not dig one',
      );
      window.clearTimeout(timer);
      timer = window.setTimeout(draw, 160);
    },
    setLook(next: Look) {
      current = next;
      draw();
    },
    destroy() {
      window.clearTimeout(timer);
      resize.disconnect();
    },
  };
}

// —— records ——

export function recordsScreen(
  look: Look,
  progress: Progress,
  daily: Record<string, DailyRecord>,
  counters: { hushes: number; expeditions: number; roomsSeen: number },
  onBack: () => void,
): Screen {
  const rows = [TUTORIAL, ...CAMPAIGN].map((cave) => {
    const record = progress.caves[cave.id];
    return h(
      'tr',
      {},
      h('th', { scope: 'row' }, cave.number === 0 ? 'Tutorial' : `${cave.number}. ${cave.name}`),
      h(
        'td',
        {},
        cave.number === 0 ? (progress.tutorialDone ? 'done' : '—') : starRow(record?.stars ?? 0),
      ),
      h('td', { class: 'hw-mono' }, record?.bestScore ? String(record.bestScore) : '—'),
      h('td', { class: 'hw-mono' }, record?.fewestMoves ? String(record.fewestMoves) : '—'),
      h('td', { class: 'hw-mono' }, record ? `${record.hushes}/${record.tries}` : '—'),
    );
  });
  const dailies = Object.values(daily);
  return page(
    look,
    'Records',
    `${counters.hushes} wumpuses hushed in ${counters.expeditions} expeditions; ${counters.roomsSeen} rooms explored.`,
    onBack,
    h(
      'table',
      { class: 'hw-table' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', {}, 'Cave'),
          h('th', {}, 'Stars'),
          h('th', {}, 'Best score'),
          h('th', {}, 'Fewest moves'),
          h('th', {}, 'Hushed / tries'),
        ),
      ),
      h('tbody', {}, ...rows),
    ),
    h(
      'p',
      { class: 'hw-note' },
      'Score: 100 for a hushed wumpus, 15 for each dart left and 2 for each room you never needed to enter; each move costs 2 and each bat ride 5.',
    ),
    h('h2', { class: 'hw-heading' }, 'Daily Caves'),
    h(
      'p',
      {},
      dailies.length === 0
        ? 'None yet.'
        : `${dailies.length} explored, ${dailies.filter((d) => d.hushed).length} hushed.`,
    ),
  );
}

// —— settings ——

export function settingsScreen(
  look: Look,
  settings: GameSettings,
  save: (next: GameSettings) => void,
  hall: { openSettings(): void; forgetData(): void },
  onBack: () => void,
): Screen {
  const state = { ...settings };
  const toggle = (key: 'scout' | 'autoMap' | 'cameraRide' | 'sound', label: string, note: string) =>
    h(
      'label',
      { class: 'hw-field hw-field--check' },
      h('input', {
        type: 'checkbox',
        checked: state[key],
        onchange: (event: Event) => {
          state[key] = (event.target as HTMLInputElement).checked;
          save({ ...state });
        },
      }),
      h('span', {}, h('b', {}, label), h('small', {}, note)),
    );
  const rule = (value: GameSettings['rules'], label: string) =>
    h(
      'label',
      { class: 'hw-field hw-field--check' },
      h('input', {
        type: 'radio',
        name: 'hw-rules',
        checked: state.rules === value,
        onchange: () => {
          state.rules = value;
          save({ ...state });
        },
      }),
      h('span', {}, h('b', {}, label), h('small', {}, RULES_TEXT[value])),
    );
  return page(
    look,
    'Settings',
    'Changes apply from your next expedition; the Daily Cave always plays Standard.',
    onBack,
    h(
      'fieldset',
      { class: 'hw-fields' },
      h('legend', { class: 'hw-heading' }, 'Rules'),
      rule('standard', 'Standard'),
      rule('classic', 'Classic'),
    ),
    h(
      'div',
      { class: 'hw-fields' },
      toggle('scout', 'Scout assist', 'Marks every room your notes prove safe.'),
      toggle('autoMap', 'Map draws itself', 'Off: only your notebook marks go on the map.'),
      toggle(
        'cameraRide',
        'Ride with the dart',
        'Off: the dart’s flight is traced on the map instead.',
      ),
      toggle('sound', 'Sound', 'Drips, drafts, flutters and a sleepy snore, all kept soft.'),
    ),
    h(
      'div',
      { class: 'hw-row' },
      h(
        'button',
        { type: 'button', class: 'hw-button', onclick: hall.openSettings },
        'Volume, motion and colours',
      ),
      h(
        'button',
        { type: 'button', class: 'hw-button', onclick: hall.forgetData },
        'Forget my data',
      ),
    ),
  );
}

// —— how to play ——

export function helpScreen(look: Look, onBack: () => void): Screen {
  const row = (keys: string[], what: string) =>
    h(
      'tr',
      {},
      h('td', {}, ...keys.flatMap((k, i) => [i > 0 ? ' ' : '', keycap(k)])),
      h('td', {}, what),
    );
  return page(
    look,
    'How to play',
    'Somewhere in the cave a wumpus is snoring. Find it by its smell and send it to sleep with a dart.',
    onBack,
    h(
      'div',
      { class: 'hw-columns' },
      h(
        'section',
        {},
        h('h2', { class: 'hw-heading' }, 'Your senses'),
        h(
          'ul',
          { class: 'hw-list' },
          h(
            'li',
            {},
            h('b', {}, 'Draft:'),
            ' a pit lies through one of the tunnels out of this room.',
          ),
          h(
            'li',
            {},
            h('b', {}, 'Flutter:'),
            ' bats roost through one of them; they carry you to any room at all.',
          ),
          h(
            'li',
            {},
            h('b', {}, 'Whiff:'),
            ' the wumpus is within two tunnels. Standard rules tell you which: strong is one room, faint is two.',
          ),
          h('li', {}, 'Only tunnels leading out count. Some tunnels run one way only.'),
        ),
        h('h2', { class: 'hw-heading' }, 'Darts'),
        h(
          'ul',
          { class: 'hw-list' },
          h('li', {}, 'Plan up to five rooms. Only the room the dart comes down in counts.'),
          h('li', {}, 'A hop with no tunnel sends the dart down a random one instead.'),
          h(
            'li',
            {},
            'Past the third room the string may snap (2 in 10); past the fourth the dart may waver (6 in 10).',
          ),
          h(
            'li',
            {},
            'A miss may wake the wumpus, and it may wander. Run out of darts and the expedition is over.',
          ),
        ),
      ),
      h(
        'section',
        {},
        h('h2', { class: 'hw-heading' }, 'Controls'),
        h(
          'table',
          { class: 'hw-table' },
          h(
            'tbody',
            {},
            row(['1–9'], 'Walk through a tunnel (or click it, or its room on the map)'),
            row(['A'], 'Aim a dart (or right-click the chamber); then 1–9 or click rooms'),
            row(['Enter'], 'Throw the dart'),
            row(['⌫'], 'Take back the last room of the dart’s path'),
            row(['N'], 'Notebook: arrows to move, S P B W to mark'),
            row(['M'], 'Big map'),
            row(['Esc'], 'Cancel aiming or the notebook; otherwise pause'),
          ),
        ),
        h(
          'p',
          { class: 'hw-note' },
          'Right-click any room on the map to mark it: Safe, Pit?, Bats? or Wumpus?',
        ),
      ),
    ),
  );
}
