import '../src/ui/detour.css';
import '../src/ui/pages.css';
import { type Kind, DUEL_DECK, KINDS, familyOf } from '../src/engine/cards';
import { scoreSide } from '../src/engine/score';
import { CARD_COPY, FAMILY_LABEL } from '../src/content/cards';
import { CARD_ASPECT, drawCardBack, drawCardFace } from '../src/render/card-art';
import { RESTING, drawCar } from '../src/render/car';
import { drawBanner, drawCoupBurst } from '../src/render/effects';
import { lookFor } from '../src/render/look';
import { BODY_FONT, DISPLAY_FONT, alpha, roundRect } from '../src/render/paint';
import { type RoadCar, drawRoad, mileToX, roadGeometry } from '../src/render/road';
import { COAST, ROUTES, type RouteId } from '../src/render/routes';
import { Stage } from '../src/render/stage';
import { paintAtlas, type FlyingCard } from '../src/render/table';
import { handView, roadScene, sideView } from '../src/play/view';
import { Hud } from '../src/ui/hud';
import { h } from '../src/ui/dom';
import { findCoupMoment, findHazardMoment } from './hero';
import { createSynth } from '@usr-games/kit';
import type { Level } from '../src/ai/players';
import { newMatch, nextHand } from '../src/engine/match';
import { DriverClient } from '../src/play/driver-client';
import { createTableSound } from '../src/play/sound';
import { Table } from '../src/play/table';
import game from '../src/index';

/** Workbench scenes, staged with the real engine and renderer. */

export interface SceneOptions {
  dark: boolean;
  live: boolean;
  /** Seconds into the scene at which a still frame is taken. */
  time: number;
  params: URLSearchParams;
}

type Scene = (host: HTMLElement, options: SceneOptions) => Promise<void> | void;

const HERO_SEEDS = Array.from({ length: 120 }, (_, i) => `hero/${i}`);

