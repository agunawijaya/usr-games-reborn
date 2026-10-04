import { FIGUREHEADS, figureheadSvg } from '../../render/figureheads';
import { PALETTES } from '../../render/palette';
import { launchLife } from '../../voyage/life';
import { LAUNCH_NAMES } from '../../voyage/names';
import type { FigureheadId } from '../../voyage/types';
import type { App, Screen } from '../app';
import { confirmDialog } from '../dialog';
import { button, h, svg } from '../dom';

/**
 * Launching a ship: her name, the captain's, and the carving that will ride at her bow for
 * the rest of her life, whatever happens to the timber behind it.
 */

export function launchScreen(app: App): Screen {
  const p = PALETTES[app.look];
  const existing = app.saves.life.load();
  let figurehead: FigureheadId = 'heron';
  const suggestion =
    LAUNCH_NAMES[(app.saves.counts.load().lives + new Date().getDate()) % LAUNCH_NAMES.length]!;
  const name = h('input', {
    type: 'text',
    maxlength: '24',
    value: suggestion,
    'aria-label': 'Her name',
    autocomplete: 'off',
    spellcheck: 'false',
    dataset: { testid: 'fh-launch-name' },
  });
  const captain = h('input', {
    type: 'text',
    maxlength: '20',
    value: existing?.captain ?? '',
    placeholder: 'Your name, if you like',
    'aria-label': 'Captain',
    autocomplete: 'off',
    dataset: { testid: 'fh-launch-captain' },
  });
  const picks = h('div', { class: 'fh-carvings', role: 'radiogroup', 'aria-label': 'Figurehead' });
  const drawPicks = () => {
    picks.replaceChildren(
      ...FIGUREHEADS.map((fh, i) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(fh.id === figurehead),
            tabindex: fh.id === figurehead ? '0' : '-1',
            class: `fh-carving${fh.id === figurehead ? ' is-chosen' : ''}`,
            dataset: { testid: `fh-carving-${fh.id}` },
            onclick: () => {
              figurehead = fh.id;
              drawPicks();
              picks.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
            },
            onkeydown: (event: Event) => {
              const e = event as KeyboardEvent;
              const step =
                e.key === 'ArrowRight' || e.key === 'ArrowDown'
                  ? 1
                  : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                    ? -1
                    : 0;
              if (!step) return;
              e.preventDefault();
              figurehead = FIGUREHEADS[(i + step + FIGUREHEADS.length) % FIGUREHEADS.length]!.id;
              drawPicks();
              picks.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
            },
          },
          svg(figureheadSvg(fh.id, p, app.look === 'night', fh.name), 'fh-carving__art'),
          h('span', { class: 'fh-carving__name' }, fh.name),
          h('span', { class: 'fh-carving__line' }, fh.line),
        ),
      ),
    );
  };
  drawPicks();

  const launch = async () => {
    if (existing && !existing.ending) {
      const ok = await confirmDialog(element, {
        title: 'Launch a new ship?',
        text: `The ${existing.shipName} is still at sea. Her story will end here, unfinished.`,
        yes: 'Launch anyway',
      });
      if (!ok) return;
    }
    const life = launchLife({
      id: `${app.context.daily.dateKey()}-${Date.now().toString(36)}`,
      dateKey: app.context.daily.dateKey(),
      shipName: name.value,
      captain: captain.value,
      figurehead,
    });
    app.saves.life.save(life);
    if (app.saves.active.load()?.mode.kind === 'voyage') app.saves.active.save(null);
    app.go.voyage();
  };

  const element = h(
    'section',
    { class: 'fh-screen fh-launch', dataset: { testid: 'fh-launch' } },
    h(
      'div',
      { class: 'fh-sheet' },
      h('p', { class: 'fh-kicker' }, 'Alder Haven dockyard'),
      h('h1', {}, 'A ship on the slip'),
      h(
        'p',
        { class: 'fh-lede' },
        'She is a frigate of forty guns, new oak and new canvas, with a green crew and five officers who have never sailed together. Her life will be twelve chapters over thirty years, if she lives it all. Whatever happens to her timbers, the carving at her bow goes on.',
      ),
      h(
        'div',
        { class: 'fh-launch__names' },
        h('label', {}, h('span', {}, 'Her name'), name),
        h('label', {}, h('span', {}, 'Captain'), captain),
      ),
      h('h2', { class: 'fh-launch__pick' }, 'Her figurehead'),
      picks,
      h(
        'div',
        { class: 'fh-actions' },
        button('Launch her', {
          onClick: () => void launch(),
          key: 'Enter',
          variant: 'primary',
          testId: 'fh-launch-go',
        }),
        button('Game menu', { onClick: () => app.go.title(), testId: 'fh-launch-menu' }),
      ),
    ),
  );

  return {
    element,
    onKey(event) {
      if (event.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') {
        void launch();
        return true;
      }
      if (event.key === 'Escape') {
        app.go.title();
        return true;
      }
      return false;
    },
    focus: () => name.focus({ preventScroll: true }),
  };
}
