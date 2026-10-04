import { portraitSvg } from '../../render/portrait';
import { FIGUREHEADS, figureheadSvg } from '../../render/figureheads';
import { PALETTES } from '../../render/palette';
import { chapterOptions, currentName, currentPlan, QUALITY_NAMES } from '../../voyage/life';
import type { Life } from '../../voyage/types';
import type { App, Screen } from '../app';
import { GAME_TITLE, KIND_TITLES, TAGLINE } from '../copy';
import { button, h, svg } from '../dom';

/**
 * The game menu: her portrait at anchor (or a new ship waiting on the slip), the carving at her
 * bow, and the ways to sea: her voyage, Today's Weather, open water, the log, the manual.
 */

export function heroPortrait(app: App, life: Life | null, on: 'page' | 'card' = 'page'): string {
  return portraitSvg({
    look: app.look,
    design: 'frigate',
    nation: 0,
    figurehead: life?.figurehead ?? 'heron',
    sails: 'full',
    rig: [1, 1, 1, 1],
    hull: 1,
    scars: life?.scars ?? [],
    refits: life?.refits ?? [],
    struck: false,
    burning: false,
    seed: 3,
    water: 'scene',
    on,
    label: life ? `The ${currentName(life)} at sea` : 'A new frigate, waiting for a name',
  });
}

export function titleScreen(app: App): Screen {
  const life = app.saves.life.load();
  const active = app.saves.active.load();
  const daily = app.context.daily;
  const day = app.saves.days.load()[daily.dateKey()];
  const plan = life ? currentPlan(life) : null;

  const voyageLine = (() => {
    if (!life) return 'A new frigate, waiting for a name and a carving.';
    if (life.ending) return `The ${currentName(life)}’s story is told. Launch another ship.`;
    if (active?.mode.kind === 'voyage')
      return `Return to the action, turn ${active.battle.turn + 1}.`;
    if (life.dockyard) return `In the dockyard, a refit to choose.`;
    const options = chapterOptions(life);
    return `Chapter ${life.records.length + 1}, year ${plan?.year}: ${options.map((o) => KIND_TITLES[o.kind].toLowerCase()).join(' or ')}.`;
  })();

  const go = {
    voyage: () => {
      if (!life || life.ending) app.go.launch();
      else if (active?.mode.kind === 'voyage') app.go.battle(active.mode, true);
      else app.go.voyage();
    },
    daily: () => {
      if (active?.mode.kind === 'daily' && active.mode.dateKey === daily.dateKey())
        app.go.battle(active.mode, true);
      else app.go.daily();
    },
    open: () => {
      if (active?.mode.kind === 'open') app.go.battle(active.mode, true);
      else app.go.open();
    },
  };

  const cards = h(
    'nav',
    { class: 'fh-menu', 'aria-label': 'Game menu' },
    menuCard(
      life && !life.ending ? 'The Voyage' : 'Launch a ship',
      voyageLine,
      'V',
      go.voyage,
      'fh-menu-voyage',
      true,
    ),
    menuCard(
      `Today’s Weather #${daily.number()}`,
      day
        ? `${day.won ? 'Won' : 'Fought'} today · rating ${day.rating.toLocaleString('en')}. Sail it again for practice.`
        : 'One action, the same for every captain today.',
      'T',
      go.daily,
      'fh-menu-daily',
    ),
    menuCard(
      'Open water',
      'Any action, any crew, any seed: practice without a log.',
      'O',
      go.open,
      'fh-menu-open',
    ),
    menuCard(
      'The ship’s log',
      'Her story so far, and the ships whose stories are told.',
      'L',
      () => app.go.log(),
      'fh-menu-log',
    ),
    menuCard(
      'How to play',
      'Wind, broadsides, prizes and the six-to-one rule.',
      '?',
      () => app.go.help(),
      'fh-menu-help',
    ),
  );

  const p = PALETTES[app.look];
  const carving = life?.figurehead ?? 'heron';
  const element = h(
    'section',
    { class: 'fh-screen fh-title', dataset: { testid: 'fh-title' } },
    h(
      'div',
      { class: 'fh-title__hero' },
      svg(heroPortrait(app, life), 'fh-title__portrait'),
      h(
        'div',
        { class: 'fh-title__carving', title: FIGUREHEADS.find((f) => f.id === carving)!.name },
        svg(
          figureheadSvg(
            carving,
            p,
            app.look === 'night',
            FIGUREHEADS.find((f) => f.id === carving)!.name,
          ),
        ),
      ),
    ),
    h(
      'div',
      { class: 'fh-title__side' },
      h('h1', { class: 'fh-title__name' }, GAME_TITLE),
      h('p', { class: 'fh-title__tagline' }, TAGLINE),
      life && !life.ending
        ? h(
            'p',
            { class: 'fh-title__ship', dataset: { testid: 'fh-title-ship' } },
            h('b', {}, currentName(life)),
            ` · ${QUALITY_NAMES[life.crew.qual]} crew · ${life.squadron.length ? `${life.squadron.length} in her squadron · ` : ''}renown ${life.renown}`,
          )
        : null,
      cards,
    ),
  );

  const buttons = () => [...cards.querySelectorAll<HTMLButtonElement>('button')];
  return {
    element,
    onTitle: true,
    onKey(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      const key = event.key.toLowerCase();
      if (key === 'v') go.voyage();
      else if (key === 't') go.daily();
      else if (key === 'o') go.open();
      else if (key === 'l') app.go.log();
      else if (key === '?') app.go.help();
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const list = buttons();
        const i = list.indexOf(document.activeElement as HTMLButtonElement);
        list[(i + (event.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus();
      } else return false;
      return true;
    },
    onLook() {
      app.go.title();
    },
    focus: () => buttons()[0]?.focus({ preventScroll: true }),
  };
}

function menuCard(
  title: string,
  line: string,
  key: string,
  onClick: () => void,
  testId: string,
  primary = false,
): HTMLElement {
  const b = button(
    h(
      'span',
      { class: 'fh-menu__text' },
      h('span', { class: 'fh-menu__title' }, title),
      h('span', { class: 'fh-menu__line' }, line),
    ),
    {
      onClick,
      key,
      testId,
      variant: primary ? 'primary' : undefined,
    },
  );
  b.classList.add('fh-menu__card');
  return b;
}
