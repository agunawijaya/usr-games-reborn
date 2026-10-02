import { groundAt, isOpen } from './garden';
import { type Cell, directionBetween, isDiagonal, moved, same } from './geometry';
import { chaseView, isAsleep, type Round } from './round';
import { strikeChances } from './snake';

/**
 * How likely a step is to get you caught on the snake's reply, worked out exactly from the
 * chase weights: certain if you walk onto any of its squares, else the chance its head lands
 * on yours, through both strokes when it swims. The bots play by it, and the strike preview's
 * numbers are the same sums.
 */
export function captureRisk(round: Round, direction: number): number | null {
  if (!round.rules.diagonals && isDiagonal(direction)) return null;
  const to = moved(round.you, direction);
  if (!isOpen(round.garden, to)) return null;
  // A pickup or the door ends the turn before the snake moves.
  if (round.glints.some((g) => same(g, to)) || same(to, round.garden.door)) return 0;
  if (round.snake.some((s) => same(s, to))) return 1;
  if (isAsleep(round)) return 0;
  const walked = { ...round, you: to };
  const head = round.snake[0]!;
  let risk = 0;
  const swims = groundAt(round.garden, head) === 'pool';
  for (const first of strikeChances(head, chaseView(walked))) {
    if (same(first.cell, to)) {
      risk += first.chance;
      continue;
    }
    if (!swims) continue;
    const afterFirst = {
      ...walked,
      snake: [first.cell, ...round.snake.slice(0, -1)],
      heading: directionBetween(head, first.cell),
    };
    const second = strikeChances(first.cell, chaseView(afterFirst)).find((s) => same(s.cell, to));
    risk += first.chance * (second?.chance ?? 0);
  }
  return risk;
}

/** Every direction you may step in, with its risk. */
export function stepRisks(round: Round): Array<{ direction: number; to: Cell; risk: number }> {
  const result: Array<{ direction: number; to: Cell; risk: number }> = [];
  for (let direction = 0; direction < 8; direction++) {
    const risk = captureRisk(round, direction);
    if (risk !== null) result.push({ direction, to: moved(round.you, direction), risk });
  }
  return result;
}
