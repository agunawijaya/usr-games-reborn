/** Sidewalk Chalk by day (the Hall's light appearance), Night Neon by night (dark). */
export type Look = 'chalk' | 'neon';

/** How a player's boxes are filled: never by colour alone. */
export type Fill = 'hatch' | 'stipple';

export interface PlayerColours {
  /** Lines and marks. */
  readonly ink: string;
  /** A paler or brighter partner for highlights and glow. */
  readonly glow: string;
}

export interface LookPalette {
  readonly ground: readonly [string, string];
  readonly groundDetail: string;
  readonly joint: string;
  readonly dot: string;
  readonly dotGlow: string;
  /** The lens: its tint, its border, a quieter tab for short chains, and the tab's text. */
  readonly lens: string;
  readonly lensEdge: string;
  readonly lensQuiet: string;
  readonly lensInk: string;
  readonly players: readonly [PlayerColours, PlayerColours];
  /** Lines nobody drew in this game: a puzzle's position, the Daily Board's opening. */
  readonly neutral: PlayerColours;
  readonly cut: string;
  readonly shade: string;
}

export const PALETTES: Readonly<Record<Look, LookPalette>> = {
  chalk: {
    ground: ['#dcd6ca', '#cfc8bb'],
    groundDetail: '#a49c8e',
    joint: '#958c7d',
    dot: '#fbf8f1',
    dotGlow: 'rgba(255, 255, 255, 0.5)',
    lens: '#ffdc5c',
    lensEdge: '#86620a',
    lensQuiet: '#f6e6b2',
    lensInk: '#4a3700',
    // Chalk dark enough to reach 3:1 on the whole pavement (see contrast.test.ts).
    players: [
      { ink: '#c43c27', glow: '#ff9d86' },
      { ink: '#1d63b4', glow: '#8cc6ff' },
    ],
    neutral: { ink: '#6d655a', glow: '#d9d2c4' },
    cut: '#3b2f22',
    shade: 'rgba(70, 58, 40, 0.28)',
  },
  neon: {
    ground: ['#120f24', '#0b0a17'],
    groundDetail: '#1d1936',
    joint: '#08070f',
    dot: '#e9f3ff',
    dotGlow: 'rgba(170, 210, 255, 0.55)',
    lens: '#ffe156',
    lensEdge: '#ffe156',
    lensQuiet: '#bfae5a',
    lensInk: '#2b2200',
    players: [
      { ink: '#ff4fa0', glow: '#ffb3d6' },
      { ink: '#35e0ff', glow: '#b8f6ff' },
    ],
    neutral: { ink: '#b9b2ff', glow: '#e6e2ff' },
    cut: '#ffffff',
    shade: 'rgba(0, 0, 0, 0.5)',
  },
};

/** Player 0 hatches its boxes; player 1 stipples them. */
export const FILLS: readonly [Fill, Fill] = ['hatch', 'stipple'];
