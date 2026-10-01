import type { MountedPoster } from '../../core/art/art';

/**
 * The holo effect. A card under the pointer lifts and leans toward it (at most 12°), its foil
 * slides and a highlight follows the pointer. Everything is driven by five CSS variables on
 * that one card, updated at most once a frame, so the rest of the grid never repaints.
 * Keyboard focus gives the same card a gentle default lean. Only the active card's poster
 * animates. Reduced motion keeps the lift and a static sheen, but no lean and no movement.
 */

export const MAX_TILT_DEGREES = 12;

/** Where the light sits for keyboard focus: up and to the right, as if the card were picked up. */
const FOCUS_POINTER = { x: 0.72, y: 0.28 };

export interface TiltCard {
  card: HTMLElement;
  poster: MountedPoster | null;
}

export interface TiltController {
  attach(target: TiltCard): void;
  destroy(): void;
}

function setVariables(card: HTMLElement, x: number, y: number, active: boolean) {
  const style = card.style;
  style.setProperty('--hc-px', (x * 100).toFixed(1));
  style.setProperty('--hc-py', (y * 100).toFixed(1));
  style.setProperty('--hc-ry', `${((x - 0.5) * 2 * MAX_TILT_DEGREES).toFixed(2)}deg`);
  style.setProperty('--hc-rx', `${((0.5 - y) * 2 * MAX_TILT_DEGREES).toFixed(2)}deg`);
  style.setProperty('--hc-active', active ? '1' : '0');
}

function clearVariables(card: HTMLElement) {
  for (const name of ['--hc-px', '--hc-py', '--hc-rx', '--hc-ry', '--hc-active']) {
    card.style.removeProperty(name);
  }
}

export function createTiltController(options: {
  reducedMotion: boolean;
  frozen: boolean;
}): TiltController {
  let active: TiltCard | null = null;
  let frame = 0;
  let pending: { target: TiltCard; x: number; y: number } | null = null;
  const cleanups: (() => void)[] = [];

  function activate(target: TiltCard) {
    if (active === target) return;
    if (active) deactivate(active);
    active = target;
    target.card.classList.add('is-lifted');
    if (!options.reducedMotion && !options.frozen) target.poster?.setAnimating(true);
  }

  function deactivate(target: TiltCard) {
    target.card.classList.remove('is-lifted', 'is-tracking');
    clearVariables(target.card);
    target.poster?.setAnimating(false);
    if (active === target) active = null;
  }

  function flush() {
    frame = 0;
    if (!pending) return;
    const { target, x, y } = pending;
    pending = null;
    setVariables(target.card, x, y, true);
  }

  function track(target: TiltCard, event: PointerEvent) {
    if (options.reducedMotion) return;
    const rect = target.card.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    target.card.classList.add('is-tracking');
    pending = { target, x, y };
    if (!frame) frame = requestAnimationFrame(flush);
  }

  return {
    attach(target) {
      const { card } = target;
      const onEnter = (event: PointerEvent) => {
        activate(target);
        track(target, event);
      };
      const onMove = (event: PointerEvent) => track(target, event);
      const onLeave = () => {
        if (document.activeElement === card) {
          card.classList.remove('is-tracking');
          setVariables(card, FOCUS_POINTER.x, FOCUS_POINTER.y, true);
        } else {
          deactivate(target);
        }
      };
      const onFocus = () => {
        activate(target);
        if (!options.reducedMotion) setVariables(card, FOCUS_POINTER.x, FOCUS_POINTER.y, true);
      };
      const onBlur = () => {
        if (!card.matches(':hover')) deactivate(target);
      };
      card.addEventListener('pointerenter', onEnter);
      card.addEventListener('pointermove', onMove);
      card.addEventListener('pointerleave', onLeave);
      card.addEventListener('focus', onFocus);
      card.addEventListener('blur', onBlur);
      cleanups.push(() => {
        card.removeEventListener('pointerenter', onEnter);
        card.removeEventListener('pointermove', onMove);
        card.removeEventListener('pointerleave', onLeave);
        card.removeEventListener('focus', onFocus);
        card.removeEventListener('blur', onBlur);
      });
    },
    destroy() {
      cancelAnimationFrame(frame);
      if (active) deactivate(active);
      for (const cleanup of cleanups.splice(0)) cleanup();
    },
  };
}

/**
 * Arrow keys walk the card grid: left and right step through cards, up and down jump to the
 * card nearest in the row above or below, like moving through an album page. `onMove` hears
 * every step that lands on a card (the Hall's quiet key click).
 */
export function gridKeys(
  container: HTMLElement,
  selector: string,
  onMove: () => void = () => {},
): () => void {
  const moveTo = (card: HTMLElement | undefined) => {
    if (!card) return;
    card.focus();
    onMove();
  };
  const onKey = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const cards = [...container.querySelectorAll<HTMLElement>(selector)];
    const current = cards.indexOf(document.activeElement as HTMLElement);
    if (current === -1) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      moveTo(cards[current + (event.key === 'ArrowRight' ? 1 : -1)]);
      return;
    }
    const from = cards[current]!.getBoundingClientRect();
    const down = event.key === 'ArrowDown';
    const candidates = cards
      .map((card) => ({ card, rect: card.getBoundingClientRect() }))
      .filter(({ rect }) =>
        down ? rect.top > from.top + from.height / 2 : rect.bottom < from.top + from.height / 2,
      );
    if (candidates.length === 0) return;
    const rowTop = down
      ? Math.min(...candidates.map(({ rect }) => rect.top))
      : Math.max(...candidates.map(({ rect }) => rect.top));
    const row = candidates.filter(({ rect }) => Math.abs(rect.top - rowTop) < 8);
    const centre = from.left + from.width / 2;
    row.sort(
      (a, b) =>
        Math.abs(a.rect.left + a.rect.width / 2 - centre) -
        Math.abs(b.rect.left + b.rect.width / 2 - centre),
    );
    moveTo(row[0]?.card);
  };
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}
