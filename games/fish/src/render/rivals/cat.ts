import {
  blinkAmount,
  breath,
  type Ctx,
  drawGrumpCloud,
  drawHeldCards,
  drawSparkles,
  drawThoughtBubble,
  ellipse,
  hop,
  type RivalPainter,
  type RivalPose,
} from './common';

/**
 * Miso the cat: a calico who remembers every ask and every card that changed hands. She sits
 * tall on a mossy stone at the water's edge, tail wrapped round her feet, one paw raised with
 * her cards fanned in it. Her eyes do the work: green almonds with slit pupils that narrow while
 * she reckons who holds what.
 */

interface Coat {
  white: string;
  whiteShade: string;
  orange: string;
  orangeShade: string;
  black: string;
  nose: string;
  earInner: string;
  iris: string;
  irisRim: string;
  whisker: string;
  stone: string;
  stoneShade: string;
  moss: string;
  mossLight: string;
  blush: string;
}

const DAY: Coat = {
  white: '#f8f3ea',
  whiteShade: '#ddd2c2',
  orange: '#e3944a',
  orangeShade: '#c07230',
  black: '#2f2b30',
  nose: '#f095a3',
  earInner: '#f3b4bc',
  iris: '#8fd06c',
  irisRim: '#4c8a39',
  whisker: 'rgba(120, 110, 100, 0.75)',
  stone: '#aba497',
  stoneShade: '#7d7669',
  moss: '#6fa04c',
  mossLight: '#94c46a',
  blush: 'rgba(240, 130, 140, 0.4)',
};

const NIGHT: Coat = {
  white: '#d9d6db',
  whiteShade: '#a8a3ad',
  orange: '#b9773f',
  orangeShade: '#8c5428',
  black: '#19171c',
  nose: '#c9798a',
  earInner: '#c68e9a',
  iris: '#a7ee7c',
  irisRim: '#4e8f3d',
  whisker: 'rgba(230, 235, 245, 0.55)',
  stone: '#4c5362',
  stoneShade: '#2f3441',
  moss: '#2f5c45',
  mossLight: '#41785a',
  blush: 'rgba(220, 120, 150, 0.32)',
};

