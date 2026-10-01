/**
 * Prints Skyloom's canonical trace of a scripted shift, for comparing with the original program
 * when a golden run disagrees. Usage:
 *   pnpm exec tsx games/atc/scripts/trace.ts '{"arena":"old-reliable","seed":1,"ticks":30}'
 */
import { CLASSIC_ARENAS } from '../src/arenas/classic';
import { traceScenario } from '../src/engine/trace';

const print = (text: string) => process.stdout.write(`${text}\n`);

const input = JSON.parse(process.argv[2] ?? '{}') as {
  arena: string;
  seed: number;
  ticks: number;
  orders?: [number, string][];
};
const arena = CLASSIC_ARENAS.find((a) => a.id === input.arena);
if (!arena) throw new Error(`No classic arena “${input.arena}”`);
const result = traceScenario({ ...input, arena });
if (process.argv.includes('--states')) print(result.lines.join('\n'));
print(
  JSON.stringify({
    digest: result.digest,
    ticks: result.lines.length - 1,
    safe: result.safe,
    loss: result.loss,
    rejected: result.rejected,
  }),
);
