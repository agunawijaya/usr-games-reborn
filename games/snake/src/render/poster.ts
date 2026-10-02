import { gardenFromRows } from '../engine/garden';
import { type Round, RUN_RULES } from '../engine/round';
import { chunkFor } from '../engine/value';
import { GardenView } from './garden-view';
import type { GlintTier } from './glint';
import type { Look } from './look';
import { sceneFor } from './scene';

/**
 * The key art for the Hall: the snake coiled round a heap of glints, one eye winking, in a
 * small corner of the garden. By moonlight in the dark appearance, at noon in the light one.
 */
const CORNER = [
  '...........',
  '.HH.....~~.',
  '.H......~~.',
  '...........',
  '...........',
  '.......HH..',
  '.#.........',
];

const HOARD: GlintTier[] = [1, 2, 3, 4, 1, 2, 3, 1, 4, 2, 3, 1, 4];

function posterRound(): Round {
  const garden = gardenFromRows(CORNER);
  return {
    garden,
    you: { x: 5, y: 3 },
    glints: [{ x: 9, y: 5 }],
    snake: [
      { x: 5, y: 2 },
      { x: 4, y: 2 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
    ],
    heading: 2,
    loot: 400,
    penalty: 0,
    chunk: chunkFor(garden.width, garden.height),
    appetite: 0,
    ledger: { gross: 0, spent: 0 },
    rules: RUN_RULES,
    moves: 0,
    pickups: 0,
    warps: 0,
  };
}

export function drawPoster(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  look: Look,
  animate: boolean,
) {
  const view = new GardenView(canvas);
  view.layout(width, height, { x: 0, y: 0, width, height });
  const scene = sceneFor(posterRound(), look, 31, {
    mood: 'wink',
    boldness: 0.85,
    moment: { kind: 'hoard', tiers: HOARD },
  });
  let frame = 0;
  const started = performance.now();
  const paint = (now: number) => {
    view.render(scene, animate ? (now - started) / 1000 : 2.4);
    if (animate) frame = requestAnimationFrame(paint);
  };
  paint(started);
  return { stop: () => cancelAnimationFrame(frame) };
}
