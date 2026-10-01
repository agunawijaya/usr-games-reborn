import { describe, expect, it } from 'vitest';
import {
  BRIDGE_PROTOCOL,
  BRIDGE_VERSION,
  gameMessage,
  hallMessage,
  type HelloPayload,
  LIMITS,
  parseGameMessage,
  parseHallMessage,
} from './protocol';

const settings = {
  volume: 0.35,
  muted: false,
  reducedMotion: false,
  colorBlindPalette: false,
  language: 'en' as const,
};
const tokens = {
  '--ug-bg': '#040c07',
  '--ug-ink': '#c9f7d7',
  '--ug-font-body': "'Atkinson Hyperlegible Next', sans-serif",
};
const hello: HelloPayload = {
  version: 1,
  gameId: 'pom',
  appearance: 'dark',
  theme: 'phosphor',
  tokens,
  settings,
};

/** A structured clone, exactly what postMessage delivers (NaN and Infinity survive it). */
const deliver = (value: unknown): unknown => structuredClone(value);

function envelope(type: string, payload: unknown, extra: Record<string, unknown> = {}) {
  return { protocol: BRIDGE_PROTOCOL, version: BRIDGE_VERSION, type, payload, ...extra };
}

describe('Hall → game messages', () => {
  const valid = [
    hallMessage('hello', hello),
    // Console Home and Holo Collection paint with their own palettes.
    hallMessage('hello', { ...hello, theme: 'console' }),
    hallMessage('hello', { ...hello, theme: 'holo' }),
    hallMessage('appearance-changed', {
      appearance: 'light',
      theme: 'manual',
      tokens,
      reducedMotion: true,
    }),
    hallMessage('settings-changed', { settings: { ...settings, muted: true, volume: 0 } }),
    hallMessage('pause', {}),
    hallMessage('resume', {}),
  ];

  it.each(valid.map((message) => [message.type, message]))('accepts %s', (_type, message) => {
    expect(parseHallMessage(deliver(message))).toEqual(message);
  });

  it('rejects them when they arrive at the Hall', () => {
    for (const message of valid) expect(parseGameMessage(deliver(message))).toBeNull();
  });

  it.each([
    ['a hello for another protocol version', { ...hello, version: 2 }],
    ['an unknown theme', { ...hello, theme: 'vaporwave' }],
    ['an unknown appearance', { ...hello, appearance: 'dim' }],
    ['a game id with capitals', { ...hello, gameId: 'Pom' }],
    ['a token that is not a custom property', { ...hello, tokens: { color: 'red' } }],
    [
      'a token value that is too long',
      { ...hello, tokens: { '--ug-bg': 'x'.repeat(LIMITS.tokenValueLength + 1) } },
    ],
    [
      'too many tokens',
      {
        ...hello,
        tokens: Object.fromEntries(
          Array.from({ length: LIMITS.tokenCount + 1 }, (_, i) => [`--t-${i}`, '1']),
        ),
      },
    ],
    ['a volume above 1', { ...hello, settings: { ...settings, volume: 1.5 } }],
    ['another language', { ...hello, settings: { ...settings, language: 'fr' } }],
    ['a missing settings field', { ...hello, settings: { volume: 1, muted: false } }],
    ['an extra payload field', { ...hello, admin: true }],
  ])('rejects a hello with %s', (_label, payload) => {
    expect(parseHallMessage(deliver(envelope('hello', payload)))).toBeNull();
  });

  it('rejects pause and resume that carry a payload', () => {
    expect(parseHallMessage(envelope('pause', { now: true }))).toBeNull();
    expect(parseHallMessage(envelope('resume', null))).toBeNull();
  });
});

