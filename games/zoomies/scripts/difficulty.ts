/**
 * A rough difficulty curve: how often a player who only avoids immediate danger (random safe
 * steps, a loaf now and then, a zoom when cornered) clears each house room, and how many of the
 * first moves keep the room winnable. `tsx scripts/difficulty.ts [tries]`.
 */
import { ROOMS } from '../src/data/house';
import { createRoom } from '../src/engine/room';
import { applyAction, legality, STEPS } from '../src/engine/rules';
import { randomClearRate } from './random-player';
import { solve } from '../src/engine/solver';
import type { Action } from '../src/engine/types';

const tries = Number(process.argv[2] ?? 300);
process.stdout.write(
  '| Room | Par | Safe first moves | Winnable after them | Random safe play clears |\n| --- | --- | --- | --- | --- |\n',
);
for (const room of ROOMS) {
  const initial = createRoom(room.spec);
  const firsts = STEPS.map(([dx, dy]) => ({ type: 'step', dx, dy }) as Action).filter(
    (a) => legality(initial, a) === 'ok',
  );
  const winnable = firsts.filter(
    (a) => solve(applyAction(initial, a).state, { maxNodes: 200_000 }) !== null,
  ).length;
  const rate = randomClearRate(initial, tries, `difficulty/${room.id}`);
  process.stdout.write(
    `| ${room.name} | ${room.par} | ${firsts.length} | ${winnable} | ${Math.round(rate * 100)}% |\n`,
  );
}
