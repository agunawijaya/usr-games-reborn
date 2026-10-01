/**
 * Searches a layout for every room of the house and writes `src/data/house-layouts.ts`.
 * Run with `pnpm --dir games/zoomies rooms`; it is deterministic, so a re-run writes the
 * same file unless a blueprint or the rules changed.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HOUSE } from '../src/data/blueprints';
import { findRoom } from '../src/engine/generate';
import { createRoom } from '../src/engine/room';
import { createGlasses } from '../src/rivals/glasses';
import { createMochi } from '../src/rivals/mochi';
import { playRoom } from '../src/rivals/run';
import { randomClearRate } from './random-player';

const only = process.argv[2];
const lines: string[] = [];
for (const room of HOUSE) {
  if (only && room.id !== only) continue;
  const started = performance.now();
  const found = findRoom(room.blueprint, room.searchSeed, {
    maxCandidates: 3000,
    accept: ({ spec, solution }) => {
      // A room the napping strategy clears, or the patched Professor clears at par, teaches nothing.
      const napper = playRoom(createRoom(spec), createMochi(), 200);
      if (napper.outcome === 'cleared' && napper.zooms === 0) return false;
      const glasses = playRoom(createRoom(spec), createGlasses(), 200);
      if (glasses.outcome === 'cleared' && glasses.turns <= solution.turns) return false;
      // Last, the expensive one: is it as forgiving as this point in the house should be?
      const [easiest, hardest] = room.blueprint.ease ?? [0, 1];
      const rate = randomClearRate(createRoom(spec), 60, `ease/${spec.seed}`);
      return rate >= easiest && rate <= hardest;
    },
  });
  const ms = Math.round(performance.now() - started);
  if (!found) {
    process.stdout.write(`${room.id}: nothing found (${ms} ms)\n`);
    continue;
  }
  const { spec, solution } = found;
  process.stdout.write(
    `${room.id}: par ${solution.turns}, ${solution.nodes} nodes, seed ${spec.seed} (${ms} ms)\n`,
  );
  lines.push(`  ${room.id}: { par: ${solution.turns}, spec: ${JSON.stringify(spec)} },`);
}

if (!only) {
  const target = fileURLToPath(new URL('../src/data/house-layouts.ts', import.meta.url));
  writeFileSync(
    target,
    [
      '// Written by scripts/search-rooms.ts. Each par is proven by the solver; see house.test.ts.',
      "import type { RoomSpec } from '../engine/room';",
      "import type { RoomTheme } from './blueprints';",
      '',
      'export const HOUSE_LAYOUTS: Record<RoomTheme, { par: number; spec: RoomSpec }> = {',
      ...lines,
      '};',
      '',
    ].join('\n'),
  );
  process.stdout.write(`wrote ${target}\n`);
}
