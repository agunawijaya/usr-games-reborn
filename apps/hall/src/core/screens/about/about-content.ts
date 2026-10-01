import './about.css';
import type { Category } from '@usr-games/kit/manifest';
import type { CatalogEntry } from '../../../catalog/catalog';
import type { HallStore } from '../../../store/hall-store';
import { type Child, h } from '../../../ui/h';
import { CATEGORY_NAMES } from '../../plain';

/**
 * About the collection: the story of /usr/games, how the Hall works, and the credits for every
 * original program, written from the sourced facts in CREDITS.md. Shared by all three styles;
 * the Machine Room tells it with a little more Unix flavour.
 */

export interface AboutOptions {
  store: HallStore;
  wording: 'plain' | 'unix';
}

const FONTS = [
  ['Atkinson Hyperlegible Next', 'The Atkinson Hyperlegible Next Project Authors'],
  ['IBM Plex Mono', 'IBM Corp.'],
  ['VT323', 'The VT323 Project Authors'],
  ['Source Serif 4', 'Google'],
  ['Fraunces', 'The Fraunces Project Authors'],
  ['Bricolage Grotesque', 'The Bricolage Grotesque Project Authors'],
  ['Fredoka', 'The Fredoka Project Authors'],
] as const;

function story(wording: AboutOptions['wording']): Child[] {
  const opening =
    wording === 'unix'
      ? 'On every BSD Unix machine from the late 1970s on, a directory called /usr/games held a small collection of programs anyone could run: space battles, card games, a cave to explore, a moon to look at.'
      : 'From the late 1970s on, every BSD Unix computer came with a folder of games anyone could play: space battles, card games, a cave to explore, a moon to look at.';
  return [
    h('p', { class: 'ab-lede' }, opening),
    h(
      'p',
      null,
      'They were written by students, researchers and hobbyists, often just for fun, and passed from machine to machine for decades. The collection here keeps each game’s heart, the choice you make every turn, and rebuilds everything around it for today: new art, new sound, plain rules and room to breathe.',
    ),
    h(
      'p',
      null,
      'Nothing is emulated. Each game is redesigned from its original source and credited to the people who wrote it.',
    ),
  ];
}

function howItWorks(wording: AboutOptions['wording']): Child[] {
  const words =
    wording === 'unix'
      ? {
          progress: 'Your rank, packages, uptime and saves live only in this browser.',
          switch:
            'The Hall comes in three styles, the machine room you are in, Console Home and Holo Collection, and they all share your progress.',
        }
      : {
          progress: 'Your level, achievements, streak and saves live only in this browser.',
          switch:
            'The Hall comes in three styles, Console Home, Holo Collection and the Machine Room, and they all share your progress.',
        };
  return [
    h(
      'ul',
      { class: 'ab-list' },
      h(
        'li',
        null,
        'Every game is free to play from the first visit. Levels only unlock looks, never games.',
      ),
      h('li', null, words.progress, ' Nothing is sent anywhere, and there is nothing to buy.'),
      h('li', null, words.switch),
      h(
        'li',
        null,
        'Everything you see is drawn in code: no photos, no downloaded pictures, no tracking.',
      ),
    ),
  ];
}

function creditRow(entry: CatalogEntry): HTMLElement {
  const { manifest } = entry;
  return h(
    'li',
    { class: 'ab-credit' },
    h(
      'p',
      { class: 'ab-credit__title' },
      h('b', null, manifest.title),
      h(
        'span',
        { class: 'ab-credit__origin' },
        ` · reborn from ${manifest.inspiredBy.uiTitle}, ${manifest.inspiredBy.year}`,
      ),
    ),
    h('p', { class: 'ab-credit__text' }, manifest.manPage.description),
  );
}

function credits(store: HallStore, wording: AboutOptions['wording']): Child[] {
  const byCategory = new Map<Category, CatalogEntry[]>();
  for (const entry of store.catalog.listed()) {
    byCategory.set(entry.manifest.category, [
      ...(byCategory.get(entry.manifest.category) ?? []),
      entry,
    ]);
  }
  return [
    h(
      'p',
      null,
      'The originals come from the bsd-games package for Linux, first put together by Curt Olson and Andy Tefft and later looked after by Joseph S. Myers, which gathered the games shipped with NetBSD. Most are copyright the Regents of the University of California under the BSD licence; hack carries the notice of CWI Amsterdam, and phantasia was released without copyright.',
    ),
    h(
      'div',
      { class: 'ab-credits' },
      [...byCategory].map(([category, entries]) =>
        h(
          'section',
          { class: 'ab-credits__group', 'aria-label': CATEGORY_NAMES[category] },
          h(
            'h3',
            { class: 'ab-credits__heading' },
            wording === 'unix' ? `/usr/games/${category}` : CATEGORY_NAMES[category],
          ),
          h(
            'ul',
            { class: 'ab-credits__list' },
            entries.map((entry) => creditRow(entry)),
          ),
        ),
      ),
    ),
  ];
}

function licences(): Child[] {
  return [
    h(
      'p',
      null,
      'The Hall’s own code is MIT licensed. The original programs’ copyright and licence notices travel with the source in its LICENSES folder, and CREDITS.md lists who wrote what.',
    ),
    h(
      'p',
      null,
      'Type faces, all under the SIL Open Font License and served from this site: ',
      FONTS.map(([font, holder], index) => [
        index > 0 ? ', ' : '',
        h('b', null, font),
        ` (${holder})`,
      ]),
      '.',
    ),
    h(
      'p',
      null,
      'Trademarked names of some original games are mentioned only in the credits file, never in titles; every game here goes by its own name.',
    ),
  ];
}

/** The About page body; each style wraps it in its own page chrome. */
export function aboutContent(options: AboutOptions): HTMLElement {
  const { store, wording } = options;
  const block = (id: string, title: string, ...body: Child[]) =>
    h(
      'section',
      { class: 'ab-section', 'aria-labelledby': `ab-${id}` },
      h('h2', { id: `ab-${id}`, class: 'ab-section__title' }, title),
      body,
    );
  return h(
    'div',
    { class: 'ab-content', dataset: { wording } },
    block(
      'story',
      wording === 'unix' ? 'The story of /usr/games' : 'Where these games come from',
      story(wording),
    ),
    block('how', 'How the Hall works', howItWorks(wording)),
    block('credits', 'The people behind the originals', credits(store, wording)),
    block('licences', 'Licences and type', licences()),
  );
}
