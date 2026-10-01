import './closet.css';
import { paletteOf } from '@usr-games/kit';
import { firstLevelOfRank, levelForXp, rankById, rankForXp } from '@usr-games/kit/progression';
import type { HallStore } from '../../../store/hall-store';
import { formatNumber } from '../../../ui/format';
import { h } from '../../../ui/h';
import { barMeter } from '../../../ui/meter';
import { tokensFor } from '../../palette';
import { playSound } from '../../sound';
import { drawRoom, type RoomState } from './room-art';

/**
 * The server closet: a small reward room behind the racks, open only at rank root. Inside, two
 * racks hum, a fan turns and an old monitor scrolls the names of the people who wrote the
 * original games (the room itself is painted in room-art.ts). Three switches change the lights,
 * stop the fan and reboot the racks. Until root, the door stays shut and says how far away it is.
 */

export interface ClosetOptions {
  store: HallStore;
  wording: 'plain' | 'unix';
  /** Screenshot scenes pin the room to one moment. */
  frozenAt?: number;
}

export interface ClosetRoom {
  element: HTMLElement;
  destroy(): void;
}

/** From AUTHORS and the manual pages of the originals (see CREDITS.md). */
const ORIGINAL_AUTHORS = [
  'Will Crowther',
  'Don Woods',
  'Jim Gillogly',
  'Eamonn McManus',
  'Ed James',
  'Alan Char',
  'Mark Horton',
  'David Riggle',
  'Ed Wang',
  'Steve Hayman',
  'Barry Brachman',
  'Steve Levine',
  'Earl T. Cohen',
  'Ken Arnold',
  'Landon Curt Noll',
  'Muffy Barkocy',
  'Ralph Campbell',
  'Jay Fenlason',
  'Andries Brouwer',
  'Conrad Huang',
  'Greg Couch',
  'Edward Estes',
  'Keith E. Brandt',
  'Jim R. Oldroyd',
  'Eric P. Scott',
  'Christos Zoulas',
  'Chris Torek',
  'Darren F. Provine',
  'Eric Allman',
  'Michael Toy',
  'Dave Taylor',
  'Curt Olson',
  'Andy Tefft',
  'Joseph S. Myers',
];

/** Under reduced motion the reboot is a single step: dark for a moment, then back. */
const STILL_REBOOT_MS = 700;

function lockedDoor(store: HallStore, wording: ClosetOptions['wording']): HTMLElement {
  const xp = store.snapshot().progression.xp;
  const root = rankById('root');
  const rank = rankForXp(xp).id;
  const level = levelForXp(xp).level;
  const fraction = Math.min(1, xp / root.threshold);
  const status =
    wording === 'unix'
      ? `Permission denied: /var/closet opens for root, and you are ${rank}.`
      : `This door opens at Level ${firstLevelOfRank('root')}. You are Level ${level}.`;
  return h(
    'div',
    { class: 'cl-locked' },
    h(
      'div',
      { class: 'cl-door', 'aria-hidden': 'true' },
      h('span', { class: 'cl-door__plate' }, 'SERVER'),
      h('span', { class: 'cl-door__handle' }),
      h('span', { class: 'cl-door__light' }),
    ),
    h(
      'div',
      { class: 'cl-locked__copy' },
      h('h2', { class: 'cl-title' }, 'The server closet'),
      h('p', { class: 'cl-status' }, status),
      barMeter({
        fraction,
        label: 'Progress to the closet',
        valueText: `${formatNumber(xp)} of ${formatNumber(root.threshold)} XP`,
        className: 'cl-bar',
      }),
      h(
        'p',
        { class: 'cl-hint' },
        `${formatNumber(Math.max(0, root.threshold - xp))} XP to go. Something hums behind this door.`,
      ),
    ),
  );
}

function switchButton(label: string, pressed: boolean, onPress: () => void): HTMLButtonElement {
  return h(
    'button',
    {
      type: 'button',
      class: ['cl-switch', pressed && 'is-on'],
      'aria-pressed': String(pressed),
      onclick: onPress,
    },
    h('span', { class: 'cl-switch__lever', 'aria-hidden': 'true' }),
    h('span', null, label),
  );
}

