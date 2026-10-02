// Deep Space Command — the game menu on the title screen and the pages behind it: the Frontier
// Tour with each sortie's briefing, the Daily Patrol, a Free Mission and the Service Record. The
// deck renders into one host element and reports only two things outward: a plan to launch and
// the wish to leave for the Hall. Escape on a page goes back to the menu; on the menu it is left
// alone, so the Hall's bridge can take the player home.

import { describeCommendation } from './orders.js';
import { SORTIES, TOUR_STARS, PATROL_SETUP } from './missions.js';
import { dailyNumber, localDateKey, standingOrder, patrolCommendations, weekdayOf } from './daily.js';
import { RANKS, nextRank, rankFor, tourStars } from './ranks.js';
import { FREE_LEVELS, planFreeMission, planPatrol, planSortie } from './plans.js';
import { loadPatrols, loadRecord, loadTour } from './store.js';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MENU_KEYS = { t: 'tour', d: 'patrol', f: 'free', s: 'record' };

const esc = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const starsText = (stars) => stars.map((earned) => (earned ? '★' : '☆')).join('');
const words = (n) => ['no', 'one', 'two', 'three', 'four', 'five'][n] ?? String(n);

function longDate(key) {
  const [, month, day] = key.split('-').map(Number);
  return `${WEEKDAYS[weekdayOf(key)]} ${day} ${MONTHS[month - 1]}`;
}

/** A sortie is open once the one before it has been won. */
function sortieOpen(tour, sortie) {
  if (sortie.number === 1) return true;
  const before = SORTIES[sortie.number - 2];
  return Boolean(tour.sorties[before.id]?.won);
}

function sortieEntry(tour, sortie) {
  return tour.sorties[sortie.id] ?? { won: false, stars: [false, false, false] };
}

/** The sortie to offer first: the earliest open one not yet won, else the last one. */
function sortieToOffer(tour) {
  return SORTIES.find((sortie) => sortieOpen(tour, sortie) && !sortieEntry(tour, sortie).won) ?? SORTIES[SORTIES.length - 1];
}

function pageHead(title, meta = '') {
  return `
    <div class="deck-head">
      <button class="deck-back" data-action="back" data-nav>← Game menu</button>
      <h2>${esc(title)}</h2>
      <span class="deck-meta">${meta}</span>
    </div>`;
}

function commendationList(commendations, earned = []) {
  return `<ul class="deck-orders">${commendations
    .map((c, i) => `<li class="${earned[i] ? 'earned' : ''}"><span class="mark" aria-hidden="true">${earned[i] ? '★' : '☆'}</span>${esc(describeCommendation(c))}${earned[i] ? '<span class="sr-only"> (earned)</span>' : ''}</li>`)
    .join('')}</ul>`;
}

