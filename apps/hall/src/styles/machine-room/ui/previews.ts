import type { CatalogEntry } from '../../../catalog/catalog';
import type { ThemeState } from '../../../core/palette';

/**
 * Attract-mode previews on the process tiles. Only one runs at a time, only while its tile is
 * hovered or focused, and the drawing code is loaded on first use so it never weighs on the
 * Hall's first load. Reduced motion keeps the still emblem instead.
 */

export interface RunningPreview {
  element: HTMLElement;
  destroy(): void;
}

export interface PreviewManager {
  attach(trigger: HTMLElement, host: HTMLElement, entry: CatalogEntry): void;
  stopAll(): void;
}

export function createPreviewManager(getTheme: () => ThemeState): PreviewManager {
  let active: { host: HTMLElement; preview: RunningPreview } | null = null;
  let requestId = 0;

  function stop() {
    requestId++;
    if (!active) return;
    active.preview.destroy();
    active.preview.element.remove();
    active.host.classList.remove('is-previewing');
    active = null;
  }

  async function start(host: HTMLElement, entry: CatalogEntry) {
    const theme = getTheme();
    if (theme.reducedMotion || active?.host === host) return;
    stop();
    const ticket = requestId;
    const { startPreview } = await import('./attract');
    if (ticket !== requestId) return;
    const preview = await startPreview(entry, theme, host);
    if (ticket !== requestId) {
      preview.destroy();
      return;
    }
    host.append(preview.element);
    host.classList.add('is-previewing');
    active = { host, preview };
  }

  return {
    attach(trigger, host, entry) {
      trigger.addEventListener('pointerenter', () => void start(host, entry));
      trigger.addEventListener('focus', () => void start(host, entry));
      trigger.addEventListener('pointerleave', () => {
        if (document.activeElement !== trigger) stop();
      });
      trigger.addEventListener('blur', stop);
    },
    stopAll: stop,
  };
}
