import { localDateKey } from '@usr-games/kit';
import { forecast } from '../engine/predict';
import { findPlane, type LossReason, planeName, type World } from '../engine/world';
import { type LookId, lookFor } from '../render/look';
import { Radar } from '../render/radar';
import { drawTapestry } from '../render/tapestry';
import { dailyQuarters, type DailySky, dailyShareText } from '../modes/daily';
import type { Puzzle } from '../modes/puzzles';
import { TUTORIAL_ARRIVALS } from '../modes/tutorial';
import { SHIFTS, type ShiftDefinition, type Stars } from '../modes/shifts';
import type { SkySummary } from '../play/session';
import { h } from '../ui/dom';
import { actions, type CardAction, lossCard, type Stat, shiftCard, stats } from '../ui/results';
import { LOSS_HEADLINES } from '../ui/strips';

/**
 * The card a sky ends on, built from its summary: the loss card with its replay, the shift card
 * with its tapestry, and smaller cards for the Daily Sky, Endless, puzzles and the tutorial. Every
 * card keeps the collection's order and keys: Play again (R) · Game menu · Back to the Hall (H).
 */

export interface Card {
  element: HTMLElement;
  focus: HTMLElement | null;
  destroy(): void;
}

export interface CardContext {
  look: LookId;
  reducedMotion: boolean;
  onAction(action: CardAction): void;
}

function wire(root: HTMLElement, context: CardContext): Card {
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', () => context.onAction(button.dataset.action as CardAction));
  });
  const keys = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const key = event.key.toLowerCase();
    const action: CardAction | null =
      key === 'r'
        ? 'play-again'
        : key === 'h'
          ? 'hall'
          : key === 'enter' && root.querySelector('[data-action="next"]')
            ? 'next'
            : null;
    if (!action) return;
    event.preventDefault();
    context.onAction(action);
  };
  window.addEventListener('keydown', keys);
  const primary =
    root.querySelector<HTMLElement>('.sk-button--primary') ??
    root.querySelector<HTMLElement>('button');
  return {
    element: root,
    focus: primary,
    destroy: () => window.removeEventListener('keydown', keys),
  };
}

function lossLede(reason: LossReason, names: string[]): string {
  const [first, second] = names;
  switch (reason.kind) {
    case 'separation':
      return `${first} and ${second} came within one cell and a thousand feet of each other. The ring counted down to that moment: two thousand feet between them would have kept them apart.`;
    case 'fuel':
      return `${first} declared an emergency and diverted with its tank dry. Planes low on fuel show their count in amber; bring them in first.`;
    case 'ground':
      return `${first} came down away from a runway. Only a runway takes a plane at 0 ft; a route to it glides down in time.`;
    case 'wrong-runway':
      return `${first} landed on a runway that was not its own. Its strip names where it is going.`;
    case 'wrong-landing-heading':
      return `${first} touched down across its runway. A runway takes planes only along its arrow.`;
    case 'landed-not-exited':
      return `${first} landed when it should have left. Planes bound for a gate must stay in the air.`;
    case 'wrong-exit-altitude':
      return `${first} reached its gate below 9 000 ft. Leaving planes must cross the gate at exactly 9 000 ft.`;
    case 'wrong-gate':
      return `${first} left by a gate that was not its own.`;
    case 'exited-not-landed':
      return `${first} left by a gate when it should have landed.`;
    case 'left-arena':
      return `${first} crossed the edge of the sky away from any gate.`;
    case 'ceiling':
      return `${first} climbed above the 9 000 ft ceiling.`;
  }
}

/** Plays the last ticks over and over in two windows: from above and tilted. */
function replayInto(
  canvases: HTMLCanvasElement[],
  frames: World[],
  look: LookId,
  scrub: HTMLElement,
  reducedMotion: boolean,
) {
  const radars = canvases.map((canvas) => new Radar(canvas));
  const last = frames[frames.length - 1]!;
  const loss = last.loss;
  const pair = [
    loss?.letter,
    loss?.reason.kind === 'separation' ? loss.reason.other : undefined,
  ].filter((l): l is number => l !== undefined);
  const focusOn = (world: World) => {
    const planes = pair.map((l) => findPlane(world, l)).filter((p) => p !== undefined);
    if (planes.length === 0)
      return { x: world.arena.width / 2, y: world.arena.height / 2, altitude: 3 };
    return {
      x: planes.reduce((s, p) => s + p.x, 0) / planes.length + 0.5,
      y: planes.reduce((s, p) => s + p.y, 0) / planes.length + 0.5,
      altitude: planes.reduce((s, p) => s + p.altitude, 0) / planes.length,
    };
  };
  let index = Math.max(0, frames.length - 3);
  let playing = !reducedMotion;
  let started = performance.now();
  let frame = 0;
  const skies = frames.map((world) => forecast(world));
  const buttons = [...scrub.querySelectorAll<HTMLButtonElement>('[data-tick]')];
  const mark = () => {
    for (const button of buttons) {
      const current = Number(button.dataset.tick) === frames[index]!.clock;
      button.parentElement?.classList.toggle('is-current', current);
      button.setAttribute('aria-pressed', String(current));
    }
  };
  buttons.forEach((button) =>
    button.addEventListener('click', () => {
      const at = frames.findIndex((w) => w.clock === Number(button.dataset.tick));
      if (at >= 0) {
        index = at;
        playing = false;
        mark();
      }
    }),
  );
  const draw = (now: number) => {
    const world = frames[index]!;
    const progress = playing ? Math.min(1, (now - started) / 900) : 0;
    const centre = focusOn(world);
    radars.forEach((radar, i) => {
      const box = canvases[i]!.getBoundingClientRect();
      if (box.width > 0) radar.resize(box.width, box.height, window.devicePixelRatio || 1);
      radar.draw({
        world,
        forecast: skies[index]!,
        look: lookFor(look === 'scope'),
        tilt: i === 0 ? 0 : 1,
        focus: { ...centre, zoom: i === 0 ? 2.6 : 2.3 },
        tickProgress: index === frames.length - 1 ? 0 : progress,
        time: now / 1000,
        selected: null,
        ghost: null,
        ripples: [],
        bursts: index === frames.length - 1 && loss ? [{ ...centre, start: now / 1000 - 5 }] : [],
        drain: 0,
        reducedMotion,
        showForecast: true,
        flagged: new Set(pair),
      });
    });
    if (playing && progress >= 1) {
      index = index >= frames.length - 1 ? 0 : index + 1;
      started = now + (index === frames.length - 1 ? 600 : 0);
      mark();
    }
    frame = requestAnimationFrame(draw);
  };
  mark();
  frame = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(frame);
}

