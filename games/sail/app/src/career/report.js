// What the player sees of a battle's orders: the strip under the top bar while it is fought, the
// counsel panel behind Ctrl+Alt+C, and the battle report when it ends. Plain HTML strings;
// main.js owns the elements and the keys.

import { commendationProgress, commendationStatus, describeCommendation, shortCommendation } from './commendations.js';
import { engagementShareLine } from './daily.js';
import { actionAfter } from './service.js';
import { actionOfPlan } from './plans.js';
import { formatBoard } from '../engine/scoreboard.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const MARKS = { open: '◇', met: '◆', lost: '✕' };
const TITLES = { victory: 'Victory', hurricane: 'Hurricane', nightfall: 'Nightfall', quit: 'Command relinquished' };

export function stripHtml(plan, st, me, log) {
  const items = plan.commendations
    .map((c) => {
      const status = commendationStatus(c, st, me, log);
      const count = commendationProgress(c, st, me, log);
      return `<li class="${status}" title="${esc(describeCommendation(c))}"><span class="mark" aria-hidden="true">${MARKS[status]}</span>${esc(shortCommendation(c))}${count ? ` <small>${esc(count)}</small>` : ''}</li>`;
    })
    .join('');
  return `<span class="strip-name">${esc(plan.name)}</span>${items ? `<ul>${items}</ul>` : ''}`;
}

export function counselHtml(advice) {
  if (!advice) return '<h2>First lieutenant’s counsel</h2><p class="dim">No orders to give.</p>';
  const rows = advice.notes.map((n) => `<li><b>${esc(n.order)}</b><span>${esc(n.why)}</span></li>`).join('');
  return `<h2>First lieutenant’s counsel</h2>
    <ol>${rows || '<li><b>Hold your course</b><span>Nothing to do this turn.</span></li>'}</ol>
    <p class="counsel-cmds">${advice.commands.map((c) => `<code>${esc(c)}</code>`).join(' ')}</p>
    <p><button class="btn" id="counselApply">Give these orders</button> <span class="dim">then Make it so</span></p>`;
}

/** The ways on from a report: the way on first, then the collection's results order. */
export function reportButtons(plan, st, summary, hosted) {
  const won = st.result?.reason === 'victory';
  const next = plan.mode === 'service' && won ? actionAfter(actionOfPlan(plan)) : null;
  const buttons = [];
  if (plan.mode === 'daily') buttons.push({ key: 'S', label: 'Copy share line', action: 'share', primary: true });
  else if (next) buttons.push({ key: 'N', label: `Next: ${next.title}`, action: 'next', primary: true });
  buttons.push({
    key: 'R',
    label: plan.mode === 'free' ? 'Fight it again' : won ? 'Fight it again' : 'Try again',
    action: 'again',
    primary: buttons.length === 0,
  });
  buttons.push({ key: 'M', label: 'Game menu', action: 'menu' });
  if (hosted) buttons.push({ key: 'H', label: 'Back to the Hall', action: 'hall' });
  buttons.push({ key: 'L', label: 'Look around', action: 'look' });
  return buttons;
}

export function reportShareLine(plan, st, summary) {
  if (plan.mode !== 'daily') return null;
  return engagementShareLine({ number: plan.number, earned: summary.earned, rating: summary.rating, won: st.result?.reason === 'victory' });
}

function notesHtml(plan, summary) {
  const notes = [];
  if (summary.opened) notes.push(`Action ${summary.opened.number}, ${esc(summary.opened.title)}, is open.`);
  if (summary.rankAfter !== summary.rankBefore) notes.push(`Promoted to <b>${esc(summary.rankAfter)}</b>.`);
  if (summary.serviceComplete) notes.push('The Sea Service is complete: every action won.');
  if (plan.mode === 'daily') {
    notes.push(summary.firstToday
      ? `Engagement rating <b>${summary.rating.toLocaleString('en')}</b> · today’s first engagement, on record.`
      : `Practice, rating ${summary.rating.toLocaleString('en')} · today’s record stays as it was.`);
  }
  return notes.length ? `<div class="report-notes">${notes.map((n) => `<p>${n}</p>`).join('')}</div>` : '';
}

/**
 * @param {{ plan: object, st: object, me: object, summary: object, rank: number, board: object[],
 *   buttons: object[] }} report  `me` is the player's ship, `rank` its place in the top ten (-1).
 */
export function reportHtml({ plan, st, me, summary, rank, board, buttons }) {
  const r = st.result || { text: 'The battle is over.' };
  const title = TITLES[r.reason] || 'Defeat';
  const share = reportShareLine(plan, st, summary);
  const stars = plan.commendations.length
    ? `<ul class="report-orders">${plan.commendations.map((c, i) => `<li class="${summary.earned[i] ? 'earned' : ''}"><span class="mark" aria-hidden="true">${summary.earned[i] ? '★' : '☆'}</span> ${esc(describeCommendation(c))}${summary.earned[i] ? '<span class="sr-only"> (earned)</span>' : ''}${summary.newlyEarned[i] ? '<span class="fresh">new</span>' : ''}</li>`).join('')}</ul>`
    : '';
  const kicker = plan.mode === 'service' ? `The Sea Service · ${esc(plan.name)}` : plan.mode === 'daily' ? esc(plan.name) : `Historical action · ${esc(plan.name)}`;
  const actions = buttons
    .map((b) => `<button class="btn${b.primary ? ' primary' : ''}" data-report="${b.action}"><span class="kbd">${b.key}</span> ${esc(b.label)}</button>`)
    .join(' ');
  return `<div class="panel rivets report" style="max-width:660px">
    <p class="report-kicker">${kicker}</p>
    <h1 id="endTitle">${title}</h1>
    <p class="tag">${esc(r.text)} — turn ${st.turn}</p>
    ${me ? `<p>Captain ${esc(me.captain)} of the ${esc(me.name)}: <b>${me.points}</b> points (net ${(me.points / me.max.pts).toFixed(2)}).${rank >= 0 ? ` Entered the top ten at #${rank + 1}.` : ''}</p>` : ''}
    ${stars}
    ${notesHtml(plan, summary)}
    ${share ? `<p class="share-line"><span>${esc(share)}</span></p>` : ''}
    <p class="report-actions">${actions}</p>
    <details><summary>Top ten sailors</summary><pre class="board">${formatBoard(board).map(esc).join('\n')}</pre></details>
  </div>`;
}
