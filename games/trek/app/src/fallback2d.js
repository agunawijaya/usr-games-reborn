// trek/procedural-web — Canvas 2D fallback for browsers without WebGL2.
//
// Same interface as the WebGL adapter in main.js, far simpler pictures:
// a seeded gradient sky per quadrant, vector silhouettes of the same ship
// designs, line beams and ring blasts, and a flat galaxy chart. The game
// plays identically; only the rendering tier drops.

import { QUADRANT_SIZE, GALAXY_SIZE, CELL } from './galaxy.js';
import { mulberry32, quadrantSeed } from './render/rng.js';

const PAL = [['#2a0610', '#8c1630'], ['#06202a', '#127a86'], ['#030a2a', '#1d4fa8'], ['#1c0626', '#7a1a78'], ['#02161a', '#0d6a64'], ['#1c0c04', '#7a3a10'], ['#0e0626', '#3c1e8c']];

// Plan-view outlines (bow +x), matching src/render/ships.js silhouettes.
const SHAPES = {
  player: [[1.24, 0], [0.86, 0.13], [0.3, 0.2], [-0.25, 0.63], [-0.96, 0.67], [-1.08, 0.55], [-1.02, 0.17], [-1.02, -0.17], [-1.08, -0.55], [-0.96, -0.67], [-0.25, -0.63], [0.3, -0.2], [0.86, -0.13]],
  warship: [[0.98, 0.2], [0.12, 0.31], [-0.55, 0.64], [-0.74, 0.6], [-0.8, 0.1], [-0.8, -0.1], [-0.74, -0.6], [-0.55, -0.64], [0.12, -0.31], [0.98, -0.2], [0.6, -0.14], [0.62, 0], [0.6, 0.14]],
  battlecruiser: [[0.98, 0.12], [0.93, 0.6], [0.74, 0.66], [0.55, 0.3], [0.2, 0.2], [-0.8, 0.2], [-0.86, 0.38], [-1.2, 0.4], [-1.2, -0.4], [-0.86, -0.38], [-0.8, -0.2], [0.2, -0.2], [0.55, -0.3], [0.74, -0.66], [0.93, -0.6], [0.98, -0.12]],
  super: [[1.32, 0], [0.95, 0.55], [0.7, 0.6], [-1.06, 0.62], [-1.22, 0.15], [-1.22, -0.15], [-1.06, -0.62], [0.7, -0.6], [0.95, -0.55]],
  warbird: [[0.86, 0], [0.3, 0.54], [-0.3, 1.1], [-0.36, 1.12], [-0.42, 0.46], [-0.98, 0.02], [-0.98, -0.02], [-0.42, -0.46], [-0.36, -1.12], [-0.3, -1.1], [0.3, -0.54]],
};
const COLORS = { player: '#cfd8e2', warship: '#8a6a4a', battlecruiser: '#7a6048', super: '#8a5a3a', warbird: '#3f8a7e' };

