import type { Rng } from '@usr-games/kit';
import { type Board, indexOf, inside } from '../engine/board';
import type { Cell, Dir } from '../engine/geometry';
import type { Layout } from './layout';
import { withAlpha } from './fruit';
import type { Look } from './look';

/**
 * What lies in the bed besides the noodle and the fruit: rocks, roots, mud, tunnel mouths and
 * soil that flows one way. Painted into the backdrop, since none of it moves.
 */

const PAIR_COLOURS = ['#ffd166', '#7ef9d3', '#ff8fab', '#b39bff'];

export function paintTerrain(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  board: Board,
  random: Rng,
): void {
  const mud: Cell[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++)
      if (board.terrain[y * board.width + x] === 'mud') mud.push({ x, y });
  }
  // A puddle on the edge row stays inside the box rather than spilling over its rim.
  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.left, layout.top, layout.cols * layout.cell, layout.rows * layout.cell);
  ctx.clip();
  paintMudPatch(ctx, layout, look, mud, random);
  ctx.restore();
  paintRootNetwork(ctx, layout, look, board, random);
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const index = y * board.width + x;
      const t = board.terrain[index];
      if (t === 'rock') paintRock(ctx, layout, look, { x, y }, random);
      if (t === 'flow') paintFlow(ctx, layout, look, { x, y }, board.flow.get(index)!);
    }
  }
  [...board.tunnels.entries()].forEach(([letter, mouths], i) => {
    for (const mouth of mouths)
      paintTunnel(ctx, layout, look, mouth, letter, PAIR_COLOURS[i % PAIR_COLOURS.length]!);
  });
}

/** One tunnel mouth drawn again over the noodle, so the part of the body inside it is hidden. */
export function paintTunnelMouth(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  board: Board,
  cell: Cell,
): void {
  [...board.tunnels.entries()].forEach(([letter, mouths], i) => {
    for (const mouth of mouths) {
      if (mouth.x === cell.x && mouth.y === cell.y)
        paintTunnel(ctx, layout, look, mouth, letter, PAIR_COLOURS[i % PAIR_COLOURS.length]!);
    }
  });
}

