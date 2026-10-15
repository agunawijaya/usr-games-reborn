import '../src/ui/fish.css';
import { type CardId, type Rank, rankOf } from '@usr-games/kit/cards';
import type { GameEvent } from '../src/engine/events';
import type { FishState } from '../src/engine/game';
import { lineFor } from '../src/play/lines';
import { bucketShape } from '../src/render/bucket';
import { CAST, landingPoint } from '../src/render/cast';
import { lookFor } from '../src/render/look';
import type { Mood } from '../src/render/rivals/common';
import { type PondScene, PondView, type RivalKind } from '../src/render/pond-view';
import { Hud, type HudModel } from '../src/ui/hud';
import { h } from '../src/ui/dom';
import { rankWord } from '../src/ui/words';
import { findBook, findCast, findMidgame, type Moment, RIVAL_NAMES } from './hero';
import type { SceneOptions } from './scenes';

/**
 * The hero frames for the owner's checkpoint, staged from real games: the pond mid-game with all
 * three rivals and the notebook open, a "Go Fish!" cast being reeled in, and a book leaping into
 * the bucket as its fish (golden in the bonus frame).
 */

const KINDS: RivalKind[] = ['otter', 'heron', 'cat'];

interface Staging {
  moods: Mood[];
  moodAges?: number[];
  speech: HudModel['speech'];
  hand: readonly CardId[];
  hidden?: ReadonlySet<CardId>;
  lifted?: Rank;
  selectedRival: number | null;
  askMessage?: string;
  cast?: PondScene['cast'];
  leap?: PondScene['leap'];
  ripples?: PondScene['ripples'];
}

function stage(host: HTMLElement, options: SceneOptions, moment: Moment, staging: Staging): void {
  const look = lookFor(options.dark);
  const root = h('div', { class: 'gf-app' });
  host.append(root);
  const view = new PondView(look);
  root.append(view.element);
  view.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  const layout = view.layout;
  const state = moment.state;

  const rivals = KINDS.map((kind, i) => ({
    kind,
    mood: staging.moods[i] ?? 'idle',
    moodAge: staging.moodAges?.[i] ?? 3,
    cards: state.seats[i + 1]!.hand.length,
  }));
  const bucket = state.seats[0]!.books.map((book) => ({ rank: book.rank, golden: book.golden }));
  view.draw({
    time: options.time,
    rivals,
    pond: state.pond.length,
    hand: staging.hand,
    hiddenInHand: staging.hidden,
    lifted: staging.lifted,
    bucket,
    ripples: staging.ripples ?? [],
    cast: staging.cast,
    leap: staging.leap,
    motion: 1,
  });

  const hud = new Hud({ chooseRival() {}, ask() {}, toggleNotebook() {} });
  root.append(hud.element);
  const handRanks = new Map<Rank, number>();
  for (const card of staging.hand)
    handRanks.set(rankOf(card), (handRanks.get(rankOf(card)) ?? 0) + 1);
  const shape = bucketShape(layout.bucket, layout.s);
  hud.render(
    {
      look,
      s: layout.s,
      status: { title: 'Gone Fishing', mode: 'Quick game · Standard' },
      rivals: KINDS.map((kind, i) => {
        const anchor = view.rivalAnchor(i, 3, kind);
        const seat = state.seats[i + 1]!;
        return {
          name: RIVAL_NAMES[i]!,
          cards: seat.hand.length,
          books: seat.books.length,
          goldens: seat.books.filter((b) => b.golden).length,
          selected: staging.selectedRival === i,
          turn: false,
          anchor: { x: anchor.base.x, top: anchor.top },
        };
      }),
      speech: staging.speech,
      ask: {
        rect: layout.askBar,
        target: staging.selectedRival === null ? null : RIVAL_NAMES[staging.selectedRival]!,
        ranks: [...handRanks].sort((a, b) => a[0] - b[0]).map(([rank, count]) => ({ rank, count })),
        selectedRank: staging.lifted ?? null,
        mode: staging.askMessage ? 'message' : 'choose-rank',
        message: staging.askMessage,
      },
      notebook: {
        rect: layout.notebook,
        open: true,
        rivals: RIVAL_NAMES,
        knowledge: moment.knowledge,
        myRanks: new Set(handRanks.keys()),
        lines: moment.lines.slice(0, 9),
        selected: staging.selectedRival,
      },
      bucket: {
        anchor: { x: shape.mouth.x, y: shape.bottom + 22 * layout.s },
        fish: bucket.length,
        goldens: bucket.filter((b) => b.golden).length,
      },
      pond: {
        anchor: { x: layout.pile.x, y: layout.pile.y + 70 * layout.s },
        cards: state.pond.length,
      },
    },
    root,
  );
}

