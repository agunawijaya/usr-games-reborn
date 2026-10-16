import { page } from './pages';

/**
 * How to play, in the game: the rules in short, the two rule sets and the keys. The full
 * manual is HOW-TO-PLAY.md; this page is what a player needs at the table.
 */

const KEYS: readonly [string, string][] = [
  ['Space', 'Roll the dice'],
  ['B / P', 'Buy the lot, or pass it to auction'],
  ['H', 'Build'],
  ['M', 'Mortgage, sell or pay off'],
  ['T', 'Trade'],
  ['E', 'End your turn'],
  ['F / U', 'In the lock-up: pay the fine, or use a pardon'],
  ['F / W', 'Berkeley income tax: the flat sum, or a tenth of your worth'],
  ['Enter', 'The main choice; skips a moment on screen'],
  ['1–9', 'Rows in a list, bids, trade partners'],
  ['C', 'Counter an offer'],
  ['V', 'Map view'],
  ['Arrows', 'Walk the lot card round the board'],
  ['Esc', 'Close what is open; otherwise pause'],
];

export function renderHelp(root: HTMLElement): HTMLElement {
  const keys = KEYS.map(
    ([key, what]) => `<tr><th scope="row"><kbd>${key}</kbd></th><td>${what}</td></tr>`,
  ).join('');
  const body = `<header class="dd-sheet-head"><p class="dd-moment-kicker">How to play</p><h2>Roll, buy, build, out-deal</h2></header>
    <div class="dd-help">
      <section>
        <h3>The aim</h3>
        <p>In a Quick game the richest player when the last round ends wins: coins, plus every deed at its price and every building at cost. In Classic, play on until one player is left standing.</p>
        <h3>A turn</h3>
        <p>Roll and walk round the board. Land on a lot nobody owns and you may buy it; pass, and it goes to auction for everyone. Land on someone else's and pay their rent. Doubles roll again; a third double sends you to the lock-up.</p>
        <h3>Building</h3>
        <p>Own every lot of a district to double its bare rent and to build: storeys one at a time and evenly, then a landmark on top. Buildings multiply the rent many times over.</p>
        <h3>Money</h3>
        <p>Mortgage a lot for half its price (no rent while it is mortgaged; paying it off costs a tenth more). Sell storeys back for half. If you go below zero, raise the money before play goes on, or leave the game and hand what you own to whoever you owe.</p>
        <h3>Trading</h3>
        <p>Offer deeds and coins to anyone, any time between rolls. Rivals answer in a sentence, and a stingy offer gets a counter. With the coach on, a meter shows what each side really gains.</p>
      </section>
      <section>
        <h3>Two rule sets</h3>
        <p><strong>Standard</strong>: you need the coins to buy and build, declined lots are auctioned, and the builders' stock is limited. <strong>Berkeley 1980</strong> is the original program: the bank lends to anyone (fix the debt after), no auction once only two players are left, and buildings never run out.</p>
        <h3>Keys</h3>
        <table class="dd-keys"><tbody>${keys}</tbody></table>
      </section>
    </div>`;
  return page(root, 'dd-help-page', 'How to play', body);
}
