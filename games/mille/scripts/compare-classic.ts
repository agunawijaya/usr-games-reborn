import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRng } from '@usr-games/kit';
import {
  type ClassicMemory,
  type Player,
  type View,
  SafetyKnown,
  calcMove,
  handMilesOf,
  viewFor,
  wantsExtension,
} from '../src/ai/classic';
import { type Kind, ordinal } from '../src/engine/cards';
import { nextDriverAction, newMatch, nextHand, step } from '../src/engine/match';

/**
 * Checks the Classic driver against the original `comp.c`. It needs a harness built from the
 * original sources outside the repository (see docs/NOTES.md, "Classic against comp.c"): a
 * program that reads positions on standard input and prints the original `calcmove`'s choice
 * and its need table, or `check_ext`'s answer. Run with
 *   MILLE_HARNESS="wsl -e /path/to/harness" npx tsx scripts/compare-classic.ts [games]
 */

const harness = process.env.MILLE_HARNESS;
if (!harness) throw new Error('set MILLE_HARNESS to the command that runs the comparison harness');
const games = Number(process.argv[2] ?? 60);

const code = (kind: Kind | null): number => (kind === null ? -1 : ordinal(kind));

function playerLine(p: Player, hand: (Kind | null)[] | null): number[] {
  return [
    code(p.battle),
    code(p.speed),
    p.canGo ? 1 : 0,
    p.mileage,
    0,
    0,
    0,
    0,
    p.numMiles200,
    ...p.safety,
    ...(hand ?? new Array<Kind | null>(7).fill(null)).map(code),
  ];
}

/** The original keeps every mileage count; only the 200s matter to `calcmove`, the rest are padding. */
function positionLine(mode: 0 | 1, v: View, memory: ClassicMemory, rolls: number[]): string {
  return [
    mode,
    v.end,
    v.deckLeft,
    memory.numGos,
    ...v.seen,
    ...memory.numNeed,
    ...playerLine(v.op, null),
    ...playerLine(v.pp, v.hand),
    ...rolls,
  ].join(' ');
}

interface Case {
  line: string;
  expected: string;
}

const cases: Case[] = [];
const rolls = createRng('compare:rolls');
for (let g = 0; g < games; g++) {
  const opponent = g % 3 === 0 ? 'rookie' : 'classic';
  const match = newMatch({
    teams: false,
    length: 'full',
    seed: `compare:${g}`,
    drivers: g % 2 ? ['classic', opponent] : [opponent, 'classic'],
  });
  for (;;) {
    const hand = match.hand;
    if (hand.over) {
      if (match.over) break;
      nextHand(match);
      continue;
    }
    const seat = hand.turn;
    const driver = match.drivers[seat]!;
    if (driver.level === 'classic' && !hand.awaitingExtension) {
      const memory: ClassicMemory = {
        numGos: driver.memory.numGos,
        numNeed: [...driver.memory.numNeed],
      };
      const queue = Array.from({ length: 10 }, () => rolls.int(1, 10));
      let next = 0;
      const view = viewFor(hand, seat, memory, () => queue[next++]!);
      const before: ClassicMemory = { numGos: memory.numGos, numNeed: [...memory.numNeed] };
      const line = positionLine(0, view, before, queue);
      const decision = calcMove(view);
      const movetype = decision.type === 'discard' ? 0 : decision.type === 'draw' ? 1 : 2;
      const cardNo = decision.type === 'draw' ? 0 : decision.slot;
      cases.push({ line, expected: [movetype, cardNo, ...memory.numNeed].join(' ') });
      if (view.end === 700 && view.pp.safety.some((s) => s !== SafetyKnown.Unknown)) {
        const ext = viewFor(hand, seat, before, () => 1);
        cases.push({
          line: positionLine(1, ext, before, queue),
          expected: wantsExtension(ext, handMilesOf(ext.hand)) ? '1' : '0',
        });
      }
    }
    const action = nextDriverAction(match)!;
    step(match, action);
  }
}

const [command, ...args] = harness.split(' ');
const output = execFileSync(command!, args, {
  input: cases.map((c) => c.line).join('\n') + '\n',
  maxBuffer: 1 << 28,
}).toString();
const answers = output.trim().split('\n');
let same = 0;
const differences: string[] = [];
cases.forEach((c, i) => {
  const answer = answers[i]?.trim();
  if (answer === c.expected) same++;
  else if (differences.length < 8)
    differences.push(`#${i}\n  in   ${c.line}\n  C    ${answer}\n  port ${c.expected}`);
});
process.stdout.write(`${same} of ${cases.length} positions agree with comp.c\n`);
const fixtures = process.env.MILLE_FIXTURES;
if (fixtures) {
  const kept = cases.filter((c, i) => i % 120 === 0 && answers[i]?.trim() === c.expected);
  writeFileSync(
    fixtures,
    `${JSON.stringify(
      kept.map((c) => ({ input: c.line, original: c.expected })),
      null,
      1,
    )}\n`,
  );
  process.stdout.write(`kept ${kept.length} positions in ${fixtures}\n`);
}
for (const d of differences) process.stdout.write(`${d}\n`);
