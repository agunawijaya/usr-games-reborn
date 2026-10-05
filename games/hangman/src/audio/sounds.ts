import type { Patch, Synth } from '@usr-games/kit';

/**
 * Every sound on the beach, synthesised and quiet by default: the surf breaking with each
 * breath of the sea, the odd gull, a soft chime for a right letter that climbs as the word
 * fills, a whoosh for each wave, the Lighthouse's bell, and the moments when the castle stands
 * or the tide takes it. The Hall's volume and mute rule them all.
 */
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export class Sounds {
  constructor(private readonly synth: Synth) {}

  private play(patch: Patch) {
    this.synth.play(patch);
  }

  /** One breaking wave of the sea's breath: a rush of filtered noise rising and falling. */
  surf(strength = 1) {
    this.play({
      name: 'surf',
      voices: [
        {
          wave: 'noise',
          duration: 2.6,
          attack: 0.7,
          decay: 1.9,
          gain: 0.05 * strength,
          lowpass: 700,
        },
        {
          wave: 'noise',
          delay: 0.4,
          duration: 1.8,
          attack: 0.25,
          decay: 1.5,
          gain: 0.025 * strength,
          lowpass: 2600,
        },
      ],
    });
  }

  gull() {
    this.play({
      name: 'gull',
      voices: [
        {
          wave: 'triangle',
          frequency: 1350,
          glideTo: 980,
          duration: 0.32,
          attack: 0.02,
          decay: 0.28,
          gain: 0.03,
          lowpass: 3200,
        },
        {
          wave: 'triangle',
          frequency: 1300,
          glideTo: 900,
          delay: 0.38,
          duration: 0.28,
          attack: 0.02,
          decay: 0.24,
          gain: 0.025,
          lowpass: 3200,
        },
      ],
    });
  }

  /** A right letter: a chime one step higher on a pentatonic scale for each letter found. */
  chime(found: number) {
    const step = PENTATONIC[Math.min(PENTATONIC.length - 1, found)]!;
    const base = 523.25 * Math.pow(2, step / 12);
    this.play({
      name: 'chime',
      voices: [
        { wave: 'sine', frequency: base, duration: 0.6, attack: 0.004, decay: 0.55, gain: 0.12 },
        { wave: 'sine', frequency: base * 2, delay: 0.02, duration: 0.4, decay: 0.35, gain: 0.04 },
      ],
    });
  }

  /** A wrong letter: the swell gathers and rushes in. */
  whoosh() {
    this.play({
      name: 'whoosh',
      voices: [
        { wave: 'noise', duration: 1.6, attack: 0.9, decay: 0.7, gain: 0.07, lowpass: 1600 },
        { wave: 'sine', frequency: 90, glideTo: 60, delay: 1.1, duration: 0.6, gain: 0.06 },
      ],
    });
  }

  /** The letter was tried already, or was not a letter: a soft tap, no wave. */
  tap() {
    this.play({
      name: 'tap',
      voices: [{ wave: 'triangle', frequency: 330, duration: 0.07, decay: 0.06, gain: 0.05 }],
    });
  }

  lighthouse() {
    this.play({
      name: 'lighthouse',
      voices: [
        { wave: 'sine', frequency: 392, duration: 1.4, attack: 0.01, decay: 1.3, gain: 0.09 },
        { wave: 'sine', frequency: 784.5, duration: 1.0, decay: 0.9, gain: 0.04 },
        { wave: 'sine', frequency: 1177, duration: 0.7, decay: 0.6, gain: 0.02 },
      ],
    });
  }

  /** The castle stands: a bright rising arpeggio. */
  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    this.play({
      name: 'win',
      voices: notes.map((frequency, i) => ({
        wave: 'sine' as const,
        frequency,
        delay: i * 0.11,
        duration: 0.9,
        attack: 0.01,
        decay: 0.8,
        gain: 0.09,
      })),
    });
  }

  /** The tide takes it: a long slow swell and a gentle falling phrase, sad but not harsh. */
  lose() {
    this.play({
      name: 'lose',
      voices: [
        { wave: 'noise', duration: 3.4, attack: 1.6, decay: 1.7, gain: 0.08, lowpass: 900 },
        { wave: 'sine', frequency: 392, delay: 2.2, duration: 0.9, decay: 0.8, gain: 0.06 },
        { wave: 'sine', frequency: 329.63, delay: 2.6, duration: 0.9, decay: 0.8, gain: 0.06 },
        { wave: 'sine', frequency: 261.63, delay: 3.0, duration: 1.4, decay: 1.3, gain: 0.06 },
      ],
    });
  }

  /** A Tide run's castle mends a section. */
  repair() {
    this.play({
      name: 'repair',
      voices: [
        { wave: 'triangle', frequency: 440, glideTo: 880, duration: 0.5, decay: 0.45, gain: 0.07 },
      ],
    });
  }

  select() {
    this.play({
      name: 'select',
      voices: [{ wave: 'sine', frequency: 660, duration: 0.09, decay: 0.08, gain: 0.05 }],
    });
  }
}