describe('game → Hall messages', () => {
  const valid = [
    gameMessage('ready', { id: 'robots' }),
    gameMessage('result', { outcome: 'win' }),
    gameMessage('result', {
      outcome: 'loss',
      score: -12.5,
      stats: { planesLanded: 12, near_misses: 0 },
      xpEvents: [{ id: 'wave-3', xp: 10 }],
      daily: true,
      durationSeconds: 312,
    }),
    gameMessage('achievement', { id: 'first-full-moon' }),
    gameMessage('navigate', { to: 'hall' }),
    gameMessage('navigate', { to: 'game-menu' }),
    gameMessage('request-settings', {}),
    gameMessage('title-screen', { active: true }),
    gameMessage('poster', { image: 'data:image/webp;base64,UklGRg==', width: 640, height: 360 }),
    gameMessage('poster', { image: 'data:image/png;base64,iVBORw0KGgo=', width: 1, height: 4096 }),
  ];

  it.each(valid.map((message) => [message.type, message]))('accepts %s', (_type, message) => {
    expect(parseGameMessage(deliver(message))).toEqual(message);
  });

  it('rejects them when they arrive at the game', () => {
    for (const message of valid) expect(parseHallMessage(deliver(message))).toBeNull();
  });

  it.each([
    ['an unknown outcome', { outcome: 'victory' }],
    ['a NaN score', { outcome: 'win', score: Number.NaN }],
    ['an infinite score', { outcome: 'win', score: Number.POSITIVE_INFINITY }],
    ['a score as text', { outcome: 'win', score: '100' }],
    ['a negative duration', { outcome: 'win', durationSeconds: -1 }],
    ['a stat that is not a number', { outcome: 'win', stats: { landed: '12' } }],
    ['a stat name with spaces', { outcome: 'win', stats: { 'planes landed': 12 } }],
    [
      'a stat name that is too long',
      { outcome: 'win', stats: { ['s'.repeat(LIMITS.statKeyLength + 1)]: 1 } },
    ],
    [
      'too many stats',
      {
        outcome: 'win',
        stats: Object.fromEntries(
          Array.from({ length: LIMITS.statCount + 1 }, (_, i) => [`s${i}`, i]),
        ),
      },
    ],
    ['an xp event without xp', { outcome: 'win', xpEvents: [{ id: 'wave' }] }],
    [
      'an xp event with an extra field',
      { outcome: 'win', xpEvents: [{ id: 'wave', xp: 5, bonus: 100 }] },
    ],
    [
      'too many xp events',
      {
        outcome: 'win',
        xpEvents: Array.from({ length: LIMITS.xpEventCount + 1 }, (_, i) => ({
          id: `e${i}`,
          xp: 1,
        })),
      },
    ],
    ['daily as text', { outcome: 'win', daily: 'yes' }],
    ['an unknown field', { outcome: 'win', xp: 9000 }],
  ])('rejects a result with %s', (_label, payload) => {
    expect(parseGameMessage(deliver(envelope('result', payload)))).toBeNull();
  });

  it.each([
    ['ready', { id: 'x'.repeat(LIMITS.idLength + 1) }],
    ['ready', { id: 'Robots' }],
    ['ready', {}],
    ['achievement', { id: '../../etc' }],
    ['navigate', { to: 'somewhere-else' }],
    ['title-screen', { active: 'true' }],
    ['request-settings', { please: true }],
    ['poster', { image: 'https://example.com/art.png', width: 640, height: 360 }],
    ['poster', { image: 'data:image/svg+xml;base64,PHN2Zz4=', width: 640, height: 360 }],
    ['poster', { image: 'data:text/html;base64,PGgxPg==', width: 640, height: 360 }],
    ['poster', { image: 'data:image/png;base64,not base64!', width: 640, height: 360 }],
    ['poster', { image: 'data:image/png,raw-bytes', width: 640, height: 360 }],
    ['poster', { image: 'data:image/png;base64,iVBO', width: 0, height: 360 }],
    ['poster', { image: 'data:image/png;base64,iVBO', width: 640.5, height: 360 }],
    ['poster', { image: 'data:image/png;base64,iVBO', width: LIMITS.posterSide + 1, height: 360 }],
    ['poster', { image: 'data:image/png;base64,iVBO', width: 640 }],
    ['poster', { image: 'data:image/png;base64,iVBO', width: 640, height: 360, alt: 'art' }],
    [
      'poster',
      {
        image: `data:image/png;base64,${'A'.repeat(LIMITS.posterDataLength)}`,
        width: 640,
        height: 360,
      },
    ],
  ])('rejects a malformed %s', (type, payload) => {
    expect(parseGameMessage(deliver(envelope(type, payload)))).toBeNull();
  });
});

describe('envelopes', () => {
  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a string', 'ready'],
    ['an array', [BRIDGE_PROTOCOL, 1, 'ready', { id: 'pom' }]],
    ['another protocol', { ...envelope('ready', { id: 'pom' }), protocol: 'some-other-bridge' }],
    ['another version', { ...envelope('ready', { id: 'pom' }), version: 2 }],
    ['an unknown type', envelope('launch-missiles', {})],
    ['an inherited type name', envelope('toString', {})],
    ['a missing payload', { protocol: BRIDGE_PROTOCOL, version: BRIDGE_VERSION, type: 'ready' }],
    ['an extra envelope field', envelope('ready', { id: 'pom' }, { reply: true })],
  ])('rejects %s', (_label, data) => {
    expect(parseGameMessage(data)).toBeNull();
    expect(parseHallMessage(data)).toBeNull();
  });

  it('rejects a smuggled __proto__ key', () => {
    const smuggled = JSON.parse('{"id":"pom","__proto__":{"admin":true}}') as unknown;
    expect(parseGameMessage(envelope('ready', smuggled))).toBeNull();
  });

  it('rejects payloads that are class instances rather than plain data', () => {
    expect(parseGameMessage(envelope('request-settings', new Date()))).toBeNull();
  });
});
