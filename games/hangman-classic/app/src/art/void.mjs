import { blur, brushes, f1, grain, linear, paint, radial, seeded, svg } from './kit.mjs';

/**
 * The Void Vessel: deep space with a nebula, a sun and a blue planet seen through the bridge
 * window; the bridge itself (its window left open, its life-support monitors live), two
 * stations, a spaceplane and an astronaut drifting past.
 */

const S = {
  ink: '#05080c',
  hull: '#e8ecf0',
  hullLo: '#8a96a4',
  hullDeep: '#3a4450',
  panel: '#1f3a8a',
  panelHi: '#5a8aff',
  gold: '#e8b84a',
  mint: '#8affd8',
  steel: '#1c2228',
  steelHi: '#4a5a66',
  steelLo: '#0a0d10',
};

/** Deep space, 1600 × 900: nebula, stars, a sun with its flare, and a blue planet. */
export function spaceBackdrop({ id = 'sb' } = {}) {
  const p = id;
  const rand = seeded(71);
  const stars = Array.from({ length: 420 }, () => {
    const x = rand() * 1600;
    const y = rand() * 900;
    const r = rand() < 0.92 ? 0.4 + rand() * 0.9 : 1.2 + rand() * 1.2;
    const tone = ['#ffffff', '#cfe4ff', '#fff2d8', '#d8e8ff'][Math.floor(rand() * 4)];
    return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${tone}" opacity="${f1(0.45 + rand() * 0.55)}"/>`;
  }).join('');
  const bright = Array.from({ length: 14 }, () => {
    const x = rand() * 1600;
    const y = rand() * 900;
    const s = 4 + rand() * 6;
    return `<g opacity="${f1(0.6 + rand() * 0.4)}"><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s * 0.5)}" fill="#ffffff" filter="url(#${p}-b2)"/><path d="M${f1(x - s * 2)},${f1(y)} L${f1(x + s * 2)},${f1(y)} M${f1(x)},${f1(y - s * 2)} L${f1(x)},${f1(y + s * 2)}" stroke="#e8f2ff" stroke-width="0.8"/></g>`;
  }).join('');
  const nebula = [
    [520, 520, 520, 220, '#3a2a8a', 0.55],
    [1100, 380, 480, 260, '#1a5a9a', 0.5],
    [900, 640, 420, 180, '#6a2a7a', 0.4],
    [300, 260, 380, 200, '#1a3a7a', 0.45],
    [1300, 700, 360, 200, '#2a7a8a', 0.35],
  ]
    .map(([cx, cy, rx, ry, c, o]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" opacity="${o}" filter="url(#${p}-cloud)" transform="rotate(${f1(-20 + rand() * 40)} ${cx} ${cy})"/>`)
    .join('');
  const clouds = Array.from({ length: 9 }, (_, i) => {
    const y = 230 + i * 24 + rand() * 10;
    const w = 90 + rand() * 120;
    const x = 690 + rand() * 120;
    return `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(w)}" ry="${f1(6 + rand() * 8)}" fill="#ffffff" opacity="${f1(0.35 + rand() * 0.3)}" filter="url(#${p}-b4)"/>`;
  }).join('');
  const body = `<defs>${brushes(p)}
      ${blur(`${p}-cloud`, 60)}
      ${blur(`${p}-glare`, 24)}
      ${radial(`${p}-space`, [[0, '#0e1a3a'], [0.6, '#060b1c'], [1, '#02030a']], { cx: 0.45, cy: 0.45, r: 0.8 })}
      ${radial(`${p}-sun`, [[0, '#ffffff'], [0.1, '#fff4c8'], [0.3, '#ffb84a', 0.6], [1, '#ff7a1a', 0]])}
      ${radial(`${p}-ocean`, [[0, '#7ac8ff'], [0.45, '#2a6ac8'], [0.85, '#0c2a6a'], [1, '#061436']], { cx: 0.3, cy: 0.3, r: 0.9 })}
      ${radial(`${p}-night`, [[0, '#000', 0], [0.55, '#000', 0], [0.85, '#000', 0.75], [1, '#000', 0.9]], { cx: 0.25, cy: 0.25, r: 1 })}
      ${radial(`${p}-atmo`, [[0.86, '#5ac8ff', 0], [0.93, '#8ae0ff', 0.7], [1, '#5ac8ff', 0]])}
      <clipPath id="${p}-planet"><circle cx="780" cy="330" r="150"/></clipPath>
    </defs>
    <rect width="1600" height="900" fill="url(#${p}-space)"/>
    ${nebula}
    ${stars}${bright}
    <circle cx="520" cy="180" r="260" fill="url(#${p}-sun)" opacity="0.55"/>
    <circle cx="520" cy="180" r="70" fill="url(#${p}-sun)"/>
    <path d="M300,180 L740,180 M520,40 L520,320" stroke="#fff4d8" stroke-width="2" opacity="0.5" filter="url(#${p}-b2)"/>
    <ellipse cx="520" cy="180" rx="180" ry="6" fill="#ffe8b0" opacity="0.6" filter="url(#${p}-b4)"/>
    ${[[600, 220, 14, '#ffb84a'], [660, 252, 8, '#8ae0ff'], [720, 280, 22, '#ff8a4a']].map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="2" opacity="0.4"/>`).join('')}
    <circle cx="780" cy="330" r="164" fill="url(#${p}-atmo)"/>
    <circle cx="780" cy="330" r="150" fill="url(#${p}-ocean)"/>
    <g clip-path="url(#${p}-planet)">
      <path d="M660,260 C700,240 740,250 760,280 C780,300 760,330 720,330 C690,330 660,300 660,260 Z M800,360 C840,340 880,360 890,400 C870,430 820,430 800,400 Z" fill="#3a8a5a" opacity="0.6" filter="url(#${p}-b4)"/>
      ${clouds}
      <circle cx="780" cy="330" r="150" fill="url(#${p}-night)"/>
    </g>
    <circle cx="780" cy="330" r="150" fill="none" stroke="#bfefff" stroke-width="2" opacity="0.5"/>`;
  return svg('0 0 1600 900', body, { ratio: 'xMidYMid slice' });
}

const MONO = `'JetBrains Mono', ui-monospace, Consolas, monospace`;

/**
 * The four gases the bridge's life-support monitors watch, and what they read after each miss:
 * the oxygen thins as the scrubbers fail and the cabin fills with carbon dioxide, ammonia from
 * the coolant loop and hydrogen sulphide from the waste plant. `warn` and `crit` are where a
 * reading turns amber and red; oxygen is the one that falls.
 */
export const GASES = [
  { key: 'o2', formula: 'O', sub: '2', name: 'OXYGEN', unit: '%', readings: [20.9, 19.5, 18.0, 16.2, 14.1, 11.8, 9.0], warn: 19.5, crit: 16, falling: true },
  { key: 'co2', formula: 'CO', sub: '2', name: 'CARBON DIOXIDE', unit: 'ppm', readings: [600, 2400, 5000, 9000, 15000, 24000, 40000], warn: 5000, crit: 10000 },
  { key: 'nh3', formula: 'NH', sub: '3', name: 'AMMONIA', unit: 'ppm', readings: [0, 4, 12, 25, 50, 110, 300], warn: 10, crit: 35 },
  { key: 'h2s', formula: 'H', sub: '2', tail: 'S', name: 'HYDROGEN SULPHIDE', unit: 'ppm', readings: [0, 2, 6, 12, 30, 60, 100], warn: 5, crit: 20 },
];

const STATUS = { ok: 'NOMINAL', warn: 'CAUTION', crit: 'DANGER' };
const SEVERITY = ['ok', 'warn', 'crit'];

/** Each monitor's screen, in the bridge's 1600 × 900 drawing. */
const MONITOR = { x: 417, y: 694, w: 184, h: 130, gap: 10 };
const CHART = { left: 12, right: 12, top: 86, bottom: 112 };

function levelOf(gas, value) {
  if (gas.falling) return value >= gas.warn ? 'ok' : value >= gas.crit ? 'warn' : 'crit';
  return value < gas.warn ? 'ok' : value < gas.crit ? 'warn' : 'crit';
}

/** How high on its chart a reading sits (0 top, 1 bottom); ppm on a square-root scale. */
function chartHeight(gas, value) {
  if (gas.falling) return (22 - value) / 14;
  return 1 - Math.sqrt(value / gas.readings[gas.readings.length - 1]);
}

/** What a gas's monitor shows after `misses` misses, in the monitor's own coordinates. */
function reading(gas, misses) {
  const value = gas.readings[misses];
  const width = MONITOR.w - CHART.left - CHART.right;
  const point = (v, i) => [CHART.left + (width * i) / 6, CHART.top + (CHART.bottom - CHART.top) * chartHeight(gas, v)];
  const trend = gas.readings.slice(0, misses + 1).map(point);
  return {
    text: gas.falling ? value.toFixed(1) : value.toLocaleString('en-US'),
    level: levelOf(gas, value),
    trend: trend.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' '),
    now: trend[trend.length - 1],
    bar: gas.falling ? value / 20.9 : Math.max(0.02, chartHeight(gas, 0) - chartHeight(gas, value)),
  };
}

/** Sets the bridge's monitors (inside `root`) to their readings after `misses` misses. */
export function showGasLevels(root, misses) {
  if (!root) return;
  const m = Math.max(0, Math.min(6, misses));
  let worst = 0;
  for (const gas of GASES) {
    const monitor = root.querySelector(`[data-gas="${gas.key}"]`);
    if (!monitor) continue;
    const r = reading(gas, m);
    worst = Math.max(worst, SEVERITY.indexOf(r.level));
    monitor.setAttribute('data-level', r.level);
    monitor.querySelector('[data-part="value"]').textContent = r.text;
    monitor.querySelector('[data-part="status"]').textContent = STATUS[r.level];
    monitor.querySelector('[data-part="trend"]').setAttribute('points', r.trend);
    const now = monitor.querySelector('[data-part="now"]');
    now.setAttribute('cx', f1(r.now[0]));
    now.setAttribute('cy', f1(r.now[1]));
    monitor.querySelector('[data-part="bar"]').setAttribute('width', f1((MONITOR.w - 24) * r.bar));
  }
  root.querySelector('[data-part="master"]')?.setAttribute('data-level', SEVERITY[worst]);
}

/** One life-support monitor: bezel, screen, formula, reading, status, trend and level bar. */
function gasMonitor(p, gas, index) {
  const x = MONITOR.x + index * (MONITOR.w + MONITOR.gap);
  const { y, w, h } = MONITOR;
  const r = reading(gas, 0);
  const warnLine = CHART.top + (CHART.bottom - CHART.top) * chartHeight(gas, gas.warn);
  const grid = [0, 1, 2, 3, 4, 5, 6]
    .map((i) => `<path d="M${f1(CHART.left + ((w - 24) * i) / 6)},${CHART.top} V${CHART.bottom}" stroke="#7affd8" stroke-width="0.6" opacity="0.18"/>`)
    .join('');
  const formula = `${gas.formula}<tspan font-size="12" dy="5">${gas.sub}</tspan>${gas.tail ? `<tspan font-size="19" dy="-5">${gas.tail}</tspan>` : ''}`;
  return `<g class="${p}-gas" data-gas="${gas.key}" data-level="${r.level}" transform="translate(${x} ${y})">
    <rect x="-7" y="-7" width="${w + 14}" height="${h + 14}" rx="9" fill="url(#${p}-bezel)" stroke="#000" stroke-width="2"/>
    <rect x="-2.5" y="-2.5" width="${w + 5}" height="${h + 5}" rx="5" fill="none" stroke="#56636e" stroke-width="1" opacity="0.7"/>
    <rect class="${p}-screen" width="${w}" height="${h}" rx="4"/>
    <rect width="${w}" height="${h}" rx="4" fill="url(#${p}-screenGlow)" class="${p}-wash"/>
    <text x="12" y="25" font-family="${MONO}" font-size="19" font-weight="700" class="${p}-tone">${formula}</text>
    <text x="12" y="41" font-family="${MONO}" font-size="8.5" letter-spacing="1.2" fill="#b8d8d0" opacity="0.75">${gas.name}</text>
    <g class="${p}-pill">
      <rect x="${w - 76}" y="9" width="66" height="17" rx="8.5" class="${p}-toneFill" opacity="0.2"/>
      <rect x="${w - 76}" y="9" width="66" height="17" rx="8.5" fill="none" class="${p}-toneStroke" stroke-width="1.2"/>
      <text data-part="status" x="${w - 43}" y="21" text-anchor="middle" font-family="${MONO}" font-size="9.5" font-weight="700" letter-spacing="0.8" class="${p}-tone">${STATUS[r.level]}</text>
    </g>
    <text data-part="value" x="12" y="78" font-family="${MONO}" font-size="31" font-weight="700" class="${p}-tone ${p}-figure">${r.text}</text>
    <text x="${w - 12}" y="78" text-anchor="end" font-family="${MONO}" font-size="11" fill="#b8d8d0" opacity="0.85">${gas.unit}</text>
    ${grid}
    <path d="M${CHART.left},${f1(warnLine)} H${w - CHART.right}" stroke="#ffc04a" stroke-width="1" stroke-dasharray="4 3" opacity="0.6"/>
    <polyline data-part="trend" points="${r.trend}" fill="none" class="${p}-toneStroke" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle data-part="now" cx="${f1(r.now[0])}" cy="${f1(r.now[1])}" r="3.4" class="${p}-toneFill"/>
    <rect x="12" y="${h - 11}" width="${w - 24}" height="4" rx="2" fill="#000" opacity="0.6"/>
    <rect data-part="bar" x="12" y="${h - 11}" width="${f1((w - 24) * r.bar)}" height="4" rx="2" class="${p}-toneFill"/>
    <path d="M4,4 L${w - 4},4 L${w - 4},${h * 0.32} C${w * 0.6},${h * 0.4} ${w * 0.3},${h * 0.36} 4,${h * 0.44} Z" fill="#ffffff" opacity="0.045"/>
  </g>`;
}

/** A small display with its bezel; `inner` is drawn in the screen's coordinates. */
function display(p, x, y, w, h, inner) {
  return `<g transform="translate(${x} ${y})">
    <rect x="-6" y="-6" width="${w + 12}" height="${h + 12}" rx="8" fill="url(#${p}-bezel)" stroke="#000" stroke-width="2"/>
    <rect width="${w}" height="${h}" rx="4" fill="#041318"/>
    <rect width="${w}" height="${h}" rx="4" fill="url(#${p}-screenGlow)"/>
    ${inner}
    <path d="M4,4 L${w - 4},4 L${w - 4},${h * 0.3} C${w * 0.6},${h * 0.38} ${w * 0.3},${h * 0.34} 4,${h * 0.42} Z" fill="#ffffff" opacity="0.045"/>
  </g>`;
}

/** The navigation display: the planet, the ship's orbit and the next burn. */
function navDisplay(w, h) {
  const cx = w * 0.5;
  const cy = h * 0.56;
  return `<text x="8" y="14" font-family="${MONO}" font-size="9" fill="#7affd8" letter-spacing="1">NAV · ORBIT</text>
    <circle cx="${cx}" cy="${cy}" r="16" fill="#1a5a9a" stroke="#7ac8ff" stroke-width="1"/>
    <ellipse cx="${cx}" cy="${cy}" rx="62" ry="30" fill="none" stroke="#7affd8" stroke-width="1.4" opacity="0.85"/>
    <ellipse cx="${cx + 8}" cy="${cy - 2}" rx="74" ry="38" fill="none" stroke="#ffc04a" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>
    <path d="M${cx + 58},${cy - 12} l8,4 l-8,4 z" fill="#ffffff"/>
    <circle cx="${cx - 60}" cy="${cy + 8}" r="3" fill="#ffc04a"/>
    <text x="8" y="${h - 8}" font-family="${MONO}" font-size="8" fill="#b8d8d0" opacity="0.8">AP 412 · PE 388</text>`;
}

/** The power display: reactor output and four bus loads. */
function powerDisplay(w, h, rand) {
  const bars = ['A', 'B', 'C', 'D']
    .map((bus, i) => {
      const load = 0.35 + rand() * 0.55;
      const by = 26 + i * 18;
      return `<text x="8" y="${by + 8}" font-family="${MONO}" font-size="8" fill="#b8d8d0">BUS ${bus}</text>
        <rect x="46" y="${by}" width="${w - 96}" height="9" rx="2" fill="#000" opacity="0.6"/>
        <rect x="46" y="${by}" width="${f1((w - 96) * load)}" height="9" rx="2" fill="${load > 0.8 ? '#ffc04a' : '#5ab8ff'}" opacity="0.9"/>
        <text x="${w - 8}" y="${by + 8}" text-anchor="end" font-family="${MONO}" font-size="8" fill="#7affd8">${Math.round(load * 100)}%</text>`;
    })
    .join('');
  return `<text x="8" y="14" font-family="${MONO}" font-size="9" fill="#7affd8" letter-spacing="1">PWR · REACTOR</text>${bars}`;
}

/** A row of toggle switches with their status lights, for the overhead panel. */
function switchRow(x0, y, count, spacing, rand) {
  return Array.from({ length: count }, (_, i) => {
    const x = x0 + i * spacing;
    const up = rand() < 0.7;
    const led = ['#5affd0', '#5affd0', '#5ab8ff', '#ffc04a', '#2a3038'][Math.floor(rand() * 5)];
    const guard = rand() < 0.12;
    return `<rect x="${f1(x - 7)}" y="${y}" width="14" height="20" rx="2" fill="#1a2026" stroke="#000" stroke-width="1"/>
      <path d="M${f1(x)},${y + 10} L${f1(x)},${up ? y + 2 : y + 18}" stroke="#c8d0d8" stroke-width="3.4" stroke-linecap="round"/>
      <circle cx="${f1(x)}" cy="${up ? y + 2 : y + 18}" r="2.4" fill="#e8eef4"/>
      <circle cx="${f1(x)}" cy="${y - 6}" r="2.2" fill="${led}"${led === '#2a3038' ? '' : ' opacity="0.95"'}/>
      ${guard ? `<path d="M${f1(x - 8)},${y + 21} L${f1(x - 8)},${y - 1} L${f1(x + 8)},${y - 1} L${f1(x + 8)},${y + 21}" fill="#c0281e" opacity="0.55" stroke="#5a0a06" stroke-width="1"/>` : ''}`;
  }).join('');
}

/** Backlit keys for the console, in a block of rows. */
function keyBlock(x0, y0, cols, rows, rand) {
  return Array.from({ length: cols * rows }, (_, i) => {
    const x = x0 + (i % cols) * 30;
    const y = y0 + Math.floor(i / cols) * 18;
    const lit = rand();
    const c = lit < 0.5 ? '#5affd0' : lit < 0.7 ? '#5ab8ff' : lit < 0.8 ? '#ffc04a' : '#2a343c';
    return `<rect x="${x}" y="${y}" width="24" height="12" rx="2.5" fill="#12181e" stroke="#000" stroke-width="1"/>
      <rect x="${x + 3}" y="${y + 3}" width="18" height="3" rx="1.5" fill="${c}"${c === '#2a343c' ? '' : ' opacity="0.9"'}/>`;
  }).join('');
}

/**
 * The bridge around the window, 1600 × 900, the window left open: a canopy split by two
 * pillars with a head-up display on the centre pane, an overhead switch panel, side displays,
 * the glare shield with its master caution and warning, the life-support monitors for the four
 * gases, navigation and power displays, the throttle pedestal and two pilot seats.
 */
export function bridge({ id = 'br' } = {}) {
  const p = id;
  const rand = seeded(83);
  const win = 'M232,318 C246,196 318,124 440,108 L1160,108 C1282,124 1354,196 1368,318 L1384,560 C1386,604 1360,628 1318,630 L282,630 C240,628 214,604 216,560 Z';
  const frame = `M0,0 L1600,0 L1600,900 L0,900 Z ${win}`;

  const pillar = (top, bottom, flip) => {
    const [t1, t2] = top;
    const [b1, b2] = bottom;
    const lit = flip ? t1 + 6 : t2 - 6;
    const litB = flip ? b1 + 8 : b2 - 8;
    return `<path d="M${t1},104 L${t2},104 L${b2},634 L${b1},634 Z" fill="url(#${p}-pillar)" stroke="#000" stroke-width="2"/>
      <path d="M${lit},110 L${litB},628" stroke="#7affd8" stroke-width="2" opacity="0.55"/>
      <path d="M${lit},110 L${litB},628" stroke="#7affd8" stroke-width="8" opacity="0.15" filter="url(#${p}-b4)"/>`;
  };

  const hud = `<g opacity="0.5" stroke="#8affd8" fill="none" stroke-width="1.6" font-family="${MONO}">
    <path d="M640,150 H960"/>
    ${Array.from({ length: 17 }, (_, i) => `<path d="M${640 + i * 20},150 v${i % 2 ? 6 : 12}"/>`).join('')}
    ${['330', '340', '350', '000', '010', '020', '030', '040', '050'].map((t, i) => `<text x="${640 + i * 40}" y="176" font-size="11" text-anchor="middle" fill="#8affd8" stroke="none">${t}</text>`).join('')}
    <path d="M800,140 l-6,-8 h12 z" fill="#8affd8" stroke="none"/>
    <path d="M700,300 H770 M830,300 H900 M700,300 v8 M900,300 v8"/>
    <path d="M700,470 H770 M830,470 H900 M700,470 v-8 M900,470 v-8" stroke-dasharray="10 6"/>
    <text x="684" y="304" font-size="10" text-anchor="end" fill="#8affd8" stroke="none">10</text>
    <text x="684" y="474" font-size="10" text-anchor="end" fill="#8affd8" stroke="none">-10</text>
    <circle cx="800" cy="385" r="10"/><path d="M776,385 H790 M810,385 H824 M800,375 V367"/>
    <path d="M676,240 V520 M934,240 V520"/>
    <rect x="622" y="372" width="44" height="22"/><text x="644" y="388" font-size="11" text-anchor="middle" fill="#8affd8" stroke="none">7.8</text>
    <rect x="934" y="372" width="52" height="22"/><text x="960" y="388" font-size="11" text-anchor="middle" fill="#8affd8" stroke="none">412</text>
  </g>`;

  const overhead = `${paint(p, 'overhead', 'M170,0 L1430,0 L1316,96 L284,96 Z', {
    fill: `url(#${p}-ceiling)`,
    ink: S.ink,
    strokes: [{ d: 'M290,90 L1310,90', c: '#000', w: 14, o: 0.6, b: 6 }],
  })}
    ${switchRow(360, 22, 12, 26, rand)}${switchRow(925, 22, 12, 26, rand)}
    ${switchRow(400, 58, 10, 26, rand)}${switchRow(965, 58, 10, 26, rand)}
    ${display(p, 700, 16, 200, 58, `<text x="8" y="14" font-family="${MONO}" font-size="9" fill="#7affd8" letter-spacing="1">COMMS · CH 4</text>
      <path d="M8,40 ${Array.from({ length: 24 }, (_, i) => `L${8 + i * 7.7},${f1(40 + Math.sin(i * 1.3) * (4 + (i % 5) * 2.4))}`).join(' ')}" stroke="#5ab8ff" stroke-width="1.4" fill="none"/>`)}
    <path d="M286,96 L1314,96" stroke="#7affd8" stroke-width="3" opacity="0.8"/>
    <path d="M286,98 L1314,98" stroke="#7affd8" stroke-width="12" opacity="0.25" filter="url(#${p}-b7)"/>`;

  const sideWall = (flip) => {
    const t = flip ? 'translate(1600 0) scale(-1 1)' : '';
    return `<g transform="${t}">
      ${paint(p, `wall${flip ? 'R' : 'L'}`, 'M0,0 L170,0 L284,96 L240,300 L226,560 L170,660 L0,760 Z', {
        fill: `url(#${p}-wall)`,
        ink: S.ink,
        strokes: [
          { d: 'M150,40 L232,300 L216,600', c: '#4a5a66', w: 6, o: 0.6, b: 2 },
          { d: 'M10,120 L10,700', c: '#000', w: 40, o: 0.5, b: 12 },
        ],
      })}
      <path d="M22,60 L22,720" stroke="#7affd8" stroke-width="3" opacity="0.7"/>
      <path d="M22,60 L22,720" stroke="#7affd8" stroke-width="14" opacity="0.18" filter="url(#${p}-b7)"/>
      <path d="M44,180 L190,214 L184,540 L44,596 Z" fill="#0a1014" stroke="#3a4650" stroke-width="3"/>
      <path d="M52,190 L182,220 L176,534 L52,584 Z" fill="#041318"/>
      <path d="M52,190 L182,220 L176,534 L52,584 Z" fill="url(#${p}-screenGlow)"/>
      ${Array.from({ length: 9 }, (_, i) => `<path d="M66,${236 + i * 34} L${f1(110 + rand() * 56)},${f1(240 + i * 34 - (i * 1.2))}" stroke="${i % 4 === 3 ? '#ffc04a' : '#5affd0'}" stroke-width="7" stroke-linecap="round" opacity="0.75"/>`).join('')}
      <path d="M60,640 L150,612 M60,662 L150,634 M60,684 L150,656" stroke="#06090c" stroke-width="7"/>
    </g>`;
  };

  const glareShield = `${paint(p, 'glare', 'M200,662 C360,612 1240,612 1400,662 L1392,690 C1230,646 370,646 208,690 Z', {
    fill: `url(#${p}-glare)`,
    ink: S.ink,
    strokes: [{ d: 'M230,664 C380,622 1220,622 1370,664', c: '#5a6a76', w: 4, o: 0.7, b: 1 }],
  })}
    <path d="M214,690 C372,650 1228,650 1386,690" stroke="#7affd8" stroke-width="2.4" fill="none" opacity="0.9"/>
    <path d="M214,694 C372,654 1228,654 1386,694" stroke="#7affd8" stroke-width="16" fill="none" opacity="0.2" filter="url(#${p}-b7)"/>
    <g data-part="master" data-level="ok" class="${p}-master" font-family="${MONO}" font-weight="700" text-anchor="middle">
      <g class="${p}-caution">
        <rect x="694" y="622" width="98" height="26" rx="4" fill="#2a1e08" stroke="#000" stroke-width="1.6"/>
        <text x="743" y="633" font-size="7" letter-spacing="1" fill="#000">MASTER</text>
        <text x="743" y="644" font-size="10" letter-spacing="1" fill="#000">CAUTION</text>
      </g>
      <g class="${p}-warning">
        <rect x="808" y="622" width="98" height="26" rx="4" fill="#2a0a08" stroke="#000" stroke-width="1.6"/>
        <text x="857" y="633" font-size="7" letter-spacing="1" fill="#000">MASTER</text>
        <text x="857" y="644" font-size="10" letter-spacing="1" fill="#000">WARNING</text>
      </g>
    </g>`;

  const dash = `${paint(p, 'dash', 'M150,684 L1450,684 L1600,830 L1600,900 L0,900 L0,830 Z', {
    fill: `url(#${p}-dash)`,
    ink: S.ink,
    strokes: [
      { d: 'M170,692 L1430,692', c: '#5affd0', w: 30, o: 0.12, b: 12 },
      { d: 'M0,860 L1600,860', c: '#000', w: 60, o: 0.5, b: 12 },
    ],
    after: `<path d="M400,684 L380,900 M1200,684 L1220,900 M150,826 L1450,826" stroke="#000" stroke-width="2" opacity="0.6"/>
      <path d="M401,684 L381,900 M1201,684 L1221,900" stroke="#3a4650" stroke-width="1" opacity="0.6"/>`,
  })}
    <text x="800" y="683" text-anchor="middle" font-family="${MONO}" font-size="9.5" letter-spacing="3" fill="#7affd8" opacity="0.85">LIFE SUPPORT · CABIN ATMOSPHERE</text>
    ${GASES.map((gas, i) => gasMonitor(p, gas, i)).join('')}
    ${display(p, 240, 712, 158, 104, navDisplay(158, 104))}
    ${display(p, 1202, 712, 158, 104, powerDisplay(158, 104, rand))}
    ${keyBlock(430, 832, 9, 3, rand)}${keyBlock(902, 832, 9, 3, rand)}
    <path d="M718,836 L882,836 L896,900 L704,900 Z" fill="#0e1318" stroke="#000" stroke-width="2"/>
    <path d="M760,846 L760,880 M840,846 L840,880" stroke="#000" stroke-width="5"/>
    ${[760, 840].map((x) => `<path d="M${x},880 L${x + 4},852" stroke="#5a6672" stroke-width="7" stroke-linecap="round"/>
      <rect x="${x - 14}" y="836" width="34" height="20" rx="7" fill="#20282e" stroke="#000" stroke-width="1.6"/>
      <rect x="${x - 10}" y="840" width="26" height="5" rx="2.5" fill="#5affd0" opacity="0.85"/>`).join('')}
    ${[[330, 852], [370, 868], [1230, 852], [1270, 868]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="#1a2228" stroke="#000" stroke-width="1.6"/><path d="M${x},${y} L${x},${y - 9}" stroke="#7affd8" stroke-width="2.4"/>`).join('')}`;

  const seat = (cx, flip) => `<g transform="translate(${cx} 900) scale(${flip ? -0.86 : 0.86} 0.86)">
    ${paint(p, `back${cx}`, 'M-120,0 L-128,-118 C-128,-150 -104,-168 -64,-170 L64,-170 C104,-168 128,-150 128,-118 L120,0 Z', {
      fill: `url(#${p}-seat)`,
      ink: S.ink,
      strokes: [
        { d: 'M-108,-10 L-114,-120 C-112,-146 -94,-158 -60,-160', c: '#5a6a7a', w: 8, o: 0.6, b: 4 },
        { d: 'M110,-10 L116,-120', c: '#000', w: 26, o: 0.6, b: 7 },
      ],
      after: `<path d="M-46,-170 L-40,0 M46,-170 L40,0" stroke="#0a0c10" stroke-width="22"/>
        <path d="M-46,-170 L-40,0 M46,-170 L40,0" stroke="#3a2a10" stroke-width="16"/>
        <path d="M-52,-120 L-30,-120 M30,-120 L52,-120" stroke="#c8d0d8" stroke-width="4"/>`,
    })}
    <path d="M-124,-4 L-130,-118 C-130,-152 -104,-172 -64,-174 L64,-174 C104,-172 130,-152 130,-118 L124,-4" stroke="#7affd8" stroke-width="2" fill="none" opacity="0.75"/>
    ${paint(p, `head${cx}`, 'M-62,-180 C-66,-214 -40,-230 0,-230 C40,-230 66,-214 62,-180 C58,-170 40,-168 0,-168 C-40,-168 -58,-170 -62,-180 Z', {
      fill: `url(#${p}-seat)`,
      ink: S.ink,
      strokes: [{ d: 'M-50,-196 C-44,-216 -20,-222 10,-222', c: '#6a7a8a', w: 6, o: 0.6, b: 2 }],
      after: Array.from({ length: 4 }, (_, i) => `<path d="M-30,${-210 + i * 9} H30" stroke="#06080a" stroke-width="2.4" stroke-linecap="round"/>`).join(''),
    })}
    <path d="M-10,-168 L-10,-176 M10,-168 L10,-176" stroke="#2a3038" stroke-width="6"/>
  </g>`;

  const body = `<defs>${brushes(p)}
      ${linear(`${p}-frame`, [[0, '#262e36'], [0.5, '#161c22'], [1, '#07090c']])}
      ${linear(`${p}-ceiling`, [[0, '#0c1014'], [1, '#2a323a']])}
      ${linear(`${p}-wall`, [[0, '#0a0e12'], [0.6, '#1c242c'], [1, '#2c363e']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
      ${linear(`${p}-pillar`, [[0, '#0c1014'], [0.45, '#2e3842'], [0.55, '#3c4854'], [1, '#0c1014']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
      ${linear(`${p}-glare`, [[0, '#2c343c'], [0.4, '#141a20'], [1, '#05070a']])}
      ${linear(`${p}-dash`, [[0, '#1e262e'], [0.35, '#12181e'], [1, '#05070a']])}
      ${linear(`${p}-bezel`, [[0, '#3a4450'], [0.5, '#1a2026'], [1, '#0a0d10']])}
      ${linear(`${p}-seat`, [[0, '#3a4654'], [0.5, '#1e2630'], [1, '#0a0e14']], { x1: 0, y1: 0, x2: 1, y2: 1 })}
      ${radial(`${p}-screenGlow`, [[0, '#2affd0', 0.16], [1, '#2affd0', 0]])}
      ${grain(`${p}-metal`, { frequency: 0.9, octaves: 2, strength: 0.25, seed: 19 })}
    </defs>
    <style>
      .${p}-gas { --tone: #5affd0; }
      .${p}-gas[data-level="warn"] { --tone: #ffc04a; }
      .${p}-gas[data-level="crit"] { --tone: #ff5a4a; }
      .${p}-tone { fill: var(--tone); }
      .${p}-toneFill { fill: var(--tone); }
      .${p}-toneStroke { stroke: var(--tone); }
      .${p}-screen { fill: #03141a; transition: fill 0.6s; }
      .${p}-gas[data-level="warn"] .${p}-screen { fill: #181204; }
      .${p}-gas[data-level="crit"] .${p}-screen { fill: #200606; }
      .${p}-figure { filter: drop-shadow(0 0 4px var(--tone)); }
      .${p}-gas[data-level="crit"] .${p}-pill { animation: ${p}-blink 1.1s steps(2, jump-none) infinite; }
      .${p}-caution rect, .${p}-warning rect { transition: fill 0.3s; }
      .${p}-master[data-level="warn"] .${p}-caution rect { fill: #ffb020; }
      .${p}-master[data-level="crit"] .${p}-caution rect { fill: #ffb020; }
      .${p}-master[data-level="crit"] .${p}-warning rect { fill: #ff3a2a; }
      .${p}-master[data-level="crit"] .${p}-warning { animation: ${p}-blink 0.8s steps(2, jump-none) infinite; }
      .${p}-master[data-level="ok"] text { fill: #3a3020; }
      @keyframes ${p}-blink { 50% { opacity: 0.35; } }
    </style>
    <path d="${frame}" fill="url(#${p}-frame)" fill-rule="evenodd" filter="url(#${p}-metal)"/>
    ${sideWall(false)}${sideWall(true)}
    ${overhead}
    <path d="${win}" fill="none" stroke="#06080b" stroke-width="30"/>
    <path d="${win}" fill="none" stroke="#3a4652" stroke-width="8"/>
    <path d="${win}" fill="none" stroke="#7affd8" stroke-width="2" opacity="0.75"/>
    <path d="${win}" fill="none" stroke="#7affd8" stroke-width="12" opacity="0.14" filter="url(#${p}-b7)"/>
    ${hud}
    ${pillar([548, 584], [488, 530], false)}${pillar([1016, 1052], [1070, 1112], true)}
    ${dash}
    ${glareShield}
    ${seat(112, false)}${seat(1488, true)}`;
  return svg('0 0 1600 900', body, { ratio: 'xMidYMid slice' });
}

/** A truss station: modules, radiators and four long solar wings. */
export function trussStation({ id = 'ts' } = {}) {
  const p = id;
  const wing = (x, y, flip) => {
    const cells = Array.from({ length: 10 }, (_, i) => `<path d="M${x + (flip ? -1 : 1) * (12 + i * 14)},${y - 32} L${x + (flip ? -1 : 1) * (12 + i * 14)},${y + 32}" stroke="#0a1a4a" stroke-width="1"/>`).join('');
    const x2 = x + (flip ? -150 : 150);
    return `<path d="M${x},${y - 32} L${x2},${y - 32} L${x2},${y + 32} L${x},${y + 32} Z" fill="url(#${p}-cells)" stroke="#9ab0d8" stroke-width="1.4"/>${cells}<path d="M${x},${y} L${x2},${y}" stroke="#d8e4f4" stroke-width="2"/>`;
  };
  const module = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="url(#${p}-module)" stroke="${S.hullDeep}" stroke-width="1.4"/>${Array.from({ length: Math.floor(w / 18) }, (_, i) => `<path d="M${x + 10 + i * 18},${y + 2} L${x + 10 + i * 18},${y + h - 2}" stroke="${S.hullLo}" stroke-width="1"/>`).join('')}`;
  const body = `<defs>${brushes(p)}
      ${linear(`${p}-cells`, [[0, '#3a6ae0'], [0.5, S.panel], [1, '#0a1640']], { x1: 0, y1: 0, x2: 1, y2: 1 })}
      ${linear(`${p}-module`, [[0, '#ffffff'], [0.45, S.hull], [1, S.hullLo]])}
    </defs>
    <path d="M40,130 L360,130" stroke="${S.hullLo}" stroke-width="10"/>
    <path d="M40,130 L360,130" stroke="${S.hull}" stroke-width="4" stroke-dasharray="6 4"/>
    ${wing(40, 60, false)}${wing(40, 200, false)}${wing(360, 60, true)}${wing(360, 200, true)}
    <path d="M40,60 L40,200 M360,60 L360,200" stroke="${S.hull}" stroke-width="5"/>
    ${module(150, 110, 100, 40)}${module(180, 80, 40, 100)}${module(120, 120, 34, 22)}${module(246, 118, 40, 24)}
    <rect x="176" y="150" width="48" height="60" rx="4" fill="#f4f6f8" stroke="${S.hullDeep}" stroke-width="1.4"/>
    ${Array.from({ length: 4 }, (_, i) => `<path d="M176,${158 + i * 14} L224,${158 + i * 14}" stroke="${S.hullLo}" stroke-width="1"/>`).join('')}
    <circle cx="200" cy="130" r="12" fill="#c8d0dc" stroke="${S.hullDeep}" stroke-width="1.4"/>
    <circle cx="200" cy="130" r="5" fill="#ffd060"/>
    <path d="M200,80 L200,40 M196,44 L204,44" stroke="${S.hull}" stroke-width="2.4"/>`;
  return svg('0 0 400 260', body, { ratio: 'xMidYMid meet' });
}

/** A wheel station: a hub with solar sails and a ring on four spokes. */
export function wheelStation({ id = 'ws' } = {}) {
  const p = id;
  const windows = Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2;
    return `<circle cx="${f1(150 + Math.cos(a) * 118)}" cy="${f1(150 + Math.sin(a) * 118)}" r="2.6" fill="#ffd88a"/>`;
  }).join('');
  const body = `<defs>${brushes(p)}
      ${linear(`${p}-ring`, [[0, '#ffffff'], [0.5, S.hull], [1, S.hullLo]], { x1: 0, y1: 0, x2: 1, y2: 1 })}
      ${linear(`${p}-cells`, [[0, '#3a6ae0'], [0.5, S.panel], [1, '#0a1640']])}
    </defs>
    <circle cx="150" cy="150" r="118" fill="none" stroke="${S.hullDeep}" stroke-width="26"/>
    <circle cx="150" cy="150" r="118" fill="none" stroke="url(#${p}-ring)" stroke-width="22"/>
    ${Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return `<path d="M${f1(150 + Math.cos(a) * 107)},${f1(150 + Math.sin(a) * 107)} L${f1(150 + Math.cos(a) * 129)},${f1(150 + Math.sin(a) * 129)}" stroke="${S.hullLo}" stroke-width="1.4"/>`;
    }).join('')}
    ${windows}
    ${[0, 1, 2, 3].map((k) => `<path d="M150,150 L${f1(150 + Math.cos((k * Math.PI) / 2) * 106)},${f1(150 + Math.sin((k * Math.PI) / 2) * 106)}" stroke="${S.hullLo}" stroke-width="7"/><path d="M150,150 L${f1(150 + Math.cos((k * Math.PI) / 2) * 106)},${f1(150 + Math.sin((k * Math.PI) / 2) * 106)}" stroke="${S.hull}" stroke-width="3"/>`).join('')}
    <path d="M118,150 L60,120 L60,180 Z M182,150 L240,120 L240,180 Z" fill="url(#${p}-cells)" stroke="#9ab0d8" stroke-width="1.2" transform="rotate(45 150 150)"/>
    <circle cx="150" cy="150" r="26" fill="url(#${p}-ring)" stroke="${S.hullDeep}" stroke-width="1.6"/>
    <circle cx="150" cy="150" r="10" fill="#5ab8ff" stroke="${S.hullDeep}" stroke-width="1.2"/>`;
  return svg('0 0 300 300', body, { ratio: 'xMidYMid meet' });
}

/** A delta-wing spaceplane, nose up, engines alight. */
export function spaceplane({ id = 'sp' } = {}) {
  const p = id;
  const body = `<defs>${brushes(p)}
      ${linear(`${p}-hull`, [[0, '#b8c4d0'], [0.35, '#ffffff'], [0.7, S.hull], [1, S.hullLo]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
      ${radial(`${p}-flame`, [[0, '#ffffff'], [0.3, '#9ad8ff'], [1, '#3a7aff', 0]], { cy: 0.2 })}
    </defs>
    <ellipse cx="50" cy="236" rx="10" ry="22" fill="url(#${p}-flame)"/><ellipse cx="70" cy="236" rx="10" ry="22" fill="url(#${p}-flame)"/>
    ${paint(p, 'wing', 'M60,90 L112,200 L112,212 L8,212 L8,200 Z', {
      fill: `url(#${p}-hull)`,
      ink: S.ink,
      strokes: [{ d: 'M14,206 L106,206', c: '#1a1e24', w: 8, o: 0.85, b: 0 }],
    })}
    ${paint(p, 'body', 'M60,8 C74,22 80,50 80,90 L80,214 L40,214 L40,90 C40,50 46,22 60,8 Z', {
      fill: `url(#${p}-hull)`,
      ink: S.ink,
      strokes: [{ d: 'M74,40 L76,210', c: S.hullLo, w: 8, o: 0.6, b: 2 }],
    })}
    <path d="M60,8 C68,16 72,26 74,38 L46,38 C48,26 52,16 60,8 Z" fill="#1a1e24"/>
    <path d="M50,46 L70,46 L68,58 L52,58 Z" fill="#2a3a5a" stroke="${S.ink}" stroke-width="1"/>
    <path d="M52,48 L58,48 L57,56 L53,56 Z" fill="#9ad8ff" opacity="0.8"/>
    <path d="M56,140 L60,100 L64,140 L64,170 L56,170 Z" fill="${S.hull}" stroke="${S.ink}" stroke-width="1.2"/>
    <rect x="44" y="210" width="12" height="12" rx="2" fill="#3a3e46" stroke="${S.ink}" stroke-width="1"/>
    <rect x="64" y="210" width="12" height="12" rx="2" fill="#3a3e46" stroke="${S.ink}" stroke-width="1"/>
    <path d="M44,120 L76,120" stroke="#c0392b" stroke-width="3"/>`;
  return svg('0 0 120 260', body, { ratio: 'xMidYMid meet' });
}

/** An astronaut in a white suit with a gold visor, drifting free. */
export function astronaut({ id = 'as' } = {}) {
  const p = id;
  const suit = (key, d, strokes = []) => paint(p, key, d, { fill: `url(#${p}-suit)`, ink: S.hullDeep, strokes });
  const body = `<defs>${brushes(p)}
      ${linear(`${p}-suit`, [[0, '#ffffff'], [0.5, '#e8ecf0'], [1, '#9aa6b4']], { x1: 0, y1: 0, x2: 1, y2: 1 })}
      ${radial(`${p}-visor`, [[0, '#fff8d0'], [0.3, '#e8b84a'], [0.75, '#8a5a14'], [1, '#3a2408']], { cx: 0.35, cy: 0.3 })}
    </defs>
    <path d="M150,120 C190,110 200,70 180,40" stroke="#c8ccd4" stroke-width="4" fill="none" stroke-dasharray="2 4"/>
    ${suit('pack', 'M58,70 L122,64 L130,150 L64,158 Z', [{ d: 'M120,70 L126,150', c: '#6a7684', w: 10, o: 0.6, b: 4 }])}
    <rect x="76" y="80" width="40" height="14" rx="3" fill="#9aa6b4"/>
    ${suit('legL', 'M70,180 C66,200 62,220 56,236 L76,240 C82,224 86,206 90,186 Z', [{ d: 'M72,186 L62,234', c: '#6a7684', w: 6, o: 0.5, b: 2 }])}
    ${suit('legR', 'M100,180 C110,196 120,212 126,226 L144,218 C138,202 128,186 118,172 Z')}
    <path d="M54,234 L78,240 L76,250 L50,244 Z M124,224 L146,216 L150,226 L128,234 Z" fill="#c8ccd4" stroke="${S.hullDeep}" stroke-width="1.4"/>
    ${suit('torso', 'M66,96 C80,86 118,84 132,96 L136,170 C128,186 76,190 64,176 Z', [
      { d: 'M126,100 L130,170', c: '#6a7684', w: 12, o: 0.5, b: 4 },
      { d: 'M74,104 L72,170', c: '#ffffff', w: 8, o: 0.6, b: 4 },
    ])}
    <rect x="84" y="120" width="34" height="26" rx="3" fill="#d8dce4" stroke="${S.hullDeep}" stroke-width="1.2"/>
    <rect x="88" y="124" width="8" height="5" fill="#c0392b"/><rect x="100" y="124" width="8" height="5" fill="#2a6ac8"/><rect x="88" y="134" width="20" height="4" fill="#5a6470"/>
    <path d="M66,160 C90,166 112,166 134,160" stroke="#c0392b" stroke-width="3" fill="none"/>
    ${suit('armL', 'M68,104 C50,110 36,124 30,142 L46,150 C52,136 62,126 76,120 Z')}
    <circle cx="36" cy="150" r="10" fill="#c8ccd4" stroke="${S.hullDeep}" stroke-width="1.4"/>
    ${suit('armR', 'M130,100 C148,96 162,86 170,70 L182,80 C174,98 158,112 136,118 Z')}
    <circle cx="178" cy="72" r="10" fill="#c8ccd4" stroke="${S.hullDeep}" stroke-width="1.4"/>
    ${suit('helmet', 'M74,62 C72,36 88,20 106,20 C126,20 140,36 138,60 C138,80 124,94 106,94 C88,94 74,82 74,62 Z')}
    <path d="M84,52 C84,38 94,30 106,30 C120,30 130,40 128,56 C126,72 116,80 104,80 C92,80 84,70 84,52 Z" fill="url(#${p}-visor)" stroke="${S.hullDeep}" stroke-width="1.6"/>
    <path d="M94,40 C100,34 110,34 116,38" stroke="#fffaf0" stroke-width="3" fill="none" opacity="0.8" stroke-linecap="round"/>
    <circle cx="112" cy="60" r="4" fill="#ffffff" opacity="0.4"/>`;
  return svg('0 0 200 260', body, { ratio: 'xMidYMid meet' });
}
