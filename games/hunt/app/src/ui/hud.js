// HUD: the modern face of hunt's status panel (draw.c drawstatus): ammo,
// gun heat, damage / capacity, cloak or scan left, the player list with
// scores; plus a kill feed, the message line, a weapon bar and a radar of
// gunshots — faithful to the original, where every shot fired is drawn on
// every screen (execute.c:377-386), so everyone "hears" everyone.

import * as K from '../engine/constants.js';
import * as H from '../engine/hunt.js';
import { scoreboard } from '../engine/match.js';
import { ACTIONS, MODERN_DEFAULT, CLASSIC } from '../keymap.js';

const $ = (id) => document.getElementById(id);
const FACE_ARROW = { [K.LEFTS]: '&larr;', [K.RIGHT]: '&rarr;', [K.ABOVE]: '&uarr;', [K.BELOW]: '&darr;', [K.FLYER]: '&amp;' };

const WEAPONS = [
  ['shot', 'Shot', 1], ['grenade', 'Grenade', 9], ['satchel', 'Satchel', 25], ['bomb7', 'Bomb', 49],
  ['slime', 'Slime', 5], ['scan', 'Scan', 1], ['cloak', 'Cloak', 1],
];

export class Hud {
  constructor() {
    this.feed = [];
    this.pings = [];
    this.radar = $('radar');
    this.rctx = this.radar.getContext('2d');
    this.lastMsg = '';
    this.msgT = 0;
  }

  keyLabel(action, scheme, modern = MODERN_DEFAULT) {
    if (scheme === 'classic') {
      return ACTIONS[action];
    }
    const code = Object.keys(modern).find((c) => modern[c] === action);
    if (!code) return '';
    return code.replace('Key', '').replace('Digit', '').replace('Space', 'Spc');
  }

  buildWeapons(scheme, modern) {
    $('weapons').innerHTML = WEAPONS.map(([a, name, cost]) => `<span class="w" data-a="${a}" data-c="${cost}"><kbd>${this.keyLabel(a, scheme, modern)}</kbd>${name}<span class="c">${cost}</span></span>`).join('')
      + (scheme === 'modern' ? '<span class="w"><kbd>LMB</kbd>shot <kbd>RMB</kbd>grenade</span>' : '');
  }

  helpKeys(scheme, modern) {
    const rows = [
      ['moveLeft', 'moveRight'], ['moveUp', 'moveDown'], ['faceLeft', 'faceRight'], ['faceUp', 'faceDown'],
      ['shot', 'grenade'], ['satchel', 'bomb7'], ['slime', 'slime2'], ['scan', 'cloak'],
    ];
    const label = { moveLeft: 'move left', moveRight: 'move right', moveUp: 'move up', moveDown: 'move down', faceLeft: 'face left', faceRight: 'face right', faceUp: 'face up', faceDown: 'face down', shot: 'shot · 1 ammo', grenade: 'grenade 3×3 · 9', satchel: 'satchel 5×5 · 25', bomb7: 'bomb 7×7 · 49 (5–0 bigger)', slime: 'slime · 5', slime2: 'more slime · 10', scan: 'scan · 1', cloak: 'cloak · 1' };
    return rows.map(([a, b]) => `<kbd>${this.keyLabel(a, scheme, modern)}</kbd><span>${label[a]}</span><kbd>${this.keyLabel(b, scheme, modern)}</kbd><span>${label[b]}</span>`).join('');
  }

  onEvents(g, me, events, colorOf) {
    for (const e of events) {
      if (e.t === 'death') {
        const text = e.text.replace(/^\| | \|$/g, '');
        this.feed.unshift({ text, name: e.name, t: performance.now(), me: me && e.name === H.nameOf(g, me) });
        if (this.feed.length > 6) this.feed.pop();
      } else if (e.t === 'msg' && me && e.to === me.id) {
        this.lastMsg = e.text;
        this.msgT = performance.now();
      } else if (e.t === 'fire' || e.t === 'boom') {
        this.pings.push({ x: e.x, y: e.y, t: performance.now(), kind: e.t, size: e.size || 1 });
        if (this.pings.length > 40) this.pings.shift();
      } else if (e.t === 'enter' && me && e.id === me.id) {
        this.lastMsg = '';
      } else if (e.t === 'defuse' && me && e.id === me.id) {
        this.lastMsg = `Defused a mine: +${e.ammo} ammo`;
        this.msgT = performance.now();
      }
    }
    void colorOf;
  }

