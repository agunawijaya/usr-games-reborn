/**
 * Bridge protocol v1: the only language the Hall and a hosted game share.
 *
 * Every message is an envelope `{ protocol, version, type, payload }` sent with postMessage
 * between same-origin windows. Both sides parse with the strict validators below and drop
 * anything that does not match exactly: unknown types, unknown keys, wrong value types,
 * non-finite numbers and oversize strings or maps. A hosted game is trusted code, but a strict
 * schema keeps one buggy game from putting nonsense into the player's progression.
 *
 * This file is dependency-free on purpose: hosted games include the bridge with one script tag,
 * so it must not pull in the kit or anything else.
 */

export const BRIDGE_PROTOCOL = 'usr-games-bridge';
export const BRIDGE_VERSION = 1;

export type Appearance = 'light' | 'dark';
/**
 * The palette painting the Hall: the Machine Room's three, or the signature palette of Console
 * Home or Holo Collection. Hosted games only need it to pick matching colours; the tokens carry
 * the exact values.
 */
export type ThemeId = 'phosphor' | 'manual' | 'sunset' | 'console' | 'holo';
export type Outcome = 'win' | 'loss' | 'draw' | 'complete' | 'quit';
export type NavigateTarget = 'hall' | 'game-menu';

export interface BridgeSettings {
  /** Master volume, 0–1. */
  volume: number;
  muted: boolean;
  reducedMotion: boolean;
  colorBlindPalette: boolean;
  language: 'en';
}

/** CSS custom properties such as `--ug-bg`, ready to set on the game's root element. */
export type ThemeTokenMap = Record<string, string>;

export interface HelloPayload {
  version: typeof BRIDGE_VERSION;
  gameId: string;
  appearance: Appearance;
  theme: ThemeId;
  tokens: ThemeTokenMap;
  settings: BridgeSettings;
}

export interface AppearancePayload {
  appearance: Appearance;
  theme: ThemeId;
  tokens: ThemeTokenMap;
  reducedMotion: boolean;
}

export interface XpEvent {
  id: string;
  xp: number;
}

export interface ResultPayload {
  outcome: Outcome;
  score?: number;
  stats?: Record<string, number>;
  xpEvents?: XpEvent[];
  daily?: boolean;
  durationSeconds?: number;
}

/**
 * Key art the game draws of itself, for the Hall's poster-led styles: a data URL of a PNG, JPEG
 * or WebP snapshot (for example its title screen), with its size in pixels.
 */
export interface PosterPayload {
  image: string;
  width: number;
  height: number;
}

export type EmptyPayload = Record<string, never>;

interface Envelope<Type extends string, Payload> {
  protocol: typeof BRIDGE_PROTOCOL;
  version: typeof BRIDGE_VERSION;
  type: Type;
  payload: Payload;
}

/** Hall → game. */
export type HallMessage =
  | Envelope<'hello', HelloPayload>
  | Envelope<'appearance-changed', AppearancePayload>
  | Envelope<'settings-changed', { settings: BridgeSettings }>
  | Envelope<'pause', EmptyPayload>
  | Envelope<'resume', EmptyPayload>;

/** Game → Hall. */
export type GameMessage =
  | Envelope<'ready', { id: string }>
  | Envelope<'result', ResultPayload>
  | Envelope<'achievement', { id: string }>
  | Envelope<'navigate', { to: NavigateTarget }>
  | Envelope<'request-settings', EmptyPayload>
  | Envelope<'title-screen', { active: boolean }>
  | Envelope<'poster', PosterPayload>;

export type HallMessageType = HallMessage['type'];
export type GameMessageType = GameMessage['type'];

type PayloadOf<M extends { type: string; payload: unknown }, T extends M['type']> = Extract<
  M,
  { type: T }
>['payload'];

export function hallMessage<T extends HallMessageType>(
  type: T,
  payload: PayloadOf<HallMessage, T>,
): HallMessage {
  return { protocol: BRIDGE_PROTOCOL, version: BRIDGE_VERSION, type, payload } as HallMessage;
}

export function gameMessage<T extends GameMessageType>(
  type: T,
  payload: PayloadOf<GameMessage, T>,
): GameMessage {
  return { protocol: BRIDGE_PROTOCOL, version: BRIDGE_VERSION, type, payload } as GameMessage;
}

// Limits generous enough for any real game and small enough that nothing silly gets through.
export const LIMITS = {
  idLength: 64,
  tokenCount: 96,
  tokenValueLength: 240,
  statCount: 32,
  statKeyLength: 40,
  xpEventCount: 16,
  /** A data URL of about 1.5 MB of image; base64 spends four characters per three bytes. */
  posterDataLength: 2_000_000,
  posterSide: 4096,
} as const;

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const TOKEN_NAME_PATTERN = /^--[a-z0-9-]{1,48}$/;
const STAT_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
// Images only, inline only: no remote URLs, no SVG (which can carry script), no other schemes.
const POSTER_DATA_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

type Json = Record<string, unknown>;

function isPlainObject(value: unknown): value is Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** True when `value` is a plain object whose keys are all allowed and all required keys exist. */
function hasShape(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): value is Json {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => key in value) && keys.every((key) => allowed.has(key));
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= LIMITS.idLength && ID_PATTERN.test(value);
const isAppearance = (value: unknown): value is Appearance => value === 'light' || value === 'dark';
const THEMES: readonly ThemeId[] = ['phosphor', 'manual', 'sunset', 'console', 'holo'];
const isTheme = (value: unknown): value is ThemeId => THEMES.includes(value as ThemeId);
const isOutcome = (value: unknown): value is Outcome =>
  value === 'win' ||
  value === 'loss' ||
  value === 'draw' ||
  value === 'complete' ||
  value === 'quit';

