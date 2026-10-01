// trek/fancy-web — Core game engine
//
// Turn-based space combat. Each command advances stardate. Klingons fire
// back when the player is in their quadrant. Victory = destroy all
// klingons. Loss = fuel out, ship destroyed, or stardate budget exhausted.

import {
  GALAXY_SIZE, QUADRANT_SIZE, CELL, DIFFICULTY,
  ENEMY_STATS,
  createGalaxy, populateQuadrant, makeRng,
  clampQuadrant, clampSector, sectorDist, quadDist,
} from './galaxy.js';

export const SYS = {
  WARP: 'warp',
  IMPULSE: 'impulse',
  PHASERS: 'phasers',
  TORPEDOES: 'torpedoes',
  SHIELDS: 'shields',
  SENSORS: 'sensors',
  COMPUTER: 'computer',
  LIFE_SUPPORT: 'lifeSupport',
};

export const SYSTEM_ORDER = [
  SYS.WARP, SYS.IMPULSE, SYS.PHASERS, SYS.TORPEDOES,
  SYS.SHIELDS, SYS.SENSORS, SYS.COMPUTER, SYS.LIFE_SUPPORT,
];

const INITIAL_ENERGY = 10000;
const INITIAL_SHIELDS = 1500;
const INITIAL_TORPEDOES = 10;
const INITIAL_HULL = 100;

// ---------------------------------------------------------------------------
// Game state factory
// ---------------------------------------------------------------------------

export function createGame(opts = {}) {
  const difficulty = opts.difficulty || 'standard';
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const rng = makeRng(seed);
  const galaxy = createGalaxy(rng, difficulty);

  // Start position: random SAFE quadrant (no klingons)
  let startQx, startQy;
  let safety = 200;
  do {
    startQx = Math.floor(rng() * GALAXY_SIZE);
    startQy = Math.floor(rng() * GALAXY_SIZE);
    safety--;
  } while (safety > 0 && galaxy.quadrants[startQy][startQx].klingons > 0);

  // Random sector inside quadrant (avoid stars)
  const startSx = 4 + Math.floor(rng() * 2);
  const startSy = 4 + Math.floor(rng() * 2);

  const game = {
    rng,
    seed,
    difficulty,
    galaxy,
    stardate: galaxy.stardateStart,
    stardateEnd: galaxy.stardateStart + galaxy.stardateBudget,

    ship: {
      qx: startQx,
      qy: startQy,
      sx: startSx,
      sy: startSy,
      energy: INITIAL_ENERGY,
      shields: 0,          // start with shields down; player must raise
      shieldsMax: INITIAL_SHIELDS,
      shieldsUp: false,
      torpedoes: INITIAL_TORPEDOES,
      hull: INITIAL_HULL,
      docked: false,
      systems: Object.fromEntries(SYSTEM_ORDER.map(s => [s, 0])),  // 0 = OK, higher = more damage
    },

    kills: 0,
    klingonsRemaining: galaxy.totalKlingons,
    starbasesRemaining: galaxy.totalStarbases,

    won: false,
    lost: false,
    lostReason: null,

    events: [],       // rolling log of major happenings
  };

  // Materialise start quadrant
  populateQuadrant(galaxy, startQx, startQy, rng, { x: startSx, y: startSy });

  logEvent(game, 'meta', `USS Enterprise assumes command, stardate ${game.stardate.toFixed(1)}`);
  logEvent(game, 'meta', `Mission: destroy ${galaxy.totalKlingons} Klingons by stardate ${game.stardateEnd.toFixed(1)}`);
  autoScanNeighbours(game);

  return game;
}

// ---------------------------------------------------------------------------
// Event log
// ---------------------------------------------------------------------------

function logEvent(game, tag, msg) {
  game.events.push({ tag, msg, stardate: game.stardate });
  while (game.events.length > 40) game.events.shift();
}

// ---------------------------------------------------------------------------
// Long-range scan of neighbouring quadrants (auto every move)
// ---------------------------------------------------------------------------

