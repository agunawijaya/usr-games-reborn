import { type Rank, rankLabel } from '@usr-games/kit/cards';
import type { RuleSetId } from '../engine/rules';
import {
  CLASSIC_RIVALS,
  RIVAL_IDS,
  RIVALS,
  type RivalId,
  TOURNAMENT_ROUNDS,
  TOURNAMENT_WINS_NEEDED,
} from '../modes/match';
import { drawFish } from '../render/fish/draw';
import { SPECIES } from '../render/fish/species';
import type { Look } from '../render/look';
import { PAINTERS } from '../render/pond-view';
import { h } from '../ui/dom';
import { rankWord } from '../ui/words';
import type {
  Album,
  DailyDay,
  Prefs,
  Records,
  RoundResult,
  Speed,
  TournamentProgress,
} from './saves';

/**
 * The screens around the pond: the game menu and the pages it opens. Each is a plain element
 * with its buttons wired to the actions the app gives it. Letters press buttons (Q for Quick
 * game and so on); Escape on a page returns to the game menu, and on the game menu the Hall
 * takes it back to the Hall.
 */

export interface Screen {
  element: HTMLElement;
  /** The game menu: the Hall shows only "Back to the Hall" there, and Escape leaves. */
  isTitle?: boolean;
  focus(): void;
}

export const RULE_NAMES: Readonly<Record<RuleSetId, string>> = {
  standard: 'Standard',
  'all-books': 'All 13 books',
  classic: 'Classic 1993',
};

const RULE_BLURBS: Readonly<Record<RuleSetId, string>> = {
  standard: 'The game ends the moment anyone runs out of cards. Most books wins.',
  'all-books': 'Empty hands draw again from the pond, and play goes on until every book is made.',
  classic: 'The Berkeley game exactly: one rival, seven cards each, and P for pro mode.',
};

function menuItem(
  label: string,
  detail: string,
  key: string,
  run: () => void,
  testid: string,
  primary = false,
): HTMLButtonElement {
  return h(
    'button',
    {
      type: 'button',
      class: `gf-menu-item${primary ? ' is-primary' : ''}`,
      'data-testid': testid,
      'aria-keyshortcuts': key,
      onclick: run,
    },
    h('span', { class: 'gf-menu-label' }, label),
    h('span', { class: 'gf-menu-detail' }, detail),
    h('kbd', { class: 'gf-key' }, key),
  );
}

/** Letters on a page press its buttons; Escape on a page goes back to the game menu. */
function withKeys(element: HTMLElement, back?: () => void): HTMLElement {
  element.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    if (event.key === 'Escape' && back) {
      // Handled here, before the Hall's pause menu hears it on the window.
      event.preventDefault();
      event.stopPropagation();
      back();
      return;
    }
    if ((event.target as HTMLElement).closest('input, select, textarea')) return;
    const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
    const button = element.querySelector<HTMLButtonElement>(
      `button[aria-keyshortcuts="${CSS.escape(key)}"]`,
    );
    if (button && !button.disabled) {
      event.preventDefault();
      button.click();
    }
  });
  return element;
}

function page(
  title: string,
  testid: string,
  back: () => void,
  ...body: (HTMLElement | null)[]
): Screen {
  const heading = h('h2', { class: 'gf-page-title', id: `${testid}-title`, tabindex: '-1' }, title);
  const element = withKeys(
    h(
      'section',
      { class: 'gf-page gf-panel', 'aria-labelledby': `${testid}-title`, 'data-testid': testid },
      h(
        'header',
        { class: 'gf-page-head' },
        heading,
        h(
          'button',
          { type: 'button', class: 'gf-button', onclick: back, 'data-testid': `${testid}-back` },
          '← Game menu',
          h('kbd', { class: 'gf-key' }, 'Esc'),
        ),
      ),
      ...body,
    ),
    back,
  );
  return { element, focus: () => heading.focus() };
}

const PORTRAIT_FACE: Readonly<
  Record<'otter' | 'heron' | 'cat', { x: number; y: number; zoom: number }>
