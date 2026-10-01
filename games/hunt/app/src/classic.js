// Classic view: the hunt client's 80 x 24 terminal, drawn from the same
// engine state as the 3D arena. The maze area is the player's own screen
// (engine `scr`, see src/engine/hunt.js); the right-hand panel follows
// drawstatus() (draw.c:73-123); row 23 is the message line.

import * as K from './engine/constants.js';
import { ident } from './engine/hunt.js';

const W = K.SCREEN_WIDTH;
const Hh = K.SCREEN_HEIGHT;

const pad = (s, n) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));
const num = (v, n) => pad(String(v).padStart(n), n);

export function classicLines(g, me, state) {
  const rows = [];
  for (let y = 0; y < Hh; y++) rows.push(new Array(W).fill(' '));
  const put = (y, x, s) => { for (let i = 0; i < s.length && x + i < W; i++) rows[y][x + i] = s[i]; };

  // Maze: the player's screen; while dead, the last screen they had.
  const scr = me ? me.scr : state.lastScr;
  if (scr) {
    for (let y = 0; y < K.HEIGHT; y++) {
      for (let x = 0; x < K.WIDTH; x++) rows[y][x] = String.fromCharCode(scr[y * K.WIDTH + x] || 32);
    }
  }
  if (me) state.lastScr = me.scr.slice();

  // Status panel (STAT_*_ROW / _COL in hunt.h:132-144)
  const p = me || state.lastMe;
  if (me) state.lastMe = { ammo: me.ammo, ncshot: me.ncshot, damage: me.damage, damcap: me.damcap };
  if (p) {
    put(0, 60, 'Ammo:');
    put(0, 74, num(p.ammo, 3));
    put(1, 60, 'Gun:');
    put(1, 74, p.ncshot > K.MAXNCSHOT ? '   ' : ' ok');
    put(2, 60, 'Damage:');
    put(2, 74, `${num(p.damage, 2)}/${num(p.damcap, 2)}`);
    put(3, 60, 'Kills:');
    put(3, 74, num((p.damcap - K.MAXDAM) / 2, 3));
  }
  put(5, 60, 'Player:');
  for (let i = 0; i < g.np; i++) {
    const pp = g.slots[i];
    const id = ident(g, pp);
    const line = `${id.score.toFixed(2).padStart(5)}${K.statChar(pp)}${pad(id.name, 10)} ${String.fromCharCode(id.team)}`;
    put(6 + i, 61, pad(line, 18));
  }

  // The death box zap() draws in the middle of the maze (driver.c:628-640)
  if (!me && state.death) {
    const len = state.death.length;
    const x = Math.floor((K.WIDTH - len) / 2);
    const y = Math.floor(K.HEIGHT / 2);
    const bar = '+' + '-'.repeat(len - 2) + '+';
    put(y - 1, x, bar);
    put(y, x, state.death);
    put(y + 1, x, bar);
  }
  // Message line (row 23), or the re-entry question while dead.
  if (!me && state.death) put(23, 0, state.prompt || 'Re-enter game?  [c] cloaked  [s] scanning  [f] flying');
  else if (state.message) put(23, 0, pad(state.message, 79));
  return rows.map((r) => r.join(''));
}

// Render into a <pre>; own glyph and team digits get spans for colour.
export function renderClassic(pre, g, me, state) {
  const lines = classicLines(g, me, state);
  const html = lines.map((l, y) => {
    let out = '';
    for (let x = 0; x < l.length; x++) {
      const c = l[x];
      const e = c === '<' || c === '>' || c === '^' || c === 'v' ? 'me'
        : (y < K.HEIGHT && x < K.WIDTH && (c === '{' || c === '}' || c === 'i' || c === '!' || c === '&')) ? 'foe'
        : (y < K.HEIGHT && x < K.WIDTH && (c === ':' || c === 'o' || c === 'O' || c === '@')) ? 'shot'
        : (y < K.HEIGHT && x < K.WIDTH && (c === '$' || c === '~')) ? 'goo'
        : null;
      const ch = c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c;
      out += e && (y < K.HEIGHT && x < K.WIDTH) ? `<span class="c-${e}">${ch}</span>` : ch;
    }
    return out;
  }).join('\n');
  if (pre.__last !== html) {
    pre.innerHTML = html;
    pre.__last = html;
  }
}
