import type { Patch, Synth } from '@usr-games/kit';
import type { TurnEvent } from '../engine/types';

/**
 * Every sound is a patch for the kit's synthesiser: soft paws, the whirr of a turn, a cartoon
 * bonk with a spring in it, a gulp, the whoosh of a zoom, a purr for loafing, a little tune for
 * a tidy room. Quiet by default; the Hall's volume and mute apply.
 */

const PATCHES = {
  paw: {
    name: 'paw',
    gain: 0.5,
    voices: [{ wave: 'triangle', frequency: 240, glideTo: 170, duration: 0.06, gain: 0.25 }],
  },
  whirr: {
    name: 'whirr',
    gain: 0.35,
    voices: [
      { wave: 'noise', duration: 0.16, gain: 0.12, lowpass: 700, attack: 0.03 },
      { wave: 'sawtooth', frequency: 90, glideTo: 110, duration: 0.16, gain: 0.05, lowpass: 400 },
    ],
  },
  bonk: {
    name: 'bonk',
    gain: 0.7,
    voices: [
      { wave: 'sine', frequency: 190, glideTo: 80, duration: 0.2, gain: 0.5 },
      { wave: 'noise', duration: 0.06, gain: 0.25, lowpass: 1800 },
      { wave: 'triangle', frequency: 420, glideTo: 760, delay: 0.05, duration: 0.18, gain: 0.18 },
    ],
  },
  stuck: {
    name: 'stuck',
    gain: 0.6,
    voices: [
      { wave: 'sine', frequency: 140, glideTo: 70, duration: 0.22, gain: 0.45 },
      { wave: 'noise', duration: 0.1, gain: 0.18, lowpass: 900 },
    ],
  },
  gulp: {
    name: 'gulp',
    gain: 0.6,
    voices: [
      { wave: 'sine', frequency: 320, glideTo: 110, duration: 0.22, gain: 0.4 },
      { wave: 'sine', frequency: 520, glideTo: 300, delay: 0.12, duration: 0.12, gain: 0.2 },
    ],
  },
  zoom: {
    name: 'zoom',
    gain: 0.5,
    voices: [
      { wave: 'noise', duration: 0.3, gain: 0.18, lowpass: 3000, attack: 0.08 },
      { wave: 'triangle', frequency: 300, glideTo: 1300, duration: 0.25, gain: 0.12 },
    ],
  },
  purr: {
    name: 'purr',
    gain: 0.45,
    voices: [
      {
        wave: 'sawtooth',
        frequency: 26,
        duration: 0.5,
        gain: 0.25,
        lowpass: 180,
        attack: 0.08,
        release: 0.2,
      },
      { wave: 'noise', duration: 0.5, gain: 0.05, lowpass: 220, attack: 0.1 },
    ],
  },
  sparkle: {
    name: 'sparkle',
    gain: 0.4,
    voices: [
      { wave: 'triangle', frequency: 1320, duration: 0.08, gain: 0.18 },
      { wave: 'triangle', frequency: 1760, delay: 0.07, duration: 0.12, gain: 0.15 },
    ],
  },
  dock: {
    name: 'dock',
    gain: 0.35,
    voices: [
      { wave: 'square', frequency: 880, duration: 0.05, gain: 0.08, lowpass: 2400 },
      { wave: 'square', frequency: 1175, delay: 0.08, duration: 0.06, gain: 0.08, lowpass: 2400 },
    ],
  },
  refuse: {
    name: 'refuse',
    gain: 0.4,
    voices: [{ wave: 'triangle', frequency: 200, glideTo: 160, duration: 0.09, gain: 0.2 }],
  },
  caught: {
    name: 'caught',
    gain: 0.6,
    voices: [
      { wave: 'noise', duration: 0.35, gain: 0.22, lowpass: 2600, attack: 0.02 },
      { wave: 'sine', frequency: 392, delay: 0.3, duration: 0.25, gain: 0.25 },
      { wave: 'sine', frequency: 311, delay: 0.55, duration: 0.45, gain: 0.25 },
    ],
  },
  tidy: {
    name: 'tidy',
    gain: 0.55,
    voices: [
      { wave: 'triangle', frequency: 523, duration: 0.14, gain: 0.22 },
      { wave: 'triangle', frequency: 659, delay: 0.1, duration: 0.14, gain: 0.22 },
      { wave: 'triangle', frequency: 784, delay: 0.2, duration: 0.14, gain: 0.22 },
      { wave: 'triangle', frequency: 1046, delay: 0.3, duration: 0.3, gain: 0.22 },
      { wave: 'sine', frequency: 620, glideTo: 900, delay: 0.55, duration: 0.18, gain: 0.12 },
      { wave: 'sine', frequency: 900, glideTo: 700, delay: 0.72, duration: 0.2, gain: 0.12 },
    ],
  },
} satisfies Record<string, Patch>;

export type SoundName = keyof typeof PATCHES;

export class Sounds {
  constructor(private synth: Synth) {}

  play(name: SoundName) {
    this.synth.play(PATCHES[name]);
  }

  /** One turn's worth of sound, read from its events. */
  turn(events: readonly TurnEvent[]) {
    let moved = false;
    for (const event of events) {
      switch (event.type) {
        case 'cat-step':
          this.play('paw');
          break;
        case 'cat-zoom':
          this.play('zoom');
          break;
        case 'vacuum-move':
          moved = true;
          break;
        case 'bonk':
          this.play(event.onTangle ? 'stuck' : 'bonk');
          break;
        case 'gulp':
          this.play('gulp');
          break;
        case 'dock-spawn':
          this.play('dock');
          break;
        case 'safe-zoom-earned':
          this.play('sparkle');
          break;
        case 'caught':
          this.play('caught');
          break;
        default:
          break;
      }
    }
    if (moved) this.play('whirr');
  }
}
