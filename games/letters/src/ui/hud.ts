import type { Tier } from '../dictionary/tiers';
import { COMBO_WINDOW_SECONDS, multiplierFor, percent } from '../engine/score';
import { h, svg, text } from './dom';

/**
 * The play screen's instruments, each a small element with an `update`. They read state and
 * never change it.
 */

const RING = 2 * Math.PI * 52;

function ring(className: string): {
  element: SVGSVGElement;
  fill: SVGCircleElement;
  tick: SVGLineElement;
} {
  const fill = svg('circle', {
    class: `${className}__fill`,
    cx: 60,
    cy: 60,
    r: 52,
    'stroke-dasharray': `0 ${RING}`,
  });
  const tick = svg('line', { class: `${className}__tick`, x1: 60, y1: 2, x2: 60, y2: 18 });
  const element = svg(
    'svg',
    { class: `${className}__ring`, viewBox: '0 0 120 120', 'aria-hidden': 'true' },
    svg('circle', { class: `${className}__track`, cx: 60, cy: 60, r: 52 }),
    fill,
    tick,
  );
  return { element, fill, tick };
}

function setArc(fill: SVGCircleElement, share: number) {
  const length = Math.max(0, Math.min(1, share)) * RING;
  fill.setAttribute('stroke-dasharray', `${length.toFixed(2)} ${RING.toFixed(2)}`);
  // A round cap on an empty arc would still draw a dot.
  fill.style.visibility = length > 0 ? 'visible' : 'hidden';
}

export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export interface ClockPanel {
  element: HTMLElement;
  update(left: number | null, total: number | null, elapsed: number): void;
}

export function clockPanel(): ClockPanel {
  const { element: dial, fill } = ring('chl-clock');
  const digits = h('div', { class: 'chl-clock__digits' });
  const label = h('div', { class: 'chl-clock__label' });
  const element = h(
    'section',
    { class: 'chl-clock chl-card', 'aria-label': 'Clock' },
    dial,
    h('div', { class: 'chl-clock__face' }, digits, label),
  );
  return {
    element,
    update(left, total, elapsed) {
      if (left === null || total === null) {
        text(digits, formatClock(elapsed));
        text(label, 'untimed');
        setArc(fill, 1);
        element.dataset.low = 'false';
        return;
      }
      text(digits, formatClock(left));
      text(label, 'left');
      setArc(fill, left / total);
      element.dataset.low = String(left <= 20);
    },
  };
}

export interface ScorePanel {
  element: HTMLElement;
  update(score: number, comboLevel: number, comboLeft: number): void;
}

export function scorePanel(): ScorePanel {
  const value = h('div', { class: 'chl-score__value' });
  const multiplier = h('span', { class: 'chl-combo__multiplier' });
  const bar = h('i', { class: 'chl-combo__drain' });
  const combo = h(
    'div',
    { class: 'chl-combo' },
    multiplier,
    h('span', { class: 'chl-combo__label' }, 'chain'),
    h('span', { class: 'chl-combo__bar', 'aria-hidden': 'true' }, bar),
  );
  const element = h(
    'section',
    { class: 'chl-score chl-card', 'aria-label': 'Score' },
    h('div', { class: 'chl-card__label' }, 'Score'),
    value,
    combo,
  );
  return {
    element,
    update(score, level, left) {
      text(value, String(score));
      const active = level > 0 && left > 0;
      combo.dataset.level = String(active ? level : 0);
      text(multiplier, `×${active ? multiplierFor(level) : 1}`);
      bar.style.transform = `scaleX(${active ? left / COMBO_WINDOW_SECONDS : 0})`;
    },
  };
}

export interface CoverageCard {
  element: HTMLElement;
  update(found: number, total: number, average: number | null): void;
}

export function coverageCard(): CoverageCard {
  const { element: dial, fill, tick } = ring('chl-cover');
  const value = h('div', { class: 'chl-cover__value' });
  const counts = h('div', { class: 'chl-cover__counts' });
  const average = h('div', { class: 'chl-cover__average' });
  const element = h(
    'section',
    { class: 'chl-cover chl-card', 'aria-label': 'Share of the board found' },
    h(
      'div',
      { class: 'chl-cover__dial' },
      dial,
      h(
        'div',
        { class: 'chl-cover__face' },
        value,
        h('div', { class: 'chl-cover__caption' }, 'of the board'),
      ),
    ),
    h('div', { class: 'chl-cover__text' }, counts, average),
  );
  return {
    element,
    update(found, total, lifetime) {
      const share = total === 0 ? 0 : found / total;
      value.replaceChildren(String(percent(share)), h('small', {}, '%'));
      text(counts, `${found} of ${total} words`);
      setArc(fill, share);
      if (lifetime === null) {
        text(average, 'First board: no average yet');
        tick.style.display = 'none';
      } else {
        text(average, `Your average ${percent(lifetime)}%`);
        tick.style.display = '';
        tick.setAttribute('transform', `rotate(${(lifetime * 360).toFixed(1)} 60 60)`);
      }
    },
  };
}

export interface WallEntry {
  word: string;
  points: number;
  tier: Tier;
}

