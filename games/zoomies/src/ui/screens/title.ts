import { ROOMS, STARS_IN_HOUSE } from '../../data/house';
import { starsEarned } from '../../game/saves';
import { today } from '../../game/today';
import { startDemoLoop } from '../../render/demo-loop';
import type { Look } from '../../render/palette';
import { drawCat } from '../../render/sprites/cat';
import { drawVacuum } from '../../render/sprites/vacuum';
import type { App, Screen } from '../app';
import { h } from '../dom';

/**
 * The game menu: a room playing itself behind the title, the four ways to play, and the
 * smaller doors (records, how to play, settings). Escape here goes back to the Hall.
 */
export function titleScreen(app: App): Screen {
  const backdrop = h('canvas', { class: 'zm-title__backdrop', 'aria-hidden': 'true' });
  const demo = startDemoLoop(backdrop, {
    look: app.look,
    reducedMotion: app.reducedMotion,
    coat: app.coat(),
    seed: new Date().getDate(),
  });
  const art = h('canvas', { 'aria-hidden': 'true' });
  const artBox = h('div', { class: 'zm-title__art' }, art);

  const house = app.saves.house.load();
  const stars = starsEarned(house);
  const nextRoom = ROOMS.find((room) => !house.rooms[room.id]?.tidy) ?? null;
  const day = today(app.context);
  const doneToday = app.saves.daily.load().days[day.dateKey];
  const best = app.saves.night.load().top[0];
  const lab = app.saves.lab.load();

  const item = (
    name: string,
    note: string,
    side: string,
    onClick: () => void,
    testId: string,
    primary = false,
  ) =>
    h(
      'li',
      {},
      h(
        'button',
        {
          type: 'button',
          class: primary ? 'zm-menu__item zm-menu__item--primary' : 'zm-menu__item',
          onclick: onClick,
          dataset: { testid: testId },
        },
        h(
          'span',
          {},
          h('span', { class: 'zm-menu__name' }, name),
          h('span', { class: 'zm-menu__note' }, note),
        ),
        h('span', { class: 'zm-menu__side' }, side),
      ),
    );

  const houseNote = nextRoom
    ? stars === 0
      ? 'Twelve rooms, one new trick in each'
      : `Next: ${nextRoom.name.toLowerCase()}`
    : 'Every room tidy. Chase the last stars';
  const dailyNote = !day.room
    ? 'Today’s room is still being tidied'
    : doneToday
      ? doneToday.outcome === 'cleared'
        ? `Tidied in ${doneToday.turns} · par ${doneToday.par}`
        : `Fluffed on turn ${doneToday.turns}. Another go?`
      : `${day.room.label} · par ${day.room.solution.turns}`;

  const menu = h(
    'ul',
    { class: 'zm-menu' },
    item(
      'The House',
      houseNote,
      `★ ${stars}/${STARS_IN_HOUSE}`,
      () => app.go.house(),
      'zm-menu-house',
      true,
    ),
    item(
      `Today’s mess #${day.number}`,
      dailyNote,
      doneToday?.outcome === 'cleared' ? '✓' : '',
      () => app.go.daily(),
      'zm-menu-daily',
    ),
    item(
      'Long Night',
      'The 1980 original, rule for rule',
      best ? `best ${best.score}` : '',
      () => app.go.night(),
      'zm-menu-night',
    ),
    item(
      'Pattern Lab',
      'Write a pattern, race Pip',
      lab.best ? `best ${lab.best.score}` : '',
      () => app.go.lab(),
      'zm-menu-lab',
    ),
  );

  const links = h(
    'div',
    { class: 'zm-title__links' },
    h(
      'button',
      {
        type: 'button',
        class: 'zm-button zm-button--quiet',
        onclick: () => app.go.records(),
        dataset: { testid: 'zm-menu-records' },
      },
      'Records & rivals',
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'zm-button zm-button--quiet',
        onclick: () => app.go.help(),
        dataset: { testid: 'zm-menu-help' },
      },
      'How to play',
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'zm-button zm-button--quiet',
        onclick: () => app.go.settings(),
        dataset: { testid: 'zm-menu-settings' },
      },
      'Settings',
    ),
  );

  const element = h(
    'section',
    { class: 'zm-screen zm-title', 'aria-labelledby': 'zm-logo', dataset: { testid: 'zm-title' } },
    backdrop,
    h('div', { class: 'zm-title__veil', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'zm-title__column' },
      h(
        'h1',
        { class: 'zm-logo', id: 'zm-logo', 'aria-label': 'Zoomies' },
        'Zoo',
        h('span', { 'aria-hidden': 'true' }, 'mies'),
      ),
      h(
        'p',
        { class: 'zm-tagline' },
        'Every robot vacuum in the house wants your fur. Make them bonk.',
      ),
      menu,
      links,
    ),
    artBox,
  );

  const resize = () => {
    demo.resize(element.clientWidth, element.clientHeight);
    paintHero(art, artBox.clientWidth, artBox.clientHeight, app.look, app);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(element);

  return {
    element,
    onTitle: true,
    onLook(look, reducedMotion) {
      demo.setLook(look, reducedMotion);
      paintHero(art, artBox.clientWidth, artBox.clientHeight, look, app);
    },
    onPause: () => demo.setVisible(false),
    onResume: () => demo.setVisible(true),
    focus: () => menu.querySelector('button')?.focus({ preventScroll: true }),
    destroy() {
      observer.disconnect();
      demo.destroy();
    },
  };
}

/** The title's hero: the cat, one paw up, eyeing a vacuum that is eyeing it right back. */
function paintHero(canvas: HTMLCanvasElement, width: number, height: number, look: Look, app: App) {
  if (width < 10 || height < 10) return;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const s = Math.min(width * 0.34, height * 0.46);
  drawVacuum(ctx, width * 0.72, height * 0.62, s * 0.95, {
    kind: 'basic',
    look,
    heading: { x: -1, y: 0.2 },
    mood: 'danger',
    resting: false,
    full: false,
    time: 0,
    hop: 0,
  });
  drawCat(ctx, width * 0.32, height * 0.58, s * 1.25, {
    coat: app.coat(),
    pose: 'sit',
    facing: 1,
    gaze: { x: 1, y: 0.2 },
    time: 0.6,
    look,
  });
}
