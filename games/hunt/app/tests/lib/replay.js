// Replays a tests/golden/scenarios/*.hunt script through the JavaScript
// engine and produces records in the exact shape scripts/oracle/harness.c
// prints, so tests/golden.test.js can compare them field by field.

import * as H from '../../src/engine/hunt.js';
import * as K from '../../src/engine/constants.js';
import { addBot, runBots } from '../../src/bots/index.js';

const { WIDTH, HEIGHT } = K;
const chr = (n) => String.fromCharCode(n & 0xff);

function fnvRows(rowsOf) {
  let h = 2166136261;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      h ^= rowsOf(y, x) & 0xff;
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  return h >>> 0;
}

const rows = (get) => {
  const out = [];
  for (let y = 0; y < HEIGHT; y++) {
    let s = '';
    for (let x = 0; x < WIDTH; x++) s += chr(get(y, x));
    out.push(s);
  }
  return out;
};

export function dump(g, full, logs) {
  const M = g.maze;
  const rec = { step: g.step, seed: g.seed };
  rec.maze = full ? rows((y, x) => M[y * WIDTH + x]) : fnvRows((y, x) => M[y * WIDTH + x]);
  rec.players = [];
  for (let i = 0; i < g.np; i++) {
    const pp = g.slots[i];
    const id = H.ident(g, pp);
    const p = {
      name: id.name, team: chr(id.team), x: pp.x, y: pp.y, face: chr(pp.face), over: chr(pp.over),
      ammo: pp.ammo, damage: pp.damage, damcap: pp.damcap, cloak: pp.cloak, scan: pp.scan,
      ncshot: pp.ncshot, flying: pp.flying, flyx: pp.flyx, flyy: pp.flyy, undershot: pp.undershot ? 1 : 0,
      nboots: pp.nboots, queue: pp.q.length,
    };
    if (full) {
      p.mem = rows((y, x) => pp.mem[y * WIDTH + x]);
      p.screen = rows((y, x) => H.screenChar(g, pp, y, x));
    } else {
      p.mem = fnvRows((y, x) => pp.mem[y * WIDTH + x]);
    }
    rec.players.push(p);
  }
  const nameOfSlot = (s) => (s >= 0 ? H.ident(g, g.slots[s]).name : null);
  const nameOfIid = (iid) => (iid >= 0 ? g.scores.find((s) => s.iid === iid).name : null);
  rec.bullets = g.bullets.map((b) => [b.x, b.y, chr(b.face), chr(b.type), b.charge, b.size, chr(b.over),
    b.expl ? 1 : 0, nameOfSlot(b.owner), nameOfIid(b.score)]);
  rec.expl = g.expl.map((l) => l.map(([y, x, c]) => [y, x, chr(c)]));
  rec.removed = g.removed.map((r) => [r[0], r[1]]);
  rec.remIndex = g.remIndex;
  rec.volcano = g.volcano;
  rec.boots = g.boots.map((b) => ({ x: b.x, y: b.y, face: chr(b.face), over: chr(b.over), flying: b.flying, flyx: b.flyx, flyy: b.flyy, undershot: b.undershot ? 1 : 0 }));
  rec.scores = g.scores.map((s) => ({
    name: s.name, team: chr(s.team), kills: s.kills, entries: s.entries, score: s.score,
    absorbed: s.absorbed, faced: s.faced, shot: s.shot, robbed: s.robbed, slime: s.slime,
    missed: s.missed, ducked: s.ducked, gkills: s.gkills, bkills: s.bkills, deaths: s.deaths,
    stillb: s.stillb, saved: s.saved,
  }));
  rec.msgs = logs.msgs;
  rec.deaths = logs.deaths;
  rec.otto = logs.otto;
  return rec;
}

const FACE = { '<': K.LEFTS, '>': K.RIGHT, '^': K.ABOVE, v: K.BELOW };

// Runs a scenario; returns the list of records.
export function replay(script) {
  const lines = script.split(/\r?\n/);
  let g = H.newGame({ seed: 0 });
  const out = [];
  const empty = () => ({ msgs: [], deaths: [], otto: [] });
  let logs = empty();
  const collect = () => {
    logs = empty();
    for (const e of g.ev) {
      if (e.t === 'msg') logs.msgs.push([e.name, e.text]);
      else if (e.t === 'death') logs.deaths.push([e.name, e.text]);
      else if (e.t === 'bot') logs.otto.push([e.name, e.cmd]);
    }
  };
  const iterate = () => {
    H.step(g, runBots);
    collect();
  };
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (!line.trim() || line.startsWith('#')) continue;
    const [a, b, c, d] = line.trim().split(/\s+/);
    switch (a) {
      case 'seed': g.seed = parseInt(b, 10) | 0; break;
      case 'init': H.initArena(g); break;
      case 'maze': {
        const m = lines.slice(li + 1, li + 1 + HEIGHT);
        li += HEIGHT;
        H.loadMaze(g, m);
        break;
      }
      case 'join': {
        const st = d === 's' ? K.Q_SCAN : d === 'f' ? K.Q_FLY : K.Q_CLOAK;
        H.connect(g, b, c === '-' ? ' ' : c, st);
        break;
      }
      case 'ensure': {
        if (H.findPlayer(g, b)) break;
        const st = d === 's' ? K.Q_SCAN : d === 'f' ? K.Q_FLY : K.Q_CLOAK;
        H.connect(g, b, c === '-' ? ' ' : c, st);
        break;
      }
      case 'bot': {
        addBot(g, b, 'otto', parseInt(c, 10));
        const pp = H.findPlayer(g, b);
        if (pp && !pp.q.length) {
          g.ev = [];
          runBots(g);
          for (const e of g.ev) if (e.t === 'bot') logs.otto.push([e.name, e.cmd]);
        }
        break;
      }
      case 'autorejoin': g.autorejoin = b === '1'; break;
      case 'key': {
        const pp = H.findPlayer(g, b);
        const keys = line.slice(line.indexOf(b, 4) + b.length + 1);
        if (pp) H.key(g, pp, keys);
        break;
      }
      case 'place': {
        const pp = H.findPlayer(g, b);
        const f = line.trim().slice(-1);
        const y = +c;
        const x = +d;
        g.maze[pp.y * WIDTH + pp.x] = pp.over;
        pp.over = g.maze[y * WIDTH + x];
        pp.y = y;
        pp.x = x;
        pp.face = FACE[f];
        g.maze[y * WIDTH + x] = pp.face;
        break;
      }
      case 'put': g.maze[+b * WIDTH + +c] = line.trim().slice(-1).charCodeAt(0); break;
      case 'set': {
        const pp = H.findPlayer(g, b);
        if (pp) pp[c] = parseInt(d, 10);
        break;
      }
      case 'step': case 'fullstep': {
        const n = b ? parseInt(b, 10) : 1;
        for (let k = 0; k < n; k++) {
          iterate();
          out.push(dump(g, a === 'fullstep', logs));
        }
        break;
      }
      case 'quiet': {
        const n = b ? parseInt(b, 10) : 1;
        for (let k = 0; k < n; k++) iterate();
        break;
      }
      case 'dump': out.push(dump(g, false, logs)); break;
      case 'full': out.push(dump(g, true, logs)); break;
      default: throw new Error(`replay: unknown op ${line}`);
    }
  }
  return { records: out, game: g };
}
