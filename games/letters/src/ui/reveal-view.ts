import { percent } from '../engine/score';
import type { BoardWord } from '../engine/solver';
import type { BoardView } from '../render/board-view';
import type { Palette } from '../render/palette';
import { h, svg } from './dom';
import { applyLook } from './look';

/**
 * The end of a round: the board lit with every word it held, as a web of strands, and beside it
 * the coverage ring filling to your share, the longest word still hidden, and every word, found
 * or not, ready to be traced on the grid by pointing at it (the 1988 game's Escape-locate).
 */

export interface RevealList {
  id: string;
  label: string;
  words: readonly BoardWord[];
}

export interface RevealSummary {
  heading: string;
  /** A line under the heading: who won a duel, how two players compared. */
  banner?: string;
  /** Share of the board for the ring, 0–1. */
  share: number;
  stats: readonly { label: string; value: string }[];
  longestHidden: BoardWord | null;
  /** Tabs of word lists; the first is shown first. */
  lists: readonly RevealList[];
  /** The legend's name for the bright strands of the web. */
  foundLabel: string;
  /** The legend's name for the dashed ghost strands, when a Duel's hunter drew some. */
  ghostLabel?: string;
}

export interface RevealActions {
  playAgain(): void;
  gameMenu(): void;
  hall(): void;
}

const RING = 2 * Math.PI * 52;

export class RevealView {
  readonly element: HTMLElement;
  /** Extras the screen adds under the ring: the XP line, the share button, a coach note. */
  readonly notes: HTMLElement;
  private readonly slot: HTMLElement;
  private readonly observer: ResizeObserver;
  private readonly fill: SVGCircleElement;
  private readonly tooltip: HTMLElement;
  private readonly listHost: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly words: Map<string, BoardWord>;
  private tab: string;

  constructor(
    readonly board: BoardView,
    palette: Palette,
    reducedMotion: boolean,
    private readonly summary: RevealSummary,
    actions: RevealActions,
  ) {
    this.tab = summary.lists[0]?.id ?? '';
    this.words = new Map(
      summary.lists.flatMap((list) => list.words.map((word) => [word.word, word] as const)),
    );
    if (summary.longestHidden) this.words.set(summary.longestHidden.word, summary.longestHidden);
    this.slot = h('div', { class: 'chl-reveal__board' });
    this.fill = svg('circle', {
      class: 'chl-cover__fill',
      cx: 60,
      cy: 60,
      r: 52,
      'stroke-dasharray': `0 ${RING}`,
    });
    this.tooltip = h(
      'div',
      { class: 'chl-source', role: 'tooltip', hidden: true },
      'SCOWL + ENABLE',
    );
    this.listHost = h('div', { class: 'chl-reveal__words', 'data-testid': 'chl-reveal-words' });
    this.notes = h('div', { class: 'chl-reveal__notes' });
    this.tabs = h(
      'div',
      { class: 'chl-tabs', role: 'tablist' },
      ...summary.lists.map((list) => this.tabButton(list)),
    );
    const longest = summary.longestHidden;
    this.element = h(
      'div',
      { class: 'chl-screen chl-reveal', 'data-testid': 'chl-reveal' },
      h(
        'div',
        { class: 'chl-reveal__grid' },
        h(
          'header',
          { class: 'chl-reveal__title' },
          h('h1', {}, summary.heading),
          h(
            'p',
            { class: 'chl-legend' },
            h('span', { class: 'chl-legend__found' }, summary.foundLabel),
            h('span', { class: 'chl-legend__hidden' }, 'Still hidden'),
            summary.ghostLabel
              ? h('span', { class: 'chl-legend__ghost' }, summary.ghostLabel)
              : null,
          ),
          summary.banner
            ? h('p', { class: 'chl-banner', 'data-testid': 'chl-banner' }, summary.banner)
            : null,
        ),
        this.slot,
        h(
          'aside',
          { class: 'chl-reveal__panel chl-card' },
          h(
            'div',
            { class: 'chl-reveal__cover' },
            h(
              'div',
              { class: 'chl-cover__dial chl-cover__dial--large' },
              svg(
                'svg',
                { class: 'chl-cover__ring', viewBox: '0 0 120 120', 'aria-hidden': 'true' },
                svg('circle', { class: 'chl-cover__track', cx: 60, cy: 60, r: 52 }),
                this.fill,
              ),
              h(
                'div',
                { class: 'chl-cover__face' },
                h(
                  'div',
                  { class: 'chl-cover__value', 'data-testid': 'chl-reveal-share' },
                  String(percent(summary.share)),
                  h('small', {}, '%'),
                ),
                h('div', { class: 'chl-cover__caption' }, 'of the board'),
              ),
            ),
            h(
              'dl',
              { class: 'chl-stats' },
              ...summary.stats.map((item) =>
                h('div', { class: 'chl-stat' }, h('dt', {}, item.label), h('dd', {}, item.value)),
              ),
            ),
          ),
          this.notes,
          longest
            ? h(
                'button',
                { class: 'chl-longest', type: 'button', 'data-word': longest.word },
                h('span', { class: 'chl-longest__label' }, 'Longest word still hidden'),
                h('span', { class: 'chl-longest__word' }, longest.word.toUpperCase()),
                h('span', { class: 'chl-longest__meta' }, `${longest.word.length} letters`),
              )
            : h(
                'p',
                { class: 'chl-longest chl-longest--none' },
                'Every word on this board was found.',
              ),
          this.tabs,
          this.listHost,
          h(
            'nav',
            { class: 'chl-actions', 'aria-label': 'What next' },
            h(
              'button',
              {
                class: 'chl-button chl-button--primary',
                type: 'button',
                'data-testid': 'chl-again',
                onclick: () => actions.playAgain(),
              },
              'Play again',
              h('kbd', {}, 'R'),
            ),
            h(
              'button',
              {
                class: 'chl-button',
                type: 'button',
                'data-testid': 'chl-menu',
                onclick: () => actions.gameMenu(),
              },
              'Game menu',
            ),
            h(
              'button',
              {
                class: 'chl-button',
                type: 'button',
                'data-testid': 'chl-hall',
                onclick: () => actions.hall(),
              },
              'Back to the Hall',
              h('kbd', {}, 'H'),
            ),
          ),
        ),
      ),
      this.tooltip,
    );
    applyLook(this.element, palette, reducedMotion);
    this.renderList();
    this.wireHover();
    this.observer = new ResizeObserver(() => this.placeBoard());
    this.observer.observe(this.slot);
    this.observer.observe(this.element);
    requestAnimationFrame(() => this.setShare(summary.share));
  }

