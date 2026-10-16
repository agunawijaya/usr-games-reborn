import type { BoardId } from '../../boards/themes';
import type { BoardArt } from '../world/world';
import { createColonyArt } from './colony';
import { createHarbourArt } from './harbour';
import { createPopupArt } from './popup';

/** Each board's art, for whoever builds a world: the game, its attract mode and its poster. */
export const ART: Readonly<Record<BoardId, () => BoardArt>> = {
  harbour: createHarbourArt,
  colony: createColonyArt,
  popup: createPopupArt,
};
