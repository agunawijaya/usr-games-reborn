import { s } from '../../ui/h';

/** Console Home's own glyphs on a 24×24 grid, stroked like the shared interface icons. */
const PATHS = {
  flame:
    'M12 3c1.2 3.6 5 5.4 5 10.2a5 5 0 0 1-10 0c0-2.3 1.2-4 2.6-5.2.2 1.9 1 3.1 2.3 3.5C11 9 11.2 6.1 12 3z',
  quests: 'M5 21V4M5 4h11.5l-2.2 4 2.2 4H5',
  styles: 'M12 3l9 5-9 5-9-5 9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5',
  play: 'M8 5.5l10.5 6.5L8 18.5z',
  more: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 11v5.5M12 7.6h.01',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  back: 'M20 12H5M11 6l-6 6 6 6',
  chevron: 'M6 9.5l6 6 6-6',
  trophy:
    'M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5.5a3 3 0 0 0 2.7 4M16 6h2.5a3 3 0 0 1-2.7 4M12 13v4M8.5 20h7M10 17h4',
  lock: 'M7 11h10v9H7zM9 11V8a3 3 0 0 1 6 0v3',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 2',
  settings: 'M4 7h9M17 7h3M15 4.5v5M4 17h3M11 17h9M9 14.5v5',
  sun: 'M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9M12 2v2.2M12 19.8V22M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2 12h2.2M19.8 12H22M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5',
  moon: 'M20 14.6A8 8 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z',
  device: 'M4 5h16v11H4zM9 20h6M12 16v4',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
} as const;

export type ConsoleIcon = keyof typeof PATHS;

export function glyph(name: ConsoleIcon, className = 'ch-icon'): SVGSVGElement {
  return s(
    'svg',
    { class: className, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
    s('path', { d: PATHS[name] }),
  );
}
