import { CLOCK_SECONDS, type RoundPlan } from '../../game/modes';
import { readingLevel, UNLOCK_LEVEL } from '../../game/records';
import { AttractLoop } from '../../render/attract';
import type { App, Screen } from '../app';
import { h, svg } from '../dom';
import { applyLook } from '../look';

/**
 * The game menu: the name, your board-reading level, the ways to play, and the cubes behind
 * it all, hunting words on their own. Escape here goes back to the Hall.
 */
export function titleScreen(app: App): Screen {
  const records = app.records();
  const level = readingLevel(records);
  const daily = app.context.daily;
  const dailyDone = records.dailies[daily.dateKey()];
  const slot = h('div', { class: 'chl-title__board' });

  const mode = (id: string, name: string, line: string, run: () => void, extra?: string) =>
    h(
      'button',
      {
        class: 'chl-mode',
        type: 'button',
        'data-mode': id,
        'data-testid': `chl-mode-${id}`,
        onclick: () => (app.sounds.tap(), run()),
      },
      h('span', { class: 'chl-mode__name' }, name),
      h('span', { class: 'chl-mode__line' }, line),
      extra ? h('span', { class: 'chl-mode__tag' }, extra) : null,
    );

  const quickClassic: RoundPlan = {
    mode: 'classic',
    size: 4,
    rule: 'classic',
    minLetters: 3,
    seconds: CLOCK_SECONDS[4],
    seed: `classic#${Math.floor(Math.random() * 1e9)}`,
  };
  const modes = h(
    'nav',
    { class: 'chl-modes', 'aria-label': 'Ways to play' },
    records.tutorialDone
      ? null
      : mode(
          'tutorial',
          'Tutorial',
          'One minute, three tips, then the board is yours.',
          () => app.go.tutorial(),
          'Start here',
        ),
    mode('classic', 'Classic', 'Three minutes on sixteen cubes: the 1988 rules.', () =>
      app.go.play(quickClassic),
    ),
    mode(
      'daily',
      `Daily Grid #${daily.number()}`,
      dailyDone
        ? `Played today: ${dailyDone.found} words. Replay it for practice.`
        : 'The same rich board for everyone today.',
      () => app.go.daily(),
      dailyDone ? 'Played' : 'New',
    ),
    mode(
      'setup',
      'Choose your board',
      'Bigger grids, Echo and Mirror rules, shorter or longer words.',
      () => app.go.setup('classic'),
    ),
    mode('zen', 'Zen', 'No clock. Stop when you like.', () => app.go.setup('zen')),
    mode('duel', 'Duel', 'Race an AI word-hunter on the same board.', () => app.go.setup('duel')),
    mode('pass', 'Pass and play', 'Two players, one board, one turn each.', () =>
      app.go.setup('pass'),
    ),
    records.tutorialDone
      ? mode('tutorial', 'Tutorial', 'A one-minute refresher.', () => app.go.tutorial())
      : null,
  );
  const more = h(
    'nav',
    { class: 'chl-more', 'aria-label': 'More' },
    h(
      'button',
      {
        class: 'chl-button',
        type: 'button',
        'data-testid': 'chl-open-book',
        onclick: () => app.go.book(),
      },
      'Word book',
    ),
    h(
      'button',
      {
        class: 'chl-button',
        type: 'button',
        'data-testid': 'chl-open-records',
        onclick: () => app.go.records(),
      },
      'Records',
    ),
    h(
      'button',
      {
        class: 'chl-button',
        type: 'button',
        'data-testid': 'chl-open-help',
        onclick: () => app.go.help(),
      },
      'How to play',
    ),
  );
  const levelCard = h(
    'section',
    { class: 'chl-level chl-card', 'aria-label': 'Board-reading level' },
    levelRing(level),
    h(
      'div',
      {},
      h('h2', { class: 'chl-card__label' }, 'Board-reading level'),
      h('p', { class: 'chl-level__text' }, levelText(level, records.level.boards)),
    ),
  );
  const element = h(
    'div',
    { class: 'chl-screen chl-title', 'data-testid': 'chl-title' },
    h(
      'div',
      { class: 'chl-title__menu' },
      h(
        'header',
        { class: 'chl-wordmark' },
        h('h1', {}, h('span', {}, 'Chain'), h('span', {}, 'Letter')),
        h(
          'p',
          { class: 'chl-wordmark__tagline' },
          'Trace the letters. Find the words. Beat the dictionary.',
        ),
      ),
      levelCard,
      modes,
      more,
    ),
    slot,
  );
  applyLook(element, app.palette, app.reducedMotion);

  const place = () => {
    const frame = element.getBoundingClientRect();
    const box = slot.getBoundingClientRect();
    app.board.setBoardRect({
      x: box.left - frame.left,
      y: box.top - frame.top,
      width: box.width,
      height: box.height,
    });
  };
  const observer = new ResizeObserver(place);
  observer.observe(slot);
  const attract = new AttractLoop(app.board, Math.floor(Math.random() * 97));
  requestAnimationFrame(() => {
    place();
    attract.start();
  });

  return {
    element,
    onTitle: true,
    onLook: (palette, reducedMotion) => applyLook(element, palette, reducedMotion),
    focus: () => element.querySelector<HTMLElement>('.chl-mode')?.focus({ preventScroll: true }),
    destroy: () => {
      attract.stop();
      app.board.setVisible(true);
      observer.disconnect();
    },
  };
}

function levelText(level: number | null, boards: number): string {
  if (level === null) {
    const left = 3 - boards;
    return `Read ${left} more timed ${left === 1 ? 'board' : 'boards'} to set your level.`;
  }
  const pct = Math.round(level * 100);
  const next =
    level < UNLOCK_LEVEL[5]
      ? `Big grid opens at ${UNLOCK_LEVEL[5] * 100}%.`
      : level < UNLOCK_LEVEL[6]
        ? `Mega grid opens at ${UNLOCK_LEVEL[6] * 100}%.`
        : 'Every grid is open.';
  return `${pct}% of every board you have read. ${next}`;
}

function levelRing(level: number | null): HTMLElement {
  const ring = 2 * Math.PI * 52;
  const share = level ?? 0;
  return h(
    'div',
    { class: 'chl-cover__dial chl-level__dial' },
    svg(
      'svg',
      { class: 'chl-cover__ring', viewBox: '0 0 120 120', 'aria-hidden': 'true' },
      svg('circle', { class: 'chl-cover__track', cx: 60, cy: 60, r: 52 }),
      svg('circle', {
        class: 'chl-cover__fill',
        cx: 60,
        cy: 60,
        r: 52,
        'stroke-dasharray': `${(share * ring).toFixed(2)} ${ring.toFixed(2)}`,
        style: share > 0 ? '' : 'visibility:hidden',
      }),
    ),
    h(
      'div',
      { class: 'chl-cover__face' },
      h('div', { class: 'chl-level__value' }, level === null ? '—' : `${Math.round(level * 100)}%`),
    ),
  );
}
