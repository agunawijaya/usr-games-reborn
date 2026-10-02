import type { Expedition } from '../engine/expedition';

/**
 * The Daily Cave's share line, URL-free:
 * `Hush the Wumpus #42 · hushed in 14 moves · 🎯2 · 🦇0 · 💤`
 * 🎯 darts thrown, 🦇 bat rides, then 💤 for a hushed wumpus or 💨 for an explorer who fled.
 */
export function dailyShareText(
  dailyNumber: number,
  expedition: Expedition,
  dartsThrown: number,
): string {
  const hushed = expedition.ending?.kind === 'hushed';
  const headline = hushed
    ? `hushed in ${expedition.moves} moves`
    : `fled after ${expedition.moves} moves`;
  return [
    `Hush the Wumpus #${dailyNumber}`,
    headline,
    `🎯${dartsThrown}`,
    `🦇${expedition.batRides}`,
    hushed ? '💤' : '💨',
  ].join(' · ');
}
