import { brushes, f1, grain, linear, paint, radial, seeded, svg } from './kit.mjs';

/**
 * The Pharaoh's Tomb: painted reliefs of seven gods, a golden coffin, a sphinx and an Apis bull
 * in gilded stone, and the mummy that walks when the sand wins. Painted in the old Egyptian
 * palette (ochre, lapis, turquoise, gold, red earth) with soft modelling.
 */

const T = {
  ink: '#2a160a',
  ochre: '#b8742e',
  ochreHi: '#e8a85a',
  ochreLo: '#6e3a12',
  skin: '#a8532a',
  skinHi: '#d98a5a',
  skinLo: '#5e2a10',
  linen: '#efe6cf',
  linenLo: '#b5a888',
  lapis: '#1f3f8f',
  lapisHi: '#4a6fd0',
  turq: '#2aa39a',
  turqHi: '#7fe0d0',
  gold: '#e3b146',
  goldHi: '#fff0b0',
  goldLo: '#8a5c14',
  black: '#1b1714',
  red: '#b0322a',
  stone: '#c9a46a',
  stoneHi: '#ead09a',
  stoneLo: '#7a5a30',
};

function commonDefs(p) {
  return `${brushes(p)}
    ${linear(`${p}-gold`, [[0, T.goldHi], [0.4, T.gold], [1, T.goldLo]])}
    ${linear(`${p}-goldS`, [[0, T.goldLo], [0.3, T.goldHi], [0.6, T.gold], [1, T.goldLo]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-linen`, [[0, '#ffffff'], [0.5, T.linen], [1, T.linenLo]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-skin`, [[0, T.skinHi], [0.5, T.skin], [1, T.skinLo]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-lapis`, [[0, T.lapisHi], [0.5, T.lapis], [1, '#0c1a40']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-stone`, [[0, T.stoneHi], [0.45, T.stone], [1, T.stoneLo]], { x1: 0, y1: 0, x2: 1, y2: 0.3 })}
    ${grain(`${p}-grain`, { frequency: 0.9, octaves: 3, strength: 0.3, seed: 7 })}`;
}

/** A broad collar: bands of lapis, turquoise and gold between two arcs. */
function collar(cx, cy, rx, ry, bands = [T.gold, T.lapis, T.turq, T.gold, T.red]) {
  return bands
    .map((c, i) => {
      const r = rx - i * (rx / (bands.length + 1));
      const s = ry - i * (ry / (bands.length + 1));
      return `<path d="M${f1(cx - r)},${cy} A${f1(r)},${f1(s)} 0 0 0 ${f1(cx + r)},${cy}" fill="none" stroke="${c}" stroke-width="${f1(rx / (bands.length + 1))}"/>`;
    })
    .join('');
}

// —— the seven gods ——

const HEADS = {
  anubis: (p) => `
    <path d="M56,30 L72,28 L74,70 L54,72 Z" fill="${T.lapis}" stroke="${T.ink}" stroke-width="1.4"/>
    <path d="M58,36 L72,34 M58,44 L72,42 M57,52 L73,50 M56,60 L73,58" stroke="${T.gold}" stroke-width="2"/>
    ${paint(p, 'head', 'M62,42 C62,30 70,26 76,28 L82,4 L90,28 C94,30 96,34 98,38 L122,46 C125,48 124,54 118,54 L96,58 C90,62 82,66 72,66 C64,64 62,56 62,42 Z', {
      fill: T.black,
      ink: T.ink,
      strokes: [{ d: 'M70,32 C80,30 92,36 104,42', c: '#5a5a66', w: 4, o: 0.6, b: 2 }],
    })}
    <path d="M80,10 L84,26" stroke="#7a3a2a" stroke-width="2.4"/>
    <path d="M82,40 C86,36 92,36 94,40 C92,43 86,44 82,40 Z" fill="${T.goldHi}" stroke="${T.ink}" stroke-width="1"/><circle cx="89" cy="40" r="1.6" fill="${T.ink}"/>`,
  seth: (p) => `
    <path d="M56,30 L72,28 L74,70 L54,72 Z" fill="${T.lapis}" stroke="${T.ink}" stroke-width="1.4"/>
    <path d="M72,30 L74,6 L80,6 L78,28 M80,30 L86,8 L92,8 L84,30" fill="${T.ochreLo}" stroke="${T.ink}" stroke-width="1.6"/>
    ${paint(p, 'head', 'M62,44 C62,32 70,26 80,28 C92,30 100,36 108,42 C116,46 120,54 116,62 C112,58 106,54 98,56 C90,62 82,66 72,66 C64,64 62,56 62,44 Z', {
      fill: T.ochreLo,
      ink: T.ink,
      strokes: [{ d: 'M70,34 C84,32 100,38 110,46', c: T.ochreHi, w: 4, o: 0.5, b: 2 }],
    })}
    <path d="M86,40 C90,36 96,37 97,41 C95,44 89,44 86,40 Z" fill="${T.goldHi}" stroke="${T.ink}" stroke-width="1"/><circle cx="92" cy="40" r="1.6" fill="${T.ink}"/>`,
  thoth: (p) => `
    <path d="M56,34 L72,32 L74,70 L54,72 Z" fill="${T.lapis}" stroke="${T.ink}" stroke-width="1.4"/>
    <path d="M60,16 C62,26 72,30 80,30 C88,30 96,26 98,16 C94,22 88,24 80,24 C72,24 64,22 60,16 Z" fill="url(#${p}-gold)" stroke="${T.ink}" stroke-width="1.2"/>
    <circle cx="79" cy="12" r="10" fill="url(#${p}-gold)" stroke="${T.ink}" stroke-width="1.2"/>
    ${paint(p, 'head', 'M64,46 C64,36 72,30 80,32 C88,34 92,42 90,48 C88,56 80,62 72,62 C66,60 64,54 64,46 Z', { fill: T.black, ink: T.ink })}
    <path d="M88,42 C104,46 116,56 122,74 C116,68 104,56 88,50 Z" fill="${T.black}" stroke="${T.ink}" stroke-width="1.2"/>
    <circle cx="82" cy="42" r="2.4" fill="${T.goldHi}"/>`,
  khonsu: (p) => `
    <path d="M60,16 C62,26 72,30 80,30 C88,30 96,26 98,16 C94,22 88,24 80,24 C72,24 64,22 60,16 Z" fill="url(#${p}-gold)" stroke="${T.ink}" stroke-width="1.2"/>
    <circle cx="79" cy="10" r="10" fill="#f4f0e0" stroke="${T.ink}" stroke-width="1.2"/>
    <path d="M64,32 C60,40 58,56 62,70 C66,66 66,52 68,42" fill="${T.lapis}" stroke="${T.ink}" stroke-width="1.4"/>
    ${paint(p, 'head', 'M66,46 C66,36 72,30 80,30 C88,30 92,38 92,44 L96,50 L92,52 C92,58 88,64 80,64 C72,64 66,58 66,46 Z', {
      fill: `url(#${p}-skin)`,
      ink: T.ink,
    })}
    <path d="M64,34 C70,30 80,30 86,32 L86,38 L64,40 Z" fill="${T.lapis}" stroke="${T.ink}" stroke-width="1.2"/>
    <path d="M82,46 C85,44 89,44 90,46 C88,48 84,48 82,46 Z" fill="#fff" stroke="${T.ink}" stroke-width="0.9"/><path d="M90,46 L95,48" stroke="${T.ink}" stroke-width="1.2"/>
    <path d="M88,64 L90,72 L86,72 Z" fill="${T.lapis}" stroke="${T.ink}" stroke-width="1"/>`,
  khnum: (p) => `
    <path d="M56,30 L72,28 L74,70 L54,72 Z" fill="${T.lapis}" stroke="${T.ink}" stroke-width="1.4"/>
    <path d="M40,30 C52,22 66,26 70,30 M70,30 C80,22 104,22 118,30 C110,26 104,32 108,36" fill="none" stroke="${T.ink}" stroke-width="6" stroke-linecap="round"/>
    <path d="M40,30 C52,22 66,26 70,30 M70,30 C80,22 104,22 118,30 C110,26 104,32 108,36" fill="none" stroke="${T.stoneHi}" stroke-width="3.6" stroke-linecap="round"/>
    ${paint(p, 'head', 'M62,44 C62,34 70,30 80,32 C92,34 100,40 106,48 C110,54 108,60 102,60 L96,60 C90,64 82,66 72,66 C64,64 62,56 62,44 Z', {
      fill: '#d8c8a8',
      ink: T.ink,
      strokes: [{ d: 'M68,58 C76,62 88,62 98,58', c: '#8a7a5a', w: 4, o: 0.6, b: 2 }],
    })}
    <path d="M70,46 C70,40 76,36 80,42 C78,48 74,50 70,46 Z" fill="none" stroke="#8a7a5a" stroke-width="1.6"/>
    <circle cx="88" cy="42" r="2" fill="${T.ink}"/>`,
  atum: (p) => `
    <path d="M62,34 L62,12 L69,12 L69,24 L94,24 L94,36 Z" fill="${T.red}" stroke="${T.ink}" stroke-width="1.4"/>
    <path d="M70,26 C70,4 75,-10 80,-10 C85,-10 90,4 90,26 Z" fill="#f4f0e2" stroke="${T.ink}" stroke-width="1.4"/>
    <path d="M69,24 C76,22 80,16 82,10" fill="none" stroke="${T.goldLo}" stroke-width="1.6"/>
    ${paint(p, 'head', 'M66,46 C66,36 72,32 80,32 C88,32 92,38 92,44 L96,50 L92,52 C92,58 88,64 80,64 C72,64 66,58 66,46 Z', { fill: `url(#${p}-skin)`, ink: T.ink })}
    <path d="M82,46 C85,44 89,44 90,46 C88,48 84,48 82,46 Z" fill="#fff" stroke="${T.ink}" stroke-width="0.9"/><path d="M90,46 L95,48" stroke="${T.ink}" stroke-width="1.2"/>
    <path d="M86,64 L90,76 L84,76 Z" fill="${T.lapis}" stroke="${T.ink}" stroke-width="1"/>
    <path d="M64,36 C60,46 60,58 64,68 L70,66 L70,38 Z" fill="${T.lapis}" stroke="${T.ink}" stroke-width="1.2"/>`,
  amun: (p) => `
    <path d="M70,30 L70,-32 C70,-36 76,-36 76,-32 L77,30 Z M79,30 L80,-32 C80,-36 86,-36 86,-32 L86,30 Z" fill="#f2ead2" stroke="${T.ink}" stroke-width="1.2"/>
    ${Array.from({ length: 7 }, (_, i) => `<path d="M70,${-24 + i * 8} L77,${-24 + i * 8} M80,${-24 + i * 8} L86,${-24 + i * 8}" stroke="${i % 2 ? T.lapis : T.red}" stroke-width="2"/>`).join('')}
    <path d="M64,28 L92,28 L92,38 L64,38 Z" fill="url(#${p}-gold)" stroke="${T.ink}" stroke-width="1.2"/>
    ${paint(p, 'head', 'M66,46 C66,38 72,36 80,36 C88,36 92,40 92,46 L96,52 L92,54 C92,60 88,64 80,64 C72,64 66,58 66,46 Z', {
      fill: `url(#${p}-lapis)`,
      ink: T.ink,
    })}
    <path d="M82,48 C85,46 89,46 90,48 C88,50 84,50 82,48 Z" fill="#fff" stroke="${T.ink}" stroke-width="0.9"/>
    <path d="M86,64 L90,78 L84,78 Z" fill="${T.lapis}" stroke="${T.ink}" stroke-width="1"/>`,
};

const GLYPHS = [
  (x, y) => `<path d="M${x - 6},${y + 6} C${x - 6},${y - 4} ${x + 6},${y - 4} ${x + 6},${y + 6} Z" fill="${T.ink}"/>`,
  (x, y) => `<path d="M${x - 8},${y} l4,-3 l4,3 l4,-3 l4,3" stroke="${T.lapis}" stroke-width="2" fill="none"/><path d="M${x - 8},${y + 5} l4,-3 l4,3 l4,-3 l4,3" stroke="${T.lapis}" stroke-width="2" fill="none"/>`,
  (x, y) => `<path d="M${x},${y - 8} L${x},${y + 8} M${x},${y - 8} C${x + 6},${y - 6} ${x + 4},${y - 2} ${x},${y - 2}" stroke="${T.ink}" stroke-width="2" fill="none"/>`,
  (x, y) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="4" fill="#fff" stroke="${T.ink}" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="2.4" fill="${T.ink}"/><path d="M${x - 4},${y + 4} l-2,6" stroke="${T.ink}" stroke-width="1.4"/>`,
  (x, y) => `<circle cx="${x}" cy="${y - 4}" r="4" fill="none" stroke="${T.gold}" stroke-width="2"/><path d="M${x - 6},${y + 1} L${x + 6},${y + 1} M${x},${y} L${x},${y + 10}" stroke="${T.gold}" stroke-width="2"/>`,
  (x, y) => `<path d="M${x - 6},${y + 6} C${x - 8},${y - 2} ${x - 2},${y - 8} ${x + 4},${y - 6} L${x + 8},${y - 8} L${x + 6},${y - 2} C${x + 8},${y + 2} ${x + 4},${y + 6} ${x - 6},${y + 6} Z" fill="${T.red}" stroke="${T.ink}" stroke-width="1"/>`,
  (x, y) => `<path d="M${x - 8},${y + 6} L${x + 8},${y + 6} L${x + 4},${y - 6} L${x - 4},${y - 6} Z" fill="${T.turq}" stroke="${T.ink}" stroke-width="1"/>`,
];