export const CAT: RivalPainter = {
  height: 196,
  draw(ctx: Ctx, pose: RivalPose): void {
    const coat = pose.look.dark ? NIGHT : DAY;
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.scale(pose.scale, pose.scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    drawStone(ctx, coat);
    const lift = pose.mood === 'delighted' ? -9 * hop(pose.moodAge) : 0;
    ctx.translate(0, lift);
    drawBody(ctx, coat, pose);
    drawHead(ctx, coat, pose);
    drawRaisedPaw(ctx, coat, pose);
    drawTail(ctx, coat, pose);
    if (pose.mood === 'thinking') drawThoughtBubble(ctx, 88, -166, pose.time, pose.look);
    if (pose.mood === 'delighted') {
      drawSparkles(ctx, 0, -140, 76, pose.time, pose.look.dark ? '#ffe27a' : '#ffffff');
    }
    if (pose.mood === 'grumpy') drawGrumpCloud(ctx, 44, -222, pose.time, pose.look);
    ctx.restore();
  },
};

function drawStone(ctx: Ctx, coat: Coat): void {
  ctx.beginPath();
  ctx.moveTo(-78, 20);
  ctx.bezierCurveTo(-82, -6, -40, -12, 0, -10);
  ctx.bezierCurveTo(46, -12, 84, -4, 80, 22);
  ctx.bezierCurveTo(70, 40, -66, 42, -78, 20);
  ctx.closePath();
  const stone = ctx.createLinearGradient(0, -12, 0, 40);
  stone.addColorStop(0, coat.stone);
  stone.addColorStop(1, coat.stoneShade);
  ctx.fillStyle = stone;
  ctx.fill();
  // Moss along the top, ragged at its edge.
  ctx.beginPath();
  ctx.moveTo(-74, 6);
  ctx.bezierCurveTo(-60, -10, -20, -12, 10, -11);
  ctx.bezierCurveTo(40, -12, 70, -6, 76, 6);
  for (let x = 76; x >= -74; x -= 8) ctx.lineTo(x, 4 + ((x * 7) % 5));
  ctx.closePath();
  ctx.fillStyle = coat.moss;
  ctx.fill();
  ctx.fillStyle = coat.mossLight;
  for (const [x, y] of [
    [-50, -4],
    [-30, -8],
    [-8, -9],
    [24, -9],
    [50, -6],
    [64, -1],
  ] as const) {
    ellipse(ctx, x, y, 6, 2.4);
    ctx.fill();
  }
}

function drawBody(ctx: Ctx, coat: Coat, pose: RivalPose): void {
  const swell = breath(pose.time, pose.seed) * 1.4;
  ctx.beginPath();
  ctx.moveTo(-44, -4);
  ctx.bezierCurveTo(-52 - swell, -40, -38, -82, -22, -96);
  ctx.quadraticCurveTo(0, -104, 22, -96);
  ctx.bezierCurveTo(38, -82, 52 + swell, -40, 44, -4);
  ctx.quadraticCurveTo(0, 6, -44, -4);
  ctx.closePath();
  ctx.fillStyle = coat.white;
  ctx.fill();
  // Calico patches on the flanks, kept inside the body's outline.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = coat.orange;
  ctx.beginPath();
  ctx.moveTo(-60, -90);
  ctx.bezierCurveTo(-30, -84, -26, -50, -32, -20);
  ctx.bezierCurveTo(-38, 0, -60, 0, -60, -20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = coat.black;
  ctx.beginPath();
  ctx.moveTo(60, -70);
  ctx.bezierCurveTo(30, -66, 28, -36, 36, -14);
  ctx.bezierCurveTo(44, 0, 64, -6, 60, -30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = coat.whiteShade;
  ellipse(ctx, 0, -6, 46, 8);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-44, -4);
  ctx.bezierCurveTo(-52 - swell, -40, -38, -82, -22, -96);
  ctx.moveTo(22, -96);
  ctx.bezierCurveTo(38, -82, 52 + swell, -40, 44, -4);
  ctx.strokeStyle = coat.whiteShade;
  ctx.lineWidth = 2;
  ctx.stroke();
  // The front leg on the ground: a soft column from the chest, outlined only down its sides.
  ctx.beginPath();
  ctx.moveTo(-24, -64);
  ctx.quadraticCurveTo(-27, -30, -23, -6);
  ctx.lineTo(-5, -6);
  ctx.quadraticCurveTo(-4, -36, -6, -64);
  ctx.quadraticCurveTo(-15, -76, -24, -64);
  ctx.fillStyle = coat.white;
  ctx.fill();
  ctx.strokeStyle = coat.whiteShade;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-25, -50);
  ctx.quadraticCurveTo(-27, -30, -23, -8);
  ctx.moveTo(-5, -8);
  ctx.quadraticCurveTo(-4, -30, -5, -44);
  ctx.stroke();
  ellipse(ctx, -14, -4, 11, 6.5);
  ctx.fillStyle = coat.white;
  ctx.fill();
  ctx.stroke();
  for (const dx of [-4, 0, 4]) {
    ctx.beginPath();
    ctx.moveTo(-14 + dx, -6);
    ctx.lineTo(-14 + dx, -1);
    ctx.stroke();
  }
}

function drawHead(ctx: Ctx, coat: Coat, pose: RivalPose): void {
  const tilt =
    pose.mood === 'thinking'
      ? -0.08
      : pose.mood === 'grumpy'
        ? 0.05
        : Math.sin(pose.time * 0.7) * 0.02;
  ctx.save();
  ctx.translate(0, -126);
  ctx.rotate(tilt);
  ctx.translate(0, 126);
  drawEars(ctx, coat, pose);

  // A round head with fluffy cheeks.
  const headPath = () => {
    ctx.beginPath();
    ctx.moveTo(-40, -132);
    ctx.bezierCurveTo(-42, -160, -20, -170, 0, -170);
    ctx.bezierCurveTo(20, -170, 42, -160, 40, -132);
    ctx.lineTo(46, -124);
    ctx.lineTo(40, -120);
    ctx.lineTo(44, -112);
    ctx.bezierCurveTo(30, -98, -30, -98, -44, -112);
    ctx.lineTo(-40, -120);
    ctx.lineTo(-46, -124);
    ctx.closePath();
  };
  headPath();
  ctx.fillStyle = coat.white;
  ctx.fill();
  ctx.save();
  headPath();
  ctx.clip();
  // Orange over her left eye and ear, black over the right: a calico's mask.
  ctx.fillStyle = coat.orange;
  ctx.beginPath();
  ctx.moveTo(-50, -180);
  ctx.lineTo(-4, -180);
  ctx.bezierCurveTo(-6, -158, -8, -144, -22, -134);
  ctx.bezierCurveTo(-34, -126, -50, -124, -50, -130);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = coat.black;
  ctx.beginPath();
  ctx.moveTo(50, -180);
  ctx.lineTo(10, -180);
  ctx.bezierCurveTo(8, -164, 14, -152, 26, -146);
  ctx.bezierCurveTo(38, -140, 50, -146, 50, -150);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  headPath();
  ctx.strokeStyle = coat.whiteShade;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  drawEyes(ctx, coat, pose);
  drawMuzzle(ctx, coat, pose);
  ctx.restore();
}

function drawEars(ctx: Ctx, coat: Coat, pose: RivalPose): void {
  const flat = pose.mood === 'grumpy' ? 0.55 : pose.mood === 'thinking' ? 0.18 : 0;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 24, -156);
    // Thinking turns one ear out to listen; grumpy folds both flat.
    const turn = pose.mood === 'thinking' && side === 1 ? flat : side === 1 ? flat : -flat;
    ctx.rotate(side * (0.18 + Math.abs(turn)));
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    ctx.quadraticCurveTo(-8, -20, 0, -32);
    ctx.quadraticCurveTo(8, -20, 14, 6);
    ctx.closePath();
    ctx.fillStyle = side === -1 ? coat.orange : coat.black;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8, 4);
    ctx.quadraticCurveTo(-4, -14, 0, -22);
    ctx.quadraticCurveTo(4, -14, 8, 4);
    ctx.closePath();
    ctx.fillStyle = coat.earInner;
    ctx.fill();
    ctx.restore();
  }
}

