import type { Patch, Voice } from '@usr-games/kit';
import type { BoardId } from '../boards/themes';

/**
 * The table's sounds as patches for the kit's synthesiser: nothing recorded, everything built
 * from oscillators and noise. Each board has its own bed (surf and gulls, the colony's hum, a
 * quiet study with a clock) and its own voice for the big moments; the small sounds of play
 * (dice, coins, cards, a gavel) are shared. All of them sit low under the Hall's volume.
 */

/** The frequency of a MIDI note: 69 is the A above middle C. */
export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A short percussive tick of filtered noise. */
function tick(delay: number, gain: number, lowpass: number, duration = 0.03): Voice {
  return {
    wave: 'noise',
    delay,
    duration,
    attack: 0.001,
    decay: duration * 0.8,
    sustain: 0,
    lowpass,
    gain,
  };
}

/** A plucked, bell-like note: quick attack, a decay that rings off. */
export function pluck(
  midi: number,
  delay: number,
  gain: number,
  ring = 0.5,
  wave: Voice['wave'] = 'triangle',
): Voice {
  return {
    wave,
    frequency: hz(midi),
    delay,
    duration: ring,
    attack: 0.004,
    decay: ring * 0.6,
    sustain: 0.15,
    release: ring * 0.4,
    gain,
  };
}

// —— the beds under each board ——

export const BEDS: Readonly<Record<BoardId, Patch>> = {
  // Surf on the breakwater: a low wash of noise with a little hiss on top.
  harbour: {
    name: 'harbour-surf',
    gain: 0.1,
    voices: [
      { wave: 'noise', duration: 3, attack: 2, sustain: 1, release: 1.5, lowpass: 420, gain: 0.55 },
      {
        wave: 'noise',
        duration: 3,
        attack: 2.5,
        sustain: 1,
        release: 1.5,
        lowpass: 1500,
        gain: 0.08,
      },
    ],
  },
  // Air handlers and a reactor far away: two low sines a hair apart, and moving air.
  colony: {
    name: 'colony-hum',
    gain: 0.1,
    voices: [
      { wave: 'sine', frequency: 55, duration: 3, attack: 2, sustain: 1, release: 1.5, gain: 0.5 },
      {
        wave: 'sine',
        frequency: 110.6,
        duration: 3,
        attack: 2.4,
        sustain: 1,
        release: 1.5,
        gain: 0.22,
      },
      {
        wave: 'triangle',
        frequency: 164.8,
        duration: 3,
        attack: 3,
        sustain: 1,
        release: 1.5,
        gain: 0.05,
        lowpass: 600,
      },
      { wave: 'noise', duration: 3, attack: 2, sustain: 1, release: 1.5, lowpass: 320, gain: 0.18 },
    ],
  },
  // A quiet study: the room's own hush under the reading lamp.
  popup: {
    name: 'popup-study',
    gain: 0.07,
    voices: [
      { wave: 'noise', duration: 3, attack: 2, sustain: 1, release: 1.5, lowpass: 260, gain: 0.4 },
    ],
  },
};

/** The sounds that come now and then over a bed, with how often (seconds between, at least and at most). */
export const CALLS: Readonly<
  Record<BoardId, readonly { patch: Patch; every: [number, number] }[]>
