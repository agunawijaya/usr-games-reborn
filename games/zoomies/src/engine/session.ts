import { classicWaveSpec, createRoom } from './room';
import { applyAction } from './rules';
import { scoreNight } from './scoring';
import type { Action, RoomState, TurnEvent } from './types';

/**
 * A room being played: every state along the way, so undo is just a step back. Because the
 * zoom stream lives in the state, undoing a zoom and zooming again lands in the same place.
 */
export interface RoomSession {
  readonly history: readonly RoomState[];
  readonly actions: readonly Action[];
  readonly undos: number;
}

export function startSession(initial: RoomState): RoomSession {
  return { history: [initial], actions: [], undos: 0 };
}

export function current(session: RoomSession): RoomState {
  return session.history[session.history.length - 1]!;
}

export function initialState(session: RoomSession): RoomState {
  return session.history[0]!;
}

export function play(
  session: RoomSession,
  action: Action,
): { session: RoomSession; events: readonly TurnEvent[] } {
  const { state, events } = applyAction(current(session), action);
  return {
    session: {
      history: [...session.history, state],
      actions: [...session.actions, action],
      undos: session.undos,
    },
    events,
  };
}

export function canUndo(session: RoomSession): boolean {
  return session.history.length > 1;
}

export function undo(session: RoomSession): RoomSession {
  if (!canUndo(session)) return session;
  return {
    history: session.history.slice(0, -1),
    actions: session.actions.slice(0, -1),
    undos: session.undos + 1,
  };
}

// ---------------------------------------------------------------------------------------------
// The Long Night: one wave after another on the original field

export interface NightSession {
  readonly seed: string;
  readonly startWave: number;
  readonly wave: number;
  /** Waves already cleared, in order. */
  readonly cleared: readonly RoomState[];
  readonly room: RoomSession;
}

export function startNight(seed: string, startWave = 1): NightSession {
  return {
    seed,
    startWave,
    wave: startWave,
    cleared: [],
    room: startSession(createRoom(classicWaveSpec(seed, startWave))),
  };
}

export function nextWave(night: NightSession): NightSession {
  const wave = night.wave + 1;
  return {
    ...night,
    wave,
    cleared: [...night.cleared, current(night.room)],
    room: startSession(createRoom(classicWaveSpec(night.seed, wave))),
  };
}

export function nightScore(night: NightSession): number {
  return scoreNight([...night.cleared, current(night.room)], night.startWave);
}

export function nightTangled(night: NightSession): number {
  return [...night.cleared, current(night.room)].reduce((sum, room) => sum + room.tangled, 0);
}
