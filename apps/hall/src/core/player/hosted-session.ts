import { type BridgeHost, createBridgeHost } from '@usr-games/bridge/host';
import {
  type AppearancePayload,
  BRIDGE_VERSION,
  type BridgeSettings,
  type HelloPayload,
} from '@usr-games/bridge/protocol';
import { paletteOf, tokensToCss } from '@usr-games/kit';
import type { HallSnapshot } from '../../store/hall-store';
import { h } from '../../ui/h';
import { rememberGamePoster } from '../art/art';
import { tokensFor } from '../palette';
import { hallLink, keyCap, labelNodes } from './chrome';
import type { Session, SessionOptions } from './native-session';
import { confirmDialog } from './overlays';
import { announcements, packageLookup } from './receipt';
import { createToasts } from './toasts';
import { LABELS } from './wording';

/**
 * Runs a hosted game: its own page in a full-screen frame, talking to the Hall over the bridge.
 * The game draws its own menus and results; the Hall adds a slim strip along the top with the
 * way out, which tucks itself away during play and comes back on hover or keyboard focus.
 */

const STRIP_LINGER_MS = 2_500;

export function appearancePayload(snapshot: HallSnapshot): AppearancePayload {
  const theme = paletteOf(snapshot.settings);
  const tokens = tokensFor({
    theme,
    appearance: snapshot.appearance,
    colorBlindPalette: snapshot.settings.colorBlindPalette,
  });
  return {
    appearance: snapshot.appearance,
    theme,
    tokens: tokensToCss(tokens),
    reducedMotion: snapshot.reducedMotion,
  };
}

export function bridgeSettings(snapshot: HallSnapshot): BridgeSettings {
  const { volume, muted, colorBlindPalette, language } = snapshot.settings;
  return { volume, muted, reducedMotion: snapshot.reducedMotion, colorBlindPalette, language };
}

export function helloFor(gameId: string, snapshot: HallSnapshot): HelloPayload {
  const { appearance, theme, tokens } = appearancePayload(snapshot);
  return {
    version: BRIDGE_VERSION,
    gameId,
    appearance,
    theme,
    tokens,
    settings: bridgeSettings(snapshot),
  };
}

