import './settings.css';
import {
  type AppearancePreference,
  describeCode,
  type MotionPreference,
  STYLE_IDS,
  type StyleId,
  THEME_IDS,
  THEMES,
  type ThemeId,
} from '@usr-games/kit';
import type { ControlBinding } from '@usr-games/kit/manifest';
import { type Cosmetic, COSMETICS, firstLevelOfRank, isUnlocked } from '@usr-games/kit/progression';
import type { HallStore } from '../../../store/hall-store';
import { type Child, h, mount } from '../../../ui/h';
import { playSound } from '../../sound';
import { STYLE_COPY } from '../../style-module';

/**
 * The settings every style shows, as one shared panel: style, palette, appearance, sound, motion,
 * accessibility, controls, language and data. Styles place it in their own page; the player shows
 * a subset in its pause menu. Every control is a native form element, so keyboards and screen
 * readers get the behaviour they expect for free.
 */

export type SettingsSection =
  | 'style'
  | 'palette'
  | 'appearance'
  | 'sound'
  | 'motion'
  | 'accessibility'
  | 'controls'
  | 'language'
  | 'data';

export const ALL_SECTIONS: readonly SettingsSection[] = [
  'style',
  'palette',
  'appearance',
  'sound',
  'motion',
  'accessibility',
  'controls',
  'language',
  'data',
];

export interface SettingsPanelOptions {
  store: HallStore;
  /** Machine Room keeps its Unix flavour; the other styles speak in plain words. */
  wording: 'plain' | 'unix';
  sections?: readonly SettingsSection[];
  /** Limit the controls section to one game (the player's pause menu). */
  gameId?: string;
  /** Called after "Forget my data" has wiped everything. */
  onForget?: () => void;
  /**
   * A picture for each choice of a section, drawn by the style in its own chrome (Console Home
   * shows its skins as swatches, Holo Collection its foils). It sits before the choice's label and
   * is decoration only: the label still names the choice.
   */
  choiceMedia?: Partial<Record<SettingsSection, (value: string) => Child>>;
}

export interface SettingsPanel {
  element: HTMLElement;
  destroy(): void;
}

type Wording = SettingsPanelOptions['wording'];

const TITLES: Record<SettingsSection, Record<Wording, string>> = {
  style: { plain: 'Style', unix: 'Style' },
  palette: { plain: 'Colour', unix: 'Palette' },
  appearance: { plain: 'Day or night', unix: 'Appearance' },
  sound: { plain: 'Sound', unix: 'Sound' },
  motion: { plain: 'Motion', unix: 'Motion' },
  accessibility: { plain: 'Accessibility', unix: 'Accessibility' },
  controls: { plain: 'Controls', unix: 'Key bindings' },
  language: { plain: 'Language', unix: 'Locale' },
  data: { plain: 'Your data', unix: 'Data' },
};

const APPEARANCE_LABELS: Record<Wording, Record<AppearancePreference, string>> = {
  plain: { light: 'Day', dark: 'Night', system: 'Auto' },
  unix: { light: 'Light', dark: 'Dark', system: 'System' },
};

const MOTION_LABELS: Record<MotionPreference, string> = {
  system: 'Match my device',
  reduce: 'Reduce motion',
  full: 'Full motion',
};

let panelCount = 0;

/**
 * A group of radio buttons drawn as segmented pills or cards. Most groups apply a choice at
 * once. A group with `confirm` is for choices that rebuild the whole Hall: arrow keys only move
 * the selection, and the player applies it with Enter or the button that appears; a click still
 * applies at once.
 */
