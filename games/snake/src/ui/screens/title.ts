import { AttractLoop } from '../../render/attract';
import type { App, Screen } from '../app';
import { h, svg } from '../dom';
import { EMBLEM } from '../icons';

/** Things the original's code says about its snake, one shown at a time. */
const TIPS = [
  'with empty pockets the snake never heads straight for you.',
  'the snake will never step onto a glint or the door. They are safe squares.',
  'picking up a glint ends your turn before the snake moves.',
  'step onto the square its tail just left and you are caught all the same.',
  'a warp costs a tenth of everything you have picked up, so it can leave you owing.',
  'the richer you are, the more the snake keeps going the way it went last.',
];

/**
 * The game menu: the garden playing itself behind a panel of ways to play. The Hall draws
 * "← Back to the Hall" over it, and Escape here goes back. Typing "root" gets a wink: the
 * original never let root keep a score, and its snake always winked at root.
 */
export function titleScreen(app: App): Screen {
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const prefs = app.saves.prefs.load();
  const records = app.saves.records.load();
  const today = app.context.daily.dateKey();
  const played = records.dailies[today];

  const option = (
    label: string,
    detail: string,
    onclick: () => void,
    extra: Node | null = null,
    primary = false,
  ) =>
    h(
      'button',
      { class: `fp-option${primary ? ' fp-option-primary' : ''}`, type: 'button', onclick },
      h('b', {}, label),
      h('span', {}, detail),
      extra,
    );

  const note = h('p', { class: 'fp-root-note', role: 'status', 'aria-live': 'polite' });
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)]!;
  const glance = h(
    'div',
    { class: 'fp-glance' },
    h('span', {}, h('b', {}, records.runBest.toLocaleString('en-US')), 'best haul'),
    h('span', {}, h('b', {}, String(records.runDeepest || '—')), 'deepest chamber'),
    h('span', {}, h('b', {}, String(records.luckyBreaks)), 'lucky breaks'),
  );
  const menu = h(
    'section',
    { class: 'fp-menu fp-panel', 'aria-labelledby': 'fp-title' },
    h('div', { class: 'fp-logo' }, svg(EMBLEM), h('h1', { id: 'fp-title' }, 'Full Pockets')),
    h('p', { class: 'fp-tag' }, 'Grab the glints. Mind the snake. Know when to leave.'),
    h(
      'nav',
      { class: 'fp-options', 'aria-label': 'Ways to play' },
      option(
        'Start a run',
        'Ten chambers down. Bank at any door, or go deeper.',
        () => app.go.run(),
        null,
        true,
      ),
      option(
        `Daily Run #${app.context.daily.number()}`,
        played
          ? `Today: ${played.banked === null ? 'caught in chamber ' + played.chamber : played.banked.toLocaleString('en-US') + ' banked'}`
          : 'Five chambers, the same for everyone today.',
        () => app.go.daily(),
      ),
      option('Classic', 'The 1980 game on one board, its rules and quirks kept.', () =>
        app.go.classic(),
      ),
      option(
        'Tutorial',
        'Ninety seconds: step, grab, peek, bank.',
        () => app.go.tutorial(),
        prefs.tutorialDone ? null : h('em', { class: 'fp-badge' }, 'New? Start here'),
      ),
    ),
    glance,
    h('p', { class: 'fp-tip' }, h('b', {}, 'From the 1980 source: '), tip),
    h(
      'div',
      { class: 'fp-links' },
      h('button', { class: 'fp-btn', type: 'button', onclick: () => app.go.records() }, 'Records'),
      h('button', { class: 'fp-btn', type: 'button', onclick: () => app.go.help() }, 'How to play'),
      h(
        'button',
        { class: 'fp-btn', type: 'button', onclick: () => app.go.settings() },
        'Settings',
      ),
    ),
    note,
  );
  const element = h('div', { class: 'fp-title', 'data-testid': 'fp-title' }, canvas, menu);

  let attract: AttractLoop | null = null;
  const start = () => {
    attract = new AttractLoop(canvas, {
      look: app.look,
      reducedMotion: app.reducedMotion,
      seed: Math.floor(Math.random() * 1000),
      region: (width, height) => {
        const left = width > 900 ? Math.min(560, width * 0.42) : 0;
        return { x: left + 24, y: 60, width: width - left - 48, height: height - 84 };
      },
    });
  };
  requestAnimationFrame(start);
  const onResize = () => attract?.resize();
  window.addEventListener('resize', onResize);

  let typed = '';
  return {
    element,
    onTitle: true,
    onKey(event) {
      if (event.key.length !== 1) return false;
      typed = (typed + event.key.toLowerCase()).slice(-4);
      if (typed !== 'root') return false;
      note.textContent = 'No scores for root, as in 1980. The snake winks at you anyway.';
      app.sounds.wink();
      app.install('root-denied');
      return true;
    },
    onLook(look, reducedMotion) {
      attract?.setLook(look, reducedMotion);
    },
    onPause: () => attract?.setVisible(false),
    onResume: () => attract?.setVisible(true),
    focus() {
      menu.querySelector<HTMLButtonElement>('.fp-option')?.focus();
    },
    destroy() {
      window.removeEventListener('resize', onResize);
      attract?.destroy();
    },
  };
}
