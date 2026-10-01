import { hashString } from '@usr-games/kit';
import type { Arena } from './arena';
import { giveOrder, type LineState, readLine } from './commands';
import { glibcRandom } from './glibc-random';
import { addPlane, createWorld, type LossReason, planeName, tick, type World } from './world';

/**
 * Replays a scripted shift the way the 1986 program played it on Linux: the same `-r` seed, the
 * C library's generator for every random draw, one plane added before the first tick, and typed
 * orders given between ticks. Each tick is written as one canonical line, so a whole run can be
 * compared with the original's by a single digest (see golden.test.ts and docs/NOTES.md).
 */

export interface Scenario {
  arena: Arena;
  seed: number;
  ticks: number;
  /** Typed orders, each given just before the tick it is listed with. */
  orders?: readonly (readonly [number, string])[];
}

export interface TraceResult {
  lines: string[];
  digest: number;
  safe: number;
  loss: { tick: number; plane: string; kind: LossReason['kind'] } | null;
  rejected: string[];
}

/** clock|safe|air planes|ground planes — the same text the harness prints for the original. */
export function stateLine(world: World): string {
  const air = world.air
    .map((p) => `${planeName(p)}${p.x},${p.y},${p.altitude},${p.heading},${p.fuel};`)
    .join('');
  const ground = world.ground.map((p) => `${planeName(p)}${p.x},${p.y};`).join('');
  return `${world.clock}|${world.safe}|${air}|${ground}`;
}

/**
 * Types a line key by key, as a player at the original's prompt would: a key that does not fit is
 * dropped (the original beeped), and the line ends with Enter.
 */
export function typeLine(world: World, keys: string): LineState {
  let accepted = '';
  for (const key of `${keys}\n`) {
    const state = readLine(world, accepted + key);
    if (state.kind === 'error' && state.reason === 'key') continue;
    accepted += key;
    if (state.kind !== 'reading') return state;
  }
  return readLine(world, accepted);
}

export function traceScenario(scenario: Scenario): TraceResult {
  const draw = glibcRandom(scenario.seed);
  let flavour = 0;
  const world = createWorld(scenario.arena, {
    random: draw,
    rand: draw,
    flavour: () => flavour++,
  });
  const rejected: string[] = [];
  addPlane(world);
  const lines = [stateLine(world)];
  for (let t = 1; t <= scenario.ticks && !world.loss; t++) {
    for (const [at, keys] of scenario.orders ?? []) {
      if (at !== t) continue;
      const state = typeLine(world, keys);
      if (state.kind === 'order') giveOrder(world, state.order);
      else if (state.kind !== 'tick') rejected.push(`${t} ${keys}`);
    }
    tick(world);
    lines.push(stateLine(world));
  }
  const loss = world.loss;
  return {
    lines,
    digest: hashString(lines.join('\n')),
    safe: world.safe,
    loss: loss
      ? {
          tick: loss.tick,
          plane: planeName(
            world.air.find((p) => p.letter === loss.letter) ?? { letter: loss.letter, kind: 'jet' },
          ),
          kind: loss.reason.kind,
        }
      : null,
    rejected,
  };
}
