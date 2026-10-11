import { createRng } from '@usr-games/kit';
import { eventCount, eventPar, spellLevel, spellPoints } from '../../engine/events';
import { type SpellItem, spellItems } from '../../engine/levels';
import {
  groupDigits,
  parseNumeral,
  sameNumeral,
  saysNumeral,
  spell,
  spellNumeral,
  TILE_WORDS,
  wordTokens,
} from '../../engine/words';
import type { App, Screen, ScreenFactory } from '../app';
import { clockText, EventClock } from '../clock';
import { h } from '../dom';
import { type EventScreenOptions, rungKey } from '../flow';
import { TOAST_WIDTH } from '../../render/layout';
import { fitBoardText, hud, numberKeys, place, placeTop, type PipState } from '../hud';
import { exposeHook } from '../hook';
import { confirmLeave, eventLabel, feedbackLine, playRoot, shake } from './play';

/**
 * Spell It, after `number`: a numeral to put into words, from word tiles or by typing, then words
 * to write back as a numeral, in turn. Spacing, hyphens and capitals never matter, and a British
 * "and" after the hundreds is fine in a whole number.
 */
const NEXT_MS = 900;
const TENS = new Set([
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
]);
const UNITS = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']);
const FRACTION_WORDS = new Set([
  'tenth',
  'tenths',
  'hundredth',
  'hundredths',
  'thousandth',
  'thousandths',
]);

/** Adds a tile's word to the answer, joining a tens word and a units word with a hyphen. */
export function addWord(answer: string, word: string): string {
  const trimmed = answer.trimEnd();
  if (trimmed === '') return word;
  const last = trimmed.split(/[\s-]+/).pop() ?? '';
  return TENS.has(last) && UNITS.has(word) ? `${trimmed}-${word}` : `${trimmed} ${word}`;
}

/** Takes the last word (or the last half of a hyphenated pair) off the answer. */
export function dropWord(answer: string): string {
  return answer.trimEnd().replace(/[\s-]*[^\s-]+$/, '');
}

