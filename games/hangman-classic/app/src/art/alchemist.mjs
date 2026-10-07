import { brushes, f1, grain, linear, paint, radial, svg } from './kit.mjs';

/**
 * Doktor Formalin, the alchemist, drawn in profile as a jointed figure so the gas can wear him
 * down. The room sets `data-slump` (0–6, one per wrong guess) on his container and he gives a
 * little more each time: holding his flask up to the light, sagging, head bowed, knees buckling
 * (the flask slips and breaks), kneeling, bowed to the floor, and at the sixth, flat out with
 * spirals for eyes. Each pose is a set of joint angles turned by CSS, so every change is a
 * movement rather than a cut.
 *
 * He has slicked black-and-silver hair, waxed moustache and goatee, brass goggles pushed up on
 * his brow, a plum waistcoat under a stained leather apron, black rubber gauntlets and riding
 * boots. Drawn in a 320 × 560 box, facing right, soles on y = 550.
 */

const A = {
  ink: '#140d0a',
  skin: '#e0c3a0',
  skinHi: '#f7e2c8',
  skinLo: '#a67c58',
  skinDeep: '#6b4630',
  hair: '#1b1b22',
  silver: '#a3a9b2',
  brass: '#c9a24a',
  brassHi: '#fff0b0',
  brassLo: '#6e5216',
  lens: '#9dff7a',
  apron: '#6b5a2a',
  apronHi: '#a08a4a',
  apronLo: '#33290f',
  vest: '#4c1f3c',
  vestHi: '#7a3a62',
  shirt: '#ebe6da',
  shirtLo: '#a49c8c',
  glove: '#16161a',
  gloveHi: '#5a5a66',
  trousers: '#2d2d36',
  trousersHi: '#4d4d5a',
  boot: '#1b120c',
  bootHi: '#5a4030',
  brew: '#7dff5a',
  glass: '#d8fff0',
};

const GROUND = 550;

/** Every moving part, the joint it turns about (in the drawing's rest pose) and its parent. */
const BONES = {
  root: { pivot: [150, GROUND], parent: null },
  torso: { pivot: [150, 318], parent: 'root' },
  head: { pivot: [150, 190], parent: 'torso' },
  nearUpper: { pivot: [152, 208], parent: 'torso' },
  nearFore: { pivot: [153, 274], parent: 'nearUpper' },
  flask: { pivot: [154, 344], parent: 'nearFore' },
  farUpper: { pivot: [142, 210], parent: 'torso' },
  farFore: { pivot: [143, 276], parent: 'farUpper' },
  nearThigh: { pivot: [150, 318], parent: 'root' },
  nearShin: { pivot: [152, 433], parent: 'nearThigh' },
  nearFoot: { pivot: [150, 530], parent: 'nearShin' },
  farThigh: { pivot: [150, 318], parent: 'root' },
  farShin: { pivot: [142, 433], parent: 'farThigh' },
  farFoot: { pivot: [140, 530], parent: 'farShin' },
  skirt: { pivot: [150, 312], parent: 'root' },
};

/**
 * The seven poses as world angles in degrees, clockwise from the rest drawing (he stands with
 * his arms hanging). He faces right, so a positive torso or head leans forward, and a negative
 * limb swings forward. The flask stays at 0: it hangs plumb from his grip.
 */
const POSES = [
  // 0 — upright, holding the flask out to the light
  { torso: 0, head: 10, nearUpper: -40, nearFore: -98, flask: 0, farUpper: 6, farFore: -4, nearThigh: -4, nearShin: -2, nearFoot: 0, farThigh: 7, farShin: 6, farFoot: 0, skirt: -2 },
  // 1 — the shoulders go, the flask comes down
  { torso: 7, head: 20, nearUpper: -30, nearFore: -74, flask: 0, farUpper: 6, farFore: 2, nearThigh: -4, nearShin: 0, nearFoot: 0, farThigh: 7, farShin: 7, farFoot: 0, skirt: -2 },
  // 2 — head bowed
  { torso: 14, head: 52, nearUpper: -18, nearFore: -44, flask: 0, farUpper: 6, farFore: 4, nearThigh: -12, nearShin: 6, nearFoot: 0, farThigh: 2, farShin: 10, farFoot: 0, skirt: -8 },
  // 3 — the knees buckle and the flask slips
  { torso: 30, head: 56, nearUpper: -6, nearFore: -14, flask: 0, farUpper: -2, farFore: -8, nearThigh: -58, nearShin: 36, nearFoot: 0, farThigh: -50, farShin: 40, farFoot: 0, skirt: -44 },
  // 4 — down on his knees
  { torso: 14, head: 48, nearUpper: -4, nearFore: -10, flask: 0, farUpper: 2, farFore: -6, nearThigh: -10, nearShin: 88, nearFoot: 172, farThigh: -4, farShin: 92, farFoot: 174, skirt: -8 },
  // 5 — bowed to the floor
  { torso: 104, head: 126, nearUpper: -8, nearFore: -84, flask: 0, farUpper: 2, farFore: -78, nearThigh: -14, nearShin: 90, nearFoot: 174, farThigh: -8, farShin: 92, farFoot: 176, skirt: -12 },
  // 6 — flat out on his front, arms at his sides
  { torso: 90, head: 74, nearUpper: 92, nearFore: 86, flask: 0, farUpper: 86, farFore: 90, nearThigh: 90, nearShin: 92, nearFoot: 168, farThigh: 86, farShin: 96, farFoot: 172, skirt: 88 },
];