function openRoom(options: ClosetOptions): ClosetRoom {
  const { store, wording } = options;
  const state: RoomState = { lights: 'warm', fan: true, rebootedAt: null };
  const canvas = h('canvas', {
    class: 'cl-canvas',
    role: 'img',
    'aria-label':
      'A small server closet under a hanging lamp: two humming racks of blinking lights joined by patch cables, a fan in the wall, and a desk where an old monitor thanks the people who wrote the original games.',
  });
  const controls = h('div', {
    class: 'cl-controls',
    role: 'group',
    'aria-label': 'Switches on the wall',
  });
  const started = performance.now();
  let frame = 0;
  let stillReboot: ReturnType<typeof setTimeout> | undefined;
  const reducedMotion = store.snapshot().reducedMotion;
  const still = reducedMotion || options.frozenAt !== undefined;
  const now = () => options.frozenAt ?? (reducedMotion ? 0 : (performance.now() - started) / 1000);

  function paint() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== width * ratio) {
      canvas.width = width * ratio;
      canvas.height = height * ratio;
    }
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const snapshot = store.snapshot();
    const tokens = tokensFor({
      theme: paletteOf(snapshot.settings),
      appearance: snapshot.appearance,
      colorBlindPalette: false,
    });
    drawRoom(context, width, height, now(), state, tokens, ORIGINAL_AUTHORS);
  }

  function loop() {
    paint();
    if (!still) frame = requestAnimationFrame(loop);
  }

  function reboot() {
    playSound(store, 'bootHum');
    if (!still) {
      state.rebootedAt = now();
      return;
    }
    // A still room has no clock to sweep the lights back on, so it simply blinks off and on.
    clearTimeout(stillReboot);
    state.rebootedAt = now();
    paint();
    stillReboot = setTimeout(() => {
      state.rebootedAt = null;
      paint();
    }, STILL_REBOOT_MS);
  }

  function renderSwitches() {
    const lightsLabel = { warm: 'Lights: warm', cool: 'Lights: cool', party: 'Lights: party' }[
      state.lights
    ];
    controls.replaceChildren(
      switchButton(lightsLabel, state.lights !== 'warm', () => {
        state.lights =
          state.lights === 'warm' ? 'cool' : state.lights === 'cool' ? 'party' : 'warm';
        playSound(store, 'select');
        renderSwitches();
        paint();
      }),
      switchButton(state.fan ? 'Fan: on' : 'Fan: off', state.fan, () => {
        state.fan = !state.fan;
        playSound(store, state.fan ? 'select' : 'back');
        renderSwitches();
        paint();
      }),
      switchButton(wording === 'unix' ? 'shutdown -r now' : 'Reboot the racks', false, reboot),
    );
  }

  renderSwitches();
  const element = h(
    'div',
    { class: 'cl-room' },
    h(
      'div',
      { class: 'cl-room__copy' },
      h('h2', { class: 'cl-title' }, 'The server closet'),
      h(
        'p',
        { class: 'cl-status' },
        wording === 'unix'
          ? 'Welcome, root. Mind the cables. The rack hums for the people who wrote the originals.'
          : 'You made it to the top. The rack hums here for the people who wrote the original games.',
      ),
    ),
    canvas,
    controls,
  );
  const resize = new ResizeObserver(() => paint());
  resize.observe(canvas);
  // A still room is painted once, so it repaints itself when the palette or appearance changes.
  const unsubscribe = store.subscribe((_, change) => {
    if (still && change === 'settings') paint();
  });
  frame = requestAnimationFrame(loop);
  return {
    element,
    destroy() {
      cancelAnimationFrame(frame);
      clearTimeout(stillReboot);
      resize.disconnect();
      unsubscribe();
    },
  };
}

/** The closet, or its locked door for anyone below root. */
export function closetRoom(options: ClosetOptions): ClosetRoom {
  const atRoot = rankForXp(options.store.snapshot().progression.xp).id === 'root';
  if (!atRoot) return { element: lockedDoor(options.store, options.wording), destroy: () => {} };
  return openRoom(options);
}
