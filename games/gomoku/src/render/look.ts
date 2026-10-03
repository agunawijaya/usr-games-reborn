/**
 * Fivefold's two appearances, each designed on its own. Zen Sand is a stone garden in the morning:
 * the grid raked into pale sand, river pebbles of slate and quartz. Lantern Lake is a still lake at
 * night: the grid drawn in light on the water, floating lanterns of warm amber and cool moonlight.
 * Every colour the canvas draws comes from here; the screens around it take theirs from
 * `src/ui/fivefold.css`.
 *
 * The first player's pieces (black in the original) are slate by day and amber by night.
 */

export type LookId = 'sand' | 'lake';

/** The colours of one side's pieces and of the threats it makes. */
export interface Side {
  /** What the screens call this side's pieces. */
  name: string;
  body: string;
  shade: string;
  light: string;
  detail: string;
  /** Threat lines and the rings at the points that complete them. */
  threat: string;
  threatGlow: string;
}

export interface Look {
  id: LookId;
  dark: boolean;
  /** The ground around the board: sand by day, water by night, top to bottom. */
  ground: readonly [string, string];
  /** The board's own surface, a shade apart from the ground. */
  bed: string;
  bedEdge: string;
  /** Grid lines: grooves in the sand, or lines of light on the water. */
  line: string;
  lineShade: string;
  lineGlow: number;
  starPoint: string;
  coordinate: string;
  /** Sand grooves around the garden, and their sunlit lip. */
  groove: string;
  grooveLight: string;
  /** Rocks and moss (by day), or the far shore (by night). */
  rock: readonly [string, string, string];
  moss: readonly [string, string];
  sky: readonly [string, string, string];
  star: string;
  moon: string;
  shore: readonly [string, string];
  ripple: string;
  pieces: readonly [Side, Side];
  /** Halo around a lantern, by side (night only). */
  halo: readonly [string, string];
  lastMove: string;
  cursor: string;
  winLine: string;
  winGlow: string;
  shadow: string;
}

const ZEN_SAND: Look = {
  id: 'sand',
  dark: false,
  ground: ['#e9dfca', '#e2d6bd'],
  bed: '#efe7d5',
  bedEdge: '#8f8a80',
  line: 'rgba(116, 92, 56, 0.42)',
  lineShade: 'rgba(255, 251, 240, 0.9)',
  lineGlow: 0,
  starPoint: 'rgba(104, 80, 46, 0.55)',
  coordinate: '#6a5a3f',
  groove: 'rgba(122, 98, 60, 0.26)',
  grooveLight: 'rgba(255, 252, 243, 0.75)',
  rock: ['#8c887f', '#64615b', '#b5b1a6'],
  moss: ['#8d9a62', '#6c7a45'],
  sky: ['#e9dfca', '#e9dfca', '#e9dfca'],
  star: '#ffffff',
  moon: '#ffffff',
  shore: ['#e2d6bd', '#e2d6bd'],
  ripple: 'rgba(122, 98, 60, 0.3)',
  pieces: [
    {
      name: 'Slate',
      body: '#3c444d',
      shade: '#1f252c',
      light: '#76838f',
      detail: 'rgba(150, 165, 178, 0.22)',
      threat: '#1d5fb0',
      threatGlow: 'rgba(80, 150, 255, 0.55)',
    },
    {
      name: 'Quartz',
      body: '#f4efe7',
      shade: '#cbc0b1',
      light: '#ffffff',
      detail: 'rgba(214, 170, 160, 0.4)',
      threat: '#c2410c',
      threatGlow: 'rgba(255, 140, 70, 0.5)',
    },
  ],
  halo: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
  lastMove: '#d9480f',
  cursor: '#a8320a',
  winLine: '#fffbe8',
  winGlow: 'rgba(246, 190, 70, 0.9)',
  shadow: 'rgba(84, 62, 30, 0.34)',
};

const LANTERN_LAKE: Look = {
  id: 'lake',
  dark: true,
  ground: ['#0c1730', '#050a17'],
  bed: 'rgba(4, 9, 22, 0.55)',
  bedEdge: 'rgba(120, 170, 255, 0.22)',
  line: 'rgba(150, 196, 255, 0.62)',
  lineShade: 'rgba(90, 150, 255, 0.5)',
  lineGlow: 6,
  starPoint: '#cfe2ff',
  coordinate: '#8ea9d8',
  groove: 'rgba(0,0,0,0)',
  grooveLight: 'rgba(0,0,0,0)',
  rock: ['#0b1224', '#070c19', '#16213c'],
  moss: ['#0b1224', '#0b1224'],
  sky: ['#03050f', '#0a1230', '#1b2b57'],
  star: '#e4ecff',
  moon: '#f5f1e2',
  shore: ['#050915', '#081024'],
  ripple: 'rgba(160, 200, 255, 0.10)',
  pieces: [
    {
      name: 'Amber',
      body: '#ffad42',
      shade: '#c96a12',
      light: '#fff1c8',
      detail: '#5a2f0e',
      threat: '#ffc35a',
      threatGlow: 'rgba(255, 170, 60, 0.8)',
    },
    {
      name: 'Moonlight',
      body: '#d9e6ff',
      shade: '#8ea6d8',
      light: '#ffffff',
      detail: '#2a3654',
      threat: '#8edcff',
      threatGlow: 'rgba(110, 200, 255, 0.8)',
    },
  ],
  halo: ['rgba(255, 160, 60, 0.42)', 'rgba(160, 200, 255, 0.36)'],
  lastMove: '#ffffff',
  cursor: '#ffe08a',
  winLine: '#fff6d8',
  winGlow: 'rgba(255, 205, 110, 0.95)',
  shadow: 'rgba(0, 0, 0, 0.5)',
};

export function lookFor(dark: boolean): Look {
  return dark ? LANTERN_LAKE : ZEN_SAND;
}
