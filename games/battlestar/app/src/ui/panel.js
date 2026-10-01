// Side panel: status, body, bearings (compass + minimap), inventory; and the
// world map used by the Override panel.

import { C, OUCH, OBJWT, OBJCUMBER } from '../engine/battlestar.js';
import { LAYOUT } from '../scene/layout.js';
import { ROOM_CLASS, relativeExits } from '../scene/composer.js';
import { objectName } from './helpers.js';

const $ = (id) => document.getElementById(id);
const ARTIFACTS = new Set([C.AMULET, C.MEDALION, C.TALISMAN]);
const FATAL = new Set([C.SKULL, C.INCISE, C.NECK]);

/** Short human labels for the 13 injuries (ouch[] is kept for the tooltip). */
const INJURY_SHORT = ['abrasions', 'lacerations', 'puncture', 'amputation', 'sprained wrist', 'broken ankle',
  'broken arm', 'broken ribs', 'broken leg', 'broken back', 'bleeding', 'fractured skull', 'broken neck'];

/** Facing -> angle (radians, 0 = north up, clockwise). */
const ANGLE = { [C.NORTH]: 0, [C.EAST]: Math.PI / 2, [C.SOUTH]: Math.PI, [C.WEST]: -Math.PI / 2 };

export function skyText(g) {
  if (g.position <= 31) return 'inside the battlestar';
  if (g.notes[C.LAUNCHED] && g.position <= 68) return 'deep space';
  const night = g.isNight;
  const k = Math.max(0, Math.min(6, Math.trunc(((g.ourtime - g.rythmn) % 100) / 14)));
  const DAY = ['sunrise', 'early morning', 'late morning', 'noon', 'early afternoon', 'late afternoon', 'near sunset'];
  const NIGHT = ['after sunset', 'early evening', 'late evening', 'near midnight', 'small hours', 'night waning', 'almost dawn'];
  return `${night ? 'night' : 'day'} · ${(night ? NIGHT : DAY)[k]}`;
}

export class Panel {
  constructor() {
    this.compass = $('compass');
    this.minimap = $('minimap');
    this.reveal = false;
  }

  update(g) {
    $('st-turn').textContent = g.ourtime;
    $('st-sky').textContent = skyText(g);
    $('st-pleasure').textContent = g.pleasure;
    $('st-power').textContent = g.power;
    $('st-ego').textContent = g.ego;
    $('st-rating').textContent = g.rate();

    // Stamina: turns left before you drop (snooze is a deadline, not a counter).
    const left = g.snooze - g.ourtime;
    this.meter('stamina', Math.max(0, Math.min(1, left / 100)), left <= 0 ? 'exhausted' : `${left} turns`,
      left < 10 ? 'var(--bad)' : left < 30 ? 'var(--warn)' : 'var(--good)');
    // Hunger never harms you in the original; it only says whether you could eat.
    const fed = g.ate - g.ourtime;
    this.meter('hunger', Math.max(0, Math.min(1, fed / 33)), fed > 0 ? 'fed' : 'peckish', fed > 0 ? 'var(--good)' : 'var(--ink-dim)');
    this.meter('load', g.WEIGHT ? Math.min(1, g.carrying / g.WEIGHT) : 1, `${g.carrying}/${g.WEIGHT} kg`,
      g.carrying > g.WEIGHT ? 'var(--bad)' : 'var(--accent)');
    this.meter('bulk', g.CUMBER ? Math.min(1, g.encumber / g.CUMBER) : 1, `${g.encumber}/${g.CUMBER}`,
      g.encumber > g.CUMBER ? 'var(--bad)' : 'var(--accent)');

    const inj = $('injuries');
    inj.textContent = '';
    let any = false;
    g.injuries.forEach((v, i) => {
      if (!v) return;
      any = true;
      const li = document.createElement('li');
      li.textContent = INJURY_SHORT[i];
      li.title = OUCH[i];
      if (FATAL.has(i)) li.className = 'fatal';
      inj.append(li);
    });
    if (!any) {
      const li = document.createElement('li');
      li.className = 'ok';
      li.textContent = 'perfect health';
      inj.append(li);
    }

    this.list($('inv-held'), g.inventory(), (o) => `${OBJWT[o]} kg`);
    this.list($('inv-worn'), g.worn(), () => '');
    $('inv-weight').textContent = `${g.carrying} kg · ${g.encumber} bulk`;
    $('badge-wizard').hidden = !(g.wiz || g.tempwiz);
    $('badge-override').hidden = !g.cheated;
    this.drawCompass(g);
    this.drawMinimap(g);
  }

  meter(id, frac, text, color) {
    const em = $(`m-${id}`);
    em.style.width = `${Math.round(frac * 100)}%`;
    em.style.background = color;
    $(`t-${id}`).textContent = text;
  }

  list(ul, objs, extra) {
    ul.textContent = '';
    if (!objs.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'nothing';
      ul.append(li);
      return;
    }
    for (const o of objs) {
      const li = document.createElement('li');
      if (ARTIFACTS.has(o)) li.className = 'art';
      li.innerHTML = `<span></span><small></small>`;
      li.firstChild.textContent = objectName(o);
      li.lastChild.textContent = extra(o);
      ul.append(li);
    }
  }

