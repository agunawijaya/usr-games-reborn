import type { Arena } from './arena';
import { type Heading, HEADING_KEYS, headingToward, STEPS, toHeading } from './geometry';
import { CEILING, findPlane, type Hold, type Plane, type PlaneStatus, type World } from './world';

/**
 * Terminal mode: the typed orders of the 1986 game, read one key at a time by a table of states
 * in the spirit of the original's parser, and Skyloom's own additions: `cl` and `cr` for the left
 * and right holds the manual promised, and `?` for the choices at any point.
 *
 * The words echoed back and every error are Skyloom's own. A finished order is a change to one
 * part of one plane: its altitude, its status or its heading.
 */

/** What an order would make of the plane, before it is given. */
export interface Draft {
  letter: number;
  altitude: number;
  targetAltitude: number;
  heading: Heading;
  targetHeading: Heading;
  hold: Hold | null;
  status: PlaneStatus;
  waitForBeacon: number | null;
  onGround: boolean;
  x: number;
  y: number;
}

export type OrderPart = 'altitude' | 'status' | 'heading';

export interface Order {
  letter: number;
  part: OrderPart;
  draft: Draft;
}

/** Working state while a line is read: the original kept the same three things in globals. */
interface Reading {
  draft: Draft | null;
  part: OrderPart | null;
  side: 'left' | 'right' | null;
  sense: 'up' | 'down' | null;
  toward: 'beacon' | 'gate' | 'runway' | null;
  towardIndex: number | null;
}

type Action = (reading: Reading, key: string, world: World) => string | null;

interface Rule {
  /** A literal key, or 'letter', 'digit' or 'enter'. */
  key: string;
  next: number;
  /** The words echoed when this key is accepted ('#' is replaced by the key). */
  echo: string;
  /** Shown among the choices when the player asks with `?`. */
  hint: string;
  action?: Action;
}

const DONE = -1;
const ENTER = 'enter';
const LETTER = 'letter';
const DIGIT = 'digit';

const COMPASS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const;

function headingRules(next: number, echo: (i: number) => string, action: Action): Rule[] {
  return HEADING_KEYS.map((key, i) => ({ key, next, echo: echo(i), hint: COMPASS[i]!, action }));
}

const S = {
  START: 0,
  ORDER: 1,
  HEADING: 2,
  ALTITUDE: 3,
  AT_OR_END: 4,
  DELAY_BEACON: 5,
  SIDE: 6,
  END: 7,
  TOWARD_NUMBER: 8,
  AT_BEACON: 9,
  BY_AMOUNT: 10,
  TOWARD: 11,
  HOLD: 12,
} as const;

