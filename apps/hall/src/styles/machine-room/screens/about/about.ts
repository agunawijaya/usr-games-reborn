import { aboutContent } from '../../../../core/screens/about/about-content';
import { h } from '../../../../ui/h';
import type { Screen, ScreenContext } from '../screen';

/**
 * `cat /etc/motd`: the story of /usr/games, how the Hall works and who wrote the originals,
 * printed as the machine's message of the day.
 */
export function aboutScreen(context: ScreenContext): Screen {
  const element = h(
    'div',
    { class: 'screen screen--about' },
    h(
      'header',
      { class: 'page-head' },
      h('p', { class: 'page-head__path' }, '/etc/motd'),
      h('h1', { class: 'page-head__title' }, 'About this machine'),
      h(
        'p',
        { class: 'page-head__lede' },
        'Thirty small programs, forty-odd years, one directory. Here is where they came from.',
      ),
    ),
    h('article', { class: 'panel motd' }, aboutContent({ store: context.store, wording: 'unix' })),
  );
  return { element, title: 'About', cwd: '/etc', command: 'cat /etc/motd' };
}
