// The game menu and the pages behind it, drawn in the #menu overlay: the Sea Service with each
// action's briefing, the Daily Engagement, the historical actions (menu.js's scenario browser,
// the free battles) and the service record. The deck reports outward only a plan to launch, the
// wish to browse the historical actions, and the wish to leave for the Hall. Escape on a page
// goes back to the menu; on the menu it is left alone, so the Hall's bridge can take the player
// home.

import { SCENARIOS, SPECS, COUNTRY, CLASS_NAME, PLAYABLE } from '../engine/index.js';
import { describeCommendation } from './commendations.js';
import { ACTIONS, SERVICE_STARS } from './service.js';
import { dailyNumber, engagementCommendations, engagementFor, localDateKey, weekdayOf } from './daily.js';
import { RANKS, nextRank, rankFor, serviceStars } from './ranks.js';
import { planAction, planDaily } from './plans.js';
import { loadEngagements, loadRecord, loadService } from './store.js';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MENU_KEYS = { s: 'service', d: 'daily', h: 'historic', r: 'record' };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const starsText = (stars) => stars.map((earned) => (earned ? '★' : '☆')).join('');

function longDate(key) {
  const [, month, day] = key.split('-').map(Number);
  return `${WEEKDAYS[weekdayOf(key)]} ${day} ${MONTHS[month - 1]}`;
}

/** A ship as the briefing describes her: "the Shannon, a 38-gun British frigate". */
function shipLine(scenarioId, ship) {
  const s = SCENARIOS[scenarioId].ships[ship];
  const spec = SPECS[s.spec];
  return `the ${esc(s.name)}, a ${spec.guns}-gun ${esc(COUNTRY[s.nationality])} ${esc(CLASS_NAME[spec.class].toLowerCase())}`;
}

function opponents(scenarioId, ship) {
  const sc = SCENARIOS[scenarioId];
  const mine = sc.ships[ship].nationality;
  return sc.ships.filter((s) => s.nationality !== mine).map((s) => esc(s.name)).join(', ');
}

const entryOf = (service, action) => service.actions[action.id] ?? { won: false, stars: [false, false, false] };
const isOpen = (service, action) => action.number === 1 || !!service.actions[ACTIONS[action.number - 2].id]?.won;
const actionToOffer = (service) => ACTIONS.find((a) => isOpen(service, a) && !entryOf(service, a).won) ?? ACTIONS[ACTIONS.length - 1];

function commendationList(commendations, earned = []) {
  return `<ul class="deck-orders">${commendations
    .map((c, i) => `<li class="${earned[i] ? 'earned' : ''}"><span class="mark" aria-hidden="true">${earned[i] ? '★' : '☆'}</span> ${esc(describeCommendation(c))}${earned[i] ? '<span class="sr-only"> (earned)</span>' : ''}</li>`)
    .join('')}</ul>`;
}

function pageHead(title, meta = '') {
  return `<div class="deck-head">
    <button class="btn" data-act="back" data-nav>← Game menu</button>
    <h1 id="menuTitle">${esc(title)}</h1>
    <span class="deck-meta">${meta}</span>
  </div>`;
}

