import { capship, createBattle, DESIGNS } from '../../engine';
import { encounterFor } from '../../game/flow';
import type { Mode } from '../../game/saves';
import { portraitSvg } from '../../render/portrait';
import { currentName } from '../../voyage/life';
import type { App, Screen } from '../app';
import { briefingFor, mentionLabel, windLine } from '../copy';
import { button, h, svg } from '../dom';

/**
 * The orders before an action: what is happening and why, who she will meet, the weather, and
 * the three things a captain can be mentioned for.
 */

export function briefingScreen(app: App, mode: Mode): Screen {
  const encounter = encounterFor(app, mode);
  const battle = createBattle(encounter.setup);
  const life = mode.kind === 'voyage' ? app.saves.life.load() : null;
  const plan = life ? life.plan[life.next] : null;
  const me = battle.ships[battle.player]!;
  const brief = briefingFor(encounter.kind, {
    ship: life ? currentName(life) : me.name,
    foe: encounter.foe,
    year: plan?.year ?? 0,
    aboard: encounter.aboard,
  });
  const QUAL = ['', 'unruly', 'green', 'steady', 'crack', 'elite'];
  const enemies = battle.ships.filter(
    (sp) => capship(battle, sp).nation !== capship(battle, me).nation,
  );
  const friends = battle.ships.filter(
    (sp) => sp !== me && capship(battle, sp).nation === capship(battle, me).nation,
  );

  const shipCard = (index: number) => {
    const sp = battle.ships[index]!;
    return h(
      'li',
      { class: 'fh-briefing__ship' },
      svg(
        portraitSvg({
          look: app.look,
          design: sp.design,
          nation: sp.nation,
          figurehead: null,
          sails: 'full',
          rig: [1, 1, 1, 1],
          hull: 1,
          scars: [],
          refits: [],
          struck: false,
          burning: false,
          seed: index + 31,
          water: 'none',
          label: sp.name,
        }),
        'fh-briefing__portrait',
      ),
      h('b', {}, sp.name),
      h(
        'span',
        {},
        `${DESIGNS[sp.design].kind}, ${sp.specs.guns} guns · ${QUAL[capship(battle, sp).specs.qual]} crew${sp.role === 'merchant' ? ' · merchantman' : ''}`,
      ),
    );
  };

  const start = () => app.go.battle(mode);
  const element = h(
    'section',
    { class: 'fh-screen fh-briefing', dataset: { testid: 'fh-briefing' } },
    h(
      'div',
      { class: 'fh-sheet fh-sheet--wide' },
      h(
        'p',
        { class: 'fh-kicker' },
        mode.kind === 'daily'
          ? `Today’s Weather #${mode.number}`
          : mode.kind === 'open'
            ? 'Open water'
            : `Year ${plan?.year} of her life`,
      ),
      h('h1', {}, brief.title),
      h('p', { class: 'fh-lede' }, brief.story),
      h(
        'div',
        { class: 'fh-briefing__grid' },
        h(
          'div',
          {},
          h('h2', {}, 'Mentioned in the log for'),
          h(
            'ul',
            { class: 'fh-mentions' },
            encounter.mentions.map((m) => h('li', {}, mentionLabel(m.id, m.turns, encounter.kind))),
          ),
          h('h2', {}, 'Weather'),
          h(
            'p',
            {},
            `${windLine(battle)}${encounter.setup.wind.change <= 2 ? ', and rising' : ''}${encounter.night ? ', by night' : ''}. ${battle.maxTurns} turns of daylight.`,
          ),
        ),
        h(
          'div',
          {},
          h('h2', {}, enemies.length === 1 ? 'The enemy' : 'The enemy'),
          h(
            'ul',
            { class: 'fh-briefing__ships' },
            enemies.map((sp) => shipCard(sp.index)),
          ),
          friends.length ? h('h2', {}, 'With you') : null,
          friends.length
            ? h(
                'ul',
                { class: 'fh-briefing__ships' },
                friends.map((sp) => shipCard(sp.index)),
              )
            : null,
        ),
      ),
      h(
        'div',
        { class: 'fh-actions' },
        button('Make sail', {
          onClick: start,
          key: 'Enter',
          variant: 'primary',
          testId: 'fh-make-sail',
          autofocus: true,
        }),
        button(mode.kind === 'voyage' ? 'Back to her chart' : 'Game menu', {
          onClick: () => (mode.kind === 'voyage' ? app.go.voyage() : app.go.title()),
          testId: 'fh-briefing-back',
        }),
      ),
    ),
  );

  return {
    element,
    onKey(event) {
      if (event.key === 'Enter') {
        start();
        return true;
      }
      return false;
    },
    onLook: () => app.go.briefing(mode),
    focus: () =>
      element.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }),
  };
}
