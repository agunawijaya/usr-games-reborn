// Deep Space Command — settling a finished mission into the saved progress: the tour's stars,
// the day's patrol, the service record. Missions flown with the Captain's Override never count.

import { judgeCommendation } from './orders.js';
import { SORTIES } from './missions.js';
import { patrolRating } from './daily.js';
import { rankFor, tourStars } from './ranks.js';
import {
  loadPatrols,
  loadRecord,
  loadTour,
  savePatrols,
  saveRecord,
  saveTour,
} from './store.js';

/**
 * @typedef {{ mode: 'tour' | 'daily' | 'free', difficulty: string, seed?: number, name: string,
 *   sortie?: import('./missions.js').Sortie, dateKey?: string, number?: number,
 *   commendations: import('./orders.js').Commendation[] }} Mission
 */

/**
 * @returns {{ counted: boolean, earned: boolean[], newlyEarned: boolean[], rating: number | null,
 *   firstPatrolToday: boolean, rankBefore: string, rankAfter: string, unlocked: object | null,
 *   tourComplete: boolean, tourWon: boolean }} `tourWon` whenever every sortie has been won,
 *   `tourComplete` only on the mission that wins the last of them.
 */
export function settleMission(mission, game, log) {
  const earned = mission.commendations.map((c) => judgeCommendation(c, game, log));
  const tour = loadTour();
  const starsBefore = tourStars(tour);
  const tourWon = () => SORTIES.every((sortie) => tour.sorties[sortie.id]?.won);
  const tourWonBefore = tourWon();
  const summary = {
    counted: !game.cheated,
    earned,
    newlyEarned: earned.map(() => false),
    rating: mission.mode === 'daily' ? patrolRating(game, log, earned) : null,
    firstPatrolToday: false,
    rankBefore: rankFor(starsBefore).title,
    rankAfter: rankFor(starsBefore).title,
    unlocked: null,
    tourComplete: false,
    tourWon: tourWonBefore,
  };
  if (game.cheated) return summary;

  const record = loadRecord();
  record.missions += 1;
  if (game.won) record.victories += 1;
  record.shipsDestroyed += game.kills;
  record.orders += log.orders;

  if (mission.mode === 'tour' && mission.sortie) {
    const entry = tour.sorties[mission.sortie.id] ?? { won: false, stars: [false, false, false] };
    summary.newlyEarned = earned.map((ok, i) => ok && !entry.stars[i]);
    const wasWon = entry.won;
    entry.won = entry.won || game.won;
    entry.stars = entry.stars.map((had, i) => had || earned[i]);
    tour.sorties[mission.sortie.id] = entry;
    saveTour(tour);
    if (game.won && !wasWon) {
      summary.unlocked = SORTIES.find((sortie) => sortie.number === mission.sortie.number + 1) ?? null;
    }
    summary.rankAfter = rankFor(tourStars(tour)).title;
    summary.tourWon = tourWon();
    summary.tourComplete = !tourWonBefore && summary.tourWon;
  }

  if (mission.mode === 'daily' && mission.dateKey) {
    const patrols = loadPatrols();
    if (!patrols.days[mission.dateKey]) {
      summary.firstPatrolToday = true;
      record.patrolsFlown += 1;
      patrols.days[mission.dateKey] = {
        number: mission.number,
        won: game.won,
        rating: summary.rating,
        stars: earned,
        orders: log.orders,
        stardates: Math.round((game.stardate - game.galaxy.stardateStart) * 10) / 10,
      };
      savePatrols(patrols);
    }
  }
  saveRecord(record);
  return summary;
}