export function spellScreen(options: EventScreenOptions): ScreenFactory {
  return (app: App): Screen => {
    const { plan, spec } = options;
    const level = spellLevel(spec.level);
    const items: SpellItem[] = spellItems(
      { ...level, count: eventCount(spec) },
      createRng(options.seed),
    );
    const parPerItem = eventPar(spec) / items.length;
    const fractions = level.decimals !== undefined;
    const rush = plan.tempo === 'rush';
    const clock = new EventClock();
    let index = 0;
    let typed = '';
    let misses = 0;
    let hints = 0;
    let score = 0;
    let clean = 0;
    let wrongs = 0;
    let itemStartedAt = 0;
    let between = false;
    let closed = false;
    const results: { numeral: string; misses: number }[] = [];
    const pipStates: PipState[] = items.map((_, i) => (i === 0 ? 'now' : 'todo'));

    const hudSlot = h('div', { class: 'ns-slot' });
    const boardSlot = h('div', { class: 'ns-slot', 'data-testid': 'ns-board' });
    const answer = h('div', {
      class: 'ns-answer',
      role: 'textbox',
      'aria-label': 'Your answer',
      'aria-live': 'polite',
      'data-testid': 'ns-answer',
    });
    const feedback = feedbackLine();
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
    const words = TILE_WORDS.filter(
      (word) => word !== 'minus' && (fractions ? word !== 'million' : !FRACTION_WORDS.has(word)),
    );
    const tray = h(
      'div',
      { class: 'ns-tray', role: 'group', 'aria-label': 'Word tiles' },
      ...words.map((word) =>
        h('button', { class: 'ns-tile', type: 'button', onclick: () => tile(word) }, word),
      ),
      h(
        'button',
        { class: 'ns-tile ns-tile--wide', type: 'button', onclick: () => edit('Delete') },
        '⌫ word',
      ),
      h(
        'button',
        { class: 'ns-tile ns-tile--go', type: 'button', onclick: () => edit('Enter') },
        'Enter',
      ),
    );
    const digits = numberKeys((key) => edit(key), fractions ? '.' : null);
    const root = playRoot(
      'ns-spell',
      hudSlot,
      boardSlot,
      answer,
      feedback,
      hintButton,
      tray,
      digits,
    );

    const item = () => items[index]!;

    function renderHud() {
      hudSlot.replaceChildren(
        hud({
          mode: 'Spell It',
          level: level.name,
          count: `Number ${Math.min(index + 1, items.length)} of ${items.length}`,
          pips: pipStates,
          clock: rush ? clockText(clock.elapsed()) : null,
          streak: null,
        }),
      );
    }

    function renderBoard() {
      const current = item();
      const spelling = current.direction === 'spell';
      boardSlot.replaceChildren(
        h(
          'div',
          { class: 'ns-board' },
          h(
            'div',
            { class: 'ns-board__top' },
            eventLabel(plan, options.index, spelling ? 'Say it in words' : 'Write it in digits'),
          ),
          spelling
            ? h('div', { class: 'ns-board__problem' }, groupDigits(current.numeral))
            : h(
                'div',
                { class: 'ns-board__words', 'aria-label': spell(current.numeral) },
                ...spellNumeral(parseNumeral(current.numeral)!).lines.map((line) =>
                  h('span', {}, line.replace(/\.$/, '')),
                ),
              ),
        ),
      );
      const whole = Number(parseNumeral(current.numeral)!.whole || 0);
      app.setScene(spelling ? { kind: 'quiet' } : { kind: 'number', value: whole });
      tray.hidden = !spelling;
      digits.hidden = spelling;
      renderAnswer();
      layout();
    }

    function renderAnswer() {
      answer.replaceChildren(
        typed
          ? h('span', {}, typed)
          : h(
              'span',
              { class: 'ns-answer__placeholder' },
              item().direction === 'spell' ? 'Type the words, or use the tiles' : 'Type the number',
            ),
        h('span', { class: 'ns-board__caret' }),
      );
    }

    function layout() {
      const l = app.layout;
      place(hudSlot, { ...l.hud, h: l.hud.h + 30 * l.s });
      place(boardSlot, l.board);
      placeTop(answer, { x: l.board.x, y: l.board.y + l.board.h + 26 * l.s, w: l.board.w });
      placeTop(feedback, { x: l.board.x, y: l.board.y + l.board.h + 112 * l.s, w: l.board.w });
      const trayTop = l.board.y + l.board.h + 160 * l.s;
      // Clear of the Hall's toasts in the bottom-left corner.
      const trayLeft = Math.max(l.width / 2 - 560 * l.s, TOAST_WIDTH + 24);
      const trayRight = Math.min(l.width / 2 + 560 * l.s, l.width - 40 * l.s);
      placeTop(tray, { x: trayLeft, y: trayTop, w: trayRight - trayLeft });
      place(digits, l.keys);
      placeTop(hintButton, { x: l.side.x, y: l.side.y, w: 150 * l.s });
      for (const board of boardSlot.querySelectorAll<HTMLElement>('.ns-board')) fitBoardText(board);
    }

    function say(text: string) {
      feedback.textContent = text;
    }

    function tile(word: string) {
      if (between || item().direction !== 'spell') return;
      clock.start();
      typed = addWord(typed, word);
      app.sounds.tap();
      renderAnswer();
    }

    function edit(key: string): boolean {
      if (between || app.isPaused || closed) return false;
      const spelling = item().direction === 'spell';
      if (key === 'Enter') {
        submit();
        return true;
      }
      if (key === 'Backspace') {
        typed = typed.slice(0, -1);
      } else if (key === 'Delete') {
        typed = dropWord(typed);
      } else if (key === '?') {
        giveHint();
        return true;
      } else if (spelling && /^[a-zA-Z -]$/.test(key)) {
        if (typed.length >= 160 || (key === ' ' && (typed === '' || typed.endsWith(' '))))
          return true;
        typed += key.toLowerCase();
      } else if (!spelling && /^[0-9.,]$/.test(key)) {
        if (typed.length >= 14) return true;
        typed += key;
      } else {
        return false;
      }
      clock.start();
      app.sounds.tap();
      renderAnswer();
      return true;
    }

    function giveHint() {
      if (between) return;
      hints++;
      app.sounds.hint();
      const current = item();
      if (current.direction === 'spell') {
        const first = wordTokens(spell(current.numeral)).slice(0, 2).join(' ');
        say(`It starts with "${first}". Read it in groups of three digits from the right.`);
      } else {
        const numeral = parseNumeral(current.numeral)!;
        say(
          numeral.fraction
            ? `${numeral.whole.length} digit${numeral.whole.length === 1 ? '' : 's'} before the point, ${numeral.fraction.length} after it.`
            : `It has ${numeral.whole.length} digits.`,
        );
      }
    }

    function submit() {
      if (typed.trim() === '') {
        say(
          item().direction === 'spell'
            ? 'Type the words first, then Enter.'
            : 'Type the number first, then Enter.',
        );
        return;
      }
      const current = item();
      const right =
        current.direction === 'spell'
          ? saysNumeral(typed, current.numeral)
          : sameNumeral(typed, current.numeral);
      if (!right) {
        misses++;
        wrongs++;
        app.cue({ kind: 'wrong' });
        app.sounds.wrong();
        shake(answer);
        say('Not quite. Have another go.');
        return;
      }
      clock.stop();
      between = true;
      const ms = clock.elapsed() - itemStartedAt;
      score += spellPoints(misses, ms, parPerItem, plan.tempo);
      if (misses === 0) clean++;
      results.push({ numeral: current.numeral, misses });
      pipStates[index] = misses === 0 ? 'clean' : 'done';
      app.cue({
        kind: 'correct',
        answer: Number(parseNumeral(current.numeral)!.whole || 0),
        streak: clean,
      });
      app.sounds.right(clean);
      say(
        current.direction === 'spell'
          ? `Right: ${spell(current.numeral)}.`
          : `Right: ${groupDigits(current.numeral)}.`,
      );
      answer.classList.add('ns-answer--right');
      renderHud();
      window.setTimeout(next, NEXT_MS);
    }

    function next() {
      if (closed) return;
      answer.classList.remove('ns-answer--right');
      index++;
      if (index >= items.length) {
        const ms = clock.elapsed();
        app.cue({ kind: 'finish', personalBest: false });
        app.sounds.finish(false);
        options.onDone({
          result: {
            spec,
            tempo: plan.tempo,
            score,
            items: items.length,
            clean,
            rights: items.length,
            wrongs,
            hints,
            ms,
          },
          detail: { mode: 'spell', items: results },
          rungKey: rungKey(spec),
          primes: [],
        });
        return;
      }
      between = false;
      typed = '';
      misses = 0;
      pipStates[index] = 'now';
      itemStartedAt = clock.elapsed();
      clock.start();
      say('');
      renderHud();
      renderBoard();
    }

    const ticker = window.setInterval(() => {
      if (!rush || !clock.running) return;
      const text = hudSlot.querySelector('.ns-clock');
      if (text) text.textContent = clockText(clock.elapsed());
    }, 100);

    exposeHook({
      mode: 'spell',
      answer: () => {
        if (between || index >= items.length) return '';
        return item().direction === 'spell' ? spell(item().numeral) : item().numeral;
      },
    });
    renderHud();
    renderBoard();
    app.sounds.start();
    clock.start();

    return {
      element: root,
      layout: 'play',
      pauseItems: [
        {
          id: 'restart',
          label: 'Start these numbers again',
          run: () =>
            confirmLeave(app, 'Start these numbers again?', () => app.show(spellScreen(options))),
        },
      ],
      onLayout: layout,
      onKey: (event) => edit(event.key),
      onPause: () => clock.stop(),
      onResume: () => {
        if (!between) clock.start();
      },
      destroy: () => {
        exposeHook(null);
        closed = true;
        window.clearInterval(ticker);
      },
    };
  };
}
