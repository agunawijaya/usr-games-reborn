import type { RoomSpec } from '../engine/room';
import { HOUSE, type HouseRoom, type RoomTheme } from './blueprints';
import { HOUSE_LAYOUTS } from './house-layouts';

export interface PlayableRoom extends HouseRoom {
  readonly index: number;
  readonly par: number;
  readonly spec: RoomSpec;
}

export const ROOMS: readonly PlayableRoom[] = HOUSE.map((room, index) => ({
  ...room,
  index,
  ...HOUSE_LAYOUTS[room.id],
}));

export function roomById(id: RoomTheme): PlayableRoom {
  const room = ROOMS.find((r) => r.id === id);
  if (!room) throw new Error(`No room ${id}`);
  return room;
}

export const STARS_IN_HOUSE = ROOMS.length * 3;
