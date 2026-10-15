import type { Drone, Patch, Synth } from '@usr-games/kit';
import { type Kind, isSafety } from '../engine/cards';
import type { RouteId } from '../render/routes';

/**
 * Detour's sounds, all synthesised and kept soft: cards flicked and slammed, an engine that
 * rises as a car pulls away, the hiss of a flat, the cough of an empty tank, a cartoon bonk, the
 * signals' tones, the coup fourré's sting, a horn when the trip is done, and each route's air.
 */

export type Cue =
  | 'flick'
  | 'draw'
  | 'slam'
  | 'engine'
  | 'hiss'
  | 'cough'
  | 'bonk'
  | 'red'
  | 'green'
  | 'sign'
  | 'fix'
  | 'coup'
  | 'horn'
  | 'extend'
  | 'tick';

const PATCHES: Record<Cue, Patch> = {
  flick: {
    name: 'flick',
    gain: 0.3,
    voices: [
      { wave: 'noise', duration: 0.06, attack: 0.002, release: 0.04, gain: 0.5, lowpass: 2600 },
    ],
  },
  draw: {
    name: 'draw',
    gain: 0.22,
    voices: [
      { wave: 'noise', duration: 0.08, attack: 0.01, release: 0.05, gain: 0.5, lowpass: 3400 },
    ],
  },
  slam: {
    name: 'slam',
    gain: 0.45,
    voices: [
      {
        wave: 'sine',
        frequency: 110,
        glideTo: 55,
        duration: 0.25,
        attack: 0.002,
        release: 0.2,
        gain: 0.9,
      },
      { wave: 'noise', duration: 0.09, attack: 0.001, release: 0.07, gain: 0.5, lowpass: 1800 },
    ],
  },
  engine: {
    name: 'engine',
    gain: 0.18,
    voices: [
      {
        wave: 'sawtooth',
        frequency: 62,
        glideTo: 128,
        duration: 0.7,
        attack: 0.05,
        release: 0.3,
        gain: 0.6,
        lowpass: 520,
      },
      {
        wave: 'square',
        frequency: 31,
        glideTo: 64,
        duration: 0.7,
        attack: 0.05,
        release: 0.3,
        gain: 0.25,
        lowpass: 300,
      },
    ],
  },
  hiss: {
    name: 'hiss',
    gain: 0.2,
    voices: [
      { wave: 'noise', duration: 0.9, attack: 0.02, release: 0.7, gain: 0.6, lowpass: 7000 },
    ],
  },
  cough: {
    name: 'cough',
    gain: 0.25,
    voices: [0, 0.18, 0.4, 0.66].map((delay, i) => ({
      wave: 'square' as const,
      frequency: 58 - i * 6,
      delay,
      duration: 0.1,
      attack: 0.005,
      release: 0.06,
      gain: 0.6 - i * 0.1,
      lowpass: 420,
    })),
  },
  bonk: {
    name: 'bonk',
    gain: 0.35,
    voices: [
      {
        wave: 'triangle',
        frequency: 320,
        glideTo: 150,
        duration: 0.18,
        attack: 0.002,
        release: 0.12,
        gain: 0.8,
      },
      { wave: 'noise', duration: 0.05, attack: 0.001, release: 0.04, gain: 0.3, lowpass: 2200 },
    ],
  },
  red: {
    name: 'red',
    gain: 0.22,
    voices: [
      { wave: 'sine', frequency: 440, duration: 0.32, attack: 0.005, release: 0.25, gain: 0.7 },
    ],
  },
  green: {
    name: 'green',
    gain: 0.22,
    voices: [
      { wave: 'sine', frequency: 660, duration: 0.18, attack: 0.005, release: 0.12, gain: 0.6 },
      {
        wave: 'sine',
        frequency: 990,
        delay: 0.11,
        duration: 0.24,
        attack: 0.005,
        release: 0.18,
        gain: 0.6,
      },
    ],
  },
  sign: {
    name: 'sign',
    gain: 0.22,
    voices: [
      {
        wave: 'triangle',
        frequency: 220,
        glideTo: 196,
        duration: 0.22,
        attack: 0.005,
        release: 0.15,
        gain: 0.7,
      },
    ],
  },
  fix: {
    name: 'fix',
    gain: 0.2,
    voices: [0, 0.09, 0.2].map((delay, i) => ({
      wave: 'triangle' as const,
      frequency: 1400 + i * 180,
      delay,
      duration: 0.07,
      attack: 0.001,
      release: 0.05,
      gain: 0.5,
    })),
  },
  coup: {
    name: 'coup',
    gain: 0.4,
    voices: [
      {
        wave: 'sine',
        frequency: 82,
        glideTo: 41,
        duration: 0.5,
        attack: 0.002,
        release: 0.4,
        gain: 0.9,
      },
      ...[523, 659, 784, 1047].map((frequency, i) => ({
        wave: 'triangle' as const,
        frequency,
        delay: 0.14 + i * 0.07,
        duration: 0.55 - i * 0.05,
        attack: 0.01,
        release: 0.35,
        gain: 0.45,
      })),
    ],
  },
  horn: {
    name: 'horn',
    gain: 0.22,
    voices: [
      {
        wave: 'square',
        frequency: 392,
        duration: 0.22,
        attack: 0.01,
        release: 0.06,
        gain: 0.5,
        lowpass: 1500,
      },
      {
        wave: 'square',
        frequency: 494,
        duration: 0.22,
        attack: 0.01,
        release: 0.06,
        gain: 0.5,
        lowpass: 1500,
      },
      {
        wave: 'square',
        frequency: 392,
        delay: 0.3,
        duration: 0.42,
        attack: 0.01,
        release: 0.12,
        gain: 0.5,
        lowpass: 1500,
      },
      {
        wave: 'square',
        frequency: 494,
        delay: 0.3,
        duration: 0.42,
        attack: 0.01,
        release: 0.12,
        gain: 0.5,
        lowpass: 1500,
      },
    ],
  },
  extend: {
    name: 'extend',
    gain: 0.25,
    voices: [392, 523, 659, 784].map((frequency, i) => ({
      wave: 'triangle' as const,
      frequency,
      delay: i * 0.09,
      duration: 0.3,
      attack: 0.01,
      release: 0.2,
      gain: 0.5,
    })),
  },
  tick: {
    name: 'tick',
    gain: 0.12,
    voices: [
      {
        wave: 'triangle',
        frequency: 1800,
        duration: 0.03,
        attack: 0.001,
        release: 0.02,
        gain: 0.5,
      },
    ],
  },
};

