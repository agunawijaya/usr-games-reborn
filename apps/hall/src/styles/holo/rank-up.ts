import type { Cosmetic } from '@usr-games/kit/progression';
import {
  celebrateRankUp,
  RANK_UP_MS,
  type RankUpMoment,
  rankUpChord,
  rankUpMoment,
} from '../../core/rank-up';
import type { HallStore } from '../../store/hall-store';
import { h } from '../../ui/h';
import { holoIcon } from './icons';
import { type CardRank, finishName, levelCard, RANK_CARD_LOOKS } from './level-card';

/**
 * The rank-up moment in the Holo Collection: a rare card reveal. The new level card rises face
 * down, turns over, and a shine runs across its foil while a burst of sparkles settles, all in
 * about two seconds; then it slips into the album. It is earned, never drawn: the card is always
 * the one for the level the player reached. Any key, a click or Skip ends it early. Under reduced
 * motion the card simply fades in and out. Screenshot scenes hold the brightest moment and leave
 * the celebration unseen, so the frame can be taken again.
 */

/** How long the card takes to slip into the album after the reveal. */
const LEAVE_MS = 380;
const SPARKLES = 14;

export interface RankUpStage {
  /** Plays the moment if the player has one waiting and nothing is playing already. */
  check(): void;
  destroy(): void;
}

interface StageOptions {
  store: HallStore;
  /** Where the overlay lives; everything else in it is made inert while the card is shown. */
  host: HTMLElement;
  frozen: boolean;
  reducedMotion: () => boolean;
}

function unlockList(moment: RankUpMoment, rank: CardRank): HTMLElement {
  const finish = moment.unlocked.find((c) => c.kind === 'finish');
  const room = moment.unlocked.find((c) => c.kind === 'room');
  const others = moment.unlocked.filter((c: Cosmetic) => c !== finish && c !== room).length;
  return h(
    'ul',
    { class: 'hc-rankup__unlocks' },
    h(
      'li',
      { class: 'hc-rankup__unlock hc-rankup__unlock--foil' },
      holoIcon('sparkle', 'hc-icon hc-icon--small'),
      h('b', null, finish?.name ?? finishName(rank)),
      ' for every card',
    ),
    room
      ? h(
          'li',
          { class: 'hc-rankup__unlock' },
          holoIcon('door', 'hc-icon hc-icon--small'),
          h('b', null, 'The server closet'),
          ' is open',
        )
      : null,
    others > 0
      ? h(
          'li',
          { class: 'hc-rankup__unlock' },
          holoIcon('palette', 'hc-icon hc-icon--small'),
          `${others} new ${others === 1 ? 'look' : 'looks'} for the other styles`,
        )
      : null,
  );
}

function cardBack(): HTMLElement {
  return h(
    'div',
    { class: 'hc-rankup__back' },
    h('span', { class: 'hc-brand__mark hc-rankup__mark' }, h('span'), h('span'), h('span')),
    h('span', { class: 'hc-rankup__back-name' }, '/usr/games Reborn'),
  );
}

