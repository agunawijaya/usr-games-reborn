// atc/fancy-web — Dynamic cheat sheet hint generator.
//
// For each active plane, computes the *next* command a novice controller
// should probably issue, given the current game state. Purely advisory —
// the hint is one of many valid moves; players can and should override
// with experience. The goal is to remove the "what do I type now?"
// paralysis that a first-time controller experiences.
//
// Priority levels:
//   'urgent' — imminent loss condition (fuel, wall, wrong-altitude arrival)
//   'normal' — a productive move to make progress toward destination
//   'ok'     — plane is on course, no command needed right now

import { DIR_KEYS, DIR_NAMES, DISPLACEMENT, MAXDIR, FEATURE, dirTowards, clampDirDelta } from './engine.js';

// Reverse-lookup: direction number → compass key ('w','e','d',...).
const KEY_FROM_DIR = [];
for (const [k, v] of Object.entries(DIR_KEYS)) KEY_FROM_DIR[v] = k;

/** Chebyshev distance (grid king-move) between two cells. */
function chebDist(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Human-readable direction name. */
function dirName(d) { return DIR_NAMES[((d % MAXDIR) + MAXDIR) % MAXDIR]; }

// ---------------------------------------------------------------------------
// Pending / in-flight command helpers.
// The BSD engine mutates plane.newAltitude and plane.newDir when the player
// issues a command; the plane converges toward those values at ±1 altitude
// and ±2 direction per tick. Hints must reason about the *commanded* state
// so that a satisfied suggestion doesn't re-appear.
// ---------------------------------------------------------------------------

function altitudeChanging(p) { return p.altitude !== p.newAltitude; }
function altitudeIsClimbing(p) { return p.altitude < p.newAltitude; }
function isCircling(p) { return p.newDir === MAXDIR; }
function turning(p) { return !isCircling(p) && p.dir !== p.newDir; }

/** Compute the dir the plane will HAVE after next tick's update.
 *  Movement uses this dir for the position step, so wall / arrival
 *  projections should use it too. */
function projectedDir(p) {
  if (isCircling(p)) return (p.dir + 2) % MAXDIR;
  const delta = clampDirDelta(p.dir, p.newDir);
  return ((p.dir + delta) % MAXDIR + MAXDIR) % MAXDIR;
}

/** Build an EXECUTING status tag if any pending change is underway. */
function executingSuffix(p) {
  const bits = [];
  if (altitudeChanging(p)) bits.push(altitudeIsClimbing(p) ? '▲ climbing' : '▼ descending');
  if (turning(p)) bits.push('⟳ turning');
  if (isCircling(p)) bits.push('◯ circling');
  return bits.join(' · ');
}

/** True if moving from (x, y) in `dir` for one step stays inside arena. */
function isInsideAfterStep(x, y, dir, pf) {
  const d = DISPLACEMENT[dir];
  const nx = x + d.dx;
  const ny = y + d.dy;
  return nx >= 0 && nx < pf.width && ny >= 0 && ny < pf.height;
}

/** Return the direction the plane will actually be flying next tick if
 *  we command `candNewDir`. Accounts for the ±2/tick turn cap. */
function actualDirAfterCommand(plane, candNewDir) {
  if (candNewDir === MAXDIR) return (plane.dir + 2) % MAXDIR; // circle
  const delta = clampDirDelta(plane.dir, candNewDir);
  return ((plane.dir + delta) % MAXDIR + MAXDIR) % MAXDIR;
}

/** From the plane's position, pick the compass direction closest to a
 *  desired direction that KEEPS THE PLANE INSIDE THE ARENA next tick.
 *  Critical: because the engine caps turns at ±2/tick, commanding a
 *  180°-away newDir doesn't actually stop the plane from stepping
 *  further along its current heading. This function tests candidate
 *  newDirs by projecting the *clamped* movement direction after the
 *  command, and returns one that stays in-arena. */
function pickSafeInsideDir(plane, pf, preferredDir = null) {
  const target = preferredDir !== null ? preferredDir : 0;
  // Try directions in increasing angular distance from target.
  const ordered = [0, 1, -1, 2, -2, 3, -3, 4].map(o => ((target + o) % MAXDIR + MAXDIR) % MAXDIR);
  for (const d of ordered) {
    const actual = actualDirAfterCommand(plane, d);
    if (isInsideAfterStep(plane.xpos, plane.ypos, actual, pf)) return d;
  }
  // Fallback: some direction must exist. Return current preferred.
  return target;
}

/** Is plane exactly on the approach line to airport?
 *  The approach line runs from the airport in the *opposite* of the
 *  runway direction: for a SE-runway airport, plane must approach from
 *  NW along the diagonal (airport - (1,1)*k for integer k ≥ 1). */
function isOnApproachLine(plane, airport) {
  const disp = DISPLACEMENT[airport.dir];
  const dx = airport.x - plane.xpos;
  const dy = airport.y - plane.ypos;
  if (disp.dx === 0 && disp.dy === 0) return false;
  // Plane must be along the direction ray (matching signs of disp).
  if (disp.dx === 0) return dx === 0 && (dy === 0 || Math.sign(dy) === Math.sign(disp.dy));
  if (disp.dy === 0) return dy === 0 && (dx === 0 || Math.sign(dx) === Math.sign(disp.dx));
  return (
    (dx === 0 && dy === 0) ||
    (Math.sign(dx) === Math.sign(disp.dx) &&
     Math.sign(dy) === Math.sign(disp.dy) &&
     Math.abs(dx) === Math.abs(dy))
  );
}

/** Find the approach-line cell closest to the plane. Returns
 *  { x, y, distFromAirport } or null if no approach cell exists inside
 *  the arena (never happens for shipped playfields). */
function findApproachTarget(plane, airport, pf) {
  const disp = DISPLACEMENT[airport.dir];
  let best = null;
  let bestScore = Infinity;
  // Approach line cells at distances 1..maxK from airport.
  const maxK = Math.max(pf.width, pf.height);
  for (let k = 1; k < maxK; k++) {
    const cx = airport.x - k * disp.dx;
    const cy = airport.y - k * disp.dy;
    if (cx < 0 || cx >= pf.width || cy < 0 || cy >= pf.height) break;
    // Score: prefer cells closer to plane but also further from airport
    // so plane has room to set up glidepath. Weight both roughly equally.
    const distToCell = chebDist(plane.xpos, plane.ypos, cx, cy);
    const score = distToCell + Math.max(0, 4 - k) * 2; // penalise near-airport cells
    if (score < bestScore) {
      bestScore = score;
      best = { x: cx, y: cy, distFromAirport: k };
    }
  }
  return best;
}

/**
 * Compute a hint for one plane.
 * @param plane plane state (in air or ground)
 * @param pf playfield
 * @param onGround boolean — plane is in game.ground list
 * @param otherAirPlanes optional array of other planes currently in air
 *   (used for collision-avoidance projections). Pass an empty array to
 *   disable inter-plane deconfliction.
 * @returns { priority, command, explain, tag } | null
 */
export function hintForPlane(plane, pf, onGround, otherAirPlanes = []) {
  const letter = plane.letter;

  // ---- Ground: needs takeoff clearance ----
  if (onGround) {
    return {
      priority: 'normal',
      tag: 'READY',
      command: `${letter}a+7`,
      explain: 'On ground at airport. Type this to take off and climb to 7000 ft.',
    };
  }

  // ---- Collision imminent / proximate: separate by altitude change ----
  // Fires when this plane and another are within 2 cells AND within 2
  // altitudes right now — i.e., there's a plausible collision path over
  // the next 2 ticks. Reactive 1-tick avoidance wasn't enough (altitude
  // changes only ±1/tick, so a 1-tick warning can't clear a same-altitude
  // collision).
  //
  // Deterministic tie-breaker: the plane with the alphabetically earlier
  // letter always climbs; the other descends. Prevents lockstep deadlocks
  // where both planes make the same avoidance choice.
  if (!onGround && otherAirPlanes.length > 0) {
    for (const other of otherAirPlanes) {
      if (other === plane || other.letter === plane.letter) continue;
      const chebXY = Math.max(
        Math.abs(plane.xpos - other.xpos),
        Math.abs(plane.ypos - other.ypos)
      );
      const altDiff = Math.abs(plane.altitude - other.altitude);
      // Trigger: 3-cell proximity AND altitudes within 3. Two-phase
      // avoidance: (1) command opposite altitude extreme, (2) once
      // that's committed, turn AWAY from the other plane. This uses
      // both separation axes since altitude convergence is 1/tick and
      // may not be fast enough on its own.
      if (chebXY <= 3 && altDiff <= 3) {
        const myKey = plane.letter.toUpperCase();
        const otherKey = other.letter.toUpperCase();
        const iClimb = myKey < otherKey;
        const preferredAlt = iClimb ? 9 : 0;

        // Phase 1: altitude split. Command the preferred extreme
        // (letter-tiebreaker). If we're already at/committed to that
        // extreme, DON'T fall back to the opposite — the other plane
        // has the reciprocal preference and will handle the split from
        // their side. Falling back caused both planes to converge to
        // the same extreme.
        if (plane.newAltitude !== preferredAlt) {
          return {
            priority: 'urgent',
            tag: 'AVOID',
            command: `${letter}a${preferredAlt}`,
            explain: `Collision risk with ${other.letter} (${chebXY} cells, ${altDiff} alt apart). Split altitude — command Aa${preferredAlt}.`,
          };
        }

        // Phase 2: altitude committed. Turn AWAY from other plane's
        // position — reinforces alt split with spatial spread. Applies
        // even to circling planes (collision override).
        const awayFromOther = dirTowards(other.xpos, other.ypos, plane.xpos, plane.ypos);
        const safeDir = pickSafeInsideDir(plane, pf, awayFromOther);
        if (plane.newDir !== safeDir) {
          const dirKey = KEY_FROM_DIR[safeDir];
          return {
            priority: 'urgent',
            tag: 'AVOID',
            command: `${letter}t${dirKey}`,
            explain: `Alt split done but still close to ${other.letter}. Turn ${dirName(safeDir)} to break spatial adjacency.`,
          };
        }
      }
    }
  }

  // ---- Fuel critical: highest urgency ----
  if (plane.fuel <= 6) {
    const dest = plane.destType === FEATURE.EXIT
      ? { list: pf.exits, prefix: 'tte', kind: 'exit' }
      : { list: pf.airports, prefix: 'tta', kind: 'airport' };
    const target = dest.list[plane.destNo];
    return {
      priority: 'urgent',
      tag: 'FUEL',
      command: `${letter}${dest.prefix}${target.label}`,
      explain: `Fuel ${plane.fuel} — direct to ${dest.kind} ${target.label} now.`,
    };
  }

  // ---- Wall imminent: next tick puts plane out-of-arena at wrong spot ----
  // Use projected dir (post-update) so a plane already commanded to turn
  // away doesn't get flagged as heading into the wall.
  const effectiveDir = projectedDir(plane);
  const disp = DISPLACEMENT[effectiveDir];
  const nextX = plane.xpos + disp.dx;
  const nextY = plane.ypos + disp.dy;
  const outNext = nextX < 0 || nextX >= pf.width || nextY < 0 || nextY >= pf.height;
  if (outNext) {
    // Clean departure — right exit + right effective altitude next tick.
    if (plane.destType === FEATURE.EXIT) {
      const destExit = pf.exits[plane.destNo];
      // Altitude after next tick: current ±1 toward newAltitude
      const nextAlt = plane.altitude + Math.sign(plane.newAltitude - plane.altitude);
      if (destExit.x === nextX && destExit.y === nextY && nextAlt === 9) {
        return {
          priority: 'ok',
          tag: 'DEPARTING',
          command: null,
          explain: `Cleared for exit ${destExit.label}. No action.`,
        };
      }
    }
    // Pick a safe turn — prefer one that keeps plane in-arena AND is
    // closer to the destination direction if possible.
    const safeDir = pickSafeInsideDir(plane, pf);
    const safeKey = KEY_FROM_DIR[safeDir];
    return {
      priority: 'urgent',
      tag: 'WALL',
      command: `${letter}t${safeKey}`,
      explain: `Heading ${dirName(effectiveDir)} — off arena next tick. Turn ${dirName(safeDir)} to stay inside.`,
    };
  }

  // ---- Destination: EXIT ----
  if (plane.destType === FEATURE.EXIT) {
    const destExit = pf.exits[plane.destNo];
    const distToExit = chebDist(plane.xpos, plane.ypos, destExit.x, destExit.y);
    const altDeficit = 9 - plane.altitude;

    // Time-to-climb check: plane must be alt 9 upon arrival. Altitude
    // rises 1/tick, and if heading direct to exit distance drops 1/tick.
    // If altDeficit > distToExit, plane cannot climb in time and will
    // arrive at exit at a lower altitude → "exited at wrong altitude".
    // Solution: circle while climbing to hold position (dist stays same
    // while altitude rises).
    if (altDeficit > distToExit) {
      if (!isCircling(plane)) {
        return {
          priority: 'urgent',
          tag: 'HOLD',
          command: `${letter}c`,
          explain: `Alt ${plane.altitude} but only ${distToExit} cells to exit — will arrive too low. Circle to climb in place.`,
        };
      }
      // Already circling; ensure alt 9 is commanded.
      if (plane.newAltitude < 9) {
        return {
          priority: 'urgent',
          tag: 'CLIMB',
          command: `${letter}a9`,
          explain: `Circling to bleed distance. Command Aa9 to climb to exit altitude.`,
        };
      }
      const status = executingSuffix(plane);
      return {
        priority: 'ok',
        tag: status ? 'EXECUTING' : 'HOLD',
        command: null,
        explain: `Holding while climbing to alt 9. Then resume heading to exit ${destExit.label}.`,
      };
    }

    // Check commanded altitude — command climb if not yet at 9.
    if (plane.newAltitude < 9) {
      return {
        priority: 'normal',
        tag: 'CLIMB',
        command: `${letter}a9`,
        explain: `Exit needs alt 9. Commanded ${plane.newAltitude}, currently ${plane.altitude}. Type this to command climb.`,
      };
    }

    // Commanded altitude is 9. Check commanded direction toward the exit.
    // Skip if already circling (player deliberately holding for altitude).
    const wantDir = dirTowards(plane.xpos, plane.ypos, destExit.x, destExit.y);
    // Guard: only suggest heading toward exit if that direction doesn't
    // immediately push the plane out through the wrong border.
    const safeWantDir = isInsideAfterStep(plane.xpos, plane.ypos, wantDir, pf)
      ? wantDir
      : pickSafeInsideDir(plane, pf, wantDir);
    if (!isCircling(plane) && plane.newDir !== safeWantDir) {
      return {
        priority: 'normal',
        tag: 'HEADING',
        command: `${letter}tte${destExit.label}`,
        explain: `At/climbing to exit altitude but off-heading. Type this to steer direct to exit ${destExit.label}.`,
      };
    }

    // Everything commanded correctly — plane is executing.
    const status = executingSuffix(plane);
    return {
      priority: 'ok',
      tag: status ? 'EXECUTING' : 'ON COURSE',
      command: null,
      explain: status
        ? `${status}. On course for exit ${destExit.label}.`
        : `Alt ${plane.altitude} and pointing at exit ${destExit.label}. No action.`,
    };
  }

  // ---- Destination: AIRPORT ----
  // Landing arithmetic (BSD atc): altitude drops ±1 / tick, movement is
  // 1 cell / tick along the plane's heading. Safe landing requires:
  //   1. Plane on the airport's *approach line* — cells extending from
  //      the airport in the opposite direction of the runway. Only from
  //      this line will the plane hit the airport cell while flying the
  //      runway direction.
  //   2. Altitude equal to distance-to-airport at approach start, so alt
  //      hits 0 exactly as position hits airport.
  //
  // The cheat routes off-line planes to an approach-line target first,
  // then guides descent along the line. When altitude can't converge
  // to distance in time, cheat suggests CIRCLE to bleed altitude before
  // final approach.
  const destAirport = pf.airports[plane.destNo];
  const dist = chebDist(plane.xpos, plane.ypos, destAirport.x, destAirport.y);
  const runwayKey = KEY_FROM_DIR[destAirport.dir];

  // At the airport cell.
  if (dist === 0) {
    if (plane.newDir !== destAirport.dir) {
      return {
        priority: 'urgent',
        tag: 'ALIGN',
        command: `${letter}t${runwayKey}`,
        explain: `At airport ${destAirport.label}, need runway heading ${dirName(destAirport.dir)}. Turn now.`,
      };
    }
    if (plane.newAltitude > 0) {
      return {
        priority: 'urgent',
        tag: 'TOUCHDOWN',
        command: `${letter}a0`,
        explain: `Runway aligned. Command touchdown.`,
      };
    }
    const status = executingSuffix(plane);
    return {
      priority: 'ok',
      tag: status ? 'EXECUTING' : 'LANDING',
      command: null,
      explain: status ? `${status} onto runway. No action.` : `Touchdown imminent.`,
    };
  }

  // Not at airport. Decide: are we on the approach line?
  const onLine = isOnApproachLine(plane, destAirport);

  if (onLine) {
    // ---- On approach line: align, glide ----
    // On the line, distance decreases 1/tick exactly when heading is the
    // runway direction. Altitude must match distance for a clean landing.

    // Runway alignment first (most important on the line).
    if (plane.newDir !== destAirport.dir) {
      return {
        priority: 'urgent',
        tag: 'ALIGN',
        command: `${letter}t${runwayKey}`,
        explain: `On approach line, ${dist} cells out. Align to runway heading ${dirName(destAirport.dir)}.`,
      };
    }

    // Altitude management. Target: alt == dist so descent lands at zero.
    const targetAlt = Math.min(dist, 9);

    if (plane.altitude > targetAlt) {
      // Above glidepath. Can we descend in time?
      // Ticks to reach target alt = plane.altitude - targetAlt.
      // Ticks to reach airport = dist.
      // If altitude drop ≤ dist we're fine; otherwise plane arrives too high.
      const altDrop = plane.altitude - targetAlt;
      if (altDrop <= dist) {
        // We can converge on the way down.
        if (plane.newAltitude > targetAlt) {
          return {
            priority: 'normal',
            tag: dist <= 4 ? 'APPROACH' : 'DESCEND',
            command: `${letter}a${targetAlt}`,
            explain: `${dist} cells out on approach line. Command alt ${targetAlt}.`,
          };
        }
        // Command already at or below target.
      } else {
        // Too high to descend in the remaining distance — must circle.
        if (!isCircling(plane)) {
          return {
            priority: 'urgent',
            tag: 'HOLD',
            command: `${letter}c`,
            explain: `Alt ${plane.altitude} too high to land in ${dist} cells. Circle to bleed altitude.`,
          };
        }
        // Already circling. Command lower altitude so we bleed on the hold.
        if (plane.newAltitude > 0) {
          return {
            priority: 'normal',
            tag: 'HOLD',
            command: `${letter}a0`,
            explain: `Circling to bleed altitude before final approach.`,
          };
        }
      }
    } else if (plane.altitude < targetAlt) {
      // Below glidepath.
      if (plane.newAltitude < targetAlt) {
        return {
          priority: 'urgent',
          tag: 'CLIMB',
          command: `${letter}a${targetAlt}`,
          explain: `Alt ${plane.altitude} below glidepath (need ${targetAlt}). Climb.`,
        };
      }
    } else {
      // Exactly at glidepath (alt == dist). Command Aa0 for final glide.
      if (plane.newAltitude > 0) {
        return {
          priority: 'urgent',
          tag: 'GLIDE',
          command: `${letter}a0`,
          explain: `Alt ${plane.altitude} matches distance ${dist} on approach line. Command Aa0 for landing.`,
        };
      }
    }

    // dist === 1 final approach detail — mainly to catch late alt-mismatch.
    if (dist === 1 && plane.altitude !== 1 && plane.newAltitude !== 0) {
      // Should already have been handled above; safety net.
      return {
        priority: 'urgent',
        tag: 'FINAL',
        command: `${letter}a0`,
        explain: `1 cell out, aligned. Command touchdown.`,
      };
    }

    const status = executingSuffix(plane);
    return {
      priority: 'ok',
      tag: status ? 'EXECUTING' : 'ON GLIDEPATH',
      command: null,
      explain: status
        ? `${status}. On approach line to airport ${destAirport.label}.`
        : `On approach line, alt ${plane.altitude} = distance ${dist}. Awaiting glidepath.`,
    };
  }

  // ---- Off approach line: route to the approach line first ----
  const target = findApproachTarget(plane, destAirport, pf);
  if (!target) {
    // Playfield has no valid approach cell (shouldn't happen).
    return {
      priority: 'urgent',
      tag: 'HOLD',
      command: `${letter}c`,
      explain: `No approach path to airport ${destAirport.label}. Circle.`,
    };
  }

  const distToTarget = chebDist(plane.xpos, plane.ypos, target.x, target.y);
  const totalToAirport = distToTarget + target.distFromAirport;
  const overallTargetAlt = Math.min(totalToAirport, 9);

  // Safety: below overall glidepath and not climbing → CLIMB.
  if (plane.altitude < overallTargetAlt && plane.newAltitude < overallTargetAlt) {
    return {
      priority: 'urgent',
      tag: 'CLIMB',
      command: `${letter}a${overallTargetAlt}`,
      explain: `Alt ${plane.altitude} but ${totalToAirport} cells to airport (via approach point). Climb to alt ${overallTargetAlt}.`,
    };
  }

  // Steer toward the approach target.
  const wantDir = dirTowards(plane.xpos, plane.ypos, target.x, target.y);
  const safeWantDir = isInsideAfterStep(plane.xpos, plane.ypos, wantDir, pf)
    ? wantDir : pickSafeInsideDir(plane, pf, wantDir);
  if (!isCircling(plane) && plane.newDir !== safeWantDir) {
    const dirKey = KEY_FROM_DIR[safeWantDir];
    return {
      priority: distToTarget <= 3 ? 'urgent' : 'normal',
      tag: 'WAYPOINT',
      command: `${letter}t${dirKey}`,
      explain: `Not on approach line. Steer ${dirName(safeWantDir)} to reach approach point (${target.x},${target.y}) ${distToTarget} cells away, then align runway.`,
    };
  }

  // Manage altitude while routing to approach.
  if (plane.newAltitude > overallTargetAlt) {
    return {
      priority: 'normal',
      tag: 'DESCEND',
      command: `${letter}a${overallTargetAlt}`,
      explain: `Routing to approach line. Command alt ${overallTargetAlt} for total glidepath.`,
    };
  }

  const status = executingSuffix(plane);
  return {
    priority: 'ok',
    tag: status ? 'EXECUTING' : 'ROUTING',
    command: null,
    explain: status
      ? `${status}. En route to approach line for airport ${destAirport.label}.`
      : `En route to approach point for airport ${destAirport.label}.`,
  };
}

/** Sort hints so urgent ones surface at the top. */
const PRIORITY_RANK = { urgent: 0, normal: 1, ok: 2 };

export function sortHintsByPriority(hints) {
  return hints.slice().sort((a, b) => {
    const pa = PRIORITY_RANK[a.hint.priority] ?? 3;
    const pb = PRIORITY_RANK[b.hint.priority] ?? 3;
    return pa - pb;
  });
}
