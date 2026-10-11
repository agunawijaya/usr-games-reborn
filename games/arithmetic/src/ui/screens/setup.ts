import type { EventSpec } from '../../engine/events';
import { MODE_NAMES, sieveLevel } from '../../engine/events';
import {
  type ModeId,
  SIEVE_LEVELS,
  SPELL_LEVELS,
  SPLIT_LEVELS,
  SUMS_LEVELS,
} from '../../engine/levels';
import { clampRange, SIGN, type Tempo } from '../../engine/sums';
import type { App, Screen, ScreenFactory } from '../app';
import { clockText } from '../clock';
import { h } from '../dom';
import { rungKey } from '../flow';
import { icon } from '../icons';
import { eventDetail } from './intro';
import { choiceRow, page } from './page';

/**
 * Free play: any mode, any rung, Rush or Calm. Quick Sums also has "your own", the original's
 * options: which signs to ask (a sign asked more often counts more) and how far the numbers go.
 */

const MODES: readonly ModeId[] = ['sums', 'split', 'sieve', 'spell'];

function rungsFor(mode: ModeId): { id: string; name: string }[] {
  switch (mode) {
    case 'sums':
      return [
        ...SUMS_LEVELS.map((l) => ({ id: l.id, name: l.name })),
        { id: 'custom', name: 'Your own' },
      ];
    case 'split':
      return SPLIT_LEVELS.map((l) => ({ id: l.id, name: l.name }));
    case 'sieve':
      return SIEVE_LEVELS.map((l) => ({
        id: l.id,
        name: `${l.name} (${l.first.toLocaleString('en-US')} to ${l.last.toLocaleString('en-US')})`,
      }));
    case 'spell':
      return SPELL_LEVELS.map((l) => ({ id: l.id, name: l.name }));
  }
}

