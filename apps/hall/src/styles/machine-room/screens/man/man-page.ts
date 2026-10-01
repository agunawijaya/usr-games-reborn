import { type PackageDefinition, packageKey, packageXp } from '@usr-games/kit';
import type { GameManifest } from '@usr-games/kit/manifest';
import { isLaunchable } from '../../../../catalog/catalog';
import { gameAccent } from '../../../../core/palette';
import {
  formatLongDate,
  formatMinutes,
  formatNumber,
  formatShortDate,
} from '../../../../ui/format';
import { h } from '../../../../ui/h';
import { emblem, icon } from '../../../../ui/icons';
import { processState } from '../../../../core/home-model';
import type { Screen, ScreenContext } from '../screen';

/**
 * The game's detail page, typeset as a Unix manual page: NAME, SYNOPSIS, DESCRIPTION,
 * ACHIEVEMENTS, HISTORY, SEE ALSO. Arrow keys move between sections; Enter runs the game.
 */

const MANUAL_VERSION = 'usr-games-reborn 0.1';

function section(id: string, heading: string, ...body: (Node | string | null)[]): HTMLElement {
  return h(
    'section',
    { class: 'man-section', 'aria-labelledby': `man-${id}` },
    h(
      'h2',
      {
        id: `man-${id}`,
        class: 'man-section__heading',
        tabindex: '-1',
        dataset: { focusKey: `man:${id}` },
      },
      heading,
    ),
    h('div', { class: 'man-section__body' }, body),
  );
}

function packageRow(
  manifest: GameManifest,
  definition: PackageDefinition,
  installedOn: string | undefined,
): HTMLElement {
  const installed = installedOn !== undefined;
  const description =
    definition.hidden && !installed
      ? 'A surprise, revealed once installed.'
      : definition.description;
  return h(
    'li',
    { class: ['pkg', installed ? 'pkg--installed' : 'pkg--available'] },
    h('span', { class: 'pkg__state', 'aria-hidden': 'true' }, installed ? 'ii' : 'un'),
    h(
      'span',
      { class: 'pkg__title' },
      definition.title,
      h('code', { class: 'pkg__name' }, `${manifest.id}/${definition.id}.pkg`),
    ),
    h('span', { class: 'pkg__desc' }, description),
    h(
      'span',
      { class: 'pkg__xp' },
      installed ? `installed ${formatShortDate(installedOn)}` : `+${packageXp(definition)} XP`,
    ),
  );
}

function achievements(context: ScreenContext, manifest: GameManifest): HTMLElement {
  const packages = manifest.packages ?? [];
  if (packages.length === 0) {
    return h(
      'p',
      { class: 'man-note' },
      'This game’s packages ship with the game itself. When it arrives, each one you earn is installed into ',
      h('code', null, `${context.store.homeDirectory()}/${manifest.id}/`),
      '.',
    );
  }
  const installed = context.snapshot.progression.packages;
  const count = packages.filter((p) => installed[packageKey(manifest.id, p.id)]).length;
  return h(
    'div',
    null,
    h(
      'p',
      null,
      `${count} of ${packages.length} packages installed in `,
      h('code', null, `${context.store.homeDirectory()}/${manifest.id}/`),
      '.',
    ),
    h(
      'ul',
      { class: 'pkg-list' },
      packages.map((p) =>
        packageRow(manifest, p, installed[packageKey(manifest.id, p.id)]?.installedOn),
      ),
    ),
  );
}

function seeAlso(context: ScreenContext, manifest: GameManifest): HTMLElement {
  const links = manifest.manPage.seeAlso
    .map((id) => context.store.catalog.byId(id))
    .filter((entry) => entry !== undefined)
    .map((entry) =>
      h(
        'a',
        { class: 'man-xref', href: `#/man/${entry.manifest.id}` },
        h('b', null, entry.manifest.id),
        '(6)',
      ),
    );
  return h(
    'p',
    { class: 'man-xrefs' },
    links.flatMap((link, index) => (index === 0 ? [link] : [', ', link])),
  );
}

