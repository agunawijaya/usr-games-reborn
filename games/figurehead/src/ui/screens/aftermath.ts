import type { ResultReceipt, ShareCell } from '@usr-games/kit';
import { DESIGNS } from '../../engine';
import { settleChapter, settleQuick } from '../../game/flow';
import { portraitSvg } from '../../render/portrait';
import { botPrizeCrews } from '../../bots/sim';
import { currentName, type PrizeOffer, prizeVerdict, QUALITY_NAMES } from '../../voyage/life';
import type { ChapterRecord, Life, Scar } from '../../voyage/types';
import type { App, Ending, Screen } from '../app';
import { END_HEADLINES, endLine, KIND_TITLES, lifeEventLine, mentionLabel } from '../copy';
import { button, h, put, svg } from '../dom';

/**
 * After the action. For her voyage: what she won and what it cost, and the prize crews (the
 * six-to-one rule decides whether a prize reaches harbour, and two hands more keep her for the
 * squadron). Then the chapter goes into the log for good. For Today's Weather and open water:
 * the reckoning, a share line, and another go.
 */

const VERDICT_WORDS = {
  released: 'Let her go: her people keep their ship and give their word not to fight again.',
  retaken: 'Too few. Her prisoners would outnumber them six to one and take her back on the way.',
  home: 'Enough to bring her into harbour.',
  serve: 'Enough to keep her: she joins your squadron.',
} as const;

const CONDITION_WORDS = {
  whole: 'taken whole',
  sound: 'sound enough',
  battered: 'badly battered',
} as const;

export function aftermathScreen(app: App, ending: Ending): Screen {
  return ending.mode.kind === 'voyage' ? voyageAftermath(app, ending) : quickAftermath(app, ending);
}

function headline(ending: Ending, ship: string): HTMLElement {
  const o = ending.outcome;
  return h(
    'header',
    { class: 'fh-after__head', dataset: { win: String(o.win) } },
    h('p', { class: 'fh-kicker' }, KIND_TITLES[o.encounter.kind]),
    h('h1', { dataset: { testid: 'fh-after-headline' } }, END_HEADLINES[o.reason]),
    h('p', { class: 'fh-lede' }, endLine(o.reason, ship, o.encounter.kind)),
  );
}

/** What became of every ship that fought against her. */
function enemyFates(ending: Ending): HTMLElement | null {
  const b = ending.battle;
  const me = b.ships[b.player]!;
  const taken = new Set(ending.outcome.prizes.map((p) => p.ship));
  const lines = b.ships
    .filter((sp) => sp.nation !== me.nation)
    .map((sp) => {
      let fate: string;
      if (taken.has(sp.index))
        fate =
          sp.captured >= 0
            ? 'taken by boarding'
            : sp.yielded
              ? 'yielded, whole'
              : 'struck to your guns';
      else if (sp.sink) fate = 'went down; her boats got clear';
      else if (sp.explode) fate = 'burned and blew up; her people were picked up';
      else if (sp.escaped) fate = 'got away';
      else if (sp.struck) fate = 'struck';
      else fate = 'still under her own flag';
      return h('li', {}, h('b', {}, sp.name), `: ${fate}.`);
    });
  return lines.length
    ? h('section', { class: 'fh-after__fates' }, h('h2', {}, 'The enemy'), h('ul', {}, lines))
    : null;
}

function ownPortrait(
  app: App,
  ending: Ending,
  scars: readonly Scar[],
  figurehead: Life['figurehead'] | null,
  refits: readonly Life['refits'][number][],
): string {
  const b = ending.battle;
  const index = ending.outcome.encounter.ownShip >= 0 ? ending.outcome.encounter.ownShip : b.player;
  const sp = b.ships[index]!;
  return portraitSvg({
    look: app.look,
    design: sp.design,
    nation: sp.nation,
    figurehead,
    sails: sp.struck ? 'furled' : 'battle',
    rig: [
      rate(sp.specs.rig1, sp.max.rig1),
      rate(sp.specs.rig2, sp.max.rig2),
      rate(sp.specs.rig3, sp.max.rig3),
      sp.max.rig4 > 0 ? rate(sp.specs.rig4, sp.max.rig4) : 1,
    ],
    hull: rate(sp.specs.hull, sp.max.hull),
    scars,
    refits,
    struck: sp.struck,
    burning: sp.explode === 1,
    seed: 9,
    water: 'scene',
    on: 'card',
    label: `${sp.name} after the action`,
  });
}