/** A god painted on the wall in profile: one shared body, a head of his own, a column of signs. */
export function deity(name, { id = `dy-${name}` } = {}) {
  const p = id;
  const rand = seeded(name.length * 13 + name.charCodeAt(0));
  const skin = name === 'amun' ? `url(#${p}-lapis)` : `url(#${p}-skin)`;
  const glyphs = Array.from({ length: 6 }, (_, i) => GLYPHS[Math.floor(rand() * GLYPHS.length)](172, 14 + i * 34)).join('');
  const body = `
    <rect x="152" y="-2" width="40" height="214" fill="none" stroke="${T.ink}" stroke-width="1.2" opacity="0.7"/>
    ${glyphs}
    ${paint(p, 'armBack', 'M48,82 C40,104 38,126 40,148 L50,148 C50,126 54,106 58,86 Z', { fill: skin, ink: T.ink, strokes: [{ d: 'M50,88 L46,146', c: T.skinLo, w: 6, o: 0.5, b: 2 }] })}
    <ellipse cx="44" cy="158" rx="5" ry="7" fill="none" stroke="url(#${p}-gold)" stroke-width="3"/>
    <path d="M36,166 L52,166 M44,165 L44,190" stroke="url(#${p}-gold)" stroke-width="3.4"/>
    ${paint(p, 'legBack', 'M60,168 L74,168 L68,226 L56,226 Z', { fill: skin, ink: T.ink, strokes: [{ d: 'M70,170 L64,224', c: T.skinLo, w: 5, o: 0.5, b: 2 }] })}
    <path d="M50,224 L72,224 L74,232 L44,232 Z" fill="${skin}" stroke="${T.ink}" stroke-width="1.4"/>
    ${paint(p, 'legFront', 'M80,168 L94,168 L106,226 L94,226 Z', { fill: skin, ink: T.ink, strokes: [{ d: 'M84,170 L96,224', c: T.skinHi, w: 4, o: 0.5, b: 2 }] })}
    <path d="M92,224 L114,224 L118,232 L88,232 Z" fill="${skin}" stroke="${T.ink}" stroke-width="1.4"/>
    ${paint(p, 'torso', 'M48,78 C56,74 92,74 100,80 L96,96 C92,108 90,116 88,122 L58,122 C56,110 52,96 48,78 Z', {
      fill: skin,
      ink: T.ink,
      strokes: [
        { d: 'M94,82 C90,100 88,112 86,120', c: T.skinLo, w: 8, o: 0.5, b: 4 },
        { d: 'M56,84 C58,98 60,110 62,120', c: T.skinHi, w: 6, o: 0.45, b: 4 },
      ],
    })}
    ${collar(74, 80, 26, 18)}
    ${paint(p, 'kilt', 'M56,120 L90,120 L104,170 L50,170 Z', {
      fill: `url(#${p}-linen)`,
      ink: T.ink,
      strokes: [{ d: 'M86,124 L98,168', c: T.linenLo, w: 8, o: 0.6, b: 4 }],
      after: Array.from({ length: 6 }, (_, i) => `<path d="M${66 + i * 6},124 L${62 + i * 8},170" stroke="${T.linenLo}" stroke-width="1" opacity="0.8"/>`).join(''),
    })}
    <path d="M56,120 L90,120 L90,128 L56,128 Z" fill="url(#${p}-gold)" stroke="${T.ink}" stroke-width="1"/>
    <path d="M114,36 L114,232 M110,232 L114,224 L118,232" stroke="${T.ink}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M114,36 L114,232" stroke="url(#${p}-gold)" stroke-width="3" stroke-linecap="round"/>
    <path d="M110,40 L114,34 L124,30 L120,38 Z" fill="url(#${p}-gold)" stroke="${T.ink}" stroke-width="1"/>
    ${paint(p, 'armFront', 'M94,82 C102,94 106,108 106,118 L116,120 L116,130 L102,130 C96,118 90,100 86,88 Z', { fill: skin, ink: T.ink, strokes: [{ d: 'M96,88 C100,100 104,112 104,122', c: T.skinHi, w: 4, o: 0.5, b: 2 }] })}
    <path d="M98,108 L108,108" stroke="url(#${p}-gold)" stroke-width="4"/>
    <path d="M68,62 L80,62 L82,78 L66,78 Z" fill="${skin}" stroke="${T.ink}" stroke-width="1.2"/>
    ${HEADS[name](p)}`;
  return svg('0 -40 200 280', `<defs>${commonDefs(p)}</defs>${body}`, { ratio: 'xMidYMid meet' });
}

export const GODS = ['anubis', 'seth', 'thoth', 'khonsu', 'khnum', 'atum', 'amun'];

/** A golden anthropoid coffin standing upright: nemes, crook and flail, feathered body. */
export function sarcophagus({ id = 'sc' } = {}) {
  const p = id;
  const feathers = Array.from({ length: 9 }, (_, i) => {
    const y = 170 + i * 20;
    return `<path d="M30,${y} C44,${y + 10} 76,${y + 10} 90,${y}" fill="none" stroke="${i % 2 ? T.lapis : T.turq}" stroke-width="5"/>
      <path d="M30,${y} C44,${y + 10} 76,${y + 10} 90,${y}" fill="none" stroke="${T.goldLo}" stroke-width="1"/>`;
  }).join('');
  const body = `<defs>${commonDefs(p)}
      ${linear(`${p}-coffin`, [[0, T.goldLo], [0.25, T.goldHi], [0.5, T.gold], [0.8, '#a8741e'], [1, '#4a2e08']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    </defs>
    <ellipse cx="60" cy="376" rx="52" ry="6" fill="#000" opacity="0.55" filter="url(#${p}-b4)"/>
    ${paint(p, 'case', 'M60,8 C82,8 96,26 98,52 C108,70 110,96 104,130 C110,200 106,290 96,368 L24,368 C14,290 10,200 16,130 C10,96 12,70 22,52 C24,26 38,8 60,8 Z', {
      fill: `url(#${p}-coffin)`,
      ink: T.ink,
      line: 2,
      strokes: [
        { d: 'M94,60 C104,140 102,260 92,364', c: '#2a1804', w: 14, o: 0.45, b: 7 },
        { d: 'M28,70 C22,150 22,260 30,364', c: T.goldHi, w: 8, o: 0.5, b: 4 },
      ],
      after: feathers,
    })}
    ${Array.from({ length: 6 }, (_, i) => `<path d="M${30 - i * 2},${48 + i * 14} L${90 + i * 2},${48 + i * 14}" stroke="${i % 2 ? T.gold : T.lapis}" stroke-width="7"/>`).join('')}
    ${paint(p, 'face', 'M42,40 C42,28 50,22 60,22 C70,22 78,28 78,40 C78,56 72,68 60,70 C48,68 42,56 42,40 Z', {
      fill: `url(#${p}-gold)`,
      ink: T.ink,
      strokes: [{ d: 'M72,34 C76,46 74,58 66,66', c: T.goldLo, w: 6, o: 0.5, b: 2 }],
    })}
    <path d="M40,22 C46,14 74,14 80,22 L82,34 L38,34 Z" fill="${T.lapis}" stroke="${T.ink}" stroke-width="1.2"/>
    <path d="M44,40 C48,37 54,37 56,40 C54,42 48,42 44,40 Z M64,40 C66,37 72,37 76,40 C72,42 66,42 64,40 Z" fill="#fff" stroke="${T.ink}" stroke-width="1.6"/>
    <circle cx="50" cy="40" r="1.8" fill="${T.ink}"/><circle cx="70" cy="40" r="1.8" fill="${T.ink}"/>
    <path d="M40,38 L36,42 M80,38 L84,42" stroke="${T.ink}" stroke-width="1.6"/>
    <path d="M56,62 C58,64 62,64 64,62" stroke="${T.ink}" stroke-width="1.4" fill="none"/>
    <path d="M56,70 L64,70 L62,92 L58,92 Z" fill="${T.lapis}" stroke="${T.ink}" stroke-width="1"/>
    <path d="M56,24 L60,14 L64,24 Z" fill="url(#${p}-gold)" stroke="${T.ink}" stroke-width="1"/>
    ${collar(60, 96, 40, 30)}
    <path d="M30,140 L90,126 L92,138 L32,152 Z M30,126 L90,140 L88,152 L28,138 Z" fill="url(#${p}-goldS)" stroke="${T.ink}" stroke-width="1.2"/>
    <path d="M40,120 C36,128 38,136 44,134 L48,160" stroke="${T.lapis}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M80,120 L76,164 M76,164 L68,170 M76,164 L76,174 M76,164 L84,170" stroke="${T.gold}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <rect x="50" y="200" width="20" height="150" fill="${T.linen}" stroke="${T.ink}" stroke-width="1"/>
    ${Array.from({ length: 7 }, (_, i) => GLYPHS[i % GLYPHS.length](60, 212 + i * 20)).join('')}`;
  return svg('0 0 120 380', body, { ratio: 'xMidYMax meet' });
}

/** A sphinx couchant on a carved plinth, gilded stone with a lapis-striped headcloth. */
export function sphinx({ id = 'sx' } = {}) {
  const p = id;
  const plinthGlyphs = Array.from({ length: 12 }, (_, i) => GLYPHS[i % GLYPHS.length](40 + i * 26, 214)).join('');
  const body = `<defs>${commonDefs(p)}</defs>
    <ellipse cx="180" cy="236" rx="170" ry="6" fill="#000" opacity="0.6" filter="url(#${p}-b4)"/>
    ${paint(p, 'plinth', 'M12,190 L348,190 L344,234 L16,234 Z', {
      fill: `url(#${p}-stone)`,
      ink: T.ink,
      filter: `url(#${p}-grain)`,
      strokes: [{ d: 'M14,194 L346,194', c: T.stoneHi, w: 4, o: 0.6, b: 1 }],
      after: `<rect x="24" y="200" width="312" height="28" fill="#3a2a14" opacity="0.35"/>${plinthGlyphs}`,
    })}
    ${paint(p, 'body', 'M98,120 C120,104 200,100 260,108 C300,112 324,130 330,160 C334,176 330,188 320,190 L80,190 C70,170 76,136 98,120 Z', {
      fill: `url(#${p}-stone)`,
      ink: T.ink,
      filter: `url(#${p}-grain)`,
      strokes: [
        { d: 'M110,116 C160,106 230,104 290,116', c: T.stoneHi, w: 10, o: 0.6, b: 4 },
        { d: 'M100,180 C160,186 260,186 320,180', c: T.stoneLo, w: 14, o: 0.6, b: 7 },
        { d: 'M300,130 C316,146 320,166 312,186', c: T.stoneLo, w: 10, o: 0.5, b: 4 },
      ],
    })}
    ${paint(p, 'hind', 'M262,140 C292,136 314,152 316,176 C316,186 306,190 296,190 L258,190 C248,170 248,150 262,140 Z', { fill: `url(#${p}-stone)`, ink: T.ink, strokes: [{ d: 'M270,148 C290,146 304,160 306,176', c: T.stoneHi, w: 5, o: 0.5, b: 2 }] })}
    <path d="M326,170 C342,160 352,170 346,182 C340,190 330,188 326,184" fill="none" stroke="${T.ink}" stroke-width="5" stroke-linecap="round"/>
    <path d="M326,170 C342,160 352,170 346,182" fill="none" stroke="${T.stone}" stroke-width="3" stroke-linecap="round"/>
    ${paint(p, 'paws', 'M60,174 L130,174 C140,176 140,190 130,190 L54,190 C44,190 44,176 60,174 Z', { fill: `url(#${p}-stone)`, ink: T.ink, strokes: [{ d: 'M60,178 L128,178', c: T.stoneHi, w: 4, o: 0.6, b: 1 }] })}
    <path d="M54,182 L46,190 M62,182 L56,190 M70,182 L66,190" stroke="${T.ink}" stroke-width="1.6"/>
    ${paint(p, 'chest', 'M74,98 C90,84 130,84 146,100 C156,120 154,152 142,172 C130,184 96,184 82,172 C68,152 64,118 74,98 Z', {
      fill: `url(#${p}-stone)`,
      ink: T.ink,
      filter: `url(#${p}-grain)`,
      strokes: [
        { d: 'M140,104 C150,128 148,156 136,174', c: T.stoneLo, w: 12, o: 0.55, b: 4 },
        { d: 'M80,108 C74,128 76,150 86,168', c: T.stoneHi, w: 8, o: 0.5, b: 4 },
      ],
    })}
    ${collar(110, 106, 34, 26, [T.gold, T.lapis, T.turq, T.gold, T.lapis])}
<g transform="translate(0 16)">    ${paint(p, 'nemes', 'M78,52 C80,30 98,20 112,22 C128,24 138,38 138,58 L140,96 L126,112 L126,74 L94,74 L94,112 L80,98 Z', {
      fill: `url(#${p}-gold)`,
      ink: T.ink,
      after: Array.from({ length: 9 }, (_, i) => `<path d="M76,${40 + i * 7} L142,${40 + i * 7}" stroke="${T.lapis}" stroke-width="3"/>`).join(''),
    })}
    ${paint(p, 'face', 'M96,50 C96,40 104,36 110,36 C118,36 124,42 124,52 C124,66 118,76 110,78 C102,76 96,66 96,50 Z', {
      fill: `url(#${p}-stone)`,
      ink: T.ink,
      strokes: [{ d: 'M120,48 C122,60 118,70 112,76', c: T.stoneLo, w: 5, o: 0.6, b: 2 }],
    })}
    <path d="M100,52 C103,50 107,50 108,52 C106,54 102,54 100,52 Z M113,52 C115,50 119,50 121,52 C119,54 115,54 113,52 Z" fill="#fff" stroke="${T.ink}" stroke-width="1.2"/>
    <circle cx="104" cy="52" r="1.2" fill="${T.ink}"/><circle cx="117" cy="52" r="1.2" fill="${T.ink}"/>
    <path d="M106,70 C108,71 112,71 114,70" stroke="${T.ink}" stroke-width="1.2" fill="none"/>
    <path d="M106,78 L114,78 L112,96 L108,96 Z" fill="${T.lapis}" stroke="${T.ink}" stroke-width="1"/>
    <path d="M108,36 L110,26 L112,36 Z" fill="url(#${p}-gold)" stroke="${T.ink}" stroke-width="1"/></g>`;
  return svg('0 0 360 240', body, { ratio: 'xMidYMax meet' });
}

/** An Apis bull in black stone: gold sun disc between the horns, a jewelled blanket, a base. */
export function apis({ id = 'ap' } = {}) {
  const p = id;
  const bull = { fill: '#1d2a44', hi: '#4a5f8a', lo: '#070b14' };
  const body = `<defs>${commonDefs(p)}
      ${radial(`${p}-disc`, [[0, T.goldHi], [0.5, T.gold], [1, T.goldLo]], { cx: 0.35, cy: 0.3 })}
    </defs>
    <ellipse cx="150" cy="232" rx="140" ry="6" fill="#000" opacity="0.6" filter="url(#${p}-b4)"/>
    ${paint(p, 'base', 'M16,206 C40,198 260,198 284,206 L280,226 C250,234 50,234 20,226 Z', {
      fill: '#9a6a3a',
      ink: T.ink,
      filter: `url(#${p}-grain)`,
      strokes: [{ d: 'M20,208 C60,202 240,202 280,208', c: '#d8a26a', w: 4, o: 0.6, b: 1 }],
    })}
    ${['M78,170 L92,170 L90,206 L76,206 Z', 'M200,170 L214,170 L218,206 L204,206 Z']
      .map((d, i) => paint(p, `legB${i}`, d, { fill: bull.lo, ink: T.ink }))
      .join('')}
    ${paint(p, 'body', 'M60,110 C80,92 200,88 236,100 C250,106 256,124 252,150 C250,170 236,178 220,178 L80,180 C60,178 50,160 52,140 C52,126 54,116 60,110 Z', {
      fill: bull.fill,
      ink: T.ink,
      strokes: [
        { d: 'M70,104 C120,94 190,92 232,104', c: bull.hi, w: 10, o: 0.6, b: 4 },
        { d: 'M64,172 C120,180 200,180 240,170', c: bull.lo, w: 16, o: 0.7, b: 7 },
      ],
    })}
    ${['M96,170 L110,170 L108,206 L94,206 Z', 'M222,166 L236,166 L240,206 L226,206 Z']
      .map((d, i) => paint(p, `legF${i}`, d, { fill: bull.fill, ink: T.ink, strokes: [{ d: d.split(' ')[0].replace('M', 'M') + ' L' + d.split(' ')[3].slice(1), c: bull.hi, w: 3, o: 0.4, b: 1 }] }))
      .join('')}
    ${[[92, 206], [106, 206], [232, 206], [214, 206]].map(([x, y]) => `<path d="M${x - 8},${y} L${x + 6},${y} L${x + 4},${y - 6} L${x - 6},${y - 6} Z" fill="url(#${p}-gold)" stroke="${T.ink}" stroke-width="1"/>`).join('')}
    <path d="M56,120 C40,126 30,144 34,164" fill="none" stroke="${T.ink}" stroke-width="4" stroke-linecap="round"/>
    ${paint(p, 'blanket', 'M100,96 L196,92 L204,150 L96,154 Z', {
      fill: T.red,
      ink: T.ink,
      after: `<rect x="108" y="104" width="86" height="40" fill="none" stroke="${T.gold}" stroke-width="3"/>
        ${Array.from({ length: 5 }, (_, i) => `<rect x="${114 + i * 16}" y="110" width="12" height="28" fill="${i % 2 ? T.turq : T.lapis}" stroke="${T.goldLo}" stroke-width="1"/>`).join('')}
        <path d="M96,154 L204,150" stroke="${T.gold}" stroke-width="4"/>`,
    })}
    ${paint(p, 'neck', 'M224,96 C236,84 254,82 262,92 C270,104 270,122 262,136 L236,148 C228,130 222,112 224,96 Z', {
      fill: bull.fill,
      ink: T.ink,
      strokes: [{ d: 'M232,96 C246,90 256,92 262,100', c: bull.hi, w: 6, o: 0.5, b: 2 }],
    })}
    ${paint(p, 'head', 'M248,92 C262,84 280,90 284,104 C288,118 284,134 276,140 C266,146 256,140 252,128 C248,116 244,102 248,92 Z', {
      fill: bull.fill,
      ink: T.ink,
      strokes: [{ d: 'M258,92 C270,92 280,100 282,112', c: bull.hi, w: 5, o: 0.5, b: 2 }],
    })}
    <path d="M250,90 C240,72 246,58 258,56 M270,88 C276,70 290,64 298,72" fill="none" stroke="${T.ink}" stroke-width="7" stroke-linecap="round"/>
    <path d="M250,90 C240,72 246,58 258,56 M270,88 C276,70 290,64 298,72" fill="none" stroke="#ece4cc" stroke-width="4.4" stroke-linecap="round"/>
    <circle cx="268" cy="54" r="20" fill="url(#${p}-disc)" stroke="${T.ink}" stroke-width="1.6"/>
    <path d="M256,40 C262,36 270,36 276,40" stroke="${T.goldHi}" stroke-width="2.4" fill="none"/>
    <path d="M262,72 C266,66 276,66 280,72 L272,80 Z" fill="${T.turq}" stroke="${T.ink}" stroke-width="1"/>
    <path d="M266,104 C269,102 273,102 274,105 C271,107 268,107 266,104 Z" fill="${T.goldHi}" stroke="${T.ink}" stroke-width="1"/>
    <path d="M258,130 L278,124" stroke="${T.gold}" stroke-width="3"/>
    ${collar(246, 118, 16, 20, [T.gold, T.turq, T.gold])}`;
  return svg('0 0 300 240', body, { ratio: 'xMidYMax meet' });
}

/**
 * The mummy: linen bandages wound and trailing, eyes glowing in the wraps. It is never still: it
 * sways on its feet, its arms reach and sag, its head lolls and the loose ends of its bandages
 * stir. The motion is CSS inside the picture, stopped for reduced motion and for the Hall's pause.
 */
export function mummy({ id = 'mm' } = {}) {
  const p = id;
  const rand = seeded(29);
  const wraps = (x0, y0, x1, y1, n, tilt) =>
    Array.from({ length: n }, (_, i) => {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t + rand() * 4;
      return `<path d="M${f1(x - 40)},${f1(y)} q40,${f1(tilt + rand() * 4)} 80,${f1(tilt * 2 + rand() * 4)}" stroke="#7a6a50" stroke-width="${f1(1 + rand() * 1.2)}" fill="none" opacity="0.85"/>`;
    }).join('');
  const limb = (key, d, after, strokes = []) =>
    paint(p, key, d, { fill: `url(#${p}-wrap)`, ink: T.ink, filter: `url(#${p}-grain)`, after, strokes });
  const strip = (d) => `<path d="${d}" stroke="#2a2014" stroke-width="7" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#d8cdb0" stroke-width="4.4" fill="none" stroke-linecap="round"/>`;
  const body = `<defs>${commonDefs(p)}
      ${linear(`${p}-wrap`, [[0, '#f2ead2'], [0.45, '#cfc3a4'], [1, '#6e624a']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
      ${radial(`${p}-eye`, [[0, '#fff8c0'], [0.4, '#ffb030'], [1, '#ff6010', 0]])}
      <style>
        .${p}-sway { transform-box: view-box; transform-origin: 118px 404px; animation: ${p}-sway 3.4s ease-in-out infinite; }
        .${p}-reach { transform-box: view-box; transform-origin: 126px 100px; animation: ${p}-reach 2.3s ease-in-out infinite; }
        .${p}-sag { transform-box: view-box; transform-origin: 86px 102px; animation: ${p}-sag 2.9s ease-in-out infinite; }
        .${p}-loll { transform-box: view-box; transform-origin: 104px 78px; animation: ${p}-loll 3.1s ease-in-out infinite; }
        .${p}-flutter { transform-box: fill-box; transform-origin: 50% 0; animation: ${p}-flutter 1.3s ease-in-out infinite; }
        @keyframes ${p}-sway { 0%, 100% { transform: rotate(-2.4deg) translateX(-2px); } 50% { transform: rotate(2.2deg) translateX(3px); } }
        @keyframes ${p}-reach { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(5deg); } }
        @keyframes ${p}-sag { 0%, 100% { transform: rotate(4deg); } 50% { transform: rotate(-6deg); } }
        @keyframes ${p}-loll { 0%, 100% { transform: rotate(-5deg); } 40% { transform: rotate(4deg); } 70% { transform: rotate(-1deg); } }
        @keyframes ${p}-flutter { 0%, 100% { transform: rotate(-9deg); } 50% { transform: rotate(10deg); } }
        .reduced-motion .${p}-sway, .reduced-motion .${p}-reach, .reduced-motion .${p}-sag, .reduced-motion .${p}-loll, .reduced-motion .${p}-flutter { animation: none; }
        @media (prefers-reduced-motion: reduce) { .${p}-sway, .${p}-reach, .${p}-sag, .${p}-loll, .${p}-flutter { animation: none; } }
      </style>
    </defs>
    <ellipse cx="124" cy="412" rx="72" ry="6" fill="#000" opacity="0.5" filter="url(#${p}-b4)"/>
    <g class="${p}-sway">
      <g class="${p}-sag">
        ${limb('armBack', 'M84,92 C110,106 140,120 170,128 C182,131 180,146 168,146 C138,142 108,130 80,116 Z', wraps(94, 102, 170, 134, 8, 4))}
        <path d="M166,126 C176,124 184,128 186,136 M170,138 C178,142 182,148 180,154" stroke="#2a2014" stroke-width="4" fill="none" stroke-linecap="round"/>
        <g class="${p}-flutter">${strip('M140,128 C142,140 138,150 142,160')}</g>
      </g>
      ${limb('legBack', 'M80,204 L110,204 C112,256 108,306 104,354 L108,400 L80,404 L80,354 C78,306 78,256 80,204 Z', wraps(80, 214, 104, 398, 13, 3), [{ d: 'M104,206 C102,280 100,340 100,398', c: '#3a3020', w: 8, o: 0.45, b: 4 }])}
      ${limb('legFront', 'M108,204 L140,204 C146,256 152,306 156,352 L170,396 L144,406 L132,356 C122,306 112,256 108,204 Z', wraps(114, 214, 156, 398, 13, 4))}
      <path d="M80,398 L106,398 L108,408 L76,408 Z M140,398 L166,394 L170,404 L142,408 Z" fill="#b8ad90" stroke="${T.ink}" stroke-width="1.4"/>
      ${limb('torso', 'M70,86 C88,74 124,74 142,86 C150,110 150,150 148,170 C146,190 140,204 134,212 L80,212 C74,198 68,178 68,150 C66,120 66,100 70,86 Z', wraps(72, 92, 146, 206, 14, 5), [
        { d: 'M132,92 C140,140 140,180 132,204', c: '#3a3020', w: 14, o: 0.45, b: 7 },
        { d: 'M82,94 C78,140 80,180 86,204', c: '#fffaf0', w: 8, o: 0.4, b: 4 },
      ])}
      <g class="${p}-flutter">${strip('M88,200 C84,220 90,236 84,254')}</g>
      <g class="${p}-flutter" style="animation-delay: -0.6s">${strip('M128,204 C132,222 126,236 132,250')}</g>
      <g class="${p}-loll">
        <path d="M94,66 L114,66 L116,86 L92,86 Z" fill="#b8ad90" stroke="${T.ink}" stroke-width="1.2"/>
        ${limb('head', 'M82,22 C94,8 120,10 125,28 C130,44 126,62 116,70 C106,78 90,76 82,66 C74,54 74,32 82,22 Z', wraps(80, 26, 124, 70, 7, 3), [
          { d: 'M116,28 C122,42 120,56 112,64', c: '#3a3020', w: 8, o: 0.5, b: 4 },
        ])}
        <path d="M86,45 L124,38" stroke="#1a1208" stroke-width="10" stroke-linecap="round"/>
        <circle cx="98" cy="43" r="8" fill="url(#${p}-eye)"/><circle cx="113" cy="40" r="7" fill="url(#${p}-eye)"/>
        <circle cx="98" cy="43" r="2" fill="#fff"/><circle cx="113" cy="40" r="1.8" fill="#fff"/>
        <g class="${p}-flutter" style="animation-delay: -0.3s">${strip('M88,30 C78,34 74,44 76,54')}</g>
      </g>
      <g class="${p}-reach">
        ${limb('armFront', 'M124,88 C150,86 174,90 196,96 C208,99 208,115 196,117 C174,117 150,114 126,112 Z', wraps(132, 94, 198, 112, 8, 2))}
        <path d="M196,98 C206,100 210,106 208,112 M196,106 C204,110 206,116 204,122 M194,110 C200,116 200,122 196,128" stroke="#2a2014" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M196,98 C206,100 210,106 208,112 M196,106 C204,110 206,116 204,122 M194,110 C200,116 200,122 196,128" stroke="#cfc3a4" stroke-width="2" fill="none" stroke-linecap="round"/>
        <g class="${p}-flutter" style="animation-delay: -0.9s">${strip('M160,110 C162,122 156,132 160,144')}</g>
      </g>
    </g>`;
  return svg('0 0 210 422', body, { ratio: 'xMidYMax meet' });
}

/**
 * A wall torch in the Egyptian manner: a bronze bracket ending in a gilded lotus cup. Its rim
 * sits where the animated flame burns (as `wallTorch` in hold.mjs: 82 × 220, rim at 88).
 */
export function lotusTorch({ id = 'lt' } = {}) {
  const p = id;
  const body = `<defs>${commonDefs(p)}
      ${linear(`${p}-bronze`, [[0, '#e0a868'], [0.4, '#9a5a28'], [1, '#3a1c08']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
      ${radial(`${p}-ember`, [[0, '#ffdf8a', 0.95], [0.5, '#ff7a1a', 0.6], [1, '#ff4a10', 0]])}
    </defs>
    <rect x="30" y="150" width="22" height="56" rx="3" fill="#000" opacity="0.35" filter="url(#${p}-b4)"/>
    ${paint(p, 'plate', 'M28,146 L54,146 L56,204 L26,204 Z', {
      fill: `url(#${p}-bronze)`,
      ink: T.ink,
      strokes: [{ d: 'M30,150 L30,200', c: '#ffd8a0', w: 3, o: 0.5, b: 1 }],
      after: `<path d="M34,160 L48,160 M34,190 L48,190" stroke="${T.goldLo}" stroke-width="2"/><circle cx="41" cy="175" r="6" fill="none" stroke="url(#${p}-gold)" stroke-width="2.4"/>`,
    })}
    <path d="M41,146 C41,130 41,118 41,108" stroke="${T.ink}" stroke-width="9"/>
    <path d="M41,146 C41,130 41,118 41,108" stroke="url(#${p}-bronze)" stroke-width="6"/>
    ${[116, 128, 140].map((y) => `<path d="M35,${y} L47,${y}" stroke="url(#${p}-gold)" stroke-width="3"/>`).join('')}
    ${paint(p, 'cup', 'M22,88 C24,100 32,108 41,110 C50,108 58,100 60,88 C52,92 46,92 41,90 C36,92 30,92 22,88 Z', {
      fill: `url(#${p}-gold)`,
      ink: T.ink,
      strokes: [{ d: 'M54,92 C52,100 48,106 42,108', c: T.goldLo, w: 5, o: 0.6, b: 2 }],
    })}
    <path d="M30,90 C32,98 36,104 41,108 M52,90 C50,98 46,104 41,108 M41,90 L41,108" stroke="${T.goldLo}" stroke-width="1.4" fill="none"/>
    <path d="M24,90 C18,86 16,80 20,76 C24,80 26,84 28,88 Z M58,90 C64,86 66,80 62,76 C58,80 56,84 54,88 Z" fill="${T.turq}" stroke="${T.ink}" stroke-width="1.2"/>
    <ellipse cx="41" cy="88" rx="18" ry="4.4" fill="#3a1c08" stroke="${T.ink}" stroke-width="1.2"/>
    <ellipse cx="41" cy="87" rx="14" ry="3.4" fill="url(#${p}-ember)"/>`;
  return svg('0 0 82 220', body, { ratio: 'xMidYMid meet' });
}