function drawEyes(ctx: Ctx, coat: Coat, pose: RivalPose): void {
  const blink = blinkAmount(pose.time, pose.seed);
  for (const side of [-1, 1]) {
    const x = side * 16;
    const y = -136;
    if (pose.mood === 'delighted') {
      ctx.beginPath();
      ctx.moveTo(x - 8, y + 2);
      ctx.quadraticCurveTo(x, y - 7, x + 8, y + 2);
      ctx.strokeStyle = coat.black;
      ctx.lineWidth = 3;
      ctx.stroke();
      continue;
    }
    const open = pose.mood === 'thinking' ? 0.5 : pose.mood === 'grumpy' ? 0.45 : 1 - blink * 0.94;
    // An almond: pointed at both corners.
    const h = 7 * open;
    ctx.beginPath();
    ctx.moveTo(x - 9, y);
    ctx.quadraticCurveTo(x, y - h * 1.6, x + 9, y);
    ctx.quadraticCurveTo(x, y + h * 1.6, x - 9, y);
    ctx.closePath();
    ctx.fillStyle = coat.iris;
    ctx.fill();
    ctx.strokeStyle = coat.black;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    if (open > 0.25) {
      const glance = pose.mood === 'thinking' ? 3 : 0;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x - 9, y);
      ctx.quadraticCurveTo(x, y - h * 1.6, x + 9, y);
      ctx.quadraticCurveTo(x, y + h * 1.6, x - 9, y);
      ctx.clip();
      ellipse(ctx, x + glance, y, 2.2, 7);
      ctx.fillStyle = '#121014';
      ctx.fill();
      ellipse(ctx, x - 3 + glance, y - 2.5, 1.6, 1.6);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
      ctx.restore();
    }
    if (pose.mood === 'grumpy') {
      ctx.beginPath();
      ctx.moveTo(x - side * 10, y - 12);
      ctx.lineTo(x + side * 6, y - 7);
      ctx.strokeStyle = coat.black;
      ctx.lineWidth = 2.6;
      ctx.stroke();
    }
  }
}

