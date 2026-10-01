import { s } from './h';

/** Interface icons as path data on a 24×24 grid, stroked like the game emblems. */
export const ICONS = {
  brand: 'M3 5h18v11H3zM6.5 8.5l2.5 2-2.5 2M11 13h4M9 20h6M12 16v4',
  home: 'M3 8h6l2 2h10v9H3zM3 8V5h6l2 3',
  settings: 'M4 7h9M17 7h3M15 4.5v5M4 17h3M11 17h9M9 14.5v5',
  appearance: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 3v18',
  run: 'M8 5.5l10.5 6.5L8 18.5z',
  back: 'M20 12H5M11 6l-6 6 6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  folder: 'M3 6h6l2 2h10v11H3z',
  folderOpen: 'M3 6h6l2 2h8v3M3 6v13h15l3-8H7l-4 8',
  snow: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5',
  sleep: 'M5 9h5l-5 6h5M13 5h4l-4 5h4',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z',
} as const;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, className = 'icon'): SVGSVGElement {
  return s(
    'svg',
    { class: className, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
    s('path', { d: ICONS[name] }),
  );
}

/** A game emblem: path data on the manifest's 48×48 grid. */
export function emblem(pathData: string, className = 'emblem'): SVGSVGElement {
  return s(
    'svg',
    { class: className, viewBox: '0 0 48 48', 'aria-hidden': 'true', focusable: 'false' },
    s('path', { d: pathData }),
  );
}