/** Each route's air, very low under everything else. */
const AMBIENCE: Record<RouteId, Patch> = {
  coast: {
    name: 'surf',
    gain: 0.05,
    voices: [{ wave: 'noise', duration: 60, attack: 2, release: 1, gain: 0.5, lowpass: 420 }],
  },
  desert: {
    name: 'dry-wind',
    gain: 0.04,
    voices: [{ wave: 'noise', duration: 60, attack: 2, release: 1, gain: 0.5, lowpass: 900 }],
  },
  alpine: {
    name: 'snow-wind',
    gain: 0.04,
    voices: [{ wave: 'noise', duration: 60, attack: 2, release: 1, gain: 0.5, lowpass: 1300 }],
  },
  jungle: {
    name: 'rainforest',
    gain: 0.04,
    voices: [
      { wave: 'noise', duration: 60, attack: 2, release: 1, gain: 0.45, lowpass: 2600 },
      { wave: 'sine', frequency: 2400, duration: 60, attack: 3, release: 1, gain: 0.03 },
    ],
  },
  city: {
    name: 'city-hum',
    gain: 0.05,
    voices: [
      { wave: 'sine', frequency: 55, duration: 60, attack: 2, release: 1, gain: 0.4 },
      { wave: 'noise', duration: 60, attack: 2, release: 1, gain: 0.3, lowpass: 600 },
    ],
  },
};

/** What a card sounds like when it lands. */
export function cueFor(kind: Kind): Cue {
  if (isSafety(kind)) return 'slam';
  switch (kind) {
    case 'flatTyre':
      return 'hiss';
    case 'noFuel':
      return 'cough';
    case 'fenderBender':
      return 'bonk';
    case 'redLight':
      return 'red';
    case 'slowZone':
    case 'openRoad':
      return 'sign';
    case 'greenLight':
      return 'green';
    case 'fillUp':
    case 'spareTyre':
    case 'mechanic':
      return 'fix';
    default:
      return 'flick';
  }
}

export interface TableSound {
  play(cue: Cue): void;
  ambience(route: RouteId | null): void;
  stop(): void;
}

export function createTableSound(synth: Synth, enabled: () => boolean): TableSound {
  let air: Drone | null = null;
  let airRoute: RouteId | null = null;
  return {
    play(cue) {
      if (enabled()) synth.play(PATCHES[cue]);
    },
    ambience(route) {
      if (route === airRoute && air) return;
      air?.stop(1.2);
      air = null;
      airRoute = route;
      if (route && enabled()) air = synth.drone(AMBIENCE[route]);
    },
    stop() {
      air?.stop(0.4);
      air = null;
      airRoute = null;
    },
  };
}
