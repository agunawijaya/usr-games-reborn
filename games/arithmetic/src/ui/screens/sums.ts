import { createRng } from '@usr-games/kit';
import { sumsLevel } from '../../engine/events';
import { type Hint, hintFor } from '../../engine/hints';
import type { SumsLevel } from '../../engine/levels';
import { trainingRows } from '../../engine/penalties';
import {
  BLOCK_SIZE,
  type BlockState,
  blockCard,
  SIGN,
  startBlock,
  submitAnswer,
} from '../../engine/sums';
import { ghostGap, noteForgiven } from '../../game/records';
import type { App, Screen, ScreenFactory } from '../app';
import { clockText, EventClock } from '../clock';
import { h } from '../dom';
import { type EventScreenOptions, rungKey } from '../flow';
import { hintCard } from '../hint-view';
import { exposeHook } from '../hook';
import {
  fitBoardText,
  hud,
  numberKeys,
  place,
  placeTop,
  type PipState,
  problemBoard,
  trainingPanel,
} from '../hud';
import { confirmLeave, eventLabel, feedbackLine, playRoot, shake } from './play';

/**
 * Quick Sums: a block of twenty problems in the original's rules. A wrong answer keeps the
 * problem; three wrong answers bring up a picture hint; the answer itself is never shown. The
 * tutor's charges carry over between blocks, and the numbers it lets go are announced.
 */
const FINISH_PAUSE_MS = 1700;

export function customLevel(ops: string, range: number): SumsLevel {
  const signs = [...new Set(ops)].map((sign) => SIGN[sign as keyof typeof SIGN]).join(' ');
  return {
    id: 'custom',
    name: `Your own: ${signs} to ${range}`,
    ops,
    range,
    rule: ops.includes('/') ? 'Whole-number answer: drop what is left over' : undefined,
  };
}

