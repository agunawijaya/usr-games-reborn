import { type Direction, directionAngle, type Pose } from '../../codecs/semaphore';
import { paintOutside } from '../outside';
import type { DeskPalette } from '../palette';
import { alpha, type Ctx, FONT_BODY, FONT_MONO, mix } from '../paint';
import type { Span } from '../room';
import { paintSignaller, reach, shoulderPosition, type SignallerPose } from '../signaller';

/**
 * The rooftop, close: the signaller stands large in the middle of the screen with a ring of
 * eight chips around each shoulder, one per position, labelled with its key. Chips for the
 * flag on the reader's left are amber, for the right blue; the chosen ones light up.
 */
export const SEMAPHORE_LAYOUT = {
  signaller: { x: 760, y: 960, height: 520 },
};

/** Keys for each direction, by flag: the left hand's cluster and the number pad. */
export const NEAR_KEYS: Record<Direction, string> = {
  0: 'X',
  1: 'Z',
  2: 'A',
  3: 'Q',
  4: 'W',
  5: 'E',
  6: 'D',
  7: 'C',
};
export const FAR_KEYS: Record<Direction, string> = {
  0: '2',
  1: '1',
  2: '4',
  3: '7',
  4: '8',
  5: '9',
  6: '6',
  7: '3',
};

export interface SemaphoreScene {
  time: number;
  scene: 'rooftop' | 'ship';
  /** The arms as drawn now (they ease towards the chosen pose). */
  arms: SignallerPose;
  /** The positions the player has chosen so far. */
  chosen: { near: Direction | null; far: Direction | null };
  /** The pose being asked for, drawn as a ghost when help is on. */
  ghost: Pose | null;
  /** Show the position chips (sending) or not (reading). */
  chips: boolean;
}

export interface Chip {
  side: 'near' | 'far';
  direction: Direction;
  x: number;
  y: number;
  r: number;
}

/** Where every chip sits, for drawing and for picking them with the mouse. */
export function chipPositions(): Chip[] {
  const { x, y, height } = SEMAPHORE_LAYOUT.signaller;
  // Just past the flag's tip, so a raised flag points at its chip without covering it.
  const radius = reach(height) * 1.06;
  const chips: Chip[] = [];
  for (const side of ['near', 'far'] as const) {
    const shoulder = shoulderPosition(x, y, height, side === 'near' ? 'left' : 'right');
    for (let d = 0; d < 8; d++) {
      const angle = directionAngle(d);
      chips.push({
        side,
        direction: d as Direction,
        x: shoulder.x + Math.cos(angle) * radius,
        y: shoulder.y + Math.sin(angle) * radius,
        r: 25,
      });
    }
  }
  return chips;
}

export function paintSemaphoreStation(
  ctx: Ctx,
  span: Span,
  pal: DeskPalette,
  scene: SemaphoreScene,
) {
  const top = Math.min(0, span.top ?? 0);
  const { x, y, height } = SEMAPHORE_LAYOUT.signaller;
  const width = span.right - span.left;
  paintOutside(
    ctx,
    {
      x: span.left,
      y: top,
      width,
      height: 1080 - top,
      roofLine: 0.7,
      signaller: { x: (x - span.left) / width, y: (y - top) / (1080 - top), height },
      pose: scene.arms,
      scene: scene.scene,
      time: scene.time,
      detail: 'near',
    },
    pal,
  );
  paintSemaphoreOverlay(ctx, pal, {
    chips: scene.chips,
    chosen: scene.chosen,
    ghost: scene.ghost,
    beforeFigure: true,
  });
  // Repaint the signaller over the spokes so the arms stay on top; the chips go over both, as
  // the "down" chips sit by the boots.
  paintSignaller(ctx, x, y, height, scene.arms, pal, {
    flags: scene.scene === 'ship' ? 'sea' : 'land',
    time: scene.time,
    detail: 'near',
    wind: 0.7,
  });
  paintSemaphoreOverlay(ctx, pal, {
    chips: scene.chips,
    chosen: scene.chosen,
    ghost: null,
    beforeFigure: false,
  });
}

