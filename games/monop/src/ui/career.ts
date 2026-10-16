import type { BoardId } from '../boards/themes';
import type { Extra } from '../career/career';
import { page } from './pages';
import { emblemBadge } from './parts';

/**
 * Your career: the title you hold and what the next one asks, your records, the ladder of
 * titles with what each opens, your token on each board, the touches on the boards you have
 * earned (each one a switch), and the twelve packages.
 */

export interface CareerView {
  readonly title: { readonly name: string; readonly line: string };
  readonly next: {
    readonly name: string;
    readonly wins: { readonly have: number; readonly need: number };
    readonly worth: { readonly have: number; readonly need: number };
  } | null;
  readonly stats: readonly { readonly label: string; readonly value: string }[];
  readonly ladder: readonly {
    readonly name: string;
    readonly line: string;
    readonly reached: boolean;
    readonly needs: string;
  }[];
  readonly colour: string;
  readonly boards: readonly {
    readonly id: BoardId;
    readonly name: string;
    readonly tokens: readonly {
      readonly id: string;
      readonly name: string;
      readonly open: boolean;
      readonly chosen: boolean;
      readonly unlock?: string;
    }[];
  }[];
  readonly extras: readonly {
    readonly id: Extra;
    readonly name: string;
    readonly detail: string;
    readonly earned: boolean;
    readonly on: boolean;
  }[];
  readonly packages: readonly {
    readonly title: string;
    readonly description: string;
    readonly earned: boolean;
  }[];
}

function meter(label: string, have: number, need: number): string {
  const share = need === 0 ? 1 : Math.min(1, have / need);
  return `<div class="dd-career-meter"><span>${label}</span><div class="dd-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${need}" aria-valuenow="${Math.min(have, need)}" aria-label="${label}"><span style="width:${(share * 100).toFixed(1)}%"></span></div><strong>${have.toLocaleString('en-GB')} / ${need.toLocaleString('en-GB')}</strong></div>`;
}

export function renderCareer(root: HTMLElement, view: CareerView): HTMLElement {
  const next = view.next
    ? `<div class="dd-career-next"><p>Next: <strong>${view.next.name}</strong></p>${meter('Wins', view.next.wins.have, view.next.wins.need)}${view.next.worth.need > 0 ? meter('Best worth', view.next.worth.have, view.next.worth.need) : ''}</div>`
    : '<p class="dd-career-next">The top of the ladder. The town knows your name.</p>';
  const stats = view.stats
    .map((s) => `<li><span>${s.label}</span><strong>${s.value}</strong></li>`)
    .join('');
  const ladder = view.ladder
    .map(
      (t) =>
        `<li class="${t.reached ? 'dd-ladder--reached' : ''}"><strong>${t.name}</strong><span>${t.line}</span><small>${t.reached ? 'Yours' : t.needs}</small></li>`,
    )
    .join('');
  const boards = view.boards
    .map((b) => {
      const tokens = b.tokens
        .map(
          (t) =>
            `<button type="button" class="dd-token-pick" data-act="token" data-board="${b.id}" data-token="${t.id}" aria-pressed="${t.chosen}" ${t.open ? '' : 'disabled'} title="${t.open ? t.name : `${t.name}: ${t.unlock}`}">${emblemBadge(t.id, t.open ? view.colour : '#8a8f99', 34)}<span class="dd-visually-hidden">${t.name}${t.open ? '' : `, ${t.unlock}`}</span></button>`,
        )
        .join('');
      return `<li><span>${b.name}</span><span class="dd-token-picks" role="group" aria-label="Your token on ${b.name}">${tokens}</span></li>`;
    })
    .join('');
  const extras = view.extras
    .map(
      (e) =>
        `<label class="dd-choice${e.earned ? '' : ' dd-choice--locked'}"><input type="checkbox" data-field="extra" value="${e.id}" ${e.on ? 'checked' : ''} ${e.earned ? '' : 'disabled'}/><span><strong>${e.name}</strong><small>${e.detail}</small></span></label>`,
    )
    .join('');
  const packages = view.packages
    .map(
      (p) =>
        `<li class="${p.earned ? 'dd-package--earned' : ''}"><strong>${p.title}</strong><span>${p.description}</span></li>`,
    )
    .join('');
  const body = `<header class="dd-sheet-head"><p class="dd-moment-kicker">Career</p><h2>${view.title.name}</h2><p class="dd-career-line">${view.title.line}</p></header>
    <div class="dd-career-columns">
      <section aria-label="Progress">
        ${next}
        <ul class="dd-career-stats">${stats}</ul>
        <h3>Titles</h3>
        <ol class="dd-ladder">${ladder}</ol>
      </section>
      <section aria-label="Tokens and touches">
        <h3>Your token</h3>
        <ul class="dd-career-tokens">${boards}</ul>
        <h3>On the boards</h3>
        <div class="dd-career-extras">${extras}</div>
        <h3>Packages</h3>
        <ul class="dd-packages">${packages}</ul>
      </section>
    </div>`;
  return page(root, 'dd-career', 'Career', body);
}
