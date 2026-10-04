import { cellsOf, FORMS } from './forms';
import {
  cellAt,
  CORAL,
  fits,
  type Game,
  type GameEvent,
  plunge,
  restingPlace,
  shift,
  sink,
  stepDown,
  turn,
} from './game';
import type { Offset } from './forms';

/**
 * The house diver: plays the attract tank, the Hall's demo, the balance runs and the staging of
 * the hero frames. For the sinker in hand it tries every form it can turn to at the top of the
 * tank and every column it can slide to, plunges each, and scores the tank that would result: low
 * landings, rows cleared, few holes, few covered cells, a smooth top. The weights are the classic
 * hand-tuned ones for this kind of game (after Pierre Dellacherie), plus a reward for coral
 * cleared. A plunge through a current lands where the current takes it, and the diver knows. No
 * search beyond the one sinker, and no clock: every call costs the same.
 */

export type Step = 'left' | 'right' | 'turnLeft' | 'turnRight' | 'sink' | 'plunge';

export interface Placement {
  form: number;
  x: number;
  /**
   * The keys that get it there from where it starts, ending with a plunge. Through currents the
   * diver sinks a row at a time, sliding back each time it is pushed, and plunges once the last
   * current is above it.
   */
  steps: Step[];
  score: number;
}

export interface BotStyle {
  /** Keep this column empty for a long one to fill several rows at once (staging bursts). */
  well?: number | null;
}

interface Grid {
  width: number;
  height: number;
  filled: boolean[];
  coral: boolean[];
}

function gridOf(game: Game): Grid {
  const filled: boolean[] = [];
  const coral: boolean[] = [];
  for (let y = 0; y < game.height; y++)
    for (let x = 0; x < game.width; x++) {
      const cell = cellAt(game, x, y);
      filled.push(cell !== null);
      coral.push(cell?.kind === CORAL);
    }
  return { width: game.width, height: game.height, filled, coral };
}

function at(grid: Grid, x: number, y: number): boolean {
  if (x < 0 || x >= grid.width || y >= grid.height) return true;
  if (y < 0) return false;
  return grid.filled[y * grid.width + x]!;
}

/** The forms reachable by turning at the top, with the turns that reach them. */
function turnings(game: Game): { form: number; turns: Step[] }[] {
  const out: { form: number; turns: Step[] }[] = [{ form: game.form, turns: [] }];
  const seen = new Set([game.form]);
  const ways: Step[] = game.rules === 'classic' ? ['turnLeft'] : ['turnLeft', 'turnRight'];
  for (const way of ways) {
    let form = game.form;
    const turns: Step[] = [];
    for (let i = 0; i < 3; i++) {
      form = way === 'turnLeft' ? FORMS[form]!.left : FORMS[form]!.right;
      turns.push(way);
      if (!fits(game, form, game.x, game.y)) break;
      if (seen.has(form)) continue;
      seen.add(form);
      out.push({ form, turns: [...turns] });
    }
  }
  return out;
}

export function choosePlacement(game: Game, style: BotStyle = {}): Placement | null {
  if (game.over) return null;
  let best: Placement | null = null;
  for (const { form, turns } of turnings(game)) {
    for (const dir of [-1, 1] as const) {
      let x = game.x;
      const slides: Step[] = [];
      for (let k = 0; k <= game.width; k++) {
        if (k > 0) {
          if (!fits(game, form, x + dir, game.y)) break;
          x += dir;
          slides.push(dir < 0 ? 'left' : 'right');
        }
        if (dir === 1 && k === 0) continue; // the column it starts in is tried once, going left
        const path = steer(game, form, x);
        const score = evaluate(game, form, path.rest.x, path.rest.y, style);
        if (!best || score > best.score)
          best = { form, x, steps: [...turns, ...slides, ...path.steps, 'plunge'], score };
      }
    }
  }
  return best;
}

