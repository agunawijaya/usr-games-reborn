import type { Patch, Synth, Voice } from '@usr-games/kit';
import type { Tempo } from '../engine/tempo';

/**
 * The garden's sounds, all synthesised and quiet by default: a squishy pop for each bite,
 * pitched by the digit (a 1 is a high little pip, a 9 a deep plop), a chime that climbs with
 * the chain, a whoosh as the tempo rises, the swish of a dash, a crunch of root, a soft bump for
 * a refused reverse, and for a bonk a thud and a descending boing.
 */

/** The bite's note for each digit, from high to low: a C major scale downward from G5. */
const BITE_NOTES = [784, 698, 659, 587, 523, 494, 440, 392, 349];
/** The chain chime climbs a pentatonic scale. */
const CHIME_NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568];

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

export function bitePatch(value: number): Patch {
  const note = BITE_NOTES[Math.min(8, Math.max(0, value - 1))]!;
  return {
    name: `bite-${value}`,
    gain: 0.5,
    voices: [
      // The squish: a quick drop in pitch, then a little wet pop on top.
      {
        wave: 'sine',
        frequency: note * 1.6,
        glideTo: note,
        duration: 0.14,
        attack: 0.002,
        release: 0.08,
        gain: 0.7,
      },
      {
        wave: 'triangle',
        frequency: note / 2,
        duration: 0.1,
        attack: 0.002,
        release: 0.06,
        gain: 0.35,
        lowpass: 900,
      },
      noise(0.05, 1800, 0.25, { attack: 0.001 }),
    ],
  };
}

export function chimePatch(chain: number): Patch {
  const at = Math.min(CHIME_NOTES.length - 1, chain - 2);
  const voices: Voice[] = [];
  for (let i = 0; i <= Math.min(2, at); i++) {
    voices.push({
      wave: 'sine',
      frequency: CHIME_NOTES[at - i]! * 2,
      delay: 0.06 + i * 0.05,
      duration: 0.45,
      attack: 0.004,
      release: 0.35,
      gain: 0.35 - i * 0.08,
    });
  }
  return { name: `chime-${chain}`, gain: 0.32, voices };
}

const TEMPO_LIFT: Record<Tempo, number> = { creep: 0, stroll: 1, rush: 2, zoom: 3 };

export function whooshPatch(tempo: Tempo): Patch {
  const lift = TEMPO_LIFT[tempo];
  return {
    name: `whoosh-${tempo}`,
    gain: 0.25,
    voices: [noise(0.32, 900 + lift * 700, 0.6, { attack: 0.12, release: 0.18 })],
  };
}

export const NOODLE_PATCHES = {
  dash: {
    name: 'dash',
    gain: 0.3,
    voices: [noise(0.22, 2600, 0.6, { attack: 0.01, release: 0.16 })],
  },
  chew: {
    name: 'chew',
    gain: 0.35,
    voices: Array.from({ length: 3 }, (_, i) =>
      noise(0.05, 1400, 0.5, { delay: i * 0.06, attack: 0.002 }),
    ),
  },
  regrow: {
    name: 'regrow',
    gain: 0.18,
    voices: [
      {
        wave: 'triangle',
        frequency: 330,
        glideTo: 495,
        duration: 0.3,
        attack: 0.05,
        release: 0.2,
        gain: 0.5,
      },
    ],
  },
  bump: {
    name: 'bump',
    gain: 0.35,
    voices: [
      {
        wave: 'sine',
        frequency: 180,
        glideTo: 140,
        duration: 0.12,
        attack: 0.003,
        release: 0.08,
        gain: 0.7,
      },
    ],
  },
  bonk: {
    name: 'bonk',
    gain: 0.55,
    voices: [
      noise(0.12, 300, 0.6, { attack: 0.002 }),
      {
        wave: 'sine',
        frequency: 120,
        glideTo: 70,
        duration: 0.2,
        attack: 0.002,
        release: 0.12,
        gain: 0.6,
      },
      // The boing, softly falling away.
      {
        wave: 'triangle',
        frequency: 520,
        glideTo: 180,
        delay: 0.14,
        duration: 0.7,
        attack: 0.01,
        release: 0.45,
        gain: 0.35,
      },
    ],
  },
  grown: {
    name: 'grown',
    gain: 0.35,
    voices: [523, 659, 784, 1047].map((frequency, i) => ({
      wave: 'triangle' as const,
      frequency,
      delay: i * 0.09,
      duration: 0.5,
      attack: 0.005,
      release: 0.35,
      gain: 0.45,
    })),
  },
  filled: {
    name: 'filled',
    gain: 0.35,
    voices: [523, 659, 784, 1047, 1319, 1568].map((frequency, i) => ({
      wave: 'sine' as const,
      frequency,
      delay: i * 0.07,
      duration: 0.8,
      attack: 0.004,
      release: 0.6,
      gain: 0.4,
    })),
  },
  undo: { name: 'undo', gain: 0.2, voices: [noise(0.08, 1200, 0.5, { attack: 0.002 })] },
} satisfies Record<string, Patch>;

export interface NoodleSound {
  bite(value: number): void;
  chain(chain: number): void;
  tempo(tempo: Tempo): void;
  play(name: keyof typeof NOODLE_PATCHES): void;
}

/** Sounds that keep quiet when the game's own sound setting is off. */
export function createNoodleSound(synth: Synth, enabled: () => boolean): NoodleSound {
  const play = (patch: Patch) => {
    if (enabled()) synth.play(patch);
  };
  return {
    bite: (value) => play(bitePatch(value)),
    chain: (chain) => play(chimePatch(chain)),
    tempo: (tempo) => play(whooshPatch(tempo)),
    play: (name) => play(NOODLE_PATCHES[name]),
  };
}
