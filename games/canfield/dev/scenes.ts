import '../src/ui/thirteen.css';
import '../src/ui/screens.css';
import { CardSprites, cardId, type Rank, SUITS } from '@usr-games/kit/cards';
import { canBuild, canHome, type Layout, TABLEAU } from '../src/engine/rules';
import { drawCard } from '../src/render/card-draw';
import { lookFor } from '../src/render/look';
import {
  emptyModel,
  FINISH_DELAY,
  finishOrder,
  type Place,
  TableView,
} from '../src/render/table-view';
import { Hud } from '../src/ui/hud';
import { h } from '../src/ui/dom';
import { bloomsOf, findMidgame, replayWin, wonLayout } from './hero';

/** Workbench scenes, staged with the real engine and renderer. */

export interface SceneOptions {
  dark: boolean;
  live: boolean;
  /** Seconds into the scene at which a still frame is taken. */
  time: number;
  params: URLSearchParams;
}

type Scene = (host: HTMLElement, options: SceneOptions) => Promise<void> | void;

const HERO_SEEDS = Array.from({ length: 24 }, (_, i) => `hero/${i}`);

function app(host: HTMLElement, dark: boolean): HTMLDivElement {
  const root = h('div', { class: 'td-app', 'data-look': dark ? 'observatory' : 'sunroom' });
  host.append(root);
  return root;
}

function tableIn(root: HTMLElement, dark: boolean): TableView {
  const view = new TableView(lookFor(dark), false);
  root.append(view.element);
  view.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  return view;
}

function hudIn(
  root: HTMLElement,
  view: TableView,
  layout: Layout,
  stats: { score: string; time: string; run: string },
) {
  const hud = new Hud(
    () => {},
    () => {},
  );
  root.append(hud.element);
  const t = view.table;
  hud.place({
    x: t.reserve.x - t.card.w * 0.12,
    y: t.reserve.y + t.card.h * 1.27,
    w: Math.max(t.card.w * 1.24, 196),
    // The hero frames are 1920 × 1080: room for the full card.
    compact: false,
  });
  const base = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][
    layout.baseRank
  ];
  hud.update({
    title: 'Thirteen Down',
    modeLine: `Standard · Points · Base ${base}`,
    stats: [
      { id: 'score', label: 'Score', value: stats.score },
      { id: 'time', label: 'Time', value: stats.time },
      { id: 'run', label: 'Pass', value: stats.run },
    ],
    dealLabel: 'Deal',
    canDeal: true,
    canUndo: true,
    insightOn: false,
    prices: { undo: '−2', hint: '−5', insight: '−1/card' },
    showLedger: false,
    ended: false,
  });
  return hud;
}

/** Keeps a scene moving when `live=1`, else draws the one frame asked for. */
function run(draw: (time: number) => void, options: SceneOptions): void {
  if (!options.live) {
    draw(options.time);
    return;
  }
  const started = performance.now() / 1000 - options.time;
  const tick = () => {
    draw(performance.now() / 1000 - started);
    requestAnimationFrame(tick);
  };
  tick();
}

/** Mid-game: two foundations half in bloom, a card in the air on its way to the tableau. */
const midgame: Scene = (host, options) => {
  const { replay, layout, drag } = findMidgame(HERO_SEEDS);
  const root = app(host, options.dark);
  const view = tableIn(root, options.dark);
  const card = (drag.from === 'talon' ? layout.talon : layout.stock).at(-1)!;
  const fromRect = view.rectOf({ kind: drag.from === 'talon' ? 'talon' : 'stock' });
  const landing = view.landing({ kind: 'tableau', index: drag.to }, layout);
  const along = Number(options.params.get('along') ?? 0.8);
  const corner = {
    x: fromRect.x + (landing.x - fromRect.x) * along,
    y: fromRect.y + (landing.y - fromRect.y) * along - view.table.card.h * 0.12,
  };
  const targets: Place[] = TABLEAU.filter((t) => canBuild(layout, drag.from, t, 1)).map(
    (index) => ({
      kind: 'tableau' as const,
      index,
    }),
  );
  if (canHome(layout, drag.from)) targets.push({ kind: 'foundation', index: 0 });
  const model = {
    ...emptyModel(layout, bloomsOf(layout)),
    drag: {
      cards: [card],
      from: drag.from,
      corner,
      velocity: { x: Math.sign(landing.x - fromRect.x) * 1500, y: 300 },
      snap: landing,
      pull: 0.35,
    },
    targets,
    hidden: new Set([card]),
  };
  const home = layout.foundations.reduce((s, f) => s + f.length, 0);
  const score = home * 5 - (layout.run - 1) * 5;
  hudIn(root, view, layout, { score: String(score), time: '4:12', run: String(layout.run) });
  root.dataset.seed = replay.seed;
  run((time) => view.render(model, time), options);
};

