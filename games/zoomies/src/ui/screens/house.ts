import { ROOMS, STARS_IN_HOUSE } from '../../data/house';
import { starsEarned } from '../../game/saves';
import { paintMiniature } from '../../render/miniature';
import { COATS } from '../../render/palette';
import type { App, Screen } from '../app';
import { h, starRow } from '../dom';

/**
 * The house as a floor plan: twelve rooms in order, each with its stars and best turns. A
 * room opens once the one before it has been tidied.
 */
export function houseScreen(app: App): Screen {
  const house = app.saves.house.load();
  const stars = starsEarned(house);
  const nextCoat = COATS.find((coat) => coat.stars > stars);
  const plans: { canvas: HTMLCanvasElement; room: (typeof ROOMS)[number] }[] = [];
  const tiles = ROOMS.map((room, index) => {
    const record = house.rooms[room.id];
    const previous = ROOMS[index - 1];
    const open = index === 0 || Boolean(previous && house.rooms[previous.id]?.tidy);
    const earned = record?.stars ?? [false, false, false];
    const best = record?.bestTurns ?? null;
    const label = open
      ? `Room ${index + 1}, ${room.name}. ${earned.filter(Boolean).length} of 3 stars.${best !== null ? ` Best ${best} turns, par ${room.par}.` : ` Par ${room.par}.`}`
      : `Room ${index + 1}, ${room.name}. Opens when ${previous?.name.toLowerCase()} is tidy.`;
    const plan = h('canvas', { class: 'zm-room__plan', 'aria-hidden': 'true' });
    paintMiniature(plan, room.spec, room.id, app.look, app.coat(), 230, 74);
    plans.push({ canvas: plan, room });
    return h(
      'button',
      {
        type: 'button',
        class: 'zm-room',
        disabled: !open,
        'aria-label': label,
        onclick: () => app.go.room(room.id),
        dataset: { testid: `zm-room-${room.id}` },
      },
      plan,
      h('span', { class: 'zm-room__number' }, `Room ${index + 1}`),
      h('span', { class: 'zm-room__name' }, room.name),
      h(
        'span',
        { class: 'zm-room__foot' },
        open ? starRow(earned, '') : h('span', {}, `Tidy ${previous?.name.toLowerCase()} first`),
        open
          ? h('span', {}, best !== null ? `${best} / par ${room.par}` : `par ${room.par}`)
          : null,
      ),
    );
  });
  const back = h(
    'button',
    {
      type: 'button',
      class: 'zm-button zm-button--quiet',
      onclick: () => app.go.title(),
      dataset: { testid: 'zm-back' },
    },
    '← Game menu',
  );
  const element = h(
    'section',
    { class: 'zm-screen', 'aria-labelledby': 'zm-house-title', dataset: { testid: 'zm-house' } },
    h(
      'div',
      { class: 'zm-page' },
      h(
        'div',
        { class: 'zm-page__head' },
        back,
        h('h1', { class: 'zm-page__title', id: 'zm-house-title' }, 'The House'),
        h(
          'span',
          { class: 'zm-menu__side', style: 'margin-left:auto' },
          `★ ${stars} / ${STARS_IN_HOUSE}`,
        ),
      ),
      h(
        'p',
        { class: 'zm-page__lede' },
        'Each room brings one new trick. Earn a star for tidying it, one for par or better, one for never zooming.',
        nextCoat
          ? ` ${nextCoat.stars - stars} more star${nextCoat.stars - stars === 1 ? '' : 's'} and you can wear the ${nextCoat.name.toLowerCase()} coat.`
          : ' Every coat is yours.',
      ),
      h('div', { class: 'zm-plan' }, ...tiles),
    ),
  );
  return {
    element,
    onLook(look) {
      for (const { canvas, room } of plans)
        paintMiniature(canvas, room.spec, room.id, look, app.coat(), 230, 74);
    },
    focus() {
      const next = ROOMS.find((room) => !house.rooms[room.id]?.tidy) ?? ROOMS[0]!;
      const tile = element.querySelector<HTMLButtonElement>(
        `[data-testid="zm-room-${next.id}"]:not(:disabled)`,
      );
      (tile ?? back).focus({ preventScroll: true });
    },
    onKey(event) {
      if (event.key === 'Backspace') {
        app.go.title();
        return true;
      }
      return false;
    },
  };
}