> = {
  harbour: [
    {
      // A wave breaking on the seawall.
      every: [5, 9],
      patch: {
        name: 'wave',
        gain: 0.09,
        voices: [
          {
            wave: 'noise',
            duration: 3.2,
            attack: 1.1,
            decay: 1.8,
            sustain: 0.1,
            release: 0.6,
            lowpass: 700,
            gain: 0.6,
          },
          {
            wave: 'noise',
            delay: 0.9,
            duration: 1.6,
            attack: 0.2,
            decay: 1.2,
            sustain: 0,
            lowpass: 2600,
            gain: 0.12,
          },
        ],
      },
    },
    {
      // Two gulls calling across the harbour.
      every: [14, 30],
      patch: {
        name: 'gulls',
        gain: 0.05,
        voices: [
          {
            wave: 'sine',
            frequency: 1350,
            glideTo: 1900,
            duration: 0.18,
            attack: 0.02,
            release: 0.08,
            gain: 0.5,
          },
          {
            wave: 'sine',
            frequency: 1800,
            glideTo: 1250,
            delay: 0.2,
            duration: 0.3,
            attack: 0.02,
            release: 0.12,
            gain: 0.45,
          },
          {
            wave: 'sine',
            frequency: 1500,
            glideTo: 2050,
            delay: 0.75,
            duration: 0.16,
            attack: 0.02,
            release: 0.08,
            gain: 0.3,
          },
        ],
      },
    },
    {
      // A ferry's horn out on the water.
      every: [55, 90],
      patch: {
        name: 'ferry-horn',
        gain: 0.05,
        voices: [
          {
            wave: 'sawtooth',
            frequency: 98,
            duration: 1.6,
            attack: 0.12,
            sustain: 0.9,
            release: 0.5,
            lowpass: 420,
            gain: 0.5,
          },
          {
            wave: 'sawtooth',
            frequency: 147,
            duration: 1.6,
            attack: 0.14,
            sustain: 0.9,
            release: 0.5,
            lowpass: 520,
            gain: 0.25,
          },
        ],
      },
    },
  ],
  colony: [
    {
      // A console somewhere answering a console.
      every: [9, 20],
      patch: {
        name: 'beeps',
        gain: 0.04,
        voices: [
          {
            wave: 'sine',
            frequency: 1318.5,
            duration: 0.07,
            attack: 0.003,
            release: 0.03,
            gain: 0.5,
          },
          {
            wave: 'sine',
            frequency: 1760,
            delay: 0.11,
            duration: 0.07,
            attack: 0.003,
            release: 0.03,
            gain: 0.4,
          },
        ],
      },
    },
    {
      // An airlock cycling.
      every: [30, 60],
      patch: {
        name: 'airlock',
        gain: 0.05,
        voices: [
          {
            wave: 'noise',
            duration: 1.2,
            attack: 0.05,
            decay: 1,
            sustain: 0.1,
            lowpass: 3200,
            gain: 0.5,
          },
          {
            wave: 'sine',
            frequency: 220,
            glideTo: 180,
            delay: 1.1,
            duration: 0.25,
            attack: 0.01,
            release: 0.1,
            gain: 0.4,
          },
        ],
      },
    },
  ],
  popup: [
    {
      // A page turned somewhere in the study.
      every: [16, 34],
      patch: {
        name: 'page',
        gain: 0.06,
        voices: [
          tick(0, 0.5, 2600, 0.22),
          tick(0.16, 0.35, 3400, 0.18),
          tick(0.3, 0.2, 1800, 0.12),
        ],
      },
    },
  ],
};

// —— the small sounds of play ——

export const DICE: Patch = {
  name: 'dice',
  gain: 0.22,
  voices: [0, 0.07, 0.12, 0.2, 0.26, 0.37, 0.45, 0.6].map((t, i) =>
    tick(t, 0.6 - i * 0.05, 2400 - i * 120, 0.025),
  ),
};

export const STEP: Patch = {
  name: 'step',
  gain: 0.07,
  voices: [
    {
      wave: 'sine',
      frequency: 660,
      glideTo: 520,
      duration: 0.05,
      attack: 0.002,
      release: 0.03,
      gain: 0.5,
    },
  ],
};

/** Coins changing hands: brighter when they come to a person at the table. */
export function coinsPatch(toPerson: boolean, gain: number): Patch {
  const base = toPerson ? 88 : 81;
  return {
    name: 'coins',
    gain,
    voices: [0, 0.06, 0.13, 0.19].map((t, i) =>
      pluck(base + [0, 4, 7, 12][i]!, t, 0.35, 0.22, 'sine'),
    ),
  };
}

export const SALARY: Patch = {
  name: 'salary',
  gain: 0.16,
  voices: [pluck(84, 0, 0.4, 0.3, 'sine'), pluck(91, 0.09, 0.35, 0.4, 'sine')],
};

export const CARD: Patch = {
  name: 'card',
  gain: 0.12,
  voices: [tick(0, 0.5, 3000, 0.12), tick(0.1, 0.4, 4200, 0.16)],
};