function fullCanvas(host: HTMLElement): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
} {
  const canvas = document.createElement('canvas');
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.cssText = `width:${w}px;height:${h}px;display:block`;
  host.append(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return { canvas, ctx, w, h };
}

function appRoot(host: HTMLElement, dark: boolean): HTMLDivElement {
  const root = h('div', { class: 'dt-app', 'data-look': dark ? 'night' : 'day' });
  host.append(root);
  return root;
}

function stageIn(root: HTMLElement, dark: boolean): { stage: Stage; hud: Hud } {
  const stage = new Stage(lookFor(dark));
  root.append(stage.canvas);
  stage.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  const hud = new Hud();
  root.append(hud.element);
  hud.place(stage.layout);
  return { stage, hud };
}

function centre(rect: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/** Mid-hand on the coast: you have just thrown a flat tyre at a rival who was rolling. */
const midhand: Scene = (host, { dark, time }) => {
  const look = lookFor(dark);
  const moment = findHazardMoment(HERO_SEEDS);
  const root = appRoot(host, dark);
  const { stage, hud } = stageIn(root, dark);
  const state = moment.after;
  const play = moment.events.find((e) => e.type === 'play')!;
  const hazard = play.type === 'play' ? play.kind : 'flatTyre';
  const fromSlot = moment.before.seats[0]!.hand.findIndex(
    (c) => c !== null && play.type === 'play' && c === play.card,
  );
  const from = centre(stage.layout.hand[Math.max(0, fromSlot)]!);
  const to = centre(stage.layout.sides[1].battle);
  const t = 0.9;
  const card: FlyingCard = {
    kind: hazard,
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 120 * stage.layout.scale,
    w: stage.layout.sides[1].battle.w * 1.08,
    rotation: 0.22,
    alpha: 1,
    height: 0.7,
  };
  const road = roadScene(state, look, COAST, time, [0.85, 0]);
  const g = roadGeometry({ ...stage.layout.road, span: road.span });
  const rivalX = mileToX(
    { ...stage.layout.road, left: road.left, span: road.span },
    road.cars[1].miles,
  );
  road.cars[1].pose = { ...road.cars[1].pose, bob: 1.2, pitch: -0.02 };
  void rivalX;
  void g;
  const sides = [sideView(state, 0, look, 'Your car'), sideView(state, 1, look, 'Rival')] as const;
  const scores = [scoreSide(state, 0).total, scoreSide(state, 1).total] as [number, number];
  // A short trail of where the card has just been, fading back along its arc.
  const trail: FlyingCard[] = [0.8, 0.85].map((k, i) => ({
    ...card,
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 120 * stage.layout.scale,
    rotation: 0.22 * k,
    alpha: 0.12 + i * 0.08,
  }));
  stage.render(road, {
    sides: [sides[0], sides[1]],
    hand: handView(state, 0, { helper: true, selected: null, hover: null }),
    deckLeft: state.deck.length,
    discardTop: state.discards.length ? state.cards[state.discards.at(-1)!]! : null,
    targets: [],
    hover: null,
    flying: [...trail, card],
    hidden: ['battle-1'],
    time,
  });
  hud.update(
    {
      route: COAST.name,
      progress: `Hand ${moment.handNo + 1} · game to 5,000`,
      names: ['You', 'Rival'],
      totals: moment.totals,
      hand: scores,
      status: `${CARD_COPY[hazard].name}! Your rival is stuck until a ${hazard === 'flatTyre' ? 'spare tyre' : 'fix'} and a green light.`,
    },
    look,
  );
};

/** The coup fourré: the rival's hazard flies at you and your safety slams down to throw it back. */
const coup: Scene = (host, { dark, time }) => {
  const look = lookFor(dark);
  const moment = findCoupMoment(HERO_SEEDS);
  const root = appRoot(host, dark);
  const { stage, hud } = stageIn(root, dark);
  const state = moment.after;
  const play = moment.events.find((e) => e.type === 'play' && e.coup)!;
  const safety = play.type === 'play' ? play.kind : 'roadSense';
  const hazard = moment.before.sides[0].battle!;
  const layout = stage.layout;
  const s = layout.scale;
  const slotIndex = ['longRangeTank', 'runFlats', 'roadSense', 'greenWave'].indexOf(safety);
  const slot = layout.sides[0].safeties[slotIndex]!;
  const slotCentre = centre(slot);
  // The hazard, knocked back across the table toward the rival's side, tumbling.
  const rivalBattle = centre(layout.sides[1].battle);
  void rivalBattle;
  const back: FlyingCard = {
    kind: hazard,
    x: layout.width / 2 + 120 * s,
    y: layout.road.y + layout.road.h + 2 * s,
    w: layout.sides[0].battle.w * 1.05,
    rotation: 0.42,
    alpha: 0.95,
    height: 1,
  };
  const road = roadScene(moment.before, look, COAST, time, [0, 0]);
  road.slowMo = 0.75;
  road.cars[0] = {
    ...road.cars[0],
    trouble: null,
    glow: 1,
    pose: { ...road.cars[0].pose, dent: 0, flat: 0 },
  };
  const sides = [sideView(state, 0, look, 'Your car'), sideView(state, 1, look, 'Rival')] as const;
  const scores = [scoreSide(state, 0).total, scoreSide(state, 1).total] as [number, number];
  stage.render(
    road,
    {
      sides: [sides[0], sides[1]],
      hand: handView(state, 0, { helper: true, selected: null, hover: null }),
      deckLeft: state.deck.length,
      discardTop: state.discards.length ? state.cards[state.discards.at(-1)!]! : null,
      targets: [],
      hover: null,
      flying: [],
      hidden: [`safety-0-${safety}`],
      time,
    },
    (ctx) => {
      // Time slows over the table too: a veil, then only the parry in full light.
      ctx.fillStyle = alpha(dark ? '#070b14' : '#efe5cf', dark ? 0.5 : 0.55);
      ctx.fillRect(0, layout.road.y + layout.road.h, layout.width, layout.height);
      for (let k = 3; k >= 1; k--) {
        ctx.save();
        ctx.globalAlpha = 0.18 * (4 - k);
        ctx.translate(back.x - k * 95 * s, back.y + k * 34 * s);
        ctx.rotate(back.rotation - k * 0.18);
        const tw = back.w;
        const th = tw * CARD_ASPECT;
        ctx.drawImage(stage.sprites.face(hazard, tw, th), -tw / 2, -th / 2, tw, th);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(back.x, back.y);
      ctx.rotate(back.rotation);
      ctx.shadowColor = alpha('#000000', 0.4);
      ctx.shadowBlur = 24 * s;
      ctx.shadowOffsetY = 18 * s;
      const bw = back.w;
      const bh = bw * CARD_ASPECT;
      ctx.drawImage(stage.sprites.face(hazard, bw, bh), -bw / 2, -bh / 2, bw, bh);
      ctx.restore();
      // The burst behind the slammed safety, then the safety itself, crosswise and still large.
      drawCoupBurst(ctx, slotCentre.x, slotCentre.y, 190 * s, 0.34, look);
      const w = slot.w * 1.28;
      const hh = w * CARD_ASPECT;
      ctx.save();
      ctx.translate(slotCentre.x, slotCentre.y);
      ctx.rotate(Math.PI / 2 - 0.08);
      ctx.shadowColor = alpha('#000000', 0.45);
      ctx.shadowBlur = 26 * s;
      ctx.shadowOffsetY = 14 * s;
      ctx.drawImage(stage.sprites.face(safety, w, hh), -w / 2, -hh / 2, w, hh);
      ctx.restore();
      drawBanner(
        ctx,
        layout.width / 2 + 40 * s,
        layout.road.y + layout.road.h + 150 * s,
        s,
        'COUP FOURRÉ!',
        `+300  ·  ${CARD_COPY[safety].name} parries the ${CARD_COPY[hazard].name.toLowerCase()}`,
        1,
        look,
      );
    },
  );
  hud.update(
    {
      route: COAST.name,
      progress: `Hand ${moment.handNo + 1} · game to 5,000`,
      names: ['You', 'Rival'],
      totals: moment.totals,
      hand: scores,
      status: 'Coup fourré! The hazard bounces back and the turn is yours.',
    },
    look,
  );
};

/** Every kind of card, hazards lined up over the remedy and the safety that answer them. */
const sheet: Scene = (host, { dark }) => {
  const look = lookFor(dark);
  const root = appRoot(host, dark);
  const { ctx, w, h: H } = fullCanvas(root);
  paintAtlas(ctx, w, H, look, 0);
  const s = Math.min(w / 1920, H / 1080);
  const cardW = 150 * s;
  const cardH = cardW * CARD_ASPECT;
  const gap = 28 * s;
  const left = 260 * s;
  const top = 150 * s;
  ctx.fillStyle = look.table.label;
  ctx.font = `800 ${46 * s}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('The Detour deck', 80 * s, 92 * s);
  ctx.font = `600 ${20 * s}px ${BODY_FONT}`;
  ctx.fillStyle = look.table.labelSoft;
  ctx.fillText(
    '101 cards · each hazard sits over the remedy that fixes it and the safety that parries it',
    80 * s + ctx.measureText('').width,
    126 * s,
  );
  const rows: { label: string; kinds: (Kind | null)[] }[] = [
    { label: FAMILY_LABEL.distance, kinds: ['m25', 'm50', 'm75', 'm100', 'm200'] },
    {
      label: FAMILY_LABEL.hazard,
      kinds: ['noFuel', 'flatTyre', 'fenderBender', 'redLight', 'slowZone'],
    },
    {
      label: FAMILY_LABEL.remedy,
      kinds: ['fillUp', 'spareTyre', 'mechanic', 'greenLight', 'openRoad'],
    },
    {
      label: FAMILY_LABEL.safety,
      kinds: ['longRangeTank', 'runFlats', 'roadSense', 'greenWave', null],
    },
  ];
  const rowH = (H - top - 30 * s) / rows.length;
  const scaleRow = Math.min(1, (rowH - 30 * s) / cardH);
  const cw = cardW * scaleRow;
  const ch = cardH * scaleRow;
  rows.forEach((row, r) => {
    const y = top + r * rowH + 12 * s;
    const fam = look.card.families[familyOf(row.kinds[0]!)];
    ctx.fillStyle = dark ? fam.base : fam.deep;
    ctx.font = `800 ${24 * s}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(row.label.toUpperCase(), left - 30 * s, y + ch / 2);
    row.kinds.forEach((kind, c) => {
      const x = left + c * (cw + gap + 40 * s);
      if (kind === null) {
        // The green wave answers a slow zone as well as a red light: say so in the gap.
        roundRect(ctx, x, y, cw, ch, 10 * s);
        ctx.save();
        ctx.setLineDash([8 * s, 7 * s]);
        ctx.strokeStyle = alpha(look.card.families.safety.base, 0.85);
        ctx.lineWidth = 2.5 * s;
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = look.table.label;
        ctx.font = `750 ${16 * s}px ${DISPLAY_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ['Green Wave', 'also ends a', 'slow zone'].forEach((text, k) =>
          ctx.fillText(text, x + cw / 2, y + ch / 2 - 22 * s + k * 22 * s),
        );
        ctx.font = `800 ${26 * s}px ${DISPLAY_FONT}`;
        ctx.fillText('←', x + cw / 2, y + ch / 2 + 50 * s);
        return;
      }
      ctx.save();
      ctx.shadowColor = look.table.shadow;
      ctx.shadowBlur = 16 * s;
      ctx.shadowOffsetY = 6 * s;
      roundRect(ctx, x + 3, y + 3, cw - 6, ch - 6, 8 * s);
      ctx.fillStyle = look.card.paper;
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      drawCardFace(ctx, kind, cw, ch, look.card);
      ctx.restore();
      ctx.fillStyle = look.table.label;
      ctx.font = `750 ${17 * s}px ${DISPLAY_FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`× ${DUEL_DECK[kind]}`, x + cw + 10 * s, y + ch - 14 * s);
    });
  });
  // The back, set apart.
  const bx = left + 5 * (cw + gap + 40 * s) + 30 * s;
  const by = top + 12 * s;
  ctx.save();
  ctx.translate(bx, by);
  drawCardBack(ctx, cw * 1.2, ch * 1.2, look.card);
  ctx.restore();
  ctx.fillStyle = look.table.label;
  ctx.font = `750 ${17 * s}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('the back', bx, by + ch * 1.2 + 26 * s);
  // What each family does, in a line or two.
  const legend: [Kind, string, string][] = [
    ['m100', 'Miles', 'Lay them to reach exactly 700. No more than two 200s a hand.'],
    ['redLight', 'Hazards', 'Thrown at a rival who is rolling, to stop or slow them.'],
    ['greenLight', 'Remedies', 'Fix your own trouble, then a green light to roll again.'],
    [
      'roadSense',
      'Safeties',
      'One of each. Safe from that hazard all hand, and laid the moment it hits you: a coup fourré, +300.',
    ],
  ];
  const lx = bx;
  let ly = by + ch * 1.2 + 70 * s;
  const lw = w - lx - 60 * s;
  legend.forEach(([kind, title, text]) => {
    const fam = look.card.families[familyOf(kind)];
    roundRect(ctx, lx, ly, 10 * s, 64 * s, 5 * s);
    ctx.fillStyle = fam.base;
    ctx.fill();
    ctx.fillStyle = dark ? fam.base : fam.deep;
    ctx.font = `800 ${21 * s}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(title, lx + 24 * s, ly + 20 * s);
    ctx.fillStyle = look.table.label;
    ctx.font = `500 ${17 * s}px ${BODY_FONT}`;
    const words = text.split(' ');
    let line = '';
    let lineY = ly + 44 * s;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > lw - 24 * s && line) {
        ctx.fillText(line, lx + 24 * s, lineY);
        line = word;
        lineY += 22 * s;
      } else line = test;
    }
    ctx.fillText(line, lx + 24 * s, lineY);
    ly = lineY + 34 * s;
  });
  void KINDS;
};