function overlay(moment: RankUpMoment, rank: CardRank, onSkip: () => void): HTMLElement {
  const sparkles = Array.from({ length: SPARKLES }, (_, index) =>
    h('span', { style: { '--hc-i': String(index), '--hc-n': String(SPARKLES) } }),
  );
  return h(
    'div',
    {
      class: ['hc-rankup', `hc-rankup--${rank}`],
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'hc-rankup-title',
      'aria-describedby': 'hc-rankup-line',
      style: {
        '--hc-frame-from': RANK_CARD_LOOKS[rank].frameFrom,
        '--hc-frame-to': RANK_CARD_LOOKS[rank].frameTo,
      },
      onclick: onSkip,
    },
    h('div', { class: 'hc-rankup__glow', 'aria-hidden': 'true' }),
    h('div', { class: 'hc-rankup__rays', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'hc-rankup__stage' },
      h(
        'div',
        { class: 'hc-rankup__card' },
        h('div', { class: 'hc-rankup__burst', 'aria-hidden': 'true' }, sparkles),
        h(
          'div',
          { class: 'hc-rankup__spin' },
          cardBack(),
          h(
            'div',
            { class: 'hc-rankup__front' },
            levelCard(rank, null, { earned: true, size: 'reveal' }),
            h('span', { class: 'hc-rankup__shine', 'aria-hidden': 'true' }),
          ),
        ),
      ),
      h(
        'div',
        { class: 'hc-rankup__copy' },
        h(
          'p',
          { class: 'hc-eyebrow hc-rankup__eyebrow' },
          holoIcon('star', 'hc-icon hc-icon--small'),
          'New level card',
        ),
        h(
          'h2',
          { id: 'hc-rankup-title', class: 'hc-rankup__title' },
          `Level ${moment.level}`,
          h('span', { class: 'hc-level__rank hc-rankup__rank' }, rank),
        ),
        h('p', { id: 'hc-rankup-line', class: 'hc-rankup__line' }, RANK_CARD_LOOKS[rank].line),
        unlockList(moment, rank),
        h('p', { class: 'hc-rankup__note' }, 'It is in your album now. Pick a foil in Settings.'),
      ),
    ),
    h(
      'button',
      {
        class: 'hc-button hc-button--ghost hc-rankup__skip',
        type: 'button',
        onclick: (event: Event) => {
          event.stopPropagation();
          onSkip();
        },
      },
      'Skip',
      h('kbd', null, 'Esc'),
    ),
  );
}

export function createRankUpStage(options: StageOptions): RankUpStage {
  const { store, host, frozen } = options;
  const live = h('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
  host.append(live);
  let showing: HTMLElement | null = null;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let returnFocus: HTMLElement | null = null;

  function setBackgroundInert(inert: boolean) {
    for (const child of host.children) {
      if (child !== showing && child !== live) (child as HTMLElement).inert = inert;
    }
  }

  function close() {
    if (!showing) return;
    const element = showing;
    showing = null;
    timers.forEach(clearTimeout);
    timers = [];
    document.removeEventListener('keydown', onKey, true);
    element.remove();
    setBackgroundInert(false);
    celebrateRankUp(store);
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }

  /** The card slips toward the album tab as the overlay fades; a plain fade when motion is calm. */
  function leave() {
    const element = showing;
    if (!element) return;
    element.classList.add('is-leaving');
    const card = element.querySelector<HTMLElement>('.hc-rankup__card');
    const album = host.querySelector<HTMLElement>('[data-focus-key="tab:album"]');
    if (card && album && !options.reducedMotion()) {
      const from = card.getBoundingClientRect();
      const to = album.getBoundingClientRect();
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      card.animate(
        [
          { transform: 'none', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.12) rotate(-8deg)`, opacity: 0.2 },
        ],
        { duration: LEAVE_MS, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' },
      );
    }
    timers.push(setTimeout(close, LEAVE_MS));
  }

  function onKey(event: KeyboardEvent) {
    if (!showing) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      // The only control is Skip; keep focus on it while the card is up.
      event.preventDefault();
      showing.querySelector<HTMLElement>('.hc-rankup__skip')?.focus();
    }
  }

  function show(moment: RankUpMoment, rank: CardRank) {
    const element = overlay(moment, rank, close);
    showing = element;
    element.classList.add(
      frozen ? 'is-frozen' : options.reducedMotion() ? 'is-calm' : 'is-playing',
    );
    host.append(element);
    setBackgroundInert(true);
    live.textContent = `Level up! You reached Level ${moment.level}. New: ${finishName(rank)}. The level card is in your album.`;
    if (frozen) return;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.querySelector<HTMLElement>('.hc-rankup__skip')?.focus({ preventScroll: true });
    document.addEventListener('keydown', onKey, true);
    rankUpChord(store);
    timers.push(setTimeout(leave, RANK_UP_MS));
  }

  return {
    check() {
      if (showing) return;
      const moment = rankUpMoment(store);
      if (!moment || moment.to === 'guest') return;
      show(moment, moment.to);
    },
    destroy() {
      timers.forEach(clearTimeout);
      document.removeEventListener('keydown', onKey, true);
      showing?.remove();
      showing = null;
      live.remove();
    },
  };
}
