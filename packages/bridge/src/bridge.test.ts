// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectToHall, HALL_DEFAULT_VOLUME, READY_RETRY_DELAYS, soundLevel } from './game';
import { createBridgeHost } from './host';
import {
  BRIDGE_PROTOCOL,
  BRIDGE_VERSION,
  gameMessage,
  type HelloPayload,
  hallMessage,
} from './protocol';

const HALL_ORIGIN = 'https://hall.test';

type Listener = (event: unknown) => void;

/**
 * Two stand-in windows, a Hall and the game frame inside it. Messages queue up and are
 * delivered on `flush()`, like the browser's asynchronous postMessage, with the real rules:
 * the receiver sees the sender as `source` and `origin`, and a targetOrigin that does not match
 * the receiver drops the message.
 */
function createChannel(gameOrigin = HALL_ORIGIN) {
  const queue: (() => void)[] = [];
  const sentTargets: string[] = [];

  function fakeWindow(origin: string) {
    const listeners = new Map<string, Set<Listener>>();
    const win = {
      parent: undefined as unknown,
      location: { origin },
      document,
      addEventListener(type: string, listener: Listener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(listener);
      },
      removeEventListener(type: string, listener: Listener) {
        listeners.get(type)?.delete(listener);
      },
      dispatch(type: string, event: unknown) {
        for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
      },
      listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
      postMessage: (_data: unknown, _targetOrigin: string) => {},
    };
    return win;
  }

  const hall = fakeWindow(HALL_ORIGIN);
  const game = fakeWindow(gameOrigin);
  hall.parent = hall;
  game.parent = hall;

  function postFrom(sender: typeof hall, receiver: typeof hall) {
    return (data: unknown, targetOrigin: string) => {
      sentTargets.push(targetOrigin);
      queue.push(() => {
        if (targetOrigin !== '*' && targetOrigin !== receiver.location.origin) return;
        receiver.dispatch('message', {
          data: structuredClone(data),
          origin: sender.location.origin,
          source: sender,
        });
      });
    };
  }
  hall.postMessage = postFrom(game, hall);
  game.postMessage = postFrom(hall, game);

  return {
    hall,
    game,
    hallWindow: hall as unknown as Window,
    gameWindow: game as unknown as Window,
    iframe: { contentWindow: game } as unknown as HTMLIFrameElement,
    sentTargets,
    flush() {
      while (queue.length > 0) queue.shift()!();
    },
    /** Delivers a message to the Hall as if some other window had sent it. */
    injectToHall(data: unknown, source: unknown, origin = HALL_ORIGIN) {
      hall.dispatch('message', { data, origin, source });
    },
    injectToGame(data: unknown, source: unknown, origin = HALL_ORIGIN) {
      game.dispatch('message', { data, origin, source });
    },
  };
}

const settings = {
  volume: 0.35,
  muted: false,
  reducedMotion: false,
  colorBlindPalette: false,
  language: 'en' as const,
};

function helloFor(gameId: string, overrides: Partial<HelloPayload> = {}): HelloPayload {
  return {
    version: 1,
    gameId,
    appearance: 'dark',
    theme: 'phosphor',
    tokens: { '--ug-bg': '#040c07', '--ug-ink': '#c9f7d7' },
    settings,
    ...overrides,
  };
}

function keydown(key: string, init: { repeat?: boolean; prevented?: boolean } = {}) {
  const event = {
    key,
    repeat: init.repeat ?? false,
    defaultPrevented: init.prevented ?? false,
    preventDefault() {
      event.defaultPrevented = true;
    },
  };
  return event;
}

