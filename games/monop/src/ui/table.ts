import type { PersonalityId } from '../engine/rivals';
import { portrait } from './avatars';
import { coins, element, emblemBadge } from './parts';

/**
 * The trade table in play. Composing: pick who to trade with, click deeds (or focus one and
 * press Space) to put them on the table, set the coins, and see the coach's fairness reading.
 * An offer coming in (a rival's proposal or counter) shows what changed and the rival's one
 * sentence, with Accept, Counter and Decline.
 */

export interface TableDeed {
  readonly space: number;
  readonly name: string;
  readonly groupName: string;
  readonly groupColour: string;
  readonly value: number;
  readonly mortgaged: boolean;
  readonly chosen: boolean;
  readonly changed?: boolean;
  /** Why this deed cannot go on the table, if it cannot. */
  readonly blocked?: string;
}

export interface TablePartner {
  readonly seat: number;
  readonly name: string;
  readonly title: string;
  readonly colour: string;
  readonly portrait?: PersonalityId;
  readonly token: string;
}

export interface TableView {
  readonly mode: 'compose' | 'incoming';
  readonly partners: readonly TablePartner[];
  readonly partner: TablePartner;
  readonly mine: readonly TableDeed[];
  readonly theirs: readonly TableDeed[];
  readonly giveCoins: number;
  readonly getCoins: number;
  readonly coinsChanged?: { readonly give: boolean; readonly get: boolean };
  readonly meter?: {
    readonly balance: number;
    readonly give: number;
    readonly get: number;
    readonly text: string;
  };
  readonly reply?: {
    readonly kind: 'offer' | 'counter' | 'accept' | 'decline';
    readonly text: string;
  };
  /** Why the offer cannot be made as it stands. */
  readonly problem?: string;
}

const REPLY_KIND = {
  offer: 'Offer',
  counter: 'Counter-offer',
  accept: 'Deal',
  decline: 'No deal',
} as const;

function deeds(list: readonly TableDeed[], side: 'give' | 'get', locked: boolean): string {
  if (list.length === 0) {
    const none = locked
      ? 'No deeds'
      : side === 'give'
        ? 'You have no deeds to offer'
        : 'They have no deeds';
    return `<li class="dd-drop">${none}</li>`;
  }
  return list
    .map(
      (
        d,
      ) => `<li><button type="button" class="dd-deed${d.chosen ? ' dd-deed--in' : ''}${d.blocked ? ' dd-deed--blocked' : ''}${d.changed ? ' dd-changed' : ''}" style="--group:${d.groupColour}" data-act="toggle" data-side="${side}" data-space="${d.space}" aria-pressed="${d.chosen}"${locked || d.blocked ? ' disabled' : ''}${d.blocked ? ` title="${d.blocked}"` : ''}>
        <span class="dd-deed-band">${d.groupName}${d.mortgaged ? ' · mortgaged' : ''}${d.blocked ? ' · built' : ''}</span><span class="dd-deed-name">${d.name}</span><span class="dd-deed-value">${coins(d.value)}</span></button></li>`,
    )
    .join('');
}

function coinRow(side: 'give' | 'get', amount: number, locked: boolean, changed: boolean): string {
  const steps = locked
    ? ''
    : [-50, -10, 10, 50]
        .map(
          (delta) =>
            `<button type="button" class="dd-step" data-act="coins" data-side="${side}" data-delta="${delta}" aria-label="${delta > 0 ? 'Add' : 'Take away'} ${Math.abs(delta)} coins">${delta > 0 ? '+' : '−'}${Math.abs(delta)}</button>`,
        )
        .join('');
  return `<p class="dd-trade-coins${changed ? ' dd-changed' : ''}"><span>Coins</span><span class="dd-trade-steps">${steps}</span>${coins(amount)}</p>`;
}

function meter(m: NonNullable<TableView['meter']>): string {
  const position = ((m.balance + 1) / 2) * 100;
  return `<section class="dd-meter"><p class="dd-meter-title">Coach · ${m.text}</p>
    <div class="dd-meter-track" role="meter" aria-valuemin="-1" aria-valuemax="1" aria-valuenow="${m.balance.toFixed(2)}" aria-label="Fairness"><span class="dd-meter-fair"></span><span class="dd-meter-needle" style="left:${position.toFixed(1)}%"></span></div>
    <p class="dd-meter-values"><span>You gain ${m.give.toLocaleString('en-GB')}</span><span>They gain ${m.get.toLocaleString('en-GB')}</span></p></section>`;
}

export function renderTable(root: HTMLElement, view: TableView): void {
  const locked = view.mode === 'incoming';
  root.append(element('div', 'dd-scrim'));
  const table = element('section', 'dd-panel dd-trade');
  table.setAttribute('role', 'dialog');
  table.setAttribute('aria-label', `Trade with ${view.partner.name}`);
  table.style.setProperty('--seat', view.partner.colour);
  const face = view.partner.portrait
    ? portrait(view.partner.portrait, 64)
    : emblemBadge(view.partner.token, view.partner.colour, 64);
  const tabs =
    !locked && view.partners.length > 1
      ? `<nav class="dd-trade-tabs" aria-label="Trade with">${view.partners
          .map(
            (p, i) =>
              `<button type="button" class="dd-tab" data-act="partner" data-seat="${p.seat}" aria-pressed="${p.seat === view.partner.seat}"><span>${p.name}</span><kbd>${i + 1}</kbd></button>`,
          )
          .join('')}</nav>`
      : '';
  table.innerHTML = `<header class="dd-trade-head">${face}<div><h2>Trade with ${view.partner.name}</h2><p>${view.partner.title}</p></div>${tabs}</header>
    <div class="dd-trade-sides">
      <section class="dd-trade-side"><h3>You give</h3><ul class="dd-deeds">${deeds(view.mine, 'give', locked)}</ul>${coinRow('give', view.giveCoins, locked, view.coinsChanged?.give ?? false)}</section>
      <section class="dd-trade-side"><h3>You get</h3><ul class="dd-deeds">${deeds(view.theirs, 'get', locked)}</ul>${coinRow('get', view.getCoins, locked, view.coinsChanged?.get ?? false)}</section>
    </div>
    ${view.meter ? meter(view.meter) : ''}
    ${view.reply ? `<figure class="dd-reply dd-reply--${view.reply.kind}">${view.partner.portrait ? portrait(view.partner.portrait, 40) : ''}<blockquote><p class="dd-reply-kind">${REPLY_KIND[view.reply.kind]}</p><p>${view.reply.text}</p></blockquote></figure>` : ''}
    ${view.problem ? `<p class="dd-trade-problem" role="status">${view.problem}</p>` : ''}
    <nav class="dd-trade-actions">${
      locked
        ? `<button type="button" class="dd-action dd-action--primary" data-act="accept"><span>Accept</span><kbd>Enter</kbd></button>
           <button type="button" class="dd-action" data-act="counter"><span>Counter</span><kbd>C</kbd></button>
           <button type="button" class="dd-action" data-act="decline"><span>Decline</span><kbd>Esc</kbd></button>`
        : `<button type="button" class="dd-action dd-action--primary" data-act="offer"${view.problem ? ' disabled' : ''}><span>Make the offer</span><kbd>Enter</kbd></button>
           <button type="button" class="dd-action" data-act="close"><span>Walk away</span><kbd>Esc</kbd></button>`
    }</nav>`;
  root.append(table);
}
