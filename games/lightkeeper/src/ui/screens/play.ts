import { worldName } from '../../data/worlds';
import { botOrder } from '../../engine/bot';
import type { Beat } from '../../engine/beats';
import {
  automaticBeamsAvailable,
  hailChance,
  harbourIsNear,
  maxDrive,
  type Order,
} from '../../engine/orders';
import {
  clearCourseTo,
  courseTo,
  driveCost,
  knownCalls,
  plotCourse,
  previewBeams,
  previewFlare,
  suggestedBeamEnergy,
  sureStopEnergy,
  systemsDown,
  thrusterCost,
} from '../../engine/preview';
import type { Point, SystemId } from '../../engine/types';
import type { WatchKind } from '../../game/saves';
import { type OrderOutcome, WatchSession } from '../../game/session';
import { ChartView } from '../../render/chart-view';
import { ZoneView } from '../../render/zone-view';
import type { App, Screen } from '../app';
import { days, type LogLine, power, SYSTEM_DOWN, SYSTEM_NAMES, zoneLabel } from '../copy';
import { button, h } from '../dom';
import { coachTip } from './coach';
import { statusBar } from './status';

/**
 * A watch in progress. The zone on the left is where orders are aimed; the chart on the right
 * is the whole Reach with its lights and calls; the log and the dock sit beside and below.
 * Every order goes through the session; the views only animate what it reports.
 */

type Mode = 'helm' | 'flare' | 'hail' | 'sweep';
type Sheet = 'beams' | 'rest' | 'more' | null;

