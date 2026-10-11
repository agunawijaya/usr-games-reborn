import { paintCipherWheel } from '../machines/cipher-wheel';
import { paintScope, type ScopeState } from '../machines/scope';
import { type Flap, paintFlapRow } from '../flaps';
import type { DeskPalette } from '../palette';
import {
  alpha,
  type Ctx,
  FONT_MONO,
  glow,
  linear,
  mix,
  roundRect,
  screw,
  spacedText,
} from '../paint';
import { paintCloseDesk, paintStationLight, type Span } from '../room';

/**
 * The cipher wheel close up: the wheel on the left, the frequency scope at the top right and
 * the split-flap reading board under it. Rectangles are exported so the interface can sit on
 * the same grid.
 */
export const CIPHER_LAYOUT = {
  wheel: { x: 590, y: 660, r: 340 },
  scope: { x: 1010, y: 96, width: 840, height: 360 },
  board: { x: 1010, y: 476, width: 840, height: 300 },
};

export interface CipherScene {
  time: number;
  rotation: number;
  spin: number;
  lock: number;
  /** The message as it arrived. */
  cipherText: string;
  /** One flap per character of the message, in reading lines. */
  lines: readonly (readonly Flap[])[];
  scope: ScopeState;
  /** Outer letter being read on the wheel. */
  highlight: number | null;
  /** For keyword messages: which ring is being turned. */
  ringLabel?: string | null;
  /** The scope is switched off: its screen stays dark. */
  scopeOff?: boolean;
  /** The caller has already laid the desk (from a cache). */
  deskLaid?: boolean;
}

export function paintCipherStation(ctx: Ctx, span: Span, pal: DeskPalette, scene: CipherScene) {
  if (!scene.deskLaid) paintCloseDesk(ctx, span, pal, scene.time);
  const { wheel, scope } = CIPHER_LAYOUT;
  paintCipherWheel(ctx, wheel.x, wheel.y, wheel.r, pal, {
    rotation: scene.rotation,
    highlight: scene.highlight,
    spin: scene.spin,
    lock: scene.lock,
    stand: false,
  });
  paintScope(ctx, scope.x, scope.y, scope.width, scope.height, pal, scene.scope);
  if (scene.scopeOff) paintScopeOff(ctx, pal);
  paintStationLight(ctx, span, pal, { x: 420, y: 160, r: 1700 });
  // The board's flaps are painted white on black so they read even in the lamp's shadow.
  paintBoard(ctx, pal, scene);
  if (pal.look === 'night') {
    // The scope's phosphor spills onto the desk and the case.
    glow(
      ctx,
      scope.x + scope.width / 2,
      scope.y + scope.height * 0.45,
      scope.width * 0.75,
      alpha(pal.phosphor, 0.1),
      1,
    );
  }
}

/** A dark screen with a note: the scope is help, switched on with S. */
function paintScopeOff(ctx: Ctx, pal: DeskPalette) {
  const { x, y, width, height } = CIPHER_LAYOUT.scope;
  const pad = Math.min(width, height) * 0.07;
  ctx.save();
  ctx.fillStyle = pal.scopeGlass;
  roundRect(ctx, x + pad, y + pad, width - pad * 2, height - pad * 2 - height * 0.16, pad * 0.6);
  ctx.fill();
  ctx.fillStyle = alpha(pal.phosphor, 0.55);
  ctx.font = `600 22px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCOPE OFF  ·  S SWITCHES IT ON', x + width / 2, y + (height - height * 0.16) / 2);
  ctx.restore();
}

function paintBoard(ctx: Ctx, pal: DeskPalette, scene: CipherScene) {
  const { x, y, width, height } = CIPHER_LAYOUT.board;
  ctx.save();
  // A black-enamelled frame with brass corners, like a station board.
  ctx.fillStyle = alpha('#000000', 0.4);
  roundRect(ctx, x + 8, y + 12, width, height, 14);
  ctx.fill();
  ctx.fillStyle = linear(ctx, 0, y, 0, y + height, [
    [0, mix(pal.enamelLight, '#000000', 0.2)],
    [1, pal.enamel],
  ]);
  roundRect(ctx, x, y, width, height, 14);
  ctx.fill();
  ctx.strokeStyle = alpha(pal.brassLight, 0.7);
  ctx.lineWidth = 2;
  roundRect(ctx, x + 6, y + 6, width - 12, height - 12, 10);
  ctx.stroke();
  for (const [sx, sy] of [
    [x + 18, y + 18],
    [x + width - 18, y + 18],
    [x + 18, y + height - 18],
    [x + width - 18, y + height - 18],
  ] as const) {
    screw(ctx, sx, sy, 5, pal.brassShine, pal.brassDeep);
  }
  // The intercept as it arrived, small, above the board.
  ctx.fillStyle = alpha(pal.brassLight, 0.9);
  ctx.font = `600 15px ${FONT_MONO}`;
  ctx.textBaseline = 'middle';
  spacedText(ctx, 'INTERCEPT', x + 40, y + 36, 3, 'left');
  ctx.fillStyle = alpha('#d8cbb3', 0.85);
  ctx.font = `500 ${scene.cipherText.length > 30 ? 18 : 22}px ${FONT_MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText(scene.cipherText, x + 170, y + 37);
  ctx.fillStyle = alpha(pal.brassLight, 0.9);
  ctx.font = `600 15px ${FONT_MONO}`;
  spacedText(ctx, 'READING', x + 40, y + 74, 3, 'left');
  if (scene.ringLabel) {
    ctx.fillStyle = alpha(pal.brassLight, 0.9);
    ctx.textAlign = 'right';
    ctx.fillText(scene.ringLabel, x + width - 40, y + 74);
    ctx.textAlign = 'left';
  }
  // Tiles, as large as the lines allow.
  const longest = Math.max(...scene.lines.map((line) => line.length));
  const gap = 7;
  const rowGap = 12;
  const top = y + 96;
  const room = height - (top - y) - 20;
  const byHeight = (room - rowGap * (scene.lines.length - 1)) / scene.lines.length / 1.42;
  const tileW = Math.min(50, (width - 80 - gap * (longest - 1)) / longest, byHeight);
  const tileH = tileW * 1.42;
  scene.lines.forEach((line, row) => {
    paintFlapRow(ctx, x + 40, top + row * (tileH + rowGap), tileW, tileH, gap, line, pal);
  });
  ctx.restore();
}
