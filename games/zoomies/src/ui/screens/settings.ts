import { starsEarned, type Pace, type Prefs } from '../../game/saves';
import { iconCanvas } from '../../render/icons';
import { COATS } from '../../render/palette';
import type { App, Screen } from '../app';
import { h } from '../dom';

/** Zoomies' own settings. Sound, motion and appearance live in the Hall's settings. */
export function settingsScreen(app: App): Screen {
  const stars = starsEarned(app.saves.house.load());
  const body = h('div', { class: 'zm-grid-2' });

  function update(patch: Partial<Prefs>) {
    app.saves.prefs.update((prefs) => ({ ...prefs, ...patch }));
    render();
  }

  function toggle(label: string, help: string, on: boolean, onChange: () => void, testId: string) {
    return h(
      'div',
      { style: 'display:grid;gap:4px' },
      h(
        'div',
        { class: 'zm-toggle' },
        h('span', { id: `${testId}-label` }, label),
        h('button', {
          type: 'button',
          class: 'zm-switch',
          role: 'switch',
          'aria-checked': String(on),
          'aria-labelledby': `${testId}-label`,
          onclick: onChange,
          dataset: { testid: testId },
        }),
      ),
      h('p', { class: 'zm-ladder__note' }, help),
    );
  }

  function render() {
    const prefs = app.saves.prefs.load();
    const paces: [Pace, string][] = [
      ['calm', 'Calm'],
      ['brisk', 'Brisk'],
      ['zippy', 'Zippy'],
    ];
    body.replaceChildren(
      h(
        'section',
        { class: 'zm-card zm-section', 'aria-labelledby': 'zm-settings-play' },
        h('h2', { id: 'zm-settings-play' }, 'Play'),
        toggle(
          'Careful paws',
          'Refuse a step into a vacuum’s reach, as the original did. The Long Night always keeps it on.',
          prefs.carefulPaws,
          () => update({ carefulPaws: !prefs.carefulPaws }),
          'zm-careful',
        ),
        toggle(
          'Whiskers',
          'Hatch the squares a vacuum could reach next turn.',
          prefs.whiskers,
          () => update({ whiskers: !prefs.whiskers }),
          'zm-whiskers-setting',
        ),
        h(
          'div',
          { role: 'group', 'aria-labelledby': 'zm-pace-label', style: 'display:grid;gap:6px' },
          h('span', { id: 'zm-pace-label', style: 'font-weight:600' }, 'How fast turns play out'),
          h(
            'div',
            { class: 'zm-choice' },
            ...paces.map(([pace, label]) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'zm-button',
                  'aria-pressed': String(prefs.pace === pace),
                  onclick: () => update({ pace }),
                },
                label,
              ),
            ),
          ),
        ),
      ),
      h(
        'section',
        { class: 'zm-card zm-section', 'aria-labelledby': 'zm-settings-coat' },
        h('h2', { id: 'zm-settings-coat' }, 'Your coat'),
        h('p', {}, `Stars from the House earn new coats. You have ${stars}.`),
        h(
          'div',
          { class: 'zm-choice' },
          ...COATS.map((coat) => {
            const open = stars >= coat.stars;
            return h(
              'button',
              {
                type: 'button',
                class: 'zm-coat',
                disabled: !open,
                'aria-pressed': String(prefs.coat === coat.id),
                onclick: () => update({ coat: coat.id }),
                dataset: { testid: `zm-coat-${coat.id}` },
              },
              iconCanvas('cat', app.look, coat, 64, 64),
              h('span', {}, coat.name),
              h(
                'span',
                { class: 'zm-ladder__note' },
                open ? (prefs.coat === coat.id ? 'Wearing' : 'Ready') : `${coat.stars} stars`,
              ),
            );
          }),
        ),
      ),
      h(
        'section',
        { class: 'zm-card zm-section', 'aria-labelledby': 'zm-settings-more' },
        h('h2', { id: 'zm-settings-more' }, 'More'),
        h('p', {}, 'Sound, motion, light or dark, and key bindings are in the Hall’s settings.'),
        h(
          'div',
          { class: 'zm-dialog__buttons' },
          h(
            'button',
            { type: 'button', class: 'zm-button', onclick: () => app.context.openSettings() },
            'Open the Hall’s settings',
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'zm-button zm-button--quiet',
              onclick: () =>
                void app.context.forgetData().then((forgot) => forgot && app.go.title()),
              dataset: { testid: 'zm-forget' },
            },
            'Forget my Zoomies saves',
          ),
        ),
      ),
    );
  }

  render();
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
    {
      class: 'zm-screen',
      'aria-labelledby': 'zm-settings-title',
      dataset: { testid: 'zm-settings' },
    },
    h(
      'div',
      { class: 'zm-page' },
      h(
        'div',
        { class: 'zm-page__head' },
        back,
        h('h1', { class: 'zm-page__title', id: 'zm-settings-title' }, 'Settings'),
      ),
      body,
    ),
  );
  return {
    element,
    focus: () => back.focus({ preventScroll: true }),
    onLook: () => render(),
    onKey(event) {
      if (event.key === 'Backspace') {
        app.go.title();
        return true;
      }
      return false;
    },
  };
}
