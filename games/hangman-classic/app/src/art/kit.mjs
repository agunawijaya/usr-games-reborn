/**
 * Small helpers shared by the scene painters. Every picture in the game is an SVG string built
 * here, so it can be injected inline (and animated by CSS) or written out as a file to look at.
 */

/** Wraps markup in an <svg> element. `ratio` is the preserveAspectRatio value. */
export function svg(viewBox, body, { ratio = 'xMidYMid meet', label = '' } = {}) {
  const aria = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="${ratio}" ${aria}>${body}</svg>`;
}

/** A seeded generator (mulberry32), so procedural details are the same on every load. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const f1 = (n) => Math.round(n * 10) / 10;

/** A linear gradient; `stops` is a list of [offset, colour, opacity?]. */
export function linear(id, stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1, units = '' } = {}) {
  const u = units ? ` gradientUnits="${units}"` : '';
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${u}>${stopList(stops)}</linearGradient>`;
}

export function radial(id, stops, { cx = 0.5, cy = 0.5, r = 0.5, fx, fy, units = '' } = {}) {
  const focus = fx !== undefined ? ` fx="${fx}" fy="${fy}"` : '';
  const u = units ? ` gradientUnits="${units}"` : '';
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${focus}${u}>${stopList(stops)}</radialGradient>`;
}

function stopList(stops) {
  return stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a === 1 ? '' : ` stop-opacity="${a}"`}/>`)
    .join('');
}

/** A soft blur, for shadows and glows. */
export function blur(id, amount) {
  return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${amount}"/></filter>`;
}

/**
 * Grain laid over whatever it filters: fine noise darkens and lightens the fill a little, so a
 * flat colour reads as cloth, bone or wood. `strength` is how much the noise shows.
 */
export function grain(id, { frequency = 0.8, octaves = 3, strength = 0.35, seed = 2 } = {}) {
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="${octaves}" seed="${seed}" result="noise"/>
    <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${-2 * strength} ${strength}" result="shade"/>
    <feComposite in="shade" in2="SourceGraphic" operator="in" result="shadeIn"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="shadeIn"/></feMerge>
  </filter>`;
}

/**
 * A bone or any rounded rod drawn in three strokes: the ink outline, the body, and a thin
 * highlight along its lit side.
 */
export function rod(d, { width, ink, body, light, lightWidth = width * 0.28, shift = -width * 0.18 }) {
  return `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${f1(width + 3)}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${body}" stroke-width="${f1(width)}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${light}" stroke-width="${f1(lightWidth)}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${f1(shift)} ${f1(shift)})" opacity="0.8"/>`;
}

/** The blur filters `paint` uses for its soft strokes: `${prefix}-b1` … `${prefix}-b12`. */
export function brushes(prefix) {
  return [1, 2, 4, 6, 7, 12].map((n) => blur(`${prefix}-b${n}`, n)).join('');
}

/**
 * A shape painted the way an illustrator would: a base fill, then soft shadow and light
 * strokes kept inside the silhouette (airbrushed with a blur), then the ink line on top.
 * Each stroke is { d, c (colour), w (width, 0 for a filled shape), o (opacity), b (blur) }.
 */
export function paint(prefix, key, d, { fill, ink, line = 2.2, strokes = [], filter = '', after = '' }) {
  const clip = `${prefix}-clip-${key}`;
  const marks = strokes
    .map(({ d: sd, c, w = 0, o = 0.6, b = 4, cap = 'round', blend = '' }) => {
      const paintAttr = w ? `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="${cap}" stroke-linejoin="round"` : `fill="${c}"`;
      const blurAttr = b ? ` filter="url(#${prefix}-b${b})"` : '';
      const blendAttr = blend ? ` style="mix-blend-mode:${blend}"` : '';
      return `<path d="${sd}" ${paintAttr} opacity="${o}"${blurAttr}${blendAttr}/>`;
    })
    .join('');
  const filterAttr = filter ? ` filter="${filter}"` : '';
  const inkLine = line ? `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${line}" stroke-linejoin="round" stroke-linecap="round"/>` : '';
  return `<clipPath id="${clip}"><path d="${d}"/></clipPath>
    <path d="${d}" fill="${fill}"${filterAttr}/>
    <g clip-path="url(#${clip})">${marks}${after}</g>${inkLine}`;
}

/** Points as an SVG path through them (straight segments). */
export function poly(points, close = true) {
  return `M${points.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' L')}${close ? ' Z' : ''}`;
}

/** A ragged edge between two points: little teeth of cloth, seeded. */
export function ragged(from, to, rand, { teeth = 8, depth = 14 } = {}) {
  const points = [];
  for (let i = 0; i <= teeth; i++) {
    const t = i / teeth;
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t;
    const out = i % 2 === 1 ? depth * (0.55 + rand() * 0.7) : rand() * depth * 0.25;
    points.push([x + (rand() - 0.5) * 3, y + out]);
  }
  return points;
}
