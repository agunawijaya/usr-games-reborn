import { CHAPTERS } from '../../engine/chapters';
import { MACHINE_NAMES, MACHINES } from '../../engine/message';
import { PACKAGES } from '../../game/packages';
import { totalStars } from '../../game/records';
import { DeskScene } from '../../render/desk-view';
import type { DesignFrame } from '../../render/frame';
import type { DeskPalette } from '../../render/palette';
import { alpha } from '../../render/paint';
import type { App, Screen } from '../app';
import { button, h, place } from '../dom';

/**
 * The pages that sit over the desk: the logbook (stars, packages and records), how to play,
 * and the desk's own settings. Each is one card, readable, with the way back at the bottom.
 */
abstract class PageScreen implements Screen {
  readonly element = h('div', { class: 'dd-screen dd-page' });
  protected readonly card = h('section', { class: 'dd-card dd-page__card' });
  private readonly scene = new DeskScene();

  constructor(protected readonly app: App) {
    this.element.append(this.card);
  }

  layout(frame: DesignFrame) {
    place(this.card, frame, { x: 260, y: 70, width: 1400, height: 940 });
  }

  paint(ctx: CanvasRenderingContext2D, frame: DesignFrame, pal: DeskPalette, time: number) {
    this.scene.paint(ctx, frame, this.app.canvas.ratio, pal, {
      time,
      waiting: [],
      focus: null,
      pose: { left: Math.PI * 0.75, right: Math.PI * 0.25 },
      scene: 'rooftop',
      clock: 22,
      reducedMotion: true,
      notes: [],
    });
    ctx.fillStyle = alpha(pal.look === 'night' ? '#05070c' : '#2b2119', 0.35);
    ctx.fillRect(frame.span.left, frame.top, frame.span.right - frame.span.left, 1080 - frame.top);
  }

  protected back(): HTMLElement {
    return h(
      'div',
      { class: 'dd-actions' },
      button('Game menu', () => this.app.go.title(), { primary: true, choice: 'menu' }),
    );
  }

  focus() {
    this.card
      .querySelector<HTMLElement>('button, a, input, select')
      ?.focus({ preventScroll: true });
  }

  onLook() {
    this.scene.invalidate();
  }
}

class LogbookScreen extends PageScreen {
  constructor(app: App) {
    super(app);
    const records = app.saves.records.load();
    const chapters = CHAPTERS.map((chapter) =>
      h(
        'li',
        {},
        h('h3', {}, `${chapter.number}. ${chapter.title}`),
        h(
          'ol',
          { class: 'dd-slots dd-slots--small' },
          ...chapter.messages.map((message, i) => {
            const stars = records.stars[message.id];
            return h(
              'li',
              {
                class: 'dd-slot',
                'data-state': stars !== undefined ? 'done' : 'locked',
                'aria-label': `${message.title}: ${stars !== undefined ? `${stars} stars` : 'not yet'}`,
              },
              String(i + 1),
              h(
                'span',
                { class: 'dd-slot__stars', 'aria-hidden': 'true' },
                stars !== undefined ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '·',
              ),
            );
          }),
        ),
      ),
    );
    const earned = new Set(records.earned);
    const packages = PACKAGES.map((pkg) =>
      h(
        'li',
        { class: earned.has(pkg.id as never) ? 'dd-package dd-package--earned' : 'dd-package' },
        h('b', {}, pkg.title),
        ' ',
        h('span', {}, pkg.description),
      ),
    );
    const worked = MACHINES.map((id) => `${MACHINE_NAMES[id]} ${records.worked[id] ?? 0}`).join(
      ' · ',
    );
    this.card.append(
      h(
        'div',
        { class: 'dd-band' },
        h('span', {}, 'Logbook'),
        h('span', {}, `${totalStars(records)} of 126 stars`),
      ),
      h(
        'div',
        { class: 'dd-card__body dd-page__body dd-page__body--columns' },
        h(
          'div',
          {},
          h('h2', { class: 'dd-title' }, 'The Signal Room'),
          h('ol', { class: 'dd-chapters' }, ...chapters),
        ),
        h(
          'div',
          {},
          h('h2', { class: 'dd-title' }, 'Packages'),
          h('ul', { class: 'dd-packages' }, ...packages),
          h('h2', { class: 'dd-title' }, 'Records'),
          h(
            'p',
            {},
            `Fastest clean keying: ${records.bestWpm ? `${records.bestWpm} words a minute` : 'not yet'}.`,
          ),
          h('p', {}, `Daily Signals played: ${records.dailies.length}.`),
          h('p', {}, `Steps worked: ${worked}.`),
        ),
      ),
      h('div', { class: 'dd-card__foot' }, this.back()),
    );
  }
}

