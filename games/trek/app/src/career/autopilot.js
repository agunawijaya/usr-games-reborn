// Deep Space Command — the autopilot: a player who types the bridge computer's top suggestion
// every turn, the same way tests/autoplay.test.js plays, with a fixed escape cycle for the rare
// loop where the advice repeats itself. A run that never needed an escape is exactly what a
// player gets by typing the hint panel's first command each turn (Ctrl+Alt+C): that is how the
// sorties and the daily patrols are proven winnable. It is never shown.

import { createGame, executeCommand, snapshot } from '../engine.js';
import { computeHints } from '../hints.js';
import { parseCommand, PARSE } from '../parser.js';
import { createLog, noteOrder } from './orders.js';

const ESCAPES = ['move 3 1', 'move 6 1', 'move 9 1', 'move 0 1', 'move 1.5 1', 'move 4.5 1', 'move 7.5 1', 'move 10.5 1'];
const FALLBACKS = ['move 3 1', 'move 0 1', 'move 6 1', 'move 9 1', 'lrscan'];

function run(game, log, text) {
  const parsed = parseCommand(text);
  if (parsed.status !== PARSE.OK) return false;
  const result = executeCommand(game, parsed.cmd);
  if (result.ok) noteOrder(log, game, parsed.cmd.action, result.effects ?? []);
  return result.ok;
}

/**
 * Plays one mission to its end. `options` are createGame's (difficulty, seed).
 * @returns {{ game: object, log: object, turns: number, escapes: number }}
 */
export function autoplay(options, maxTurns = 500) {
  const game = createGame(options);
  const log = createLog(game);
  let turns = 0;
  let repeat = 0;
  let escape = 0;
  let last = null;
  while (!game.won && !game.lost && turns < maxTurns) {
    const actionable = computeHints(snapshot(game)).find((hint) => hint.cmd);
    let text = actionable ? actionable.cmd : 'lrscan';
    if (text === last) {
      repeat += 1;
      if (repeat > 5) {
        text = ESCAPES[escape++ % ESCAPES.length];
        repeat = 0;
      }
    } else repeat = 0;
    last = text;
    if (!run(game, log, text) && !FALLBACKS.some((fallback) => run(game, log, fallback))) break;
    turns += 1;
  }
  return { game, log, turns, escapes: escape };
}