function runPanel(context: ScreenContext, manifest: GameManifest): HTMLElement {
  const entry = context.store.catalog.byId(manifest.id);
  const runnable = entry ? isLaunchable(entry) : false;
  const state = entry ? processState(entry) : 'S';
  const stats = context.snapshot.progression.games[manifest.id];
  const status = runnable
    ? stats
      ? `Run ${stats.sessions} ${stats.sessions === 1 ? 'time' : 'times'}, last on ${formatShortDate(stats.lastPlayed)}.`
      : 'Ready to run.'
    : state === 'D'
      ? 'Being adopted into the collection; it will run here soon.'
      : 'Sleeping until its brief is written and it is built.';
  return h(
    'aside',
    { class: 'man-aside', 'aria-label': 'Run this game' },
    h('div', { class: 'monitor monitor--man' }, emblem(manifest.emblem, 'emblem monitor__emblem')),
    runnable
      ? h(
          'a',
          {
            class: 'button button--primary button--run',
            href: `#/run/${manifest.id}`,
            dataset: { focusKey: 'man:run' },
          },
          icon('run'),
          h('span', null, 'Run'),
          h('kbd', null, 'Enter'),
        )
      : h(
          'span',
          { class: 'button button--sleeping', role: 'note' },
          icon(state === 'D' ? 'folder' : 'sleep'),
          h('span', null, state === 'D' ? 'Arriving soon' : 'Coming soon'),
        ),
    h('p', { class: 'man-aside__status' }, status),
    h(
      'dl',
      { class: 'facts' },
      h(
        'div',
        null,
        h('dt', null, 'directory'),
        h('dd', null, h('code', null, manifest.directory)),
      ),
      h(
        'div',
        null,
        h('dt', null, 'session'),
        h('dd', null, formatMinutes(manifest.sessionMinutes)),
      ),
      h(
        'div',
        null,
        h('dt', null, 'players'),
        h(
          'dd',
          null,
          manifest.players.max === 1 ? 'one' : `${manifest.players.min}–${manifest.players.max}`,
        ),
      ),
      h(
        'div',
        null,
        h('dt', null, 'daily'),
        h('dd', null, manifest.daily ? 'yes, a new one every day' : 'no'),
      ),
      h(
        'div',
        null,
        h('dt', null, 'best'),
        h(
          'dd',
          null,
          stats?.bestScore !== null && stats?.bestScore !== undefined
            ? formatNumber(stats.bestScore)
            : '—',
        ),
      ),
    ),
  );
}

export function manPageScreen(context: ScreenContext, id: string): Screen {
  const entry = context.store.catalog.byId(id);
  if (!entry) {
    const element = h(
      'div',
      { class: 'screen screen--man' },
      h(
        'article',
        { class: 'manpage manpage--missing' },
        h('h1', null, `No manual entry for ${id}`),
        h('p', null, h('a', { href: '#/' }, 'Back to the process list')),
      ),
    );
    return { element, title: 'No manual entry', cwd: '~', command: `man ${id}` };
  }
  const { manifest } = entry;
  const upper = `${manifest.id.toUpperCase()}(6)`;
  const article = h(
    'article',
    {
      class: 'manpage',
      style: {
        '--game-accent': gameAccent(manifest.accent, context.theme),
        '--game-accent-raw': manifest.accent,
      },
    },
    h(
      'header',
      { class: 'manpage__header' },
      h('span', null, upper),
      h('span', { class: 'manpage__book' }, '/usr/games Reborn Manual'),
      h('span', null, upper),
    ),
    h('h1', { class: 'visually-hidden' }, `${manifest.title}, manual page`),
    h(
      'div',
      { class: 'manpage__layout' },
      h(
        'div',
        { class: 'manpage__text' },
        section(
          'name',
          'NAME',
          h(
            'p',
            { class: 'man-name' },
            h('b', null, manifest.id),
            ' — ',
            h('span', { class: 'man-name__title' }, manifest.title),
            h('span', { class: 'man-name__tagline' }, manifest.tagline),
          ),
        ),
        section(
          'synopsis',
          'SYNOPSIS',
          h('p', { class: 'man-synopsis' }, h('code', null, manifest.manPage.synopsis)),
        ),
        section('description', 'DESCRIPTION', h('p', { class: 'man-lede' }, manifest.teaser)),
        section('achievements', 'ACHIEVEMENTS', achievements(context, manifest)),
        section(
          'history',
          'HISTORY',
          h('p', null, manifest.manPage.description),
          h(
            'p',
            { class: 'man-note' },
            `Reborn from `,
            h('b', null, manifest.inspiredBy.uiTitle),
            `, dated ${manifest.inspiredBy.year} in the BSD sources.`,
          ),
        ),
        section('see-also', 'SEE ALSO', seeAlso(context, manifest)),
      ),
      runPanel(context, manifest),
    ),
    h(
      'footer',
      { class: 'manpage__footer' },
      h('span', null, MANUAL_VERSION),
      h('span', null, formatLongDate(context.snapshot.today)),
      h('span', null, upper),
    ),
  );

  const element = h(
    'div',
    { class: 'screen screen--man' },
    h(
      'p',
      { class: 'screen__back' },
      h('a', { href: '#/', class: 'link-back' }, icon('back'), 'Back to the process list'),
    ),
    article,
  );

  const headings = () => [...article.querySelectorAll<HTMLElement>('.man-section__heading')];
  const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const list = headings();
      const current = list.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === 'ArrowDown'
          ? Math.min(list.length - 1, current + 1)
          : Math.max(0, current - 1);
      list[current === -1 ? 0 : next]?.focus();
      event.preventDefault();
    } else if (
      event.key === 'Enter' &&
      (target === document.body || target?.classList.contains('man-section__heading'))
    ) {
      const run = article.querySelector<HTMLAnchorElement>('.button--run');
      if (run) {
        run.click();
        event.preventDefault();
      }
    }
  };
  document.addEventListener('keydown', onKey);

  return {
    element,
    title: `${manifest.title} — man ${manifest.id}`,
    cwd: '/usr/share/man/man6',
    command: `man ${manifest.id}`,
    destroy: () => document.removeEventListener('keydown', onKey),
  };
}
