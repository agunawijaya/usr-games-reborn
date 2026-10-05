import { average, formatAverage } from '../../engine/score';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { type MenuEntry, titleInSand, titleMenu } from '../title';

/**
 * The game menu: the castle standing on a living beach, the title in the wet sand, and the
 * ways to play. The Hall draws "← Back to the Hall" over it, and Escape here goes back.
 */
export function titleScreen(app: App): Screen {
  const prefs = app.saves.prefs.load();
  const records = app.saves.records.load();
  const today = records.dailies[app.context.daily.dateKey()];
  const number = app.context.daily.number();
  const lifetime = average(records.lifetime);

  const entries: MenuEntry[] = [
    {
      id: 'daily',
      label: 'Daily Word',
      badge: `#${number}`,
      detail: today
        ? today.waves === null
          ? 'Today the tide won. Play it again for fun'
          : `Today: found with ${today.waves} ${today.waves === 1 ? 'wave' : 'waves'}`
        : 'One word for everyone today',
      primary: prefs.tutorialDone,
    },
    { id: 'beach', label: 'Beach day', detail: 'Word after word from a deck you choose' },
    { id: 'run', label: 'Tide run', detail: 'Ten words, one castle: how far before the tide?' },
    { id: 'duel', label: 'Duel', detail: 'Two players, one device, a secret word each' },
    { id: 'classic', label: 'Classic', detail: 'The 1983 rules: six letters and up, no help' },
    {
      id: 'tutorial',
      label: 'Tutorial',
      detail: 'Learn the beach in forty seconds',
      badge: prefs.tutorialDone ? undefined : 'New? Start here',
      primary: !prefs.tutorialDone,
    },
  ];
  const go = app.go;
  const routes: Record<string, () => void> = {
    daily: go.daily,
    beach: go.chooseDeck,
    run: go.run,
    duel: go.duel,
    classic: go.classic,
    tutorial: go.tutorial,
    records: go.records,
    help: go.help,
    settings: go.settings,
  };
  const menu = titleMenu(entries, (id) => {
    app.sounds.select();
    routes[id]?.();
  });
  const glance = h(
    'p',
    { class: 'bt-glance' },
    h('span', {}, 'Tide average ', h('strong', {}, formatAverage(lifetime))),
    h('span', {}, 'Words found ', h('strong', {}, String(records.found))),
    h('span', {}, 'Best run ', h('strong', {}, `${records.bestRun}/10`)),
  );
  menu.append(glance);
  const element = h('div', { class: 'bt-title-screen', 'data-testid': 'bt-title' }, menu);

  app.stage.setExtras({ wordPatch: true, gauge: false, wavesAllowed: 7 });
  app.stage.relayout(12, { title: true });
  app.stage.director.settle(0, 9);

  return {
    element,
    onTitle: true,
    onLayout(layout) {
      element.querySelector('.bt-title')?.remove();
      element.append(titleInSand(layout.columnX, layout.word.y - 28 * layout.scale));
    },
    focus() {
      menu.querySelector<HTMLButtonElement>('.bt-menu__item--primary')?.focus();
    },
  };
}
