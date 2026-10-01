// trek/fancy-web — Galaxy and quadrant model
//
// BSD trek uses an 8×8 galaxy of quadrants, each an 10×10 sector grid.
// Klingons, starbases, and stars are seeded into random quadrants at
// game start. The player's ship (USS Enterprise) starts in a random
// safe quadrant.

export const GALAXY_SIZE = 8;
export const QUADRANT_SIZE = 10;

// Cell contents inside a quadrant sector.
export const CELL = {
  EMPTY: 0,
  ENTERPRISE: 1,
  KLINGON: 2,
  STARBASE: 3,
  STAR: 4,
};

// Enemy types and their stats. Each spawn rolls a type based on
// SPAWN_WEIGHTS; ships of different types have different energy pools
// and attack strength.
export const ENEMY = {
  WARSHIP:       'warship',
  BATTLECRUISER: 'battlecruiser',
  SUPER:         'super',
  WARBIRD:       'warbird',
};

export const ENEMY_STATS = {
  warship:       { name: 'Klingon Warship',       energy: [200, 400],  attack: [25, 65]  },
  battlecruiser: { name: 'Klingon Battlecruiser', energy: [450, 700],  attack: [40, 90]  },
  super:         { name: 'Klingon Super-Commander', energy: [900, 1200], attack: [70, 130] },
  warbird:       { name: 'Romulan Warbird',       energy: [350, 550],  attack: [35, 80]  },
};

// Weighted distribution — sum to 1.0. Basic warship most common, super
// commander rare, warbird occasional, battlecruiser medium.
const SPAWN_WEIGHTS = [
  { type: ENEMY.SUPER,         cum: 0.03 }, // 3%
  { type: ENEMY.WARBIRD,       cum: 0.13 }, // 10%
  { type: ENEMY.BATTLECRUISER, cum: 0.35 }, // 22%
  { type: ENEMY.WARSHIP,       cum: 1.00 }, // 65%
];

function pickEnemyType(rng) {
  const r = rng();
  for (const w of SPAWN_WEIGHTS) if (r < w.cum) return w.type;
  return ENEMY.WARSHIP;
}

// ---------------------------------------------------------------------------
// Deterministic RNG (Mulberry32)
// ---------------------------------------------------------------------------

export function makeRng(seed = 1) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Difficulty presets — tune Klingon count + stardate budget
// ---------------------------------------------------------------------------

export const DIFFICULTY = {
  novice:   { klingons: 8,  starbases: 3, stars: 20, stardates: 40, name: 'Novice',   desc: 'training run — 8 Klingons, 40 stardates' },
  standard: { klingons: 15, starbases: 4, stars: 25, stardates: 30, name: 'Standard', desc: '15 Klingons, tight schedule' },
  expert:   { klingons: 25, starbases: 3, stars: 30, stardates: 22, name: 'Expert',   desc: '25 Klingons, minimal time' },
};

// ---------------------------------------------------------------------------
// Build a fresh galaxy: 8×8 quadrant summaries with contents.
// ---------------------------------------------------------------------------

/** Create an empty quadrant summary. */
function emptyQuadrant() {
  return {
    klingons: 0,
    starbases: 0,
    stars: 0,
    scanned: false,
    contents: null,  // built lazily when entered
  };
}

/**
 * Randomly seed the galaxy with klingons, starbases, and stars.
 * Never places more than 3 klingons or 1 starbase per quadrant (playable).
 */
