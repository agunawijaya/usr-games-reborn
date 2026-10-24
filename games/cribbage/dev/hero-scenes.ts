import '../src/ui/cribbage.css';
import { type CardId, parseCard } from '@usr-games/kit/cards';
import { countHand } from '../src/engine/score';
import {
  cribCards,
  leapingPeg,
  pileCards,
  restingPegs,
  rivalHand,
  showCards,
  showPositionMap,
  starterCard,
  yourHand,
} from '../src/render/arrange';
import { holeFor } from '../src/render/board';
import { ringFor } from '../src/render/count-fx';
import { LAYOUT } from '../src/render/layout';
import { lookFor } from '../src/render/look';
import { emptyScene, type Scene, TableView } from '../src/render/scene';
import { Hud } from '../src/ui/hud';

/**
 * The three hero frames, staged with the real table, board, cards and panels: the play to 31
 * with a run of four just laid, a hand being counted with its fifteens lit, and the perfect 29.
 */

export interface SceneOptions {
  dark: boolean;
  live: boolean;
  time: number;
  params: URLSearchParams;
}

const c = (text: string): CardId => parseCard(text)!;
const cs = (text: string) => text.split(' ').map(c);

interface Staging {
  scene: (time: number) => Scene;
  hud: (hud: Hud) => void;
}

function play(dark: boolean): Staging {
  const look = lookFor(dark);
  const pile = cs('7s 8h 6d 5c');
  return {
    scene: (time) => ({
      ...emptyScene(look),
      time,
      names: ['You', 'Sharp'],
      plates: [62, 63],
      plateGlow: [0.6, 0],
      pegs: [
        { side: 0, at: holeFor(0, 58, 121), lift: 0 },
        leapingPeg(0, 54, 62, 121, 0.56),
        ...restingPegs([62, 63], [58, 60], 121).filter((peg) => peg.side === 1),
      ],
      stock: { at: LAYOUT.stock, cards: 39 },
      cards: [
        ...cribCards(4, 1),
        ...starterCard(c('4h')),
        ...rivalHand(2),
        ...pileCards(pile),
        ...yourHand(cs('9c kd')),
      ],
      countDial: { value: 26, flash: 0.35, label: 'the count' },
      callouts: [
        {
          text: 'Run of four',
          detail: '+4 for you',
          at: { x: LAYOUT.pileStartX + 3 * LAYOUT.pileStep, y: LAYOUT.pileY - 150 },
          t: 0.32,
          colour: look.glow.run,
        },
      ],
      labels: [
        { text: 'Starter', at: { x: LAYOUT.starter.x, y: LAYOUT.starter.y + 96 } },
        { text: "Sharp's crib", at: { x: LAYOUT.crib.rival.x, y: LAYOUT.crib.rival.y + 96 } },
      ],
    }),
    hud: (hud) => {
      hud.setStatus('Sharp', 'Hand 6 · Sharp deals · game to 121');
      hud.setPrompt('Sharp to play · <strong>26</strong> on the table');
      hud.setKeys([
        ['← →', 'choose a card'],
        ['Enter', 'lay it'],
        ['C', 'coach'],
        ['Esc', 'pause'],
      ]);
    },
  };
}

