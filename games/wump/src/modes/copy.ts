import type { Ending } from '../engine/expedition';
import type { PopulationProblem } from '../engine/expedition';

/**
 * Every line the game says at the big moments, in our own words. The wumpus is hushed, never
 * hurt; the explorer is bowled over, never harmed; nothing here borrows the original's wording.
 */

export interface EndingText {
  title: string;
  story: string;
}

export function endingText(ending: Ending): EndingText {
  switch (ending.kind) {
    case 'hushed':
      return {
        title: 'Hushed!',
        story:
          'It yawned hugely, turned round three times, curled up and began to snore. You tiptoe out.',
      };
    case 'bowled-over':
      return ending.cause === 'walked-in'
        ? {
            title: 'Bowled over!',
            story:
              'You stepped straight into the wumpus’s room. It bowled you over, gave your boots a long, slobbery sniff, and you fled the cave empty-handed.',
          }
        : {
            title: 'It came to you',
            story:
              'Woken and grumpy, the wumpus shuffled into your room, bowled you over and sniffed you all over. You fled for daylight.',
          };
    case 'pit':
      return {
        title: 'Down you go',
        story:
          'The floor gave way under you. Your rope snagged on the edge and the team hauled you back to the entrance: bruised, dusty, and done for the day.',
      };
    case 'own-dart':
      return {
        title: 'Your own dart',
        story:
          'The dart flew round and came back to you. You nodded off on the spot; the wumpus found you snoring and carried you, very gently, out of the cave.',
      };
    case 'empty-quiver':
      return {
        title: 'Out of darts',
        story:
          'Your last dart missed. The wumpus heard the empty quiver rattle and came looking, and you ran.',
      };
  }
}

/** Why a custom cave cannot be dug, in a playful line. */
export const REFUSALS: Record<PopulationProblem, string> = {
  'too-few-rooms': 'Ten rooms at the least: a wumpus needs somewhere to turn round.',
  'too-many-rooms': 'Two hundred and fifty rooms is as big as any cave map gets.',
  'too-few-tunnels': 'Give each room two tunnels at least, or nobody gets anywhere.',
  collapses: 'That many tunnels would leave more hole than rock. The roof gives way.',
  'too-crowded': 'Bats in more than half the rooms? The bats themselves would move out.',
  'too-dangerous': 'Pits in more than half the rooms leave no floor to walk on.',
  'no-room-to-stand': 'Standard rules keep bats and pits apart: leave two rooms clear to stand in.',
};

export interface TutorialLine {
  title: string;
  body: string;
}

/** The tutorial's prism cave, room by room: what to notice and what to try next. */
export const TUTORIAL_LINES: Record<number, TutorialLine> = {
  1: {
    title: 'A quiet room',
    body: 'No draft, no flutter, no whiff: nothing dangerous lies through any tunnel here. Walk to room 2: click its tunnel, or press 1.',
  },
  2: {
    title: 'A draft, and a whiff',
    body: 'A pit lies through 3 or 7 (you came from 1, which is safe). The faint whiff says the wumpus is two rooms away. Go back to 1 and try room 6.',
  },
  5: {
    title: 'Wings',
    body: 'Bats live through 4 or 10. They would carry you off somewhere random. Head back through 1 to room 6.',
  },
  6: {
    title: 'Putting it together',
    body: 'Wings: bats through 7 or 10. Room 2 heard none, so they are in 10. No draft here, so 7 has no pit, and the whiff in 2 was faint, so the wumpus is not in 7. Room 7 is safe: press 2.',
  },
  7: {
    title: 'A strong whiff',
    body: 'The wumpus is right next door: through 2, 6 or 8. You have stood in 2 and 6, so it must be 8. Press A to aim, 3 for room 8 (or click its tunnel), then Enter to throw.',
  },
};

export const RULES_TEXT = {
  standard: 'Standard rules: every rule of the original, played as its author meant it.',
  classic: 'Classic rules: the BSD game exactly, its crooked temper and stacking pits included.',
} as const;
