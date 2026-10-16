import type { Patch, Voice } from '@usr-games/kit';
import type { BoardId } from '../boards/themes';
import { hz } from './patches';

/**
 * Each board's tune, written for this game: a lilting waltz on a marimba for the harbour, slow
 * arpeggios that hang in the air for the colony, and a music box for the pop-up book. A tune is
 * a list of bars; the player plays one bar at a time so pausing stops it within a bar, and rests
 * between repeats so it never nags.
 */

/** A note: MIDI pitch (0 rests), when it starts and how long it lasts, in beats. */
type Note = readonly [pitch: number, at: number, beats: number];

export interface Tune {
  readonly beatsPerBar: number;
  readonly tempo: number;
  /** Bars of melody and accompaniment, each a list of notes. */
  readonly bars: readonly (readonly Note[])[];
  /** Silent bars after the tune before it starts again. */
  readonly rest: number;
  readonly voice: (midi: number, delay: number, seconds: number, gain: number) => Voice[];
  readonly gain: number;
}

const marimba = (midi: number, delay: number, seconds: number, gain: number): Voice[] => [
  {
    wave: 'triangle',
    frequency: hz(midi),
    delay,
    duration: Math.min(0.9, seconds + 0.3),
    attack: 0.004,
    decay: 0.25,
    sustain: 0.2,
    release: 0.3,
    gain,
  },
  {
    wave: 'sine',
    frequency: hz(midi + 24),
    delay,
    duration: 0.15,
    attack: 0.002,
    decay: 0.1,
    sustain: 0,
    gain: gain * 0.15,
  },
];

const glass = (midi: number, delay: number, seconds: number, gain: number): Voice[] => [
  {
    wave: 'sine',
    frequency: hz(midi),
    delay,
    duration: seconds + 1.4,
    attack: 0.12,
    decay: 0.6,
    sustain: 0.5,
    release: 1.2,
    gain,
  },
];

/** A music box's tooth: the fundamental, a soft octave and a slightly sour twelfth. */
const musicBox = (midi: number, delay: number, _seconds: number, gain: number): Voice[] => [
  {
    wave: 'sine',
    frequency: hz(midi),
    delay,
    duration: 1.1,
    attack: 0.002,
    decay: 0.7,
    sustain: 0,
    release: 0.4,
    gain,
  },
  {
    wave: 'sine',
    frequency: hz(midi) * 2,
    delay,
    duration: 0.6,
    attack: 0.002,
    decay: 0.4,
    sustain: 0,
    release: 0.2,
    gain: gain * 0.3,
  },
  {
    wave: 'sine',
    frequency: hz(midi) * 3.01,
    delay,
    duration: 0.3,
    attack: 0.002,
    decay: 0.2,
    sustain: 0,
    gain: gain * 0.1,
  },
];

/** Three-four on the quay, in D: melody above a bass on the beat and the chord after it. */
const TIDE_WALTZ: Tune = {
  beatsPerBar: 3,
  tempo: 104,
  rest: 3,
  gain: 0.06,
  voice: marimba,
  bars: (
    [
      [
        [74, 0, 1],
        [78, 1, 1],
        [81, 2, 1],
      ],
      [
        [83, 0, 2],
        [81, 2, 1],
      ],
      [
        [79, 0, 1],
        [78, 1, 1],
        [76, 2, 1],
      ],
      [[78, 0, 3]],
      [
        [76, 0, 1],
        [78, 1, 1],
        [79, 2, 1],
      ],
      [
        [81, 0, 2],
        [78, 2, 1],
      ],
      [
        [76, 0, 1],
        [74, 1, 1],
        [73, 2, 1],
      ],
      [[74, 0, 3]],
    ] as Note[][]
  ).map((melody, bar) => {
    const roots = [50, 55, 52, 50, 45, 50, 45, 50];
    const root = roots[bar]!;
    return [...melody, [root, 0, 1], [root + 12, 1, 1], [root + 16, 2, 1]] as Note[];
  }),
};

/** Slow light over the ring: four chords, each picked out upwards and left to ring. */
const ORBIT_DRIFT: Tune = {
  beatsPerBar: 4,
  tempo: 66,
  rest: 2,
  gain: 0.05,
  voice: glass,
  bars: [
    [64, 68, 71, 75],
    [61, 64, 68, 71],
    [57, 61, 64, 68],
    [59, 63, 66, 71],
  ].flatMap((chord) => {
    const up = chord.map((pitch, i): Note => [pitch, i, 1]);
    const back = [...chord].reverse().map((pitch, i): Note => [pitch + 12, i, 1]);
    return [[...up, [chord[0]! - 12, 0, 4]], back];
  }),
};

/** A music box on the desk, in C: a little tune turned by hand. */
const BOX_TUNE: Tune = {
  beatsPerBar: 3,
  tempo: 92,
  rest: 2,
  gain: 0.07,
  voice: musicBox,
  bars: (
    [
      [
        [79, 0, 1],
        [84, 1, 1],
        [88, 2, 1],
      ],
      [
        [86, 0, 2],
        [84, 2, 1],
      ],
      [
        [81, 0, 1],
        [84, 1, 1],
        [89, 2, 1],
      ],
      [[88, 0, 3]],
      [
        [89, 0, 1],
        [88, 1, 1],
        [86, 2, 1],
      ],
      [
        [84, 0, 1],
        [83, 1, 1],
        [84, 2, 1],
      ],
      [
        [86, 0, 1],
        [79, 1, 1],
        [83, 2, 1],
      ],
      [[84, 0, 3]],
    ] as Note[][]
  ).map((melody, bar) => [...melody, [[60, 67, 65, 60, 62, 69, 67, 60][bar]!, 0, 3]] as Note[]),
};

export const TUNES: Readonly<Record<BoardId, Tune>> = {
  harbour: TIDE_WALTZ,
  colony: ORBIT_DRIFT,
  popup: BOX_TUNE,
};

export function barSeconds(tune: Tune): number {
  return (tune.beatsPerBar * 60) / tune.tempo;
}

/** One bar of a tune as a patch; the bass and the chord sit under the melody. */
export function barPatch(tune: Tune, bar: number): Patch {
  const beat = 60 / tune.tempo;
  const notes = tune.bars[bar] ?? [];
  return {
    name: `tune-${bar}`,
    gain: tune.gain,
    voices: notes.flatMap(([pitch, at, beats]) => {
      if (pitch === 0) return [];
      // Lower notes are the accompaniment: softer than the tune.
      const gain = pitch < 60 ? 0.28 : 0.45;
      return tune.voice(pitch, at * beat, beats * beat, gain);
    }),
  };
}
