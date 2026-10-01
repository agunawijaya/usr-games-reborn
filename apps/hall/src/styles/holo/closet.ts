import { closetRoom } from '../../core/screens/closet/closet';
import type { HoloContext, HoloScreen } from './context';
import { hasReached } from './level-card';
import { pageFrame } from './page-frame';

/**
 * The server closet, framed like a secret page at the back of the album: open at the top level,
 * a locked door with the way there before that. The room paints itself from the store, so the
 * shell keeps it running across changes and only rebuilds it when day turns to night.
 */

/** Screenshot scenes stop the room at one moment: fan mid-turn, a few names on the screen. */
const FROZEN_ROOM_SECONDS = 12.5;

export function closetScreen(context: HoloContext): HoloScreen {
  const open = hasReached(context.snapshot.progression.xp, 'root');
  const room = closetRoom({
    store: context.store,
    wording: 'plain',
    ...(context.frozen ? { frozenAt: FROZEN_ROOM_SECONDS } : {}),
  });
  const element = pageFrame({
    key: 'closet',
    icon: open ? 'door' : 'lock',
    eyebrow: open ? 'A reward for the top level' : 'A locked door',
    title: 'The server closet',
    body: room.element,
  });
  return {
    element,
    title: 'The server closet',
    destroy: () => room.destroy(),
    onStateChange(next, previous) {
      const opened = hasReached(next.progression.xp, 'root') !== open;
      return opened || next.appearance !== previous.appearance ? 'rebuild' : 'keep';
    },
  };
}