/** Every card in the deck, with its count, on the atlas table. */
const deck: Scene = (host, { dark }) => {
  const look = lookFor(dark);
  const { ctx, w, h } = fullCanvas(host);
  ctx.fillStyle = look.table.paper;
  ctx.fillRect(0, 0, w, h);
  const cols = 7;
  const cardW = Math.min(170, (w - 160) / cols - 24);
  const cardH = cardW * CARD_ASPECT;
  const kinds = [...KINDS, 'back' as const];
  kinds.forEach((kind, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 80 + col * (cardW + 24);
    const y = 120 + row * (cardH + 54);
    ctx.save();
    ctx.translate(x, y);
    if (kind === 'back') drawCardBack(ctx, cardW, cardH, look.card);
    else drawCardFace(ctx, kind, cardW, cardH, look.card);
    ctx.restore();
  });
};

/** The road strip on its own, cars at `a` and `b` miles. */
const road: Scene = (host, { dark, params, time }) => {
  const look = lookFor(dark);
  const { ctx, w } = fullCanvas(host);
  const hgt = Number(params.get('rh') ?? 420);
  const a = Number(params.get('a') ?? 325);
  const b = Number(params.get('b') ?? 250);
  const car = (side: 0 | 1, miles: number): RoadCar => ({
    model: side === 0 ? 'roadster' : 'coupe',
    ink: look.cars[side],
    miles,
    shownMiles: miles,
    pose: { ...RESTING, lights: dark, wind: 0.8, time, wheelTurn: time * 0.7 },
    trouble: (params.get(`t${side}`) as RoadCar['trouble']) ?? null,
    slowed: params.get(`s${side}`) === '1',
    greenFlash: 0,
    tag: look.cars[side].tag,
    speed: side === 0 ? 0.8 : 0,
  });
  const span = Math.max(480, Math.abs(a - b) + 260);
  drawRoad(ctx, {
    route: ROUTES[(params.get('route') as RouteId) ?? 'coast'] ?? COAST,
    night: dark,
    x: 0,
    y: 0,
    w,
    h: hgt,
    left: (a + b) / 2 + 40 - span / 2,
    span,
    end: 700,
    passedFlag: null,
    time,
    cars: [car(0, a), car(1, b)],
    puffs: [],
    slowMo: 0,
  });
};

