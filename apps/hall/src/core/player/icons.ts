import { s } from '../../ui/h';

/** The player's own icons, on the same 24×24 stroked grid as the Hall's interface icons. */
const PATHS = {
  pause: 'M8 5.5v13M16 5.5v13',
  play: 'M8 5.5l10.5 6.5L8 18.5z',
  back: 'M20 12H5M11 6l-6 6 6 6',
  book: 'M4 5.5c3-1 5.5-1 8 .8 2.5-1.8 5-1.8 8-.8v13c-3-1-5.5-1-8 .8-2.5-1.8-5-1.8-8-.8zM12 6.3v13',
  sliders: 'M4 7h9M17 7h3M15 4.5v5M4 17h3M11 17h9M9 14.5v5',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  again: 'M19 12a7 7 0 1 1-2.1-5M19 4.5V9h-4.5',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z',
  flag: 'M6 21V4M6 4h11l-2.5 4L17 12H6',
  bolt: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
  rank: 'M12 3l2.4 4.8 5.3.8-3.9 3.7.9 5.3-4.7-2.5-4.7 2.5.9-5.3-3.9-3.7 5.3-.8zM8 21h8',
  sound: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8',
  muted: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5',
} as const;

export type PlayerIconName = keyof typeof PATHS;

export function playerIcon(name: PlayerIconName, className = 'pl-icon'): SVGSVGElement {
  return s(
    'svg',
    { class: className, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
    s('path', { d: PATHS[name] }),
  );
}
