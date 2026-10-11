import { type AppearanceState, createRng, type DemoHandle } from '@usr-games/kit';
import { SKILLS, sumDifficulty } from '../bots/bots';
import { emptyBook } from '../engine/penalties';
import { BLOCK_SIZE, type BlockState, startBlock, submitAnswer } from '../engine/sums';
import { SUMS_LEVELS } from '../engine/levels';
import type { Look } from '../render/look';
import { SprintWorld } from '../render/sprint/sprint-world';
import { Stage } from '../render/stage';
import { h } from './dom';
import { fitBoardText, place, problemBoard } from './hud';

/**
 * The Hall's attract loop: the ace bot running a Quick Sums block on the Sprint track, silent.
 * Answers are typed out digit by digit on the scoreboard; now and then it slips and stumbles.
 * When the block ends it starts another, on the next rung.
 */
export function startDemo(seed: string, appearance: AppearanceState): DemoHandle {
  const element = h('div', { class: 'ns', 'data-theme': 'sprint', 'aria-hidden': 'true' });
  element.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden';
  let look: Look = { theme: 'sprint', dark: appearance.appearance === 'dark' };
  element.dataset.look = look.dark ? 'night' : 'day';
  element.dataset.motion = appearance.reducedMotion ? 'reduce' : 'full';
  const world = new SprintWorld(
    look,
    appearance.reducedMotion,
    Math.min(2, window.devicePixelRatio || 1),
  );
  const stage = new Stage(element, world);
  stage.setKind('play');
  const layer = h('div', { class: 'ns-layer' });
  element.append(layer);
  const rng = createRng(`demo:${seed}`);
  const random = (n: number) => rng.int(0, n - 1);
  const ace = SKILLS.ace;
  let rung = 0;
  let state: BlockState = startBlock(emptyBook(), SUMS_LEVELS[rung]!, 'rush', random);
  let typed = '';
  let timer = 0;
  let visible = true;
  const timeline: (() => void)[] = [];

  function render() {
    const l = stage.layout;
    element.style.setProperty('--s', String(l.s));
    const board = place(
      problemBoard({
        top: `Quick Sums · ${SUMS_LEVELS[rung]!.name} · ${Math.min(state.solved + 1, BLOCK_SIZE)} of ${BLOCK_SIZE}`,
        left: state.problem.left,
        sign: state.problem.op,
        right: state.problem.right,
        typed,
        askRemainder: state.problem.askRemainder,
      }),
      l.board,
    );
    layer.replaceChildren(board);
    fitBoardText(board);
    world.show(
      {
        kind: 'sums',
        op: state.problem.op,
        left: state.problem.left,
        right: state.problem.right,
        solved: state.solved,
        total: BLOCK_SIZE,
        streak: state.streak,
        ghost: null,
      },
      stage.now(),
    );
  }

  /** Plans the next answer: think, type each digit, then press Enter. */
  function plan() {
    const slip = rng.chance(Math.min(0.25, ace.slip * sumDifficulty(state.problem) * 4));
    const answer = slip
      ? String(state.problem.answer + rng.pick([1, -1, 10]))
      : String(state.problem.answer);
    const think =
      (ace.sumBase + ace.sumPerDifficulty * (sumDifficulty(state.problem) - 1)) *
      rng.float(0.8, 1.3);
    timeline.push(...[...answer].map((digit) => () => ((typed += digit), render())), () =>
      submit(answer),
    );
    timer = window.setTimeout(step, think * 0.6);
  }

  function step() {
    if (!visible) return;
    const next = timeline.shift();
    if (!next) {
      plan();
      return;
    }
    next();
    timer = window.setTimeout(step, 140);
  }

  function submit(answer: string) {
    const outcome = submitAnswer(state, answer, 1200, random);
    typed = '';
    if (outcome.check === 'wrong') {
      world.cue({ kind: 'wrong' }, stage.now());
      state = outcome.state;
    } else if (outcome.check === 'right') {
      world.cue(
        { kind: 'correct', answer: state.problem.answer, streak: outcome.state.streak },
        stage.now(),
      );
      state = outcome.state;
      if (state.finished) {
        world.cue({ kind: 'finish', personalBest: true }, stage.now());
        rung = (rung + 1) % 4;
        state = startBlock(emptyBook(), SUMS_LEVELS[rung]!, 'rush', random);
      }
    }
    render();
  }

  const unlisten = stage.onLayout(render);
  render();
  stage.start();
  plan();

  return {
    element,
    setAppearance(next) {
      look = { theme: 'sprint', dark: next.appearance === 'dark' };
      element.dataset.look = look.dark ? 'night' : 'day';
      element.dataset.motion = next.reducedMotion ? 'reduce' : 'full';
      stage.setLook(look, next.reducedMotion);
    },
    setVisible(next) {
      visible = next;
      stage.setVisible(next);
      window.clearTimeout(timer);
      if (next) timer = window.setTimeout(step, 400);
    },
    destroy() {
      window.clearTimeout(timer);
      unlisten();
      stage.destroy();
      element.remove();
    },
  };
}