const TABLE: Record<number, Rule[]> = {
  [S.START]: [
    { key: LETTER, next: S.ORDER, echo: '#:', hint: 'a plane’s letter', action: choosePlane },
    { key: ENTER, next: DONE, echo: '', hint: 'next tick now' },
  ],
  [S.ORDER]: [
    { key: 't', next: S.HEADING, echo: ' heading', hint: 't heading', action: mustFly('turn') },
    {
      key: 'a',
      next: S.ALTITUDE,
      echo: ' altitude',
      hint: 'a altitude',
      action: setPart('altitude'),
    },
    { key: 'c', next: S.HOLD, echo: ' hold', hint: 'c hold', action: hold },
    { key: 'm', next: S.END, echo: ' mark', hint: 'm mark', action: status('marked') },
    { key: 'u', next: S.END, echo: ' unmark', hint: 'u unmark', action: status('unmarked') },
    { key: 'i', next: S.END, echo: ' ignore', hint: 'i ignore', action: status('ignored') },
  ],
  [S.HEADING]: [
    { key: 'l', next: S.SIDE, echo: ' left', hint: 'l left', action: nudge('left', 1) },
    { key: 'r', next: S.SIDE, echo: ' right', hint: 'r right', action: nudge('right', 1) },
    {
      key: 'L',
      next: S.AT_OR_END,
      echo: ' hard left',
      hint: 'L hard left',
      action: nudge('left', 2),
    },
    {
      key: 'R',
      next: S.AT_OR_END,
      echo: ' hard right',
      hint: 'R hard right',
      action: nudge('right', 2),
    },
    { key: 't', next: S.TOWARD, echo: ' toward', hint: 't toward' },
    ...headingRules(S.AT_OR_END, (i) => ` ${COMPASS[i]}`, absolute),
  ],
  [S.ALTITUDE]: [
    { key: '+', next: S.BY_AMOUNT, echo: ' up', hint: '+ up by', action: sense('up') },
    { key: 'c', next: S.BY_AMOUNT, echo: ' up', hint: 'c up by', action: sense('up') },
    { key: '-', next: S.BY_AMOUNT, echo: ' down', hint: '- down by', action: sense('down') },
    { key: 'd', next: S.BY_AMOUNT, echo: ' down', hint: 'd down by', action: sense('down') },
    {
      key: DIGIT,
      next: S.END,
      echo: ' to # 000 ft',
      hint: '0–9 thousand feet',
      action: altitudeTo,
    },
  ],
  [S.AT_OR_END]: [
    { key: '@', next: S.AT_BEACON, echo: ' at', hint: '@ at a beacon' },
    { key: 'a', next: S.AT_BEACON, echo: ' at', hint: 'a at a beacon' },
    { key: ENTER, next: DONE, echo: '', hint: '⏎ send' },
  ],
  [S.DELAY_BEACON]: [{ key: DIGIT, next: S.END, echo: ' #', hint: '0–9 beacon', action: delayAt }],
  [S.SIDE]: [
    { key: '@', next: S.AT_BEACON, echo: ' at', hint: '@ at a beacon' },
    { key: 'a', next: S.AT_BEACON, echo: ' at', hint: 'a at a beacon' },
    ...headingRules(S.AT_OR_END, (i) => ` by ${i * 45}°`, relative),
    { key: ENTER, next: DONE, echo: '', hint: '⏎ send' },
  ],
  [S.END]: [{ key: ENTER, next: DONE, echo: '', hint: '⏎ send' }],
  [S.TOWARD_NUMBER]: [
    { key: DIGIT, next: S.AT_OR_END, echo: ' #', hint: '0–9 number', action: towardNumber },
  ],
  [S.AT_BEACON]: [
    { key: 'b', next: S.DELAY_BEACON, echo: ' beacon', hint: 'b beacon' },
    { key: '*', next: S.DELAY_BEACON, echo: ' beacon', hint: '* beacon' },
  ],
  [S.BY_AMOUNT]: [
    {
      key: DIGIT,
      next: S.END,
      echo: ' by # 000 ft',
      hint: '0–9 thousand feet',
      action: altitudeBy,
    },
  ],
  [S.TOWARD]: [
    {
      key: 'b',
      next: S.TOWARD_NUMBER,
      echo: ' beacon',
      hint: 'b beacon',
      action: toward('beacon'),
    },
    {
      key: '*',
      next: S.TOWARD_NUMBER,
      echo: ' beacon',
      hint: '* beacon',
      action: toward('beacon'),
    },
    { key: 'e', next: S.TOWARD_NUMBER, echo: ' gate', hint: 'e gate', action: toward('gate') },
    {
      key: 'a',
      next: S.TOWARD_NUMBER,
      echo: ' runway',
      hint: 'a runway',
      action: toward('runway'),
    },
  ],
  // Skyloom: the hold takes a side; on its own it holds right, as the original circled.
  [S.HOLD]: [
    { key: 'l', next: S.AT_OR_END, echo: ' left', hint: 'l left', action: holdSide('left') },
    { key: 'r', next: S.AT_OR_END, echo: ' right', hint: 'r right', action: holdSide('right') },
    { key: '@', next: S.AT_BEACON, echo: ' at', hint: '@ at a beacon' },
    { key: 'a', next: S.AT_BEACON, echo: ' at', hint: 'a at a beacon' },
    { key: ENTER, next: DONE, echo: '', hint: '⏎ send' },
  ],
};

function matches(rule: Rule, key: string): boolean {
  if (rule.key === LETTER) return /^[A-Za-z]$/.test(key);
  if (rule.key === DIGIT) return /^[0-9]$/.test(key);
  if (rule.key === ENTER) return key === '\n';
  return rule.key === key;
}

// —— actions: each fills in the draft, or returns what is wrong in a few plain words ——

function choosePlane(reading: Reading, key: string, world: World): string | null {
  const plane = findPlane(world, key.toLowerCase().charCodeAt(0) - 97);
  if (!plane) return `There is no plane ${key} in the sky`;
  reading.draft = draftOf(plane);
  return null;
}