function radioGroup<T extends string>(options: {
  name: string;
  legend: string;
  hint?: string;
  choices: {
    value: T;
    label: string;
    detail?: string;
    disabled?: boolean;
    note?: string;
    media?: Child;
  }[];
  selected: T;
  layout: 'pills' | 'cards';
  onChange: (value: T) => void;
  confirm?: (value: T) => string;
}): HTMLElement {
  const { confirm } = options;
  let arrowed = false;
  let pending: T | null = null;
  const apply = h('button', { type: 'button', class: 'set-apply', hidden: true });
  const propose = (value: T) => {
    pending = value === options.selected ? null : value;
    apply.hidden = pending === null;
    if (pending !== null && confirm) {
      apply.replaceChildren(confirm(pending), ' ', h('kbd', { class: 'set-kbd' }, 'Enter'));
    }
  };
  apply.addEventListener('click', () => {
    if (pending !== null) options.onChange(pending);
  });
  return h(
    'fieldset',
    { class: ['set-group', `set-group--${options.layout}`] },
    h('legend', { class: 'set-group__legend' }, options.legend),
    options.hint ? h('p', { class: 'set-hint' }, options.hint) : null,
    h(
      'div',
      { class: 'set-choices' },
      options.choices.map((choice) =>
        h(
          'label',
          {
            class: [
              'set-choice',
              choice.value === options.selected && 'is-selected',
              choice.disabled && 'is-locked',
            ],
          },
          h('input', {
            type: 'radio',
            class: 'set-radio',
            name: options.name,
            value: choice.value,
            checked: choice.value === options.selected,
            disabled: choice.disabled,
            onkeydown: (event: KeyboardEvent) => {
              if (!confirm) return;
              if (event.key.startsWith('Arrow')) arrowed = true;
              else if ((event.key === 'Enter' || event.key === ' ') && pending === choice.value) {
                event.preventDefault();
                options.onChange(choice.value);
              }
            },
            onkeyup: () => {
              arrowed = false;
            },
            onchange: () => {
              if (confirm && arrowed) propose(choice.value);
              else options.onChange(choice.value);
              arrowed = false;
            },
          }),
          choice.media
            ? h('span', { class: 'set-choice__media', 'aria-hidden': 'true' }, choice.media)
            : null,
          h('span', { class: 'set-choice__label' }, choice.label),
          choice.detail ? h('span', { class: 'set-choice__detail' }, choice.detail) : null,
          choice.note ? h('span', { class: 'set-choice__note' }, choice.note) : null,
        ),
      ),
    ),
    confirm ? apply : null,
  );
}

