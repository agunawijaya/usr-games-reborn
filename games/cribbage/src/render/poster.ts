import type { PosterHandle, PosterOptions } from '@usr-games/kit';
import { type CardId, parseCard } from '@usr-games/kit/cards';
import { countHand } from '../engine/score';
import { restingPegs, showCards, showPositionMap } from './arrange';
import { ringFor } from './count-fx';
import { LAYOUT } from './layout';
import { lookFor } from './look';
import { emptyScene, type Scene, TableView } from './scene';

/**
 * The key art: a big hand being counted over the table, its fifteens bridged in light, the
 * board beside it with both players deep into a long game. By firelight in the dark look, in
 * the porch's late sun in the light one.
 */

const HAND: CardId[] = ['7c', '7h', '8d', '8s'].map((text) => parseCard(text)!);
const STARTER: CardId = parseCard('9c')!;

export function posterScene(dark: boolean, time: number, still: boolean): Scene {
  const look = lookFor(dark);
  const count = countHand(HAND, STARTER);
  const fx = {
    combos: count.combos,
    positions: showPositionMap(HAND, STARTER),
    active: 3,
    progress: 0.8,
  };
  return {
    ...emptyScene(look),
    time,
    still,
    names: ['You', 'Sharp'],
    plates: [98, 104],
    pegs: restingPegs([98, 104], [86, 96], 121),
    stock: { at: LAYOUT.stock, cards: 39 },
    cards: showCards(HAND, STARTER).map((card) => ({
      ...card,
      ring: typeof card.card === 'number' ? ringFor(look, fx, card.card, time) : undefined,
    })),
    showFx: fx,
  };
}

export function drawPoster(canvas: HTMLCanvasElement, options: PosterOptions): PosterHandle {
  const dark = options.appearance === 'dark';
  const view = new TableView(lookFor(dark), canvas);
  const scale = canvas.width / Math.max(1, options.width);
  view.resize(options.width, options.height, scale);
  if (!options.animate) {
    view.render(posterScene(dark, 2.2, true));
    return { stop() {} };
  }
  let stopped = false;
  let frame = 0;
  const started = performance.now();
  const tick = () => {
    if (stopped) return;
    view.render(posterScene(dark, 2.2 + (performance.now() - started) / 1000, false));
    frame = requestAnimationFrame(tick);
  };
  tick();
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
    },
  };
}