function wire(
  channel = createChannel(),
  overrides: Parameters<typeof createBridgeHost>[0] extends infer O ? Partial<O> : never = {},
) {
  const calls = {
    ready: 0,
    results: [] as unknown[],
    achievements: [] as string[],
    navigations: [] as string[],
    titleScreens: [] as boolean[],
    settingsRequests: 0,
    posters: [] as unknown[],
  };
  let current = helloFor('pom');
  const host = createBridgeHost({
    iframe: channel.iframe,
    gameId: 'pom',
    hello: () => current,
    window: channel.hallWindow,
    onReady: () => calls.ready++,
    onResult: (result) => calls.results.push(result),
    onAchievement: (id) => calls.achievements.push(id),
    onNavigate: (to) => calls.navigations.push(to),
    onTitleScreen: (active) => calls.titleScreens.push(active),
    onRequestSettings: () => calls.settingsRequests++,
    onPoster: (poster) => calls.posters.push(poster),
    ...overrides,
  });
  return {
    channel,
    host,
    calls,
    setHello(next: HelloPayload) {
      current = next;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('style');
  delete document.documentElement.dataset.ugAppearance;
  delete document.documentElement.dataset.ugTheme;
});

describe('handshake', () => {
  it('answers ready with the current hello', () => {
    const { channel, calls } = wire();
    const onHello = vi.fn();
    const game = connectToHall({ id: 'pom', window: channel.gameWindow, onHello });
    expect(game.hosted).toBe(true);
    channel.flush();
    expect(calls.ready).toBe(1);
    expect(onHello).toHaveBeenCalledWith(helloFor('pom'));
    expect(game.state()).toEqual(helloFor('pom'));
  });

  it('repeats ready with backoff until the Hall answers, then stops', () => {
    const channel = createChannel();
    const readies: unknown[] = [];
    channel.hall.addEventListener('message', (event) => readies.push(event));
    connectToHall({ id: 'pom', window: channel.gameWindow });
    channel.flush();
    expect(readies).toHaveLength(1);

    vi.advanceTimersByTime(READY_RETRY_DELAYS[0]);
    channel.flush();
    expect(readies).toHaveLength(2);

    // The Hall wakes up late and answers the second ready.
    wire(channel);
    vi.advanceTimersByTime(READY_RETRY_DELAYS[1]);
    channel.flush();
    channel.flush();
    const countAfterHello = readies.length;
    vi.advanceTimersByTime(60_000);
    channel.flush();
    expect(readies).toHaveLength(countAfterHello);
  });

  it('gives up after a bounded number of attempts when nobody answers', () => {
    const channel = createChannel();
    let readies = 0;
    channel.hall.addEventListener('message', () => readies++);
    connectToHall({ id: 'pom', window: channel.gameWindow });
    vi.advanceTimersByTime(120_000);
    channel.flush();
    expect(readies).toBe(READY_RETRY_DELAYS.length + 1);
  });

  it('sends a fresh hello after the frame reloads and announces itself again', () => {
    const { channel, setHello } = wire();
    const seen: string[] = [];
    connectToHall({
      id: 'pom',
      window: channel.gameWindow,
      onHello: (h) => seen.push(h.appearance),
    });
    channel.flush();
    setHello(helloFor('pom', { appearance: 'light' }));
    connectToHall({
      id: 'pom',
      window: channel.gameWindow,
      onHello: (h) => seen.push(`reloaded:${h.appearance}`),
    });
    channel.flush();
    expect(seen).toContain('reloaded:light');
  });

  it('ignores a ready from a frame claiming to be another game', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { channel, calls } = wire();
    const onHello = vi.fn();
    connectToHall({ id: 'robots', window: channel.gameWindow, onHello });
    channel.flush();
    expect(calls.ready).toBe(0);
    expect(onHello).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('only ever posts to the explicit origin, never to *', () => {
    const { channel, host } = wire();
    const game = connectToHall({ id: 'pom', window: channel.gameWindow });
    channel.flush();
    host.pause();
    host.resume();
    game.result({ outcome: 'win' });
    channel.flush();
    expect(channel.sentTargets.length).toBeGreaterThan(3);
    expect(new Set(channel.sentTargets)).toEqual(new Set([HALL_ORIGIN]));
  });
});

describe('trust', () => {
  it('drops game messages from other windows or other origins', () => {
    const { channel, calls } = wire();
    const stranger = {};
    channel.injectToHall(gameMessage('achievement', { id: 'free-xp' }), stranger);
    channel.injectToHall(
      gameMessage('achievement', { id: 'free-xp' }),
      channel.game,
      'https://elsewhere.test',
    );
    channel.injectToHall(
      {
        protocol: BRIDGE_PROTOCOL,
        version: BRIDGE_VERSION,
        type: 'achievement',
        payload: { id: 'Nope!' },
      },
      channel.game,
    );
    expect(calls.achievements).toEqual([]);
  });

  it('drops Hall messages from other windows or other origins', () => {
    const channel = createChannel();
    const onPause = vi.fn();
    const onHello = vi.fn();
    connectToHall({ id: 'pom', window: channel.gameWindow, onPause, onHello });
    channel.injectToGame(hallMessage('pause', {}), {});
    channel.injectToGame(
      hallMessage('hello', helloFor('pom')),
      channel.hall,
      'https://elsewhere.test',
    );
    channel.injectToGame({ type: 'pause' }, channel.hall);
    expect(onPause).not.toHaveBeenCalled();
    expect(onHello).not.toHaveBeenCalled();
  });

  it('refuses to send a malformed result and says why', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { channel, calls } = wire();
    const game = connectToHall({ id: 'pom', window: channel.gameWindow });
    channel.flush();
    game.result({ outcome: 'win', score: Number.NaN });
    channel.flush();
    expect(calls.results).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('result'), expect.anything());
  });
});

