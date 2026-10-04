import type { GameInstance, GameResult, PauseMenuItem } from '@usr-games/kit';
import type { ProgressionUpdate } from '@usr-games/kit/progression';
import type { CatalogEntry } from '../../catalog/catalog';
import type { HallStore } from '../../store/hall-store';
import { h } from '../../ui/h';
import { playSound } from '../sound';
import { hallLink, hasModifier, isTyping, keyCap } from './chrome';
import { type ContextHandle, type ContextHooks, createGameContext } from './context';
import { playerIcon } from './icons';
import { type PauseEntry, type ResultsAction, resultsActionForKey } from './menu';
import { confirmDialog } from './overlays';
import { type PauseSheet, pauseSheet, type PauseView } from './pause-menu';
import { announcements, packageLookup } from './receipt';
import { type ResultsSheet, resultsSheet } from './results';
import { createToasts } from './toasts';
import { LABELS, type Wording } from './wording';

/**
 * Runs a native game: mounts its module on a full-page stage with a GameContext, and wraps it
 * in the Hall's pause menu, results screen and XP toasts. Escape pauses; on the game's own
 * title screen it goes back to the Hall instead, and only "← Back to the Hall" shows there: the
 * Pause pill belongs to play. The pill and the toasts keep to the safe zones a native game
 * leaves free (see `player.css` and docs/ARCHITECTURE.md).
 */

export interface SessionOptions {
  entry: CatalogEntry;
  store: HallStore;
  wording: Wording;
  /** Keeps toasts on screen for screenshot scenes. */
  frozen: boolean;
  leave(): void;
}

export interface Session {
  element: HTMLElement;
  destroy(): void;
}

const LEAVE_ROUND = {
  title: 'Leave this round?',
  body: 'Your progress in it will be lost.',
  cancel: 'Keep playing',
  confirm: 'Leave',
};

