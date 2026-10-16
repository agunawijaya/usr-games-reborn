import type { PersonalityId } from '../engine/rivals';
import { portrait } from './avatars';
import { coins, element, emblemBadge } from './parts';

/**
 * The recap at the end of a game: who won and by how much, everyone's net worth turn by turn
 * on one chart with the turning point marked, and the sentence that says what decided it.
 * Buttons in the collection's order: Play again (R), Game menu, Back to the Hall (H).
 */

export interface Standing {
  readonly name: string;
  readonly colour: string;
  readonly portrait?: PersonalityId;
  readonly token: string;
  readonly worth: number;
  readonly you: boolean;
  readonly out: boolean;
}

export interface ResultsView {
  readonly kicker: string;
  readonly title: string;
  readonly story: string;
  readonly standings: readonly Standing[];
  /** Net worth of every seat after every turn, seat colours in seat order. */
  readonly series: readonly (readonly number[])[];
  readonly colours: readonly string[];
  /** The turn (index into `series`) the story points at. */
  readonly turningPoint: number | null;
  readonly facts: readonly { readonly label: string; readonly value: string }[];
  readonly won: boolean;
  /** A scenario's goals, ticked off or not. */
  readonly goals?: readonly { readonly text: string; readonly done: boolean }[];
  /** Short lines under the facts: XP, a new title, packages installed. */
  readonly notes?: readonly string[];
  /** The Daily Deal offers its share line. */
  readonly share?: boolean;
}

const WIDTH = 760;
const HEIGHT = 260;
const PAD = { left: 52, right: 16, top: 14, bottom: 30 };

function niceStep(max: number): number {
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? rough;
}

function chart(view: ResultsView): string {
  const turns = view.series.length - 1;
  const max = Math.max(1, ...view.series.flat());
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const x = (t: number) => PAD.left + (t / Math.max(1, turns)) * (WIDTH - PAD.left - PAD.right);
  const y = (v: number) => HEIGHT - PAD.bottom - (v / top) * (HEIGHT - PAD.top - PAD.bottom);
  const grid = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
    .map(
      (v) =>
        `<line x1="${PAD.left}" x2="${WIDTH - PAD.right}" y1="${y(v)}" y2="${y(v)}" class="dd-chart-grid"/><text x="${PAD.left - 8}" y="${y(v) + 4}" text-anchor="end">${v.toLocaleString('en-GB')}</text>`,
    )
    .join('');
  const lines = view.colours
    .map((colour, seat) => {
      const points = view.series
        .map((row, t) => `${x(t).toFixed(1)},${y(row[seat] ?? 0).toFixed(1)}`)
        .join(' ');
      return `<polyline points="${points}" fill="none" stroke="${colour}" stroke-width="${view.standings.find((s) => s.colour === colour)?.you ? 3.6 : 2.4}" stroke-linejoin="round" stroke-linecap="round"/>`;
    })
    .join('');
  const marker =
    view.turningPoint === null
      ? ''
      : `<line x1="${x(view.turningPoint)}" x2="${x(view.turningPoint)}" y1="${PAD.top}" y2="${HEIGHT - PAD.bottom}" class="dd-chart-turn"/><text x="${x(view.turningPoint) + 6}" y="${HEIGHT - PAD.bottom - 6}" class="dd-chart-turn-label">turning point</text>`;
  return `<svg class="dd-chart" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Net worth of every player, turn by turn">
    ${grid}<text x="${WIDTH - PAD.right}" y="${HEIGHT - 8}" text-anchor="end">turn ${turns}</text><text x="${PAD.left}" y="${HEIGHT - 8}">start</text>${marker}${lines}</svg>`;
}

export function renderResults(root: HTMLElement, view: ResultsView): HTMLElement {
  const page = element('section', `dd-panel dd-results${view.won ? ' dd-results--won' : ''}`);
  page.setAttribute('role', 'dialog');
  page.setAttribute('aria-labelledby', 'dd-results-title');
  const standings = view.standings
    .map((s, place) => {
      const face = s.portrait ? portrait(s.portrait, 40) : emblemBadge(s.token, s.colour, 40);
      return `<li class="dd-standing${s.you ? ' dd-standing--you' : ''}" style="--seat:${s.colour}"><span class="dd-standing-place">${place + 1}</span>${face}<span class="dd-standing-name">${s.name}${s.out ? ' <small>out</small>' : ''}</span>${coins(s.worth)}</li>`;
    })
    .join('');
  const facts = view.facts
    .map((f) => `<li><span>${f.label}</span><strong>${f.value}</strong></li>`)
    .join('');
  const goals = view.goals?.length
    ? `<ul class="dd-results-goals">${view.goals.map((g) => `<li class="${g.done ? 'dd-goal--done' : ''}"><span aria-hidden="true">${g.done ? '✓' : '·'}</span>${g.text}</li>`).join('')}</ul>`
    : '';
  const notes = view.notes?.length
    ? `<ul class="dd-results-notes">${view.notes.map((n) => `<li>${n}</li>`).join('')}</ul>`
    : '';
  const share = view.share
    ? '<button type="button" class="dd-action" data-act="share"><span>Share</span><kbd>S</kbd></button>'
    : '';
  page.innerHTML = `<header><p class="dd-moment-kicker">${view.kicker}</p><h2 id="dd-results-title">${view.title}</h2>${goals}</header>
    <div class="dd-results-body">
      <ol class="dd-standings" aria-label="Net worth at the end">${standings}</ol>
      <figure class="dd-results-chart">${chart(view)}<figcaption>${view.story}</figcaption></figure>
    </div>
    <ul class="dd-facts">${facts}</ul>
    ${notes}
    <nav class="dd-results-actions">
      <button type="button" class="dd-action dd-action--primary" data-act="again"><span>Play again</span><kbd>R</kbd></button>
      <button type="button" class="dd-action" data-act="menu"><span>Game menu</span></button>
      <button type="button" class="dd-action" data-act="hall"><span>Back to the Hall</span><kbd>H</kbd></button>
      ${share}
    </nav>`;
  root.append(page);
  return page;
}