> = {
  otter: { x: 0, y: -150, zoom: 0.62 },
  heron: { x: 48, y: -214, zoom: 0.78 },
  cat: { x: 0, y: -136, zoom: 0.66 },
};

/** A rival's head and shoulders, painted by the same painter as at the pond. */
export function portrait(id: RivalId, look: Look, size = 96): HTMLCanvasElement {
  const canvas = h('canvas', { class: 'gf-portrait', 'aria-hidden': 'true' });
  const scale = window.devicePixelRatio || 1;
  canvas.width = size * scale;
  canvas.height = size * scale;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  const kind = RIVALS[id].kind;
  // Framed on the face, a little of the shoulders below: each rival's head sits elsewhere.
  const face = PORTRAIT_FACE[kind];
  const zoom = (size / 96) * face.zoom;
  PAINTERS[kind].draw(ctx, {
    x: size / 2 - face.x * zoom,
    y: size * 0.46 - face.y * zoom,
    scale: zoom,
    mood: 'idle',
    time: 0.5,
    cards: 0,
    moodAge: 3,
    look,
    seed: 1,
  });
  return canvas;
}

// —— the game menu ——

export interface TitleModel {
  quickLine: string;
  tournamentLine: string;
  dailyNumber: number;
  dailyLine: string;
  albumLine: string;
}

export interface TitleActions {
  quick(): void;
  tournament(): void;
  daily(): void;
  album(): void;
  help(): void;
  settings(): void;
}

export function titleScreen(model: TitleModel, actions: TitleActions): Screen {
  const first = menuItem('Quick game', model.quickLine, 'Q', actions.quick, 'gf-menu-quick', true);
  const element = withKeys(
    h(
      'section',
      {
        class: 'gf-title gf-panel',
        'aria-labelledby': 'gf-title-heading',
        'data-testid': 'gf-title',
      },
      h('p', { class: 'gf-title-kicker' }, 'Go Fish, from the Berkeley games'),
      h('h1', { class: 'gf-title-heading', id: 'gf-title-heading' }, 'Gone Fishing'),
      h('p', { class: 'gf-title-tagline' }, 'Ask. Remember. Reel them in.'),
      h(
        'nav',
        { class: 'gf-menu', 'aria-label': 'Game menu' },
        first,
        menuItem('Tournament', model.tournamentLine, 'T', actions.tournament, 'gf-menu-tournament'),
        menuItem(
          `Daily Pond #${model.dailyNumber}`,
          model.dailyLine,
          'D',
          actions.daily,
          'gf-menu-daily',
        ),
        menuItem('Fish album', model.albumLine, 'A', actions.album, 'gf-menu-album'),
        menuItem(
          'How to play',
          'Asking, fishing, books, and the keys',
          '?',
          actions.help,
          'gf-menu-help',
        ),
        menuItem(
          'Settings',
          'Rules, the notebook, pace and sound',
          'S',
          actions.settings,
          'gf-menu-settings',
        ),
      ),
    ),
  );
  return { element, isTitle: true, focus: () => first.focus() };
}

// —— a Quick game ——

export interface QuickActions {
  change(patch: Partial<Prefs>): void;
  start(): void;
  back(): void;
}

function choice(
  name: string,
  value: string,
  label: string,
  detail: string,
  checked: boolean,
  onchange: () => void,
  disabled = false,
): HTMLLabelElement {
  return h(
    'label',
    { class: `gf-choice${disabled ? ' is-disabled' : ''}` },
    h('input', {
      type: 'radio',
      name,
      value,
      checked,
      disabled,
      onchange,
      'data-testid': `gf-choice-${name}-${value}`,
    }),
    h('span', { class: 'gf-choice-text' }, h('strong', {}, label), h('span', {}, detail)),
  );
}

