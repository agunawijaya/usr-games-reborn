import { dailyNumber } from '@usr-games/kit';
import { chunkFor } from '../../engine/value';
import { CLASSIC_SIZES, sizeKey } from '../../game/saves';
import type { App, Screen } from '../app';
import { formatGlints, h } from '../dom';

/** The quieter screens off the game menu: records, how to play and settings. */

function page(
  app: App,
  title: string,
  ...content: Node[]
): { element: HTMLElement; focus(): void } {
  const back = h(
    'button',
    { class: 'fp-btn', type: 'button', onclick: () => app.go.title() },
    '← Game menu',
  );
  const element = h(
    'div',
    { class: 'fp-page' },
    h(
      'section',
      { class: 'fp-page-body fp-panel', 'aria-labelledby': 'fp-page-title' },
      h('header', { class: 'fp-page-head' }, back, h('h1', { id: 'fp-page-title' }, title)),
      ...content,
    ),
  );
  return { element, focus: () => back.focus() };
}

function backOnEscape(app: App) {
  return (event: KeyboardEvent) => {
    if (event.key !== 'Backspace') return false;
    app.go.title();
    return true;
  };
}

export function recordsScreen(app: App): Screen {
  const r = app.saves.records.load();
  const days = Object.entries(r.dailies)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 10);
  const classic = CLASSIC_SIZES.filter((size) => r.classicBest[sizeKey(size)] !== undefined);
  const { element, focus } = page(
    app,
    'Records',
    h(
      'div',
      { class: 'fp-records' },
      h(
        'section',
        { class: 'fp-record' },
        h('h2', {}, 'Runs'),
        h('p', { class: 'fp-big' }, formatGlints(r.runBest)),
        h(
          'p',
          {},
          r.runBest ? 'your best haul banked' : 'Nothing banked yet: every door is a chance.',
        ),
        h('p', {}, `Deepest chamber reached: ${r.runDeepest || '—'}`),
      ),
      h(
        'section',
        { class: 'fp-record' },
        h('h2', {}, 'Daily Runs'),
        days.length === 0
          ? h('p', {}, 'None yet. Today’s is on the game menu.')
          : h(
              'ol',
              {},
              ...days.map(([key, d]) =>
                h(
                  'li',
                  {},
                  h('b', {}, `#${dailyNumber(key)}`),
                  ' ',
                  d.banked === null
                    ? `caught in chamber ${d.chamber}`
                    : `${formatGlints(d.banked)} banked at chamber ${d.chamber}`,
                ),
              ),
            ),
      ),
      h(
        'section',
        { class: 'fp-record' },
        h('h2', {}, 'Classic'),
        classic.length === 0
          ? h('p', {}, 'No Classic haul yet.')
          : h(
              'ol',
              {},
              ...classic.map((size) =>
                h(
                  'li',
                  {},
                  h('b', {}, sizeKey(size)),
                  ' ',
                  formatGlints(r.classicBest[sizeKey(size)]!),
                ),
              ),
            ),
      ),
      h(
        'section',
        { class: 'fp-record' },
        h('h2', {}, 'All told'),
        h(
          'p',
          {},
          `${r.banks} hauls banked · ${r.luckyBreaks} lucky breaks · ${r.peeks} peeks · ${r.dailyRuns} Daily Runs`,
        ),
      ),
    ),
  );
  return { element, focus, onKey: backOnEscape(app) };
}

