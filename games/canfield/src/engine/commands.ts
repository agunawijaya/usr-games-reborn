import { countFor } from './assist';
import type { Layout, Move, TableauIndex } from './rules';

/**
 * The original's typed commands, for players who know them: `s#` and `sf` (reserve), `t#` and
 * `tf` (talon), `##` and `#f` (tableau), `ht` (deal), `c` (card counting, our Insight), `b` (the
 * account, our ledger), `i` (instructions) and `q` (quit). Piles are numbered 1 to 4.
 */

export type Command =
  | { kind: 'move'; move: Move }
  | { kind: 'insight' }
  | { kind: 'ledger' }
  | { kind: 'help' }
  | { kind: 'quit' }
  | { kind: 'unknown'; text: string };

export const COMMAND_EXAMPLES = 's1 · sf · t2 · tf · 34 · 2f · ht · c';

function pile(char: string | undefined): TableauIndex | null {
  if (char === undefined || char < '1' || char > '4') return null;
  return (Number(char) - 1) as TableauIndex;
}

/**
 * Reads a command against the current layout. A pile-to-pile command moves the whole pile in
 * Standard, and in Relaxed the longest run that fits.
 */
export function parseCommand(text: string, layout: Layout): Command {
  const typed = text.toLowerCase().replace(/\s+/g, '');
  const [first, second] = [typed[0], typed[1]];
  if (typed === 'c') return { kind: 'insight' };
  if (typed === 'b') return { kind: 'ledger' };
  if (typed === 'i') return { kind: 'help' };
  if (typed === 'q') return { kind: 'quit' };
  if (typed === 'ht') return { kind: 'move', move: { kind: 'deal' } };
  if (typed.length !== 2) return { kind: 'unknown', text };
  const source = first === 's' ? 'stock' : first === 't' ? 'talon' : pile(first);
  if (source === null) return { kind: 'unknown', text };
  if (second === 'f') return { kind: 'move', move: { kind: 'home', from: source } };
  const to = pile(second);
  if (to === null) return { kind: 'unknown', text };
  if (source === 'stock' || source === 'talon')
    return { kind: 'move', move: { kind: 'build', from: source, to, count: 1 } };
  const length = layout.tableau[source]!.length;
  const count = countFor(layout, source, to, length) ?? length;
  return { kind: 'move', move: { kind: 'build', from: source, to, count } };
}
