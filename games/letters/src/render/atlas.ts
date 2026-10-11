import { QU } from '../engine/grid';

/**
 * Every cube letter, drawn once at start-up into a texture the cube shader samples: the crisp
 * glyph in the red channel and a soft halo of it in the green channel, which the glass cubes use
 * as light leaking from inside. Drawn with the collection's self-hosted Fredoka; nothing is a
 * stored image.
 */

export const ATLAS_COLUMNS = 8;
export const ATLAS_ROWS = 4;
export const ATLAS_CELL = 256;
export const QU_GLYPH = 26;

const LETTER_FONT =
  "'Fredoka Variable', 'Fredoka', 'Bricolage Grotesque Variable', system-ui, sans-serif";

export function glyphIndex(face: string): number {
  return face === QU ? QU_GLYPH : face.charCodeAt(0) - 97;
}

function glyphText(glyph: number): string {
  return glyph === QU_GLYPH ? 'Qu' : String.fromCharCode(65 + glyph);
}

export function letterFontReady(): boolean {
  if (typeof document === 'undefined' || !document.fonts) return true;
  try {
    return document.fonts.check(`600 160px ${LETTER_FONT}`, 'A');
  } catch {
    return true;
  }
}

/** Waits for the letter face (if the page declares it) so the atlas never bakes a fallback. */
export async function loadLetterFont(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.race([
      document.fonts.load(`600 160px ${LETTER_FONT}`, 'ABCQu'),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch {
    // A missing face only means the system's sans-serif draws the letters.
  }
}

export function drawLetterAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLUMNS * ATLAS_CELL;
  canvas.height = ATLAS_ROWS * ATLAS_CELL;
  const crisp = glyphLayer(canvas.width, canvas.height, 0);
  const halo = glyphLayer(canvas.width, canvas.height, 18);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(tint(crisp, '#ff0000'), 0, 0);
  ctx.drawImage(tint(halo, '#00ff00'), 0, 0);
  return canvas;
}

function glyphLayer(width: number, height: number, blur: number): HTMLCanvasElement {
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const ctx = layer.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  if (blur > 0) ctx.filter = `blur(${blur}px)`;
  for (let glyph = 0; glyph <= QU_GLYPH; glyph++) {
    const x = (glyph % ATLAS_COLUMNS) * ATLAS_CELL + ATLAS_CELL / 2;
    const y = Math.floor(glyph / ATLAS_COLUMNS) * ATLAS_CELL;
    const text = glyphText(glyph);
    const size = glyph === QU_GLYPH ? 150 : 176;
    ctx.font = `600 ${size}px ${LETTER_FONT}`;
    // Centre on the capital's own height, so every letter sits in the middle of its face.
    const metrics = ctx.measureText('H');
    const capHeight = metrics.actualBoundingBoxAscent;
    ctx.fillText(text, x, y + ATLAS_CELL / 2 + capHeight / 2);
  }
  return layer;
}

function tint(layer: HTMLCanvasElement, colour: string): HTMLCanvasElement {
  const tinted = document.createElement('canvas');
  tinted.width = layer.width;
  tinted.height = layer.height;
  const ctx = tinted.getContext('2d')!;
  ctx.drawImage(layer, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, tinted.width, tinted.height);
  return tinted;
}
