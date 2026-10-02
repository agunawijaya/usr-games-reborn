import type { Drone, Patch, Synth, Voice } from '@usr-games/kit';

/**
 * The cave's sounds, all synthesised and quiet by default: dripping water, a soft step, the draft
 * and the flutter, the dart's twang, a sleepy snore and a little lullaby for a hushed wumpus, and
 * two low notes when an expedition is lost.
 */

const noise = (
  duration: number,
  lowpass: number,
  gain: number,
  extra: Partial<Voice> = {},
): Voice => ({
  wave: 'noise',
  duration,
  lowpass,
  gain,
  attack: 0.01,
  release: Math.min(0.2, duration / 2),
  ...extra,
});

export const CAVE_PATCHES = {
  step: { name: 'step', gain: 0.4, voices: [noise(0.09, 520, 0.5, { attack: 0.004 })] },
  drip: {
    name: 'drip',
    gain: 0.22,
    voices: [
      {
        wave: 'sine',
        frequency: 1250,
        glideTo: 620,
        duration: 0.11,
        attack: 0.002,
        release: 0.06,
        gain: 0.5,
      },
    ],
  },
  draft: {
    name: 'draft',
    gain: 0.35,
    voices: [noise(1.1, 760, 0.5, { attack: 0.35, release: 0.5 })],
  },
  flutter: {
    name: 'flutter',
    gain: 0.35,
    voices: Array.from({ length: 6 }, (_, i) =>
      noise(0.05, 2400, 0.4, { delay: i * 0.07, attack: 0.003 }),
    ),
  },
  whiff: {
    name: 'whiff',
    gain: 0.25,
    voices: [
      {
        wave: 'sawtooth',
        frequency: 92,
        glideTo: 70,
        duration: 0.9,
        attack: 0.3,
        release: 0.4,
        gain: 0.35,
        lowpass: 300,
      },
    ],
  },
  bump: {
    name: 'bump',
    gain: 0.45,
    voices: [
      noise(0.12, 220, 0.7, { attack: 0.002 }),
      {
        wave: 'triangle',
        frequency: 140,
        glideTo: 90,
        duration: 0.18,
        attack: 0.002,
        release: 0.1,
        gain: 0.4,
      },
    ],
  },
  grumble: {
    name: 'grumble',
    gain: 0.35,
    voices: [
      {
        wave: 'square',
        frequency: 58,
        glideTo: 46,
        duration: 1.2,
        attack: 0.2,
        release: 0.5,
        gain: 0.3,
        lowpass: 260,
      },
    ],
  },
  flap: {
    name: 'flap',
    gain: 0.35,
    voices: Array.from({ length: 10 }, (_, i) =>
      noise(0.06, 2000 - i * 90, 0.45, { delay: i * 0.08 }),
    ),
  },
  ledge: {
    name: 'ledge',
    gain: 0.4,
    voices: [
      noise(0.5, 900, 0.5, { attack: 0.01 }),
      { wave: 'triangle', frequency: 300, glideTo: 520, duration: 0.5, delay: 0.3, gain: 0.25 },
    ],
  },
  shimmer: {
    name: 'shimmer',
    gain: 0.25,
    voices: [0, 1, 2, 3, 4].map((i) => ({
      wave: 'sine' as const,
      frequency: 880 + i * 220,
      duration: 0.5,
      delay: i * 0.06,
      attack: 0.02,
      release: 0.3,
      gain: 0.3,
    })),
  },
  throw: {
    name: 'throw',
    gain: 0.4,
    voices: [
      {
        wave: 'triangle',
        frequency: 420,
        glideTo: 180,
        duration: 0.22,
        attack: 0.002,
        release: 0.15,
        gain: 0.35,
      },
      noise(0.3, 3000, 0.25, { attack: 0.02 }),
    ],
  },
  twang: {
    name: 'twang',
    gain: 0.4,
    voices: [
      {
        wave: 'sawtooth',
        frequency: 196,
        glideTo: 150,
        duration: 0.6,
        attack: 0.002,
        release: 0.4,
        gain: 0.3,
        lowpass: 1400,
      },
    ],
  },
  snore: {
    name: 'snore',
    gain: 0.3,
    voices: [
      {
        wave: 'sawtooth',
        frequency: 70,
        glideTo: 92,
        duration: 1.1,
        attack: 0.5,
        release: 0.3,
        gain: 0.35,
        lowpass: 380,
      },
      noise(1.1, 600, 0.15, { attack: 0.5 }),
    ],
  },
  lullaby: {
    name: 'lullaby',
    gain: 0.3,
    voices: [523.25, 659.25, 783.99, 1046.5, 783.99].map((frequency, i) => ({
      wave: 'triangle' as const,
      frequency,
      duration: 0.6,
      delay: i * 0.22,
      attack: 0.02,
      release: 0.45,
      gain: 0.35,
    })),
  },
  lost: {
    name: 'lost',
    gain: 0.35,
    voices: [
      { wave: 'sine', frequency: 392, duration: 0.7, attack: 0.05, release: 0.4, gain: 0.4 },
      {
        wave: 'sine',
        frequency: 311.13,
        duration: 1.3,
        delay: 0.55,
        attack: 0.05,
        release: 0.9,
        gain: 0.4,
      },
    ],
  },
} satisfies Record<string, Patch>;

export type CaveSoundName = keyof typeof CAVE_PATCHES;

const AMBIENCE: Patch = {
  name: 'cave-air',
  gain: 0.05,
  voices: [noise(4, 260, 0.6, { attack: 1.5, release: 1.5 })],
};

export interface CaveSound {
  play(name: CaveSoundName): void;
  /** The cave's air and an occasional drip, while an expedition is on screen. */
  startAmbience(): void;
  stopAmbience(): void;
}

export function createCaveSound(synth: Synth, enabled: () => boolean): CaveSound {
  let air: Drone | null = null;
  let drips: number | null = null;
  return {
    play(name) {
      if (enabled()) synth.play(CAVE_PATCHES[name]);
    },
    startAmbience() {
      if (!enabled() || air) return;
      air = synth.drone(AMBIENCE);
      drips = window.setInterval(() => {
        if (enabled() && Math.random() < 0.5) synth.play(CAVE_PATCHES.drip);
      }, 2600);
    },
    stopAmbience() {
      air?.stop(0.8);
      air = null;
      if (drips !== null) window.clearInterval(drips);
      drips = null;
    },
  };
}
