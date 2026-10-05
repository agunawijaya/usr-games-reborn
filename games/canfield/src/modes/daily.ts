import { formatTime } from '../play/clock';

/**
 * The Daily Deal's share line: the kit's daily number, the result, the cards home, the time and
 * how many cards Insight showed. Never money: the Daily is played in points by everyone.
 */
export function dailyShareText(record: {
  number: number;
  won: boolean;
  cardsHome: number;
  ms: number;
  insight: number;
}): string {
  const parts = [`Thirteen Down #${record.number}`];
  if (record.won) parts.push('won');
  parts.push(`${record.cardsHome}/52`, formatTime(record.ms), `🔍${record.insight}`);
  return parts.join(' · ');
}
