import { createRng, emojiGrid, type ShareCell } from '@usr-games/kit';
import { type Round, WAVES_ALLOWED } from './round';

/**
 * The Daily Word: one word for everyone each day. The pool is shuffled once with a fixed seed
 * and walked one word per day, so no word comes back until the whole pool has been used.
 * No Lighthouse in the Daily.
 */
const POOL_SEED = 'before-the-tide:daily-pool:v1';

export function dailyWord(pool: readonly string[], dailyNumber: number): string {
  if (pool.length === 0) throw new Error('the daily pool is empty');
  const order = createRng(POOL_SEED).shuffle([...pool]);
  const index = (((dailyNumber - 1) % order.length) + order.length) % order.length;
  return order[index]!;
}

/** Seven squares, one per wave the castle could take: filled for each wave that came. */
export function waveGrid(round: Round): ShareCell[] {
  const used = round.status === 'lost' ? WAVES_ALLOWED : round.waves;
  return Array.from({ length: WAVES_ALLOWED }, (_, i) => (i < used ? 'near' : 'empty'));
}

function headline(round: Round): string {
  if (round.status === 'lost') return '🌊 the tide won';
  if (round.waves === 0) return '🏰 not a single wave';
  return `🏰 ${round.waves} ${round.waves === 1 ? 'wave' : 'waves'}`;
}

/** `Before the Tide #42 · 🏰 2 waves · 🟨🟨⬜⬜⬜⬜⬜`: no word, no link, nothing to spoil. */
export function dailyShareLine(
  title: string,
  dailyNumber: number,
  round: Round,
  colorBlind = false,
): string {
  return `${title} #${dailyNumber} · ${headline(round)} · ${emojiGrid([waveGrid(round)], colorBlind)}`;
}