/** Both cars large, to check they read as cars: wheels on, driver in, nothing floating. */
const cars: Scene = (host, { dark, time }) => {
  const look = lookFor(dark);
  const { ctx, w, h } = fullCanvas(host);
  ctx.fillStyle = dark ? '#262a35' : '#e8e2d2';
  ctx.fillRect(0, 0, w, h);
  const poses = [
    { ...RESTING, time, wind: 1 },
    { ...RESTING, time, flat: 1 },
    { ...RESTING, time, dent: 1, lights: true },
  ];
  (['roadster', 'coupe'] as const).forEach((model, row) => {
    poses.forEach((pose, col) => {
      drawCar(ctx, model, look.cars[row as 0 | 1], 220 + col * 560, 330 + row * 420, 4, pose, dark);
    });
  });
};

/** A live table against a driver: `?scene=play&rival=sly&seed=…&teams=1&helper=0`. */
const play: Scene = (host, { dark, params }) => {
  const root = appRoot(host, dark);
  const teams = params.get('teams') === '1';
  const rival = (params.get('rival') ?? 'classic') as Level;
  const match = newMatch({
    teams,
    length: (params.get('length') as 'single' | 'short' | 'full') ?? 'single',
    seed: params.get('seed') ?? 'workbench',
    drivers: teams ? [null, rival, 'classic', rival] : [null, rival],
  });
  const synth = createSynth({ getVolume: () => 0.35, isMuted: () => params.get('mute') !== '0' });
  const table = new Table(root, match, {
    look: () => lookFor(dark),
    reducedMotion: () => params.get('reduced') === '1',
    helper: () => params.get('helper') !== '0',
    route: () => COAST,
    names: teams ? ['You', 'Rival 1', 'Partner', 'Rival 2'] : ['You', 'Rival'],
    modeLine: () => `Workbench · ${rival}`,
    sound: createTableSound(synth, () => true),
    drivers: new DriverClient(),
    onProgress: () => {},
    onHandOver: (m) => {
      (window as unknown as { __dtOver: unknown }).__dtOver = m.history.at(-1);
      if (!m.over) {
        nextHand(m);
        table.newHand(m);
      }
    },
  });
  (window as unknown as { __dt: unknown }).__dt = table;
};

