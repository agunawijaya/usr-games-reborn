import type { Patch, Synth } from '@usr-games/kit';

/**
 * Fivefold's sounds, synthesised and quiet: a pebble's soft tock on sand by day, a lantern's plip
 * on the water by night, a low pair of notes when a four is set against you, and short phrases
 * for a win, a loss, a draw and a puzzle. No files.
 */

export interface FivefoldSound {
  /** A piece lands: yours a touch brighter than the other side's. */
  place(dark: boolean, mine: boolean): void;
  /** The other side has a four. */
  warning(): void;
  win(dark: boolean): void;
  loss(): void;
  draw(): void;
  solved(): void;
  miss(): void;
}

const pebble = (mine: boolean): Patch => ({
  name: 'pebble',
  gain: mine ? 0.32 : 0.24,
  voices: [
    {
      wave: 'noise',
      duration: 0.07,
      attack: 0.002,
      decay: 0.05,
      sustain: 0,
      lowpass: 1100,
      gain: 0.6,
    },
    {
      wave: 'sine',
      frequency: mine ? 210 : 180,
      glideTo: mine ? 150 : 130,
      duration: 0.12,
      attack: 0.002,
      decay: 0.1,
      sustain: 0,
      gain: 0.7,
    },
  ],
});

const lantern = (mine: boolean): Patch => ({
  name: 'lantern',
  gain: mine ? 0.26 : 0.2,
  voices: [
    {
      wave: 'sine',
      frequency: mine ? 660 : 560,
      glideTo: mine ? 400 : 340,
      duration: 0.2,
      attack: 0.004,
      decay: 0.16,
      sustain: 0,
      gain: 0.7,
    },
    {
      wave: 'triangle',
      frequency: mine ? 1320 : 1120,
      delay: 0.03,
      duration: 0.6,
      attack: 0.01,
      decay: 0.5,
      sustain: 0,
      gain: 0.12,
      lowpass: 3000,
    },
  ],
});

const WARNING: Patch = {
  name: 'warning',
  gain: 0.16,
  voices: [
    { wave: 'sine', frequency: 330, duration: 0.22, attack: 0.01, decay: 0.18, sustain: 0 },
    {
      wave: 'sine',
      frequency: 294,
      delay: 0.16,
      duration: 0.3,
      attack: 0.01,
      decay: 0.26,
      sustain: 0,
    },
  ],
};

/** A rising pentatonic phrase: marimba-like by day, chimes by night. */
function phrase(notes: readonly number[], dark: boolean, gap: number, name: string): Patch {
  return {
    name,
    gain: 0.2,
    voices: notes.map((frequency, i) => ({
      wave: dark ? 'sine' : 'triangle',
      frequency,
      delay: i * gap,
      duration: dark ? 1.2 : 0.4,
      attack: 0.005,
      decay: dark ? 1.0 : 0.32,
      sustain: 0,
      gain: 0.6,
      lowpass: dark ? 4000 : 2400,
    })),
  };
}

const NOTES = {
  c5: 523.25,
  d5: 587.33,
  e5: 659.25,
  g5: 783.99,
  a5: 880,
  c6: 1046.5,
  e4: 329.63,
  a4: 440,
};

export function createFivefoldSound(synth: Synth, enabled: () => boolean): FivefoldSound {
  const play = (patch: Patch) => {
    if (enabled()) synth.play(patch);
  };
  return {
    place: (dark, mine) => play(dark ? lantern(mine) : pebble(mine)),
    warning: () => play(WARNING),
    win: (dark) =>
      play(phrase([NOTES.c5, NOTES.d5, NOTES.e5, NOTES.g5, NOTES.a5, NOTES.c6], dark, 0.09, 'win')),
    loss: () => play(phrase([NOTES.a4, NOTES.e4], true, 0.22, 'loss')),
    draw: () => play(phrase([NOTES.e5, NOTES.e5], false, 0.2, 'draw')),
    solved: () => play(phrase([NOTES.e5, NOTES.g5, NOTES.c6], false, 0.08, 'solved')),
    miss: () => play(phrase([NOTES.e4], true, 0, 'miss')),
  };
}