/** Faces and details that change with the pose: the stages each one shows in. */
const FEATURES = {
  eyeOpen: [0, 1],
  eyeHeavy: [2, 3, 4],
  eyeShut: [5],
  dazed: [6],
  mouth: [0, 1, 2],
  gasp: [3, 4, 5, 6],
  sweat: [1, 2, 3],
  flaskHeld: [0, 1, 2],
  flaskFloor: [3, 4, 5, 6],
  stars: [6],
  glint: [0, 1, 2, 3, 4, 5],
};

/** How green the gas has turned him, by stage. */
const PALLOR = [0, 0.1, 0.18, 0.26, 0.32, 0.38, 0.44];

function relative(pose) {
  return Object.fromEntries(
    Object.entries(BONES).map(([bone, { parent }]) => [bone, parent && parent !== 'root' ? pose[bone] - pose[parent] : (pose[bone] ?? 0)]),
  );
}

function rotate([x, y], [cx, cy], degrees) {
  const r = (degrees * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * Math.cos(r) - dy * Math.sin(r), cy + dx * Math.sin(r) + dy * Math.cos(r)];
}

/** Where a point of `bone`'s rest drawing ends up in a pose, before the root's lift. */
function carry(point, bone, turns) {
  let p = point;
  for (let b = bone; b && b !== 'root'; b = BONES[b].parent) p = rotate(p, BONES[b].pivot, turns[b]);
  return p;
}

/** Points that can meet the floor, in the rest drawing; the far side is the near side shifted. */
const OUTLINE = [
  ['nearFoot', [[128, 550], [204, 550], [204, 532], [128, 520]]],
  ['farFoot', [[118, 550], [194, 550], [194, 532], [118, 520]]],
  ['nearShin', [[128, 462], [132, 534], [168, 534], [168, 440], [152, 447]]],
  ['farShin', [[118, 462], [122, 534], [158, 534], [158, 440], [142, 447]]],
  ['nearThigh', [[178, 330], [172, 404], [130, 330], [128, 400]]],
  ['farThigh', [[168, 330], [162, 404]]],
  ['skirt', [[194, 420], [150, 422]]],
  ['torso', [[118, 300], [116, 250], [122, 214], [184, 240], [186, 300], [182, 322], [148, 350]]],
  ['head', [[160, 88], [126, 128], [190, 104], [197, 140], [186, 168], [182, 188], [132, 150]]],
  ['nearUpper', [[139, 230], [167, 230]]],
  ['nearFore', [[153, 288], [140, 346], [150, 360], [167, 350]]],
  ['farUpper', [[129, 232], [157, 232]]],
  ['farFore', [[143, 290], [130, 348], [140, 362], [157, 352]]],
];

function placed(pose) {
  const turns = relative(pose);
  const points = OUTLINE.flatMap(([bone, list]) => list.map((pt) => carry(pt, bone, turns)));
  const lift = GROUND - Math.max(...points.map(([, y]) => y));
  const xs = points.map(([x]) => x);
  return { turns, lift, left: Math.min(...xs), right: Math.max(...xs) };
}

