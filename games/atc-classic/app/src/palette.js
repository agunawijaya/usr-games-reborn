// Control Room 1986 — the radar's colours, and the contrast arithmetic that keeps its lettering
// readable. tests/contrast.test.js checks every colour the radar writes text in against the
// screen behind it; the page's own text is checked in the browser (e2e/polish.spec.ts).

export const RADAR_BACKGROUND = '#040805';
export const PHOSPHOR = '#5eff8a';
export const PHOSPHOR_DIM = '#2a8a45';
export const PHOSPHOR_BRIGHT = '#c8ffdc';
export const PHOSPHOR_AMBER = '#ffb14f';
export const PHOSPHOR_RED = '#ff5252';
/** The range rings' and the compass card's numbers: quieter than the traffic, still AA. */
export const RADAR_SCALE_TEXT = 'rgba(94, 255, 138, 0.62)';

/** Every colour the radar writes text in, by what it labels. */
export const RADAR_LETTERING = {
  'exit numbers': PHOSPHOR_DIM,
  'beacon numbers': PHOSPHOR,
  'airport names': PHOSPHOR_DIM,
  'range and bearing numbers': RADAR_SCALE_TEXT,
  'planes, marked': PHOSPHOR_BRIGHT,
  'planes, unmarked': PHOSPHOR,
  'planes, ignored': PHOSPHOR_DIM,
  'planes, low on fuel': PHOSPHOR_RED,
  'planes on the ground': PHOSPHOR_AMBER,
  'arrival stamps': PHOSPHOR_BRIGHT,
};

/** [r, g, b, a] from `#rrggbb` or `rgb(a)(…)`. */
export function parseColour(colour) {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i.exec(colour);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
  throw new Error(`Not a colour: ${colour}`);
}

/** A colour laid over an opaque background, as [r, g, b]. */
export function over(colour, background) {
  const [r, g, b, a] = parseColour(colour);
  const [br, bg, bb] = parseColour(background);
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
}

function luminance([r, g, b]) {
  const channel = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** The WCAG contrast ratio of text in `foreground` (possibly translucent) on an opaque `background`. */
export function contrastRatio(foreground, background) {
  const a = luminance(over(foreground, background));
  const b = luminance(over(background, background));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