function autoScanNeighbours(game) {
  const { qx, qy } = game.ship;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = qx + dx, ny = qy + dy;
      if (nx < 0 || nx >= GALAXY_SIZE || ny < 0 || ny >= GALAXY_SIZE) continue;
      game.galaxy.quadrants[ny][nx].scanned = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentQuadrant(game) {
  return game.galaxy.quadrants[game.ship.qy][game.ship.qx];
}

function currentContents(game) {
  const q = currentQuadrant(game);
  if (!q.contents) populateQuadrant(game.galaxy, game.ship.qx, game.ship.qy, game.rng, {
    x: game.ship.sx, y: game.ship.sy,
  });
  return q.contents;
}

function livingKlingons(game) {
  const contents = currentContents(game);
  return contents.klingons.filter(k => !k.destroyed);
}

/** Advance stardate. Trigger loss if budget exceeded. */
function advanceStardate(game, amount) {
  game.stardate += amount;
  if (game.stardate >= game.stardateEnd && !game.won && !game.lost) {
    endLoss(game, 'stardate budget exhausted — Federation defeated');
  }
}

function endLoss(game, reason) {
  game.lost = true;
  game.lostReason = reason;
  logEvent(game, 'loss', `LOSS: ${reason}`);
}

function endWin(game) {
  game.won = true;
  logEvent(game, 'win', `VICTORY: all Klingons destroyed at stardate ${game.stardate.toFixed(1)}`);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Execute a parsed command.
 * @param cmd { action: string, ...args }
 * @returns { ok: bool, error?: string, effects?: [{type,...}] }
 */
export function executeCommand(game, cmd) {
  if (game.lost || game.won) return { ok: false, error: 'Game over.' };
  const effects = [];

  switch (cmd.action) {
    case 'phaser': return doPhaser(game, cmd.energy, effects);
    case 'torpedo': return doTorpedo(game, cmd.bearing, effects);
    case 'move': return doMove(game, cmd.course, cmd.warp, effects);
    case 'srscan': return { ok: true, effects: [{ type: 'srscan' }] };
    case 'lrscan': return doLrscan(game);
    case 'damages': return { ok: true, effects: [{ type: 'damages', systems: game.ship.systems }] };
    case 'dock': return doDock(game, effects);
    case 'shieldUp': return doShields(game, true, effects);
    case 'shieldDown': return doShields(game, false, effects);
    case 'shieldTransfer': return doShieldTransfer(game, cmd.amount, effects);
    case 'computer': return { ok: true, effects: [{ type: 'computer', ship: game.ship }] };
    case 'quit': return { ok: true, effects: [{ type: 'quit' }] };
    default:
      return { ok: false, error: `Unknown action: ${cmd.action}` };
  }
}

// ---------------------------------------------------------------------------
// Phasers — fire at all klingons in current quadrant
// ---------------------------------------------------------------------------

function doPhaser(game, energy, effects) {
  if (energy <= 0) return { ok: false, error: 'Phaser energy must be > 0' };
  if (energy > game.ship.energy) return { ok: false, error: `Only ${game.ship.energy} energy available` };

  const targets = livingKlingons(game);
  if (targets.length === 0) return { ok: false, error: 'No hostiles in this quadrant' };

  if (game.ship.systems[SYS.PHASERS] > 3) {
    return { ok: false, error: 'Phasers damaged — cannot fire' };
  }

  game.ship.energy -= energy;
  const perTarget = energy / targets.length;
  const dmgs = [];
  for (const k of targets) {
    const dist = sectorDist({x: game.ship.sx, y: game.ship.sy}, {x: k.sx, y: k.sy});
    const attenuation = Math.max(0.2, 1 - dist * 0.06);
    const damageDealt = Math.floor(perTarget * attenuation);
    k.energy -= damageDealt;
    // Include type + destroyed flag so the renderer can play the
    // right explosion sprite at the target position, even though the
    // engine's `destroyed` state removes the ship from the sector map
    // on the same tick.
    const entry = { target: k.id, sx: k.sx, sy: k.sy, damage: damageDealt, destroyed: false, type: k.type };
    if (k.energy <= 0) {
      k.destroyed = true;
      entry.destroyed = true;
      game.kills++;
      game.klingonsRemaining--;
      currentQuadrant(game).klingons--;
      currentContents(game).sectors[k.sy][k.sx] = CELL.EMPTY;
      const typeName = ENEMY_STATS[k.type]?.name || 'Klingon';
      logEvent(game, 'kill', `${typeName} ${k.id} destroyed at (${k.sx},${k.sy})`);
    }
    dmgs.push(entry);
  }
  effects.push({ type: 'phaser', energy, damages: dmgs });
  logEvent(game, 'phaser', `Phasers fire ${energy} units → ${targets.length} target(s)`);

  // Klingons return fire
  klingonReturnFire(game, effects);
  advanceStardate(game, 0.1);

  if (game.klingonsRemaining <= 0) endWin(game);
  return { ok: true, effects };
}

// ---------------------------------------------------------------------------
// Photon torpedoes — trajectory from ship at bearing angle
// ---------------------------------------------------------------------------

/**
 * Bearing = angle in 0..12 units (like a clock face, but 12 = due right = E,
 * 3 = down = S, 6 = W, 9 = N in BSD convention). We convert to radians.
 * For simplicity: 0 = E (right), increasing counter-clockwise.
 */
function bearingToVector(bearing) {
  // BSD trek convention: 0.0 = East, 3.0 = North, 6.0 = West, 9.0 = South.
  // Convert bearing (0..12) to radians (0 = right, CCW).
  const rad = (bearing / 12) * Math.PI * 2;
  return { dx: Math.cos(rad), dy: -Math.sin(rad) };
}

function doTorpedo(game, bearing, effects) {
  if (game.ship.torpedoes <= 0) return { ok: false, error: 'No torpedoes remaining' };
  if (game.ship.systems[SYS.TORPEDOES] > 3) return { ok: false, error: 'Torpedo bays damaged' };
  if (game.ship.energy < 50) return { ok: false, error: 'Insufficient energy for launch' };

  game.ship.torpedoes--;
  game.ship.energy -= 50;
  const contents = currentContents(game);
  const { dx, dy } = bearingToVector(bearing);

  // Step-trace along trajectory
  let x = game.ship.sx + 0.5, y = game.ship.sy + 0.5;
  const trail = [];
  let hit = null;
  let miss = false;

  for (let step = 0; step < QUADRANT_SIZE * 3; step++) {
    x += dx * 0.5;
    y += dy * 0.5;
    const sx = Math.floor(x), sy = Math.floor(y);
    if (sx < 0 || sx >= QUADRANT_SIZE || sy < 0 || sy >= QUADRANT_SIZE) {
      miss = true;
      break;
    }
    trail.push({ x, y });
    if (sx === game.ship.sx && sy === game.ship.sy) continue; // don't hit self
    const cell = contents.sectors[sy][sx];
    if (cell === CELL.EMPTY) continue;
    hit = { sx, sy, cell };
    break;
  }

  effects.push({ type: 'torpedo', bearing, trail, hit, miss });

  if (miss) {
    logEvent(game, 'miss', `Torpedo missed at bearing ${bearing.toFixed(1)}`);
  } else if (hit.cell === CELL.KLINGON) {
    const k = contents.klingons.find(kl => kl.sx === hit.sx && kl.sy === hit.sy && !kl.destroyed);
    if (k) {
      k.destroyed = true;
      game.kills++;
      game.klingonsRemaining--;
      currentQuadrant(game).klingons--;
      contents.sectors[hit.sy][hit.sx] = CELL.EMPTY;
      // Attach destroyed-target info to the effect so the renderer can
      // play an explosion sprite at the exact hit cell.
      const lastEffect = effects[effects.length - 1];
      if (lastEffect && lastEffect.type === 'torpedo') {
        lastEffect.destroyedKlingon = { sx: k.sx, sy: k.sy, type: k.type };
      }
      const typeName = ENEMY_STATS[k.type]?.name || 'Klingon';
      logEvent(game, 'kill', `Torpedo destroys ${typeName} ${k.id}`);
    }
  } else if (hit.cell === CELL.STAR) {
    logEvent(game, 'miss', `Torpedo struck a star at (${hit.sx},${hit.sy})`);
    // Stars absorb torpedoes silently
  } else if (hit.cell === CELL.STARBASE) {
    logEvent(game, 'miss', `WARNING: torpedo destroyed starbase!`);
    contents.sectors[hit.sy][hit.sx] = CELL.EMPTY;
    contents.starbase = null;
    currentQuadrant(game).starbases = 0;
    game.starbasesRemaining--;
  }

  klingonReturnFire(game, effects);
  advanceStardate(game, 0.1);

  if (game.klingonsRemaining <= 0) endWin(game);
  return { ok: true, effects };
}

// ---------------------------------------------------------------------------
// Move — either warp (between quadrants) or impulse (within sector)
// course: 0..12 clock direction like torpedo bearing
// warp: 0.5..8 — warp factor. Below 1 = impulse within sector.
// ---------------------------------------------------------------------------

function doMove(game, course, warp, effects) {
  if (warp <= 0 || warp > 8) return { ok: false, error: 'Warp factor 0.5 to 8' };
  if (game.ship.systems[SYS.WARP] > 5 && warp > 1) {
    return { ok: false, error: 'Warp engines damaged — impulse only' };
  }

  const energyCost = Math.floor(warp * warp * 10);
  if (energyCost > game.ship.energy) {
    return { ok: false, error: `Insufficient energy (need ${energyCost}, have ${game.ship.energy})` };
  }

  const { dx, dy } = bearingToVector(course);

  if (warp < 1) {
    // Impulse — sector-level movement
    const distance = Math.floor(warp * 8);
    const newSx = Math.max(0, Math.min(QUADRANT_SIZE - 1, Math.round(game.ship.sx + dx * distance)));
    const newSy = Math.max(0, Math.min(QUADRANT_SIZE - 1, Math.round(game.ship.sy + dy * distance)));
    const contents = currentContents(game);
    // Check destination not blocked
    if (contents.sectors[newSy][newSx] !== CELL.EMPTY && contents.sectors[newSy][newSx] !== CELL.ENTERPRISE) {
      return { ok: false, error: 'Destination sector occupied' };
    }
    contents.sectors[game.ship.sy][game.ship.sx] = CELL.EMPTY;
    game.ship.sx = newSx;
    game.ship.sy = newSy;
    contents.sectors[newSy][newSx] = CELL.ENTERPRISE;
    game.ship.energy -= energyCost;
    game.ship.docked = false;
    effects.push({ type: 'impulseMove', from: [game.ship.sx, game.ship.sy], to: [newSx, newSy] });
    logEvent(game, 'move', `Impulse to sector (${newSx},${newSy})`);
    klingonReturnFire(game, effects);
    advanceStardate(game, 0.3);
    return { ok: true, effects };
  }

  // Warp — quadrant-level jump. bearingToVector already returns dy in
  // game-coord orientation (dy > 0 = South, dy < 0 = North), matching
  // the impulse branch above. Add — don't subtract — or the ship
  // travels perpendicular / opposite of intent.
  const distance = warp;
  const newQx = Math.round(game.ship.qx + dx * distance);
  const newQy = Math.round(game.ship.qy + dy * distance);
  const c = clampQuadrant(newQx, newQy);
  if (c.x === game.ship.qx && c.y === game.ship.qy) {
    return { ok: false, error: 'Warp too small — nowhere to go' };
  }

  // Clean up old quadrant contents
  const oldContents = currentContents(game);
  if (oldContents) {
    oldContents.sectors[game.ship.sy][game.ship.sx] = CELL.EMPTY;
  }

  game.ship.qx = c.x;
  game.ship.qy = c.y;
  // Enter new quadrant at random-ish edge sector
  game.ship.sx = Math.floor(game.rng() * QUADRANT_SIZE);
  game.ship.sy = Math.floor(game.rng() * QUADRANT_SIZE);
  game.ship.energy -= energyCost;
  game.ship.docked = false;

  populateQuadrant(game.galaxy, c.x, c.y, game.rng, { x: game.ship.sx, y: game.ship.sy });
  autoScanNeighbours(game);
  effects.push({ type: 'warpMove', toQuad: [c.x, c.y] });
  logEvent(game, 'move', `Warp ${warp} to quadrant (${c.x + 1}-${c.y + 1})`);

  const stardateCost = Math.max(0.5, distance);
  advanceStardate(game, stardateCost);
  klingonReturnFire(game, effects);
  return { ok: true, effects };
}

// ---------------------------------------------------------------------------
// Long-range scan
// ---------------------------------------------------------------------------

function doLrscan(game) {
  if (game.ship.systems[SYS.SENSORS] > 3) {
    return { ok: false, error: 'Long-range sensors damaged' };
  }
  autoScanNeighbours(game);
  advanceStardate(game, 0.05);
  return { ok: true, effects: [{ type: 'lrscan' }] };
}

// ---------------------------------------------------------------------------
// Dock at starbase (adjacent sector)
// ---------------------------------------------------------------------------

function doDock(game, effects) {
  const contents = currentContents(game);
  if (!contents.starbase) return { ok: false, error: 'No starbase in this quadrant' };
  const d = sectorDist({x: game.ship.sx, y: game.ship.sy}, {x: contents.starbase.sx, y: contents.starbase.sy});
  if (d > 1) return { ok: false, error: 'Must be adjacent to starbase to dock' };

  game.ship.docked = true;
  game.ship.energy = INITIAL_ENERGY;
  game.ship.shields = INITIAL_SHIELDS;
  game.ship.shieldsUp = false;
  game.ship.torpedoes = INITIAL_TORPEDOES;
  game.ship.hull = INITIAL_HULL;
  for (const s of SYSTEM_ORDER) game.ship.systems[s] = 0;

  logEvent(game, 'dock', 'Docked at starbase — resupplied and repaired');
  effects.push({ type: 'dock' });
  advanceStardate(game, 0.5);
  return { ok: true, effects };
}

// ---------------------------------------------------------------------------
// Shields
// ---------------------------------------------------------------------------

function doShields(game, up, effects) {
  if (up && !game.ship.shieldsUp) {
    // Raising shields costs some energy
    game.ship.shieldsUp = true;
    if (game.ship.shields === 0) game.ship.shields = 500;
    game.ship.energy -= 50;
    logEvent(game, 'shield', `Shields UP (${game.ship.shields}/${game.ship.shieldsMax})`);
  } else if (!up && game.ship.shieldsUp) {
    game.ship.shieldsUp = false;
    logEvent(game, 'shield', 'Shields DOWN');
  }
  effects.push({ type: 'shield', up });
  advanceStardate(game, 0.05);
  return { ok: true, effects };
}

function doShieldTransfer(game, amount, effects) {
  if (amount <= 0) return { ok: false, error: 'Amount must be positive' };
  if (amount > game.ship.energy) return { ok: false, error: 'Insufficient energy to transfer' };
  const newShields = Math.min(game.ship.shieldsMax, game.ship.shields + amount);
  const actualCost = newShields - game.ship.shields;
  game.ship.energy -= actualCost;
  game.ship.shields = newShields;
  logEvent(game, 'shield', `Transferred ${actualCost} to shields (${game.ship.shields}/${game.ship.shieldsMax})`);
  effects.push({ type: 'shield', up: game.ship.shieldsUp });
  advanceStardate(game, 0.05);
  return { ok: true, effects };
}

// ---------------------------------------------------------------------------
// Klingon return fire (when player in same quadrant)
// ---------------------------------------------------------------------------

function klingonReturnFire(game, effects) {
  if (game.ship.docked) return;  // docked = safe
  const attackers = livingKlingons(game);
  if (attackers.length === 0) return;

  const shipPos = { x: game.ship.sx, y: game.ship.sy };
  for (const k of attackers) {
    const dist = sectorDist(shipPos, { x: k.sx, y: k.sy });
    const attenuation = Math.max(0.2, 1 - dist * 0.08);
    // Enemy-type-specific attack range (fallback if legacy klingon has no attack array)
    const attack = k.attack || [30, 80];
    const rawDamage = Math.floor((attack[0] + game.rng() * (attack[1] - attack[0])) * attenuation);

    // Shields absorb first
    let hullDamage = rawDamage;
    if (game.ship.shieldsUp && game.ship.shields > 0) {
      const absorbed = Math.min(game.ship.shields, rawDamage);
      game.ship.shields -= absorbed;
      hullDamage -= absorbed;
      if (game.ship.shields <= 0) {
        game.ship.shieldsUp = false;
        logEvent(game, 'shield', 'Shields collapsed!');
      }
    }

    if (hullDamage > 0) {
      game.ship.hull -= hullDamage;
      // System damage roll — random subsystem takes 1-3 damage
      if (game.rng() < 0.4) {
        const sys = SYSTEM_ORDER[Math.floor(game.rng() * SYSTEM_ORDER.length)];
        game.ship.systems[sys] += 1 + Math.floor(game.rng() * 3);
        logEvent(game, 'damage', `${sys} systems damaged`);
      }
    }

    effects.push({
      type: 'klingonFire',
      from: [k.sx, k.sy],
      damage: rawDamage,
      hullDamage,
    });
    logEvent(game, 'hit', `${k.id} fires — ${rawDamage} damage, hull ${game.ship.hull}%`);
  }

  // Loss checks
  if (game.ship.hull <= 0) {
    endLoss(game, 'Enterprise destroyed');
  } else if (game.ship.systems[SYS.LIFE_SUPPORT] > 7) {
    endLoss(game, 'Life support failed — crew lost');
  } else if (game.ship.energy <= 0) {
    endLoss(game, 'Energy reserves exhausted');
  }
}

// ---------------------------------------------------------------------------
// Public status snapshot for rendering
// ---------------------------------------------------------------------------

export function snapshot(game) {
  return {
    stardate: game.stardate,
    stardateEnd: game.stardateEnd,
    ship: { ...game.ship, systems: { ...game.ship.systems } },
    quadrant: {
      qx: game.ship.qx,
      qy: game.ship.qy,
      contents: currentContents(game),
      klingonCount: currentQuadrant(game).klingons,
      starbaseCount: currentQuadrant(game).starbases,
    },
    galaxy: game.galaxy,
    kills: game.kills,
    klingonsRemaining: game.klingonsRemaining,
    won: game.won,
    lost: game.lost,
    lostReason: game.lostReason,
    events: game.events.slice(-30),
  };
}
