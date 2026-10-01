import type { HoloIcon } from './icons';

/** Each Hall achievement gets its own mark and hue, so the Hall's page reads as a varied set. */
export const HALL_CARD_ART: Readonly<Record<string, { icon: HoloIcon; hue: number }>> = {
  'hello-world': { icon: 'wave', hue: 330 },
  'first-process': { icon: 'play', hue: 265 },
  'read-the-manual': { icon: 'book', hue: 200 },
  'daily-driver': { icon: 'calendar', hue: 160 },
  'first-cron-job': { icon: 'flag', hue: 30 },
  'window-shopping': { icon: 'palette', hue: 290 },
  'ten-processes': { icon: 'stack', hue: 220 },
  'seven-days-up': { icon: 'flame', hue: 15 },
  'clean-crontab': { icon: 'list', hue: 140 },
  'ls-usr-games': { icon: 'compass', hue: 45 },
};