/** The Hall's key art at the shapes the Hall shows it: a wide tile, a card, a square, a tall one. */
const poster: Scene = (host, { dark, live }) => {
  host.style.cssText = `display:flex;flex-wrap:wrap;gap:24px;padding:24px;background:${dark ? '#0b1220' : '#efe5cf'}`;
  for (const [width, height] of [
    [800, 450],
    [480, 300],
    [360, 360],
    [300, 420],
  ] as const) {
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.cssText = `width:${width}px;height:${height}px;border-radius:12px`;
    host.append(canvas);
    game.poster!(canvas, {
      seed: 'poster:mille',
      appearance: dark ? 'dark' : 'light',
      width,
      height,
      animate: live,
    });
  }
};

/** The Hall's attract mode: two Classic drivers on the road, silent. */
const demo: Scene = (host, { dark }) => {
  const appearance = { appearance: dark ? 'dark' : 'light', reducedMotion: false } as Parameters<
    NonNullable<typeof game.demo>
  >[1];
  const handle = game.demo!('demo:workbench', appearance);
  host.style.cssText = 'width:960px;height:540px;margin:24px';
  host.append(handle.element);
};

export const SCENES: Record<string, Scene> = {
  midhand,
  coup,
  sheet,
  deck,
  road,
  cars,
  play,
  poster,
  demo,
};