export function quickScreen(prefs: Prefs, look: Look, actions: QuickActions): Screen {
  const classic = prefs.rules === 'classic';
  const rivals = classic
    ? [prefs.rivals.find((id) => CLASSIC_RIVALS.includes(id)) ?? 'otto']
    : prefs.rivals;
  const rivalCards = RIVAL_IDS.map((id) => {
    const chosen = rivals.includes(id);
    const unavailable = classic && !CLASSIC_RIVALS.includes(id);
    const toggle = () => {
      if (unavailable) return;
      if (classic) return actions.change({ rivals: [id] });
      const next = chosen ? rivals.filter((r) => r !== id) : [...rivals, id];
      // At least one rival always stays at the pond.
      if (next.length > 0) actions.change({ rivals: RIVAL_IDS.filter((r) => next.includes(r)) });
    };
    return h(
      'button',
      {
        type: 'button',
        class: 'gf-rival-card',
        role: classic ? 'radio' : 'checkbox',
        'aria-checked': String(chosen && !unavailable),
        'aria-disabled': unavailable ? 'true' : undefined,
        'data-testid': `gf-rival-${id}`,
        onclick: toggle,
      },
      portrait(id, look),
      h(
        'span',
        { class: 'gf-rival-text' },
        h('strong', {}, RIVALS[id].name),
        h(
          'span',
          {},
          classic && id === 'otto'
            ? 'The original’s normal mode: asks in turn. Press P in play to switch on pro mode.'
            : classic && id === 'hazel'
              ? 'The original’s pro mode from the start. It may peek, very rarely, as the original did.'
              : unavailable
                ? 'Not at a Classic table: the original had two minds, not three.'
                : RIVALS[id].blurb,
        ),
      ),
    );
  });
  const rules = (['standard', 'all-books', 'classic'] as const).map((id) =>
    choice('rules', id, RULE_NAMES[id], RULE_BLURBS[id], prefs.rules === id, () =>
      actions.change({ rules: id }),
    ),
  );
  const start = h(
    'button',
    {
      type: 'button',
      class: 'gf-button is-primary',
      'aria-keyshortcuts': 'Enter',
      'data-testid': 'gf-quick-start',
      onclick: actions.start,
    },
    'Go fishing',
    h('kbd', { class: 'gf-key' }, 'Enter'),
  );
  const screen = page(
    'Quick game',
    'gf-quick',
    actions.back,
    h('h3', { class: 'gf-section' }, classic ? 'Your rival' : 'Your rivals'),
    h(
      'div',
      { class: 'gf-rivals', role: classic ? 'radiogroup' : 'group', 'aria-label': 'Rivals' },
      ...rivalCards,
    ),
    h('h3', { class: 'gf-section' }, 'Rules'),
    h('div', { class: 'gf-choices', role: 'radiogroup', 'aria-label': 'Rules' }, ...rules),
    notebookChoice(prefs.notebook, (notebook) => actions.change({ notebook })),
    h('div', { class: 'gf-page-actions' }, start),
  );
  screen.element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !(event.target as HTMLElement).closest('button, input')) {
      event.preventDefault();
      actions.start();
    }
  });
  return screen;
}

function notebookChoice(on: boolean, change: (on: boolean) => void): HTMLElement {
  return h(
    'label',
    { class: 'gf-toggle' },
    h('input', {
      type: 'checkbox',
      checked: on,
      'data-testid': 'gf-notebook-default',
      onchange: (event: Event) => change((event.target as HTMLInputElement).checked),
    }),
    h(
      'span',
      { class: 'gf-choice-text' },
      h('strong', {}, 'Open the notebook'),
      h('span', {}, 'It writes down every ask and answer. Win with it closed for a bonus.'),
    ),
  );
}

// —— the Tournament ——

export interface TournamentActions {
  play(): void;
  restart(): void;
  back(): void;
}

const RESULT_WORDS: Readonly<Record<RoundResult, string>> = {
  win: 'Won',
  draw: 'Tied',
  loss: 'Lost',
};

