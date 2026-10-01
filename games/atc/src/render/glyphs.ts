import type { PlaneKind } from '../engine/world';

/**
 * Plane silhouettes, drawn nose-up in a unit box and rotated to the heading. Jets have swept
 * wings; props have a rounded, elliptical wing and a propeller across the nose, so the two kinds
 * differ by shape and never by colour alone.
 */

type Outline = readonly (readonly [number, number])[];

const JET_HALF: Outline = [
  [0, -0.54],
  [0.055, -0.44],
  [0.062, -0.1],
  [0.45, 0.16],
  [0.45, 0.23],
  [0.062, 0.11],
  [0.05, 0.33],
  [0.2, 0.45],
  [0.2, 0.5],
  [0.03, 0.46],
  [0, 0.5],
];

/** The prop's parts, in unit coordinates: fuselage outline, wing and tailplane ellipses. */
const PROP_BODY: Outline = [
  [0, -0.47],
  [0.07, -0.4],
  [0.08, -0.1],
  [0.06, 0.18],
  [0.03, 0.44],
  [0, 0.46],
];
const PROP_WING = { y: -0.1, rx: 0.47, ry: 0.115 };
const PROP_TAIL = { y: 0.37, rx: 0.19, ry: 0.06 };
const PROPELLER_Y = -0.5;
const PROPELLER_HALF_SPAN = 0.19;

function mirroredPoints(half: Outline): Outline {
  return [
    ...half,
    ...half
      .slice(1, -1)
      .reverse()
      .map(([x, y]) => [-x, y] as const),
  ];
}

function outlinePath(points: Outline, path = new Path2D()): Path2D {
  points.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.closePath();
  return path;
}

function propPath(): Path2D {
  const path = outlinePath(mirroredPoints(PROP_BODY));
  path.moveTo(PROP_WING.rx, PROP_WING.y);
  path.ellipse(0, PROP_WING.y, PROP_WING.rx, PROP_WING.ry, 0, 0, Math.PI * 2);
  path.moveTo(PROP_TAIL.rx, PROP_TAIL.y);
  path.ellipse(0, PROP_TAIL.y, PROP_TAIL.rx, PROP_TAIL.ry, 0, 0, Math.PI * 2);
  return path;
}

const SHAPES: Record<PlaneKind, Path2D> = {
  jet: outlinePath(mirroredPoints(JET_HALF)),
  prop: propPath(),
};

const PROPELLER = (() => {
  const path = new Path2D();
  path.moveTo(-PROPELLER_HALF_SPAN, PROPELLER_Y);
  path.lineTo(PROPELLER_HALF_SPAN, PROPELLER_Y);
  return path;
})();

/** The same silhouette as SVG path data in a 24 × 24 box, for strips and buttons. */
export function glyphPathData(kind: PlaneKind): string {
  const to = (v: number) => (12 + v * 23).toFixed(2);
  const outline = (points: Outline) =>
    `${points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${to(x)} ${to(y)}`).join(' ')} Z`;
  if (kind === 'jet') return outline(mirroredPoints(JET_HALF));
  const ellipse = ({ y, rx, ry }: { y: number; rx: number; ry: number }) => {
    const r = `${(rx * 23).toFixed(2)} ${(ry * 23).toFixed(2)}`;
    return `M${to(-rx)} ${to(y)} A${r} 0 1 1 ${to(rx)} ${to(y)} A${r} 0 1 1 ${to(-rx)} ${to(y)} Z`;
  };
  const blade = `M${to(-PROPELLER_HALF_SPAN)} ${to(PROPELLER_Y - 0.025)} H${to(PROPELLER_HALF_SPAN)} V${to(PROPELLER_Y + 0.025)} H${to(-PROPELLER_HALF_SPAN)} Z`;
  return [outline(mirroredPoints(PROP_BODY)), ellipse(PROP_WING), ellipse(PROP_TAIL), blade].join(
    ' ',
  );
}

export interface GlyphStyle {
  fill: string;
  outline: string;
  glow: string | null;
  glowStrength: number;
}

/**
 * Draws a plane at the current transform's origin. `angle` is in radians clockwise from north;
 * `squash` flattens it onto a tilted layer.
 */
export function drawPlaneGlyph(
  ctx: CanvasRenderingContext2D,
  kind: PlaneKind,
  x: number,
  y: number,
  size: number,
  angle: number,
  squash: number,
  style: GlyphStyle,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size * squash);
  ctx.rotate(angle);
  ctx.lineJoin = 'round';
  // The outline goes first and the fill on top, so the halo frames the shape without cutting it.
  ctx.lineWidth = 0.12;
  ctx.strokeStyle = style.outline;
  ctx.stroke(SHAPES[kind]);
  if (style.glow) {
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = size * 0.35 * style.glowStrength;
  }
  ctx.fillStyle = style.fill;
  ctx.fill(SHAPES[kind]);
  ctx.shadowBlur = 0;
  if (kind === 'prop') {
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.13;
    ctx.strokeStyle = style.outline;
    ctx.stroke(PROPELLER);
    ctx.lineWidth = 0.06;
    ctx.strokeStyle = style.fill;
    ctx.stroke(PROPELLER);
  }
  ctx.restore();
}