function mentionsList(ending: Ending): HTMLElement {
  const o = ending.outcome;
  return h(
    'ul',
    { class: 'fh-mentions fh-mentions--marked', dataset: { testid: 'fh-after-mentions' } },
    o.mentions.map((m) =>
      h(
        'li',
        { dataset: { earned: String(m.earned) } },
        h('span', { 'aria-hidden': 'true' }, m.earned ? '◆' : '◇'),
        ` ${mentionLabel(m.id, m.turns, o.encounter.kind)}`,
        h('span', { class: 'fh-sr' }, m.earned ? ' (earned)' : ' (not this time)'),
      ),
    ),
  );
}

function prizePortrait(app: App, offer: PrizeOffer, ending: Ending): string {
  const sp = ending.battle.ships[offer.ship]!;
  return portraitSvg({
    look: app.look,
    design: sp.design,
    nation: sp.nation,
    figurehead: null,
    sails: 'furled',
    rig: [
      rate(sp.specs.rig1, sp.max.rig1),
      rate(sp.specs.rig2, sp.max.rig2),
      rate(sp.specs.rig3, sp.max.rig3),
      1,
    ],
    hull: rate(sp.specs.hull, sp.max.hull),
    scars: [],
    refits: [],
    struck: true,
    burning: false,
    seed: offer.ship + 11,
    water: 'none',
    label: `${sp.name}, ${CONDITION_WORDS[offer.condition]}`,
  });
}

