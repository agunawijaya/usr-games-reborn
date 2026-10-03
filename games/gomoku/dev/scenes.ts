import fivefold from '../src/index';
import { opponentById, OPPONENTS, type OpponentId } from '../src/engine/opponents';
import { type GameState, newGame, play, pointOf, type Stone } from '../src/engine/game';
import { findThreats } from '../src/engine/threats';
import { lookFor } from '../src/render/look';
import { SceneryView } from '../src/render/scenery';
import { BoardView, type PieceView, type SideIndex, type ThreatView } from '../src/render/view';
import { createLadderScreen, type RungRecord } from '../src/ui/ladder-screen';
import { createPlayScreen, type PlayModel, type Tally } from '../src/ui/play-screen';
import { portraitSvg } from '../src/ui/portraits';
import referenceGames from '../src/engine/campbell/reference-games.json';

/**
 * The hero scenes, staged with the real engine, renderer and screens. Every position is from a
 * game the 1994 player played against itself on a 15 × 15 board (at combination depths of one to
 * three, a few stones near the centre to vary the openings); staging only chooses the moment.
 */

export interface HeroOptions {
  dark: boolean;
  live: boolean;
  /** Seconds into the scene at which a still frame is taken. */
  time: number;
  params: URLSearchParams;
}

type Scene = (host: HTMLElement, options: HeroOptions) => Promise<void> | void;

/**
 * Seed 194, 36 moves: the second player has a four on the long diagonal and an open three; the
 * first player has an open three of their own, but must block.
 */
const MIDGAME =
  '142,111,82,112,110,114,96,124,68,54,126,158,94,78,95,97,92,93,125,140,65,80,67,66,81,109,53,39,83,38,85,84,113,98,69,70';
/** Seed 186, 43 moves: the first player's five on a diagonal across the lower board. */
const WIN =
  '114,125,140,139,111,153,112,113,126,154,98,84,156,141,109,110,124,172,108,92,82,130,50,66,127,97,95,79,159,143,81,123,67,53,144,129,128,145,161,160,142,100,170';

const LETTERS = 'ABCDEFGHJKLMNOPQRST';

function label(game: GameState, p: number): string {
  const { x, y } = pointOf(game, p);
  return `${LETTERS[x]}${game.size - y}`;
}

function replay(moves: string, size = 15): GameState {
  const game = newGame(size, 'freestyle');
  for (const p of moves.split(',').map(Number)) play(game, p);
  return game;
}

const sideOf = (stone: Stone): SideIndex => (stone === 'black' ? 0 : 1);

function threatViews(game: GameState): ThreatView[] {
  return findThreats(game).map((t) => ({
    side: sideOf(t.stone),
    kind: t.kind,
    stones: t.stones,
    spots: t.spots,
  }));
}

function tally(threats: ThreatView[], side: SideIndex): Tally {
  return {
    threes: threats.filter((t) => t.side === side && t.kind === 'three').length,
    fours: threats.filter((t) => t.side === side && t.kind === 'four').length,
  };
}

function piecesOf(game: GameState, settledAt: number): PieceView[] {
  return game.moves.map((point, i) => ({
    point,
    side: (i % 2) as SideIndex,
    placedAt: settledAt - (game.moves.length - i) * 7,
  }));
}

function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    const tick = (left: number) =>
      left <= 0 ? resolve() : requestAnimationFrame(() => tick(left - 1));
    tick(n);
  });
}

/** Runs `draw` once at `time`, or every frame from there when the scene is live. */
async function present(draw: (time: number) => void, options: HeroOptions): Promise<void> {
  if (!options.live) {
    draw(options.time);
    await waitFrames(2);
    return;
  }
  const start = performance.now();
  const loop = () => {
    draw(options.time + (performance.now() - start) / 1000);
    requestAnimationFrame(loop);
  };
  loop();
}

function stagePlay(host: HTMLElement, dark: boolean) {
  const look = lookFor(dark);
  const screen = createPlayScreen(host, look, { ownPause: true, inHall: false });
  const width = window.innerWidth;
  const height = window.innerHeight;
  const { slot, horizon } = screen.layout(width, height);
  const view = new BoardView(screen.canvas, look);
  view.resize(width, height, window.devicePixelRatio || 1, slot, horizon, 15);
  return { look, screen, view };
}

/** Heron beaten once so far, as on the ladder scene. */
const HERON_ONCE: PlayModel['record'] = { wins: 1, needed: 2, star: false };

