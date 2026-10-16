import type { PersonalityId } from '../engine/rivals';
import { portrait } from './avatars';
import { coins, element } from './parts';

/**
 * The trade table: what each side puts in, a fairness meter (with the coach on), and the
 * rival's answer in one plain sentence. A counter-offer shows what the rival changed.
 */

export interface DeedChip {
  readonly name: string;
  readonly groupColour: string;
  readonly groupName: string;
  readonly value: number;
  /** Added or changed by the rival's counter. */
  readonly changed?: boolean;
}

export interface TradeSide {
  readonly deeds: readonly DeedChip[];
  readonly coins: number;
  readonly coinsChanged?: boolean;
}

export interface TradeView {
  readonly rival: {
    readonly name: string;
    readonly title: string;
    readonly portrait: PersonalityId;
    readonly colour: string;
  };
  readonly give: TradeSide;
  readonly get: TradeSide;
  /** -1 (good for the rival) to +1 (good for you), from the coach's valuation. */
  readonly fairness?: number;
  readonly values?: { readonly give: number; readonly get: number };
  readonly reply: { readonly kind: 'counter' | 'accept' | 'decline'; readonly text: string };
}

function side(title: string, data: TradeSide, drop: string): HTMLElement {
  const column = element('section', 'dd-trade-side');
  const deeds = data.deeds
    .map(
      (
        d,
      ) => `<li class="dd-deed${d.changed ? ' dd-changed' : ''}" style="--group:${d.groupColour}" tabindex="0" draggable="true">
        <span class="dd-deed-band">${d.groupName}</span><span class="dd-deed-name">${d.name}</span><span class="dd-deed-value">${coins(d.value)}</span></li>`,
    )
    .join('');
  column.innerHTML = `<h3>${title}</h3><ul class="dd-deeds" aria-label="${title}">${deeds}<li class="dd-drop">${drop}</li></ul>
    <p class="dd-trade-coins${data.coinsChanged ? ' dd-changed' : ''}"><span>Coins</span>${coins(data.coins)}</p>`;
  return column;
}

function meter(fairness: number, values: NonNullable<TradeView['values']>): HTMLElement {
  const node = element('section', 'dd-meter');
  const position = ((fairness + 1) / 2) * 100;
  const verdict =
    Math.abs(fairness) < 0.12 ? 'A fair deal' : fairness > 0 ? 'Good for you' : 'Good for them';
  node.innerHTML = `<p class="dd-meter-title">Coach · ${verdict}</p>
    <div class="dd-meter-track" role="meter" aria-valuemin="-1" aria-valuemax="1" aria-valuenow="${fairness.toFixed(2)}" aria-label="Fairness"><span class="dd-meter-fair"></span><span class="dd-meter-needle" style="left:${position.toFixed(1)}%"></span></div>
    <p class="dd-meter-values"><span>You give ${values.give.toLocaleString('en-GB')}</span><span>You get ${values.get.toLocaleString('en-GB')}</span></p>`;
  return node;
}

export function renderTrade(root: HTMLElement, view: TradeView): void {
  const scrim = element('div', 'dd-scrim');
  const table = element('section', 'dd-panel dd-trade');
  table.setAttribute('role', 'dialog');
  table.setAttribute('aria-label', `Trade with ${view.rival.name}`);
  table.style.setProperty('--seat', view.rival.colour);
  const head = element(
    'header',
    'dd-trade-head',
    `${portrait(view.rival.portrait, 64)}<div><h2>Trade with ${view.rival.name}</h2><p>${view.rival.title}</p></div>`,
  );
  const sides = element('div', 'dd-trade-sides');
  sides.append(
    side('You give', view.give, 'Drag a deed here'),
    side('You get', view.get, 'Drag their deed here'),
  );
  table.append(head, sides);
  if (view.fairness !== undefined && view.values) table.append(meter(view.fairness, view.values));
  const reply = element('figure', `dd-reply dd-reply--${view.reply.kind}`);
  reply.innerHTML = `${portrait(view.rival.portrait, 40)}<blockquote><p class="dd-reply-kind">${view.reply.kind === 'counter' ? 'Counter-offer' : view.reply.kind === 'accept' ? 'Deal' : 'No deal'}</p><p>${view.reply.text}</p></blockquote>`;
  table.append(reply);
  const actions = element('nav', 'dd-trade-actions');
  actions.innerHTML = `<button type="button" class="dd-action dd-action--primary"><span>Accept their counter</span><kbd>Enter</kbd></button>
    <button type="button" class="dd-action"><span>Change my offer</span><kbd>C</kbd></button>
    <button type="button" class="dd-action"><span>Walk away</span><kbd>Esc</kbd></button>`;
  table.append(actions);
  root.append(scrim, table);
}
