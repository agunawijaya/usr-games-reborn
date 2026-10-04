import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRng } from '@usr-games/kit';
import { greedyGusMove } from '../src/ai/greedy-gus';
import { chooseMove } from '../src/ai/opponents';
import { Position } from '../src/ai/position';
import { Solver } from '../src/ai/solver';
import { type Board, edgeBoxes, isFull, newBoard, play } from '../src/engine/board';
import { safeEdges } from '../src/engine/chains';
import { encodeLines, encodeOwners, type PuzzleKind, type PuzzleSpec } from '../src/game/puzzles';

/**
 * Finds the endgame puzzles. Random games on small boards are played into their endgames; every
 * position on the way is solved exactly, and kept when all of its best moves give boxes away,
 * the best move that gives nothing away is at least two boxes worse, and the best moves all
 * belong to one piece of the board (one idea, not several). Writes `src/game/puzzle-data.ts`.
 */

const SIZES = [
  { columns: 3, rows: 3, want: { decline: 6, sacrifice: 2, choice: 4 } },
  { columns: 4, rows: 3, want: { decline: 4, sacrifice: 3, choice: 5 } },
  { columns: 4, rows: 4, want: { decline: 3, sacrifice: 3, choice: 4 } },
  { columns: 5, rows: 4, want: { decline: 2, sacrifice: 2, choice: 2 } },
] as const;

const say = (line: string) => process.stdout.write(`${line}\n`);

const KINDS: readonly PuzzleKind[] = ['decline', 'sacrifice', 'choice'];

interface Found extends PuzzleSpec {
  readonly free: number;
  readonly margin: number;
}

/** Closes nothing and leaves a box with three sides: a line that gives something away. */
function gives(position: Position, edge: number): boolean {
  if (position.isSafe(edge)) return false;
  const closed = position.draw(edge);
  position.undraw(edge);
  return closed === 0;
}

/** The boxes a line touches that are still open. */
function touched(board: Board, edge: number): number[] {
  return edgeBoxes(board, edge).filter((box) => board.owner[box] === -1);
}

/** All best moves touch one connected run of open boxes with two or three sides. */
function oneIdea(board: Board, position: Position, best: readonly number[]): boolean {
  const member = (box: number) => position.sides[box] === 2 || position.sides[box] === 3;
  const start = touched(board, best[0]!).find(member);
  if (start === undefined) return false;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const box = stack.pop()!;
    for (const edge of position.freeSides(box)) {
      const other = position.grid.across(edge, box);
      if (other >= 0 && member(other) && !seen.has(other)) {
        seen.add(other);
        stack.push(other);
      }
    }
  }
  return best.every((edge) => touched(board, edge).some((box) => seen.has(box)));
}

/**
 * Three kinds of puzzle. With boxes to take: the best move declines them. With safe lines left:
 * the best move gives boxes away early. With neither: every line gives something, and the best
 * gift is not the one the original computer would choose.
 */
function candidate(board: Board, clock: number): Found | null {
  const position = Position.from(board);
  if (position.free > 30 || position.free < 6) return null;
  const solved = new Solver(600_000).solveEvery(position);
  if (!solved) return null;
  if (!solved.best.every((edge) => gives(position, edge))) return null;
  const kind: PuzzleKind =
    position.firstCapturable() >= 0
      ? 'decline'
      : position.safeEdges().length > 0
        ? 'sacrifice'
        : 'choice';
  const instinct =
    kind === 'choice'
      ? solved.scored.filter((s) => s.edge === greedyGusMove(board, clock))
      : solved.scored.filter((s) => !gives(position, s.edge));
  if (instinct.length === 0) return null;
  const margin = solved.value - Math.max(...instinct.map((s) => s.value));
  if (margin < 2 || !oneIdea(board, position, solved.best)) return null;
  const open = [...board.owner].filter((o) => o === -1).length;
  return {
    columns: board.columns,
    rows: board.rows,
    lines: encodeLines(board.drawn),
    owners: encodeOwners(board.owner, board.toMove),
    target: (open + solved.value) / 2,
    kind,
    free: position.free,
    margin,
  };
}

function* positions(columns: number, rows: number, seed: number): Generator<Board> {
  const rng = createRng(`puzzles:${columns}x${rows}:${seed}`);
  let board = newBoard({ columns, rows });
  for (;;) {
    const safe = safeEdges(board);
    if (safe.length === 0) break;
    if (safe.length <= 6) yield board;
    board = play(board, rng.pick(safe)).board;
  }
  let clock = seed * 1009;
  while (!isFull(board)) {
    yield board;
    const id = rng.chance(0.5) ? 'pupil' : 'chain-counter';
    board = play(board, chooseMove(id, board, { rng, clock: clock++ })).board;
  }
}

const chosen: Found[] = [];
for (const size of SIZES) {
  const picked: Record<PuzzleKind, Found[]> = { decline: [], sacrifice: [], choice: [] };
  const seenLines = new Set<string>();
  const full = () => KINDS.every((kind) => picked[kind].length >= size.want[kind]);
  for (let seed = 0; seed < 6000 && !full(); seed++) {
    for (const board of positions(size.columns, size.rows, seed)) {
      const found = candidate(board, seed * 1009);
      if (!found || seenLines.has(found.lines)) continue;
      if (picked[found.kind].length >= size.want[found.kind]) continue;
      seenLines.add(found.lines);
      picked[found.kind].push(found);
      break;
    }
  }
  const forSize = KINDS.flatMap((kind) => picked[kind]).sort((a, b) => a.free - b.free);
  say(
    `${size.columns} × ${size.rows}: ${KINDS.map((kind) => `${picked[kind].length} ${kind}`).join(', ')}`,
  );
  chosen.push(...forSize);
}

const body = chosen
  .map(
    (p) =>
      `  { columns: ${p.columns}, rows: ${p.rows}, lines: '${p.lines}', owners: '${p.owners}', target: ${p.target}, kind: '${p.kind}' },`,
  )
  .join('\n');
const file = `import type { PuzzleSpec } from './puzzles';

/** Written by \`scripts/puzzles.ts\`; checked by \`puzzles.test.ts\`. Do not edit by hand. */
export const PUZZLE_DATA: readonly PuzzleSpec[] = [
${body}
];
`;
writeFileSync(fileURLToPath(new URL('../src/game/puzzle-data.ts', import.meta.url)), file);
say(`${chosen.length} puzzles written`);