const SECTIONS: ReadonlyArray<[string, string[]]> = [
  [
    'The desk',
    [
      'Messages arrive on six machines. In the Signal Room, the machine with a message waiting glows: click it, or press its number (1 to 6), or Tab to it and press Enter.',
      'Every message earns up to three stars: every letter right, inside the par time, and without hints (or without the charts, where they cost a star).',
      'Esc pauses. The pause menu can play a message again, open the chart, show the answer, or take you back.',
    ],
  ],
  [
    '1. The telegraph',
    [
      'Reading: the lamp lights and the register inks every mark; the sounder clicks, with a 600 Hz tone if you like. A short mark is a dit, a long one a daw. Type what it says.',
      'Sending: tap Space (or press the key with the mouse) for a dit, hold it for a daw. Leave a short gap between letters and a longer one between words. Backspace takes back a letter.',
      'Letters come two at a time on the free desk, at full speed with wide gaps, the way the Koch method teaches them.',
    ],
  ],
  [
    '2. The cipher wheel',
    [
      'Every letter was turned the same number of places. Turn the wheel with ← and → (or drag it, or use the mouse wheel) until the board reads, then press Enter.',
      'The scope (S) shows the message’s letters against English, and lights the turn the old codebreaker would pick. Short messages full of odd letters can fool it.',
      'Key-word messages turn each letter by a different ring: ↑ and ↓ choose the ring.',
    ],
  ],
  [
    '3. The card punch',
    [
      'One column is one character. Holes in the top rows (12, 11, 0) choose a part of the alphabet; one hole below gives the place: 12 and 1 make A, 11 and 1 make J, 0 and 2 make S.',
      'Punching: arrow keys move, Space punches or closes a hole, Enter moves to the next column, and Feed the card checks it.',
    ],
  ],
  [
    '4. The tape reader',
    [
      'Each row is one character. The holes are worth 128 64 32 16 8, the sprocket, then 4 2 1. Capitals add 64 to their place in the alphabet; digits are 48 and up; a space is 32.',
      'Punching: keys 1 to 8 punch the row’s holes from top to bottom, Enter feeds the tape, Tear it off checks it.',
    ],
  ],
  [
    '5. The banner printer',
    [
      'The banner prints on its side, tops of the letters to the right. Type it as soon as you can read it: reading before half is out earns a package. Narrow banners skip lines and columns and go grainy.',
    ],
  ],
  [
    '6. Flags on the roof',
    [
      'Each letter is a pose of the two flags, held for a beat; between words both flags drop and cross. The pose chart (H) shows them all.',
      'Sending: Q W E / A D / Z X C move the flag on your left, the number pad (or U I O / J L / M , .) the one on your right; or click a position, or drag a flag. Space drops both to rest.',
    ],
  ],
  [
    'Make your own',
    [
      'Write a message, turn it on the wheel if you like, choose a machine to carry it, and copy the desk code for a friend. Paste a friend’s code to read it at the machines.',
    ],
  ],
];

class HelpScreen extends PageScreen {
  constructor(app: App) {
    super(app);
    this.card.append(
      h('div', { class: 'dd-band' }, h('span', {}, 'How to play'), h('span', {}, 'Dits & Daws')),
      h(
        'div',
        { class: 'dd-card__body dd-page__body dd-page__body--columns' },
        ...SECTIONS.map(([title, paragraphs]) =>
          h(
            'section',
            {},
            h('h2', { class: 'dd-title dd-title--small' }, title),
            ...paragraphs.map((p) => h('p', {}, p)),
          ),
        ),
      ),
      h('div', { class: 'dd-card__foot' }, this.back()),
    );
  }
}

class SettingsScreen extends PageScreen {
  constructor(app: App) {
    super(app);
    this.render();
  }

  private render() {
    const prefs = this.app.saves.prefs.load();
    const select = (
      label: string,
      value: number,
      options: number[],
      suffix: string,
      onchange: (n: number) => void,
    ) =>
      h(
        'label',
        { class: 'dd-setting' },
        h('span', {}, label),
        h(
          'select',
          {
            class: 'dd-select',
            onchange: (event: Event) => onchange(Number((event.target as HTMLSelectElement).value)),
          },
          ...options.map((n) => h('option', { value: n, selected: n === value }, `${n} ${suffix}`)),
        ),
      );
    const toggle = (label: string, checked: boolean, onchange: (on: boolean) => void) =>
      h(
        'label',
        { class: 'dd-setting' },
        h('input', {
          type: 'checkbox',
          checked,
          onchange: (event: Event) => onchange((event.target as HTMLInputElement).checked),
        }),
        h('span', {}, label),
      );
    const save = (change: Partial<typeof prefs>) => {
      this.app.saves.prefs.update((current) => ({ ...current, ...change }));
    };
    this.card.replaceChildren(
      h('div', { class: 'dd-band' }, h('span', {}, 'Settings'), h('span', {}, 'the desk')),
      h(
        'div',
        { class: 'dd-card__body dd-page__body' },
        h('h2', { class: 'dd-title dd-title--small' }, 'The telegraph on the free desk'),
        select('Letter speed', prefs.wpm, [10, 12, 15, 18, 20, 25], 'words a minute', (wpm) =>
          save({ wpm, spacingWpm: Math.min(prefs.spacingWpm, wpm) }),
        ),
        select(
          'Spacing',
          prefs.spacingWpm,
          [5, 8, 10, 12, 15, 20, 25],
          'words a minute overall',
          (spacingWpm) => save({ spacingWpm: Math.min(spacingWpm, prefs.wpm) }),
        ),
        toggle('The sounder’s 600 Hz tone as well as its clicks', prefs.tone, (tone) =>
          save({ tone }),
        ),
        h('h2', { class: 'dd-title dd-title--small' }, 'Help'),
        toggle('Open the charts by themselves where they are free', prefs.charts, (charts) =>
          save({ charts }),
        ),
        select(
          'Seconds per flag letter when sending',
          prefs.flagLimit,
          [3, 4, 5, 6, 8],
          'seconds',
          (flagLimit) => save({ flagLimit }),
        ),
        h(
          'p',
          { class: 'dd-note' },
          'Sound, volume, appearance and motion follow the Hall’s settings.',
        ),
        h(
          'div',
          { class: 'dd-actions' },
          button('The Hall’s settings', () => this.app.context.openSettings(), { small: true }),
          button('Forget this desk', () => void this.forget(), { small: true }),
        ),
      ),
      h('div', { class: 'dd-card__foot' }, this.back()),
    );
  }

  private async forget() {
    if (await this.app.context.forgetData()) this.app.go.title();
  }
}

export const logbookScreen = (app: App) => new LogbookScreen(app);
export const helpScreen = (app: App) => new HelpScreen(app);
export const settingsScreen = (app: App) => new SettingsScreen(app);
