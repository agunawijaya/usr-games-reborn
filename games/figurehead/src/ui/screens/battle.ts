import type { PauseMenuItem } from '@usr-games/kit';
import { advise, type Advice } from '../../bots/captain';
import {
  type Battle,
  type BattleEvent,
  capship,
  crewOf,
  DESIGNS,
  fireOption,
  isActive,
  type Load,
  pointOfSail,
  range,
  reachablePoses,
  type Reachable,
  relativeBearing,
  resolveTurn,
  type Ship,
  type Signal,
} from '../../engine';
import {
  abandonBattle,
  checkBattlePackages,
  encounterFor,
  outcomeOf,
  startBattle,
} from '../../game/flow';
import type { ActiveBattle, LogLine, Mode } from '../../game/saves';
import { ChartView } from '../../render/chart-view';
import { portraitSvg } from '../../render/portrait';
import { addEvents } from '../../voyage/tally';
import { currentName } from '../../voyage/life';
import type { App, Screen } from '../app';
import {
  briefingFor,
  END_HEADLINES,
  eventLine,
  HELM_PROBLEMS,
  LOAD_HELP,
  LOAD_NAMES,
  mentionLabel,
  SIGNAL_HELP,
  SIGNAL_NAMES,
  windLine,
} from '../copy';
import { confirmDialog } from '../dialog';
import { button, h, kbd, put, svg } from '../dom';
import { closeQuarters, type Draft, freshDraft, SHOTS, toOrders } from '../battle/orders';
import { windRoseSvg } from '../battle/rose';

/**
 * The battle: the chart, the turn's orders, and the film of each turn. One key can play a turn
 * (Enter takes the defaults: hold her course, fire what bears); every order has a key and a
 * button; the sailing master offers advice for those who want it.
 */

const BEARING_WORDS = [
  '',
  'dead ahead',
  'off the starboard bow',
  'on the starboard beam',
  'off the starboard quarter',
  'dead astern',
  'off the port quarter',
  'on the port beam',
  'off the port bow',
];
const QUAL_WORDS = ['', 'unruly', 'green', 'steady', 'crack', 'elite'];