function toggle(options: {
  name: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return h(
    'label',
    { class: 'set-toggle' },
    h('input', {
      type: 'checkbox',
      role: 'switch',
      name: options.name,
      class: 'set-toggle__input',
      checked: options.checked,
      onchange: (event: Event) => options.onChange((event.target as HTMLInputElement).checked),
    }),
    h(
      'span',
      { class: 'set-toggle__track', 'aria-hidden': 'true' },
      h('span', { class: 'set-toggle__thumb' }),
    ),
    h(
      'span',
      { class: 'set-toggle__text' },
      h('span', { class: 'set-toggle__label' }, options.label),
      h('span', { class: 'set-hint' }, options.hint),
    ),
  );
}

function section(key: SettingsSection, wording: Wording, ...body: Child[]): HTMLElement {
  return h(
    'section',
    { class: ['set-section', `set-section--${key}`], dataset: { section: key } },
    h('h2', { class: 'set-section__title' }, TITLES[key][wording]),
    body,
  );
}

function unlockNote(cosmetic: Cosmetic, wording: Wording): string {
  if (!('rank' in cosmetic.source)) return 'Unlocks with an achievement';
  const rank = cosmetic.source.rank;
  return wording === 'plain'
    ? `Unlocks at Level ${firstLevelOfRank(rank)}`
    : `Unlocks at rank ${rank}`;
}

function paletteSection(
  store: HallStore,
  wording: Wording,
  name: string,
  media?: (value: string) => Child,
): HTMLElement {
  const { settings, progression, appearance } = store.snapshot();
  if (settings.style === 'machine-room') {
    return section(
      'palette',
      wording,
      radioGroup<ThemeId>({
        name,
        legend: 'The machine room’s palette',
        choices: THEME_IDS.map((id) => ({
          value: id,
          label: THEMES[id].name,
          detail: THEMES[id].mood[appearance],
        })),
        selected: settings.theme,
        layout: 'cards',
        onChange: (theme) => store.settings.update({ theme }),
      }),
    );
  }
  const kind = settings.style === 'console' ? 'skin' : 'finish';
  const key = kind === 'skin' ? 'consoleSkin' : 'holoFinish';
  const legend = kind === 'skin' ? 'Accent skin' : 'Foil finish';
  const hint =
    kind === 'skin'
      ? 'Skins tint the buttons and highlights; the games keep their own colours.'
      : 'Finishes change how the foil catches the light on every card.';
  const choices: {
    value: string;
    label: string;
    detail?: string;
    disabled?: boolean;
    note?: string;
    media?: Child;
  }[] = [
    { value: 'default', label: 'Standard' },
    ...COSMETICS.filter((c) => c.kind === kind).map((c) => {
      const unlocked = isUnlocked(c, progression);
      return {
        value: c.id,
        label: c.name.replace(/ (skin|foil)$/i, ''),
        detail: c.description,
        disabled: !unlocked,
        ...(unlocked ? {} : { note: unlockNote(c, wording) }),
      };
    }),
  ].map((choice) => (media ? { ...choice, media: media(choice.value) } : choice));
  const current = settings[key];
  const selected = choices.some((c) => c.value === current && !c.disabled) ? current : 'default';
  return section(
    'palette',
    wording,
    radioGroup({
      name,
      legend,
      hint,
      choices,
      selected,
      layout: 'cards',
      onChange: (value) => store.settings.update({ [key]: value }),
    }),
  );
}

/** Games that declare remappable controls, or just the one the player is running. */
function remappableGames(store: HallStore, gameId?: string) {
  return store.catalog.entries.filter(
    (entry) =>
      (entry.manifest.controls?.length ?? 0) > 0 &&
      (gameId ? entry.manifest.id === gameId : entry.manifest.status !== 'coming-soon'),
  );
}

function bindingFor(store: HallStore, gameId: string, control: ControlBinding): string[] {
  return store.settings.get().bindings[gameId]?.[control.action] ?? control.keys;
}

function controlsSection(
  store: HallStore,
  wording: Wording,
  gameId: string | undefined,
  onChange: () => void,
) {
  const games = remappableGames(store, gameId);
  if (games.length === 0) {
    return section(
      'controls',
      wording,
      h(
        'p',
        { class: 'set-hint' },
        'Games with keys you can change will list them here once they arrive.',
      ),
    );
  }
  return section(
    'controls',
    wording,
    h(
      'p',
      { class: 'set-hint' },
      'Choose Change, then press the key you want. Escape keeps the old one.',
    ),
    games.map((entry) => {
      const id = entry.manifest.id;
      const custom = Boolean(store.settings.get().bindings[id]);
      return h(
        'div',
        { class: 'set-controls' },
        h(
          'div',
          { class: 'set-controls__head' },
          h('h3', { class: 'set-controls__game' }, entry.manifest.title),
          custom
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'set-button set-button--quiet',
                  onclick: () => {
                    const { [id]: _removed, ...rest } = store.settings.get().bindings;
                    store.settings.update({ bindings: rest });
                    onChange();
                  },
                },
                'Reset to default',
              )
            : null,
        ),
        h(
          'ul',
          { class: 'set-controls__list' },
          (entry.manifest.controls ?? []).map((control) =>
            h(
              'li',
              { class: 'set-control' },
              h('span', { class: 'set-control__label' }, control.label),
              h(
                'span',
                { class: 'set-control__keys' },
                bindingFor(store, id, control).map((code) =>
                  h('kbd', { class: 'set-key' }, describeCode(code)),
                ),
              ),
              h(
                'button',
                {
                  type: 'button',
                  class: 'set-button',
                  'aria-label': `Change the key for ${control.label}`,
                  onclick: (event: Event) =>
                    captureKey(
                      event.currentTarget as HTMLButtonElement,
                      store,
                      id,
                      control,
                      onChange,
                    ),
                },
                'Change',
              ),
            ),
          ),
        ),
      );
    }),
  );
}

