import type { DailyRecord } from '../app/saves';

/**
 * The Daily Puzzle's share line: "Fivefold #42 · solved in 3 · 🔵🔵🔵" — a blue circle for each
 * of your moves in the solve, after a white one for each try before it. No link, nothing else.
 */
export function dailyShareText(record: DailyRecord): string {
  const misses = '⚪'.repeat(Math.min(5, Math.max(0, record.tries - 1)));
  return `Fivefold #${record.number} · solved in ${record.moves} · ${misses}${'🔵'.repeat(record.moves)}`;
}
