import type { Patch, Synth, Voice } from '@usr-games/kit';
import type { ThemeId } from '../render/look';

/**
 * Every sound in Number Sprint, synthesised and quiet by default, in two voices. Sprint: a
 * starter's tone, footfall ticks that climb with a streak, a stumble thud, the crowd swelling
 * and a finish-line cheer. Atom: a lab hum's glassy notes, a fusion chime, a soft buzz, the
 * crack of a split and a shimmer as atoms settle. The Hall's volume and mute rule both.
 */

const STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];

function note(semitones: number, base = 440): number {
  return base * 2 ** (semitones / 12);
}

export class Sounds {
  theme: ThemeId = 'sprint';

  constructor(private readonly synth: Synth) {}

  private play(name: string, voices: Voice[], gain = 1) {
    const patch: Patch = { name, voices, gain };
    this.synth.play(patch);
  }

  /** A key pressed on the board or the keys. */
  tap() {
    if (this.theme === 'sprint') {
      this.play('tap', [
        { wave: 'triangle', frequency: 520, duration: 0.05, decay: 0.04, gain: 0.04 },
      ]);
    } else {
      this.play('tap', [
        { wave: 'sine', frequency: 1320, duration: 0.06, decay: 0.05, gain: 0.03 },
      ]);
    }
  }

  /** A right answer; the pitch climbs with the streak. */
  right(streak: number) {
    const step = STEPS[Math.min(streak, STEPS.length - 1)]!;
    if (this.theme === 'sprint') {
      this.play('right', [
        { wave: 'noise', duration: 0.07, decay: 0.06, gain: 0.05, lowpass: 900 },
        {
          wave: 'triangle',
          frequency: note(step, 392),
          duration: 0.16,
          attack: 0.005,
          decay: 0.14,
          gain: 0.07,
        },
        {
          wave: 'sine',
          frequency: note(step + 7, 392),
          delay: 0.05,
          duration: 0.18,
          decay: 0.16,
          gain: 0.04,
        },
      ]);
    } else {
      this.play('right', [
        {
          wave: 'sine',
          frequency: note(step, 660),
          duration: 0.5,
          attack: 0.005,
          decay: 0.48,
          gain: 0.06,
        },
        {
          wave: 'sine',
          frequency: note(step + 12, 660),
          delay: 0.03,
          duration: 0.6,
          decay: 0.55,
          gain: 0.03,
        },
        {
          wave: 'triangle',
          frequency: note(step + 19, 660),
          delay: 0.06,
          duration: 0.4,
          decay: 0.36,
          gain: 0.015,
        },
      ]);
    }
  }

  /** A wrong answer or a bounce: a stumble, or a soft buzz. Never harsh. */
  wrong() {
    if (this.theme === 'sprint') {
      this.play('wrong', [
        { wave: 'noise', duration: 0.18, decay: 0.16, gain: 0.07, lowpass: 380 },
        { wave: 'sine', frequency: 140, glideTo: 90, duration: 0.2, decay: 0.18, gain: 0.08 },
      ]);
    } else {
      this.play('wrong', [
        {
          wave: 'triangle',
          frequency: 220,
          glideTo: 196,
          duration: 0.24,
          decay: 0.2,
          gain: 0.05,
          lowpass: 900,
        },
        {
          wave: 'triangle',
          frequency: 233,
          glideTo: 207,
          duration: 0.24,
          decay: 0.2,
          gain: 0.04,
          lowpass: 900,
        },
      ]);
    }
  }