/** The finish: four blooms open at once and the cards spiral up into one neat stack. */
const finish: Scene = (host, options) => {
  const replay = replayWin(options.params.get('seed') ?? 'hero/a');
  const layout = wonLayout(replay);
  const root = app(host, options.dark);
  const view = tableIn(root, options.dark);
  const blooms = bloomsOf(layout).map((b) => ({ ...b, fullAt: 0 }));
  const model = {
    ...emptyModel(layout, blooms),
    finish: { startedAt: 0, cards: finishOrder(layout.foundations) },
  };
  const hud = hudIn(root, view, layout, { score: '485', time: '4:31', run: '1' });
  hud.element.querySelector('.td-hud__bar')?.remove();
  const at = Number(options.params.get('at') ?? FINISH_DELAY + 1.12);
  run((time) => view.render(model, options.live ? time : at), options);
};

/** The deck sheet: the twelve court cards and both backs, laid out on the table. */
const deckSheet: Scene = (host, options) => {
  const root = app(host, options.dark);
  const view = tableIn(root, options.dark);
  const look = lookFor(options.dark);
  const canvas = h('canvas', { class: 'td-layer', 'aria-hidden': 'true' });
  // Above the table's own cards layer, under its light.
  root.querySelector('.td-layer--light')!.before(canvas);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  const cardH = Math.round(height * 0.27);
  const cardW = Math.round(cardH / 1.4);
  const make = (back: 'conservatory' | 'constellations') =>
    new CardSprites({
      width: cardW,
      height: cardH,
      scale,
      look: look.deck,
      fourColour: false,
      back,
    });
  const sprites = make(look.back);
  const gapX = cardW * 0.16;
  const gapY = cardH * 0.08;
  const gridW = 4 * cardW + 3 * gapX;
  const backsW = cardW * 1.95;
  const left = (width - (gridW + cardW * 0.9 + backsW)) / 2;
  const top = (height - (3 * cardH + 2 * gapY)) / 2 + height * 0.025;
  const ranks: Rank[] = [13, 12, 11];
  const order = ['spades', 'hearts', 'clubs', 'diamonds'] as const;
  ranks.forEach((rank, row) => {
    order.forEach((suit, col) => {
      const tilt = (((row * 4 + col) % 3) - 1) * 0.012;
      drawCard(
        ctx,
        sprites,
        cardId(suit, rank),
        {
          x: left + col * (cardW + gapX),
          y: top + row * (cardH + gapY),
          rotation: tilt,
          faceUp: true,
        },
        look,
        'cast',
      );
    });
  });
  // The two backs, overlapping like a pair just turned over, clear of the room's centrepiece.
  const decor = view.table.decor;
  const bx = Math.max(left + gridW + cardW * 0.5, decor.x + decor.w / 2 - cardW * 0.98);
  const by = top - cardH * 0.04;
  const other = options.dark ? 'conservatory' : 'constellations';
  drawCard(
    ctx,
    make(other),
    0,
    { x: bx + cardW * 0.95, y: by + cardH * 0.18, rotation: 0.07, faceUp: false },
    look,
    'cast',
  );
  drawCard(ctx, sprites, 0, { x: bx, y: by, rotation: -0.05, faceUp: false }, look, 'cast');
  const caption = h(
    'header',
    { class: 'td-hud__plaque td-hud__plaque--title' },
    h('h1', { class: 'td-hud__title' }, 'The deck'),
    h('p', { class: 'td-hud__mode' }, 'Twelve courts and two backs, all drawn in code'),
  );
  const hud = h('div', { class: 'td-hud' }, caption);
  root.append(hud);
  view.renderRoom(options.time);
};

/** Every card laid out raw, for judging the deck itself; `?h=` sets the card height. */
const deck: Scene = (host, options) => {
  const canvas = document.createElement('canvas');
  const width = window.innerWidth;
  const height = window.innerHeight;
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  host.append(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = options.dark ? '#141a33' : '#e9e1cf';
  ctx.fillRect(0, 0, width, height);
  const cardHeight = Number(options.params.get('h') ?? 150);
  const sprites = new CardSprites({
    width: Math.round(cardHeight / 1.4),
    height: cardHeight,
    scale,
    look: options.dark ? 'lamp' : 'day',
    fourColour: options.params.get('four') === '1',
    back: options.dark ? 'constellations' : 'conservatory',
  });
  const gap = 10;
  let x = gap;
  let y = gap;
  const only = options.params.get('ranks');
  const ranks = only ? only.split(',').map(Number) : Array.from({ length: 13 }, (_, i) => i + 1);
  for (const suit of SUITS) {
    for (const rank of ranks) {
      if (x + sprites.width > width) {
        x = gap;
        y += sprites.height + gap;
      }
      ctx.drawImage(sprites.face(cardId(suit, rank as Rank)), x, y, sprites.width, sprites.height);
      x += sprites.width + gap;
    }
  }
  ctx.drawImage(sprites.back(), x, y, sprites.width, sprites.height);
};

export const SCENES: Record<string, Scene> = { midgame, finish, 'deck-sheet': deckSheet, deck };
