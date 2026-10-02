// Settling a finished battle into the saved progress: the Sea Service's stars, the day's
// engagement, the service record. A battle given up still counts as fought; nothing else is
// held back, since Broadside has no rule-bending switches.

import { judgeCommendation } from './commendations.js';
import { ACTIONS, actionAfter } from './service.js';
import { engagementRating } from './daily.js';
import { rankFor, serviceStars } from './ranks.js';
import { actionOfPlan } from './plans.js';
import {
  loadEngagements, loadRecord, loadService, saveEngagements, saveRecord, saveService,
} from './store.js';

const allWon = (service) => ACTIONS.every((action) => service.actions[action.id]?.won);

/**
 * @returns {{ earned: boolean[], newlyEarned: boolean[], rating: number | null,
 *   firstToday: boolean, rankBefore: string, rankAfter: string, opened: object | null,
 *   serviceComplete: boolean, serviceWon: boolean }} `serviceWon` whenever every action has been
 *   won, `serviceComplete` only on the battle that wins the last of them.
 */
export function settleBattle(plan, st, me, log) {
  const earned = plan.commendations.map((c) => judgeCommendation(c, st, me, log));
  const won = st.result?.reason === 'victory';
  const service = loadService();
  const starsBefore = serviceStars(service);
  const wonBefore = allWon(service);
  const summary = {
    earned,
    newlyEarned: earned.map(() => false),
    rating: plan.mode === 'daily' ? engagementRating(st, me, log, earned) : null,
    firstToday: false,
    rankBefore: rankFor(starsBefore).title,
    rankAfter: rankFor(starsBefore).title,
    opened: null,
    serviceComplete: false,
    serviceWon: wonBefore,
  };

  const record = loadRecord();
  record.battles += 1;
  if (won) record.victories += 1;
  record.prizes += log.struckToGuns + log.boardedPrizes;
  record.broadsides += log.broadsides;
  record.rakes += log.rakes;

  const action = actionOfPlan(plan);
  if (plan.mode === 'service' && action) {
    const entry = service.actions[action.id] ?? { won: false, stars: [false, false, false] };
    summary.newlyEarned = earned.map((ok, i) => ok && !entry.stars[i]);
    if (won && !entry.won) summary.opened = actionAfter(action);
    entry.won = entry.won || won;
    entry.stars = entry.stars.map((had, i) => had || earned[i]);
    service.actions[action.id] = entry;
    saveService(service);
    summary.rankAfter = rankFor(serviceStars(service)).title;
    summary.serviceWon = allWon(service);
    summary.serviceComplete = !wonBefore && summary.serviceWon;
  }

  if (plan.mode === 'daily' && plan.dateKey) {
    const engagements = loadEngagements();
    if (!engagements.days[plan.dateKey]) {
      summary.firstToday = true;
      record.engagements += 1;
      engagements.days[plan.dateKey] = {
        number: plan.number,
        won,
        rating: summary.rating,
        stars: earned,
        turns: st.turn,
      };
      saveEngagements(engagements);
    }
  }
  saveRecord(record);
  return summary;
}
