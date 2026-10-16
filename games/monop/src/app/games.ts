import { BOARDS, type BoardId } from '../boards/themes';
import type { GameKind } from '../career/career';
import { PERSONALITIES } from '../engine/rivals';
import { makeRules, NO_HOUSE_RULES, quickRounds } from '../engine/rules';
import type { GameState, Rules, SeatSetup } from '../engine/types';
import type { Scenario } from '../scenarios/catalogue';
import { scenarioGame } from '../scenarios/run';
import type { TableChoices } from './saves';

/**
 * A game about to be played, whichever door it came through: the Quick game on the menu, a table
 * set up by hand, a scenario or the Daily Deal. Playing again starts the same spec afresh.
 */

export interface GameSpec {
  readonly kind: GameKind;
  readonly board: BoardId;
  readonly seed: string;
  readonly rules: Rules;
  readonly seats: readonly SeatSetup[];
  readonly coach: boolean;
  readonly prepare?: (state: GameState) => void;
  readonly scenario?: Scenario;
  readonly daily?: { readonly number: number; readonly dateKey: string };
}

const freshSeed = (kind: string) => `${kind}-${Date.now().toString(36)}`;

/** Tokens for the rivals: the board's, in order, skipping the ones people play with. */
function rivalTokens(board: BoardId, taken: readonly string[]): string[] {
  return BOARDS[board].tokens.map((t) => t.id).filter((id) => !taken.includes(id));
}

/** The menu's Quick game: you against Dex the dealmaker and Marlowe the builder. */
export function quickGame(board: BoardId, token: string, coach: boolean, seed?: string): GameSpec {
  const tokens = rivalTokens(board, [token]);
  const seats: SeatSetup[] = [
    { name: 'You', kind: 'human', token },
    ...(['dealmaker', 'builder'] as const).map((personality, i) => ({
      name: PERSONALITIES[personality].name,
      kind: 'ai' as const,
      token: tokens[i]!,
      personality,
      difficulty: 'medium' as const,
    })),
  ];
  return {
    kind: 'quick',
    board,
    seed: seed ?? freshSeed('quick'),
    rules: makeRules('standard', 'quick', NO_HOUSE_RULES, quickRounds(seats.length)),
    seats,
    coach,
  };
}

/** A table set up on the New game page. Guests are named in seat order: Player 2, Player 3… */
export function customGame(table: TableChoices, token: string, seed?: string): GameSpec {
  const tokens = rivalTokens(table.board, [token]);
  let next = 0;
  const humans = table.seats.filter((s) => s.kind !== 'rival').length;
  const seats: SeatSetup[] = table.seats.map((choice, index) => {
    if (choice.kind === 'you')
      return { name: humans > 1 ? 'Player 1' : 'You', kind: 'human', token };
    const own = tokens[next++]!;
    if (choice.kind === 'guest')
      return { name: choice.name || `Player ${index + 1}`, kind: 'human', token: own };
    return {
      name: PERSONALITIES[choice.personality].name,
      kind: 'ai',
      token: own,
      personality: choice.personality,
      difficulty: choice.difficulty,
    };
  });
  return {
    kind: table.mode,
    board: table.board,
    seed: seed ?? freshSeed(table.mode),
    rules: makeRules(
      table.preset,
      table.mode,
      table.house,
      table.mode === 'quick' ? quickRounds(seats.length) : undefined,
    ),
    seats,
    coach: table.coach,
  };
}

export function scenarioSpec(
  scenario: Scenario,
  token: string,
  coach: boolean,
  seed?: string,
): GameSpec {
  const game = scenarioGame(scenario, seed ?? freshSeed(scenario.id), { name: 'You', token });
  return { kind: 'scenario', ...game, coach, scenario };
}

/** The Daily Deal: the day's scenario on the day's proven dice, with the coach off. */
export function dailySpec(
  scenario: Scenario,
  seed: string,
  token: string,
  daily: { readonly number: number; readonly dateKey: string },
): GameSpec {
  const game = scenarioGame(scenario, seed, { name: 'You', token });
  return { kind: 'daily', ...game, coach: false, scenario, daily };
}
