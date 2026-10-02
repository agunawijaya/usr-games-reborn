import type { Patch, Synth } from '@usr-games/kit';

/**
 * Every sound in the garden, synthesised: soft footsteps, chimes that climb as your pockets
 * fill, a hiss that thickens as the snake grows bold, the spill, the dial's ticks, the vault's
 * cascade and the wink's little "ting". Quiet by default; the Hall's volume rules them all.
 */
export class Sounds {
  private muted = false;

  constructor(private readonly synth: Synth) {}

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  private play(patch: Patch) {
    if (!this.muted) this.synth.play(patch);
  }

  footstep(alternate: boolean) {
    this.play({
      name: 'step',
      voices: [
        {
          wave: 'noise',
          duration: 0.05,
          attack: 0.002,
          decay: 0.04,
          gain: 0.08,
          lowpass: alternate ? 900 : 700,
        },
      ],
    });
  }

  bump() {
    this.play({
      name: 'bump',
      voices: [{ wave: 'triangle', frequency: 120, glideTo: 90, duration: 0.09, gain: 0.12 }],
    });
  }

  /** A chime one step higher for every glint in your pockets, up to two octaves. */
  pickup(pickupsSoFar: number) {
    const semitone = Math.min(24, pickupsSoFar * 2);
    const base = 660 * Math.pow(2, semitone / 12);
    this.play({
      name: 'glint',
      voices: [
        { wave: 'sine', frequency: base, duration: 0.35, attack: 0.004, decay: 0.3, gain: 0.16 },
        {
          wave: 'sine',
          frequency: base * 1.5,
          delay: 0.06,
          duration: 0.3,
          decay: 0.25,
          gain: 0.08,
        },
        {
          wave: 'triangle',
          frequency: base * 2,
          delay: 0.1,
          duration: 0.25,
          decay: 0.2,
          gain: 0.04,
        },
      ],
    });
  }

  /** The snake's slide: a hiss, thicker and lower as it grows bold. */
  slither(boldness: number) {
    this.play({
      name: 'slither',
      voices: [
        {
          wave: 'noise',
          duration: 0.16,
          attack: 0.03,
          decay: 0.12,
          gain: 0.025 + boldness * 0.05,
          lowpass: 5200 - boldness * 3200,
        },
      ],
    });
  }

  wake() {
    this.play({
      name: 'wake',
      voices: [
        { wave: 'noise', duration: 0.5, attack: 0.1, decay: 0.35, gain: 0.09, lowpass: 2400 },
        { wave: 'triangle', frequency: 180, glideTo: 260, duration: 0.4, gain: 0.06 },
      ],
    });
  }

  peek() {
    this.play({
      name: 'peek',
      voices: [
        { wave: 'sine', frequency: 880, duration: 0.12, gain: 0.07 },
        { wave: 'sine', frequency: 1175, delay: 0.08, duration: 0.14, gain: 0.06 },
      ],
    });
  }

  warp() {
    this.play({
      name: 'warp',
      voices: [
        { wave: 'sine', frequency: 300, glideTo: 1400, duration: 0.45, attack: 0.02, gain: 0.1 },
        {
          wave: 'triangle',
          frequency: 1500,
          glideTo: 500,
          delay: 0.25,
          duration: 0.35,
          gain: 0.06,
        },
      ],
    });
  }

  /** The coil and the spill: a tightening hiss, then glints scattering across the stones. */
  caught() {
    this.play({
      name: 'coil',
      voices: [
        { wave: 'noise', duration: 0.7, attack: 0.05, decay: 0.6, gain: 0.12, lowpass: 1600 },
        { wave: 'triangle', frequency: 220, glideTo: 110, duration: 0.6, gain: 0.08 },
        ...Array.from({ length: 8 }, (_, i) => ({
          wave: 'sine' as const,
          frequency: 1200 + ((i * 337) % 900),
          delay: 0.45 + i * 0.06,
          duration: 0.18,
          decay: 0.15,
          gain: 0.05,
        })),
      ],
    });
  }

  tick() {
    this.play({
      name: 'tick',
      voices: [{ wave: 'square', frequency: 1800, duration: 0.025, gain: 0.03, lowpass: 3000 }],
    });
  }

  escaped() {
    this.play({
      name: 'escape',
      voices: [523, 659, 784, 1047].map((frequency, i) => ({
        wave: 'triangle' as const,
        frequency,
        delay: i * 0.08,
        duration: 0.3,
        gain: 0.08,
      })),
    });
  }

  /** A soft fall, never a fanfare of failure: the glints roll away, that is all. */
  scrambled() {
    this.play({
      name: 'scramble',
      voices: [
        { wave: 'triangle', frequency: 392, glideTo: 330, duration: 0.4, gain: 0.07 },
        { wave: 'triangle', frequency: 330, glideTo: 262, delay: 0.25, duration: 0.5, gain: 0.06 },
      ],
    });
  }

  wink() {
    this.play({
      name: 'wink',
      voices: [
        { wave: 'sine', frequency: 2093, duration: 0.25, attack: 0.002, decay: 0.22, gain: 0.08 },
      ],
    });
  }

  /** Glints pouring into the vault, a ripple of chimes. */
  bank(glints: number) {
    const count = Math.min(16, 6 + glints);
    this.play({
      name: 'bank',
      voices: Array.from({ length: count }, (_, i) => ({
        wave: 'sine' as const,
        frequency: 880 + ((i * 263) % 1200),
        delay: i * 0.07,
        duration: 0.22,
        decay: 0.18,
        gain: 0.06,
      })),
    });
  }
}
