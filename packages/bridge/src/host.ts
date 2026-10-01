import {
  type AppearancePayload,
  type BridgeSettings,
  type HallMessage,
  hallMessage,
  type HelloPayload,
  type NavigateTarget,
  parseGameMessage,
  type PosterPayload,
  type ResultPayload,
} from './protocol';

/**
 * The Hall side of the bridge: one host per hosted-game frame. It answers every `ready` with a
 * fresh `hello` (so a reloaded frame gets the current appearance and settings), forwards later
 * changes, and turns validated game messages into callbacks.
 */

export interface BridgeHostOptions {
  iframe: HTMLIFrameElement;
  gameId: string;
  /** Builds the hello from the Hall's current state; called on every `ready`. */
  hello: () => HelloPayload;
  /** The only origin messages are accepted from and sent to. Defaults to the Hall's own. */
  origin?: string;
  /** Stand-in window for tests; defaults to the real one. */
  window?: Window;
  onReady?: () => void;
  onResult?: (result: ResultPayload) => void;
  onAchievement?: (id: string) => void;
  onNavigate?: (to: NavigateTarget) => void;
  /** The host already replies with `settings-changed`; this is for anything extra. */
  onRequestSettings?: () => void;
  onTitleScreen?: (active: boolean) => void;
  /** Key art the game drew of itself, already validated as an inline PNG, JPEG or WebP. */
  onPoster?: (poster: PosterPayload) => void;
}

export interface BridgeHost {
  sendAppearance(appearance: AppearancePayload): void;
  sendSettings(settings: BridgeSettings): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

export function createBridgeHost(options: BridgeHostOptions): BridgeHost {
  const win = options.window ?? window;
  const origin = options.origin ?? win.location.origin;
  // Until the game has said `ready`, the frame may still hold about:blank; anything sent then
  // would be lost, and the next hello carries the current state anyway.
  let gameReady = false;
  let paused = false;
  let destroyed = false;

  function send(message: HallMessage) {
    const target = options.iframe.contentWindow;
    if (destroyed || !target) return;
    target.postMessage(message, origin);
  }

  function sendWhenReady(message: HallMessage) {
    if (gameReady) send(message);
  }

  function onMessage(event: MessageEvent) {
    const frameWindow = options.iframe.contentWindow;
    if (!frameWindow || event.source !== frameWindow || event.origin !== origin) return;
    const message = parseGameMessage(event.data);
    if (!message) return;
    switch (message.type) {
      case 'ready':
        if (message.payload.id !== options.gameId) {
          console.warn(
            `[bridge] Frame for "${options.gameId}" announced itself as "${message.payload.id}".`,
          );
          return;
        }
        gameReady = true;
        send(hallMessage('hello', options.hello()));
        if (paused) send(hallMessage('pause', {}));
        options.onReady?.();
        break;
      case 'result':
        options.onResult?.(message.payload);
        break;
      case 'achievement':
        options.onAchievement?.(message.payload.id);
        break;
      case 'navigate':
        options.onNavigate?.(message.payload.to);
        break;
      case 'request-settings':
        // The game just spoke, so its document is live even if it skipped `ready`.
        send(hallMessage('settings-changed', { settings: options.hello().settings }));
        options.onRequestSettings?.();
        break;
      case 'title-screen':
        options.onTitleScreen?.(message.payload.active);
        break;
      case 'poster':
        options.onPoster?.(message.payload);
        break;
    }
  }

  win.addEventListener('message', onMessage);

  return {
    sendAppearance: (appearance) => sendWhenReady(hallMessage('appearance-changed', appearance)),
    sendSettings: (settings) => sendWhenReady(hallMessage('settings-changed', { settings })),
    pause() {
      paused = true;
      sendWhenReady(hallMessage('pause', {}));
    },
    resume() {
      paused = false;
      sendWhenReady(hallMessage('resume', {}));
    },
    destroy() {
      destroyed = true;
      win.removeEventListener('message', onMessage);
    },
  };
}
