// atc/fancy-web — Headless game engine
// Faithful to BSD atc(6) mechanics per bsdgames/atc/docs/spec.md
// Zero DOM / rendering dependencies — pure state machine, testable in Node.

// ---------------------------------------------------------------------------
// Direction system: 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW
// ---------------------------------------------------------------------------

export const DIR = { N: 0, NE: 1, E: 2, SE: 3, S: 4, SW: 5, W: 6, NW: 7 };
export const MAXDIR = 8;

export const DISPLACEMENT = [
  { dx: 0, dy: -1 }, // 0 N
  { dx: 1, dy: -1 }, // 1 NE
  { dx: 1, dy: 0 },  // 2 E
  { dx: 1, dy: 1 },  // 3 SE
  { dx: 0, dy: 1 },  // 4 S
  { dx: -1, dy: 1 }, // 5 SW
  { dx: -1, dy: 0 }, // 6 W
  { dx: -1, dy: -1 }, // 7 NW
];

// BSD atc keys: qwedcxza (8 compass points)
export const DIR_KEYS = { w: 0, e: 1, d: 2, c: 3, x: 4, z: 5, a: 6, q: 7 };
export const DIR_NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// ---------------------------------------------------------------------------
// Feature types
// ---------------------------------------------------------------------------

export const FEATURE = { EXIT: 0, AIRPORT: 1, BEACON: 2 };

// ---------------------------------------------------------------------------
// Plane status
// ---------------------------------------------------------------------------

export const STATUS = {
  MARKED: 'MARKED',     // highlighted, spawn default
  UNMARKED: 'UNMARKED', // dim, unmarked
  IGNORED: 'IGNORED',   // ignored (no attention)
  GONE: 'GONE',         // safely delivered, awaiting sweep
};

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
// Direction arithmetic
// ---------------------------------------------------------------------------

/** Clamp a signed direction delta to [-2, +2] (BSD atc rate limit). */
export function clampDirDelta(dir, newDir) {
  let diff = newDir - dir;
  // shortest path around the circle
  if (diff > MAXDIR / 2) diff -= MAXDIR;
  if (diff < -MAXDIR / 2) diff += MAXDIR;
  if (diff > 2) diff = 2;
  if (diff < -2) diff = -2;
  return diff;
}

// ---------------------------------------------------------------------------
// Playfield validation
// ---------------------------------------------------------------------------

export function validatePlayfield(pf) {
  const errs = [];
  if (pf.width < 3 || pf.height < 3) errs.push('width/height must be >= 3');
  for (const ex of pf.exits) {
    const onBorder = ex.x === 0 || ex.x === pf.width - 1 || ex.y === 0 || ex.y === pf.height - 1;
    if (!onBorder) errs.push(`exit (${ex.x},${ex.y}) not on border`);
  }
  for (const bc of pf.beacons) {
    const inside = bc.x > 0 && bc.x < pf.width - 1 && bc.y > 0 && bc.y < pf.height - 1;
    if (!inside) errs.push(`beacon (${bc.x},${bc.y}) not inside border`);
  }
  for (const ap of pf.airports) {
    const inside = ap.x > 0 && ap.x < pf.width - 1 && ap.y > 0 && ap.y < pf.height - 1;
    if (!inside) errs.push(`airport (${ap.x},${ap.y}) not inside border`);
  }
  return errs;
}

// ---------------------------------------------------------------------------
// Game state factory
// ---------------------------------------------------------------------------

