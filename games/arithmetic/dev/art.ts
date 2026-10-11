import { AtomWorld } from '../src/render/atom/atom-world';
import type { Look } from '../src/render/look';
import { SprintWorld } from '../src/render/sprint/sprint-world';
import { Stage } from '../src/render/stage';
import type { WorldScene } from '../src/render/world';

/**
 * One world on its own, frozen or running: `?art=sums|split|menu&theme=atom&look=night&freeze=3`.
 * `split` holds the moment of the last split of 360.
 */
export async function stageArt(params: URLSearchParams) {
  await document.fonts.ready;
  const host = document.getElementById('stage')!;
  const look: Look = {
    theme: params.get('theme') === 'atom' ? 'atom' : 'sprint',
    dark: params.get('look') === 'night',
  };
  const scale = Math.min(2, devicePixelRatio);
  const world =
    look.theme === 'atom' ? new AtomWorld(look, false, scale) : new SprintWorld(look, false, scale);
  const stage = new Stage(host, world);
  const kind = params.get('art') ?? 'sums';
  stage.setKind(kind === 'menu' ? 'menu' : 'play');
  const freeze = Number(params.get('freeze') ?? 3);
  const t0 = freeze - Number(params.get('ago') ?? 0.42);
  if (kind === 'split') {
    const before: WorldScene = {
      kind: 'split',
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
  } else if (kind === 'menu') {
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
      world.stage(
        {
          distance: 40,
          phase: Number(params.get('phase') ?? 2.1),
          speed: Number(params.get('speed') ?? 6.5),
        },
        freeze,
      );
    if (world instanceof AtomWorld)
      world.stage({ fusedAgo: Number(params.get('ago') ?? 0.42) }, freeze);
  }
  stage.freeze(freeze);
  (window as unknown as { __ready: boolean }).__ready = true;
}
