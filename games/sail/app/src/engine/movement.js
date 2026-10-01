// Movement: allowance, helm-string validation, execution with collisions,
// and the computer captains' depth-first move search.
//
// Ported from sail/game.c:44-90 (maxturns, maxmove), sail/pl_5.c:54-153
// (acceptmove), sail/dr_3.c:52-264 (moveall, step) and sail/dr_2.c:147-280
// (closeon, score, move_ship, try).

import { WET, SCENARIOS } from './data.js';
import { DR, DC, DTAB } from './constants.js';
import { range, gunsbear, portside } from './geometry.js';
import { dieroll } from './rng.js';
import {
  snagged, snagged2, fouled2, addFoul, makesignal, emit,
} from './state.js';

// Max turns this move; `af` = drifting (must move ahead before turning).
export function maxturns(sp) {
  let turns = sp.specs.ta;
  const af = sp.drift > 1 && turns !== 0;
  if (af) {
    turns--;
    if (sp.FS === 1) turns = 0;
  }
  return { turns, af };
}

// Squares a ship can sail on heading `dir` in the current wind.
// fs: 0 = use current sails, 1 = assume full sails, -1 = assume battle sails.
export function maxmove(st, sp, dir, fs) {
  const s = sp.specs;
  // WET has rows 0..6. During the hurricane tick (wind 7) the C driver read
  // past the end of the table; the port clamps to the full-gale row (ADR 004).
  const w = WET[Math.min(st.windspeed, 6)][s.class - 1] || [0, 0, 0, 0];
  const [A, B, C, D] = w;
  let riggone = 0;
  let flank = false;
  let move = s.bs;
  if (!s.rig1) riggone++;
  if (!s.rig2) riggone++;
  if (!s.rig3) riggone++;
  if (!s.rig4) riggone++;
  if ((sp.FS || fs) && fs !== -1) {
    flank = true;
    move = s.fs;
  }
  const wd = st.winddir;
  const rel = ((dir - wd) % 8 + 8) % 8; // 0 = running before the wind
  if (rel === 0) move -= 1 + B; // wind dead astern
  else if (rel === 2 || rel === 6) move -= 1 + C; // wind on the beam
  else if (rel === 3 || rel === 5) move = (flank ? 2 : 1) - D; // close-hauled
  else if (rel === 4) move = 0; // in irons
  else move -= A; // wind on the quarter: best point of sail
  move -= riggone;
  return move < 0 ? 0 : move;
}

// Point of sail name for UI / audio, same buckets as maxmove.
export function pointOfSail(winddir, dir) {
  const rel = ((dir - winddir) % 8 + 8) % 8;
  return ['running', 'quarter', 'beam', 'close-hauled', 'in irons', 'close-hauled', 'beam', 'quarter'][rel];
}

const turnLeft = (d) => (d === 1 ? 8 : d - 1);
const turnRight = (d) => (d === 8 ? 1 : d + 1);

// Validate a helm string the way the player's prompt did (sail/pl_5.c:54-153).
// Returns { movebuf, msgs, error, unable, preview } — preview is the list of
// intermediate (dir, allowance) states used by the ghost-path UI.
//
// One documented divergence (ADR 004): on an over-run, the helm keeps every
// order up to the failing one — "if at any point in a movement command you
// turn into the wind, the movement stops there" (sail.6:413-423, whose own
// example is `l1l4` -> `Helm: l1l`). The C code instead cut the string to its
// first character; the man page and the canonical test T-08 win.
export function validateMove(st, sp, input) {
  const msgs = [];
  if (!sp.specs.crew3 || snagged(sp) || !st.windspeed) {
    return { movebuf: 'd', msgs: ['Unable to move'], error: false, unable: true };
  }
  const { turns, af } = maxturns(sp);
  let ta = turns;
  let ma = maxmove(st, sp, sp.dir, 0);
  let dir = sp.dir;
  let vma = ma;
  let moved = false;
  let last = '';
  let buf = '';
  const src = String(input || '').toLowerCase();
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    let cut = false;
    if (c === 'l' || c === 'r') {
      dir = c === 'l' ? turnLeft(dir) : turnRight(dir);
      if (last === 't') {
        msgs.push("Ship can't turn that fast.");
        cut = true;
      }
      last = 't';
      ma--;
      ta--;
      vma = Math.min(ma, maxmove(st, sp, dir, 0));
      if ((ta < 0 && moved) || (vma < 0 && moved)) cut = true;
    } else if (c === 'b') {
      ma--;
      vma--;
      last = 'b';
      if ((ta < 0 && moved) || (vma < 0 && moved)) cut = true;
    } else if (c === '0' || c === 'd') {
      break;
    } else if (c >= '1' && c <= '7') {
      if (last === '0') {
        msgs.push("Can't move that fast.");
        cut = true;
      }
      last = '0';
      moved = true;
      ma -= +c;
      vma -= +c;
      if ((ta < 0 && moved) || (vma < 0 && moved)) cut = true;
    } else if (/\s/.test(c)) {
      continue;
    } else {
      msgs.push('Input error.');
      break;
    }
    if (cut) break;
    buf += c;
  }
  let error = false;
  const turnfirst = buf[0] === 'l' || buf[0] === 'r';
  const overrun = (ta < 0 && moved) || (vma < 0 && moved);
  const driftTurn = af && turnfirst && moved;
  let fsDropped = false;
  if (overrun || driftTurn) {
    error = true;
    msgs.push('Movement Error;');
    if (ta < 0 && moved) {
      if (sp.FS === 1) fsDropped = true;
    } else if (driftTurn) {
      // drifting: only the single opening turn is possible (sail.6:376-380)
      buf = buf.slice(0, 1);
    }
  }
  if (af && !moved && sp.FS === 1) fsDropped = true;
  if (fsDropped) msgs.push('No hands to set full sails.');
  const movebuf = buf || 'd';
  msgs.push(`Helm: ${movebuf}`);
  return { movebuf, msgs, error, unable: false, fsDropped };
}

