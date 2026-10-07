import { brushes, f1, grain, linear, paint, radial, rod, svg } from './kit.mjs';

/**
 * What is left of Captain Blackrot when the hold floods: his bones come apart and float with
 * his coat, his boot and his peg among the flotsam. Same bone, cloth and leather as the
 * standing captain, so the player sees it is him.
 */

const C = {
  ink: '#1a100a',
  bone: '#e9dbbb',
  boneHi: '#fff8e4',
  boneLo: '#b09a6f',
  boneDeep: '#6a5537',
  void: '#0f0805',
  navy: '#2e417c',
  navyHi: '#5a74b8',
  navyLo: '#1a2550',
  navyDeep: '#0d1330',
  red: '#a3262d',
  redLo: '#560f15',
  gold: '#e1ae47',
  goldLo: '#87591a',
  leather: '#553520',
  leatherHi: '#8f6640',
  leatherLo: '#211309',
  wood: '#9c6c3b',
  woodHi: '#d9aa70',
  woodLo: '#563619',
  iron: '#34363c',
  felt: '#24222f',
};

const BONE = { width: 7, ink: C.ink, body: C.bone, light: C.boneHi };

function defsFor(p) {
  return `<defs>${brushes(p)}
    ${radial(`${p}-bone`, [[0, C.boneHi], [0.5, C.bone], [1, C.boneLo]], { cx: 0.35, cy: 0.3, r: 0.8 })}
    ${linear(`${p}-coat`, [[0, '#3c5294'], [0.5, C.navy], [1, C.navyLo]], { x1: 0, y1: 0, x2: 1, y2: 0.3 })}
    ${linear(`${p}-lining`, [[0, '#dc5a46'], [0.45, C.red], [1, C.redLo]], { x1: 0, y1: 0, x2: 1, y2: 1 })}
    ${linear(`${p}-leather`, [[0, C.leatherHi], [0.45, C.leather], [1, C.leatherLo]])}
    ${linear(`${p}-peg`, [[0, C.woodHi], [0.45, C.wood], [1, C.woodLo]])}
    ${linear(`${p}-gold`, [[0, '#fff0b0'], [0.4, C.gold], [1, C.goldLo]])}
    ${grain(`${p}-pores`, { frequency: 1.4, octaves: 2, strength: 0.2, seed: 9 })}
    ${grain(`${p}-cloth`, { frequency: 0.85, strength: 0.3, seed: 4 })}
  </defs>`;
}

/** A long bone with a knuckle at each end, from (x1,y1) to (x2,y2). */
function longBone(x1, y1, x2, y2, thick) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const knob = (x, y, out) => {
    const a = `${f1(x + nx * thick * 0.9 + (out * dx) / len * thick * 0.4)},${f1(y + ny * thick * 0.9 + (out * dy) / len * thick * 0.4)}`;
    const b = `${f1(x - nx * thick * 0.9 + (out * dx) / len * thick * 0.4)},${f1(y - ny * thick * 0.9 + (out * dy) / len * thick * 0.4)}`;
    return `<circle cx="${a.split(',')[0]}" cy="${a.split(',')[1]}" r="${f1(thick * 0.75)}"/><circle cx="${b.split(',')[0]}" cy="${b.split(',')[1]}" r="${f1(thick * 0.75)}"/>`;
  };
  const shaft = `M${f1(x1)},${f1(y1)} L${f1(x2)},${f1(y2)}`;
  return `<g>
    <g fill="${C.ink}" transform="translate(0 0)">${knob(x1, y1, -1)}${knob(x2, y2, 1)}</g>
    <g fill="${C.bone}" stroke="${C.ink}" stroke-width="1.6">${knob(x1, y1, -1)}${knob(x2, y2, 1)}</g>
    ${rod(shaft, { width: thick * 1.3, ink: C.ink, body: C.bone, light: C.boneHi })}
    <path d="${shaft}" stroke="${C.boneLo}" stroke-width="${f1(thick * 0.45)}" stroke-linecap="round" transform="translate(${f1(nx * thick * 0.35)} ${f1(ny * thick * 0.35)})" opacity="0.7"/>
  </g>`;
}

