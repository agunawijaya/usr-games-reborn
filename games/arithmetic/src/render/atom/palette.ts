/**
 * Atom's two looks. Clean Room: a white and mint lab behind frosted glass, pastel atoms with
 * crisp rims. Particle Night: a deep indigo chamber where atoms glow like plasma and bonds are
 * threads of light. Every atom always carries its prime as a numeral, so colour is never the
 * only way to tell them apart.
 */

export interface AtomPalette {
  readonly background: readonly [string, string];
  readonly vignette: string;
  readonly grid: string;
  readonly panel: string;
  readonly panelRim: string;
  readonly ring: string;
  readonly ringGlow: string;
  readonly tick: string;
  readonly readoutFace: string;
  readonly readoutRim: string;
  readonly bond: string;
  readonly label: string;
  readonly labelOnCore: string;
  readonly dust: string;
  readonly tile: string;
  readonly tileInk: string;
  /** Lightness and chroma of atom colours, as OKLCH-ish HSL settings. */
  readonly atomSaturation: number;
  readonly atomLightness: number;
  readonly glow: boolean;
}

export const CLEAN_ROOM: AtomPalette = {
  background: ['#eef8f4', '#cfe9df'],
  vignette: 'rgba(40, 100, 85, 0.16)',
  grid: 'rgba(30, 140, 112, 0.1)',
  panel: 'rgba(255, 255, 255, 0.72)',
  panelRim: 'rgba(255, 255, 255, 1)',
  ring: 'rgba(24, 132, 108, 0.7)',
  ringGlow: 'rgba(80, 210, 175, 0.18)',
  tick: 'rgba(30, 110, 92, 0.5)',
  readoutFace: 'rgba(255, 255, 255, 0.82)',
  readoutRim: 'rgba(32, 140, 115, 0.45)',
  bond: 'rgba(40, 70, 80, 0.4)',
  label: '#10302a',
  labelOnCore: '#0d2522',
  dust: 'rgba(40, 160, 130, 0.22)',
  tile: 'rgba(255, 255, 255, 0.9)',
  tileInk: '#10302a',
  atomSaturation: 80,
  atomLightness: 68,
  glow: false,
};

export const PARTICLE_NIGHT: AtomPalette = {
  background: ['#0d0a2a', '#05041a'],
  vignette: 'rgba(0, 0, 0, 0.55)',
  grid: 'rgba(130, 120, 255, 0.07)',
  panel: 'rgba(40, 34, 110, 0.32)',
  panelRim: 'rgba(150, 140, 255, 0.28)',
  ring: 'rgba(140, 160, 255, 0.65)',
  ringGlow: 'rgba(110, 120, 255, 0.28)',
  tick: 'rgba(170, 180, 255, 0.55)',
  readoutFace: 'rgba(18, 14, 52, 0.82)',
  readoutRim: 'rgba(150, 140, 255, 0.5)',
  bond: 'rgba(200, 220, 255, 0.55)',
  label: '#f2f0ff',
  labelOnCore: '#0b0920',
  dust: 'rgba(160, 170, 255, 0.35)',
  tile: 'rgba(28, 22, 80, 0.88)',
  tileInk: '#f2f0ff',
  atomSaturation: 92,
  atomLightness: 64,
  glow: true,
};

/** A hue for every prime: fixed for the small ones players meet most, spread for the rest. */
const HUES: Record<number, number> = {
  2: 192,
  3: 38,
  5: 318,
  7: 142,
  11: 266,
  13: 18,
  17: 172,
  19: 346,
  23: 84,
  29: 226,
  31: 52,
};

export function primeHue(prime: number): number {
  return HUES[prime] ?? (prime * 137.508) % 360;
}

export function atomColor(
  prime: number,
  palette: AtomPalette,
  lightness = palette.atomLightness,
): string {
  return `hsl(${primeHue(prime).toFixed(1)} ${palette.atomSaturation}% ${lightness}%)`;
}

export function atomColorAlpha(
  prime: number,
  palette: AtomPalette,
  a: number,
  lightness = palette.atomLightness,
): string {
  return `hsl(${primeHue(prime).toFixed(1)} ${palette.atomSaturation}% ${lightness}% / ${a})`;
}
