import {
  browserStorage,
  createSaveSlot,
  type PosterHandle,
  type PosterOptions,
} from '@usr-games/kit';
import { AtomWorld } from './atom/atom-world';
import { layoutFor } from './layout';
import type { Look, ThemeId } from './look';
import { SprintWorld } from './sprint/sprint-world';

/**
 * Key art for the Hall. Sprint: the runner breaking the tape, the stadium board lit. Atom (shown
 * when the player has chosen Atom): a molecule fired apart into its prime atoms.
 */

/** The theme the player chose, read straight from the game's saved preferences. */
function savedTheme(): ThemeId {
  try {
    const prefs = createSaveSlot<{ theme: ThemeId | null }>({
      storage: browserStorage(),
      scope: 'arithmetic',
      key: 'prefs',
      version: 1,
      defaults: () => ({ theme: null }),
    }).load();
    return prefs.theme === 'atom' ? 'atom' : 'sprint';
  } catch {
    return 'sprint';
  }
}

function boardText(
  ctx: CanvasRenderingContext2D,
  look: Look,
  rect: { x: number; y: number; w: number; h: number },
  s: number,
) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (look.theme === 'sprint') {
    ctx.fillStyle = '#f4efe2';
    ctx.font = `700 ${Math.round(22 * s)}px "Bricolage Grotesque Variable", system-ui, sans-serif`;
    ctx.fillText('FAST SUMS · PRIME SPLITS', rect.x + rect.w / 2, rect.y + rect.h * 0.24);
    ctx.fillStyle = look.dark ? '#ffcf4a' : '#ffd25a';
    ctx.shadowColor = look.dark ? 'rgba(255, 190, 80, 0.6)' : 'transparent';
    ctx.shadowBlur = 18 * s;
    ctx.font = `italic 800 ${Math.round(112 * s)}px "Bricolage Grotesque Variable", system-ui, sans-serif`;
    ctx.fillText('Number Sprint', rect.x + rect.w / 2, rect.y + rect.h * 0.6, rect.w * 0.92);
  } else {
    ctx.fillStyle = look.dark ? '#f2f0ff' : '#10302a';
    ctx.font = `600 ${Math.round(96 * s)}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.fillText('360 = 2³ × 3² × 5', rect.x + rect.w / 2, rect.y + rect.h * 0.52, rect.w * 0.9);
  }
  ctx.restore();
}

export function drawPoster(canvas: HTMLCanvasElement, options: PosterOptions): PosterHandle {
  const look: Look = { theme: savedTheme(), dark: options.appearance === 'dark' };
  const scale = canvas.width / Math.max(1, options.width);
  const layout = layoutFor(options.width, options.height, 'play');
  const ctx = canvas.getContext('2d')!;
  const world =
    look.theme === 'atom' ? new AtomWorld(look, false, scale) : new SprintWorld(look, false, scale);
  world.resize(layout);
  const start = 6;
  if (world instanceof SprintWorld) {
    world.show(
      { kind: 'sums', op: 'x', left: 7, right: 8, solved: 20, total: 20, streak: 9, ghost: null },
      0,
    );
    world.stage({ distance: 60, phase: 2.1, speed: 8, tapeAhead: 0.1, tapeBroken: true }, start);
    world.confetti(start - 0.6);
  } else {
    const before = {
      kind: 'split' as const,
      start: 360,
      remaining: 5,
      found: [2, 2, 2, 3, 3],
      total: 6,
      done: false,
    };
    world.show(before, 0);
    world.cue({ kind: 'split', prime: 5, last: true }, start - 0.32);
    world.show({ ...before, remaining: 1, found: [2, 2, 2, 3, 3, 5], done: true }, start - 0.32);
  }
  const paint = (time: number) => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    world.draw(ctx, time);
    boardText(ctx, look, layout.board, layout.s);
  };
  paint(start);
  if (!options.animate) {
    world.destroy();
    return { stop: () => undefined };
  }
  let frame = 0;
  const began = performance.now() / 1000;
  const tick = () => {
    paint(start + performance.now() / 1000 - began);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return {
    stop: () => {
      cancelAnimationFrame(frame);
      world.destroy();
    },
  };
}
