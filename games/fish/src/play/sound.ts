import type { Drone, Patch, Synth, Voice } from '@usr-games/kit';

/**
 * The pond's sounds, synthesised and quiet: water lapping under everything, the soft snap of a
 * card handed over, a reel's click-click-click and a splash for every cast, a bloop for "Go
 * fish!", and a chime that rises for each book (higher and brighter when it turns golden). No
 * files; the Hall's volume and mute apply to all of it.
 */

export interface PondSound {
  /** The water under everything while a game is open. */
  ambience(on: boolean): void;
  deal(cards: number): void;
  ask(): void;
  give(cards: number): void;
  goFish(): void;
  cast(): void;
  reel(): void;
  splash(size?: number): void;
  lucky(): void;
  book(golden: boolean): void;
  win(): void;
  end(): void;
}

function snap(delay: number, gain: number, cutoff: number): Voice {
  return {
    wave: 'noise',
    delay,
    duration: 0.04,
    attack: 0.001,
    decay: 0.03,
    sustain: 0,
    lowpass: cutoff,
    gain,
  };
}

const WATER: Patch = {
  name: 'pond-water',
  gain: 0.12,
  voices: [
    { wave: 'noise', duration: 3, attack: 1.5, sustain: 1, release: 1.5, lowpass: 420, gain: 0.5 },
    { wave: 'noise', duration: 3, attack: 2, sustain: 1, release: 1.5, lowpass: 900, gain: 0.12 },
  ],
};

const ASK: Patch = {
  name: 'ask',
  gain: 0.22,
  voices: [
    {
      wave: 'triangle',
      frequency: 520,
      glideTo: 640,
      duration: 0.09,
      attack: 0.004,
      release: 0.05,
      gain: 0.4,
    },
  ],
};

const GO_FISH: Patch = {
  name: 'go-fish',
  gain: 0.26,
  voices: [
    {
      wave: 'sine',
      frequency: 300,
      glideTo: 170,
      duration: 0.22,
      attack: 0.005,
      release: 0.12,
      gain: 0.55,
    },
    {
      wave: 'sine',
      frequency: 450,
      glideTo: 255,
      delay: 0.03,
      duration: 0.18,
      attack: 0.005,
      release: 0.1,
      gain: 0.2,
    },
  ],
};

const CAST: Patch = {
  name: 'cast',
  gain: 0.2,
  voices: [
    {
      wave: 'noise',
      duration: 0.32,
      attack: 0.02,
      decay: 0.3,
      sustain: 0,
      lowpass: 2600,
      gain: 0.35,
    },
    {
      wave: 'triangle',
      frequency: 900,
      glideTo: 380,
      duration: 0.3,
      attack: 0.01,
      release: 0.1,
      gain: 0.12,
    },
  ],
};

const REEL: Patch = {
  name: 'reel',
  gain: 0.2,
  voices: Array.from({ length: 12 }, (_, i): Voice => ({
    wave: 'square',
    frequency: 1700 + (i % 2) * 140,
    delay: i * 0.055,
    duration: 0.014,
    attack: 0.001,
    sustain: 0.2,
    release: 0.006,
    lowpass: 3200,
    gain: 0.18,
  })),
};

function splashPatch(size: number): Patch {
  return {
    name: 'splash',
    gain: 0.24 * size,
    voices: [
      {
        wave: 'noise',
        duration: 0.45,
        attack: 0.004,
        decay: 0.4,
        sustain: 0,
        lowpass: 1800,
        gain: 0.7,
      },
      {
        wave: 'noise',
        delay: 0.05,
        duration: 0.3,
        attack: 0.01,
        decay: 0.25,
        sustain: 0,
        lowpass: 700,
        gain: 0.4,
      },
      {
        wave: 'sine',
        frequency: 160,
        glideTo: 90,
        duration: 0.18,
        attack: 0.004,
        release: 0.1,
        gain: 0.3,
      },
    ],
  };
}

/** A pentatonic run: each book a little higher than the last in a game. */
const CHIME_NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637];

function chime(step: number, golden: boolean): Patch {
  const base = CHIME_NOTES[Math.min(step, CHIME_NOTES.length - 1)]!;
  const voices: Voice[] = [
    {
      wave: 'sine',
      frequency: base,
      duration: 0.6,
      attack: 0.004,
      decay: 0.4,
      sustain: 0.2,
      release: 0.3,
      gain: 0.45,
    },
    {
      wave: 'triangle',
      frequency: base * 1.5,
      delay: 0.08,
      duration: 0.5,
      attack: 0.004,
      release: 0.3,
      gain: 0.2,
    },
  ];
  if (golden) {
    for (let i = 0; i < 5; i++) {
      voices.push({
        wave: 'sine',
        frequency: base * 2 * (1 + i * 0.25),
        delay: 0.12 + i * 0.07,
        duration: 0.3,
        attack: 0.002,
        release: 0.2,
        gain: 0.12,
      });
    }
  }
  return { name: golden ? 'golden-book' : 'book', gain: 0.3, voices };
}

const LUCKY: Patch = {
  name: 'lucky',
  gain: 0.26,
  voices: [659, 880, 1319].map((frequency, i): Voice => ({
    wave: 'triangle',
    frequency,
    delay: i * 0.07,
    duration: 0.18,
    attack: 0.003,
    release: 0.1,
    gain: 0.35,
  })),
};

const WIN: Patch = {
  name: 'win',
  gain: 0.28,
  voices: [523, 659, 784, 1047].map((frequency, i): Voice => ({
    wave: 'triangle',
    frequency,
    delay: i * 0.12,
    duration: 0.5,
    attack: 0.005,
    release: 0.3,
    gain: 0.35,
  })),
};

const END: Patch = {
  name: 'end',
  gain: 0.22,
  voices: [523, 440, 392].map((frequency, i): Voice => ({
    wave: 'sine',
    frequency,
    delay: i * 0.14,
    duration: 0.45,
    attack: 0.005,
    release: 0.3,
    gain: 0.35,
  })),
};

export function createPondSound(synth: Synth, enabled: () => boolean): PondSound {
  let water: Drone | null = null;
  let books = 0;
  const play = (patch: Patch) => {
    if (enabled()) synth.play(patch);
  };
  return {
    ambience(on) {
      if (on && !water && enabled()) water = synth.drone(WATER);
      if (!on && water) {
        water.stop(0.8);
        water = null;
      }
      if (on) books = 0;
    },
    deal(cards) {
      play({
        name: 'deal',
        gain: 0.22,
        voices: Array.from({ length: Math.min(cards, 20) }, (_, i) => snap(i * 0.045, 0.5, 2600)),
      });
    },
    ask: () => play(ASK),
    give(cards) {
      play({
        name: 'give',
        gain: 0.24,
        voices: Array.from({ length: Math.max(1, cards) }, (_, i) => snap(i * 0.08, 0.6, 2200)),
      });
    },
    goFish: () => play(GO_FISH),
    cast: () => play(CAST),
    reel: () => play(REEL),
    splash: (size = 1) => play(splashPatch(size)),
    lucky: () => play(LUCKY),
    book(golden) {
      play(chime(books++, golden));
    },
    win: () => play(WIN),
    end: () => play(END),
  };
}

/** Silence, for the attract mode and the tests. */
export const SILENT: PondSound = {
  ambience() {},
  deal() {},
  ask() {},
  give() {},
  goFish() {},
  cast() {},
  reel() {},
  splash() {},
  lucky() {},
  book() {},
  win() {},
  end() {},
};