export function createGalaxy(rng, difficulty) {
  const cfg = DIFFICULTY[difficulty] || DIFFICULTY.standard;
  const galaxy = [];
  for (let y = 0; y < GALAXY_SIZE; y++) {
    galaxy.push([]);
    for (let x = 0; x < GALAXY_SIZE; x++) {
      galaxy[y].push(emptyQuadrant());
    }
  }

  // Distribute klingons across quadrants (max 3 per quadrant).
  let remaining = cfg.klingons;
  let safety = 500;
  while (remaining > 0 && safety-- > 0) {
    const qx = Math.floor(rng() * GALAXY_SIZE);
    const qy = Math.floor(rng() * GALAXY_SIZE);
    if (galaxy[qy][qx].klingons < 3) {
      galaxy[qy][qx].klingons++;
      remaining--;
    }
  }

  // Starbases (max 1 per quadrant, never in same quadrant as klingons).
  let bases = cfg.starbases;
  safety = 500;
  while (bases > 0 && safety-- > 0) {
    const qx = Math.floor(rng() * GALAXY_SIZE);
    const qy = Math.floor(rng() * GALAXY_SIZE);
    if (galaxy[qy][qx].starbases === 0 && galaxy[qy][qx].klingons === 0) {
      galaxy[qy][qx].starbases = 1;
      bases--;
    }
  }

  // Stars (obstacles, 1-9 per quadrant, distributed uniformly)
  let stars = cfg.stars;
  safety = 1000;
  while (stars > 0 && safety-- > 0) {
    const qx = Math.floor(rng() * GALAXY_SIZE);
    const qy = Math.floor(rng() * GALAXY_SIZE);
    if (galaxy[qy][qx].stars < 9) {
      galaxy[qy][qx].stars++;
      stars--;
    }
  }

  return {
    quadrants: galaxy,
    difficulty: difficulty,
    config: cfg,
    totalKlingons: cfg.klingons,
    totalStarbases: cfg.starbases,
    stardateStart: 3200 + Math.floor(rng() * 500),  // classic trek stardate range
    stardateBudget: cfg.stardates,
  };
}

// ---------------------------------------------------------------------------
// Materialise a quadrant's sector grid on first entry.
// Klingons, starbase, stars get concrete sector positions.
// ---------------------------------------------------------------------------

/** Random unoccupied sector inside a quadrant. */
function pickEmptySector(sectors, rng) {
  let safety = 500;
  while (safety-- > 0) {
    const sx = Math.floor(rng() * QUADRANT_SIZE);
    const sy = Math.floor(rng() * QUADRANT_SIZE);
    if (sectors[sy][sx] === CELL.EMPTY) return { x: sx, y: sy };
  }
  return null;
}

export function populateQuadrant(galaxy, qx, qy, rng, enterprisePos = null) {
  const q = galaxy.quadrants[qy][qx];
  if (q.contents) return q.contents;

  // Empty sector grid.
  const sectors = [];
  for (let y = 0; y < QUADRANT_SIZE; y++) {
    sectors.push(new Array(QUADRANT_SIZE).fill(CELL.EMPTY));
  }

  const contents = {
    sectors,
    klingons: [],
    starbase: null,
    stars: [],
  };

  // Enterprise (if entering this quadrant)
  if (enterprisePos) {
    sectors[enterprisePos.y][enterprisePos.x] = CELL.ENTERPRISE;
  }

  // Place klingons (varied enemy types)
  for (let i = 0; i < q.klingons; i++) {
    const pos = pickEmptySector(sectors, rng);
    if (!pos) break;
    sectors[pos.y][pos.x] = CELL.KLINGON;
    const type = pickEnemyType(rng);
    const stats = ENEMY_STATS[type];
    const [eLo, eHi] = stats.energy;
    contents.klingons.push({
      id: `K${qx}${qy}-${i}`,
      sx: pos.x,
      sy: pos.y,
      type,
      energy: eLo + Math.floor(rng() * (eHi - eLo)),
      attack: stats.attack,
      destroyed: false,
    });
  }

  // Place starbase
  if (q.starbases > 0) {
    const pos = pickEmptySector(sectors, rng);
    if (pos) {
      sectors[pos.y][pos.x] = CELL.STARBASE;
      contents.starbase = { sx: pos.x, sy: pos.y };
    }
  }

  // Place stars
  for (let i = 0; i < q.stars; i++) {
    const pos = pickEmptySector(sectors, rng);
    if (!pos) break;
    sectors[pos.y][pos.x] = CELL.STAR;
    contents.stars.push({ sx: pos.x, sy: pos.y });
  }

  q.contents = contents;
  q.scanned = true;
  return contents;
}

// ---------------------------------------------------------------------------
// Coordinate arithmetic helpers
// ---------------------------------------------------------------------------

export function clampQuadrant(x, y) {
  return {
    x: Math.max(0, Math.min(GALAXY_SIZE - 1, x)),
    y: Math.max(0, Math.min(GALAXY_SIZE - 1, y)),
  };
}

export function clampSector(x, y) {
  return {
    x: Math.max(0, Math.min(QUADRANT_SIZE - 1, x)),
    y: Math.max(0, Math.min(QUADRANT_SIZE - 1, y)),
  };
}

/** Chebyshev distance between two sectors. */
export function sectorDist(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Manhattan distance for stardate consumption. */
export function quadDist(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
