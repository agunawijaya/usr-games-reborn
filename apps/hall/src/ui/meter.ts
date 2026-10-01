import { h } from './h';

/**
 * A progress meter drawn as a row of cells, like a text-mode progress bar, with the exact
 * numbers beside it. The element carries role="progressbar" so the value is announced.
 */
export function cellMeter(options: {
  value: number;
  max: number;
  label: string;
  cells?: number;
  className?: string;
}): HTMLElement {
  const { value, max, label } = options;
  const cells = options.cells ?? Math.min(Math.max(max, 1), 12);
  const fraction = max > 0 ? Math.min(1, value / max) : 0;
  const filled = Math.round(fraction * cells);
  return h(
    'div',
    {
      class: ['meter', options.className],
      role: 'progressbar',
      'aria-label': label,
      'aria-valuemin': '0',
      'aria-valuemax': String(max),
      'aria-valuenow': String(Math.min(value, max)),
      style: { '--meter-fraction': String(fraction) },
    },
    Array.from({ length: cells }, (_, index) =>
      h('span', { class: ['meter__cell', index < filled && 'meter__cell--on'] }),
    ),
  );
}

/** A continuous bar, for XP where cells would be too coarse. */
export function barMeter(options: {
  fraction: number;
  label: string;
  valueText: string;
  className?: string;
}): HTMLElement {
  const fraction = Math.min(1, Math.max(0, options.fraction));
  return h(
    'div',
    {
      class: ['bar', options.className],
      role: 'progressbar',
      'aria-label': options.label,
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': String(Math.round(fraction * 100)),
      'aria-valuetext': options.valueText,
    },
    h('span', { class: 'bar__fill', style: { width: `${(fraction * 100).toFixed(2)}%` } }),
  );
}
