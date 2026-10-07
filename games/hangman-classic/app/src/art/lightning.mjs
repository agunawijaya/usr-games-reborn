// High-voltage streamers from the Tesla coil's toroid: branching bolts drawn afresh a dozen times a
// second while the laboratory is on screen. Each bolt lives for one or two draws, as real
// streamers do; between draws the corona at the toroid keeps glowing.

import { TESLA_TOROID } from './lab.mjs';

const DRAW_EVERY_MS = 75;

/** A jagged line from `a` to `b` by midpoint displacement; `rough` is the share of the length. */
function jagged(a, b, rough, depth, rand) {
  if (depth === 0) return [a, b];
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = -(b[1] - a[1]) / (len || 1);
  const ny = (b[0] - a[0]) / (len || 1);
  const shift = (rand() - 0.5) * len * rough;
  const mid = [mx + nx * shift, my + ny * shift];
  return [...jagged(a, mid, rough, depth - 1, rand).slice(0, -1), ...jagged(mid, b, rough, depth - 1, rand)];
}

const line = (points) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** One streamer and its forks, in three strokes: wide haze, violet body, white core. */
function streamer(start, angle, length, unit, rand) {
  const end = [start[0] + Math.cos(angle) * length, start[1] + Math.sin(angle) * length];
  const trunk = jagged(start, end, 0.55, 5, rand);
  const paths = [{ points: trunk, weight: 1 }];
  const forks = 1 + Math.floor(rand() * 3);
  for (let f = 0; f < forks; f++) {
    const from = trunk[2 + Math.floor(rand() * (trunk.length - 4))];
    const turn = angle + (rand() - 0.5) * 1.6;
    const reach = length * (0.25 + rand() * 0.35);
    const tip = [from[0] + Math.cos(turn) * reach, from[1] + Math.sin(turn) * reach];
    paths.push({ points: jagged(from, tip, 0.6, 4, rand), weight: 0.55 });
  }
  return paths
    .map(({ points, weight }) => {
      const d = line(points);
      return `<path d="${d}" stroke="#8affd8" stroke-width="${(7 * unit * weight).toFixed(1)}" opacity="0.22"/>
        <path d="${d}" stroke="#cbbcff" stroke-width="${(3 * unit * weight).toFixed(1)}" opacity="0.85"/>
        <path d="${d}" stroke="#ffffff" stroke-width="${(1.3 * unit * weight).toFixed(1)}"/>`;
    })
    .join('');
}

/**
 * Starts the streamers over `layer` (an <svg> covering `scene`), springing from the toroid of the
 * coil drawn in `coil`. Returns a switch the page uses for pause and reduced motion.
 */
export function startArcs({ scene, coil, layer, rand = Math.random }) {
  if (!scene || !coil || !layer) return { setRunning() {} };
  let running = false;
  let frame = 0;
  let last = 0;

  function toroid() {
    const stage = scene.getBoundingClientRect();
    const box = coil.getBoundingClientRect();
    // The coil is drawn in a 200 × 450 box, fitted (meet) and sat on the floor (YMax).
    const scale = Math.min(box.width / 200, box.height / 450);
    const left = box.left + (box.width - 200 * scale) / 2 - stage.left;
    const top = box.top + box.height - 450 * scale - stage.top;
    return {
      cx: left + TESLA_TOROID.x * scale,
      cy: top + TESLA_TOROID.y * scale,
      rx: TESLA_TOROID.rx * scale,
      ry: TESLA_TOROID.ry * scale,
      unit: Math.max(0.6, scale),
      width: stage.width,
      height: stage.height,
    };
  }

  function draw() {
    if (!scene.classList.contains('active')) {
      layer.innerHTML = '';
      return;
    }
    const t = toroid();
    layer.setAttribute('viewBox', `0 0 ${t.width.toFixed(0)} ${t.height.toFixed(0)}`);
    const bolts = 1 + Math.floor(rand() * 3);
    let markup = '';
    for (let i = 0; i < bolts; i++) {
      // Mostly up and outward, now and then down towards the floor or the bench.
      const down = rand() < 0.2;
      const angle = down ? Math.PI * (0.15 + rand() * 0.7) : -Math.PI * (0.05 + rand() * 0.9);
      const start = [t.cx + Math.cos(angle) * t.rx, t.cy + Math.sin(angle) * t.ry];
      const length = t.rx * (0.9 + rand() * 1.6);
      markup += streamer(start, angle, length, t.unit, rand);
    }
    const flare = (0.35 + rand() * 0.4).toFixed(2);
    layer.innerHTML = `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${markup}</g>
      <ellipse cx="${t.cx.toFixed(1)}" cy="${t.cy.toFixed(1)}" rx="${(t.rx * 1.25).toFixed(1)}" ry="${(t.ry * 2.2).toFixed(1)}" fill="#cbbcff" opacity="${flare}" style="filter: blur(${(10 * t.unit).toFixed(1)}px)"/>`;
  }

  function tick(now) {
    if (!running) return;
    frame = requestAnimationFrame(tick);
    if (now - last < DRAW_EVERY_MS) return;
    last = now;
    draw();
  }

  return {
    setRunning(on) {
      if (on === running) return;
      running = on;
      if (on) frame = requestAnimationFrame(tick);
      else {
        cancelAnimationFrame(frame);
        layer.innerHTML = '';
      }
    },
  };
}
