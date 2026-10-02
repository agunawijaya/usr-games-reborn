// Deep Space Command — what a mission is before it starts: which preset and seed the engine gets,
// what it is called on screen and which commendations it carries. Main.js keeps the plan for the
// whole mission, so "fly it again" is the same plan once more.

import { SORTIES, PATROL_PRESET, sortiePreset } from './missions.js';
import { dailyNumber, patrolCommendations, patrolSeed } from './daily.js';

export const FREE_LEVELS = [
  { key: 'novice', label: 'Novice', desc: '8 ships · 40 stardates' },
  { key: 'standard', label: 'Standard', desc: '15 ships · 30 stardates' },
  { key: 'expert', label: 'Expert', desc: '25 ships · 22 stardates' },
];

/** @returns {import('./progress.js').Mission} */
export function planFreeMission(difficulty, seed) {
  const level = FREE_LEVELS.find((entry) => entry.key === difficulty) ?? FREE_LEVELS[1];
  return {
    mode: 'free',
    difficulty: level.key,
    seed,
    name: `Free Mission · ${level.label}`,
    commendations: [],
  };
}

/** @returns {import('./progress.js').Mission} */
export function planSortie(sortie) {
  return {
    mode: 'tour',
    difficulty: sortiePreset(sortie),
    seed: sortie.seed,
    name: `Sortie ${sortie.number} · ${sortie.name}`,
    sortie,
    commendations: sortie.commendations,
  };
}

/** @returns {import('./progress.js').Mission} */
export function planPatrol(dateKey) {
  const number = dailyNumber(dateKey);
  return {
    mode: 'daily',
    difficulty: PATROL_PRESET,
    seed: patrolSeed(dateKey),
    name: `Daily Patrol #${number}`,
    dateKey,
    number,
    commendations: patrolCommendations(dateKey),
  };
}

/** The sortie after this one, or null at the end of the tour. */
export function sortieAfter(sortie) {
  return SORTIES.find((next) => next.number === sortie.number + 1) ?? null;
}
