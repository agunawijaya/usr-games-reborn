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
import { keepGamePoster } from '../art/poster-shelf';
import { tokensFor } from '../palette';
import { hallLink, keyCap, labelNodes } from './chrome';
import { playerIcon } from './icons';
import type { Session, SessionOptions } from './native-session';
import { confirmDialog } from './overlays';
import { announcements, packageLookup } from './receipt';
import { createToasts } from './toasts';
import { LABELS } from './wording';

/**
 * Runs a hosted game: its own page in a frame, talking to the Hall over the bridge. The game
 * draws its own menus and results. Above it the Hall keeps a slim strip with the ways out and
 * the Hall's mute, always in view: the frame is laid out below the strip, so it never covers
 * the game's own top bar, and the game never changes size while it runs.
 */

/** Why the Hall is holding the game still: its tab is hidden, or it is asking the player. */
type PauseReason = 'hidden' | 'asking';

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

/** The Hall's mute as a toggle on the strip; it silences the Hall and the game alike. */
function muteToggle(options: Pick<SessionOptions, 'store'>) {
  const { store } = options;
  const button = h('button', {
    type: 'button',
    class: 'pl-button pl-button--quiet pl-strip__mute',
    'aria-label': 'Mute',
    title: 'Mute the Hall and this game',
    dataset: { testid: 'pl-strip-mute' },
    onclick: () => store.settings.update({ muted: !store.snapshot().settings.muted }),
  });
  const show = (muted: boolean) => {
    button.setAttribute('aria-pressed', String(muted));
    button.replaceChildren(playerIcon(muted ? 'muted' : 'sound'));
  };
  show(store.snapshot().settings.muted);
  return { element: button, show };
}

export function startHostedSession(options: SessionOptions & { frameUrl: string }): Session {
  const { entry, store, wording } = options;
  const gameId = entry.manifest.id;
  const lookup = packageLookup(store.catalog);

  let onTitle = false;
  let confirming: { close(): void } | null = null;
  let destroyed = false;
  const pauseReasons = new Set<PauseReason>();

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
  const mute = muteToggle({ store });
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
      mute.element,
      menuButton,
      hallLink('pl-strip__hall', () => options.leave()),
    ),
  );
  const layer = h('div', { class: 'pl-layer' });
  const toasts = createToasts({ persist: options.frozen });
  const element = h(
    'main',
    {
      id: 'screen',
      class: 'pl-page pl-page--hosted',
      'aria-label': entry.manifest.title,
      dataset: { game: gameId },
    },
    strip,
    frame,
    layer,
    toasts.element,
  );

  function setTitleScreen(active: boolean) {
    onTitle = active;
    hint.hidden = !active;
    element.classList.toggle('is-on-title', active);
  }

  function focusFrame() {
    frame.focus({ preventScroll: true });
    frame.contentWindow?.focus();
  }

  function holdGame(reason: PauseReason, held: boolean) {
    const wasPaused = pauseReasons.size > 0;
    if (held) pauseReasons.add(reason);
    else pauseReasons.delete(reason);
    const paused = pauseReasons.size > 0;
    if (paused === wasPaused) return;
    if (paused) host.pause();
    else host.resume();
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

  /** Mid-round, Game menu asks first (holding the game still); its title screen reloads at once. */
  async function toGameMenu() {
    if (!onTitle) {
      const dialog = confirmDialog(layer, {
        title: 'Leave this round?',
        body: 'Your progress in it will be lost.',
        cancel: 'Keep playing',
        confirm: 'Leave',
      });
      confirming = dialog;
      holdGame('asking', true);
      const confirmed = await dialog.result;
      confirming = null;
      if (destroyed) return;
      holdGame('asking', false);
      if (!confirmed) {
        focusFrame();
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
    onPoster: (poster) => keepGamePoster(store.storage, gameId, poster.image),
  });

  const stopStore = store.subscribe((snapshot, change) => {
    if (change !== 'settings' && change !== 'reset') return;
    mute.show(snapshot.settings.muted);
    host.sendAppearance(appearancePayload(snapshot));
    host.sendSettings(bridgeSettings(snapshot));
  });

  function onVisibility() {
    holdGame('hidden', document.hidden);
  }

  // Focus sits on the strip here; inside the frame, the bridge handles Escape itself.
  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented || confirming) return;
    event.preventDefault();
    if (onTitle) options.leave();
    else focusFrame();
  }

  frame.addEventListener('load', () => {
    if (!strip.contains(document.activeElement) && !confirming) focusFrame();
  });
  window.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    element,
    destroy() {
      destroyed = true;
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
