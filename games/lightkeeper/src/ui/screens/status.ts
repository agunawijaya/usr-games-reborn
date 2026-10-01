import type { WatchState } from '../../engine/types';
import { power } from '../copy';
import { h } from '../dom';

/**
 * The bar along the top of a watch: the reserve clock first (the number that matters most),
 * then power and shield as meters, then the small counts. The days figure flares up when a
 * gleaner is stopped and the clock stretches.
 */

export interface StatusBar {
  element: HTMLElement;
  update(s: WatchState, stretched: boolean): void;
}

function meter(label: string, testId: string) {
  const fill = h('span', { class: 'lk-meter__fill' });
  const value = h('span', { class: 'lk-meter__value', dataset: { testid: testId } });
  const note = h('span', { class: 'lk-meter__note' });
  const element = h(
    'div',
    { class: 'lk-meter' },
    h('span', { class: 'lk-meter__label' }, label, note),
    h('span', { class: 'lk-meter__track', 'aria-hidden': 'true' }, fill),
    value,
  );
  return { element, fill, value, note };
}

function chip(label: string, testId: string) {
  const value = h('b', { dataset: { testid: testId } });
  const element = h(
    'span',
    { class: 'lk-chip' },
    h('span', { class: 'lk-chip__label' }, label),
    value,
  );
  return { element, value };
}

export function statusBar(): StatusBar {
  const daysValue = h('span', { class: 'lk-clock__days', dataset: { testid: 'lk-days-left' } });
  const daysNote = h('span', { class: 'lk-clock__note' });
  const clock = h(
    'div',
    { class: 'lk-clock', role: 'group', 'aria-label': 'Reserve clock' },
    h('span', { class: 'lk-clock__label' }, 'Reserve'),
    daysValue,
    daysNote,
  );
  const energy = meter('Power', 'lk-power');
  const shield = meter('Shield', 'lk-shield');
  const flares = chip('Flares', 'lk-flares');
  const ore = chip('Ore', 'lk-ore');
  const drive = chip('Drive', 'lk-drive');
  const condition = h('span', { class: 'lk-condition', dataset: { testid: 'lk-condition' } });
  const element = h(
    'header',
    { class: 'lk-status' },
    clock,
    h('div', { class: 'lk-status__meters' }, energy.element, shield.element),
    h('div', { class: 'lk-status__chips' }, flares.element, ore.element, drive.element, condition),
  );
  let lastDays = -1;
  return {
    element,
    update(s, stretched) {
      const left = Math.max(0, s.now.time);
      daysValue.textContent = `${left.toFixed(1)} days`;
      const elapsed = s.now.date - s.params.date;
      daysNote.textContent = `Day ${elapsed.toFixed(1)} · ${s.now.gleaners} ${s.now.gleaners === 1 ? 'gleaner' : 'gleaners'} left`;
      if (stretched && lastDays >= 0 && left > lastDays) {
        clock.classList.remove('is-stretched');
        void clock.offsetWidth;
        clock.classList.add('is-stretched');
      }
      clock.classList.toggle('is-low', left < 2);
      lastDays = left;
      const energyShare = Math.max(0, s.ship.energy / s.params.energy);
      energy.fill.style.width = `${Math.min(100, energyShare * 100)}%`;
      energy.value.textContent = power(s.ship.energy);
      energy.element.classList.toggle('is-low', s.ship.energy < s.params.lowEnergy);
      const shieldShare = Math.max(0, s.ship.shield / s.params.shield);
      shield.fill.style.width = `${Math.min(100, shieldShare * 100)}%`;
      shield.value.textContent = power(s.ship.shield);
      shield.note.textContent = s.ship.shieldUp ? ' · up' : ' · down';
      shield.element.classList.toggle('is-down', !s.ship.shieldUp);
      flares.value.textContent = String(s.ship.flares);
      ore.value.textContent = String(s.params.holdFree - s.ship.holdFree);
      drive.value.textContent = String(s.ship.drive);
      const label =
        s.ship.condition === 'moored'
          ? 'Moored'
          : s.ship.condition === 'red'
            ? 'Red alert'
            : s.ship.condition === 'yellow'
              ? 'Low power'
              : 'All clear';
      condition.textContent = s.ship.shrouded ? `${label} · shrouded` : label;
      condition.dataset.condition = s.ship.condition;
    },
  };
}
