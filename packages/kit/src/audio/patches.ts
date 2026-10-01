import type { Patch } from './synth';

/**
 * Shared sounds of the machine room, kept quiet and soft. Games bring their own patches; these
 * are the Hall's voice, available to any game that wants to sound at home.
 */
export const HALL_PATCHES = {
  keyClick: {
    name: 'key-click',
    gain: 0.35,
    voices: [
      {
        wave: 'noise',
        duration: 0.018,
        attack: 0.001,
        decay: 0.01,
        sustain: 0.2,
        release: 0.006,
        gain: 0.5,
        lowpass: 5200,
      },
      {
        wave: 'square',
        frequency: 2100,
        duration: 0.012,
        attack: 0.001,
        sustain: 0.3,
        release: 0.004,
        gain: 0.12,
        lowpass: 3800,
      },
    ],
  },
  select: {
    name: 'select',
    gain: 0.4,
    voices: [
      {
        wave: 'triangle',
        frequency: 660,
        glideTo: 880,
        duration: 0.09,
        attack: 0.004,
        release: 0.05,
        gain: 0.35,
      },
    ],
  },
  back: {
    name: 'back',
    gain: 0.4,
    voices: [
      {
        wave: 'triangle',
        frequency: 700,
        glideTo: 470,
        duration: 0.1,
        attack: 0.004,
        release: 0.05,
        gain: 0.3,
      },
    ],
  },
  bootHum: {
    name: 'boot-hum',
    gain: 0.18,
    voices: [
      {
        wave: 'sine',
        frequency: 55,
        duration: 3,
        attack: 1.2,
        sustain: 0.9,
        release: 1,
        gain: 0.6,
      },
      {
        wave: 'sine',
        frequency: 110.4,
        duration: 3,
        attack: 1.4,
        sustain: 0.8,
        release: 1,
        gain: 0.25,
      },
      {
        wave: 'noise',
        duration: 3,
        attack: 1.5,
        sustain: 0.6,
        release: 1,
        gain: 0.05,
        lowpass: 380,
      },
    ],
  },
  rankUp: {
    name: 'rank-up',
    gain: 0.45,
    voices: [
      {
        wave: 'triangle',
        frequency: 392,
        duration: 1.4,
        attack: 0.02,
        decay: 0.3,
        sustain: 0.5,
        release: 0.6,
        gain: 0.3,
      },
      {
        wave: 'triangle',
        frequency: 493.9,
        delay: 0.12,
        duration: 1.3,
        attack: 0.02,
        decay: 0.3,
        sustain: 0.5,
        release: 0.6,
        gain: 0.26,
      },
      {
        wave: 'triangle',
        frequency: 587.3,
        delay: 0.24,
        duration: 1.2,
        attack: 0.02,
        decay: 0.3,
        sustain: 0.5,
        release: 0.6,
        gain: 0.24,
      },
      {
        wave: 'sine',
        frequency: 784,
        delay: 0.36,
        duration: 1.1,
        attack: 0.03,
        decay: 0.3,
        sustain: 0.4,
        release: 0.6,
        gain: 0.18,
      },
    ],
  },
} satisfies Record<string, Patch>;
