import { settingsPanel } from '../../../../core/screens/settings/settings-panel';
import type { HallStore } from '../../../../store/hall-store';
import { type Child, h, mount } from '../../../../ui/h';
import type { Screen, ScreenContext } from '../screen';

/**
 * `vi ~/.config/hall`: the shared settings panel in the machine room, beside the config file it
 * writes. The file is the room's way of saying that every change is saved the moment it is made
 * (and only in this browser); it updates live as the player flips switches.
 */

const KEY_WIDTH = 11;

function configLine(key: string, value: string, comment?: string): Child[] {
  return [
    h('span', { class: 'config__key' }, key.padEnd(KEY_WIDTH)),
    h('span', { class: 'config__punct' }, '= '),
    h('span', { class: 'config__value' }, value),
    comment ? h('span', { class: 'config__comment' }, `  # ${comment}`) : null,
    '\n',
  ];
}

function onOff(value: boolean): string {
  return value ? 'on' : 'off';
}

function configFile(store: HallStore): Child[] {
  const { settings, appearance, reducedMotion } = store.snapshot();
  const remapped = Object.keys(settings.bindings).length;
  return [
    h('span', { class: 'config__comment' }, '# saved as you go; never sent anywhere'),
    '\n\n',
    configLine('style', settings.style),
    configLine('palette', settings.theme),
    configLine(
      'appearance',
      settings.appearance,
      settings.appearance === 'system' ? `${appearance} right now` : undefined,
    ),
    configLine('volume', `${Math.round(settings.volume * 100)}%`),
    configLine('muted', onOff(settings.muted)),
    configLine(
      'motion',
      settings.motion,
      settings.motion === 'system' ? (reducedMotion ? 'reduced here' : 'full here') : undefined,
    ),
    configLine('colorblind', onOff(settings.colorBlindPalette)),
    configLine('locale', settings.language),
    configLine('bindings', remapped === 0 ? 'defaults' : `${remapped} remapped`),
  ];
}

export function settingsScreen(context: ScreenContext): Screen {
  const { store, router } = context;
  const panel = settingsPanel({
    store,
    wording: 'unix',
    onForget: () => router.go({ name: 'login' }, { replace: true }),
  });
  const file = h('code', { class: 'config' });
  const refreshFile = () => mount(file, configFile(store));
  refreshFile();
  const stopWatching = store.subscribe((_, change) => {
    if (change === 'settings') refreshFile();
  });

  const element = h(
    'div',
    { class: 'screen screen--settings' },
    h(
      'header',
      { class: 'page-head' },
      h('p', { class: 'page-head__path' }, '~/.config/hall'),
      h('h1', { class: 'page-head__title' }, 'Settings'),
      h(
        'p',
        { class: 'page-head__lede' },
        'Every change is saved the moment you make it, in this browser only.',
      ),
    ),
    h(
      'div',
      { class: 'settings-room' },
      panel.element,
      h(
        'aside',
        { class: 'panel settings-room__file', 'aria-labelledby': 'config-title' },
        h(
          'header',
          { class: 'panel__label' },
          h('span', { id: 'config-title' }, 'cat ~/.config/hall'),
          h('span', null, 'live'),
        ),
        h('pre', { class: 'config__sheet' }, file),
        h(
          'p',
          { class: 'settings-room__note' },
          'Tab moves between groups; the arrow keys choose within one.',
        ),
      ),
    ),
  );

  return {
    element,
    title: 'Settings',
    cwd: '~',
    command: 'vi ~/.config/hall',
    keepsItself: true,
    destroy() {
      stopWatching();
      panel.destroy();
    },
  };
}