export function setupScreen(initial: ModeId = 'sums'): ScreenFactory {
  return (app: App): Screen => {
    let mode = initial;
    let tempo: Tempo = app.saves.prefs.load().tempo;
    const content = h('div', { class: 'ns-setup' });
    const start = h(
      'button',
      {
        class: 'ns-button ns-button--primary ns-start',
        type: 'button',
        onclick: () => begin(),
        'data-testid': 'ns-setup-start',
      },
      'Start',
      h('small', {}, 'Enter'),
    );

    const selected = () => app.saves.prefs.load().rungs[mode] ?? rungsFor(mode)[0]!.id;

    function bestText(spec: EventSpec): string {
      const records = app.saves.records.load();
      const custom = app.saves.prefs.load().custom;
      const key = rungKey(spec, custom);
      const best = records[spec.mode][key];
      if (!best) return '';
      return best.ms !== null
        ? `Best ${clockText(best.ms)}`
        : `Best ${best.score.toLocaleString('en-US')}`;
    }

    /** Re-renders, keeping the keyboard focus on the same control. */
    function render() {
      const focused = (document.activeElement as HTMLElement | null)?.dataset;
      const restore = focused?.testid ?? (focused?.value ? `value:${focused.value}` : null);
      draw();
      if (!restore) return;
      const selector = restore.startsWith('value:')
        ? `[data-value="${restore.slice(6)}"]`
        : `[data-testid="${restore}"]`;
      content.querySelector<HTMLElement>(selector)?.focus();
    }

    function draw() {
      const prefs = app.saves.prefs.load();
      const tabs = h(
        'div',
        { class: 'ns-tabs', role: 'tablist', 'aria-label': 'Mode' },
        ...MODES.map((m) =>
          h(
            'button',
            {
              class: 'ns-tab',
              type: 'button',
              role: 'tab',
              'aria-selected': String(m === mode),
              'data-testid': `ns-tab-${m}`,
              onclick: () => {
                mode = m;
                render();
              },
            },
            icon(m, 'ns-mode__icon'),
            MODE_NAMES[m],
          ),
        ),
      );
      const rungs = h(
        'div',
        { class: 'ns-rungs', role: 'radiogroup', 'aria-label': 'Rung' },
        ...rungsFor(mode).map((rung) => {
          const spec = { mode, level: rung.id } as EventSpec;
          return h(
            'button',
            {
              class: 'ns-rung',
              type: 'button',
              role: 'radio',
              'aria-checked': String(rung.id === selected()),
              'data-testid': `ns-rung-${rung.id}`,
              onclick: () => {
                app.saves.prefs.update((p) => ({ ...p, rungs: { ...p.rungs, [mode]: rung.id } }));
                render();
              },
            },
            h('span', { class: 'ns-rung__name' }, rung.name),
            h(
              'span',
              { class: 'ns-muted' },
              rung.id === 'custom' ? describeCustom(prefs.custom) : bestText(spec),
            ),
          );
        }),
      );
      const custom = mode === 'sums' && selected() === 'custom' ? customPanel() : null;
      const spec = { mode, level: selected() } as EventSpec;
      content.replaceChildren(
        tabs,
        rungs,
        custom ?? h('span'),
        choiceRow(
          'Tempo',
          [
            { value: 'rush', text: 'Rush', note: 'Against the clock' },
            { value: 'calm', text: 'Calm', note: 'No clock' },
          ],
          tempo,
          (value) => {
            tempo = value;
            app.saves.prefs.update((p) => ({ ...p, tempo: value }));
            render();
          },
        ),
        h(
          'div',
          { class: 'ns-setup__go' },
          h('p', { class: 'ns-muted' }, eventDetail(spec, { tempo })),
          start,
        ),
      );
    }

    function customPanel(): HTMLElement {
      const prefs = app.saves.prefs.load();
      const counts = (sign: string) => [...prefs.custom.ops].filter((s) => s === sign).length;
      const setCount = (sign: string, count: number) => {
        const others = [...prefs.custom.ops].filter((s) => s !== sign).join('');
        const ops = others + sign.repeat(Math.max(0, Math.min(3, count)));
        if (ops.length === 0) return;
        app.saves.prefs.update((p) => ({ ...p, custom: { ...p.custom, ops } }));
        render();
      };
      const setRange = (range: number) => {
        app.saves.prefs.update((p) => ({
          ...p,
          custom: { ...p.custom, range: clampRange(range) },
        }));
        render();
      };
      return h(
        'div',
        { class: 'ns-custom', 'aria-label': 'Your own sums' },
        h('span', { class: 'ns-label' }, 'Signs, and how often'),
        h(
          'div',
          { class: 'ns-custom__row' },
          ...['+', '-', 'x', '/'].map((sign) =>
            h(
              'div',
              {
                class: 'ns-stepper',
                role: 'group',
                'aria-label': `How often ${SIGN[sign as keyof typeof SIGN]}`,
              },
              h('span', { class: 'ns-stepper__sign' }, SIGN[sign as keyof typeof SIGN]),
              h(
                'button',
                {
                  class: 'ns-button',
                  type: 'button',
                  'aria-label': 'Less often',
                  onclick: () => setCount(sign, counts(sign) - 1),
                },
                '−',
              ),
              h('span', { class: 'ns-count' }, `${counts(sign)}×`),
              h(
                'button',
                {
                  class: 'ns-button',
                  type: 'button',
                  'aria-label': 'More often',
                  onclick: () => setCount(sign, counts(sign) + 1),
                },
                '+',
              ),
            ),
          ),
        ),
        h('span', { class: 'ns-label' }, 'Numbers up to'),
        h(
          'div',
          { class: 'ns-custom__row' },
          h(
            'button',
            {
              class: 'ns-button',
              type: 'button',
              'aria-label': 'Smaller',
              onclick: () => setRange(prefs.custom.range - 1),
            },
            '−',
          ),
          h('span', { class: 'ns-count ns-custom__range' }, String(prefs.custom.range)),
          h(
            'button',
            {
              class: 'ns-button',
              type: 'button',
              'aria-label': 'Bigger',
              onclick: () => setRange(prefs.custom.range + 1),
            },
            '+',
          ),
          ...[10, 12, 20, 50, 100].map((preset) =>
            h(
              'button',
              { class: 'ns-button', type: 'button', onclick: () => setRange(preset) },
              String(preset),
            ),
          ),
        ),
      );
    }

    function begin() {
      const spec = { mode, level: selected() } as EventSpec;
      const title =
        mode === 'sieve'
          ? `${MODE_NAMES[mode]} · ${sieveLevel(spec.level).name}`
          : MODE_NAMES[mode];
      app.go.run({ kind: 'free', title, events: [spec], tempo, seed: `free:${Date.now()}` });
    }

    render();
    const { root, layout } = page(app, 'Free play', [content], 'ns-setup');
    app.setScene({ kind: 'ready' });
    return {
      element: root,
      layout: 'menu',
      onLayout: layout,
      onKey(event) {
        if (event.key === 'Enter' && (event.target as HTMLElement | null)?.tagName !== 'BUTTON') {
          begin();
          return true;
        }
        return false;
      },
      focus: () => start.focus(),
    };
  };
}

function describeCustom(custom: { ops: string; range: number }): string {
  const signs = [...custom.ops].map((s) => SIGN[s as keyof typeof SIGN]).join(' ');
  return `${signs}, numbers to ${custom.range}`;
}
