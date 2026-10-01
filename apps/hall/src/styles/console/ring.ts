import { s } from '../../ui/h';

/**
 * The big level ring: a track, an arc for progress through the level, and room in the middle
 * for the number. Drawn in SVG so it stays crisp at any size. The arc's path length is 100, so
 * `--ch-ring-fill` is simply a percentage the rank-up moment can animate without redrawing.
 */

export function levelRing(fraction: number, className = 'ch-ring'): SVGSVGElement {
  const percent = Math.min(1, Math.max(0, fraction)) * 100;
  return s(
    'svg',
    {
      class: className,
      viewBox: '0 0 100 100',
      'aria-hidden': 'true',
      focusable: 'false',
      style: { '--ch-ring-fill': percent.toFixed(2) },
    },
    s('circle', { class: 'ch-ring__track', cx: '50', cy: '50', r: '44', pathLength: '100' }),
    s('circle', { class: 'ch-ring__arc', cx: '50', cy: '50', r: '44', pathLength: '100' }),
  );
}
