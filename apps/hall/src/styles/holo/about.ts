import { processRows } from '../../core/home-model';
import { aboutContent } from '../../core/screens/about/about-content';
import { h } from '../../ui/h';
import { gameCard } from './card';
import type { HoloContext, HoloScreen } from './context';
import { pageFrame } from './page-frame';

/**
 * About, told as the story on the back of the collection's box: the shared text about where the
 * games come from and who made them, with a small fan of real cards from the collection beside it.
 */

const FAN_SIZE = 3;

function cardFan(context: HoloContext): HTMLElement | null {
  const rows = processRows(
    context.store.catalog.listed(),
    context.snapshot.progression,
    context.snapshot.today,
  );
  const ready = rows.filter((row) => row.state === 'R');
  const pool = ready.length >= FAN_SIZE ? ready : rows;
  // One card from each of a few different sets, so the hand shows the range of the collection.
  const picks = pool
    .filter(
      (row, index) =>
        pool.findIndex((other) => other.entry.manifest.category === row.entry.manifest.category) ===
        index,
    )
    .slice(0, FAN_SIZE);
  if (picks.length === 0) return null;
  return h(
    'div',
    { class: 'hc-about-fan' },
    h('p', { class: 'hc-about-fan__label' }, 'From the collection'),
    h(
      'ul',
      { class: 'hc-about-fan__cards' },
      picks.map((row) => h('li', null, gameCard(row, context))),
    ),
  );
}

export function aboutScreen(context: HoloContext): HoloScreen {
  const element = pageFrame({
    key: 'about',
    icon: 'info',
    eyebrow: 'About the collection',
    title: `${context.store.catalog.listed().length} games with a long story`,
    lede: 'Small games from the first Unix computers, rebuilt as cards to collect and play today.',
    body: aboutContent({ store: context.store, wording: 'plain' }),
    aside: cardFan(context),
  });
  return { element, title: 'About' };
}
