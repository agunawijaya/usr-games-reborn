import type { Appearance, PaletteId, ThemeId } from '../settings/settings';

/**
 * The colour and type tokens every screen and every native game draws with. Each theme is
 * designed twice, once per appearance; dark is never computed from light.
 *
 * Contract (checked by tokens.test.ts): every `ink*`, `accent*`, `mark` and status colour
 * reaches AA text contrast (4.5:1) on `bg`, `surface` and `surface2`; `accentInk` reaches it
 * on `accent`; `focus` and `lineStrong` reach 3:1 on `bg`.
 */
export interface ThemeTokens {
  bg: string;
  bg2: string;
  surface: string;
  surface2: string;
  line: string;
  lineStrong: string;
  ink: string;
  ink2: string;
  accent: string;
  accent2: string;
  accentInk: string;
  mark: string;
  good: string;
  warn: string;
  bad: string;
  glow: string;
  focus: string;
  shadow: string;
  fontBody: string;
  fontMono: string;
  fontDisplay: string;
  radius: string;
}

export type StatusColors = Pick<ThemeTokens, 'good' | 'warn' | 'bad'>;

export interface ThemeDefinition {
  id: PaletteId;
  name: string;
  /** One line shown in the theme picker. */
  mood: Record<Appearance, string>;
  tokens: Record<Appearance, ThemeTokens>;
  /** Blue/orange replacements for good/bad when the colour-blind palette is on. */
  colorBlind: Record<Appearance, StatusColors>;
}

const FONT_BODY = "'Atkinson Hyperlegible Next', 'Segoe UI', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace";

export const PHOSPHOR: ThemeDefinition = {
  id: 'phosphor',
  name: 'Phosphor',
  mood: {
    light: 'A sunlit lab: pale green glass and dark green type.',
    dark: 'A CRT at night: green and amber phosphor glowing in the dark.',
  },
  tokens: {
    light: {
      bg: '#dfe9e2',
      bg2: '#cfded4',
      surface: '#ecf3ee',
      surface2: '#f6faf7',
      line: '#b6c9bc',
      lineStrong: '#5c8a6d',
      ink: '#0b2e1b',
      ink2: '#2d5840',
      accent: '#0a6e38',
      accent2: '#8f4d00',
      accentInk: '#f1fbf4',
      mark: '#8f4d00',
      good: '#0a6a36',
      warn: '#7d5200',
      bad: '#ad2a1f',
      glow: '#7fdca4',
      focus: '#8f4d00',
      shadow: '#1d4630',
      fontBody: FONT_BODY,
      fontMono: FONT_MONO,
      fontDisplay: "'VT323', 'IBM Plex Mono', monospace",
      radius: '6px',
    },
    dark: {
      bg: '#040c07',
      bg2: '#08170e',
      surface: '#0a1710',
      surface2: '#0f2218',
      line: '#1b3a28',
      lineStrong: '#3a7d55',
      ink: '#c9f7d7',
      ink2: '#8ccca2',
      accent: '#5dff9a',
      accent2: '#ffb547',
      accentInk: '#03140a',
      mark: '#ffb547',
      good: '#5dff9a',
      warn: '#ffd166',
      bad: '#ff7d6e',
      glow: '#3dff88',
      focus: '#ffd166',
      shadow: '#000000',
      fontBody: FONT_BODY,
      fontMono: FONT_MONO,
      fontDisplay: "'VT323', 'IBM Plex Mono', monospace",
      radius: '6px',
    },
  },
  colorBlind: {
    light: { good: '#1c5aa3', warn: '#7d5200', bad: '#974811' },
    dark: { good: '#7fbcff', warn: '#ffd166', bad: '#ffab5e' },
  },
};

