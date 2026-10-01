/** Number and time formatting shared by every screen, in one place so copy stays consistent. */

const integer = new Intl.NumberFormat('en-GB');

export function formatNumber(value: number): string {
  return integer.format(Math.round(value));
}

export function formatMinutes([shortest, longest]: readonly [number, number]): string {
  return shortest === longest ? `${shortest} min` : `${shortest}–${longest} min`;
}

export function formatClock(date: Date): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

export function formatPlayTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;
}

const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

export function formatLongDate(key: string): string {
  return LONG_DATE.format(new Date(`${key}T12:00:00`));
}

export function formatShortDate(key: string): string {
  return SHORT_DATE.format(new Date(`${key}T12:00:00`));
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}
