// A tiny event bus: the game loop announces what happened in a turn and
// the scene effects, the camera, the HUD and the audio each react to it.

import type { Position } from '../game/state';

export type FxEvent =
  | { type: 'impact'; at: Position; count: number; onPile: boolean; chain: number }
  | { type: 'teleport'; from: Position; to: Position }
  | { type: 'playerStep'; to: Position }
  | { type: 'robotSteps'; count: number; nearest: number }
  | { type: 'death'; at: Position }
  | { type: 'levelClear'; level: number }
  | { type: 'levelStart'; level: number; robots: number }
  | { type: 'spawn'; at: Position; delay: number }
  | { type: 'shake'; amount: number }
  // the stadium
  | { type: 'firework'; phase: 'launch' | 'burst'; size: number; distance: number }
  | { type: 'trash'; kind: TrashKind; speed: number };

export type TrashKind = 'can' | 'cup' | 'bottle' | 'paper';

type Listener = (e: FxEvent) => void;
const listeners = new Set<Listener>();

export const fxBus = {
  on(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  emit(e: FxEvent): void {
    for (const fn of listeners) fn(e);
  },
};