// Allowance summary for the move prompt: "move (7, 4)" plus the drift quote.
export function movePrompt(st, sp) {
  const { turns, af } = maxturns(sp);
  return { ma: maxmove(st, sp, sp.dir, 0), ta: turns, af };
}

// Simulate a helm string from a ship's current pose WITHOUT the wind drift,
// for the ghost-path preview. Returns the list of poses (including start).
export function tracePath(sp, movebuf) {
  const poses = [{ row: sp.row, col: sp.col, dir: sp.dir }];
  let { row, col, dir } = sp;
  for (const ch of movebuf) {
    if (ch === 'r') dir = turnRight(dir);
    else if (ch === 'l') dir = turnLeft(dir);
    else if (ch >= '1' && ch <= '7') {
      const dist = dir % 2 === 0 ? DTAB[+ch] : +ch;
      row -= DR[dir] * dist;
      col -= DC[dir] * dist;
    } else continue;
    poses.push({ row, col, dir });
  }
  return poses;
}

// --- execution ------------------------------------------------------------------

// One step of a movement string (sail/dr_3.c:226-264).
function step(st, sp, com, movedRef) {
  switch (com) {
    case 'r': sp.dir = turnRight(sp.dir); break;
    case 'l': sp.dir = turnLeft(sp.dir); break;
    case '0': case '1': case '2': case '3':
    case '4': case '5': case '6': case '7': {
      const dist = sp.dir % 2 === 0 ? DTAB[+com] : +com;
      sp.row -= DR[sp.dir] * dist;
      sp.col -= DC[sp.dir] * dist;
      movedRef.moved = true;
      break;
    }
    case 'd':
      if (!movedRef.moved) {
        if (st.windspeed !== 0 && ++sp.drift > 2
          && ((sp.specs.class >= 3 && !snagged(sp)) || (st.turn & 1) === 0)) {
          sp.row -= DR[st.winddir];
          sp.col -= DC[st.winddir];
          movedRef.drifted = true;
        }
      } else sp.drift = 0;
      break;
    default: break;
  }
}

function isIsolated(st, ship) {
  return !st.ships.some((sp) => ship !== sp && range(ship, sp) <= 10);
}

// Bigger ships shove smaller ones aside on collision (sail/dr_3.c:212-224).
function push(from, to) {
  const sb = to.specs.guns;
  const bs = from.specs.guns;
  if (sb > bs) return true;
  if (sb < bs) return false;
  return from.index < to.index;
}

// Execute every ship's movebuf in lock-step, resolving collisions and fouls
// after each step (sail/dr_3.c:52-187). AI movebufs must already be set.
export function moveall(ctx) {
  const { st } = ctx;
  const ships = st.ships;
  for (const sp of ships) {
    if (snagged(sp)) sp.movebuf = 'd';
    else if (sp.movebuf[0] !== 'd') sp.movebuf += 'd';
  }
  const start = ships.map((sp) => ({ row: sp.row, col: sp.col, dir: sp.dir, drift: sp.drift }));
  const moved = ships.map(() => ({ moved: false, drifted: false }));
  const paths = ships.map((sp) => [{ row: sp.row, col: sp.col, dir: sp.dir }]);
  const bufs = ships.map((sp) => sp.movebuf.split(''));
  const stillmoving = (k) => bufs.some((b) => b[k]);
  for (let k = 0; stillmoving(k); k++) {
    ships.forEach((sp, n) => {
      if (!bufs[n][k]) bufs[n].length = k; // propagate the terminator
      else if (sp.dir) step(st, sp, bufs[n][k], moved[n]);
    });
    ships.forEach((sp) => {
      if (sp.dir === 0 || isIsolated(st, sp)) return;
      ships.forEach((sq) => {
        if (sp === sq || sq.dir === 0 || !push(sp, sq)) return;
        let snap = false;
        if (snagged2(sp, sq) && range(sp, sq) > 1) snap = true;
        if (!range(sp, sq) && !fouled2(sp, sq)) {
          makesignal(ctx, sp, 'collision with $$', sq);
          emit(ctx, 'collision', { a: sp.index, b: sq.index, step: k });
          if (dieroll(st.rng) < 4) {
            makesignal(ctx, sp, 'fouled with $$', sq);
            addFoul(st, sp, sq);
            addFoul(st, sq, sp);
            emit(ctx, 'foul', { a: sp.index, b: sq.index });
          }
          snap = true;
        }
        if (snap) {
          bufs[sp.index].length = Math.min(bufs[sp.index].length, k + 1);
          bufs[sq.index].length = Math.min(bufs[sq.index].length, k + 1);
          sq.row = sp.row - 1;
          sq.col = (sp.dir === 1 || sp.dir === 5) ? sp.col - 1 : sp.col;
          sq.dir = sp.dir;
        }
      });
    });
    ships.forEach((sp, n) => {
      const prev = paths[n][paths[n].length - 1];
      if (prev.row !== sp.row || prev.col !== sp.col || prev.dir !== sp.dir) {
        paths[n].push({ row: sp.row, col: sp.col, dir: sp.dir, k });
      }
    });
  }
  const changed = {};
  ships.forEach((sp, n) => {
    if (sp.dir !== 0) sp.movebuf = '';
    if (paths[n].length > 1) changed[n] = paths[n];
  });
  emit(ctx, 'move', {
    paths: changed,
    drifted: ships.filter((sp, n) => moved[n].drifted).map((sp) => sp.index),
    from: start,
  });
}

