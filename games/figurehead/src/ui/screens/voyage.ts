import { DESIGNS } from '../../engine';
import { portraitSvg } from '../../render/portrait';
import { chapterOptions, currentName, currentPlan, QUALITY_NAMES } from '../../voyage/life';
import type { ChapterRecord, Life } from '../../voyage/types';
import type { App, Screen } from '../app';
import { KIND_TEASERS, KIND_TITLES, POSTS, REFITS } from '../copy';
import { button, h, svg } from '../dom';

/**
 * Her life between battles: the ship as she is now, scars and all, her people and her
 * squadron, the wake of every chapter so far, and the choice of what comes next.
 */

export function voyageScreen(app: App): Screen {
  const life = app.saves.life.load();
  if (!life) {
    queueMicrotask(() => app.go.launch());
    return { element: h('section', { class: 'fh-screen' }) };
  }
  if (life.dockyard) {
    queueMicrotask(() => app.go.dockyard());
    return { element: h('section', { class: 'fh-screen' }) };
  }
  if (life.ending) {
    queueMicrotask(() => app.go.epilogue());
    return { element: h('section', { class: 'fh-screen' }) };
  }
  const plan = currentPlan(life)!;
  const options = chapterOptions(life);
  const name = currentName(life);

  const choices = h(
    'div',
    { class: 'fh-choices', role: 'list' },
    ...options.map((option, i) =>
      h(
        'div',
        { role: 'listitem' },
        button(
          h(
            'span',
            { class: 'fh-choice' },
            h('span', { class: 'fh-choice__title' }, KIND_TITLES[option.kind]),
            h('span', { class: 'fh-choice__line' }, KIND_TEASERS[option.kind]),
          ),
          {
            onClick: () => app.go.briefing({ kind: 'voyage', option }),
            key: String(i + 1),
            variant: i === 0 ? 'primary' : undefined,
            testId: `fh-choice-${i}`,
          },
        ),
      ),
    ),
  );

  const element = h(
    'section',
    { class: 'fh-screen fh-voyage', dataset: { testid: 'fh-voyage' } },
    h(
      'div',
      { class: 'fh-voyage__ship' },
      svg(
        portraitSvg({
          look: app.look,
          design: 'frigate',
          nation: 0,
          figurehead: life.figurehead,
          sails: 'battle',
          rig: [1, 1, 1, 1],
          hull: 1,
          scars: life.scars,
          refits: life.refits,
          struck: false,
          burning: false,
          seed: 3,
          water: 'scene',
          label: `The ${name}, with every scar of her life so far`,
        }),
        'fh-voyage__portrait',
      ),
      h(
        'div',
        { class: 'fh-voyage__facts' },
        h('h1', {}, name),
        h(
          'p',
          { class: 'fh-lede' },
          `Year ${plan.year} of her life · ${QUALITY_NAMES[life.crew.qual]} crew · renown ${life.renown}${life.crew.away ? ` · ${life.crew.away * 10} hands away with prizes` : ''}`,
        ),
        h(
          'div',
          { class: 'fh-voyage__lists' },
          factList(
            'Her officers',
            life.officers.map((o) => `${POSTS[o.post]}: ${o.name}`),
          ),
          h(
            'div',
            {},
            life.squadron.length
              ? factList(
                  'Her squadron',
                  life.squadron.map(
                    (a) => `${a.shipName}, ${DESIGNS[a.design].kind}, Captain ${a.captain}`,
                  ),
                )
              : null,
            life.refits.length
              ? factList(
                  'Refits',
                  life.refits.map((r) => REFITS[r].name),
                )
              : null,
          ),
        ),
        life.scars.length
          ? h(
              'p',
              { class: 'fh-orders__small' },
              `${life.scars.length} ${life.scars.length === 1 ? 'scar' : 'scars'} on her hull and spars, each from a chapter in the log.`,
            )
          : null,
      ),
    ),
    h(
      'div',
      { class: 'fh-voyage__next' },
      h('p', { class: 'fh-kicker' }, `Chapter ${life.records.length + 1} · year ${plan.year}`),
      h(
        'h2',
        {},
        life.taken
          ? 'She is held by the enemy'
          : options.length > 1
            ? 'Where will she sail?'
            : 'Her orders',
      ),
      choices,
      wake(life),
      recent(life),
      h(
        'div',
        { class: 'fh-actions' },
        button('Game menu', { onClick: () => app.go.title(), testId: 'fh-voyage-menu' }),
        button('The ship’s log', {
          onClick: () => app.go.log(),
          key: 'L',
          testId: 'fh-voyage-log',
        }),
      ),
    ),
  );

  return {
    element,
    onKey(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      const n = Number(event.key);
      if (n >= 1 && n <= options.length) {
        app.go.briefing({ kind: 'voyage', option: options[n - 1]! });
        return true;
      }
      if (event.key.toLowerCase() === 'l') {
        app.go.log();
        return true;
      }
      return false;
    },
    onLook: () => app.go.voyage(),
    focus: () => choices.querySelector<HTMLElement>('button')?.focus({ preventScroll: true }),
  };
}

function factList(title: string, items: string[]): HTMLElement {
  return h(
    'div',
    { class: 'fh-facts' },
    h('h3', {}, title),
    h('ul', {}, ...items.map((t) => h('li', {}, t))),
  );
}

/** The last few pages of her log, newest first. */
function recent(life: Life): HTMLElement | null {
  const last = life.records.slice(-3).reverse();
  if (!last.length) return null;
  return h(
    'section',
    { class: 'fh-recent', 'aria-label': 'Her latest chapters' },
    h('h3', {}, 'Lately in her log'),
    h(
      'ul',
      {},
      last.map((r) =>
        h(
          'li',
          { dataset: { result: r.win === true ? 'won' : r.win === false ? 'lost' : 'even' } },
          h('b', {}, `Year ${r.year}`),
          ` · ${KIND_TITLES[r.kind]}${r.foe ? `, the ${r.foe}` : ''} · ${r.win === true ? 'won' : r.win === false ? 'lost' : 'undecided'}${r.prizes.length ? ` · ${r.prizes.length} ${r.prizes.length === 1 ? 'prize' : 'prizes'}` : ''}`,
        ),
      ),
    ),
  );
}

/** Her wake: one mark for each chapter fought, and the ones still ahead. */
function wake(life: Life): HTMLElement {
  const marks = life.records.map((r: ChapterRecord) =>
    h(
      'li',
      {
        class: 'fh-wake__mark',
        dataset: { result: r.win === true ? 'won' : r.win === false ? 'lost' : 'even' },
        title: `Year ${r.year}: ${KIND_TITLES[r.kind]}${r.foe ? ` against the ${r.foe}` : ''}`,
      },
      h(
        'span',
        { class: 'fh-sr' },
        `Year ${r.year}, ${KIND_TITLES[r.kind]}, ${r.win === true ? 'won' : r.win === false ? 'lost' : 'undecided'}`,
      ),
    ),
  );
  const ahead = Math.max(0, life.plan.length - life.next);
  return h(
    'div',
    { class: 'fh-wake', 'aria-label': 'Her wake so far' },
    h(
      'ol',
      {},
      ...marks,
      ...Array.from({ length: ahead }, () =>
        h('li', { class: 'fh-wake__mark', dataset: { result: 'ahead' } }),
      ),
    ),
    h(
      'p',
      { class: 'fh-orders__small' },
      `${life.records.length} chapters behind her, ${ahead} ahead.`,
    ),
  );
}
