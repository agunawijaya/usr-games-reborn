import { type CardId, isRed, rankOf, suitIndexOf } from '@usr-games/kit/cards';
import {
  CARDS_PER_DEAL,
  type From,
  type Layout,
  type Move,
  type RuleSet,
  TABLEAU,
  type TableauIndex,
} from './rules';

/**
 * Decides whether a layout can still be won, by depth-first search with a memory of every
 * position already explored. The search works on its own compact copy of the rules (checked
 * against the real ones in the tests by replaying every line it finds) and stops after a
 * budget of positions, so the same deal always gets the same answer on every machine.
 *
 * Dealing is folded into the moves: from each position the search looks at every card the
 * talon can show by dealing on (and turning over once), dealing exactly as the rules do, base
 * cards swept home on the way. A step of the search is then "deal k times, then move a card",
 * so positions that differ only in how far the hand has been dealt are never stored. Dealing
 * commutes with every move that does not touch the talon, so nothing is lost.
 *
 * Positions are keyed by what can still change: the reserve's height, which cards are left in
 * the hand and talon and where the talon ends, and the tableau piles, sorted (piles are
 * interchangeable). Cards home follow from the rest. Runs through the hand are left out unless
 * a run limit is set, and every step moves a card, so the original's rule ending a deal on the
 * fourth idle turn-over never cuts a line short.
 */

/** What the search looks for: the win, or a challenge's lesser goal. */
export type SolveGoal = 'win' | 'empty-reserve' | { home: number };

export interface SolveOptions {
  /** Positions to explore before giving up with `unknown`. */
  nodeBudget: number;
  /** Runs through the hand allowed, counting the current one; unlimited when absent. */
  maxRuns?: number;
  /** The win unless told otherwise; `winnable` then means the goal can be reached. */
  goal?: SolveGoal;
}

/** The answer, with the most cards home in any position the search reached. */
export type Verdict =
  | { result: 'winnable'; line: Move[]; nodes: number; bestHome: number }
  | { result: 'unwinnable'; nodes: number; bestHome: number }
  | { result: 'unknown'; nodes: number; bestHome: number };

interface State {
  /** Reserve cards left; the reserve itself never changes order. */
  stock: number;
  tableau: CardId[][];
  /** Positions (into the solver's original talon-and-hand order) still in play. */
  waste: number[];
  /** How many of `waste` are on the talon; the talon top is `waste[talon - 1]`. */
  talon: number;
  /** Cards home per suit; 0 means the suit's foundation is not founded yet. */
  home: number[];
  run: number;
}

/** A step of the search: the moves to replay (deals, then one card move) and where they lead. */
interface Step {
  moves: Move[];
  next: State;
  /** Lower first: cards home, then builds, then spaces. */
  rank: number;
}

class OutOfBudget extends Error {}

const DEAL: Move = { kind: 'deal' };
/** Ranks moves that need a turn-over after every move that does not. */
const TURN_OVER_RANK = 10;

export class Solver {
  private readonly base: number;
  private readonly rules: RuleSet;
  private readonly reserve: readonly CardId[];
  /** The talon bottom first, then the hand in dealing order. */
  private readonly order: readonly CardId[];
  private readonly visited = new Set<string>();
  private readonly line: Move[][] = [];
  private nodes = 0;
  private bestHome = 0;

  constructor(
    private readonly layout: Layout,
    private readonly options: SolveOptions,
  ) {
    this.base = layout.baseRank;
    this.rules = layout.rules;
    this.reserve = layout.stock;
    this.order = [...layout.talon, ...[...layout.hand].reverse()];
  }

  solve(): Verdict {
    const home = this.layout.foundations.reduce((sum, pile) => sum + pile.length, 0);
    if (this.layout.outcome === 'won')
      return { result: 'winnable', line: [], nodes: 0, bestHome: home };
    if (this.layout.outcome !== null) return { result: 'unwinnable', nodes: 0, bestHome: home };
    try {
      const won = this.search(this.initialState());
      const { nodes, bestHome } = this;
      return won
        ? { result: 'winnable', line: this.line.flat(), nodes, bestHome }
        : { result: 'unwinnable', nodes, bestHome };
    } catch (error) {
      if (error instanceof OutOfBudget)
        return { result: 'unknown', nodes: this.nodes, bestHome: this.bestHome };
      throw error;
    }
  }

  private initialState(): State {
    const home = [0, 0, 0, 0];
    for (const pile of this.layout.foundations) home[suitIndexOf(pile[0]!)] = pile.length;
    return {
      stock: this.layout.stock.length,
      tableau: this.layout.tableau.map((pile) => [...pile]),
      waste: this.order.map((_, i) => i),
      talon: this.layout.talon.length,
      home,
      run: this.layout.run,
    };
  }

  // —— rules, mirrored from rules.ts ——

  /** Position of a card in its suit's building order: 0 for the base rank. */
  private ordinal(card: CardId): number {
    return (rankOf(card) - this.base + 13) % 13;
  }

