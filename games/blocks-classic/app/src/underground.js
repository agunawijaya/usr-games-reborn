/*
 * Broken Well — the underground. Everything here is drawn in code (no image files):
 *
 *  - the earth around the well, as a cutaway: strata from the grass down to the bedrock, roots
 *    hanging from the surface, burrows with earthworms, a beetle and a snail, a fossil shell, an
 *    old coin, fallen bricks, seeping drips and a lantern; and the broken well itself, its
 *    crumbling brick lining running up to a collapsed parapet with a snapped beam and a rope;
 *  - inside the well canvas: the damp shaft, the well's own wall stones (cut grey stone, mossy
 *    and cracked) and the falling pieces as rough-hewn stones, one colour of stone per shape.
 *
 * Exposed as window.BrokenWellArt for index.html's classic script. Light and dark are both
 * designed: Lamplight (dark) is a lantern-lit pit; Daylight (light) is a sunlit cutaway.
 */
(function () {
  'use strict';

  // ——— palettes ———

  const LOOKS = {
    dark: {
      sky: ['#0b0e1a', '#1a1d2e'],
      grass: '#2f4a2a',
      strata: ['#2a1c13', '#3a2518', '#47331f', '#3a332b', '#26262a'],
      strataLine: 'rgba(0,0,0,0.35)',
      speck: ['rgba(255,236,200,0.05)', 'rgba(0,0,0,0.25)'],
      pebble: ['#5d554b', '#4a443d', '#6b6156'],
      root: '#4a3524',
      rootLight: '#6b4f36',
      burrow: 'rgba(8,5,3,0.32)',
      worm: '#c98a7f',
      wormBand: '#a96a62',
      wormShine: 'rgba(255,220,210,0.35)',
      beetle: '#1c2a24',
      beetleShine: '#4f7a68',
      snailShell: '#9c7b55',
      snailBody: '#a8977f',
      fossil: '#8a7a64',
      coin: '#c9a24a',
      shaft: ['#1e1a16', '#0c0a08'],
      shaftCourse: 'rgba(255,240,220,0.045)',
      lining: ['#6a5442', '#4c3b2e', '#7d6551'],
      mortar: '#1a130e',
      wall: '#77746c',
      wallShade: '#4b4943',
      wallLight: '#a6a298',
      moss: 'rgba(96,140,72,0.55)',
      lantern: '#ffc76b',
      ambient: 'rgba(0,0,0,0.45)',
      water: 'rgba(120,180,200,0.55)',
      beam: '#5b4330',
      rope: '#a08860',
      ghost: 0.5,
    },
    light: {
      sky: ['#9fd3ef', '#dcefe6'],
      grass: '#6fa64a',
      strata: ['#6e4a31', '#8b5d3b', '#b48b5e', '#a19583', '#8a8684'],
      strataLine: 'rgba(60,35,15,0.35)',
      speck: ['rgba(255,250,235,0.18)', 'rgba(60,35,15,0.22)'],
      pebble: ['#c9bca8', '#a99c88', '#ddd2bf'],
      root: '#5a3c22',
      rootLight: '#8a643e',
      burrow: 'rgba(50,28,12,0.26)',
      worm: '#e3958c',
      wormBand: '#c4706a',
      wormShine: 'rgba(255,240,235,0.55)',
      beetle: '#24392f',
      beetleShine: '#6aa48a',
      snailShell: '#b98a55',
      snailBody: '#cdb9a0',
      fossil: '#d8c8ad',
      coin: '#d9a92c',
      shaft: ['#7b6a58', '#4e4135'],
      shaftCourse: 'rgba(255,248,235,0.10)',
      lining: ['#b0785a', '#8f5d44', '#c58c6a'],
      mortar: '#5a4636',
      wall: '#a8a397',
      wallShade: '#7d786d',
      wallLight: '#d8d3c6',
      moss: 'rgba(92,140,60,0.6)',
      lantern: '#ffe7a8',
      ambient: 'rgba(255,240,210,0.0)',
      water: 'rgba(90,150,180,0.6)',
      beam: '#7a5a3c',
      rope: '#c2a374',
      ghost: 0.7,
    },
  };

  /** One colour of old stone per shape: weathered, earthy, still easy to tell apart. */
  const STONE_COLORS = {
    I: '#4aa39a', // verdigris
    O: '#d9a441', // sandstone
    T: '#9277b8', // amethyst slate
    S: '#6e9e4a', // mossy greenstone
    Z: '#c25a41', // terracotta
    J: '#4e7fb5', // blue slate
    L: '#d27b39', // rust ochre
  };

  const engineColorToType = () => {
    const map = {};
    const colors = (window.BrokenWellEngine && window.BrokenWellEngine.PIECE_COLORS) || {};
    for (const [type, color] of Object.entries(colors)) map[color.toLowerCase()] = type;
    return map;
  };
  let colorToType = null;

  function typeOf(color) {
    colorToType = colorToType || engineColorToType();
    return colorToType[String(color).toLowerCase()] || 'O';
  }

  // ——— small helpers ———

  function hash(n) {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  }

  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ch = (shift) =>
      Math.round(((pa >> shift) & 255) + (((pb >> shift) & 255) - ((pa >> shift) & 255)) * t);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  function look(theme) {
    return LOOKS[theme === 'light' ? 'light' : 'dark'];
  }

  /** A rough-hewn outline: a squarish stone with soft, uneven corners and a chip or two. */
  function stoneOutline(ctx, cx, cy, half, seed, squareness) {
    const points = [];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (hash(seed + i) - 0.5) * 0.22;
      const square = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      const r = half * (squareness * Math.min(square, 1.32) + (1 - squareness)) * (0.9 + hash(seed * 3 + i) * 0.1);
      points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    ctx.beginPath();
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const start = mid(points[n - 1], points[0]);
    ctx.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i++) {
      const next = mid(points[i], points[(i + 1) % n]);
      ctx.quadraticCurveTo(points[i][0], points[i][1], next[0], next[1]);
    }
    ctx.closePath();
  }

  // ——— sprite caches: stones are drawn once per colour, variant and size ———

  const sprites = new Map();

  function sprite(key, size, paint) {
    let canvas = sprites.get(key);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = canvas.height = Math.ceil(size);
      paint(canvas.getContext('2d'), size);
      if (sprites.size > 600) sprites.clear();
      sprites.set(key, canvas);
    }
    return canvas;
  }

  /** A falling or settled piece cell: a chunk of coloured stone, lit from above. */
  function paintStone(ctx, size, base, seed, theme) {
    const half = size / 2;
    const r = half - Math.max(1, size * 0.035);
    stoneOutline(ctx, half, half, r, seed, 0.8);
    const body = ctx.createLinearGradient(0, 0, size, size);
    body.addColorStop(0, mix(base, '#ffffff', theme === 'light' ? 0.28 : 0.2));
    body.addColorStop(0.55, base);
    body.addColorStop(1, mix(base, '#000000', 0.42));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // Grain and pits pressed into the stone.
    for (let i = 0; i < 26; i++) {
      const x = hash(seed + i * 5.1) * size;
      const y = hash(seed + i * 7.3) * size;
      const d = (0.4 + hash(seed + i) * 1.1) * Math.max(1, size / 30);
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.arc(x, y, d, 0, Math.PI * 2);
      ctx.fill();
    }
    // A hairline crack on some stones.
    if (hash(seed * 1.7) > 0.45) {
      ctx.strokeStyle = 'rgba(0,0,0,0.38)';
      ctx.lineWidth = Math.max(0.8, size * 0.03);
      ctx.beginPath();
      let x = size * (0.2 + hash(seed * 2.1) * 0.6);
      let y = size * 0.12;
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (hash(seed + k * 9) - 0.5) * size * 0.3;
        y += size * 0.2;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // A corner knocked off: a darker facet.
    if (hash(seed * 4.3) > 0.35) {
      const corner = Math.floor(hash(seed * 8.1) * 4);
      const cx = corner % 2 ? size : 0;
      const cy = corner > 1 ? size : 0;
      const chip = size * (0.18 + hash(seed) * 0.12);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.moveTo(cx, cy + (cy ? -chip : chip));
      ctx.lineTo(cx + (cx ? -chip : chip), cy);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
    }
    // Wear: a darker lower edge, a lit upper rim.
    const wear = ctx.createRadialGradient(half * 0.7, half * 0.6, r * 0.2, half, half, r * 1.25);
    wear.addColorStop(0, 'rgba(255,255,255,0)');
    wear.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = wear;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
    stoneOutline(ctx, half, half, r, seed, 0.8);
    ctx.lineWidth = Math.max(1, size * 0.045);
    ctx.strokeStyle = mix(base, '#000000', 0.6);
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, size * 0.62, size * 0.5);
    ctx.clip();
    stoneOutline(ctx, half, half, r - size * 0.05, seed, 0.8);
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();
    ctx.restore();
  }

  // ——— rubble: the old well's stones, none of them square ———

  /** A field stone: an irregular, rounded outline, wider than tall, never with a straight side. */
  function rubbleOutline(ctx, cx, cy, rx, ry, seed) {
    const n = 9;
    const points = [];
    const turn = hash(seed * 0.7) * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = turn + (i / n) * Math.PI * 2 + (hash(seed + i * 1.7) - 0.5) * 0.45;
      const r = 0.78 + hash(seed * 2.3 + i) * 0.26;
      points.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
    }
    ctx.beginPath();
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const start = mid(points[n - 1], points[0]);
    ctx.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i++) {
      const next = mid(points[i], points[(i + 1) % n]);
      ctx.quadraticCurveTo(points[i][0], points[i][1], next[0], next[1]);
    }
    ctx.closePath();
  }

  /** One stone of the wall: shaded from above, grained, sometimes mossy or split. */
  function paintRubbleStone(ctx, cx, cy, rx, ry, seed, tones, p) {
    rubbleOutline(ctx, cx, cy, rx, ry, seed);
    const tone = tones[Math.floor(hash(seed * 3.9) * tones.length)];
    const body = ctx.createLinearGradient(cx - rx * 0.4, cy - ry, cx + rx * 0.4, cy + ry);
    body.addColorStop(0, mix(tone, '#ffffff', 0.22));
    body.addColorStop(0.5, tone);
    body.addColorStop(1, mix(tone, '#000000', 0.45));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(cx + (hash(seed + i * 5.1) - 0.5) * rx * 1.7, cy + (hash(seed + i * 7.3) - 0.5) * ry * 1.7, Math.max(0.6, rx * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
    if (hash(seed * 5.5) > 0.6) {
      const moss = ctx.createRadialGradient(cx, cy + ry, 0, cx, cy + ry, rx * 1.3);
      moss.addColorStop(0, p.moss);
      moss.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = moss;
      ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
    }
    if (hash(seed * 2.9) > 0.72) {
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = Math.max(0.8, rx * 0.06);
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.2, cy - ry);
      ctx.quadraticCurveTo(cx + rx * 0.15, cy, cx - rx * 0.05, cy + ry);
      ctx.stroke();
    }
    ctx.restore();
    rubbleOutline(ctx, cx, cy, rx, ry, seed);
    ctx.lineWidth = Math.max(1, rx * 0.07);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - rx * 1.2, cy - ry * 1.2, rx * 2.4, ry * 0.9);
    ctx.clip();
    rubbleOutline(ctx, cx, cy - ry * 0.08, rx * 0.88, ry * 0.82, seed);
    ctx.lineWidth = Math.max(0.8, rx * 0.05);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Packs stones into a region the way an old well was built: a staggered, jittered lattice of
   * stones of every size, each sitting in a little bed of earthy mortar. `inside(x, y)` says
   * whether a point belongs to the region; stones shrink to stay in it, so its edge is a row of
   * rounded stone sides rather than a straight line.
   */
  function packRubble(ctx, left, top, right, bottom, size, inside, seed, tones, p, skip) {
    const stones = [];
    const sy = size * 0.66;
    const sx = size * 0.86;
    for (let r = Math.floor(top / sy) - 1; r * sy < bottom + sy; r++) {
      for (let k = Math.floor(left / sx) - 1; k * sx < right + sx; k++) {
        const id = seed + r * 37 + k * 11;
        const cx = (k + (Math.abs(r) % 2) * 0.5) * sx + (hash(id) - 0.5) * sx * 0.32;
        const cy = (r + 0.5) * sy + (hash(id * 1.3) - 0.5) * sy * 0.3;
        if (cx < left || cx > right || cy < top || cy > bottom) continue;
        if (!inside(cx, cy) || (skip && skip(cx, cy, id))) continue;
        let rx = sx * (0.52 + hash(id * 2.1) * 0.2);
        let ry = sy * (0.56 + hash(id * 2.7) * 0.15);
        for (let tries = 0; tries < 6; tries++) {
          const fits =
            inside(cx - rx * 0.92, cy) && inside(cx + rx * 0.92, cy) && inside(cx, cy - ry * 0.92) && inside(cx, cy + ry * 0.92);
          if (fits) break;
          rx *= 0.82;
          ry *= 0.86;
        }
        stones.push([cx, cy, rx, ry, id]);
      }
    }
    // Earth packed round the stones first, then the stones on top.
    ctx.fillStyle = p.mortar;
    for (const [cx, cy, rx, ry, id] of stones) {
      rubbleOutline(ctx, cx, cy, rx * 1.38, ry * 1.42, id);
      ctx.fill();
    }
    for (const [cx, cy, rx, ry, id] of stones) paintRubbleStone(ctx, cx, cy, rx, ry, id, tones, p);
  }

  const WALL_SEED = 17;
  const SEAM = 1.6;

  function wallTones(p) {
    return [p.wall, p.wallShade, p.wallLight, mix(p.wall, '#8a7356', 0.35), mix(p.wallShade, '#5f6f5a', 0.3)];
  }

  /**
   * Whether a point (in the well canvas's pixels) is wall: a rock cell inside the well, the top
   * row's pattern carried up the shaft above it, and solid wall all round outside it.
   */
  function rockTest(board, cols, rows, cs) {
    return (px, py) => {
      const x = Math.floor(px / cs);
      const y = Math.floor(py / cs);
      if (x < 0 || x >= cols || y >= rows) return true;
      return board[Math.max(0, y)][x].type === 'rock';
    };
  }

  const wallCache = { key: '', canvas: null };

  /** The well's own walls (the engine's rock cells), as old rubble masonry. */
  function wallLayer(game, width, height, cs, theme) {
    let signature = '';
    for (let y = 0; y < game.height; y++) {
      for (let x = 0; x < game.width; x++) signature += game.board[y][x].type === 'rock' ? '1' : '0';
    }
    const key = `${signature}:${width}x${height}:${cs}:${theme}`;
    if (wallCache.key === key) return wallCache.canvas;
    const p = look(theme);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const isRock = rockTest(game.board, game.width, game.height, cs);
    // Stones a little beyond the frame are drawn too: the earth canvas draws the same ones from
    // its side, so a stone across the seam is whole.
    packRubble(ctx, -cs * SEAM, -cs * SEAM, width + cs * SEAM, height + cs * SEAM, cs, isRock, WALL_SEED, wallTones(p), p);
    wallCache.key = key;
    wallCache.canvas = canvas;
    return canvas;
  }

  // ——— the well canvas ———

  const shaftCache = { key: '', canvas: null };

  /** Daylight or lamplight spilling down from the mouth of the well, strongest at the top. */
  function shaftLight(theme) {
    return theme === 'light' ? ['#fff6dc', 0.32] : ['#ffc878', 0.07];
  }

  /** The shaft's colour where the board begins, which the open shaft above it continues. */
  function shaftTopColor(theme) {
    const [light, amount] = shaftLight(theme);
    return mix(look(theme).shaft[0], light, amount);
  }

  /** The far side of the shaft: faint stone shapes on a lattice anchored to the board's origin. */
  function paintFarWall(ctx, left, top, right, bottom, cs, theme) {
    ctx.strokeStyle = look(theme).shaftCourse;
    ctx.lineWidth = 1;
    const sy = cs * 0.66;
    const sx = cs * 0.86;
    for (let r = Math.floor(top / sy) - 1; r * sy < bottom + sy; r++) {
      for (let k = Math.floor(left / sx) - 1; k * sx < right + sx; k++) {
        const id = 500 + r * 37 + k * 11;
        const cx = (k + (Math.abs(r) % 2) * 0.5) * sx + (hash(id) - 0.5) * cs * 0.25;
        const cy = r * sy + (hash(id * 1.3) - 0.5) * cs * 0.2;
        rubbleOutline(ctx, cx, cy, cs * (0.4 + hash(id * 2.1) * 0.12), cs * (0.32 + hash(id * 2.7) * 0.08), id);
        ctx.stroke();
      }
    }
  }

  /** The empty shaft: damp, dark below, with the faint courses of an older lining behind. */
  function shaftBackdrop(width, height, cs, theme) {
    const key = `${width}x${height}:${cs}:${theme}`;
    if (shaftCache.key === key) return shaftCache.canvas;
    const p = look(theme);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const fill = ctx.createLinearGradient(0, 0, 0, height);
    fill.addColorStop(0, p.shaft[0]);
    fill.addColorStop(1, p.shaft[1]);
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);
    paintFarWall(ctx, 0, 0, width, height, cs, theme);
    // Seep stains running down, soft-edged.
    for (let i = 0; i < 9; i++) {
      const x = hash(i * 13.1) * width;
      const y = height * (0.3 + hash(i * 3.1) * 0.5);
      const stain = ctx.createRadialGradient(x, y, 0, x, y, cs * 2.4);
      stain.addColorStop(0, theme === 'light' ? 'rgba(60,40,20,0.14)' : 'rgba(0,0,0,0.25)');
      stain.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(0.25, 1);
      ctx.translate(-x, -y);
      ctx.fillStyle = stain;
      ctx.fillRect(x - cs * 2.4, y - cs * 2.4, cs * 4.8, cs * 4.8);
      ctx.restore();
    }
    // Light falling from the mouth of the well, fading with depth.
    const [light, amount] = shaftLight(theme);
    const beam = ctx.createLinearGradient(0, 0, 0, Math.min(height, cs * 9));
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(light.slice(i, i + 2), 16));
    beam.addColorStop(0, `rgba(${r},${g},${bl},${amount})`);
    beam.addColorStop(1, `rgba(${r},${g},${bl},0)`);
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, width, height);
    shaftCache.key = key;
    shaftCache.canvas = canvas;
    return canvas;
  }

  const seeds = new WeakMap();
  let nextSeed = 1;
  function seedOf(cell, fallback) {
    if (!cell || typeof cell !== 'object') return fallback;
    let seed = seeds.get(cell);
    if (seed === undefined) {
      seed = (nextSeed++ * 7.31) % 97;
      seeds.set(cell, seed);
    }
    return seed;
  }

  function variant(seed) {
    return Math.floor(seed) % 12;
  }

  function drawStoneCell(ctx, x, y, cs, color, seed, theme) {
    const type = typeOf(color);
    const v = variant(seed);
    const size = Math.round(cs);
    const img = sprite(`s:${type}:${v}:${size}:${theme}`, size, (c, s) => paintStone(c, s, STONE_COLORS[type], v * 13 + 3, theme));
    ctx.drawImage(img, x * cs, y * cs, cs, cs);
  }

  function drawGhostCell(ctx, x, y, cs, color, theme) {
    const type = typeOf(color);
    const half = cs / 2;
    ctx.save();
    ctx.globalAlpha = look(theme).ghost;
    stoneOutline(ctx, x * cs + half, y * cs + half, half - cs * 0.08, 5, 0.8);
    ctx.setLineDash([Math.max(2, cs * 0.12), Math.max(2, cs * 0.09)]);
    ctx.lineWidth = Math.max(1.5, cs * 0.07);
    ctx.strokeStyle = mix(STONE_COLORS[type], theme === 'light' ? '#000000' : '#ffffff', theme === 'light' ? 0.35 : 0.25);
    ctx.stroke();
    ctx.restore();
  }

  /** The whole well: the shaft, the well's wall stones, settled stones, the ghost and the piece. */
  function drawWell(ctx, game, cs, theme) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(shaftBackdrop(width, height, cs, theme), 0, 0);
    ctx.drawImage(wallLayer(game, width, height, cs, theme), 0, 0);
    for (let y = 0; y < game.height; y++) {
      for (let x = 0; x < game.width; x++) {
        const cell = game.board[y][x];
        if (cell.type === 'filled') drawStoneCell(ctx, x, y, cs, cell.color, seedOf(cell, x + y * 3), theme);
      }
    }
    if (!game.current) return;
    const color = window.BrokenWellEngine.PIECE_COLORS[game.current.type];
    for (const c of game.current.cells) {
      const x = game.current.x + c.x;
      const y = game.ghostY + c.y;
      if (y >= 0 && y !== game.current.y + c.y) drawGhostCell(ctx, x, y, cs, color, theme);
    }
    game.current.cells.forEach((c, i) => {
      const x = game.current.x + c.x;
      const y = game.current.y + c.y;
      if (y >= 0) drawStoneCell(ctx, x, y, cs, color, i * 11 + 2, theme);
    });
  }

  /** The next piece in the side panel, as stones. */
  function drawNext(ctx, type, cells, theme) {
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    for (const c of cells) {
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y);
      maxY = Math.max(maxY, c.y);
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const cs = Math.min(canvas.width / (bw + 1), canvas.height / (bh + 1));
    const offX = (canvas.width - cs * bw) / 2 - minX * cs;
    const offY = (canvas.height - cs * bh) / 2 - minY * cs;
    cells.forEach((c, i) => {
      const size = Math.round(cs);
      const img = sprite(`s:${type}:${i}:${size}:${theme}`, size, (g, s) => paintStone(g, s, STONE_COLORS[type], i * 13 + 3, theme));
      ctx.drawImage(img, offX + c.x * cs, offY + c.y * cs, cs, cs);
    });
  }

  /** Dust and pebbles thrown up when a row of stones gives way. */
  function clearParticles(rows, width, cs) {
    const out = [];
    const colors = Object.values(STONE_COLORS);
    for (const y of rows) {
      for (let x = 0; x < width; x++) {
        for (let i = 0; i < 4; i++) {
          out.push({
            x: (x + 0.5) * cs,
            y: (y + 0.5) * cs,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 5 - 2.5,
            life: 1,
            decay: 0.02 + Math.random() * 0.03,
            color: i === 0 ? 'rgba(200,180,150,0.8)' : colors[(x + i) % colors.length],
            size: cs * (0.08 + Math.random() * 0.14),
          });
        }
      }
    }
    return out;
  }

  // ——— the earth around the well ———

  const earth = {
    canvas: null,
    ctx: null,
    container: null,
    well: null,
    staticLayer: null,
    staticKey: '',
    theme: 'dark',
    reduced: false,
    startle: -10,
    frame: 0,
    worms: [],
    wellInfo: null,
  };

  function surfaceY(h) {
    return Math.max(70, h * 0.1);
  }

  /** The well's rectangle on the earth canvas, and its shaft up to the surface. */
  function wellBox() {
    const box = earth.container.getBoundingClientRect();
    const r = earth.well.getBoundingClientRect();
    return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
  }

  function strataBounds(h) {
    const top = surfaceY(h);
    const span = h - top;
    return [top, top + span * 0.16, top + span * 0.38, top + span * 0.6, top + span * 0.8, h];
  }

  function wavy(x, base, amp, seed) {
    return base + Math.sin(x * 0.006 + seed) * amp + Math.sin(x * 0.017 + seed * 2.3) * amp * 0.45;
  }

  function paintStatic(ctx, w, h, theme, well) {
    const p = look(theme);
    const bounds = strataBounds(h);
    const top = bounds[0];
    // Sky and the grassy surface.
    const sky = ctx.createLinearGradient(0, 0, 0, top);
    sky.addColorStop(0, p.sky[0]);
    sky.addColorStop(1, p.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, top + 4);
    // Strata, each with a wavy upper boundary.
    for (let band = 0; band < 5; band++) {
      ctx.beginPath();
      const y0 = band === 0 ? top : bounds[band];
      ctx.moveTo(0, h);
      for (let x = 0; x <= w + 12; x += 12) ctx.lineTo(x, band === 0 ? y0 + Math.sin(x * 0.02) * 2 : wavy(x, y0, 9, band * 3.1));
      ctx.lineTo(w + 12, h);
      ctx.closePath();
      ctx.fillStyle = p.strata[band];
      ctx.fill();
      if (band > 0) {
        ctx.strokeStyle = p.strataLine;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= w + 12; x += 12) {
          const y = wavy(x, y0, 9, band * 3.1);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    // Grains everywhere.
    for (let i = 0; i < Math.floor((w * h) / 900); i++) {
      ctx.fillStyle = p.speck[i % 2];
      const s = 1 + hash(i * 1.3) * 2;
      ctx.fillRect(hash(i * 2.1) * w, top + hash(i * 3.7) * (h - top), s, s);
    }
    paintGrass(ctx, w, top, theme);
    // Pebbles in the gravel band, stones in the bedrock.
    for (let i = 0; i < Math.floor(w / 14); i++) {
      const band = i % 3 === 0 ? 4 : 3;
      const x = hash(i * 4.4) * w;
      const y = bounds[band] + 14 + hash(i * 5.5) * (bounds[band + 1] - bounds[band] - 20);
      const rx = (band === 4 ? 6 : 3) + hash(i * 6.6) * (band === 4 ? 10 : 5);
      ctx.fillStyle = p.pebble[i % 3];
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, rx * (0.5 + hash(i) * 0.25), (hash(i * 7.7) - 0.5) * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.ellipse(x - rx * 0.3, y - rx * 0.25, rx * 0.35, rx * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Roots hanging from the surface, some reaching the well.
    for (let i = 0; i < 9; i++) {
      let x = hash(i * 9.1) * w;
      let y = top;
      let width = 7 + hash(i * 2.2) * 5;
      const length = (bounds[2] - top) * (0.6 + hash(i * 3.3) * 0.9);
      ctx.lineCap = 'round';
      for (let step = 0; step < 14 && width > 0.6; step++) {
        const nx = x + (hash(i * 31 + step) - 0.5) * 34;
        const ny = y + length / 14;
        ctx.strokeStyle = step % 3 ? p.root : p.rootLight;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo((x + nx) / 2 + 6, (y + ny) / 2, nx, ny);
        ctx.stroke();
        if (hash(i * 7 + step) > 0.6) {
          ctx.lineWidth = Math.max(0.6, width * 0.3);
          ctx.beginPath();
          ctx.moveTo(nx, ny);
          ctx.quadraticCurveTo(nx + 14, ny + 6, nx + 22 * (hash(step) - 0.3), ny + 22);
          ctx.stroke();
        }
        x = nx;
        y = ny;
        width *= 0.84;
      }
    }
    // A fossil shell in the clay, an old coin in the sand.
    const fossil = { x: w * 0.12, y: (bounds[1] + bounds[2]) / 2 + 20 };
    ctx.strokeStyle = p.fossil;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let t = 0; t < 22; t += 0.2) {
      const r = 2 + t * 1.25;
      const px = fossil.x + Math.cos(t) * r;
      const py = fossil.y + Math.sin(t) * r * 0.9;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    for (let t = 2; t < 22; t += 1.1) {
      const r = 2 + t * 1.25;
      ctx.beginPath();
      ctx.moveTo(fossil.x + Math.cos(t) * r * 0.8, fossil.y + Math.sin(t) * r * 0.72);
      ctx.lineTo(fossil.x + Math.cos(t) * r, fossil.y + Math.sin(t) * r * 0.9);
      ctx.stroke();
    }
    const coin = { x: w * 0.86, y: (bounds[2] + bounds[3]) / 2 + 30 };
    ctx.fillStyle = p.coin;
    ctx.beginPath();
    ctx.ellipse(coin.x, coin.y, 12, 9, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,50,10,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(coin.x, coin.y, 8.5, 6, -0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(coin.x - 4, coin.y - 3, 4, 2, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // Burrows: the tunnels the worms live in.
    for (const worm of earth.worms) {
      ctx.strokeStyle = p.burrow;
      ctx.lineCap = 'round';
      ctx.lineWidth = worm.thickness * 3.4;
      ctx.beginPath();
      worm.path.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
    }
    paintWellLining(ctx, w, h, theme, well, top);
    if (theme !== 'light') {
      // The pit is dark away from the lantern.
      const reach = well.w / 2 + (earth.wellInfo ? earth.wellInfo.cs * 2.6 : 80);
      const shade = ctx.createRadialGradient(well.x + well.w / 2, well.y + well.h * 0.35, reach, well.x + well.w / 2, well.y + well.h * 0.35, Math.max(w, h) * 0.75);
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(1, p.ambient);
      ctx.fillStyle = shade;
      ctx.fillRect(0, top, w, h - top);
    }
  }

  /** One blade of grass: a curved, tapering leaf from a base width to a point. */
  function blade(ctx, x, base, height, lean, width, color) {
    const tipX = x + lean;
    const tipY = base - height;
    ctx.beginPath();
    ctx.moveTo(x - width / 2, base);
    ctx.quadraticCurveTo(x - width * 0.3 + lean * 0.35, base - height * 0.55, tipX, tipY);
    ctx.quadraticCurveTo(x + width * 0.3 + lean * 0.45, base - height * 0.5, x + width / 2, base);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  /** Grass along the surface: clumps of blades in several greens, the odd seed head and flower. */
  function paintGrass(ctx, w, top, theme) {
    const greens =
      theme === 'light'
        ? ['#3f7a2c', '#4f8f34', '#62a63e', '#78ba4a', '#8fcb5a']
        : ['#1c3320', '#24402a', '#2f5234', '#3b6440', '#4d7a52'];
    // A dark band of turf the blades grow out of, with an uneven top.
    ctx.fillStyle = greens[0];
    ctx.beginPath();
    ctx.moveTo(0, top + 6);
    for (let x = 0; x <= w + 6; x += 6) ctx.lineTo(x, top - 1 - hash(x * 0.37) * 3);
    ctx.lineTo(w + 6, top + 6);
    ctx.closePath();
    ctx.fill();
    for (let layer = 0; layer < 3; layer++) {
      for (let x = -4; x < w + 8; x += 3 + hash(x * 0.71 + layer) * 4) {
        const seed = x * 1.13 + layer * 91;
        const height = (6 + hash(seed) * 12) * (1 - layer * 0.18);
        const lean = (hash(seed * 1.7) - 0.5) * height * 0.9;
        const color = greens[Math.min(greens.length - 1, 1 + layer + Math.floor(hash(seed * 2.3) * 2))];
        blade(ctx, x, top + 2, height, lean, 2.2 + hash(seed * 3.1) * 1.4, color);
      }
    }
    // Now and then a taller seed stalk, a clover leaf or a small flower.
    for (let x = 12; x < w; x += 40 + hash(x) * 70) {
      const kind = hash(x * 0.3);
      if (kind < 0.45) {
        const height = 18 + hash(x * 1.9) * 10;
        ctx.strokeStyle = greens[2];
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, top + 1);
        ctx.quadraticCurveTo(x + 3, top - height * 0.6, x + 5, top - height);
        ctx.stroke();
        ctx.fillStyle = theme === 'light' ? '#c8b46a' : '#6f6a4a';
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.ellipse(x + 5 - k * 0.6, top - height + k * 3, 1.6, 2.6, 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (kind < 0.7) {
        ctx.fillStyle = greens[3];
        for (let k = 0; k < 3; k++) {
          const a = -Math.PI / 2 + (k - 1) * 1.2;
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a) * 3, top - 6 + Math.sin(a) * 3, 2.8, 2.2, a, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.strokeStyle = greens[2];
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, top + 1);
        ctx.lineTo(x + 1, top - 10);
        ctx.stroke();
        ctx.fillStyle = theme === 'light' ? (kind > 0.85 ? '#ffffff' : '#ffd84a') : kind > 0.85 ? '#cfcfe0' : '#c9b46a';
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(x + 1 + Math.cos(a) * 2.2, top - 11 + Math.sin(a) * 2.2, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = theme === 'light' ? '#e8a020' : '#a08a40';
        ctx.beginPath();
        ctx.arc(x + 1, top - 11, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * The open shaft between the grass and the board, over the columns the board leaves open at
   * its top: the board's own top colour and far-wall stones, so the two meet without a seam, and
   * an uneven rim where the earth gave way at the surface.
   */
  function paintOpenShaft(ctx, theme, well, top) {
    const info = earth.wellInfo;
    if (!info || well.y <= top) return;
    const cs = info.cs;
    const surface = top - well.y;
    ctx.save();
    ctx.translate(well.x, well.y);
    ctx.beginPath();
    let x = 0;
    while (x < info.cols) {
      if (info.board[0][x].type === 'rock') {
        x++;
        continue;
      }
      const from = x;
      while (x < info.cols && info.board[0][x].type !== 'rock') x++;
      const left = from * cs - cs * 0.7;
      const right = x * cs + cs * 0.7;
      ctx.moveTo(left, 2);
      for (let px = left; px <= right; px += cs * 0.25) ctx.lineTo(px, surface + 2 + hash(px * 0.37) * cs * 0.35);
      ctx.lineTo(right, 2);
      ctx.closePath();
    }
    ctx.fillStyle = shaftTopColor(theme);
    ctx.fill();
    ctx.clip();
    paintFarWall(ctx, 0, surface, well.w, 0, cs, theme);
    ctx.restore();
  }

  /** The well's lining from the surface down, crumbling, with a broken parapet on top. */
  function paintWellLining(ctx, w, h, theme, well, top) {
    const p = look(theme);
    const brickH = Math.max(12, well.w / 14);
    const thick = earth.wellInfo ? earth.wellInfo.cs * 2.2 : brickH * 1.9;
    const bottom = well.y + well.h;
    paintOpenShaft(ctx, theme, well, top);
    const tones = wallTones(p);
    const info = earth.wellInfo;
    if (info) {
      const cs = info.cs;
      const band = cs * 2.2;
      const isRock = rockTest(info.board, info.cols, info.rows, cs);
      const surface = top - well.y;
      const inBand = (x, y) => y >= surface - 2 && x >= -band && x <= well.w + band && y <= well.h + cs * 1.4 && isRock(x, y);
      // Broken: stones gone near the grass, but never one the well canvas also draws.
      const missing = (x, y, id) => {
        // Only the outer face of the wall crumbles: never a stone the board draws, nor one that
        // edges the open shaft above it.
        const nearCanvas = x > -cs * (SEAM + 0.3) && x < well.w + cs * (SEAM + 0.3);
        return !nearCanvas && hash(id * 4.4) < (y < surface + cs * 2.5 ? 0.35 : 0.06);
      };
      ctx.save();
      ctx.translate(well.x, well.y);
      packRubble(ctx, -band, surface, well.w + band, well.h + cs * 1.4, cs, inBand, WALL_SEED, tones, p, missing);
      ctx.restore();
    }
    // Fallen stones lying in the earth beside the well.
    for (let i = 0; i < 7; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side < 0 ? well.x - thick - 30 - hash(i * 3.3) * 120 : well.x + well.w + thick + 20 + hash(i * 3.3) * 120;
      const y = top + 30 + hash(i * 5.1) * (h - top - 80);
      paintRubbleStone(ctx, x, y, brickH * (0.7 + hash(i) * 0.4), brickH * (0.5 + hash(i * 2) * 0.25), 900 + i * 59, tones, p);
    }
    // A snapped beam across the mouth, and its rope hanging into the shaft.
    ctx.save();
    ctx.translate(well.x - thick * 0.6, top + brickH * 0.4);
    ctx.rotate(0.12);
    ctx.fillStyle = p.beam;
    ctx.fillRect(0, -6, well.w * 0.62, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 2, well.w * 0.62, 4);
    ctx.beginPath();
    ctx.moveTo(well.w * 0.62, -6);
    ctx.lineTo(well.w * 0.62 + 10, -2);
    ctx.lineTo(well.w * 0.62 + 4, 1);
    ctx.lineTo(well.w * 0.62 + 12, 6);
    ctx.lineTo(well.w * 0.62, 6);
    ctx.closePath();
    ctx.fillStyle = p.beam;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = p.rope;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const ropeX = well.x + well.w * 0.38;
    const ropeTop = top + brickH * 0.4 + well.w * 0.38 * 0.12;
    ctx.moveTo(ropeX, ropeTop);
    ctx.bezierCurveTo(ropeX + 6, ropeTop + 40, ropeX - 4, well.y - 30, ropeX + 3, Math.max(ropeTop + 30, well.y + 20));
    ctx.stroke();
  }

  // ——— living things ———

  function makeWorms(w, h, well) {
    const bounds = strataBounds(h);
    const worms = [];
    const spots = [
      [0.07, 1],
      [0.25, 2],
      [0.78, 1],
      [0.92, 2],
      [0.16, 3],
      [0.84, 3],
    ];
    // The lining's stones reach this far either side of the shaft.
    const lining = earth.wellInfo ? earth.wellInfo.cs * 2.2 : 40;
    spots.forEach(([fx, band], i) => {
      const length = 110 + hash(i * 2.7) * 70;
      // Keep the whole burrow clear of the well and its lining.
      const clear = lining + length / 2 + 24;
      let x = fx * w;
      if (x > well.x - clear && x < well.x + well.w + clear) x = fx < 0.5 ? well.x - clear : well.x + well.w + clear;
      const y = bounds[band] + 26 + hash(i * 4.1) * (bounds[band + 1] - bounds[band] - 52);
      const path = [];
      const angle = (hash(i * 8.8) - 0.5) * 0.9;
      for (let k = 0; k <= 24; k++) {
        const t = k / 24;
        path.push([
          x + Math.cos(angle) * length * (t - 0.5) + Math.sin(t * 6 + i) * 10,
          y + Math.sin(angle) * length * (t - 0.5) + Math.cos(t * 5 + i) * 8,
        ]);
      }
      worms.push({ path, thickness: 3.2 + hash(i) * 1.6, phase: hash(i * 3.9) * 10, speed: 0.05 + hash(i * 1.1) * 0.05 });
    });
    return worms;
  }

  function pointOn(path, t) {
    const f = Math.min(path.length - 1.001, Math.max(0, t * (path.length - 1)));
    const i = Math.floor(f);
    const a = path[i];
    const b = path[i + 1];
    const u = f - i;
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  }

  function paintWorm(ctx, worm, time, p) {
    const startled = Math.max(0, 1 - (time - earth.startle) / 2.5);
    const visible = 0.42 * (1 - startled * 0.9);
    const head = 0.5 + Math.sin(time * worm.speed * 6 + worm.phase) * (0.5 - visible / 2) * 0.95;
    const segments = 14;
    const points = [];
    for (let s = 0; s <= segments; s++) {
      const t = head - (s / segments) * visible;
      const [x, y] = pointOn(worm.path, t);
      const wiggle = Math.sin(time * 4 + s * 0.9 + worm.phase) * 1.6 * (1 - startled);
      points.push([x, y + wiggle]);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = p.worm;
    ctx.lineWidth = worm.thickness * 2;
    ctx.beginPath();
    points.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    // The saddle band, the rings and a wet shine.
    ctx.strokeStyle = p.wormBand;
    ctx.lineWidth = worm.thickness * 2.2;
    ctx.beginPath();
    ctx.moveTo(...points[3]);
    ctx.lineTo(...points[5]);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    for (let k = 1; k < points.length - 1; k += 1) {
      const [x, y] = points[k];
      ctx.beginPath();
      ctx.arc(x, y, worm.thickness * 0.95, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = p.wormShine;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    points.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y - worm.thickness * 0.5) : ctx.lineTo(x, y - worm.thickness * 0.5)));
    ctx.stroke();
  }

  function paintBeetle(ctx, x, y, time, p) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = p.beetle;
    ctx.lineWidth = 1.4;
    for (let k = -1; k <= 1; k++) {
      const step = Math.sin(time * 10 + k) * 2;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(k * 4, 0);
        ctx.lineTo(k * 5 + step * side * 0.3, side * 8);
        ctx.lineTo(k * 6 + step * side * 0.3, side * 10);
        ctx.stroke();
      }
    }
    ctx.fillStyle = p.beetle;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.beetleShine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, -1);
    ctx.lineTo(17, -5);
    ctx.moveTo(12, 1);
    ctx.lineTo(17, 5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(-2, -3, 4, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function paintSnail(ctx, x, y, time, p) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = p.snailBody;
    ctx.beginPath();
    ctx.ellipse(2, 5, 13 + Math.sin(time) * 1, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.snailBody;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(12, 3);
    ctx.lineTo(16, -5);
    ctx.moveTo(10, 3);
    ctx.lineTo(12, -4);
    ctx.stroke();
    ctx.fillStyle = p.snailShell;
    ctx.beginPath();
    ctx.arc(0, -1, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let t = 0; t < 9; t += 0.2) {
      const r = 0.8 * t;
      const px = Math.cos(t) * r;
      const py = -1 + Math.sin(t) * r;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function paintLiving(ctx, w, h, time, well) {
    const p = look(earth.theme);
    const bounds = strataBounds(h);
    for (const worm of earth.worms) paintWorm(ctx, worm, time, p);
    // A beetle trundling through the sandy layer, back and forth.
    const span = Math.max(80, well.x - 150);
    const t = (Math.sin(time * 0.12) + 1) / 2;
    paintBeetle(ctx, 60 + t * span, bounds[3] - 22, time, p);
    // A snail on the bedrock, beside the well.
    paintSnail(ctx, well.x + well.w + 110 + Math.sin(time * 0.05) * 20, bounds[4] + 30, time, p);
    // Water seeping from the roots, dripping down beside the lining.
    const thick = Math.max(12, well.w / 14) * 1.6;
    for (let i = 0; i < 3; i++) {
      const x = well.x + well.w + thick + 8 + i * 22;
      const fall = ((time * 0.35 + i * 0.37) % 1) * 160;
      ctx.fillStyle = p.water;
      ctx.beginPath();
      ctx.ellipse(x, bounds[0] + 20 + fall, 2.2, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (earth.theme !== 'light') {
      // The lantern on its hook by the well, and the warm light it throws.
      // Hung far enough off that its light fades before the well's stones, inside and out alike.
      const thick = earth.wellInfo ? earth.wellInfo.cs * 2.2 : 40;
      const lx = well.x - thick - 120;
      const ly = bounds[0] + 70;
      const flicker = 1 + Math.sin(time * 7) * 0.03 + Math.sin(time * 13) * 0.02;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 150 * flicker);
      glow.addColorStop(0, 'rgba(255,190,110,0.28)');
      glow.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lx - 170, ly - 170, 340, 340);
      ctx.restore();
      ctx.strokeStyle = '#2c2218';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, ly - 22);
      ctx.lineTo(lx + 18, ly - 30);
      ctx.stroke();
      ctx.fillStyle = '#2c2218';
      ctx.fillRect(lx - 7, ly - 14, 14, 3);
      ctx.fillRect(lx - 7, ly + 9, 14, 4);
      ctx.fillStyle = p.lantern;
      ctx.beginPath();
      ctx.roundRect(lx - 6, ly - 11, 12, 20, 3);
      ctx.fill();
    }
  }

  // ——— the earth canvas's life cycle ———

  function earthFrame(now) {
    const { canvas, ctx } = earth;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      earth.staticKey = '';
    }
    const well = wellBox();
    const info = earth.wellInfo;
    const key = `${w}x${h}:${earth.theme}:${Math.round(well.x)}:${Math.round(well.y)}:${Math.round(well.w)}:${Math.round(well.h)}:${info ? info.signature : ''}`;
    if (key !== earth.staticKey) {
      earth.worms = makeWorms(w, h, well);
      const layer = document.createElement('canvas');
      layer.width = canvas.width;
      layer.height = canvas.height;
      const g = layer.getContext('2d');
      g.scale(ratio, ratio);
      paintStatic(g, w, h, earth.theme, well);
      earth.staticLayer = layer;
      earth.staticKey = key;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(earth.staticLayer, 0, 0);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const time = earth.reduced ? 3 : now / 1000;
    paintLiving(ctx, w, h, time, well);
    if (!earth.reduced && !document.hidden) earth.frame = requestAnimationFrame(earthFrame);
    else earth.frame = 0;
  }

  function wake() {
    if (!earth.frame) earth.frame = requestAnimationFrame(earthFrame);
  }

  // ——— key art for the Hall ———

  /** A small well for the poster: the canyon shape, a stack of stones, a T coming down. */
  function posterGame() {
    const cols = 10;
    const rows = 11;
    const colors = window.BrokenWellEngine.PIECE_COLORS;
    const order = ['Z', 'O', 'I', 'L', 'S', 'J', 'T'];
    const board = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        const wall = x < 2 || x > 7 || (x === 2 && y >= 2 && y <= 4) || (x === 7 && y >= 5 && y <= 6);
        row.push({ type: wall ? 'rock' : 'empty' });
      }
      board.push(row);
    }
    const stack = [
      [rows - 1, [2, 3, 4, 6, 7]],
      [rows - 2, [2, 3, 5, 6, 7]],
      [rows - 3, [3, 4, 5, 7]],
      [rows - 4, [4, 6]],
    ];
    stack.forEach(([y, xs], r) => {
      xs.forEach((x, i) => {
        board[y][x] = { type: 'filled', color: colors[order[(x + r * 2 + i) % order.length]] };
      });
    });
    return {
      width: cols,
      height: rows,
      board,
      current: { type: 'T', x: 4, y: 1, cells: [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] },
      ghostY: rows - 6,
    };
  }

  /**
   * Draws the game's key art: the earth in cross-section, the old field-stone well with its
   * stones, and the life around it, by lamplight (dark) or daylight (light).
   */
  function paintPoster(theme, width = 1280, height = 720) {
    const game = posterGame();
    const cs = Math.round(height * 0.05);
    const wellW = cs * game.width;
    const wellH = cs * game.height;
    // Right of centre: the Hall's hero sets the title over the left of the art.
    const well = { x: Math.round(width * 0.62 - wellW / 2), y: Math.round(height * 0.72 - wellH), w: wellW, h: wellH };
    const saved = { wellInfo: earth.wellInfo, worms: earth.worms, theme: earth.theme };
    earth.theme = theme === 'light' ? 'light' : 'dark';
    earth.wellInfo = { board: game.board, cols: game.width, rows: game.height, cs, signature: 'poster' };
    earth.worms = makeWorms(width, height, well);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    paintStatic(ctx, width, height, earth.theme, well);
    const shaft = document.createElement('canvas');
    shaft.width = wellW;
    shaft.height = wellH;
    drawWell(shaft.getContext('2d'), game, cs, earth.theme);
    ctx.drawImage(shaft, well.x, well.y);
    paintLiving(ctx, width, height, 4.2, well);
    Object.assign(earth, saved);
    return canvas;
  }

  window.BrokenWellArt = {
    STONE_COLORS,
    paintPoster,
    drawWell,
    drawNext,
    clearParticles,
    /** Mounts the earth behind the page: `canvas` fills `container`; `well` is the well canvas. */
    mountEarth(canvas, container, well) {
      earth.canvas = canvas;
      earth.ctx = canvas.getContext('2d');
      earth.container = container;
      earth.well = well;
      new ResizeObserver(() => {
        earth.staticKey = '';
        wake();
      }).observe(container);
      document.addEventListener('visibilitychange', wake);
      wake();
    },
    setTheme(theme) {
      earth.theme = theme === 'light' ? 'light' : 'dark';
      earth.staticKey = '';
      wake();
    },
    setReducedMotion(reduced) {
      earth.reduced = reduced;
      wake();
    },
    /** Rows gave way: the worms nearby flinch back into their burrows. */
    startle() {
      earth.startle = performance.now() / 1000;
    },
    /** Redraws the earth when the well changes (a new shift with another shape, another size). */
    refresh(game, cs) {
      if (game && cs) {
        let signature = `${cs}:`;
        for (let y = 0; y < game.height; y++) {
          for (let x = 0; x < game.width; x++) signature += game.board[y][x].type === 'rock' ? '1' : '0';
        }
        earth.wellInfo = { board: game.board, cols: game.width, rows: game.height, cs, signature };
      }
      earth.staticKey = '';
      wake();
    },
  };
})();
