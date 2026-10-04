import type { App, Screen } from '../app';
import { button, h, kbd } from '../dom';

/** How to play, in the game itself: the wind, the guns, close action, prizes, her life. */
export function helpScreen(app: App): Screen {
  const keys: [string, string][] = [
    ['Enter', 'Make it so: play the turn'],
    ['Q / E  or  [ / ]', 'Turn to port / starboard'],
    ['1 – 7', 'Sail that many squares ahead'],
    ['Backspace, H', 'Undo the last helm order; hold her where she is'],
    ['A / D', 'Fire the port / starboard broadside, or hold it'],
    ['W', 'Aim at her hull or her rigging'],
    ['Z / C', 'Reload port / starboard with another shot'],
    ['S', 'Full sail or battle sail'],
    ['G, B, V', 'Grapple, board (1–3 sections), keep hands back'],
    ['K', 'Signal the squadron'],
    ['M', 'Take the sailing master’s advice'],
    ['Tab', 'Show the next enemy’s possible positions'],
    ['+ / −, F', 'Zoom the chart; follow the action again'],
    ['Space', 'Skip the turn’s film'],
  ];
  const section = (title: string, ...paras: string[]) =>
    h('section', {}, h('h2', {}, title), ...paras.map((p) => h('p', {}, p)));
  const element = h(
    'section',
    { class: 'fh-screen fh-help', dataset: { testid: 'fh-help' } },
    h(
      'div',
      { class: 'fh-sheet fh-sheet--wide' },
      h('p', { class: 'fh-kicker' }, 'How to play'),
      h('h1', {}, 'Wind, guns and the six-to-one rule'),
      h(
        'div',
        { class: 'fh-help__grid' },
        h(
          'div',
          {},
          section(
            'The wind',
            'A square-rigged ship cannot sail into the wind. The rose shows how many squares she can sail on every heading: most with the wind on her quarter, none with it dead ahead. Every turn costs a square, and she cannot turn twice running. Every seventh turn the weather may shift.',
          ),
          section(
            'The guns',
            'Each broadside covers three points either side of the beam. Your guns fire first in a turn, from where the ships lie; then every ship moves at once, and the enemy fires. Round shot reaches ten squares, chain three, grape and double shot only alongside. Firing down an enemy’s length from ahead or astern, a rake, hits much harder; she cannot answer.',
            'The enemy’s guns never need reloading, and alongside they always fire double shot: keep out of pistol shot unless you mean to board.',
          ),
          section(
            'Taking a prize',
            'A ship beaten to a hulk strikes, and may sink or burn. A ship that has lost her masts or most of her people yields whole. Chain and grape take her that way; boarders take her best of all.',
            'After the action every prize needs a prize crew: enough of your hands to sail her, and one for every six prisoners, or they will rise and take her back. Two more and she can join your squadron, under one of your officers.',
          ),
          section(
            'Her life',
            'Twelve chapters over thirty years. Battles leave scars that stay. Her crew grows from green to elite, her officers become captains, and her squadron grows from the ships she takes. Lose her and the story goes on: a ship taken can be cut out of an enemy harbour, and a ship lost is built again under the same figurehead.',
          ),
        ),
        h(
          'div',
          {},
          h('h2', {}, 'Keys'),
          h(
            'dl',
            { class: 'fh-keys' },
            keys.flatMap(([k, what]) => [h('dt', {}, kbd(k)), h('dd', {}, what)]),
          ),
          h(
            'p',
            { class: 'fh-orders__small' },
            'Every order also has a button, and the chart can be steered by clicking a dot: each is a square she can end her turn on.',
          ),
        ),
      ),
      h(
        'div',
        { class: 'fh-actions' },
        button('Game menu', {
          onClick: () => app.go.title(),
          key: 'Esc',
          variant: 'primary',
          testId: 'fh-help-menu',
          autofocus: true,
        }),
      ),
    ),
  );
  return {
    element,
    onKey(event) {
      if (event.key === 'Escape') {
        app.go.title();
        return true;
      }
      return false;
    },
    focus: () =>
      element.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }),
  };
}
