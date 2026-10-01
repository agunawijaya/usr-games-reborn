// Canonical grid dimensions from `bsdgames/robots/docs/spec.md` §State Variables.
// Y_FIELDSIZE = 23, X_FIELDSIZE = 60. Do not change without updating the spec.
export const GRID_WIDTH = 60;
export const GRID_HEIGHT = 23;

// Robots per level and cap, per spec:
//   Num_robots = min(Level * 10, MAX_ROBOTS)
export const ROBOTS_PER_LEVEL = 10;
export const MAX_ROBOTS = 40;

// Score per robot destroyed (spec §Scoring — ROB_SCORE = 10).
export const ROBOT_SCORE = 10;

export type Position = Readonly<{ x: number; y: number }>;

// A robot has a stable ID assigned at level init. IDs persist across
// robot moves so that rendering-layer animation can identify "the same
// robot" between frames. Not part of the spec — a port implementation
// detail (see docs/decisions/001-tech-stack.md).
export type Robot = Readonly<{ id: number; x: number; y: number }>;

export type GameStatus = 'playing' | 'dead' | 'level-clear' | 'quit';

export type GameState = Readonly<{
  level: number;
  score: number;
  player: Position;
  robots: readonly Robot[];
  piles: readonly Position[];
  waitBonus: number;
  status: GameStatus;
}>;

// Direction as a delta vector (dx, dy in {-1, 0, 1}).
export type Direction = Readonly<{ dx: -1 | 0 | 1; dy: -1 | 0 | 1 }>;

export const DIRECTIONS = {
  up:        { dx:  0, dy: -1 },
  down:      { dx:  0, dy:  1 },
  left:      { dx: -1, dy:  0 },
  right:     { dx:  1, dy:  0 },
  upLeft:    { dx: -1, dy: -1 },
  upRight:   { dx:  1, dy: -1 },
  downLeft:  { dx: -1, dy:  1 },
  downRight: { dx:  1, dy:  1 },
  stay:      { dx:  0, dy:  0 },
} as const satisfies Record<string, Direction>;

export type DirectionName = keyof typeof DIRECTIONS;
