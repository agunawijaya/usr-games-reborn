import '../src/ui/styles.css';
import { dailyPlan } from '../src/engine/daily';
import { dailyEvent } from '../src/ui/menu-view';
import type { TrainingRow } from '../src/engine/penalties';
import { AtomWorld } from '../src/render/atom/atom-world';
import type { Layout } from '../src/render/layout';
import type { Look } from '../src/render/look';
import { SprintWorld } from '../src/render/sprint/sprint-world';
import { Stage } from '../src/render/stage';
import { h } from '../src/ui/dom';
import {
  fitBoardText,
  hud,
  numberKeys,
  place,
  placeTop,
  primeKeys,
  problemBoard,
  splitBoard,
  trainingPanel,
} from '../src/ui/hud';
import { menuView, type MenuData } from '../src/ui/menu-view';

/**
 * Hero moments staged with the real worlds and interface pieces:
 * `?scene=sums|split|menu&theme=sprint|atom&look=day|night`, held still at `&freeze=<seconds>`.
 */
type SceneName = 'sums' | 'split' | 'menu';

const TRAINING: TrainingRow[] = [
  { op: 'x', slot: 0, value: 7, chances: 4 },
  { op: 'x', slot: 1, value: 8, chances: 3 },
  { op: '-', slot: 1, value: 6, chances: 1 },
];

function menuData(): MenuData {
  const plan = dailyPlan('arithmetic:daily:2026-10-11');
  return {
    daily: {
      number: 41,
      dateLabel: 'Sunday 11 October',
      events: plan.events.map((spec) => dailyEvent(spec)),
      played: null,
    },
    campaign: {
      chapters: Array.from({ length: 12 }, (_, i) => ({
        stars: [3, 2, 3][i] ?? 0,
        state: i < 3 ? ('done' as const) : i === 3 ? ('next' as const) : ('later' as const),
      })),
      nextTitle: 'Tables',
      nextNumber: 4,
      totalStars: 8,
    },
    album: 37,
    training: TRAINING.length,
  };
}

function hallChrome(onTitle: boolean): HTMLElement {
  const pill = h(
    'div',
    {
      style: `position:absolute;top:10px;${onTitle ? 'left:16px' : 'right:16px'};z-index:30;padding:9px 18px;border-radius:999px;background:rgba(255,255,255,0.9);color:#14202f;font:600 16px/1.2 'Atkinson Hyperlegible Next',system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,0.18)`,
    },
    onTitle ? '← Back to the Hall' : 'Pause · Esc',
  );
  return pill;
}

function overlay(scene: SceneName, layout: Layout, look: Look): HTMLElement[] {
  const nothing = () => undefined;
  if (scene === 'menu') {
    const parts: HTMLElement[] = [
      menuView(layout, menuData(), {
        daily: nothing,
        campaign: nothing,
        mode: nothing,
        album: nothing,
        training: nothing,
        help: nothing,
        settings: nothing,
      }),
    ];
    if (look.theme === 'sprint') {
      parts.push(
        place(
          h(
            'div',
            { class: 'ns-board', 'aria-hidden': 'true' },
            h('div', { class: 'ns-board__top' }, 'Your best Daily'),
            h('div', { class: 'ns-board__problem' }, '2,840'),
            h('div', { class: 'ns-board__rule' }, 'Sums 19/20 · Split 5/5 · Sieve 0:41 · Spell ✓'),
          ),
          layout.board,
        ),
      );
    } else {
      const { chamber } = layout;
      const caption = h(
        'div',
        { class: 'ns-caption' },
        h('div', { class: 'ns-caption__small' }, 'Number of the day'),
        h('div', { class: 'ns-caption__big' }, '360 = 2³ × 3² × 5'),
      );
      caption.style.left = `${chamber.x - chamber.r * 1.2}px`;
      caption.style.width = `${chamber.r * 2.4}px`;
      caption.style.top = `${chamber.y + chamber.r * 1.02}px`;
      parts.push(caption);
    }
    return parts;
  }
  const keysRect = layout.keys;
  if (scene === 'sums') {
    return [
      place(
        hud({
          mode: 'Quick Sums',
          level: 'Times tables',
          count: 'Problem 12 of 20',
          pips: Array.from({ length: 20 }, (_, i) =>
            i < 11 ? (i === 4 || i === 8 ? 'done' : 'clean') : i === 11 ? 'now' : 'todo',
          ),
          clock: '0:31.4',
          streak: '6 in a row',
        }),
        { ...layout.hud, h: layout.hud.h + 30 * layout.s },
      ),
      place(
        problemBoard({
          top: 'Problem 12 · times tables',
          left: 7,
          sign: 'x',
          right: 8,
          typed: '5',
          askRemainder: false,
        }),
        layout.board,
      ),
      placeTop(trainingPanel(TRAINING), layout.side),
      place(numberKeys(nothing), keysRect),
    ];
  }
  return [
    place(
      hud({
        mode: 'Split',
        level: 'Three digits',
        count: 'Number 3 of 5',
        pips: ['clean', 'done', 'now', 'todo', 'todo'],
        clock: '0:24.8',
        streak: null,
      }),
      { ...layout.hud, h: layout.hud.h + 30 * layout.s },
    ),
    place(
      splitBoard({
        top: 'Split into primes',
        start: 360,
        found: [2, 2, 2, 3, 3, 5],
        remaining: 1,
        done: true,
      }),
      layout.board,
    ),
    place(primeKeys([2, 3, 5, 7, 11, 13], nothing, nothing), keysRect),
  ];
}

