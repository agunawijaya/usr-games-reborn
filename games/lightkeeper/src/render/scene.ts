import type { Beat } from '../engine/beats';
import { lights, type LightState } from '../engine/score';
import type { Point, WatchState } from '../engine/types';

/**
 * What the zone view draws: a light copy of the ship's zone that the animation can move piece
 * by piece while an order plays out, then settle onto the new state. Building the scene at the
 * moment of arrival lets a jump show the zone as the Lantern first saw it.
 */

export interface SceneGleaner {
  key: number;
  row: number;
  col: number;
  charge: number;
}

export interface Scene {
  zone: Point;
  ship: Point;
  stars: Point[];
  holes: Point[];
  world: { at: Point; state: LightState; index: number } | null;
  harbour: Point | null;
  gleaners: SceneGleaner[];
  /** The near sensors are down: only swept cells and the ship's own are visible. */
  dark: boolean;
  swept: Point[];
  collapsed: boolean;
}

let nextKey = 1;

export function sceneOf(s: WatchState): Scene {
  const zone = s.zones[s.ship.zone.row]![s.ship.zone.col]!;
  const layout = zone.layout;
  const light = zone.world === null ? null : lights(s).find((l) => l.world === zone.world);
  const nearDown =
    s.ship.condition !== 'moored' &&
    s.events.some((e) => e.kind === 'repair' && e.system === 'near-sensors');
  return {
    zone: { ...s.ship.zone },
    ship: { ...s.ship.cell },
    stars: layout ? layout.stars.map((p) => ({ ...p })) : [],
    holes: layout ? layout.holes.map((p) => ({ ...p })) : [],
    world:
      s.worldCell && zone.world !== null
        ? { at: { ...s.worldCell }, state: light?.state ?? 'lit', index: zone.world }
        : null,
    harbour: s.harbourCell ? { ...s.harbourCell } : null,
    gleaners: s.gleaners.map((g) => ({
      key: nextKey++,
      row: g.row,
      col: g.col,
      charge: g.power / s.params.gleanerPower,
    })),
    dark: nearDown,
    swept: s.swept.map((p) => ({ ...p })),
    collapsed: zone.stars < 0,
  };
}

function same(a: Point, b: Point) {
  return a.row === b.row && a.col === b.col;
}

/**
 * The scene just after the ship arrived somewhere, worked back from the final state by undoing
 * the gleaner beats that followed the arrival.
 */
export function sceneAtArrival(next: WatchState, after: readonly Beat[]): Scene {
  const scene = sceneOf(next);
  for (let i = after.length - 1; i >= 0; i--) {
    const beat = after[i]!;
    if (beat.type === 'gleaner-moved') {
      const g = scene.gleaners.find((x) => same(x, beat.to));
      if (g) {
        g.row = beat.from.row;
        g.col = beat.from.col;
      }
    } else if (beat.type === 'gleaner-left') {
      scene.gleaners.push({ key: nextKey++, ...beat.from, charge: 1 });
    } else if (beat.type === 'gleaner-stopped') {
      scene.gleaners.push({ key: nextKey++, ...beat.at, charge: 0.4 });
    } else if (beat.type === 'gleaner-arrived') {
      scene.gleaners = scene.gleaners.filter((x) => !same(x, beat.at));
    } else if (beat.type === 'nova') {
      scene.stars.push({ ...beat.at });
      if (beat.leftHole) scene.holes = scene.holes.filter((h) => !same(h, beat.at));
    } else if (beat.type === 'travel') {
      break;
    }
  }
  return scene;
}

export function gleanerAt(scene: Scene, at: Point): SceneGleaner | undefined {
  return scene.gleaners.find((g) => same(g, at));
}

export { same as samePoint };