export const GAVEL: Patch = {
  name: 'gavel',
  gain: 0.2,
  voices: [
    tick(0, 0.6, 1200, 0.05),
    {
      wave: 'sine',
      frequency: 190,
      glideTo: 150,
      duration: 0.12,
      attack: 0.002,
      release: 0.06,
      gain: 0.5,
    },
  ],
};

export const BID: Patch = {
  name: 'bid',
  gain: 0.1,
  voices: [
    { wave: 'triangle', frequency: 880, duration: 0.06, attack: 0.002, release: 0.03, gain: 0.4 },
  ],
};

export const LOCKUP: Patch = {
  name: 'lockup',
  gain: 0.15,
  voices: [
    {
      wave: 'square',
      frequency: 140,
      glideTo: 110,
      duration: 0.22,
      attack: 0.002,
      release: 0.1,
      lowpass: 900,
      gain: 0.4,
    },
    tick(0, 0.5, 2000, 0.08),
    tick(0.12, 0.3, 1600, 0.06),
  ],
};

export const FREE: Patch = {
  name: 'free',
  gain: 0.14,
  voices: [pluck(76, 0, 0.35, 0.25), pluck(81, 0.08, 0.35, 0.3)],
};

export const DEBT: Patch = {
  name: 'debt',
  gain: 0.14,
  voices: [
    { wave: 'sine', frequency: 233, duration: 0.24, attack: 0.01, release: 0.1, gain: 0.5 },
    {
      wave: 'sine',
      frequency: 185,
      delay: 0.22,
      duration: 0.34,
      attack: 0.01,
      release: 0.16,
      gain: 0.5,
    },
  ],
};

export const DEAL: Patch = {
  name: 'deal',
  gain: 0.16,
  voices: [
    ...[72, 76, 79].map((n) => pluck(n, 0, 0.3, 0.5)),
    ...[74, 77, 81].map((n) => pluck(n, 0.16, 0.25, 0.4)),
    ...[76, 79, 84].map((n) => pluck(n, 0.3, 0.3, 0.6)),
  ],
};

export const NO_DEAL: Patch = {
  name: 'no-deal',
  gain: 0.1,
  voices: [
    {
      wave: 'triangle',
      frequency: 520,
      glideTo: 380,
      duration: 0.14,
      attack: 0.004,
      release: 0.06,
      gain: 0.4,
    },
  ],
};

export const OUT: Patch = {
  name: 'out',
  gain: 0.14,
  voices: [76, 72, 67].map((n, i) => pluck(n, i * 0.16, 0.35, 0.45, 'sine')),
};

/** A district finished: three notes climbing. */
export const DISTRICT: Patch = {
  name: 'district',
  gain: 0.18,
  voices: [72, 76, 79, 84].map((n, i) => pluck(n, i * 0.1, 0.35, i === 3 ? 0.9 : 0.35)),
};

export const SELECT: Patch = {
  name: 'select',
  gain: 0.12,
  voices: [
    {
      wave: 'triangle',
      frequency: 660,
      glideTo: 880,
      duration: 0.08,
      attack: 0.004,
      release: 0.04,
      gain: 0.35,
    },
  ],
};

export const BACK: Patch = {
  name: 'back',
  gain: 0.12,
  voices: [
    {
      wave: 'triangle',
      frequency: 700,
      glideTo: 470,
      duration: 0.09,
      attack: 0.004,
      release: 0.05,
      gain: 0.3,
    },
  ],
};

// —— each board's voice for building and for its big moments ——

