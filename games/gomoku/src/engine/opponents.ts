/**
 * The ladder's opponents. All of them think with the 1994 program's combination search; they
 * differ in how far ahead they combine frames, how often they make a human slip, and (for the
 * Referee only) a modern threat-space search on top. Their lines are their own: friendly, never
 * smug.
 */

/**
 * The full 1994 search's safety cap: combinations of three frames or more per side per move.
 * Uncapped, one move in a hundred takes many seconds and a few take minutes (see NOTES.md).
 */
export const CAMPBELL_WORK = 30_000;

export type OpponentId = 'pebble' | 'reed' | 'heron' | 'koi' | 'campbell' | 'referee';

export interface Opponent {
  id: OpponentId;
  name: string;
  /** 1 to 5 on the ladder; the Referee stands apart after it. */
  rung: number;
  temperament: string;
  /** How it introduces itself. */
  hello: string;
  /** What it says when it wins, when you win, and when the board fills. */
  afterWin: string;
  afterLoss: string;
  afterDraw: string;
  play: {
    /** The deepest combination of frames it looks for. */
    maxDepth: number;
    /** Chance, on a quiet move, of playing a near-best point instead of the best. */
    slip: number;
    /** Chance of overlooking the other side's open three. */
    blindToThree: number;
    /** Chance of not seeing the other side's four (Pebble only). */
    blindToFour: number;
    /** A cap on the 1994 search's combination work per move, so no move takes long. */
    maxWork: number;
    /** Adds a search for a win by a run of forcing moves, and for defences against one. */
    threatSearch: boolean;
  };
}

export const OPPONENTS: readonly Opponent[] = [
  {
    id: 'pebble',
    name: 'Pebble',
    rung: 1,
    temperament: 'Playful',
    hello: 'I like the shiny spots. Shall we play?',
    afterWin: 'Oh! Five shiny ones in a row. Again?',
    afterLoss: 'You found the shiny spot first!',
    afterDraw: 'No room left! That was fun.',
    play: {
      maxDepth: 1,
      slip: 0.4,
      blindToThree: 0.55,
      blindToFour: 0.2,
      maxWork: 2000,
      threatSearch: false,
    },
  },
  {
    id: 'reed',
    name: 'Reed',
    rung: 2,
    temperament: 'Easygoing',
    hello: 'I bend with the wind. Take all the time you like.',
    afterWin: 'The wind was with me that time.',
    afterLoss: 'Nicely done. I never saw it coming.',
    afterDraw: 'A calm day on the water.',
    play: {
      maxDepth: 2,
      slip: 0.22,
      blindToThree: 0.3,
      blindToFour: 0,
      maxWork: 4000,
      threatSearch: false,
    },
  },
  {
    id: 'heron',
    name: 'Heron',
    rung: 3,
    temperament: 'Patient',
    hello: 'I stand very still and watch the water.',
    afterWin: 'Patience paid off. Well played, though.',
    afterLoss: 'You were the stiller one today.',
    afterDraw: 'Neither of us blinked.',
    play: {
      maxDepth: 3,
      slip: 0.1,
      blindToThree: 0.12,
      blindToFour: 0,
      maxWork: 8000,
      threatSearch: false,
    },
  },
  {
    id: 'koi',
    name: 'Koi',
    rung: 4,
    temperament: 'Crafty',
    hello: 'I circle and circle, and then I’m already there.',
    afterWin: 'Round and round, and there it was. Good game.',
    afterLoss: 'You swam rings round me. Lovely.',
    afterDraw: 'We chased each other’s tails.',
    play: {
      maxDepth: 4,
      slip: 0.05,
      blindToThree: 0.05,
      blindToFour: 0,
      maxWork: 14000,
      threatSearch: false,
    },
  },
  {
    id: 'campbell',
    name: 'Campbell',
    rung: 5,
    temperament: 'The 1994 mind',
    hello: 'I learned this game at Berkeley in 1994. I still love it.',
    afterWin: 'A fine game. Shall we have another?',
    afterLoss: 'You read that better than I did. Bravo.',
    afterDraw: 'A full board! That hardly ever happens.',
    play: {
      maxDepth: Number.POSITIVE_INFINITY,
      slip: 0,
      blindToThree: 0,
      blindToFour: 0,
      maxWork: CAMPBELL_WORK,
      threatSearch: false,
    },
  },
  {
    id: 'referee',
    name: 'Referee',
    rung: 6,
    temperament: 'Reads every threat',
    hello: 'I count every threat on the board, yours and mine. Show me one I missed.',
    afterWin: 'A close read. You’ll spot it next time.',
    afterLoss: 'I missed that one. Beautifully read.',
    afterDraw: 'Every threat answered. A rare game.',
    play: {
      maxDepth: Number.POSITIVE_INFINITY,
      slip: 0,
      blindToThree: 0,
      blindToFour: 0,
      maxWork: CAMPBELL_WORK,
      threatSearch: true,
    },
  },
];

export function opponentById(id: OpponentId): Opponent {
  return OPPONENTS.find((o) => o.id === id)!;
}