function draftOf(plane: Plane): Draft {
  return {
    letter: plane.letter,
    altitude: plane.altitude,
    targetAltitude: plane.targetAltitude,
    heading: plane.heading,
    targetHeading: plane.targetHeading,
    hold: plane.hold,
    status: plane.status,
    // Every heading order starts without a delay, as the original's copy did.
    waitForBeacon: null,
    onGround: plane.onGround,
    x: plane.x,
    y: plane.y,
  };
}

function mustFly(what: string): Action {
  return (reading) => {
    reading.part = 'heading';
    return reading.draft?.altitude === 0 ? `A plane on the ground cannot ${what}` : null;
  };
}

function setPart(part: OrderPart): Action {
  return (reading) => {
    reading.part = part;
    return null;
  };
}

function hold(reading: Reading): string | null {
  reading.part = 'heading';
  const draft = reading.draft!;
  if (draft.altitude === 0) return 'A plane on the ground cannot hold';
  draft.hold = 'right';
  return null;
}

function holdSide(side: Hold): Action {
  return (reading) => {
    reading.draft!.hold = side;
    return null;
  };
}

function status(next: PlaneStatus): Action {
  return (reading) => {
    reading.part = 'status';
    const draft = reading.draft!;
    if (draft.altitude === 0) return 'Only planes in the air can be marked';
    if (draft.status === next) return `It is ${next} already`;
    draft.status = next;
    return null;
  };
}

function nudge(side: 'left' | 'right', eighths: number): Action {
  return (reading) => {
    const draft = reading.draft!;
    reading.side = side;
    draft.hold = null;
    draft.targetHeading = toHeading(draft.heading + (side === 'left' ? -eighths : eighths));
    return null;
  };
}

function relative(reading: Reading, key: string): string | null {
  const draft = reading.draft!;
  const eighths = HEADING_KEYS.indexOf(key as (typeof HEADING_KEYS)[number]);
  draft.targetHeading = toHeading(draft.heading + (reading.side === 'left' ? -eighths : eighths));
  return null;
}

function absolute(reading: Reading, key: string): string | null {
  const draft = reading.draft!;
  draft.hold = null;
  draft.targetHeading = HEADING_KEYS.indexOf(key as (typeof HEADING_KEYS)[number]) as Heading;
  return null;
}

function sense(direction: 'up' | 'down'): Action {
  return (reading) => {
    reading.sense = direction;
    return null;
  };
}

function altitudeTo(reading: Reading, key: string): string | null {
  const draft = reading.draft!;
  const to = Number(key);
  if (draft.targetAltitude === to) return `It is already flying at ${to} 000 ft`;
  draft.targetAltitude = to;
  return null;
}

/** Skyloom fixes the original's "+0": it now says nothing would change, as was intended. */
function altitudeBy(reading: Reading, key: string): string | null {
  const draft = reading.draft!;
  const by = Number(key);
  if (by === 0) return 'That would not change its altitude';
  const to = draft.altitude + (reading.sense === 'up' ? by : -by);
  if (to < 0) return 'That is below the ground';
  if (to > CEILING) return 'That is above the 9 000 ft ceiling';
  draft.targetAltitude = to;
  return null;
}

function toward(kind: 'beacon' | 'gate' | 'runway'): Action {
  return (reading) => {
    reading.toward = kind;
    return null;
  };
}

function placeList(arena: Arena, kind: 'beacon' | 'gate' | 'runway') {
  return kind === 'beacon' ? arena.beacons : kind === 'gate' ? arena.gates : arena.runways;
}

function towardNumber(reading: Reading, key: string, world: World): string | null {
  const draft = reading.draft!;
  const kind = reading.toward!;
  const target = placeList(world.arena, kind)[Number(key)];
  if (!target) return `There is no ${kind} ${key}`;
  reading.towardIndex = Number(key);
  draft.hold = null;
  draft.targetHeading = headingToward(target.x - draft.x, target.y - draft.y);
  return null;
}

/**
 * "At beacon": keep the heading until the beacon, then turn. The beacon has to lie ahead along
 * the current heading; with a "toward" order the turn is aimed from the beacon.
 */
