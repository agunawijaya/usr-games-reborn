import type { Drone, Patch, Synth } from '@usr-games/kit';

/**
 * Skyloom's sounds, all synthesised and quiet by default: the tower's hum, a soft radio blip for
 * every order, a chime that climbs a scale as a string of landings grows, a two-note call for a
 * near-miss and one low tone when a sky is lost.
 */

export interface SkySound {
  hum(on: boolean): void;
  order(): void;
  refused(): void;
  landing(stringLength: number): void;
  departure(): void;
  arrival(): void;
  nearMiss(): void;
  loss(): void;
  shiftComplete(): void;
}

/** A major pentatonic scale climbing from A4: each landing in a string sounds one step higher. */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

const HUM: Patch = {
  name: 'tower-hum',
  gain: 0.05,
  voices: [
    { wave: 'sine', frequency: 55, duration: 4, attack: 1.2, sustain: 1, release: 1.2, gain: 0.6 },
    {
      wave: 'triangle',
      frequency: 110.4,
      duration: 4,
      attack: 1.4,
      sustain: 1,
      release: 1.2,
      gain: 0.18,
      lowpass: 400,
    },
  ],
};

const BLIP: Patch = {
  name: 'radio-blip',
  gain: 0.12,
  voices: [
    {
      wave: 'square',
      frequency: 1320,
      duration: 0.05,
      attack: 0.002,
      decay: 0.03,
      sustain: 0.3,
      release: 0.02,
      gain: 0.25,
      lowpass: 2600,
    },
    {
      wave: 'noise',
      duration: 0.07,
      attack: 0.002,
      decay: 0.05,
      sustain: 0.1,
      release: 0.02,
      gain: 0.12,
      lowpass: 3000,
      delay: 0.03,
    },
  ],
};

const REFUSED: Patch = {
  name: 'order-refused',
  gain: 0.12,
  voices: [
    {
      wave: 'triangle',
      frequency: 330,
      glideTo: 247,
      duration: 0.16,
      attack: 0.005,
      sustain: 0.6,
      release: 0.06,
      gain: 0.5,
    },
  ],
};

const DEPARTURE: Patch = {
  name: 'departure',
  gain: 0.08,
  voices: [
    {
      wave: 'noise',
      duration: 0.6,
      attack: 0.15,
      decay: 0.3,
      sustain: 0.3,
      release: 0.25,
      gain: 0.5,
      lowpass: 900,
    },
  ],
};

const ARRIVAL: Patch = {
  name: 'arrival',
  gain: 0.08,
  voices: [
    {
      wave: 'sine',
      frequency: 880,
      glideTo: 990,
      duration: 0.18,
      attack: 0.01,
      sustain: 0.5,
      release: 0.08,
      gain: 0.4,
    },
  ],
};

const NEAR_MISS: Patch = {
  name: 'near-miss',
  gain: 0.12,
  voices: [
    {
      wave: 'triangle',
      frequency: 784,
      duration: 0.12,
      attack: 0.005,
      sustain: 0.7,
      release: 0.04,
      gain: 0.5,
    },
    {
      wave: 'triangle',
      frequency: 622,
      duration: 0.14,
      attack: 0.005,
      sustain: 0.7,
      release: 0.06,
      gain: 0.5,
      delay: 0.14,
    },
  ],
};

const LOSS: Patch = {
  name: 'loss',
  gain: 0.14,
  voices: [
    {
      wave: 'sine',
      frequency: 110,
      duration: 2.4,
      attack: 0.05,
      decay: 0.6,
      sustain: 0.5,
      release: 1.2,
      gain: 0.7,
    },
    {
      wave: 'sine',
      frequency: 164.8,
      duration: 1.6,
      attack: 0.05,
      decay: 0.5,
      sustain: 0.3,
      release: 0.8,
      gain: 0.25,
    },
  ],
};

function chime(step: number): Patch {
  const semitones = SCALE[Math.min(step, SCALE.length - 1)]!;
  const frequency = 440 * 2 ** (semitones / 12);
  return {
    name: `chime-${step}`,
    gain: 0.1,
    voices: [
      {
        wave: 'sine',
        frequency,
        duration: 0.9,
        attack: 0.005,
        decay: 0.25,
        sustain: 0.25,
        release: 0.5,
        gain: 0.6,
      },
      {
        wave: 'sine',
        frequency: frequency * 2,
        duration: 0.5,
        attack: 0.005,
        decay: 0.15,
        sustain: 0.1,
        release: 0.3,
        gain: 0.18,
      },
    ],
  };
}

export function createSkySound(synth: Synth, enabled: () => boolean): SkySound {
  let drone: Drone | null = null;
  const play = (patch: Patch) => {
    if (enabled()) synth.play(patch);
  };
  return {
    hum(on) {
      if (on && enabled() && !drone) drone = synth.drone(HUM);
      if ((!on || !enabled()) && drone) {
        drone.stop(0.8);
        drone = null;
      }
    },
    order: () => play(BLIP),
    refused: () => play(REFUSED),
    landing: (length) => play(chime(Math.max(0, length - 1))),
    departure: () => play(DEPARTURE),
    arrival: () => play(ARRIVAL),
    nearMiss: () => play(NEAR_MISS),
    loss() {
      if (drone) {
        drone.stop(0.3);
        drone = null;
      }
      play(LOSS);
    },
    shiftComplete() {
      [0, 2, 4].forEach((step, i) => setTimeout(() => play(chime(step + 2)), i * 160));
    },
  };
}