describe('game → Hall', () => {
  it('delivers results, achievements, navigation and the title-screen signal', () => {
    const { channel, calls } = wire();
    const game = connectToHall({ id: 'pom', window: channel.gameWindow });
    channel.flush();
    const result = {
      outcome: 'win' as const,
      score: 120,
      stats: { rounds: 1 },
      xpEvents: [{ id: 'm', xp: 5 }],
      durationSeconds: 30,
    };
    game.result(result);
    game.achievement('first-full-moon');
    game.navigate('game-menu');
    game.setTitleScreen(true);
    game.setTitleScreen(false);
    channel.flush();
    expect(calls.results).toEqual([result]);
    expect(calls.achievements).toEqual(['first-full-moon']);
    expect(calls.navigations).toEqual(['game-menu']);
    expect(calls.titleScreens).toEqual([true, false]);
  });

  it('delivers key art the game drew of itself, and drops anything that is not an inline image', () => {
    const { channel, calls } = wire();
    const game = connectToHall({ id: 'pom', window: channel.gameWindow });
    channel.flush();
    game.poster('data:image/webp;base64,UklGRg==', 640, 360);
    game.poster('https://example.com/art.webp', 640, 360);
    channel.flush();
    expect(calls.posters).toEqual([
      { image: 'data:image/webp;base64,UklGRg==', width: 640, height: 360 },
    ]);
  });

  it('scales a canvas the game drew down to poster size and sends it as WebP', () => {
    const { channel, calls } = wire();
    const game = connectToHall({ id: 'pom', window: channel.gameWindow });
    channel.flush();
    const drawn: number[][] = [];
    const still = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: (_source: unknown, x: number, y: number, w: number, h: number) =>
          drawn.push([x, y, w, h]),
      }),
      toDataURL: (type: string) => `data:${type};base64,UklGRg==`,
    };
    vi.spyOn(document, 'createElement').mockReturnValue(still as unknown as HTMLElement);
    game.posterFromCanvas({ width: 2560, height: 1440 } as HTMLCanvasElement);
    channel.flush();
    expect(drawn).toEqual([[0, 0, 1280, 720]]);
    expect(calls.posters).toEqual([
      { image: 'data:image/webp;base64,UklGRg==', width: 1280, height: 720 },
    ]);
  });

  it('turns Escape on the title screen into a trip back to the Hall', () => {
    const { channel, calls } = wire();
    const game = connectToHall({ id: 'pom', window: channel.gameWindow });
    channel.flush();

    channel.game.dispatch('keydown', keydown('Escape'));
    game.setTitleScreen(true);
    channel.game.dispatch('keydown', keydown('Enter'));
    channel.game.dispatch('keydown', keydown('Escape', { repeat: true }));
    channel.game.dispatch('keydown', keydown('Escape', { prevented: true }));
    channel.game.dispatch('keydown', keydown('Escape'));
    vi.runAllTimers();
    channel.flush();

    expect(calls.navigations).toEqual(['hall']);

    game.setTitleScreen(false);
    channel.game.dispatch('keydown', keydown('Escape'));
    vi.runAllTimers();
    channel.flush();
    expect(calls.navigations).toEqual(['hall']);
  });

  it('leaves Escape to the game when a listener added after the bridge uses it', () => {
    const { channel, calls } = wire();
    const game = connectToHall({ id: 'pom', window: channel.gameWindow });
    channel.flush();
    game.setTitleScreen(true);
    // The game's own handler, registered after the bridge's, closes a dialog with Escape.
    channel.game.addEventListener('keydown', (event) => {
      (event as { preventDefault(): void }).preventDefault();
    });

    channel.game.dispatch('keydown', keydown('Escape'));
    vi.runAllTimers();
    channel.flush();
    expect(calls.navigations).toEqual([]);
  });

  it('answers a settings request with the current settings', () => {
    const { channel, calls, setHello } = wire();
    const onSettingsChange = vi.fn();
    const game = connectToHall({ id: 'pom', window: channel.gameWindow, onSettingsChange });
    channel.flush();
    setHello(helloFor('pom', { settings: { ...settings, muted: true } }));
    game.requestSettings();
    channel.flush();
    channel.flush();
    expect(calls.settingsRequests).toBe(1);
    expect(onSettingsChange).toHaveBeenCalledWith({ ...settings, muted: true });
    expect(game.state()?.settings.muted).toBe(true);
  });
});