function delayAt(reading: Reading, key: string, world: World): string | null {
  const draft = reading.draft!;
  const index = Number(key);
  const beacon = world.arena.beacons[index];
  if (!beacon) return `There is no beacon ${key}`;
  const step = STEPS[draft.heading]!;
  if (Math.sign(beacon.x - draft.x) !== step.x || Math.sign(beacon.y - draft.y) !== step.y) {
    return 'That beacon is not ahead of the plane';
  }
  draft.waitForBeacon = index;
  if (reading.toward && reading.towardIndex !== null) {
    const target = placeList(world.arena, reading.toward)[reading.towardIndex]!;
    if (target.x === beacon.x && target.y === beacon.y) return 'It would be there already';
    draft.targetHeading = headingToward(target.x - beacon.x, target.y - beacon.y);
    if (draft.targetHeading === draft.heading) return 'It is already flying that way';
  }
  return null;
}

// —— reading a line ——

export interface Echo {
  /** The accepted keys, as words. */
  words: string;
  /** Where each key's words start in `words`, to underline the one that failed. */
  spans: { from: number; to: number }[];
}

export type LineState =
  | { kind: 'reading'; echo: Echo; choices: readonly string[] }
  | { kind: 'shell' }
  | { kind: 'tick'; echo: Echo }
  | { kind: 'order'; echo: Echo; order: Order }
  | {
      kind: 'error';
      /** 'key': the key does not belong here (the original beeped and ignored it); 'rule': the
       * order is well formed but cannot be given (the original refused the whole line). */
      reason: 'key' | 'rule';
      echo: Echo;
      at: number;
      message: string;
      choices: readonly string[];
    };

/**
 * Reads a typed line key by key. Keys the current state does not accept are rejected with the
 * choices that would have been accepted; the original only beeped. A finished line that names a
 * plane becomes an order; an empty line asks for the next tick at once.
 */
export function readLine(world: World, typed: string): LineState {
  const reading: Reading = {
    draft: null,
    part: null,
    side: null,
    sense: null,
    toward: null,
    towardIndex: null,
  };
  let state: number = S.START;
  let words = '';
  const spans: Echo['spans'] = [];
  const echo = () => ({ words, spans: [...spans] });

  for (let i = 0; i < typed.length; i++) {
    const key = typed[i]!;
    const rules = TABLE[state]!;
    // `!` once opened a real shell and stopped the clock; Skyloom keeps the loophole as a wink.
    if (key === '!') return { kind: 'shell' };
    if (key === '?') return { kind: 'reading', echo: echo(), choices: rules.map((r) => r.hint) };
    const rule = rules.find((r) => matches(r, key));
    if (!rule) {
      return {
        kind: 'error',
        reason: 'key',
        echo: echo(),
        at: i,
        message: key === '\n' ? 'That order is not finished' : `“${key}” does not fit here`,
        choices: rules.map((r) => r.hint),
      };
    }
    const problem = rule.action?.(reading, key, world) ?? null;
    const from = words.length;
    words += rule.echo.replace('#', key);
    spans.push({ from, to: words.length });
    if (problem) {
      return { kind: 'error', reason: 'rule', echo: echo(), at: i, message: problem, choices: [] };
    }
    state = rule.next;
    if (state === DONE) {
      if (!reading.draft) return { kind: 'tick', echo: echo() };
      return {
        kind: 'order',
        echo: echo(),
        order: {
          letter: reading.draft.letter,
          part: reading.part ?? 'heading',
          draft: reading.draft,
        },
      };
    }
  }
  return { kind: 'reading', echo: echo(), choices: TABLE[state]!.map((r) => r.hint) };
}

/**
 * Gives an order. Only the part the order is about changes; a heading order replaces the drawn
 * route and any hold or delay. Returns false when the plane has gone in the meantime.
 */
export function giveOrder(world: World, order: Order): boolean {
  const plane = findPlane(world, order.letter);
  if (!plane) return false;
  const { draft } = order;
  if (order.part === 'altitude') plane.targetAltitude = draft.targetAltitude;
  else if (order.part === 'status') plane.status = draft.status;
  else {
    plane.targetHeading = draft.targetHeading;
    plane.hold = draft.hold;
    plane.waitForBeacon = draft.waitForBeacon;
    plane.route = [];
  }
  return true;
}
