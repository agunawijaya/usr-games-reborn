import { createSynth, HALL_PATCHES, type Patch, type Synth } from '@usr-games/kit';
import type { HallStore } from '../store/hall-store';

/**
 * The Hall's one synthesiser, shared by every style, the player and native games. It follows
 * the volume and mute settings live and starts quiet by default. Browsers only allow sound after
 * a user gesture, so nothing plays until the player has pressed a key or clicked.
 */

export type HallSound = keyof typeof HALL_PATCHES;

let shared: { synth: Synth; stop: () => void } | null = null;

export function hallSynth(store: HallStore): Synth {
  if (shared) return shared.synth;
  const synth = createSynth({
    getVolume: () => store.settings.get().volume,
    isMuted: () => store.settings.get().muted,
  });
  const stop = store.settings.subscribe(() => synth.refresh());
  shared = { synth, stop };
  return synth;
}

export function playSound(store: HallStore, sound: HallSound | Patch): void {
  hallSynth(store).play(typeof sound === 'string' ? HALL_PATCHES[sound] : sound);
}
