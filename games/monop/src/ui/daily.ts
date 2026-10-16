import type { DailyRecord } from '../scenarios/daily';
import { page } from './pages';
import type { ScenarioCard } from './scenarios';

/**
 * The Daily Deal: today's scenario, the same table and the same dice for everyone, with the
 * coach off. Once played, the day's result and a share line; playing again is allowed, but the
 * first try is the one that counts.
 */

export interface DailyView {
  readonly number: number;
  readonly dateLabel: string;
  readonly boardName: string;
  readonly card: ScenarioCard;
  readonly record: DailyRecord | null;
  readonly played: number;
}

export function renderDaily(root: HTMLElement, view: DailyView): HTMLElement {
  const { card, record } = view;
  const goals = card.goals.map((g) => `<li>${g}</li>`).join('');
  const rules = card.rules.length
    ? `<ul class="dd-scenario-rules">${card.rules.map((r) => `<li>${r}</li>`).join('')}</ul>`
    : '';
  const result = record
    ? `<p class="dd-daily-result${record.won ? ' dd-daily-result--won' : ''}">${record.won ? `Won in ${record.turns} turn${record.turns === 1 ? '' : 's'}` : 'Not this time'} · ${record.towers} tower${record.towers === 1 ? '' : 's'} · ${record.deals} deal${record.deals === 1 ? '' : 's'}</p>`
    : '';
  const actions = record
    ? `<button type="button" class="dd-action dd-action--primary" data-act="share"><span>Share</span><kbd>S</kbd></button>
       <button type="button" class="dd-action" data-act="start"><span>Play it again</span><kbd>Enter</kbd></button>`
    : `<button type="button" class="dd-action dd-action--primary" data-act="start"><span>Play</span><kbd>Enter</kbd></button>`;
  const body = `<header class="dd-sheet-head"><p class="dd-moment-kicker">Daily Deal #${view.number} · ${view.dateLabel}</p><h2>${card.title}</h2></header>
    <p class="dd-daily-where">${view.boardName} · ${card.rounds} turns</p>
    <p class="dd-scenario-brief">${card.brief}</p>
    <h4>Goal</h4><ul class="dd-scenario-goals">${goals}</ul>
    ${rules}
    <p class="dd-setup-note">The same table and the same dice for everyone today, and the coach stays home. Your first try is the one that counts${view.played > 0 ? `; you have played ${view.played} Daily Deal${view.played === 1 ? '' : 's'} so far` : ''}.</p>
    ${result}
    <nav class="dd-menu-actions">${actions}</nav>`;
  return page(root, 'dd-daily', `Daily Deal #${view.number}`, body);
}