export async function stageHero(params: URLSearchParams) {
  await document.fonts.ready;
  const scene = (params.get('scene') ?? 'sums') as SceneName;
  const look: Look = {
    theme: params.get('theme') === 'atom' ? 'atom' : 'sprint',
    dark: params.get('look') === 'night',
  };
  const host = document.getElementById('stage')!;
  const root = h('div', {
    class: 'ns',
    'data-theme': look.theme,
    'data-look': look.dark ? 'night' : 'day',
    'data-motion': 'full',
  });
  host.append(root);
  const scale = Math.min(2, devicePixelRatio);
  const world =
    look.theme === 'atom' ? new AtomWorld(look, false, scale) : new SprintWorld(look, false, scale);
  const stage = new Stage(root, world);
  stage.setKind(scene === 'menu' ? 'menu' : 'play');
  const layout = stage.layout;
  root.style.setProperty('--s', String(layout.s));
  const freeze = Number(params.get('freeze') ?? 6);
  const ago = Number(params.get('ago') ?? (scene === 'split' ? 0.34 : 0.9));
  const t0 = freeze - ago;
  if (scene === 'split') {
    const before = {
      kind: 'split' as const,
      start: 360,
      remaining: 5,
      found: [2, 2, 2, 3, 3],
      total: 6,
      done: false,
    };
    if (world instanceof SprintWorld) world.stage({ distance: 40, speed: 5 }, 0);
    world.show(before, 0);
    world.cue({ kind: 'split', prime: 5, last: true }, t0);
    world.show({ ...before, remaining: 1, found: [2, 2, 2, 3, 3, 5], done: true }, t0);
    if (world instanceof SprintWorld)
      world.stage({ distance: 40 + 6 + 5 * 5.5 - 0.15, jump: 0.5, speed: 6, phase: 1 }, freeze);
  } else if (scene === 'menu') {
    world.show({ kind: 'menu', featured: 360, daily: 41 }, 0);
  } else {
    world.show(
      { kind: 'sums', op: 'x', left: 6, right: 9, solved: 10, total: 20, streak: 5, ghost: -0.5 },
      0,
    );
    world.cue({ kind: 'correct', answer: 54, streak: 6 }, t0);
    world.show(
      { kind: 'sums', op: 'x', left: 7, right: 8, solved: 11, total: 20, streak: 6, ghost: -0.6 },
      t0,
    );
    if (world instanceof SprintWorld)
      world.stage({ distance: 40, phase: Number(params.get('phase') ?? 2.1), speed: 6.5 }, freeze);
    if (world instanceof AtomWorld) world.stage({ fusedAgo: ago }, freeze);
  }
  stage.freeze(freeze);
  const layer = h('div', { class: 'ns-layer' }, ...overlay(scene, layout, look));
  root.append(layer, hallChrome(scene === 'menu'));
  for (const board of root.querySelectorAll<HTMLElement>('.ns-board')) fitBoardText(board);
  (window as unknown as { __ready: boolean }).__ready = true;
}
