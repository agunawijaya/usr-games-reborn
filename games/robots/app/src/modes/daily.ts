// The Daily Showdown's calendar. Day keys follow the player's local calendar,
// and the showdown number counts the same way the Hall numbers every daily
// challenge in the collection: #1 on 2026-09-01. A hosted game cannot import
// the Hall's kit, so the few lines it needs live here.

export const DAILY_EPOCH = '2026-09-01';

export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole days from one key to another, counted on UTC dates so clock changes never skip a day. */
function daysBetween(from: string, to: string): number {
  const utc = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  return Math.round(utc(to) - utc(from));
}

export function dailyNumber(key: string): number {
  return daysBetween(DAILY_EPOCH, key) + 1;
}

/** Monday 0 … Sunday 6. */
export function weekday(key: string): number {
  // 2026-09-01 was a Tuesday.
  return (((daysBetween(DAILY_EPOCH, key) + 1) % 7) + 7) % 7;
}

/** FNV-1a: a stable 32-bit number for a seed string. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function dailySeed(key: string): number {
  return hashSeed(`robots:daily:${key}`);
}