export function playScreen(app: App, watch: WatchKind, resume: boolean): Screen {
  const hooks = {
    install: (id: string) => app.install(id),
    report: (result: Parameters<App['report']>[0]) => app.report(result),
    dateKey: () => app.context.daily.dateKey(),
    daySeed: () => app.context.daily.seed(),
  };
  let session: WatchSession;
  let openingBeats: Beat[] = [];
  const resumed = resume ? WatchSession.resume(app.saves, hooks) : null;
  if (resumed) session = resumed;
  else {
    const begun = WatchSession.begin(watch, app.saves, hooks);
    session = begun.session;
    openingBeats = begun.beats;
  }
  const prefs = app.saves.prefs.load();
  let coachOn = prefs.coach;

  // ---- Layout -------------------------------------------------------------------------
  const status = statusBar();
  const zoneCanvas = h('canvas', {
    class: 'lk-zone__canvas',
    tabindex: '0',
    role: 'application',
    'aria-label': 'The ship’s zone. Arrow keys move the cursor; Enter carries out the order.',
    dataset: { testid: 'lk-zone' },
  });
  const zoneTitle = h('h2', { class: 'lk-zone__title' });
  const zoneFacts = h('p', { class: 'lk-zone__facts' });
  const modeHint = h('p', { class: 'lk-zone__mode', dataset: { testid: 'lk-mode' } });
  const tip = h('div', {
    class: 'lk-tip',
    role: 'status',
    'aria-live': 'polite',
    dataset: { testid: 'lk-tip' },
  });
  const coach = h('div', { class: 'lk-coach', dataset: { testid: 'lk-coach' } });
  const sheet = h('div', { class: 'lk-sheet', hidden: true, dataset: { testid: 'lk-sheet' } });
  const zonePanel = h(
    'section',
    { class: 'lk-zone', 'aria-label': 'Zone' },
    h('div', { class: 'lk-zone__stage' }, zoneCanvas),
    h(
      'div',
      { class: 'lk-zone__info' },
      h('div', { class: 'lk-zone__head' }, zoneTitle, zoneFacts),
      modeHint,
      tip,
      coach,
      sheet,
    ),
  );
  const chartCanvas = h('canvas', {
    class: 'lk-chart__canvas',
    tabindex: '0',
    role: 'application',
    'aria-label': 'The chart of the Reach. Arrow keys pick a zone; Enter jumps there.',
    dataset: { testid: 'lk-chart' },
  });
  const chartTip = h('div', { class: 'lk-chart__tip', dataset: { testid: 'lk-chart-tip' } });
  const calls = h('ul', {
    class: 'lk-calls',
    'aria-label': 'Calls',
    dataset: { testid: 'lk-calls' },
  });
  const systems = h('div', { class: 'lk-systems', dataset: { testid: 'lk-systems' } });
  const log = h('ol', {
    class: 'lk-log',
    'aria-live': 'polite',
    'aria-label': 'Log',
    dataset: { testid: 'lk-log' },
  });
  const side = h(
    'aside',
    { class: 'lk-side' },
    h(
      'div',
      { class: 'lk-chart' },
      h('h2', { class: 'lk-side__title' }, 'The Reach'),
      h('div', { class: 'lk-chart__stage' }, chartCanvas),
      chartTip,
    ),
    h('div', { class: 'lk-side__lists' }, calls, systems),
    log,
  );
  const dock = h('footer', { class: 'lk-dock', 'aria-label': 'Orders' });
  const element = h(
    'section',
    { class: 'lk-screen lk-play', dataset: { testid: 'lk-play' } },
    status.element,
    zonePanel,
    side,
    dock,
  );

  const zoneView = new ZoneView(zoneCanvas, app.look, app.reducedMotion);
  const chartView = new ChartView(chartCanvas, app.look, app.reducedMotion);
  zoneView.pace = prefs.pace === 'brisk' ? 0.6 : 1;
  zoneView.show(session.state);
  chartView.show(session.state);
  zoneView.start();
  chartView.start();

  let mode: Mode = 'helm';
  let openSheet: Sheet = null;
  let zoneCursor: Point = { ...session.state.ship.cell };
  let chartCursor: Point = { ...session.state.ship.zone };
  let hoverCell: Point | null = null;
  let hoverZone: Point | null = null;
  let armed: string | null = null;
  let beamEnergy = 0;
  let endTimer = 0;
  let animationTimer = 0;

  const state = () => session.state;
  const isDown = (system: SystemId) => systemsDown(state()).some((d) => d.system === system);
  const computerUp = () => !isDown('computer') || state().ship.condition === 'moored';

  // ---- Orders -------------------------------------------------------------------------
  function issue(order: Order) {
    if (session.over) return;
    if (zoneView.busy) finishAnimation();
    armed = null;
    const outcome = session.issue(order);
    if (!outcome.accepted) {
      app.sounds.play('refused');
      showTip(outcome.lines[0]?.text ?? 'That order cannot be carried out.', 'warn');
      return;
    }
    playOutcome(outcome);
  }

  function playOutcome(outcome: OrderOutcome) {
    const speed = (app.reducedMotion ? 0.45 : 1) * zoneView.pace;
    const duration = zoneView.play(outcome.prev, outcome.state, outcome.beats);
    chartView.play(outcome.prev, outcome.state, outcome.beats);
    app.sounds.forBeats(outcome.beats, speed);
    appendLog(outcome.lines);
    const stretched = outcome.beats.some((b) => b.type === 'clock' && b.after > b.before);
    status.update(outcome.state, stretched);
    if (!samePoint(outcome.prev.ship.zone, outcome.state.ship.zone)) {
      zoneCursor = { ...outcome.state.ship.cell };
      chartCursor = { ...outcome.state.ship.zone };
    }
    mode = 'helm';
    closeSheet();
    window.clearTimeout(animationTimer);
    animationTimer = window.setTimeout(() => refreshAll(), duration * 1000 + 30);
    refreshAll();
    if (session.over) {
      window.clearTimeout(endTimer);
      endTimer = window.setTimeout(finishWatch, duration * 1000 + (app.reducedMotion ? 300 : 900));
    }
  }

  function finishAnimation() {
    zoneView.skip(state());
    chartView.show(state());
  }

  function finishWatch() {
    app.go.results({
      watch: session.watch,
      state: session.state,
      promoted: session.promoted,
      receipt: session.receipt,
      log: session.log,
    });
  }

  // ---- Previews -----------------------------------------------------------------------
  function describeCell(at: Point): string {
    const s = state();
    const content = s.cells[at.row]![at.col]!;
    const cell = `${at.row}·${at.col}`;
    switch (content) {
      case 'gleaner': {
        const g = s.gleaners.find((x) => x.row === at.row && x.col === at.col);
        return g
          ? `Gleaner at ${cell}: charge ${power(g.power)} of ${power(s.params.gleanerPower)}, ${g.dist.toFixed(1)} cells away.`
          : `Gleaner at ${cell}.`;
      }
      case 'star':
        return `A star at ${cell}. A flare may set it off, and everything beside it.`;
      case 'hole':
        return `A black hole at ${cell}. Fly into it and you come out anywhere.`;
      case 'world':
        return `${worldName(s.zones[s.ship.zone.row]![s.ship.zone.col]!.world)} at ${cell}.`;
      case 'harbour':
        return `The harbour at ${cell}. Move beside it, then moor (M).`;
      case 'lantern':
      case 'ember':
        return `The ${content === 'ember' ? 'Ember' : 'Lantern'}, at ${cell}.`;
      default:
        return `Cell ${cell}, empty.`;
    }
  }

  function previewCell(at: Point | null) {
    const s = state();
    if (openSheet === 'beams') return;
    zoneView.overlay = { kind: 'none' };
    if (!at || session.over) {
      hideTip();
      return;
    }
    const content = s.cells[at.row]![at.col]!;
    if (mode === 'flare') {
      const course = courseTo(s, s.ship.zone, at);
      if (course.distance === 0) {
        showTip('Aim at a cell away from the ship.');
        return;
      }
      if (!computerUp()) {
        showTip(`Flare on bearing ${course.bearing}°. The computer is down: no track to show.`);
        return;
      }
      const flight = previewFlare(s, course.bearing);
      const burst = s.params.rules.bursts && s.ship.flares >= 3 ? 5 : 0;
      zoneView.overlay = {
        kind: 'flare',
        path: flight.path,
        hit: flight.at,
        bearing: course.bearing,
        scatter: flight.scatter,
        burst,
      };
      const meets =
        flight.end === 'missed'
          ? 'it leaves the zone without meeting anything'
          : flight.end === 'gleaner'
            ? 'it meets the gleaner first'
            : flight.end === 'star'
              ? 'it meets a star (it may flare up)'
              : flight.end === 'world'
                ? 'it meets a world. Careful!'
                : flight.end === 'harbour'
                  ? 'it meets the harbour. Careful!'
                  : 'it falls into a black hole';
      const shieldNote = s.ship.shieldUp ? ' Lower the shield for a straighter shot.' : '';
      showTip(
        `Flare, bearing ${course.bearing}°: flown true, ${meets}. It can stray about ±${flight.scatter}°.${shieldNote}${burst ? ' Shift: a spread of three.' : ''}`,
      );
      return;
    }
    if (mode === 'hail') {
      const g = s.gleaners.find((x) => x.row === at.row && x.col === at.col);
      if (!g) {
        showTip('Pick a gleaner to hail.');
        return;
      }
      const chance = hailChance(s, g.power);
      zoneView.overlay = { kind: 'hail', target: at, chance };
      showTip(
        `Hail this gleaner: ${chance}% chance it takes the shutdown code. Worn-down gleaners listen more, and a well-charged Lantern is more convincing.`,
      );
      return;
    }
    if (mode === 'sweep') {
      showTip('Sweep the lantern in this direction to light three cells.');
      return;
    }
    if (content === 'gleaner') {
      const g = s.gleaners.find((x) => x.row === at.row && x.col === at.col)!;
      const options = [
        s.ship.flares > 0 ? 'F to aim a flare' : null,
        'B for beams',
        s.params.rules.hail ? `H to hail (${hailChance(s, g.power)}%)` : null,
      ].filter(Boolean);
      showTip(`${describeCell(at)} ${options.join(' · ')}.`);
      return;
    }
    if (content === 'lantern' || content === 'ember') {
      showTip(describeCell(at));
      return;
    }
    const course = courseTo(s, s.ship.zone, at);
    const thrusters = isDown('drive');
    const cost = thrusters ? thrusterCost(course.distance) : driveCost(s, course.distance);
    if (!computerUp()) {
      showTip(
        `${describeCell(at)} The computer is down: no estimate, and nothing stops the Lantern short of a collision.`,
      );
      return;
    }
    const plot = plotCourse(s, course);
    const warn = risky(cost.energy, cost.days);
    zoneView.overlay = {
      kind: 'path',
      cells: plot.cells,
      stop: plot.stop,
      blocked: plot.blockedBy ? stepAfter(plot) : null,
      leaves: plot.leaves,
      warn: warn !== null,
    };
    const blocked = plot.blockedBy
      ? ` The way is blocked by a ${plot.blockedBy}; the computer will stop short.`
      : '';
    showTip(
      `${content === 'empty' ? 'Move here' : describeCell(at)}: ${days(cost.days)}, ${power(cost.energy)} power${thrusters ? ' on thrusters' : ''}.${blocked}${warn ? ` ${warn}` : ''}`,
      warn ? 'warn' : 'info',
    );
  }

  function stepAfter(plot: ReturnType<typeof plotCourse>): Point | null {
    const s = state();
    const last = plot.cells[plot.cells.length - 1] ?? s.ship.cell;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = last.row + dr;
        const c = last.col + dc;
        if (r < 0 || r > 9 || c < 0 || c > 9) continue;
        if (s.cells[r]![c] === plot.blockedBy) return { row: r, col: c };
      }
    }
    return null;
  }

  /** The warnings the original's crew gave before an order that eats most of what is left. */
  function risky(energy: number, time: number): string | null {
    const s = state();
    if (energy >= 0.85 * s.ship.energy)
      return `That uses ${Math.round((100 * energy) / Math.max(1, s.ship.energy))}% of the power left. Click again to go.`;
    if (time >= 0.85 * s.now.time)
      return `That takes ${Math.round((100 * time) / Math.max(0.01, s.now.time))}% of the time left. Click again to go.`;
    return null;
  }

  function previewZone(at: Point | null) {
    const s = state();
    chartView.route = null;
    if (!at || session.over) {
      showChartTip('Hover or pick a zone to see the jump.');
      chartTip.dataset.tone = 'quiet';
      return;
    }
    const facts = zoneSummary(at);
    if (samePoint(at, s.ship.zone)) {
      showChartTip(`${zoneLabel(at)}: the Lantern is here. ${facts}`);
      return;
    }
    if (isDown('drive')) {
      showChartTip(`${zoneLabel(at)}. ${facts} The drive is down; thrusters cannot cross zones.`);
      return;
    }
    if (!computerUp()) {
      showChartTip(`${zoneLabel(at)}. ${facts} The computer is down: no estimate.`);
      return;
    }
    const course = clearCourseTo(s, at);
    if (!course) {
      showChartTip(`${zoneLabel(at)}. Every line out of this zone is blocked; move first.`);
      return;
    }
    const cost = driveCost(s, course.distance);
    const warn = risky(cost.energy, cost.days);
    chartView.route = { to: at, warn: warn !== null };
    const shieldNote = s.ship.shieldUp ? ' Shield up: double cost.' : '';
    const strain = cost.strain > 0 ? ` ${cost.strain}% chance the drive strains.` : '';
    const redline = cost.redline ? ' Redline: anything can happen.' : '';
    showChartTip(
      `${zoneLabel(at)} · ${course.distance.toFixed(1)} zones at drive ${s.ship.drive}: ${days(cost.days)}, ${power(cost.energy)} power.${shieldNote}${strain}${redline} ${facts}${warn ? ` ${warn}` : ''}`,
      warn !== null,
    );
  }

  function zoneSummary(at: Point): string {
    const s = state();
    const zone = s.zones[at.row]![at.col]!;
    const parts: string[] = [];
    if (zone.world !== null) parts.push(worldName(zone.world));
    const seen = zone.seen;
    if (seen?.collapsed) return 'A dead zone: its star has collapsed.';
    if (!seen || seen.gleaners === null)
      parts.push(seen?.harbour ? 'a harbour; not yet scanned' : 'not yet scanned');
    else {
      parts.push(
        seen.gleaners === 0
          ? 'no gleaners seen'
          : `${seen.gleaners} ${seen.gleaners === 1 ? 'gleaner' : 'gleaners'} seen`,
      );
      if (seen.harbour) parts.push('a harbour');
    }
    return `${parts.join(', ')}.`.replace(/^./, (c) => c.toUpperCase());
  }

  function showTip(text: string, tone: 'info' | 'warn' = 'info') {
    if (openSheet) return;
    tip.textContent = text;
    tip.dataset.tone = tone;
    tip.hidden = false;
  }

  function hideTip() {
    tip.hidden = true;
  }

  function showChartTip(text: string, warn = false) {
    chartTip.textContent = text;
    chartTip.dataset.tone = warn ? 'warn' : 'info';
    chartTip.hidden = false;
  }

  // ---- Acting on cells and zones --------------------------------------------------------
  function actOnCell(at: Point, shift: boolean) {
    const s = state();
    if (session.over) return;
    const content = s.cells[at.row]![at.col]!;
    if (mode === 'flare') {
      const course = courseTo(s, s.ship.zone, at);
      if (course.distance === 0) return;
      const burst = shift && s.params.rules.bursts ? 5 : 0;
      issue({ type: 'flare', bearing: course.bearing, burst });
      return;
    }
    if (mode === 'hail') {
      if (content !== 'gleaner') {
        showTip('Pick a gleaner to hail.', 'warn');
        return;
      }
      issue({ type: 'hail', target: at });
      return;
    }
    if (mode === 'sweep') {
      const course = courseTo(s, s.ship.zone, at);
      issue({ type: 'sweep', bearing: course.bearing });
      return;
    }
    if (content === 'gleaner') {
      zoneView.selected = { ...at };
      previewCell(at);
      return;
    }
    if (content === 'lantern' || content === 'ember') return;
    const course = courseTo(s, s.ship.zone, at);
    if (course.distance === 0) return;
    const thrusters = isDown('drive');
    const cost = thrusters ? thrusterCost(course.distance) : driveCost(s, course.distance);
    const key = `move:${at.row},${at.col}`;
    if (computerUp() && risky(cost.energy, cost.days) && armed !== key) {
      armed = key;
      previewCell(at);
      return;
    }
    issue(
      thrusters
        ? { type: 'thrusters', bearing: course.bearing, distance: course.distance }
        : { type: 'travel', bearing: course.bearing, distance: course.distance },
    );
  }

  function jumpTo(at: Point) {
    const s = state();
    if (session.over || samePoint(at, s.ship.zone)) return;
    const course = clearCourseTo(s, at) ?? courseTo(s, at, { row: 4, col: 5 });
    const cost = driveCost(s, course.distance);
    const key = `jump:${at.row},${at.col}`;
    if (computerUp() && risky(cost.energy, cost.days) && armed !== key) {
      armed = key;
      previewZone(at);
      return;
    }
    issue({ type: 'travel', bearing: course.bearing, distance: course.distance });
  }

  // ---- Panels -------------------------------------------------------------------------
  function appendLog(lines: readonly LogLine[]) {
    for (const line of lines) {
      log.append(h('li', { class: 'lk-log__line', dataset: { tone: line.tone } }, line.text));
    }
    while (log.children.length > 60) log.firstElementChild?.remove();
    log.scrollTop = log.scrollHeight;
  }

  function refreshCalls() {
    const s = state();
    const list = knownCalls(s);
    calls.replaceChildren(
      h(
        'li',
        { class: 'lk-calls__title' },
        list.length === 0 ? 'No calls. Every light is steady.' : 'Calls',
      ),
      ...list.map((call) => {
        const name =
          call.kind === 'siege'
            ? `Harbour ${zoneLabel(call.zone)}`
            : `${worldName(call.world)} · ${zoneLabel(call.zone)}`;
        const when =
          call.kind === 'dark'
            ? 'dark, building gleaners'
            : call.kind === 'siege'
              ? `besieged · falls in ${days(Math.max(0, call.deadline! - s.now.date))}`
              : `attacked · falls in ${days(Math.max(0, call.deadline! - s.now.date))}`;
        return h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: 'lk-call',
              dataset: { kind: call.kind },
              onclick: () => {
                chartCursor = { ...call.zone };
                chartView.cursor = chartCursor;
                chartView.showCursor = true;
                chartCanvas.focus();
                previewZone(call.zone);
              },
            },
            h('span', { class: 'lk-call__name' }, name),
            h('span', { class: 'lk-call__when' }, when),
          ),
        );
      }),
    );
  }

  function refreshSystems() {
    const s = state();
    const down = systemsDown(s);
    if (down.length === 0) {
      systems.replaceChildren(h('p', { class: 'lk-systems__ok' }, 'All systems working.'));
      return;
    }
    systems.replaceChildren(
      h(
        'p',
        { class: 'lk-systems__title' },
        s.ship.condition === 'moored' ? 'Repairs (twice as fast in harbour)' : 'Repairs',
      ),
      h(
        'ul',
        {},
        ...down.map((d) =>
          h(
            'li',
            { title: SYSTEM_DOWN[d.system as SystemId] },
            h('span', {}, SYSTEM_NAMES[d.system as SystemId]),
            h('span', { class: 'lk-systems__eta' }, days(Math.max(0, d.until - s.now.date))),
          ),
        ),
      ),
    );
  }

  function refreshZoneHead() {
    const s = state();
    const zone = s.zones[s.ship.zone.row]![s.ship.zone.col]!;
    zoneTitle.textContent = `Zone ${zoneLabel(s.ship.zone)}`;
    const parts: string[] = [];
    if (s.gleaners.length > 0)
      parts.push(`${s.gleaners.length} ${s.gleaners.length === 1 ? 'gleaner' : 'gleaners'}`);
    else parts.push('no gleaners');
    if (zone.world !== null) parts.push(worldName(zone.world));
    if (zone.harbour) parts.push('a harbour');
    zoneFacts.textContent = parts.join(' · ');
    const hints: Record<Mode, string> = {
      helm: 'Click a cell to move · a zone on the chart to jump',
      flare: 'Flare: click where to aim · F again to cancel',
      hail: 'Hail: click a gleaner · H again to cancel',
      sweep: 'Sweep: click a direction · S again to cancel',
    };
    modeHint.textContent = hints[mode];
    modeHint.dataset.mode = mode;
    zoneCanvas.dataset.mode = mode;
  }

  function refreshCoach() {
    const s = state();
    const text = coachOn && !session.over && !openSheet ? coachTip(s) : null;
    coach.hidden = !text;
    coach.replaceChildren(
      h('span', { class: 'lk-coach__label' }, 'First officer'),
      h('span', {}, text ?? ''),
    );
  }

  function dockButton(
    label: string,
    key: string,
    onClick: () => void,
    options: { testId: string; disabled?: boolean; pressed?: boolean; title?: string },
  ) {
    const b = button(label, {
      onClick,
      key,
      testId: options.testId,
      disabled: options.disabled,
      title: options.title,
    });
    if (options.pressed !== undefined) b.setAttribute('aria-pressed', String(options.pressed));
    return b;
  }

  function refreshDock() {
    const s = state();
    const over = session.over;
    const moored = s.ship.condition === 'moored';
    const canFlare = s.ship.flares > 0 && (!isDown('flare-tubes') || moored) && !s.ship.shrouded;
    const drive = h(
      'div',
      { class: 'lk-drive', role: 'group', 'aria-label': `Drive factor ${s.ship.drive}` },
      h('span', { class: 'lk-drive__label' }, 'Drive'),
      button('−', {
        onClick: () => setDrive(-1),
        key: '[',
        testId: 'lk-drive-down',
        variant: 'quiet',
        disabled: over || s.ship.drive <= 1,
        title: 'Slower: cheaper, longer',
      }),
      h('b', { class: 'lk-drive__value' }, String(s.ship.drive)),
      button('+', {
        onClick: () => setDrive(1),
        key: ']',
        testId: 'lk-drive-up',
        variant: 'quiet',
        disabled: over || s.ship.drive >= maxDrive(s),
        title: 'Faster: costlier; above 6 the drive may strain',
      }),
    );
    const buttons: (HTMLElement | null)[] = [
      dockButton(mode === 'flare' ? 'Cancel flare' : 'Flare', 'F', () => toggleMode('flare'), {
        testId: 'lk-act-flare',
        disabled: over || !canFlare,
        pressed: mode === 'flare',
      }),
      dockButton('Beams', 'B', () => toggleSheet('beams'), {
        testId: 'lk-act-beams',
        disabled: over || s.gleaners.length === 0 || moored,
      }),
      dockButton(
        s.ship.shieldUp ? 'Lower shield' : 'Raise shield',
        'G',
        () => issue({ type: 'shield', up: !s.ship.shieldUp }),
        {
          testId: 'lk-act-shield',
          disabled: over || moored || (!s.ship.shieldUp && isDown('shield')),
        },
      ),
      s.params.rules.hail
        ? dockButton(mode === 'hail' ? 'Cancel hail' : 'Hail', 'H', () => toggleMode('hail'), {
            testId: 'lk-act-hail',
            disabled: over || s.gleaners.length === 0 || isDown('radio'),
            pressed: mode === 'hail',
          })
        : null,
      dockButton(
        moored ? 'Leave harbour' : 'Moor',
        'M',
        () => issue(moored ? { type: 'unmoor' } : { type: 'moor' }),
        { testId: 'lk-act-moor', disabled: over || (!moored && !harbourIsNear(s)) },
      ),
      dockButton('Rest', 'R', () => toggleSheet('rest'), { testId: 'lk-act-rest', disabled: over }),
      dockButton('More', '.', () => toggleSheet('more'), { testId: 'lk-act-more', disabled: over }),
      drive,
    ];
    dock.replaceChildren(...buttons.filter((b): b is HTMLElement => b !== null));
  }

  function refreshAll() {
    const s = state();
    if (!zoneView.busy) {
      status.update(s, false);
    }
    refreshZoneHead();
    refreshCalls();
    refreshSystems();
    refreshDock();
    refreshCoach();
    if (openSheet) renderSheet();
    zoneView.cursor = zoneCursor;
    chartView.cursor = chartCursor;
    previewCell(hoverCell ?? (zoneView.showCursor ? zoneCursor : null));
    previewZone(hoverZone ?? (chartView.showCursor ? chartCursor : null));
  }

  function setDrive(step: number) {
    const s = state();
    const next = Math.min(maxDrive(s), Math.max(1, s.ship.drive + step));
    if (next !== s.ship.drive) issue({ type: 'drive', factor: next });
  }

  function toggleMode(next: Mode) {
    mode = mode === next ? 'helm' : next;
    zoneView.selected = null;
    if (mode !== 'helm') {
      zoneView.showCursor = true;
      zoneCanvas.focus();
      if (mode === 'flare' || mode === 'hail') {
        const nearest = state().gleaners[0];
        if (nearest) zoneCursor = { row: nearest.row, col: nearest.col };
      }
    }
    closeSheet();
    refreshAll();
  }

  // ---- Sheets -------------------------------------------------------------------------
  function toggleSheet(which: Exclude<Sheet, null>) {
    if (openSheet === which) {
      closeSheet();
      return;
    }
    openSheet = which;
    mode = 'helm';
    if (which === 'beams') beamEnergy = suggestedBeamEnergy(state());
    renderSheet();
    sheet.hidden = false;
    tip.hidden = true;
    coach.hidden = true;
    sheet.querySelector<HTMLElement>('[data-autofocus], .lk-range')?.focus();
  }

  function closeSheet() {
    openSheet = null;
    sheet.hidden = true;
    sheet.replaceChildren();
    if (zoneView.overlay.kind === 'beams') zoneView.overlay = { kind: 'none' };
  }

  function renderSheet() {
    if (openSheet === 'beams') renderBeams();
    else if (openSheet === 'rest') renderRest();
    else if (openSheet === 'more') renderMore();
  }

  function renderBeams() {
    const s = state();
    const sure = suggestedBeamEnergy(s);
    const auto = automaticBeamsAvailable(s);
    const max = Math.max(0, Math.trunc(s.ship.energy));
    beamEnergy = Math.max(0, Math.min(max, Math.round(beamEnergy)));
    const preview = previewBeams(s, beamEnergy);
    zoneView.overlay = {
      kind: 'beams',
      targets: preview.targets.map((t) => ({ at: t.at, expected: t.expected, stopped: t.stopped })),
    };
    const slider = h('input', {
      type: 'range',
      min: '0',
      max: String(max),
      step: '10',
      value: String(beamEnergy),
      class: 'lk-range',
      'aria-label': 'Power for the volley',
      dataset: { testid: 'lk-beam-energy' },
    });
    slider.addEventListener('input', () => {
      beamEnergy = Number(slider.value);
      renderBeams();
      sheet.querySelector<HTMLInputElement>('.lk-range')?.focus();
    });
    const fire = () => {
      if (s.ship.shieldUp) {
        issue({ type: 'shield', up: false });
        return;
      }
      if (!auto) {
        const target = s.gleaners[0];
        if (!target) return;
        const course = courseTo(s, s.ship.zone, target);
        issue({
          type: 'beams-aimed',
          banks: [{ units: beamEnergy, bearing: course.bearing, spread: 1 }],
        });
        return;
      }
      issue({ type: 'beams', energy: beamEnergy });
    };
    const stops = preview.targets.filter((t) => t.stopped).length;
    sheet.replaceChildren(
      h(
        'div',
        { class: 'lk-sheet__body', role: 'dialog', 'aria-label': 'Beams' },
        h('h3', {}, 'Beams'),
        h(
          'p',
          { class: 'lk-sheet__lede' },
          auto
            ? 'Power pours through every gleaner here, nearest first; whatever is left is wasted.'
            : 'The computer or the near sensors are down: the banks are aimed by hand at the nearest gleaner.',
        ),
        s.ship.shieldUp
          ? h(
              'p',
              { class: 'lk-sheet__warn' },
              'Beams cannot fire through your own shield. Lowering it gives the gleaners one volley at a half-raised shield.',
            )
          : null,
        h(
          'div',
          { class: 'lk-beams__row' },
          slider,
          h('output', { class: 'lk-beams__value' }, power(beamEnergy)),
        ),
        h(
          'div',
          { class: 'lk-beams__presets' },
          button(`All · ${power(sure)}`, {
            onClick: () => ((beamEnergy = sure), renderBeams()),
            variant: 'quiet',
            testId: 'lk-beam-sure',
            title: 'Enough to stop every gleaner here, even at worst luck',
          }),
          ...(s.gleaners.length > 1
            ? s.gleaners.slice(0, 1).map((g) =>
                button(`Nearest · ${power(sureStopEnergy(g))}`, {
                  onClick: () => ((beamEnergy = sureStopEnergy(g)), renderBeams()),
                  variant: 'quiet',
                  title: 'Enough to stop the nearest gleaner',
                }),
              )
            : []),
        ),
        h(
          'ul',
          { class: 'lk-beams__targets' },
          ...preview.targets.map((t) =>
            h(
              'li',
              { dataset: { stopped: String(t.stopped) } },
              h('span', {}, `${t.at.row}·${t.at.col} · charge ${power(t.power)}`),
              h(
                'b',
                {},
                t.stopped
                  ? 'likely stopped'
                  : t.expected > 0
                    ? `about −${power(t.expected)}`
                    : 'untouched',
              ),
            ),
          ),
        ),
        h(
          'div',
          { class: 'lk-sheet__actions' },
          button(
            s.ship.shieldUp ? 'Lower shield first' : stops > 0 ? `Fire · ${stops} stopped` : 'Fire',
            {
              onClick: fire,
              key: 'Enter',
              variant: 'primary',
              testId: 'lk-beam-fire',
              disabled: beamEnergy <= 0 && !s.ship.shieldUp,
            },
          ),
          button('Cancel', { onClick: closeSheet, key: 'B', variant: 'quiet' }),
        ),
      ),
    );
  }

  function renderRest() {
    const s = state();
    const repairs = systemsDown(s);
    const longest = repairs.length ? Math.max(...repairs.map((r) => r.until - s.now.date)) : 0;
    const rest = (d: number) => issue({ type: 'rest', days: Math.max(0.05, d) });
    sheet.replaceChildren(
      h(
        'div',
        { class: 'lk-sheet__body', role: 'dialog', 'aria-label': 'Rest' },
        h('h3', {}, 'Rest'),
        h(
          'p',
          { class: 'lk-sheet__lede' },
          `Time passes for repairs${s.params.regen > 0 ? ' and the reactor recharges' : ''}, and the reserve drains while you wait. ${s.gleaners.length > 0 ? 'The gleaners here will not wait politely.' : ''} News wakes the crew.`,
        ),
        h(
          'div',
          { class: 'lk-sheet__actions' },
          button('Half a day', {
            onClick: () => rest(0.5),
            key: '1',
            autofocus: true,
            testId: 'lk-rest-half',
          }),
          button('One day', { onClick: () => rest(1), key: '2', testId: 'lk-rest-day' }),
          longest > 0
            ? button(`Until repaired · ${days(longest)}`, {
                onClick: () => rest(longest + 0.01),
                key: '3',
                testId: 'lk-rest-repairs',
              })
            : null,
          button('Cancel', { onClick: closeSheet, key: 'R', variant: 'quiet' }),
        ),
      ),
    );
  }

  function renderMore() {
    const s = state();
    const moored = s.ship.condition === 'moored';
    const nearest = s.now.harbours.length
      ? Math.min(
          ...s.now.harbours.map((hb) =>
            Math.hypot(hb.row - s.ship.zone.row, hb.col - s.ship.zone.col),
          ),
        )
      : Infinity;
    const odds = Number.isFinite(nearest)
      ? Math.round(100 * (1 - Math.cbrt(1 - 0.94 ** nearest)))
      : 0;
    let confirmAbandon = false;
    const abandonButton = button('Abandon the Lantern', {
      onClick: () => {
        if (!confirmAbandon) {
          confirmAbandon = true;
          abandonButton.querySelector('.lk-button__label')!.textContent =
            'Really abandon her? Click again';
          return;
        }
        issue({ type: 'abandon' });
      },
      variant: 'quiet',
      testId: 'lk-act-abandon',
      disabled: s.ship.vessel === 'ember',
    });
    sheet.replaceChildren(
      h(
        'div',
        { class: 'lk-sheet__body', role: 'dialog', 'aria-label': 'More orders' },
        h('h3', {}, 'More orders'),
        h(
          'ul',
          { class: 'lk-more' },
          isDown('near-sensors') && !moored
            ? h(
                'li',
                {},
                button('Sweep the lantern', {
                  onClick: () => toggleMode('sweep'),
                  key: 'S',
                  testId: 'lk-act-sweep',
                }),
                h(
                  'span',
                  {},
                  'Light three cells in one direction while the near sensors are down.',
                ),
              )
            : null,
          s.params.rules.shroud && s.ship.vessel === 'lantern'
            ? h(
                'li',
                {},
                button(s.ship.shrouded ? 'Drop the shroud' : 'Raise the shroud', {
                  onClick: () => issue({ type: 'shroud', on: !s.ship.shrouded }),
                  testId: 'lk-act-shroud',
                  disabled: moored || isDown('shroud'),
                }),
                h(
                  'span',
                  {},
                  `Unseen and unhit once some time has passed, but no beams, flares or hails, and it burns ${power(s.params.shroudEnergy)} power a day.`,
                ),
              )
            : null,
          h(
            'li',
            {},
            button('Call a harbour', {
              onClick: () => issue({ type: 'beacon' }),
              testId: 'lk-act-beacon',
              disabled: moored || isDown('radio') || s.now.harbours.length === 0,
            }),
            h(
              'span',
              {},
              `The nearest harbour tries to beam the Lantern in: about ${odds}% each try, three tries. It ends any hope of promotion this watch.`,
            ),
          ),
          h(
            'li',
            {},
            abandonButton,
            h(
              'span',
              {},
              'Take the launch to the old Ember at a harbour. Smaller, slower, no shroud, and a black mark on the record.',
            ),
          ),
        ),
        h(
          'div',
          { class: 'lk-sheet__actions' },
          button('Close', { onClick: closeSheet, key: '.', variant: 'quiet', autofocus: true }),
        ),
      ),
    );
  }

  // ---- Input --------------------------------------------------------------------------
  const pointerCell = (event: PointerEvent) => {
    const rect = zoneCanvas.getBoundingClientRect();
    return zoneView.cellAtPixel(event.clientX - rect.left, event.clientY - rect.top);
  };
  const pointerZone = (event: PointerEvent) => {
    const rect = chartCanvas.getBoundingClientRect();
    return chartView.zoneAtPixel(event.clientX - rect.left, event.clientY - rect.top);
  };
  zoneCanvas.addEventListener('pointermove', (event) => {
    const at = pointerCell(event);
    zoneView.showCursor = false;
    if (samePointOrNull(at, hoverCell)) return;
    hoverCell = at;
    if (!at || armed?.startsWith('move:') !== true) armed = null;
    previewCell(at);
  });
  zoneCanvas.addEventListener('pointerleave', () => {
    hoverCell = null;
    previewCell(null);
  });
  zoneCanvas.addEventListener('pointerdown', (event) => {
    if (zoneView.busy) {
      finishAnimation();
      refreshAll();
    }
    const at = pointerCell(event);
    if (at) {
      zoneCursor = at;
      actOnCell(at, event.shiftKey);
    }
  });
  zoneCanvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    if (mode !== 'helm') toggleMode(mode);
  });
  chartCanvas.addEventListener('pointermove', (event) => {
    const at = pointerZone(event);
    chartView.showCursor = false;
    if (samePointOrNull(at, hoverZone)) return;
    hoverZone = at;
    chartView.hover = at;
    previewZone(at);
  });
  chartCanvas.addEventListener('pointerleave', () => {
    hoverZone = null;
    chartView.hover = null;
    previewZone(null);
  });
  chartCanvas.addEventListener('pointerdown', (event) => {
    if (zoneView.busy) {
      finishAnimation();
      refreshAll();
    }
    const at = pointerZone(event);
    if (at) {
      chartCursor = at;
      jumpTo(at);
    }
  });
  // The cursor is for keyboard players: shown on keyboard focus or once an arrow is pressed.
  zoneCanvas.addEventListener('focus', () => {
    if (!zoneCanvas.matches(':focus-visible')) return;
    zoneView.showCursor = true;
    previewCell(zoneCursor);
  });
  zoneCanvas.addEventListener('blur', () => {
    zoneView.showCursor = false;
  });
  chartCanvas.addEventListener('focus', () => {
    if (!chartCanvas.matches(':focus-visible')) return;
    chartView.showCursor = true;
    previewZone(chartCursor);
  });
  chartCanvas.addEventListener('blur', () => {
    chartView.showCursor = false;
    chartView.route = null;
  });

  function moveCursor(event: KeyboardEvent, on: 'zone' | 'chart'): boolean {
    const steps: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const step = steps[event.key];
    if (!step) return false;
    if (on === 'zone') {
      zoneCursor = {
        row: clamp(zoneCursor.row + step[0], 0, 9),
        col: clamp(zoneCursor.col + step[1], 0, 9),
      };
      zoneView.cursor = zoneCursor;
      zoneView.showCursor = true;
      previewCell(zoneCursor);
    } else {
      chartCursor = {
        row: clamp(chartCursor.row + step[0], 0, 7),
        col: clamp(chartCursor.col + step[1], 0, 7),
      };
      chartView.cursor = chartCursor;
      chartView.showCursor = true;
      previewZone(chartCursor);
    }
    return true;
  }

  function onKey(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    // A key during an animation finishes it and is then taken as the next order.
    if (zoneView.busy) {
      finishAnimation();
      refreshAll();
    }
    if (session.over) return false;
    const focus = document.activeElement;
    const inSheet = !!openSheet && sheet.contains(focus);
    if (focus === zoneCanvas && moveCursor(event, 'zone')) return true;
    if (focus === chartCanvas && moveCursor(event, 'chart')) return true;
    if ((event.key === 'Enter' || event.key === ' ') && focus === zoneCanvas) {
      actOnCell(zoneCursor, event.shiftKey);
      return true;
    }
    if ((event.key === 'Enter' || event.key === ' ') && focus === chartCanvas) {
      jumpTo(chartCursor);
      return true;
    }
    if (openSheet === 'rest' && ['1', '2', '3'].includes(event.key)) {
      const ids = { '1': 'lk-rest-half', '2': 'lk-rest-day', '3': 'lk-rest-repairs' } as const;
      sheet
        .querySelector<HTMLButtonElement>(`[data-testid="${ids[event.key as '1' | '2' | '3']}"]`)
        ?.click();
      return true;
    }
    if (inSheet && event.key === 'Enter' && focus instanceof HTMLInputElement) {
      sheet.querySelector<HTMLButtonElement>('[data-testid="lk-beam-fire"]')?.click();
      return true;
    }
    const s = state();
    switch (event.key.toLowerCase()) {
      case 'f':
        if (s.ship.flares > 0) toggleMode('flare');
        return true;
      case 'b':
        if (s.gleaners.length > 0 && s.ship.condition !== 'moored') toggleSheet('beams');
        return true;
      case 'g':
        if (s.ship.condition !== 'moored') issue({ type: 'shield', up: !s.ship.shieldUp });
        return true;
      case 'h':
        if (s.params.rules.hail) toggleMode('hail');
        return true;
      case 'm':
        issue(s.ship.condition === 'moored' ? { type: 'unmoor' } : { type: 'moor' });
        return true;
      case 'r':
        toggleSheet('rest');
        return true;
      case 's':
        if (mode === 'sweep' || isDown('near-sensors')) toggleMode('sweep');
        return true;
      case '.':
        toggleSheet('more');
        return true;
      case 'j':
        chartCanvas.focus();
        return true;
      case 'z':
        zoneCanvas.focus();
        return true;
      case '[':
        setDrive(-1);
        return true;
      case ']':
        setDrive(1);
        return true;
      default:
        return false;
    }
  }

  // ---- Lifetime -----------------------------------------------------------------------
  const observer = new ResizeObserver(() => {
    const zoneStage = zoneCanvas.parentElement!;
    zoneView.resize(zoneStage.clientWidth, zoneStage.clientHeight);
    const chartStage = chartCanvas.parentElement!;
    chartView.resize(chartStage.clientWidth, chartStage.clientHeight);
  });
  observer.observe(zoneCanvas.parentElement!);
  observer.observe(chartCanvas.parentElement!);

  appendLog(session.log);
  status.update(session.state, false);
  refreshAll();
  if (openingBeats.length > 0) {
    const opening: OrderOutcome = {
      prev: session.state,
      state: session.state,
      beats: openingBeats,
      lines: [],
      accepted: true,
    };
    requestAnimationFrame(() => {
      zoneView.play(opening.prev, opening.state, opening.beats);
    });
  }
  if (session.over) endTimer = window.setTimeout(finishWatch, 400);

  if (import.meta.env.DEV) {
    // Workbench only: let the steady captain play through the real screen, for screenshots.
    Object.assign(window, {
      __lightkeeperState: () => session.state,
      __lightkeeperAutopilot: (orders: number) => {
        for (let i = 0; i < orders && !session.over; i++) {
          const before = session.state;
          issue(botOrder(before));
          if (session.state === before) issue({ type: 'rest', days: 0.3 });
          if (i < orders - 1) finishAnimation();
        }
        return { over: session.over, gleaners: session.state.now.gleaners };
      },
    });
  }

  const pauseItems = [
    {
      id: 'coach',
      label: 'First officer’s tips on or off',
      run: () => {
        coachOn = !coachOn;
        app.saves.prefs.update((p) => ({ ...p, coach: coachOn }));
        refreshCoach();
      },
    },
    {
      id: 'pace',
      label: 'Animations: calm or brisk',
      run: () => {
        const pace = app.saves.prefs.load().pace === 'brisk' ? 'calm' : 'brisk';
        app.saves.prefs.update((p) => ({ ...p, pace }));
        zoneView.pace = pace === 'brisk' ? 0.6 : 1;
      },
    },
    {
      id: 'end-watch',
      label: 'End this watch',
      run: () => issue({ type: 'end-watch' }),
    },
  ];

  return {
    element,
    pauseItems,
    onKey,
    onLook(look, reducedMotion) {
      zoneView.setLook(look, reducedMotion);
      chartView.setLook(look, reducedMotion);
    },
    onPause() {
      zoneView.setVisible(false);
      chartView.setVisible(false);
    },
    onResume() {
      zoneView.setVisible(true);
      chartView.setVisible(true);
    },
    focus: () => zoneCanvas.focus({ preventScroll: true }),
    destroy() {
      observer.disconnect();
      zoneView.stop();
      chartView.stop();
      window.clearTimeout(endTimer);
      window.clearTimeout(animationTimer);
    },
  };
}

function samePoint(a: Point, b: Point) {
  return a.row === b.row && a.col === b.col;
}

function samePointOrNull(a: Point | null, b: Point | null) {
  if (!a || !b) return a === b;
  return samePoint(a, b);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
