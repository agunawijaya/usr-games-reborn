import type { RoomState } from './types';

/** The original's numbers: ten points a robot, and a bonus for clearing a level you skipped to. */
export const POINTS_PER_VACUUM = 10;
export const ADVANCE_BONUS = 60 * POINTS_PER_VACUUM;
export const POINTS_PER_STAR = 30;

/** A wave's points: ten per vacuum, plus the nap bonus if the wave was cleared. */
export function scoreWave(room: RoomState): number {
  const napBonus = room.status === 'cleared' ? room.napBonus : 0;
  return room.tangled * POINTS_PER_VACUUM + napBonus;
}

/** A whole Long Night, waves in order; starting past wave one pays the advance bonus once. */
export function scoreNight(rooms: readonly RoomState[], startWave: number): number {
  let total = rooms.reduce((sum, room) => sum + scoreWave(room), 0);
  if (startWave > 1 && rooms[0]?.status === 'cleared') total += ADVANCE_BONUS;
  return total;
}

export interface Stars {
  readonly tidy: boolean;
  readonly onPar: boolean;
  readonly noZoom: boolean;
}

export function starsFor(room: RoomState, par: number): Stars {
  const tidy = room.status === 'cleared';
  return { tidy, onPar: tidy && room.turn <= par, noZoom: tidy && room.zooms === 0 };
}

export function starCount(stars: Stars): number {
  return Number(stars.tidy) + Number(stars.onPar) + Number(stars.noZoom);
}

export function scoreRoom(room: RoomState, par: number): number {
  return room.tangled * POINTS_PER_VACUUM + starCount(starsFor(room, par)) * POINTS_PER_STAR;
}