  private goesHome(state: State, card: CardId): boolean {
    const home = state.home[suitIndexOf(card)]!;
    return home > 0 && home === this.ordinal(card);
  }

  private goesDownOn(card: CardId, onto: CardId): boolean {
    return rankOf(onto) === (rankOf(card) % 13) + 1 && isRed(card) !== isRed(onto);
  }

  /**
   * A card is safe to send home when nothing could ever be built on it: both cards one rank
   * below in the other colour are home already.
   */
  private isSafeHome(state: State, card: CardId): boolean {
    const needed = this.ordinal(card);
    const red = isRed(card);
    for (let suit = 0; suit < 4; suit++) {
      if (isRed(suit * 13) === red) continue;
      if (state.home[suit]! < needed) return false;
    }
    return true;
  }

  private stockTop(state: State): CardId | undefined {
    return state.stock > 0 ? this.reserve[state.stock - 1] : undefined;
  }

  private talonTop(state: State): CardId | undefined {
    return state.talon > 0 ? this.order[state.waste[state.talon - 1]!] : undefined;
  }

  private clone(state: State): State {
    return {
      stock: state.stock,
      tableau: state.tableau.map((pile) => pile.slice()),
      waste: state.waste.slice(),
      talon: state.talon,
      home: state.home.slice(),
      run: state.run,
    };
  }

  private sendHome(state: State, card: CardId): void {
    state.home[suitIndexOf(card)]! += 1;
  }

  private removeTalonTop(state: State): void {
    state.waste.splice(state.talon - 1, 1);
    state.talon -= 1;
  }

  private dealThree(state: State): void {
    state.talon = Math.min(state.talon + CARDS_PER_DEAL, state.waste.length);
    this.sweepTalon(state);
  }

  private sweepTalon(state: State): void {
    for (let top = this.talonTop(state); top !== undefined && rankOf(top) === this.base;) {
      this.sendHome(state, top);
      this.removeTalonTop(state);
      top = this.talonTop(state);
    }
  }

  /** What the rules do after every move: base cards go home, an empty talon is refilled. */
  private settle(state: State): void {
    for (let top = this.stockTop(state); top !== undefined && rankOf(top) === this.base;) {
      this.sendHome(state, top);
      state.stock -= 1;
      top = this.stockTop(state);
    }
    this.sweepTalon(state);
    while (state.talon === 0 && state.waste.length > 0) this.dealThree(state);
  }

  /** The player's deal: three more, or the talon turned over and three dealt again. */
  private deal(state: State): State {
    const next = this.clone(state);
    if (next.talon === next.waste.length) {
      next.talon = 0;
      next.run += 1;
    }
    this.dealThree(next);
    this.settle(next);
    return next;
  }

  private take(state: State, from: From, count: number): CardId[] {
    if (from === 'stock') {
      state.stock -= 1;
      return [this.reserve[state.stock]!];
    }
    if (from === 'talon') {
      const card = this.talonTop(state)!;
      this.removeTalonTop(state);
      return [card];
    }
    return state.tableau[from]!.splice(-count, count);
  }

  private apply(state: State, move: Move): State {
    if (move.kind === 'deal') return this.deal(state);
    const next = this.clone(state);
    const count = move.kind === 'build' ? move.count : 1;
    const cards = this.take(next, move.from, count);
    if (move.kind === 'home') this.sendHome(next, cards[0]!);
    else next.tableau[move.to]!.push(...cards);
    this.settle(next);
    return next;
  }

  private isWon(state: State): boolean {
    return (
      state.stock === 0 && state.waste.length === 0 && state.tableau.every((p) => p.length === 0)
    );
  }

  private reached(state: State): boolean {
    const goal = this.options.goal ?? 'win';
    if (goal === 'win') return this.isWon(state);
    if (goal === 'empty-reserve') return state.stock === 0;
    return state.home.reduce((sum, n) => sum + n, 0) >= goal.home;
  }

  // —— moves ——

  /** Moves of the reserve and tableau cards, ranked; a safe move home comes back alone. */
  private cardMoves(state: State): { move: Move; rank: number }[] {
    const moves: { move: Move; rank: number }[] = [];
    const stockTop = this.stockTop(state);
    for (const pile of TABLEAU) {
      const top = state.tableau[pile]!.at(-1);
      if (top !== undefined && this.goesHome(state, top)) {
        const move: Move = { kind: 'home', from: pile };
        if (this.isSafeHome(state, top)) return [{ move, rank: -1 }];
        moves.push({ move, rank: 0 });
      }
    }
    if (stockTop !== undefined && this.goesHome(state, stockTop)) {
      const move: Move = { kind: 'home', from: 'stock' };
      if (this.isSafeHome(state, stockTop)) return [{ move, rank: -1 }];
      moves.push({ move, rank: 0 });
    }
    let space: TableauIndex | undefined;
    for (const to of TABLEAU) {
      const onto = state.tableau[to]!.at(-1);
      if (onto === undefined) {
        space ??= to;
        continue;
      }
      if (stockTop !== undefined && this.goesDownOn(stockTop, onto))
        moves.push({ move: { kind: 'build', from: 'stock', to, count: 1 }, rank: 1 });
      for (const from of TABLEAU) {
        const source = state.tableau[from]!;
        if (from === to || source.length === 0) continue;
        const counts =
          this.rules === 'standard'
            ? [source.length]
            : Array.from({ length: source.length }, (_, i) => source.length - i);
        for (const count of counts)
          if (this.goesDownOn(source[source.length - count]!, onto))
            moves.push({ move: { kind: 'build', from, to, count }, rank: 2 });
      }
    }
    // One space is as good as another: the piles are interchangeable.
    if (space !== undefined && stockTop !== undefined)
      moves.push({ move: { kind: 'build', from: 'stock', to: space, count: 1 }, rank: 4 });
    return moves;
  }