  update(g, me, ctx) {
    const { colorOf, cheated, humanName } = ctx;
    // player card
    const alive = !!me;
    const p = me || ctx.lastMe;
    if (p) {
      const col = colorOf(p).css;
      $('c-dot').style.background = col;
      $('c-dot').style.color = col;
      $('c-name').textContent = humanName;
      const team = g.mode === 'teams' ? `TEAM ${String.fromCharCode(H.ident(g, p)?.team ?? 32)}` : 'FREE FOR ALL';
      $('c-tag').textContent = alive ? team : 'DOWN';
      $('c-dmg').textContent = `${p.damage} / ${p.damcap}`;
      $('dmgbar').firstElementChild.style.width = `${Math.min(100, (p.damage / p.damcap) * 100)}%`;
      $('c-ammo').textContent = String(p.ammo);
      const bar = $('ammobar');
      bar.firstElementChild.style.width = `${Math.min(100, (p.ammo / 60) * 100)}%`;
      if (!bar.dataset.ticks) {
        bar.dataset.ticks = '1';
        for (const c of [1, 9, 25, 49]) {
          const t = document.createElement('span');
          t.className = 'tick';
          t.style.left = `${(c / 60) * 100}%`;
          bar.appendChild(t);
        }
      }
      const cloaked = p.cloak >= 0;
      const scanning = p.scan > 0;
      $('c-cloaklab').textContent = cloaked ? 'CLOAK · HIDDEN FROM SCANS' : scanning ? 'SCAN · SEEING MOVERS' : 'CLOAK / SCAN OFF';
      $('c-cloak').textContent = cloaked ? `${p.cloak + 1} moves` : scanning ? `${p.scan} moves` : '—';
      $('cloakbar').firstElementChild.style.width = `${cloaked ? Math.min(100, ((p.cloak + 1) / K.CLOAKLEN) * 100) : scanning ? Math.min(100, (p.scan / (g.nplayer * 20)) * 100) : 0}%`;
      const pips = $('c-gun').children;
      for (let i = 0; i < 3; i++) pips[i].classList.toggle('on', p.ncshot > i);
      $('c-boots').classList.toggle('on', p.nboots > 0);
      $('c-boots').textContent = p.nboots === 2 ? 'BOOTS ×2' : p.nboots === 1 ? 'BOOT ×1' : 'NO BOOTS';
      $('c-face').innerHTML = `FACING ${FACE_ARROW[p.face] ?? '?'}`;
    }
    // weapons affordability
    for (const w of document.querySelectorAll('#weapons .w[data-c]')) w.classList.toggle('no', !p || p.ammo < +w.dataset.c);
    // scoreboard
    const rows = scoreboard(g);
    $('s-table').innerHTML = rows.map((r) => {
      const pp = r.id != null ? H.playerById(g, r.id) : null;
      const col = pp ? colorOf(pp).css : '#6b7488';
      const kind = r.bot ? { otto: 'OTTO', novice: 'NOVICE', sharp: 'SHARP' }[r.kind] : 'YOU';
      const stat = r.stat.trim() ? ` ${r.stat}` : '';
      return `<tr class="${r.name === humanName ? 'me' : ''} ${r.alive ? '' : 'dead'}"><td><span class="sw" style="background:${col}"></span>${r.name}${r.team ? `<span class="kind">[${r.team}]</span>` : ''}<span class="kind">${kind}${stat}</span>${r.name === humanName && cheated ? '<span class="cheat">CHEATED</span>' : ''}</td>`
        + `<td class="s">${r.score.toFixed(2)}</td><td class="n">${r.kills}/${r.deaths}</td></tr>`;
    }).join('');
    // feed + message
    const now = performance.now();
    $('f-list').innerHTML = this.feed.map((f, i) => `<div class="k ${i > 2 ? 'old' : ''}" style="${f.me ? 'color:#ff8a95' : ''}">${f.text}</div>`).join('');
    $('msg').textContent = now - this.msgT < 4500 ? this.lastMsg : '';
  }

  // Radar: gunshots and blasts near you, as rings that fade.
  drawRadar(me, face) {
    const c = this.rctx;
    const S = this.radar.width;
    c.clearRect(0, 0, S, S);
    c.save();
    c.translate(S / 2, S / 2);
    const R = S / 2 - 6;
    c.fillStyle = 'rgba(8,12,24,0.85)';
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(111,140,255,0.25)';
    c.lineWidth = 2;
    for (const k of [0.33, 0.66, 1]) { c.beginPath(); c.arc(0, 0, R * k, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.moveTo(-R, 0); c.lineTo(R, 0); c.moveTo(0, -R); c.lineTo(0, R); c.stroke();
    const now = performance.now();
    const range = 26; // cells from centre to rim
    if (me) {
      for (const p of this.pings) {
        const age = (now - p.t) / 1000;
        if (age > 2.5) continue;
        const dx = (p.x - me.x) / range * R;
        const dy = (p.y - me.y) / range * R;
        const d = Math.hypot(dx, dy);
        const a = 1 - age / 2.5;
        const ex = d > R ? dx / d * R : dx;
        const ey = d > R ? dy / d * R : dy;
        c.strokeStyle = p.kind === 'boom' ? `rgba(255,170,80,${a})` : `rgba(255,255,255,${a})`;
        c.lineWidth = p.kind === 'boom' ? 3 : 2;
        c.beginPath(); c.arc(ex, ey, 4 + age * 18 * (p.kind === 'boom' ? 1 + p.size * 0.3 : 0.6), 0, Math.PI * 2); c.stroke();
        c.fillStyle = `rgba(255,${p.kind === 'boom' ? 170 : 255},${p.kind === 'boom' ? 90 : 255},${a})`;
        c.beginPath(); c.arc(ex, ey, 3, 0, Math.PI * 2); c.fill();
      }
      // you: a chevron pointing where you face
      const ang = { [K.RIGHT]: 0, [K.BELOW]: Math.PI / 2, [K.LEFTS]: Math.PI, [K.ABOVE]: -Math.PI / 2 }[face] ?? 0;
      c.rotate(ang);
      c.fillStyle = '#5cffc8';
      c.beginPath(); c.moveTo(11, 0); c.lineTo(-7, 7); c.lineTo(-3, 0); c.lineTo(-7, -7); c.closePath(); c.fill();
    }
    c.restore();
    c.fillStyle = 'rgba(127,140,163,0.8)';
    c.font = '600 17px Chakra Petch, sans-serif';
    c.textAlign = 'center';
    c.fillText('GUNSHOTS', S / 2, S * 0.3);
    c.textAlign = 'left';
  }
}

export { CLASSIC };
