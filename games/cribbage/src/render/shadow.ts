/**
 * A soft elliptical shadow from a radial gradient. Canvas blur filters look the same but cost
 * a great deal every frame, so everything that moves (pegs, the count dial, the props) uses
 * this instead; blur is kept for layers painted once.
 */
export function softShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  alpha: number,
  rgb = '0, 0, 0',
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(radiusX, radiusY);
  const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  shade.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  shade.addColorStop(0.55, `rgba(${rgb}, ${alpha * 0.75})`);
  shade.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
