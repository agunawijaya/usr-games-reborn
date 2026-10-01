// trek/fancy-web — Dynamic cheat sheet: "what to type next"
//
// Analyses the current game state and returns a priority-sorted list of
// concrete command suggestions. Novices can follow these blindly;
// experienced players can override.

import { GALAXY_SIZE, QUADRANT_SIZE, ENEMY_STATS } from './galaxy.js';

const PRIORITY_RANK = { urgent: 0, normal: 1, ok: 2 };

/** Chebyshev distance between two grid points. */
function chebDist(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/**
 * Convert a game-space direction (dx, dy) to a bearing on the 12-hour
 * clock face used by trek commands:  0 = E, 3 = N, 6 = W, 9 = S.
 * Game convention: +y is South (row increases downward), so we invert
 * dy before the atan2.
 */
function bearingClock(dx, dy) {
  const gy = -dy; // flip: North is +y in bearing math
  const rad = Math.atan2(gy, dx);
  let clock = rad * 6 / Math.PI;
  while (clock < 0) clock += 12;
  while (clock >= 12) clock -= 12;
  return clock + 0; // normalise -0 → +0 for clean assertions
}

/** Find the nearest scanned quadrant containing at least one Klingon. */
function findNearestKlingonQuadrant(galaxy, qx, qy) {
  let best = null;
  let bestDist = Infinity;
  for (let y = 0; y < GALAXY_SIZE; y++) {
    for (let x = 0; x < GALAXY_SIZE; x++) {
      const q = galaxy.quadrants[y][x];
      if (!q.scanned || q.klingons <= 0) continue;
      if (x === qx && y === qy) continue;
      const d = chebDist(qx, qy, x, y);
      if (d < bestDist) { bestDist = d; best = { qx: x, qy: y, dist: d, count: q.klingons }; }
    }
  }
  return best;
}

/** Find the nearest unscanned quadrant — used to keep the exploration
 *  going after all locally known klingon quadrants are cleared. */
function findNearestUnscannedQuadrant(galaxy, qx, qy) {
  let best = null;
  let bestDist = Infinity;
  for (let y = 0; y < GALAXY_SIZE; y++) {
    for (let x = 0; x < GALAXY_SIZE; x++) {
      const q = galaxy.quadrants[y][x];
      if (q.scanned) continue;
      const d = chebDist(qx, qy, x, y);
      if (d < bestDist) { bestDist = d; best = { qx: x, qy: y, dist: d }; }
    }
  }
  return best;
}

/** Find the nearest scanned quadrant with a starbase. */
function findNearestStarbaseQuadrant(galaxy, qx, qy) {
  let best = null;
  let bestDist = Infinity;
  for (let y = 0; y < GALAXY_SIZE; y++) {
    for (let x = 0; x < GALAXY_SIZE; x++) {
      const q = galaxy.quadrants[y][x];
      if (!q.scanned || q.starbases <= 0) continue;
      if (x === qx && y === qy) continue;
      const d = chebDist(qx, qy, x, y);
      if (d < bestDist) { bestDist = d; best = { qx: x, qy: y, dist: d }; }
    }
  }
  return best;
}

/** Count unscanned quadrants adjacent to (qx, qy). */
function countUnscannedAdjacent(galaxy, qx, qy) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = qx + dx, ny = qy + dy;
      if (nx < 0 || nx >= GALAXY_SIZE || ny < 0 || ny >= GALAXY_SIZE) continue;
      if (!galaxy.quadrants[ny][nx].scanned) n++;
    }
  }
  return n;
}

/** Suggest a warp factor for a quadrant-level move: match distance. */
function suggestWarp(dist) {
  return Math.max(1, Math.min(8, dist));
}

/**
 * Compute a priority-sorted list of hint objects for the current state.
 *
 * @param snap output of engine.snapshot(game)
 * @returns Array<{ priority, tag, cmd, explain }>
 *   priority ∈ 'urgent' | 'normal' | 'ok'
 *   cmd string (something the player can type) or null
 */
