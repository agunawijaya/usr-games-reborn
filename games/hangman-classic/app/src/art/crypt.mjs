import { brushes, f1, grain, linear, paint, radial, rod, seeded, svg } from './kit.mjs';

/**
 * The Vampire's Crypt: a moonlit stone wall, Count Nachtvorn (pale lilac skin, long silver
 * hair, a towering crimson-lined cape, clawed hand reaching), the werewolf he keeps prisoner
 * (howling, a broken shackle on his wrist), a five-branched candelabrum, and the end: the
 * Count's cape closing over the werewolf.
 */

const V = {
  ink: '#0c0810',
  skin: '#cbc2d8',
  skinHi: '#efe8f8',
  skinLo: '#7a6e8e',
  hair: '#d6d8e2',
  hairLo: '#8a8ea0',
  cape: '#16131c',
  capeHi: '#3e3850',
  crimson: '#8e1424',
  crimsonHi: '#d23a44',
  crimsonLo: '#3c050c',
  vest: '#4a0e1c',
  vestHi: '#8a2a3a',
  cravat: '#e8e2d8',
  silver: '#c8ccd6',
  gold: '#d8ac4c',
  ruby: '#e0283c',
  fur: '#4a5068',
  furHi: '#8a92ae',
  furLo: '#1c2030',
  belly: '#9aa0b4',
  iron: '#3a3c44',
  ironHi: '#8a8e98',
  eye: '#ff3a2a',
  moon: '#f0d488',
};

