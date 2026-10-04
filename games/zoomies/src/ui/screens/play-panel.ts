import type { RoomState } from '../../engine/types';
import { MAX_SAFE_ZOOMS } from '../../engine/rules';
import type { App } from '../app';
import { button, h } from '../dom';

/**
 * The side panel during play: where you are, the counters that matter, the actions that are
 * not plain steps with the keys beside them, and one line saying what just happened (read out
 * to screen readers).
 */

/** Past this many vacuums the dots give way to two counts, so the row never wraps. */
const MAX_PIPS = 8;

export interface PanelInfo {
  eyebrow: string;
  title: string;
  idea: string;
  par: number | null;
  rules: 'house' | 'classic';
  canUndo: boolean;
}

export interface PanelHandlers {
  loaf(): void;
  zoom(): void;
  undo(): void;
  nap(): void;
  toggleWhiskers(): void;
  toggleWholeRoom(): void;
}

export class PlayPanel {
  readonly element: HTMLElement;
  private turn = h('span', { class: 'zm-counter__value', dataset: { testid: 'zm-turn' } });
  private left = h('span', { class: 'zm-counter__value', dataset: { testid: 'zm-left' } });
  private leftPips = h('span', { class: 'zm-pips', dataset: { testid: 'zm-pips' } });
  private third = h('span', { class: 'zm-counter__value' });
  private thirdLabel = h('span', { class: 'zm-counter__label' });
  private thirdPips = h('span', { class: 'zm-pips', 'aria-hidden': 'true' });
  private fourth = h('span', { class: 'zm-counter__value' });
  private fourthLabel = h('span', { class: 'zm-counter__label' });
  private status = h('p', {
    class: 'zm-status',
    role: 'status',
    'aria-live': 'polite',
    dataset: { testid: 'zm-status' },
  });
  private eyebrow = h('span', { class: 'zm-panel__eyebrow' });
  private title = h('h1', { class: 'zm-panel__title' });
  private idea = h('p', { class: 'zm-panel__idea' });
  private whiskerSwitch: HTMLButtonElement;
  private wholeRoomSwitch: HTMLButtonElement;
  private wholeRoomRow: HTMLElement;
  private undoButton: HTMLButtonElement;
  private zoomButton: HTMLButtonElement;
  private loafButton: HTMLButtonElement;

  constructor(
    private app: App,
    private info: PanelInfo,
    handlers: PanelHandlers,
  ) {
    const keys = app.keys;
    this.loafButton = button('Loaf', {
      onClick: handlers.loaf,
      key: keys.first('loaf'),
      testId: 'zm-loaf',
    });
    this.zoomButton = button('Zoom', {
      onClick: handlers.zoom,
      key: keys.first('zoom'),
      testId: 'zm-zoom',
    });
    this.undoButton = button('Undo', {
      onClick: handlers.undo,
      key: keys.first('undo'),
      testId: 'zm-undo',
    });
    const nap = button('Nap till it’s over', {
      onClick: handlers.nap,
      key: keys.first('nap'),
      testId: 'zm-nap',
    });
    nap.classList.add('zm-button--wide');
    this.whiskerSwitch = h('button', {
      type: 'button',
      class: 'zm-switch',
      role: 'switch',
      'aria-checked': String(app.saves.prefs.load().whiskers),
      'aria-label': 'Whiskers: show where vacuums can reach',
      onclick: handlers.toggleWhiskers,
      dataset: { testid: 'zm-whiskers' },
    });
    this.wholeRoomSwitch = h('button', {
      type: 'button',
      class: 'zm-switch',
      role: 'switch',
      'aria-checked': 'false',
      'aria-label': 'Whole room: show the whole room instead of following the cat',
      onclick: handlers.toggleWholeRoom,
      dataset: { testid: 'zm-whole-room' },
    });
    this.wholeRoomRow = h(
      'label',
      { class: 'zm-toggle', hidden: true },
      h('span', {}, 'Whole room ', h('kbd', { class: 'zm-kbd' }, keys.first('whole-room'))),
      this.wholeRoomSwitch,
    );
    const actions =
      info.rules === 'classic'
        ? [this.loafButton, this.zoomButton, nap]
        : [this.loafButton, this.zoomButton, this.undoButton];
    if (info.rules !== 'classic') this.undoButton.classList.add('zm-button--wide');
    this.element = h(
      'aside',
      { class: 'zm-panel', 'aria-label': 'Room status and actions' },
      h('div', { class: 'zm-panel__room' }, this.eyebrow, this.title, this.idea),
      h(
        'div',
        { class: 'zm-counters' },
        h(
          'div',
          { class: 'zm-counter' },
          h('span', { class: 'zm-counter__label' }, 'Turn'),
          this.turn,
        ),
        h('div', { class: 'zm-counter' }, this.fourthLabel, this.fourth),
        h(
          'div',
          { class: 'zm-counter zm-counter--wide' },
          h('span', { class: 'zm-counter__label' }, 'Vacuums'),
          h('span', { class: 'zm-counter__row' }, this.left, this.leftPips),
        ),
        h(
          'div',
          { class: 'zm-counter zm-counter--slim' },
          this.thirdLabel,
          h('span', { class: 'zm-counter__row' }, this.third, this.thirdPips),
        ),
      ),
      h('div', { class: 'zm-actions' }, ...actions),
      h(
        'p',
        { class: 'zm-keys' },
        'Step: Q W E · A D · Z X C, arrows or number pad. Stay: S or Space. Or click a square next to the cat.',
      ),
      h(
        'label',
        { class: 'zm-toggle' },
        h('span', {}, 'Whiskers ', h('kbd', { class: 'zm-kbd' }, keys.first('whiskers'))),
        this.whiskerSwitch,
      ),
      this.wholeRoomRow,
      this.status,
    );
    this.setInfo(info);
  }

