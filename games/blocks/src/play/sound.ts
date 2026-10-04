import type { Patch, Synth, Voice } from '@usr-games/kit';

/**
 * The tank's sounds, all synthesised and quiet by default: a soft tick for a slide, a click for a
 * turn, a falling whoosh for a plunge (longer the deeper it goes), a thud as a sinker comes to
 * rest, a fizz of bubbles for a burst with a pop for each score bubble at the surface, a chime that
 * climbs with the depth combo, and for a full tank a low, bubbling sigh.
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
  attack: 0.005,
  release: Math.min(0.2, duration / 2),
  ...extra,
});

/** A stable spread of numbers for a patch's bubbles, so a burst always sounds the same. */
function spread(i: number, salt: number): number {
  const v = Math.sin(i * 91.7 + salt * 47.3) * 9631.17;
  return v - Math.floor(v);
}

function blip(frequency: number, delay: number, gain: number): Voice {
  return {
    wave: 'sine',
    frequency,
    glideTo: frequency * 1.5,
    delay,
    duration: 0.07,
    attack: 0.003,
    release: 0.05,
    gain,
  };
}

export function plungePatch(rows: number): Patch {
  const length = 0.12 + Math.min(rows, 18) * 0.014;
  return {
    name: `plunge-${Math.min(rows, 18)}`,
    gain: 0.3,
    voices: [
      noise(length, 1800, 0.5, { attack: 0.01, release: length * 0.6 }),
      {
        wave: 'sine',
        frequency: 520,
        glideTo: 160,
        duration: length,
        attack: 0.005,
        release: length * 0.5,
        gain: 0.35,
      },
    ],
  };
}

export function landPatch(plunged: boolean): Patch {
  return {
    name: plunged ? 'land-plunge' : 'land-soft',
    gain: plunged ? 0.45 : 0.3,
    voices: [
      {
        wave: 'sine',
        frequency: plunged ? 130 : 170,
        glideTo: plunged ? 75 : 120,
        duration: 0.16,
        attack: 0.002,
        release: 0.1,
        gain: 0.7,
      },
      noise(0.08, 500, 0.35, { attack: 0.001 }),
      ...(plunged ? [0, 1, 2].map((i) => blip(700 + i * 260, 0.05 + i * 0.04, 0.12)) : []),
    ],
  };
}

/**
 * Bubbles rising, more of them the more rows, a soft swell under them, and one pop for each of
 * the score's bubbles as it reaches the surface (the times match the picture's).
 */
export function burstPatch(rows: number, factors: number, pops: readonly number[]): Patch {
  const count = 6 + rows * 5;
  const voices: Voice[] = [];
  for (let i = 0; i < count; i++) {
    const delay = spread(i, rows) * (0.35 + rows * 0.1);
    voices.push(blip(500 + spread(i, rows + 7) * 900 + delay * 600, delay, 0.1));
  }
  voices.push({
    wave: 'triangle',
    frequency: 262,
    glideTo: 392,
    duration: 0.6 + rows * 0.1,
    attack: 0.08,
    release: 0.4,
    gain: 0.18,
  });
  for (const at of pops.slice(0, factors))
    voices.push(blip(1100, at, 0.22), noise(0.04, 3000, 0.15, { delay: at, attack: 0.001 }));
  return { name: `burst-${rows}-${factors}`, gain: 0.4, voices };
}

/** The depth combo's chime: a fifth higher for every plunge, up a pentatonic scale. */
const CHIME_NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568];

export function comboPatch(combo: number): Patch {
  const at = Math.min(CHIME_NOTES.length - 1, combo - 2);
  return {
    name: `combo-${combo}`,
    gain: 0.28,
    voices: [0, 1].map((i) => ({
      wave: 'sine' as const,
      frequency: CHIME_NOTES[Math.max(0, at - i)]! * 2,
      delay: i * 0.05,
      duration: 0.4,
      attack: 0.004,
      release: 0.32,
      gain: 0.35 - i * 0.1,
    })),
  };
}

export const SINKER_PATCHES = {
  slide: {
    name: 'slide',
    gain: 0.12,
    voices: [
      { wave: 'sine', frequency: 880, duration: 0.03, attack: 0.002, release: 0.02, gain: 0.5 },
    ],
  },
  turn: {
    name: 'turn',
    gain: 0.18,
    voices: [
      {
        wave: 'triangle',
        frequency: 660,
        glideTo: 990,
        duration: 0.05,
        attack: 0.002,
        release: 0.04,
        gain: 0.5,
      },
    ],
  },
  blocked: {
    name: 'blocked',
    gain: 0.18,
    voices: [
      {
        wave: 'sine',
        frequency: 200,
        glideTo: 160,
        duration: 0.07,
        attack: 0.002,
        release: 0.05,
        gain: 0.6,
      },
    ],
  },
  drift: {
    name: 'drift',
    gain: 0.16,
    voices: [noise(0.22, 1300, 0.6, { attack: 0.06, release: 0.14 })],
  },
  level: {
    name: 'level',
    gain: 0.3,
    voices: [523, 659, 784, 1047].map((frequency, i) => ({
      wave: 'triangle' as const,
      frequency,
      delay: i * 0.08,
      duration: 0.4,
      attack: 0.005,
      release: 0.3,
      gain: 0.4,
    })),
  },
  won: {
    name: 'won',
    gain: 0.32,
    voices: [523, 659, 784, 1047, 1319].map((frequency, i) => ({
      wave: 'sine' as const,
      frequency,
      delay: i * 0.08,
      duration: 0.7,
      attack: 0.004,
      release: 0.5,
      gain: 0.4,
    })),
  },
  full: {
    name: 'full',
    gain: 0.4,
    voices: [
      {
        wave: 'sine',
        frequency: 220,
        glideTo: 98,
        duration: 1.3,
        attack: 0.05,
        release: 0.8,
        gain: 0.5,
      },
      ...Array.from({ length: 7 }, (_, i) => blip(300 - i * 25, 0.15 + i * 0.13, 0.08)),
      noise(1.1, 400, 0.25, { attack: 0.2, release: 0.7 }),
    ],
  },
} satisfies Record<string, Patch>;

export interface SinkerSound {
  play(name: keyof typeof SINKER_PATCHES): void;
  plunge(rows: number): void;
  land(plunged: boolean): void;
  burst(rows: number, factors: number, pops: readonly number[]): void;
  combo(combo: number): void;
}

/** Sounds that keep quiet when the game's own sound setting is off. */
export function createSinkerSound(synth: Synth, enabled: () => boolean): SinkerSound {
  const play = (patch: Patch) => {
    if (enabled()) synth.play(patch);
  };
  return {
    play: (name) => play(SINKER_PATCHES[name]),
    plunge: (rows) => play(plungePatch(rows)),
    land: (plunged) => play(landPatch(plunged)),
    burst: (rows, factors, pops) => play(burstPatch(rows, factors, pops)),
    combo: (combo) => play(comboPatch(combo)),
  };
}
