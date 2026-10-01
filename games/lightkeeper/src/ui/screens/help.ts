import type { App, Screen } from '../app';
import { button, h, kbd } from '../dom';

/** How to play, in the game's own words: the clock, moving, fighting, the lights and ranks. */
export function helpScreen(app: App): Screen {
  const section = (title: string, ...paragraphs: (string | HTMLElement)[]) =>
    h(
      'section',
      { class: 'lk-help__section' },
      h('h3', {}, title),
      ...paragraphs.map((p) => (typeof p === 'string' ? h('p', {}, p) : p)),
    );

  const keys: [string, string][] = [
    ['Click a cell', 'Move there inside the zone'],
    ['Click a zone on the chart', 'Jump there'],
    ['F', 'Aim a flare (F again to cancel; Shift for a spread of three, from Head Keeper on)'],
    ['B', 'Beams'],
    ['G', 'Raise or lower the shield'],
    ['H', 'Hail a gleaner (from Lamplighter on)'],
    ['M', 'Moor beside a harbour, or leave it'],
    ['R', 'Rest'],
    ['[ and ]', 'Drive factor down and up'],
    ['.', 'More orders: beacon, shroud, abandon ship'],
    ['Z and J', 'Focus the zone or the chart; arrows move the cursor, Enter acts'],
    ['Esc', 'Pause'],
  ];

  const element = h(
    'section',
    { class: 'lk-screen lk-help', dataset: { testid: 'lk-help' } },
    h(
      'div',
      { class: 'lk-page lk-page--narrow' },
      h(
        'header',
        { class: 'lk-page__head' },
        h('p', { class: 'lk-kicker' }, 'How to play'),
        h('h2', {}, 'Keeping the watch'),
      ),
      section(
        'The goal',
        'Gleaners, self-replicating mining drones, have spread through the Reach: eight by eight zones, each ten cells across, with thirty-two inhabited worlds among them. Stop every gleaner before the reserve runs dry.',
      ),
      section(
        'The reserve clock',
        'The reserve drains a little for every gleaner still out there, every day. The figure at the top is how long it lasts at the swarm’s present size, so every gleaner you stop makes it last longer, and every new one shortens it.',
      ),
      section(
        'Moving',
        'Click a cell to move inside the zone, or a zone on the chart to jump. The drive factor sets the pace: time falls with its square, power climbs with its cube, and above 6 the drive may strain. A raised shield doubles the cost of the drive.',
      ),
      section(
        'Fighting',
        'Gleaners answer every order that takes them a turn: they move, fire, tire and often drift away. Beams pour power through every gleaner in the zone, nearest first, weaker with distance, and cannot fire through your own shield. Flares stop most gleaners outright but stray from their bearing, and more so with the shield up. A flare that hits a star may set it off, and everything next to it.',
      ),
      section(
        'Lights and calls',
        'When gleaners attack a world, it sends out a call with a deadline. Clear its zone in time and the world is safe. Miss it and the world goes dark: its forge starts building new gleaners until you clear the zone and light it again.',
      ),
      section(
        'Harbours',
        'Move beside a harbour and moor to refill power, flares and shield at once and to speed up repairs. Gleaners may besiege a harbour and take it if nobody comes.',
      ),
      section(
        'Ranks',
        'The career climbs six ranks, each adding one idea. A win worth 1,000 points with a clean record earns the next rank: no call for a harbour’s beacon, no harbour or world lost to your own fire, few stars spent, few crew hurt, and the Lantern brought home. Ranks are never taken away.',
      ),
      h(
        'section',
        { class: 'lk-help__section' },
        h('h3', {}, 'Keys'),
        h(
          'table',
          { class: 'lk-keys' },
          h(
            'tbody',
            {},
            ...keys.map(([key, what]) =>
              h(
                'tr',
                {},
                h(
                  'th',
                  {},
                  ...key.split(' and ').flatMap((k, i) => (i ? [' and ', kbd(k)] : [kbd(k)])),
                ),
                h('td', {}, what),
              ),
            ),
          ),
        ),
      ),
      h(
        'div',
        { class: 'lk-page__actions' },
        button('Game menu', { onClick: () => app.go.title(), variant: 'primary', autofocus: true }),
      ),
    ),
  );
  return {
    element,
    focus: () =>
      element.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }),
  };
}