function poseStyles(p) {
  const joints = Object.entries(BONES)
    .map(([bone, { pivot }]) => `.${p}-${bone} { transform-origin: ${pivot[0]}px ${pivot[1]}px; }`)
    .join('\n');
  const scope = (i) => (i === 0 ? '' : `[data-slump="${i}"] `);
  const poses = POSES.map((pose, i) => {
    const { turns, lift, left, right } = placed(pose);
    const rules = Object.keys(BONES)
      .filter((bone) => bone !== 'root')
      .map((bone) => `${scope(i)}.${p}-${bone} { transform: rotate(${f1(turns[bone])}deg); }`);
    rules.push(`${scope(i)}.${p}-root { transform: translate(0px, ${f1(lift)}px); }`);
    const spread = Math.max(1, (right - left) / 150);
    rules.push(`${scope(i)}.${p}-shadow { transform: translate(${f1((left + right) / 2 - 160)}px, 0px) scaleX(${f1(spread * 100) / 100}); }`);
    rules.push(`${scope(i)}.${p}-pallor { opacity: ${PALLOR[i]}; }`);
    return rules.join('\n');
  }).join('\n');
  const features = Object.entries(FEATURES)
    .map(([name, stages]) => {
      const shownAtRest = stages.includes(0);
      const flips = [1, 2, 3, 4, 5, 6].filter((i) => stages.includes(i) !== shownAtRest);
      const base = `.${p}-${name} { opacity: ${shownAtRest ? 1 : 0}; }`;
      return flips.length ? `${base}\n${flips.map((i) => `${scope(i)}.${p}-${name}`).join(', ')} { opacity: ${shownAtRest ? 0 : 1}; }` : base;
    })
    .join('\n');
  return `<style>
    .${p}-bone, .${p}-shadow { transform-box: view-box; transition: transform 0.9s cubic-bezier(0.45, 0.05, 0.3, 1); }
    .${p}-shadow { transform-origin: 160px ${GROUND}px; }
    ${joints}
    ${poses}
    ${features}
    .${p}-feature, .${p}-pallor { transition: opacity 0.35s; }
    .${p}-flaskHeld { transition: opacity 0.12s 0.2s; }
    .${p}-flaskFloor { transition: opacity 0.3s 0.45s; }
    .${p}-stars { transition: opacity 0.4s 0.7s; }
    .${p}-spin { transform-box: view-box; animation: ${p}-circle 2.6s linear infinite; }
    @keyframes ${p}-circle { to { transform: rotate(360deg); } }
    .reduced-motion .${p}-bone, .reduced-motion .${p}-shadow { transition: none; }
    .reduced-motion .${p}-spin { animation: none; }
    @media (prefers-reduced-motion: reduce) {
      .${p}-bone, .${p}-shadow { transition: none; }
      .${p}-spin { animation: none; }
    }
  </style>`;
}

