import type { Patch, Synth, Voice } from '@usr-games/kit';

/**
 * Thirteen Down's sounds, synthesised and quiet: the riffle of a deal, a card laid down, a soft
 * chime that climbs a scale as a lotus fills, a chord when the four bloom together, a low knock
 * when a card cannot go where it was asked. No files, and nothing that rings like a till.
 */

export interface TableSound {
  shuffle(): void;
  deal(cards: number): void;
  place(): void;
  turnOver(): void;
  /** A card home: `petal` 0–12 climbs the scale. */
  home(petal: number): void;
  /** The king-to-ace turn on a foundation. */
  wrap(): void;
  bloom(): void;
  finish(): void;
  nope(): void;
  insight(on: boolean): void;
  /** A Bank charge or purchase: a pen stroke in the account book. */
  ledger(): void;
  undo(): void;
  hint(): void;
}

/** A pentatonic scale over two octaves, so any run of petals sounds like a tune. */
const SCALE = [392, 440, 494, 587, 659, 784, 880, 988, 1175, 1319, 1568, 1760, 1976];

function snap(delay: number, gain: number, cutoff: number): Voice {
  return {
    wave: 'noise',
    delay,
    duration: 0.045,
    attack: 0.001,
    decay: 0.03,
    sustain: 0,
    lowpass: cutoff,
    gain,
  };
}

const RIFFLE: Patch = {
  name: 'riffle',
  gain: 0.28,
  voices: Array.from({ length: 14 }, (_, i) => snap(i * 0.022, 0.5 - i * 0.015, 3200 + i * 90)),
};

function dealPatch(cards: number): Patch {
  return {
    name: 'deal',
    gain: 0.26,
    voices: Array.from({ length: Math.max(1, cards) }, (_, i) => snap(i * 0.05, 0.55, 2600)),
  };
}

const PLACE: Patch = {
  name: 'place',
  gain: 0.28,
  voices: [
    {
      wave: 'noise',
      duration: 0.05,
      attack: 0.001,
      decay: 0.035,
      sustain: 0,
      lowpass: 1500,
      gain: 0.7,
    },
    {
      wave: 'sine',
      frequency: 240,
      glideTo: 170,
      duration: 0.07,
      attack: 0.002,
      decay: 0.06,
      sustain: 0,
      gain: 0.25,
    },
  ],
};

const TURN_OVER: Patch = {
  name: 'turn-over',
  gain: 0.22,
  voices: [
    {
      wave: 'noise',
      duration: 0.32,
      attack: 0.04,
      decay: 0.2,
      sustain: 0.2,
      release: 0.08,
      lowpass: 1800,
      gain: 0.5,
    },
    ...Array.from({ length: 6 }, (_, i) => snap(0.05 + i * 0.03, 0.3, 2400)),
  ],
};

function chime(frequency: number, gain = 0.3): Patch {
  return {
    name: 'chime',
    gain,
    voices: [
      { wave: 'sine', frequency, duration: 0.6, attack: 0.004, decay: 0.5, sustain: 0, gain: 0.5 },
      {
        wave: 'sine',
        frequency: frequency * 2,
        duration: 0.35,
        attack: 0.004,
        decay: 0.3,
        sustain: 0,
        gain: 0.12,
      },
      {
        wave: 'triangle',
        frequency: frequency * 3,
        duration: 0.18,
        attack: 0.002,
        decay: 0.15,
        sustain: 0,
        gain: 0.05,
      },
    ],
  };
}

const WRAP: Patch = {
  name: 'wrap',
  gain: 0.22,
  voices: [784, 988, 1319, 1568].map((frequency, i) => ({
    wave: 'sine' as const,
    frequency,
    delay: i * 0.05,
    duration: 0.4,
    attack: 0.004,
    decay: 0.35,
    sustain: 0,
    gain: 0.3,
  })),
};

const BLOOM: Patch = {
  name: 'bloom',
  gain: 0.3,
  voices: [392, 494, 587, 784, 988].map((frequency, i) => ({
    wave: i % 2 === 0 ? ('sine' as const) : ('triangle' as const),
    frequency,
    delay: i * 0.06,
    duration: 1.6,
    attack: 0.02,
    decay: 0.6,
    sustain: 0.3,
    release: 0.8,
    gain: 0.22,
    lowpass: 3200,
  })),
};

const FINISH: Patch = {
  name: 'finish',
  gain: 0.26,
  voices: [523, 659, 784, 1047, 1319, 1568, 2093].map((frequency, i) => ({
    wave: 'sine' as const,
    frequency,
    delay: i * 0.09,
    duration: 0.9,
    attack: 0.006,
    decay: 0.7,
    sustain: 0,
    gain: 0.28,
  })),
};

const NOPE: Patch = {
  name: 'nope',
  gain: 0.24,
  voices: [
    {
      wave: 'sine',
      frequency: 150,
      glideTo: 110,
      duration: 0.14,
      attack: 0.003,
      decay: 0.12,
      sustain: 0,
      gain: 0.6,
    },
    {
      wave: 'noise',
      duration: 0.04,
      attack: 0.001,
      decay: 0.03,
      sustain: 0,
      lowpass: 700,
      gain: 0.3,
    },
  ],
};

const PEN: Patch = {
  name: 'pen',
  gain: 0.16,
  voices: [
    {
      wave: 'noise',
      duration: 0.12,
      attack: 0.01,
      decay: 0.08,
      sustain: 0.2,
      release: 0.02,
      lowpass: 5200,
      gain: 0.4,
    },
    {
      wave: 'noise',
      delay: 0.13,
      duration: 0.07,
      attack: 0.005,
      decay: 0.05,
      sustain: 0,
      lowpass: 4800,
      gain: 0.3,
    },
  ],
};

const UNDO: Patch = {
  name: 'undo',
  gain: 0.22,
  voices: [
    {
      wave: 'triangle',
      frequency: 520,
      glideTo: 380,
      duration: 0.11,
      attack: 0.004,
      release: 0.05,
      gain: 0.3,
    },
  ],
};

const HINT: Patch = {
  name: 'hint',
  gain: 0.22,
  voices: [
    {
      wave: 'sine',
      frequency: 659,
      duration: 0.25,
      attack: 0.004,
      decay: 0.2,
      sustain: 0,
      gain: 0.35,
    },
    {
      wave: 'sine',
      frequency: 988,
      delay: 0.1,
      duration: 0.3,
      attack: 0.004,
      decay: 0.25,
      sustain: 0,
      gain: 0.3,
    },
  ],
};

export function createTableSound(synth: Synth, enabled: () => boolean): TableSound {
  const play = (patch: Patch) => {
    if (enabled()) synth.play(patch);
  };
  return {
    shuffle: () => play(RIFFLE),
    deal: (cards) => play(dealPatch(cards)),
    place: () => play(PLACE),
    turnOver: () => play(TURN_OVER),
    home: (petal) => play(chime(SCALE[Math.max(0, Math.min(12, petal))]!)),
    wrap: () => play(WRAP),
    bloom: () => play(BLOOM),
    finish: () => play(FINISH),
    nope: () => play(NOPE),
    insight: (on) => play(chime(on ? 880 : 659, 0.18)),
    ledger: () => play(PEN),
    undo: () => play(UNDO),
    hint: () => play(HINT),
  };
}

/** For screens and tests with nothing to hear. */
export const SILENT: TableSound = {
  shuffle() {},
  deal() {},
  place() {},
  turnOver() {},
  home() {},
  wrap() {},
  bloom() {},
  finish() {},
  nope() {},
  insight() {},
  ledger() {},
  undo() {},
  hint() {},
};