  /** Moves of the talon's top card in this position. */
  private talonMoves(state: State): { move: Move; rank: number }[] {
    const top = this.talonTop(state);
    if (top === undefined) return [];
    const moves: { move: Move; rank: number }[] = [];
    if (this.goesHome(state, top)) moves.push({ move: { kind: 'home', from: 'talon' }, rank: 0 });
    let space: TableauIndex | undefined;
    for (const to of TABLEAU) {
      const onto = state.tableau[to]!.at(-1);
      if (onto === undefined) space ??= to;
      else if (this.goesDownOn(top, onto))
        moves.push({ move: { kind: 'build', from: 'talon', to, count: 1 }, rank: 1 });
    }
    // The talon fills a space only once the reserve is gone.
    if (space !== undefined && state.stock === 0)
      moves.push({ move: { kind: 'build', from: 'talon', to: space, count: 1 }, rank: 4 });
    return moves;
  }

  /** Every position the hand can be dealt to from here, nearest first, with the deals it takes. */
  private dealPositions(state: State): { deals: number; turned: boolean; state: State }[] {
    const positions = [{ deals: 0, turned: false, state }];
    let turned = false;
    const seen = new Set([`${state.talon}/${state.waste.length}`]);
    let current = state;
    for (let deals = 1; current.waste.length > 0; deals++) {
      const turnsOver = current.talon === current.waste.length;
      if (turnsOver && this.options.maxRuns !== undefined && current.run >= this.options.maxRuns)
        break;
      current = this.deal(current);
      turned ||= turnsOver;
      const key = `${current.talon}/${current.waste.length}`;
      if (seen.has(key)) break;
      seen.add(key);
      positions.push({ deals, turned, state: current });
    }
    return positions;
  }

  private steps(state: State): Step[] {
    const steps: Step[] = [];
    const direct = this.cardMoves(state);
    if (direct.length === 1 && direct[0]!.rank < 0) {
      const { move } = direct[0]!;
      return [{ moves: [move], next: this.apply(state, move), rank: -1 }];
    }
    for (const { move, rank } of direct)
      steps.push({ moves: [move], next: this.apply(state, move), rank });
    const homeBefore = state.home.join();
    for (const position of this.dealPositions(state)) {
      const deals = Array<Move>(position.deals).fill(DEAL);
      const moves = this.talonMoves(position.state);
      // Base cards swept while dealing can open moves elsewhere that were not there before.
      if (position.deals > 0 && position.state.home.join() !== homeBefore)
        moves.push(...this.cardMoves(position.state));
      // Moves within this run come before those that need the talon turned over, as a player
      // would look for them, and as a hint should offer them.
      for (const { move, rank } of moves)
        steps.push({
          moves: [...deals, move],
          next: this.apply(position.state, move),
          rank: rank + position.deals * 0.01 + (position.turned ? TURN_OVER_RANK : 0),
        });
    }
    return steps.sort((a, b) => a.rank - b.rank);
  }

  // —— search ——

  private keyOf(state: State): string {
    const mask = [0, 0, 0];
    for (const position of state.waste) mask[Math.floor(position / 12)]! |= 1 << (position % 12);
    const piles = state.tableau.map((pile) => String.fromCharCode(...pile.map((c) => c + 64)));
    piles.sort();
    const runs = this.options.maxRuns !== undefined ? state.run : 0;
    const head = String.fromCharCode(
      state.stock + 1,
      state.talon + 1,
      runs + 1,
      mask[0]! + 1,
      mask[1]! + 1,
      mask[2]! + 1,
    );
    return head + piles.join('|');
  }

  private search(state: State): boolean {
    const home = state.home.reduce((sum, n) => sum + n, 0);
    if (home > this.bestHome) this.bestHome = home;
    if (this.reached(state)) return true;
    if (++this.nodes > this.options.nodeBudget) throw new OutOfBudget();
    const key = this.keyOf(state);
    if (this.visited.has(key)) return false;
    this.visited.add(key);
    for (const step of this.steps(state)) {
      this.line.push(step.moves);
      if (this.search(step.next)) return true;
      this.line.pop();
    }
    return false;
  }
}

export function solve(layout: Layout, options: SolveOptions): Verdict {
  return new Solver(layout, options).solve();
}
