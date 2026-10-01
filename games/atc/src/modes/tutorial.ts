import { FIRST_LIGHT } from '../arenas/ours';
import { CLASSIC_RULES, type ScriptedArrival, type SkyRules } from '../engine/world';

/**
 * The tutorial: four planes on First Light, about two minutes. One leaves by a gate, one lands,
 * then two more are timed to meet over the beacon, so the conflict ring appears and a change of
 * height parts them. The arrivals are scripted; nothing else comes.
 */

export const TUTORIAL_ARENA = FIRST_LIGHT;

/** c needs nine moves from E0 to the beacon and d needs four from E2, so d enters five ticks later. */
const MEETING_TICK = 23;

export const TUTORIAL_ARRIVALS: readonly ScriptedArrival[] = [
  // a: in from the north, out by the western gate.
  {
    tick: 1,
    kind: 'jet',
    origin: { kind: 'gate', index: 2 },
    destination: { kind: 'gate', index: 0 },
  },
  // B: a prop straight in from the east, to land.
  {
    tick: 3,
    kind: 'prop',
    origin: { kind: 'gate', index: 1 },
    destination: { kind: 'runway', index: 0 },
  },
  // c: in from the west along the airway, bound for the east.
  {
    tick: MEETING_TICK - 9,
    kind: 'jet',
    origin: { kind: 'gate', index: 0 },
    destination: { kind: 'gate', index: 1 },
  },
  // d: in from the north, reaching the beacon on the same tick as c, bound for the runway.
  {
    tick: MEETING_TICK - 4,
    kind: 'jet',
    origin: { kind: 'gate', index: 2 },
    destination: { kind: 'runway', index: 0 },
  },
];

export const TUTORIAL_RULES: SkyRules = { ...CLASSIC_RULES, arrivals: TUTORIAL_ARRIVALS };

export type TutorialStep =
  'route-to-gate' | 'let-time-run' | 'route-to-runway' | 'conflict' | 'part-them' | 'finish';

export interface TutorialStepText {
  step: TutorialStep;
  title: string;
  /** `{pair}` is replaced by the two planes in conflict, such as "c and d". */
  body: string;
}

/** What the tutorial says at each step, in Skyloom's own words. */
export const TUTORIAL_TEXT: readonly TutorialStepText[] = [
  {
    step: 'route-to-gate',
    title: 'Weave a route',
    body: 'This is a, a jet. Drag from it to the gate E0 on the left and let go: that is its route.',
  },
  {
    step: 'let-time-run',
    title: 'Let the sky move',
    body: 'Planes move one cell a tick; props every other tick. Press Space to move on a tick now.',
  },
  {
    step: 'route-to-runway',
    title: 'Land on the runway',
    body: 'B wants runway A0. Drag its route onto the runway: it will glide down and touch at 0 ft.',
  },
  {
    step: 'conflict',
    title: 'A ring means trouble',
    body: '{pair} are closing on each other, and the ring counts the ticks left. Planes must keep more than a cell apart, or two thousand feet.',
  },
  {
    step: 'part-them',
    title: 'Change height',
    body: 'Click one of them (or press Shift and its letter), then press 5 or scroll over it. Once they are far enough apart, the ring goes away.',
  },
  {
    step: 'finish',
    title: 'That is the job',
    body: 'Route the rest home the same way: out by their gates, or down onto the runway.',
  },
];
