import '@fontsource-variable/bricolage-grotesque/wght.css';
import './login.css';
import { validateUsername } from '@usr-games/kit';
import { applyTheme } from '../core/palette';
import { playSound } from '../core/sound';
import type { StyleDeps, StyleModule } from '../core/style-module';
import { h, mount } from '../ui/h';
import { icon } from '../ui/icons';

/**
 * The first visit: a short, friendly boot sequence that ends at `login:`, then a name (or
 * "Play as guest"). It belongs to no style yet, so it borrows Console Home's calm palette; the
 * style picker comes right after.
 */

const BOOT_LINES = [
  'found 30 games in /usr/games',
  'warming up the machine room',
  'tuning the console',
  'polishing the holo cards',
];
const BOOT_MS = 3000;
const ESC_HINT = 'esc-menu';

function bootLog(): HTMLElement {
  return h(
    'ol',
    { class: 'lg-boot', 'aria-hidden': 'true' },
    h(
      'li',
      { class: 'lg-boot__line lg-boot__line--title', style: { '--lg-line': '0' } },
      '/usr/games Reborn',
    ),
    BOOT_LINES.map((line, index) =>
      h(
        'li',
        { class: 'lg-boot__line', style: { '--lg-line': String(index + 1) } },
        h('span', { class: 'lg-boot__ok' }, '[ ok ]'),
        ` ${line}`,
      ),
    ),
    h(
      'li',
      {
        class: 'lg-boot__line lg-boot__line--ready',
        style: { '--lg-line': String(BOOT_LINES.length + 1) },
      },
      'ready.',
    ),
  );
}

function loginForm(deps: StyleDeps, onFirstGesture: () => void): HTMLElement {
  const { store } = deps;
  const error = h('p', { class: 'lg-error', id: 'lg-error', role: 'alert' });
  const input = h('input', {
    id: 'lg-name',
    class: 'lg-input',
    type: 'text',
    name: 'username',
    autocomplete: 'nickname',
    autocapitalize: 'none',
    spellcheck: false,
    maxLength: 24,
    'aria-describedby': 'lg-rules lg-error',
    onkeydown: () => {
      onFirstGesture();
      playSound(store, 'keyClick');
    },
  });
  const submit = (event: Event) => {
    event.preventDefault();
    onFirstGesture();
    const check = validateUsername(input.value);
    if (!check.ok) {
      error.textContent = check.reason;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      playSound(store, 'back');
      return;
    }
    playSound(store, 'select');
    store.login(check.name);
  };
  return h(
    'form',
    { class: 'lg-form', onsubmit: submit, novalidate: true },
    h(
      'p',
      { class: 'lg-prompt', 'aria-hidden': 'true' },
      'login:',
      h('span', { class: 'lg-cursor' }),
    ),
    h('h1', { class: 'lg-title', id: 'lg-title' }, 'What should we call you?'),
    h(
      'p',
      { class: 'lg-lede' },
      'Your name stays in this browser. It becomes your profile here: your level, your achievements, your home.',
    ),
    h(
      'div',
      { class: 'lg-field' },
      h('label', { class: 'lg-label', for: 'lg-name' }, 'Your name'),
      input,
      h(
        'p',
        { class: 'lg-rules', id: 'lg-rules' },
        '2 to 16 letters or numbers; dashes and underscores are fine.',
      ),
      error,
    ),
    h(
      'div',
      { class: 'lg-actions' },
      h(
        'button',
        { type: 'submit', class: 'lg-button lg-button--primary' },
        h('span', null, 'Continue'),
        icon('run'),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'lg-button lg-button--quiet',
          onclick: () => {
            onFirstGesture();
            playSound(store, 'select');
            store.login(null);
          },
        },
        'Play as guest',
      ),
    ),
  );
}

const login: Pick<StyleModule, 'start'> = {
  start(root, deps) {
    const { store } = deps;
    const html = document.documentElement;
    const snapshot = store.snapshot();
    applyTheme(html, {
      style: 'console',
      theme: 'console',
      appearance: snapshot.appearance,
      colorBlindPalette: snapshot.settings.colorBlindPalette,
      reducedMotion: snapshot.reducedMotion,
    });
    html.dataset.style = 'login';
    document.title = 'Log in · /usr/games Reborn';

    let hummed = false;
    const onFirstGesture = () => {
      if (hummed) return;
      hummed = true;
      // The boot hum waits for a gesture: browsers refuse sound before one.
      playSound(store, 'bootHum');
    };

    const form = loginForm(deps, onFirstGesture);
    const panel = h('section', { class: 'lg-panel', 'aria-labelledby': 'lg-title' }, form);
    const skip = h(
      'button',
      { type: 'button', class: 'lg-skip' },
      'Skip',
      h('kbd', null, 'any key'),
    );
    const page = h(
      'main',
      { id: 'screen', class: 'lg-page' },
      h('div', { class: 'lg-glow', 'aria-hidden': 'true' }),
      h(
        'p',
        { class: 'lg-brand' },
        icon('brand', 'icon lg-brand__mark'),
        h('span', null, '/usr/games'),
        h('b', null, 'Reborn'),
      ),
      h('div', { class: 'lg-stage' }, h('div', { class: 'lg-screen' }, bootLog(), skip), panel),
      h('p', { class: 'lg-tip' }, h('kbd', null, 'Esc'), ' pauses any game and opens its menu.'),
    );
    mount(root, page);
    if (!snapshot.profile.hintsSeen.includes(ESC_HINT)) store.markHintSeen(ESC_HINT);

    let finished = false;
    const finishBoot = () => {
      if (finished) return;
      finished = true;
      page.classList.add('is-booted');
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
      document.querySelector<HTMLInputElement>('#lg-name')?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      onFirstGesture();
      event.preventDefault();
      finishBoot();
    };
    const onPointer = () => {
      onFirstGesture();
      finishBoot();
    };
    skip.addEventListener('click', finishBoot);

    const instant = snapshot.reducedMotion || html.dataset.frozen === 'true';
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (instant) finishBoot();
    else {
      page.classList.add('is-booting');
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('pointerdown', onPointer, true);
      timer = setTimeout(finishBoot, BOOT_MS);
    }

    return {
      destroy() {
        clearTimeout(timer);
        window.removeEventListener('keydown', onKey, true);
        window.removeEventListener('pointerdown', onPointer, true);
        root.replaceChildren();
      },
    };
  },
};

export default login;
