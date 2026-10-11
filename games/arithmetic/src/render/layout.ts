/**
 * Where everything sits, in CSS pixels, shared by the canvas world and the DOM interface so the
 * problem text lands exactly on the scoreboard or the lab display. Designed at 1920 × 1080 and
 * scaled by `s`; the player's safe zones (the Pause pill top right, toasts bottom left, 400 px
 * wide and 64 px up) are kept free of anything the player needs to read.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** `results` mirrors `menu`: the card on the right, clear of the toasts in the bottom left. */
export type LayoutKind = 'menu' | 'play' | 'results';

export interface Layout {
  readonly kind: LayoutKind;
  readonly width: number;
  readonly height: number;
  /** Design pixels to CSS pixels. */
  readonly s: number;
  /** The scoreboard face (Sprint) or the lab display (Atom) that carries the problem. */
  readonly board: Rect;
  /** Sprint: where the stands meet the track. */
  readonly horizon: number;
  /** Atom: the chamber the molecules float in. */
  readonly chamber: { readonly x: number; readonly y: number; readonly r: number };
  /** Status at the top left: mode, progress, clock. */
  readonly hud: Rect;
  /** The right column below the Pause pill: numbers in training. */
  readonly side: Rect;
  /** The on-screen keys along the bottom. */
  readonly keys: Rect;
}

/** Toasts own the bottom-left corner at every size: this far in, from this high up. */
export const TOAST_WIDTH = 400;
const TOAST_CLEARANCE = 24;

export function layoutFor(width: number, height: number, kind: LayoutKind): Layout {
  const s = Math.min(width / 1920, height / 1080);
  const u = (n: number) => n * s;
  const hud = { x: u(40), y: u(28), w: u(440), h: u(160) };
  const side = { x: width - u(40) - u(330), y: Math.max(u(96), 76), w: u(330), h: u(420) };
  const keysWidth = Math.min(u(860), width - TOAST_WIDTH - TOAST_CLEARANCE - u(60));
  const keysLeft = Math.max(TOAST_WIDTH + TOAST_CLEARANCE, width / 2 - keysWidth / 2);
  const keys = { x: keysLeft, y: height - u(28) - u(76), w: keysWidth, h: u(76) };
  if (kind === 'results') {
    const boardWidth = u(640);
    return {
      kind,
      width,
      height,
      s,
      board: { x: u(80), y: u(120), w: boardWidth, h: u(240) },
      horizon: height * 0.6,
      chamber: { x: u(470), y: height * 0.52, r: u(290) },
      hud,
      side,
      keys,
    };
  }
  if (kind === 'menu') {
    const boardWidth = u(640);
    return {
      kind,
      width,
      height,
      s,
      board: { x: width - u(80) - boardWidth, y: u(120), w: boardWidth, h: u(240) },
      horizon: height * 0.6,
      chamber: { x: width - u(470), y: height * 0.5, r: u(300) },
      hud,
      side,
      keys,
    };
  }
  const boardWidth = u(820);
  return {
    kind,
    width,
    height,
    s,
    board: { x: width / 2 - boardWidth / 2, y: u(92), w: boardWidth, h: u(290) },
    horizon: height * 0.56,
    chamber: { x: width / 2, y: height * 0.625, r: u(235) },
    hud,
    side,
    keys,
  };
}
