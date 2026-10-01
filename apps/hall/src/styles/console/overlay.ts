/**
 * A tiny overlay manager for the style menu and the quests sheet: one overlay at a time,
 * Escape and outside clicks close it, and focus always returns to the control that opened it.
 */

let active: { close: () => void } | null = null;

export function closeOverlay(): void {
  active?.close();
}

export function openOverlay(
  layer: HTMLElement,
  trigger: HTMLElement,
  element: HTMLElement,
  options: { onKey?: (event: KeyboardEvent) => void; initialFocus?: () => HTMLElement | null } = {},
): () => void {
  closeOverlay();
  layer.append(element);
  trigger.setAttribute('aria-expanded', 'true');

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    options.onKey?.(event);
  };
  const onPointer = (event: PointerEvent) => {
    const target = event.target as Node;
    if (!element.contains(target) && !trigger.contains(target)) close({ restoreFocus: false });
  };

  function close(settings: { restoreFocus?: boolean } = {}) {
    if (!active) return;
    active = null;
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onPointer, true);
    trigger.setAttribute('aria-expanded', 'false');
    element.classList.add('is-closing');
    // Let the exit animation run; reduced motion removes it immediately.
    const remove = () => element.remove();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) remove();
    else setTimeout(remove, 180);
    if (settings.restoreFocus !== false && trigger.isConnected) trigger.focus();
  }

  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onPointer, true);
  active = { close: () => close() };
  requestAnimationFrame(() => {
    element.classList.add('is-open');
    (
      options.initialFocus?.() ?? element.querySelector<HTMLElement>('button, a, [tabindex]')
    )?.focus();
  });
  return () => close();
}
