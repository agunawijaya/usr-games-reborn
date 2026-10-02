// What a battle is before it starts: the scenario, ship and seed the engine gets, what it is
// called on screen and the commendations it carries. Main.js keeps the plan for the whole battle
// (and saves it with the battle), so "fight it again" is the same plan once more.

import { SCENARIOS } from '../engine/index.js';
import { actionById } from './service.js';
import { dailyNumber, engagementCommendations, engagementFor } from './daily.js';

/**
 * @typedef {{ mode: 'service' | 'daily' | 'free', scenarioId: number, ship: number, seed?: number,
 *   name: string, actionId?: string, dateKey?: string, number?: number,
 *   commendations: import('./commendations.js').Commendation[] }} Plan
 */

/** @returns {Plan} */
export function planFree(scenarioId, ship, seed) {
  return { mode: 'free', scenarioId, ship, seed, name: SCENARIOS[scenarioId].name, commendations: [] };
}

/** @returns {Plan} */
export function planAction(action) {
  return {
    mode: 'service',
    scenarioId: action.scenarioId,
    ship: action.ship,
    seed: action.seed,
    name: `${action.number}. ${action.title}`,
    actionId: action.id,
    commendations: action.commendations,
  };
}

/** @returns {Plan} */
export function planDaily(dateKey) {
  const day = engagementFor(dateKey);
  const number = dailyNumber(dateKey);
  return {
    mode: 'daily',
    scenarioId: day.scenarioId,
    ship: day.ship,
    seed: day.seed,
    name: `Daily Engagement #${number}`,
    dateKey,
    number,
    commendations: engagementCommendations(dateKey),
  };
}

/** The action a plan was made from, if it is one of the Sea Service's. */
export const actionOfPlan = (plan) => (plan.actionId ? actionById(plan.actionId) : null);