/** A cell of the same root group that touches the edge of the box, top edge first. */
function edgeCellOf(board: Board, seed: Cell, isRoot: (c: Cell) => boolean): Cell | null {
  const group: Cell[] = [];
  const seen = new Set([`${seed.x},${seed.y}`]);
  const queue = [seed];
  while (queue.length > 0) {
    const c = queue.pop()!;
    group.push(c);
    for (const n of [
      { x: c.x + 1, y: c.y },
      { x: c.x - 1, y: c.y },
      { x: c.x, y: c.y + 1 },
      { x: c.x, y: c.y - 1 },
    ]) {
      const k = `${n.x},${n.y}`;
      if (!seen.has(k) && isRoot(n)) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  const onEdge = (c: Cell) =>
    c.y === 0 || c.y === board.height - 1 || c.x === 0 || c.x === board.width - 1;
  return (
    group.find((c) => c.y === 0) ??
    group.find((c) => c.y === board.height - 1) ??
    group.find(onEdge) ??
    null
  );
}

/** Where a root at the edge of the box disappears under the rim, or null if it is not at one. */
function rimPoint(
  layout: Layout,
  board: Board,
  cell: Cell,
  at: { x: number; y: number },
): { x: number; y: number } | null {
  const out = layout.cell * 0.15;
  if (cell.y === 0) return { x: at.x, y: layout.top - out };
  if (cell.y === board.height - 1)
    return { x: at.x, y: layout.top + board.height * layout.cell + out };
  if (cell.x === 0) return { x: layout.left - out, y: at.y };
  if (cell.x === board.width - 1)
    return { x: layout.left + board.width * layout.cell + out, y: at.y };
  return null;
}

/**
 * A root cell the noodle has chewed open: bare soil where the braid was, two frayed ends where it
 * was bitten off, and a few crumbs. Painted over the backdrop, which keeps the whole root.
 */
export function paintChewedRoot(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  cell: Cell,
): void {
  const { x, y } = cellCentre(layout, cell);
  const size = layout.cell;
  ctx.save();
  const soil = ctx.createRadialGradient(x, y, size * 0.2, x, y, size * 0.62);
  soil.addColorStop(0, look.bed);
  soil.addColorStop(0.7, look.bed);
  soil.addColorStop(1, withAlpha(look.bed, 0));
  ctx.fillStyle = soil;
  ctx.fillRect(x - size * 0.65, y - size * 0.65, size * 1.3, size * 1.3);
  // Frayed ends: short splinters pointing into the gap from each side.
  ctx.strokeStyle = look.rootColour;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.beginPath();
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const) {
    for (let k = -1; k <= 1; k++) {
      const sx = x + dx * size * 0.5 + dy * k * size * 0.08;
      const sy = y + dy * size * 0.5 + dx * k * size * 0.08;
      ctx.moveTo(sx, sy);
      ctx.lineTo(
        sx - dx * size * (0.12 + Math.abs(k) * 0.04),
        sy - dy * size * (0.12 + Math.abs(k) * 0.04),
      );
    }
  }
  ctx.globalAlpha = 0.55;
  ctx.stroke();
  // Crumbs.
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = look.rootShade;
  for (const [cx, cy, r] of [
    [-0.18, 0.12, 0.035],
    [0.14, -0.08, 0.03],
    [0.05, 0.2, 0.025],
    [-0.08, -0.17, 0.025],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + cx * size, y + cy * size, r * size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function cellCentre(layout: Layout, cell: Cell): { x: number; y: number } {
  return {
    x: layout.left + (cell.x + 0.5) * layout.cell,
    y: layout.top + (cell.y + 0.5) * layout.cell,
  };
}

function paintRock(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  cell: Cell,
  random: Rng,
): void {
  const { x, y } = cellCentre(layout, cell);
  const r = layout.cell * 0.52;
  const points = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2;
    const k = random.float(0.8, 1.04);
    return { x: x + Math.cos(a) * r * k, y: y + Math.sin(a) * r * k * 0.92 };
  });
  const shape = () => {
    ctx.beginPath();
    points.forEach((p, i) => {
      const next = points[(i + 1) % points.length]!;
      const mid = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
      if (i === 0) ctx.moveTo(mid.x, mid.y);
      else ctx.quadraticCurveTo(p.x, p.y, mid.x, mid.y);
    });
    const first = points[0]!;
    const second = points[1]!;
    ctx.quadraticCurveTo(first.x, first.y, (first.x + second.x) / 2, (first.y + second.y) / 2);
    ctx.closePath();
  };
  ctx.fillStyle = look.rockShade;
  ctx.save();
  ctx.translate(0, layout.cell * 0.06);
  shape();
  ctx.fill();
  ctx.restore();
  const fill = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  fill.addColorStop(0, look.rockLight);
  fill.addColorStop(0.55, look.rock);
  fill.addColorStop(1, look.rockShade);
  ctx.fillStyle = fill;
  shape();
  ctx.fill();
  ctx.strokeStyle = look.rockShade;
  ctx.lineWidth = Math.max(1.5, layout.cell * 0.045);
  shape();
  ctx.stroke();
  // Moss by day, glowing lichen by night.
  ctx.fillStyle = look.dark ? '#7ef9d3' : '#6fae3f';
  ctx.globalAlpha = look.dark ? 0.7 : 0.85;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(
      x + random.float(-0.45, 0.2) * r,
      y - r * random.float(0.55, 0.75),
      r * random.float(0.06, 0.11),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.lineWidth = layout.dpr * 1.2;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.2, y - r * 0.1);
  ctx.lineTo(x + r * 0.05, y + r * 0.18);
  ctx.lineTo(x + r * 0.32, y + r * 0.12);
  ctx.stroke();
}

/**
 * Root cells drawn as little root trees: each group grows from its highest cell (from the bed's
 * edge when it touches the top), through the others, thinner the further it goes; the line
 * wanders a little inside each cell so no root bends at a right angle.
 */
function paintRootNetwork(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  board: Board,
  random: Rng,
): void {
  const isRoot = (c: Cell) => inside(board, c) && board.terrain[indexOf(board, c)] === 'root';
  const { cell, dpr } = layout;
  const key = (c: Cell) => c.y * board.width + c.x;
  const jitter = new Map<number, { x: number; y: number }>();
  const pointOf = (c: Cell) => {
    const k = key(c);
    if (!jitter.has(k)) {
      const p = cellCentre(layout, c);
      jitter.set(k, {
        x: p.x + random.float(-0.16, 0.16) * cell,
        y: p.y + random.float(-0.12, 0.12) * cell,
      });
    }
    return jitter.get(k)!;
  };
  const depth = new Map<number, number>();
  const segments: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    depth: number;
  }[] = [];
  const tips: { at: { x: number; y: number }; depth: number }[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const seed = { x, y };
      if (!isRoot(seed) || depth.has(key(seed))) continue;
      // A new group, grown breadth-first from where it meets the edge of the box (or, for a
      // root lying loose in the bed, from its highest cell). Its stub runs out under the rim.
      const anchor = edgeCellOf(board, seed, isRoot) ?? seed;
      if (depth.has(key(anchor))) continue;
      depth.set(key(anchor), 0);
      const stub = rimPoint(layout, board, anchor, pointOf(anchor));
      if (stub) segments.push({ from: stub, to: pointOf(anchor), depth: 0 });
      const queue: Cell[] = [anchor];
      while (queue.length > 0) {
        const c = queue.shift()!;
        const d = depth.get(key(c))!;
        let children = 0;
        for (const n of [
          { x: c.x, y: c.y + 1 },
          { x: c.x + 1, y: c.y },
          { x: c.x - 1, y: c.y },
          { x: c.x, y: c.y - 1 },
        ]) {
          if (!isRoot(n) || depth.has(key(n))) continue;
          depth.set(key(n), d + 1);
          segments.push({ from: pointOf(c), to: pointOf(n), depth: d + 1 });
          queue.push(n);
          children++;
        }
        if (children === 0) tips.push({ at: pointOf(c), depth: d });
      }
    }
  }
  // Each root is a braid of a few thin strands twisting round each other: plainly a root, and
  // plainly in the way, and nothing like the noodle's smooth body.
  const strands = 4;
  const strandWidth = (d: number) => cell * Math.max(0.07, 0.12 - d * 0.012);
  const spread = (d: number) => cell * Math.max(0.12, 0.22 - d * 0.025);
  const braid = (seg: (typeof segments)[number], k: number, offsetScale = 1) => {
    const dx = seg.to.x - seg.from.x;
    const dy = seg.to.y - seg.from.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const steps = 10;
    const phase = (k / strands) * Math.PI * 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const wave =
        Math.sin(t * Math.PI * 2 + phase + seg.depth * 1.3) * spread(seg.depth) * offsetScale;
      const x = seg.from.x + dx * t + nx * wave;
      const y = seg.from.y + dy * t + ny * wave;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const pass of ['shade', 'wood'] as const) {
    for (let k = 0; k < strands; k++) {
      ctx.strokeStyle =
        pass === 'shade' ? look.rootShade : k % 2 === 0 ? look.rootColour : mixRoot(look);
      ctx.beginPath();
      for (const seg of segments) {
        ctx.lineWidth = strandWidth(seg.depth) + (pass === 'shade' ? dpr * 2.4 : 0);
        braid(seg, k);
      }
      ctx.stroke();
    }
  }
  // Fine hairs at the tips, where a root ends in the soil, and a few along the way.
  ctx.strokeStyle = look.rootColour;
  ctx.lineWidth = Math.max(1, dpr * 1.2);
  const hairs = [
    ...tips.map((t) => ({ at: t.at, n: 5 })),
    ...segments.filter(() => random.chance(0.5)).map((seg) => ({ at: seg.to, n: 2 })),
  ];
  for (const hair of hairs) {
    for (let i = 0; i < hair.n; i++) {
      const a = random.float(0, Math.PI * 2);
      const r0 = cell * 0.12;
      const r1 = r0 + random.float(0.2, 0.4) * cell;
      ctx.beginPath();
      ctx.moveTo(hair.at.x + Math.cos(a) * r0, hair.at.y + Math.sin(a) * r0);
      ctx.quadraticCurveTo(
        hair.at.x + Math.cos(a + 0.4) * r1 * 0.6,
        hair.at.y + Math.sin(a + 0.4) * r1 * 0.6,
        hair.at.x + Math.cos(a + 0.2) * r1,
        hair.at.y + Math.sin(a + 0.2) * r1,
      );
      ctx.stroke();
    }
  }
}