export class Fallback2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = 'title';
    this.snap = null;
    this.chart = null;
    this.fx = [];
    this.gpuName = 'none (2D fallback)';
    this.software = false;
    this.profile = null;
    this.armed = false;
    this.hover = null;
    this.frames = [];
    this.resize();
  }

  get fps() {
    if (this.frames.length < 2) return 0;
    return (this.frames.length - 1) / ((this.frames[this.frames.length - 1] - this.frames[0]) / 1000);
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * dpr);
    this.canvas.height = Math.floor(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.skyKey = null;
  }

  showTitle() { this.mode = 'title'; }
  startGame(snap) { this.mode = 'tactical'; this.snap = snap; this.skyKey = null; }
  setMode(m) { this.mode = m; }
  sync(snap) { this.snap = snap; }
  setChartState(snap, vis) { this.snap = snap; this.vis = vis; }
  pulseScan() { this.scanAt = performance.now(); }
  setWarpArmed(v) { this.armed = v; }
  setChartHover(q) { this.hover = q; }

  _layout() {
    const cell = Math.min(this.W - 200, this.H - 400) / QUADRANT_SIZE;
    const ox = (this.W - cell * QUADRANT_SIZE) / 2;
    const oy = (this.H - cell * QUADRANT_SIZE) / 2 - 40;
    return { cell, ox, oy, at: (sx, sy) => ({ x: ox + (sx + 0.5) * cell, y: oy + (sy + 0.5) * cell }) };
  }

  play(effects, ctx) {
    const snap = ctx.getSnap();
    const L = this._layout();
    const t0 = performance.now();
    const me = L.at(snap.ship.sx, snap.ship.sy);
    for (const e of effects) {
      if (e.type === 'phaser') for (const d of e.damages) {
        this.fx.push({ kind: 'beam', a: me, b: L.at(d.sx, d.sy), t0, dur: 600, color: '#7fe8ff' });
        if (d.destroyed) this.fx.push({ kind: 'boom', p: L.at(d.sx, d.sy), t0: t0 + 400, dur: 900, r: L.cell * 1.6 });
      }
      if (e.type === 'torpedo') {
        const end = e.hit ? L.at(e.hit.sx, e.hit.sy) : me;
        this.fx.push({ kind: 'beam', a: me, b: end, t0, dur: 400, color: '#ff8a40' });
        if (e.destroyedKlingon) this.fx.push({ kind: 'boom', p: L.at(e.destroyedKlingon.sx, e.destroyedKlingon.sy), t0: t0 + 300, dur: 900, r: L.cell * 1.6 });
      }
      if (e.type === 'klingonFire') this.fx.push({ kind: 'beam', a: L.at(e.from[0], e.from[1]), b: me, t0: t0 + 500, dur: 400, color: '#ff4a30' });
    }
    ctx.audio?.play(effects.some(e => e.type === 'phaser') ? 'phaser' : effects.some(e => e.type === 'torpedo') ? 'torpedo' : 'scan');
    return effects.some(e => e.type === 'phaser' || e.type === 'torpedo') ? 1.2 : 0.3;
  }

  pickQuadrant(x, y) {
    const g = this._chartLayout();
    const qx = Math.floor((x - g.ox) / g.cell), qy = Math.floor((y - g.oy) / g.cell);
    return qx >= 0 && qy >= 0 && qx < 8 && qy < 8 ? { qx, qy } : null;
  }

  chartScreenPoint(qx, qy) {
    const g = this._chartLayout();
    return { x: g.ox + (qx + 0.5) * g.cell, y: g.oy + (qy + 0.5) * g.cell };
  }

  _chartLayout() {
    const size = Math.min(this.W, this.H) * 0.7;
    return { cell: size / GALAXY_SIZE, ox: (this.W - size) / 2, oy: (this.H - size) / 2 };
  }

  _sky(qx, qy) {
    const key = `${qx},${qy},${this.W},${this.H}`;
    if (this.skyKey === key) return;
    this.skyKey = key;
    const c = document.createElement('canvas');
    c.width = this.W; c.height = this.H;
    const g = c.getContext('2d');
    const rand = mulberry32(quadrantSeed(qx, qy));
    const [deep, mid] = PAL[Math.floor(rand() * PAL.length)];
    g.fillStyle = '#020310';
    g.fillRect(0, 0, this.W, this.H);
    for (let i = 0; i < 7; i++) {
      const x = rand() * this.W, y = rand() * this.H, r = (0.2 + rand() * 0.5) * Math.max(this.W, this.H);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, mid + '66');
      grd.addColorStop(0.5, deep + '44');
      grd.addColorStop(1, '#00000000');
      g.fillStyle = grd;
      g.fillRect(0, 0, this.W, this.H);
    }
    for (let i = 0; i < 700; i++) {
      const b = rand();
      g.fillStyle = `rgba(255,255,255,${0.15 + b * b * 0.8})`;
      g.fillRect(rand() * this.W, rand() * this.H, b > 0.95 ? 2 : 1, b > 0.95 ? 2 : 1);
    }
    this.sky = c;
  }

  _ship(g, kind, x, y, size, angle) {
    const pts = SHAPES[kind] || SHAPES.warship;
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.scale(size, size);
    g.beginPath();
    pts.forEach(([px, pz], i) => (i ? g.lineTo(px, pz) : g.moveTo(px, pz)));
    g.closePath();
    g.fillStyle = COLORS[kind] || '#888';
    g.shadowColor = kind === 'player' ? '#7fe8ff' : kind === 'warbird' ? '#3cffc8' : '#ff5a24';
    g.shadowBlur = 12;
    g.fill();
    g.lineWidth = 1 / size;
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.stroke();
    g.restore();
  }

  frame(tms) {
    this.frames.push(tms);
    if (this.frames.length > 60) this.frames.shift();
    const g = this.ctx;
    const snap = this.snap;
    const qx = snap?.quadrant?.qx ?? 1, qy = snap?.quadrant?.qy ?? 6;
    this._sky(qx, qy);
    g.drawImage(this.sky, 0, 0, this.W, this.H);
    if (!snap || this.mode === 'title') return;
    if (this.mode === 'chart') return this._chart(g, snap);
    const L = this._layout();
    g.strokeStyle = 'rgba(90,190,255,0.08)';
    g.lineWidth = 1;
    for (let i = 0; i <= QUADRANT_SIZE; i++) {
      g.beginPath(); g.moveTo(L.ox + i * L.cell, L.oy); g.lineTo(L.ox + i * L.cell, L.oy + L.cell * 10); g.stroke();
      g.beginPath(); g.moveTo(L.ox, L.oy + i * L.cell); g.lineTo(L.ox + L.cell * 10, L.oy + i * L.cell); g.stroke();
    }
    const c = snap.quadrant.contents;
    for (const s of c.stars) {
      const p = L.at(s.sx, s.sy);
      const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, L.cell * 0.6);
      grd.addColorStop(0, '#fff6dc'); grd.addColorStop(0.25, '#ffc070'); grd.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(p.x, p.y, L.cell * 0.6, 0, Math.PI * 2); g.fill();
    }
    if (c.starbase) {
      const p = L.at(c.starbase.sx, c.starbase.sy);
      g.strokeStyle = '#c8d4e2'; g.lineWidth = L.cell * 0.12;
      g.beginPath(); g.arc(p.x, p.y, L.cell * 2.6, 0, Math.PI * 2); g.stroke();
      g.lineWidth = L.cell * 0.1;
      g.beginPath(); g.arc(p.x, p.y, L.cell * 1.5, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#b8c4d4'; g.beginPath(); g.arc(p.x, p.y, L.cell * 0.6, 0, Math.PI * 2); g.fill();
    }
    const me = L.at(snap.ship.sx, snap.ship.sy);
    for (const k of c.klingons) {
      if (k.destroyed) continue;
      const p = L.at(k.sx, k.sy);
      this._ship(g, k.type || 'warship', p.x, p.y, L.cell * 0.85, Math.atan2(me.y - p.y, me.x - p.x));
    }
    if (snap.ship.shieldsUp) {
      g.strokeStyle = 'rgba(124,196,255,0.45)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(me.x, me.y, L.cell * 1.35, L.cell * 0.85, 0, 0, Math.PI * 2); g.stroke();
    }
    this._ship(g, 'player', me.x, me.y, L.cell * 1.0, 0);
    const now = performance.now();
    this.fx = this.fx.filter(f => now < f.t0 + f.dur);
    for (const f of this.fx) {
      const k = (now - f.t0) / f.dur;
      if (k < 0) continue;
      if (f.kind === 'beam') {
        g.strokeStyle = f.color; g.globalAlpha = 1 - k; g.lineWidth = 3;
        g.beginPath(); g.moveTo(f.a.x, f.a.y); g.lineTo(f.b.x, f.b.y); g.stroke();
        g.globalAlpha = 1;
      } else {
        g.fillStyle = `rgba(255,${Math.round(200 - k * 150)},80,${1 - k})`;
        g.beginPath(); g.arc(f.p.x, f.p.y, f.r * (0.3 + k), 0, Math.PI * 2); g.fill();
      }
    }
  }

  _chart(g, snap) {
    const L = this._chartLayout();
    g.fillStyle = 'rgba(2,4,16,0.6)';
    g.fillRect(0, 0, this.W, this.H);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const px = L.ox + x * L.cell, py = L.oy + y * L.cell;
      const vis = this.vis ? this.vis(x, y) : snap.galaxy.quadrants[y][x].scanned;
      const q = snap.galaxy.quadrants[y][x];
      g.fillStyle = vis ? 'rgba(0,212,255,0.05)' : 'rgba(20,30,50,0.6)';
      g.fillRect(px, py, L.cell, L.cell);
      g.strokeStyle = 'rgba(0,212,255,0.3)';
      g.strokeRect(px + 0.5, py + 0.5, L.cell, L.cell);
      g.fillStyle = 'rgba(150,190,240,0.5)';
      g.font = '10px Orbitron, monospace';
      g.fillText(`${x + 1}-${y + 1}`, px + 4, py + 12);
      if (vis && q.klingons > 0) { g.fillStyle = '#ff5a4a'; g.fillText(`K${q.klingons}`, px + 6, py + L.cell - 8); }
      if (vis && q.starbases > 0) { g.fillStyle = '#ffd76a'; g.fillText('SB', px + L.cell - 22, py + L.cell / 2); }
      if (x === snap.ship.qx && y === snap.ship.qy) {
        g.strokeStyle = '#00d4ff'; g.lineWidth = 2;
        g.strokeRect(px + 3, py + 3, L.cell - 6, L.cell - 6);
        g.lineWidth = 1;
        g.fillStyle = '#eaf4ff';
        g.fillText('YOU', px + L.cell / 2 - 10, py + L.cell / 2 + 4);
      }
      if (this.armed && this.hover && this.hover.qx === x && this.hover.qy === y) {
        g.strokeStyle = '#ffb14f'; g.strokeRect(px + 1, py + 1, L.cell - 2, L.cell - 2);
      }
    }
  }
}

void CELL;
