import type { Patch, Synth } from '@usr-games/kit';
import type { Beat } from '../engine/beats';

/**
 * Lightkeeper's sounds, all synthesised: the warm hum of the beams, a flare's whistle, the
 * gleaners' dry clicks, the bell of a world relit, the radio's chirp. Quiet by default; the
 * Hall's volume and mute apply to all of them.
 */

const PATCHES = {
  beam: {
    name: 'beam',
    gain: 0.4,
    voices: [
      { wave: 'sawtooth', frequency: 220, glideTo: 330, duration: 0.35, gain: 0.08, lowpass: 1400 },
      { wave: 'sine', frequency: 440, glideTo: 660, duration: 0.35, gain: 0.12 },
    ],
  },
  flare: {
    name: 'flare',
    gain: 0.45,
    voices: [
      { wave: 'triangle', frequency: 900, glideTo: 260, duration: 0.45, gain: 0.14 },
      { wave: 'noise', duration: 0.35, gain: 0.1, lowpass: 2200, attack: 0.02 },
    ],
  },
  burst: {
    name: 'burst',
    gain: 0.6,
    voices: [
      { wave: 'noise', duration: 0.5, gain: 0.3, lowpass: 900 },
      { wave: 'sine', frequency: 120, glideTo: 50, duration: 0.5, gain: 0.35 },
    ],
  },
  shot: {
    name: 'shot',
    gain: 0.35,
    voices: [
      { wave: 'square', frequency: 680, glideTo: 380, duration: 0.09, gain: 0.08, lowpass: 2200 },
      { wave: 'noise', duration: 0.05, gain: 0.08, lowpass: 3000 },
    ],
  },
  stopped: {
    name: 'stopped',
    gain: 0.5,
    voices: [
      { wave: 'triangle', frequency: 520, glideTo: 90, duration: 0.55, gain: 0.2 },
      { wave: 'sine', frequency: 260, glideTo: 60, delay: 0.08, duration: 0.5, gain: 0.15 },
    ],
  },
  shield: {
    name: 'shield',
    gain: 0.35,
    voices: [{ wave: 'sine', frequency: 300, glideTo: 520, duration: 0.3, gain: 0.15 }],
  },
  jump: {
    name: 'jump',
    gain: 0.45,
    voices: [
      { wave: 'noise', duration: 0.7, gain: 0.16, lowpass: 1600, attack: 0.25 },
      { wave: 'sine', frequency: 110, glideTo: 440, duration: 0.7, gain: 0.12, attack: 0.2 },
    ],
  },
  call: {
    name: 'call',
    gain: 0.4,
    voices: [
      { wave: 'square', frequency: 1320, duration: 0.07, gain: 0.06, lowpass: 3000 },
      { wave: 'square', frequency: 1320, delay: 0.12, duration: 0.07, gain: 0.06, lowpass: 3000 },
      { wave: 'square', frequency: 990, delay: 0.24, duration: 0.12, gain: 0.06, lowpass: 3000 },
    ],
  },
  relit: {
    name: 'relit',
    gain: 0.45,
    voices: [
      { wave: 'sine', frequency: 523, duration: 0.6, gain: 0.14 },
      { wave: 'sine', frequency: 659, delay: 0.1, duration: 0.6, gain: 0.12 },
      { wave: 'sine', frequency: 784, delay: 0.2, duration: 0.8, gain: 0.12 },
    ],
  },
  darkened: {
    name: 'darkened',
    gain: 0.4,
    voices: [
      { wave: 'triangle', frequency: 330, glideTo: 220, duration: 0.6, gain: 0.12 },
      { wave: 'triangle', frequency: 262, glideTo: 175, delay: 0.15, duration: 0.6, gain: 0.1 },
    ],
  },
  moor: {
    name: 'moor',
    gain: 0.4,
    voices: [
      { wave: 'sine', frequency: 392, duration: 0.25, gain: 0.12 },
      { wave: 'sine', frequency: 587, delay: 0.12, duration: 0.4, gain: 0.12 },
    ],
  },
  refused: {
    name: 'refused',
    gain: 0.3,
    voices: [{ wave: 'triangle', frequency: 200, glideTo: 160, duration: 0.12, gain: 0.12 }],
  },
  won: {
    name: 'won',
    gain: 0.5,
    voices: [
      { wave: 'sine', frequency: 523, duration: 0.5, gain: 0.14 },
      { wave: 'sine', frequency: 659, delay: 0.15, duration: 0.5, gain: 0.14 },
      { wave: 'sine', frequency: 784, delay: 0.3, duration: 0.5, gain: 0.14 },
      { wave: 'sine', frequency: 1047, delay: 0.45, duration: 0.9, gain: 0.14 },
    ],
  },
  lost: {
    name: 'lost',
    gain: 0.45,
    voices: [
      { wave: 'triangle', frequency: 392, glideTo: 330, duration: 0.5, gain: 0.12 },
      { wave: 'triangle', frequency: 330, glideTo: 262, delay: 0.3, duration: 0.8, gain: 0.12 },
    ],
  },
} satisfies Record<string, Patch>;

export type SoundName = keyof typeof PATCHES;

export class Sounds {
  constructor(private readonly synth: Synth) {}

  play(name: SoundName) {
    this.synth.play(PATCHES[name]);
  }

  /**
   * One sound per kind of thing that happened, spread over the order's animation. Sounds named
   * in `except` are left to the caller (the saved-world chime, timed to its moment).
   */
  forBeats(beats: readonly Beat[], speed: number, except: readonly SoundName[] = []) {
    const queued = new Set<SoundName>(except);
    let delay = 0;
    const later = (name: SoundName, step = 0.18) => {
      if (queued.has(name)) return;
      queued.add(name);
      const at = delay;
      delay += step * speed;
      window.setTimeout(() => this.play(name), at * 1000);
    };
    for (const beat of beats) {
      if (beat.type === 'refused') later('refused');
      if (beat.type === 'travel' && beat.from.zone.row !== beat.to.zone.row) later('jump', 0.5);
      if (beat.type === 'travel' && beat.from.zone.col !== beat.to.zone.col) later('jump', 0.5);
      if (beat.type === 'shot') later('shot');
      if (beat.type === 'beam') later('beam', 0.3);
      if (beat.type === 'flare') later('flare', 0.3);
      if (beat.type === 'nova' || beat.type === 'collapse') later('burst', 0.3);
      if (beat.type === 'gleaner-stopped') later('stopped', 0.3);
      if (beat.type === 'shield') later('shield');
      if ((beat.type === 'call' || beat.type === 'siege') && beat.heard) later('call', 0.4);
      if (beat.type === 'world-relit') later('relit', 0.5);
      if (beat.type === 'world-fell' && beat.heard) later('darkened', 0.4);
      if (beat.type === 'moored') later('moor');
      if (beat.type === 'won') later('won');
      if (beat.type === 'lost') later('lost');
    }
  }
}