function isTokenMap(value: unknown): value is ThemeTokenMap {
  if (!isPlainObject(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length <= LIMITS.tokenCount &&
    entries.every(
      ([name, token]) =>
        TOKEN_NAME_PATTERN.test(name) &&
        typeof token === 'string' &&
        token.length <= LIMITS.tokenValueLength,
    )
  );
}

function isSettings(value: unknown): value is BridgeSettings {
  return (
    hasShape(value, ['volume', 'muted', 'reducedMotion', 'colorBlindPalette', 'language']) &&
    isFiniteNumber(value.volume) &&
    value.volume >= 0 &&
    value.volume <= 1 &&
    typeof value.muted === 'boolean' &&
    typeof value.reducedMotion === 'boolean' &&
    typeof value.colorBlindPalette === 'boolean' &&
    value.language === 'en'
  );
}

function isStats(value: unknown): value is Record<string, number> {
  if (!isPlainObject(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length <= LIMITS.statCount &&
    entries.every(
      ([key, count]) =>
        key.length <= LIMITS.statKeyLength && STAT_KEY_PATTERN.test(key) && isFiniteNumber(count),
    )
  );
}

function isXpEvents(value: unknown): value is XpEvent[] {
  return (
    Array.isArray(value) &&
    value.length <= LIMITS.xpEventCount &&
    value.every(
      (event) => hasShape(event, ['id', 'xp']) && isId(event.id) && isFiniteNumber(event.xp),
    )
  );
}

function isResult(value: unknown): value is ResultPayload {
  return (
    hasShape(value, ['outcome'], ['score', 'stats', 'xpEvents', 'daily', 'durationSeconds']) &&
    isOutcome(value.outcome) &&
    (value.score === undefined || isFiniteNumber(value.score)) &&
    (value.stats === undefined || isStats(value.stats)) &&
    (value.xpEvents === undefined || isXpEvents(value.xpEvents)) &&
    (value.daily === undefined || typeof value.daily === 'boolean') &&
    (value.durationSeconds === undefined ||
      (isFiniteNumber(value.durationSeconds) && value.durationSeconds >= 0))
  );
}

function isPosterSide(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0 && (value as number) <= LIMITS.posterSide;
}

function isPoster(value: unknown): value is PosterPayload {
  return (
    hasShape(value, ['image', 'width', 'height']) &&
    typeof value.image === 'string' &&
    value.image.length <= LIMITS.posterDataLength &&
    POSTER_DATA_PATTERN.test(value.image) &&
    isPosterSide(value.width) &&
    isPosterSide(value.height)
  );
}

const isEmpty = (value: unknown): value is EmptyPayload => hasShape(value, []);

const HALL_PAYLOADS: Record<HallMessageType, (payload: unknown) => boolean> = {
  hello: (p) =>
    hasShape(p, ['version', 'gameId', 'appearance', 'theme', 'tokens', 'settings']) &&
    p.version === BRIDGE_VERSION &&
    isId(p.gameId) &&
    isAppearance(p.appearance) &&
    isTheme(p.theme) &&
    isTokenMap(p.tokens) &&
    isSettings(p.settings),
  'appearance-changed': (p) =>
    hasShape(p, ['appearance', 'theme', 'tokens', 'reducedMotion']) &&
    isAppearance(p.appearance) &&
    isTheme(p.theme) &&
    isTokenMap(p.tokens) &&
    typeof p.reducedMotion === 'boolean',
  'settings-changed': (p) => hasShape(p, ['settings']) && isSettings(p.settings),
  pause: isEmpty,
  resume: isEmpty,
};

const GAME_PAYLOADS: Record<GameMessageType, (payload: unknown) => boolean> = {
  ready: (p) => hasShape(p, ['id']) && isId(p.id),
  result: isResult,
  achievement: (p) => hasShape(p, ['id']) && isId(p.id),
  navigate: (p) => hasShape(p, ['to']) && (p.to === 'hall' || p.to === 'game-menu'),
  'request-settings': isEmpty,
  'title-screen': (p) => hasShape(p, ['active']) && typeof p.active === 'boolean',
  poster: isPoster,
};

function parseEnvelope<M>(
  data: unknown,
  payloads: Record<string, (payload: unknown) => boolean>,
): M | null {
  if (!hasShape(data, ['protocol', 'version', 'type', 'payload'])) return null;
  if (data.protocol !== BRIDGE_PROTOCOL || data.version !== BRIDGE_VERSION) return null;
  if (typeof data.type !== 'string' || !Object.hasOwn(payloads, data.type)) return null;
  const validPayload = payloads[data.type] as (payload: unknown) => boolean;
  return validPayload(data.payload) ? (data as M) : null;
}

/** For the game side: a message from the Hall, or null if it is not one. */
export function parseHallMessage(data: unknown): HallMessage | null {
  return parseEnvelope<HallMessage>(data, HALL_PAYLOADS);
}

/** For the Hall side: a message from a game, or null if it is not one. */
export function parseGameMessage(data: unknown): GameMessage | null {
  return parseEnvelope<GameMessage>(data, GAME_PAYLOADS);
}