/**
 * The way down to column `target` from the top: straight to a plunge in still water; through
 * currents a row at a time, sliding back towards the target after every push, until no current is
 * left below. Where the plunge from there comes to rest is where the sinker lands.
 */
function steer(game: Game, form: number, target: number): { steps: Step[]; rest: Offset } {
  const steps: Step[] = [];
  let x = target;
  let y = game.y;
  const lastCurrent = Math.max(-1, ...game.currents.map((c) => c.row));
  while (y < lastCurrent) {
    const next = stepDown(game, form, x, y);
    if (!next) break;
    steps.push('sink');
    x = next.x;
    y = next.y;
    const toward = Math.sign(target - x);
    while (x !== target && fits(game, form, x + toward, y)) {
      x += toward;
      steps.push(toward > 0 ? 'right' : 'left');
    }
  }
  return { steps, rest: restingPlace(game, form, x, y) };
}

/** How good the tank would be with this form settled at (x, y). */
function evaluate(game: Game, form: number, x: number, y: number, style: BotStyle): number {
  const grid = gridOf(game);
  const cells = cellsOf(form, x, y);
  for (const c of cells) if (c.y >= 0) grid.filled[c.y * grid.width + c.x] = true;
  // Rows the landing completes, and the pieces of this sinker that go with them.
  let cleared = 0;
  let eroded = 0;
  let coral = 0;
  for (let row = 0; row < grid.height; row++) {
    let full = true;
    for (let col = 0; col < grid.width && full; col++) full = at(grid, col, row);
    if (!full) continue;
    cleared++;
    eroded += cells.filter((c) => c.y === row).length;
    coral += grid.coral.slice(row * grid.width, (row + 1) * grid.width).filter(Boolean).length;
    for (const layer of [grid.filled, grid.coral]) {
      layer.splice(row * grid.width, grid.width);
      layer.unshift(...Array.from({ length: grid.width }, () => false));
    }
  }
  const landingHeight =
    grid.height - (y + cellsOf(form, 0, 0).reduce((s, c) => s + c.y, 0) / 4) - 0.5;
  let rowTransitions = 0;
  let columnTransitions = 0;
  let holes = 0;
  let wells = 0;
  for (let row = 0; row < grid.height; row++) {
    for (let col = -1; col < grid.width; col++)
      if (at(grid, col, row) !== at(grid, col + 1, row)) rowTransitions++;
  }
  for (let col = 0; col < grid.width; col++) {
    let covered = false;
    for (let row = -1; row < grid.height; row++) {
      if (at(grid, col, row) !== at(grid, col, row + 1)) columnTransitions++;
      if (at(grid, col, row)) covered = true;
      else if (covered && row >= 0) holes++;
    }
    let depth = 0;
    for (let row = 0; row < grid.height; row++) {
      if (!at(grid, col, row) && at(grid, col - 1, row) && at(grid, col + 1, row)) {
        depth++;
        wells += depth;
      } else depth = 0;
    }
  }
  let score =
    -4.5 * landingHeight +
    3.4 * cleared * eroded -
    3.2 * rowTransitions -
    9.3 * columnTransitions -
    7.9 * holes -
    3.4 * wells +
    6 * coral;
  if (style.well !== undefined && style.well !== null && cells.some((c) => c.x === style.well)) {
    // Staging: filling the well costs, unless it is the long one going in to clear four rows.
    score += cleared >= 4 ? 60 : -40;
  }
  return score;
}

/** Plays the diver's keys on a game, as a player pressing them would. */
export function playStep(game: Game, step: Step): GameEvent[] {
  switch (step) {
    case 'left':
      return shift(game, -1);
    case 'right':
      return shift(game, 1);
    case 'turnLeft':
      return turn(game, 'left');
    case 'turnRight':
      return turn(game, 'right');
    case 'sink':
      return sink(game);
    case 'plunge':
      return plunge(game);
  }
}

export function playSteps(game: Game, steps: readonly Step[]): GameEvent[] {
  return steps.flatMap((step) => playStep(game, step));
}
