import { eventPar, sieveLevel, sievePoints } from '../../engine/events';
import { factorize } from '../../engine/factor';
import { collect } from '../../engine/album';
import {
  choose,
  newBoard,
  onBoard,
  parChoices,
  type SieveBoard,
  survivors,
} from '../../engine/sieve-board';
import { albumPackages } from '../../game/records';
import type { App, Screen, ScreenFactory } from '../app';
import { clockText, EventClock } from '../clock';
import { h } from '../dom';
import { type EventScreenOptions, rungKey } from '../flow';
import { TOAST_WIDTH } from '../../render/layout';
import { hud, place, placeTop } from '../hud';
import { exposeHook } from '../hook';
import { confirmLeave, eventLabel, feedbackLine, playRoot, shake } from './play';

/**
 * The Sieve, after `primes`: choose a prime and every multiple of it leaves the board. When only
 * primes are left, the board is clear and they light up. Fewer choices and less time are better;
 * a number that is not prime bounces and in Rush costs three seconds. Arrow keys move along the
 * board and Enter chooses; typing a number and Enter chooses it too.
 */
const BOUNCE_MS = 3000;
const CLEAR_MS = 1800;

export function sieveScreen(options: EventScreenOptions): ScreenFactory {
  return (app: App): Screen => {
    const { plan, spec } = options;
    const level = sieveLevel(spec.level);
    const par = parChoices(level);
    const rush = plan.tempo === 'rush';
    const clock = new EventClock();
    let board: SieveBoard = newBoard(level);
    let typed = '';
    let hints = 0;
    let cursor = 0;
    let finished = false;
    let closed = false;

    const hudSlot = h('div', { class: 'ns-slot' });
    const title = h('span', { class: 'ns-label' });
    const grid = h('div', {
      class: 'ns-sieve',
      role: 'grid',
      'aria-label': `Numbers from ${level.first} to ${level.last}`,
      'data-testid': 'ns-sieve',
    });
    const strip = h('div', {
      class: 'ns-sieve__strip',
      role: 'group',
      'aria-label': 'Sieving primes',
    });
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
    const side = h(
      'section',
      { class: 'ns-panel ns-training ns-sieve__side' },
      title,
      h(
        'p',
        { class: 'ns-training__note' },
        'Choose a prime to sweep away all its multiples. When only primes are left, the board is clear.',
      ),
      h('p', { class: 'ns-training__note' }, `Par: ${par.length} choices.`),
      typedLine,
      hintButton,
    );
    const root = playRoot('ns-sieve-screen', hudSlot, grid, strip, feedback, side);

    const cells: HTMLButtonElement[] = [];
    for (let n = level.first; n <= level.last; n++) {
      const cell = h(
        'button',
        {
          class: 'ns-cell',
          type: 'button',
          tabindex: -1,
          'data-n': n,
          role: 'gridcell',
          onclick: () => pick(n),
        },
        String(n),
      );
      cells.push(cell);
      grid.append(cell);
    }
    grid.style.setProperty('--columns', String(level.columns));
    for (const prime of board.strip) {
      strip.append(
        h(
          'button',
          {
            class: 'ns-key ns-key--prime',
            type: 'button',
            onclick: () => pick(prime),
            'data-n': prime,
          },
          String(prime),
        ),
      );
    }

    function renderHud() {
      hudSlot.replaceChildren(
        hud({
          mode: 'Sieve',
          level: level.name,
          count: `${board.clicks} choice${board.clicks === 1 ? '' : 's'} · par ${par.length}`,
          pips: par.map((p) => (board.chosen.includes(p) ? 'clean' : 'todo')),
          clock: rush ? clockText(clock.elapsed()) : null,
          streak: null,
        }),
      );
    }

    function renderCells() {
      board.gone.forEach((gone, i) => {
        const cell = cells[i]!;
        const n = level.first + i;
        cell.classList.toggle('ns-cell--gone', gone !== null);
        cell.classList.toggle('ns-cell--one', gone === 'one');
        cell.classList.toggle('ns-cell--chosen', board.chosen.includes(n));
        cell.setAttribute(
          'aria-label',
          gone === null ? String(n) : gone === 'one' ? '1, not prime' : `${n}, swept by ${gone}`,
        );
      });
      for (const button of strip.querySelectorAll<HTMLButtonElement>('button')) {
        button.classList.toggle('ns-key--pressed', board.chosen.includes(Number(button.dataset.n)));
      }
      title.textContent = eventLabel(
        plan,
        options.index,
        `${level.first.toLocaleString('en-US')} to ${level.last.toLocaleString('en-US')}`,
      );
      typedLine.textContent = typed ? `Choose ${typed}` : '';
    }

    function layout() {
      const l = app.layout;
      place(hudSlot, { ...l.hud, h: l.hud.h + 30 * l.s });
      // Clear of the status panel, and of the Hall's toasts in the bottom-left corner.
      const left = Math.max(l.hud.x + l.hud.w + 30 * l.s, TOAST_WIDTH + 24);
      const right = l.side.x - 30 * l.s;
      const top = Math.max(l.hud.y, 18 * l.s) + 12 * l.s;
      const stripHeight = board.strip.length > 0 ? 70 * l.s : 0;
      const bottom = l.height - 30 * l.s - stripHeight;
      const rows = Math.ceil(cells.length / level.columns);
      const size = Math.min((right - left) / level.columns, (bottom - top) / rows);
      const width = size * level.columns;
      const x = left + (right - left - width) / 2;
      place(grid, { x, y: top, w: width, h: size * rows });
      grid.style.setProperty('--cell', `${size}px`);
      if (stripHeight)
        place(strip, { x, y: top + size * rows + 14 * l.s, w: width, h: stripHeight - 14 * l.s });
      placeTop(side, { ...l.side, y: l.side.y });
      placeTop(feedback, { x: l.hud.x, y: l.hud.y + l.hud.h + 60 * l.s, w: l.hud.w });
    }

    function say(text: string) {
      feedback.textContent = text;
    }

    function giveHint() {
      if (finished) return;
      const next = par.find((p) => !board.chosen.includes(p));
      if (next === undefined) return;
      hints++;
      app.sounds.hint();
      say(`Try ${next}: it still has multiples on the board.`);
      const cell = cells[next - level.first];
      const button = [...strip.querySelectorAll<HTMLButtonElement>('button')].find(
        (b) => Number(b.dataset.n) === next,
      );
      for (const target of [cell, button]) {
        if (!target) continue;
        target.classList.remove('ns-cell--hinted');
        void target.offsetWidth;
        target.classList.add('ns-cell--hinted');
      }
    }

    function pick(n: number) {
      if (finished || app.isPaused || closed) return;
      if (n >= level.first && n <= level.last) {
        cells[cursor]!.tabIndex = -1;
        cursor = n - level.first;
        cells[cursor]!.tabIndex = 0;
      }
      clock.start();
      typed = '';
      const { board: next, move } = choose(board, n);
      board = next;
      switch (move.kind) {
        case 'ignored':
          break;
        case 'not-prime': {
          if (rush) clock.addPenalty(BOUNCE_MS);
          app.cue({ kind: 'bounce' });
          app.sounds.wrong();
          const cell = cells[n - level.first];
          if (cell) shake(cell);
          say(
            `${n} is not prime: ${factorize(n).join(' × ')}.${rush ? ' Three seconds added.' : ''}`,
          );
          break;
        }
        case 'idle':
          app.sounds.tap();
          say(`${move.prime} has nothing left to sweep here.`);
          break;
        case 'sweep':
          app.sounds.sweep(move.swept.length);
          say(
            `${move.prime} swept away ${move.swept.length} number${move.swept.length === 1 ? '' : 's'}.`,
          );
          move.swept.forEach((value, k) => {
            const cell = cells[value - level.first];
            if (cell) cell.style.setProperty('--delay', `${Math.min(k * 14, 600)}ms`);
          });
          break;
      }
      renderCells();
      renderHud();
      if (board.clear) finish();
    }

    function finish() {
      finished = true;
      clock.stop();
      const left = survivors(board);
      left.forEach((n, k) => {
        const cell = cells[n - level.first];
        if (!cell) return;
        cell.style.setProperty('--delay', `${Math.min(k * 25, 900)}ms`);
        cell.classList.add('ns-cell--star');
      });
      const ms = clock.elapsed();
      const found = [...new Set([...left, ...board.chosen])];
      const { album, added } = collect(app.saves.album.load(), found);
      if (added.length > 0) {
        app.saves.album.save(album);
        app.install(albumPackages(album));
      }
      app.cue({ kind: 'finish', personalBest: false });
      app.sounds.finish(false);
      say(
        `Clear: ${left.length} primes left standing.${added.length > 0 ? ` ${added.length} new in your album.` : ''}`,
      );
      renderHud();
      window.setTimeout(() => {
        if (closed) return;
        options.onDone({
          result: {
            spec,
            tempo: plan.tempo,
            score: sievePoints(
              board.clicks,
              par.length,
              board.wrongClicks,
              ms,
              eventPar(spec),
              plan.tempo,
            ),
            items: 1,
            clean: board.wrongClicks === 0 ? 1 : 0,
            rights: board.clicks - board.wrongClicks,
            wrongs: board.wrongClicks,
            hints,
            ms,
            clicks: board.clicks,
            parClicks: par.length,
          },
          detail: { mode: 'sieve', wrongClicks: board.wrongClicks },
          rungKey: rungKey(spec),
          primes: found,
        });
      }, CLEAR_MS);
    }

    /** Arrow keys move along the board; the cursor skips nothing, gone cells included. */
    function moveCursor(dx: number, dy: number) {
      const columns = level.columns;
      const next = cursor + dx + dy * columns;
      if (next < 0 || next >= cells.length) return;
      if (dx !== 0 && Math.floor(next / columns) !== Math.floor(cursor / columns)) return;
      cells[cursor]!.tabIndex = -1;
      cursor = next;
      cells[cursor]!.tabIndex = 0;
      cells[cursor]!.focus();
    }

    function onKey(event: KeyboardEvent): boolean {
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const arrow = arrows[event.key];
      if (arrow) {
        moveCursor(arrow[0], arrow[1]);
        return true;
      }
      if (/^[0-9]$/.test(event.key)) {
        if (typed.length < 6) typed += event.key;
        renderCells();
        return true;
      }
      if (event.key === 'Backspace') {
        typed = typed.slice(0, -1);
        renderCells();
        return true;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        if (typed) {
          const n = Number(typed);
          if (onBoard(board, n) || board.strip.includes(n)) pick(n);
          else {
            say(`${n} is not on this board.`);
            typed = '';
            renderCells();
          }
        } else {
          pick(level.first + cursor);
        }
        return true;
      }
      if (event.key === '?') {
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
      mode: 'sieve',
      answer: () => String(par.find((p) => !board.chosen.includes(p)) ?? ''),
    });
    cells[0]!.tabIndex = 0;
    renderCells();
    renderHud();
    app.setScene({ kind: 'quiet' });
    app.sounds.start();
    clock.start();

    return {
      element: root,
      layout: 'play',
      pauseItems: [
        {
          id: 'restart',
          label: 'Start this sieve again',
          run: () =>
            confirmLeave(app, 'Start this sieve again?', () => app.show(sieveScreen(options))),
        },
      ],
      onLayout: layout,
      onKey,
      onPause: () => clock.stop(),
      onResume: () => {
        if (!finished) clock.start();
      },
      focus: () => cells[cursor]?.focus(),
      destroy: () => {
        exposeHook(null);
        closed = true;
        window.clearInterval(ticker);
      },
    };
  };
}