  /** A prime split off a number, or swept through the sieve. */
  split(last: boolean) {
    if (this.theme === 'sprint') {
      this.play('split', [
        { wave: 'noise', duration: 0.12, decay: 0.1, gain: 0.06, lowpass: 2400 },
        { wave: 'triangle', frequency: last ? 784 : 587, duration: 0.22, decay: 0.2, gain: 0.06 },
        ...(last
          ? [
              {
                wave: 'triangle' as const,
                frequency: 1175,
                delay: 0.09,
                duration: 0.3,
                decay: 0.28,
                gain: 0.05,
              },
            ]
          : []),
      ]);
    } else {
      this.play('split', [
        { wave: 'noise', duration: 0.05, decay: 0.04, gain: 0.05, lowpass: 5000 },
        { wave: 'sine', frequency: last ? 1047 : 880, duration: 0.5, decay: 0.48, gain: 0.05 },
        ...(last
          ? [
              {
                wave: 'sine' as const,
                frequency: 1319,
                delay: 0.08,
                duration: 0.6,
                decay: 0.55,
                gain: 0.04,
              },
              {
                wave: 'sine' as const,
                frequency: 1568,
                delay: 0.16,
                duration: 0.7,
                decay: 0.65,
                gain: 0.03,
              },
            ]
          : []),
      ]);
    }
  }

  /** A sweep through the sieve: a run of quick notes. */
  sweep(count: number) {
    const voices: Voice[] = [];
    const notes = Math.min(8, Math.max(2, Math.round(count / 4)));
    for (let i = 0; i < notes; i++) {
      voices.push(
        this.theme === 'sprint'
          ? {
              wave: 'triangle',
              frequency: note(STEPS[i]!, 330),
              delay: i * 0.035,
              duration: 0.09,
              decay: 0.08,
              gain: 0.03,
            }
          : {
              wave: 'sine',
              frequency: note(STEPS[i]! + 12, 440),
              delay: i * 0.04,
              duration: 0.3,
              decay: 0.28,
              gain: 0.025,
            },
      );
    }
    this.play('sweep', voices);
  }

  /** The start of an event: the starter's two tones, or the chamber spinning up. */
  start() {
    if (this.theme === 'sprint') {
      this.play('start', [
        { wave: 'square', frequency: 660, duration: 0.12, decay: 0.1, gain: 0.03, lowpass: 2000 },
        {
          wave: 'square',
          frequency: 990,
          delay: 0.5,
          duration: 0.25,
          decay: 0.22,
          gain: 0.04,
          lowpass: 2400,
        },
      ]);
    } else {
      this.play('start', [
        {
          wave: 'sine',
          frequency: 110,
          glideTo: 440,
          duration: 0.7,
          attack: 0.3,
          decay: 0.4,
          gain: 0.04,
        },
        { wave: 'sine', frequency: 880, delay: 0.55, duration: 0.5, decay: 0.45, gain: 0.03 },
      ]);
    }
  }

  /** The end of an event or a block: the crowd, or the chamber's chord. Louder for a best. */
  finish(best: boolean) {
    const lift = best ? 1.4 : 1;
    if (this.theme === 'sprint') {
      this.play('finish', [
        {
          wave: 'noise',
          duration: 1.8,
          attack: 0.25,
          decay: 1.5,
          gain: 0.05 * lift,
          lowpass: 1800,
        },
        { wave: 'triangle', frequency: 523, duration: 0.3, decay: 0.28, gain: 0.05 },
        { wave: 'triangle', frequency: 659, delay: 0.12, duration: 0.3, decay: 0.28, gain: 0.05 },
        {
          wave: 'triangle',
          frequency: 784,
          delay: 0.24,
          duration: 0.5,
          decay: 0.45,
          gain: 0.05 * lift,
        },
      ]);
    } else {
      this.play('finish', [
        { wave: 'sine', frequency: 523, duration: 1.4, attack: 0.05, decay: 1.3, gain: 0.04 },
        { wave: 'sine', frequency: 659, delay: 0.08, duration: 1.4, decay: 1.3, gain: 0.035 },
        { wave: 'sine', frequency: 784, delay: 0.16, duration: 1.4, decay: 1.3, gain: 0.03 * lift },
        {
          wave: 'sine',
          frequency: 1047,
          delay: 0.24,
          duration: 1.6,
          decay: 1.5,
          gain: 0.025 * lift,
        },
      ]);
    }
  }

  /** The picture hint appearing. */
  hint() {
    this.play('hint', [
      { wave: 'sine', frequency: 587, duration: 0.25, decay: 0.22, gain: 0.03 },
      { wave: 'sine', frequency: 880, delay: 0.1, duration: 0.3, decay: 0.28, gain: 0.025 },
    ]);
  }
}