export function lossCardFor(
  summary: SkySummary,
  title: string,
  context: CardContext,
  best: string,
): Card {
  const world = summary.world;
  const loss = world.loss!;
  const first = findPlane(world, loss.letter);
  const other = loss.reason.kind === 'separation' ? findPlane(world, loss.reason.other) : undefined;
  const names = [first, other]
    .filter((p) => p !== undefined)
    .map((p) => `${planeName(p)}${p.altitude}`);
  const letters = [first, other].filter((p) => p !== undefined).map((p) => planeName(p));
  const frames = summary.replay;
  const card = lossCard({
    side: 'left',
    kicker: `${title} · tick ${loss.tick}`,
    headline: LOSS_HEADLINES[loss.reason.kind],
    planes: names,
    lede: lossLede(loss.reason, letters),
    replay: frames.map((w, i) => ({
      tick: w.clock,
      state: i === frames.length - 1 ? 'loss' : 'past',
    })),
    stats: [
      { label: 'Safe', value: String(summary.safe) },
      { label: 'Ticks', value: String(summary.ticks) },
      { label: 'Longest string', value: String(summary.longestString) },
      { label: 'Near-misses', value: String(summary.nearMisses) },
      { label: 'Best here', value: best },
    ],
  });
  const wired = wire(card.root, context);
  const stop = replayInto(
    [card.above, card.tilted],
    frames,
    context.look,
    card.root.querySelector('.sk-scrub')!,
    context.reducedMotion,
  );
  return { ...wired, destroy: () => (wired.destroy(), stop()) };
}

export function shiftCardFor(
  summary: SkySummary,
  shift: ShiftDefinition,
  earned: Stars,
  page: number,
  context: CardContext,
): Card {
  const card = shiftCard({
    kicker: `Shift ${shift.number} ${earned.target ? 'cleared' : 'complete'} · ${summary.world.arena.name}`,
    title: `${shift.title}, woven`,
    lede: earned.target
      ? 'Every flight of your shift is a thread in this cloth: crossings woven over and under, landings cross-stitched, departures tied off in the fringe, and each near-miss a knot.'
      : `The shift is over, short of its target of ${shift.target}. Every flight is still woven in: try again to clear it.`,
    stars: [
      { label: `${shift.target} home safely`, earned: earned.target },
      { label: 'No near-misses', earned: earned.calm },
      { label: 'Fuel to spare', earned: earned.fuel },
    ],
    stats: [
      { label: 'Safe', value: `${summary.safe} / ${shift.target}` },
      { label: 'Ticks', value: String(summary.ticks) },
      { label: 'Longest string', value: String(summary.longestString) },
      { label: 'Near-misses', value: String(summary.nearMisses) },
    ],
    logbook: `Woven into your logbook as page ${page}`,
  });
  if (!earned.target || shift.number === 12)
    card.root.querySelector('[data-action="next"]')?.remove();
  const wired = wire(card.root, context);
  requestAnimationFrame(() => {
    const box = card.tapestry.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    card.tapestry.width = Math.round(box.width * dpr);
    card.tapestry.height = Math.round(box.height * dpr);
    drawTapestry(card.tapestry, {
      arena: summary.world.arena,
      flights: summary.flights,
      knots: summary.knots,
      dark: context.look === 'scope',
      caption: `${summary.world.arena.name} · ${shift.title} · ${summary.safe} home safely`,
      seed: `${shift.id}:${localDateKey()}`,
    });
  });
  return wired;
}

