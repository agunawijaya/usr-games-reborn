import type { BoardId } from '../boards/themes';
import type { Difficulty } from '../engine/types';
import type { PersonalityId } from '../engine/rivals';
import { portrait } from './avatars';
import { page } from './pages';

/**
 * The scenarios: three chapters, one a board, eight puzzles in each from gentle to fierce. The
 * list sits on the left, the chosen scenario's brief, goals, rivals and rules on the right.
 */

export interface ScenarioCard {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly brief: string;
  readonly goals: readonly string[];
  readonly rounds: number;
  readonly rivals: readonly {
    readonly personality: PersonalityId;
    readonly name: string;
    readonly title: string;
    readonly difficulty: Difficulty;
  }[];
  /** Rules that differ from a standard game, in a few words each. */
  readonly rules: readonly string[];
  readonly status: {
    readonly won: boolean;
    readonly bestTurns: number | null;
    readonly tries: number;
  } | null;
}

export interface ScenariosView {
  readonly chapter: BoardId;
  readonly chapters: readonly {
    readonly id: BoardId;
    readonly name: string;
    readonly won: number;
    readonly total: number;
  }[];
  readonly list: readonly ScenarioCard[];
  readonly selected: string;
}

const LEVEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

function statusLine(card: ScenarioCard): string {
  if (!card.status) return '';
  if (card.status.won)
    return `<span class="dd-scenario-status dd-scenario-status--won">Won${card.status.bestTurns ? ` in ${card.status.bestTurns}` : ''}</span>`;
  return `<span class="dd-scenario-status">Tried ${card.status.tries}×</span>`;
}

function detail(card: ScenarioCard): string {
  const goals = card.goals.map((g) => `<li>${g}</li>`).join('');
  const rivals = card.rivals
    .map(
      (r) =>
        `<li>${portrait(r.personality, 36)}<span><strong>${r.name}</strong> ${r.title}<small>${LEVEL[r.difficulty]}</small></span></li>`,
    )
    .join('');
  const rules = card.rules.length
    ? `<ul class="dd-scenario-rules">${card.rules.map((r) => `<li>${r}</li>`).join('')}</ul>`
    : '';
  return `<article class="dd-scenario-detail" aria-labelledby="dd-scenario-title">
      <p class="dd-moment-kicker">Scenario ${card.number} · ${card.rounds} turns</p>
      <h3 id="dd-scenario-title">${card.title}</h3>
      <p class="dd-scenario-brief">${card.brief}</p>
      <h4>Goal</h4><ul class="dd-scenario-goals">${goals}</ul>
      ${rules}
      <h4>At the table</h4><ul class="dd-scenario-rivals">${rivals}</ul>
      <div class="dd-menu-actions"><button type="button" class="dd-action dd-action--primary" data-act="start"><span>Start</span><kbd>Enter</kbd></button></div>
    </article>`;
}

export function renderScenarios(root: HTMLElement, view: ScenariosView): HTMLElement {
  const tabs = view.chapters
    .map(
      (c, i) =>
        `<button type="button" class="dd-tab dd-chapter" role="tab" aria-selected="${c.id === view.chapter}" data-act="chapter" data-board="${c.id}"><kbd>${i + 1}</kbd>${c.name} <small>${c.won}/${c.total}</small></button>`,
    )
    .join('');
  const list = view.list
    .map(
      (card) =>
        `<li><button type="button" class="dd-row dd-scenario-row" data-act="pick" data-id="${card.id}" aria-current="${card.id === view.selected}"><span class="dd-scenario-number">${card.number}</span><span class="dd-row-text">${card.title}<small>${card.goals.join(' · ')}</small></span>${statusLine(card)}</button></li>`,
    )
    .join('');
  const chosen = view.list.find((c) => c.id === view.selected) ?? view.list[0]!;
  const body = `<header class="dd-sheet-head"><p class="dd-moment-kicker">Scenarios</p><h2>Puzzles on a table already in play</h2></header>
    <div class="dd-chapters" role="tablist" aria-label="Boards">${tabs}</div>
    <div class="dd-scenarios-body">
      <ol class="dd-rows dd-scenario-list" aria-label="Scenarios">${list}</ol>
      ${detail(chosen)}
    </div>
    <p class="dd-setup-note">Every scenario has been won by a rival's mind playing your seat: each one can be done. Arrows choose, Enter starts.</p>`;
  return page(root, 'dd-scenarios', 'Scenarios', body);
}
