import type { BoardId } from '../boards/themes';
import type { PersonalityId } from '../engine/rivals';
import { portrait } from './avatars';
import { element } from './parts';

/**
 * The game menu, over the chosen board's world idling behind it: the three boards to choose
 * from, the Quick game on that board, and the doors to everything else (a table of your own,
 * the scenarios, the Daily Deal, your career). "← Back to the Hall" sits at the top left where
 * the Hall puts it, and Escape leaves from here.
 */

export interface MenuView {
  readonly board: BoardId;
  readonly boards: readonly { readonly id: BoardId; readonly name: string }[];
  readonly boardName: string;
  readonly tagline: string;
  readonly rivals: readonly {
    readonly id: PersonalityId;
    readonly name: string;
    readonly title: string;
    readonly blurb: string;
  }[];
  readonly minutes: number;
  readonly daily: { readonly number: number; readonly line: string };
  readonly scenariosLine: string;
  readonly careerLine: string;
  /** A game in progress, to carry on with. */
  readonly continueLine?: string;
}

function door(act: string, name: string, line: string, key: string): string {
  return `<button type="button" class="dd-door" data-act="${act}"><span class="dd-door-text"><strong>${name}</strong><span>${line}</span></span><kbd>${key}</kbd></button>`;
}

export function renderMenu(root: HTMLElement, view: MenuView): HTMLElement {
  const page = element('section', 'dd-menu');
  page.setAttribute('aria-labelledby', 'dd-menu-title');
  const rivals = view.rivals
    .map(
      (r) =>
        `<li>${portrait(r.id, 46)}<div><p class="dd-menu-rival">${r.name} <span>${r.title}</span></p><p>${r.blurb}</p></div></li>`,
    )
    .join('');
  const boards = view.boards
    .map(
      (b, i) =>
        `<button type="button" class="dd-board-pick" role="radio" aria-checked="${b.id === view.board}" data-act="board" data-board="${b.id}"><kbd>${i + 1}</kbd><span>${b.name}</span></button>`,
    )
    .join('');
  page.innerHTML = `<button type="button" class="dd-back" data-act="hall"><span aria-hidden="true">←</span> Back to the Hall</button>
    <div class="dd-panel dd-menu-card">
      <p class="dd-moment-kicker">/usr/games · monop</p>
      <h1 id="dd-menu-title">Deeds &amp; Dice</h1>
      <p class="dd-menu-tagline">Roll, buy and build a living town, and out-deal the rivals across the table.</p>
      <div class="dd-board-picks" role="radiogroup" aria-label="Board">${boards}</div>
      <section class="dd-menu-game">
        <h2>Quick game · ${view.boardName}</h2>
        <p>${view.tagline} About ${view.minutes} minutes; the richest at the end wins.</p>
        <ul class="dd-menu-rivals">${rivals}</ul>
        <div class="dd-menu-actions">
          ${
            view.continueLine
              ? `<button type="button" class="dd-action dd-action--primary" data-act="continue"><span>Continue</span><kbd>Enter</kbd></button>
                 <button type="button" class="dd-action" data-act="play"><span>New Quick game</span></button>`
              : '<button type="button" class="dd-action dd-action--primary" data-act="play"><span>Play</span><kbd>Enter</kbd></button>'
          }
        </div>
        ${view.continueLine ? `<p class="dd-menu-continue">In progress: ${view.continueLine}</p>` : ''}
      </section>
      <nav class="dd-doors" aria-label="More ways to play">
        ${door('setup', 'New game', 'Your board, your seats, your rules', 'N')}
        ${door('scenarios', 'Scenarios', view.scenariosLine, 'S')}
        ${door('daily', `Daily Deal #${view.daily.number}`, view.daily.line, 'D')}
        ${door('career', 'Career', view.careerLine, 'C')}
      </nav>
      <nav class="dd-menu-links" aria-label="Help and settings">
        <button type="button" class="dd-link" data-act="help">How to play <kbd>?</kbd></button>
        <button type="button" class="dd-link" data-act="settings">Settings <kbd>O</kbd></button>
      </nav>
    </div>`;
  root.append(page);
  return page;
}
