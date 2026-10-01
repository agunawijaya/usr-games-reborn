import type { DateKey } from '@usr-games/kit';
import {
  acknowledgeRank,
  emptyProgression,
  type EngineContext,
  type ProgressionState,
  rankById,
  recordLogin,
} from '@usr-games/kit/progression';
import type { Profile } from '../store/hall-store';

/**
 * Who is sitting at the Hall in a screenshot scene (`&player=`). The default is "ada", a month
 * into the first wave at Level 17; the others show the ends of the journey and the moment in
 * between, so every screen can be judged empty, full and mid-celebration.
 */

export type ScenePlayer = 'ada' | 'new' | 'root' | 'rankup';

export const SCENE_PLAYERS: readonly ScenePlayer[] = ['ada', 'new', 'root', 'rankup'];

/** Past root by a comfortable margin, so the closet is open and every cosmetic is unlocked. */
const ROOT_MARGIN_XP = 2_150;

export function readScenePlayer(value: string | null): ScenePlayer {
  return SCENE_PLAYERS.includes(value as ScenePlayer) ? (value as ScenePlayer) : 'ada';
}

/** Everyone is ada; a new player simply started today. */
export function sceneProfile(player: ScenePlayer, started: DateKey, today: DateKey): Profile {
  return {
    username: 'ada',
    guest: false,
    createdOn: player === 'new' ? today : started,
    hintsSeen: ['esc-menu'],
    styleChosen: true,
  };
}

/**
 * Turns ada's month of play into the requested player. `rankup` leaves her staff promotion
 * uncelebrated, which is exactly the state a style finds when the player comes back from the
 * game that crossed the line.
 */
export function sceneProgression(
  player: ScenePlayer,
  ada: () => ProgressionState,
  context: EngineContext,
): ProgressionState {
  switch (player) {
    case 'ada':
      return ada();
    case 'new':
      return recordLogin(emptyProgression(), context).state;
    case 'root':
      return acknowledgeRank({ ...ada(), xp: rankById('root').threshold + ROOT_MARGIN_XP });
    case 'rankup':
      return { ...ada(), celebratedRank: 'user' };
  }
}
