import type { GameContext } from '@usr-games/kit';
import { type DailyRoom, dailyRoom } from '../data/daily';

/** Today's room, worked out once per day and kept for the rest of the visit. */

let cached: { key: string; room: DailyRoom | null } | null = null;

export interface Today {
  readonly dateKey: string;
  readonly number: number;
  readonly room: DailyRoom | null;
}

export function today(context: Pick<GameContext, 'daily'>): Today {
  const dateKey = context.daily.dateKey();
  if (cached?.key !== dateKey)
    cached = { key: dateKey, room: dailyRoom(dateKey, context.daily.seed()) };
  return { dateKey, number: context.daily.number(), room: cached.room };
}
