/**
 * Sinkers' two appearances, each designed on its own: Sunlit Tank, a bright aquarium by day, and
 * Abyss Glow, the deep sea at night where the sinkers light themselves. Every colour the canvas
 * draws comes from here; the screens around it take theirs from `src/ui/sinkers.css`.
 *
 * A sinker's colour says how deep it is, never which shape it is: the depth ramp runs from the
 * shallows at the top of the tank to the deep at the bottom. Its shape is told by the glyph etched
 * into its cells.
 */

export type LookId = 'sunlit' | 'abyss';

export interface Look {
  id: LookId;
  dark: boolean;
  /** Open water, top to bottom. */
  waterTop: string;
  waterMid: string;
  waterDeep: string;
  /** The light that plays on the back glass and through the water. */
  caustic: string;
  causticStrength: number;
  ray: string;
  rayStrength: number;
  sand: readonly [string, string, string];
  sandShade: string;
  pebble: readonly string[];
  plant: readonly string[];
  plantTip: string;
  fish: readonly string[];
  /** Marine snow and plankton (the deep sea's own light), or null by day. */
  snow: string | null;
  plankton: string | null;
  /** The tank: inside of the glass, its edge and its shine. */
  tankWater: string;
  tankWaterDeep: string;
  glass: string;
  glassEdge: string;
  glassShine: string;
  rim: string;
  rimLight: string;
  gauge: string;
  gaugeInk: string;
  /** Sinker colours from shallow to deep. */
  depth: readonly string[];
  /** How much a sinker glows from within: none by day. */
  glow: number;
  sinkerEdge: string;
  sinkerShine: string;
  etch: string;
  etchShadow: string;
  sonar: string;
  bubble: string;
  bubbleRim: string;
  bubbleShine: string;
  popInk: string;
  popOutline: string;
  murk: string;
  /** Coral to clear: its body, its shade and the polyps that dot it. */
  coral: string;
  coralShade: string;
  coralPolyp: string;
  /** Seaweed set in a dive's tank. */
  kelp: string;
  kelpShade: string;
  kelpLeaf: string;
  /** The streaks of a current across its row. */
  current: string;
  /** The dark of a night tank, lit only by the falling sinker. */
  night: string;
}

export const SUNLIT_TANK: Look = {
  id: 'sunlit',
  dark: false,
  waterTop: '#8fe6ea',
  waterMid: '#3fb9cc',
  waterDeep: '#1d7f9e',
  caustic: '#f4fffc',
  causticStrength: 0.34,
  ray: '#fffbe0',
  rayStrength: 0.22,
  sand: ['#f2d9a6', '#e3c189', '#c99f68'],
  sandShade: '#a77f4f',
  pebble: ['#fff4e2', '#d7c2a5', '#a99476', '#f6c7b7'],
  plant: ['#3f9b5a', '#5cbc69', '#2f7d4d', '#86cf6d'],
  plantTip: '#b6ec8a',
  fish: ['#ff8a3d', '#ffc94a', '#ff6f91', '#7a8cff'],
  snow: null,
  plankton: null,
  tankWater: 'rgba(214, 252, 255, 0.34)',
  tankWaterDeep: 'rgba(120, 214, 236, 0.30)',
  glass: 'rgba(255, 255, 255, 0.16)',
  glassEdge: 'rgba(255, 255, 255, 0.85)',
  glassShine: 'rgba(255, 255, 255, 0.55)',
  rim: '#2b6f86',
  rimLight: '#a8eef4',
  gauge: 'rgba(16, 70, 92, 0.55)',
  gaugeInk: '#0f4a5f',
  depth: ['#9ff3d6', '#6fe0d0', '#58c7f2', '#5f9cff', '#7e7dff', '#a86cf0', '#d067d9'],
  glow: 0,
  sinkerEdge: 'rgba(14, 54, 86, 0.55)',
  sinkerShine: '#ffffff',
  etch: 'rgba(255, 255, 255, 0.85)',
  etchShadow: 'rgba(10, 40, 70, 0.35)',
  sonar: '#ffffff',
  bubble: 'rgba(255, 255, 255, 0.16)',
  bubbleRim: 'rgba(255, 255, 255, 0.85)',
  bubbleShine: '#ffffff',
  popInk: '#ffffff',
  popOutline: '#0f4a6b',
  murk: 'rgba(84, 108, 96, 0.62)',
  coral: '#ff8a72',
  coralShade: '#c9503f',
  coralPolyp: '#ffe2c9',
  kelp: '#3f8f4e',
  kelpShade: '#24613a',
  kelpLeaf: '#7fcf6a',
  current: 'rgba(255, 255, 255, 0.75)',
  night: 'rgba(6, 22, 38, 0.9)',
};

