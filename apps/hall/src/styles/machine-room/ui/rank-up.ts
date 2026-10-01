import {
  celebrateRankUp,
  RANK_UP_MS,
  rankUpChord,
  type RankUpMoment,
  rankUpMoment,
} from '../../../core/rank-up';
import type { HallStore } from '../../../store/hall-store';
import { h } from '../../../ui/h';

/**
 * The machine room's rank-up moment. The prompt rewrites itself (the old rank is backspaced and
 * the new one typed in its place), the room's lights flare in the palette's colour, a card
 * announces the new group, and the cosmetics it brings fly into the home-directory chip. It
 * lasts two seconds, any key or click skips it, and with reduced motion it is a plain
 * cross-fade. Screenshot scenes hold it at its peak and leave it uncelebrated.
 */

export interface RankUpStage {
  /** Plays the moment if one is waiting and none is playing. */
  check(): void;
  destroy(): void;
}

interface StageParts {
  store: HallStore;
  /** The style's root; the moment's layer is added beside the room. */
  root: HTMLElement;
  room: HTMLElement;
  header: HTMLElement;
  main: HTMLElement;
  frozen: boolean;
}

const ERASE_STARTS_MS = 180;
const ERASE_STEP_MS = 55;
const TYPE_STEP_MS = 75;
const FLIGHT_STARTS_MS = 1_050;
const FLIGHT_MS = 620;
const FLIGHT_STAGGER_MS = 70;
const LEAVE_MS = 220;
const MAX_ITEMS = 6;

function card(moment: RankUpMoment, username: string, onSkip: () => void): HTMLElement {
  const shown = moment.unlocked.slice(0, MAX_ITEMS);
  const more = moment.unlocked.length - shown.length;
  return h(
    'div',
    { class: 'rank-up__card' },
    h('p', { class: 'rank-up__cmd' }, `$ usermod -aG ${moment.to} ${username}`),
    h(
      'h2',
      { id: 'rank-up-title', class: 'rank-up__title' },
      h('span', { class: 'rank-up__kicker' }, 'You are now'),
      h('span', { class: 'rank-up__rank' }, moment.to),
    ),
    h('p', { class: 'rank-up__flavour' }, moment.flavour),
    shown.length > 0
      ? h(
          'div',
          { class: 'rank-up__unlocks' },
          h('p', { class: 'rank-up__label' }, 'new in ~/.config'),
          h(
            'ul',
            { class: 'rank-up__items' },
            shown.map((cosmetic) =>
              h(
                'li',
                { class: 'rank-up__item' },
                h('span', { class: 'rank-up__kind' }, cosmetic.kind),
                h('span', { class: 'rank-up__name' }, cosmetic.name),
              ),
            ),
            more > 0 ? h('li', { class: 'rank-up__item rank-up__item--more' }, `+${more}`) : null,
          ),
        )
      : null,
    h(
      'button',
      { type: 'button', class: 'rank-up__skip', onclick: onSkip },
      'Skip',
      h('kbd', null, 'Esc'),
    ),
  );
}

/** Backspaces the old rank in the prompt and types the new one, one character at a time. */
function rewritePrompt(header: HTMLElement, from: string, to: string, timers: number[]) {
  const user = () => header.querySelector<HTMLElement>('.prompt__user');
  const set = (text: string) => {
    const element = user();
    if (element) element.textContent = text;
  };
  set(from);
  user()?.classList.add('is-rewriting');
  for (let cut = 1; cut <= from.length; cut++) {
    timers.push(
      window.setTimeout(
        () => set(from.slice(0, from.length - cut)),
        ERASE_STARTS_MS + cut * ERASE_STEP_MS,
      ),
    );
  }
  const typeStarts = ERASE_STARTS_MS + from.length * ERASE_STEP_MS + 90;
  for (let length = 1; length <= to.length; length++) {
    timers.push(
      window.setTimeout(() => set(to.slice(0, length)), typeStarts + length * TYPE_STEP_MS),
    );
  }
}

