import { EMERITUS_TITLE, rankById } from '../../engine/params';
import { NIGHT_RANK } from '../../game/saves';
import { startTitleBackdrop } from '../../render/backdrop';
import { startHeroShip } from '../../render/hero';
import type { App, Screen } from '../app';
import { zoneLabel } from '../copy';
import { h } from '../dom';

/**
 * The game menu: the Reach glowing behind the title, the ways to keep a watch, and the smaller
 * doors. Escape here goes back to the Hall.
 */
export function titleScreen(app: App): Screen {
  const backdrop = h('canvas', { class: 'lk-title__backdrop', 'aria-hidden': 'true' });
  const scene = startTitleBackdrop(backdrop, app.look, app.reducedMotion);
  const heroCanvas = h('canvas', { class: 'lk-title__hero', 'aria-hidden': 'true' });
  const hero = startHeroShip(heroCanvas, app.look, app.reducedMotion);

  const career = app.saves.career.load();
  const active = app.saves.active.load();
  const dateKey = app.context.daily.dateKey();
  const number = app.context.daily.number();
  const tonight = app.saves.nights.load().days[dateKey];
  const rankTitle = career.emeritus ? EMERITUS_TITLE : rankById(career.rank).title;

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
          class: primary ? 'lk-menu__item lk-menu__item--primary' : 'lk-menu__item',
          onclick: onClick,
          dataset: { testid: testId },
        },
        h(
          'span',
          {},
          h('span', { class: 'lk-menu__name' }, name),
          h('span', { class: 'lk-menu__note' }, note),
        ),
        h('span', { class: 'lk-menu__side' }, side),
      ),
    );

  const resumeItem =
    active && !active.state.outcome
      ? item(
          'Resume the watch',
          `Zone ${zoneLabel(active.state.ship.zone)} · day ${(active.state.now.date - active.state.params.date).toFixed(1)} · ${active.state.now.gleaners} gleaners left`,
          '',
          () => app.go.play(active.watch, true),
          'lk-menu-resume',
          true,
        )
      : null;

  const tonightNote = tonight
    ? tonight.outcome === 'won'
      ? `Kept · ${tonight.lights}/32 lights · ${tonight.score} points`
      : `Ended early · ${tonight.lights}/32 lights. Another go?`
    : `${rankById(NIGHT_RANK).title}’s rules · the same Reach for every keeper tonight`;

  const menu = h(
    'ul',
    { class: 'lk-menu' },
    resumeItem,
    item(
      'Commission',
      career.emeritus
        ? 'Every rank earned. Keep any watch you like.'
        : career.watches === 0
          ? 'Your first watch as a Cadet'
          : `Next watch as ${rankTitle}`,
      rankTitle,
      () => app.go.briefing({ kind: 'commission', rank: career.rank }),
      'lk-menu-commission',
      !resumeItem,
    ),
    item(
      `Tonight’s watch #${number}`,
      tonightNote,
      tonight?.outcome === 'won' ? '✓' : '',
      () => app.go.briefing({ kind: 'daily', dateKey, number }),
      'lk-menu-daily',
    ),
    item(
      'Open watch',
      'Any code, any rank, or the 1976 rules in full',
      '',
      () => app.go.openWatch(),
      'lk-menu-open',
    ),
  );

  const links = h(
    'div',
    { class: 'lk-title__links' },
    h(
      'button',
      {
        type: 'button',
        class: 'lk-button lk-button--quiet',
        onclick: () => app.go.record(),
        dataset: { testid: 'lk-menu-record' },
      },
      'Service record',
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'lk-button lk-button--quiet',
        onclick: () => app.go.help(),
        dataset: { testid: 'lk-menu-help' },
      },
      'How to play',
    ),
  );

  const element = h(
    'section',
    { class: 'lk-screen lk-title', 'aria-labelledby': 'lk-logo', dataset: { testid: 'lk-title' } },
    backdrop,
    h('div', { class: 'lk-title__veil', 'aria-hidden': 'true' }),
    heroCanvas,
    h(
      'div',
      { class: 'lk-title__column' },
      h('p', { class: 'lk-kicker' }, 'A keeper’s watch over the Reach'),
      h('h1', { class: 'lk-logo', id: 'lk-logo' }, 'Lightkeeper'),
      h(
        'p',
        { class: 'lk-tagline' },
        'Thirty-two worlds, one ship, and a swarm of mining drones that will not wait. Keep the lights on.',
      ),
      menu,
      links,
    ),
  );

  const observer = new ResizeObserver(() => {
    scene.resize(backdrop.clientWidth, backdrop.clientHeight);
    hero.resize(heroCanvas.clientWidth, heroCanvas.clientHeight);
  });
  observer.observe(backdrop);
  observer.observe(heroCanvas);

  return {
    element,
    onTitle: true,
    onLook(look, reducedMotion) {
      scene.setLook(look, reducedMotion);
      hero.setLook(look, reducedMotion);
    },
    onPause() {
      scene.setVisible(false);
      hero.setVisible(false);
    },
    onResume() {
      scene.setVisible(true);
      hero.setVisible(true);
    },
    focus: () => menu.querySelector('button')?.focus({ preventScroll: true }),
    destroy() {
      observer.disconnect();
      scene.destroy();
      hero.destroy();
    },
  };
}
