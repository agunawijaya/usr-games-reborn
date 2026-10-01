import { describe, expect, it } from 'vitest';
import {
  initGame,
  movePlayer,
  nextLevel,
  teleport,
  waitUntilResolved,
} from '../src/game/engine';
import { RNG } from '../src/game/rng';
import {
  DIRECTIONS,
  GRID_HEIGHT,
  GRID_WIDTH,
  MAX_ROBOTS,
  ROBOTS_PER_LEVEL,
  ROBOT_SCORE,
  type GameState,
  type Position,
  type Robot,
} from '../src/game/state';

// Fixed seed so every test run is deterministic.
const seededRng = () => new RNG(42);

type RobotLike = Position | Robot;
type BuildOverrides = Partial<Omit<GameState, 'robots'>> & {
  robots?: readonly RobotLike[];
};

// Helper to build a synthetic state (bypasses initGame's random placement).
// Accepts robots as bare {x,y} for terse tests; auto-assigns sequential IDs.
function buildState(overrides: BuildOverrides = {}): GameState {
  const baseRobots: readonly Robot[] = (overrides.robots ?? []).map(
    (r, i): Robot => ('id' in r ? (r as Robot) : { id: i, x: r.x, y: r.y }),
  );
  const base: GameState = {
    level: 1,
    score: 0,
    player: { x: 30, y: 11 },
    robots: baseRobots,
    piles: [],
    waitBonus: 0,
    status: 'playing',
  };
  return { ...base, ...overrides, robots: baseRobots };
}

describe('initGame', () => {
  it('places level * 10 robots on level 1 (per spec §State Variables)', () => {
    const s = initGame(1, seededRng());
    expect(s.robots).toHaveLength(1 * ROBOTS_PER_LEVEL);
  });

  it('places 40 robots on level 4 and clamps thereafter (spec: min(level*10, 40))', () => {
    const s4 = initGame(4, seededRng());
    const s5 = initGame(5, seededRng());
    expect(s4.robots).toHaveLength(MAX_ROBOTS);
    expect(s5.robots).toHaveLength(MAX_ROBOTS);
  });

  it('places all entities inside field bounds', () => {
    const s = initGame(3, seededRng());
    const inBounds = (p: Position) =>
      p.x >= 0 && p.x < GRID_WIDTH && p.y >= 0 && p.y < GRID_HEIGHT;
    expect(inBounds(s.player)).toBe(true);
    for (const r of s.robots) expect(inBounds(r)).toBe(true);
  });

  it('places player on a cell distinct from every robot', () => {
    const s = initGame(3, seededRng());
    for (const r of s.robots) {
      expect(r.x === s.player.x && r.y === s.player.y).toBe(false);
    }
  });

  it('places robots on distinct cells', () => {
    const s = initGame(4, seededRng());
    const keys = new Set(s.robots.map((r) => `${r.x},${r.y}`));
    expect(keys.size).toBe(s.robots.length);
  });

  it('rejects level < 1', () => {
    expect(() => initGame(0, seededRng())).toThrow(RangeError);
    expect(() => initGame(-1, seededRng())).toThrow(RangeError);
  });

  it('starts with score 0, waitBonus 0, status playing, no piles', () => {
    const s = initGame(2, seededRng());
    expect(s.score).toBe(0);
    expect(s.waitBonus).toBe(0);
    expect(s.status).toBe('playing');
    expect(s.piles).toEqual([]);
  });
});

