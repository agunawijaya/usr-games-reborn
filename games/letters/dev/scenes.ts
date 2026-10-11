import '../src/ui/styles.css';
import { loadDictionary } from '../src/dictionary/load';
import { dealBoard } from '../src/engine/deal';
import { spell } from '../src/engine/grid';
import { wordScore } from '../src/engine/score';
import type { BoardWord } from '../src/engine/solver';
import { BoardView } from '../src/render/board-view';
import { type Look, paletteFor } from '../src/render/palette';
import { applyLook } from '../src/ui/look';
import { PlayView } from '../src/ui/play-view';
import { RevealView } from '../src/ui/reveal-view';

/**
 * Single moments staged with the real renderer and interface, for the hero frames:
 * `?scene=play|reveal|tumble`, `&look=studio|arcade`, `&freeze=<seconds>`.
 */
type Ready = { __ready?: boolean };

export async function stageScene(params: URLSearchParams) {
  const look: Look = params.get('look') === 'arcade' ? 'arcade' : 'studio';
  const scene = params.get('scene') ?? 'play';
  const stage = document.getElementById('stage')!;
  const trie = await loadDictionary();
  if (scene === 'tumble') await stageTumble(stage, look, trie, params);
  else if (scene === 'reveal') await stageReveal(stage, look, trie, params);
  else await stagePlay(stage, look, trie, params);
  requestAnimationFrame(() => requestAnimationFrame(() => ((window as Ready).__ready = true)));
}

/** The game's frame as the app builds it: a root, the shared board behind, a screen on top. */
function frame(stage: HTMLElement, look: Look): { root: HTMLElement; board: BoardView } {
  const palette = paletteFor(look);
  const board = new BoardView(palette, false);
  const backdrop = document.createElement('div');
  backdrop.className = 'chl-stage';
  backdrop.append(board.element);
  const root = document.createElement('div');
  root.className = 'chl-app';
  root.append(backdrop);
  applyLook(root, palette, false);
  stage.append(root);
  return { root, board };
}

/** A share of the board's words, as a player might have them a minute and a half in. */
function foundSoFar(words: readonly BoardWord[], skip: string, limit = 34): BoardWord[] {
  const common = words
    .filter((w) => w.word !== skip && w.word.length <= 6 && w.tier <= 1)
    .filter((_, index) => index % 2 === 0);
  const rare = words
    .filter((w) => w.word !== skip && w.word.length <= 6 && w.tier >= 2)
    .slice(0, 3);
  return [...common.slice(0, limit - rare.length), ...rare].sort(
    (a, b) => a.word.length - b.word.length,
  );
}

async function stageReveal(
  stage: HTMLElement,
  look: Look,
  trie: Awaited<ReturnType<typeof loadDictionary>>,
  params: URLSearchParams,
) {
  const palette = paletteFor(look);
  const deal = dealBoard(trie, {
    size: 4,
    rule: 'classic',
    seed: params.get('seed') ?? 'showcase-174',
    minLetters: 3,
  });
  const found = foundSoFar(deal.words, deal.words[0]!.word, 46);
  const foundSet = new Set(found.map((w) => w.word));
  const hidden = deal.words.filter((w) => !foundSet.has(w.word));
  const { root, board } = frame(stage, look);
  const view = new RevealView(
    board,
    palette,
    false,
    {
      heading: 'Every word on the board',
      share: found.length / deal.words.length,
      stats: [
        { label: 'Words', value: `${found.length} of ${deal.words.length}` },
        { label: 'Score', value: '96' },
        { label: 'Best chain', value: '×3' },
        { label: 'Best word', value: 'TAILED' },
      ],
      longestHidden: hidden[0] ?? null,
      lists: [
        { id: 'hidden', label: 'Still hidden', words: hidden },
        { id: 'yours', label: 'Yours', words: found },
      ],
      foundLabel: 'Your words',
    },
    { playAgain: () => undefined, gameMenu: () => undefined, hall: () => undefined },
  );
  root.append(view.element);
  view.board.freeze(1000);
  view.board.setRoll(deal.roll, 5, false);
  view.board.showWeb(deal.words.map((w) => ({ path: w.path, found: foundSet.has(w.word) })));
  view.board.freeze(1000 + Number(params.get('at') ?? 4));
  await nextFrame();
  view.placeBoard();
  await nextFrame();
  if (params.get('hover') !== '0') view.showWord(params.get('word') ?? hidden[0]!.word);
}

async function stagePlay(
  stage: HTMLElement,
  look: Look,
  trie: Awaited<ReturnType<typeof loadDictionary>>,
  params: URLSearchParams,
) {
  const palette = paletteFor(look);
  const deal = dealBoard(trie, {
    size: 4,
    rule: 'classic',
    seed: params.get('seed') ?? 'showcase-435',
    minLetters: 3,
  });
  const target =
    deal.words.find((w) => w.word === (params.get('word') ?? 'quotable')) ?? deal.words[0]!;
  const { root, board } = frame(stage, look);
  const view = new PlayView(board, palette, false);
  view.rule.update('Classic · 4×4', 'Each cube once per word.');
  root.append(view.element);
  view.board.setRoll(deal.roll, 3, false);
  const found = foundSoFar(deal.words, target.word);
  view.wall.set(
    found.map((w, i) => ({
      word: w.word,
      points: wordScore(w.word, i % 5 === 0 ? 2 : 0),
      tier: w.tier,
    })),
  );
  view.cover.update(found.length, deal.words.length, 0.33);
  view.clock.update(107, 180, 73);
  view.score.update(128, 2, 2.6);
  const longestFound = [...found].sort((a, b) => b.word.length - a.word.length)[0]!;
  view.best.update(
    longestFound.word,
    found.filter((w) => w.tier === 2).length,
    found.filter((w) => w.tier === 3).length,
  );
  const traced = target.path.slice(0, target.path.length - 1);
  view.current.update(
    spell(deal.roll.board, traced),
    wordScore(spell(deal.roll.board, traced), 2),
    false,
  );
  view.board.setDimmed(0.18);
  const freeze = params.get('freeze');
  if (freeze) view.board.freeze(Number(freeze));
  await nextFrame();
  view.placeBoard();
  await nextFrame();
  const last = view.board.cellPoint(traced.at(-1)!)!;
  const next = view.board.cellPoint(target.path.at(-1)!)!;
  view.board.setTrace(traced, {
    x: last.x + (next.x - last.x) * 0.58,
    y: last.y + (next.y - last.y) * 0.58,
  });
}

async function stageTumble(
  stage: HTMLElement,
  look: Look,
  trie: Awaited<ReturnType<typeof loadDictionary>>,
  params: URLSearchParams,
) {
  const palette = paletteFor(look);
  const deal = dealBoard(trie, {
    size: 4,
    rule: 'classic',
    seed: params.get('seed') ?? 'showcase-100',
    minLetters: 3,
  });
  const { root, board } = frame(stage, look);
  const view = new PlayView(board, palette, false);
  view.rule.update('Classic · 4×4', 'Each cube once per word.');
  root.append(view.element);
  view.wall.set([]);
  view.cover.update(0, deal.words.length, 0.33);
  view.clock.update(180, 180, 0);
  view.score.update(0, 0, 0);
  view.current.update('', null, false);
  await nextFrame();
  view.placeBoard();
  const at = Number(params.get('at') ?? 0.62);
  view.board.freeze(1000);
  view.board.setRoll(deal.roll, 11, true);
  view.board.freeze(1000 + at);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
