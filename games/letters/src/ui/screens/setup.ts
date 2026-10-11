import type { GridSize, Rule } from '../../engine/grid';
import { GRID_SIZES, RULES } from '../../engine/grid';
import { HUNTERS, type Strength, STRENGTHS } from '../../engine/hunter';
import {
  CLOCK_SECONDS,
  GRID_NAMES,
  MIN_LETTER_CHOICES,
  type ModeId,
  type RoundPlan,
  RULE_CARDS,
} from '../../game/modes';
import { sizeUnlocked, UNLOCK_LEVEL } from '../../game/records';
import type { App, Screen } from '../app';
import { h, svg } from '../dom';
import { applyLook } from '../look';

/**
 * Choosing the board before a round: the grid (larger ones open with your board-reading level),
 * the rule card (Classic, or the 1988 program's Echo and Mirror switches), the shortest word, and
 * for a Duel the hunter, for Pass and play the two names.
 */
type SetupMode = Exclude<ModeId, 'tutorial' | 'daily'>;

const MODE_TEXT: Record<SetupMode, { title: string; line: string; start: string }> = {
  classic: {
    title: 'Choose your board',
    line: 'A timed round on the grid and rule you pick.',
    start: 'Shake the cubes',
  },
  zen: {
    title: 'Zen',
    line: 'No clock. Find words at your own pace and stop when you like.',
    start: 'Shake the cubes',
  },
  duel: {
    title: 'Duel',
    line: 'An AI word-hunter plays the same board at the same time. Most points wins.',
    start: 'Start the duel',
  },
  pass: {
    title: 'Pass and play',
    line: 'Each player gets the same board for one turn; the other looks away.',
    start: 'Start the first turn',
  },
};