function menuPage(v) {
  const stars = serviceStars(v.service);
  const rank = rankFor(stars);
  const next = nextRank(stars);
  const offer = actionToOffer(v.service);
  const done = ACTIONS.every((a) => entryOf(v.service, a).won);
  const today = v.engagements.days[v.dateKey];
  const card = (key, page, title, desc) => `<button class="card deck-card" data-act="open" data-page="${page}" data-nav>
      <span class="card-key" aria-hidden="true">${key}</span><b>${esc(title)}</b><small>${desc}</small></button>`;
  return `<div class="panel rivets deck" data-deck="menu">
    <h1 id="menuTitle">Broadside — Wooden Walls</h1>
    <p class="tag">Dave Riggle’s <i>sail</i> (1980), after Avalon Hill’s <i>Wooden Ships and Iron Men</i> — every sea, sky, ship and flag drawn by code.</p>
    <p class="deck-rank"><b>${esc(rank.title)}</b> · ★ ${stars} / ${SERVICE_STARS} · ${next ? `${next.stars - stars} more for ${esc(next.title)}` : 'the highest rank there is'}</p>
    <div class="deck-cards">
      ${card('S', 'service', 'The Sea Service', done ? 'Every action won · fight any again for its stars' : `Ten actions, one career · next: ${esc(offer.title)}`)}
      ${card('D', 'daily', `Daily Engagement #${dailyNumber(v.dateKey)}`, today ? `Fought today · ${starsText(today.stars)}${today.won ? ` · ${today.rating.toLocaleString('en')}` : ''}` : `Standing order: ${esc(describeCommendation(engagementCommendations(v.dateKey)[1]).toLowerCase())}`)}
      ${card('H', 'historic', 'Historical Actions', 'Twenty-two staged actions · any ship, any side · the top ten')}
      ${card('R', 'record', 'Service Record', v.record.battles ? `${v.record.battles} battles · ${v.record.victories} won · ${v.record.prizes} prizes` : 'Rank, stars and engagements')}
    </div>
    <p class="deck-foot"><button class="btn" data-act="top" data-nav>Top ten sailors</button> <button class="btn" data-act="help" data-nav>How to command</button>${v.hosted ? ' <button class="btn" data-act="hall" data-nav>← Back to the Hall</button>' : ''}</p>
  </div>`;
}

function briefing(v, action) {
  const entry = entryOf(v.service, action);
  const open = isOpen(v.service, action);
  return `<div class="brief-kicker">Action ${action.number} · ${action.year} · ${esc(SCENARIOS[action.scenarioId].name)}</div>
    <h2 class="brief-title">${esc(action.title)}</h2>
    <p>${esc(action.briefing)}</p>
    <p class="brief-ship">You command ${shipLine(action.scenarioId, action.ship)}. Against you: ${opponents(action.scenarioId, action.ship)}.</p>
    <div class="brief-label">Commendations</div>
    ${commendationList(action.commendations, entry.stars)}
    ${open
      ? `<p><button class="btn primary" data-act="launch-action" data-nav>${entry.won ? 'Fight it again' : 'Take command'}</button></p>`
      : `<p class="brief-locked">Win action ${action.number - 1} to open this one.</p>`}`;
}

function servicePage(v) {
  const rows = ACTIONS.map((a) => {
    const entry = entryOf(v.service, a);
    const open = isOpen(v.service, a);
    const selected = a.id === v.selected.id;
    const state = open ? `<span class="row-stars" aria-label="${entry.stars.filter(Boolean).length} of 3 stars">${starsText(entry.stars)}</span>` : '<span class="row-lock">sealed orders</span>';
    return `<li><button class="action-row${open ? '' : ' locked'}${selected ? ' selected' : ''}" data-act="select" data-id="${a.id}" aria-pressed="${selected}" data-nav>
      <span class="row-no">${a.number}</span><span class="row-name">${esc(a.title)}</span>${state}</button></li>`;
  }).join('');
  return `<div class="panel rivets deck" data-deck="service">
    ${pageHead('The Sea Service', `★ ${serviceStars(v.service)} / ${SERVICE_STARS}`)}
    <div class="service">
      <ol class="action-list">${rows}</ol>
      <section class="briefing" aria-live="polite">${briefing(v, v.selected)}</section>
    </div>
  </div>`;
}

function dailyPage(v) {
  const day = engagementFor(v.dateKey);
  const commendations = engagementCommendations(v.dateKey);
  const today = v.engagements.days[v.dateKey];
  const recent = Object.entries(v.engagements.days)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 7)
    .map(([key, d]) => `<li><span>#${d.number}</span><span>${starsText(d.stars)}</span><span>${d.won ? d.rating.toLocaleString('en') : 'not won'}</span><span class="dim">${esc(longDate(key))}</span></li>`)
    .join('');
  return `<div class="panel rivets deck" data-deck="daily">
    ${pageHead(`Daily Engagement #${dailyNumber(v.dateKey)}`, esc(longDate(v.dateKey)))}
    <p>The same action for every captain today: ${esc(SCENARIOS[day.scenarioId].name)}, ${PLAYABLE.find((f) => f.id === day.scenarioId)?.year ?? ''}. You command ${shipLine(day.scenarioId, day.ship)}; against you, ${opponents(day.scenarioId, day.ship)}. Your first engagement of the day is the one on record; fight it again as often as you like.</p>
    <div class="brief-label">${WEEKDAYS[weekdayOf(v.dateKey)]}’s standing order</div>
    <div class="standing-order">${esc(describeCommendation(commendations[1]))}</div>
    <div class="brief-label">Commendations</div>
    ${commendationList(commendations, today?.stars)}
    ${today ? `<p class="flown">On record today: ${starsText(today.stars)} · ${today.won ? `rating ${today.rating.toLocaleString('en')}` : 'not won'} · ${today.turns} turns</p>` : ''}
    <p><button class="btn primary" data-act="launch-daily" data-nav>${today ? 'Fight it again' : 'Take command'}</button></p>
    ${recent ? `<div class="brief-label">Recent engagements</div><ol class="recent">${recent}</ol>` : ''}
  </div>`;
}

function recordPage(v) {
  const stars = serviceStars(v.service);
  const rank = rankFor(stars);
  const next = nextRank(stars);
  const best = Math.max(0, ...Object.values(v.engagements.days).map((d) => (d.won ? d.rating : 0)));
  const toNext = next ? Math.round(((stars - rank.stars) / (next.stars - rank.stars)) * 100) : 100;
  const cell = (value, label) => `<div class="record-cell"><b>${value.toLocaleString('en')}</b><span>${label}</span></div>`;
  const ladder = RANKS.map((r) => `<li class="${stars >= r.stars ? 'reached' : ''}${r === rank ? ' current' : ''}"><span>${esc(r.title)}</span><span>★ ${r.stars}</span></li>`).join('');
  return `<div class="panel rivets deck" data-deck="record">
    ${pageHead('Service Record')}
    <div class="record">
      <div>
        <div class="record-title">${esc(rank.title)}</div>
        <div class="record-bar" role="img" aria-label="${stars} of ${SERVICE_STARS} stars"><i style="width:${toNext}%"></i></div>
        <p class="dim">★ ${stars} / ${SERVICE_STARS} · ${next ? `${next.stars - stars} more stars for ${esc(next.title)}` : 'every rank reached'}</p>
        <ol class="rank-ladder">${ladder}</ol>
      </div>
      <div class="record-grid">
        ${cell(v.record.battles, 'battles fought')}
        ${cell(v.record.victories, 'victories')}
        ${cell(v.record.prizes, 'prizes taken')}
        ${cell(v.record.rakes, 'rakes')}
        ${cell(v.record.broadsides, 'broadsides fired')}
        ${cell(v.record.engagements, 'daily engagements')}
        ${cell(best, 'best engagement rating')}
      </div>
    </div>
    <p class="tag">Stars come from the Sea Service’s commendations, and a rank once reached is yours for good.</p>
  </div>`;
}

const PAGES = { menu: menuPage, service: servicePage, daily: dailyPage, record: recordPage };

/**
 * @param {{ host: HTMLElement, hosted: boolean, onLaunch: (plan: object) => void,
 *   onHistoric: () => void, onTopTen: () => void, onHelp: () => void, onLeave: () => void,
 *   open: () => void, dateKey?: () => string }} options
 */
export function createDeck(options) {
  const { host } = options;
  const dateKey = options.dateKey ?? (() => localDateKey());
  let page = 'menu';
  let selected = ACTIONS[0];

  function view() {
    return {
      service: loadService(),
      engagements: loadEngagements(),
      record: loadRecord(),
      dateKey: dateKey(),
      hosted: options.hosted,
      selected,
    };
  }

  const targets = () => [...host.querySelectorAll('[data-nav]')].filter((el) => !el.disabled);

  function show(next = 'menu', focus = null) {
    const from = page;
    page = next;
    if (page === 'service') selected = actionToOffer(loadService());
    host.innerHTML = PAGES[page](view());
    options.open();
    const target = (focus && host.querySelector(focus))
      || (page === 'menu' && from !== 'menu' && host.querySelector(`[data-page="${from}"]`))
      || (page === 'service' && host.querySelector('.action-row.selected'))
      || host.querySelector('.btn.primary, .deck-card')
      || targets()[0];
    setTimeout(() => target?.focus({ preventScroll: true }), 30);
  }

  function select(id) {
    const action = ACTIONS.find((a) => a.id === id);
    if (!action || action === selected) return;
    selected = action;
    for (const row of host.querySelectorAll('.action-row')) {
      const on = row.dataset.id === id;
      row.classList.toggle('selected', on);
      row.setAttribute('aria-pressed', String(on));
    }
    host.querySelector('.briefing').innerHTML = briefing(view(), action);
  }

  function act(button) {
    switch (button.dataset.act) {
      case 'open':
        if (button.dataset.page === 'historic') options.onHistoric();
        else show(button.dataset.page);
        break;
      case 'back':
        show('menu');
        break;
      case 'select':
        select(button.dataset.id);
        break;
      case 'launch-action':
        options.onLaunch(planAction(selected));
        break;
      case 'launch-daily':
        options.onLaunch(planDaily(dateKey()));
        break;
      case 'top':
        options.onTopTen();
        break;
      case 'help':
        options.onHelp();
        break;
      case 'hall':
        options.onLeave();
        break;
    }
  }

  host.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (button && host.contains(button) && host.querySelector('[data-deck]')) act(button);
  });
  host.addEventListener('focusin', (event) => {
    const row = event.target.closest('.action-row');
    if (row) select(row.dataset.id);
  });

  function moveFocus(step) {
    const list = targets();
    if (!list.length) return;
    const at = list.indexOf(document.activeElement);
    list[at === -1 ? 0 : (at + step + list.length) % list.length].focus({ preventScroll: true });
  }

  /** Keys while the deck is showing; true when the deck used the key. */
  function handleKey(event) {
    if (!host.querySelector('[data-deck]') || event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === 'Escape' && page !== 'menu') {
      show('menu');
      return true;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      moveFocus(1);
      return true;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      moveFocus(-1);
      return true;
    }
    const shortcut = MENU_KEYS[event.key.toLowerCase()];
    if (page === 'menu' && shortcut) {
      if (shortcut === 'historic') options.onHistoric();
      else show(shortcut);
      return true;
    }
    return false;
  }

  host.addEventListener('keydown', (event) => {
    if (handleKey(event)) event.preventDefault();
  });

  return {
    show,
    get page() {
      return host.querySelector('[data-deck]') ? page : null;
    },
  };
}