export function startHostedSession(options: SessionOptions & { frameUrl: string }): Session {
  const { entry, store, wording } = options;
  const gameId = entry.manifest.id;
  const lookup = packageLookup(store.catalog);

  let onTitle = false;
  let pointerOnStrip = false;
  let lingerTimer: ReturnType<typeof setTimeout> | undefined;
  let confirming: { close(): void } | null = null;
  let destroyed = false;

  const frame = h('iframe', {
    class: 'pl-frame',
    title: entry.manifest.title,
    src: options.frameUrl,
    allow: 'fullscreen; gamepad',
    dataset: { testid: 'pl-frame' },
  });
  const hint = h(
    'p',
    { class: 'pl-strip__hint', hidden: true },
    keyCap('Esc'),
    ' back to the Hall',
  );
  const menuButton = h(
    'button',
    {
      type: 'button',
      class: 'pl-button pl-button--quiet',
      dataset: { testid: 'pl-strip-menu' },
      onclick: () => void toGameMenu(),
    },
    labelNodes(LABELS.gameMenu),
  );
  const strip = h(
    'header',
    { class: 'pl-strip', dataset: { testid: 'pl-strip' } },
    h(
      'p',
      { class: 'pl-strip__title' },
      wording === 'unix' ? h('span', { class: 'pl-strip__pid' }, `${gameId} ·`) : null,
      h('span', null, entry.manifest.title),
    ),
    hint,
    h(
      'nav',
      { class: 'pl-strip__actions', 'aria-label': 'Leave the game' },
      menuButton,
      hallLink('pl-strip__hall', () => options.leave()),
    ),
  );
  // The frame swallows pointer events, so a thin zone above it notices the pointer arriving.
  const hotZone = h('div', { class: 'pl-hotzone', 'aria-hidden': 'true' });
  const layer = h('div', { class: 'pl-layer' });
  const toasts = createToasts({ persist: options.frozen });
  const element = h(
    'main',
    {
      id: 'screen',
      class: 'pl-page pl-page--hosted is-strip-open',
      'aria-label': entry.manifest.title,
      dataset: { game: gameId },
    },
    hotZone,
    strip,
    frame,
    layer,
    toasts.element,
  );

  function stripWanted(): boolean {
    return onTitle || pointerOnStrip || strip.contains(document.activeElement) || !!confirming;
  }

  function showStrip() {
    clearTimeout(lingerTimer);
    element.classList.add('is-strip-open');
  }

  function tuckStripSoon() {
    clearTimeout(lingerTimer);
    if (options.frozen) return;
    lingerTimer = setTimeout(() => {
      if (!stripWanted()) element.classList.remove('is-strip-open');
    }, STRIP_LINGER_MS);
  }

  function setTitleScreen(active: boolean) {
    onTitle = active;
    hint.hidden = !active;
    element.classList.toggle('is-on-title', active);
    if (active) showStrip();
    else tuckStripSoon();
  }

  function focusFrame() {
    frame.focus({ preventScroll: true });
    frame.contentWindow?.focus();
  }

  function reloadGame() {
    setTitleScreen(false);
    try {
      frame.contentWindow?.location.reload();
    } catch {
      frame.src = options.frameUrl;
    }
    focusFrame();
  }

  /** Mid-round, Game menu asks first; the game's own title screen reloads straight away. */
  async function toGameMenu() {
    if (!onTitle) {
      const dialog = confirmDialog(layer, {
        title: 'Leave this round?',
        body: 'Your progress in it will be lost.',
        cancel: 'Keep playing',
        confirm: 'Leave',
      });
      confirming = dialog;
      const confirmed = await dialog.result;
      confirming = null;
      if (destroyed) return;
      if (!confirmed) {
        focusFrame();
        tuckStripSoon();
        return;
      }
    }
    reloadGame();
  }

  const host: BridgeHost = createBridgeHost({
    iframe: frame,
    gameId,
    hello: () => helloFor(gameId, store.snapshot()),
    onReady: () => {
      if (!strip.contains(document.activeElement) && !confirming) focusFrame();
    },
    onResult: (payload) => {
      const update = store.reportResult(gameId, { ...payload, presentation: 'game' });
      toasts.show(announcements(update, wording, lookup));
    },
    onAchievement: (id) => {
      const update = store.installPackage(gameId, id);
      if (update && update.packagesInstalled.length > 0)
        toasts.show(announcements(update, wording, lookup));
    },
    onNavigate: (to) => {
      if (to === 'hall') options.leave();
      else reloadGame();
    },
    onTitleScreen: setTitleScreen,
    onPoster: (poster) => rememberGamePoster(gameId, poster.image),
  });

  const stopStore = store.subscribe((snapshot, change) => {
    if (change !== 'settings' && change !== 'reset') return;
    host.sendAppearance(appearancePayload(snapshot));
    host.sendSettings(bridgeSettings(snapshot));
  });

  function onVisibility() {
    if (document.hidden) host.pause();
    else host.resume();
  }

  // Focus sits on the strip here; inside the frame, the bridge handles Escape itself.
  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented || confirming) return;
    event.preventDefault();
    if (onTitle) options.leave();
    else focusFrame();
  }

  hotZone.addEventListener('pointerenter', showStrip);
  strip.addEventListener('pointerenter', () => {
    pointerOnStrip = true;
    showStrip();
  });
  strip.addEventListener('pointerleave', () => {
    pointerOnStrip = false;
    tuckStripSoon();
  });
  strip.addEventListener('focusin', showStrip);
  strip.addEventListener('focusout', tuckStripSoon);
  frame.addEventListener('load', () => {
    if (!strip.contains(document.activeElement) && !confirming) focusFrame();
  });
  window.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', onVisibility);
  tuckStripSoon();

  return {
    element,
    destroy() {
      destroyed = true;
      clearTimeout(lingerTimer);
      confirming?.close();
      host.destroy();
      stopStore();
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
      toasts.destroy();
      element.remove();
    },
  };
}
