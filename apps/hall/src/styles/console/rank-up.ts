import './rank-up.css';
import { levelForXp } from '@usr-games/kit/progression';
import {
  celebrateRankUp,
  RANK_UP_MS,
  type RankUpMoment,
  rankUpChord,
  rankUpMoment,
} from '../../core/rank-up';
import { playSound } from '../../core/sound';
import type { HallStore } from '../../store/hall-store';
import { h } from '../../ui/h';
import { glyph } from './icons';
import { levelRing } from './ring';

/**
 * Console Home's rank-up moment: a level ring fills to the top, bursts into sparks and settles
 * on the new level, with the new skin shown as a swatch. It lasts two seconds and any key or
 * click skips it; afterwards a small card stays in the corner with the new skin to try. Under
 * reduced motion the ring is simply there, full, and the moment fades in and out.
 */

const SPARKS = 18;

interface Staging {
  layer: HTMLElement;
  announcer: HTMLElement;
  frozen: boolean;
  reducedMotion: boolean;
}

function unlockedSkin(moment: RankUpMoment) {
  return moment.unlocked.find((cosmetic) => cosmetic.kind === 'skin') ?? null;
}

function otherUnlocks(moment: RankUpMoment): number {
  return moment.unlocked.filter((cosmetic) => cosmetic.kind !== 'skin').length;
}

function burst(): HTMLElement {
  return h(
    'span',
    { class: 'ch-rankup__sparks', 'aria-hidden': 'true' },
    Array.from({ length: SPARKS }, (_, index) =>
      h('span', {
        class: 'ch-rankup__spark',
        style: {
          '--ch-spark-angle': `${(360 / SPARKS) * index + (index % 2) * 7}deg`,
          '--ch-spark-reach': `${index % 3 === 0 ? 1.18 : index % 3 === 1 ? 0.96 : 1.06}`,
        },
      }),
    ),
  );
}

/**
 * The level the player is actually at: usually the new rank's first level, higher when one
 * big session carried them past it.
 */
function reachedLevel(store: HallStore, moment: RankUpMoment): number {
  return Math.max(moment.level, levelForXp(store.snapshot().progression.xp).level);
}

function stage(moment: RankUpMoment, level: number, onSkip: () => void): HTMLElement {
  const skin = unlockedSkin(moment);
  const more = otherUnlocks(moment);
  return h(
    'div',
    { class: 'ch-rankup', role: 'presentation' },
    h('div', { class: 'ch-rankup__backdrop', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'ch-rankup__centre' },
      h(
        'div',
        { class: 'ch-rankup__ring' },
        h('span', { class: 'ch-rankup__wave', 'aria-hidden': 'true' }),
        burst(),
        levelRing(1, 'ch-ring ch-ring--rankup'),
        h(
          'span',
          { class: 'ch-rankup__number', 'aria-hidden': 'true' },
          h('span', null, 'Level'),
          h('b', null, String(level)),
        ),
      ),
      h('p', { class: 'ch-rankup__eyebrow' }, glyph('spark'), 'Level up'),
      h(
        'p',
        { class: 'ch-rankup__title' },
        `Level ${level}`,
        h('span', { class: 'ch-rankup__rank' }, moment.to),
      ),
      h('p', { class: 'ch-rankup__line' }, moment.plainFlavour),
      skin
        ? h(
            'p',
            { class: 'ch-rankup__unlock' },
            h(
              'span',
              { class: 'ch-swatch ch-swatch--small', dataset: { skin: skin.id } },
              h('span', { class: 'ch-swatch__ring' }),
              h('span', { class: 'ch-swatch__pill' }),
            ),
            h('span', null, `New: ${skin.name}`),
            more > 0 ? h('span', { class: 'ch-rankup__more' }, `and ${more} more looks`) : null,
          )
        : null,
    ),
    h(
      'button',
      {
        class: 'ch-rankup__skip',
        type: 'button',
        'aria-keyshortcuts': 'Escape',
        onclick: onSkip,
      },
      'Skip',
      h('kbd', { 'aria-hidden': 'true' }, 'Esc'),
    ),
  );
}

/** The card that stays once the moment has passed, so the new skin is one click away. */
function keepsake(
  store: HallStore,
  moment: RankUpMoment,
  level: number,
  onClose: () => void,
): HTMLElement {
  const skin = unlockedSkin(moment);
  const card = h(
    'aside',
    { class: 'ch-keepsake', 'aria-label': 'Level up' },
    h('span', { class: 'ch-keepsake__badge', 'aria-hidden': 'true' }, String(level)),
    h(
      'span',
      { class: 'ch-keepsake__text' },
      h('b', null, `Level ${level} · ${moment.to}`),
      h(
        'span',
        null,
        skin ? `The ${skin.name} is yours to wear.` : 'New looks are waiting in your profile.',
      ),
    ),
    skin
      ? h(
          'button',
          {
            class: 'ch-keepsake__try',
            type: 'button',
            onclick: () => {
              playSound(store, 'select');
              store.settings.update({ consoleSkin: skin.id });
              onClose();
            },
          },
          'Wear it',
        )
      : h('a', { class: 'ch-keepsake__try', href: '#/home', onclick: onClose }, 'See them'),
    h(
      'button',
      { class: 'ch-keepsake__close', type: 'button', 'aria-label': 'Close', onclick: onClose },
      glyph('close'),
    ),
  );
  return card;
}

/**
 * Plays the moment once if a rank-up is waiting. Returns a function that tears everything down
 * (used when the style unmounts). Frozen scenes hold the peak and leave the rank-up pending.
 */
export function playRankUp(store: HallStore, staging: Staging): () => void {
  const moment = rankUpMoment(store);
  if (!moment) return () => {};
  const { layer, announcer } = staging;
  const level = reachedLevel(store, moment);
  let finished = false;
  let card: HTMLElement | null = null;

  const removeCard = () => {
    card?.remove();
    card = null;
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey, true);
    view.classList.add('is-leaving');
    setTimeout(() => view.remove(), staging.reducedMotion ? 0 : 260);
    card = keepsake(store, moment, level, removeCard);
    layer.append(card);
    // Acknowledging re-renders the screen, so it comes last.
    celebrateRankUp(store);
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    finish();
  };

  const view = stage(moment, level, finish);
  view.addEventListener('click', finish);
  if (staging.reducedMotion) view.classList.add('is-still');
  if (staging.frozen) view.classList.add('is-frozen');
  layer.append(view);

  const skin = unlockedSkin(moment);
  announcer.textContent = `Level up! You reached level ${level}, rank ${moment.to}. ${moment.plainFlavour}${skin ? ` New: ${skin.name}.` : ''}`;
  if (staging.frozen) return () => view.remove();

  rankUpChord(store);
  document.addEventListener('keydown', onKey, true);
  // `finish` reads this timer, but only from events and the timer itself, both after this line.
  const timer = setTimeout(finish, RANK_UP_MS);
  return () => {
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey, true);
    view.remove();
    removeCard();
  };
}
