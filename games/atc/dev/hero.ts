import type { Cell } from '../src/engine/geometry';
import { forecast } from '../src/engine/predict';
import { planRoute } from '../src/engine/route';
import { findPlane, planeName, tick, type World } from '../src/engine/world';
import { type LookId, lookFor } from '../src/render/look';
import type { Focus } from '../src/render/camera';
import {
  type Burst,
  type GhostRoute,
  type Pearl,
  Radar,
  type RadarScene,
  type Ripple,
} from '../src/render/radar';
import { h } from '../src/ui/dom';
import { createPlayScreen, type FootModel, type PlayScreen } from '../src/ui/play-screen';
import { lossCard, shiftCard } from '../src/ui/results';
import { drawTapestry } from '../src/render/tapestry';
import { LOSS_HEADLINES, stripModels } from '../src/ui/strips';
import { rushHour, stringOfPearls, wovenShift } from './scenes';

/**
 * The hero frames for the owner's checkpoint: live scenes drawn by the game's own screens.
 */

export interface HeroOptions {
  look: LookId;
  live: boolean;
  /** Seconds on the animation clock for a frozen frame (sweep angle, pulses, ripples). */
  time: number;
}

type HeroScene = (host: HTMLElement, options: HeroOptions) => Promise<void>;

interface PlayFrame {
  world: World;
  context: string;
  title: string;
  target: number | null;
  string: number;
  speed: string;
  selected: number | null;
  tilt: number;
  focus?: Focus;
  ghost?: (world: World) => GhostRoute | null;
  ripples?: (time: number) => Ripple[];
  pearls?: (time: number) => Pearl[];
  stringQueue?: readonly string[];
  foot?: FootModel;
  tickProgress?: number;
  overlay?: (layer: HTMLElement, look: LookId) => void;
  bursts?: (time: number) => Burst[];
  drain?: number;
}

function letter(name: string): number {
  return name.toLowerCase().charCodeAt(0) - 97;
}

/** A route being drawn from a plane through waypoints, with the pointer at the last one. */
function ghostThrough(
  world: World,
  name: string,
  waypoints: readonly Cell[],
  label: string,
): GhostRoute | null {
  const plane = findPlane(world, letter(name));
  if (!plane) return null;
  const planned = planRoute(world.arena, { cell: plane, heading: plane.heading }, waypoints);
  if (!planned) return null;
  const end = waypoints[waypoints.length - 1]!;
  return {
    letter: plane.letter,
    cells: planned.cells,
    cursor: { x: end.x + 0.5, y: end.y + 0.5 },
    valid: true,
    label,
  };
}

