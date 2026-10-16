import type { DeckId } from '../boards/layout';
import type { PersonalityId } from '../engine/rivals';
import { portrait } from './avatars';
import { coins, element, emblemBadge } from './parts';

/**
 * The panels that open over the play screen: a drawn card, the celebration's caption, the
 * auction, the fix-it panel for debts, the build and money lists, and short notices. Buttons
 * carry `data-act` (and `data-space` where a lot is meant); the play screen handles them all
 * in one place, so every button also has a key.
 */

export function renderCard(
  root: HTMLElement,
  card: { deckName: string; text: string; deck: DeckId },
): void {
  const panel = element('section', `dd-panel dd-drawn dd-drawn--${card.deck}`);
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', card.deckName);
  panel.innerHTML = `<p class="dd-drawn-deck">${card.deckName}</p><p class="dd-drawn-text">${card.text}</p>
    <button type="button" class="dd-action dd-action--primary" data-act="card-ok"><span>OK</span><kbd>Enter</kbd></button>`;
  root.append(panel);
}

export function renderMoment(
  root: HTMLElement,
  moment: { kicker: string; title: string; detail: string },
): void {
  const banner = element('section', 'dd-panel dd-moment');
  banner.setAttribute('aria-live', 'assertive');
  banner.innerHTML = `<p class="dd-moment-kicker">${moment.kicker}</p><h2>${moment.title}</h2><p>${moment.detail}</p>`;
  root.append(banner);
}

export interface AuctionBidder {
  readonly name: string;
  readonly colour: string;
  readonly portrait?: PersonalityId;
  readonly token: string;
  readonly passed: boolean;
  readonly calling: boolean;
}

export interface AuctionView {
  readonly lot: string;
  readonly groupColour: string;
  readonly price: number;
  readonly high: { readonly name: string; readonly amount: number } | null;
  readonly bidders: readonly AuctionBidder[];
  /** The person's call: the bids they can make and the share of their time left. */
  readonly yourCall: { readonly bids: readonly number[]; readonly clock: number } | null;
}

export function renderAuction(root: HTMLElement, view: AuctionView): void {
  const panel = element('section', 'dd-panel dd-auction');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', `Auction for ${view.lot}`);
  panel.style.setProperty('--group', view.groupColour);
  const bidders = view.bidders
    .map((b) => {
      const face = b.portrait ? portrait(b.portrait, 34) : emblemBadge(b.token, b.colour, 34);
      return `<li class="dd-bidder${b.passed ? ' dd-bidder--out' : ''}${b.calling ? ' dd-bidder--calling' : ''}" style="--seat:${b.colour}">${face}<span>${b.name}</span><em>${b.passed ? 'out' : b.calling ? 'to call' : ''}</em></li>`;
    })
    .join('');
  const high = view.high
    ? `${coins(view.high.amount)}<span>${view.high.name}</span>`
    : '<span>No bids yet</span>';
  const call = view.yourCall
    ? `<div class="dd-auction-clock" role="progressbar" aria-label="Time to call" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(view.yourCall.clock * 100)}"><span style="width:${(view.yourCall.clock * 100).toFixed(1)}%"></span></div>
       <nav class="dd-auction-bids">${view.yourCall.bids
         .map(
           (bid, i) =>
             `<button type="button" class="dd-action${i === 0 ? ' dd-action--primary' : ''}" data-act="bid" data-amount="${bid}"><span>Bid ${bid.toLocaleString('en-GB')}</span><kbd>${i + 1}</kbd></button>`,
         )
         .join(
           '',
         )}<button type="button" class="dd-action" data-act="fold"><span>Pass</span><kbd>P</kbd></button></nav>`
    : '<p class="dd-auction-wait">Waiting for the next call…</p>';
  panel.innerHTML = `<header class="dd-auction-head"><p class="dd-moment-kicker">Auction</p><h2>${view.lot}</h2><p>Listed at ${coins(view.price)}</p></header>
    <p class="dd-auction-high">${high}</p>
    <ol class="dd-bidders">${bidders}</ol>${call}`;
  root.append(panel);
}

export interface FixView {
  readonly short: number;
  readonly moves: readonly {
    readonly act: string;
    readonly space: number;
    readonly label: string;
    readonly amount: number;
  }[];
}

/** The fix-it panel: how short the player is, and every way to raise the money. */
export function renderDebt(root: HTMLElement, view: FixView): void {
  const panel = element('section', 'dd-panel dd-debt');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Raise money');
  const moves = view.moves
    .map(
      (m, i) =>
        `<li><button type="button" class="dd-row" data-act="${m.act}" data-space="${m.space}"><span>${m.label}</span>${coins(m.amount)}${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}</button></li>`,
    )
    .join('');
  panel.innerHTML = `<header><p class="dd-moment-kicker">Short of coins</p><h2>Raise ${coins(view.short)}</h2>
    <p>Sell buildings, mortgage lots or trade until you are back above nothing.</p></header>
    <ol class="dd-rows">${moves || '<li class="dd-empty">Nothing left to sell or mortgage.</li>'}</ol>
    <nav class="dd-panel-actions"><button type="button" class="dd-action" data-act="trade"><span>Trade</span><kbd>T</kbd></button>
    <button type="button" class="dd-action" data-act="resign"><span>Leave the game</span><kbd>L</kbd></button></nav>`;
  root.append(panel);
}

export interface ListRow {
  readonly act: string;
  readonly space: number;
  readonly title: string;
  readonly detail?: string;
  readonly amount: number;
  readonly tone?: 'gain' | 'loss';
}

/** A side panel listing what can be done with the player's lots: build, mortgage, sell, pay off. */
export function renderList(
  root: HTMLElement,
  title: string,
  rows: readonly ListRow[],
  empty: string,
): void {
  const panel = element('section', 'dd-panel dd-list');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', title);
  const items = rows
    .map(
      (
        r,
        i,
      ) => `<li><button type="button" class="dd-row" data-act="${r.act}" data-space="${r.space}">
        <span class="dd-row-text"><strong>${r.title}</strong>${r.detail ? `<small>${r.detail}</small>` : ''}</span>
        <span class="dd-row-amount dd-row-amount--${r.tone ?? 'loss'}">${r.tone === 'gain' ? '+' : '−'}${coins(r.amount)}</span>${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}</button></li>`,
    )
    .join('');
  panel.innerHTML = `<header><h2>${title}</h2><button type="button" class="dd-close" data-act="close" aria-label="Close"><kbd>Esc</kbd></button></header>
    <ol class="dd-rows">${items || `<li class="dd-empty">${empty}</li>`}</ol>`;
  root.append(panel);
}

export function renderNotice(root: HTMLElement, text: string): void {
  const notice = element('p', 'dd-panel dd-notice', text);
  notice.setAttribute('role', 'status');
  root.append(notice);
}

/** Coins rising from a point and fading: green to you, red from you, plain between others. */
export function popCoins(
  layer: HTMLElement,
  x: number,
  y: number,
  amount: number,
  tone: 'gain' | 'loss' | 'neutral',
): void {
  const sign = tone === 'gain' ? '+' : tone === 'loss' ? '−' : '';
  const node = element('span', `dd-pop dd-pop--${tone}`, `${sign}${coins(amount)}`);
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  layer.append(node);
  node.addEventListener('animationend', () => node.remove());
  // A safety net for reduced motion, where there is no animation to end.
  setTimeout(() => node.remove(), 2600);
}
