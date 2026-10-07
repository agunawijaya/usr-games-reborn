import { brushes, f1, grain, linear, paint, radial, svg } from './kit.mjs';

/**
 * The people of the tomb, painted in the Egyptian manner: a priestess with a lotus staff, a
 * young priestess with an offering jar, a scribe with his papyrus, and a noble kneeling in
 * adoration. When the sand wins, all four bow to the floor before the mummy.
 */

const P = {
  ink: '#2a160a',
  skin: '#b8673a',
  skinHi: '#e6a070',
  skinLo: '#6a2e12',
  fair: '#d9945e',
  fairLo: '#8a4a22',
  linen: '#f2ecdc',
  linenHi: '#ffffff',
  linenLo: '#a9a08a',
  wig: '#17151a',
  wigHi: '#4a4656',
  lapis: '#1f3f8f',
  turq: '#2aa39a',
  gold: '#e3b146',
  goldHi: '#fff0b0',
  goldLo: '#8a5c14',
  red: '#b0322a',
};

function defs(p) {
  return `<defs>${brushes(p)}
    ${linear(`${p}-linen`, [[0, P.linenHi], [0.5, P.linen], [1, P.linenLo]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-skin`, [[0, P.skinHi], [0.5, P.skin], [1, P.skinLo]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-fair`, [[0, '#f2c08e'], [0.5, P.fair], [1, P.fairLo]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-gold`, [[0, P.goldHi], [0.4, P.gold], [1, P.goldLo]])}
    ${linear(`${p}-wig`, [[0, P.wigHi], [0.5, P.wig], [1, '#000']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-nemes`, [[0, '#ffffff'], [1, '#d8d0bc']])}
    ${grain(`${p}-cloth`, { frequency: 0.9, strength: 0.18, seed: 4 })}
  </defs>`;
}

function collar(cx, cy, rx, ry, bands = [P.gold, P.lapis, P.turq, P.gold, P.red]) {
  return bands
    .map((c, i) => {
      const r = rx - i * (rx / (bands.length + 1));
      const s = ry - i * (ry / (bands.length + 1));
      return `<path d="M${f1(cx - r)},${cy} A${f1(r)},${f1(s)} 0 0 0 ${f1(cx + r)},${cy}" fill="none" stroke="${c}" stroke-width="${f1(rx / (bands.length + 1))}"/>`;
    })
    .join('');
}

const eye = (x, y) =>
  `<path d="M${x - 5},${y} C${x - 2},${y - 3} ${x + 3},${y - 3} ${x + 5},${y} C${x + 2},${y + 2} ${x - 2},${y + 2} ${x - 5},${y} Z" fill="#fff" stroke="${P.ink}" stroke-width="1.2"/>
   <circle cx="${x + 1}" cy="${y}" r="1.6" fill="${P.ink}"/><path d="M${x + 5},${y} L${x + 11},${y + 2}" stroke="${P.ink}" stroke-width="1.6"/>
   <path d="M${x - 5},${y - 5} C${x - 1},${y - 8} ${x + 4},${y - 8} ${x + 8},${y - 6}" stroke="${P.ink}" stroke-width="1.4" fill="none"/>`;

/** A face in profile looking right, its nose at (x + 22, y). */
function face(p, key, x, y, fill) {
  return paint(p, key, `M${x - 14},${y} C${x - 14},${y - 16} ${x - 4},${y - 26} ${x + 8},${y - 26} C${x + 18},${y - 26} ${x + 22},${y - 14} ${x + 22},${y - 4} L${x + 27},${y + 4} L${x + 22},${y + 6} C${x + 22},${y + 14} ${x + 16},${y + 22} ${x + 6},${y + 22} C${x - 6},${y + 22} ${x - 14},${y + 12} ${x - 14},${y} Z`, {
    fill,
    ink: P.ink,
    strokes: [
      { d: `M${x + 18},${y - 14} C${x + 20},${y} ${x + 18},${y + 12} ${x + 8},${y + 20}`, c: P.skinLo, w: 6, o: 0.45, b: 2 },
      { d: `M${x - 8},${y - 12} C${x - 10},${y} ${x - 6},${y + 10} ${x},${y + 16}`, c: P.skinHi, w: 5, o: 0.4, b: 2 },
    ],
  }) + `<path d="M${x + 12},${y + 13} C${x + 15},${y + 14} ${x + 18},${y + 13} ${x + 19},${y + 12}" stroke="${P.ink}" stroke-width="1.4" fill="none"/>`;
}

/** The tall priestess with a lotus staff; feet at (0,0), facing right. */
function priestess(p) {
  return `
    ${paint(p, 'pArmB', 'M-24,-246 C-30,-220 -32,-196 -30,-172 L-22,-170 C-22,-194 -18,-220 -14,-244 Z', { fill: `url(#${p}-fair)`, ink: P.ink })}
    ${paint(p, 'pDress', 'M-22,-252 C-12,-258 14,-258 24,-250 L28,-150 C32,-90 34,-40 32,-8 L-30,-8 C-32,-40 -30,-90 -26,-150 Z', {
      fill: `url(#${p}-linen)`,
      ink: P.ink,
      filter: `url(#${p}-cloth)`,
      strokes: [
        { d: 'M20,-240 C24,-160 28,-80 28,-10', c: P.linenLo, w: 12, o: 0.55, b: 7 },
        { d: 'M-18,-230 C-20,-160 -22,-80 -22,-10', c: '#ffffff', w: 8, o: 0.6, b: 4 },
        { d: 'M2,-196 C4,-130 6,-70 6,-10', c: P.linenLo, w: 2, o: 0.6, b: 1 },
        { d: 'M-8,-190 C-8,-130 -10,-70 -12,-10', c: P.linenLo, w: 1.6, o: 0.5, b: 1 },
      ],
    })}
    <path d="M-24,-204 C-10,-198 12,-198 28,-206 L28,-196 C12,-188 -10,-188 -24,-194 Z" fill="${P.red}" stroke="${P.ink}" stroke-width="1"/>
    <path d="M20,-198 C24,-170 22,-140 26,-116 L18,-114 C16,-140 14,-170 14,-196 Z" fill="${P.red}" stroke="${P.ink}" stroke-width="1"/>
    <path d="M-26,-8 L-4,-8 L-2,0 L-30,0 Z M6,-8 L28,-8 L34,0 L4,0 Z" fill="url(#${p}-fair)" stroke="${P.ink}" stroke-width="1.2"/>
    ${collar(0, -250, 26, 20)}
    <path d="M-6,-270 L6,-270 L7,-252 L-7,-252 Z" fill="url(#${p}-fair)" stroke="${P.ink}" stroke-width="1.2"/>
    ${face(p, 'pFace', -2, -292, `url(#${p}-fair)`)}
    ${eye(10, -296)}
    ${paint(p, 'pWig', 'M-20,-294 C-22,-318 -6,-330 10,-328 C22,-326 26,-318 24,-308 L12,-306 C8,-298 4,-290 0,-286 L-2,-246 L-24,-246 Z', {
      fill: `url(#${p}-wig)`,
      ink: P.ink,
      strokes: [{ d: 'M-14,-312 C-16,-290 -16,-270 -16,-250', c: P.wigHi, w: 4, o: 0.6, b: 1 }],
    })}
    <path d="M-20,-312 C-6,-322 12,-320 24,-312" stroke="url(#${p}-gold)" stroke-width="4" fill="none"/>
    <path d="M-2,-318 C-4,-330 4,-338 10,-332 C14,-338 22,-332 18,-322 Z" fill="#f2f6ff" stroke="${P.ink}" stroke-width="1"/>
    <circle cx="16" cy="-276" r="3" fill="url(#${p}-gold)"/>
    ${paint(p, 'pArmF', 'M14,-246 C22,-232 26,-216 28,-204 L44,-210 L46,-200 L26,-192 C18,-206 12,-222 8,-238 Z', { fill: `url(#${p}-fair)`, ink: P.ink })}
    <path d="M18,-222 L26,-224" stroke="url(#${p}-gold)" stroke-width="4"/>
    <path d="M46,-330 L46,0" stroke="${P.ink}" stroke-width="6"/><path d="M46,-330 L46,0" stroke="url(#${p}-gold)" stroke-width="3.6"/>
    <path d="M46,-332 C36,-344 38,-360 46,-366 C54,-360 56,-344 46,-332 Z" fill="${P.turq}" stroke="${P.ink}" stroke-width="1.2"/>
    <path d="M46,-334 C40,-342 34,-352 30,-352 C32,-344 38,-338 46,-334 Z M46,-334 C52,-342 58,-352 62,-352 C60,-344 54,-338 46,-334 Z" fill="${P.lapis}" stroke="${P.ink}" stroke-width="1"/>
    <path d="M40,-206 C42,-212 50,-212 52,-206 C50,-200 42,-200 40,-206 Z" fill="url(#${p}-fair)" stroke="${P.ink}" stroke-width="1"/>`;
}

/** The young priestess holding an offering jar before her; feet at (0,0), facing right. */
function acolyte(p) {
  return `
    ${paint(p, 'aDress', 'M-20,-222 C-10,-228 12,-228 22,-220 L26,-130 C28,-80 30,-36 28,-8 L-26,-8 C-28,-36 -26,-80 -24,-130 Z', {
      fill: `url(#${p}-linen)`,
      ink: P.ink,
      filter: `url(#${p}-cloth)`,
      strokes: [
        { d: 'M18,-210 C22,-140 24,-70 24,-10', c: P.linenLo, w: 12, o: 0.55, b: 7 },
        { d: 'M-16,-200 C-18,-140 -20,-70 -20,-10', c: '#ffffff', w: 6, o: 0.6, b: 4 },
        { d: 'M0,-170 C2,-110 2,-60 2,-10', c: P.linenLo, w: 1.6, o: 0.6, b: 1 },
      ],
    })}
    <path d="M-22,-178 C-8,-172 12,-172 26,-180 L26,-170 C12,-162 -8,-162 -22,-168 Z" fill="${P.lapis}" stroke="${P.ink}" stroke-width="1"/>
    <path d="M-22,-8 L-2,-8 L0,0 L-26,0 Z M4,-8 L24,-8 L30,0 L2,0 Z" fill="url(#${p}-fair)" stroke="${P.ink}" stroke-width="1.2"/>
    ${collar(0, -220, 24, 18, [P.gold, P.turq, P.lapis, P.gold])}
    <path d="M-6,-240 L6,-240 L7,-222 L-7,-222 Z" fill="url(#${p}-fair)" stroke="${P.ink}" stroke-width="1.2"/>
    ${face(p, 'aFace', -2, -262, `url(#${p}-fair)`)}
    ${eye(10, -266)}
    ${paint(p, 'aWig', 'M-18,-264 C-20,-288 -4,-298 10,-296 C22,-294 26,-286 24,-278 L12,-276 C8,-268 4,-260 0,-256 L-2,-222 L-22,-222 Z', {
      fill: `url(#${p}-wig)`,
      ink: P.ink,
      strokes: [{ d: 'M-12,-282 C-14,-260 -14,-240 -14,-224', c: P.wigHi, w: 4, o: 0.6, b: 1 }],
    })}
    <path d="M-18,-282 C-4,-292 12,-290 24,-282" stroke="url(#${p}-gold)" stroke-width="3.4" fill="none"/>
    ${paint(p, 'aArms', 'M8,-216 C18,-200 22,-184 24,-168 L36,-168 L36,-156 L16,-156 C10,-176 6,-196 4,-212 Z', { fill: `url(#${p}-fair)`, ink: P.ink })}
    ${paint(p, 'jar', 'M30,-188 C40,-190 48,-184 48,-172 C48,-158 42,-150 36,-150 C30,-150 24,-158 24,-172 C24,-180 26,-186 30,-188 Z', {
      fill: `url(#${p}-gold)`,
      ink: P.ink,
      strokes: [{ d: 'M44,-182 C46,-170 44,-158 38,-152', c: P.goldLo, w: 4, o: 0.6, b: 1 }],
    })}
    <path d="M30,-190 L42,-190 L42,-196 L30,-196 Z" fill="${P.turq}" stroke="${P.ink}" stroke-width="1"/>`;
}

/** The scribe, bald, in a kilt, papyrus open in his hands; feet at (0,0), facing right. */
function scribe(p) {
  return `
    ${paint(p, 'sLegB', 'M-14,-120 L-2,-120 L-8,-6 L-20,-6 Z', { fill: `url(#${p}-skin)`, ink: P.ink })}
    ${paint(p, 'sLegF', 'M4,-120 L16,-120 L26,-6 L14,-6 Z', { fill: `url(#${p}-skin)`, ink: P.ink, strokes: [{ d: 'M8,-116 L18,-10', c: P.skinHi, w: 4, o: 0.5, b: 2 }] })}
    <path d="M-26,-8 L-4,-8 L-2,0 L-30,0 Z M12,-8 L32,-8 L36,0 L10,0 Z" fill="#9a6a3a" stroke="${P.ink}" stroke-width="1.2"/>
    ${paint(p, 'sTorso', 'M-20,-232 C-10,-238 14,-238 24,-232 L20,-200 C18,-184 16,-172 14,-164 L-16,-164 C-18,-180 -20,-204 -20,-232 Z', {
      fill: `url(#${p}-skin)`,
      ink: P.ink,
      strokes: [
        { d: 'M18,-228 C16,-200 14,-180 12,-166', c: P.skinLo, w: 10, o: 0.5, b: 4 },
        { d: 'M-14,-224 C-14,-200 -12,-180 -10,-166', c: P.skinHi, w: 6, o: 0.45, b: 4 },
        { d: 'M-4,-204 C2,-200 8,-200 12,-204', c: P.skinLo, w: 2, o: 0.6, b: 0 },
      ],
    })}
    ${paint(p, 'sKilt', 'M-18,-166 L18,-166 L30,-106 L-26,-106 Z', {
      fill: `url(#${p}-linen)`,
      ink: P.ink,
      after: Array.from({ length: 7 }, (_, i) => `<path d="M${-8 + i * 4},-162 L${-14 + i * 7},-108" stroke="${P.linenLo}" stroke-width="1"/>`).join(''),
      strokes: [{ d: 'M14,-162 L26,-110', c: P.linenLo, w: 8, o: 0.5, b: 4 }],
    })}
    <path d="M-18,-166 L18,-166 L18,-158 L-18,-158 Z" fill="url(#${p}-gold)" stroke="${P.ink}" stroke-width="1"/>
    ${collar(2, -232, 24, 16, [P.gold, P.turq, P.gold])}
    <path d="M-4,-252 L8,-252 L9,-234 L-5,-234 Z" fill="url(#${p}-skin)" stroke="${P.ink}" stroke-width="1.2"/>
    ${face(p, 'sFace', 0, -274, `url(#${p}-skin)`)}
    ${eye(12, -278)}
    <path d="M-12,-282 C-10,-298 2,-302 10,-300" stroke="${P.skinHi}" stroke-width="3" fill="none" opacity="0.7" stroke-linecap="round"/>
    <ellipse cx="-12" cy="-274" rx="4" ry="6" fill="url(#${p}-skin)" stroke="${P.ink}" stroke-width="1"/>
    ${paint(p, 'sArmB', 'M-18,-228 C-24,-208 -24,-190 -18,-176 L10,-182 L10,-172 L-20,-166 C-30,-180 -30,-206 -26,-228 Z', { fill: `url(#${p}-skin)`, ink: P.ink })}
    ${paint(p, 'sArmF', 'M18,-228 C26,-214 30,-200 30,-186 L44,-188 L44,-178 L26,-176 C20,-190 16,-206 12,-222 Z', { fill: `url(#${p}-skin)`, ink: P.ink })}
    ${paint(p, 'papyrus', 'M4,-196 L48,-200 L50,-170 L6,-166 Z', {
      fill: '#efe0b0',
      ink: P.ink,
      after: Array.from({ length: 4 }, (_, i) => `<path d="M12,${-190 + i * 6} L42,${-193 + i * 6}" stroke="#6a4a20" stroke-width="1" stroke-dasharray="3 2"/>`).join(''),
    })}
    <path d="M2,-198 C0,-190 0,-172 4,-164 M50,-202 C52,-194 52,-176 48,-168" stroke="#c9a96a" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M10,-176 L22,-210" stroke="#6a4a20" stroke-width="2"/>`;
}

/** A noble kneeling in adoration, nemes headcloth, both palms raised; knee at (0,0), facing right. */
function noble(p) {
  return `
    ${paint(p, 'nLegB', 'M-50,-4 C-46,-30 -30,-46 -8,-46 L4,-30 L-10,-4 Z', { fill: `url(#${p}-linen)`, ink: P.ink, strokes: [{ d: 'M-44,-10 C-38,-28 -26,-38 -10,-40', c: P.linenLo, w: 6, o: 0.6, b: 2 }] })}
    <path d="M-60,-6 L-40,-6 L-40,0 L-64,0 Z" fill="url(#${p}-skin)" stroke="${P.ink}" stroke-width="1.2"/>
    ${paint(p, 'nLegF', 'M-6,-48 L30,-44 L36,-4 L24,-4 L20,-30 L-2,-30 Z', { fill: `url(#${p}-linen)`, ink: P.ink, strokes: [{ d: 'M22,-40 L30,-6', c: P.linenLo, w: 6, o: 0.6, b: 2 }] })}
    <path d="M22,-6 L44,-6 L46,0 L20,0 Z" fill="url(#${p}-skin)" stroke="${P.ink}" stroke-width="1.2"/>
    ${paint(p, 'nBody', 'M-26,-180 C-14,-186 12,-186 22,-178 L20,-120 C20,-90 16,-60 10,-44 L-24,-44 C-30,-70 -32,-110 -30,-150 Z', {
      fill: `url(#${p}-linen)`,
      ink: P.ink,
      filter: `url(#${p}-cloth)`,
      strokes: [
        { d: 'M16,-170 C16,-120 12,-80 8,-48', c: P.linenLo, w: 10, o: 0.55, b: 4 },
        { d: 'M-22,-160 C-24,-120 -24,-80 -20,-48', c: '#ffffff', w: 6, o: 0.6, b: 2 },
      ],
    })}
    <path d="M-28,-110 C-10,-104 10,-104 20,-110 L20,-100 C10,-94 -10,-94 -28,-100 Z" fill="url(#${p}-gold)" stroke="${P.ink}" stroke-width="1"/>
    ${collar(-2, -178, 24, 18)}
    <path d="M-8,-198 L4,-198 L5,-180 L-9,-180 Z" fill="url(#${p}-skin)" stroke="${P.ink}" stroke-width="1.2"/>
    ${face(p, 'nFace', -4, -220, `url(#${p}-skin)`)}
    ${eye(8, -224)}
    <path d="M14,-198 L18,-186 L12,-186 Z" fill="${P.lapis}" stroke="${P.ink}" stroke-width="1"/>
    ${paint(p, 'nemes', 'M-24,-224 C-26,-246 -10,-256 6,-254 C20,-252 24,-242 22,-232 L12,-230 L10,-212 L2,-212 L2,-206 C2,-196 -2,-188 -6,-180 L-30,-170 C-34,-190 -30,-210 -24,-224 Z', {
      fill: `url(#${p}-nemes)`,
      ink: P.ink,
      after: Array.from({ length: 8 }, (_, i) => `<path d="M-34,${-250 + i * 9} L26,${-250 + i * 9}" stroke="${P.lapis}" stroke-width="3.4"/>`).join(''),
    })}
    <path d="M-24,-236 C-8,-246 10,-244 22,-236" stroke="url(#${p}-gold)" stroke-width="3" fill="none"/>
    ${paint(p, 'nArmB', 'M2,-176 C14,-182 26,-190 36,-204 L44,-198 C36,-182 24,-170 10,-164 Z', { fill: `url(#${p}-skin)`, ink: P.ink })}
    ${paint(p, 'nArmF', 'M12,-168 C26,-174 40,-184 50,-200 L58,-194 C50,-176 36,-162 20,-156 Z', { fill: `url(#${p}-skin)`, ink: P.ink, strokes: [{ d: 'M18,-166 C30,-174 42,-184 50,-196', c: P.skinHi, w: 4, o: 0.5, b: 2 }] })}
    <path d="M34,-204 C32,-214 36,-222 42,-220 L46,-200 Z M48,-200 C46,-210 50,-218 56,-216 L60,-196 Z" fill="url(#${p}-skin)" stroke="${P.ink}" stroke-width="1.2"/>
    <path d="M28,-190 L34,-196 M42,-182 L48,-188" stroke="url(#${p}-gold)" stroke-width="4"/>`;
}

/** The four standing before the coffin. */
export function templeCourt({ id = 'ct' } = {}) {
  const p = id;
  const body = `${defs(p)}
    <ellipse cx="280" cy="410" rx="260" ry="9" fill="#000" opacity="0.5" filter="url(#${p}-b4)"/>
    <g transform="translate(78 404)">${priestess(p)}</g>
    <g transform="translate(188 404) scale(0.94)">${acolyte(p)}</g>
    <g transform="translate(340 404) scale(-1 1)">${scribe(p)}</g>
    <g transform="translate(470 404) scale(-1 1)">${noble(p)}</g>`;
  return svg('0 0 560 420', body, { ratio: 'xMidYMax meet', label: 'The priestesses, the scribe and the noble' });
}

/** All four bowed to the floor, foreheads down, arms before them. */
export function templeCourtBowed({ id = 'cb' } = {}) {
  const p = id;
  // Kneeling folded forward: hips high at the back, forehead on the floor, arms along it.
  const bowed = (x, scale, robe, head) => `<g transform="translate(${x} 200) scale(${scale})">
    <path d="M-72,0 L-50,-6 L-46,0 Z" fill="url(#${p}-skin)" stroke="${P.ink}" stroke-width="1.2"/>
    ${paint(p, `back${x}`, 'M-66,0 C-74,-34 -58,-72 -24,-78 C8,-82 38,-62 52,-38 L58,-20 L48,0 Z', {
      fill: robe,
      ink: P.ink,
      filter: `url(#${p}-cloth)`,
      strokes: [
        { d: 'M-58,-40 C-40,-70 0,-76 30,-58', c: '#ffffff', w: 8, o: 0.5, b: 4 },
        { d: 'M-62,-6 C-30,-2 10,-2 46,-6', c: P.linenLo, w: 12, o: 0.6, b: 4 },
        { d: 'M-40,-24 C-20,-20 0,-22 20,-30', c: P.linenLo, w: 2, o: 0.6, b: 0 },
      ],
    })}
    ${paint(p, `arm${x}`, 'M40,-26 C66,-18 94,-14 116,-14 L118,-4 C94,-2 66,-4 40,-10 Z', {
      fill: `url(#${p}-skin)`,
      ink: P.ink,
      strokes: [{ d: 'M44,-22 C70,-16 94,-12 114,-12', c: P.skinHi, w: 3, o: 0.5, b: 1 }],
    })}
    <path d="M114,-14 C120,-16 128,-12 128,-6 L124,-2 L114,-4 Z" fill="url(#${p}-skin)" stroke="${P.ink}" stroke-width="1"/>
    ${head}
  </g>`;
  const wigHead = `<path d="M46,-44 C62,-52 84,-44 86,-22 C86,-8 80,0 70,0 L50,0 C40,-12 38,-32 46,-44 Z" fill="url(#${p}-wig)" stroke="${P.ink}" stroke-width="1.4"/><path d="M50,-42 C64,-48 80,-42 84,-30" stroke="url(#${p}-gold)" stroke-width="3" fill="none"/>`;
  const baldHead = `<path d="M50,-36 C62,-48 84,-42 86,-22 C88,-8 80,0 70,0 L54,0 C46,-10 44,-26 50,-36 Z" fill="url(#${p}-skin)" stroke="${P.ink}" stroke-width="1.4"/><path d="M58,-38 C66,-42 76,-40 82,-32" stroke="${P.skinHi}" stroke-width="3" fill="none" opacity="0.7"/>`;
  const nemesHead = `<path d="M40,-46 C58,-58 84,-50 86,-26 C88,-10 82,0 72,0 L44,0 C34,-12 32,-34 40,-46 Z" fill="url(#${p}-nemes)" stroke="${P.ink}" stroke-width="1.4"/>${Array.from({ length: 5 }, (_, i) => `<path d="M38,${-42 + i * 8} L86,${-42 + i * 8}" stroke="${P.lapis}" stroke-width="3"/>`).join('')}`;
  const body = `${defs(p)}
    <ellipse cx="335" cy="206" rx="320" ry="8" fill="#000" opacity="0.5" filter="url(#${p}-b4)"/>
    ${bowed(72, 0.86, `url(#${p}-linen)`, wigHead)}
    ${bowed(234, 0.8, `url(#${p}-linen)`, wigHead)}
    ${bowed(392, 0.84, `url(#${p}-skin)`, baldHead)}
    ${bowed(552, 0.86, `url(#${p}-linen)`, nemesHead)}`;
  return svg('0 0 670 214', body, { ratio: 'xMidYMax meet', label: 'All four bowed to the floor' });
}
