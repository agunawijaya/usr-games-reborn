/**
 * The two beaches. Midday is the light appearance: turquoise water, white sand, a high sun.
 * Moonlit Tide is the dark one: a night beach where breaking waves glow and a lantern burns
 * inside the castle. Each is designed on its own; neither is the other inverted.
 */
export type Look = 'midday' | 'moonlit';

export type Rgb = readonly [number, number, number];

export interface BeachPalette {
  look: Look;
  skyTop: string;
  skyHorizon: string;
  haze: string;
  orb: string;
  orbGlow: string;
  seaDeep: string;
  seaMid: string;
  seaShallow: string;
  foam: string;
  glow: string;
  sandWet: string;
  sandDry: string;
  sandShade: string;
  sandLight: string;
  castleLight: string;
  castleMid: string;
  castleShadow: string;
  castleDeep: string;
  castleWet: string;
  moatWater: string;
  window: string;
  lantern: string;
  flag: string;
  flagShade: string;
  pole: string;
  shellPink: string;
  shellCream: string;
  pebble: string;
  crab: string;
  crabShade: string;
  gull: string;
  gullWing: string;
  island: string;
  headland: string;
  ink: string;
  inkSoft: string;
}

export const MIDDAY: BeachPalette = {
  look: 'midday',
  skyTop: '#3fb2ea',
  skyHorizon: '#cdeffa',
  haze: '#e9f8fc',
  orb: '#fffbe8',
  orbGlow: '#fff2b8',
  seaDeep: '#0d7fa6',
  seaMid: '#17a9c0',
  seaShallow: '#55dccb',
  foam: '#ffffff',
  glow: '#ffffff',
  sandWet: '#cfae80',
  sandDry: '#f6e8c9',
  sandShade: '#e6cfa2',
  sandLight: '#fff8e8',
  castleLight: '#fbe9c2',
  castleMid: '#ebcd96',
  castleShadow: '#cda56c',
  castleDeep: '#a07a48',
  castleWet: '#b48c58',
  moatWater: '#3cc4c8',
  window: '#5b3f22',
  lantern: '#ffe3a0',
  flag: '#ff5e4d',
  flagShade: '#d63f33',
  pole: '#a8743f',
  shellPink: '#ffc4bb',
  shellCream: '#fff3df',
  pebble: '#b9c3c8',
  crab: '#ec5b3a',
  crabShade: '#b8391f',
  gull: '#ffffff',
  gullWing: '#9fb0bb',
  island: '#7fb8c9',
  headland: '#6d8f7c',
  ink: '#123446',
  inkSoft: '#2f5566',
};

export const MOONLIT: BeachPalette = {
  look: 'moonlit',
  skyTop: '#050a1f',
  skyHorizon: '#1d2c5a',
  haze: '#2c3d6e',
  orb: '#f6f2df',
  orbGlow: '#a9bcff',
  seaDeep: '#051326',
  seaMid: '#0a2843',
  seaShallow: '#12485a',
  foam: '#a8cbe0',
  glow: '#48f3ff',
  sandWet: '#24263a',
  sandDry: '#5e5a72',
  sandShade: '#4a4760',
  sandLight: '#7d7894',
  castleLight: '#a29cb8',
  castleMid: '#7d7795',
  castleShadow: '#565170',
  castleDeep: '#3a3652',
  castleWet: '#4a4664',
  moatWater: '#0e3a52',
  window: '#ffc366',
  lantern: '#ffcf7a',
  flag: '#e06a5a',
  flagShade: '#a8473d',
  pole: '#6f5642',
  shellPink: '#d9b3c4',
  shellCream: '#e8e1ef',
  pebble: '#8a90a8',
  crab: '#e9e2d4',
  crabShade: '#b5ab99',
  gull: '#c9d2e6',
  gullWing: '#7f8aa6',
  island: '#16234a',
  headland: '#101a38',
  ink: '#eef3ff',
  inkSoft: '#c3cde6',
};

export function paletteFor(look: Look): BeachPalette {
  return look === 'moonlit' ? MOONLIT : MIDDAY;
}

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`;
}

export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const channel = (x: number, y: number) =>
    Math.round((x + (y - x) * t) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(ar, br)}${channel(ag, bg)}${channel(ab, bb)}`;
}