export function createGame(playfield, opts = {}) {
  const errs = validatePlayfield(playfield);
  if (errs.length) throw new Error('Playfield validation failed: ' + errs.join('; '));

  const rng = makeRng(opts.seed ?? 1);
  return {
    playfield,
    clock: 0,
    air: [],       // active planes
    ground: [],    // planes at airports, altitude 0
    safePlanes: 0,
    lost: false,
    lostReason: null,
    lostPlane: null,
    rng,
    nextPlaneNo: 0,      // rotates 0..25 -> letters A..Z
    events: [],          // narration ring buffer
    tickHistory: [],     // for replay/testing
    startTime: opts.now ?? Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Plane construction
// ---------------------------------------------------------------------------

function nextAvailablePlaneNo(game) {
  const used = new Set([...game.air, ...game.ground].map(p => p.planeNo));
  for (let i = 0; i < 26; i++) if (!used.has(i)) return i;
  return -1;
}

export function planeLetter(planeNo, planeType) {
  const c = String.fromCharCode(65 + planeNo); // A..Z
  return planeType === 1 ? c : c.toLowerCase(); // jets uppercase, props lowercase
}

/**
 * Attempt to spawn a plane. Returns the new plane or null if full.
 * BSD atc rule: origin picked randomly; must be > 4 units from any active plane.
 *
 * @param eventSink optional array — if provided, the spawn event is
 *   also pushed here (in addition to the game's internal ring buffer).
 *   `tick()` passes its local events array so callers see spawns
 *   alongside land/exit/beacon/loss events. Direct callers who only
 *   want the plane returned may omit it.
 */
export function spawnPlane(game, eventSink = null) {
  const pf = game.playfield;
  const planeNo = nextAvailablePlaneNo(game);
  if (planeNo < 0) return null;

  const rng = game.rng;
  const planeType = rng() < 0.5 ? 0 : 1; // 0=prop, 1=jet

  // origin candidates: all exits + all airports
  const origins = [
    ...pf.exits.map((e, i) => ({ type: FEATURE.EXIT, idx: i, x: e.x, y: e.y, dir: e.dir })),
    ...pf.airports.map((a, i) => ({ type: FEATURE.AIRPORT, idx: i, x: a.x, y: a.y, dir: a.dir })),
  ];
  const destTargets = origins; // dest picked from same pool minus self

  // pick destination first
  const dest = destTargets[Math.floor(rng() * destTargets.length)];
  // pick origin != dest, retrying on adjacency to existing planes
  let origin = null;
  for (let retry = 0; retry < 32; retry++) {
    const cand = origins[Math.floor(rng() * origins.length)];
    if (cand.type === dest.type && cand.idx === dest.idx) continue;
    const tooClose = game.air.some(p =>
      Math.abs(p.xpos - cand.x) <= 4 && Math.abs(p.ypos - cand.y) <= 4
    );
    if (tooClose) continue;
    origin = cand;
    break;
  }
  if (!origin) return null; // couldn't place

  const isExitOrigin = origin.type === FEATURE.EXIT;
  const plane = {
    planeNo,
    planeType,
    letter: planeLetter(planeNo, planeType),
    origType: origin.type,
    origNo: origin.idx,
    destType: dest.type,
    destNo: dest.idx,
    xpos: origin.x,
    ypos: origin.y,
    altitude: isExitOrigin ? 7 : 0,
    newAltitude: isExitOrigin ? 7 : 0,
    dir: origin.dir,
    newDir: origin.dir,
    fuel: pf.width + pf.height,
    status: STATUS.MARKED,
    delayed: false,
    delayedBeaconNo: -1,
    ticksAlive: 0,
    spawnTick: game.clock,
  };

  if (isExitOrigin) {
    game.air.push(plane);
  } else {
    // ground plane at airport — sits until player commands altitude > 0
    game.ground.push(plane);
  }
  const spawnEvent = { type: 'spawn', tick: game.clock, plane: plane.letter };
  game.events.push(spawnEvent);
  if (eventSink) eventSink.push(spawnEvent);
  return plane;
}

// ---------------------------------------------------------------------------
// Command execution — mutates newAltitude / newDir / status only
// ---------------------------------------------------------------------------

/**
 * Execute a parsed command against the game state.
 * @param cmd shape: { plane, action, arg }
 *   actions:
 *     'altitude'      arg = 0..9
 *     'altitudeUp'    arg = +delta
 *     'altitudeDown'  arg = -delta
 *     'turn'          arg = 0..7 (absolute direction)
 *     'turnLeft'      arg = number of 45deg steps (default 2)
 *     'turnRight'     arg = number of 45deg steps (default 2)
 *     'turnHardLeft'  arg = 2 (fixed)
 *     'turnHardRight' arg = 2 (fixed)
 *     'circle'        arg = MAXDIR (circle sentinel)
 *     'mark'
 *     'ignore'
 *     'unmark'
 *     'towardsBeacon' arg = beacon idx
 *     'towardsAirport'arg = airport idx
 *     'towardsExit'   arg = exit idx
 * @returns { ok: bool, error?: string }
 */
export function executeCommand(game, cmd) {
  const all = [...game.air, ...game.ground];
  const plane = all.find(p => p.letter.toLowerCase() === cmd.plane.toLowerCase());
  if (!plane) return { ok: false, error: `No plane ${cmd.plane}` };

  const pf = game.playfield;

  switch (cmd.action) {
    case 'altitude':
      if (cmd.arg < 0 || cmd.arg > 9) return { ok: false, error: 'altitude 0..9' };
      plane.newAltitude = cmd.arg;
      break;
    case 'altitudeUp':
      plane.newAltitude = Math.min(9, plane.altitude + cmd.arg);
      break;
    case 'altitudeDown':
      plane.newAltitude = Math.max(0, plane.altitude - cmd.arg);
      break;
    case 'turn':
      if (cmd.arg < 0 || cmd.arg > 7) return { ok: false, error: 'direction 0..7' };
      plane.newDir = cmd.arg;
      break;
    case 'turnLeft':
      plane.newDir = ((plane.dir - (cmd.arg ?? 1)) % MAXDIR + MAXDIR) % MAXDIR;
      break;
    case 'turnRight':
      plane.newDir = (plane.dir + (cmd.arg ?? 1)) % MAXDIR;
      break;
    case 'turnHardLeft':
      plane.newDir = ((plane.dir - 2) % MAXDIR + MAXDIR) % MAXDIR;
      break;
    case 'turnHardRight':
      plane.newDir = (plane.dir + 2) % MAXDIR;
      break;
    case 'circle':
      plane.newDir = MAXDIR; // sentinel meaning "circle"
      break;
    case 'mark':      plane.status = STATUS.MARKED; break;
    case 'ignore':    plane.status = STATUS.IGNORED; break;
    case 'unmark':    plane.status = STATUS.UNMARKED; break;
    case 'towardsBeacon':
    case 'towardsAirport':
    case 'towardsExit': {
      const list = cmd.action === 'towardsBeacon' ? pf.beacons
                 : cmd.action === 'towardsAirport' ? pf.airports
                 : pf.exits;
      if (cmd.arg < 0 || cmd.arg >= list.length) return { ok: false, error: 'index oob' };
      const target = list[cmd.arg];
      plane.newDir = dirTowards(plane.xpos, plane.ypos, target.x, target.y);
      break;
    }
    default:
      return { ok: false, error: 'unknown action ' + cmd.action };
  }

  return { ok: true, plane };
}

/** Compute the compass direction (0..7) from (fx,fy) toward (tx,ty). */
export function dirTowards(fx, fy, tx, ty) {
  const dx = tx - fx, dy = ty - fy;
  if (dx === 0 && dy === 0) return 0;
  const angle = Math.atan2(dy, dx); // radians, x-right y-down
  // 0=N (angle -π/2), 2=E (angle 0), 4=S (angle π/2), 6=W (angle π)
  // Convert: dir = round((angle + π/2) / (π/4)) mod 8
  let dir = Math.round((angle + Math.PI / 2) / (Math.PI / 4));
  dir = ((dir % MAXDIR) + MAXDIR) % MAXDIR;
  return dir;
}

// ---------------------------------------------------------------------------
// The tick — advances one game step
// ---------------------------------------------------------------------------

/**
 * Advance the game by one tick.
 * Faithful to spec.md §Turn Order.
 * @returns list of events that occurred this tick
 */
export function tick(game) {
  if (game.lost) return { events: [] };

  const events = [];
  const pf = game.playfield;
  game.clock++;

  // 1. ground-to-air promotion
  for (let i = game.ground.length - 1; i >= 0; i--) {
    const p = game.ground[i];
    if (p.newAltitude > 0) {
      game.ground.splice(i, 1);
      game.air.push(p);
      events.push({ type: 'takeoff', plane: p.letter });
    }
  }

  // 2. per-plane update (in list order)
  for (const p of game.air) {
    if (p.status === STATUS.GONE) continue;

    // props tick every other clock
    if (p.planeType === 0 && (game.clock & 1)) continue;

    p.ticksAlive++;

    // fuel
    p.fuel--;
    if (p.fuel < 0) {
      return endLoss(game, p, 'ran out of fuel', events);
    }

    // altitude change (±1 per tick)
    if (p.altitude < p.newAltitude) p.altitude++;
    else if (p.altitude > p.newAltitude) p.altitude--;

    // direction change (unless delayed)
    if (!p.delayed) {
      if (p.newDir === MAXDIR) {
        // circle: shift dir by +2 each tick (right circle)
        p.dir = (p.dir + 2) % MAXDIR;
      } else {
        const delta = clampDirDelta(p.dir, p.newDir);
        p.dir = ((p.dir + delta) % MAXDIR + MAXDIR) % MAXDIR;
      }
    }

    // move
    const d = DISPLACEMENT[p.dir];
    p.xpos += d.dx;
    p.ypos += d.dy;

    // delayed release at beacon
    if (p.delayed && p.delayedBeaconNo >= 0) {
      const bc = pf.beacons[p.delayedBeaconNo];
      if (bc && p.xpos === bc.x && p.ypos === bc.y) {
        p.delayed = false;
        p.delayedBeaconNo = -1;
        if (p.status === STATUS.UNMARKED) p.status = STATUS.MARKED;
        events.push({ type: 'beacon', plane: p.letter, beacon: p.delayedBeaconNo });
      }
    }

    // destination check
    if (p.destType === FEATURE.AIRPORT) {
      const ap = pf.airports[p.destNo];
      if (p.xpos === ap.x && p.ypos === ap.y && p.altitude === 0) {
        if (p.dir === ap.dir) {
          p.status = STATUS.GONE;
          events.push({ type: 'land', plane: p.letter, airport: p.destNo });
          continue;
        } else {
          return endLoss(game, p, 'landed in the wrong direction', events);
        }
      }
    } else if (p.destType === FEATURE.EXIT) {
      const ex = pf.exits[p.destNo];
      if (p.xpos === ex.x && p.ypos === ex.y) {
        if (p.altitude === 9) {
          p.status = STATUS.GONE;
          events.push({ type: 'exit', plane: p.letter, exit: p.destNo });
          continue;
        } else {
          return endLoss(game, p, 'exited at the wrong altitude', events);
        }
      }
    }

    // crash checks
    if (p.altitude > 9) {
      return endLoss(game, p, 'exceeded flight ceiling', events);
    }
    if (p.altitude <= 0) {
      const anyAirport = pf.airports.findIndex(a => a.x === p.xpos && a.y === p.ypos);
      if (anyAirport >= 0) {
        if (p.destType === FEATURE.AIRPORT && anyAirport !== p.destNo) {
          return endLoss(game, p, 'landed at wrong airport', events);
        } else if (p.destType === FEATURE.EXIT) {
          return endLoss(game, p, 'landed instead of exited', events);
        }
        // else fine — landing at own airport handled above
      } else {
        return endLoss(game, p, 'crashed on the ground', events);
      }
    }
    if (p.xpos < 0 || p.xpos >= pf.width || p.ypos < 0 || p.ypos >= pf.height) {
      const anyExit = pf.exits.findIndex(e => e.x === p.xpos && e.y === p.ypos);
      if (anyExit >= 0) {
        if (p.destType === FEATURE.EXIT && anyExit !== p.destNo) {
          return endLoss(game, p, 'exited via the wrong exit', events);
        } else if (p.destType === FEATURE.AIRPORT) {
          return endLoss(game, p, 'exited instead of landed', events);
        }
      } else {
        return endLoss(game, p, 'illegally left the flight arena', events);
      }
    }
  }

  // 3. sweep gone
  for (let i = game.air.length - 1; i >= 0; i--) {
    if (game.air[i].status === STATUS.GONE) {
      game.air.splice(i, 1);
      game.safePlanes++;
    }
  }

  // 4. collision check
  for (let i = 0; i < game.air.length; i++) {
    for (let j = i + 1; j < game.air.length; j++) {
      const a = game.air[i], b = game.air[j];
      if (Math.abs(a.altitude - b.altitude) <= 1 &&
          Math.abs(a.xpos - b.xpos) <= 1 &&
          Math.abs(a.ypos - b.ypos) <= 1) {
        return endLoss(game, a, `collided with ${b.letter}`, events);
      }
    }
  }

  // 5. new plane roll
  if (Math.floor(game.rng() * pf.newplaneMean) === 0) {
    spawnPlane(game, events);
  }

  return { events };
}

function endLoss(game, plane, reason, events) {
  game.lost = true;
  game.lostPlane = plane.letter;
  game.lostReason = reason;
  events.push({ type: 'loss', plane: plane.letter, reason });
  return { events };
}

// ---------------------------------------------------------------------------
// Convenience: full-game snapshot for rendering
// ---------------------------------------------------------------------------

export function snapshot(game) {
  return {
    clock: game.clock,
    playfield: game.playfield,
    air: game.air.map(p => ({ ...p })),
    ground: game.ground.map(p => ({ ...p })),
    safePlanes: game.safePlanes,
    lost: game.lost,
    lostReason: game.lostReason,
    lostPlane: game.lostPlane,
  };
}