export function tournamentScreen(
  progress: TournamentProgress | null,
  actions: TournamentActions,
): Screen {
  const results = progress?.results ?? [];
  const wins = results.filter((r) => r === 'win').length;
  const done = results.length >= TOURNAMENT_ROUNDS.length;
  const next = results.length;
  const rounds = TOURNAMENT_ROUNDS.map((rivals, i) => {
    const result = results[i];
    const names = rivals.map((id) => RIVALS[id].name);
    const who =
      names.length === 1
        ? names[0]!
        : names.length === 2
          ? `${names[0]} and ${names[1]}, both at once`
          : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}, all three`;
    return h(
      'li',
      { class: 'gf-round', 'data-result': result ?? (i === next ? 'next' : 'later') },
      h('span', { class: 'gf-round-number' }, String(i + 1)),
      h('span', { class: 'gf-round-who' }, who),
      h(
        'span',
        { class: 'gf-round-result' },
        result ? RESULT_WORDS[result] : i === next ? 'Next' : '',
      ),
    );
  });
  const verdict = done
    ? wins >= TOURNAMENT_WINS_NEEDED
      ? `The cup is yours: ${wins} rounds won of five.`
      : `${wins} ${wins === 1 ? 'round' : 'rounds'} won of five. The cup needs three; a new tournament starts fresh.`
    : wins >= TOURNAMENT_WINS_NEEDED
      ? `The cup is already yours with ${wins} wins. Play on for a clean sweep.`
      : `${wins} of the ${TOURNAMENT_WINS_NEEDED} round wins the cup needs.`;
  const playButton = h(
    'button',
    {
      type: 'button',
      class: 'gf-button is-primary',
      'aria-keyshortcuts': 'P',
      'data-testid': 'gf-tournament-play',
      onclick: done ? actions.restart : actions.play,
    },
    done
      ? 'Start a new tournament'
      : results.length === 0
        ? 'Play round 1'
        : `Play round ${next + 1}`,
    h('kbd', { class: 'gf-key' }, 'P'),
  );
  return page(
    'Tournament',
    'gf-tournament',
    actions.back,
    h(
      'p',
      { class: 'gf-page-lead' },
      'Five rounds against rivals who grow smarter, every round played until all thirteen books are made. Win three to take the cup.',
    ),
    h('ol', { class: 'gf-rounds' }, ...rounds),
    h('p', { class: 'gf-verdict', role: 'status' }, verdict),
    h(
      'div',
      { class: 'gf-page-actions' },
      playButton,
      results.length > 0 && !done
        ? h(
            'button',
            {
              type: 'button',
              class: 'gf-button',
              'aria-keyshortcuts': 'N',
              'data-testid': 'gf-tournament-restart',
              onclick: actions.restart,
            },
            'Start over',
            h('kbd', { class: 'gf-key' }, 'N'),
          )
        : null,
    ),
  );
}

// —— the Daily Pond ——

export interface DailyActions {
  play(): void;
  share(): void;
  back(): void;
}

export function dailyScreen(
  model: {
    number: number;
    dateLabel: string;
    today: DailyDay | undefined;
    days: number;
    rivals: readonly RivalId[];
  },
  actions: DailyActions,
): Screen {
  const today = model.today;
  const seats = model.rivals.map((id) => RIVALS[id].name).join(', then ');
  return page(
    `Daily Pond #${model.number}`,
    'gf-daily',
    actions.back,
    h(
      'p',
      { class: 'gf-page-lead' },
      `${model.dateLabel}. The same pond for everyone today: the same cards, the same seats, the same rivals' luck. All three rivals are at the water, and play goes on until all thirteen books are made. Your score is your books.`,
    ),
    h('p', { class: 'gf-page-note' }, `Round the pond from you: ${seats}.`),
    today
      ? h(
          'div',
          { class: 'gf-daily-result' },
          h(
            'strong',
            {},
            `${today.books.length} ${today.books.length === 1 ? 'book' : 'books'} today`,
          ),
          h(
            'span',
            {},
            today.books.map((b) => (b.golden ? '🐠' : '🐟')).join('') || 'No fish today',
          ),
          h('span', {}, today.notebookUsed ? 'with the notebook' : 'from memory, no notebook'),
        )
      : null,
    h('p', { class: 'gf-page-note' }, `Days fished: ${model.days}.`),
    h(
      'div',
      { class: 'gf-page-actions' },
      h(
        'button',
        {
          type: 'button',
          class: 'gf-button is-primary',
          'aria-keyshortcuts': 'P',
          'data-testid': 'gf-daily-play',
          onclick: actions.play,
        },
        today ? 'Fish it again (only the first counts)' : 'Fish the Daily Pond',
        h('kbd', { class: 'gf-key' }, 'P'),
      ),
      today
        ? h(
            'button',
            {
              type: 'button',
              class: 'gf-button',
              'aria-keyshortcuts': 'S',
              'data-testid': 'gf-daily-share',
              onclick: actions.share,
            },
            'Share',
            h('kbd', { class: 'gf-key' }, 'S'),
          )
        : null,
    ),
  );
}

