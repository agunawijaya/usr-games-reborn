import type { Patch, Synth } from '@usr-games/kit';

/**
 * Every sound on the desk, synthesised: the sounder's click-clack and its optional tone, the
 * wheel's detents, the punch's thunk, the tape's whirr, the printer's chatter, flags and stamps.
 * Gains are low; the Hall's volume, quiet by default, scales them all.
 */
const SOUNDER_DOWN: Patch = {
  name: 'sounder-down',
  voices: [
    { wave: 'noise', duration: 0.035, attack: 0.001, release: 0.03, gain: 0.5, lowpass: 1800 },
    {
      wave: 'triangle',
      frequency: 150,
      glideTo: 90,
      duration: 0.06,
      attack: 0.001,
      release: 0.05,
      gain: 0.45,
    },
  ],
};

const SOUNDER_UP: Patch = {
  name: 'sounder-up',
  voices: [
    { wave: 'noise', duration: 0.025, attack: 0.001, release: 0.02, gain: 0.28, lowpass: 3600 },
  ],
};

const DETENT: Patch = {
  name: 'detent',
  voices: [
    { wave: 'triangle', frequency: 1500, duration: 0.025, attack: 0.001, release: 0.02, gain: 0.2 },
    { wave: 'noise', duration: 0.015, release: 0.012, gain: 0.15, lowpass: 5000 },
  ],
};

const PUNCH: Patch = {
  name: 'punch',
  voices: [
    { wave: 'noise', duration: 0.06, attack: 0.001, release: 0.05, gain: 0.5, lowpass: 700 },
    {
      wave: 'sine',
      frequency: 95,
      glideTo: 50,
      duration: 0.09,
      attack: 0.001,
      release: 0.08,
      gain: 0.5,
    },
  ],
};

const FLAP: Patch = {
  name: 'flap',
  voices: [{ wave: 'noise', duration: 0.02, release: 0.015, gain: 0.18, lowpass: 4200 }],
};

const FLAG: Patch = {
  name: 'flag',
  voices: [
    { wave: 'noise', duration: 0.16, attack: 0.03, release: 0.12, gain: 0.16, lowpass: 500 },
  ],
};

const STAMP: Patch = {
  name: 'stamp',
  voices: [
    { wave: 'noise', duration: 0.08, attack: 0.001, release: 0.07, gain: 0.4, lowpass: 500 },
    { wave: 'square', frequency: 70, duration: 0.06, release: 0.05, gain: 0.12, lowpass: 400 },
  ],
};

const RIGHT: Patch = {
  name: 'right',
  voices: [
    { wave: 'triangle', frequency: 523, duration: 0.18, release: 0.14, gain: 0.22 },
    { wave: 'triangle', frequency: 659, delay: 0.07, duration: 0.18, release: 0.14, gain: 0.2 },
    { wave: 'triangle', frequency: 784, delay: 0.14, duration: 0.3, release: 0.24, gain: 0.2 },
  ],
};

const WRONG: Patch = {
  name: 'wrong',
  voices: [
    {
      wave: 'square',
      frequency: 220,
      glideTo: 180,
      duration: 0.2,
      release: 0.15,
      gain: 0.08,
      lowpass: 900,
    },
  ],
};

export class Sounds {
  constructor(private readonly synth: Synth) {}

  sounderDown() {
    this.synth.play(SOUNDER_DOWN);
  }

  sounderUp() {
    this.synth.play(SOUNDER_UP);
  }

  /** The tone of one mark, for the length of the mark. */
  tone(seconds: number, hertz = 600) {
    this.synth.play({
      name: 'tone',
      voices: [
        {
          wave: 'sine',
          frequency: hertz,
          duration: seconds + 0.012,
          attack: 0.005,
          release: 0.01,
          sustain: 1,
          gain: 0.22,
        },
      ],
    });
  }

  detent() {
    this.synth.play(DETENT);
  }

  punch() {
    this.synth.play(PUNCH);
  }

  flap() {
    this.synth.play(FLAP);
  }

  flag() {
    this.synth.play(FLAG);
  }

  stamp() {
    this.synth.play(STAMP);
  }

  right() {
    this.synth.play(RIGHT);
  }

  wrong() {
    this.synth.play(WRONG);
  }

  /** Tape running through the reader, for a while. */
  whirr(seconds: number) {
    this.synth.play({
      name: 'whirr',
      voices: [
        { wave: 'noise', duration: seconds, attack: 0.05, release: 0.1, gain: 0.08, lowpass: 900 },
      ],
    });
  }

  /** One printer line: a quick burst of hammer ticks. */
  printLine() {
    this.synth.play({
      name: 'print-line',
      voices: [0, 0.018, 0.036].map((delay) => ({
        wave: 'noise' as const,
        delay,
        duration: 0.012,
        release: 0.01,
        gain: 0.13,
        lowpass: 2600,
      })),
    });
  }

  unlock() {
    void this.synth.resume();
  }
}
