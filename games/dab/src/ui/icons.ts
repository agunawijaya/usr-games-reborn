/**
 * The emblem: nine dots, one box closed, and a pair left open with the scissors' cross between
 * them. The same path data is in the manifest, where the Hall draws it as a 3 px round stroke.
 */
export const EMBLEM_PATH =
  'M10 10h.01M24 10h.01M38 10h.01M10 24h.01M24 24h.01M38 24h.01M10 38h.01M24 38h.01M38 38h.01M10 10h14v14H10zM24 38h14V24M28.5 28.5l5 5M33.5 28.5l-5 5';

export const EMBLEM = `<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${EMBLEM_PATH}"/></svg>`;
