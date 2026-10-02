import {
  type AppearancePayload,
  type BridgeSettings,
  gameMessage,
  type GameMessage,
  type HelloPayload,
  type NavigateTarget,
  parseGameMessage,
  parseHallMessage,
  type ResultPayload,
  type ThemeTokenMap,
} from './protocol';

export { BRIDGE_PROTOCOL, BRIDGE_REVISION, BRIDGE_VERSION } from './protocol';

/**
 * The game side of the bridge. A hosted game calls `connectToHall` once at startup and then
 * reports what happens: results, achievements, navigation and whether it is on its own title
 * screen. Opened on its own (not inside the Hall), the same code keeps working: every call
 * becomes a quiet no-op, so a game never needs two code paths.
 */

/** The Hall's master sound, as a hosted game needs it. */
export interface SoundSettings {
  /** Master volume, 0–1. */
  volume: number;
  muted: boolean;
}

export interface ConnectOptions {
  /** The game's catalog id, e.g. `pom`. */
  id: string;
  onHello?: (hello: HelloPayload) => void;
  onAppearanceChange?: (appearance: AppearancePayload) => void;
  onSettingsChange?: (settings: BridgeSettings) => void;
  /**
   * The Hall's pause: its tab was hidden, or it is asking the player something over the game.
   * Stop the game's clocks and silence it until `onResume`.
   */
  onPause?: () => void;
  onResume?: () => void;
  /**
   * Since 1.1. The Hall's master volume and mute: once when the hello arrives, then whenever
   * either changes. Muted means silent, whatever the game's own switch says; `soundLevel` turns
   * the volume into a level for the game's own mixer.
   */
  onSound?: (sound: SoundSettings) => void;
  /**
   * Since 1.1. Whether the player wants reduced motion (the Hall's setting, or the system's when
   * they chose that): once when the hello arrives, then whenever it changes.
   */
  onReducedMotion?: (reduced: boolean) => void;
  /**
   * Since 1.1. Also pause while this page itself is hidden, folded together with the Hall's
   * pause: `onPause` when either begins, `onResume` once neither holds. It works when the game
   * runs on its own as well, so a background tab falls quiet either way.
   */
  pauseWhenHidden?: boolean;
  /**
   * Writes the Hall's theme tokens as CSS custom properties on the document root (plus
   * `data-ug-appearance`, `data-ug-theme` and `color-scheme`), for games that style themselves
   * with `var(--ug-…)`.
   */
  applyTokens?: boolean;
  /** Stand-in window for tests; defaults to the real one. */
  window?: Window;
}

export interface HallConnection {
  /** False when the game runs on its own, outside the Hall. */
  readonly hosted: boolean;
  /** The latest hello (with any later appearance or settings changes folded in), or null. */
  state(): HelloPayload | null;
  result(result: ResultPayload): void;
  achievement(id: string): void;
  navigate(to: NavigateTarget): void;
  /** Tell the Hall whether the game is on its own title screen; Escape there leaves the game. */
  setTitleScreen(active: boolean): void;
  requestSettings(): void;
  /**
   * Offer the Hall key art of the game: a data URL (PNG, JPEG or WebP) of a frame the game drew
   * itself, such as `canvas.toDataURL('image/webp', 0.8)` of its title screen.
   */
  poster(image: string, width: number, height: number): void;
  /**
   * Offer the Hall a still of a canvas the game has just drawn, scaled to at most
   * `POSTER_MAX_WIDTH` pixels wide and sent as WebP. Call it in the same task as the drawing
   * (right after the render call): a WebGL canvas may be cleared once the frame is shown.
   */
  posterFromCanvas(canvas: HTMLCanvasElement, quality?: number): void;
  disconnect(): void;
}

/** Key art wider than this is scaled down before sending: sharp on a hero, light to post. */
export const POSTER_MAX_WIDTH = 1280;
const POSTER_QUALITY = 0.82;

/** When the Hall has not answered yet, `ready` is repeated after these delays (milliseconds). */
export const READY_RETRY_DELAYS = [250, 500, 1000, 2000, 4000] as const;

