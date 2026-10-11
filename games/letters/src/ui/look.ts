import type { Palette } from '../render/palette';

/** Hands the look's colours to the stylesheet as custom properties on the game's root. */
export function applyLook(root: HTMLElement, palette: Palette, reducedMotion: boolean) {
  root.dataset.look = palette.look;
  root.dataset.motion = reducedMotion ? 'reduce' : 'full';
  const values: Record<string, string> = {
    '--chl-ink': palette.ink,
    '--chl-ink-soft': palette.inkSoft,
    '--chl-panel': palette.panel,
    '--chl-panel-edge': palette.panelEdge,
    '--chl-accent': palette.accent,
    '--chl-accent-ink': palette.accentInk,
    '--chl-good': palette.good,
    '--chl-warn': palette.warn,
    '--chl-ribbon-from': palette.ribbonFrom,
    '--chl-ribbon-to': palette.ribbonTo,
    '--chl-web-found': palette.webFound,
    '--chl-web-missed': palette.webMissed,
    '--chl-sky': palette.skyBottom,
  };
  palette.cubes.forEach((colour, index) => (values[`--chl-cube-${index}`] = colour));
  for (const [name, value] of Object.entries(values)) root.style.setProperty(name, value);
}