/** Sends each unlocked item from the card into the header's home-directory chip. */
function flyHome(layer: HTMLElement, header: HTMLElement): Animation[] {
  const target = header.querySelector<HTMLElement>('.rank-chip');
  if (!target) return [];
  const goal = target.getBoundingClientRect();
  const items = [...layer.querySelectorAll<HTMLElement>('.rank-up__item')];
  const flights = items.map((item, index) => {
    const start = item.getBoundingClientRect();
    const dx = goal.left + goal.width * 0.3 - (start.left + start.width / 2);
    const dy = goal.top + goal.height / 2 - (start.top + start.height / 2);
    return item.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        {
          transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 40}px) scale(0.8)`,
          opacity: 1,
          offset: 0.55,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0 },
      ],
      {
        duration: FLIGHT_MS,
        delay: index * FLIGHT_STAGGER_MS,
        easing: 'cubic-bezier(0.5, 0, 0.3, 1)',
        fill: 'forwards',
      },
    );
  });
  target.classList.add('is-receiving');
  return flights;
}

export function createRankUpStage(parts: StageParts): RankUpStage {
  const { store, root, room, header, main, frozen } = parts;
  const html = document.documentElement;
  const announcer = h('p', { class: 'visually-hidden', role: 'status' });
  root.append(announcer);
  /** Ends the moment on screen; celebrating marks it seen so it never replays. */
  let finishCurrent: ((celebrate: boolean) => void) | null = null;

  function play(moment: RankUpMoment) {
    const snapshot = store.snapshot();
    const still = snapshot.reducedMotion;
    const returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timers: number[] = [];
    let flights: Animation[] = [];

    const finish = (celebrate: boolean) => {
      if (finishCurrent !== finish) return;
      finishCurrent = null;
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('keydown', onKey, true);
      flights.forEach((flight) => flight.cancel());
      layer.classList.add('is-leaving');
      window.setTimeout(() => layer.remove(), still ? 0 : LEAVE_MS);
      delete html.dataset.moment;
      header.querySelector('.rank-chip')?.classList.remove('is-receiving');
      room.inert = false;
      if (!celebrate) return;
      (returnFocus?.isConnected ? returnFocus : main).focus({ preventScroll: true });
      // Celebrating re-renders the room with the new rank everywhere.
      celebrateRankUp(store);
    };
    const skip = () => finish(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      skip();
    };

    const layer = h(
      'div',
      {
        class: ['rank-up', still && 'is-still', frozen && 'is-peak'],
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'rank-up-title',
        onclick: skip,
      },
      h('div', { class: 'rank-up__lights', 'aria-hidden': 'true' }),
      h('div', { class: 'rank-up__sweep', 'aria-hidden': 'true' }),
      card(moment, snapshot.profile.username ?? 'guest', skip),
    );
    root.append(layer);
    html.dataset.moment = 'rank-up';
    room.inert = true;
    announcer.textContent = `Rank up: you are now ${moment.to}. ${moment.flavour}`;
    finishCurrent = finish;
    rankUpChord(store);

    if (frozen) {
      // Held at the peak for screenshots, and deliberately left uncelebrated.
      header.querySelector('.prompt__user')?.classList.add('is-rewriting');
      return;
    }
    layer.querySelector<HTMLElement>('.rank-up__skip')?.focus({ preventScroll: true });
    window.addEventListener('keydown', onKey, true);
    if (!still) {
      rewritePrompt(header, moment.from, moment.to, timers);
      timers.push(window.setTimeout(() => (flights = flyHome(layer, header)), FLIGHT_STARTS_MS));
    }
    timers.push(window.setTimeout(skip, RANK_UP_MS));
  }

  return {
    check() {
      if (finishCurrent) return;
      const moment = rankUpMoment(store);
      if (moment) play(moment);
    },
    destroy() {
      // Leaving mid-moment (the Back button, say) leaves it waiting for the next visit.
      finishCurrent?.(false);
      finishCurrent = null;
      delete html.dataset.moment;
      root.querySelector('.rank-up')?.remove();
      announcer.remove();
    },
  };
}
