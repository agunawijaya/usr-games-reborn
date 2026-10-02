import { gardenFromRows } from '../src/engine/garden';
import type { Cell } from '../src/engine/geometry';
import { chaseView, type Round, RUN_RULES } from '../src/engine/round';
import { boldnessChance, strikeChances } from '../src/engine/snake';
import { chunkFor } from '../src/engine/value';
import type { ViewScene } from '../src/render/garden-view';
import type { GlintTier } from '../src/render/glint';
import type { Look } from '../src/render/look';
import type { HudModel } from '../src/ui/hud';

/**
 * Staged moments for the hero frames: real rounds and the real renderer, with the pieces
 * placed by hand so each frame tells its story.
 */

const CHAMBER_FOUR = [
  '..................',
  '.HHH.......~~~....',
  '.H.........~~~....',
  '.H....HH..........',
  '......H.......HH..',
  '..............H...',
  '.~~......HHH......',
  '.~~...............',
  '.......H.....#....',
  '.......H....HH....',
  '..................',
];

function round(
  rows: readonly string[],
  parts: {
    you: Cell;
    glints: Cell[];
    snake: Cell[];
    heading: number;
    loot: number;
    penalty?: number;
  },
): Round {
  const garden = gardenFromRows(rows);
  return {
    garden,
    you: parts.you,
    glints: parts.glints,
    snake: parts.snake,
    heading: parts.heading,
    loot: parts.loot,
    penalty: parts.penalty ?? 0,
    chunk: chunkFor(garden.width, garden.height),
    appetite: 60,
    ledger: { gross: parts.loot * 2, spent: 0 },
    rules: RUN_RULES,
    moves: 140,
    pickups: parts.loot / 25,
    warps: 0,
  };
}

export type SceneName = 'chamber' | 'coil' | 'bank' | 'wink';

export function stage(name: SceneName, look: Look): ViewScene {
  switch (name) {
    case 'chamber':
      return chamberScene(look);
    case 'coil':
      return coilScene(look);
    case 'bank':
      return bankScene(look);
    case 'wink':
      return {
        ...coilScene(look),
        mood: 'wink',
        moment: { kind: 'coil', progress: 1, spill: 1, spillTiers: SPILL },
      };
  }
}

const SPILL: GlintTier[] = [1, 2, 3, 1, 4, 2, 0, 3, 1, 2, 4, 1, 3, 2, 1, 0];

function chamberScene(look: Look): ViewScene {
  const r = round(CHAMBER_FOUR, {
    you: { x: 10, y: 4 },
    glints: [{ x: 15, y: 2 }],
    snake: [
      { x: 7, y: 5 },
      { x: 6, y: 6 },
      { x: 5, y: 7 },
      { x: 4, y: 8 },
      { x: 3, y: 8 },
      { x: 2, y: 9 },
    ],
    heading: 1,
    loot: 300,
  });
  const view = chaseView(r);
  return {
    round: r,
    look,
    tiers: [2],
    fullness: 0.85,
    boldness: boldnessChance(r.snake[0]!, view),
    mood: 'bold',
    strikes: strikeChances(r.snake[0]!, view),
    peek: null,
    pose: 'walk',
    facing: 1,
    moment: null,
    seed: 4,
  };
}

function coilScene(look: Look): ViewScene {
  const r = round(CHAMBER_FOUR, {
    you: { x: 8, y: 4 },
    glints: [{ x: 15, y: 2 }],
    snake: [
      { x: 8, y: 3 },
      { x: 7, y: 3 },
      { x: 6, y: 4 },
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 6 },
    ],
    heading: 3,
    loot: 425,
  });
  return {
    round: r,
    look,
    tiers: [3],
    fullness: 0,
    boldness: 0.9,
    mood: 'smug',
    strikes: null,
    peek: null,
    pose: 'startled',
    facing: 1,
    moment: { kind: 'coil', progress: 1, spill: 0.62, spillTiers: SPILL },
    seed: 4,
  };
}

function bankScene(look: Look): ViewScene {
  const r = round(CHAMBER_FOUR, {
    you: { x: 13, y: 8 },
    glints: [{ x: 4, y: 3 }],
    snake: [
      { x: 2, y: 9 },
      { x: 3, y: 9 },
      { x: 3, y: 10 },
      { x: 2, y: 10 },
      { x: 1, y: 10 },
      { x: 1, y: 9 },
    ],
    heading: 6,
    loot: 400,
  });
  const door = r.garden.door;
  return {
    round: { ...r, you: { x: door.x, y: door.y } },
    look,
    tiers: [1],
    fullness: 0.75,
    boldness: 0.15,
    mood: 'sulk',
    strikes: null,
    peek: null,
    pose: 'pour',
    facing: 1,
    moment: { kind: 'bank', open: 1, pouring: true, pourTiers: [1, 2, 3, 1, 4, 2, 1, 3] },
    seed: 4,
  };
}

/** The interface for each staged moment. */
export function hudFor(name: SceneName, scene: ViewScene): HudModel {
  return {
    chamber: 4,
    chambers: 10,
    chamberName: 'The Hedge Walk',
    traits: ['Hedges', 'Lily pools', 'Glints worth ×1.6'],
    pockets: name === 'bank' ? 1240 : name === 'chamber' ? 1062 : 1386,
    warpCost: 106,
    boldness: scene.boldness,
    strikePreview: scene.strikes !== null,
  };
}