// —— the fish album ——

function fishTile(rank: Rank, golden: boolean, caught: boolean, look: Look): HTMLCanvasElement {
  const canvas = h('canvas', {
    class: `gf-fish-tile${golden ? ' is-golden' : ''}`,
    'aria-hidden': 'true',
  });
  const width = 150;
  const height = 92;
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  const species = SPECIES[rank - 1]!;
  const place = {
    x: width / 2,
    y: height / 2,
    length: 92 * (0.75 + species.size * 0.25),
    gold: look.gold,
    golden,
    time: 0.6,
  };
  if (caught) {
    drawFish(ctx, species, place);
    return canvas;
  }
  // A silhouette in one flat colour: the shape to look forward to, no markings given away.
  const shape = document.createElement('canvas');
  shape.width = canvas.width;
  shape.height = canvas.height;
  const shapeCtx = shape.getContext('2d')!;
  shapeCtx.scale(scale, scale);
  drawFish(shapeCtx, species, place);
  shapeCtx.setTransform(1, 0, 0, 1, 0, 0);
  shapeCtx.globalCompositeOperation = 'source-in';
  shapeCtx.fillStyle = look.dark ? 'rgba(170, 190, 220, 0.35)' : 'rgba(40, 70, 60, 0.22)';
  shapeCtx.fillRect(0, 0, shape.width, shape.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(shape, 0, 0);
  return canvas;
}

export function albumScreen(album: Album, look: Look, back: () => void): Screen {
  const caught = album.filter((entry) => entry.first).length;
  const golden = album.filter((entry) => entry.goldenFirst).length;
  const tiles = SPECIES.map((species, i) => {
    const entry = album[i]!;
    const rank = (i + 1) as Rank;
    const seen = entry.first !== null;
    return h(
      'li',
      {
        class: 'gf-album-entry',
        'data-caught': String(seen),
        'data-testid': `gf-album-${species.id}`,
      },
      fishTile(rank, false, seen, look),
      entry.goldenFirst ? fishTile(rank, true, true, look) : null,
      h('span', { class: 'gf-album-rank' }, rankLabel(rank)),
      h('strong', {}, seen ? species.name : 'Not yet caught'),
      h(
        'span',
        { class: 'gf-album-detail' },
        seen
          ? `First caught ${formatDate(entry.first!)} · ${entry.caught} in all`
          : `A book of ${rankWord(rank)} brings it`,
      ),
      entry.goldenFirst
        ? h('span', { class: 'gf-album-golden' }, `Golden since ${formatDate(entry.goldenFirst)}`)
        : null,
    );
  });
  return page(
    'Fish album',
    'gf-album',
    back,
    h(
      'p',
      { class: 'gf-page-lead' },
      `${caught} of 13 species caught · ${golden} golden. Every book of four becomes its rank's fish; now and then one comes up golden.`,
    ),
    h('ol', { class: 'gf-album' }, ...tiles),
  );
}

function formatDate(key: string): string {
  return new Date(`${key}T12:00:00`).toLocaleDateString('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// —— how to play ——

export function helpScreen(back: () => void, backLabel?: string): Screen {
  const keys: [string, string][] = [
    ['1 · 2 · 3', 'Choose the rival to ask (Enter: the one you asked last)'],
    ['A · 2–9 · 0 · J · Q · K', 'Ask for that rank (0 is the ten)'],
    ['Backspace', 'Choose a different rival'],
    ['Click', 'A name to choose a rival; a card or a rank button to ask'],
    ['N', 'Open or close the notebook'],
    ['P', 'Classic 1993: switch your rival to pro mode'],
    ['Esc', 'Pause'],
  ];
  const screen = page(
    'How to play',
    'gf-help',
    back,
    h(
      'div',
      { class: 'gf-help' },
      h(
        'p',
        {},
        'Everyone holds a hand of cards. On your turn, ask one rival for a rank you hold: “Any sevens?” If they have any, they hand them all over and you ask again. If not, they say “Go fish!” and you cast into the pond for a card. Catch the rank you asked for and you ask again; otherwise the turn moves on.',
      ),
      h(
        'p',
        {},
        'Four of a rank make a book, and every book leaps into your bucket as that rank’s fish. Most books wins.',
      ),
      h('h3', { class: 'gf-section' }, 'Remember'),
      h(
        'p',
        {},
        'Whoever asks for a rank holds it. Whoever says “Go fish!” has none, until they draw again. The notebook keeps track of both; the rivals each keep their own kind of memory.',
      ),
      h('h3', { class: 'gf-section' }, 'Keys'),
      h(
        'table',
        { class: 'gf-keys' },
        h(
          'tbody',
          {},
          ...keys.map(([key, what]) =>
            h('tr', {}, h('th', { scope: 'row' }, key), h('td', {}, what)),
          ),
        ),
      ),
    ),
  );
  if (backLabel)
    screen.element.querySelector('[data-testid="gf-help-back"]')!.firstChild!.textContent =
      backLabel;
  return screen;
}

// —— settings ——

export interface SettingsActions {
  change(patch: Partial<Prefs>): void;
  hallSettings(): void;
  forget(): void;
  back(): void;
}

export function settingsScreen(prefs: Prefs, records: Records, actions: SettingsActions): Screen {
  const paces: [Speed, string, string][] = [
    ['relaxed', 'Relaxed', 'Every ask and answer at an easy pace'],
    ['brisk', 'Brisk', 'The rivals play quicker'],
  ];
  return page(
    'Settings',
    'gf-settings',
    actions.back,
    h('h3', { class: 'gf-section' }, 'Rules for a Quick game'),
    h(
      'div',
      { class: 'gf-choices', role: 'radiogroup', 'aria-label': 'Rules' },
      ...(['standard', 'all-books', 'classic'] as const).map((id) =>
        choice('settings-rules', id, RULE_NAMES[id], RULE_BLURBS[id], prefs.rules === id, () =>
          actions.change({ rules: id }),
        ),
      ),
    ),
    notebookChoice(prefs.notebook, (notebook) => actions.change({ notebook })),
    h('h3', { class: 'gf-section' }, 'Pace'),
    h(
      'div',
      { class: 'gf-choices', role: 'radiogroup', 'aria-label': 'Pace' },
      ...paces.map(([id, label, detail]) =>
        choice('pace', id, label, detail, prefs.speed === id, () => actions.change({ speed: id })),
      ),
    ),
    h(
      'label',
      { class: 'gf-toggle' },
      h('input', {
        type: 'checkbox',
        checked: prefs.sound,
        'data-testid': 'gf-sound',
        onchange: (event: Event) =>
          actions.change({ sound: (event.target as HTMLInputElement).checked }),
      }),
      h(
        'span',
        { class: 'gf-choice-text' },
        h('strong', {}, 'Sound'),
        h('span', {}, 'Water, casts and chimes, at the Hall’s volume'),
      ),
    ),
    h(
      'p',
      { class: 'gf-page-note' },
      `${records.games} games · ${records.wins} won · ${records.books} books · ${records.goldens} golden · ${records.tournamentsWon} tournaments won`,
    ),
    h(
      'div',
      { class: 'gf-page-actions' },
      h(
        'button',
        { type: 'button', class: 'gf-button', onclick: actions.hallSettings },
        'Hall settings…',
      ),
      h(
        'button',
        { type: 'button', class: 'gf-button', 'data-testid': 'gf-forget', onclick: actions.forget },
        'Forget my pond…',
      ),
    ),
  );
}