describe('movePlayer — single step', () => {
  it('moves the player by the direction delta', () => {
    const s = buildState({ player: { x: 5, y: 5 } });
    const { state, outcome } = movePlayer(s, DIRECTIONS.right);
    expect(state.player).toEqual({ x: 6, y: 5 });
    expect(outcome).toBe('moved');
  });

  it('supports diagonal moves', () => {
    const s = buildState({ player: { x: 5, y: 5 } });
    const { state } = movePlayer(s, DIRECTIONS.upRight);
    expect(state.player).toEqual({ x: 6, y: 4 });
  });

  it('rejects moves out of bounds (state unchanged)', () => {
    const s = buildState({ player: { x: 0, y: 0 } });
    const { state, outcome } = movePlayer(s, DIRECTIONS.upLeft);
    expect(state).toBe(s);
    expect(outcome).toBe('invalid');
  });

  it('stay direction consumes a turn without moving', () => {
    const s = buildState({
      player: { x: 5, y: 5 },
      robots: [{ x: 5, y: 3 }],
    });
    const { state } = movePlayer(s, DIRECTIONS.stay);
    // Player position unchanged.
    expect(state.player).toEqual({ x: 5, y: 5 });
    // But robots advanced one step toward player.
    expect(state.robots[0]).toMatchObject({ x: 5, y: 4 });
  });

  it('stepping onto a robot kills the player', () => {
    const s = buildState({
      player: { x: 5, y: 5 },
      robots: [{ x: 6, y: 5 }],
    });
    const { state, outcome } = movePlayer(s, DIRECTIONS.right);
    expect(outcome).toBe('died');
    expect(state.status).toBe('dead');
  });

  it('stepping onto a pile kills the player', () => {
    const s = buildState({
      player: { x: 5, y: 5 },
      piles: [{ x: 6, y: 5 }],
    });
    const { state, outcome } = movePlayer(s, DIRECTIONS.right);
    expect(outcome).toBe('died');
    expect(state.status).toBe('dead');
  });
});

describe('robot AI — each robot moves 1 step toward the player', () => {
  it('robot approaches player using sign(dx), sign(dy)', () => {
    const s = buildState({
      player: { x: 10, y: 10 },
      robots: [{ x: 5, y: 5 }],
    });
    const { state } = movePlayer(s, DIRECTIONS.stay);
    expect(state.robots[0]).toMatchObject({ x: 6, y: 6 });
  });

  it('robot moves purely in y when aligned in x', () => {
    const s = buildState({
      player: { x: 5, y: 10 },
      robots: [{ x: 5, y: 3 }],
    });
    const { state } = movePlayer(s, DIRECTIONS.stay);
    expect(state.robots[0]).toMatchObject({ x: 5, y: 4 });
  });

  it('robot moves diagonally away from own quadrant toward player', () => {
    const s = buildState({
      player: { x: 5, y: 5 },
      robots: [{ x: 8, y: 8 }],
    });
    const { state } = movePlayer(s, DIRECTIONS.stay);
    expect(state.robots[0]).toMatchObject({ x: 7, y: 7 });
  });

  it('robot landing on player kills the player', () => {
    const s = buildState({
      player: { x: 5, y: 5 },
      robots: [{ x: 5, y: 4 }], // one step above player
    });
    const { state, outcome } = movePlayer(s, DIRECTIONS.stay);
    expect(outcome).toBe('died');
    expect(state.status).toBe('dead');
  });
});

describe('collisions', () => {
  it('two robots meeting on the same cell both die and form one pile', () => {
    const s = buildState({
      player: { x: 5, y: 5 },
      // Both robots are to the LEFT of player; after player moves right
      // to (6, 5), both robots target (4, 5) — a cross-fire meeting point
      // in front of the player, not on the player's new cell.
      robots: [
        { x: 3, y: 4 },
        { x: 3, y: 6 },
      ],
    });
    const { state, outcome, destroyed } = movePlayer(s, DIRECTIONS.right);
    expect(outcome).toBe('level-clear');
    expect(destroyed).toBe(2);
    expect(state.robots).toHaveLength(0);
    expect(state.piles).toHaveLength(1);
    expect(state.piles[0]).toEqual({ x: 4, y: 5 });
    expect(state.score).toBe(2 * ROBOT_SCORE);
  });

  it('robot walking onto existing pile dies (pile persists, robot added to scrap)', () => {
    const s = buildState({
      player: { x: 10, y: 10 },
      robots: [{ x: 6, y: 6 }], // will move to (7, 7)
      piles: [{ x: 7, y: 7 }],
    });
    const { state, outcome, destroyed } = movePlayer(s, DIRECTIONS.stay);
    expect(outcome).toBe('level-clear');
    expect(destroyed).toBe(1);
    expect(state.robots).toHaveLength(0);
    expect(state.piles).toHaveLength(1); // pile did not grow
  });
});

