import { brushes, f1, grain, linear, paint, radial, ragged, rod, seeded, svg } from './kit.mjs';

/**
 * Captain Blackrot: a drowned captain risen in his own hold. A skeleton in a sea-rotted navy
 * frock coat with red facings, a black tricorn with a drooping plume, one ember eye and one
 * patch, a cutlass at his hip and a lantern of ghost-green fire held up beside his face.
 * Drawn in a 420 × 800 box: warm torchlight from the left, the lantern's green from the right.
 */

const C = {
  ink: '#1a100a',
  navy: '#2e417c',
  navyHi: '#5a74b8',
  navyLo: '#1a2550',
  navyDeep: '#0d1330',
  red: '#a3262d',
  redHi: '#dc5a46',
  redLo: '#560f15',
  bone: '#e9dbbb',
  boneHi: '#fff8e4',
  boneLo: '#b09a6f',
  boneDeep: '#6a5537',
  gold: '#e1ae47',
  goldHi: '#fff0b0',
  goldLo: '#87591a',
  felt: '#24222f',
  feltHi: '#4a4a66',
  feltLo: '#0b0a10',
  leather: '#553520',
  leatherHi: '#8f6640',
  leatherLo: '#211309',
  breech: '#4b4552',
  breechHi: '#736b7e',
  breechLo: '#211d27',
  wood: '#9c6c3b',
  woodHi: '#d9aa70',
  woodLo: '#563619',
  iron: '#34363c',
  ironHi: '#80858e',
  linen: '#d6cbac',
  linenLo: '#8c8167',
  weed: '#55712b',
  weedLo: '#26380f',
  weedHi: '#9aba57',
  void: '#0f0805',
  ember: '#ff8a3d',
  warm: '#ffc27a',
  ghost: '#b5ff92',
};

