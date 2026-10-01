import { iconCanvas, type IconSubject, paintIcon } from '../../render/icons';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { DEFAULT_KEYS, describeKey, KEY_LABELS, type KeyAction } from '../keys';

/** How to play, in the game's own words, with every thing on the floor drawn beside its line. */
export function helpScreen(app: App): Screen {
  const coat = app.coat();
  const legend: [IconSubject, string, string][] = [
    [
      'cat',
      'You',
      'Step one square in any direction, stay put, loaf or zoom. Then it is the vacuums’ turn.',
    ],
    [
      'basic',
      'Robot vacuum',
      'Rolls one square straight at you after every turn, diagonally if it can.',
    ],
    [
      'tangle',
      'Tangle',
      'Two vacuums on one square bonk and tangle. Anything that rolls in later is stuck too.',
    ],
    [
      'sock',
      'Sock or cable',
      'Lying about on the floor. A vacuum that rolls over one chokes on it.',
    ],
    [
      'mop',
      'Mop bot',
      'Only travels in straight lines, so it cannot reach a square diagonal to it.',
    ],
    [
      'slow',
      'Old model',
      'Rests every other turn. Its light dims and a “z” floats up before a rest.',
    ],
    ['turbo', 'Turbo', 'Takes two steps every turn.'],
    [
      'sweeper',
      'Shop vac',
      'Swallows the first tangle it rolls over. After that it is as clumsy as the rest.',
    ],
    [
      'dock',
      'Charging dock',
      'Sends out a new vacuum every few turns until it is empty, or until a tangle jams it.',
    ],
  ];
  const keys = Object.keys(DEFAULT_KEYS) as KeyAction[];
  const icons = legend.map(([subject]) => ({
    subject,
    canvas: iconCanvas(subject, app.look, coat, 64, 56),
  }));
  const element = h(
    'section',
    { class: 'zm-screen', 'aria-labelledby': 'zm-help-title', dataset: { testid: 'zm-help' } },
    h(
      'div',
      { class: 'zm-page' },
      h(
        'div',
        { class: 'zm-page__head' },
        h(
          'button',
          {
            type: 'button',
            class: 'zm-button zm-button--quiet',
            onclick: () => app.go.title(),
            dataset: { testid: 'zm-back' },
          },
          '← Game menu',
        ),
        h('h1', { class: 'zm-page__title', id: 'zm-help-title' }, 'How to play'),
      ),
      h(
        'p',
        { class: 'zm-page__lede' },
        'You cannot fight a vacuum. You can only move, and every vacuum rolls straight at you after each move. Stand where two of them will arrive at the same moment and they bonk into a tangle. Tangle them all and the room is tidy.',
      ),
      h(
        'div',
        { class: 'zm-grid-2' },
        h(
          'section',
          { class: 'zm-card zm-section', 'aria-labelledby': 'zm-help-floor' },
          h('h2', { id: 'zm-help-floor' }, 'On the floor'),
          h(
            'div',
            { class: 'zm-legend' },
            ...legend.flatMap(([, name, text], i) => [
              icons[i]!.canvas,
              h('p', {}, h('strong', {}, `${name}. `), text),
            ]),
          ),
        ),
        h(
          'div',
          { style: 'display:grid;gap:18px' },
          h(
            'section',
            { class: 'zm-card zm-section', 'aria-labelledby': 'zm-help-moves' },
            h('h2', { id: 'zm-help-moves' }, 'Your moves'),
            h(
              'p',
              {},
              h('strong', {}, 'Step. '),
              'Click a square next to the cat, drag the cat, or use the keys below. A paw print marks every safe square.',
            ),
            h(
              'p',
              {},
              h('strong', {}, 'Loaf. '),
              'Wait turn after turn, stopping by itself before anything can reach you. Every vacuum that tangles while you loaf earns a safe zoom (up to three).',
            ),
            h(
              'p',
              {},
              h('strong', {}, 'Zoom. '),
              'Dash to a random square. With a safe zoom in hand you land somewhere quiet; without one, you land wherever you land.',
            ),
            h(
              'p',
              {},
              h('strong', {}, 'Whiskers. '),
              'Hatched squares are within a vacuum’s reach next turn. With careful paws on (Settings), the game will not let you step into one.',
            ),
            h(
              'p',
              {},
              h('strong', {}, 'Undo. '),
              'In the House and Today’s Mess, take back as many turns as you like. Zooms land in the same place if you try again.',
            ),
          ),
          h(
            'section',
            { class: 'zm-card zm-section', 'aria-labelledby': 'zm-help-ways' },
            h('h2', { id: 'zm-help-ways' }, 'Ways to play'),
            h(
              'p',
              {},
              h('strong', {}, 'The House: '),
              'twelve rooms, each with one new idea. Stars for a tidy room, for par or better, and for never zooming. Par is the fewest turns the room can be cleared in, worked out by searching every possible game.',
            ),
            h(
              'p',
              {},
              h('strong', {}, 'Today’s mess: '),
              'one room a day, the same for everyone, played by the cats next door as well.',
            ),
            h(
              'p',
              {},
              h('strong', {}, 'Long Night: '),
              'the original game, rule for rule, on its 59 by 22 field, wave after wave until a vacuum catches you. Ten points a vacuum. Napping pays a bonus but never stops for danger.',
            ),
            h(
              'p',
              {},
              h('strong', {}, 'Pattern Lab: '),
              'write a pattern of up to eight directions and let it play the Long Night by itself, the way one of the original’s hidden experiments did.',
            ),
          ),
          h(
            'section',
            { class: 'zm-card zm-section', 'aria-labelledby': 'zm-help-keys' },
            h('h2', { id: 'zm-help-keys' }, 'Keys'),
            h(
              'table',
              { class: 'zm-table' },
              h(
                'tbody',
                {},
                ...keys.map((action) =>
                  h(
                    'tr',
                    {},
                    h('th', { scope: 'row', style: 'font-weight:600' }, KEY_LABELS[action]),
                    h('td', {}, DEFAULT_KEYS[action].map(describeKey).join(' · ')),
                  ),
                ),
              ),
            ),
            h(
              'p',
              {},
              'Ctrl or ⌘ with Z also undoes. Esc pauses. Keys can be changed in the Hall’s settings.',
            ),
          ),
        ),
      ),
    ),
  );
  return {
    element,
    onLook(look) {
      for (const { subject, canvas } of icons) paintIcon(canvas, subject, look, coat, 64, 56);
    },
    focus: () => element.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }),
    onKey(event) {
      if (event.key === 'Backspace') {
        app.go.title();
        return true;
      }
      return false;
    },
  };
}