describe('score & level progression', () => {
  it('adds ROBOT_SCORE per robot destroyed', () => {
    const s = buildState({
      player: { x: 5, y: 20 },
      // Both robots target (5, 4) after one turn — cross-fire collision.
      robots: [
        { x: 4, y: 3 },
        { x: 6, y: 3 },
      ],
    });
    const { state, destroyed } = movePlayer(s, DIRECTIONS.stay);
    expect(destroyed).toBe(2);
    expect(state.score).toBe(2 * ROBOT_SCORE);
  });

  it('nextLevel preserves cumulative score and initializes next level with more robots', () => {
    const s = buildState({ level: 2, score: 250, status: 'level-clear' });
    const next = nextLevel(s, seededRng());
    expect(next.level).toBe(3);
    expect(next.score).toBe(250); // score carries forward
    expect(next.robots).toHaveLength(3 * ROBOTS_PER_LEVEL);
    expect(next.status).toBe('playing');
  });
});

describe('teleport', () => {
  it('moves player to a cell not occupied by a robot or pile', () => {
    const s = buildState({
      player: { x: 5, y: 5 },
      robots: [{ x: 10, y: 10 }],
      piles: [{ x: 15, y: 15 }],
    });
    const { state } = teleport(s, seededRng());
    // Not on a robot.
    for (const r of state.robots) {
      expect(state.player.x === r.x && state.player.y === r.y).toBe(false);
    }
    // Not on a pile.
    for (const p of state.piles) {
      expect(state.player.x === p.x && state.player.y === p.y).toBe(false);
    }
  });

  it('advances robots after teleport (turn is consumed)', () => {
    const s = buildState({
      player: { x: 5, y: 5 },
      robots: [{ x: 30, y: 15 }],
    });
    const beforeRobot = s.robots[0];
    const { state } = teleport(s, seededRng());
    expect(state.robots[0]).not.toEqual(beforeRobot);
  });

  it('is a no-op when the game is already over', () => {
    const s = buildState({ status: 'dead' });
    const { state, outcome } = teleport(s, seededRng());
    expect(outcome).toBe('invalid');
    expect(state).toBe(s);
  });
});

describe('waitUntilResolved', () => {
  it('kills the player when robots reach them during a wait', () => {
    const s = buildState({
      player: { x: 5, y: 5 },
      robots: [
        { x: 5, y: 1 },
        { x: 5, y: 3 },
      ],
    });
    // Robots march down toward player over successive turns; second robot
    // reaches (5, 5) on turn 2 and lands on the player.
    const { state, outcome } = waitUntilResolved(s);
    expect(outcome).toBe('died');
    expect(state.status).toBe('dead');
  });

  it('clears the level when robots collide before reaching the player', () => {
    const s = buildState({
      player: { x: 3, y: 22 }, // far from robots so they collide first
      robots: [
        { x: 2, y: 3 }, // targets (3, 4)
        { x: 4, y: 3 }, // also targets (3, 4)
      ],
    });
    const { state, outcome, destroyed } = waitUntilResolved(s);
    expect(outcome).toBe('level-clear');
    expect(destroyed).toBe(2);
    expect(state.robots).toHaveLength(0);
    // Level clear applies wait bonus: 2 robots × 10 score + waitBonus (2).
    expect(state.score).toBe(2 * ROBOT_SCORE + 2);
  });

  it('is a no-op when game is over', () => {
    const s = buildState({ status: 'dead' });
    const { state, outcome } = waitUntilResolved(s);
    expect(outcome).toBe('invalid');
    expect(state).toBe(s);
  });
});
