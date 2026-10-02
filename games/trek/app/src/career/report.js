// Deep Space Command — what the player sees of a mission's orders: the strip on the HUD while it
// is flown, and the mission report when it ends. Both are plain HTML strings; main.js owns the
// elements and the keys.

import { commendationStatus, describeCommendation } from './orders.js';
import { patrolShareLine } from './daily.js';
import { sortieAfter } from './plans.js';

const esc = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** A commendation in a few words, for the narrow HUD strip. */
function shortLabel(c) {
  switch (c.kind) {
    case 'win':
      return 'Clear the sector';
    case 'hull':
      return `Hull ${c.atLeast}%+`;
    case 'noDock':
      return 'Never dock';
    case 'spare':
      return `${c.stardates} stardates spare`;
    case 'orders':
      return `Under ${c.under} orders`;
    case 'torpedoes':
      return c.atMost === 0 ? 'Phasers only' : `${c.atMost} torpedoes max`;
    case 'torpedoKills':
      return `${c.atLeast} torpedo kills`;
    case 'energy':
      return `${c.atLeast.toLocaleString('en')} energy kept`;
    case 'charted':
      return `Chart ${c.atLeast}`;
    default:
      return '';
  }
}

/** How far along a commendation is, where a count helps. */
function progress(c, game, log) {
  switch (c.kind) {
    case 'win':
      return `${game.klingonsRemaining} left`;
    case 'hull':
      return `${game.ship.hull}%`;
    case 'orders':
      return `${log.orders}`;
    case 'torpedoes':
      return `${log.torpedoesFired} fired`;
    case 'torpedoKills':
      return `${log.torpedoKills}/${c.atLeast}`;
    case 'charted':
      return `${log.charted}/${c.atLeast}`;
    case 'energy':
      return game.ship.energy.toLocaleString('en');
    default:
      return '';
  }
}

const MARKS = { open: '◇', kept: '◆', lost: '✕' };

export function ordersStripHtml(mission, game, log) {
  const items = mission.commendations
    .map((c) => {
      const status = commendationStatus(c, game, log);
      const count = progress(c, game, log);
      return `<li class="${status}" title="${esc(describeCommendation(c))}"><span class="mark" aria-hidden="true">${MARKS[status]}</span>${esc(shortLabel(c))}${count ? ` <small>${esc(count)}</small>` : ''}</li>`;
    })
    .join('');
  return `<div class="orders-name">${esc(mission.name)}</div>${items ? `<ul class="orders-list">${items}</ul>` : ''}`;
}

/** The ways on from a report, the way on first, then the collection's results order. */
export function reportButtons(mission, game, summary, hosted) {
  const buttons = [];
  const next = mission.mode === 'tour' && game.won ? sortieAfter(mission.sortie) : null;
  if (mission.mode === 'daily' && summary.counted) {
    buttons.push({ key: 'S', label: 'Copy share line', action: 'share', primary: true });
    buttons.push({ key: 'R', label: 'Fly it again', action: 'again' });
  } else if (next) {
    buttons.push({ key: 'N', label: `Next: ${next.name}`, action: 'next', primary: true });
    buttons.push({ key: 'R', label: 'Fly it again', action: 'again' });
  } else {
    const label = mission.mode === 'free' ? 'New mission' : game.won ? 'Fly it again' : 'Try again';
    buttons.push({ key: 'R', label, action: 'again', primary: true });
  }
  buttons.push({ key: 'M', label: 'Game menu', action: 'menu' });
  if (hosted) buttons.push({ key: 'H', label: 'Back to the Hall', action: 'hall' });
  return buttons;
}

function headline(game, abandoned) {
  if (game.won) return { text: 'VICTORY', cls: 'win' };
  if (abandoned) return { text: 'ABANDONED', cls: 'loss' };
  return { text: 'DEFEAT', cls: 'loss' };
}

function commendationsHtml(mission, summary) {
  if (!mission.commendations.length) return '';
  const rows = mission.commendations
    .map((c, i) => {
      const earned = summary.earned[i];
      const fresh = summary.newlyEarned[i] ? '<span class="fresh">new</span>' : '';
      return `<li class="${earned ? 'earned' : ''}"><span class="mark" aria-hidden="true">${earned ? '★' : '☆'}</span>${esc(describeCommendation(c))}${earned ? '<span class="sr-only"> (earned)</span>' : ''}${fresh}</li>`;
    })
    .join('');
  return `<ul class="report-orders">${rows}</ul>`;
}

function notesHtml(mission, summary) {
  const notes = [];
  if (!summary.counted) return '';
  if (summary.unlocked) notes.push(`Sortie ${summary.unlocked.number} · ${esc(summary.unlocked.name)} is open.`);
  if (summary.rankAfter !== summary.rankBefore) notes.push(`Promoted to <b>${esc(summary.rankAfter)}</b>.`);
  if (summary.tourComplete) notes.push('The Frontier Tour is complete: every sortie won.');
  if (mission.mode === 'daily') {
    notes.push(
      summary.firstPatrolToday
        ? `Patrol rating <b>${summary.rating.toLocaleString('en')}</b> · today’s first patrol, on record.`
        : `Practice run, rating ${summary.rating.toLocaleString('en')} · today’s record stays as it was.`,
    );
  }
  return notes.length ? `<div class="report-notes">${notes.map((note) => `<p>${note}</p>`).join('')}</div>` : '';
}

/** The share line of a daily patrol's report, or null. */
export function reportShareLine(mission, game, summary) {
  if (mission.mode !== 'daily') return null;
  return patrolShareLine({ number: mission.number, earned: summary.earned, rating: summary.rating, won: game.won });
}

/**
 * @param {{ mission: object, game: object, log: object, summary: object, reason: string,
 *   abandoned: boolean, buttons: object[] }} report
 */
export function reportHtml({ mission, game, log, summary, reason, abandoned, buttons }) {
  const title = headline(game, abandoned);
  const share = reportShareLine(mission, game, summary);
  const stats = `${game.kills} hostile ships disabled · Hull ${game.ship.hull}% · Energy ${game.ship.energy} · ${log.orders} orders · Stardate ${game.stardate.toFixed(1)}`;
  const actions = buttons
    .map((b) => `<button class="report-btn${b.primary ? ' primary' : ''}" data-report="${b.action}"><kbd>${b.key}</kbd> ${esc(b.label)}</button>`)
    .join('');
  return `
    <div class="report-kicker">${esc(mission.name)}</div>
    <h1 id="game-over-title" class="${title.cls}">${title.text}</h1>
    <div id="game-over-cheated" class="${summary.counted ? '' : 'shown'}">CHEATED<small>Captain's Override was used — this mission does not count.</small></div>
    <div id="game-over-text">${esc(reason)}</div>
    <div id="game-over-stats">${stats}</div>
    ${commendationsHtml(mission, summary)}
    ${notesHtml(mission, summary)}
    ${share && summary.counted ? `<div class="share-line"><span>${esc(share)}</span></div>` : ''}
    <div class="report-actions">${actions}</div>`;
}
