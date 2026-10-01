/**
 * Plays a classic arena with the house controller typing the 1986 game's own orders, from a
 * C-library seed, and prints the scenario (arena, seed, ticks and every order) as JSON. Feeding
 * the same scenario to the original program gives a long golden run (docs/NOTES.md).
 * Usage: pnpm exec tsx games/atc/scripts/bot-orders.ts <arena id> <seed> <ticks>
 */
import { CLASSIC_ARENAS } from '../src/arenas/classic';
import { botOrders } from '../src/engine/golden-bot';

const print = (text: string) => process.stdout.write(`${text}\n`);

const [id = 'old-reliable', seed = '1', ticks = '200'] = process.argv.slice(2);
const arena = CLASSIC_ARENAS.find((a) => a.id === id);
if (!arena) throw new Error(`No classic arena “${id}”`);
const orders = botOrders(arena, Number(seed), Number(ticks));
print(JSON.stringify({ arena: id, seed: Number(seed), ticks: Number(ticks), orders }));