function defs(p) {
  return `<defs>${brushes(p)}
    ${radial(`${p}-skin`, [[0, V.skinHi], [0.55, V.skin], [1, V.skinLo]], { cx: 0.4, cy: 0.35, r: 0.8 })}
    ${linear(`${p}-cape`, [[0, V.capeHi], [0.45, V.cape], [1, '#050407']], { x1: 0, y1: 0, x2: 1, y2: 0.3 })}
    ${linear(`${p}-crimson`, [[0, V.crimsonHi], [0.45, V.crimson], [1, V.crimsonLo]], { x1: 0, y1: 0, x2: 1, y2: 1 })}
    ${linear(`${p}-vest`, [[0, V.vestHi], [0.5, V.vest], [1, '#1a0408']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-hair`, [[0, '#ffffff'], [0.4, V.hair], [1, V.hairLo]])}
    ${linear(`${p}-fur`, [[0, V.furHi], [0.45, V.fur], [1, V.furLo]], { x1: 0, y1: 0, x2: 1, y2: 0.3 })}
    ${linear(`${p}-iron`, [[0, V.ironHi], [0.5, V.iron], [1, '#101114']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-gold`, [[0, '#fff0b0'], [0.45, V.gold], [1, '#7a5414']])}
    ${radial(`${p}-eye`, [[0, '#fff0c0'], [0.35, V.eye], [1, '#ff1a1a', 0]])}
    ${radial(`${p}-rim`, [[0, V.moon, 0.5], [1, V.moon, 0]])}
    ${grain(`${p}-fabric`, { frequency: 0.8, strength: 0.25, seed: 4 })}
    ${grain(`${p}-pelt`, { frequency: '0.06 0.5', octaves: 3, strength: 0.45, seed: 17 })}
  </defs>`;
}

/** The Count's face, centred on (0,0): gaunt and scowling, eyes burning in deep sockets, fangs bared. */
function fiendFace(p, key) {
  const ink = V.ink;
  return `${paint(p, key, 'M-27,-10 C-27,-32 -15,-44 -1,-44 C17,-44 27,-30 27,-8 C27,10 21,26 12,38 C7,44 -5,44 -11,38 C-19,26 -27,10 -27,-10 Z', {
      fill: `url(#${p}-skin)`,
      ink,
      strokes: [
        { d: 'M21,-22 C27,0 23,20 12,36', c: V.skinLo, w: 10, o: 0.6, b: 4 },
        { d: 'M-22,-2 C-20,12 -14,22 -8,28', c: V.skinLo, w: 7, o: 0.65, b: 4 },
        { d: 'M20,0 C18,12 14,20 9,26', c: '#4a3e5a', w: 6, o: 0.6, b: 4 },
        { d: 'M-22,-12 C-10,-6 10,-6 22,-14', c: '#3a2e48', w: 12, o: 0.65, b: 4 },
        { d: 'M-16,-34 C-6,-40 8,-40 16,-34', c: V.skinHi, w: 6, o: 0.6, b: 2 },
      ],
    })}
    <path d="M-27,-6 L-40,-22 L-26,-15 Z" fill="${V.skin}" stroke="${ink}" stroke-width="1.2"/>
    <circle cx="-12" cy="-9" r="9" fill="url(#${p}-eye)" opacity="0.85"/>
    <circle cx="12" cy="-9" r="9" fill="url(#${p}-eye)" opacity="0.85"/>
    <path d="M-20,-10 C-16,-14 -9,-13 -4,-7 C-9,-5 -15,-5 -20,-10 Z" fill="#ff2a1a" stroke="${ink}" stroke-width="1"/>
    <path d="M4,-7 C9,-13 16,-14 20,-10 C15,-5 9,-5 4,-7 Z" fill="#ff2a1a" stroke="${ink}" stroke-width="1"/>
    <circle cx="-11" cy="-8.4" r="1.4" fill="#fff4c8"/><circle cx="11" cy="-8.4" r="1.4" fill="#fff4c8"/>
    <path d="M-24,-20 C-17,-19 -10,-15 -2,-8" stroke="#1a1420" stroke-width="3.6" fill="none" stroke-linecap="round"/>
    <path d="M2,-8 C10,-15 17,-19 24,-21" stroke="#1a1420" stroke-width="3.6" fill="none" stroke-linecap="round"/>
    <path d="M-3,-20 L-1,-12 M3,-20 L1,-12" stroke="${V.skinLo}" stroke-width="1.2"/>
    <path d="M0,-6 C-1,4 -4,11 -2,15 C1,17 4,16 6,14" stroke="${V.skinLo}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M-6,13 C-10,18 -12,22 -13,26 M7,13 C10,18 12,22 13,26" stroke="${V.skinLo}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M-13,25 C-6,20 6,20 13,25 C9,34 -9,34 -13,25 Z" fill="#2a0810" stroke="${ink}" stroke-width="1.2"/>
    <path d="M-13,25 C-6,21 6,21 13,25" stroke="${V.skinLo}" stroke-width="1.6" fill="none"/>
    <path d="M-8,23 L-6,35 L-4,23 Z M4,23 L6,35 L8,23 Z" fill="#fffaf0" stroke="${ink}" stroke-width="0.8"/>
    <path d="M-3,24 L-2,27 L-1,24 M1,24 L2,27 L3,24" fill="#efe6d8" stroke="${ink}" stroke-width="0.6"/>
    <path d="M-6,31 L-5,28 L-4,31 M4,31 L5,28 L6,31" fill="#efe6d8" stroke="${ink}" stroke-width="0.6"/>`;
}

/** The crypt wall, 1600 × 900: big dressed stones, cracks and moss, moonlight from the arch. */
export function cryptWall({ id = 'cw' } = {}) {
  const p = id;
  const rand = seeded(53);
  const stones = [];
  const rowH = 100;
  for (let r = 0; r < 10; r++) {
    let x = -((r * 97) % 180);
    while (x < 1600) {
      const w = 150 + Math.floor(rand() * 90);
      const y = r * rowH;
      const tone = ['#1a1a26', '#1e1d2a', '#171622', '#211f2e', '#1b1a27'][Math.floor(rand() * 5)];
      stones.push(`<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${rowH - 4}" rx="5" fill="${tone}"/>
        <path d="M${x + 5},${y + rowH - 6} L${x + 5},${y + 5} L${x + w - 6},${y + 5}" stroke="#3a3a52" stroke-width="2" fill="none" opacity="${f1(0.3 + rand() * 0.25)}"/>
        <path d="M${x + 5},${y + rowH - 3} L${x + w - 3},${y + rowH - 3} L${x + w - 3},${y + 5}" stroke="#000" stroke-width="3" fill="none" opacity="0.6"/>
        ${rand() < 0.18 ? `<path d="M${x + 10 + rand() * (w - 40)},${y + 4} l${f1(rand() * 14)},${f1(20 + rand() * 20)} l${f1(-10 + rand() * 20)},${f1(16 + rand() * 20)}" stroke="#050408" stroke-width="1.6" fill="none"/>` : ''}
        ${rand() < 0.2 ? `<ellipse cx="${x + rand() * w}" cy="${y + rowH - 6}" rx="${20 + rand() * 30}" ry="5" fill="#22301e" opacity="0.6" filter="url(#${p}-b4)"/>` : ''}`);
      x += w;
    }
  }
  const body = `<defs>${brushes(p)}
      ${radial(`${p}-moon`, [[0, '#f0d488', 0.25], [0.4, '#b0a0d0', 0.08], [1, '#000', 0]])}
      ${radial(`${p}-candle`, [[0, '#ffb060', 0.28], [1, '#ff8030', 0]])}
      ${radial(`${p}-vignette`, [[0, '#000', 0], [0.55, '#000', 0.35], [1, '#000', 0.85]], { r: 0.75 })}
      ${grain(`${p}-grain`, { frequency: 0.8, octaves: 3, strength: 0.35, seed: 8 })}
    </defs>
    <rect width="1600" height="900" fill="#07060c"/>
    <g filter="url(#${p}-grain)">${stones.join('')}</g>
    <ellipse cx="800" cy="420" rx="620" ry="420" fill="url(#${p}-moon)" style="mix-blend-mode:screen"/>
    <ellipse cx="240" cy="420" rx="300" ry="260" fill="url(#${p}-candle)" style="mix-blend-mode:screen"/>
    <rect x="0" y="780" width="1600" height="120" fill="#0a0910"/>
    ${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 200 - 40},900 L${i * 200 + 60},780" stroke="#1c1b28" stroke-width="2"/>`).join('')}
    <path d="M0,780 L1600,780" stroke="#2c2b3c" stroke-width="3"/>
    <rect width="1600" height="900" fill="url(#${p}-vignette)"/>`;
  return svg('0 0 1600 900', body, { ratio: 'xMidYMid slice' });
}

/** Count Nachtvorn lunging to the left, cape flaring behind, clawed hand reaching. */
export function count({ id = 'ct' } = {}) {
  const p = id;
  const ink = V.ink;
  const body = `${defs(p)}
    <ellipse cx="190" cy="512" rx="130" ry="9" fill="#000" opacity="0.55" filter="url(#${p}-b4)"/>
    ${paint(p, 'capeBack', 'M150,96 C120,70 96,40 92,12 C140,30 200,44 250,70 C300,96 340,170 352,260 C362,350 356,440 340,508 L280,500 L262,512 L240,498 L200,510 L180,496 L150,504 C170,400 168,280 150,180 Z', {
      fill: `url(#${p}-crimson)`,
      ink,
      filter: `url(#${p}-fabric)`,
      strokes: [
        { d: 'M200,80 C260,120 300,200 320,300 C334,380 334,450 326,500', c: V.crimsonLo, w: 30, o: 0.6, b: 12 },
        { d: 'M170,110 C200,160 214,240 218,330 C220,410 214,470 204,504', c: V.crimsonHi, w: 12, o: 0.45, b: 7 },
        { d: 'M240,100 C280,180 290,280 288,380', c: V.crimsonLo, w: 6, o: 0.6, b: 2 },
      ],
    })}
    ${paint(p, 'capeEdge', 'M250,70 C300,96 340,170 352,260 C362,350 356,440 340,508 L358,512 C374,430 378,340 368,250 C356,160 320,92 266,62 Z', {
      fill: `url(#${p}-cape)`,
      ink,
      strokes: [{ d: 'M270,72 C320,110 350,190 360,280', c: V.capeHi, w: 6, o: 0.6, b: 2 }],
    })}
    ${paint(p, 'legBack', 'M196,330 L222,330 C238,380 262,430 290,476 L276,488 C244,446 214,400 196,350 Z', { fill: `url(#${p}-cape)`, ink, strokes: [{ d: 'M206,340 C228,390 252,436 280,478', c: V.capeHi, w: 4, o: 0.5, b: 2 }] })}
    <path d="M272,480 L300,474 L310,488 L270,494 Z" fill="#050407" stroke="${ink}" stroke-width="1.6"/>
    ${paint(p, 'legFront', 'M150,330 L182,330 C176,380 160,420 132,446 L112,500 L90,500 L104,440 C120,410 136,370 150,330 Z', {
      fill: `url(#${p}-cape)`,
      ink,
      strokes: [
        { d: 'M164,336 C158,380 142,416 120,444', c: V.capeHi, w: 5, o: 0.5, b: 2 },
        { d: 'M110,446 L100,496', c: V.capeHi, w: 3, o: 0.5, b: 1 },
      ],
    })}
    <path d="M62,500 L114,496 L114,506 L58,508 C52,508 52,500 62,500 Z" fill="#050407" stroke="${ink}" stroke-width="1.6"/>
    <path d="M66,500 C80,498 96,498 108,500" stroke="#5a5470" stroke-width="2" fill="none"/>
    ${paint(p, 'coat', 'M140,140 C160,130 210,130 228,146 L232,250 C232,290 226,320 222,338 L150,338 C142,300 136,260 136,220 Z', {
      fill: `url(#${p}-cape)`,
      ink,
      filter: `url(#${p}-fabric)`,
      strokes: [
        { d: 'M220,150 C226,220 226,290 220,334', c: '#000', w: 14, o: 0.6, b: 7 },
        { d: 'M146,150 C142,210 144,280 152,334', c: V.capeHi, w: 8, o: 0.4, b: 4 },
      ],
    })}
    ${paint(p, 'vest', 'M160,146 L206,146 L208,270 L184,292 L162,270 Z', {
      fill: `url(#${p}-vest)`,
      ink,
      filter: `url(#${p}-fabric)`,
      strokes: [{ d: 'M200,150 L202,268', c: '#000', w: 8, o: 0.5, b: 4 }],
      after: Array.from({ length: 6 }, (_, i) => `<path d="M${168 + (i % 2) * 18},${160 + i * 18} c4,-4 8,0 4,4 c-4,4 -8,0 -4,-4" stroke="${V.vestHi}" stroke-width="1" fill="none" opacity="0.8"/>`).join(''),
    })}
    ${[176, 200, 224, 248].map((y) => `<circle cx="184" cy="${y}" r="2.6" fill="url(#${p}-gold)" stroke="${ink}" stroke-width="0.8"/>`).join('')}
    <path d="M168,142 C176,150 192,150 200,142 L196,172 C190,180 178,180 172,172 Z" fill="${V.cravat}" stroke="${ink}" stroke-width="1.4"/>
    <circle cx="184" cy="162" r="4.4" fill="${V.ruby}" stroke="${ink}" stroke-width="1"/><circle cx="183" cy="161" r="1.4" fill="#ffc0c8"/>
    <path d="M152,168 L160,250 M216,168 L210,250" stroke="url(#${p}-gold)" stroke-width="1.6" fill="none" opacity="0.8"/>
    <path d="M150,198 C166,212 200,212 216,198" stroke="url(#${p}-gold)" stroke-width="2" fill="none"/>
    <circle cx="184" cy="212" r="7" fill="url(#${p}-gold)" stroke="${ink}" stroke-width="1.2"/><circle cx="184" cy="212" r="3.4" fill="${V.ruby}"/>
    ${paint(p, 'armBack', 'M218,150 C244,150 262,132 270,108 L284,114 C276,146 252,170 222,176 Z', { fill: `url(#${p}-cape)`, ink, strokes: [{ d: 'M226,160 C248,156 264,140 274,116', c: V.capeHi, w: 4, o: 0.5, b: 2 }] })}
    ${paint(p, 'handBack', 'M270,108 C272,98 282,94 290,98 C296,102 296,110 288,114 Z', { fill: `url(#${p}-skin)`, ink, line: 1.4 })}
    <path d="M288,98 L300,86 M292,104 L306,96 M290,110 L304,108" stroke="${V.skin}" stroke-width="3" stroke-linecap="round"/>
    ${paint(p, 'armFront', 'M150,156 C126,162 100,170 72,178 L74,196 C104,192 132,186 156,180 Z', {
      fill: `url(#${p}-cape)`,
      ink,
      strokes: [{ d: 'M146,162 C120,168 96,176 76,182', c: V.capeHi, w: 4, o: 0.5, b: 2 }],
    })}
    <path d="M78,174 L66,176 L66,198 L80,198 Z" fill="${V.cravat}" stroke="${ink}" stroke-width="1.2"/>
    ${paint(p, 'hand', 'M66,178 C56,176 46,180 42,188 C40,194 46,198 54,198 L66,198 Z', { fill: `url(#${p}-skin)`, ink, line: 1.4 })}
    ${['M50,182 C38,176 28,172 18,174', 'M46,188 C34,186 22,186 12,190', 'M48,194 C38,196 28,200 20,206', 'M54,198 C48,204 42,210 38,218']
      .map((d) => rod(d, { width: 3.4, ink, body: V.skin, light: V.skinHi }))
      .join('')}
    ${[[18, 174], [12, 190], [20, 206], [38, 218]].map(([x, y]) => `<path d="M${x},${y} l-6,${y > 200 ? 4 : -2}" stroke="#2a2232" stroke-width="2.4" stroke-linecap="round"/>`).join('')}
    <circle cx="58" cy="184" r="3" fill="${V.ruby}" stroke="${ink}" stroke-width="0.8"/>
    ${paint(p, 'collar', 'M136,148 C114,120 104,84 110,40 C130,60 146,86 156,118 Z M232,150 C254,122 266,86 262,42 C242,60 226,88 216,120 Z', {
      fill: `url(#${p}-crimson)`,
      ink,
      strokes: [{ d: 'M120,60 C126,90 138,116 150,136 M252,60 C246,90 234,116 222,136', c: V.crimsonLo, w: 8, o: 0.6, b: 4 }],
    })}
    <path d="M110,40 C112,80 124,116 136,148 M262,42 C260,82 248,118 232,150" stroke="${V.cape}" stroke-width="6" fill="none"/>
    ${paint(p, 'hairBack', 'M156,50 C150,80 148,120 156,160 L176,150 C172,120 172,90 176,66 Z M212,52 C224,80 228,120 222,160 L204,150 C208,120 208,90 204,66 Z', {
      fill: `url(#${p}-hair)`,
      ink,
      line: 1.4,
    })}
    <path d="M170,136 L172,140 L176,138" stroke="${V.skinLo}" stroke-width="1" fill="none"/>
    <path d="M178,116 L178,138 L192,138 L192,116" fill="${V.skinLo}" stroke="${ink}" stroke-width="1.2"/>
    <g transform="translate(187 82)">${fiendFace(p, 'face')}</g>
    ${paint(p, 'hair', 'M158,64 C156,40 170,26 188,26 C208,26 220,40 218,62 C212,52 204,46 196,46 C190,52 180,54 172,52 C166,56 162,60 158,64 Z', {
      fill: `url(#${p}-hair)`,
      ink,
      strokes: [{ d: 'M168,36 C180,30 196,30 208,38', c: '#ffffff', w: 4, o: 0.8, b: 1 }],
    })}
    <path d="M166,44 C176,40 188,40 198,44 M174,34 C186,30 200,32 210,40" stroke="${V.hairLo}" stroke-width="1.2" fill="none"/>
    <circle cx="180" cy="300" r="190" fill="url(#${p}-rim)" opacity="0.18"/>`;
  return svg('0 0 380 520', body, { ratio: 'xMidYMax meet', label: 'Count Nachtvorn' });
}

/**
 * A shaggy outline: the closed polygon `points` with tufts of fur pushed outward along every
 * edge. `out` is +1 or -1 depending on the polygon's winding.
 */
function shaggy(points, rand, { every = 9, length = 9, out = 1 } = {}) {
  let d = '';
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const nx = (out * (y2 - y1)) / len;
    const ny = (out * -(x2 - x1)) / len;
    const steps = Math.max(1, Math.round(len / every));
    for (let k = 0; k < steps; k++) {
      const t0 = k / steps;
      const t1 = (k + 0.5) / steps;
      const ax = x1 + (x2 - x1) * t0;
      const ay = y1 + (y2 - y1) * t0;
      const tx = x1 + (x2 - x1) * t1 + nx * length * (0.5 + rand() * 0.8) + (x2 - x1) / len * 4;
      const ty = y1 + (y2 - y1) * t1 + ny * length * (0.5 + rand() * 0.8) + (y2 - y1) / len * 4;
      d += `${d ? ' L' : 'M'}${f1(ax)},${f1(ay)} L${f1(tx)},${f1(ty)}`;
    }
  }
  return `${d} Z`;
}

/** The werewolf, the Count's prisoner: hunched, howling at the moon, a broken shackle on his wrist. */
export function werewolf({ id = 'ww' } = {}) {
  const p = id;
  const ink = V.ink;
  const rand = seeded(61);
  const fur = `url(#${p}-fur)`;
  const pelt = `url(#${p}-pelt)`;
  const part = (key, points, strokes = [], opts = {}) =>
    paint(p, key, shaggy(points, rand, opts), { fill: opts.fill ?? fur, ink, line: 1.6, filter: pelt, strokes });
  const claws = (spots, dx, dy) => spots.map(([x, y]) => `<path d="M${x},${y} q${dx * 0.3},${dy * 0.6} ${dx},${dy}" stroke="#ece4d2" stroke-width="2.6" fill="none" stroke-linecap="round"/>`).join('');
  const body = `${defs(p)}
    <ellipse cx="150" cy="474" rx="110" ry="8" fill="#000" opacity="0.55" filter="url(#${p}-b4)"/>
    ${part('tail', [[92, 300], [70, 312], [50, 340], [40, 372], [46, 396], [58, 388], [70, 360], [96, 330]], [{ d: 'M86,312 C66,330 52,356 48,384', c: V.furHi, w: 6, o: 0.4, b: 2 }])}
    ${part('legBack', [[96, 292], [126, 290], [132, 330], [124, 370], [132, 414], [126, 456], [100, 460], [104, 420], [96, 380], [88, 334]], [{ d: 'M120,300 C126,340 118,380 126,420', c: V.furLo, w: 10, o: 0.6, b: 4 }])}
    <path d="M96,456 L132,454 L140,466 L90,468 Z" fill="${V.furLo}" stroke="${ink}" stroke-width="1.4"/>
    ${claws([[94, 466], [104, 468], [114, 468], [126, 468], [138, 466]], -3, 7)}
    ${part('legFront', [[148, 292], [178, 296], [186, 336], [176, 372], [188, 414], [184, 456], [156, 458], [160, 420], [150, 380], [142, 336]], [{ d: 'M172,304 C180,340 170,376 180,416', c: V.furHi, w: 6, o: 0.45, b: 2 }])}
    <path d="M152,456 L188,452 L198,464 L148,466 Z" fill="${V.furLo}" stroke="${ink}" stroke-width="1.4"/>
    ${claws([[150, 466], [160, 466], [170, 466], [182, 464], [196, 462]], 3, 7)}
    ${paint(p, 'trousers', 'M98,272 L182,272 L188,320 L170,330 L158,312 L146,334 L130,316 L114,334 L96,322 Z', {
      fill: '#2a2430',
      ink,
      strokes: [{ d: 'M104,282 L110,318 M170,284 L178,316', c: '#4a4250', w: 3, o: 0.6, b: 1 }],
    })}
    <path d="M98,272 L182,272 L182,282 L98,282 Z" fill="#3a2a1c" stroke="${ink}" stroke-width="1.2"/>
    ${part('armBack', [[100, 168], [84, 196], [74, 236], [70, 270], [78, 300], [94, 298], [96, 266], [104, 226], [116, 196]])}
    <path d="M68,296 C64,312 72,324 84,324 C96,324 100,310 96,296 Z" fill="${V.furLo}" stroke="${ink}" stroke-width="1.4"/>
    ${claws([[68, 320], [76, 326], [86, 326], [94, 320]], -2, 9)}
    ${part('torso', [[96, 166], [126, 144], [168, 142], [196, 160], [202, 200], [194, 244], [182, 276], [102, 278], [90, 240], [88, 200]], [
      { d: 'M126,170 C120,210 124,248 136,274', c: V.belly, w: 30, o: 0.55, b: 7 },
      { d: 'M190,176 C196,214 190,250 178,274', c: V.furLo, w: 16, o: 0.6, b: 7 },
      { d: 'M124,200 C136,208 152,208 164,200 M122,228 C134,236 152,236 166,228 M126,252 C138,258 152,258 162,252', c: V.furLo, w: 2.4, o: 0.75, b: 1 },
    ], { length: 7 })}
    ${part('mane', [[104, 150], [122, 124], [150, 108], [176, 112], [196, 136], [192, 168], [170, 182], [140, 186], [114, 178]], [
      { d: 'M120,140 C140,124 166,120 186,138', c: V.furHi, w: 8, o: 0.45, b: 2 },
    ], { length: 12, every: 8 })}
    ${part('armFront', [[176, 166], [198, 186], [212, 222], [218, 262], [214, 296], [198, 296], [198, 262], [192, 228], [178, 200]], [{ d: 'M190,182 C204,206 210,236 210,270', c: V.furHi, w: 5, o: 0.5, b: 2 }])}
    <path d="M196,262 L218,262 L220,280 L194,280 Z" fill="url(#${p}-iron)" stroke="${ink}" stroke-width="1.4"/>
    <path d="M198,268 L216,268" stroke="${V.ironHi}" stroke-width="1.2"/>
    <path d="M218,272 C228,276 232,286 226,294 M226,294 C236,298 238,308 230,314" stroke="url(#${p}-iron)" stroke-width="3.6" fill="none"/>
    <path d="M230,314 L238,322 L228,322 Z" fill="${V.iron}" stroke="${ink}" stroke-width="0.8"/>
    <path d="M196,292 C192,308 200,320 212,320 C224,320 226,306 220,292 Z" fill="${V.furLo}" stroke="${ink}" stroke-width="1.4"/>
    ${claws([[196, 314], [204, 320], [214, 320], [222, 314]], 2, 9)}
    ${part('head', [[150, 118], [156, 92], [172, 76], [194, 72], [210, 80], [218, 94], [212, 112], [194, 124], [170, 128]], [
      { d: 'M162,96 C176,82 196,80 210,88', c: V.furHi, w: 6, o: 0.5, b: 2 },
    ], { length: 7, every: 10 })}
    ${paint(p, 'snoutTop', 'M200,82 C214,70 230,56 246,38 C252,32 260,36 256,44 C246,62 232,80 216,96 Z', { fill: fur, ink, filter: pelt, strokes: [{ d: 'M206,82 C220,70 234,56 248,42', c: V.furHi, w: 4, o: 0.5, b: 1 }] })}
    ${paint(p, 'jaw', 'M210,104 C224,94 240,80 256,66 C260,62 264,68 260,72 C248,88 232,104 216,114 Z', { fill: fur, ink, filter: pelt })}
    <path d="M214,96 C228,86 242,72 254,56 L258,66 C246,82 230,98 216,108 Z" fill="#3a1218" stroke="${ink}" stroke-width="1"/>
    <path d="M222,90 L224,84 L228,88 M234,80 L236,74 L240,78 M244,68 L246,62 L250,66 M226,100 L228,96 L231,99 M238,90 L240,86 L243,89" stroke="#fffaf0" stroke-width="1.6" fill="none"/>
    <path d="M250,36 L260,34 L258,44 Z" fill="#111" stroke="${ink}" stroke-width="0.8"/>
    <path d="M160,92 L144,58 L172,82 Z M176,80 L170,46 L192,74 Z" fill="${V.fur}" stroke="${ink}" stroke-width="1.4"/>
    <path d="M161,84 L152,64 L168,80 Z" fill="#6a3a44"/>
    <path d="M194,92 C198,88 204,88 206,92 C204,96 198,96 194,92 Z" fill="#ffd060" stroke="${ink}" stroke-width="1"/><circle cx="201" cy="92" r="1.6" fill="#111"/>
    <path d="M190,86 L208,84" stroke="${V.furLo}" stroke-width="2.4" stroke-linecap="round"/>`;
  return svg('0 0 300 480', body, { ratio: 'xMidYMax meet', label: 'The werewolf' });
}

/** The end: the Count has reached him and his cape has closed over the werewolf. */
export function cloaked({ id = 'ck' } = {}) {
  const p = id;
  const ink = V.ink;
  const body = `${defs(p)}
    <ellipse cx="220" cy="512" rx="190" ry="9" fill="#000" opacity="0.6" filter="url(#${p}-b4)"/>
    ${paint(p, 'tail', 'M70,470 C46,470 26,456 20,440 C34,448 54,452 76,450 Z', { fill: `url(#${p}-fur)`, ink, filter: `url(#${p}-pelt)` })}
    <path d="M110,500 L140,500 L144,508 L104,508 Z" fill="${V.furLo}" stroke="${ink}" stroke-width="1.4"/>
    ${paint(p, 'mantle', 'M60,500 C40,420 48,300 90,220 C120,160 170,120 230,110 C300,104 360,140 392,210 C420,280 424,400 404,504 L370,494 L350,508 L320,494 L290,508 L262,494 L232,508 L200,494 L170,508 L140,494 L110,508 Z', {
      fill: `url(#${p}-cape)`,
      ink,
      filter: `url(#${p}-fabric)`,
      strokes: [
        { d: 'M110,240 C90,320 86,410 96,490', c: V.capeHi, w: 14, o: 0.45, b: 7 },
        { d: 'M200,140 C170,240 160,360 170,490', c: '#000', w: 20, o: 0.55, b: 12 },
        { d: 'M300,130 C330,220 340,340 330,490', c: V.capeHi, w: 10, o: 0.35, b: 7 },
        { d: 'M150,180 C140,260 140,360 150,480', c: '#000', w: 4, o: 0.7, b: 2 },
        { d: 'M260,140 C270,240 270,360 262,480', c: '#000', w: 4, o: 0.7, b: 2 },
      ],
    })}
    ${paint(p, 'lining', 'M392,210 C420,280 424,400 404,504 L420,508 C438,410 434,282 404,200 Z', { fill: `url(#${p}-crimson)`, ink })}
    <path d="M118,214 L110,176 L132,204 Z M138,200 L136,164 L154,194 Z" fill="${V.fur}" stroke="${ink}" stroke-width="1.4"/>
    <path d="M120,206 L114,184 L128,202 Z" fill="#6a3a44"/>
    <path d="M70,330 C56,336 52,350 60,360 C70,368 84,360 86,348 Z" fill="${V.furLo}" stroke="${ink}" stroke-width="1.4"/>
    ${[[58, 356], [66, 364], [76, 364], [84, 356]].map(([x, y]) => `<path d="M${x},${y} q-1,6 -4,9" stroke="#ece4d2" stroke-width="2.4" fill="none" stroke-linecap="round"/>`).join('')}
    <path d="M86,348 C120,330 150,326 180,330" stroke="${V.crimson}" stroke-width="5" fill="none"/>
    ${paint(p, 'hand', 'M150,214 C140,206 128,208 124,218 C122,226 130,232 140,232 L156,230 Z', { fill: `url(#${p}-skin)`, ink, line: 1.4 })}
    ${['M132,212 C124,204 118,196 110,192', 'M128,220 C118,218 108,218 100,222', 'M132,228 C124,232 116,238 110,246']
      .map((d) => rod(d, { width: 3.2, ink, body: V.skin, light: V.skinHi }))
      .join('')}
    ${paint(p, 'shoulders', 'M226,160 C230,124 252,104 280,100 L308,100 C334,104 356,124 360,160 Z', {
      fill: `url(#${p}-cape)`,
      ink,
      strokes: [{ d: 'M240,150 C246,126 262,112 284,108', c: V.capeHi, w: 6, o: 0.5, b: 2 }],
    })}
    <path d="M284,92 L304,92 L306,114 L282,114 Z" fill="${V.skinLo}" stroke="${ink}" stroke-width="1.2"/>
    <path d="M278,108 C286,118 302,118 310,108 L304,136 C298,142 290,142 284,136 Z" fill="${V.cravat}" stroke="${ink}" stroke-width="1.2"/>
    <circle cx="294" cy="124" r="4" fill="${V.ruby}" stroke="${ink}" stroke-width="0.8"/>
    ${paint(p, 'collar', 'M250,124 C232,92 226,58 232,20 C252,40 266,68 274,104 Z M338,124 C356,92 362,58 356,20 C336,40 322,68 314,104 Z', {
      fill: `url(#${p}-crimson)`,
      ink,
    })}
    ${paint(p, 'hair', 'M266,40 C260,70 260,100 268,124 L284,116 C280,96 280,72 284,54 Z M322,40 C330,70 332,100 324,124 L308,116 C312,96 312,72 308,54 Z', { fill: `url(#${p}-hair)`, ink, line: 1.4 })}
    <g transform="translate(294 66) scale(0.95)">${fiendFace(p, 'face')}</g>
    ${paint(p, 'top', 'M266,52 C262,26 278,12 296,12 C316,12 330,26 324,52 C318,40 310,34 302,34 C296,40 286,42 278,40 C272,44 268,48 266,52 Z', { fill: `url(#${p}-hair)`, ink })}`;
  return svg('0 0 440 520', body, { ratio: 'xMidYMax meet', label: 'The Count, his cape closed' });
}

/**
 * A five-branched candelabrum. Candle tips sit at (12,14) (32,6) (50,10) (68,6) (88,14) of a
 * 100 × 170 box, where the animated flames burn.
 */
export function candelabrum({ id = 'cd' } = {}) {
  const p = id;
  const ink = V.ink;
  const tips = [[12, 14], [32, 6], [50, 10], [68, 6], [88, 14]];
  const candle = ([x, y], i) => `<g>
    <rect x="${x - 3.6}" y="${y}" width="7.2" height="${34 - (y - 6)}" rx="1.4" fill="#efe6cf" stroke="${ink}" stroke-width="0.8"/>
    <path d="M${x - 3.6},${y + 2} c1,6 -1,10 0,14 M${x + 2.6},${y + 1} c1,4 0,7 1,10" stroke="#fffaf0" stroke-width="1.4" fill="none"/>
    <path d="M${x},${y} L${x},${y - 3}" stroke="#2a1a10" stroke-width="1"/>
    <ellipse cx="${x}" cy="${y + 34 - (y - 6)}" rx="6" ry="2" fill="url(#${p}-gold)" stroke="${ink}" stroke-width="0.8"/>
    ${i % 2 === 0 ? `<path d="M${x + 3.6},${y + 4} c2,2 2,8 0,12" stroke="#efe6cf" stroke-width="2.4" fill="none"/>` : ''}
  </g>`;
  const arms = `<path d="M50,96 C50,76 34,70 32,46 M50,96 C50,76 66,70 68,46 M50,100 C40,92 16,90 12,58 M50,100 C60,92 84,90 88,58 M50,100 L50,48" fill="none" stroke="${ink}" stroke-width="5"/>
    <path d="M50,96 C50,76 34,70 32,46 M50,96 C50,76 66,70 68,46 M50,100 C40,92 16,90 12,58 M50,100 C60,92 84,90 88,58 M50,100 L50,48" fill="none" stroke="url(#${p}-gold)" stroke-width="3"/>`;
  const body = `<defs>${brushes(p)}${linear(`${p}-gold`, [[0, '#fff0b0'], [0.45, V.gold], [1, '#6a4410']], { x1: 0, y1: 0, x2: 1, y2: 0 })}</defs>
    ${arms}
    ${tips.map(candle).join('')}
    <path d="M44,100 L56,100 L54,150 L46,150 Z" fill="url(#${p}-gold)" stroke="${ink}" stroke-width="1"/>
    <ellipse cx="50" cy="118" rx="7" ry="3" fill="url(#${p}-gold)" stroke="${ink}" stroke-width="0.8"/>
    <ellipse cx="50" cy="134" rx="6" ry="2.6" fill="url(#${p}-gold)" stroke="${ink}" stroke-width="0.8"/>
    <path d="M30,166 C34,154 44,150 50,150 C56,150 66,154 70,166 Z" fill="url(#${p}-gold)" stroke="${ink}" stroke-width="1"/>
    <path d="M26,166 L74,166 L74,170 L26,170 Z" fill="#6a4410" stroke="${ink}" stroke-width="0.8"/>`;
  return svg('0 0 100 170', body, { ratio: 'none' });
}

/** One bat, its wings flapping (SMIL), for the crypt's flight paths. */
export function bat({ id = 'bt', phase = 0 } = {}) {
  const wing = (l) => {
    const y = (v, k) => f1(v - k * l);
    const left = `M28,17 C22,${y(17, 12)} 12,${y(18, 16)} 2,${y(18, 14)} C6,${y(21, 10)} 7,${y(23, 8)} 6,${y(26, 6)} C10,${y(24, 6)} 13,${y(25, 4)} 15,${y(27, 2)} C18,24 22,22 28,20 Z`;
    const right = `M32,17 C38,${y(17, 12)} 48,${y(18, 16)} 58,${y(18, 14)} C54,${y(21, 10)} 53,${y(23, 8)} 54,${y(26, 6)} C50,${y(24, 6)} 47,${y(25, 4)} 45,${y(27, 2)} C42,24 38,22 32,20 Z`;
    return `${left} ${right}`;
  };
  const frames = [wing(1), wing(0.2), wing(-0.9), wing(0.2), wing(1)].join(';');
  const body = `<defs>${radial(`${id}-rim`, [[0, '#6a5a8a'], [1, '#120c1a']], { cx: 0.5, cy: 0.2 })}</defs>
    <path d="${wing(1)}" fill="#0c0812" stroke="#3a2e52" stroke-width="0.8">
      <animate attributeName="d" values="${frames}" dur="0.3s" begin="${f1(-phase)}s" repeatCount="indefinite"/>
    </path>
    <ellipse cx="30" cy="20" rx="4" ry="6.5" fill="url(#${id}-rim)"/>
    <circle cx="30" cy="13" r="3.4" fill="#120c1a"/>
    <path d="M27.6,11 L27,6.6 L29.4,10 Z M32.4,11 L33,6.6 L30.6,10 Z" fill="#120c1a"/>
    <circle cx="28.8" cy="12.8" r="0.7" fill="#ff3a2a"/><circle cx="31.2" cy="12.8" r="0.7" fill="#ff3a2a"/>`;
  return svg('0 0 60 36', body, { ratio: 'xMidYMid meet' });
}