function menuPage(view) {
  const { tour, patrols, record, dateKey, hosted } = view;
  const stars = tourStars(tour);
  const rank = rankFor(stars);
  const next = nextRank(stars);
  const offer = sortieToOffer(tour);
  const tourDone = SORTIES.every((sortie) => sortieEntry(tour, sortie).won);
  const today = patrols.days[dateKey];
  const card = (key, page, title, desc) => `
    <button class="deck-card" data-action="open" data-page="${page}" data-nav>
      <span class="card-key" aria-hidden="true">${key}</span>
      <span class="card-title">${esc(title)}</span>
      <span class="card-desc">${desc}</span>
    </button>`;
  return `
    <div class="deck-rank">
      <span class="rank-title">${esc(rank.title)}</span>
      <span class="rank-stars">★ ${stars} / ${TOUR_STARS}</span>
      <span class="rank-next">${next ? `${next.stars - stars} more for ${esc(next.title)}` : 'The highest rank there is'}</span>
    </div>
    <div class="deck-cards">
      ${card('T', 'tour', 'Frontier Tour', tourDone ? 'Tour complete · fly any sortie again for its stars' : `Ten sorties · next: ${esc(offer.name)}`)}
      ${card('D', 'patrol', `Daily Patrol #${dailyNumber(dateKey)}`, today ? `Flown today · ${starsText(today.stars)}${today.won ? ` · ${today.rating.toLocaleString('en')}` : ''}` : `Standing order: ${esc(describeCommendation(standingOrder(dateKey)).toLowerCase())}`)}
      ${card('F', 'free', 'Free Mission', 'Novice, Standard or Expert · a new galaxy each time')}
      ${card('S', 'record', 'Service Record', record.missions ? `${record.missions} missions · ${record.victories} won` : 'Rank, stars and patrols')}
    </div>
    <div id="title-help">type commands · <kbd>?</kbd> or <kbd>help</kbd> for reference · <kbd>V</kbd> to switch views · <kbd>!</kbd> override</div>
    ${hosted ? '<button class="deck-hall" data-action="hall" data-nav>← Back to the Hall</button>' : ''}`;
}

function sortieBriefing(tour, sortie) {
  const entry = sortieEntry(tour, sortie);
  const open = sortieOpen(tour, sortie);
  const { klingons, starbases, stardates } = sortie.setup;
  return `
    <div class="brief-kicker">Sortie ${sortie.number} · ${klingons} ships · ${words(starbases)} starbase${starbases === 1 ? '' : 's'} · ${stardates} stardates</div>
    <h3>${esc(sortie.name)}</h3>
    <p>${esc(sortie.briefing)}</p>
    <div class="brief-label">Commendations</div>
    ${commendationList(sortie.commendations, entry.stars)}
    ${open
      ? `<button class="deck-launch" data-action="launch-sortie" data-nav>▶ ${entry.won ? 'FLY IT AGAIN' : 'LAUNCH SORTIE'} ◀</button>`
      : `<p class="brief-locked">Win sortie ${sortie.number - 1} to open this one.</p>`}`;
}

function tourPage(view) {
  const { tour, selectedSortie } = view;
  const rows = SORTIES.map((sortie) => {
    const entry = sortieEntry(tour, sortie);
    const open = sortieOpen(tour, sortie);
    const selected = sortie.id === selectedSortie.id;
    const state = open ? `<span class="row-stars" aria-label="${entry.stars.filter(Boolean).length} of 3 stars">${starsText(entry.stars)}</span>` : '<span class="row-lock">locked</span>';
    return `
      <li><button class="sortie-row${open ? '' : ' locked'}${selected ? ' selected' : ''}" data-action="select-sortie" data-id="${sortie.id}" aria-pressed="${selected}" data-nav>
        <span class="row-no">${String(sortie.number).padStart(2, '0')}</span>
        <span class="row-name">${esc(sortie.name)}</span>
        ${state}
      </button></li>`;
  }).join('');
  return `
    ${pageHead('Frontier Tour', `★ ${tourStars(tour)} / ${TOUR_STARS}`)}
    <div class="tour">
      <ol class="sortie-list">${rows}</ol>
      <section class="briefing" aria-live="polite">${sortieBriefing(tour, selectedSortie)}</section>
    </div>`;
}

function recentPatrols(patrols, limit) {
  return Object.entries(patrols.days)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, limit);
}

function patrolPage(view) {
  const { patrols, dateKey } = view;
  const today = patrols.days[dateKey];
  const commendations = patrolCommendations(dateKey);
  const weekday = WEEKDAYS[weekdayOf(dateKey)];
  const recent = recentPatrols(patrols, 7)
    .map(([key, day]) => `<li><span>#${day.number}</span><span>${starsText(day.stars)}</span><span>${day.won ? day.rating.toLocaleString('en') : 'not cleared'}</span><span class="dim">${esc(longDate(key))}</span></li>`)
    .join('');
  return `
    ${pageHead(`Daily Patrol #${dailyNumber(dateKey)}`, esc(longDate(dateKey)))}
    <div class="patrol">
      <p>The same sector for every captain today: ${PATROL_SETUP.klingons} ships, ${words(PATROL_SETUP.starbases)} starbases, ${PATROL_SETUP.stardates} stardates. Your first patrol of the day is the one on record; fly it again as often as you like.</p>
      <div class="brief-label">${weekday}’s standing order</div>
      <div class="standing-order">${esc(describeCommendation(commendations[1]))}</div>
      <div class="brief-label">Commendations</div>
      ${commendationList(commendations, today?.stars)}
      ${today ? `<p class="patrol-flown">On record today: ${starsText(today.stars)} · ${today.won ? `rating ${today.rating.toLocaleString('en')}` : 'not cleared'} · ${today.orders} orders</p>` : ''}
      <button class="deck-launch" data-action="launch-patrol" data-nav>▶ ${today ? 'FLY IT AGAIN' : 'LAUNCH PATROL'} ◀</button>
      ${recent ? `<div class="brief-label">Recent patrols</div><ol class="patrol-recent">${recent}</ol>` : ''}
    </div>`;
}

function freePage(view) {
  const buttons = FREE_LEVELS.map((level) => `
    <button class="diff-btn${level.key === view.freeLevel ? ' active' : ''}" data-action="level" data-level="${level.key}" aria-pressed="${level.key === view.freeLevel}" data-nav>
      <span class="diff-label">${level.label.toUpperCase()}</span><span class="diff-desc">${level.desc}</span>
    </button>`).join('');
  return `
    ${pageHead('Free Mission')}
    <p class="deck-lede">A new galaxy every time, at the level you choose. Free missions earn no stars; they count in your service record.</p>
    <div id="difficulty-picker">${buttons}</div>
    <button id="start-btn" class="deck-launch" data-action="launch-free" data-nav>▶ BEGIN MISSION ◀</button>`;
}

function recordPage(view) {
  const { tour, patrols, record } = view;
  const stars = tourStars(tour);
  const rank = rankFor(stars);
  const next = nextRank(stars);
  const best = Math.max(0, ...Object.values(patrols.days).map((day) => (day.won ? day.rating : 0)));
  const toNext = next ? Math.round(((stars - rank.stars) / (next.stars - rank.stars)) * 100) : 100;
  const counter = (value, label) => `<div class="record-cell"><b>${value.toLocaleString('en')}</b><span>${label}</span></div>`;
  const ladder = RANKS.map((entry) => `<li class="${stars >= entry.stars ? 'reached' : ''}${entry === rank ? ' current' : ''}"><span>${esc(entry.title)}</span><span>★ ${entry.stars}</span></li>`).join('');
  return `
    ${pageHead('Service Record')}
    <div class="record">
      <div class="record-rank">
        <div class="record-title">${esc(rank.title)}</div>
        <div class="record-bar" role="img" aria-label="${stars} of ${TOUR_STARS} stars"><div style="width:${toNext}%"></div></div>
        <div class="record-next">★ ${stars} / ${TOUR_STARS} · ${next ? `${next.stars - stars} more stars for ${esc(next.title)}` : 'every rank reached'}</div>
        <ol class="rank-ladder">${ladder}</ol>
      </div>
      <div class="record-grid">
        ${counter(record.missions, 'missions flown')}
        ${counter(record.victories, 'victories')}
        ${counter(record.shipsDestroyed, 'hostile ships disabled')}
        ${counter(record.orders, 'orders given')}
        ${counter(record.patrolsFlown, 'daily patrols')}
        ${counter(best, 'best patrol rating')}
      </div>
    </div>
    <p class="deck-lede">Stars come from the Frontier Tour's commendations, and a rank once reached is yours for good. Missions flown with the Captain's Override are not recorded.</p>`;
}

const PAGES = { menu: menuPage, tour: tourPage, patrol: patrolPage, free: freePage, record: recordPage };

/**
 * @param {{ host: HTMLElement, hosted: boolean, freeLevel: string, freeSeed?: number,
 *   onLaunch: (plan: object) => void, onLeave: () => void, onPage?: (page: string) => void,
 *   dateKey?: () => string }} options
 */
export function createDeck(options) {
  const { host, onLaunch, onLeave } = options;
  const dateKey = options.dateKey ?? (() => localDateKey());
  let page = 'menu';
  let freeLevel = options.freeLevel;
  let selectedSortie = null;
  let cameFrom = null;

  function view() {
    const tour = loadTour();
    selectedSortie ??= sortieToOffer(tour);
    return {
      tour,
      patrols: loadPatrols(),
      record: loadRecord(),
      dateKey: dateKey(),
      hosted: options.hosted,
      selectedSortie,
      freeLevel,
    };
  }

  function navTargets() {
    return [...host.querySelectorAll('[data-nav]')].filter((el) => !el.disabled);
  }

  function focusFirst(selector) {
    const target = (selector && host.querySelector(selector)) || host.querySelector('.deck-launch, .deck-card') || navTargets()[0];
    target?.focus({ preventScroll: true });
  }

  function show(next, focusSelector) {
    cameFrom = page;
    page = next;
    // The tour always opens on the sortie that comes next, not the last one looked at.
    if (page === 'tour') selectedSortie = sortieToOffer(loadTour());
    host.dataset.page = page;
    host.innerHTML = PAGES[page](view());
    options.onPage?.(page);
    if (page === 'menu' && cameFrom !== 'menu') focusFirst(`[data-page="${cameFrom}"]`);
    else if (page === 'tour') focusFirst('.sortie-row.selected');
    else focusFirst(focusSelector);
  }

  function selectSortie(id) {
    const sortie = SORTIES.find((candidate) => candidate.id === id);
    if (!sortie || sortie === selectedSortie) return;
    selectedSortie = sortie;
    for (const row of host.querySelectorAll('.sortie-row')) {
      const selected = row.dataset.id === id;
      row.classList.toggle('selected', selected);
      row.setAttribute('aria-pressed', String(selected));
    }
    host.querySelector('.briefing').innerHTML = sortieBriefing(loadTour(), sortie);
  }

  function act(button) {
    switch (button.dataset.action) {
      case 'open':
        show(button.dataset.page);
        break;
      case 'back':
        show('menu');
        break;
      case 'hall':
        onLeave();
        break;
      case 'select-sortie':
        selectSortie(button.dataset.id);
        break;
      case 'launch-sortie':
        onLaunch(planSortie(selectedSortie));
        break;
      case 'launch-patrol':
        onLaunch(planPatrol(dateKey()));
        break;
      case 'level':
        freeLevel = button.dataset.level;
        show('free', `[data-level="${freeLevel}"]`);
        break;
      case 'launch-free':
        onLaunch(planFreeMission(freeLevel, options.freeSeed));
        break;
    }
  }

  host.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (button && host.contains(button)) act(button);
  });
  // Moving through the tour's list with the keyboard shows each briefing as it is reached.
  host.addEventListener('focusin', (event) => {
    const row = event.target.closest('.sortie-row');
    if (row) selectSortie(row.dataset.id);
  });

  function moveFocus(step) {
    const targets = navTargets();
    if (!targets.length) return;
    const at = targets.indexOf(document.activeElement);
    const next = at === -1 ? 0 : (at + step + targets.length) % targets.length;
    targets[next].focus({ preventScroll: true });
  }

  /** Keys while the title screen is up; true when the deck used the key. */
  function handleKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
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
      show(shortcut);
      return true;
    }
    // Enter and Space reach the focused button natively; with nothing focused, they take the
    // page's main way forward.
    if ((event.key === 'Enter' || event.key === ' ') && !host.contains(document.activeElement)) {
      focusFirst();
      return true;
    }
    return false;
  }

  return {
    show,
    handleKey,
    get page() {
      return page;
    },
  };
}