function drawMuzzle(ctx: Ctx, coat: Coat, pose: RivalPose): void {
  ctx.beginPath();
  ctx.moveTo(-4.5, -124);
  ctx.lineTo(4.5, -124);
  ctx.lineTo(0, -119);
  ctx.closePath();
  ctx.fillStyle = coat.nose;
  ctx.fill();
  ctx.strokeStyle = coat.black;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -119);
  ctx.lineTo(0, -116);
  ctx.stroke();
  if (pose.mood === 'delighted') {
    ctx.beginPath();
    ctx.moveTo(-6, -115);
    ctx.quadraticCurveTo(0, -106, 6, -115);
    ctx.closePath();
    ctx.fillStyle = '#7a2d38';
    ctx.fill();
    ellipse(ctx, 0, -110.5, 2.8, 1.8);
    ctx.fillStyle = coat.nose;
    ctx.fill();
    ctx.fillStyle = coat.blush;
    ellipse(ctx, -28, -122, 7, 4);
    ctx.fill();
    ellipse(ctx, 28, -122, 7, 4);
    ctx.fill();
  } else if (pose.mood === 'grumpy') {
    ctx.beginPath();
    ctx.moveTo(-6, -112);
    ctx.lineTo(6, -112);
    ctx.stroke();
  } else {
    // The little "w" of a cat's mouth.
    ctx.beginPath();
    ctx.moveTo(-7, -114);
    ctx.quadraticCurveTo(-3.5, -111, 0, -116);
    ctx.quadraticCurveTo(3.5, -111, 7, -114);
    ctx.stroke();
  }
  ctx.strokeStyle = coat.whisker;
  ctx.lineWidth = 1.1;
  for (const side of [-1, 1]) {
    for (const [dy, reach, droop] of [
      [-2, 50, -8],
      [1, 54, 0],
      [4, 48, 8],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(side * 12, -118 + dy);
      ctx.quadraticCurveTo(
        side * (reach - 14),
        -118 + dy + droop * 0.3,
        side * reach,
        -118 + dy + droop,
      );
      ctx.stroke();
    }
  }
}

function drawRaisedPaw(ctx: Ctx, coat: Coat, pose: RivalPose): void {
  const raise = pose.mood === 'delighted' ? -8 : 0;
  // Her cards, held up in her right paw.
  drawHeldCards(ctx, 24, -70 + raise, pose.cards, 21, pose.look, 0.22);
  ctx.beginPath();
  ctx.moveTo(14, -78);
  ctx.quadraticCurveTo(30, -58, 22, -70 + raise);
  ctx.strokeStyle = coat.whiteShade;
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.strokeStyle = coat.white;
  ctx.lineWidth = 11;
  ctx.stroke();
  ellipse(ctx, 22, -72 + raise, 8, 7);
  ctx.fillStyle = coat.white;
  ctx.fill();
  ctx.strokeStyle = coat.whiteShade;
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function drawTail(ctx: Ctx, coat: Coat, pose: RivalPose): void {
  const puff = pose.mood === 'grumpy' ? 4 : 0;
  const flick = Math.sin(pose.time * (pose.mood === 'thinking' ? 4 : 1.6) + pose.seed) * 5;
  // Out from behind her right hip, down to the stone and along in front of her paw, the
  // white tip curling up at the end. Thick at the root, slimmer towards the tip.
  const spine: [number, number][] = [];
  const along = (t: number): [number, number] => {
    const u = 1 - t;
    const p0 = [36, -26];
    const p1 = [74, -14];
    const p2 = [40, 10];
    const p3 = [-30 + flick * 0.5, 0 - Math.abs(flick) * 0.6];
    return [
      u ** 3 * p0[0]! + 3 * u * u * t * p1[0]! + 3 * u * t * t * p2[0]! + t ** 3 * p3[0]!,
      u ** 3 * p0[1]! + 3 * u * u * t * p1[1]! + 3 * u * t * t * p2[1]! + t ** 3 * p3[1]!,
    ];
  };
  for (let i = 0; i <= 24; i++) spine.push(along(i / 24));
  const width = (t: number) => (8 - t * 2.6 + puff * 0.5) * (t > 0.92 ? 1 - (t - 0.92) * 4 : 1);
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  spine.forEach(([x, y], i) => {
    const next = spine[Math.min(spine.length - 1, i + 1)]!;
    const prev = spine[Math.max(0, i - 1)]!;
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const length = Math.hypot(dx, dy) || 1;
    const w = width(i / 24);
    left.push([x - (dy / length) * w, y + (dx / length) * w]);
    right.push([x + (dy / length) * w, y - (dx / length) * w]);
  });
  const tail = () => {
    ctx.beginPath();
    left.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    const tip = spine[spine.length - 1]!;
    ctx.quadraticCurveTo(
      tip[0] - 4,
      tip[1] - 3,
      right[right.length - 1]![0],
      right[right.length - 1]![1],
    );
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i]![0], right[i]![1]);
    ctx.closePath();
  };
  tail();
  ctx.fillStyle = coat.orange;
  ctx.fill();
  ctx.save();
  tail();
  ctx.clip();
  // The white tip.
  const [tx, ty] = along(0.86);
  ellipse(ctx, tx - 6, ty, 16, 14);
  ctx.fillStyle = coat.white;
  ctx.fill();
  ctx.restore();
  tail();
  ctx.strokeStyle = coat.orangeShade;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}