function counting(dark: boolean): Staging {
  const look = lookFor(dark);
  const hand = cs('5d jh qs kc');
  const starter = c('5c');
  const count = countHand(hand, starter);
  const active = 5;
  return {
    scene: (time) => {
      const fx = {
        combos: count.combos,
        positions: showPositionMap(hand, starter),
        active,
        progress: 0.78,
      };
      return {
        ...emptyScene(look),
        time,
        names: ['You', 'Sharp'],
        plates: [74, 79],
        pegs: restingPegs([74, 79], [70, 71], 121),
        stock: { at: LAYOUT.stock, cards: 39 },
        cards: [
          ...cribCards(4, 1),
          ...rivalHand(4, cs('2s 3h 4d 9s')),
          ...showCards(hand, starter).map((card) => ({
            ...card,
            ring: typeof card.card === 'number' ? ringFor(look, fx, card.card, time) : undefined,
          })),
        ],
        showFx: fx,
        labels: [
          { text: "Sharp's crib", at: { x: LAYOUT.crib.rival.x, y: LAYOUT.crib.rival.y + 96 } },
          {
            text: 'Starter',
            at: { x: showPositionMap(hand, starter).get(starter)!.x, y: LAYOUT.show.y + 140 },
          },
        ],
      };
    },
    hud: (hud) => {
      hud.setStatus('Sharp', 'Hand 8 · Sharp deals · game to 121');
      hud.setPrompt(null);
      const shown = active + 1;
      hud.setLedger({
        title: 'Your hand',
        combos: count.combos,
        shown,
        total: count.combos.slice(0, shown).reduce((sum, combo) => sum + combo.points, 0),
      });
      hud.setKeys([
        ['Space', 'next'],
        ['Enter', 'count it all'],
        ['Esc', 'pause'],
      ]);
    },
  };
}

function perfect(dark: boolean): Staging {
  const look = lookFor(dark);
  const hand = cs('5c 5d 5h js');
  const starter = c('5s');
  const count = countHand(hand, starter);
  return {
    scene: (time) => ({
      ...emptyScene(look),
      time,
      names: ['You', 'Sharp'],
      plates: [117, 96],
      plateGlow: [1, 0],
      pegs: [
        { side: 0, at: holeFor(0, 88, 121), lift: 0 },
        leapingPeg(0, 81, 117, 121, 0.52),
        ...restingPegs([117, 96], [88, 89], 121).filter((peg) => peg.side === 1),
      ],
      stock: { at: LAYOUT.stock, cards: 39 },
      cards: [
        ...cribCards(4, 1),
        ...rivalHand(4, cs('3c 8d 9h 10c')),
        ...showCards(hand, starter, 1),
      ],
      celebration: { t: 1, centre: { x: LAYOUT.centreX, y: LAYOUT.show.y } },
      callouts: [
        {
          text: 'Twenty-nine!',
          golden: true,
          at: { x: LAYOUT.centreX, y: 316 },
          t: 0.3,
          colour: look.goldDeep,
        },
      ],
    }),
    hud: (hud) => {
      hud.setStatus('Sharp', 'Hand 11 · Sharp deals · game to 121');
      hud.setPrompt(null);
      hud.setLedger({
        title: 'The perfect hand',
        combos: count.combos,
        shown: count.combos.length,
        total: count.total,
        note: 'Three fives and the jack, with the last five cut to match: about one deal in 216,580.',
        perfect: true,
      });
      hud.setKeys([
        ['Space', 'next'],
        ['Esc', 'pause'],
      ]);
    },
  };
}

const STAGINGS: Record<string, (dark: boolean) => Staging> = {
  'hero-play': play,
  'hero-count': counting,
  'hero-perfect': perfect,
};

export const SCENE_NAMES = Object.keys(STAGINGS);

export async function stageScene(host: HTMLElement, name: string, options: SceneOptions) {
  const staging = STAGINGS[name];
  if (!staging) throw new Error(`no scene ${name}`);
  const { scene, hud: dress } = staging(options.dark);
  const app = document.createElement('div');
  app.className = 'ft-app';
  app.dataset.look = options.dark ? 'fireside' : 'porch';
  host.append(app);
  const view = new TableView(lookFor(options.dark));
  const hud = new Hud();
  app.append(view.canvas, hud.sheet);
  const resize = () => {
    view.resize(host.clientWidth, host.clientHeight, window.devicePixelRatio || 1);
    hud.place(view.currentFrame);
  };
  resize();
  window.addEventListener('resize', resize);
  dress(hud);
  if (!options.live) {
    view.render({ ...scene(options.time), still: true });
    return;
  }
  const started = performance.now();
  const tick = () => {
    view.render(scene(options.time + (performance.now() - started) / 1000));
    requestAnimationFrame(tick);
  };
  tick();
}