describe('Hall → game', () => {
  it('forwards appearance, settings, pause and resume once the game is ready', () => {
    const { channel, host } = wire();
    const seen: string[] = [];
    const game = connectToHall({
      id: 'pom',
      window: channel.gameWindow,
      onAppearanceChange: (a) => seen.push(`appearance:${a.appearance}/${a.theme}`),
      onSettingsChange: (s) => seen.push(`volume:${s.volume}`),
      onPause: () => seen.push('pause'),
      onResume: () => seen.push('resume'),
    });
    channel.flush();
    host.sendAppearance({
      appearance: 'light',
      theme: 'sunset',
      tokens: { '--ug-bg': '#f3e2c2' },
      reducedMotion: true,
    });
    host.sendSettings({ ...settings, volume: 0.8, reducedMotion: true });
    host.pause();
    host.resume();
    channel.flush();
    expect(seen).toEqual(['appearance:light/sunset', 'volume:0.8', 'pause', 'resume']);
    expect(game.state()).toMatchObject({
      appearance: 'light',
      theme: 'sunset',
      settings: { volume: 0.8, reducedMotion: true },
    });
  });

  it('holds changes until ready, and replays a pause right after the hello', () => {
    const channel = createChannel();
    const delivered: string[] = [];
    channel.game.addEventListener('message', (event) =>
      delivered.push((event as { data: { type: string } }).data.type),
    );
    const { host } = wire(channel);
    host.sendAppearance({ appearance: 'light', theme: 'manual', tokens: {}, reducedMotion: false });
    host.pause();
    channel.flush();
    expect(delivered).toEqual([]);

    connectToHall({ id: 'pom', window: channel.gameWindow });
    channel.flush();
    channel.flush();
    expect(delivered).toEqual(['hello', 'pause']);
  });

  it('writes theme tokens onto the document when asked to', () => {
    const { channel, host } = wire();
    connectToHall({ id: 'pom', window: channel.gameWindow, applyTokens: true });
    channel.flush();
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--ug-bg')).toBe('#040c07');
    expect(root.dataset.ugAppearance).toBe('dark');
    expect(root.dataset.ugTheme).toBe('phosphor');

    host.sendAppearance({
      appearance: 'light',
      theme: 'manual',
      tokens: { '--ug-bg': '#efe7d8' },
      reducedMotion: false,
    });
    channel.flush();
    expect(root.style.getPropertyValue('--ug-bg')).toBe('#efe7d8');
    expect(root.style.colorScheme).toBe('light');
  });

  it('leaves the document alone by default', () => {
    const { channel } = wire();
    connectToHall({ id: 'pom', window: channel.gameWindow });
    channel.flush();
    expect(document.documentElement.style.getPropertyValue('--ug-bg')).toBe('');
  });
});

describe('cleanup', () => {
  it('stops listening and sending after disconnect and destroy', () => {
    const { channel, host, calls } = wire();
    const onPause = vi.fn();
    const game = connectToHall({ id: 'pom', window: channel.gameWindow, onPause });
    channel.flush();

    game.disconnect();
    expect(channel.game.listenerCount()).toBe(0);
    game.result({ outcome: 'win' });
    host.pause();
    channel.flush();
    expect(calls.results).toEqual([]);
    expect(onPause).not.toHaveBeenCalled();

    host.destroy();
    expect(channel.hall.listenerCount()).toBe(0);
  });

  it('cancels pending ready retries on disconnect', () => {
    const channel = createChannel();
    let readies = 0;
    channel.hall.addEventListener('message', () => readies++);
    const game = connectToHall({ id: 'pom', window: channel.gameWindow });
    game.disconnect();
    vi.advanceTimersByTime(60_000);
    channel.flush();
    expect(readies).toBe(1);
  });
});

describe('standalone', () => {
  it('runs outside the Hall with every call a harmless no-op', () => {
    const game = connectToHall({ id: 'pom' });
    expect(game.hosted).toBe(false);
    expect(game.state()).toBeNull();
    expect(() => {
      game.result({ outcome: 'win', score: 1 });
      game.achievement('anything');
      game.navigate('hall');
      game.setTitleScreen(true);
      game.requestSettings();
      game.poster('data:image/png;base64,iVBO', 1, 1);
      game.disconnect();
    }).not.toThrow();
  });
});