/** Waits for the next key press and binds it, or keeps the old binding on Escape. */
function captureKey(
  button: HTMLButtonElement,
  store: HallStore,
  gameId: string,
  control: ControlBinding,
  onChange: () => void,
) {
  button.textContent = 'Press a key…';
  button.classList.add('is-listening');
  const listen = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.removeEventListener('keydown', listen, true);
    if (event.code !== 'Escape' && event.code) {
      const bindings = store.settings.get().bindings;
      const forGame = { ...(bindings[gameId] ?? {}), [control.action]: [event.code] };
      store.settings.update({ bindings: { ...bindings, [gameId]: forGame } });
    }
    onChange();
  };
  window.addEventListener('keydown', listen, true);
}

function forgetDialog(store: HallStore, wording: Wording, onForget?: () => void): HTMLElement {
  const dialog = h(
    'dialog',
    { class: 'set-dialog', 'aria-labelledby': 'set-forget-title' },
    h('h2', { id: 'set-forget-title', class: 'set-dialog__title' }, 'Forget everything?'),
    h(
      'p',
      null,
      wording === 'plain'
        ? 'This removes your name, level, achievements, streak, settings and every game’s saves from this browser. It cannot be undone.'
        : 'This removes your home directory, rank, packages, uptime, settings and every game’s saves from this browser. It cannot be undone.',
    ),
    h(
      'form',
      { method: 'dialog', class: 'set-dialog__actions' },
      h('button', { class: 'set-button', value: 'keep', autofocus: true }, 'Keep my data'),
      h('button', { class: 'set-button set-button--danger', value: 'forget' }, 'Forget everything'),
    ),
  ) as HTMLDialogElement;
  dialog.addEventListener('close', () => {
    if (dialog.returnValue !== 'forget') return;
    store.forgetEverything();
    onForget?.();
  });
  return dialog;
}

function renderSections(options: SettingsPanelOptions, name: string, rerender: () => void): Node[] {
  const { store, wording } = options;
  const { settings } = store.snapshot();
  const sections = options.sections ?? ALL_SECTIONS;
  const built: Node[] = [];
  for (const key of sections) {
    switch (key) {
      case 'style':
        built.push(
          section(
            'style',
            wording,
            radioGroup<StyleId>({
              name: `${name}-style`,
              legend: 'How the Hall looks',
              hint: 'Your progress is the same in every style.',
              choices: STYLE_IDS.map((id) => ({
                value: id,
                label: STYLE_COPY[id].name,
                detail: STYLE_COPY[id].pitch,
              })),
              selected: settings.style,
              layout: 'cards',
              onChange: (style) => store.chooseStyle(style),
              confirm: (style) => `Switch to ${STYLE_COPY[style].name}`,
            }),
          ),
        );
        break;
      case 'palette':
        built.push(paletteSection(store, wording, `${name}-palette`, options.choiceMedia?.palette));
        break;
      case 'appearance':
        built.push(
          section(
            'appearance',
            wording,
            radioGroup<AppearancePreference>({
              name: `${name}-appearance`,
              legend: wording === 'plain' ? 'Colours for day or night' : 'Light or dark',
              choices: (['light', 'dark', 'system'] as const).map((value) => ({
                value,
                label: APPEARANCE_LABELS[wording][value],
              })),
              selected: settings.appearance,
              layout: 'pills',
              onChange: (appearance) => store.settings.update({ appearance }),
            }),
          ),
        );
        break;
      case 'sound':
        built.push(soundSection(options, name));
        break;
      case 'motion':
        built.push(
          section(
            'motion',
            wording,
            radioGroup<MotionPreference>({
              name: `${name}-motion`,
              legend: 'Animation',
              hint: 'Reduce motion swaps sweeping movement for gentle fades everywhere, games included.',
              choices: (['system', 'reduce', 'full'] as const).map((value) => ({
                value,
                label: MOTION_LABELS[value],
              })),
              selected: settings.motion,
              layout: 'pills',
              onChange: (motion) => store.settings.update({ motion }),
            }),
          ),
        );
        break;
      case 'accessibility':
        built.push(
          section(
            'accessibility',
            wording,
            toggle({
              name: `${name}-color-blind`,
              label: 'Colour-blind-safe palette',
              hint: 'Shows good and bad in blue and orange instead of green and red.',
              checked: settings.colorBlindPalette,
              onChange: (colorBlindPalette) => store.settings.update({ colorBlindPalette }),
            }),
          ),
        );
        break;
      case 'controls':
        built.push(controlsSection(store, wording, options.gameId, rerender));
        break;
      case 'language':
        built.push(
          section(
            'language',
            wording,
            h(
              'label',
              { class: 'set-field' },
              h('span', { class: 'set-field__label' }, 'Language'),
              h(
                'select',
                { class: 'set-select', disabled: true },
                h('option', { selected: true }, 'English'),
              ),
              h(
                'span',
                { class: 'set-hint' },
                'More languages can join later; English is the only one for now.',
              ),
            ),
          ),
        );
        break;
      case 'data': {
        const dialog = forgetDialog(store, wording, options.onForget);
        built.push(
          section(
            'data',
            wording,
            h(
              'p',
              { class: 'set-hint' },
              'Everything you do here stays in this browser. Nothing is sent anywhere.',
            ),
            h(
              'button',
              {
                type: 'button',
                class: 'set-button set-button--danger',
                onclick: () => (dialog as HTMLDialogElement).showModal(),
              },
              'Forget my data…',
            ),
            dialog,
          ),
        );
        break;
      }
    }
  }
  return built;
}