export function startNativeSession(options: SessionOptions): Session {
  const { entry, store, wording } = options;
  const lookup = packageLookup(store.catalog);

  const stage = h('div', { class: 'pl-stage', tabindex: '-1', dataset: { testid: 'pl-stage' } });
  const corner = hallLink('pl-corner', () => options.leave(), 'Esc');
  const pauseHint = keyCap('Esc');
  const pauseButton = h(
    'button',
    {
      type: 'button',
      class: 'pl-button pl-pause',
      'aria-keyshortcuts': 'Escape',
      dataset: { testid: 'pl-pause-button' },
      onclick: () => pause('menu'),
    },
    playerIcon('pause'),
    h('span', { class: 'pl-pause__label' }, LABELS.pause),
    pauseHint,
  );
  const chrome = h('div', { class: 'pl-chrome' }, corner, pauseButton);
  const layer = h('div', { class: 'pl-layer' });
  const toasts = createToasts({ persist: options.frozen });
  const element = h(
    'main',
    {
      id: 'screen',
      class: 'pl-page pl-page--native',
      'aria-label': entry.manifest.title,
      dataset: { game: entry.manifest.id },
    },
    stage,
    chrome,
    layer,
    toasts.element,
  );

  let instance: GameInstance | null = null;
  let handle: ContextHandle | null = null;
  let gameItems: readonly PauseMenuItem[] = [];
  let onTitle = false;
  let paused: PauseSheet | null = null;
  let results: ResultsSheet | null = null;
  let leaving: { close(): void } | null = null;
  let returnFocus: HTMLElement | null = null;
  let mountTicket = 0;
  let destroyed = false;

  function updateChrome() {
    const overlayOpen = Boolean(paused || results);
    element.classList.toggle('is-on-title', onTitle);
    element.classList.toggle('has-overlay', overlayOpen);
    corner.hidden = !onTitle;
    // A game's own menu has nothing to pause: there the way out is the only chrome.
    pauseButton.hidden = onTitle;
    // Behind a dialog the game and its buttons are out of reach, for pointers and focus alike.
    stage.inert = overlayOpen;
    chrome.inert = overlayOpen;
  }

  function focusGame() {
    const target =
      returnFocus && returnFocus.isConnected && stage.contains(returnFocus) ? returnFocus : stage;
    returnFocus = null;
    target.focus({ preventScroll: true });
  }

  function hooksFor(ticket: number): ContextHooks {
    // A game unmounted by Game menu may still fire a late timer; only the live mount counts.
    const live = () => ticket === mountTicket && !destroyed;
    return {
      onResult(update, result) {
        if (!live()) return;
        if (result.presentation === 'hall') showResults(update, result);
        else toasts.show(announcements(update, wording, lookup));
      },
      onPackageInstalled(update) {
        if (live()) toasts.show(announcements(update, wording, lookup));
      },
      setPauseItems(items) {
        if (!live()) return;
        gameItems = [...items];
        paused?.setItems(gameItems);
      },
      setOnTitleScreen(value) {
        if (!live()) return;
        onTitle = value;
        updateChrome();
      },
      openSettings() {
        if (live()) pause('settings');
      },
      confirmForget: () =>
        confirmDialog(layer, {
          title: 'Forget this game’s saves?',
          body: 'Its saved games on this device will be removed. Your Hall progress stays.',
          cancel: 'Keep them',
          confirm: 'Forget',
        }).result,
      navigate(to) {
        if (!live()) return;
        if (to === 'hall') options.leave();
        else void mountGame();
      },
    };
  }

  function unmountGame() {
    instance?.unmount();
    instance = null;
    handle?.destroy();
    handle = null;
  }

  async function mountGame() {
    const ticket = ++mountTicket;
    closeOverlays();
    unmountGame();
    stage.replaceChildren();
    gameItems = [];
    onTitle = false;
    updateChrome();
    const context = createGameContext(entry.manifest, store, hooksFor(ticket));
    handle = context;
    try {
      const module = await entry.loadModule?.();
      if (!module) throw new Error(`No module for ${entry.manifest.id}`);
      const mounted = await module.mount(stage, context.context);
      if (ticket !== mountTicket || destroyed) {
        mounted.unmount();
        context.destroy();
        return;
      }
      instance = mounted;
      if (!element.contains(document.activeElement)) focusGame();
    } catch (error) {
      if (ticket !== mountTicket || destroyed) return;
      console.error(`The player could not start ${entry.manifest.id}.`, error);
      stage.replaceChildren(
        h(
          'div',
          { class: 'pl-failure', role: 'alert' },
          h('p', null, `${entry.manifest.title} could not start. Try again from the Hall.`),
          hallLink('pl-failure__link', () => options.leave()),
        ),
      );
      onTitle = true;
      updateChrome();
    }
  }

  function closeOverlays() {
    leaving?.close();
    leaving = null;
    paused?.destroy();
    paused = null;
    results?.destroy();
    results = null;
    updateChrome();
  }

  function pause(view: PauseView) {
    if (paused || results) return;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    handle?.firePause();
    paused = pauseSheet({
      entry,
      store,
      wording,
      items: gameItems,
      view,
      onChoose: choosePauseEntry,
      onResume: resume,
    });
    layer.append(paused.element);
    updateChrome();
    paused.focus();
    playSound(store, 'select');
  }

  function resume() {
    if (!paused) return;
    playSound(store, 'back');
    closeOverlays();
    handle?.fireResume();
    focusGame();
  }

  function choosePauseEntry(item: PauseEntry) {
    switch (item.kind) {
      case 'resume':
        resume();
        break;
      case 'game':
        resume();
        item.run?.();
        break;
      case 'game-menu':
      case 'hall':
        void leaveRound(item.kind);
        break;
      default:
        break;
    }
  }

  /** Leaving mid-round asks first; from the title screen or a finished round it just goes. */
  async function leaveRound(target: 'game-menu' | 'hall') {
    if (!onTitle && !results) {
      const dialog = confirmDialog(layer, LEAVE_ROUND);
      leaving = dialog;
      const confirmed = await dialog.result;
      leaving = null;
      if (!confirmed || destroyed) return;
    }
    if (target === 'hall') options.leave();
    else void mountGame();
  }

  function showResults(update: ProgressionUpdate, result: GameResult) {
    closeOverlays();
    results = resultsSheet({ entry, wording, result, update, lookup, onAction: chooseResult });
    layer.append(results.element);
    updateChrome();
    results.focus();
  }

  function chooseResult(action: ResultsAction) {
    playSound(store, action === 'play-again' ? 'select' : 'back');
    if (action === 'hall') {
      options.leave();
      return;
    }
    closeOverlays();
    const replay = instance?.playAgain;
    if (action === 'play-again' && instance && typeof replay === 'function') {
      replay.call(instance);
      focusGame();
    } else {
      void mountGame();
    }
  }

  /**
   * Registered before the game mounts, so it runs ahead of any window listener the game adds and
   * can keep keys meant for the Hall's dialogs away from the game underneath.
   */
  function onKeyDown(event: KeyboardEvent) {
    if (results || paused) event.stopImmediatePropagation();
    if (event.defaultPrevented) return;
    if (results) {
      const action = !hasModifier(event) && !event.repeat ? resultsActionForKey(event.key) : null;
      if (action) {
        event.preventDefault();
        chooseResult(action);
      }
      return;
    }
    if (paused) {
      if (event.key === 'Escape' && !leaving) {
        event.preventDefault();
        paused.back();
      }
      return;
    }
    if (event.key !== 'Escape' || event.repeat || isTyping(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (onTitle) options.leave();
    else pause('menu');
  }

  // A hidden tab mid-round pauses, so nobody comes back to a lost game.
  function onVisibility() {
    if (document.hidden && !onTitle && instance) pause('menu');
  }

  window.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', onVisibility);
  void mountGame();

  return {
    element,
    destroy() {
      destroyed = true;
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
      closeOverlays();
      unmountGame();
      toasts.destroy();
      element.remove();
    },
  };
}