/** a) A tense middle game with Read the board on: block their four, or lose. */
const midgame: Scene = async (host, options) => {
  const { screen, view } = stagePlay(host, options.dark);
  const game = replay(options.params.get('moves') ?? MIDGAME);
  const threats = threatViews(game);
  const four = threats.find((t) => t.side === 1 && t.kind === 'four')!;
  const block = four.spots[0]!;
  const heron = opponentById('heron');
  screen.update({
    context: 'Ladder · Freestyle · 15 × 15',
    you: { name: 'You', kicker: 'Your seat', side: 0 },
    them: { name: heron.name, kicker: 'Opponent', side: 1 },
    opponent: heron,
    status: {
      text: `${heron.name} has a four. Block it at`,
      point: label(game, block),
      urgent: true,
    },
    read: { on: true, allowed: true, mine: tally(threats, 0), theirs: tally(threats, 1) },
    record: HERON_ONCE,
    speech: heron.hello,
    moveNumber: game.moves.length + 1,
    lastMove: label(game, game.moves[game.moves.length - 1]!),
    moment: null,
  });
  await present(
    (time) =>
      view.draw({
        size: 15,
        pieces: piecesOf(game, time - 0.45),
        last: game.moves[game.moves.length - 1]!,
        threats,
        cursor: block,
        ghost: { point: block, side: 0 },
        win: null,
        time,
        motion: true,
      }),
    options,
  );
};

/** b) The winning five: a line of light, then rings in the sand or lanterns rising to the stars. */
const win: Scene = async (host, options) => {
  const { screen, view } = stagePlay(host, options.dark);
  const game = replay(options.params.get('moves') ?? WIN);
  const heron = opponentById('heron');
  const winAge = Number(options.params.get('age') ?? (options.dark ? '1.5' : '2.4'));
  screen.update({
    context: 'Ladder · Freestyle · 15 × 15',
    you: { name: 'You', kicker: 'Your seat', side: 0 },
    them: { name: heron.name, kicker: 'Opponent', side: 1 },
    opponent: heron,
    status: { text: 'Heron is beaten twice. Koi is waiting on the next rung.' },
    read: {
      on: false,
      allowed: false,
      mine: { threes: 0, fours: 0 },
      theirs: { threes: 0, fours: 0 },
    },
    record: { wins: 2, needed: 2, star: false },
    speech: heron.afterLoss,
    moveNumber: game.moves.length,
    lastMove: label(game, game.moves[game.moves.length - 1]!),
    moment: 'Five in a row',
  });
  await present(
    (time) =>
      view.draw({
        size: 15,
        pieces: piecesOf(game, time - winAge - 0.05),
        last: game.moves[game.moves.length - 1]!,
        threats: [],
        cursor: null,
        ghost: null,
        win: { line: game.winningLine!, side: sideOf(game.winner!), at: time - winAge },
        time,
        motion: true,
      }),
    options,
  );
};

/** c) The ladder, part way up: Pebble and Reed beaten, Heron once, the rest waiting. */
const ladder: Scene = async (host, options) => {
  const look = lookFor(options.dark);
  const screen = createLadderScreen(host, look, { inHall: false });
  const scenery = new SceneryView(screen.canvas, look);
  scenery.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  const records = Object.fromEntries(
    OPPONENTS.map((o) => [o.id, { wins: 0, star: false }]),
  ) as Record<OpponentId, RungRecord>;
  records.pebble = { wins: 2, star: true };
  records.reed = { wins: 2, star: false };
  records.heron = { wins: 1, star: false };
  screen.update({
    records,
    chosen: 'heron',
    size: 15,
    rules: 'freestyle',
    moveFirst: true,
    ranked: true,
  });
  await present((time) => scenery.draw(time), options);
};

/**
 * d) For checking the drawing up large: every portrait at 320 pixels, and a corner of the board
 * at four times its usual scale, pieces and threat lines included.
 */