function voyageAftermath(app: App, ending: Ending): Screen {
  const life = app.saves.life.load()!;
  const name = ending.outcome.encounter.aboard ? currentName(life) : currentName(life);
  const offers = ending.outcome.prizes;
  // Start from the sailing master's suggestion: keep what can serve, bring the rest home.
  const sent = botPrizeCrews(offers, ending.outcome.spare);
  let settled: { life: Life; record: ChapterRecord; receipt: ResultReceipt } | null = null;

  const body = h('div', { class: 'fh-after__body' });
  const actions = h('div', { class: 'fh-actions' });
  const art = h('div', { class: 'fh-after__art' });
  const element = h(
    'section',
    { class: 'fh-screen fh-after', dataset: { testid: 'fh-aftermath' } },
    h(
      'div',
      { class: 'fh-sheet fh-sheet--wide' },
      headline(ending, name),
      h('div', { class: 'fh-after__grid' }, art, h('div', {}, body, actions)),
    ),
  );
  const drawArt = () => {
    const own = !ending.outcome.encounter.aboard || ending.outcome.encounter.ownShip >= 0;
    const scars = settled ? settled.life.scars : life.scars;
    art.replaceChildren();
    put(
      art,
      own
        ? svg(ownPortrait(app, ending, scars, life.figurehead, life.refits), 'fh-after__portrait')
        : null,
      settled && settled.record.scars.length
        ? h(
            'p',
            { class: 'fh-orders__small' },
            `New scars from this chapter: ${settled.record.scars.length}. They stay with her.`,
          )
        : null,
      enemyFates(ending),
    );
  };

  const spareLeft = () => ending.outcome.spare - sent.reduce((a, b) => a + b, 0);

  function prizeCard(offer: PrizeOffer, i: number): HTMLElement {
    const verdict = prizeVerdict(offer, sent[i]!);
    const step = (by: number) => {
      const next = Math.max(0, Math.min(8, sent[i]! + by));
      if (by > 0 && spareLeft() <= 0) return;
      sent[i] = next;
      draw();
      element
        .querySelector<HTMLElement>(`[data-testid="fh-prize-${i}-${by > 0 ? 'more' : 'fewer'}"]`)
        ?.focus();
    };
    return h(
      'li',
      { class: 'fh-prize', dataset: { testid: `fh-prize-${i}`, verdict } },
      svg(prizePortrait(app, offer, ending), 'fh-prize__portrait'),
      h(
        'div',
        { class: 'fh-prize__text' },
        h('h3', {}, offer.name),
        h(
          'p',
          {},
          `${DESIGNS[offer.design].kind}, ${CONDITION_WORDS[offer.condition]}, ${offer.how === 'boarded' ? 'taken by boarding' : offer.how === 'yielded' ? 'she yielded' : 'struck to your guns'} · worth ${offer.value} renown`,
        ),
        h(
          'p',
          {},
          `${offer.prisoners * 10} prisoners. To bring her home she needs ${offer.need * 10} of your hands aboard: enough to sail her, and one for every six prisoners.${offer.canServe ? ` With ${offer.keep * 10} she can join your squadron.` : ''}`,
        ),
        h(
          'div',
          { class: 'fh-stepper', role: 'group', 'aria-label': `Prize crew for the ${offer.name}` },
          button('−', {
            onClick: () => step(-1),
            variant: 'chip',
            testId: `fh-prize-${i}-fewer`,
            title: 'Fewer hands',
          }),
          h(
            'output',
            { class: 'fh-stepper__value', 'aria-live': 'polite' },
            `${sent[i]! * 10} hands`,
          ),
          button('+', {
            onClick: () => step(1),
            variant: 'chip',
            testId: `fh-prize-${i}-more`,
            title: 'More hands',
            disabled: spareLeft() <= 0,
          }),
        ),
        h('p', { class: 'fh-prize__verdict', dataset: { verdict } }, VERDICT_WORDS[verdict]),
      ),
    );
  }

  function draw(): void {
    drawArt();
    body.replaceChildren();
    actions.replaceChildren();
    if (!settled) {
      put(
        body,
        mentionsList(ending),
        offers.length
          ? h(
              'section',
              { class: 'fh-after__prizes' },
              h('h2', {}, offers.length === 1 ? 'A prize' : `${offers.length} prizes`),
              h(
                'p',
                { class: 'fh-orders__small' },
                `Hands to spare for prize crews: ${spareLeft() * 10} of ${ending.outcome.spare * 10}. They will be away for the next chapter.`,
              ),
              h('ul', { class: 'fh-prizes' }, offers.map(prizeCard)),
            )
          : null,
        h(
          'p',
          { class: 'fh-after__cost' },
          ending.outcome.crewLost
            ? `${ending.outcome.crewLost * 10} of her people hurt or out of action; the surgeons and the next port will see them right.`
            : 'Not one of her people hurt.',
        ),
      );
      actions.append(
        button('Write it in the log', {
          onClick: settle,
          key: 'Enter',
          variant: 'primary',
          testId: 'fh-write-log',
          autofocus: true,
        }),
      );
      return;
    }
    const { life, record, receipt } = settled;
    const lines = record.events.map((e) => lifeEventLine(e, currentName(life)));
    put(
      body,
      mentionsList(ending),
      h(
        'section',
        { class: 'fh-after__entry', dataset: { testid: 'fh-log-entry' } },
        h('h2', {}, `Year ${record.year} in her log`),
        h(
          'p',
          {},
          `Renown ${record.renown} · ${QUALITY_NAMES[life.crew.qual]} crew${record.scars.length ? ` · ${record.scars.length} new ${record.scars.length === 1 ? 'scar' : 'scars'}` : ''}`,
        ),
        record.prizes.length
          ? h(
              'ul',
              {},
              record.prizes.map((p) =>
                h(
                  'li',
                  {},
                  `${p.name}: ${p.fate === 'squadron' ? 'joins the squadron' : p.fate === 'dockyard' ? 'brought into harbour' : p.fate === 'retaken' ? 'taken back by her prisoners on the way' : 'let go'}`,
                ),
              ),
            )
          : null,
        lines.length
          ? h(
              'ul',
              {},
              lines.map((l) => h('li', {}, l)),
            )
          : null,
        receipt.xpGained > 0
          ? h(
              'p',
              { class: 'fh-after__xp' },
              `+${receipt.xpGained} XP${receipt.rankChange ? ` · Hall rank: ${receipt.rankChange.to}` : ''}`,
            )
          : null,
      ),
    );
    const next = () =>
      life.ending ? app.go.epilogue() : life.dockyard ? app.go.dockyard() : app.go.voyage();
    actions.append(
      button(life.ending ? 'Her last page' : 'Continue the voyage', {
        onClick: next,
        key: 'R',
        variant: 'primary',
        testId: 'fh-continue',
        autofocus: true,
      }),
      button('Game menu', { onClick: () => app.go.title(), testId: 'fh-after-menu' }),
      button('Back to the Hall', {
        onClick: () => app.context.navigate('hall'),
        key: 'H',
        testId: 'fh-after-hall',
      }),
    );
    requestAnimationFrame(() => actions.querySelector<HTMLElement>('[data-autofocus]')?.focus());
  }

  function settle(): void {
    if (settled) return;
    const active = app.saves.active.load();
    if (!active) return;
    settled = settleChapter(app, active, ending.outcome, ending.battle, sent);
    app.sounds.play(ending.outcome.win ? 'won' : 'bell');
    draw();
  }

  draw();
  return {
    element,
    onKey(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      const key = event.key.toLowerCase();
      if (!settled && event.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') {
        settle();
        return true;
      }
      if (settled && key === 'r') {
        const life = settled.life;
        if (life.ending) app.go.epilogue();
        else if (life.dockyard) app.go.dockyard();
        else app.go.voyage();
        return true;
      }
      if (settled && key === 'h') {
        app.context.navigate('hall');
        return true;
      }
      return false;
    },
    onLook: () => draw(),
    focus: () =>
      actions.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }),
  };
}