// --- computer captains ---------------------------------------------------------------

// Where would `movement` leave the ship? (sail/dr_2.c:189-227, used by score)
function moveShipSim(st, sp, p, pose) {
  let moved = false;
  for (const ch of p) {
    if (ch === 'r') pose.dir = turnRight(pose.dir);
    else if (ch === 'l') pose.dir = turnLeft(pose.dir);
    else if (ch >= '1' && ch <= '7') {
      moved = true;
      const dist = pose.dir % 2 === 0 ? DTAB[+ch] : +ch;
      pose.row -= DR[pose.dir] * dist;
      pose.col -= DC[pose.dir] * dist;
    }
  }
  if (!moved) {
    if (st.windspeed !== 0 && ++pose.drift > 2) {
      if ((sp.specs.class >= 3 && !snagged(sp)) || (st.turn & 1) === 0) {
        pose.row -= DR[st.winddir];
        pose.col -= DC[st.winddir];
      }
    }
  } else pose.drift = 0;
}

// The driver's "typical A.I. distance function" (sail/dr_2.c:158-187):
// close the range, bonus if our guns bear within 4, never sail stern-on.
function score(st, ship, to, movement) {
  if (ship.dir === 0) return 0;
  const saved = { row: ship.row, col: ship.col, dir: ship.dir };
  const pose = { row: ship.row, col: ship.col, dir: ship.dir, drift: ship.drift };
  moveShipSim(st, ship, movement, pose);
  ship.row = pose.row;
  ship.col = pose.col;
  ship.dir = pose.dir;
  let ran = range(ship, to);
  let total = -50 * ran;
  if (ran < 4 && gunsbear(ship, to)) total += 60;
  ran = portside(ship, to, 1) - ship.dir;
  if (ran === 4 || ran === -4) total = -30000;
  ship.row = saved.row;
  ship.col = saved.col;
  ship.dir = saved.dir;
  return total;
}

// Depth-first search over helm strings (sail/dr_2.c:229-269).
function tryMoves(st, f, t, best, temp, ma, ta, vma, dir) {
  const lastCh = temp[temp.length - 1] || '';
  if (!(lastCh >= '1' && lastCh <= '9')) {
    for (let n = 1; vma - n >= 0; n++) {
      const cand = temp + n;
      const sc = score(st, f, t, cand);
      if (sc > best.high) {
        best.high = sc;
        best.cmd = cand;
      }
      tryMoves(st, f, t, best, cand, ma - n, ta, vma - n, dir);
    }
  }
  const endCh = temp[temp.length - 1] || '';
  const canTurn = (ma > 0 && ta > 0 && endCh !== 'l' && endCh !== 'r') || temp.length === 0;
  if (canTurn) {
    const nd = turnRight(dir);
    const cand = `${temp}r`;
    const sc = score(st, f, t, cand);
    if (sc > best.high) {
      best.high = sc;
      best.cmd = cand;
    }
    tryMoves(st, f, t, best, cand, ma - 1, ta - 1, Math.min(ma - 1, maxmove(st, f, nd, 0)), nd);
  }
  if (canTurn) {
    const nd = turnLeft(dir);
    const cand = `${temp}l`;
    const sc = score(st, f, t, cand);
    if (sc > best.high) {
      best.high = sc;
      best.cmd = cand;
    }
    tryMoves(st, f, t, best, cand, ma - 1, ta - 1, Math.min(ma - 1, maxmove(st, f, nd, 0)), nd);
  }
}

export function closeon(st, from, to, ta, ma) {
  const best = { high: -30000, cmd: '' };
  tryMoves(st, from, to, best, '', ma, ta, ma, from.dir);
  return best.cmd;
}

export { SCENARIOS };