export const BUILD: Readonly<Record<BoardId, Patch>> = {
  // Hammer taps on a scaffold.
  harbour: {
    name: 'hammer',
    gain: 0.16,
    voices: [0, 0.16, 0.32].flatMap((t) => [
      tick(t, 0.5, 1500, 0.04),
      {
        wave: 'sine',
        frequency: 240,
        glideTo: 200,
        delay: t,
        duration: 0.06,
        attack: 0.002,
        release: 0.03,
        gain: 0.35,
      } as Voice,
    ]),
  },
  // A builder drone's servo whirring up.
  colony: {
    name: 'servo',
    gain: 0.12,
    voices: [
      {
        wave: 'sawtooth',
        frequency: 260,
        glideTo: 620,
        duration: 0.42,
        attack: 0.02,
        sustain: 0.8,
        release: 0.1,
        lowpass: 1400,
        gain: 0.3,
      },
      {
        wave: 'sine',
        frequency: 1320,
        delay: 0.42,
        duration: 0.08,
        attack: 0.002,
        release: 0.04,
        gain: 0.3,
      },
    ],
  },
  // A sheet of card folding up and creasing.
  popup: {
    name: 'fold',
    gain: 0.16,
    voices: [
      tick(0, 0.45, 2200, 0.24),
      tick(0.22, 0.6, 900, 0.06),
      {
        wave: 'sine',
        frequency: 150,
        delay: 0.22,
        duration: 0.08,
        attack: 0.002,
        release: 0.04,
        gain: 0.3,
      },
    ],
  },
};

export const BUY: Readonly<Record<BoardId, Patch>> = {
  harbour: coinsPatch(true, 0.14),
  colony: {
    name: 'stamp-colony',
    gain: 0.12,
    voices: [
      { wave: 'sine', frequency: 880, duration: 0.07, attack: 0.002, release: 0.03, gain: 0.4 },
      {
        wave: 'sine',
        frequency: 1318.5,
        delay: 0.08,
        duration: 0.12,
        attack: 0.002,
        release: 0.06,
        gain: 0.35,
      },
    ],
  },
  // A rubber stamp on a deed.
  popup: {
    name: 'stamp',
    gain: 0.2,
    voices: [
      tick(0, 0.7, 700, 0.07),
      { wave: 'sine', frequency: 120, duration: 0.1, attack: 0.002, release: 0.05, gain: 0.5 },
    ],
  },
};

/** The first landmark in a district: each board's flourish. */
export const LANDMARK: Readonly<Record<BoardId, Patch>> = {
  // A ship's horn, then a bright chord across the water.
  harbour: {
    name: 'harbour-landmark',
    gain: 0.2,
    voices: [
      {
        wave: 'sawtooth',
        frequency: 110,
        duration: 0.9,
        attack: 0.08,
        sustain: 0.9,
        release: 0.3,
        lowpass: 500,
        gain: 0.3,
      },
      ...[67, 71, 74, 79, 83].map((n, i) => pluck(n, 0.7 + i * 0.09, 0.3, 1.1)),
    ],
  },
  // A sweep up through the dome, and a chord that hangs.
  colony: {
    name: 'colony-landmark',
    gain: 0.18,
    voices: [
      {
        wave: 'sine',
        frequency: 220,
        glideTo: 880,
        duration: 0.8,
        attack: 0.05,
        sustain: 0.8,
        release: 0.2,
        gain: 0.3,
      },
      ...[64, 68, 71, 75].map((n) => ({ ...pluck(n, 0.75, 0.22, 1.6, 'sine'), attack: 0.08 })),
    ],
  },
  // A music box running up its comb.
  popup: {
    name: 'popup-landmark',
    gain: 0.2,
    voices: [72, 76, 79, 84, 88, 91, 96].map((n, i) => pluck(n, i * 0.08, 0.3, 0.9, 'sine')),
  },
};

/** The end of a game: a fanfare for a win, a warm close otherwise. Never a sad trombone. */
export function finale(won: boolean): Patch {
  return won
    ? {
        name: 'win',
        gain: 0.2,
        voices: [
          ...[72, 76, 79].map((n, i) => pluck(n, i * 0.12, 0.35, 0.3)),
          ...[72, 76, 79, 84].map((n) => pluck(n, 0.42, 0.28, 1.4)),
        ],
      }
    : {
        name: 'close',
        gain: 0.16,
        voices: [
          ...[69, 72, 76].map((n, i) => pluck(n, i * 0.14, 0.3, 0.4, 'sine')),
          ...[65, 69, 72, 77].map((n) => pluck(n, 0.5, 0.22, 1.3, 'sine')),
        ],
      };
}
