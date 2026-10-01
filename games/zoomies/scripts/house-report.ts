/** How the rivals fare in every house room: `tsx scripts/house-report.ts`. Results go in NOTES.md. */
import { ROOMS } from '../src/data/house';
import { roomLadder } from '../src/game/ladder';
import { createRoom } from '../src/engine/room';
import { solve } from '../src/engine/solver';

process.stdout.write(
  '| Room | Par | Nodes | Mochi | Pip | Professor | Glasses on |\n| --- | --- | --- | --- | --- | --- | --- |\n',
);
for (const room of ROOMS) {
  const initial = createRoom(room.spec);
  const par = solve(initial)!;
  const ladder = roomLadder(initial, par);
  const show = (id: string) => {
    const run = ladder.find((r) => r.id === id)!;
    return run.outcome === 'cleared'
      ? `${run.turns}${run.zooms ? ` (${run.zooms}z)` : ''}`
      : run.outcome === 'caught'
        ? `caught t${run.turns}`
        : 'stuck';
  };
  process.stdout.write(
    `| ${room.name} | ${room.par} | ${par.nodes} | ${show('mochi')} | ${show('pip')} | ${show('professor')} | ${show('glasses')} |\n`,
  );
}
