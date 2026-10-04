import { greedyGusMove } from '../src/ai/greedy-gus';
import {
  type Board,
  horizontalEdge,
  newBoard,
  play,
  type Player,
  verticalEdge,
} from '../src/engine/board';
import { components, controlOnCourse, isLong } from '../src/engine/chains';
import { capturingEdges } from '../src/engine/moves';
import { cascadeShowcase, greedyOpening } from '../src/game/showcase';
import type { ViewScene } from '../src/render/board-view';
import type { Look } from '../src/render/look';
import type { MarkId } from '../src/render/marks';
import type { CoachModel, SideModel } from '../src/ui/hud';

/**
 * Staged moments for the hero frames: real positions from the real engine (the original
 * computer playing itself to set up a board), shown by the real renderer and interface.
 */
export type SceneName = 'midgame' | 'double-cross' | 'tutorial';

export interface Staged {
  readonly view: ViewScene;
  readonly side: SideModel | null;
  readonly coach: CoachModel | null;
  readonly banner: { by: string; kept: number } | null;
}

const MARKS: readonly [MarkId, MarkId] = ['star', 'cap'];
const COACH_MARKS: readonly [MarkId, MarkId] = ['star', 'moon'];
const PUPIL = {
  name: 'Berlekamp’s Pupil',
  blurb: 'Read the book twice. Counts the long chains before it counts the boxes.',
  says: 'Three long chains on the board. I like that number.',
};

function base(board: Board, look: Look, extra: Partial<ViewScene> = {}): ViewScene {
  return {
    board,
    look,
    marks: MARKS,
    lens: null,
    cursor: null,
    hover: null,
    drawing: null,
    filling: new Map(),
    lineAges: new Map(),
    doubleCross: null,
    seed: 5,
    ...extra,
  };
}

function side(board: Board, lens: boolean): SideModel {
  const comps = components(board);
  return {
    names: ['You', 'Pupil'],
    marks: MARKS,
    scores: board.scores,
    toMove: board.toMove,
    match: 'Ladder · match 7 of 10',
    matchDetail: '5 × 5 against Berlekamp’s Pupil',
    rival: PUPIL,
    lens,
    lensAllowed: true,
    longChains: comps.filter((c) => c.kind === 'chain' && isLong(c)).length,
    loops: comps.filter((c) => c.kind === 'loop').length,
    control: controlOnCourse(board, 0),
  };
}

export function stage(name: SceneName, look: Look): Staged {
  switch (name) {
    case 'midgame':
      return midgame(look);
    case 'double-cross':
      return doubleCross(look);
    case 'tutorial':
      return tutorial(look);
  }
}

/** A 5 × 5 board in the middle game with the chain lens on: chains formed, a loop, a few boxes taken. */
function midgame(look: Look): Staged {
  let board = greedyOpening(28);
  // Let the short chain go, as the original would, so a couple of boxes are on the board.
  let clock = 1_072_600_000;
  while (board.scores[0] + board.scores[1] < 3) {
    board = play(board, greedyGusMove(board, clock)).board;
    clock += 3;
  }
  board = { ...board, toMove: 0 as Player };
  const last = board.history.at(-1)!.edge;
  return {
    view: base(board, look, {
      lens: components(board),
      lineAges: new Map([[last, 0.8]]),
      cursor: captureEdge(board),
    }),
    side: side(board, true),
    coach: null,
    banner: null,
  };
}

/** The cursor rests where a careful player would look first: a box that is there to take. */
function captureEdge(board: Board): number | null {
  return capturingEdges(board)[0] ?? null;
}

/**
 * The double cross: the Pupil opened a long chain; you took all but two and drew the far end of
 * the last box, leaving the pair. The Pupil took them with one line and had to open the next
 * long chain, which now falls to you box by box.
 */
function doubleCross(look: Look): Staged {
  const show = cascadeShowcase();
  const { board, cascade, taken } = show;
  const filling = new Map<number, number>([
    [cascade.boxes[1]!, 0.92],
    [cascade.boxes[2]!, 0.38],
  ]);
  const lineAges = new Map<number, number>();
  board.history
    .slice(-taken - 3)
    .forEach((m, i, recent) => lineAges.set(m.edge, 0.12 * (recent.length - i)));
  return {
    view: base(board, look, {
      filling,
      lineAges,
      doubleCross: {
        domino: show.domino,
        cutEdge: show.cutEdge,
        cut: 0.55,
        trail: cascade.boxes.slice(taken),
        falling: cascade.boxes[taken - 1]!,
      },
    }),
    side: side(board, false),
    coach: null,
    banner: { by: 'You', kept: cascade.boxes.length },
  };
}

/**
 * The tutorial's last step on a 4 × 2 board: two chains of four. The coach opened the top one;
 * you have taken two boxes. Take the last two, or give them away?
 */
function tutorial(look: Look): Staged {
  let board = newBoard({ columns: 4, rows: 2 });
  const move = (edge: number, by: Player) => {
    board = play({ ...board, toMove: by }, edge).board;
  };
  for (let c = 0; c < 4; c++) {
    move(horizontalEdge(board, 0, c), 0);
    move(horizontalEdge(board, 1, c), 1);
    move(horizontalEdge(board, 2, c), 0);
  }
  // The coach opens the top chain at the left; you take two.
  move(verticalEdge(board, 0, 0), 1);
  move(verticalEdge(board, 0, 1), 0);
  move(verticalEdge(board, 0, 2), 0);
  board = { ...board, toMove: 0 as Player };
  const suggested = verticalEdge(board, 0, 4);
  return {
    view: base(board, look, {
      marks: COACH_MARKS,
      cursor: suggested,
      lens: components(board).filter((c) => c.boxes.length === 4),
      doubleCross: { domino: [2, 3], cutEdge: null, cut: 0, trail: [], falling: null },
    }),
    side: {
      ...side(board, false),
      names: ['You', 'Coach'],
      marks: COACH_MARKS,
      rival: null,
      match: 'Tutorial',
      matchDetail: 'Step 5 of 5',
    },
    coach: {
      step: 5,
      steps: 5,
      title: 'The double cross',
      body: 'Two boxes of this chain are left. Take them both and you must draw again, which opens the bottom chain for the coach. Or draw the far end and leave the pair: the coach takes both with one line, the double cross, and has to open the bottom chain for you.',
      options: [
        {
          title: 'Take both',
          detail: 'Then you open the bottom chain: the coach takes all four.',
          result: 'You 4 · Coach 4',
          good: false,
        },
        {
          title: 'Give two away',
          detail: 'The coach takes the pair and must open the bottom chain for you.',
          result: 'You 6 · Coach 2',
          good: true,
        },
      ],
      prompt:
        'The dashed line at the far end gives the pair away. Draw it with Enter, or click it.',
    },
    banner: null,
  };
}