/** Stands in for the browser hiding and showing the page (jsdom's page is always visible). */
function setPageHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('revision 1.1: sound, motion and pause', () => {
  afterEach(() => {
    delete (document as { hidden?: boolean }).hidden;
  });

  it('tells the game the Hall’s sound and motion on hello, then only when they change', () => {
    const { channel, host } = wire();
    const seen: string[] = [];
    connectToHall({
      id: 'pom',
      window: channel.gameWindow,
      onSound: ({ volume, muted }) => seen.push(`sound:${volume}${muted ? ' muted' : ''}`),
      onReducedMotion: (reduced) => seen.push(`reduced:${reduced}`),
    });
    channel.flush();
    expect(seen).toEqual(['sound:0.35', 'reduced:false']);

    // The Hall sends both messages for any settings change; only real changes reach the game.
    host.sendAppearance({ appearance: 'light', theme: 'manual', tokens: {}, reducedMotion: false });
    host.sendSettings(settings);
    host.sendSettings({ ...settings, muted: true });
    host.sendAppearance({ appearance: 'light', theme: 'manual', tokens: {}, reducedMotion: true });
    host.sendSettings({ ...settings, muted: true, reducedMotion: true, volume: 0.6 });
    channel.flush();
    expect(seen).toEqual([
      'sound:0.35',
      'reduced:false',
      'sound:0.35 muted',
      'reduced:true',
      'sound:0.6 muted',
    ]);
  });

  it('turns the Hall’s volume into a level for the game’s own mixer', () => {
    expect(soundLevel({ volume: HALL_DEFAULT_VOLUME, muted: false })).toBe(1);
    expect(soundLevel({ volume: HALL_DEFAULT_VOLUME, muted: false }, 0.6)).toBeCloseTo(0.6);
    expect(soundLevel({ volume: HALL_DEFAULT_VOLUME / 2, muted: false }, 0.6)).toBeCloseTo(0.3);
    expect(soundLevel({ volume: 1, muted: false }, 0.6)).toBe(1);
    expect(soundLevel({ volume: 1, muted: true }, 0.6)).toBe(0);
    expect(soundLevel({ volume: 0, muted: false })).toBe(0);
  });

  it('folds the Hall’s pause and a hidden page into one pause and one resume', () => {
    const { channel, host } = wire();
    const seen: string[] = [];
    connectToHall({
      id: 'pom',
      window: channel.gameWindow,
      pauseWhenHidden: true,
      onPause: () => seen.push('pause'),
      onResume: () => seen.push('resume'),
    });
    channel.flush();

    setPageHidden(true);
    host.pause();
    channel.flush();
    host.resume();
    channel.flush();
    expect(seen).toEqual(['pause']);
    setPageHidden(false);
    expect(seen).toEqual(['pause', 'resume']);

    host.pause();
    channel.flush();
    setPageHidden(true);
    setPageHidden(false);
    expect(seen).toEqual(['pause', 'resume', 'pause']);
  });

  it('pauses a game running on its own while its page is hidden', () => {
    const { channel } = wire();
    const onPause = vi.fn();
    const onResume = vi.fn();
    const game = connectToHall({
      id: 'pom',
      window: channel.hallWindow,
      pauseWhenHidden: true,
      onPause,
      onResume,
    });
    expect(game.hosted).toBe(false);
    setPageHidden(true);
    setPageHidden(false);
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledTimes(1);

    game.disconnect();
    setPageHidden(true);
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('keeps the wire format of 1.0, so games and Halls of either revision understand each other', () => {
    expect(BRIDGE_VERSION).toBe(1);
    const { channel, host } = wire();
    const onSound = vi.fn();
    // A game written for 1.0 passes none of the new options and hears exactly what it did.
    const seen: string[] = [];
    connectToHall({
      id: 'pom',
      window: channel.gameWindow,
      onPause: () => seen.push('pause'),
      onResume: () => seen.push('resume'),
    });
    connectToHall({ id: 'pom', window: channel.gameWindow, onSound });
    channel.flush();
    host.pause();
    host.pause();
    host.resume();
    channel.flush();
    expect(seen).toEqual(['pause', 'pause', 'resume']);
    expect(onSound).toHaveBeenCalledWith({ volume: 0.35, muted: false });
  });
});
