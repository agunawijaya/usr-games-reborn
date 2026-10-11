import { CHAPTERS, chapterPar } from '../../engine/chapters';
import { MODE_NAMES } from '../../engine/events';
import type { Tempo } from '../../engine/sums';
import type { App, Screen, ScreenFactory } from '../app';
import { h } from '../dom';
import { icon } from '../icons';
import { chapterOpen, nextChapterIndex } from './menu';
import { choiceRow, page } from './page';

/**
 * The campaign's twelve chapters: each a short meet across the modes, with its best stars in Rush
 * and in Calm. A chapter opens once the one before has a star.
 */

function stars(count: number, label: string): HTMLElement {
  return h(
    'span',
    { class: 'ns-stars', 'aria-label': `${label}: ${count} of 3 stars` },
    h('span', { class: 'ns-muted ns-stars__label' }, label),
    ...[0, 1, 2].map((i) =>
      h(
        'span',
        { class: i < count ? 'ns-star' : 'ns-star ns-star--off', 'aria-hidden': 'true' },
        '★',
      ),
    ),
  );
}

export const campaignScreen: ScreenFactory = (app: App): Screen => {
  let tempo: Tempo = app.saves.prefs.load().tempo;
  const records = app.saves.records.load();
  const next = nextChapterIndex(records.chapters);
  const grid = h(
    'ol',
    { class: 'ns-chapter-grid', 'aria-label': 'Chapters' },
    ...CHAPTERS.map((chapter, i) => {
      const best = records.chapters[chapter.id];
      const open = chapterOpen(records.chapters, i);
      const minutes = Math.max(1, Math.round(chapterPar(chapter) / 60));
      return h(
        'li',
        {},
        h(
          'button',
          {
            class: `ns-chapter-card${i === next ? ' ns-chapter-card--next' : ''}`,
            type: 'button',
            disabled: !open,
            'data-testid': `ns-chapter-${chapter.number}`,
            onclick: () => play(i),
          },
          h('span', { class: 'ns-label' }, `Chapter ${chapter.number}`),
          h('span', { class: 'ns-chapter-card__title' }, chapter.title),
          h(
            'span',
            { class: 'ns-muted' },
            open ? chapter.blurb : `Opens with a star in chapter ${chapter.number - 1}.`,
          ),
          h(
            'span',
            {
              class: 'ns-chapter-card__events',
              'aria-label': chapter.events.map((e) => MODE_NAMES[e.mode]).join(', '),
            },
            ...chapter.events.map((e) => icon(e.mode, 'ns-event__icon')),
            h('span', { class: 'ns-muted' }, `about ${minutes} min`),
          ),
          h(
            'span',
            { class: 'ns-chapter-card__stars' },
            stars(best?.rush ?? 0, 'Rush'),
            stars(best?.calm ?? 0, 'Calm'),
          ),
        ),
      );
    }),
  );

  function play(index: number) {
    const chapter = CHAPTERS[index]!;
    if (!chapterOpen(app.saves.records.load().chapters, index)) return;
    app.go.run({
      kind: 'chapter',
      title: `Chapter ${chapter.number}: ${chapter.title}`,
      events: chapter.events,
      tempo,
      seed: `chapter:${chapter.id}:${Date.now()}`,
      chapterId: chapter.id,
    });
  }

  const { root, layout } = page(
    app,
    'Campaign',
    [
      choiceRow(
        'Tempo',
        [
          { value: 'rush', text: 'Rush', note: 'Stars: accurate, under par, no hints' },
          { value: 'calm', text: 'Calm', note: 'Stars: accurate, a clean run, no hints' },
        ],
        tempo,
        (value) => {
          tempo = value;
          app.saves.prefs.update((p) => ({ ...p, tempo: value }));
        },
      ),
      grid,
    ],
    'ns-campaign',
  );
  app.setScene({ kind: 'ready' });
  return {
    element: root,
    layout: 'menu',
    onLayout: layout,
    focus: () => root.querySelector<HTMLElement>('.ns-chapter-card--next')?.focus(),
  };
};
