import { createRng } from '@usr-games/kit';
import { collect } from '../../engine/album';
import { eventCount, eventPar, splitLevel, splitPoints } from '../../engine/events';
import { factorize } from '../../engine/factor';
import { splitNumbers } from '../../engine/levels';
import {
  declarePrime,
  type SplitMove,
  type SplitState,
  splitHint,
  startSplit,
  trySplit,
} from '../../engine/split';
import { albumPackages } from '../../game/records';
import type { App, Screen, ScreenFactory } from '../app';
import { clockText, EventClock } from '../clock';
import { h } from '../dom';
import { type EventScreenOptions, rungKey } from '../flow';
import { fitBoardText, hud, place, placeTop, type PipState, primeKeys, splitBoard } from '../hud';
import { exposeHook } from '../hook';
import { confirmLeave, eventLabel, feedbackLine, playRoot, shake } from './play';

/**
 * Split, after `factor`: each number is broken down one prime at a time, from the keys or by
 * typing. A prime that does not go in, or a number that is not prime, bounces and in Rush costs
 * three seconds. "It's prime" makes the last split when what is left is itself prime.
 */
const BOUNCE_MS = 3000;
const BETWEEN_MS = 1500;

export function splitScreen(options: EventScreenOptions): ScreenFactory {
  return (app: App): Screen => {
    const { plan, spec } = options;
    const level = splitLevel(spec.level);
    const numbers = splitNumbers({ ...level, count: eventCount(spec) }, createRng(options.seed));
    const parPerNumber = eventPar(spec) / numbers.length;
    const rush = plan.tempo === 'rush';
    const clock = new EventClock();
    let index = 0;
    let state: SplitState = startSplit(numbers[0]!);
    let numberStartedAt = 0;
    let typed = '';
    let hints = 0;
    let score = 0;
    let cleanNumbers = 0;
    let splits = 0;
    let bounces = 0;
    let between = false;
    let gone = false;
    const done: number[] = [];
    const primesFound: number[] = [];
    const pipStates: PipState[] = numbers.map((_, i) => (i === 0 ? 'now' : 'todo'));

    const hudSlot = h('div', { class: 'ns-slot' });
    const boardSlot = h('div', { class: 'ns-slot', 'data-testid': 'ns-board' });
    const feedback = feedbackLine();
    const typedLine = h('p', { class: 'ns-typed', 'aria-live': 'polite' });
    const hintButton = h(
      'button',
      {
        class: 'ns-button ns-hint-button',
        type: 'button',
        onclick: () => giveHint(),
        'aria-keyshortcuts': '?',
      },
      'Hint (?)',
    );
    const keys = primeKeys(
      level.pool,
      (p) => attempt(trySplit(state, p)),
      () => attempt(declarePrime(state)),
    );
    const root = playRoot('ns-split', hudSlot, boardSlot, typedLine, feedback, hintButton, keys);

    function renderHud() {
      hudSlot.replaceChildren(
        hud({
          mode: 'Split',
          level: level.name,
          count: `Number ${Math.min(index + 1, numbers.length)} of ${numbers.length}`,
          pips: pipStates,
          clock: rush ? clockText(clock.elapsed()) : null,
          streak: null,
        }),
      );
    }

    function renderBoard() {
      boardSlot.replaceChildren(
        splitBoard({
          top: eventLabel(plan, options.index, 'Split into primes'),
          start: state.start,
          found: state.found,
          remaining: state.remaining,
          done: state.done,
        }),
      );
      typedLine.textContent = typed ? `Try ${typed}` : '';
      layout();
    }

    function layout() {
      const l = app.layout;
      place(hudSlot, { ...l.hud, h: l.hud.h + 30 * l.s });
      place(boardSlot, l.board);
      placeTop(typedLine, { x: l.board.x, y: l.board.y + l.board.h + 18 * l.s, w: l.board.w });
      // Under the status panel: the hurdles' badges own the space below the board.
      placeTop(feedback, { x: l.hud.x, y: l.hud.y + l.hud.h + 60 * l.s, w: l.hud.w });
      place(keys, l.keys);
      placeTop(hintButton, {
        x: l.keys.x + l.keys.w + 16 * l.s,
        y: l.keys.y + 12 * l.s,
        w: 150 * l.s,
      });
      for (const board of boardSlot.querySelectorAll<HTMLElement>('.ns-board')) fitBoardText(board);
    }

    function showScene() {
      app.setScene({
        kind: 'split',
        start: state.start,
        remaining: state.remaining,
        found: state.found,
        total: factorize(state.start).length,
        done: state.done,
      });
    }

    function say(text: string) {
      feedback.textContent = text;
    }

    function giveHint() {
      if (between || state.done) return;
      hints++;
      app.sounds.hint();
      say(splitHint(state.remaining));
    }

    function attempt({ state: next, move }: { state: SplitState; move: SplitMove }) {
      if (between || app.isPaused || gone) return;
      clock.start();
      typed = '';
      if (move.kind === 'ignored') {
        renderBoard();
        return;
      }
      if (move.kind !== 'split') {
        state = next;
        bounces++;
        if (rush) clock.addPenalty(BOUNCE_MS);
        app.cue({ kind: 'bounce' });
        app.sounds.wrong();
        shake(boardSlot);
        say(bounceText(move, state.remaining) + (rush ? ' Three seconds added.' : ''));
        renderHud();
        renderBoard();
        return;
      }
      splits++;
      app.cue({ kind: 'split', prime: move.prime, last: move.last });
      state = next;
      showScene();
      app.sounds.split(move.last);
      say(move.last ? '' : `${move.prime} goes in.`);
      if (move.last) finishNumber();
      renderHud();
      renderBoard();
    }

    function finishNumber() {
      between = true;
      clock.stop();
      const ms = clock.elapsed() - numberStartedAt;
      const clean = state.bounces === 0;
      if (clean) cleanNumbers++;
      score += splitPoints(state.bounces, ms, parPerNumber, plan.tempo);
      pipStates[index] = clean ? 'clean' : 'done';
      done.push(state.start);
      primesFound.push(...state.found);
      const { album, added } = collect(app.saves.album.load(), state.found);
      if (added.length > 0) {
        app.saves.album.save(album);
        app.install(albumPackages(album));
        say(`New in your album: ${added.join(', ')}.`);
      }
      window.setTimeout(nextNumber, BETWEEN_MS);
    }

    function nextNumber() {
      if (gone) return;
      index++;
      if (index >= numbers.length) {
        finishEvent();
        return;
      }
      between = false;
      state = startSplit(numbers[index]!);
      pipStates[index] = 'now';
      numberStartedAt = clock.elapsed();
      clock.start();
      say('');
      showScene();
      renderHud();
      renderBoard();
    }

    function finishEvent() {
      const ms = clock.elapsed();
      app.cue({ kind: 'finish', personalBest: false });
      app.sounds.finish(false);
      options.onDone({
        result: {
          spec,
          tempo: plan.tempo,
          score,
          items: numbers.length,
          clean: cleanNumbers,
          rights: splits,
          wrongs: bounces,
          hints,
          ms,
        },
        detail: { mode: 'split', starts: done },
        rungKey: rungKey(spec),
        primes: primesFound,
      });
    }

    function press(key: string): boolean {
      if (/^[0-9]$/.test(key)) {
        if (typed.length >= 10) return true;
        typed += key;
        app.sounds.tap();
        renderBoard();
        return true;
      }
      if (key === 'Backspace') {
        typed = typed.slice(0, -1);
        renderBoard();
        return true;
      }
      if (key === 'Enter') {
        if (typed) attempt(trySplit(state, Number(typed)));
        return true;
      }
      if (key === 'p' || key === 'P') {
        attempt(declarePrime(state));
        return true;
      }
      if (key === '?') {
        giveHint();
        return true;
      }
      return false;
    }

    const ticker = window.setInterval(() => {
      if (!rush || !clock.running) return;
      const text = hudSlot.querySelector('.ns-clock');
      if (text) text.textContent = clockText(clock.elapsed());
    }, 100);

    exposeHook({
      mode: 'split',
      answer: () => (between || state.done ? '' : String(factorize(state.remaining)[0] ?? '')),
    });
    renderHud();
    renderBoard();
    showScene();
    clock.start();
    app.sounds.start();

    return {
      element: root,
      layout: 'play',
      pauseItems: [
        {
          id: 'restart',
          label: 'Start these splits again',
          run: () =>
            confirmLeave(app, 'Start these splits again?', () => app.show(splitScreen(options))),
        },
      ],
      onLayout: layout,
      onKey: (event) => press(event.key),
      onPause: () => clock.stop(),
      onResume: () => {
        if (!between) clock.start();
      },
      destroy: () => {
        exposeHook(null);
        gone = true;
        window.clearInterval(ticker);
      },
    };
  };
}

function bounceText(move: SplitMove, remaining: number): string {
  const n = remaining.toLocaleString('en-US');
  if (move.kind === 'no-divide')
    return `${move.value.toLocaleString('en-US')} does not go into ${n}.`;
  if (move.kind === 'not-prime') {
    return move.value === remaining
      ? `${n} still splits: it is not prime yet.`
      : `${move.value} is not prime: split with its primes instead.`;
  }
  return '';
}