/**
 * The Hall's starting master volume (the kit's default setting). At this volume a hosted game
 * sounds exactly as it was designed; the Hall's slider scales it from there.
 */
export const HALL_DEFAULT_VOLUME = 0.35;

/**
 * A level for the game's own mixer from the Hall's sound: silent when muted, `designed` (the
 * level the game would use on its own) at the Hall's default volume, scaled with the Hall's
 * slider and never above 1.
 */
export function soundLevel(sound: SoundSettings, designed = 1): number {
  if (sound.muted || sound.volume <= 0) return 0;
  return Math.min(1, designed * (sound.volume / HALL_DEFAULT_VOLUME));
}

/**
 * Folds the Hall's pause and this page being hidden into one paused state, so the game hears
 * one `onPause` when either begins and one `onResume` when both are over.
 */
function pauseFolder(win: Window, options: ConnectOptions) {
  let hallPaused = false;
  let pageHidden = options.pauseWhenHidden ? win.document.hidden : false;
  let paused = hallPaused || pageHidden;

  function settle() {
    const next = hallPaused || pageHidden;
    if (next === paused) return;
    paused = next;
    if (paused) options.onPause?.();
    else options.onResume?.();
  }
  function onVisibility() {
    pageHidden = win.document.hidden;
    settle();
  }
  if (options.pauseWhenHidden) win.document.addEventListener('visibilitychange', onVisibility);
  return {
    setHallPaused(next: boolean) {
      if (!options.pauseWhenHidden) {
        // Without the option every Hall pause and resume reaches the game as it comes, as in 1.0.
        if (next) options.onPause?.();
        else options.onResume?.();
        return;
      }
      hallPaused = next;
      settle();
    },
    stop() {
      win.document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}

function standaloneConnection(win: Window, options: ConnectOptions): HallConnection {
  const pause = pauseFolder(win, options);
  return {
    hosted: false,
    state: () => null,
    result: () => {},
    achievement: () => {},
    navigate: () => {},
    setTitleScreen: () => {},
    requestSettings: () => {},
    poster: () => {},
    posterFromCanvas: () => {},
    disconnect: () => pause.stop(),
  };
}

function stillOf(doc: Document, source: HTMLCanvasElement, quality: number) {
  const scale = Math.min(1, POSTER_MAX_WIDTH / source.width);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const still = doc.createElement('canvas');
  still.width = width;
  still.height = height;
  const context = still.getContext('2d');
  if (!context) return null;
  context.drawImage(source, 0, 0, width, height);
  return { image: still.toDataURL('image/webp', quality), width, height };
}

function writeTokens(
  root: HTMLElement,
  tokens: ThemeTokenMap,
  appearance: AppearancePayload['appearance'],
  theme: string,
) {
  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
  root.dataset.ugAppearance = appearance;
  root.dataset.ugTheme = theme;
  root.style.colorScheme = appearance;
}

export function connectToHall(options: ConnectOptions): HallConnection {
  const win = options.window ?? window;
  if (win.parent === win) return standaloneConnection(win, options);

  const hall = win.parent;
  const origin = win.location.origin;
  let hello: HelloPayload | null = null;
  let onTitleScreen = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let connected = true;
  const pause = pauseFolder(win, options);
  let lastSound: SoundSettings | null = null;
  let lastReducedMotion: boolean | null = null;

  /** Tells the game about sound and motion when they first arrive and whenever they change. */
  function followSettings(settings: Pick<BridgeSettings, 'volume' | 'muted' | 'reducedMotion'>) {
    const { volume, muted, reducedMotion } = settings;
    if (!lastSound || lastSound.volume !== volume || lastSound.muted !== muted) {
      lastSound = { volume, muted };
      options.onSound?.(lastSound);
    }
    if (lastReducedMotion !== reducedMotion) {
      lastReducedMotion = reducedMotion;
      options.onReducedMotion?.(reducedMotion);
    }
  }

  function send(message: GameMessage) {
    if (!connected) return;
    // Validate our own output too: a malformed message would be silently dropped by the Hall,
    // and a warning here is far easier to debug than a result that never arrives.
    if (!parseGameMessage(message)) {
      console.warn(`[bridge] Not sending an invalid "${message.type}" message.`, message.payload);
      return;
    }
    hall.postMessage(message, origin);
  }

  function announce(attempt: number) {
    send(gameMessage('ready', { id: options.id }));
    const delay = READY_RETRY_DELAYS[attempt];
    if (delay === undefined) return;
    retry = setTimeout(() => {
      if (hello === null) announce(attempt + 1);
    }, delay);
  }

  function applyAppearance(payload: AppearancePayload) {
    if (options.applyTokens) {
      writeTokens(win.document.documentElement, payload.tokens, payload.appearance, payload.theme);
    }
  }

  function onMessage(event: MessageEvent) {
    if (event.source !== hall || event.origin !== origin) return;
    const message = parseHallMessage(event.data);
    if (!message) return;
    switch (message.type) {
      case 'hello':
        hello = message.payload;
        clearTimeout(retry);
        applyAppearance({ ...hello, reducedMotion: hello.settings.reducedMotion });
        options.onHello?.(hello);
        followSettings(hello.settings);
        break;
      case 'appearance-changed':
        if (hello) {
          const { appearance, theme, tokens, reducedMotion } = message.payload;
          hello = {
            ...hello,
            appearance,
            theme,
            tokens,
            settings: { ...hello.settings, reducedMotion },
          };
        }
        applyAppearance(message.payload);
        options.onAppearanceChange?.(message.payload);
        if (lastSound)
          followSettings({ ...lastSound, reducedMotion: message.payload.reducedMotion });
        break;
      case 'settings-changed':
        if (hello) hello = { ...hello, settings: message.payload.settings };
        options.onSettingsChange?.(message.payload.settings);
        followSettings(message.payload.settings);
        break;
      case 'pause':
        pause.setHallPaused(true);
        break;
      case 'resume':
        pause.setHallPaused(false);
        break;
    }
  }

  // The Hall cannot hear keys pressed inside the frame, so on the game's own title screen the
  // bridge turns Escape into "back to the Hall". It decides only once the page has handled the
  // key: a game that uses Escape there (to close a dialog, say) calls preventDefault and keeps
  // it, whether its listener was added before the bridge's or after.
  let pendingEscape: ReturnType<typeof setTimeout> | undefined;
  function onKeyDown(event: KeyboardEvent) {
    if (!onTitleScreen || event.key !== 'Escape' || event.repeat || event.defaultPrevented) return;
    clearTimeout(pendingEscape);
    pendingEscape = setTimeout(() => {
      if (onTitleScreen && !event.defaultPrevented) send(gameMessage('navigate', { to: 'hall' }));
    }, 0);
  }

  win.addEventListener('message', onMessage);
  win.addEventListener('keydown', onKeyDown);
  announce(0);

  return {
    hosted: true,
    state: () => hello,
    result: (result) => send(gameMessage('result', result)),
    achievement: (id) => send(gameMessage('achievement', { id })),
    navigate: (to) => send(gameMessage('navigate', { to })),
    setTitleScreen(active) {
      onTitleScreen = active;
      send(gameMessage('title-screen', { active }));
    },
    requestSettings: () => send(gameMessage('request-settings', {})),
    poster: (image, width, height) => send(gameMessage('poster', { image, width, height })),
    posterFromCanvas(canvas, quality = POSTER_QUALITY) {
      if (canvas.width === 0 || canvas.height === 0) return;
      const still = stillOf(win.document, canvas, quality);
      if (still) send(gameMessage('poster', still));
    },
    disconnect() {
      clearTimeout(retry);
      clearTimeout(pendingEscape);
      win.removeEventListener('message', onMessage);
      win.removeEventListener('keydown', onKeyDown);
      pause.stop();
      connected = false;
    },
  };
}