export const MANUAL: ThemeDefinition = {
  id: 'manual',
  name: 'Manual Page',
  mood: {
    light: 'A printed manual: warm paper, black serif headings, red section marks.',
    dark: 'The same manual under a desk lamp: ink-blue night and cream type.',
  },
  tokens: {
    light: {
      bg: '#efe7d8',
      bg2: '#e6dcc8',
      surface: '#faf6ee',
      surface2: '#fffdf8',
      line: '#d9cdb7',
      lineStrong: '#8a785a',
      ink: '#1a1611',
      ink2: '#4b4236',
      accent: '#a8231b',
      accent2: '#1d4c86',
      accentInk: '#fffaf2',
      mark: '#a8231b',
      good: '#2b672d',
      warn: '#7f5500',
      bad: '#a8231b',
      glow: '#f3dcaa',
      focus: '#1d4c86',
      shadow: '#5a4a30',
      fontBody: FONT_BODY,
      fontMono: FONT_MONO,
      fontDisplay: "'Source Serif 4 Variable', 'Source Serif 4', Georgia, serif",
      radius: '3px',
    },
    dark: {
      bg: '#0b1322',
      bg2: '#101b30',
      surface: '#121e35',
      surface2: '#182742',
      line: '#28385a',
      lineStrong: '#5a6f99',
      ink: '#f2e7d0',
      ink2: '#c9bca0',
      accent: '#ff8c72',
      accent2: '#f2c46d',
      accentInk: '#1a0d08',
      mark: '#ff8c72',
      good: '#93d69d',
      warn: '#f2c46d',
      bad: '#ff8c72',
      glow: '#ffcf7a',
      focus: '#f2c46d',
      shadow: '#02050c',
      fontBody: FONT_BODY,
      fontMono: FONT_MONO,
      fontDisplay: "'Source Serif 4 Variable', 'Source Serif 4', Georgia, serif",
      radius: '3px',
    },
  },
  colorBlind: {
    light: { good: '#1b56a0', warn: '#7f5500', bad: '#9b4813' },
    dark: { good: '#86bdfd', warn: '#f2c46d', bad: '#ffae63' },
  },
};

export const SUNSET: ThemeDefinition = {
  id: 'sunset',
  name: 'Sunset Lab',
  mood: {
    light: 'A 1970s campus lab at golden hour: sand, orange and teal.',
    dark: 'The same lab after dark: indigo, magenta and neon teal.',
  },
  tokens: {
    light: {
      bg: '#f3e2c2',
      bg2: '#efcd97',
      surface: '#fbf0da',
      surface2: '#fff8e9',
      line: '#e2c898',
      lineStrong: '#9c7038',
      ink: '#2a190c',
      ink2: '#5b3f25',
      accent: '#9e370e',
      accent2: '#0c6560',
      accentInk: '#fff6e8',
      mark: '#9e370e',
      good: '#2c6537',
      warn: '#7f4f00',
      bad: '#9f261d',
      glow: '#ffb867',
      focus: '#0c6560',
      shadow: '#6b3d12',
      fontBody: FONT_BODY,
      fontMono: FONT_MONO,
      fontDisplay: "'Fraunces Variable', 'Fraunces', Georgia, serif",
      radius: '14px',
    },
    dark: {
      bg: '#130e31',
      bg2: '#1c1446',
      surface: '#1b1542',
      surface2: '#241c55',
      line: '#382d74',
      lineStrong: '#7d62c6',
      ink: '#f4edff',
      ink2: '#c6bbeb',
      accent: '#ff62b6',
      accent2: '#3ef0d8',
      accentInk: '#1a0620',
      mark: '#ff62b6',
      good: '#6ff0a8',
      warn: '#ffc46b',
      bad: '#ff8193',
      glow: '#ff62b6',
      focus: '#3ef0d8',
      shadow: '#05020f',
      fontBody: FONT_BODY,
      fontMono: FONT_MONO,
      fontDisplay: "'Fraunces Variable', 'Fraunces', Georgia, serif",
      radius: '14px',
    },
  },
  colorBlind: {
    light: { good: '#1b55a0', warn: '#7f4f00', bad: '#934109' },
    dark: { good: '#86c1ff', warn: '#ffc46b', bad: '#ffae5e' },
  },
};

/**
 * Console Home: a modern console's home screen. Day is bright warm white with deep ink type;
 * night is near-black blue. The chrome stays calm so each game's own colour can bleed around
 * its key art.
 */
