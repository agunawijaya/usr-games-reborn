import { emptyBook } from '../../engine/penalties';
import { lookName, type ThemeId } from '../../render/look';
import type { App, Screen, ScreenFactory } from '../app';
import { h } from '../dom';
import { choiceRow, page, themePreview } from './page';

/**
 * Picking a theme (on first launch, and any time in Settings) and the game's own settings. The
 * Hall's settings (appearance, sound, motion) are one button away.
 */

function themeCards(app: App, onPicked: (theme: ThemeId) => void): HTMLElement {
  const themes: { id: ThemeId; name: string; note: string }[] = [
    { id: 'sprint', name: 'Sprint', note: 'A running track: every right answer is a stride.' },
    { id: 'atom', name: 'Atom', note: 'A lab: every number is a molecule of prime atoms.' },
  ];
  const current = app.saves.prefs.load().theme;
  return h(
    'div',
    { class: 'ns-themes', role: 'radiogroup', 'aria-label': 'Theme' },
    ...themes.map((theme) =>
      h(
        'button',
        {
          class: 'ns-theme',
          type: 'button',
          role: 'radio',
          'aria-checked': String(current === theme.id),
          'data-testid': `ns-theme-${theme.id}`,
          onclick: () => onPicked(theme.id),
        },
        themePreview(theme.id, app.look.dark, 384, 216),
        h('span', { class: 'ns-theme__name' }, theme.name),
        h(
          'span',
          { class: 'ns-muted' },
          `${lookName({ theme: theme.id, dark: app.look.dark })} · ${theme.note}`,
        ),
      ),
    ),
  );
}

export const pickThemeScreen: ScreenFactory = (app: App): Screen => {
  const { root, layout, back } = page(
    app,
    'Pick your look',
    [
      h(
        'p',
        { class: 'ns-muted' },
        'Same game, same rules, two worlds. You can change it any time in Settings.',
      ),
      themeCards(app, (theme) => {
        app.setTheme(theme);
        app.go.menu();
      }),
    ],
    'ns-pick',
  );
  back.hidden = app.saves.prefs.load().theme === null;
  app.setScene({ kind: 'ready' });
  return {
    element: root,
    layout: 'menu',
    onTitle: true,
    onLayout: layout,
    onKey(event) {
      if (event.key === '1' || event.key === '2') {
        app.setTheme(event.key === '1' ? 'sprint' : 'atom');
        app.go.menu();
        return true;
      }
      return false;
    },
    focus: () => root.querySelector<HTMLElement>('.ns-theme')?.focus(),
  };
};

export const settingsScreen: ScreenFactory = (app: App): Screen => {
  const prefs = app.saves.prefs.load();
  const note = h('p', { class: 'ns-muted', role: 'status' });
  const refresh = () => app.go.settings();
  const resetTutor = h(
    'button',
    {
      class: 'ns-button',
      type: 'button',
      onclick: () => {
        if (resetTutor.dataset.armed === 'yes') {
          app.saves.tutor.save({ book: emptyBook() });
          note.textContent = 'The tutor starts afresh: no numbers in training.';
          resetTutor.dataset.armed = '';
          resetTutor.textContent = 'Start the tutor afresh';
        } else {
          resetTutor.dataset.armed = 'yes';
          resetTutor.textContent = 'Press again to clear every number in training';
        }
      },
    },
    'Start the tutor afresh',
  );
  const { root, layout } = page(
    app,
    'Settings',
    [
      h('span', { class: 'ns-label' }, 'Theme'),
      themeCards(app, (theme) => {
        app.setTheme(theme);
        refresh();
      }),
      choiceRow(
        'Tempo for the campaign and free play',
        [
          { value: 'rush', text: 'Rush', note: 'Against the clock; speed adds points' },
          { value: 'calm', text: 'Calm', note: 'No clock; accuracy only' },
        ],
        prefs.tempo,
        (tempo) => app.saves.prefs.update((p) => ({ ...p, tempo })),
      ),
      choiceRow(
        'On-screen number keys',
        [
          { value: 'show', text: 'Show' },
          { value: 'hide', text: 'Hide', note: 'For keyboard players' },
        ],
        prefs.keys ? 'show' : 'hide',
        (value) => app.saves.prefs.update((p) => ({ ...p, keys: value === 'show' })),
      ),
      h(
        'div',
        { class: 'ns-links' },
        h(
          'button',
          { class: 'ns-button', type: 'button', onclick: () => app.context.openSettings() },
          'Appearance, sound and motion',
        ),
        resetTutor,
        h(
          'button',
          {
            class: 'ns-button',
            type: 'button',
            onclick: async () => {
              if (await app.context.forgetData()) app.go.pickTheme();
            },
          },
          'Forget my data',
        ),
      ),
      note,
    ],
    'ns-settings',
  );
  app.setScene({ kind: 'ready' });
  return {
    element: root,
    layout: 'menu',
    onLayout: layout,
    focus: () => root.querySelector<HTMLElement>('.ns-theme')?.focus(),
  };
};
