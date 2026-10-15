import { composeShare, createRng } from '@usr-games/kit';
import type { RouteId } from '../render/routes';
import { STOPS } from './journal';

/**
 * The Daily Road: one hand against Classic, from the same deck and on the same route for
 * everyone that day, wherever their journal has reached.
 */

export interface DailyRecord {
  number: number;
  score: number;
  coups: number;
  miles: number;
  won: boolean;
}

export function dailyRoute(seed: string): RouteId {
  return createRng(`${seed}:route`).pick(STOPS).id;
}

/** `Detour #42 · 1,450 · ⚔️ 1 coup · 🛣️ 700` */
export function dailyShareText(dateKey: string, record: DailyRecord): string {
  const coups = `${record.coups} coup${record.coups === 1 ? '' : 's'}`;
  return composeShare({
    title: 'Detour',
    daily: dateKey,
    headline: `${record.score.toLocaleString('en-GB')} · ⚔️ ${coups} · 🛣️ ${record.miles}`,
  });
}
