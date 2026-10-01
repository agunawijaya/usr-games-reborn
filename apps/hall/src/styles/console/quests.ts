import { isoWeekKey } from '@usr-games/kit';
import { type CronJob, questLabel, XP_RULES } from '@usr-games/kit/progression';
import { playSound } from '../../core/sound';
import { h } from '../../ui/h';
import type { ConsoleContext } from './context';
import { glyph } from './icons';
import { openOverlay } from './overlay';

/**
 * The weekly quests side sheet: this week's three quests in plain words, each with a progress
 * bar. Unfinished quests simply roll over on Monday; nothing is ever taken away.
 */

function questCard(job: CronJob): HTMLElement {
  const fraction = job.target > 0 ? Math.min(1, job.progress / job.target) : 0;
  return h(
    'li',
    { class: ['ch-quest', job.done && 'is-done'] },
    h(
      'span',
      { class: 'ch-quest__icon', 'aria-hidden': 'true' },
      glyph(job.done ? 'check' : 'quests'),
    ),
    h('span', { class: 'ch-quest__label' }, questLabel(job)),
    h(
      'span',
      {
        class: 'ch-quest__bar',
        role: 'progressbar',
        'aria-label': questLabel(job),
        'aria-valuemin': '0',
        'aria-valuemax': String(job.target),
        'aria-valuenow': String(Math.min(job.progress, job.target)),
      },
      h('span', { class: 'ch-quest__fill', style: { width: `${(fraction * 100).toFixed(1)}%` } }),
    ),
    h(
      'span',
      { class: 'ch-quest__meta' },
      h('span', null, job.done ? 'Done' : `${Math.min(job.progress, job.target)} of ${job.target}`),
      h('span', null, `+${XP_RULES.cronJob} XP`),
    ),
  );
}

export function questsPanel(context: ConsoleContext): HTMLElement {
  const jobs = context.snapshot.progression.cron.jobs;
  const done = jobs.filter((job) => job.done).length;
  const week = Number(isoWeekKey(context.snapshot.today).split('-W')[1]);
  return h(
    'div',
    { class: 'ch-quests' },
    h('p', { class: 'ch-quests__week' }, `Week ${week} · ${done} of ${jobs.length} done`),
    jobs.length > 0
      ? h('ol', { class: 'ch-quests__list' }, jobs.map(questCard))
      : h(
          'p',
          { class: 'ch-quests__empty' },
          'New quests appear as soon as the first games are ready to play.',
        ),
    h(
      'p',
      { class: 'ch-quests__note' },
      `Finish all three for a bonus of ${XP_RULES.cronFullWeekBonus} XP. New quests arrive every Monday, and unfinished ones simply roll over: nothing is lost.`,
    ),
  );
}

export function openQuests(context: ConsoleContext, trigger: HTMLElement): void {
  let close = () => {};
  playSound(context.store, 'select');
  const sheet = h(
    'div',
    {
      class: 'ch-sheet',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'ch-quests-title',
    },
    h(
      'header',
      { class: 'ch-sheet__head' },
      h('h2', { id: 'ch-quests-title', class: 'ch-sheet__title' }, 'Weekly quests'),
      h(
        'button',
        {
          class: 'ch-round',
          type: 'button',
          'aria-label': 'Close weekly quests',
          onclick: () => {
            playSound(context.store, 'back');
            close();
          },
        },
        glyph('close'),
      ),
    ),
    questsPanel(context),
  );
  const scrim = h('div', { class: 'ch-scrim', 'aria-hidden': 'true' });
  const wrapper = h('div', { class: 'ch-sheet-layer' }, scrim, sheet);
  close = openOverlay(context.overlays, trigger, wrapper, {
    onKey(event) {
      // Keep Tab inside the sheet while it is open.
      if (event.key !== 'Tab') return;
      const focusable = [...sheet.querySelectorAll<HTMLElement>('button, a[href]')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    },
  });
}