function soundSection(options: SettingsPanelOptions, name: string): HTMLElement {
  const { store, wording } = options;
  const { settings } = store.snapshot();
  const volumeId = `${name}-volume`;
  const percent = Math.round(settings.volume * 100);
  return section(
    'sound',
    wording,
    h(
      'div',
      { class: 'set-field' },
      h('label', { class: 'set-field__label', for: volumeId }, 'Volume'),
      h(
        'div',
        { class: 'set-range' },
        h('input', {
          id: volumeId,
          type: 'range',
          class: 'set-range__input',
          min: '0',
          max: '100',
          step: '5',
          value: String(percent),
          'aria-valuetext': `${percent} percent`,
          style: { '--set-fill': `${percent}%` },
          onchange: (event: Event) => {
            store.settings.update({
              volume: Number((event.target as HTMLInputElement).value) / 100,
            });
            playSound(store, 'select');
          },
          oninput: (event: Event) => {
            const input = event.target as HTMLInputElement;
            input.style.setProperty('--set-fill', `${input.value}%`);
          },
        }),
        h('output', { class: 'set-range__value', for: volumeId }, `${percent}%`),
      ),
    ),
    toggle({
      name: `${name}-mute`,
      label: 'Mute',
      hint: 'Silences the Hall and every game.',
      checked: settings.muted,
      onChange: (muted) => store.settings.update({ muted }),
    }),
  );
}

export function settingsPanel(options: SettingsPanelOptions): SettingsPanel {
  const name = `settings-${++panelCount}`;
  const element = h('div', { class: 'set-panel', dataset: { wording: options.wording } });

  function render() {
    // Keep keyboard focus on the same control across re-renders.
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active && element.contains(active) ? focusKeyOf(active) : null;
    mount(element, renderSections(options, name, render));
    if (focusKey) element.querySelector<HTMLElement>(focusKey)?.focus({ preventScroll: true });
  }

  render();
  const stop = options.store.subscribe((_, change) => {
    if (change === 'settings' || change === 'progression') render();
  });
  return { element, destroy: stop };
}

function focusKeyOf(element: HTMLElement): string | null {
  if (element instanceof HTMLInputElement && element.name) {
    return element.type === 'radio'
      ? `input[name="${element.name}"][value="${CSS.escape(element.value)}"]`
      : `input[name="${element.name}"]`;
  }
  if (element.id) return `#${CSS.escape(element.id)}`;
  return null;
}
