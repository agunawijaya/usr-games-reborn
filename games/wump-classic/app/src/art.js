/*
 * The Rune Gates — art drawn in code. The game was built around three raster images (a rune
 * gate, a hanging vine and a gust of wind); /usr/games Reborn ships no raster files, so they are
 * drawn here instead, at the images' own sizes, and the game uses them where it used the PNGs.
 * The wind is not an image at all any more: each of its strokes draws itself along its own curve.
 * The ceiling's stalactites are drawn here too. A classic script, loaded before the game's own,
 * so the art is ready when the game first draws.
 */
(function (root) {
  'use strict';

  // —— helpers ——

  function canvasOf(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Points along a Catmull-Rom curve through the given points. */
  function smooth(points, steps) {
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        out.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        });
      }
    }
    out.push(points[points.length - 1]);
    return out;
  }

  /** A spiral wound inwards from an angle, for the curls at the ends of strokes. */
  function spiral(cx, cy, radius, startAngle, turns, clockwise, steps, tighten) {
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = startAngle + (clockwise ? 1 : -1) * t * turns * Math.PI * 2;
      const r = radius * (1 - t * tighten);
      points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    }
    return points;
  }

  function strokePath(ctx, points) {
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  }

  /**
   * A brush stroke along a path: full width in the middle, easing to a soft rounded point at each
   * end. `tipWidth` is how much of the width the ends keep.
   */
  function brush(ctx, path, width, taperIn, taperOut, tipWidth) {
    const n = path.length;
    if (n < 2) return;
    const left = [];
    const right = [];
    for (let i = 0; i < n; i++) {
      const a = path[Math.max(0, i - 1)];
      const b = path[Math.min(n - 1, i + 1)];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const t = i / (n - 1);
      const shape = Math.min(1, t / taperIn, (1 - t) / taperOut);
      const w = (width / 2) * (tipWidth + (1 - tipWidth) * Math.sin((Math.max(0, shape) * Math.PI) / 2));
      left.push({ x: path[i].x - (dy / len) * w, y: path[i].y + (dx / len) * w });
      right.push({ x: path[i].x + (dy / len) * w, y: path[i].y - (dx / len) * w });
    }
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (const p of left) ctx.lineTo(p.x, p.y);
    const endR = Math.hypot(left[n - 1].x - right[n - 1].x, left[n - 1].y - right[n - 1].y) / 2;
    const endA = Math.atan2(left[n - 1].y - path[n - 1].y, left[n - 1].x - path[n - 1].x);
    ctx.arc(path[n - 1].x, path[n - 1].y, endR, endA, endA + Math.PI, true);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    const startR = Math.hypot(left[0].x - right[0].x, left[0].y - right[0].y) / 2;
    const startA = Math.atan2(right[0].y - path[0].y, right[0].x - path[0].x);
    ctx.arc(path[0].x, path[0].y, startR, startA, startA + Math.PI, true);
    ctx.closePath();
    ctx.fill();
  }

  // —— the delvers' script ——

  /*
   * Our own flowing script for the gates. Fourteen letter shapes (humps, bows, loops, long
   * descenders) and a few marks above them; a phrase is enciphered letter by letter, so each arch
   * carries a real inscription without borrowing any existing alphabet. Units: baseline 0, body
   * −0.5, ascender −1.05, descender +0.55.
   */
  const GLYPHS = [
    { w: 0.55, d: ['M0 0C0 -0.5 0.45 -0.56 0.45 -0.02'] },
    { w: 0.85, d: ['M0 0C0 -0.48 0.36 -0.54 0.36 -0.02', 'M0.36 -0.08C0.37 -0.5 0.74 -0.54 0.73 -0.02'] },
    { w: 0.5, d: ['M0.04 -0.42C0.28 -0.62 0.5 -0.34 0.4 -0.12C0.32 0.04 0.12 0.04 0.04 -0.06C0.0 0.12 0.02 0.32 0.1 0.46'] },
    { w: 0.55, d: ['M0.2 -1.04C0.08 -1.06 0.02 -0.96 0.05 -0.82C0.07 -0.5 0.06 -0.25 0.05 0', 'M0.06 -0.42C0.36 -0.6 0.52 -0.26 0.28 -0.06'] },
    { w: 0.5, d: ['M0.12 -0.48C0.12 -0.16 0.12 0.2 0.0 0.55', 'M0.12 -0.44C0.38 -0.62 0.48 -0.3 0.26 -0.2'] },
    { w: 0.75, d: ['M0 -0.3C0.12 -0.5 0.3 -0.1 0.45 -0.3C0.55 -0.42 0.66 -0.36 0.72 -0.26'] },
    { w: 0.45, d: ['M0 0C0.3 -0.25 0.36 -0.96 0.16 -1.0C-0.02 -1.02 0.0 -0.5 0.32 -0.04'] },
    { w: 0.42, d: ['M0.3 -0.5C0.3 -0.2 0.34 0.3 0.1 0.46C0.0 0.52 -0.06 0.44 -0.02 0.37'] },
    { w: 0.6, d: ['M0.22 -0.04C-0.04 -0.04 -0.04 -0.44 0.2 -0.44C0.4 -0.44 0.42 -0.12 0.24 -0.02', 'M0.3 -0.4C0.38 -0.66 0.44 -0.88 0.56 -1.0'] },
    { w: 0.55, d: ['M0 0C0.15 -0.3 0.25 -0.7 0.3 -0.96', 'M0.17 -0.46C0.28 -0.3 0.38 -0.1 0.5 0'] },
    { w: 1.0, d: ['M0 0C0 -0.45 0.3 -0.5 0.3 -0.02', 'M0.3 -0.06C0.3 -0.45 0.6 -0.5 0.6 -0.02', 'M0.6 -0.06C0.6 -0.45 0.9 -0.5 0.9 -0.06C0.9 0.2 0.85 0.4 0.74 0.52'] },
    { w: 0.5, d: ['M0.42 -0.48C0.1 -0.56 0.05 -0.28 0.22 -0.25C0.43 -0.21 0.41 0.05 0.04 0.0'] },
    { w: 0.6, d: ['M0 -0.48C-0.02 -0.05 0.4 0.05 0.42 -0.48', 'M0.42 -0.48C0.43 -0.2 0.45 0.0 0.56 0.04'] },
    { w: 0.55, d: ['M0.0 -0.3C0.15 -0.46 0.34 -0.14 0.5 -0.36', 'M0.26 -0.3C0.24 -0.05 0.2 0.25 0.14 0.48'] },
  ];
  const MARKS = ['dot', null, 'acute', null, 'wave', null, 'dots', null, 'ring'];
  const ALPHABET = {};
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach((letter, i) => {
    ALPHABET[letter] = { glyph: GLYPHS[(i * 5 + 2) % GLYPHS.length], mark: MARKS[(i * 3 + 1) % MARKS.length] };
  });
  const pathCache = new Map();
  function glyphPaths(glyph) {
    if (!pathCache.has(glyph)) pathCache.set(glyph, glyph.d.map((d) => new Path2D(d)));
    return pathCache.get(glyph);
  }

  /** One letter with its baseline-left at the origin; `size` is the ascender's height. */
  function drawLetter(ctx, letter, size, lineWidth) {
    const entry = ALPHABET[letter];
    if (!entry) return;
    ctx.save();
    ctx.scale(size, size);
    ctx.transform(1, 0, -0.16, 1, 0, 0); // a light lean, as a carver's hand would give it
    ctx.lineWidth = lineWidth / size;
    for (const path of glyphPaths(entry.glyph)) ctx.stroke(path);
    const mx = entry.glyph.w * 0.5;
    const my = -0.7;
    ctx.beginPath();
    switch (entry.mark) {
      case 'dot':
        ctx.arc(mx, my, 0.07, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'dots':
        ctx.arc(mx - 0.1, my, 0.06, 0, Math.PI * 2);
        ctx.arc(mx + 0.12, my - 0.02, 0.06, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'acute':
        ctx.moveTo(mx - 0.06, my + 0.08);
        ctx.lineTo(mx + 0.12, my - 0.12);
        ctx.stroke();
        break;
      case 'wave':
        ctx.moveTo(mx - 0.16, my);
        ctx.bezierCurveTo(mx - 0.08, my - 0.12, mx + 0.04, my + 0.08, mx + 0.16, my - 0.04);
        ctx.stroke();
        break;
      case 'ring':
        ctx.arc(mx, my, 0.08, 0, Math.PI * 2);
        ctx.stroke();
        break;
      default:
    }
    ctx.restore();
  }

  function advanceOf(ch, size) {
    if (ch === ' ') return size * 0.32;
    if (ch === ':' || ch === '·') return size * 0.42;
    return ((ALPHABET[ch] ? ALPHABET[ch].glyph.w : 0.5) + 0.12) * size;
  }

  /** Writes a phrase in the script along an elliptical arc, upright to it, spread evenly. */
  function inscribeArc(ctx, phrase, cx, cy, rx, ry, from, to, size, lineWidth) {
    const items = phrase.toLowerCase().split('');
    const advance = items.map((ch) => advanceOf(ch, size));
    const total = advance.reduce((a, b) => a + b, 0);
    let arc = 0;
    const samples = 200;
    for (let i = 0; i < samples; i++) {
      const a1 = from + ((to - from) * i) / samples;
      const a2 = from + ((to - from) * (i + 1)) / samples;
      arc += Math.hypot(Math.cos(a2) * rx - Math.cos(a1) * rx, Math.sin(a2) * ry - Math.sin(a1) * ry);
    }
    const scale = arc / total;
    let along = 0;
    items.forEach((ch, i) => {
      const angle = from + ((to - from) * along) / arc;
      along += advance[i] * scale;
      if (ch === ' ') return;
      const x = cx + Math.cos(angle) * rx;
      const y = cy + Math.sin(angle) * ry;
      const normal = Math.atan2(Math.sin(angle) * rx, Math.cos(angle) * ry);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(normal + Math.PI / 2);
      if (ch === ':' || ch === '·') {
        ctx.beginPath();
        if (ch === ':') {
          ctx.arc(size * 0.12, -size * 0.42, lineWidth * 0.9, 0, Math.PI * 2);
          ctx.arc(size * 0.12, -size * 0.08, lineWidth * 0.9, 0, Math.PI * 2);
        } else {
          ctx.arc(size * 0.12, -size * 0.28, lineWidth, 0, Math.PI * 2);
        }
        ctx.fill();
      } else {
        drawLetter(ctx, ch, size, lineWidth);
      }
      ctx.restore();
    });
  }

  // —— the rune gate (671 × 906) ——

  /**
   * An arch on two pillars, drawn in glowing line: two inscribed bands round the arch, small
   * curls along its outer edge and a pair of curls at the crest, scrolled capitals, shafts wound
   * with a ribbon, stepped bases.
   */
  function gate() {
    const W = 671;
    const H = 906;
    const canvas = canvasOf(W, H);
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#b4f4fb';
    ctx.fillStyle = '#b4f4fb';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const cx = W / 2;
    const springY = 290;
    const outer = { rx: 292, ry: 262 };
    const middle = { rx: 250, ry: 221 };
    const inner = { rx: 208, ry: 180 };

    // The arch: an outer and an inner edge, a finer line between them dividing two bands.
    ctx.lineWidth = 4;
    for (const edge of [outer, inner]) {
      ctx.beginPath();
      ctx.ellipse(cx, springY, edge.rx, edge.ry, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(cx, springY, middle.rx, middle.ry, 0, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Each band carries its own line of the inscription.
    inscribeArc(ctx, ': walk softly · the deep is awake · keep your lamp lit :', cx, springY, 271 - 9, 241 - 9, Math.PI * 1.03, Math.PI * 1.97, 26, 2.5);
    inscribeArc(ctx, ': the stone remembers every lamp that passed :', cx, springY, 229 - 7, 200 - 7, Math.PI * 1.04, Math.PI * 1.96, 18, 1.8);

    // Small curls along the outer edge, turned outwards; two curls face each other at the crest.
    ctx.lineWidth = 3;
    const curls = 15;
    for (let i = 0; i < curls; i++) {
      const t = i / (curls - 1);
      if (Math.abs(t - 0.5) < 0.04) continue;
      const angle = Math.PI * (1.02 + 0.96 * t);
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);
      const n = Math.atan2(ny * outer.rx, nx * outer.ry);
      const base = { x: cx + nx * outer.rx, y: springY + ny * outer.ry };
      const leftSide = t < 0.5;
      const r = 8.5;
      const turn = n + (leftSide ? -Math.PI / 2 : Math.PI / 2);
      const centre = {
        x: base.x + Math.cos(n) * (r + 3) + Math.cos(turn) * r * 0.55,
        y: base.y + Math.sin(n) * (r + 3) + Math.sin(turn) * r * 0.55,
      };
      const start = Math.atan2(base.y - centre.y, base.x - centre.x);
      const radius = Math.hypot(base.x - centre.x, base.y - centre.y);
      strokePath(ctx, [base, ...spiral(centre.x, centre.y, radius, start, 1.15, !leftSide, 40, 0.78)]);
    }
    const top = { x: cx, y: springY - outer.ry };
    for (const side of [-1, 1]) {
      const centre = { x: top.x + side * 13, y: top.y - 16 };
      strokePath(ctx, [{ x: top.x + side * 3, y: top.y }, ...spiral(centre.x, centre.y, 12, side > 0 ? Math.PI * 0.75 : Math.PI * 0.25, 1.2, side < 0, 44, 0.75)]);
    }
    ctx.beginPath();
    ctx.arc(top.x, top.y - 30, 4, 0, Math.PI * 2);
    ctx.fill();

    for (const side of [-1, 1]) drawPillar(ctx, cx + side * 260, springY);
    return canvas;
  }

  function drawPillar(ctx, axis, abacus) {
    const capW = 124;
    const capBottom = abacus + 34;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(axis - capW / 2, abacus);
    ctx.lineTo(axis + capW / 2, abacus);
    ctx.stroke();
    for (const end of [-1, 1]) {
      strokePath(ctx, [
        { x: axis + end * (capW / 2), y: abacus },
        { x: axis + end * (capW / 2 + 1), y: abacus + 8 },
        ...spiral(axis + end * (capW / 2 - 15), abacus + 18, 15, end > 0 ? 0 : Math.PI, 1.1, end > 0, 48, 0.72),
      ]);
    }
    ctx.beginPath();
    ctx.moveTo(axis - capW / 2 + 28, abacus + 30);
    ctx.bezierCurveTo(axis - 20, capBottom + 6, axis + 20, capBottom + 6, axis + capW / 2 - 28, abacus + 30);
    ctx.stroke();

    const shaftTop = capBottom + 2;
    const shaftBottom = 836;
    const topHalf = 35;
    const footHalf = 44;
    ctx.lineWidth = 3.4;
    for (const edge of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(axis + edge * topHalf, shaftTop);
      ctx.quadraticCurveTo(axis + edge * (footHalf + 4), (shaftTop + shaftBottom) / 2, axis + edge * footHalf, shaftBottom);
      ctx.stroke();
    }
    // A ribbon wound twice round the shaft, its ends tucked round the edges.
    for (const bandY of [440, 590]) {
      const half = topHalf + ((bandY - shaftTop) / (shaftBottom - shaftTop)) * (footHalf - topHalf) + 2;
      ctx.lineWidth = 3;
      for (const offset of [0, 20]) {
        ctx.beginPath();
        ctx.moveTo(axis - half, bandY - 24 + offset);
        ctx.bezierCurveTo(axis - half * 0.2, bandY - 10 + offset, axis + half * 0.4, bandY + 8 + offset, axis + half, bandY + 26 + offset);
        ctx.stroke();
      }
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(axis - half, bandY - 24);
      ctx.quadraticCurveTo(axis - half - 6, bandY - 14, axis - half, bandY - 4);
      ctx.moveTo(axis + half, bandY + 26);
      ctx.quadraticCurveTo(axis + half + 6, bandY + 36, axis + half, bandY + 46);
      ctx.stroke();
    }
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.roundRect(axis - footHalf - 10, shaftBottom, (footHalf + 10) * 2, 22, 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(axis - footHalf - 22, shaftBottom + 22, (footHalf + 22) * 2, 44, 6);
    ctx.stroke();
  }

  // —— the hanging vine (360 × 360) ——

  /** A runner dipping across the top, strands hanging from it, heart-shaped leaves. */
  function vine() {
    const canvas = canvasOf(360, 360);
    const ctx = canvas.getContext('2d');
    const random = seeded(11);
    const leaves = [];
    const stems = [];

    function along(path, every, jitter, size, spread, sizeAtEnd) {
      let side = random() > 0.5 ? 1 : -1;
      for (let i = 2; i < path.length - 1; i += every + Math.floor(random() * jitter)) {
        const t = i / (path.length - 1);
        const p = path[i];
        const q = path[Math.min(path.length - 1, i + 1)];
        const heading = Math.atan2(q.x - p.x, q.y - p.y);
        const s = (size + (sizeAtEnd - size) * t) * (0.72 + random() * 0.5);
        // Near the top edge a leaf hangs; it never stands up out of the picture.
        const reach = p.y < 48 ? Math.min(spread, 1.25) : spread;
        leaves.push({
          x: p.x,
          y: p.y,
          size: s,
          angle: -heading * 0.3 + side * (reach * (0.6 + random() * 0.6)),
          turn: 0.55 + random() * 0.45,
          tone: random(),
          flip: random() > 0.5,
        });
        side = -side;
      }
    }

    const runner = smooth(
      [
        { x: 26, y: 34 },
        { x: 58, y: 40 },
        { x: 96, y: 46 },
        { x: 140, y: 58 },
        { x: 176, y: 60 },
        { x: 212, y: 46 },
        { x: 246, y: 30 },
        { x: 286, y: 18 },
        { x: 326, y: 10 },
        { x: 352, y: 8 },
      ],
      10,
    );
    stems.push({ path: runner, width: 2.4 });
    const dense = runner.slice(0, Math.floor(runner.length * 0.68));
    along(dense, 2, 2, 25, 1.6, 21);
    along(dense, 3, 3, 19, 2.5, 16);
    along(runner.slice(Math.floor(runner.length * 0.68)), 5, 4, 16, 1.7, 12);
    const twin = smooth([{ x: 40, y: 20 }, { x: 78, y: 26 }, { x: 118, y: 34 }, { x: 160, y: 44 }], 10);
    stems.push({ path: twin, width: 1.6 });
    along(twin, 3, 2, 22, 1.5, 17);
    const flick = smooth([{ x: 296, y: 24 }, { x: 318, y: 38 }, { x: 330, y: 58 }, { x: 328, y: 78 }], 8);
    stems.push({ path: flick, width: 1.4 });
    along(flick, 4, 2, 13, 1.2, 9);

    const strands = [
      { from: { x: 52, y: 38 }, length: 150, sway: -10 },
      { from: { x: 96, y: 46 }, length: 310, sway: 18 },
      { from: { x: 124, y: 52 }, length: 214, sway: -14 },
      { from: { x: 162, y: 60 }, length: 262, sway: 12 },
      { from: { x: 196, y: 56 }, length: 112, sway: -8 },
      { from: { x: 226, y: 42 }, length: 74, sway: 6 },
      { from: { x: 312, y: 16 }, length: 62, sway: 5 },
    ];
    for (const s of strands) {
      const path = smooth(
        [
          s.from,
          { x: s.from.x + s.sway * 0.4, y: s.from.y + s.length * 0.3 },
          { x: s.from.x - s.sway * 0.3, y: s.from.y + s.length * 0.62 },
          { x: s.from.x + s.sway, y: s.from.y + s.length },
        ],
        Math.max(8, Math.round(s.length / 10)),
      );
      stems.push({ path, width: 1.25 });
      along(path.slice(0, Math.ceil(path.length * 0.45)), 3, 3, 20, 1.1, 14);
      along(path.slice(Math.floor(path.length * 0.45)), 5, 5, 13, 1.0, 8);
      const tip = path[path.length - 1];
      stems.push({ path: spiral(tip.x + 3, tip.y + 2, 4, Math.PI, 1, s.sway > 0, 14, 0.8), width: 0.8 });
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#3f6a27';
    for (const stem of stems) {
      ctx.lineWidth = stem.width;
      strokePath(ctx, stem.path);
    }
    leaves.sort((a, b) => a.size - b.size);
    for (const l of leaves) drawLeaf(ctx, l);
    return canvas;
  }

  const LEAF_SHADES = [
    ['#86c44c', '#3a7522'],
    ['#76b642', '#326a1d'],
    ['#68a73a', '#2b5f1e'],
    ['#96cf5c', '#457f28'],
  ];

  /** A heart-shaped leaf with a long drip tip, lit from above; its stalk at (x, y). */
  function drawLeaf(ctx, l) {
    const L = l.size;
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.angle);
    ctx.strokeStyle = '#4b7a2c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(L * 0.1, L * 0.18, 0, L * 0.32);
    ctx.stroke();
    ctx.translate(0, L * 0.32);
    ctx.scale(l.turn * (l.flip ? -1 : 1), 1);
    const blade = new Path2D();
    blade.moveTo(0, L * 0.06);
    blade.bezierCurveTo(-L * 0.3, -L * 0.16, -L * 0.66, L * 0.12, -L * 0.5, L * 0.5);
    blade.bezierCurveTo(-L * 0.38, L * 0.8, -L * 0.12, L * 0.92, 0, L * 1.18);
    blade.bezierCurveTo(L * 0.12, L * 0.92, L * 0.38, L * 0.8, L * 0.5, L * 0.5);
    blade.bezierCurveTo(L * 0.66, L * 0.12, L * 0.3, -L * 0.16, 0, L * 0.06);
    ctx.save();
    ctx.translate(L * 0.08, L * 0.1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fill(blade);
    ctx.restore();
    const [lit, deep] = LEAF_SHADES[Math.floor(l.tone * LEAF_SHADES.length)];
    const gradient = ctx.createLinearGradient(-L * 0.5, 0, L * 0.5, L * 1.1);
    gradient.addColorStop(0, lit);
    gradient.addColorStop(0.55, lit);
    gradient.addColorStop(1, deep);
    ctx.fillStyle = gradient;
    ctx.fill(blade);
    ctx.save();
    ctx.clip(blade);
    ctx.fillStyle = 'rgba(30, 70, 20, 0.28)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(L * 0.06, L * 0.6, 0, L * 1.2);
    ctx.lineTo(L, L * 1.2);
    ctx.lineTo(L, -L);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(210, 240, 170, 0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, L * 0.08);
    ctx.quadraticCurveTo(L * 0.06, L * 0.6, 0, L * 1.12);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(35, 70, 20, 0.55)';
    ctx.lineWidth = 0.7;
    ctx.stroke(blade);
    ctx.restore();
  }

  // —— the wind (in a 580 × 386 box) ——

  /*
   * A gust is a handful of brush strokes, each drawing itself along its own curve: the main lane
   * first, rolling into its big curl, the others joining in, the flecks last. `start` and
   * `duration` place each stroke within the gust's progress (0–1).
   */
  const WIND_STROKES = [
    {
      path: [
        ...smooth(
          [
            { x: 150, y: 206 },
            { x: 206, y: 197 },
            { x: 270, y: 206 },
            { x: 325, y: 207 },
            { x: 365, y: 190 },
            { x: 389, y: 162 },
            { x: 394, y: 138 },
          ],
          12,
        ),
        ...spiral(371, 131, 23, 0.3, 1.1, false, 48, 0.62),
      ],
      width: 11,
      taperIn: 0.7,
      taperOut: 0.14,
      start: 0,
      duration: 0.72,
    },
    {
      path: [
        ...smooth(
          [
            { x: 156, y: 240 },
            { x: 214, y: 229 },
            { x: 286, y: 238 },
            { x: 346, y: 252 },
            { x: 388, y: 255 },
            { x: 414, y: 242 },
          ],
          12,
        ),
        ...spiral(404, 231, 11, 0.6, 1.05, false, 32, 0.6),
      ],
      width: 8,
      taperIn: 0.6,
      taperOut: 0.16,
      start: 0.12,
      duration: 0.66,
    },
    { path: smooth([{ x: 166, y: 192 }, { x: 222, y: 177 }, { x: 288, y: 177 }, { x: 330, y: 187 }, { x: 345, y: 179 }], 10), width: 5, taperIn: 0.4, taperOut: 0.3, start: 0.2, duration: 0.5 },
    { path: smooth([{ x: 206, y: 214 }, { x: 260, y: 221 }, { x: 310, y: 224 }, { x: 334, y: 221 }], 10), width: 3.6, taperIn: 0.4, taperOut: 0.35, start: 0.3, duration: 0.45 },
    { path: smooth([{ x: 190, y: 276 }, { x: 236, y: 264 }, { x: 282, y: 258 }, { x: 306, y: 254 }], 10), width: 4.5, taperIn: 0.4, taperOut: 0.4, start: 0.34, duration: 0.42 },
    { path: smooth([{ x: 272, y: 168 }, { x: 288, y: 165 }, { x: 302, y: 166 }], 6), width: 4.5, taperIn: 0.45, taperOut: 0.45, start: 0.62, duration: 0.2 },
    { path: smooth([{ x: 397, y: 206 }, { x: 407, y: 209 }, { x: 415, y: 214 }], 6), width: 4.5, taperIn: 0.45, taperOut: 0.45, start: 0.74, duration: 0.18 },
    { path: smooth([{ x: 420, y: 274 }, { x: 430, y: 272 }, { x: 438, y: 267 }], 6), width: 4.5, taperIn: 0.45, taperOut: 0.45, start: 0.8, duration: 0.18 },
  ];
  // Each stroke's length along its path, so a stroke grows at an even speed.
  for (const stroke of WIND_STROKES) {
    stroke.lengths = [0];
    for (let i = 1; i < stroke.path.length; i++) {
      const a = stroke.path[i - 1];
      const b = stroke.path[i];
      stroke.lengths.push(stroke.lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
  }
  // The strokes sit in the same box the old image used, so a gust keeps its old size and place.
  const WIND_BOX = { x: 0, y: 0, w: 580, h: 386 };

  /** The first `fraction` of a stroke's path, ending exactly at that point along it. */
  function partOf(stroke, fraction) {
    const total = stroke.lengths[stroke.lengths.length - 1];
    const reach = total * fraction;
    const points = [];
    for (let i = 0; i < stroke.path.length; i++) {
      if (stroke.lengths[i] <= reach) {
        points.push(stroke.path[i]);
        continue;
      }
      const a = stroke.path[i - 1];
      const b = stroke.path[i];
      const t = (reach - stroke.lengths[i - 1]) / (stroke.lengths[i] - stroke.lengths[i - 1] || 1);
      points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      break;
    }
    return points;
  }

  /**
   * Draws a gust blowing out of a gate at (originX, originY) into a w × h box, its strokes grown
   * as far as `progress` (0–1) takes each of them. `direction` is the way the air flows.
   */
  function drawWind(ctx, originX, originY, w, h, direction, progress, alpha) {
    if (progress <= 0 || alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    // The box the gust's strokes live in, fitted to w × h; flowing left mirrors it.
    const sx = w / WIND_BOX.w;
    const sy = h / WIND_BOX.h;
    const startY = originY - h / 2;
    if (direction === 'left') {
      ctx.translate(originX, startY);
      ctx.scale(-sx, sy);
    } else {
      ctx.translate(originX, startY);
      ctx.scale(sx, sy);
    }
    ctx.translate(-WIND_BOX.x, -WIND_BOX.y);
    for (const stroke of WIND_STROKES) {
      const local = Math.max(0, Math.min(1, (progress - stroke.start) / stroke.duration));
      if (local <= 0) continue;
      const points = partOf(stroke, local);
      // While it grows the head stays a soft point; once whole it keeps its own ending.
      const head = local < 1 ? Math.max(stroke.taperOut, 0.35) : stroke.taperOut;
      brush(ctx, points, stroke.width, stroke.taperIn * Math.max(0.35, local), head, 0.3);
    }
    ctx.restore();
  }

  // —— the ceiling ——

  /**
   * The cave's ceiling: a ragged shelf of rock with stalactites hanging from it in three depths,
   * small and dim at the back, broad and close at the front. Each one is a lumpy column of
   * flowstone, broad where it grows out of the rock and drawing down to a point, rounded by its
   * shading and caught along one flank by the glow of the gates; some carry a drop at the tip.
   */
  function drawCeiling(ctx, width, random) {
    const depths = [
      { every: 40, length: [26, 64], root: [16, 30], shade: ['#070b13', '#111a28', '#05080e'], rim: 0.08 },
      { every: 74, length: [60, 120], root: [32, 56], shade: ['#060a11', '#18233a', '#04070c'], rim: 0.16 },
      { every: 140, length: [110, 190], root: [56, 92], shade: ['#05080e', '#1d2a40', '#03050a'], rim: 0.24 },
    ];
    depths.forEach((depth, layer) => {
      for (let x = random() * depth.every; x < width + depth.root[1]; x += depth.every * (0.55 + random() * 0.9)) {
        const length = depth.length[0] + random() * (depth.length[1] - depth.length[0]);
        const root = depth.root[0] + random() * (depth.root[1] - depth.root[0]);
        stalactite(ctx, x, length, root, depth, random);
        // Younger ones gather round the big ones, sharing their root.
        const young = layer === 2 ? 2 : random() < 0.4 ? 1 : 0;
        for (let i = 0; i < young; i++) {
          const side = random() < 0.5 ? -1 : 1;
          stalactite(ctx, x + side * root * (0.35 + random() * 0.25), length * (0.3 + random() * 0.35), root * (0.35 + random() * 0.2), depth, random);
        }
      }
      // The shelf of rock they grow from, laid over their roots so they come out of it.
      shelf(ctx, width, random, 18 + layer * 6, depth.shade[0]);
    });
  }

  /** A ragged band of rock along the top edge, its lower edge at about `depth`. */
  function shelf(ctx, width, random, depth, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= width + 24; x += 24) ctx.lineTo(x, depth + random() * 12 + Math.sin(x * 0.02) * 4);
    ctx.lineTo(width, 0);
    ctx.closePath();
    ctx.fill();
  }

  function stalactite(ctx, x, length, root, depth, random) {
    const lean = (random() - 0.5) * root * 0.35;
    const steps = 22;
    const phase = random() * 10;
    const left = [];
    const right = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Broad at the root, narrowing fast, then a long fine point; lumps of flowstone on the way.
      const profile = Math.pow(1 - t, 1.9) * 0.82 + Math.pow(1 - t, 0.7) * 0.18;
      const lump = 1 + 0.16 * Math.sin(t * 17 + phase) * (1 - t) + 0.08 * Math.sin(t * 41 + phase * 2);
      const half = (root / 2) * Math.max(0.02, profile * lump);
      const cx = x + lean * t * t;
      const y = length * t;
      left.push({ x: cx - half * (0.94 + 0.12 * Math.sin(t * 23 + phase)), y });
      right.push({ x: cx + half * (0.94 + 0.12 * Math.cos(t * 19 + phase)), y });
    }
    const tip = { x: x + lean, y: length + 2 };
    const body = new Path2D();
    body.moveTo(left[0].x - root * 0.25, 0);
    for (const p of left) body.lineTo(p.x, p.y);
    body.lineTo(tip.x, tip.y);
    for (let i = right.length - 1; i >= 0; i--) body.lineTo(right[i].x, right[i].y);
    body.lineTo(right[0].x + root * 0.25, 0);
    body.closePath();

    // Rounded across its width: dark flanks, a paler core a little left of centre.
    const shade = ctx.createLinearGradient(x - root / 2, 0, x + root / 2, 0);
    shade.addColorStop(0, depth.shade[0]);
    shade.addColorStop(0.38, depth.shade[1]);
    shade.addColorStop(1, depth.shade[2]);
    ctx.fillStyle = shade;
    ctx.fill(body);

    ctx.save();
    ctx.clip(body);
    // Darker towards the root, where it is in the shadow of the shelf.
    const fall = ctx.createLinearGradient(0, 0, 0, length);
    fall.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    fall.addColorStop(0.35, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fall;
    ctx.fillRect(x - root, 0, root * 2, length);
    // Faint bands of growth across it.
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    for (let band = length * (0.15 + random() * 0.1); band < length * 0.75; band += length * (0.1 + random() * 0.12)) {
      ctx.beginPath();
      ctx.moveTo(x - root, band);
      ctx.quadraticCurveTo(x, band + root * 0.12, x + root, band - 1);
      ctx.stroke();
    }
    // A wet sheen running down the core.
    ctx.strokeStyle = `rgba(190, 230, 245, ${depth.rim * 0.5})`;
    ctx.lineWidth = Math.max(1, root * 0.05);
    ctx.beginPath();
    left.forEach((p, i) => {
      const q = right[i];
      const sx = p.x + (q.x - p.x) * 0.36;
      if (i === 0) ctx.moveTo(sx, p.y);
      else ctx.lineTo(sx, p.y);
    });
    ctx.stroke();
    ctx.restore();

    // The glow of the gates catches its left flank.
    ctx.strokeStyle = `rgba(165, 243, 252, ${depth.rim})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    left.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x + 0.8, p.y) : ctx.lineTo(p.x + 0.8, p.y)));
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // A drop gathering at the point.
    if (random() < 0.35) {
      ctx.fillStyle = 'rgba(120, 180, 200, 0.4)';
      ctx.beginPath();
      ctx.ellipse(tip.x, tip.y + 2.5, 1.8, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(220, 250, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(tip.x - 0.6, tip.y + 1.8, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  root.RuneArt = { gate, vine, drawWind, drawCeiling, inscribeArc };
})(typeof self !== 'undefined' ? self : this);
