/** Prints a room's par route as workbench key steps: `tsx scripts/route-keys.ts <room>`. */
import type { RoomTheme } from '../src/data/blueprints';
import { roomById } from '../src/data/house';
import { createRoom } from '../src/engine/room';
import { solve } from '../src/engine/solver';

const KEYS: Record<string, string> = {
  '-1,-1': 'KeyQ',
  '0,-1': 'KeyW',
  '1,-1': 'KeyE',
  '-1,0': 'KeyA',
  '0,0': 'KeyS',
  '1,0': 'KeyD',
  '-1,1': 'KeyZ',
  '0,1': 'KeyX',
  '1,1': 'KeyC',
};
const route =
  solve(createRoom(roomById((process.argv[2] ?? 'hallway') as RoomTheme).spec))?.actions ?? [];
process.stdout.write(
  `${route.map((a) => (a.type === 'step' ? `key:${KEYS[`${a.dx},${a.dy}`]} wait:450` : 'key:KeyT wait:600')).join(' ')}\n`,
);