const closeup: Scene = async (host, options) => {
  const look = lookFor(options.dark);
  host.style.background = options.dark ? '#0a1328' : '#f3ecdc';
  const strip = document.createElement('div');
  strip.style.cssText = 'display:flex;gap:16px;padding:16px;flex-wrap:wrap';
  for (const o of OPPONENTS) {
    const cell = document.createElement('div');
    cell.innerHTML = portraitSvg(o.id, options.dark, 300);
    strip.append(cell);
  }
  host.append(strip);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:1920px;height:700px';
  host.append(canvas);
  const view = new BoardView(canvas, look);
  // A 15-line board scaled so four cells fill the strip: the pieces at four times their size.
  view.resize(1920, 700, 1, { x: -40, y: -1300, width: 3200, height: 3200 }, -1400, 15);
  const game = replay(MIDGAME);
  await present(
    (time) =>
      view.draw({
        size: 15,
        pieces: piecesOf(game, time - 0.45),
        last: game.moves[game.moves.length - 1]!,
        threats: threatViews(game),
        cursor: null,
        ghost: null,
        win: null,
        time,
        motion: true,
      }),
    options,
  );
};

/**
 * e) The heaviest board, for the frame-rate test: the first 300 moves of the 1994 program's 360-move
 * tie (seed 1 of the reference games) on 19 × 19, Read the board on, everything moving.
 */
const perf: Scene = async (host, options) => {
  const look = lookFor(options.dark);
  const screen = createPlayScreen(host, look, { ownPause: true, inHall: false });
  const width = window.innerWidth;
  const height = window.innerHeight;
  const { slot, horizon } = screen.layout(width, height);
  const view = new BoardView(screen.canvas, look);
  view.resize(width, height, window.devicePixelRatio || 1, slot, horizon, 19);
  const tie = (referenceGames as { seed: number; moves: string[] }[]).find((g) => g.seed === 1)!;
  const game = newGame(19, 'freestyle');
  for (const name of tie.moves.slice(0, 300)) {
    const x = LETTERS.indexOf(name[0]!);
    const y = 19 - Number(name.slice(1));
    play(game, y * 19 + x);
  }
  const threats = threatViews(game);
  screen.update({
    context: 'Practice · Freestyle · 19 × 19',
    you: { name: 'You', kicker: 'Your seat', side: 0 },
    them: { name: 'Campbell', kicker: 'Opponent', side: 1 },
    opponent: opponentById('campbell'),
    status: { text: 'Your move.' },
    read: { on: true, allowed: true, mine: tally(threats, 0), theirs: tally(threats, 1) },
    record: null,
    speech: opponentById('campbell').hello,
    moveNumber: 301,
    lastMove: label(game, game.moves[game.moves.length - 1]!),
    moment: null,
  });
  await present(
    (time) =>
      view.draw({
        size: 19,
        pieces: game.moves.map((point, i) => ({
          point,
          side: (i % 2) as SideIndex,
          placedAt: time - ((300 - i) % 7),
        })),
        last: game.moves[game.moves.length - 1]!,
        threats,
        cursor: game.board.indexOf(null),
        ghost: { point: game.board.indexOf(null), side: 0 },
        win: null,
        time,
        motion: true,
      }),
    options,
  );
};

/** f) The key art and the attract-mode demo, side by side, as the Hall would show them. */
const art: Scene = async (host, options) => {
  host.style.cssText = `display:flex;gap:24px;padding:24px;align-items:flex-start;background:${options.dark ? '#050a17' : '#efe7d5'}`;
  const sizes = [
    { width: 420, height: 560 },
    { width: 880, height: 495 },
  ];
  for (const size of sizes) {
    const canvas = document.createElement('canvas');
    const scale = window.devicePixelRatio || 1;
    canvas.width = size.width * scale;
    canvas.height = size.height * scale;
    canvas.style.cssText = `width:${size.width}px;height:${size.height}px;border-radius:18px`;
    host.append(canvas);
    fivefold.poster!(canvas, {
      seed: 'poster',
      appearance: options.dark ? 'dark' : 'light',
      width: size.width,
      height: size.height,
      animate: options.live,
    });
  }
  const tile = document.createElement('div');
  tile.style.cssText =
    'position:relative;width:420px;height:300px;border-radius:18px;overflow:hidden';
  host.append(tile);
  const appearance = {
    appearance: options.dark ? ('dark' as const) : ('light' as const),
    style: 'console' as const,
    theme: 'console' as const,
    tokens: {} as never,
    accent: '#ad3d17',
    reducedMotion: false,
  };
  const demo = fivefold.demo('art', appearance);
  tile.append(demo.element);
  await waitFrames(30);
};

export const HERO_SCENES: Record<string, Scene> = { midgame, win, ladder, closeup, perf, art };