function quickAftermath(app: App, ending: Ending): Screen {
  const active = app.saves.active.load();
  const result = active ? settleQuick(app, active, ending.outcome) : null;
  const o = ending.outcome;
  const mode = ending.mode;
  const again = () => {
    if (mode.kind === 'daily') app.go.briefing({ ...mode });
    else app.go.briefing(mode);
  };
  const share = () => {
    if (mode.kind !== 'daily') return;
    const cells: ShareCell[] = o.mentions.map((m) => (m.earned ? 'hit' : 'miss'));
    void app.context.share({
      title: 'Figurehead · Today’s Weather',
      daily: app.context.daily.dateKey(),
      headline: `${o.win ? 'Won' : END_HEADLINES[o.reason]} · ${(result?.score ?? 0).toLocaleString('en')}`,
      grid: [cells],
      lines: [
        `${KIND_TITLES[o.encounter.kind]} · ${o.prizes.length} ${o.prizes.length === 1 ? 'prize' : 'prizes'} · turn ${o.turns}`,
      ],
    });
  };
  const element = h(
    'section',
    { class: 'fh-screen fh-after', dataset: { testid: 'fh-aftermath' } },
    h(
      'div',
      { class: 'fh-sheet fh-sheet--wide' },
      headline(ending, ending.battle.ships[ending.battle.player]!.name),
      h(
        'div',
        { class: 'fh-after__body' },
        mentionsList(ending),
        h(
          'p',
          { class: 'fh-after__score', dataset: { testid: 'fh-after-score' } },
          h('b', {}, (result?.score ?? 0).toLocaleString('en')),
          mode.kind === 'daily' ? ' rating' : ' renown',
        ),
        o.prizes.length
          ? h(
              'p',
              {},
              `Prizes: ${o.prizes.map((p) => `${p.name} (${CONDITION_WORDS[p.condition]})`).join(', ')}.`,
            )
          : null,
        result && result.receipt.xpGained > 0
          ? h('p', { class: 'fh-after__xp' }, `+${result.receipt.xpGained} XP`)
          : null,
        mode.kind === 'daily'
          ? h(
              'p',
              { class: 'fh-orders__small' },
              'The first action of the day is the one on record; sail it again as often as you like.',
            )
          : null,
      ),
      h(
        'div',
        { class: 'fh-actions' },
        button('Play again', {
          onClick: again,
          key: 'R',
          variant: 'primary',
          testId: 'fh-again',
          autofocus: true,
        }),
        button('Game menu', { onClick: () => app.go.title(), testId: 'fh-after-menu' }),
        button('Back to the Hall', {
          onClick: () => app.context.navigate('hall'),
          key: 'H',
          testId: 'fh-after-hall',
        }),
        mode.kind === 'daily'
          ? button('Share the day', {
              onClick: share,
              key: 'S',
              variant: 'quiet',
              testId: 'fh-share',
            })
          : null,
      ),
    ),
  );
  return {
    element,
    onKey(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      const key = event.key.toLowerCase();
      if (key === 'r') again();
      else if (key === 'h') app.context.navigate('hall');
      else if (key === 's' && mode.kind === 'daily') share();
      else return false;
      return true;
    },
    focus: () =>
      element.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }),
  };
}

const rate = (v: number, max: number) => (max > 0 ? Math.max(0, Math.min(1, v / max)) : 1);
