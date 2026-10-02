/**
 * The game's small line icons, drawn on a 24-square grid with the current text colour, so they
 * follow the look and the high-contrast palettes without extra work.
 */
const wrap = (body: string, label?: string) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${
    label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'
  }>${body}</svg>`;

export const ICONS = {
  menu: wrap('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  satchel: wrap(
    '<path d="M6 9h12l-1 10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/><path d="M6 12h12"/><circle cx="12" cy="15" r="1.2"/>',
  ),
  gem: wrap('<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M9 4l3 5 3-5M12 9v11"/>'),
  peek: wrap(
    '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
  ),
  warp: wrap('<path d="M12 12a2 2 0 1 0 2-2 4 4 0 1 0-4 4 6 6 0 1 0 6-6 8 8 0 1 0-8 8"/>'),
  strike: wrap('<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14l6 6M20 14l-6 6"/>'),
  snake: wrap(
    '<path d="M4 18c3 0 3-4 6-4s3 4 6 4 2-4 2-6"/><path d="M15 7a3 3 0 1 1 5 2l-2 3"/><path d="M17 5.5l-.6-2M19.5 6l1-1.6"/><circle cx="18" cy="8" r=".6" fill="currentColor"/>',
  ),
  vault: wrap(
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 4v5.5M12 14.5V20M4 12h5.5M14.5 12H20"/>',
  ),
  door: wrap('<path d="M6 21V9a6 6 0 0 1 12 0v12"/><path d="M4 21h16M14 14h.01"/>'),
  clover: wrap(
    '<path d="M12 12c-4-1-6-6-2-7 1.8-.4 2 1.6 2 1.6s.2-2 2-1.6c4 1-2 6-2 7z"/><path d="M12 12c1-4 6-6 7-2 .4 1.8-1.6 2-1.6 2s2 .2 1.6 2c-1 4-6-2-7-2z"/><path d="M12 12c4 1 6 6 2 7-1.8.4-2-1.6-2-1.6"/><path d="M12 12l-5 9"/>',
  ),
} as const;

/** The game's emblem: a coiled snake round a gem, the manifest's path drawn large. */
export const EMBLEM = `<svg class="fp-emblem" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M26 9.2A15 15 0 1 0 36 19.5Q35 12 41 9Q44 8 44.5 11Q44 17 36 19.5M40.5 12.5h.01M44.6 11.2l2.6-1.2M44.6 11.2l2.2 2M18 23l3.5-4.5h5L30 23l-6 8zM18 23h12"/></svg>`;