  /** Heading-up rose with the open exits; a true-north needle only when you hold the compass. */
  drawCompass(g) {
    const cv = this.compass;
    const ctx = cv.getContext('2d');
    const w = cv.width;
    const c = w / 2;
    ctx.clearRect(0, 0, w, w);
    const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#ffb454';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.arc(c, c, c - 6, 0, Math.PI * 2); ctx.stroke();
    const ex = relativeExits(g);
    const dirs = [['ahead', 0], ['right', Math.PI / 2], ['back', Math.PI], ['left', -Math.PI / 2]];
    for (const [k, a] of dirs) {
      const open = !!ex[k];
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(a);
      ctx.fillStyle = open ? accent : 'rgba(255,255,255,.12)';
      ctx.beginPath();
      ctx.moveTo(0, -(c - 10)); ctx.lineTo(9, -(c - 30)); ctx.lineTo(-9, -(c - 30)); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // up / down markers
    ctx.font = '600 16px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = ex.up ? accent : 'rgba(255,255,255,.15)';
    ctx.fillText('▲', c - 12, c + 6);
    ctx.fillStyle = ex.down ? accent : 'rgba(255,255,255,.15)';
    ctx.fillText('▼', c + 12, c + 6);
    const hasCompass = g.holds(C.COMPASS);
    $('nav-mode').textContent = hasCompass ? 'north up · compass' : 'heading up';
    if (hasCompass) {
      // north relative to the heading
      const a = -ANGLE[g.direction];
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(a);
      ctx.fillStyle = '#ff5a4a';
      ctx.beginPath(); ctx.moveTo(0, -(c - 16)); ctx.lineTo(5, 0); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#cfd8e3';
      ctx.beginPath(); ctx.moveTo(0, c - 16); ctx.lineTo(5, 0); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill();
      ctx.font = '700 13px Rajdhani, sans-serif';
      ctx.fillStyle = '#ff8a7a';
      ctx.fillText('N', 0, -(c - 28) + 4 - 14);
      ctx.restore();
    }
  }

  /** Visited rooms of the current map layer (fog of war), heading-up without the compass. */
  drawMinimap(g) {
    const cv = this.minimap;
    const ctx = cv.getContext('2d');
    const W = cv.width;
    const H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const here = LAYOUT[g.position];
    if (!here) return;
    const layer = here[2];
    const scale = layer === 'island' ? 900 : layer === 'caves' ? 520 : 360;
    const rot = g.holds(C.COMPASS) ? 0 : -ANGLE[g.direction];
    const cx = W / 2;
    const cy = H / 2;
    const tf = (p) => {
      const dx = (p[0] - here[0]) * scale;
      const dy = (p[1] - here[1]) * scale;
      const cs = Math.cos(rot);
      const sn = Math.sin(rot);
      return [cx + dx * cs - dy * sn, cy + dx * sn + dy * cs];
    };
    const visible = (n) => this.reveal || g.beenthere[n] || n === g.position;
    // links
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(160,190,230,.22)';
    for (let n = 1; n <= 275; n++) {
      const p = LAYOUT[n];
      if (!p || p[2] !== layer || !visible(n)) continue;
      const a = tf(p);
      const l = g.location[n].link;
      for (const i of [0, 1, 2, 3, 4, 6]) {
        const m = l[i];
        if (!m || m === n || !LAYOUT[m] || LAYOUT[m][2] !== layer || !visible(m)) continue;
        const b = tf(LAYOUT[m]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }
    const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#ffb454';
    for (let n = 1; n <= 275; n++) {
      const p = LAYOUT[n];
      if (!p || p[2] !== layer || !visible(n)) continue;
      const [x, y] = tf(p);
      if (x < -5 || y < -5 || x > W + 5 || y > H + 5) continue;
      const b = ROOM_CLASS[n].biome;
      ctx.fillStyle = n === g.position ? '#fff' : g.beenthere[n] ? BIOME_DOT[b] : 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.arc(x, y, n === g.position ? 4.5 : 3, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow (always pointing up the screen when heading-up)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot + ANGLE[g.direction]);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(6, 3); ctx.moveTo(0, -11); ctx.lineTo(-6, 3); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.font = '600 11px Rajdhani, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(layer.toUpperCase(), 6, H - 6);
  }
}

export const BIOME_DOT = {
  ship: '#ffb454', space: '#7fd6ff', air: '#8fe3ff', coast: '#5fe0c8', forest: '#9fe07a', cave: '#d6a94a',
};

/** World map for the Override panel: all layers; returns a picker(x, y) -> room. */
export function drawWorldMap(canvas, g, reveal) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const boxes = {
    island: [10, 30, 470, 480], caves: [490, 30, 260, 150], ship: [490, 200, 125, 150],
    space: [625, 200, 125, 150], air: [490, 370, 260, 140],
  };
  const pts = [];
  ctx.font = '600 12px Rajdhani, sans-serif';
  for (const [layer, [x0, y0, w, h]] of Object.entries(boxes)) {
    ctx.strokeStyle = 'rgba(160,190,230,.18)';
    ctx.strokeRect(x0 + .5, y0 + .5, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillText(layer.toUpperCase(), x0 + 4, y0 - 6);
    for (let n = 1; n <= 275; n++) {
      const p = LAYOUT[n];
      if (!p || p[2] !== layer) continue;
      const s = Math.min((w - 20) / Math.max(p[3], 0.01), (h - 20) / Math.max(p[4], 0.01));
      const x = x0 + 10 + p[0] * s;
      const y = y0 + 10 + p[1] * s;
      pts.push([n, x, y]);
      const seen = reveal || g.beenthere[n];
      ctx.fillStyle = n === g.position ? '#fff' : seen ? BIOME_DOT[ROOM_CLASS[n].biome] : 'rgba(255,255,255,.12)';
      ctx.beginPath(); ctx.arc(x, y, n === g.position ? 5 : 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  const pick = (px, py) => {
    let best = null;
    let bd = 12 * 12;
    for (const [n, x, y] of pts) {
      const d = (x - px) ** 2 + (y - py) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  };
  /** Canvas coordinates of a room's dot (used by the UI smoke test). */
  pick.where = (room) => { const p = pts.find(([n]) => n === room); return p ? [p[1], p[2]] : null; };
  return pick;
}