export const CONSOLE: ThemeDefinition = {
  id: 'console',
  name: 'Console Home',
  mood: {
    light: 'Bright warm white, deep ink type, every game in its own colour.',
    dark: 'Near-black blue with the games glowing in their own colours.',
  },
  tokens: {
    light: {
      bg: '#f8f6f2',
      bg2: '#efebe4',
      surface: '#ffffff',
      surface2: '#f4f1ec',
      line: '#e3ddd3',
      lineStrong: '#857d71',
      ink: '#14151c',
      ink2: '#4a4d59',
      accent: '#3f3fd6',
      accent2: '#a3195b',
      accentInk: '#ffffff',
      mark: '#a3195b',
      good: '#17773a',
      warn: '#855600',
      bad: '#b8202e',
      glow: '#ffd9a8',
      focus: '#3f3fd6',
      shadow: '#1c1a26',
      fontBody: FONT_BODY,
      fontMono: FONT_MONO,
      fontDisplay:
        "'Bricolage Grotesque Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif",
      radius: '16px',
    },
    dark: {
      bg: '#090d16',
      bg2: '#0e1422',
      surface: '#121a2a',
      surface2: '#192236',
      line: '#243049',
      lineStrong: '#5c6885',
      ink: '#eef1f8',
      ink2: '#aeb7cb',
      accent: '#98a6ff',
      accent2: '#ff94bd',
      accentInk: '#0a0e18',
      mark: '#ff94bd',
      good: '#74dd92',
      warn: '#ffd06e',
      bad: '#ff8f8f',
      glow: '#98a6ff',
      focus: '#ffd06e',
      shadow: '#000000',
      fontBody: FONT_BODY,
      fontMono: FONT_MONO,
      fontDisplay:
        "'Bricolage Grotesque Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif",
      radius: '16px',
    },
  },
  colorBlind: {
    light: { good: '#1b56a0', warn: '#855600', bad: '#9a4a0b' },
    dark: { good: '#86bdfd', warn: '#ffd06e', bad: '#ffae63' },
  },
};

/**
 * Holo Collection: games and achievements as collectible holographic cards. Day is pastel
 * paper (lilac, mint, peach) with crisp dark type; night is a deep plum table where the foil
 * catches the light.
 */
export const HOLO: ThemeDefinition = {
  id: 'holo',
  name: 'Holo Collection',
  mood: {
    light: 'Pastel paper in lilac, mint and peach, with crisp dark type.',
    dark: 'A deep plum table where every foil card catches the light.',
  },
  tokens: {
    light: {
      bg: '#f2edfa',
      bg2: '#e4f5ee',
      surface: '#fffdfb',
      surface2: '#fcefe8',
      line: '#e0d6ee',
      lineStrong: '#857aa2',
      ink: '#1d1530',
      ink2: '#4b4061',
      accent: '#6424d0',
      accent2: '#0c6b64',
      accentInk: '#ffffff',
      mark: '#b3165a',
      good: '#157038',
      warn: '#855600',
      bad: '#b01c1c',
      glow: '#f3cbff',
      focus: '#6424d0',
      shadow: '#3b2a5a',
      fontBody: FONT_BODY,
      fontMono: FONT_MONO,
      fontDisplay: "'Fredoka Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif",
      radius: '20px',
    },
    dark: {
      bg: '#190f2e',
      bg2: '#21133b',
      surface: '#24173e',
      surface2: '#2e1f4f',
      line: '#3e2c62',
      lineStrong: '#7f6aae',
      ink: '#f7f1ff',
      ink2: '#cbbfe7',
      accent: '#c6a4ff',
      accent2: '#80e9cb',
      accentInk: '#190f2e',
      mark: '#ffa0d0',
      good: '#88eeae',
      warn: '#fcd67a',
      bad: '#ff9d9d',
      glow: '#e9d5ff',
      focus: '#80e9cb',
      shadow: '#07030f',
      fontBody: FONT_BODY,
      fontMono: FONT_MONO,
      fontDisplay: "'Fredoka Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif",
      radius: '20px',
    },
  },
  colorBlind: {
    light: { good: '#1b56a0', warn: '#855600', bad: '#9a4a0b' },
    dark: { good: '#8cc4ff', warn: '#fcd67a', bad: '#ffb46a' },
  },
};

/** The Machine Room's palettes. */
export const THEMES: Readonly<Record<ThemeId, ThemeDefinition>> = {
  phosphor: PHOSPHOR,
  manual: MANUAL,
  sunset: SUNSET,
};

/** Every palette, keyed by id: the Machine Room's three and the two style signatures. */
export const PALETTES: Readonly<Record<PaletteId, ThemeDefinition>> = {
  ...THEMES,
  console: CONSOLE,
  holo: HOLO,
};
