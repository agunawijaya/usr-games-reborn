import type { LossKind, Status } from '../engine/game';

/**
 * The words at the end of a run. Gentle, a little silly, never unkind: a bonk is a bonk and the
 * noodle is always fine.
 */

export interface EndingText {
  title: string;
  story: string;
}

const LOSSES: Record<LossKind, EndingText> = {
  wall: {
    title: 'Bonk!',
    story:
      'Nose first into the edge of the bed. The noodle sees a few stars, shakes it off, and wants another go.',
  },
  rock: {
    title: 'Bonk!',
    story: 'That rock was not going anywhere. The noodle rubs its nose and blinks the stars away.',
  },
  self: {
    title: 'In a tangle',
    story:
      'The noodle met its own middle and tied itself in a happy knot. Untangling takes a moment.',
  },
  flow: {
    title: 'Wrong way!',
    story: 'One-way soil only lets you in going its way. The noodle bounced off the current.',
  },
  'out-of-numbers': {
    title: 'Out of numbers',
    story:
      'The last number is eaten and digested, but a few cells are still bare. Another route might cover them.',
  },
};

const ENDS: Partial<Record<Status, EndingText>> = {
  grown: {
    title: 'Garden grown!',
    story:
      'The noodle has grown as long as this garden asked. It stretches out in the sun, very pleased.',
  },
  filled: {
    title: 'Box filled!',
    story: 'Every cell of the box is noodle. Almost nobody saw this screen in 1980.',
  },
};

export function endingText(status: Status, loss: LossKind | null): EndingText {
  if (status === 'lost' && loss) return LOSSES[loss];
  return ENDS[status] ?? LOSSES.wall;
}

/** A line for the top of the screen while the noodle waits for its first move. */
export const START_HINT = 'Press an arrow key (or W A S D) to set off';

export const TEMPO_HINT =
  'Left alone the noodle creeps. Press or hold the keys to speed it up: bites are worth more at a quicker tempo.';