export function captain({ id = 'cap' } = {}) {
  const rand = seeded(11);
  const p = id;
  const url = (name) => `url(#${p}-${name})`;
  const ink = C.ink;

  const defs = `<defs>
    ${brushes(p)}
    ${linear(`${p}-coat`, [[0, '#3c5294'], [0.5, C.navy], [1, C.navyLo]], { x1: 0, y1: 0, x2: 1, y2: 0.15 })}
    ${linear(`${p}-lining`, [[0, C.redHi], [0.45, C.red], [1, C.redLo]], { x1: 0, y1: 0, x2: 1, y2: 1 })}
    ${linear(`${p}-liningBack`, [[0, '#1f0507'], [1, '#4a0c11']])}
    ${radial(`${p}-bone`, [[0, C.boneHi], [0.5, C.bone], [1, C.boneLo]], { cx: 0.35, cy: 0.3, r: 0.8 })}
    ${linear(`${p}-gold`, [[0, C.goldHi], [0.4, C.gold], [1, C.goldLo]])}
    ${linear(`${p}-felt`, [[0, '#33314a'], [0.5, C.felt], [1, C.feltLo]])}
    ${linear(`${p}-leather`, [[0, C.leatherHi], [0.45, C.leather], [1, C.leatherLo]], { x1: 0, y1: 0, x2: 1, y2: 0.2 })}
    ${linear(`${p}-breech`, [[0, C.breechHi], [0.45, C.breech], [1, C.breechLo]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-peg`, [[0, C.woodHi], [0.45, C.wood], [1, C.woodLo]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-iron`, [[0, C.ironHi], [0.5, C.iron], [1, '#16171a']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${radial(`${p}-glow`, [[0, C.ghost, 0.6], [0.3, '#86ff70', 0.26], [1, '#3dff5a', 0]])}
    ${radial(`${p}-flame`, [[0, '#fbfff0'], [0.4, C.ghost], [1, '#2fbf4a', 0.15]], { cy: 0.72 })}
    ${radial(`${p}-ember`, [[0, '#fff3b0'], [0.35, C.ember], [1, '#ff4a10', 0]])}
    ${radial(`${p}-socket`, [[0, '#3a1a0c'], [1, C.void]])}
    ${grain(`${p}-cloth`, { frequency: 0.85, strength: 0.3, seed: 4 })}
    ${grain(`${p}-pores`, { frequency: 1.4, octaves: 2, strength: 0.2, seed: 9 })}
  </defs>`;

  // —— the plume, behind the hat: a quill swept back over the crown, drooping on the left ——
  const quill = (t) => {
    const x = 284 - t * 200;
    const y = 76 - Math.sin(t * Math.PI * 0.85) * 52 + t * t * 70;
    return [x, y];
  };
  const barbs = [];
  for (let i = 0; i <= 70; i++) {
    const t = i / 70;
    const [x, y] = quill(t);
    const [nx, ny] = quill(Math.min(1, t + 0.02));
    const ang = Math.atan2(ny - y, nx - x);
    const len = 10 + Math.sin(t * Math.PI) * 26 + rand() * 6;
    for (const side of [-1, 1]) {
      const a = ang + side * (1.1 + rand() * 0.25) + 0.35;
      const ex = x + Math.cos(a) * len;
      const ey = y + Math.sin(a) * len;
      const cx = x + Math.cos(a - side * 0.5) * len * 0.5;
      const cy = y + Math.sin(a - side * 0.5) * len * 0.5;
      const tone = side < 0 ? (i % 4 ? '#f2eee5' : '#d8d2c6') : i % 3 ? '#b9b2a6' : '#8f887c';
      barbs.push(`<path d="M${f1(x)},${f1(y)} Q${f1(cx)},${f1(cy)} ${f1(ex)},${f1(ey)}" stroke="${tone}" stroke-width="${f1(2 + rand() * 1.6)}" fill="none" stroke-linecap="round" opacity="${f1(0.75 + rand() * 0.25)}"/>`);
    }
  }
  const spinePath = Array.from({ length: 21 }, (_, i) => quill(i / 20))
    .map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)},${f1(y)}`)
    .join(' ');
  const plume = `<g>
    <g filter="url(#${p}-b2)" opacity="0.55">${barbs.slice(0, 40).join('')}</g>
    ${barbs.join('')}
    <path d="${spinePath}" stroke="#f7f4ec" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="${spinePath}" stroke="#6f685c" stroke-width="0.8" fill="none" stroke-linecap="round" transform="translate(0 1.4)"/>
  </g>`;

  // —— the coat behind him ——
  const hemPoints = ragged([88, 640], [314, 636], rand, { teeth: 22, depth: 20 });
  const hem = hemPoints.map(([x, y]) => `L${f1(x)},${f1(y)}`).join(' ');
  const coatBack = `<path d="M130,288 C110,302 106,360 102,430 C98,500 94,570 88,640 ${hem} L314,636 C306,570 302,500 298,430 C294,360 292,300 272,286 Z" fill="${C.navyDeep}" stroke="${ink}" stroke-width="2.4"/>`;
  const liningHem = ragged([258, 628], [144, 632], rand, { teeth: 12, depth: 16 })
    .map(([x, y]) => `L${f1(x)},${f1(y)}`)
    .join(' ');
  const liningBack = `<path d="M156,488 L246,488 L258,628 ${liningHem} L144,632 Z" fill="${url('liningBack')}"/>`;

  // —— legs ——
  const kneeL = ragged([206, 664], [156, 668], rand, { teeth: 6, depth: 10 })
    .map(([x, y]) => `L${f1(x)},${f1(y)}`)
    .join(' ');
  const breechL = paint(p, 'breechL', `M152,494 L203,498 C205,560 207,620 206,664 ${kneeL} C153,620 150,560 152,494 Z`, {
    fill: url('breech'),
    ink,
    filter: url('cloth'),
    strokes: [
      { d: 'M196,500 C198,560 200,620 200,668', c: C.breechLo, w: 16, o: 0.7, b: 7 },
      { d: 'M160,510 C158,560 160,620 164,660', c: C.breechHi, w: 8, o: 0.45, b: 4 },
      { d: 'M170,560 C178,580 182,610 180,640', c: C.breechLo, w: 3, o: 0.8, b: 2 },
    ],
  });
  const kneeR = ragged([252, 662], [210, 666], rand, { teeth: 6, depth: 10 })
    .map(([x, y]) => `L${f1(x)},${f1(y)}`)
    .join(' ');
  const breechR = paint(p, 'breechR', `M200,498 L255,494 C257,560 255,620 252,662 ${kneeR} C209,620 205,560 200,498 Z`, {
    fill: url('breech'),
    ink,
    filter: url('cloth'),
    strokes: [
      { d: 'M246,500 C250,560 248,620 244,662', c: C.breechLo, w: 18, o: 0.75, b: 7 },
      { d: 'M210,510 C212,560 214,610 216,650', c: C.breechHi, w: 6, o: 0.35, b: 4 },
      { d: 'M226,540 C232,570 230,600 226,630', c: C.breechLo, w: 3, o: 0.8, b: 2 },
    ],
  });

  const boot = `<g>
    ${paint(p, 'bootShaft', 'M158,700 L209,700 C210,730 211,756 213,772 L215,790 L130,792 C116,792 114,779 128,773 C144,765 156,761 160,753 C160,736 159,718 158,700 Z', {
      fill: url('leather'),
      ink,
      strokes: [
        { d: 'M204,700 C206,740 208,770 212,790', c: C.leatherLo, w: 16, o: 0.8, b: 7 },
        { d: 'M166,706 C166,726 166,744 166,756', c: C.leatherHi, w: 6, o: 0.6, b: 4 },
        { d: 'M128,776 C146,770 160,764 170,756', c: '#c9a37a', w: 4, o: 0.6, b: 2 },
        { d: 'M150,740 C160,742 172,738 182,744', c: C.leatherLo, w: 2, o: 0.7, b: 1 },
      ],
    })}
    <path d="M128,788 L215,786 L215,793 L126,794 Z" fill="${C.leatherLo}"/>
    ${paint(p, 'bootCuff', 'M148,664 L216,660 L211,704 C194,712 170,712 154,704 Z', {
      fill: url('leather'),
      ink,
      strokes: [
        { d: 'M150,668 L214,664', c: C.leatherHi, w: 6, o: 0.55, b: 2 },
        { d: 'M206,664 L204,708', c: C.leatherLo, w: 14, o: 0.8, b: 6 },
        { d: 'M170,672 C172,686 170,698 168,706', c: C.leatherLo, w: 3, o: 0.7, b: 1 },
      ],
    })}
    <path d="M158,726 L208,726" stroke="${C.leatherLo}" stroke-width="7"/>
    <rect x="174" y="719" width="20" height="14" rx="2" fill="none" stroke="${url('gold')}" stroke-width="3"/>
    ${barnacles(rand, [[196, 768], [188, 778], [204, 756], [140, 772]], 3.6)}
  </g>`;

  const peg = `<g>
    ${paint(p, 'peg', 'M216,694 L243,694 L237,784 C235,792 226,792 224,784 Z', {
      fill: url('peg'),
      ink,
      strokes: [
        { d: 'M238,694 L233,786', c: C.woodLo, w: 8, o: 0.7, b: 4 },
        { d: 'M222,700 L226,780', c: C.woodHi, w: 3, o: 0.6, b: 1 },
        { d: 'M230,710 L229,760', c: C.woodLo, w: 1.4, o: 0.8, b: 0 },
      ],
    })}
    <path d="M217,712 L242,712 M219,764 L238,764" stroke="${url('iron')}" stroke-width="6"/>
    <path d="M222,782 L238,782 L236,795 L224,795 Z" fill="${url('iron')}" stroke="${ink}" stroke-width="1.8"/>
    ${paint(p, 'socket', 'M208,660 L253,656 L247,696 C237,704 222,704 214,696 Z', {
      fill: url('peg'),
      ink,
      strokes: [
        { d: 'M246,656 L242,700', c: C.woodLo, w: 14, o: 0.75, b: 6 },
        { d: 'M212,664 L252,660', c: C.woodHi, w: 4, o: 0.5, b: 2 },
      ],
    })}
    <path d="M209,672 L252,668 M211,686 L249,682" stroke="${C.leatherLo}" stroke-width="5"/>
    <circle cx="216" cy="672" r="2.4" fill="${C.gold}"/><circle cx="244" cy="669" r="2.4" fill="${C.gold}"/>
  </g>`;

  // —— the torso: the open coat shows the cave of his ribs ——
  const cave = 'M178,284 C156,316 146,360 146,410 C146,440 150,466 154,488 L246,488 C250,466 254,440 254,410 C254,360 244,316 222,284 Z';
  const torso = paint(p, 'cave', cave, {
    fill: '#1d0f09',
    ink: 'none',
    line: 0,
    strokes: [
      { d: 'M200,290 L200,486', c: '#000', w: 40, o: 0.6, b: 12 },
      { d: 'M236,300 C252,350 254,420 246,480', c: C.ghost, w: 18, o: 0.18, b: 12 },
      { d: 'M164,300 C150,350 148,420 156,480', c: '#5a2a14', w: 18, o: 0.5, b: 12 },
    ],
  });
  const spine = Array.from({ length: 13 }, (_, i) => {
    const y = 300 + i * 14.4;
    const w = 14 + i * 0.9;
    return `<path d="M${f1(200 - w / 2)},${f1(y + 4)} C${f1(200 - w / 2)},${f1(y - 1)} ${f1(200 + w / 2)},${f1(y - 1)} ${f1(200 + w / 2)},${f1(y + 4)} C${f1(200 + w / 2)},${f1(y + 10)} ${f1(200 - w / 2)},${f1(y + 10)} ${f1(200 - w / 2)},${f1(y + 4)} Z" fill="${C.boneDeep}" stroke="${ink}" stroke-width="1.4"/>
      <path d="M${f1(200 - w / 2 + 2)},${f1(y + 2.5)} L${f1(200 + w / 4)},${f1(y + 2.5)}" stroke="${C.boneLo}" stroke-width="1.6" stroke-linecap="round"/>`;
  }).join('');
  const ribs = Array.from({ length: 7 }, (_, i) => {
    const y = 292 + i * 15;
    const floating = i >= 5;
    const reach = floating ? 40 - (i - 5) * 8 : 64 - Math.abs(i - 2) * 2;
    const drop = 20 + i * 2.6;
    const w = 8.4 - i * 0.5;
    const left = `M193,${y} C182,${y - 5} ${f1(200 - reach * 0.7)},${y - 1} ${f1(200 - reach)},${f1(y + drop)}`;
    const right = `M207,${y} C218,${y - 5} ${f1(200 + reach * 0.7)},${y - 1} ${f1(200 + reach)},${f1(y + drop)}`;
    return (
      rod(left, { width: w, ink, body: C.bone, light: C.boneHi }) +
      rod(right, { width: w, ink, body: C.boneLo, light: '#d9c7a0' })
    );
  }).join('');
  const sternum = paint(p, 'sternum', 'M193,284 L207,284 L210,340 L205,384 L195,384 L190,340 Z', {
    fill: url('bone'),
    ink,
    line: 1.8,
    strokes: [
      { d: 'M206,288 L207,380', c: C.boneLo, w: 5, o: 0.8, b: 2 },
      { d: 'M194,300 L196,370', c: C.boneHi, w: 3, o: 0.8, b: 1 },
    ],
    after: `<path d="M192,306 L208,306 M192,330 L208,330 M194,354 L206,354" stroke="${C.boneLo}" stroke-width="1.4"/>`,
  });
  const shirt = `<g stroke="${ink}" stroke-width="1.4" stroke-linejoin="round" filter="${url('cloth')}">
    <path d="M178,284 L190,282 L186,306 L180,298 L182,330 L172,318 L168,356 L160,334 L156,312 Z" fill="${C.linen}"/>
    <path d="M222,284 L210,282 L214,310 L220,300 L218,336 L230,322 L232,352 L240,330 L244,306 Z" fill="#c4b898"/>
    <path d="M154,430 L168,442 L162,458 L172,466 L160,488 L154,488 Z" fill="${C.linenLo}"/>
    <path d="M248,424 L236,438 L244,452 L234,466 L246,488 L248,488 Z" fill="${C.linenLo}"/>
  </g>`;

  // —— the open coat front ——
  const hemL = hemPoints
    .filter(([x]) => x < 160)
    .map(([x, y]) => `L${f1(x)},${f1(y)}`)
    .join(' ');
  const hemR = hemPoints
    .filter(([x]) => x > 240)
    .reverse()
    .map(([x, y]) => `L${f1(x)},${f1(y)}`)
    .join(' ');
  const panelL = paint(
    p,
    'panelL',
    `M130,288 C110,302 106,360 102,430 C98,500 94,570 88,640 ${hemL} L160,632 C158,590 156,540 154,488 C152,440 152,400 154,380 C156,350 160,320 178,284 C160,280 142,282 130,288 Z`,
    {
      fill: url('coat'),
      ink,
      filter: url('cloth'),
      strokes: [
        { d: 'M116,320 C110,400 106,500 100,620', c: C.navyHi, w: 10, o: 0.45, b: 7 },
        { d: 'M144,340 C142,430 144,520 150,620', c: C.navyDeep, w: 16, o: 0.55, b: 7 },
        { d: 'M126,520 C122,560 120,600 118,630', c: C.navyDeep, w: 4, o: 0.8, b: 2 },
        { d: 'M108,470 C112,520 110,570 106,620', c: C.navyHi, w: 3, o: 0.5, b: 1 },
        { d: 'M134,300 C150,296 162,292 172,288', c: C.warm, w: 8, o: 0.25, b: 4 },
      ],
    },
  );
  const panelR = paint(
    p,
    'panelR',
    `M272,286 C292,300 294,360 298,430 C302,500 306,570 314,636 ${hemR} L240,632 C242,590 244,540 246,488 C248,440 248,400 246,380 C244,350 240,320 222,284 C240,280 258,280 272,286 Z`,
    {
      fill: url('coat'),
      ink,
      filter: url('cloth'),
      strokes: [
        { d: 'M286,320 C292,400 296,500 304,620', c: C.navyDeep, w: 22, o: 0.6, b: 7 },
        { d: 'M258,340 C258,430 256,520 252,620', c: C.navyHi, w: 8, o: 0.3, b: 7 },
        { d: 'M300,400 C304,480 306,560 310,630', c: C.ghost, w: 6, o: 0.22, b: 4 },
        { d: 'M276,520 C280,560 282,600 284,630', c: C.navyDeep, w: 4, o: 0.8, b: 2 },
      ],
    },
  );
  const embroidery = `${scroll(C, [[156, 512], [158, 548], [159, 584], [160, 616]], 1)}${scroll(C, [[244, 512], [242, 548], [241, 584], [240, 616]], -1)}`;
  const holes = `<g fill="${C.navyDeep}" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round">
    <path d="M114,560 L124,550 L130,566 L120,574 Z"/><path d="M282,580 L292,570 L298,584 L288,590 Z"/>
    <path d="M128,436 L135,431 L138,442 L131,445 Z"/><path d="M270,452 L276,448 L279,458 L272,460 Z"/>
  </g>`;
  const pockets = `
    ${paint(p, 'pocketL', 'M104,520 L150,524 L148,546 C132,552 116,550 102,544 Z', { fill: url('coat'), ink, line: 2, strokes: [{ d: 'M104,540 L148,542', c: C.navyDeep, w: 8, o: 0.6, b: 4 }] })}
    <path d="M106,524 L149,528" stroke="${C.gold}" stroke-width="2"/>
    ${paint(p, 'pocketR', 'M250,524 L296,520 L298,544 C284,550 268,552 252,546 Z', { fill: url('coat'), ink, line: 2, strokes: [{ d: 'M252,540 L296,540', c: C.navyDeep, w: 8, o: 0.6, b: 4 }] })}
    <path d="M251,528 L295,524" stroke="${C.gold}" stroke-width="2"/>
    ${[116, 128, 140].map((x) => `<circle cx="${x}" cy="${535 + (x - 116) * 0.05}" r="2.6" fill="${url('gold')}" stroke="${ink}" stroke-width="1"/>`).join('')}
    ${[262, 274, 286].map((x) => `<circle cx="${x}" cy="536" r="2.6" fill="${url('gold')}" stroke="${ink}" stroke-width="1"/>`).join('')}`;
  const buttons = [336, 370, 404, 438]
    .map((y) => `<circle cx="134" cy="${y}" r="4.4" fill="${url('gold')}" stroke="${ink}" stroke-width="1.4"/><circle cx="133" cy="${y - 1.4}" r="1.4" fill="${C.goldHi}"/>
      <circle cx="267" cy="${y}" r="4.4" fill="${url('gold')}" stroke="${ink}" stroke-width="1.4"/>`)
    .join('');

  const lapelL = paint(p, 'lapelL', 'M178,284 C156,316 146,360 146,410 C146,440 150,466 154,488 L142,488 C138,460 134,430 134,396 C134,372 136,352 138,338 L124,316 L144,302 C152,294 164,288 178,284 Z', {
    fill: url('lining'),
    ink,
    strokes: [
      { d: 'M170,292 C158,330 152,390 150,480', c: C.redHi, w: 5, o: 0.6, b: 2 },
      { d: 'M144,330 C144,390 145,450 148,488', c: C.redLo, w: 6, o: 0.7, b: 4 },
    ],
    after: `<path d="M177,287 C156,318 148,362 148,410 C148,440 151,464 155,486" fill="none" stroke="${C.gold}" stroke-width="2.4"/>${scroll(C, [[168, 300], [158, 330], [152, 362], [150, 396], [150, 430], [152, 462]], 1)}`,
  });
  const lapelR = paint(p, 'lapelR', 'M222,284 C244,316 254,360 254,410 C254,440 250,466 246,488 L258,488 C262,460 266,430 266,396 C266,372 264,352 262,338 L276,316 L256,302 C248,294 236,288 222,284 Z', {
    fill: url('lining'),
    ink,
    strokes: [
      { d: 'M232,294 C244,330 250,390 252,480', c: C.redLo, w: 8, o: 0.75, b: 4 },
      { d: 'M256,320 C258,380 258,440 256,488', c: C.ghost, w: 3, o: 0.25, b: 2 },
    ],
    after: `<path d="M223,287 C244,318 252,362 252,410 C252,440 249,464 245,486" fill="none" stroke="${C.gold}" stroke-width="2.4"/>${scroll(C, [[232, 300], [242, 330], [248, 362], [250, 396], [250, 430], [248, 462]], -1)}`,
  });
  const collar = paint(p, 'collar', 'M146,294 C150,270 166,260 180,260 L222,260 C236,260 252,270 254,294 L246,302 C232,286 168,286 154,302 Z', {
    fill: url('coat'),
    ink,
    strokes: [
      { d: 'M152,290 C168,276 232,276 248,290', c: C.red, w: 5, o: 0.9, b: 0 },
      { d: 'M236,268 C246,274 252,284 252,294', c: C.navyDeep, w: 8, o: 0.6, b: 4 },
    ],
  });

  // —— sash, belt and cutlass ——
  const sash = `${paint(p, 'sash', 'M150,462 C180,470 222,470 252,462 L254,476 C222,484 180,484 148,476 Z', { fill: url('lining'), ink, line: 2 })}
    ${paint(p, 'sashTail', 'M244,476 C252,496 258,520 262,548 L254,552 L252,538 L246,556 C244,530 240,504 236,482 Z', {
      fill: C.red,
      ink,
      line: 1.8,
      strokes: [{ d: 'M248,480 C254,506 256,528 256,548', c: C.redLo, w: 6, o: 0.7, b: 2 }],
    })}`;
  const belt = `${paint(p, 'belt', 'M150,474 C180,482 222,482 252,474 L254,494 C222,502 180,502 148,494 Z', {
    fill: url('leather'),
    ink,
    strokes: [{ d: 'M152,478 C182,486 220,486 252,478', c: C.leatherHi, w: 3, o: 0.6, b: 1 }],
  })}
    <rect x="188" y="472" width="26" height="30" rx="4" fill="none" stroke="${url('gold')}" stroke-width="5.4"/>
    <rect x="188" y="472" width="26" height="30" rx="4" fill="none" stroke="${ink}" stroke-width="1.2"/>
    <path d="M201,474 L201,500" stroke="${C.goldLo}" stroke-width="3"/>
    <path d="M191,476 L196,476" stroke="${C.goldHi}" stroke-width="1.6" stroke-linecap="round"/>`;
  const cutlass = `<g>
    ${paint(p, 'scabbard', 'M158,500 C142,556 124,610 104,664 L118,670 C136,618 156,562 172,504 Z', {
      fill: url('leather'),
      ink,
      strokes: [{ d: 'M168,506 C152,560 134,614 116,668', c: C.leatherLo, w: 6, o: 0.7, b: 2 }],
    })}
    <path d="M103,662 L119,668 L112,686 L100,680 Z" fill="${url('gold')}" stroke="${ink}" stroke-width="1.8"/>
    <path d="M160,512 L171,515" stroke="${C.gold}" stroke-width="3"/>
    <path d="M152,494 C140,486 133,472 134,458" stroke="${ink}" stroke-width="10" stroke-linecap="round" fill="none"/>
    <path d="M152,494 C140,486 133,472 134,458" stroke="${C.leatherHi}" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M146,502 C150,484 170,480 180,492 C174,506 160,510 146,502 Z" fill="${url('gold')}" stroke="${ink}" stroke-width="2"/>
    <path d="M152,498 C158,490 168,490 174,494" stroke="${C.goldHi}" stroke-width="1.6" fill="none"/>
    <circle cx="133" cy="456" r="5.4" fill="${url('gold')}" stroke="${ink}" stroke-width="1.6"/>
  </g>`;

  // —— his right arm hangs, the hand on the hilt ——
  const armR = paint(p, 'armR', 'M130,288 C110,294 98,318 96,352 C94,388 98,422 104,446 L150,442 C148,416 150,378 152,342 C154,310 148,292 130,288 Z', {
    fill: url('coat'),
    ink,
    filter: url('cloth'),
    strokes: [
      { d: 'M108,320 C104,360 104,400 108,440', c: C.navyHi, w: 12, o: 0.5, b: 7 },
      { d: 'M146,320 C146,360 144,400 146,440', c: C.navyDeep, w: 14, o: 0.6, b: 7 },
      { d: 'M114,388 C124,394 136,394 146,388', c: C.navyDeep, w: 3, o: 0.7, b: 2 },
      { d: 'M110,336 C118,340 126,342 134,340', c: C.navyDeep, w: 2.4, o: 0.6, b: 1 },
    ],
  });
  const cuffR = `${paint(p, 'cuffR', 'M100,426 C116,420 138,418 152,420 C156,434 158,450 160,466 C140,474 114,474 92,468 C94,454 96,440 100,426 Z', {
    fill: url('lining'),
    ink,
    strokes: [
      { d: 'M102,430 C118,424 138,422 152,424', c: C.redHi, w: 6, o: 0.6, b: 2 },
      { d: 'M152,424 L158,468', c: C.redLo, w: 14, o: 0.75, b: 4 },
      { d: 'M96,460 C116,466 140,466 158,462', c: C.redLo, w: 6, o: 0.6, b: 2 },
    ],
  })}
    <path d="M102,446 C112,440 120,452 130,444 C138,438 146,450 154,442" fill="none" stroke="${C.gold}" stroke-width="1.8"/>
    <path d="M100,458 C112,454 122,462 134,456 C142,452 150,460 156,456" fill="none" stroke="${C.gold}" stroke-width="1.4" opacity="0.8"/>
    ${[110, 126, 142].map((x) => `<circle cx="${x}" cy="${434 - (x - 110) * 0.08}" r="3" fill="${url('gold')}" stroke="${ink}" stroke-width="1"/>`).join('')}`;
  const handR = `<g>
    ${rod('M118,464 L124,476', { width: 6, ink, body: C.boneLo, light: C.bone })}
    ${rod('M130,466 L134,476', { width: 5, ink, body: C.boneLo, light: C.bone })}
    <path d="M116,474 C120,466 140,468 144,478 C142,486 126,488 116,482 Z" fill="${url('bone')}" stroke="${ink}" stroke-width="1.8"/>
    ${[0, 1, 2, 3]
      .map((k) =>
        rod(`M${122 + k * 6},${478 + k * 0.5} C${130 + k * 6},${480} ${134 + k * 5},${488} ${131 + k * 5},${495 + k}`, {
          width: 4.4,
          ink,
          body: k % 2 ? C.bone : '#f4ead2',
          light: C.boneHi,
        }),
      )
      .join('')}
    ${rod('M116,480 C112,488 116,496 124,498', { width: 4.6, ink, body: C.bone, light: C.boneHi })}
  </g>`;

  // —— his left arm raised, the lantern held out beside his face ——
  const upperL = paint(p, 'upperL', 'M262,284 C290,284 320,304 338,336 C348,354 340,374 322,372 C304,370 294,352 282,336 C272,322 262,312 258,298 Z', {
    fill: url('coat'),
    ink,
    filter: url('cloth'),
    strokes: [
      { d: 'M272,292 C296,298 316,316 330,340', c: C.navyHi, w: 8, o: 0.4, b: 4 },
      { d: 'M276,330 C292,350 306,366 324,368', c: C.navyDeep, w: 12, o: 0.65, b: 6 },
      { d: 'M300,318 C304,330 312,340 322,344', c: C.navyDeep, w: 2.4, o: 0.7, b: 1 },
    ],
  });
  const foreL = paint(p, 'foreL', 'M316,356 C322,322 330,290 338,262 L370,268 C364,300 356,330 346,360 C340,376 318,374 316,356 Z', {
    fill: url('coat'),
    ink,
    filter: url('cloth'),
    strokes: [
      { d: 'M326,350 C332,320 338,294 344,268', c: C.navyHi, w: 8, o: 0.35, b: 4 },
      { d: 'M354,352 C360,322 366,296 368,270', c: C.ghost, w: 8, o: 0.3, b: 4 },
      { d: 'M330,320 C338,324 348,326 358,322', c: C.navyDeep, w: 2.4, o: 0.7, b: 1 },
    ],
  });
  const cuffL = `${paint(p, 'cuffL', 'M332,240 L378,248 L372,280 L326,272 Z', {
    fill: url('lining'),
    ink,
    strokes: [
      { d: 'M372,250 L366,280', c: C.redLo, w: 10, o: 0.6, b: 4 },
      { d: 'M334,244 L376,252', c: C.ghost, w: 4, o: 0.35, b: 2 },
    ],
  })}
    <path d="M330,256 C340,250 348,262 358,256 C366,252 372,262 376,258" fill="none" stroke="${C.gold}" stroke-width="1.6"/>
    ${[340, 354, 366].map((x) => `<circle cx="${x}" cy="${266 + (x - 340) * 0.15}" r="2.6" fill="${url('gold')}" stroke="${ink}" stroke-width="1"/>`).join('')}`;
  const handL = `<g>
    ${rod('M348,240 C352,232 356,226 362,222', { width: 6, ink, body: C.boneLo, light: C.bone })}
    ${rod('M360,244 C364,236 368,230 372,226', { width: 5, ink, body: C.boneLo, light: C.bone })}
    <path d="M358,222 C362,208 384,206 388,218 C390,228 378,234 368,232 C360,232 356,228 358,222 Z" fill="${url('bone')}" stroke="${ink}" stroke-width="1.8"/>
    ${[0, 1, 2, 3]
      .map((k) =>
        rod(`M${364 + k * 6},${214 - (k % 2)} C${366 + k * 6},${202} ${374 + k * 5},${198} ${378 + k * 4},${206}`, {
          width: 4,
          ink,
          body: k % 2 ? C.bone : '#f4ead2',
          light: C.boneHi,
        }),
      )
      .join('')}
  </g>`;

  const glow = `<circle cx="384" cy="258" r="170" fill="${url('glow')}"/>`;
  const lantern = `<g>
    <circle cx="376" cy="206" r="9" fill="none" stroke="${url('iron')}" stroke-width="3.4"/>
    <path d="M376,214 L384,226" stroke="${C.iron}" stroke-width="3"/>
    <path d="M370,226 L398,226 L394,236 L374,236 Z" fill="${url('iron')}" stroke="${ink}" stroke-width="1.8"/>
    <path d="M374,226 L384,214 L394,226 Z" fill="${C.iron}" stroke="${ink}" stroke-width="1.4"/>
    <rect x="372" y="236" width="24" height="44" rx="3" fill="#e4ffd2" opacity="0.4"/>
    <path d="M384,276 C375,270 374,256 380,246 C381,254 385,256 387,248 C392,256 394,268 384,276 Z" fill="${url('flame')}"/>
    <path d="M384,274 C380,270 380,264 383,259 C385,263 387,267 384,274 Z" fill="#fdfff4"/>
    <path d="M372,236 L372,280 M396,236 L396,280 M384,236 L384,244" stroke="${url('iron')}" stroke-width="3.4"/>
    <path d="M368,280 L400,280 L396,290 L372,290 Z" fill="${url('iron')}" stroke="${ink}" stroke-width="1.8"/>
    <path d="M376,290 L392,290 L388,296 L380,296 Z" fill="${C.iron}"/>
  </g>`;

  // —— the head ——
  const neck = `<g>${rod('M200,248 L200,290', { width: 15, ink, body: C.boneLo, light: C.bone })}
    <path d="M192,262 L208,262 M192,276 L208,276" stroke="${ink}" stroke-width="1.6"/></g>`;
  const skullShape = 'M162,156 C160,126 180,110 202,110 C226,110 244,128 242,158 C242,176 238,190 232,200 C234,212 230,224 222,230 L219,240 C211,248 193,248 185,240 L182,230 C172,224 168,212 170,200 C164,190 162,174 162,156 Z';
  const skull = `<g>
    ${paint(p, 'skull', skullShape, {
      fill: url('bone'),
      ink,
      line: 2.4,
      filter: url('pores'),
      strokes: [
        { d: 'M234,150 C240,172 236,192 228,206', c: C.boneDeep, w: 14, o: 0.55, b: 7 },
        { d: 'M166,150 C164,172 168,190 174,200', c: C.boneHi, w: 8, o: 0.6, b: 4 },
        { d: 'M178,198 C182,206 190,208 196,204', c: C.boneHi, w: 6, o: 0.8, b: 2 },
        { d: 'M206,204 C212,208 222,206 226,198', c: C.boneLo, w: 6, o: 0.8, b: 2 },
        { d: 'M176,214 C180,222 186,226 190,226', c: C.boneDeep, w: 7, o: 0.6, b: 4 },
        { d: 'M228,212 C224,222 218,226 212,226', c: C.boneDeep, w: 7, o: 0.6, b: 4 },
        { d: 'M240,160 C244,180 240,200 232,214', c: C.ghost, w: 6, o: 0.45, b: 4 },
      ],
    })}
    <path d="M172,138 L178,150 L174,158 M224,128 L220,140" fill="none" stroke="${C.boneDeep}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M170,176 C172,162 192,160 196,172 C198,186 190,194 180,193 C172,192 168,186 170,176 Z" fill="${url('socket')}" stroke="${ink}" stroke-width="2"/>
    <path d="M172,170 C178,163 190,163 195,170" fill="none" stroke="${C.boneDeep}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
    <circle cx="184" cy="179" r="13" fill="${url('ember')}" opacity="0.9"/>
    <circle cx="184" cy="179" r="3.6" fill="#fff6c8"/>
    <path d="M201,194 C196,202 193,210 197,214 L201,211 L205,214 C209,210 206,202 201,194 Z" fill="${C.void}" stroke="${ink}" stroke-width="1.8"/>
    <path d="M180,218 C190,214 212,214 222,218 L220,232 C208,236 194,236 182,232 Z" fill="${C.boneLo}" stroke="${ink}" stroke-width="1.6"/>
    ${teeth(ink, 182, 218, 8, 4.9, 13, 2)}
    ${paint(p, 'jaw', 'M172,222 C172,242 186,262 202,262 C218,262 232,242 232,222 L226,232 C216,244 188,244 178,232 Z', {
      fill: url('bone'),
      ink,
      strokes: [
        { d: 'M222,236 C220,250 212,258 202,260', c: C.boneDeep, w: 8, o: 0.55, b: 4 },
        { d: 'M178,238 C182,250 190,256 198,258', c: C.boneHi, w: 5, o: 0.7, b: 2 },
      ],
    })}
    ${teeth(ink, 184, 233, 7, 4.9, 8, -1)}
    ${paint(p, 'patch', 'M206,166 C214,156 234,158 238,170 C242,184 232,194 220,194 C210,194 204,182 206,166 Z', {
      fill: url('felt'),
      ink,
      line: 2,
      strokes: [{ d: 'M212,166 C218,160 228,160 232,166', c: C.feltHi, w: 4, o: 0.8, b: 1 }],
    })}
    <path d="M208,168 L166,146 M238,172 L246,166" stroke="${C.felt}" stroke-width="3.4" stroke-linecap="round"/>
  </g>`;

  // —— the bandana and the tricorn ——
  const bandana = `${paint(p, 'bandana', 'M160,150 C180,140 222,140 244,150 L246,162 C222,154 180,154 158,164 Z', { fill: url('lining'), ink, line: 2 })}
    ${paint(p, 'knot', 'M242,154 C258,158 268,172 270,190 L262,184 L258,198 C254,182 248,170 240,164 Z', {
      fill: C.red,
      ink,
      line: 1.8,
      strokes: [{ d: 'M246,160 C256,168 262,178 264,190', c: C.redLo, w: 5, o: 0.7, b: 2 }],
    })}`;
  const hatShape = 'M100,86 C104,64 126,52 150,56 C160,40 182,30 204,30 C226,30 246,40 254,54 C278,48 300,60 306,82 C298,106 276,128 250,144 C234,154 218,162 204,164 C190,162 172,154 156,144 C130,128 108,108 100,86 Z';
  const hat = `<g>
    ${paint(p, 'hat', hatShape, {
      fill: url('felt'),
      ink,
      line: 2.6,
      filter: url('cloth'),
      strokes: [
        { d: 'M112,82 C126,66 146,62 158,66', c: C.feltHi, w: 10, o: 0.6, b: 4 },
        { d: 'M158,62 C170,86 186,120 200,158', c: C.feltLo, w: 10, o: 0.8, b: 4 },
        { d: 'M250,58 C240,86 222,120 208,158', c: C.feltLo, w: 12, o: 0.8, b: 4 },
        { d: 'M176,46 C190,38 214,38 230,46', c: C.feltHi, w: 6, o: 0.5, b: 2 },
        { d: 'M262,64 C282,62 296,72 302,84', c: C.ghost, w: 6, o: 0.3, b: 4 },
        { d: 'M130,96 C150,116 172,132 196,146', c: C.feltHi, w: 6, o: 0.35, b: 4 },
      ],
    })}
    <path d="M104,90 C114,114 134,132 158,146 C174,156 190,162 204,164 C218,162 234,156 250,146 C274,132 294,112 302,86" fill="none" stroke="${url('gold')}" stroke-width="5.4"/>
    <path d="M104,90 C114,114 134,132 158,146 C174,156 190,162 204,164 C218,162 234,156 250,146 C274,132 294,112 302,86" fill="none" stroke="${C.goldLo}" stroke-width="1.4" stroke-dasharray="1.5 5"/>
    <path d="M140,124 L146,130 M262,124 L256,132 M226,62 L232,70" stroke="${C.feltLo}" stroke-width="2.4" stroke-linecap="round"/>
    <g transform="translate(204 126)">
      <path d="M-10,-4 C-10,-13 10,-13 10,-4 C10,2 6,5 5,9 L-5,9 C-6,5 -10,2 -10,-4 Z" fill="${url('gold')}" stroke="${ink}" stroke-width="1.3"/>
      <circle cx="-3.6" cy="-3" r="2.2" fill="${ink}"/><circle cx="3.6" cy="-3" r="2.2" fill="${ink}"/>
      <path d="M-15,5 L15,15 M15,5 L-15,15" stroke="${url('gold')}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M-15,5 L15,15 M15,5 L-15,15" stroke="${ink}" stroke-width="0.8" stroke-linecap="round" opacity="0.6"/>
    </g>
    <path d="M262,108 C270,104 278,108 276,116 C272,122 264,120 262,114 Z" fill="${C.weed}" stroke="${C.weedLo}" stroke-width="1"/>
  </g>`;

  // —— sea-rot ——
  const weed = `<g fill="none" stroke-linecap="round">
    <path d="M140,290 C130,312 144,332 130,356 C122,372 130,388 120,408" stroke="${C.weedLo}" stroke-width="8"/>
    <path d="M140,290 C130,312 144,332 130,356 C122,372 130,388 120,408" stroke="${C.weed}" stroke-width="5"/>
    <path d="M140,290 C132,310 142,330 132,352" stroke="${C.weedHi}" stroke-width="1.6"/>
    <path d="M150,292 C158,314 146,330 152,350" stroke="${C.weedLo}" stroke-width="6"/>
    <path d="M150,292 C158,314 146,330 152,350" stroke="${C.weed}" stroke-width="3.6"/>
    <path d="M264,288 C274,302 266,320 276,336" stroke="${C.weedLo}" stroke-width="7"/>
    <path d="M264,288 C274,302 266,320 276,336" stroke="${C.weedHi}" stroke-width="4"/>
  </g>
  ${barnacles(rand, [[116, 606], [124, 598], [110, 616], [290, 610], [298, 602], [284, 622]], 4.4)}`;

  const shadow = `<ellipse cx="200" cy="790" rx="122" ry="13" fill="#000" opacity="0.55" filter="url(#${p}-b7)"/>`;

  const body = [
    defs,
    shadow,
    plume,
    coatBack,
    liningBack,
    breechL,
    breechR,
    boot,
    peg,
    torso,
    spine,
    ribs,
    sternum,
    shirt,
    panelL,
    panelR,
    holes,
    embroidery,
    pockets,
    buttons,
    lapelL,
    lapelR,
    glow,
    sash,
    belt,
    cutlass,
    armR,
    cuffR,
    handR,
    upperL,
    foreL,
    cuffL,
    handL,
    lantern,
    neck,
    collar,
    weed,
    skull,
    bandana,
    hat,
  ].join('\n');
  return svg('0 0 420 800', body, { label: 'Captain Blackrot' });
}

function teeth(ink, x0, y, count, w, h, gold) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = x0 + i * w;
    const fill = i === gold ? '#e8b74c' : i % 3 === 1 ? '#d8cba8' : '#f1e8cf';
    out += `<rect x="${f1(x)}" y="${y}" width="${f1(w - 0.8)}" height="${h}" rx="1.6" fill="${fill}" stroke="${ink}" stroke-width="1.1"/>`;
  }
  return out;
}

function barnacles(rand, spots, size) {
  return spots
    .map(([x, y]) => {
      const r = size * (0.7 + rand() * 0.6);
      return `<g><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="#d4cbb4" stroke="#3b3326" stroke-width="1.2"/>
        <circle cx="${f1(x - r * 0.2)}" cy="${f1(y - r * 0.2)}" r="${f1(r * 0.35)}" fill="#f4efe2" opacity="0.7"/>
        <circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 0.4)}" fill="#3b3326"/></g>`;
    })
    .join('');
}

/** A row of small gold scroll-work curls along an edge; `side` turns them outward. */
function scroll(C, spots, side) {
  return spots
    .map(([x, y]) => {
      const s = side;
      return `<path d="M${x},${y - 8} c${f1(-7 * s)},2 ${f1(-9 * s)},9 ${f1(-3 * s)},11 c${f1(4 * s)},1 ${f1(6 * s)},-4 ${f1(2 * s)},-6" fill="none" stroke="${C.gold}" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="${f1(x - 6 * s)}" cy="${y + 7}" r="1.4" fill="${C.gold}"/>`;
    })
    .join('');
}