/**
 * The sending aids around the figure. Before the figure: the ghost of the target pose and the
 * spokes from each shoulder. After it: the chips, which must stay readable over the boots.
 */
export function paintSemaphoreOverlay(
  ctx: Ctx,
  pal: DeskPalette,
  overlay: {
    chips: boolean;
    chosen: SemaphoreScene['chosen'];
    ghost: Pose | null;
    beforeFigure: boolean;
  },
) {
  if (overlay.beforeFigure) {
    if (overlay.ghost) paintGhost(ctx, pal, overlay.ghost);
    if (overlay.chips) paintSpokes(ctx, pal);
  } else if (overlay.chips) {
    paintChips(ctx, pal, overlay.chosen);
  }
}

const chipColors = (pal: DeskPalette) => ({
  near: pal.look === 'night' ? '#ffb347' : '#e08a1e',
  far: pal.look === 'night' ? '#7fb2ff' : '#2f6fd6',
});

/** Faint spokes from each shoulder to its own chips, so each ring reads as one flag's. */
function paintSpokes(ctx: Ctx, pal: DeskPalette) {
  const { near, far } = chipColors(pal);
  const { x, y, height } = SEMAPHORE_LAYOUT.signaller;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 7]);
  for (const chip of chipPositions()) {
    const shoulder = shoulderPosition(x, y, height, chip.side === 'near' ? 'left' : 'right');
    const dx = chip.x - shoulder.x;
    const dy = chip.y - shoulder.y;
    const length = Math.hypot(dx, dy);
    ctx.strokeStyle = alpha(chip.side === 'near' ? near : far, 0.55);
    ctx.beginPath();
    ctx.moveTo(shoulder.x + (dx / length) * 40, shoulder.y + (dy / length) * 40);
    ctx.lineTo(chip.x - (dx / length) * chip.r, chip.y - (dy / length) * chip.r);
    ctx.stroke();
  }
  ctx.restore();
}

function paintGhost(ctx: Ctx, pal: DeskPalette, ghost: Pose) {
  const { x, y, height } = SEMAPHORE_LAYOUT.signaller;
  ctx.save();
  ctx.setLineDash([10, 9]);
  ctx.lineCap = 'round';
  for (const [side, direction] of [
    ['left', ghost.near],
    ['right', ghost.far],
  ] as const) {
    const shoulder = shoulderPosition(x, y, height, side);
    const angle = directionAngle(direction);
    const length = reach(height) * 0.92;
    ctx.strokeStyle = alpha(pal.look === 'night' ? '#fff3cf' : '#ffffff', 0.85);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(shoulder.x + Math.cos(angle) * length, shoulder.y + Math.sin(angle) * length);
    ctx.stroke();
  }
  ctx.restore();
}

function paintChips(ctx: Ctx, pal: DeskPalette, chosenPositions: SemaphoreScene['chosen']) {
  const { near, far } = chipColors(pal);
  ctx.save();
  for (const chip of chipPositions()) {
    const color = chip.side === 'near' ? near : far;
    const chosen = chosenPositions[chip.side] === chip.direction;
    const label = (chip.side === 'near' ? NEAR_KEYS : FAR_KEYS)[chip.direction];
    // Face.
    ctx.fillStyle = chosen ? color : alpha(pal.look === 'night' ? '#10141f' : '#fdf8ee', 0.92);
    ctx.strokeStyle = color;
    ctx.lineWidth = chosen ? 4 : 3;
    ctx.beginPath();
    ctx.arc(chip.x, chip.y, chip.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (chosen) {
      ctx.strokeStyle = alpha(color, 0.45);
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(chip.x, chip.y, chip.r + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = chosen ? '#ffffff' : pal.look === 'night' ? color : mix(color, '#000000', 0.25);
    ctx.font = `700 22px ${chip.side === 'near' ? FONT_BODY : FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, chip.x, chip.y + 1);
  }
  ctx.restore();
}