  placeBoard() {
    const frame = this.element.getBoundingClientRect();
    const slot = this.slot.getBoundingClientRect();
    this.board.setBoardRect({
      x: slot.left - frame.left,
      y: slot.top - frame.top,
      width: slot.width,
      height: slot.height,
    });
  }

  setLook(palette: Palette, reducedMotion: boolean) {
    applyLook(this.element, palette, reducedMotion);
  }

  /** Traces a word on the grid and shows where it came from, as pointing at it does. */
  showWord(word: string | null) {
    const entry = word ? this.words.get(word) : undefined;
    this.board.setHover(entry?.path ?? null);
    const target = word ? this.element.querySelector<HTMLElement>(`[data-word="${word}"]`) : null;
    if (!entry || !target) {
      this.tooltip.hidden = true;
      return;
    }
    const frame = this.element.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    this.tooltip.hidden = false;
    this.tooltip.style.left = `${box.left - frame.left + box.width / 2}px`;
    this.tooltip.style.top = `${box.top - frame.top - 8}px`;
  }

  focus() {
    this.element
      .querySelector<HTMLElement>('[data-testid="chl-again"]')
      ?.focus({ preventScroll: true });
  }

  destroy() {
    this.observer.disconnect();
    this.board.setHover(null);
    this.element.remove();
  }

  private setShare(share: number) {
    this.fill.setAttribute('stroke-dasharray', `${(share * RING).toFixed(2)} ${RING.toFixed(2)}`);
    this.fill.style.visibility = share > 0 ? 'visible' : 'hidden';
  }

  private tabButton(list: RevealList): HTMLElement {
    const button = h(
      'button',
      {
        class: 'chl-tab',
        type: 'button',
        role: 'tab',
        'aria-selected': String(this.tab === list.id),
        'data-tab': list.id,
      },
      `${list.label} · ${list.words.length}`,
    );
    button.addEventListener('click', () => {
      this.tab = list.id;
      for (const other of this.tabs.children) {
        other.setAttribute('aria-selected', String(other === button));
      }
      this.renderList();
    });
    return button;
  }

  private renderList() {
    const list = this.summary.lists.find((entry) => entry.id === this.tab);
    const words = list?.words ?? [];
    const groups = new Map<number, BoardWord[]>();
    for (const word of words) {
      const group = groups.get(word.word.length) ?? [];
      group.push(word);
      groups.set(word.word.length, group);
    }
    const sections = [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([length, group]) =>
        h(
          'section',
          { class: 'chl-group' },
          h('h3', {}, `${length} letters`),
          h('ul', {}, ...group.map((entry) => h('li', {}, wordButton(entry)))),
        ),
      );
    this.listHost.replaceChildren(...sections);
    if (words.length === 0) {
      this.listHost.append(h('p', { class: 'chl-group__empty' }, 'No words here.'));
    }
  }

  private wireHover() {
    const pick = (event: Event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-word]');
      this.showWord(target?.dataset.word ?? null);
    };
    this.element.addEventListener('pointerover', pick);
    this.element.addEventListener('focusin', pick);
    this.element.addEventListener('pointerleave', () => this.showWord(null));
  }
}

function wordButton(entry: BoardWord): HTMLElement {
  return h(
    'button',
    { class: 'chl-word', type: 'button', 'data-word': entry.word, 'data-tier': entry.tier },
    entry.word.toUpperCase(),
    entry.tier >= 2
      ? h(
          'span',
          { class: 'chl-word__stamp', 'aria-label': entry.tier === 3 ? 'very rare' : 'rare' },
          '★',
        )
      : null,
  );
}
