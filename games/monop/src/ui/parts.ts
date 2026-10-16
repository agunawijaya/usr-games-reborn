import { EMBLEMS } from '../boards/emblems';

/**
 * Small pieces of the interface drawn as SVG: a coin, a token's emblem on a disc in its seat's
 * colour, and a die face. Money in this game is fictional and only ever counted as coins.
 */

export function coinIcon(): string {
  return '<svg class="dd-coin" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#f2b21b" stroke="#a8750f" stroke-width="1.4"/><circle cx="8" cy="8" r="4" fill="none" stroke="#a8750f" stroke-width="1.2"/></svg>';
}

/** Coins as the interface writes them: a coin and the number, grouped in thousands. */
export function coins(amount: number): string {
  const sign = amount < 0 ? '−' : '';
  return `<span class="dd-amount">${coinIcon()}<span>${sign}${Math.abs(amount).toLocaleString('en-GB')}</span></span>`;
}

export function emblemBadge(token: string, colour: string, size = 40): string {
  const path = EMBLEMS[token] ?? '';
  return `<svg class="dd-badge" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="${colour}"/><g transform="translate(6 6) scale(0.75)"><path d="${path}" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
}

const PIPS: Record<number, [number, number][]> = {
  1: [[12, 12]],
  2: [
    [7, 7],
    [17, 17],
  ],
  3: [
    [6.5, 6.5],
    [12, 12],
    [17.5, 17.5],
  ],
  4: [
    [7, 7],
    [17, 7],
    [7, 17],
    [17, 17],
  ],
  5: [
    [6.5, 6.5],
    [17.5, 6.5],
    [12, 12],
    [6.5, 17.5],
    [17.5, 17.5],
  ],
  6: [
    [7, 6],
    [17, 6],
    [7, 12],
    [17, 12],
    [7, 18],
    [17, 18],
  ],
};

export function dieFace(value: number, size = 30): string {
  const pips = PIPS[value]!.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2"/>`).join('');
  return `<svg class="dd-die" viewBox="0 0 24 24" width="${size}" height="${size}" role="img" aria-label="${value}"><rect x="1" y="1" width="22" height="22" rx="5" fill="#fbf8f1" stroke="#1d2230" stroke-width="1.2"/><g fill="#1d2230">${pips}</g></svg>`;
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  html = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (html) node.innerHTML = html;
  return node;
}
