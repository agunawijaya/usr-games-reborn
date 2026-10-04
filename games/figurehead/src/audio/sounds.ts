import type { Drone, Patch, Synth } from '@usr-games/kit';
import type { BattleEvent } from '../engine';

/**
 * Figurehead's sounds, all synthesised: the ship's bell at each turn, a broadside's rolling
 * boom, the splash of a miss and the crack of timber, the flag coming down, the wind's hiss in
 * the rigging. Quiet by default; the Hall's volume and mute apply to all of them.
 */

const PATCHES = {
  bell: {
    name: 'bell',
    gain: 0.35,
    voices: [
      { wave: 'sine', frequency: 1318, duration: 1.4, gain: 0.12, decay: 0.9 },
      { wave: 'sine', frequency: 1976, duration: 0.9, gain: 0.05 },
      { wave: 'sine', frequency: 1318, delay: 0.32, duration: 1.4, gain: 0.1, decay: 0.9 },
    ],
  },
  broadside: {
    name: 'broadside',
    gain: 0.7,
    voices: [
      { wave: 'noise', duration: 0.5, gain: 0.32, lowpass: 700 },
      { wave: 'sine', frequency: 90, glideTo: 38, duration: 0.6, gain: 0.4 },
      { wave: 'noise', delay: 0.08, duration: 0.45, gain: 0.22, lowpass: 500 },
      { wave: 'sine', frequency: 80, glideTo: 35, delay: 0.1, duration: 0.55, gain: 0.3 },
      { wave: 'noise', delay: 0.18, duration: 0.6, gain: 0.18, lowpass: 420 },
    ],
  },
  distant: {
    name: 'distant',
    gain: 0.45,
    voices: [
      { wave: 'noise', duration: 0.7, gain: 0.18, lowpass: 320, attack: 0.03 },
      { wave: 'sine', frequency: 60, glideTo: 30, duration: 0.7, gain: 0.25 },
    ],
  },
  splash: {
    name: 'splash',
    gain: 0.35,
    voices: [{ wave: 'noise', duration: 0.45, gain: 0.16, lowpass: 2600, attack: 0.02 }],
  },
  timber: {
    name: 'timber',
    gain: 0.45,
    voices: [
      { wave: 'noise', duration: 0.18, gain: 0.25, lowpass: 1800 },
      { wave: 'square', frequency: 140, glideTo: 70, duration: 0.2, gain: 0.08, lowpass: 900 },
    ],
  },
  helm: {
    name: 'helm',
    gain: 0.3,
    voices: [{ wave: 'triangle', frequency: 330, glideTo: 392, duration: 0.09, gain: 0.08 }],
  },
  tick: {
    name: 'tick',
    gain: 0.25,
    voices: [{ wave: 'triangle', frequency: 880, duration: 0.05, gain: 0.07 }],
  },
  strike: {
    name: 'strike',
    gain: 0.45,
    voices: [
      { wave: 'triangle', frequency: 523, duration: 0.4, gain: 0.12 },
      { wave: 'triangle', frequency: 392, delay: 0.18, duration: 0.6, gain: 0.12 },
    ],
  },
  won: {
    name: 'won',
    gain: 0.5,
    voices: [
      { wave: 'sine', frequency: 392, duration: 0.45, gain: 0.14 },
      { wave: 'sine', frequency: 523, delay: 0.14, duration: 0.45, gain: 0.14 },
      { wave: 'sine', frequency: 659, delay: 0.28, duration: 0.45, gain: 0.14 },
      { wave: 'sine', frequency: 784, delay: 0.42, duration: 1.1, gain: 0.14 },
    ],
  },
  sombre: {
    name: 'sombre',
    gain: 0.45,
    voices: [
      { wave: 'triangle', frequency: 330, glideTo: 294, duration: 0.6, gain: 0.12 },
      { wave: 'triangle', frequency: 262, glideTo: 220, delay: 0.35, duration: 0.9, gain: 0.12 },
    ],
  },
  refused: {
    name: 'refused',
    gain: 0.3,
    voices: [{ wave: 'triangle', frequency: 200, glideTo: 160, duration: 0.12, gain: 0.12 }],
  },
} satisfies Record<string, Patch>;

const WIND: Patch = {
  name: 'wind',
  gain: 0.12,
  voices: [{ wave: 'noise', duration: 60, gain: 0.05, lowpass: 600, attack: 2 }],
};

export type SoundName = keyof typeof PATCHES;

export class Sounds {
  private wind: Drone | null = null;

  constructor(private readonly synth: Synth) {}

  play(name: SoundName, delayMs = 0): void {
    if (delayMs <= 0) this.synth.play(PATCHES[name]);
    else window.setTimeout(() => this.synth.play(PATCHES[name]), delayMs);
  }

  /** The turn's sounds, timed against its film: our guns first, then theirs after the move. */
  forTurn(events: readonly BattleEvent[], player: number, replyAt: number): void {
    this.play('bell');
    const ours = events.filter((e) => e.t === 'fire' && e.from === player);
    const theirs = events.filter((e) => e.t === 'fire' && e.from !== player);
    if (ours.length) {
      this.play('broadside', 120);
      this.play(ours.some((e) => e.t === 'fire' && e.damage) ? 'timber' : 'splash', 520);
    }
    if (theirs.length) {
      this.play(
        theirs.some((e) => e.t === 'fire' && e.to === player) ? 'broadside' : 'distant',
        replyAt,
      );
      if (theirs.some((e) => e.t === 'fire' && e.to === player && e.damage))
        this.play('timber', replyAt + 380);
    }
    if (events.some((e) => e.t === 'strike')) this.play('strike', replyAt + 500);
  }

  startWind(): void {
    if (!this.wind) this.wind = this.synth.drone(WIND);
  }

  stopWind(): void {
    this.wind?.stop(0.8);
    this.wind = null;
  }
}