function mostHeld(hand: readonly CardId[]): Rank {
  const counts = new Map<Rank, number>();
  for (const card of hand) counts.set(rankOf(card), (counts.get(rankOf(card)) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
}

export function midgameFrame(host: HTMLElement, options: SceneOptions): void {
  const moment = findMidgame();
  const hand = moment.state.seats[0]!.hand;
  stage(host, options, moment, {
    moods: ['thinking', 'delighted', 'idle'],
    moodAges: [3, 0.27, 3],
    speech: { rival: 1, text: lineFor('heron', 'delighted', 0) },
    hand,
    lifted: mostHeld(hand),
    selectedRival: 2,
  });
}

function askOf(next: GameEvent[]) {
  const ask = next.find((e) => e.kind === 'ask');
  if (ask?.kind !== 'ask') throw new Error('no ask');
  return ask;
}

export function castFrame(host: HTMLElement, options: SceneOptions): void {
  const moment = findCast();
  const ask = askOf(moment.next);
  const draw = moment.next.find((e) => e.kind === 'draw');
  if (draw?.kind !== 'draw') throw new Error('no draw');
  const rivalIndex = ask.target - 1;
  const age = Number(options.params.get('age') ?? 1.72);
  const landing = landingPoint(new PondView(lookFor(options.dark)).layout);
  const moods: Mood[] = ['idle', 'thinking', 'idle'];
  moods[rivalIndex] = 'delighted';
  stage(host, options, moment, {
    moods,
    moodAges: [3, 3, 3].map((a, i) => (i === rivalIndex ? 0.27 : a)),
    speech: { rival: rivalIndex, text: lineFor(KINDS[rivalIndex]!, 'goFish', 0), loud: true },
    hand: moment.state.seats[0]!.hand,
    lifted: ask.rank,
    selectedRival: rivalIndex,
    askMessage: `${RIVAL_NAMES[rivalIndex]} has no ${rankWord(ask.rank)}. Go fish!`,
    cast: { age, card: draw.card, lucky: false },
    ripples: [
      { ...landing, start: options.time - (age - CAST.landed), strength: 1 },
      { ...landing, start: options.time - (age - CAST.bite), strength: 1.3 },
    ],
  });
}

export function bookFrame(host: HTMLElement, options: SceneOptions, golden: boolean): void {
  const moment = findBook();
  const ask = askOf(moment.next);
  const give = moment.next.find((e) => e.kind === 'give');
  const book = moment.next.find((e) => e.kind === 'book');
  if (give?.kind !== 'give' || book?.kind !== 'book') throw new Error('no book');
  const giver = give.from - 1;
  const moods: Mood[] = ['thinking', 'idle', 'idle'];
  moods[giver] = 'grumpy';
  const bookCards = new Set(book.cards);
  const before: FishState = moment.state;
  stage(host, options, moment, {
    moods,
    speech: { rival: giver, text: lineFor(KINDS[giver]!, 'grumpy', 1) },
    hand: before.seats[0]!.hand.filter((card) => !bookCards.has(card)),
    selectedRival: ask.target - 1,
    askMessage: `A book of ${rankWord(book.rank)}!`,
    leap: {
      rank: book.rank,
      golden: golden || book.golden,
      cards: book.cards,
      age: Number(options.params.get('age') ?? 1.08),
    },
  });
}
