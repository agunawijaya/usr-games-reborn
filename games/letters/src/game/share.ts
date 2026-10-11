import type { DailyRecord } from './records';

/**
 * The Daily Grid's share line: the day's number, words found, the share of the board, the
 * longest word and one square per length band (short, middle, long): full where you found at
 * least half of that band, half where you found some, empty where you found none.
 * Plain text, no link, as every share in the collection.
 */
export function dailyShareText(number: number, record: DailyRecord, colourBlind = false): string {
  const share = record.total === 0 ? 0 : Math.round((100 * record.found) / record.total);
  const squares = record.bands.map((found, band) => {
    const total = record.bandTotals[band] ?? 0;
    if (total === 0) return '⬜';
    if (found * 2 >= total) return colourBlind ? '🟦' : '🟩';
    return found > 0 ? (colourBlind ? '🟧' : '🟨') : '⬛';
  });
  const longest = record.longest ? ` · longest: ${record.longest.toUpperCase()}` : '';
  return `Chain Letter #${number} · ${record.found} ${record.found === 1 ? 'word' : 'words'} · ${share}% of the board${longest} · ${squares.join('')}`;
}