function showPlay(host: HTMLElement, options: HeroOptions, frame: PlayFrame): PlayScreen {
  const { world } = frame;
  const look = lookFor(options.look === 'scope');
  const screen = createPlayScreen(host, options.look);
  const sky = forecast(world);
  screen.renderBar({
    context: frame.context,
    title: frame.title,
    arena: world.arena.name,
    tickProgress: frame.tickProgress ?? 0.42,
    safe: world.safe,
    target: frame.target,
    tick: world.clock,
    string: frame.string,
    speed: frame.speed,
  });
  screen.renderStrips(
    stripModels(world, sky, frame.selected),
    world.air.length,
    world.ground.length,
  );
  screen.renderFoot(frame.foot ?? { kind: 'hints' });
  frame.overlay?.(screen.overlay, options.look);
  screen.fit();
  const ghost = frame.ghost?.(world) ?? null;

  const draw = (time: number, tickProgress: number) => {
    const scene: RadarScene = {
      world,
      forecast: sky,
      look,
      tilt: frame.tilt,
      focus: frame.focus,
      tickProgress,
      time,
      selected: frame.selected,
      ghost,
      ripples: frame.ripples?.(time) ?? [],
      pearls: frame.pearls?.(time) ?? [],
      stringQueue: (frame.stringQueue ?? []).map(letter),
      bursts: frame.bursts?.(time) ?? [],
      drain: frame.drain ?? 0,
      reducedMotion: false,
      showForecast: (frame.drain ?? 0) === 0,
    };
    screen.radar.draw(scene);
  };

  if (!options.live) {
    draw(options.time, frame.tickProgress ?? 0.42);
    return screen;
  }
  const loop = (now: number) => {
    const seconds = now / 1000;
    draw(seconds, (seconds % world.arena.tickSeconds) / world.arena.tickSeconds);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return screen;
}

function rushFrame(tilt: number, look: LookId): PlayFrame {
  return {
    world: rushHour(),
    context: 'Shift 9',
    title: 'Rush hour',
    target: 20,
    string: 2,
    speed: '5 s a tick',
    selected: letter('k'),
    tilt,
    ghost:
      tilt > 0
        ? undefined
        : (world) =>
            ghostThrough(
              world,
              'k',
              [{ x: 22, y: 9 }, world.arena.beacons[1]!],
              'k via B1, then E2',
            ),
    foot:
      tilt > 0 && look === 'scope'
        ? {
            kind: 'echo',
            echo: { letter: 'k', words: 'altitude: climb 3000 ft' },
            choices: ['⏎ send', '? help'],
          }
        : { kind: 'hints' },
    overlay:
      tilt > 0
        ? (layer) => {
            layer.append(
              h(
                'div',
                { class: 'sk-chip', style: 'position:absolute;left:24px;top:20px' },
                'Altitude Tilt',
                h('span', { style: 'opacity:.72;font-weight:600' }, 'release to fly flat'),
              ),
            );
          }
        : undefined,
  };
}

const rush: HeroScene = async (host, options) => {
  showPlay(host, options, rushFrame(0, options.look));
};

const tilt: HeroScene = async (host, options) => {
  showPlay(host, options, rushFrame(1, options.look));
};

/**
 * Twin Rivers, a moment after the third landing in a row: three ticks of four seconds, with the
 * newest touchdown half a second ago.
 */
const pearls: HeroScene = async (host, options) => {
  const sinceLast = 0.48;
  const landings = (time: number) => [
    { runway: 0, start: time - sinceLast - 8 },
    { runway: 1, start: time - sinceLast - 4 },
    { runway: 0, start: time - sinceLast },
  ];
  showPlay(host, options, {
    world: stringOfPearls(),
    context: 'Shift 6',
    title: 'Crossing lines',
    target: 24,
    string: 3,
    speed: '4 s a tick',
    selected: null,
    tilt: 1,
    focus: { x: 19.5, y: 9.8, altitude: 1.2, zoom: 2.2 },
    tickProgress: sinceLast / 4,
    ripples: (time) => landings(time).map((l, order) => ({ ...l, order })),
    pearls: landings,
    stringQueue: ['e', 'g', 'j'],
    overlay: (layer) => {
      layer.append(
        h(
          'div',
          {
            class: 'sk-chip sk-chip--pearls',
            style: 'position:absolute;left:50%;top:20px;transform:translateX(-50%)',
          },
          h('span', { class: 'sk-chip__beads', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
          'String of pearls',
          h('strong', {}, '×3'),
        ),
      );
    },
  });
};

/** Draws one replay window: the sky as it was, leaning in on the pair that met. */
function drawReplay(canvas: HTMLCanvasElement, world: World, options: HeroOptions, tilt: number) {
  const radar = new Radar(canvas);
  const box = canvas.getBoundingClientRect();
  radar.resize(box.width, box.height, window.devicePixelRatio || 1);
  const k = findPlane(world, letter('k'))!;
  const b = findPlane(world, letter('B'))!;
  radar.draw({
    world,
    forecast: forecast(world),
    look: lookFor(options.look === 'scope'),
    tilt,
    focus: {
      x: (k.x + b.x) / 2 + 0.5,
      y: (k.y + b.y) / 2 + 0.2,
      altitude: (k.altitude + b.altitude) / 2,
      zoom: tilt > 0 ? 2.3 : 2.6,
    },
    tickProgress: 0,
    time: options.time,
    selected: null,
    ghost: null,
    ripples: [],
    bursts: [],
    drain: 0,
    reducedMotion: false,
    showForecast: true,
  });
}

/**
 * Nobody answers the ring: the same rush hour, run on by the engine for two ticks, ends in a
 * loss of separation. The card replays tick 214, when the ring first warned.
 */
const loss: HeroScene = async (host, options) => {
  const world = rushHour();
  while (!world.loss && world.clock < 230) tick(world);
  const lost = world.loss!;
  const first = findPlane(world, lost.letter)!;
  const other = lost.reason.kind === 'separation' ? findPlane(world, lost.reason.other)! : first;
  const names = [first, other].map((p) => `${planeName(p)}${p.altitude}`);
  const screen = showPlay(host, options, {
    world,
    context: 'Shift 9',
    title: 'Rush hour',
    target: 20,
    string: 0,
    speed: '5 s a tick',
    selected: null,
    tilt: 0,
    tickProgress: 0.6,
    drain: 1,
    bursts: (time) => [
      {
        x: (first.x + other.x) / 2 + 0.5,
        y: (first.y + other.y) / 2 + 0.5,
        altitude: (first.altitude + other.altitude) / 2,
        start: time - 2,
      },
    ],
  });
  const card = lossCard({
    side: 'left',
    kicker: `Shift 9 · Rush hour · tick ${lost.tick}`,
    headline: LOSS_HEADLINES[lost.reason.kind],
    planes: names,
    lede:
      `${planeName(first)} and ${planeName(other)} came within one cell and a thousand feet of each other. ` +
      `The ring warned two ticks ahead: a climb for ${planeName(first)}, or its route through B1, would have kept them apart.`,
    replay: [212, 213, 214, 215, 216].map((t) => ({
      tick: t,
      state: t === 214 ? 'shown' : t === lost.tick ? 'loss' : 'past',
    })),
    stats: [
      { label: 'Safe', value: `${world.safe}` },
      { label: 'Ticks', value: `${lost.tick}` },
      { label: 'Longest string', value: '2' },
      { label: 'Near-misses', value: '1' },
      { label: 'Best here', value: '19' },
    ],
  });
  screen.root.append(card.root);
  drawReplay(card.above, rushHour(), options, 0);
  drawReplay(card.tilted, rushHour(), options, 1);
};

/** Shift complete: Rush hour met its target, and the shift is woven into a tapestry. */
const tapestry: HeroScene = async (host, options) => {
  const world = rushHour();
  world.air = world.air.filter((p) => ['c', 'y', 'h', 'Q'].includes(planeName(p)));
  world.ground = [];
  world.safe = 23;
  world.clock = 290;
  const screen = showPlay(host, options, {
    world,
    context: 'Shift 9',
    title: 'Rush hour',
    target: 20,
    string: 0,
    speed: '5 s a tick',
    selected: null,
    tilt: 0,
    tickProgress: 0.2,
  });
  const card = shiftCard({
    kicker: 'Shift 9 complete · Harbour Lights',
    title: 'Rush hour, woven',
    lede: 'Every flight of your shift is a thread in this cloth: crossings woven over and under, landings cross-stitched, departures tied off in the fringe, and each near-miss a knot.',
    stars: [
      { label: 'Twenty home safely', earned: true },
      { label: 'No near-misses', earned: false },
      { label: 'Fuel to spare', earned: true },
    ],
    stats: [
      { label: 'Safe', value: '23 / 20' },
      { label: 'Ticks', value: '290' },
      { label: 'Longest string', value: '4' },
      { label: 'Near-misses', value: '2' },
    ],
    logbook: 'Pinned in your logbook as page 12',
  });
  screen.root.append(card.root);
  const box = card.tapestry.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  card.tapestry.width = Math.round(box.width * dpr);
  card.tapestry.height = Math.round(box.height * dpr);
  const shift = wovenShift();
  drawTapestry(card.tapestry, {
    arena: world.arena,
    flights: shift.flights,
    knots: shift.knots,
    dark: options.look === 'scope',
    caption: 'Harbour Lights · Rush hour · 23 home safely',
    seed: 'shift-9',
  });
};

export const HERO_SCENES: Record<string, HeroScene> = { rush, tilt, pearls, loss, tapestry };