export function sumsScreen(options: EventScreenOptions): ScreenFactory {
  return (app: App): Screen => {
    const { plan, spec } = options;
    const prefs = app.saves.prefs.load();
    const custom = spec.level === 'custom' ? prefs.custom : null;
    const level = custom ? customLevel(custom.ops, custom.range) : sumsLevel(spec.level);
    const key = rungKey(spec, custom ?? undefined);
    const rng = createRng(options.seed);
    const random = (n: number) => rng.int(0, n - 1);
    let state: BlockState = startBlock(app.saves.tutor.load().book, level, plan.tempo, random);
    app.saves.tutor.save({ book: state.book });
    const pace = app.saves.records.load().sums[key]?.pace ?? [];
    const rush = plan.tempo === 'rush';
    const clock = new EventClock();
    /** Which solved problems were right the first time, for the pips. */
    const firstTime: boolean[] = [];
    let problemStartedAt = 0;
    let typed = '';
    let hint: Hint | null = null;
    let forgivenNote = '';
    let finished = false;
    let gone = false;

    const hudSlot = h('div', { class: 'ns-slot' });
    const boardSlot = h('div', { class: 'ns-slot', 'data-testid': 'ns-board' });
    const sideSlot = h('div', { class: 'ns-slot', 'data-testid': 'ns-training' });
    const hintSlot = h('div', { class: 'ns-slot', 'data-testid': 'ns-hint' });
    const feedback = feedbackLine();
    const keys = prefs.keys ? numberKeys(press, level.remainders === true ? 'r' : null) : null;
    const root = playRoot('ns-sums', hudSlot, boardSlot, feedback, sideSlot, hintSlot, keys);

    function pips(): PipState[] {
      return Array.from({ length: BLOCK_SIZE }, (_, i) => {
        if (i < state.solved) return firstTime[i] ? 'clean' : 'done';
        return i === state.solved && !state.finished ? 'now' : 'todo';
      });
    }

    function renderHud() {
      hudSlot.replaceChildren(
        hud({
          mode: 'Quick Sums',
          level: level.name,
          count: state.finished
            ? `All ${BLOCK_SIZE} done`
            : `Problem ${state.solved + 1} of ${BLOCK_SIZE}`,
          pips: pips(),
          clock: rush ? clockText(clock.elapsed()) : null,
          streak: state.streak >= 3 ? `${state.streak} in a row` : null,
        }),
      );
    }

    function renderBoard() {
      const problem = state.problem;
      boardSlot.replaceChildren(
        problemBoard({
          top: eventLabel(plan, options.index, `Problem ${state.solved + 1}`),
          left: problem.left,
          sign: problem.op,
          right: problem.right,
          typed,
          askRemainder: problem.askRemainder,
          rule: level.rule,
        }),
      );
      layout();
    }

    function renderSide() {
      const panel = trainingPanel(trainingRows(state.book));
      if (forgivenNote) {
        panel.append(h('p', { class: 'ns-training__forgiven', role: 'status' }, forgivenNote));
      }
      sideSlot.replaceChildren(panel);
    }

    function renderHint() {
      hintSlot.replaceChildren(...(hint ? [hintCard(hint)] : []));
    }

    function layout() {
      const l = app.layout;
      place(hudSlot, { ...l.hud, h: l.hud.h + 30 * l.s });
      place(boardSlot, l.board);
      placeTop(sideSlot, l.side);
      placeTop(hintSlot, { x: l.hud.x, y: l.hud.y + l.hud.h + 50 * l.s, w: l.hud.w });
      placeTop(feedback, { x: l.board.x, y: l.board.y + l.board.h + 26 * l.s, w: l.board.w });
      if (keys) place(keys, l.keys);
      for (const board of boardSlot.querySelectorAll<HTMLElement>('.ns-board')) fitBoardText(board);
    }

    function showScene() {
      app.setScene({
        kind: 'sums',
        op: state.problem.op,
        left: state.problem.left,
        right: state.problem.right,
        solved: state.solved,
        total: BLOCK_SIZE,
        streak: state.streak,
        ghost: rush ? ghostGap(pace, clock.elapsed(), state.solved) : null,
      });
    }

    function say(text: string) {
      feedback.textContent = text;
    }

    function press(key: string) {
      if (finished || app.isPaused) return;
      clock.start();
      if (/^[0-9]$/.test(key)) {
        if (typed.replace(/\D/g, '').length >= 7) return;
        typed += key;
      } else if (key === 'r' || key === ' ') {
        if (!state.problem.askRemainder || typed === '' || typed.includes('r')) return;
        typed += ' r ';
      } else if (key === 'Backspace') {
        typed = typed.endsWith(' r ') ? typed.slice(0, -3) : typed.slice(0, -1);
      } else if (key === 'Enter') {
        submit();
        return;
      } else {
        return;
      }
      app.sounds.tap();
      renderBoard();
    }

    function submit() {
      const asked = state.problem;
      if (typed.trim() === '') {
        say(
          asked.askRemainder
            ? 'Type the answer, then r and what is left over.'
            : 'Type a number, then Enter.',
        );
        return;
      }
      const outcome = submitAnswer(state, typed, clock.elapsed() - problemStartedAt, random);
      if (outcome.check === 'not-a-number') {
        say(
          asked.askRemainder
            ? 'Write it as the answer, r, and what is left over: 7 r 5.'
            : 'That is not a number.',
        );
        return;
      }
      typed = '';
      if (outcome.check === 'wrong') {
        state = outcome.state;
        app.saves.tutor.save({ book: state.book });
        app.cue({ kind: 'wrong' });
        app.sounds.wrong();
        shake(boardSlot);
        say(outcome.hintNow ? 'Here is a way to see it.' : 'Not quite. Have another go.');
        if (outcome.hintNow) {
          hint = hintFor(asked);
          app.sounds.hint();
        }
        renderAll();
        return;
      }
      firstTime[state.solved] = state.misses === 0;
      state = outcome.state;
      app.saves.tutor.save({ book: state.book });
      hint = null;
      say('');
      app.cue({ kind: 'correct', answer: asked.answer, streak: state.streak });
      app.sounds.right(state.streak);
      if (outcome.forgiven.length > 0) {
        const noted = noteForgiven(app.saves.records.load(), outcome.forgiven.length);
        app.saves.records.save(noted.records);
        app.install(noted.earned);
        const first = outcome.forgiven[0]!;
        forgivenNote = `${first.value} with ${SIGN[first.op]} is forgiven: it turns up as often as any other number again.`;
      }
      problemStartedAt = clock.elapsed();
      if (state.finished) {
        finish();
        return;
      }
      showScene();
      renderAll();
    }

    function renderAll() {
      renderHud();
      renderSide();
      renderHint();
      renderBoard();
    }

    function finish() {
      finished = true;
      clock.stop();
      const card = blockCard(state);
      const previous = app.saves.records.load().sums[key]?.ms ?? null;
      const best = rush && previous !== null && card.totalMs < previous;
      app.cue({ kind: 'finish', personalBest: best });
      app.sounds.finish(best);
      renderHud();
      renderSide();
      renderHint();
      boardSlot.replaceChildren(
        h(
          'div',
          { class: 'ns-board' },
          h('div', { class: 'ns-board__top' }, best ? 'New best time' : 'Block done'),
          h(
            'div',
            { class: 'ns-board__problem' },
            rush ? clockText(card.totalMs) : `${card.rights} / ${BLOCK_SIZE}`,
          ),
          h(
            'div',
            { class: 'ns-board__rule' },
            `${card.firstTries} of ${BLOCK_SIZE} first time · score ${card.percent} %`,
          ),
        ),
      );
      layout();
      window.setTimeout(() => {
        if (gone) return;
        options.onDone({
          result: {
            spec,
            tempo: plan.tempo,
            score: state.score,
            items: state.solved,
            clean: state.firstTries,
            rights: state.rights,
            wrongs: state.wrongs,
            hints: state.hinted,
            ms: card.totalMs,
          },
          detail: { mode: 'sums', splits: state.splits, firstTries: state.firstTries },
          rungKey: key,
          card,
          primes: [],
        });
      }, FINISH_PAUSE_MS);
    }

    const ticker = window.setInterval(() => {
      if (finished || !rush || !clock.running) return;
      const text = hudSlot.querySelector('.ns-clock');
      if (text) text.textContent = clockText(clock.elapsed());
      showScene();
    }, 100);

    exposeHook({
      mode: 'sums',
      answer: () =>
        finished
          ? ''
          : state.problem.askRemainder
            ? `${state.problem.answer} r ${state.problem.remainder}`
            : String(state.problem.answer),
    });
    renderAll();
    showScene();
    clock.start();
    app.sounds.start();

    return {
      element: root,
      layout: 'play',
      pauseItems: [
        {
          id: 'restart',
          label: 'Start this block again',
          run: () =>
            confirmLeave(app, 'Start this block again?', () => app.show(sumsScreen(options))),
        },
      ],
      onLayout: layout,
      onKey(event) {
        const key = event.key === 'R' ? 'r' : event.key;
        if (key === 'Enter' || key === 'Backspace' || /^[0-9 r]$/.test(key)) {
          press(key);
          return true;
        }
        return false;
      },
      onPause: () => clock.stop(),
      onResume: () => {
        if (!finished) clock.start();
      },
      destroy: () => {
        exposeHook(null);
        gone = true;
        window.clearInterval(ticker);
      },
    };
  };
}