export interface WordWall {
  element: HTMLElement;
  list: HTMLOListElement;
  /** Adds a tag at the head of the wall; returns it, for the flight in. */
  add(entry: WallEntry): HTMLElement;
  set(entries: readonly WallEntry[]): void;
}

export function wordTag(entry: WallEntry): HTMLElement {
  const tilt = ((entry.word.charCodeAt(0) * 7 + entry.word.length * 13) % 9) - 4;
  return h(
    'li',
    {
      class: 'chl-tag',
      'data-length': entry.word.length >= 7 ? 'long' : 'short',
      'data-tier': entry.tier,
      style: `--tilt:${tilt * 0.45}deg`,
    },
    h('span', { class: 'chl-tag__word' }, entry.word.toUpperCase()),
    h('span', { class: 'chl-tag__points' }, `+${entry.points}`),
    entry.tier >= 2
      ? h(
          'span',
          { class: 'chl-tag__stamp', title: entry.tier === 3 ? 'Very rare word' : 'Rare word' },
          '★',
        )
      : null,
  );
}

export function wordWall(): WordWall {
  const list = h('ol', { class: 'chl-wall__list', reversed: true });
  const count = h('span', { class: 'chl-wall__count' });
  const element = h(
    'section',
    { class: 'chl-wall chl-card', 'aria-label': 'Words found' },
    h('h2', { class: 'chl-card__label' }, 'Word wall ', count),
    list,
  );
  const refreshCount = () => text(count, String(list.children.length));
  return {
    element,
    list,
    add(entry) {
      const tag = wordTag(entry);
      list.prepend(tag);
      refreshCount();
      return tag;
    },
    set(entries) {
      list.replaceChildren(...[...entries].reverse().map(wordTag));
      refreshCount();
    },
  };
}

export interface BestCard {
  element: HTMLElement;
  update(longest: string | null, rare: number, veryRare: number): void;
}

/** The round's best so far: its longest word and its rare finds (shown where there is room). */
export function bestCard(): BestCard {
  const word = h('div', { class: 'chl-best__word' });
  const rare = h('div', { class: 'chl-best__rare' });
  const element = h(
    'section',
    { class: 'chl-best chl-card', 'aria-label': 'Best so far' },
    h('h2', { class: 'chl-card__label' }, 'Longest so far'),
    word,
    rare,
  );
  const card: BestCard = {
    element,
    update(longest, rareCount, veryRareCount) {
      text(word, longest ? longest.toUpperCase() : '—');
      word.dataset.length = String(longest?.length ?? 0);
      const finds = rareCount + veryRareCount;
      rare.replaceChildren(
        h('span', { class: 'chl-best__stamp', 'aria-hidden': 'true' }, '★'),
        finds === 0
          ? 'No rare finds yet'
          : `${finds} rare ${finds === 1 ? 'find' : 'finds'}${veryRareCount ? `, ${veryRareCount} very rare` : ''}`,
      );
    },
  };
  card.update(null, 0, 0);
  return card;
}

export interface CurrentWord {
  element: HTMLElement;
  update(letters: string, points: number | null, typed: boolean): void;
}

export function currentWord(): CurrentWord {
  const chips = h('div', { class: 'chl-current__chips' });
  const points = h('span', { class: 'chl-current__points' });
  const element = h(
    'div',
    { class: 'chl-current', role: 'status', 'aria-live': 'polite' },
    chips,
    points,
  );
  return {
    element,
    update(letters, value, typed) {
      element.dataset.empty = String(letters.length === 0);
      element.dataset.typed = String(typed);
      const faces = letters.toUpperCase().replace(/QU/g, 'Q').split('');
      chips.replaceChildren(
        ...faces.map((face, index) =>
          h('span', { class: 'chl-chip', style: `--i:${index}` }, face === 'Q' ? 'Qu' : face),
        ),
      );
      text(points, value === null || letters.length === 0 ? '' : `+${value}`);
    },
  };
}

export function hintLine(): HTMLElement {
  return h(
    'p',
    { class: 'chl-hint' },
    h('span', {}, 'Drag across touching cubes, or type'),
    h('kbd', {}, 'Enter'),
    h('span', {}, 'claims a word'),
    h('kbd', {}, 'Backspace'),
    h('span', {}, 'steps back'),
  );
}

export function brandBar(): HTMLElement {
  return h(
    'header',
    { class: 'chl-brand' },
    h('span', { class: 'chl-brand__mark', 'aria-hidden': 'true' }),
    h('span', { class: 'chl-brand__name' }, 'Chain Letter'),
  );
}

export interface RuleCard {
  element: HTMLElement;
  update(mode: string, rule: string): void;
}

/** The mode and the rule in force, so a twist like Echo is never a surprise mid-word. */
export function ruleCard(): RuleCard {
  const mode = h('h2', { class: 'chl-card__label' });
  const rule = h('p', { class: 'chl-rule__text' });
  const element = h(
    'section',
    { class: 'chl-rule chl-card', 'aria-label': 'Mode and rules' },
    mode,
    rule,
  );
  return {
    element,
    update(modeLabel, ruleText) {
      text(mode, modeLabel);
      text(rule, ruleText);
    },
  };
}