/** A second wood tone for alternate strands, so the braid reads as twisted. */
function mixRoot(look: Look): string {
  return look.dark ? '#5d4a73' : '#cfa874';
}

/**
 * Mud cells merge into one soft, organic puddle: a round dab on every cell and another between
 * every pair of neighbours, so the edge flows instead of scalloping. One reflection across the
 * whole surface, a couple of bubbles and a few splashes on the soil around it.
 */
function paintMudPatch(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  cells: readonly Cell[],
  random: Rng,
): void {
  if (cells.length === 0) return;
  const { cell } = layout;
  const isMud = new Set(cells.map((c) => `${c.x},${c.y}`));
  const dabs: { x: number; y: number; r: number }[] = [];
  for (const c of cells) {
    const { x, y } = cellCentre(layout, c);
    dabs.push({ x, y, r: cell * random.float(0.56, 0.62) });
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ] as const) {
      if (!isMud.has(`${c.x + dx},${c.y + dy}`)) continue;
      dabs.push({ x: x + (dx * cell) / 2, y: y + (dy * cell) / 2, r: cell * 0.55 });
    }
    // Fill the middle of any two-by-two block, so it does not dimple.
    if (
      isMud.has(`${c.x + 1},${c.y}`) &&
      isMud.has(`${c.x},${c.y + 1}`) &&
      isMud.has(`${c.x + 1},${c.y + 1}`)
    )
      dabs.push({ x: x + cell / 2, y: y + cell / 2, r: cell * 0.6 });
  }
  const puddle = (grow: number, dy = 0) => {
    ctx.beginPath();
    for (const d of dabs) {
      const r = d.r + grow;
      ctx.moveTo(d.x + r, d.y + dy);
      ctx.ellipse(d.x, d.y + dy, r, r * 0.9, 0, 0, Math.PI * 2);
    }
  };
  const xs = cells.map((c) => c.x);
  const box = {
    left: layout.left + Math.min(...xs) * cell,
    top: layout.top + Math.min(...cells.map((c) => c.y)) * cell,
    width: (Math.max(...xs) - Math.min(...xs) + 1) * cell,
  };

  // Splashes on the soil round the edge.
  ctx.fillStyle = look.mud;
  for (let i = 0; i < Math.min(6, cells.length + 2); i++) {
    const c = cells[random.int(0, cells.length - 1)]!;
    const { x, y } = cellCentre(layout, c);
    const a = random.float(0, Math.PI * 2);
    const d = cell * random.float(0.7, 0.85);
    ctx.beginPath();
    ctx.arc(
      x + Math.cos(a) * d,
      y + Math.sin(a) * d * 0.9,
      cell * random.float(0.04, 0.07),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.fillStyle = look.dark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(60, 30, 10, 0.2)';
  puddle(0, cell * 0.05);
  ctx.fill();
  ctx.fillStyle = look.mud;
  puddle(0);
  ctx.fill();
  ctx.save();
  puddle(0);
  ctx.clip();
  // Wetter and darker towards the middle.
  ctx.fillStyle = look.dark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(40, 20, 8, 0.16)';
  puddle(-cell * 0.16, cell * 0.04);
  ctx.fill();
  // One reflection laid across the whole surface, the way a puddle mirrors the sky.
  const streak = Math.min(box.width * 0.3, cell * 1.1);
  ctx.fillStyle = look.mudShine;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(
    box.left + box.width * 0.4,
    box.top + cell * 0.24,
    streak,
    cell * 0.05,
    -0.06,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(
    box.left + box.width * 0.4 + streak * 1.25,
    box.top + cell * 0.22,
    cell * 0.1,
    cell * 0.04,
    -0.06,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.globalAlpha = 1;
  // A couple of bubbles rising through it.
  ctx.strokeStyle = look.mudShine;
  ctx.lineWidth = Math.max(1, layout.dpr * 1.2);
  const bubbles = Math.min(3, Math.ceil(cells.length / 2));
  for (let i = 0; i < bubbles; i++) {
    const c = cells[random.int(0, cells.length - 1)]!;
    const { x, y } = cellCentre(layout, c);
    ctx.beginPath();
    ctx.arc(
      x + random.float(-0.2, 0.2) * cell,
      y + random.float(0.05, 0.25) * cell,
      random.float(0.05, 0.08) * cell,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function paintTunnel(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  cell: Cell,
  letter: string,
  colour: string,
): void {
  const { x, y } = cellCentre(layout, cell);
  const r = layout.cell * 0.42;
  const hole = ctx.createRadialGradient(x, y + r * 0.1, r * 0.1, x, y, r);
  hole.addColorStop(0, look.tunnel);
  hole.addColorStop(0.75, look.tunnel);
  hole.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.86, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  if (look.dark) {
    ctx.shadowColor = colour;
    ctx.shadowBlur = layout.cell * 0.4;
  }
  ctx.strokeStyle = colour;
  ctx.lineWidth = layout.cell * 0.08;
  ctx.setLineDash([layout.cell * 0.14, layout.cell * 0.09]);
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.86, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = colour;
  ctx.font = `700 ${Math.round(layout.cell * 0.32)}px "Atkinson Hyperlegible Next", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, x, y + layout.cell * 0.02);
}

function paintFlow(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  cell: Cell,
  dir: Dir,
): void {
  const { x, y } = cellCentre(layout, cell);
  const angle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = look.flow;
  ctx.lineWidth = layout.cell * 0.07;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const offset of [-0.18, 0.12]) {
    ctx.beginPath();
    ctx.moveTo((offset - 0.1) * layout.cell, -0.16 * layout.cell);
    ctx.lineTo(offset * layout.cell + 0.06 * layout.cell, 0);
    ctx.lineTo((offset - 0.1) * layout.cell, 0.16 * layout.cell);
    ctx.stroke();
  }
  ctx.restore();
}
