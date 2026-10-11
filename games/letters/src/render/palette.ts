import type { AppearanceState } from '@usr-games/kit';

/**
 * The two looks, each designed for its own light. Studio is a bright set of pastel cubes on a
 * cream tray under soft lamps; Arcade Glow is glass blocks lit from inside over a slow aurora.
 * Colours are hex strings for the DOM and RGB triples (0–1) for the shaders.
 */
export type Look = 'studio' | 'arcade';

export type Rgb = [number, number, number];

export interface Palette {
  look: Look;
  /** Background gradient, top and bottom. */
  skyTop: string;
  skyBottom: string;
  /** Studio: the lamp's pool of light; Arcade: the aurora's three colours. */
  glowA: string;
  glowB: string;
  glowC: string;
  tray: string;
  trayWell: string;
  trayEdge: string;
  /** One colour per cube, picked so neighbours differ. */
  cubes: readonly string[];
  letter: string;
  /** The traced chain: ribbon gradient, its highlight, and the glow it gives cubes. */
  ribbonFrom: string;
  ribbonTo: string;
  ribbonShine: string;
  traceGlow: string;
  shadow: string;
  /** Text on the play screen. */
  ink: string;
  inkSoft: string;
  panel: string;
  panelEdge: string;
  accent: string;
  accentInk: string;
  good: string;
  warn: string;
  /** The reveal's web: words found, and words missed. */
  webFound: string;
  webMissed: string;
}

export const STUDIO: Palette = {
  look: 'studio',
  skyTop: '#ffd8c2',
  skyBottom: '#fff0cf',
  glowA: '#fffaf0',
  glowB: '#ffc9b0',
  glowC: '#c9ecdc',
  tray: '#f6e6cf',
  trayWell: '#ead2b2',
  trayEdge: '#d9b98f',
  cubes: ['#ffb894', '#a6e3c6', '#ffdc80', '#acd2ff', '#d9c6ff'],
  letter: '#2f2140',
  ribbonFrom: '#ff6a5c',
  ribbonTo: '#ff7fb0',
  ribbonShine: '#fff3ea',
  traceGlow: '#ff8a5c',
  shadow: '#7a4630',
  ink: '#2f2140',
  inkSoft: '#5d4a63',
  panel: '#fffaf2',
  panelEdge: '#ecd6bd',
  accent: '#d9472f',
  accentInk: '#ffffff',
  good: '#1f7a52',
  warn: '#a24a00',
  webFound: '#e2533f',
  webMissed: '#7a5a8c',
};

export const ARCADE: Palette = {
  look: 'arcade',
  skyTop: '#0a0d24',
  skyBottom: '#170a2c',
  glowA: '#23e0c4',
  glowB: '#7a5cff',
  glowC: '#ff4fb0',
  tray: '#0f1334',
  trayWell: '#151a44',
  trayEdge: '#3cf2ff',
  cubes: ['#5ee7ff', '#b28cff', '#ff7ad9', '#7dffb5', '#ffd36e'],
  letter: '#fff7e6',
  ribbonFrom: '#3cf2ff',
  ribbonTo: '#ff4fd8',
  ribbonShine: '#ffffff',
  traceGlow: '#3cf2ff',
  shadow: '#000000',
  ink: '#f4f1ff',
  inkSoft: '#c3bde6',
  panel: '#12163a',
  panelEdge: '#2c3270',
  accent: '#5ff4ff',
  accentInk: '#081024',
  good: '#7dffb5',
  warn: '#ffd36e',
  webFound: '#5ff4ff',
  webMissed: '#c08bff',
};

export function lookOf(appearance: Pick<AppearanceState, 'appearance'>): Look {
  return appearance.appearance === 'dark' ? 'arcade' : 'studio';
}

export function paletteFor(look: Look): Palette {
  return look === 'arcade' ? ARCADE : STUDIO;
}

export function rgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex).map((channel) => Math.round(channel * 255));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