/** A leg's thigh, shin and boot; the far leg is the same drawing set back and in shadow. */
function leg(p, side, dx, cloth) {
  const ink = A.ink;
  const x = (n) => n + dx;
  const thigh = `${paint(p, `${side}Thigh`, `M${x(128)},318 C${x(128)},302 ${x(140)},294 ${x(152)},294 C${x(166)},294 ${x(178)},304 ${x(178)},320 C${x(178)},360 ${x(172)},402 ${x(168)},436 L${x(136)},436 C${x(132)},404 ${x(128)},362 ${x(128)},318 Z`, {
    fill: `url(#${p}-${cloth})`,
    ink,
    filter: `url(#${p}-cloth)`,
    strokes: [
      { d: `M${x(133)},310 C${x(132)},350 ${x(134)},400 ${x(140)},432`, c: '#000', w: 10, o: 0.5, b: 6 },
      { d: `M${x(172)},318 C${x(172)},356 ${x(168)},396 ${x(164)},430`, c: A.trousersHi, w: 5, o: 0.6, b: 2 },
    ],
    after: `<path d="M${x(166)},306 C${x(160)},318 ${x(160)},330 ${x(166)},340 M${x(158)},380 C${x(154)},392 ${x(156)},404 ${x(162)},410" stroke="#000" stroke-width="1.6" fill="none" opacity="0.45"/>`,
  })}`;
  const shin = `${paint(p, `${side}Shin`, `M${x(136)},428 L${x(168)},428 C${x(170)},452 ${x(168)},478 ${x(166)},500 L${x(134)},500 C${x(126)},480 ${x(126)},452 ${x(136)},428 Z`, {
    fill: `url(#${p}-${cloth})`,
    ink,
    filter: `url(#${p}-cloth)`,
    strokes: [
      { d: `M${x(132)},440 C${x(128)},462 ${x(130)},482 ${x(136)},498`, c: '#000', w: 9, o: 0.5, b: 4 },
      { d: `M${x(164)},436 L${x(162)},496`, c: A.trousersHi, w: 4, o: 0.55, b: 2 },
    ],
  })}
    ${paint(p, `${side}Shaft`, `M${x(130)},494 C${x(140)},488 ${x(160)},488 ${x(170)},494 L${x(168)},534 L${x(132)},534 Z`, {
      fill: `url(#${p}-boot)`,
      ink,
      line: 1.8,
      strokes: [
        { d: `M${x(136)},498 L${x(136)},530`, c: A.bootHi, w: 4, o: 0.7, b: 2 },
        { d: `M${x(164)},500 L${x(163)},530`, c: '#000', w: 6, o: 0.6, b: 2 },
      ],
      after: `<rect x="${x(131)}" y="510" width="38" height="5" fill="#2a1c12" stroke="${ink}" stroke-width="0.8"/>
        <rect x="${x(158)}" y="508.5" width="7" height="8" rx="1" fill="none" stroke="${A.brass}" stroke-width="1.6"/>`,
    })}
    <path d="M${x(128)},492 C${x(140)},484 ${x(162)},484 ${x(172)},492 L${x(170)},500 C${x(160)},494 ${x(140)},494 ${x(130)},500 Z" fill="#3a281c" stroke="${ink}" stroke-width="1.3"/>
    <ellipse cx="${x(152)}" cy="433" rx="16" ry="12" fill="url(#${p}-${cloth})"/>
    <path d="M${x(140)},430 C${x(146)},426 ${x(160)},426 ${x(166)},432" stroke="#000" stroke-width="1.4" fill="none" opacity="0.4"/>`;
  const foot = `${paint(p, `${side}Boot`, `M${x(132)},516 L${x(166)},516 C${x(170)},526 ${x(180)},530 ${x(192)},532 C${x(202)},534 ${x(206)},540 ${x(204)},546 L${x(204)},550 L${x(128)},550 L${x(128)},534 C${x(128)},526 ${x(130)},520 ${x(132)},516 Z`, {
    fill: `url(#${p}-boot)`,
    ink,
    line: 1.8,
    strokes: [
      { d: `M${x(170)},530 C${x(180)},533 ${x(192)},535 ${x(200)},540`, c: '#9a7a60', w: 3, o: 0.7, b: 1 },
      { d: `M${x(134)},522 L${x(134)},540`, c: A.bootHi, w: 4, o: 0.6, b: 2 },
    ],
  })}
    <path d="M${x(128)},543 L${x(205)},543 L${x(204)},550 L${x(128)},550 Z" fill="#0a0604" stroke="${ink}" stroke-width="1"/>
    <path d="M${x(128)},538 L${x(150)},538 L${x(150)},550 L${x(128)},550 Z" fill="#120a06" stroke="${ink}" stroke-width="1"/>`;
  return { thigh, shin, foot };
}

/**
 * An arm: shirt sleeve with a garter, the sleeve rolled at the elbow, a rubber gauntlet and a
 * gripping fist. `between` is drawn after the forearm and before the fist (the flask's neck).
 */
function arm(p, side, dx, dy, shirt, between = '') {
  const ink = A.ink;
  const x = (n) => n + dx;
  const y = (n) => n + dy;
  const upper = `${paint(p, `${side}Upper`, `M${x(139)},${y(210)} C${x(138)},${y(195)} ${x(167)},${y(194)} ${x(167)},${y(211)} C${x(167)},${y(234)} ${x(166)},${y(254)} ${x(166)},${y(276)} L${x(140)},${y(276)} C${x(140)},${y(254)} ${x(139)},${y(232)} ${x(139)},${y(210)} Z`, {
    fill: `url(#${p}-${shirt})`,
    ink,
    filter: `url(#${p}-cloth)`,
    strokes: [
      { d: `M${x(143)},${y(206)} C${x(142)},${y(232)} ${x(143)},${y(254)} ${x(144)},${y(274)}`, c: A.shirtLo, w: 9, o: 0.7, b: 4 },
      { d: `M${x(162)},${y(206)} C${x(163)},${y(230)} ${x(162)},${y(252)} ${x(162)},${y(272)}`, c: '#ffffff', w: 4, o: 0.7, b: 2 },
    ],
    after: `<path d="M${x(146)},${y(250)} C${x(152)},${y(256)} ${x(158)},${y(256)} ${x(164)},${y(250)} M${x(144)},${y(262)} C${x(150)},${y(268)} ${x(158)},${y(266)} ${x(165)},${y(262)}" stroke="${A.shirtLo}" stroke-width="1.6" fill="none"/>`,
  })}
    <path d="M${x(139)},${y(232)} L${x(167)},${y(232)} L${x(167)},${y(239)} L${x(139)},${y(239)} Z" fill="#5a1414" stroke="${ink}" stroke-width="1"/>
    <rect x="${x(150)}" y="${y(231)}" width="6" height="9" rx="1" fill="${A.brass}" stroke="${ink}" stroke-width="0.8"/>`;
  const fore = `<circle cx="${x(153)}" cy="${y(274)}" r="13" fill="url(#${p}-${shirt})" stroke="${ink}" stroke-width="1.5"/>
    ${paint(p, `${side}Cuff`, `M${x(138)},${y(270)} C${x(146)},${y(266)} ${x(160)},${y(266)} ${x(168)},${y(270)} L${x(169)},${y(290)} L${x(137)},${y(290)} Z`, {
      fill: `url(#${p}-${shirt})`,
      ink,
      line: 1.6,
      after: `<path d="M${x(138)},${y(279)} C${x(148)},${y(276)} ${x(158)},${y(276)} ${x(168)},${y(280)}" stroke="${A.shirtLo}" stroke-width="1.6" fill="none"/>`,
    })}
    ${paint(p, `${side}Fore`, `M${x(136)},${y(288)} L${x(170)},${y(288)} L${x(166)},${y(300)} C${x(165)},${y(312)} ${x(164)},${y(324)} ${x(163)},${y(336)} L${x(145)},${y(336)} C${x(144)},${y(324)} ${x(143)},${y(312)} ${x(142)},${y(300)} Z`, {
      fill: `url(#${p}-glove)`,
      ink,
      line: 1.8,
      strokes: [
        { d: `M${x(160)},${y(300)} L${x(158)},${y(332)}`, c: A.gloveHi, w: 4, o: 0.8, b: 2 },
        { d: `M${x(140)},${y(292)} L${x(166)},${y(292)}`, c: A.gloveHi, w: 2, o: 0.7, b: 0 },
      ],
    })}
    ${between}
    ${paint(p, `${side}Fist`, `M${x(144)},${y(332)} C${x(138)},${y(340)} ${x(139)},${y(354)} ${x(150)},${y(358)} C${x(162)},${y(360)} ${x(169)},${y(350)} ${x(166)},${y(337)} C${x(165)},${y(332)} ${x(160)},${y(330)} ${x(154)},${y(330)} Z`, {
      fill: `url(#${p}-glove)`,
      ink,
      line: 1.8,
      strokes: [{ d: `M${x(160)},${y(336)} C${x(164)},${y(342)} ${x(163)},${y(350)} ${x(158)},${y(354)}`, c: A.gloveHi, w: 3, o: 0.8, b: 1 }],
      after: `<path d="M${x(146)},${y(342)} C${x(152)},${y(344)} ${x(158)},${y(344)} ${x(163)},${y(341)} M${x(146)},${y(349)} C${x(152)},${y(351)} ${x(157)},${y(351)} ${x(162)},${y(348)}" stroke="#000" stroke-width="1.2" fill="none"/>`,
    })}`;
  return { upper, fore };
}

export function alchemist({ id = 'al' } = {}) {
  const p = id;
  const ink = A.ink;
  const url = (n) => `url(#${p}-${n})`;
  const bone = (name, inner) => `<g class="${p}-bone ${p}-${name}">${inner}</g>`;
  const feature = (name, inner) => `<g class="${p}-feature ${p}-${name}">${inner}</g>`;

  const defs = `<defs>${brushes(p)}
    ${radial(`${p}-skin`, [[0, A.skinHi], [0.55, A.skin], [1, A.skinLo]], { cx: 0.62, cy: 0.38, r: 0.72 })}
    ${linear(`${p}-hair`, [[0, '#3a3a46'], [0.5, A.hair], [1, '#060608']])}
    ${linear(`${p}-apron`, [[0, A.apronLo], [0.45, A.apron], [1, A.apronHi]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-vest`, [[0, '#1a0614'], [0.55, A.vest], [1, A.vestHi]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-shirt`, [[0, A.shirtLo], [0.55, A.shirt], [1, '#ffffff']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-farShirt`, [[0, '#5e584c'], [1, '#948c7c']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-glove`, [[0, '#000'], [0.6, A.glove], [1, A.gloveHi]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-trousers`, [[0, '#101016'], [0.55, A.trousers], [1, A.trousersHi]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-farTrousers`, [[0, '#06060a'], [1, '#202028']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-boot`, [[0, '#000'], [0.6, A.boot], [1, A.bootHi]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-brass`, [[0, A.brassHi], [0.45, A.brass], [1, A.brassLo]])}
    ${radial(`${p}-lens`, [[0, '#f4ffe8'], [0.35, A.lens], [1, '#1e6a1e']], { cx: 0.6, cy: 0.35 })}
    ${linear(`${p}-glass`, [[0, '#ffffff', 0.55], [0.3, A.glass, 0.22], [0.7, A.glass, 0.12], [1, '#ffffff', 0.4]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-brew`, [[0, '#e6ffcc'], [0.4, A.brew], [1, '#1e7a1e']])}
    ${radial(`${p}-glow`, [[0, A.brew, 0.5], [0.4, A.brew, 0.16], [1, A.brew, 0]])}
    ${grain(`${p}-leather`, { frequency: 0.7, octaves: 3, strength: 0.35, seed: 21 })}
    ${grain(`${p}-cloth`, { frequency: 0.9, strength: 0.25, seed: 4 })}
  </defs>${poseStyles(p)}`;

  const far = leg(p, 'far', -10, 'farTrousers');
  const near = leg(p, 'near', 0, 'trousers');

  // The apron's skirt hangs from the waist in front of the thighs, and folds over them as he sinks.
  const skirt = paint(p, 'skirt', 'M150,300 L188,300 C192,340 194,382 196,424 C180,428 162,428 148,424 C148,382 149,340 150,300 Z', {
    fill: url('apron'),
    ink,
    filter: url('leather'),
    strokes: [
      { d: 'M190,306 C192,350 194,390 194,420', c: A.apronHi, w: 7, o: 0.55, b: 4 },
      { d: 'M152,306 C152,350 151,390 151,420', c: A.apronLo, w: 10, o: 0.7, b: 4 },
      { d: 'M172,360 C178,372 176,388 168,394', c: '#4aa83a', w: 9, o: 0.35, b: 4 },
      { d: 'M180,404 C184,410 182,418 178,420', c: '#2a1a08', w: 6, o: 0.5, b: 2 },
    ],
    after: `<path d="M150,410 C164,416 182,416 196,410" stroke="#d8c08a" stroke-width="1.2" stroke-dasharray="3 3" fill="none" opacity="0.7"/>`,
  });

  // —— the body: trouser seat, waistcoat, the apron's bib and its straps ——
  const body = `${paint(p, 'seat', 'M118,296 C112,326 122,348 148,350 C168,350 180,340 180,322 L180,296 Z', {
    fill: url('trousers'),
    ink,
    filter: url('cloth'),
    strokes: [{ d: 'M122,300 C118,326 126,342 146,346', c: '#000', w: 10, o: 0.5, b: 6 }],
  })}
    ${paint(p, 'vest', 'M122,316 C116,286 114,250 118,224 C122,206 134,196 150,194 L160,195 C172,200 182,216 184,238 C186,262 184,290 180,316 L174,324 L166,316 Z', {
      fill: url('vest'),
      ink,
      filter: url('cloth'),
      strokes: [
        { d: 'M124,222 C120,254 120,286 126,312', c: '#000', w: 14, o: 0.55, b: 7 },
        { d: 'M142,206 C140,246 140,282 142,312', c: A.vestHi, w: 6, o: 0.4, b: 4 },
      ],
      after: `<path d="M128,250 C134,262 134,280 128,292" stroke="#2a0a20" stroke-width="2" fill="none"/>
        <rect x="119" y="284" width="10" height="6" rx="1" fill="${A.brass}" stroke="${ink}" stroke-width="0.8"/>`,
    })}
    ${paint(p, 'bib', 'M160,206 C172,210 182,224 184,244 C186,268 186,294 184,322 L158,322 C158,292 158,250 160,206 Z', {
      fill: url('apron'),
      ink,
      filter: url('leather'),
      strokes: [
        { d: 'M180,216 C184,248 184,286 182,318', c: A.apronHi, w: 6, o: 0.55, b: 2 },
        { d: 'M162,220 C160,260 160,292 160,318', c: A.apronLo, w: 7, o: 0.7, b: 2 },
        { d: 'M170,290 C176,298 174,306 168,310', c: '#4aa83a', w: 7, o: 0.35, b: 2 },
      ],
      after: `<path d="M164,252 L183,252 L183,276 L164,276 Z" fill="${A.apronLo}" opacity="0.55"/>
        <path d="M165,254 L182,254 M165,274 L182,274" stroke="#d8c08a" stroke-width="1" stroke-dasharray="2.5 2.5" opacity="0.7"/>
        <rect x="168" y="238" width="4" height="22" rx="1.6" fill="#e8f4f0" stroke="${ink}" stroke-width="0.8"/><rect x="169" y="250" width="2" height="9" fill="#d02020"/>
        <rect x="175" y="242" width="3" height="18" rx="1" fill="#2a2a30" stroke="${ink}" stroke-width="0.6"/>`,
    })}
    <path d="M161,208 C154,200 146,196 138,198" stroke="${A.apronLo}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M118,302 C136,306 152,306 160,304" stroke="${A.apronLo}" stroke-width="6" fill="none"/>
    <path d="M120,304 C110,300 106,308 112,312 C116,314 120,308 120,304 C112,312 108,322 112,330 M120,304 C122,314 118,324 120,334" stroke="${A.apronLo}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;

  // —— the head in profile, with the collar that wraps the neck ——
  const face = `${paint(p, 'neck', 'M140,156 L162,156 C162,170 164,182 166,196 L140,198 C140,184 140,170 140,156 Z', {
    fill: url('skin'),
    ink,
    line: 1.6,
    strokes: [{ d: 'M144,160 L144,196', c: A.skinDeep, w: 8, o: 0.5, b: 4 }],
  })}
    ${paint(p, 'collar', 'M138,186 C146,180 162,180 170,186 L172,200 C162,195 148,195 138,200 Z', {
      fill: url('shirt'),
      ink,
      line: 1.5,
      after: `<path d="M164,184 L174,178 L172,192 Z" fill="#ffffff" stroke="${ink}" stroke-width="1"/>`,
    })}
    <path d="M166,194 C172,190 180,192 180,198 C180,204 172,206 166,202 Z" fill="#1d3a24" stroke="${ink}" stroke-width="1.2"/>
    <path d="M168,200 C170,208 168,216 164,220 M172,200 C176,208 176,214 174,218" stroke="#1d3a24" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="148" cy="138" rx="7" ry="10" fill="${A.skinLo}" stroke="${ink}" stroke-width="1.4"/>
    <path d="M149,132 C152,136 152,142 148,145" stroke="${A.skinDeep}" stroke-width="1.4" fill="none"/>
    ${paint(p, 'face', 'M128,132 C126,106 144,90 164,92 C178,94 186,104 186,116 L188,124 C192,130 198,136 196,140 C194,143 190,143 188,144 L189,149 C188,152 186,153 186,154 L188,158 C188,164 184,170 176,172 L156,172 C140,168 130,156 128,142 Z', {
      fill: url('skin'),
      ink,
      strokes: [
        { d: 'M134,128 C134,148 140,160 152,166', c: A.skinDeep, w: 12, o: 0.45, b: 6 },
        { d: 'M178,100 C186,110 188,120 188,128', c: A.skinHi, w: 6, o: 0.7, b: 2 },
        { d: 'M170,138 C174,146 178,152 182,156', c: '#d88a7a', w: 7, o: 0.35, b: 4 },
        { d: 'M166,150 C170,158 176,162 182,162', c: A.skinDeep, w: 4, o: 0.45, b: 2 },
      ],
      after: `<path class="${p}-pallor" d="M120,80 L210,80 L210,180 L120,180 Z" fill="#5eb04a" style="mix-blend-mode:multiply"/>`,
    })}
    <path d="M188,146 C186,148 184,148 182,147" stroke="${A.skinDeep}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${feature('eyeOpen', `<path d="M171,131 C174,126 181,125 185,129 C182,134 175,135 171,131 Z" fill="#f4f0e6" stroke="${ink}" stroke-width="1.1"/>
      <circle cx="181.5" cy="129.8" r="2.7" fill="#2e5a2a"/><circle cx="182" cy="129.6" r="1.2" fill="#000"/><circle cx="182.6" cy="128.8" r="0.6" fill="#fff"/>
      <path d="M170,130 C174,124 182,123 186,128" stroke="${ink}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`)}
    ${feature('eyeHeavy', `<path d="M171,131 C174,128 181,127 185,129 C182,134 175,135 171,131 Z" fill="#e6d8c8" stroke="${ink}" stroke-width="1.1"/>
      <circle cx="181" cy="131" r="2.2" fill="#2e5a2a"/>
      <path d="M170,130 C175,127 182,127 186,129" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M172,136 C176,139 181,139 184,136" stroke="${A.skinDeep}" stroke-width="1.6" fill="none" opacity="0.8"/>`)}
    ${feature('eyeShut', `<path d="M171,131 C175,135 181,135 185,131" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`)}
    ${feature('dazed', `<path d="M178,130 m-5,0 a5,5 0 1,1 5,5 a3.2,3.2 0 1,1 -3.2,-3.2 a1.4,1.4 0 1,1 1.4,1.4" fill="none" stroke="${ink}" stroke-width="1.5"/>`)}
    <path d="M168,122 C174,117 183,117 189,121" stroke="#2a2a32" stroke-width="3.6" fill="none" stroke-linecap="round"/>
    <path d="M170,121 C175,118 181,118 186,120" stroke="${A.silver}" stroke-width="1" fill="none"/>
    ${feature('mouth', `<path d="M183,151.5 L189,151" stroke="${A.skinDeep}" stroke-width="1.6" stroke-linecap="round"/>`)}
    ${feature('gasp', `<ellipse cx="187" cy="152" rx="2.6" ry="3.6" fill="#2a0e0a" stroke="${ink}" stroke-width="0.8"/>`)}
    <path d="M179,158 C184,166 186,178 182,190 C178,182 174,172 172,164 Z" fill="${url('hair')}" stroke="${ink}" stroke-width="1"/>
    <path d="M186,145 C192,145 198,147 202,143 C205,140 204,136 201,136 C203,139 200,142 196,142 C192,142 188,142 186,144 Z" fill="${url('hair')}" stroke="${ink}" stroke-width="1"/>
    ${paint(p, 'hair', 'M128,130 C124,100 146,84 166,86 C180,88 188,98 188,110 C178,104 166,104 156,106 C146,110 140,120 138,132 C136,144 134,152 130,158 C126,150 126,140 128,130 Z', {
      fill: url('hair'),
      ink,
      strokes: [{ d: 'M140,96 C152,90 166,90 178,96', c: A.silver, w: 2.4, o: 0.9, b: 0 }],
      after: `<path d="M136,108 C144,100 156,98 168,100 M134,122 C138,112 146,106 156,104 M130,138 C132,128 136,120 142,114" stroke="${A.silver}" stroke-width="1.4" fill="none" opacity="0.8"/>`,
    })}
    <path d="M128,114 C142,104 160,100 176,100" stroke="#3a2a14" stroke-width="5" fill="none"/>
    <g transform="rotate(-24 182 100)">
      <rect x="164" y="92" width="18" height="16" rx="3" fill="${url('brass')}" stroke="${ink}" stroke-width="1.3"/>
      <rect x="176" y="91" width="6" height="18" rx="2" fill="${A.brassLo}" stroke="${ink}" stroke-width="1"/>
      <ellipse cx="184" cy="100" rx="4" ry="9.5" fill="${url('lens')}" stroke="${ink}" stroke-width="1.2"/>
      <ellipse class="${p}-feature ${p}-glint" cx="185" cy="96" rx="1.4" ry="3" fill="#ffffff" opacity="0.9"/>
      <path d="M166,95 L176,95" stroke="${A.brassHi}" stroke-width="1.4" opacity="0.8"/>
    </g>
    ${feature('sweat', `<path d="M160,112 C158,116 158,119 160,120 C162,119 162,116 160,112 Z M190,134 C188,138 188,141 190,142 C192,141 192,138 190,134 Z" fill="#cfe8ff" stroke="#5a7a9a" stroke-width="0.6" opacity="0.9"/>`)}`;

  // —— the arms; the near hand holds the flask by its neck, the bowl hanging below ——
  const flask = bone(
    'flask',
    feature(
      'flaskHeld',
      `<circle cx="154" cy="384" r="56" fill="${url('glow')}"/>
      ${paint(p, 'flaskGlass', 'M149,330 L159,330 L159,358 C174,362 182,374 180,390 C178,404 168,412 154,412 C140,412 130,404 128,390 C126,374 134,362 149,358 Z', {
        fill: url('glass'),
        ink,
        line: 1.4,
        after: `<path d="M129,384 C140,390 168,390 179,384 C180,402 168,412 154,412 C140,412 128,402 129,384 Z" fill="${url('brew')}" opacity="0.92"/>
          <circle cx="148" cy="400" r="2.4" fill="none" stroke="#f0ffe4" stroke-width="1"/><circle cx="162" cy="394" r="1.8" fill="none" stroke="#f0ffe4" stroke-width="1"/>`,
        strokes: [{ d: 'M134,376 C131,386 131,396 135,404', c: '#ffffff', w: 3, o: 0.75, b: 1 }],
      })}
      <path d="M147,328 L161,328 L161,333 L147,333 Z" fill="${url('glass')}" stroke="${ink}" stroke-width="1.2"/>
      <path d="M152,326 C148,316 156,310 152,300 M157,326 C161,318 155,312 161,304" stroke="${A.brew}" stroke-width="3" fill="none" opacity="0.5" stroke-linecap="round" filter="url(#${p}-b2)">
        <animateTransform attributeName="transform" type="translate" values="0 4;0 -6" dur="2.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;0.6;0" dur="2.4s" repeatCount="indefinite"/>
      </path>`,
    ),
  );
  const farArm = arm(p, 'far', -10, 2, 'farShirt');
  const nearArm = arm(p, 'near', 0, 0, 'shirt', flask);

  // —— on the floor once he lets go: the flask in pieces and its brew spreading ——
  const flaskFloor = feature(
    'flaskFloor',
    `<ellipse cx="262" cy="547" rx="52" ry="7" fill="${A.brew}" opacity="0.55" filter="url(#${p}-b2)"/>
    <ellipse cx="262" cy="547" rx="34" ry="4" fill="#d8ffbe" opacity="0.5"/>
    <path d="M242,543 L248,529 L254,545 Z M266,545 L278,533 L276,547 Z M286,547 L292,539 L296,549 Z" fill="${url('glass')}" stroke="${ink}" stroke-width="1.1"/>
    <path d="M228,539 C232,529 248,527 252,537 C254,545 244,549 236,547 C230,547 226,543 228,539 Z" fill="${url('glass')}" stroke="${ink}" stroke-width="1.2"/>
    <path d="M300,540 C306,534 312,538 310,544" stroke="${A.brew}" stroke-width="2" fill="none" opacity="0.6"/>`,
  );

  // —— stars circling his head when he is out ——
  const out = placed(POSES[6]);
  const [hx, hy] = carry([160, 120], 'head', out.turns);
  const cx = hx;
  const cy = hy + out.lift - 52;
  const stars = feature(
    'stars',
    `<g class="${p}-spin" style="transform-origin: ${f1(cx)}px ${f1(cy)}px">${[0, 120, 240]
      .map((a) => {
        const r = (a * Math.PI) / 180;
        return `<path transform="translate(${f1(cx + Math.cos(r) * 24)} ${f1(cy + Math.sin(r) * 9)})" d="M0,-7 L2,-2 L7,0 L2,2 L0,7 L-2,2 L-7,0 L-2,-2 Z" fill="#fff6b0" stroke="#7a6a20" stroke-width="0.8"/>`;
      })
      .join('')}</g>`,
  );

  // Draw order: far arm, far leg, body and head, near leg and apron skirt, near arm. The arms ride
  // on copies of the torso's joint so they can sit on either side of the legs.
  const figure = `${defs}
    <ellipse class="${p}-shadow" cx="160" cy="${GROUND}" rx="70" ry="6" fill="#000" opacity="0.45" filter="url(#${p}-b4)"/>
    ${flaskFloor}
    ${bone(
      'root',
      `${bone('torso', bone('farUpper', `${farArm.upper}${bone('farFore', farArm.fore)}`))}
      ${bone('farThigh', `${far.thigh}${bone('farShin', `${far.shin}${bone('farFoot', far.foot)}`)}`)}
      ${bone('torso', `${body}${bone('head', face)}`)}
      ${bone('nearThigh', `${near.thigh}${bone('nearShin', `${near.shin}${bone('nearFoot', near.foot)}`)}`)}
      ${bone('skirt', skirt)}
      ${bone('torso', bone('nearUpper', `${nearArm.upper}${bone('nearFore', nearArm.fore)}`))}`,
    )}
    ${stars}`;
  return svg('0 0 320 560', figure, { label: 'Doktor Formalin' });
}