export function helpScreen(app: App): Screen {
  const section = (title: string, ...lines: string[]) =>
    h(
      'section',
      { class: 'fp-help-part' },
      h('h2', {}, title),
      ...lines.map((line) => h('p', {}, line)),
    );
  const { element, focus } = page(
    app,
    'How to play',
    h(
      'div',
      { class: 'fp-help' },
      section(
        'Steps and answers',
        'Every step you take, the snake takes one. Picking up a glint or reaching the door ends your turn before it moves, and warping or peeking costs no turn at all.',
        'You are caught if any of its six squares is on you, or if you stand where its tail just was.',
      ),
      section(
        'Glints and boldness',
        'The snake picks its step by weighing the eight ways it can go. The way straight at you weighs nothing while your pockets are empty, then a tenth of your loot: the richer you get, the more often it comes straight for you. The boldness meter shows that chance.',
        'The strike preview (S) shades the squares its head can reach next, with the chances written in.',
      ),
      section(
        'Peek, warp and the door',
        'Peek (P) points arrows toward a glint, or the door, when it is nearly in line with you. Warp (T) drops you somewhere at random for a tenth of everything you have picked up: keep warping and you can end up owing glints.',
        'Every door asks: bank your haul and end the run, or go deeper, where glints are worth more, the chambers are narrower and the snake is bolder.',
      ),
      section(
        'The Lucky Break',
        'Caught, a dial spins against the last digit of your pockets. If it stops on your digit you scramble free with everything: about one chance in ten, and nothing is staked. Caught on a run richer than your best ever, the snake winks first.',
      ),
      section(
        'Chambers',
        'Hedges stop you both. In lily pools the snake swims two squares a turn. Corridors are narrow, twin chambers hold two glints, a sleeping snake wakes on your third glint, and in the mirror chamber peeking always shows the way.',
      ),
      section(
        'Classic',
        'One board with the 1980 rules: you walk four ways, glints pay by the size of the board, the door ends the game, and the board can be as small as four squares a side.',
      ),
    ),
  );
  return { element, focus, onKey: backOnEscape(app) };
}

export function settingsScreen(app: App): Screen {
  const prefs = app.saves.prefs.load();
  const toggle = (label: string, detail: string, on: boolean, change: (on: boolean) => void) => {
    const input = h('input', { type: 'checkbox', class: 'fp-switch' }) as HTMLInputElement;
    input.checked = on;
    input.addEventListener('change', () => change(input.checked));
    return h(
      'label',
      { class: 'fp-setting' },
      input,
      h('span', {}, h('b', {}, label), h('small', {}, detail)),
    );
  };
  const sizeOut = h('output', { class: 'fp-size-out' });
  const slider = h('input', {
    type: 'range',
    min: 0,
    max: CLASSIC_SIZES.length - 1,
    step: 1,
    class: 'fp-slider',
    'aria-label': 'Classic board size',
  }) as HTMLInputElement;
  slider.value = String(prefs.classicSize);
  const showSize = () => {
    const size = CLASSIC_SIZES[Number(slider.value)]!;
    sizeOut.textContent = `${size.width} × ${size.height} · glints worth ${chunkFor(size.width, size.height)} each${size.width === 78 ? ' · the original’s whole terminal' : ''}`;
  };
  showSize();
  slider.addEventListener('input', () => {
    showSize();
    app.saves.prefs.update((p) => ({ ...p, classicSize: Number(slider.value) }));
  });
  const { element, focus } = page(
    app,
    'Settings',
    h(
      'div',
      { class: 'fp-settings' },
      toggle(
        'Strike preview',
        'Shade the squares the snake may strike next, with the chances.',
        prefs.strikePreview,
        (on) => app.saves.prefs.update((p) => ({ ...p, strikePreview: on })),
      ),
      toggle(
        'The original’s keys',
        'List h j k l, counts and the capital jumps in the side panel.',
        prefs.classicKeys,
        (on) => app.saves.prefs.update((p) => ({ ...p, classicKeys: on })),
      ),
      h(
        'div',
        { class: 'fp-setting fp-setting-wide' },
        h(
          'span',
          {},
          h('b', {}, 'Classic board'),
          h('small', {}, 'The smallest fair board is four squares a side.'),
        ),
        slider,
        sizeOut,
      ),
      h(
        'div',
        { class: 'fp-setting fp-setting-wide' },
        h(
          'span',
          {},
          h('b', {}, 'Sound, motion and keys'),
          h('small', {}, 'Volume, reduced motion and key remapping live in the Hall’s settings.'),
        ),
        h(
          'button',
          { class: 'fp-btn', type: 'button', onclick: () => app.context.openSettings() },
          'Open the Hall’s settings',
        ),
      ),
      h(
        'div',
        { class: 'fp-setting fp-setting-wide' },
        h(
          'span',
          {},
          h('b', {}, 'Forget my data'),
          h('small', {}, 'Removes your records here and everything the Hall keeps.'),
        ),
        h(
          'button',
          { class: 'fp-btn', type: 'button', onclick: () => void app.context.forgetData() },
          'Forget my data…',
        ),
      ),
    ),
  );
  return { element, focus, onKey: backOnEscape(app) };
}