export const ABYSS_GLOW: Look = {
  id: 'abyss',
  dark: true,
  waterTop: '#0f2a52',
  waterMid: '#0a1838',
  waterDeep: '#040817',
  caustic: '#6fd8ff',
  causticStrength: 0.08,
  ray: '#5fb8ff',
  rayStrength: 0.05,
  sand: ['#1b2440', '#151b32', '#0e1224'],
  sandShade: '#080b17',
  pebble: ['#2a3558', '#20294a', '#323f6a', '#2c2950'],
  plant: ['#173a4a', '#1d4a52', '#14303f', '#22535a'],
  plantTip: '#5ef2d0',
  fish: ['#ffd36b', '#7cf2ff', '#ff8ad8'],
  snow: 'rgba(214, 232, 255, 0.55)',
  plankton: '#5ef2d0',
  tankWater: 'rgba(40, 90, 160, 0.16)',
  tankWaterDeep: 'rgba(20, 40, 110, 0.22)',
  glass: 'rgba(140, 200, 255, 0.07)',
  glassEdge: 'rgba(150, 215, 255, 0.55)',
  glassShine: 'rgba(170, 225, 255, 0.28)',
  rim: '#0b1630',
  rimLight: '#3d6fae',
  gauge: 'rgba(150, 210, 255, 0.35)',
  gaugeInk: '#9fd6ff',
  depth: ['#7cffd9', '#47f0e6', '#4cc8ff', '#5d8dff', '#8a6bff', '#c25dff', '#ff5fd2'],
  glow: 1,
  sinkerEdge: 'rgba(4, 8, 30, 0.7)',
  sinkerShine: '#eaffff',
  etch: 'rgba(255, 255, 255, 0.9)',
  etchShadow: 'rgba(0, 0, 20, 0.5)',
  sonar: '#7cf2ff',
  bubble: 'rgba(120, 220, 255, 0.10)',
  bubbleRim: 'rgba(170, 235, 255, 0.75)',
  bubbleShine: '#eaffff',
  popInk: '#ffffff',
  popOutline: '#1b1250',
  murk: 'rgba(10, 14, 34, 0.7)',
  coral: '#ff6fa8',
  coralShade: '#8a2a6a',
  coralPolyp: '#ffd1ec',
  kelp: '#1f6a5c',
  kelpShade: '#0f3a3a',
  kelpLeaf: '#48e0b0',
  current: 'rgba(124, 242, 255, 0.6)',
  night: 'rgba(1, 3, 12, 0.94)',
};

export function lookFor(dark: boolean): Look {
  return dark ? ABYSS_GLOW : SUNLIT_TANK;
}

export const FONT_DISPLAY = '"Fraunces Variable", "Fraunces", Georgia, serif';
export const FONT_UI = '"Atkinson Hyperlegible Next", system-ui, sans-serif';
export const FONT_DATA = '"IBM Plex Mono", ui-monospace, monospace';

/** The colour for a depth, as a share from the top of the tank (0) to the bottom (1). */
export function depthColour(look: Look, share: number): string {
  const ramp = look.depth;
  const at = Math.min(0.9999, Math.max(0, share)) * (ramp.length - 1);
  const i = Math.floor(at);
  return mix(ramp[i]!, ramp[i + 1]!, at - i);
}

export function mix(a: string, b: string, t: number): string {
  const pa = parse(a);
  const pb = parse(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i]! - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function parse(colour: string): [number, number, number] {
  if (colour.startsWith('#')) {
    const n = Number.parseInt(colour.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = /rgba?\(([^)]+)\)/.exec(colour);
  const [r = 0, g = 0, b = 0] = (m?.[1] ?? '').split(',').map((v) => Number.parseFloat(v));
  return [r, g, b];
}

export function withAlpha(colour: string, alpha: number): string {
  const [r, g, b] = parse(colour);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function lighten(colour: string, amount: number): string {
  return mix(colour, '#ffffff', amount);
}

export function darken(colour: string, amount: number): string {
  return mix(colour, '#000814', amount);
}
