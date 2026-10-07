import { f1, linear, svg } from './kit.mjs';

/**
 * The flooding hold's water surface, drawn 1200 × 80 and stretched across the stage. The wavy
 * waterline is the top of the water itself: under it the water body is drawn here, lit near the
 * surface and fading out towards the bottom, where the room's flood colour takes over. The
 * surface rolls along one way with foam on its crests while ripple lines under it run the other
 * way, the whole surface heaving gently, with glints of torchlight.
 */

/**
 * A wavy line from one period before the left edge to one after the right, so that sliding it by
 * one period loops without a seam. Crests alternate tall and short, which makes the period two
 * wavelengths. Returns the line, and the same line closed down to `floor` as a filled body.
 */
function waveline({ amplitude, wavelength, base, floor = 80 }) {
  const period = wavelength * 2;
  let d = `M${-period},${base}`;
  for (let x = -period; x < 1200 + period; x += wavelength) {
    const tall = Math.round((x + period) / wavelength) % 2 === 0;
    const peak = base - amplitude * (tall ? 1 : 0.62);
    d += ` C${f1(x + wavelength * 0.28)},${f1(base)} ${f1(x + wavelength * 0.36)},${f1(peak)} ${f1(x + wavelength * 0.5)},${f1(peak)}`;
    d += ` C${f1(x + wavelength * 0.64)},${f1(peak)} ${f1(x + wavelength * 0.72)},${f1(base)} ${f1(x + wavelength)},${f1(base)}`;
  }
  const end = 1200 + period;
  return { period, line: d, body: `${d} L${end},${floor} L${-period},${floor} Z` };
}

/** A group that slides by one period forever, `direction` −1 to the left, +1 to the right. */
function travel(period, seconds, direction, inner) {
  return `<g>
    <animateTransform attributeName="transform" type="translate" from="0 0" to="${direction * period} 0" dur="${seconds}s" repeatCount="indefinite"/>
    ${inner}
  </g>`;
}

export function waterSurface({ id = 'ws' } = {}) {
  const p = id;
  const surface = waveline({ amplitude: 11, wavelength: 84, base: 46 });
  const sheen = waveline({ amplitude: 11, wavelength: 84, base: 53 });
  const ripples = [
    { wave: waveline({ amplitude: 5, wavelength: 58, base: 60 }), seconds: 3.4, opacity: 0.4 },
    { wave: waveline({ amplitude: 4, wavelength: 44, base: 70 }), seconds: 2.6, opacity: 0.26 },
  ];
  const glints = Array.from({ length: 16 }, (_, i) => {
    const x = 30 + i * 74 + (i % 3) * 13;
    const y = 52 + (i % 4) * 4;
    const dur = 1.8 + (i % 5) * 0.45;
    const begin = f1((i * 0.37) % dur);
    return `<path d="M${x},${y} l${12 + (i % 3) * 7},0" stroke="#fff6e0" stroke-width="2.2" stroke-linecap="round" opacity="0">
      <animate attributeName="opacity" values="0;0.9;0" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
      <animateTransform attributeName="transform" type="translate" values="0 0;${-(14 + (i % 4) * 5)} 0" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
    </path>`;
  }).join('');

  const body = `<defs>
      ${linear(`${p}-body`, [[0, '#4e76a0', 0.62], [0.25, '#34587e', 0.5], [1, '#1e3a58', 0]], { x1: 0, y1: 35, x2: 0, y2: 80, units: 'userSpaceOnUse' })}
    </defs>
    <g>
      <animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="3.9s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
      ${travel(surface.period, 4.2, -1, `<path d="${surface.body}" fill="url(#${p}-body)"/>
        <path d="${sheen.line}" fill="none" stroke="#a8c8e8" stroke-width="5" opacity="0.22"/>
        <path d="${surface.line}" fill="none" stroke="#dce8f4" stroke-width="2.6" stroke-linejoin="round" opacity="0.85"/>
        <path d="${surface.line}" fill="none" stroke="#ffffff" stroke-width="1" stroke-dasharray="26 58" opacity="0.9"/>`)}
      ${ripples
        .map(({ wave, seconds, opacity }) => travel(wave.period, seconds, 1, `<path d="${wave.line}" fill="none" stroke="#bcd4ec" stroke-width="1.6" opacity="${opacity}"/>`))
        .join('')}
      ${glints}
    </g>`;
  return svg('0 0 1200 80', body, { ratio: 'none' });
}