/** A smaller card: a headline, a line, numbers, and optionally a tapestry. */
function simpleCard(
  kicker: string,
  title: string,
  lede: string,
  numbers: readonly Stat[],
  context: CardContext,
  extra: Node[] = [],
  tapestry?: { summary: SkySummary; caption: string },
): Card {
  const canvas = tapestry
    ? h('canvas', {
        class: 'sk-tapestry',
        role: 'img',
        'aria-label': 'This sky woven as a tapestry',
      })
    : null;
  const root = h(
    'div',
    { class: 'sk-scrim sk-scrim--focus' },
    h(
      'section',
      { class: `sk-card ${canvas ? 'sk-card--shift' : 'sk-card--simple'}`, 'aria-label': title },
      canvas ? h('div', { class: 'sk-card__art' }, canvas) : null,
      h(
        'div',
        { class: 'sk-card__side' },
        h('p', { class: 'sk-card__kicker' }, kicker),
        h('h2', { class: 'sk-card__title' }, title),
        h('p', { class: 'sk-card__lede' }, lede),
        stats(numbers),
        actions(extra),
      ),
    ),
  );
  const wired = wire(root, context);
  if (canvas && tapestry) {
    requestAnimationFrame(() => {
      const box = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
      drawTapestry(canvas, {
        arena: tapestry.summary.world.arena,
        flights: tapestry.summary.flights,
        knots: tapestry.summary.knots,
        dark: context.look === 'scope',
        caption: tapestry.caption,
        seed: `${tapestry.caption}:${Date.now()}`,
      });
    });
  }
  return wired;
}

export function dailyCardFor(
  summary: SkySummary,
  sky: DailySky,
  context: CardContext,
  colorBlind: boolean,
): Card {
  const result = {
    safe: summary.safe,
    lostAt: summary.outcome === 'lost' ? summary.ticks : null,
    nearMissTicks: summary.nearMissTicks,
    longestString: summary.longestString,
  };
  const text = dailyShareText(sky, result, colorBlind);
  const share = h(
    'button',
    { type: 'button', class: 'sk-button sk-button--primary', 'data-action': 'share' },
    'Share',
  );
  const squares = dailyQuarters(result);
  return simpleCard(
    `Daily Sky #${sky.number} · ${sky.arena.name}`,
    summary.outcome === 'lost' ? 'The sky was lost' : 'All four quarters flown',
    text,
    [
      { label: 'Safe', value: String(summary.safe) },
      {
        label: 'Quarters',
        value: `${squares.filter((s) => s === 'hit' || s === 'near').length} of 4`,
      },
      { label: 'Longest string', value: String(summary.longestString) },
    ],
    context,
    [share],
    { summary, caption: `Daily Sky #${sky.number} · ${summary.safe} home safely` },
  );
}

export function endlessCardFor(
  summary: SkySummary,
  record: boolean,
  best: string,
  context: CardContext,
): Card {
  return simpleCard(
    `Endless · ${summary.world.arena.name}`,
    record ? 'A new best for this sky' : 'The sky is closed',
    record
      ? `${summary.safe} planes home safely in ${summary.ticks} ticks: more than before, or as many in fewer ticks.`
      : `${summary.safe} planes home safely in ${summary.ticks} ticks.`,
    [
      { label: 'Safe', value: String(summary.safe) },
      { label: 'Ticks', value: String(summary.ticks) },
      { label: 'Longest string', value: String(summary.longestString) },
      { label: 'Best here', value: best },
    ],
    context,
    [],
    { summary, caption: `${summary.world.arena.name} · ${summary.safe} home safely` },
  );
}

export function puzzleCardFor(summary: SkySummary, puzzle: Puzzle, context: CardContext): Card {
  const solved = summary.outcome === 'solved';
  const verdict = !solved
    ? 'Not this time'
    : summary.orders <= puzzle.par
      ? 'At par or under'
      : summary.orders <= puzzle.par + 2
        ? 'Solved, close to par'
        : 'Solved';
  return simpleCard(
    `Puzzle · ${puzzle.title}`,
    verdict,
    solved
      ? `Every plane home with ${summary.orders} clearances; par is ${puzzle.par}.`
      : 'A plane was lost or still flying when time ran out. Plan the whole sky before you run it.',
    [
      { label: 'Clearances', value: String(summary.orders) },
      { label: 'Par', value: String(puzzle.par) },
      { label: 'Safe', value: `${summary.safe} / ${puzzle.arrivals.length}` },
    ],
    context,
  );
}

export function tutorialCardFor(summary: SkySummary, context: CardContext): Card {
  const firstShift = h(
    'button',
    { class: 'sk-button sk-button--primary', type: 'button', 'data-action': 'next' },
    `Shift 1 · ${SHIFTS[0]!.title}`,
    h('span', { class: 'sk-key' }, 'Enter'),
  );
  return simpleCard(
    'Tutorial',
    'That is the job',
    'Weave routes, keep every pair more than a cell or two thousand feet apart, land along the arrow and leave at 9 000 ft. Shift 1 is open.',
    [{ label: 'Safe', value: `${summary.safe} / ${TUTORIAL_ARRIVALS.length}` }],
    context,
    [firstShift],
  );
}
