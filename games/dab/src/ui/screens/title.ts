import { LADDER } from '../../game/modes';
import { PUZZLES } from '../../game/puzzles';
import { RIVALS } from '../../game/rivals';
import { nextLadderMatch } from '../../game/saves';
import { AttractLoop } from '../../render/attract';
import type { App, Screen } from '../app';
import { h, svg } from '../dom';
import { EMBLEM } from '../icons';

/** Things the 2003 source says about its computer, one shown at a time. */
const TIPS = [
  'the computer takes every box it can before it thinks about anything else, so it never keeps control.',
  'two functions, find_single and find_double, wait behind an “#ifdef notyet” and were never written.',
  'the computer reshuffles its random order from the clock, so within one second it keeps choosing the same way.',
  'the computer drew first unless you asked otherwise, on a 3 × 3 board unless you asked for more.',
  'its manual points to Elwyn Berlekamp’s book on the game, whose central trick the computer never plays.',
  'when forced to give boxes away, the computer tries every way and gives the fewest. It never gives on purpose.',
];

/**
 * The game menu: the board playing itself behind a panel of ways to play. The Hall draws
 * "← Back to the Hall" over it, and Escape here goes back.
 */
export function titleScreen(app: App): Screen {
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const prefs = app.saves.prefs.load();
  const records = app.saves.records.load();
  const today = app.context.daily.dateKey();
  const played = records.dailies[today];
  const next = LADDER[nextLadderMatch(records) - 1]!;
  const allWon = records.ladderWon.length >= LADDER.length;

  const option = (
    label: string,
    detail: string,
    onclick: () => void,
    testid: string,
    extra: Node | null = null,
    primary = false,
  ) =>
    h(
      'button',
      {
        class: `dx-option-btn${primary ? ' dx-option-primary' : ''}`,
        type: 'button',
        onclick,
        'data-testid': testid,
      },
      h('b', {}, label),
      h('span', {}, detail),
      extra,
    );

  const tip = TIPS[Math.floor(Math.random() * TIPS.length)]!;
  const menu = h(
    'section',
    { class: 'dx-menu dx-panel', 'aria-labelledby': 'dx-title' },
    h('div', { class: 'dx-logo' }, svg(EMBLEM), h('h1', { id: 'dx-title' }, 'Double Cross')),
    h('p', { class: 'dx-tag' }, 'Draw a line. Close a box. Learn when to give one away.'),
    h(
      'nav',
      { class: 'dx-options', 'aria-label': 'Ways to play' },
      option(
        allWon ? 'The ladder, climbed' : `Ladder · match ${next.number} of ${LADDER.length}`,
        allWon
          ? 'All ten matches won. Replay any of them.'
          : `${next.columns} × ${next.rows} against ${RIVALS[next.opponent].name}.`,
        () => app.go.ladder(),
        'dx-go-ladder',
        null,
        true,
      ),
      option(
        `Daily Board #${app.context.daily.number()}`,
        played
          ? `Today: ${played.you}–${played.rival}${played.crosses ? ` · ✂️${played.crosses}` : ''}`
          : 'The same opening for everyone today, against the Pupil.',
        () => app.go.daily(),
        'dx-go-daily',
      ),
      option(
        'Endgame puzzles',
        `${records.puzzlesSolved.length} of ${PUZZLES.length} solved. The right move gives boxes away.`,
        () => app.go.puzzles(),
        'dx-go-puzzles',
      ),
      option(
        'Tutorial',
        'Five small boards, from your first line to the double cross.',
        () => app.go.tutorial(0),
        'dx-go-tutorial',
        prefs.tutorialDone ? null : h('em', { class: 'dx-badge-new' }, 'New? Start here'),
      ),
      option(
        'Two players',
        'Pass the chalk: two of you at one keyboard.',
        () => app.go.localSetup(),
        'dx-go-local',
      ),
      option(
        'Custom board',
        'Any size from 2 × 2 to 10 × 10, any opponent.',
        () => app.go.customSetup(),
        'dx-go-custom',
      ),
    ),
    h(
      'div',
      { class: 'dx-glance' },
      h('span', {}, h('b', {}, String(records.wins)), 'games won'),
      h('span', {}, h('b', {}, String(records.crosses)), 'double crosses'),
      h('span', {}, h('b', {}, `${records.ladderWon.length}/10`), 'ladder'),
    ),
    h('p', { class: 'dx-tip' }, h('b', {}, 'From the 2003 source: '), tip),
    h(
      'div',
      { class: 'dx-links' },
      h('button', { class: 'dx-btn', type: 'button', onclick: () => app.go.records() }, 'Records'),
      h('button', { class: 'dx-btn', type: 'button', onclick: () => app.go.help() }, 'How to play'),
      h(
        'button',
        { class: 'dx-btn', type: 'button', onclick: () => app.go.settings() },
        'Settings',
      ),
    ),
  );
  const element = h('div', { class: 'dx-title', 'data-testid': 'dx-title' }, canvas, menu);

  let attract: AttractLoop | null = null;
  requestAnimationFrame(() => {
    attract = new AttractLoop(canvas, {
      look: app.look,
      reducedMotion: app.reducedMotion,
      seed: Math.floor(Math.random() * 1000),
      region: (width, height) => {
        const left = width > 900 ? Math.min(600, width * 0.42) : 0;
        return { x: left + 24, y: 80, width: width - left - 48, height: height - 104 };
      },
    });
  });
  const onResize = () => attract?.resize();
  window.addEventListener('resize', onResize);

  return {
    element,
    onTitle: true,
    onLook(look, reducedMotion) {
      attract?.setLook(look, reducedMotion);
    },
    onPause: () => attract?.setVisible(false),
    onResume: () => attract?.setVisible(true),
    focus() {
      menu.querySelector<HTMLButtonElement>('.dx-option-btn')?.focus();
    },
    destroy() {
      window.removeEventListener('resize', onResize);
      attract?.destroy();
    },
  };
}