const PIECES = {
  skull: (p) => [
    '0 0 100 90',
    `<g transform="rotate(-18 50 45)">
      ${paint(p, 'skull', 'M18,38 C16,16 32,6 50,6 C70,6 84,18 82,40 C82,50 78,58 72,62 L70,72 C64,78 40,78 34,72 L32,62 C24,58 18,50 18,38 Z', {
        fill: `url(#${p}-bone)`,
        ink: C.ink,
        filter: `url(#${p}-pores)`,
        strokes: [
          { d: 'M76,22 C82,40 78,58 70,66', c: C.boneDeep, w: 10, o: 0.55, b: 4 },
          { d: 'M24,22 C20,36 22,50 28,58', c: C.boneHi, w: 6, o: 0.7, b: 2 },
        ],
      })}
      <path d="M26,40 C28,30 42,30 44,40 C46,50 40,54 34,54 C28,54 24,48 26,40 Z" fill="${C.void}" stroke="${C.ink}" stroke-width="1.6"/>
      <path d="M56,40 C58,30 72,30 74,40 C76,50 70,54 64,54 C58,54 54,48 56,40 Z" fill="${C.void}" stroke="${C.ink}" stroke-width="1.6"/>
      <path d="M50,52 C47,57 45,62 48,64 L50,62 L52,64 C55,62 53,57 50,52 Z" fill="${C.void}"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${f1(36 + i * 4.8)}" y="66" width="4" height="8" rx="1.2" fill="${i === 1 ? '#e8b74c' : '#f1e8cf'}" stroke="${C.ink}" stroke-width="0.9"/>`).join('')}
      <path d="M30,20 L36,30 L33,36" fill="none" stroke="${C.boneDeep}" stroke-width="1.4"/>
      <path d="M52,34 C60,30 72,32 76,38 M44,38 L22,28" stroke="${C.felt}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    </g>`,
  ],
  jaw: (p) => [
    '0 0 80 46',
    `${paint(p, 'jaw', 'M6,8 C8,28 24,42 40,42 C56,42 72,28 74,8 L64,12 C58,26 48,30 40,30 C32,30 22,26 16,12 Z', {
      fill: `url(#${p}-bone)`,
      ink: C.ink,
      strokes: [{ d: 'M60,30 C54,38 46,40 40,40', c: C.boneDeep, w: 6, o: 0.5, b: 2 }],
    })}
    ${[0, 1, 2, 3, 4, 5].map((i) => {
      const a = Math.PI * (0.18 + i * 0.13);
      const x = 40 - Math.cos(a) * 21;
      const y = 22 + Math.sin(a) * 6;
      return `<rect x="${f1(x - 2)}" y="${f1(y - 6)}" width="4" height="7" rx="1.2" fill="#f1e8cf" stroke="${C.ink}" stroke-width="0.9"/>`;
    }).join('')}`,
  ],
  ribs: (p) => [
    '0 0 120 76',
    `${[0, 1, 2, 3].map((i) => rod(`M${20 + i * 24},14 C${8 + i * 24},30 ${12 + i * 24},54 ${30 + i * 24},66`, { ...BONE, width: 6 })).join('')}
    ${Array.from({ length: 6 }, (_, i) => `<rect x="${8 + i * 18}" y="6" width="16" height="12" rx="4" fill="${C.boneLo}" stroke="${C.ink}" stroke-width="1.4"/><path d="M${10 + i * 18},9 L${20 + i * 18},9" stroke="${C.bone}" stroke-width="1.6" stroke-linecap="round"/>`).join('')}`,
  ],
  femur: (p) => ['0 0 140 40', longBone(16, 20, 124, 18, 9)],
  arm: (p) => ['0 0 120 44', `${longBone(12, 14, 106, 26, 5.4)}${longBone(14, 28, 104, 34, 4.4)}`],
  hand: (p) => [
    '0 0 76 60',
    `<path d="M22,30 C24,20 46,18 50,28 C52,38 40,44 30,42 C24,40 20,36 22,30 Z" fill="url(#${p}-bone)" stroke="${C.ink}" stroke-width="1.6"/>
    ${[
      'M30,22 C30,12 32,6 36,2',
      'M38,21 C40,12 44,6 48,4',
      'M45,24 C50,16 56,12 62,12',
      'M48,32 C56,30 62,30 68,32',
      'M26,38 C20,44 14,46 8,46',
    ]
      .map((d) => rod(d, { ...BONE, width: 4 }))
      .join('')}`,
  ],
  pelvis: (p) => [
    '0 0 110 76',
    `${paint(p, 'pelvis', 'M54,10 C40,4 14,8 8,26 C4,40 14,54 30,58 C38,60 44,66 46,72 L64,72 C66,66 72,60 80,58 C96,54 106,40 102,26 C96,8 70,4 56,10 Z', {
      fill: `url(#${p}-bone)`,
      ink: C.ink,
      strokes: [{ d: 'M92,20 C100,34 96,48 84,54', c: C.boneDeep, w: 8, o: 0.5, b: 4 }],
    })}
    <ellipse cx="34" cy="38" rx="9" ry="11" fill="${C.void}" stroke="${C.ink}" stroke-width="1.4"/>
    <ellipse cx="76" cy="38" rx="9" ry="11" fill="${C.void}" stroke="${C.ink}" stroke-width="1.4"/>
    <path d="M55,12 L55,46" stroke="${C.boneLo}" stroke-width="5" stroke-linecap="round"/>`,
  ],
  spine: (p) => [
    '0 0 130 50',
    Array.from({ length: 7 }, (_, i) => {
      const x = 12 + i * 16;
      const y = 26 + Math.sin(i * 0.8) * 8;
      return `<g transform="rotate(${f1(Math.cos(i * 0.8) * 18)} ${x} ${f1(y)})">
        <path d="M${x - 11},${f1(y - 3)} L${x + 11},${f1(y - 3)}" stroke="${C.ink}" stroke-width="6" stroke-linecap="round"/>
        <path d="M${x - 11},${f1(y - 3)} L${x + 11},${f1(y - 3)}" stroke="${C.boneLo}" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M${x},${f1(y - 6)} L${x},${f1(y - 16)}" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/>
        <path d="M${x},${f1(y - 6)} L${x},${f1(y - 15)}" stroke="${C.boneLo}" stroke-width="3" stroke-linecap="round"/>
        <rect x="${x - 6}" y="${f1(y - 6)}" width="12" height="14" rx="5" fill="url(#${p}-bone)" stroke="${C.ink}" stroke-width="1.4"/></g>`;
    }).join(''),
  ],
  coat: (p) => [
    '0 0 180 90',
    `${paint(p, 'coat', 'M10,40 C30,22 60,16 90,18 C124,14 154,22 172,38 L164,48 L170,58 L156,62 L162,74 L144,72 L146,84 L126,78 L118,88 L102,78 L88,86 L76,76 L60,84 L50,72 L32,78 L30,64 L14,66 L20,54 L6,50 Z', {
      fill: `url(#${p}-coat)`,
      ink: C.ink,
      filter: `url(#${p}-cloth)`,
      strokes: [
        { d: 'M30,40 C60,30 110,30 150,40', c: C.navyHi, w: 8, o: 0.4, b: 4 },
        { d: 'M40,60 C70,54 110,56 140,64', c: C.navyDeep, w: 12, o: 0.55, b: 4 },
      ],
    })}
    ${paint(p, 'lining', 'M70,24 C80,34 84,50 82,70 L96,72 C98,52 96,34 88,22 Z', { fill: `url(#${p}-lining)`, ink: C.ink, line: 1.6 })}
    ${[40, 52, 64].map((y) => `<circle cx="${62 - y * 0.2}" cy="${y}" r="3" fill="url(#${p}-gold)" stroke="${C.ink}" stroke-width="1"/>`).join('')}
    <path d="M104,30 C118,26 132,28 146,34" stroke="#55712b" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
  ],
  boot: (p) => [
    '0 0 120 70',
    `${paint(p, 'boot', 'M8,14 L64,12 C78,12 84,20 86,30 L88,40 C100,42 112,48 112,58 C112,64 106,66 98,66 L62,66 C54,66 50,60 50,52 L50,46 L10,46 Z', {
      fill: `url(#${p}-leather)`,
      ink: C.ink,
      strokes: [
        { d: 'M12,40 L84,40', c: C.leatherLo, w: 10, o: 0.6, b: 4 },
        { d: 'M14,18 L70,16', c: C.leatherHi, w: 4, o: 0.6, b: 2 },
        { d: 'M90,48 C100,50 106,54 108,60', c: '#c9a37a', w: 3, o: 0.6, b: 1 },
      ],
    })}
    <path d="M4,8 L22,8 L22,50 L4,50 Z" fill="url(#${p}-leather)" stroke="${C.ink}" stroke-width="1.8"/>
    <path d="M50,64 L112,62" stroke="${C.leatherLo}" stroke-width="4"/>
    <rect x="34" y="20" width="10" height="20" rx="1.6" fill="none" stroke="url(#${p}-gold)" stroke-width="2.4"/>`,
  ],
  peg: (p) => [
    '0 0 130 40',
    `${paint(p, 'peg', 'M10,10 L44,8 L48,14 L122,18 C126,20 126,24 122,26 L48,28 L44,32 L10,30 Z', {
      fill: `url(#${p}-peg)`,
      ink: C.ink,
      strokes: [{ d: 'M14,14 L120,20', c: C.woodHi, w: 3, o: 0.6, b: 1 }],
    })}
    <path d="M24,9 L24,31 M38,8 L38,32" stroke="${C.leatherLo}" stroke-width="4"/>
    <path d="M110,18 L110,26" stroke="${C.iron}" stroke-width="5"/>`,
  ],
};

export const REMAINS = ['skull', 'coat', 'ribs', 'femur', 'jaw', 'arm', 'hand', 'spine', 'femur', 'boot', 'hand', 'peg'];

export function remains(kind, { id = `rm-${kind}` } = {}) {
  const [viewBox, art] = PIECES[kind](id);
  return svg(viewBox, defsFor(id) + art, { ratio: 'xMidYMid meet' });
}