  setInfo(info: PanelInfo) {
    this.info = info;
    this.eyebrow.textContent = info.eyebrow;
    this.title.textContent = info.title;
    this.idea.textContent = info.idea;
  }

  setWhiskers(on: boolean) {
    this.whiskerSwitch.setAttribute('aria-checked', String(on));
  }

  /** The Whole room switch shows only when the room outgrows the view. */
  offerWholeRoom(offered: boolean) {
    const on = this.wholeRoomSwitch.getAttribute('aria-checked') === 'true';
    this.wholeRoomRow.hidden = !offered && !on;
  }

  setWholeRoom(on: boolean) {
    this.wholeRoomSwitch.setAttribute('aria-checked', String(on));
  }

  say(text: string, warn = false) {
    this.status.textContent = text;
    this.status.classList.toggle('zm-status--warn', warn);
  }

  shakeZoom() {
    this.zoomButton.classList.remove('zm-shake');
    void this.zoomButton.offsetWidth;
    this.zoomButton.classList.add('zm-shake');
  }

  update(state: RoomState, extra: { score?: number; wave?: number; canUndo: boolean }) {
    const alive = state.vacuums.filter((v) => v.alive).length;
    const waiting = state.dock && !state.dock.jammed ? state.dock.remaining : 0;
    this.turn.replaceChildren(
      String(state.turn),
      this.info.par !== null ? h('small', {}, ` / par ${this.info.par}`) : '',
    );
    this.left.replaceChildren(
      String(alive),
      h('small', {}, waiting ? ` left · ${waiting} docked` : ' left'),
    );
    this.leftPips.replaceChildren(...vacuumPips(state));
    this.leftPips.setAttribute(
      'aria-label',
      `${state.vacuums.length - alive} of ${state.vacuums.length} tangled`,
    );
    if (this.info.rules === 'classic') {
      this.thirdLabel.textContent = 'Score';
      this.third.textContent = String(extra.score ?? 0);
      this.thirdPips.replaceChildren();
      this.fourthLabel.textContent = 'Wave';
      this.fourth.textContent = String(extra.wave ?? 1);
    } else {
      this.thirdLabel.textContent = 'Safe zooms';
      this.third.textContent = String(state.safeZooms);
      this.thirdPips.replaceChildren(
        ...Array.from({ length: MAX_SAFE_ZOOMS }, (_, i) =>
          h('span', {
            class: i < state.safeZooms ? 'zm-pip zm-pip--zoom zm-pip--on' : 'zm-pip zm-pip--zoom',
          }),
        ),
      );
      this.fourthLabel.textContent = 'Zooms used';
      this.fourth.textContent = String(state.zooms);
    }
    this.undoButton.disabled = !extra.canUndo;
    this.loafButton.disabled = state.status !== 'playing';
    this.zoomButton.disabled = state.status !== 'playing';
  }
}

/**
 * One dot per vacuum, filled once it is tangled; past eight, a filled dot and an empty one,
 * each with its count, so the row always fits on one line.
 */
function vacuumPips(state: RoomState): HTMLElement[] {
  const tangled = state.vacuums.filter((v) => !v.alive).length;
  const rolling = state.vacuums.length - tangled;
  if (state.vacuums.length <= MAX_PIPS)
    return state.vacuums.map((v) => h('span', { class: v.alive ? 'zm-pip' : 'zm-pip zm-pip--on' }));
  return [
    h('span', { class: 'zm-pip zm-pip--on' }),
    h('span', { class: 'zm-pips__count' }, `×${tangled}`),
    h('span', { class: 'zm-pip' }),
    h('span', { class: 'zm-pips__count' }, `×${rolling}`),
  ];
}