export function setupScreen(mode: SetupMode) {
  return (app: App): Screen => {
    const prefs = app.saves.loadPrefs();
    const records = app.records();
    let size: GridSize = sizeUnlocked(records, prefs.size) ? prefs.size : 4;
    let rule: Rule = prefs.rule;
    let minLetters = mode === 'classic' || mode === 'zen' ? prefs.minLetters : 3;
    let strength: Strength = prefs.strength;
    const names: [string, string] = [...prefs.players];
    const text = MODE_TEXT[mode];

    const group = (label: string, ...children: HTMLElement[]) =>
      h(
        'fieldset',
        { class: 'chl-choice' },
        h('legend', {}, label),
        h('div', { class: 'chl-choice__options' }, ...children),
      );

    const option = (
      name: string,
      value: string,
      checked: boolean,
      label: Node[],
      disabled = false,
      onPick: () => void = () => undefined,
    ) => {
      const input = h('input', {
        type: 'radio',
        name,
        value,
        checked,
        disabled,
        'data-testid': `chl-pick-${name}-${value}`,
      });
      input.addEventListener('change', () => {
        app.sounds.tap();
        onPick();
      });
      return h(
        'label',
        { class: 'chl-option', 'data-disabled': String(disabled) },
        input,
        h('span', { class: 'chl-option__body' }, ...label),
      );
    };

    const sizes = group(
      'Grid',
      ...GRID_SIZES.map((value) => {
        const open = sizeUnlocked(records, value);
        const note = open
          ? `${value * value} cubes · ${CLOCK_SECONDS[value] / 60} minutes`
          : `Opens at a board-reading level of ${UNLOCK_LEVEL[value] * 100}%`;
        return option(
          'size',
          String(value),
          value === size,
          [
            h('strong', {}, `${GRID_NAMES[value]}${value === 4 ? '' : ` ${value}×${value}`}`),
            h('small', {}, note),
          ],
          !open,
          () => (size = value),
        );
      }),
    );
    const rules = group(
      'Rule card',
      ...RULES.map((value) =>
        option(
          'rule',
          value,
          value === rule,
          [
            ruleDiagram(value),
            h('strong', {}, RULE_CARDS[value].name),
            h('small', {}, RULE_CARDS[value].text),
          ],
          false,
          () => (rule = value),
        ),
      ),
    );
    const lengths = group(
      'Shortest word',
      ...MIN_LETTER_CHOICES.map((value) =>
        option(
          'min',
          String(value),
          value === minLetters,
          [
            h('strong', {}, `${value} letters`),
            h('small', {}, value === 3 ? 'As in 1988' : 'Fewer, longer words'),
          ],
          false,
          () => (minLetters = value),
        ),
      ),
    );
    const hunters = group(
      'Hunter',
      ...STRENGTHS.map((value) => {
        const duel = records.duels[String(value)];
        const tally = duel ? ` · won ${duel.won} of ${duel.played}` : '';
        return option(
          'strength',
          String(value),
          value === strength,
          [
            h('strong', {}, `${value} · ${HUNTERS[value].name}`),
            h('small', {}, `${HUNTERS[value].blurb}${tally}`),
          ],
          false,
          () => (strength = value),
        );
      }),
    );
    const nameInputs = names.map((name, index) => {
      const input = h('input', {
        type: 'text',
        value: name,
        maxlength: 16,
        'aria-label': `Player ${index + 1}`,
        'data-testid': `chl-name-${index}`,
      });
      input.addEventListener(
        'input',
        () => (names[index] = input.value.trim() || `Player ${index + 1}`),
      );
      return h('label', { class: 'chl-name' }, h('span', {}, `Player ${index + 1}`), input);
    });
    const players = h(
      'fieldset',
      { class: 'chl-choice' },
      h('legend', {}, 'Players'),
      h('div', { class: 'chl-choice__names' }, ...nameInputs),
    );

    const start = () => {
      app.saves.prefs.save({
        size,
        rule,
        minLetters: mode === 'classic' || mode === 'zen' ? minLetters : prefs.minLetters,
        strength,
        players: [...names],
      });
      const plan: RoundPlan = {
        mode,
        size,
        rule,
        minLetters,
        seconds: mode === 'zen' ? null : CLOCK_SECONDS[size],
        seed: `${mode}#${Math.floor(Math.random() * 1e9)}`,
        ...(mode === 'duel' ? { strength } : {}),
        ...(mode === 'pass' ? { players: [names[0], names[1]] as const } : {}),
      };
      app.go.play(plan);
    };
    const startButton = h(
      'button',
      {
        class: 'chl-button chl-button--primary',
        type: 'button',
        'data-testid': 'chl-start',
        onclick: start,
      },
      text.start,
    );
    const element = h(
      'div',
      { class: 'chl-screen chl-page chl-setup', 'data-testid': 'chl-setup' },
      h(
        'div',
        { class: 'chl-page__card chl-card' },
        h('header', { class: 'chl-page__head' }, h('h1', {}, text.title), h('p', {}, text.line)),
        h(
          'div',
          { class: 'chl-setup__groups' },
          sizes,
          rules,
          mode === 'classic' || mode === 'zen' ? lengths : null,
          mode === 'duel' ? hunters : null,
          mode === 'pass' ? players : null,
        ),
        h(
          'nav',
          { class: 'chl-actions' },
          startButton,
          h(
            'button',
            {
              class: 'chl-button',
              type: 'button',
              'data-testid': 'chl-back',
              onclick: () => app.go.title(),
            },
            'Game menu',
          ),
        ),
      ),
    );
    applyLook(element, app.palette, app.reducedMotion);
    app.board.settle();
    app.board.setTrace([]);
    return {
      element,
      onLook: (palette, reducedMotion) => applyLook(element, palette, reducedMotion),
      focus: () =>
        element.querySelector<HTMLInputElement>('input:checked')?.focus({ preventScroll: true }),
      onKey: (event) => {
        if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') {
          start();
          return true;
        }
        return false;
      },
    };
  };
}

/** A small picture of each rule: three cubes and the path a word may take over them. */
function ruleDiagram(rule: Rule): SVGSVGElement {
  const cube = (x: number) =>
    svg('rect', { x, y: 8, width: 22, height: 22, rx: 5, class: 'chl-diagram__cube' });
  const paths: Record<Rule, string> = {
    classic: 'M15 19 H45 M45 19 H75',
    echo: 'M15 19 H45 M45 19 C50 2, 70 2, 75 19 M75 19 C70 36, 50 36, 45 19',
    mirror: 'M15 19 H45 M45 19 C35 -4, 58 -4, 48 14',
  };
  return svg(
    'svg',
    { class: 'chl-diagram', viewBox: '0 0 90 38', 'aria-hidden': 'true' },
    cube(4),
    cube(34),
    cube(64),
    svg('path', { d: paths[rule], class: 'chl-diagram__path' }),
  );
}
