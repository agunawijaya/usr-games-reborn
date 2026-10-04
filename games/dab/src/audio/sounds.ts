import type { Patch, Synth } from '@usr-games/kit';
import type { Look } from '../render/look';

/**
 * Every sound in Double Cross, synthesised and quiet by default: the scratch of chalk or the
 * buzz of a tube lighting, a plucked note for each box (climbing as a run goes on), the snip of
 * the double cross, and a short tune at the end. The Hall's volume and mute rule them all.
 */
export class Sounds {
  constructor(private readonly synth: Synth) {}

  private play(patch: Patch) {
    this.synth.play(patch);
  }

  line(look: Look) {
    if (look === 'chalk') {
      this.play({
        name: 'chalk',
        voices: [
          { wave: 'noise', duration: 0.13, attack: 0.01, decay: 0.11, gain: 0.06, lowpass: 2800 },
          { wave: 'noise', delay: 0.05, duration: 0.09, decay: 0.08, gain: 0.04, lowpass: 1800 },
        ],
      });
      return;
    }
    this.play({
      name: 'tube',
      voices: [
        {
          wave: 'sawtooth',
          frequency: 118,
          glideTo: 122,
          duration: 0.22,
          attack: 0.004,
          decay: 0.2,
          gain: 0.035,
          lowpass: 900,
        },
        { wave: 'square', frequency: 1800, duration: 0.03, decay: 0.02, gain: 0.02, lowpass: 3000 },
      ],
    });
  }

  /** A box claimed; `run` counts the boxes taken in a row, and lifts the note. */
  box(run: number, mine: boolean) {
    const step = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24][Math.min(10, run)]!;
    const base = (mine ? 523.25 : 392) * Math.pow(2, step / 12);
    this.play({
      name: 'box',
      voices: [
        {
          wave: 'triangle',
          frequency: base,
          duration: 0.28,
          attack: 0.003,
          decay: 0.25,
          gain: 0.11,
        },
        { wave: 'sine', frequency: base * 2, delay: 0.02, duration: 0.18, decay: 0.15, gain: 0.04 },
      ],
    });
  }

  /** The double cross: two quick snips of the scissors and a low knock. */
  snip() {
    this.play({
      name: 'snip',
      voices: [
        {
          wave: 'triangle',
          frequency: 2600,
          glideTo: 1900,
          duration: 0.05,
          decay: 0.04,
          gain: 0.07,
        },
        {
          wave: 'triangle',
          frequency: 2400,
          glideTo: 1700,
          delay: 0.11,
          duration: 0.05,
          decay: 0.04,
          gain: 0.07,
        },
        {
          wave: 'sine',
          frequency: 110,
          glideTo: 70,
          delay: 0.12,
          duration: 0.3,
          decay: 0.28,
          gain: 0.12,
        },
      ],
    });
  }

  bump() {
    this.play({
      name: 'bump',
      voices: [{ wave: 'triangle', frequency: 150, glideTo: 110, duration: 0.08, gain: 0.08 }],
    });
  }

  /** The end of a game: a climbing tune for a win, a level one for a tie, a soft fall otherwise. */
  end(outcome: 'win' | 'tie' | 'loss') {
    const notes =
      outcome === 'win'
        ? [523.25, 659.25, 783.99, 1046.5]
        : outcome === 'tie'
          ? [523.25, 523.25, 659.25]
          : [440, 392, 349.23];
    this.play({
      name: `end-${outcome}`,
      voices: notes.map((frequency, i) => ({
        wave: 'triangle' as const,
        frequency,
        delay: i * 0.12,
        duration: 0.32,
        attack: 0.005,
        decay: 0.3,
        gain: 0.1,
      })),
    });
  }
}
