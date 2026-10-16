import { BOARDS } from '../boards/themes';
import { Rival } from '../engine/ai';
import { apply, newGame } from '../engine/game';
import { keep, openLedger, type Ledger } from '../engine/ledger';
import { PERSONALITIES } from '../engine/rivals';
import { makeRules, NO_HOUSE_RULES } from '../engine/rules';
import { actor, netWorth } from '../engine/state';
import type { GameState, Rules, SeatSetup } from '../engine/types';
import type { Scenario } from './catalogue';
import { judge, type Verdict } from './goals';
import { Pilot } from './pilot';
import { tableFor } from './table';

/**
 * A scenario as a game: its rules, its seats and the hands that set its table. The same setup
 * serves the play screen and the proof, which lets a rival's mind play the player's seat under
 * the scenario's restrictions and the same referee.
 */

export interface ScenarioGame {
  readonly board: Scenario['board'];
  readonly seed: string;
  readonly rules: Rules;
  readonly seats: readonly SeatSetup[];
  readonly prepare: (state: GameState) => void;
}

export function scenarioRules(scenario: Scenario): Rules {
  return makeRules(
    scenario.preset,
    'scenario',
    { ...NO_HOUSE_RULES, ...scenario.house },
    scenario.rounds,
  );
}

export function scenarioGame(
  scenario: Scenario,
  seed: string,
  you: { readonly name: string; readonly token: string } = {
    name: 'You',
    token: BOARDS[scenario.board].tokens[0]!.id,
  },
): ScenarioGame {
  const tokens = BOARDS[scenario.board].tokens.map((t) => t.id).filter((id) => id !== you.token);
  return {
    board: scenario.board,
    seed,
    rules: scenarioRules(scenario),
    seats: [
      { name: you.name, kind: 'human', token: you.token },
      ...scenario.rivals.map((rival, i) => ({
        name: PERSONALITIES[rival.personality].name,
        kind: 'ai' as const,
        token: tokens[i]!,
        personality: rival.personality,
        difficulty: rival.difficulty,
      })),
    ],
    prepare: (state) => {
      scenario.setup?.(tableFor(state));
      // The recap's chart starts from the table as set, not from the deal.
      state.history = [state.seats.map((_, seat) => netWorth(state, seat))];
    },
  };
}

export interface ScenarioRun {
  readonly verdict: Verdict;
  readonly state: GameState;
  readonly ledger: Ledger;
}

/**
 * Plays a scenario with the pilot in the player's seat: the proof that it can be won. The rivals
 * are the scenario's own.
 */
export function playScenario(scenario: Scenario, seed: string, maxActions = 20000): ScenarioRun {
  const game = scenarioGame(scenario, seed);
  const state = newGame(game);
  game.prepare(state);
  const ledger = openLedger(0, state);
  const pilot = new Pilot(scenario, seed);
  const rivals = scenario.rivals.map((r, i) => new Rival(i + 1, r.personality, r.difficulty, seed));
  let verdict = judge(scenario.goals, state, ledger);
  for (let actions = 0; verdict === null && actions < maxActions; actions++) {
    const seat = actor(state);
    const action =
      seat === 0 ? pilot.decide(state, ledger) : rivals[seat - 1]!.decide(state).action;
    keep(ledger, state, apply(state, action));
    verdict = judge(scenario.goals, state, ledger);
  }
  return {
    verdict: verdict ?? { won: false, turns: ledger.turns, reason: 'The game did not finish.' },
    state,
    ledger,
  };
}
