import { svg } from './dom';

/**
 * Line icons on a 24-unit grid, drawn in the current text colour: one per mode and a few for the
 * menus. Each is decorative; the label beside it says what it is.
 */

export type IconName =
  'sums' | 'split' | 'sieve' | 'spell' | 'album' | 'training' | 'help' | 'settings' | 'clock';

const PATHS: Record<IconName, string> = {
  sums: 'M3.5 7h6M6.5 4v6M14.5 7h6M4 15l5 5M9 15l-5 5M14.5 17.5h6M17.5 14.6v.1M17.5 20.4v.1',
  split: 'M12 3.5v4M12 7.5l-6 5M12 7.5l6 5M6 12.5l-3 6M6 12.5l3 6M18 12.5v6',
  sieve:
    'M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM16 10h4v4h-4zM10 16h4v4h-4zM10.5 10.5l3 3M13.5 10.5l-3 3M4.5 16.5l3 3M7.5 16.5l-3 3M16.5 16.5l3 3M19.5 16.5l-3 3',
  spell: 'M3 6.5h7v11H3zM14 6.5h7v11h-7zM5.5 14.5l1-5 1 5M5.8 13h1.5M16.5 9.5h2l-2 5h2',
  album:
    'M12 13.5a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM9 12.5 7.5 21l4.5-2.5 4.5 2.5L15 12.5M12 6.5v4M10.5 7.5 12 6.5',
  training: 'M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6M17.5 3.5v3.2h-3.2M6.5 20.5v-3.2h3.2',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8v.5M12 17v.1',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
  clock: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M10 2.5h4',
};

export function icon(name: IconName, className = 'ns-icon'): SVGSVGElement {
  return svg(
    'svg',
    {
      class: className,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    },
    svg('path', { d: PATHS[name] }),
  );
}
