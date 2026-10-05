import { distance, type Point } from './motion';

/**
 * Drag and drop for cards. `DragTracker` follows a pointer and measures its velocity;
 * `snapTarget` picks the drop target a card is drawn to; `attachCardPointer` turns pointer
 * events on an element into taps, double taps and drags, so a game only says what a point
 * picks up and where things may land.
 */

/** Follows a dragged point, smoothing its velocity over the last few events. */
export class DragTracker {
  readonly grab: Point;
  position: Point;
  velocity: Point = { x: 0, y: 0 };
  private lastTime: number;

  /** `grab` is the offset from the card's corner to where it was picked up. */
  constructor(start: Point, grab: Point, time: number) {
    this.position = { ...start };
    this.grab = grab;
    this.lastTime = time;
  }

  move(point: Point, time: number): void {
    const dt = Math.max(1, time - this.lastTime) / 1000;
    const vx = (point.x - this.position.x) / dt;
    const vy = (point.y - this.position.y) / dt;
    // An exponential average: quick to follow, calm enough to draw a steady tilt from.
    const keep = Math.exp(-dt / 0.06);
    this.velocity = {
      x: this.velocity.x * keep + vx * (1 - keep),
      y: this.velocity.y * keep + vy * (1 - keep),
    };
    this.position = { ...point };
    this.lastTime = time;
  }

  /** Lets the velocity die away while the pointer rests. */
  rest(time: number): void {
    const dt = Math.max(0, time - this.lastTime) / 1000;
    const keep = Math.exp(-dt / 0.08);
    this.velocity = { x: this.velocity.x * keep, y: this.velocity.y * keep };
  }

  /** Where the card's corner is, given where it was picked up. */
  corner(): Point {
    return { x: this.position.x - this.grab.x, y: this.position.y - this.grab.y };
  }
}

export interface DropTarget<T> {
  id: T;
  /** The point a card's centre settles on when dropped here. */
  anchor: Point;
  /** Whether the dragged cards may land here. */
  accepts: boolean;
}

/**
 * The target a dragged card is drawn to: the nearest accepting anchor within `reach` of the
 * card's centre. Magnetic snapping in a drag reads as the card "wanting" to go there.
 */
export function snapTarget<T>(
  centre: Point,
  targets: readonly DropTarget<T>[],
  reach: number,
): DropTarget<T> | null {
  let best: DropTarget<T> | null = null;
  let bestDistance = reach;
  for (const target of targets) {
    if (!target.accepts) continue;
    const d = distance(centre, target.anchor);
    if (d < bestDistance) {
      best = target;
      bestDistance = d;
    }
  }
  return best;
}

/** How strongly a card is pulled towards its snap target: 0 at the edge of reach, 1 on it. */
export function snapPull(centre: Point, anchor: Point, reach: number): number {
  const d = distance(centre, anchor);
  return d >= reach ? 0 : (1 - d / reach) ** 2;
}

export interface CardPointerHandlers<T> {
  /** What a press at this point picks up, or null for nothing. */
  pick(point: Point): T | null;
  tap?(item: T, point: Point): void;
  doubleTap?(item: T, point: Point): void;
  dragStart?(item: T, tracker: DragTracker): void;
  dragMove?(item: T, tracker: DragTracker): void;
  dragEnd?(item: T, tracker: DragTracker): void;
  /** The point a press picked up from, to keep the grab offset: usually the card's corner. */
  origin?(item: T): Point;
}

/** Pixels a press must travel before it counts as a drag rather than a tap. */
export const DRAG_THRESHOLD = 6;
const DOUBLE_TAP_MS = 320;

/**
 * Wires pointer events on `element` to card handlers; returns a function that unwires them.
 * Points are in the element's own CSS pixels.
 */
export function attachCardPointer<T>(
  element: HTMLElement,
  handlers: CardPointerHandlers<T>,
): () => void {
  let pressed: { item: T; start: Point; id: number; tracker: DragTracker | null } | null = null;
  let lastTap: { item: T; time: number } | null = null;

  const local = (event: PointerEvent): Point => {
    const box = element.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const down = (event: PointerEvent) => {
    if (event.button !== 0 || pressed) return;
    const point = local(event);
    const item = handlers.pick(point);
    if (item === null) return;
    pressed = { item, start: point, id: event.pointerId, tracker: null };
    element.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const move = (event: PointerEvent) => {
    if (!pressed || event.pointerId !== pressed.id) return;
    const point = local(event);
    if (!pressed.tracker) {
      if (distance(point, pressed.start) < DRAG_THRESHOLD) return;
      const origin = handlers.origin?.(pressed.item) ?? pressed.start;
      const grab = { x: pressed.start.x - origin.x, y: pressed.start.y - origin.y };
      pressed.tracker = new DragTracker(pressed.start, grab, event.timeStamp);
      handlers.dragStart?.(pressed.item, pressed.tracker);
    }
    pressed.tracker.move(point, event.timeStamp);
    handlers.dragMove?.(pressed.item, pressed.tracker);
  };

  const up = (event: PointerEvent) => {
    if (!pressed || event.pointerId !== pressed.id) return;
    const { item, tracker } = pressed;
    pressed = null;
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    if (tracker) {
      handlers.dragEnd?.(item, tracker);
      return;
    }
    const point = local(event);
    if (lastTap && lastTap.item === item && event.timeStamp - lastTap.time < DOUBLE_TAP_MS) {
      lastTap = null;
      handlers.doubleTap?.(item, point);
      return;
    }
    lastTap = { item, time: event.timeStamp };
    handlers.tap?.(item, point);
  };

  const cancel = (event: PointerEvent) => {
    if (!pressed || event.pointerId !== pressed.id) return;
    const { item, tracker } = pressed;
    pressed = null;
    if (tracker) handlers.dragEnd?.(item, tracker);
  };

  element.addEventListener('pointerdown', down);
  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', cancel);
  return () => {
    element.removeEventListener('pointerdown', down);
    element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', up);
    element.removeEventListener('pointercancel', cancel);
  };
}
