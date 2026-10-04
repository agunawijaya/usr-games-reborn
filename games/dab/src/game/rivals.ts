import type { OpponentId } from '../ai/opponents';
import type { MarkId } from '../render/marks';

/**
 * Who you play against: a name, the mark they leave in their boxes, a line about them, and
 * what they say at the moments that matter. Every word here is ours.
 */
export interface Rival {
  readonly id: OpponentId;
  readonly name: string;
  /** The short name on the score chip. */
  readonly short: string;
  readonly mark: MarkId;
  readonly blurb: string;
  readonly says: {
    readonly hello: string;
    /** It took a run of boxes. */
    readonly feast: string;
    /** You handed boxes back to it. */
    readonly crossed: string;
    /** It handed boxes back to you. */
    readonly crossing: string;
    readonly wins: string;
    readonly loses: string;
  };
}

export const RIVALS: Readonly<Record<OpponentId, Rival>> = {
  scribbler: {
    id: 'scribbler',
    name: 'Scribbler',
    short: 'Scribbler',
    mark: 'squiggle',
    blurb: 'Draws wherever the chalk happens to land. Has never once counted anything.',
    says: {
      hello: 'Ooh, dots! Can I draw the first one? I am drawing the first one.',
      feast: 'Wait, those are mine now? Nobody tell me how.',
      crossed: 'You left these for me? That is so nice of you.',
      crossing: 'Oops. Was that a present?',
      wins: 'I won? I won! What was the game again?',
      loses: 'That was fun. Same again, but bigger?',
    },
  },
  'greedy-gus': {
    id: 'greedy-gus',
    name: 'Greedy Gus',
    short: 'Gus',
    mark: 'grin',
    blurb: 'The computer that shipped with NetBSD in 2003. Takes every box it can see. Every one.',
    says: {
      hello: 'I take every box I can see. It has always worked. Mostly.',
      feast: 'Mine, mine, mine, mine.',
      crossed: 'Two free boxes! You are too kind. Now, where do I draw…',
      crossing: 'Give boxes back? That is not in my source code.',
      wins: 'Greed is a perfectly good algorithm.',
      loses: 'I took every box I could. How did that not work?',
    },
  },
  'chain-counter': {
    id: 'chain-counter',
    name: 'Chain Counter',
    short: 'Counter',
    mark: 'tally',
    blurb: 'Counts the chains before the safe lines run out. Still cannot leave a free box alone.',
    says: {
      hello: 'One, two, three chains. I like to know where I stand.',
      feast: 'Seven boxes. I counted them as they fell.',
      crossed: 'Hm. That was not in my count.',
      crossing: 'Leave boxes behind? I would lose count.',
      wins: 'The numbers worked out. They usually do.',
      loses: 'I counted everything except that.',
    },
  },
  pupil: {
    id: 'pupil',
    name: 'Berlekamp’s Pupil',
    short: 'Pupil',
    mark: 'cap',
    blurb: 'Read the book twice. Counts the long chains before it counts the boxes.',
    says: {
      hello: 'Dots plus long chains. I already know which way I want it to come out.',
      feast: 'Control pays.',
      crossed: 'Oh, very good. You have been reading too.',
      crossing: 'Two for you. The rest of the board for me.',
      wins: 'Chapter one, page one: the long chain rule.',
      loses: 'I must have skipped a chapter.',
    },
  },
  master: {
    id: 'master',
    name: 'Master',
    short: 'Master',
    mark: 'crown',
    blurb: 'Has solved more endgames than it has had breakfasts. Small boards are its kitchen.',
    says: {
      hello: 'Take your time. I have already looked at the end.',
      feast: 'As expected.',
      crossed: 'A fine sacrifice. I will remember it.',
      crossing: 'Take the pair. You will need to draw again afterwards.',
      wins: 'Well played, all the same.',
      loses: 'Now that is a game I will study.',
    },
  },
};

/** The marks a player can choose for their own boxes. */
export const PLAYER_MARKS: readonly MarkId[] = [
  'star',
  'moon',
  'squiggle',
  'grin',
  'tally',
  'cap',
  'crown',
];
