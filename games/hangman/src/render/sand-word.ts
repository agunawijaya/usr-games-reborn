import type { BeachLayout } from './layout';
import { type BeachPalette, rgba } from './palette';

/**
 * The word written in the wet sand, painted on the canvas for the attract loop and posters
 * (the game itself uses HTML for it): a damp patch, a groove per letter, letters traced in.
 */
export function paintSandWord(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  letters: readonly (string | null)[],
) {
  const { word, slot } = layout;
  const night = palette.look === 'moonlit';
  const cx = word.x + word.width / 2;
  const cy = word.y + word.height / 2;
  ctx.save();
  const damp = ctx.createRadialGradient(cx, cy, 0, cx, cy, word.width / 2 + slot.width);
  damp.addColorStop(0, rgba(palette.sandWet, night ? 0.85 : 0.65));
  damp.addColorStop(1, rgba(palette.sandWet, 0));
  ctx.fillStyle = damp;
  ctx.beginPath();
  ctx.ellipse(cx, cy, word.width / 2 + slot.width, slot.height * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `600 ${Math.round(slot.height * 0.68)}px 'Fredoka Variable', Fredoka, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  letters.forEach((letter, i) => {
    const x = word.x + i * (slot.width + slot.gap) + slot.width / 2;
    const groove = word.y + slot.height * 0.9;
    ctx.strokeStyle = night ? 'rgba(10,10,24,0.7)' : 'rgba(96,64,30,0.55)';
    ctx.lineWidth = Math.max(2, slot.width * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - slot.width * 0.38, groove);
    ctx.quadraticCurveTo(x, groove + slot.width * 0.05, x + slot.width * 0.38, groove);
    ctx.stroke();
    if (!letter) return;
    ctx.fillStyle = night ? '#f3e9d8' : '#4a2f14';
    ctx.fillText(letter.toUpperCase(), x, word.y + slot.height * 0.76);
  });
  ctx.restore();
}
