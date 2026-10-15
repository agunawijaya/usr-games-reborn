import { drawFish } from '../src/render/fish/draw';
import { SPECIES } from '../src/render/fish/species';
import { lookFor } from '../src/render/look';
import { type PondScene, PondView } from '../src/render/pond-view';
import type { Mood, RivalPainter } from '../src/render/rivals/common';
import { CAT } from '../src/render/rivals/cat';
import { HERON } from '../src/render/rivals/heron';
import { OTTER } from '../src/render/rivals/otter';
import { bookFrame, castFrame, midgameFrame } from './hero-scenes';

/** Workbench scenes, staged with the real renderer. */

export interface SceneOptions {
  dark: boolean;
  live: boolean;
  /** Seconds into the scene at which a still frame is taken. */
  time: number;
  params: URLSearchParams;
}

type Scene = (host: HTMLElement, options: SceneOptions) => Promise<void> | void;

function fullCanvas(host: HTMLElement): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  const scale = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * scale;
  canvas.height = window.innerHeight * scale;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  host.append(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  return { canvas, ctx };
}

/**
 * Every species large, for checking anatomy close up: a row each, plain, golden, and arched as
 * in a leap with a wriggle. `?only=koi` shows one species very large.
 */
const fishSheet: Scene = (host, options) => {
  const look = lookFor(options.dark);
  const { ctx } = fullCanvas(host);
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.fillStyle = look.dark ? '#0d1a2c' : '#e9f2ef';
  ctx.fillRect(0, 0, width, height);
  const only = options.params.get('only');
  if (only) {
    const species = SPECIES.find((s) => s.id === only) ?? SPECIES[0]!;
    drawFish(ctx, species, { x: width * 0.3, y: height * 0.32, length: 560, gold: look.gold });
    drawFish(ctx, species, {
      x: width * 0.72,
      y: height * 0.32,
      length: 460,
      gold: look.gold,
      golden: true,
      time: options.time,
    });
    drawFish(ctx, species, {
      x: width * 0.3,
      y: height * 0.76,
      length: 460,
      gold: look.gold,
      angle: -0.5,
      pose: { arch: 0.8, wiggle: 0, phase: 0 },
    });
    drawFish(ctx, species, {
      x: width * 0.72,
      y: height * 0.76,
      length: 460,
      gold: look.gold,
      pose: { arch: 0, wiggle: 1, phase: options.time * 8 },
    });
    return;
  }
  const columns = 5;
  const cellW = width / columns;
  const cellH = height / 3;
  SPECIES.forEach((species, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = cellW * (col + 0.5);
    const y = cellH * (row + 0.5);
    drawFish(ctx, species, {
      x,
      y,
      length: 200 * (0.75 + species.size * 0.25),
      gold: look.gold,
      golden: options.params.get('golden') === '1',
      time: options.time,
      pose:
        options.params.get('pose') === 'leap'
          ? { arch: 0.7, wiggle: 0.3, phase: 1 }
          : { arch: 0, wiggle: 0, phase: 0 },
    });
    ctx.fillStyle = look.dark ? '#d8dde6' : '#1f3a33';
    ctx.font = '600 16px "Atkinson Hyperlegible Next"';
    ctx.textAlign = 'center';
    ctx.fillText(`${'A23456789TJQK'[i]} · ${species.name}`, x, y + cellH * 0.42);
  });
};

const PAINTERS: Record<string, RivalPainter> = { otter: OTTER, heron: HERON, cat: CAT };

/** One rival in all four moods, large: `?who=otter`, `&scale=1.6`. */
const rivalSheet: Scene = (host, options) => {
  const look = lookFor(options.dark);
  const { ctx } = fullCanvas(host);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, look.sky.top);
  sky.addColorStop(1, look.water.middle);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  const painter = PAINTERS[options.params.get('who') ?? 'otter'] ?? OTTER;
  const scale = Number(options.params.get('scale') ?? 1.6);
  const moods: Mood[] = ['idle', 'thinking', 'delighted', 'grumpy'];
  moods.forEach((mood, i) => {
    painter.draw(ctx, {
      x: width * (0.14 + i * 0.24),
      y: height * 0.78,
      scale,
      mood,
      time: options.time,
      moodAge: mood === 'delighted' ? 0.27 : 2,
      cards: 6,
      look,
      seed: 3,
    });
    ctx.fillStyle = look.dark ? '#e6e9f0' : '#1f3a33';
    ctx.font = '600 22px "Atkinson Hyperlegible Next"';
    ctx.textAlign = 'center';
    ctx.fillText(mood, width * (0.14 + i * 0.24), height * 0.95);
  });
};

/** The whole pond with the live renderer, no panels: for judging the scene itself. */
const pondScene: Scene = (host, options) => {
  const look = lookFor(options.dark);
  const view = new PondView(look);
  host.append(view.element);
  view.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  const scene: PondScene = {
    time: options.time,
    rivals: [
      { kind: 'otter', mood: 'thinking', moodAge: 2, cards: 6 },
      { kind: 'heron', mood: 'delighted', moodAge: 0.25, cards: 8 },
      { kind: 'cat', mood: 'idle', moodAge: 2, cards: 5 },
    ],
    pond: 22,
    hand: [0, 13, 26, 4, 17, 9, 22, 35, 11, 37],
    lifted: 10,
    bucket: [
      { rank: 7, golden: false },
      { rank: 13, golden: false },
      { rank: 3, golden: true },
    ],
    ripples: [],
    motion: 1,
    cast:
      options.params.get('cast') !== null
        ? { age: Number(options.params.get('cast')), card: 31, lucky: false }
        : undefined,
  };
  view.draw(scene);
};

export const SCENES: Record<string, Scene> = {
  fish: fishSheet,
  rivals: rivalSheet,
  pond: pondScene,
  midgame: midgameFrame,
  cast: castFrame,
  book: (host, options) => bookFrame(host, options, false),
  golden: (host, options) => bookFrame(host, options, true),
};