export function computeHints(snap) {
  const hints = [];
  const { ship, quadrant, galaxy, klingonsRemaining, stardate, stardateEnd } = snap;
  const contents = quadrant.contents;
  const living = contents.klingons.filter(k => !k.destroyed);
  const hasHostiles = living.length > 0;
  const stardateLeft = stardateEnd - stardate;

  // ---- URGENT tier ----

  // 1) Hostiles present, shields still down.
  if (hasHostiles && !ship.shieldsUp) {
    hints.push({
      priority: 'urgent',
      tag: 'SHIELDS',
      cmd: 'shields up',
      explain: `${living.length} hostile${living.length > 1 ? 's' : ''} in this quadrant. Raise shields immediately.`,
    });
  }

  // 2) Hull critically low — dock or die.
  if (ship.hull <= 30) {
    if (contents.starbase) {
      const d = chebDist(ship.sx, ship.sy, contents.starbase.sx, contents.starbase.sy);
      if (d <= 1) {
        hints.push({
          priority: 'urgent',
          tag: 'DOCK',
          cmd: 'dock',
          explain: `Hull at ${ship.hull}%. Starbase adjacent — dock for full repair.`,
        });
      } else {
        // Move to starbase within the quadrant using impulse
        const dx = contents.starbase.sx - ship.sx;
        const dy = contents.starbase.sy - ship.sy;
        const bearing = bearingClock(dx, dy).toFixed(1);
        hints.push({
          priority: 'urgent',
          tag: 'MOVE-TO-BASE',
          cmd: `impulse ${bearing}`,
          explain: `Hull at ${ship.hull}%. Starbase in this quadrant — impulse to it (bearing ${bearing}), then dock.`,
        });
      }
    } else {
      const base = findNearestStarbaseQuadrant(galaxy, ship.qx, ship.qy);
      if (base) {
        const dx = base.qx - ship.qx;
        const dy = base.qy - ship.qy;
        const bearing = bearingClock(dx, dy).toFixed(1);
        const warp = suggestWarp(base.dist);
        hints.push({
          priority: 'urgent',
          tag: 'RUN-TO-BASE',
          cmd: `move ${bearing} ${warp}`,
          explain: `Hull at ${ship.hull}%. Nearest starbase quadrant ${base.qx + 1}-${base.qy + 1}, ${base.dist} away. Warp there.`,
        });
      } else {
        hints.push({
          priority: 'urgent',
          tag: 'NO-BASE',
          cmd: 'lrscan',
          explain: `Hull at ${ship.hull}% and no starbase in scan. Long-range scan to locate one.`,
        });
      }
    }
  }

  // 3) Fuel critical.
  if (ship.energy < 1500 && ship.hull > 30) {
    if (contents.starbase) {
      const d = chebDist(ship.sx, ship.sy, contents.starbase.sx, contents.starbase.sy);
      if (d <= 1) {
        hints.push({
          priority: 'urgent',
          tag: 'FUEL-DOCK',
          cmd: 'dock',
          explain: `Energy at ${ship.energy}. Starbase adjacent — dock to refuel.`,
        });
      }
    } else {
      const base = findNearestStarbaseQuadrant(galaxy, ship.qx, ship.qy);
      if (base) {
        const dx = base.qx - ship.qx;
        const dy = base.qy - ship.qy;
        const bearing = bearingClock(dx, dy).toFixed(1);
        const warp = suggestWarp(base.dist);
        hints.push({
          priority: 'urgent',
          tag: 'FUEL',
          cmd: `move ${bearing} ${warp}`,
          explain: `Energy at ${ship.energy}. Head to starbase quadrant ${base.qx + 1}-${base.qy + 1}.`,
        });
      }
    }
  }

  // 4) Time pressure — stardate budget nearly out.
  if (stardateLeft < klingonsRemaining * 1.5 && klingonsRemaining > 0) {
    hints.push({
      priority: 'urgent',
      tag: 'TIME',
      cmd: null,
      explain: `Only ${stardateLeft.toFixed(1)} stardates left for ${klingonsRemaining} Klingons. Hunt aggressively — no more scans.`,
    });
  }

  // ---- NORMAL tier — attack, hunt, scan ----

  // Attack: hostiles present, shields up.
  if (hasHostiles && ship.shieldsUp) {
    // Recommend phaser energy = total enemy energy × attenuation buffer
    // (average distance attenuation ~0.65). Cap at ship reserves.
    const totalEnergyOfEnemies = living.reduce((s, k) => s + Math.max(0, k.energy), 0);
    // Fire at least 100 units even when target is nearly dead — otherwise
    // the cheat goes silent for a wounded klingon (recommended < 100) and
    // the autoplay stalls with "READY" hints while a hostile remains.
    const recommended = Math.min(ship.energy - 500, Math.max(100, Math.ceil(totalEnergyOfEnemies * 1.5)));
    if (recommended >= 100 && ship.systems.phasers <= 3) {
      hints.push({
        priority: 'normal',
        tag: 'PHASER',
        cmd: `phaser ${recommended}`,
        explain: `${living.length} target${living.length > 1 ? 's' : ''} totalling ${totalEnergyOfEnemies} energy. Recommended fire ${recommended} (buffer for distance loss).`,
      });
    }
    // Torpedo: prefer for high-energy single targets or when phasers damaged.
    if (ship.torpedoes > 0 && ship.systems.torpedoes <= 3) {
      const strongest = living.reduce((best, k) => (k.energy > best.energy ? k : best), living[0]);
      if (strongest && (strongest.energy > 400 || ship.systems.phasers > 3)) {
        const dx = strongest.sx - ship.sx;
        const dy = strongest.sy - ship.sy;
        const bearing = bearingClock(dx, dy).toFixed(1);
        const name = ENEMY_STATS[strongest.type]?.name || 'Klingon';
        hints.push({
          priority: 'normal',
          tag: 'TORPEDO',
          cmd: `torpedo ${bearing}`,
          explain: `${name} at (${strongest.sx},${strongest.sy}) is the strongest threat. Torpedo bearing ${bearing}.`,
        });
      }
    }
  }

  // Damaged systems + starbase available.
  const damagedCount = Object.values(ship.systems).filter(d => d > 3).length;
  if (damagedCount >= 2 && !hasHostiles) {
    if (contents.starbase) {
      const d = chebDist(ship.sx, ship.sy, contents.starbase.sx, contents.starbase.sy);
      if (d <= 1) {
        hints.push({
          priority: 'normal',
          tag: 'REPAIR',
          cmd: 'dock',
          explain: `${damagedCount} systems damaged. Starbase adjacent — dock to repair.`,
        });
      }
    }
  }

  // No hostiles: hunt / scan.
  if (!hasHostiles && klingonsRemaining > 0) {
    const unscanned = countUnscannedAdjacent(galaxy, ship.qx, ship.qy);
    if (unscanned > 0 && ship.systems.sensors <= 3) {
      hints.push({
        priority: 'normal',
        tag: 'SCAN',
        cmd: 'lrscan',
        explain: `${unscanned} adjacent quadrants unscanned. Long-range scan reveals Klingon activity.`,
      });
    }

    const nearest = findNearestKlingonQuadrant(galaxy, ship.qx, ship.qy);
    if (nearest) {
      const dx = nearest.qx - ship.qx;
      const dy = nearest.qy - ship.qy;
      const bearing = bearingClock(dx, dy).toFixed(1);
      const warp = suggestWarp(nearest.dist);
      hints.push({
        priority: 'normal',
        tag: 'HUNT',
        cmd: `move ${bearing} ${warp}`,
        explain: `Nearest known Klingon quadrant ${nearest.qx + 1}-${nearest.qy + 1} (${nearest.count} target${nearest.count > 1 ? 's' : ''}, ${nearest.dist} away).`,
      });
    } else {
      // No known klingon quadrants but klingons still remaining somewhere.
      // Explore the nearest unscanned quadrant so lrscan reveals more.
      const unscannedTarget = findNearestUnscannedQuadrant(galaxy, ship.qx, ship.qy);
      if (unscannedTarget) {
        const dx = unscannedTarget.qx - ship.qx;
        const dy = unscannedTarget.qy - ship.qy;
        const bearing = bearingClock(dx, dy).toFixed(1);
        const warp = suggestWarp(unscannedTarget.dist);
        hints.push({
          priority: 'normal',
          tag: 'EXPLORE',
          cmd: `move ${bearing} ${warp}`,
          explain: `No known Klingon activity nearby. Warp to unscanned quadrant ${unscannedTarget.qx + 1}-${unscannedTarget.qy + 1} to expand map.`,
        });
      }
    }
  }

  // Shields still up but no hostiles — save energy.
  if (!hasHostiles && ship.shieldsUp && ship.energy < 5000) {
    hints.push({
      priority: 'normal',
      tag: 'CONSERVE',
      cmd: 'shields down',
      explain: `No hostiles. Lower shields to conserve energy for warp travel.`,
    });
  }

  // ---- OK tier — status summaries ----

  if (hints.length === 0) {
    hints.push({
      priority: 'ok',
      tag: 'READY',
      cmd: null,
      explain: `Bridge quiet. All systems nominal. Consider lrscan or hunting the nearest Klingon quadrant.`,
    });
  }

  return sortHintsByPriority(hints);
}

export function sortHintsByPriority(hints) {
  return hints.slice().sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority] ?? 3;
    const pb = PRIORITY_RANK[b.priority] ?? 3;
    return pa - pb;
  });
}

// Export helpers for testing.
export const _internal = { chebDist, bearingClock, findNearestKlingonQuadrant, findNearestStarbaseQuadrant, countUnscannedAdjacent };