export function battleScreen(app: App, mode: Mode, resume: boolean): Screen {
  const saved = resume ? app.saves.active.load() : null;
  let active: ActiveBattle = saved && sameMode(saved.mode, mode) ? saved : startBattle(app, mode);
  const encounter = encounterFor(app, mode);
  const life = mode.kind === 'voyage' ? app.saves.life.load() : null;
  const prefs = app.saves.prefs.load();
  const ownShip = encounter.ownShip;

  let reach: Reachable[] = [];
  let draft: Draft | null = null;
  let advice: Advice | null = null;
  let focus: number | null = null;
  let hover: Reachable | null = null;
  let playing = false;
  let message: string | null = null;
  let arcs: 'faint' | 'L' | 'R' = 'faint';

  const canvas = h('canvas', {
    class: 'fh-battle__chart',
    'aria-hidden': 'true',
    dataset: { testid: 'fh-chart' },
  });
  const chart = new ChartView(canvas, app.look, app.reducedMotion);
  const card = h('div', {
    class: 'fh-card fh-battle__card',
    dataset: { testid: 'fh-battle-card' },
  });
  const panel = h('aside', {
    class: 'fh-panel',
    'aria-label': 'Orders',
    dataset: { testid: 'fh-panel' },
  });
  const film = h(
    'div',
    { class: 'fh-film', hidden: true, 'aria-hidden': 'true' },
    'Playing the turn · ',
    kbd('Space'),
    ' to skip',
  );
  const banner = h('div', {
    class: 'fh-banner',
    hidden: true,
    role: 'status',
    dataset: { testid: 'fh-banner' },
  });
  const live = h('div', { class: 'fh-sr', 'aria-live': 'polite' });
  const element = h(
    'section',
    { class: 'fh-screen fh-battle', dataset: { testid: 'fh-battle', kind: encounter.kind } },
    canvas,
    card,
    panel,
    film,
    banner,
    live,
  );

  const battle = () => active.battle;
  const me = () => battle().ships[battle().player]!;
  const enemies = () =>
    battle().ships.filter(
      (sp) => isActive(sp) && capship(battle(), sp).nation !== capship(battle(), me()).nation,
    );

  function chooseFocus(): void {
    const list = enemies();
    if (focus !== null && list.some((sp) => sp.index === focus)) return;
    focus =
      list.reduce<Ship | null>(
        (best, sp) => (!best || range(me(), sp) < range(me(), best) ? sp : best),
        null,
      )?.index ?? null;
  }

  function newTurn(): void {
    const b = battle();
    reach = b.over || me().dir === 0 ? [] : reachablePoses(b, me());
    draft = b.over ? null : freshDraft(b, reach, draft);
    advice = !b.over && prefs.advice ? advise(b, 'gunner') : null;
    message = null;
    chooseFocus();
    syncChart();
    render();
  }

  function chosenPose(): Reachable | null {
    return draft ? (reach.find((r) => r.helm === draft!.helm) ?? null) : null;
  }

  function syncChart(): void {
    chart.show(battle(), { night: encounter.night, ownShip });
    const target = focus !== null ? battle().ships[focus] : undefined;
    chart.setOverlays({
      reach: playing ? [] : reach,
      chosen: playing ? null : chosenPose(),
      hover: playing ? null : hover,
      fan:
        !playing && target && target.dir
          ? { ship: target.index, poses: reachablePoses(battle(), target) }
          : null,
      arcs: playing ? 'none' : arcs,
      focus,
    });
  }

  // --- the orders panel ------------------------------------------------------------------

  function meter(label: string, value: number, max: number, testId?: string): HTMLElement {
    const share = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
    return h(
      'div',
      {
        class: 'fh-meter',
        dataset: {
          level: share > 0.6 ? 'good' : share > 0.3 ? 'warn' : 'bad',
          ...(testId ? { testid: testId } : {}),
        },
      },
      h('span', { class: 'fh-meter__label' }, label),
      h(
        'span',
        { class: 'fh-meter__bar' },
        h('span', { style: `width:${(share * 100).toFixed(0)}%` }),
      ),
      h('span', { class: 'fh-meter__value' }, `${value}/${max}`),
    );
  }

  function shipHeader(): HTMLElement {
    const sp = me();
    const name = encounter.aboard ?? (life ? currentName(life) : sp.name);
    const portrait = portraitSvg({
      look: app.look,
      design: sp.design,
      nation: sp.nation,
      figurehead: life && !encounter.aboard ? life.figurehead : null,
      sails: sp.FS ? 'full' : 'battle',
      rig: [
        share(sp.specs.rig1, sp.max.rig1),
        share(sp.specs.rig2, sp.max.rig2),
        share(sp.specs.rig3, sp.max.rig3),
        sp.max.rig4 > 0 ? share(sp.specs.rig4, sp.max.rig4) : 1,
      ],
      hull: share(sp.specs.hull, sp.max.hull),
      scars: life && !encounter.aboard ? life.scars : [],
      refits: life?.refits ?? [],
      struck: sp.struck,
      burning: sp.explode === 1,
      seed: 7,
      water: 'sea',
      label: `${name}, as she is now`,
    });
    return h(
      'header',
      { class: 'fh-panel__ship' },
      svg(portrait, 'fh-panel__portrait'),
      h(
        'div',
        { class: 'fh-panel__name' },
        h('h2', {}, name),
        h('p', {}, `${DESIGNS[sp.design].kind} · ${QUAL_WORDS[sp.specs.qual]} crew`),
      ),
    );
  }

  function condition(): HTMLElement {
    const sp = me();
    const s = sp.specs;
    const m = sp.max;
    return h(
      'div',
      { class: 'fh-condition' },
      meter('Hull', s.hull, m.hull, 'fh-hull'),
      meter('Hands', crewOf(sp), sp.startCrew),
      meter(
        'Rigging',
        Math.max(0, s.rig1) + Math.max(0, s.rig2) + Math.max(0, s.rig3) + Math.max(0, s.rig4),
        Math.max(0, m.rig1) + Math.max(0, m.rig2) + Math.max(0, m.rig3) + Math.max(0, m.rig4),
      ),
      meter('Guns', s.gunL + s.gunR + s.carL + s.carR, m.gunL + m.gunR + m.carL + m.carR),
    );
  }

  function helmSection(): HTMLElement {
    const d = draft!;
    const pose = chosenPose();
    const sp = me();
    const words = describeHelm(d.helm);
    const steer = (helm: string) => {
      d.helm = helm;
      app.sounds.play('helm');
      update();
    };
    const extend = (ch: string) => steer(d.helm + ch);
    const head = pose
      ? pointOfSail(battle().winddir, pose.dir)
      : pointOfSail(battle().winddir, sp.dir);
    return h(
      'section',
      { class: 'fh-orders__block', 'aria-label': 'Helm' },
      h('h3', {}, 'Helm', h('span', { class: 'fh-orders__hint' }, `${pointOfSailWord(head)}`)),
      h(
        'p',
        { class: 'fh-helm__line', dataset: { testid: 'fh-helm' } },
        h('b', {}, d.helm || 'hold'),
        ` · ${words}`,
      ),
      message ? h('p', { class: 'fh-helm__problem', role: 'status' }, message) : null,
      h(
        'div',
        { class: 'fh-helm__keys' },
        button('⟲ Port', {
          onClick: () => extend('l'),
          key: 'Q',
          variant: 'chip',
          testId: 'fh-helm-port',
          title: 'Turn to port',
        }),
        ...[1, 2, 3, 4, 5, 6, 7].map((n) =>
          button(String(n), {
            onClick: () => extend(String(n)),
            variant: 'chip',
            title: `Sail ${n} ahead`,
          }),
        ),
        button('Starboard ⟳', {
          onClick: () => extend('r'),
          key: 'E',
          variant: 'chip',
          testId: 'fh-helm-starboard',
          title: 'Turn to starboard',
        }),
      ),
      h(
        'div',
        { class: 'fh-helm__keys' },
        button('Undo', { onClick: () => steer(d.helm.slice(0, -1)), key: '⌫', variant: 'chip' }),
        button('Hold', {
          onClick: () => steer(''),
          key: 'H',
          variant: 'chip',
          testId: 'fh-helm-hold',
        }),
        button(d.sails === 'full' ? 'Full sail' : 'Battle sail', {
          onClick: () => {
            d.sails = d.sails === 'full' ? 'battle' : 'full';
            update();
          },
          key: 'S',
          variant: 'chip',
          pressed: d.sails === 'full',
          testId: 'fh-sails',
          title: 'Full sail is faster; battle sail keeps canvas out of harm',
        }),
      ),
      h(
        'p',
        { class: 'fh-orders__small' },
        'Or pick a dot on the chart: each is a square she can end the turn on.',
      ),
    );
  }

  function batteryCard(side: 'L' | 'R'): HTMLElement {
    const d = draft!;
    const sp = me();
    const option = fireOption(battle(), sp, side);
    const load = side === 'L' ? sp.loadL : sp.loadR;
    const ready = side === 'L' ? sp.readyL : sp.readyR;
    const sideName = side === 'L' ? 'Port' : 'Starboard';
    let status: string;
    if (option.ok) {
      const t = battle().ships[option.target]!;
      status = `${t.name} at ${option.range}${option.reckoning.rake ? (option.reckoning.sternRake ? ' · stern rake!' : ' · rake!') : ''}${option.friendly ? ' · a friend!' : ''}`;
    } else if (option.why === 'not-loaded') status = load ? 'loading…' : 'empty';
    else if (option.why === 'nothing-bears') status = 'nothing bears';
    else if (option.why === 'out-of-range')
      status = `${battle().ships[option.target!]?.name ?? 'target'} out of reach (${option.range})`;
    else if (option.why === 'struck') status = 'her target has struck';
    else status = 'no gun crews';
    const strength = option.ok ? option.reckoning.hit : null;
    const firing = d.fire[side] && option.ok;
    return h(
      'div',
      {
        class: `fh-battery${firing ? ' is-firing' : ''}`,
        dataset: { testid: `fh-battery-${side}` },
        onmouseenter: () => {
          arcs = side;
          syncChart();
        },
        onmouseleave: () => {
          arcs = 'faint';
          syncChart();
        },
      },
      h(
        'h4',
        {},
        sideName,
        h(
          'span',
          { class: 'fh-battery__load' },
          `${LOAD_NAMES[load]} · ${load ? (ready & 1 ? 'loading' : 'ready') : 'empty'}`,
        ),
      ),
      h('p', { class: 'fh-battery__status' }, status),
      strength !== null ? h('p', { class: 'fh-battery__strength' }, strengthWords(strength)) : null,
      h(
        'div',
        { class: 'fh-battery__row' },
        button(firing ? 'Firing' : 'Fire', {
          onClick: () => {
            d.fire[side] = !d.fire[side];
            update();
          },
          key: side === 'L' ? 'A' : 'D',
          variant: 'chip',
          pressed: firing,
          disabled: !option.ok,
          testId: `fh-fire-${side}`,
        }),
        button(d.aim[side] === 'hull' ? 'At her hull' : 'At her rigging', {
          onClick: () => {
            d.aim[side] = d.aim[side] === 'hull' ? 'rigging' : 'hull';
            update();
          },
          key: 'W',
          variant: 'chip',
          disabled: !option.ok || !option.canAimHull,
          title: 'Hull shots need round or double shot inside six squares',
        }),
      ),
      h('label', { class: 'fh-battery__reload' }, 'Reload with ', reloadSelect(side)),
    );
  }

  function reloadSelect(side: 'L' | 'R'): HTMLSelectElement {
    const d = draft!;
    const select = h(
      'select',
      {
        dataset: { testid: `fh-reload-${side}` },
        onchange: (e: Event) => {
          d.reload[side] = Number((e.target as HTMLSelectElement).value) as Load;
          update();
        },
      },
      ...SHOTS.map((shot) =>
        h(
          'option',
          { value: String(shot), selected: d.reload[side] === shot, title: LOAD_HELP[shot] },
          LOAD_NAMES[shot],
        ),
      ),
    );
    return select;
  }

  function closeSection(): HTMLElement | null {
    const d = draft!;
    const q = closeQuarters(battle());
    if (!q.grapple.length && !q.board.length && !q.fouled.length) return null;
    const rows: HTMLElement[] = [];
    for (const g of q.grapple) {
      const name = battle().ships[g.target]!.name;
      const on = d.grapple?.target === g.target;
      rows.push(
        button(g.action === 'grapple' ? `Grapple ${name}` : `Cast off ${name}`, {
          onClick: () => {
            d.grapple = on ? null : g;
            update();
          },
          key: 'G',
          variant: 'chip',
          pressed: on,
          testId: 'fh-grapple',
        }),
      );
    }
    for (const target of q.board) {
      const name = battle().ships[target]!.name;
      const sections = d.board?.target === target ? d.board.sections : 0;
      rows.push(
        button(sections ? `Board ${name}: ${sections} of 3 sections` : `Board ${name}`, {
          onClick: () => {
            const next = (sections + 1) % 4;
            d.board = next ? { target, sections: next } : null;
            update();
          },
          key: 'B',
          variant: 'chip',
          pressed: sections > 0,
          testId: 'fh-board',
        }),
      );
    }
    for (const target of q.fouled) {
      const on = d.unfoul === target;
      rows.push(
        button(`Cut free of ${battle().ships[target]!.name}`, {
          onClick: () => {
            d.unfoul = on ? null : target;
            update();
          },
          variant: 'chip',
          pressed: on,
        }),
      );
    }
    rows.push(
      button(d.repel ? `Keep ${d.repel} back to repel` : 'Keep hands back to repel', {
        onClick: () => {
          d.repel = (d.repel + 1) % 4;
          update();
        },
        key: 'V',
        variant: 'chip',
        pressed: d.repel > 0,
      }),
    );
    return h(
      'section',
      { class: 'fh-orders__block', 'aria-label': 'Close action' },
      h('h3', {}, 'Close action'),
      h('div', { class: 'fh-chips' }, rows),
    );
  }

  function extraSection(): HTMLElement {
    const d = draft!;
    const squadron = battle().ships.some(
      (sp) =>
        sp !== me() &&
        sp.nation === me().nation &&
        sp.role !== 'merchant' &&
        sp.index !== ownShip &&
        sp.dir !== 0,
    );
    const repairs = (['hull', 'guns', 'rigging'] as const).map((kind) =>
      button(kind[0]!.toUpperCase() + kind.slice(1), {
        onClick: () => {
          d.repair = d.repair === kind ? null : kind;
          update();
        },
        variant: 'chip',
        pressed: d.repair === kind,
        title: 'All hands to repairs: no firing, loading, turning or setting sail this turn',
      }),
    );
    return h(
      'section',
      { class: 'fh-orders__block fh-orders__block--row' },
      h(
        'div',
        {},
        h('h3', {}, 'Repairs', h('span', { class: 'fh-orders__hint' }, 'all hands')),
        h('div', { class: 'fh-chips' }, repairs),
      ),
      squadron
        ? h(
            'div',
            { dataset: { testid: 'fh-signals' } },
            h('h3', {}, 'Signal', h('span', { class: 'fh-orders__hint' }, 'K')),
            h(
              'div',
              { class: 'fh-chips' },
              (['engage', 'follow', 'holdoff'] as Signal[]).map((signal) =>
                button(SIGNAL_NAMES[signal], {
                  onClick: () => {
                    d.signal = signal;
                    update();
                  },
                  variant: 'chip',
                  pressed: d.signal === signal,
                  title: SIGNAL_HELP[signal],
                }),
              ),
            ),
          )
        : null,
    );
  }

  function adviceLine(): HTMLElement | null {
    if (!advice) return null;
    const o = advice.orders;
    const parts = [
      o.helm && o.helm !== 'd' ? `steer ${o.helm}` : 'hold her course',
      o.fire?.L ? `fire to port at her ${o.fire.L}` : '',
      o.fire?.R ? `fire to starboard at her ${o.fire.R}` : '',
      o.board ? 'board her' : '',
      o.grapple?.[0]?.action === 'grapple' ? 'grapple' : '',
    ].filter(Boolean);
    return h(
      'div',
      { class: 'fh-advice', dataset: { testid: 'fh-advice' } },
      h('p', {}, h('b', {}, 'Sailing master: '), `${parts.join(', ')}.`),
      button('Take it', {
        onClick: takeAdvice,
        key: 'M',
        variant: 'chip',
        testId: 'fh-take-advice',
      }),
    );
  }

  function enemyCard(): HTMLElement | null {
    const b = battle();
    const target = focus !== null ? b.ships[focus] : undefined;
    if (!target || !target.dir) return null;
    return h(
      'section',
      { class: 'fh-enemy', dataset: { testid: 'fh-enemy' } },
      h(
        'p',
        {},
        h('b', {}, target.name),
        ` · ${DESIGNS[target.design].kind}, ${QUAL_WORDS[capship(b, target).specs.qual]} crew · ${range(me(), target)} squares ${BEARING_WORDS[relativeBearing(me(), target)]}`,
      ),
      h(
        'p',
        { class: 'fh-orders__small' },
        `Hull ${pct(target.specs.hull, target.max.hull)} · hands ${pct(crewOf(target), target.startCrew)} · the red squares are where she could be after this turn · `,
        kbd('Tab'),
        ' next',
      ),
    );
  }

  function render(): void {
    renderCard();
    panel.replaceChildren();
    if (!draft || battle().over) {
      panel.append(shipHeader(), condition());
      return;
    }
    put(
      panel,
      shipHeader(),
      condition(),
      enemyCard(),
      h(
        'div',
        { class: 'fh-orders' },
        helmSection(),
        h(
          'section',
          { class: 'fh-orders__block fh-batteries', 'aria-label': 'Broadsides' },
          batteryCard('L'),
          batteryCard('R'),
        ),
        closeSection(),
        extraSection(),
        adviceLine(),
      ),
      h(
        'footer',
        { class: 'fh-panel__go' },
        button('Make it so', {
          onClick: makeItSo,
          key: 'Enter',
          variant: 'primary',
          testId: 'fh-make-it-so',
          disabled: playing,
        }),
        button('Strike the flag', {
          onClick: () => void strikeFlag(),
          variant: 'ghost',
          testId: 'fh-strike',
          title: 'Give up the ship to save her people',
        }),
      ),
    );
  }

  function renderCard(): void {
    const b = battle();
    const brief = briefingFor(encounter.kind, {
      ship: life ? currentName(life) : me().name,
      foe: encounter.foe,
      year: 0,
      aboard: encounter.aboard,
    });
    card.replaceChildren();
    put(
      card,
      h(
        'p',
        { class: 'fh-kicker' },
        mode.kind === 'daily'
          ? `Today’s Weather #${mode.number}`
          : mode.kind === 'open'
            ? 'Open water'
            : `Year ${life?.plan[life.next]?.year ?? ''} · chapter ${(life?.records.length ?? 0) + 1}`,
      ),
      h('h1', { class: 'fh-card__title' }, brief.title),
      h(
        'p',
        { class: 'fh-card__turn', dataset: { testid: 'fh-turn' } },
        `Turn ${b.turn + 1} of ${b.maxTurns} · ${windLine(b)}`,
      ),
      svg(windRoseSvg(b, me().dir ? me() : null), 'fh-card__rose'),
      h(
        'ul',
        { class: 'fh-card__mentions' },
        encounter.mentions.map((m) => h('li', {}, mentionLabel(m.id, m.turns, encounter.kind))),
      ),
    );
  }

  // --- playing a turn ---------------------------------------------------------------------

  function makeItSo(): void {
    if (playing || !draft || battle().over) return;
    const before = battle();
    const orders = toOrders(before, draft);
    const result = resolveTurn(before, orders);
    const problems = result.events.find((e) => e.t === 'helm' && e.ship === before.player);
    if (problems && problems.t === 'helm' && problems.problems.length)
      message = HELM_PROBLEMS[problems.problems[0]!];
    const tally = addEvents(active.tally, result.battle, result.events);
    const lines = linesFor(result.events, result.battle, result.battle.turn);
    active = { ...active, battle: result.battle, tally, log: [...active.log, ...lines].slice(-40) };
    app.saves.active.save(active);
    checkBattlePackages(app, tally);
    playing = true;
    film.hidden = false;
    hover = null;
    syncChart();
    render();
    const replyAt = (app.reducedMotion ? 250 : 650) + (app.reducedMotion ? 300 : 900);
    app.sounds.forTurn(result.events, before.player, replyAt);
    live.textContent = lines
      .slice(-3)
      .map((l) => l.text)
      .join(' ');
    chart.play(before, result.battle, result.events, () => {
      playing = false;
      film.hidden = true;
      if (result.battle.over) showEnd();
      else newTurn();
    });
  }

  function linesFor(events: readonly BattleEvent[], after: Battle, turn: number): LogLine[] {
    const out: LogLine[] = [];
    for (const e of events) {
      const line = eventLine(e, after);
      if (line) out.push({ turn, ...line });
    }
    return out;
  }

  function takeAdvice(): void {
    if (!advice || !draft) return;
    const o = advice.orders;
    draft.helm = o.helm === 'd' ? '' : (o.helm ?? '');
    draft.fire = { L: Boolean(o.fire?.L), R: Boolean(o.fire?.R) };
    if (o.fire?.L) draft.aim.L = o.fire.L;
    if (o.fire?.R) draft.aim.R = o.fire.R;
    if (o.load?.L) draft.reload.L = o.load.L;
    if (o.load?.R) draft.reload.R = o.load.R;
    if (o.sails) draft.sails = o.sails;
    draft.grapple = o.grapple?.[0] ?? null;
    draft.board = o.board?.[0] ?? null;
    update();
  }

  async function strikeFlag(): Promise<void> {
    if (playing || !draft) return;
    const ok = await confirmDialog(element, {
      title: 'Strike the flag?',
      text: 'She will be taken, and her people spared. Ships are taken back.',
      yes: 'Strike',
      testId: 'fh-confirm-strike',
    });
    if (!ok || battle().over) return;
    const before = battle();
    const result = resolveTurn(before, { strike: true });
    active = {
      ...active,
      battle: result.battle,
      tally: addEvents(active.tally, result.battle, result.events),
    };
    app.saves.active.save(active);
    newTurn();
    showEnd();
  }

  function showEnd(): void {
    const end = battle().end!;
    banner.hidden = false;
    banner.dataset.win = String(end.win);
    banner.replaceChildren(
      h('h2', {}, END_HEADLINES[end.reason]),
      button(mode.kind === 'voyage' ? 'To the log' : 'The reckoning', {
        onClick: finish,
        key: 'Enter',
        variant: 'primary',
        testId: 'fh-to-report',
        autofocus: true,
      }),
    );
    app.sounds.play(end.win ? 'won' : end.win === false ? 'sombre' : 'strike');
    render();
    requestAnimationFrame(() => banner.querySelector<HTMLElement>('[data-autofocus]')?.focus());
  }

  function finish(): void {
    const outcome = outcomeOf(app, active);
    app.go.aftermath({
      mode,
      outcome,
      battle: battle(),
      durationSeconds: Math.round((Date.now() - active.startedAt) / 1000),
    });
  }

  function update(): void {
    syncChart();
    render();
  }

  // --- the chart under the pointer -------------------------------------------------------

  let drag: { x: number; y: number; moved: boolean } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (drag.moved || Math.hypot(dx, dy) > 5) {
        drag.moved = true;
        chart.panBy(dx, dy);
        drag.x = e.clientX;
        drag.y = e.clientY;
      }
      return;
    }
    if (playing) return;
    const pick = chart.pick(e.clientX, e.clientY);
    const next = pick?.kind === 'pose' ? pick.pose : null;
    if (next !== hover) {
      hover = next;
      canvas.style.cursor = next || pick?.kind === 'ship' ? 'pointer' : 'grab';
      syncChart();
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    const wasDrag = drag?.moved;
    drag = null;
    if (wasDrag || playing || !draft) return;
    const pick = chart.pick(e.clientX, e.clientY);
    if (pick?.kind === 'pose') {
      const pose = pick.pose;
      if (!pose.offChart) {
        draft.helm = pose.helm;
        app.sounds.play('helm');
        update();
        return;
      }
      void confirmDialog(element, {
        title: 'Leave the chart?',
        text: 'That course takes her off the chart and out of the action.',
        yes: 'Sail it',
      }).then((ok) => {
        if (ok && draft) {
          draft.helm = pose.helm;
          update();
        }
      });
    } else if (pick?.kind === 'ship' && pick.index !== battle().player) {
      focus = pick.index;
      update();
    }
  });
  canvas.addEventListener('dblclick', () => chart.recentre());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    chart.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, { x: e.offsetX, y: e.offsetY });
  });

  const layout = () => {
    const rect = element.getBoundingClientRect();
    const panelWidth = panel.getBoundingClientRect().width;
    const cardWidth = card.getBoundingClientRect().width;
    const narrow = rect.width < 760;
    // Frame the action in the open water between the chapter card and the orders panel.
    const left = narrow ? 0 : cardWidth + 24;
    chart.resize(rect.width, rect.height, {
      x: left,
      y: narrow ? card.getBoundingClientRect().height + 16 : 0,
      w: narrow ? rect.width : Math.max(200, rect.width - panelWidth - 28 - left),
      h: narrow ? rect.height * 0.5 : rect.height,
    });
  };
  const observer = new ResizeObserver(layout);
  observer.observe(element);

  const pauseItems: PauseMenuItem[] = [
    mode.kind === 'voyage'
      ? {
          id: 'break-off',
          label: 'Break off the action',
          run: async () => {
            const ok = await confirmDialog(element, {
              title: 'Break off the action?',
              text: 'It goes into her log as a fight left unfinished.',
              yes: 'Break off',
            });
            if (!ok) return;
            active = {
              ...active,
              battle: { ...battle(), over: true, end: { reason: 'withdrew', win: null } },
            };
            app.saves.active.save(active);
            finish();
          },
        }
      : {
          id: 'abandon',
          label: 'Abandon this battle',
          run: async () => {
            const ok = await confirmDialog(element, {
              title: 'Abandon this battle?',
              text: 'It will not be kept.',
              yes: 'Abandon',
            });
            if (!ok) return;
            abandonBattle(app, active);
            app.go.title();
          },
        },
  ];

  if (battle().over) {
    syncChart();
    render();
    showEnd();
  } else newTurn();
  app.sounds.startWind();

  // Development only: play turns at once with the sailing master's orders, for tests and shots.
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __figureheadAutopilot(turns = 999, style: 'gunner' | 'seaman' = 'gunner') {
        for (let i = 0; i < turns && !battle().over; i++) {
          const result = resolveTurn(battle(), advise(battle(), style).orders);
          const tally = addEvents(active.tally, result.battle, result.events);
          active = {
            ...active,
            battle: result.battle,
            tally,
            log: [
              ...active.log,
              ...linesFor(result.events, result.battle, result.battle.turn),
            ].slice(-40),
          };
        }
        app.saves.active.save(active);
        if (battle().over) {
          syncChart();
          showEnd();
        } else newTurn();
        return { turn: battle().turn, over: battle().over, end: battle().end };
      },
    });
  }

  return {
    element,
    pauseItems,
    onKey(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      const key = event.key;
      if (playing) {
        if (key === ' ' || key === 'Enter' || key === 'Escape') {
          if (key === 'Escape') return false;
          chart.skip();
          return true;
        }
        return false;
      }
      if (!banner.hidden) {
        if (key === 'Enter') {
          finish();
          return true;
        }
        return false;
      }
      if (!draft) return false;
      const d = draft;
      const lower = key.toLowerCase();
      if (key === 'Enter') makeItSo();
      else if (key === '[' || lower === 'q') d.helm += 'l';
      else if (key === ']' || lower === 'e') d.helm += 'r';
      else if (/^[1-7]$/.test(key)) d.helm += key;
      else if (key === 'Backspace') d.helm = d.helm.slice(0, -1);
      else if (key === '0' || lower === 'h') d.helm = '';
      else if (lower === 'a') d.fire.L = !d.fire.L && fireOption(battle(), me(), 'L').ok;
      else if (lower === 'd') d.fire.R = !d.fire.R && fireOption(battle(), me(), 'R').ok;
      else if (lower === 'w') {
        const next = d.aim.L === 'hull' ? 'rigging' : 'hull';
        d.aim = { L: next, R: next };
      } else if (lower === 'z' || lower === 'c') {
        const side = lower === 'z' ? 'L' : 'R';
        d.reload[side] = SHOTS[(SHOTS.indexOf(d.reload[side]) + 1) % SHOTS.length]!;
      } else if (lower === 's') d.sails = d.sails === 'full' ? 'battle' : 'full';
      else if (lower === 'm') takeAdvice();
      else if (lower === 'g') {
        const g = closeQuarters(battle()).grapple[0];
        d.grapple = d.grapple ? null : (g ?? null);
      } else if (lower === 'b') {
        const target = closeQuarters(battle()).board[0];
        if (target !== undefined) {
          const next = ((d.board?.sections ?? 0) + 1) % 4;
          d.board = next ? { target, sections: next } : null;
        }
      } else if (lower === 'v') d.repel = (d.repel + 1) % 4;
      else if (lower === 'k') {
        const order: Signal[] = ['engage', 'follow', 'holdoff'];
        d.signal = order[(order.indexOf(d.signal) + 1) % 3]!;
      } else if (key === 'Tab') {
        const list = enemies();
        if (!list.length) return false;
        const i = list.findIndex((sp) => sp.index === focus);
        focus = list[(i + (event.shiftKey ? list.length - 1 : 1)) % list.length]!.index;
      } else if (key === '+' || key === '=') chart.zoomBy(1.15);
      else if (key === '-') chart.zoomBy(1 / 1.15);
      else if (lower === 'f') chart.recentre();
      else return false;
      if (/^[qe1-7[\]]$/i.test(key) || key === 'Backspace' || key === '0' || lower === 'h')
        app.sounds.play('tick');
      update();
      return true;
    },
    onLook(look, reduced) {
      chart.setLook(look, reduced);
      render();
    },
    onPause: () => chart.setVisible(false),
    onResume: () => chart.setVisible(true),
    focus: () =>
      panel
        .querySelector<HTMLElement>('[data-testid="fh-make-it-so"]')
        ?.focus({ preventScroll: true }),
    destroy() {
      observer.disconnect();
      chart.destroy();
      app.sounds.stopWind();
    },
  };
}

function sameMode(a: Mode, b: Mode): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'voyage' && b.kind === 'voyage') return a.option.seed === b.option.seed;
  if (a.kind === 'daily' && b.kind === 'daily') return a.dateKey === b.dateKey;
  return true;
}

const share = (v: number, max: number) => (max > 0 ? Math.max(0, Math.min(1, v / max)) : 1);
const pct = (v: number, max: number) => `${Math.round(share(v, max) * 100)}%`;

function describeHelm(helm: string): string {
  if (!helm) return 'hold her where she is';
  const words: string[] = [];
  for (const ch of helm) {
    if (ch === 'l') words.push('turn to port');
    else if (ch === 'r') words.push('turn to starboard');
    else words.push(`${ch} ahead`);
  }
  return words.join(', ');
}

function pointOfSailWord(p: string): string {
  return p === 'in irons' ? 'in irons: the wind is dead ahead' : `${p}`;
}

/** The hit number as a gunner would put it. */
function strengthWords(hit: number): string {
  if (hit >= 7) return 'A murderous broadside';
  if (hit >= 4) return 'A heavy broadside';
  if (hit >= 2) return 'A fair broadside';
  if (hit >= 0) return 'A light broadside';
  return 'Likely to fall short';
}
