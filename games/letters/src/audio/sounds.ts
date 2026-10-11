import type { Patch, Synth } from '@usr-games/kit';

/**
 * Every sound in Chain Letter, synthesised and quiet by default: a wooden clatter as the cubes
 * land, a note per cube that climbs as a chain grows, a chord for each word (fuller for long
 * ones), a soft knock for a word that does not count, and a bell when time is up. The Hall's
 * volume and mute rule them all.
 */
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
const ROOT = 392;

function semitones(base: number, steps: number): number {
  return base * 2 ** (steps / 12);
}

export class Sounds {
  constructor(private readonly synth: Synth) {}

  private play(patch: Patch) {
    this.synth.play(patch);
  }

  /** Cubes striking the tray: a dry knock of wood with a little rattle. */
  clatter(strength = 1) {
    const pitch = 160 + Math.random() * 220;
    this.play({
      name: 'clatter',
      voices: [
        {
          wave: 'noise',
          duration: 0.05,
          attack: 0.001,
          decay: 0.045,
          gain: 0.07 * strength,
          lowpass: 2400,
        },
        {
          wave: 'triangle',
          frequency: pitch,
          glideTo: pitch * 0.82,
          duration: 0.09,
          attack: 0.002,
          decay: 0.08,
          gain: 0.08 * strength,
          lowpass: 1600,
        },
        {
          wave: 'noise',
          delay: 0.03 + Math.random() * 0.04,
          duration: 0.04,
          attack: 0.001,
          decay: 0.035,
          gain: 0.03 * strength,
          lowpass: 3200,
        },
      ],
    });
  }

  /** A cube joins the chain: each one a step higher on a pentatonic scale. */
  letter(index: number) {
    const step = PENTATONIC[Math.min(index, PENTATONIC.length - 1)]!;
    const frequency = semitones(ROOT, step);
    this.play({
      name: 'letter',
      voices: [
        {
          wave: 'triangle',
          frequency,
          duration: 0.16,
          attack: 0.004,
          decay: 0.15,
          gain: 0.07,
          lowpass: 3200,
        },
        {
          wave: 'sine',
          frequency: frequency * 2,
          duration: 0.1,
          attack: 0.002,
          decay: 0.09,
          gain: 0.02,
        },
      ],
    });
  }

  /** A word found: a major chord, brighter and fuller the longer the word. */
  word(letters: number) {
    const lift = Math.min(7, Math.max(0, letters - 3));
    const root = semitones(ROOT, lift);
    const notes = letters >= 7 ? [0, 4, 7, 12, 16] : letters >= 5 ? [0, 4, 7, 12] : [0, 4, 7];
    this.play({
      name: 'word',
      voices: notes.map((step, i) => ({
        wave: i === 0 ? 'triangle' : 'sine',
        frequency: semitones(root, step),
        delay: i * 0.025,
        duration: letters >= 7 ? 0.9 : 0.5,
        attack: 0.008,
        decay: letters >= 7 ? 0.85 : 0.45,
        gain: 0.055,
        lowpass: 4200,
      })),
    });
  }

  /** Not a word, or not on the board: a soft knock, never a buzzer. */
  miss() {
    this.play({
      name: 'miss',
      voices: [
        {
          wave: 'triangle',
          frequency: 150,
          glideTo: 112,
          duration: 0.17,
          attack: 0.004,
          decay: 0.16,
          gain: 0.08,
          lowpass: 900,
        },
      ],
    });
  }

  /** A word found before: two light taps where it lies. */
  again() {
    this.play({
      name: 'again',
      voices: [
        { wave: 'sine', frequency: 660, duration: 0.07, attack: 0.002, decay: 0.06, gain: 0.04 },
        {
          wave: 'sine',
          frequency: 660,
          delay: 0.11,
          duration: 0.07,
          attack: 0.002,
          decay: 0.06,
          gain: 0.04,
        },
      ],
    });
  }

  /** A word new to the book in the rarest tier: a short sparkle. */
  sparkle() {
    this.play({
      name: 'sparkle',
      voices: [0, 7, 12, 19, 24].map((step, i) => ({
        wave: 'sine' as const,
        frequency: semitones(ROOT * 2, step),
        delay: i * 0.05,
        duration: 0.32,
        attack: 0.003,
        decay: 0.3,
        gain: 0.03,
      })),
    });
  }

  /** The last seconds: a quiet woodblock, so the end is heard rather than watched. */
  tick(final: boolean) {
    this.play({
      name: 'tick',
      voices: [
        {
          wave: 'triangle',
          frequency: final ? 980 : 760,
          duration: 0.05,
          attack: 0.001,
          decay: 0.045,
          gain: 0.035,
          lowpass: 2600,
        },
      ],
    });
  }

  /** Time: a two-note bell. */
  bell() {
    this.play({
      name: 'bell',
      voices: [
        { wave: 'sine', frequency: 660, duration: 1.2, attack: 0.005, decay: 1.15, gain: 0.06 },
        {
          wave: 'sine',
          frequency: 990,
          delay: 0.02,
          duration: 1,
          attack: 0.005,
          decay: 0.95,
          gain: 0.035,
        },
        {
          wave: 'sine',
          frequency: 1320,
          delay: 0.03,
          duration: 0.6,
          attack: 0.005,
          decay: 0.55,
          gain: 0.015,
        },
      ],
    });
  }

  /** The reveal: a slow rising shimmer as the web draws in. */
  reveal() {
    this.play({
      name: 'reveal',
      voices: [0, 4, 7, 11, 14, 19].map((step, i) => ({
        wave: 'sine' as const,
        frequency: semitones(ROOT, step),
        delay: i * 0.18,
        duration: 1.1,
        attack: 0.12,
        decay: 0.95,
        gain: 0.03,
        lowpass: 3000,
      })),
    });
  }

  /** Interface taps: buttons and choices. */
  tap() {
    this.play({
      name: 'tap',
      voices: [
        {
          wave: 'triangle',
          frequency: 520,
          duration: 0.05,
          attack: 0.002,
          decay: 0.045,
          gain: 0.03,
          lowpass: 2400,
        },
      ],
    });
  }
}
