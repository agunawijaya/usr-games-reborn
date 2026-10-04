// Talon's Shadow — the expedition desk: the game menu (eight regions, the Daily Flight, the field
// book, records and how to play), the briefing before a flight, the goal, harvest and contracts on
// show while it lasts, the report after it, and the ending once the last region is cleared. The
// game itself stays in index.html; the desk starts each flight through `window.TalonGame` with
// the region's rules (rules.mjs) and listens to what happens.

import { PAGES } from './book.mjs';
import { challengeById, challengeRegion, challengeRules, CHALLENGES } from './challenges.mjs';
import { CONTRACTS, STAMPS_IN_ALL, stampKey } from './contracts.mjs';
import { dailyFlight, dailyNumber, dailyShareLine, localDateKey, seededRandom } from './daily.mjs';
import { LAYOUT_NAMES } from './fences.mjs';
import { followHall, hostedInHall, install, leaveForHall, offerPoster, reportChallenge, reportFlight, setOnDesk } from './hall.mjs';
import { freshProgress, recordChallenge, recordFlight } from './progress.mjs';
import { expeditionComplete, isCleared, openRegions, REGIONS, regionById } from './regions.mjs';
import { flightRules } from './rules.mjs';
import { loadSaved, save } from './store.mjs';

const menu = document.getElementById('deskMenu');
const run = document.getElementById('deskRun');
const report = document.getElementById('deskReport');
const subtitle = document.getElementById('deskSubtitle');

let progress = loadSaved('progress', freshProgress);
/** @type {null | { region: import('./regions.mjs').Region, daily: string | null, number: number,
 *   startedAt: number, pausedAt: number | null, fruit: number, dodges: number, locks: number,
 *   rivalsAte: number, rivalsTaken: number, rivalsCutOff: number, left: number, bare: boolean,
 *   toldEnough: boolean, cause: string | null }} */
let flight = null;
/** Refreshes the line under the field while a flight lasts (the tail's countdown). */
let runTicker = 0;
let view = 'expedition';
let posterSent = false;

/** Today's date, or the one in `?date=YYYY-MM-DD` when testing a Daily Flight. */
function todayKey() {
  const asked = new URLSearchParams(location.search).get('date');
  return asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : localDateKey();
}

const deskOpenedAt = performance.now();

/** A small element builder: attributes, listeners and children in one call. */
function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (name.startsWith('on') && typeof value === 'function') node.addEventListener(name.slice(2), value);
    else if (name === 'class') node.className = value;
    else node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

/** A line over the field for the moments that change a flight: its start, enough to clear, a bare field. */
const banner = el('p', { class: 'desk-banner', role: 'status', 'data-testid': 'desk-banner', hidden: true });
document.querySelector('.canvas-wrap')?.append(banner);
let bannerTimer = 0;

function say(text, ms = 0) {
  window.clearTimeout(bannerTimer);
  banner.textContent = text;
  banner.hidden = false;
  if (ms) bannerTimer = window.setTimeout(() => (banner.hidden = true), ms);
}

const stampRow = (regionId) =>
  (CONTRACTS[regionId] ?? []).map((c) => (progress.stamps.includes(stampKey(regionId, c)) ? '◆' : '◇')).join('');

const rivalsText = (n) => (n === 1 ? 'one rival snake' : `${n} rival snakes`);

// ------------------------------------------------------------------ the desk (game menu)

function showDesk(next = 'expedition') {
  view = next;
  flight = null;
  window.clearInterval(runTicker);
  report.hidden = true;
  run.hidden = true;
  banner.hidden = true;
  menu.hidden = false;
  menu.classList.remove('desk-loading');
  const today = dailyFlight(todayKey());
  window.TalonGame.showMenu(regionById(progress.lastRegion).theme ?? today.region.theme);
  subtitle.textContent = 'An expedition under the eagle’s wing';
  setOnDesk(next === 'expedition');
  menu.replaceChildren(deskView(next));
  requestAnimationFrame(() =>
    (menu.querySelector('[data-autofocus]') ?? menu.querySelector('button:not([disabled])'))?.focus(),
  );
}

function deskView(which) {
  if (which === 'book') return bookView();
  if (which === 'records') return recordsView();
  if (which === 'help') return helpView();
  if (which === 'ending') return endingView();
  if (which === 'challenges') return challengesView();
  if (which.startsWith('chal:')) return challengeBriefing(challengeById(which.slice(5)));
  if (which.startsWith('brief:')) return briefingView(regionById(which.slice(6)));
  return expeditionView();
}

function page(title, ...content) {
  return el(
    'section',
    { class: 'desk-page', 'aria-labelledby': 'desk-page-title' },
    el(
      'header',
      { class: 'desk-head' },
      el('button', { class: 'desk-btn', type: 'button', onclick: () => showDesk(), 'data-testid': 'desk-back' }, '← Expedition'),
      el('h1', { id: 'desk-page-title' }, title),
    ),
    ...content,
  );
}

function expeditionView() {
  const open = openRegions(progress.bestHaul);
  const today = dailyFlight(todayKey());
  const played = progress.dailies[today.key];
  // The region to fly next: the first open one not yet cleared (or the last, once all are).
  const next = REGIONS.find((r) => open.includes(r.id) && !isCleared(r, progress.bestHaul)) ?? REGIONS[REGIONS.length - 1];
  const regionCard = (region, index) => {
    const isOpen = open.includes(region.id);
    const best = progress.bestHaul[region.id];
    const cleared = isCleared(region, progress.bestHaul);
    const before = REGIONS[index - 1];
    return el(
      'button',
      {
        'data-autofocus': region === next ? true : null,
        class: `desk-region${isOpen ? '' : ' desk-region-locked'}${cleared ? ' desk-region-cleared' : ''}${region.id === progress.lastRegion ? ' desk-region-last' : ''}`,
        type: 'button',
        disabled: !isOpen,
        onclick: () => showDesk(`brief:${region.id}`),
        'data-testid': `desk-region-${region.id}`,
        'aria-label': `${region.name}${isOpen ? (cleared ? ', cleared' : '') : ', closed'}`,
      },
      el('span', { class: 'desk-swatch', style: `background:${window.TalonGame.themes[region.theme]?.swatch ?? '#888'}` }),
      el('b', {}, `${index + 1}. ${region.name}`, cleared ? el('span', { class: 'desk-cleared' }, ' ✓') : null),
      el('span', {}, region.bird),
      isOpen
        ? el(
            'span',
            { class: 'desk-small' },
            cleared ? `cleared · best 🍎${best}` : `bring home ${region.goal}${best === undefined ? '' : ` · best 🍎${best}`}`,
            ' · ',
            el('span', { class: 'desk-stamps', 'aria-label': 'stamps' }, stampRow(region.id)),
          )
        : el('span', { class: 'desk-small' }, `Clear ${before.name} to open`),
    );
  };
  const complete = expeditionComplete(progress.bestHaul);
  return el(
    'section',
    { class: 'desk-page desk-expedition', 'aria-labelledby': 'desk-title' },
    el('h1', { id: 'desk-title', class: 'desk-title' }, 'Talon’s Shadow'),
    el('p', { class: 'desk-tag' }, 'Gather the fruit. Watch the shadow. Slip away over any edge.'),
    el(
      'div',
      { class: 'desk-daily' },
      el(
        'div',
        {},
        el('b', {}, `Daily Flight #${today.number} · ${today.region.name}`),
        el('span', {}, played ? `Today: ${played.escaped ? 'escaped' : 'caught'} with 🍎${played.fruit}. Fly again for fun.` : 'The same field, rivals and bird for everyone today.'),
        el('span', { class: 'desk-small' }, 'A flight of its own: it does not clear or open regions of the expedition.'),
      ),
      el('button', { class: 'desk-btn', type: 'button', onclick: () => startFlight(today.region, today.key), 'data-testid': 'desk-daily' }, 'Fly today’s flight'),
    ),
    el(
      'h2',
      {},
      'The expedition',
      complete ? el('button', { class: 'desk-btn desk-btn-ending', type: 'button', onclick: () => showDesk('ending'), 'data-testid': 'desk-ending' }, 'Complete: read the ending') : null,
    ),
    el('div', { class: 'desk-regions' }, REGIONS.map(regionCard)),
    el(
      'div',
      { class: 'desk-links' },
      el('span', { class: 'desk-small' }, `${REGIONS.filter((r) => isCleared(r, progress.bestHaul)).length}/${REGIONS.length} cleared · ${progress.stamps.length}/${STAMPS_IN_ALL} stamps · ${progress.pages.length}/${PAGES.length} pages`),
      el('button', { class: 'desk-btn', type: 'button', onclick: () => showDesk('challenges'), 'data-testid': 'desk-challenges' }, 'Challenges'),
      el('button', { class: 'desk-btn', type: 'button', onclick: () => showDesk('book'), 'data-testid': 'desk-book' }, 'Field book'),
      el('button', { class: 'desk-btn', type: 'button', onclick: () => showDesk('records'), 'data-testid': 'desk-records' }, 'Records'),
      el('button', { class: 'desk-btn', type: 'button', onclick: () => showDesk('help'), 'data-testid': 'desk-help' }, 'How to play'),
    ),
  );
}

function briefingView(region) {
  const best = progress.bestHaul[region.id];
  const index = REGIONS.indexOf(region);
  const next = REGIONS[index + 1];
  return page(
    region.name,
    el('p', { class: 'desk-lead' }, el('b', {}, region.bird), ` — ${region.temper} `, `The fruit here: ${region.fruit.toLowerCase()}.`),
    el(
      'p',
      { class: 'desk-goal', 'data-testid': 'desk-goal' },
      el('b', {}, `Bring home ${region.goal} fruit to clear ${region.name}`),
      next ? ` and open ${next.name}.` : ' and end the expedition.',
    ),
    el('p', { class: 'desk-small' }, `The harvest: ${region.harvest} fruit, shared with ${rivalsText(region.rivals)}. The field: ${LAYOUT_NAMES[region.fence]}. The edges open when the last fruit is gone.`),
    el('p', { class: 'desk-small' }, best === undefined ? 'You have not escaped this region yet.' : `Your best escape here: 🍎${best}.`),
    el('h2', {}, 'Contracts'),
    el(
      'ul',
      { class: 'desk-contracts' },
      (CONTRACTS[region.id] ?? []).map((contract) => {
        const done = progress.stamps.includes(stampKey(region.id, contract));
        return el('li', { class: done ? 'desk-done' : '' }, el('span', { class: 'desk-stamp', 'aria-label': done ? 'stamped' : 'not yet' }, done ? '◆' : '◇'), contract.text);
      }),
    ),
    el(
      'div',
      { class: 'desk-row' },
      el('button', { class: 'desk-btn desk-btn-primary', type: 'button', onclick: () => startFlight(region, null), 'data-autofocus': true, 'data-testid': 'desk-fly' }, 'Fly ', el('kbd', {}, 'Enter')),
    ),
  );
}

function bookView() {
  return page(
    'Field book',
    el('p', { class: 'desk-lead' }, `${progress.pages.length} of ${PAGES.length} pages. A bird goes in once you dodge one of its dives; a fruit once you gather one.`),
    el(
      'div',
      { class: 'desk-book' },
      PAGES.map((p) => {
        const found = progress.pages.includes(p.key);
        return el(
          'article',
          { class: `desk-entry${found ? '' : ' desk-entry-unseen'}` },
          el('span', { class: 'desk-small' }, `${p.region.name} · ${p.kind}`),
          el('b', {}, found ? p.name : '—'),
          el('p', {}, found ? p.note : p.kind === 'bird' ? `Dodge one of its dives in ${p.region.name}.` : `Gather one in ${p.region.name}.`),
        );
      }),
    ),
  );
}

function recordsView() {
  const days = Object.entries(progress.dailies).sort(([a], [b]) => b.localeCompare(a)).slice(0, 10);
  return page(
    'Records',
    el(
      'div',
      { class: 'desk-records' },
      el(
        'section',
        {},
        el('h2', {}, 'Best escapes'),
        el(
          'ol',
          {},
          REGIONS.map((r) =>
            el('li', {}, el('b', {}, r.name), ` ${progress.bestHaul[r.id] === undefined ? '—' : `🍎${progress.bestHaul[r.id]}`} of ${r.goal}${isCleared(r, progress.bestHaul) ? ' ✓' : ''} · ${stampRow(r.id)}`),
          ),
        ),
      ),
      el(
        'section',
        {},
        el('h2', {}, 'Daily Flights'),
        days.length
          ? el('ol', {}, days.map(([key, d]) => el('li', {}, el('b', {}, `#${dailyNumber(key)}`), ` ${d.escaped ? 'escaped' : 'caught'} with 🍎${d.fruit} · 🪶${d.dodges}`)))
          : el('p', {}, 'None yet. Today’s is on the expedition page.'),
      ),
      el(
        'section',
        {},
        el('h2', {}, 'All told'),
        el('p', {}, `${progress.flights} flights · ${progress.escapes} escapes · ${progress.catches} times caught`),
        el('p', {}, `${progress.fruitSecured} fruit brought home · ${progress.divesDodged} dives dodged`),
        el('p', {}, `${progress.stamps.length}/${STAMPS_IN_ALL} stamps · ${progress.pages.length}/${PAGES.length} field-book pages · ${progress.dailyFlights} Daily Flights`),
      ),
    ),
  );
}

function helpView() {
  const part = (title, ...lines) => el('section', {}, el('h2', {}, title), lines.map((line) => el('p', {}, line)));
  return page(
    'How to play',
    el(
      'div',
      { class: 'desk-help' },
      part(
        'The flight',
        'Steer the snake with W A S D or the arrow keys and gather fruit. While any fruit is left the edges are closed and the snake slides along them; once the last fruit is gone every edge opens, and touching one takes the snake off the field with everything it carries. A flight ends when you get away or when the bird catches you.',
        'The bird hunts whichever snake is nearest to it, yours or a rival’s. When a red ring tightens round your head it has locked on to you; when the ring goes, it dives at the spot where your head was. Keep going and do not turn back: a dive that hits nothing is a dive dodged. A rival under the dive is carried off.',
      ),
      part(
        'What you carry',
        'Every fruit makes the snake longer, slower and slower to turn, and the bird hungrier: it locks on sooner and warns for less time. The more you carry, the more an escape is worth, and the harder it is.',
      ),
      part(
        'The harvest',
        'Each region has a set number of fruit, and rival snakes eat from it too. When the last fruit is gone the field is bare, the edges open and glow, and the bird turns ravenous: it dives again and again, and after its third dive each one comes quicker than the last. Head for the nearest edge; once your head is over it, the snake slithers off the field out of the bird’s reach. Fences stand in the field from the River on; nothing slithers through them.',
      ),
      part(
        'The expedition',
        'Eight regions, flown in order. Bring home a region’s goal of fruit to clear it and open the next; clear Midnight, the last, and the expedition is over. Every region has three contracts, stamped for good once met. Dodge a bird’s dive to put it in the field book; gather a fruit to add its page.',
      ),
      part(
        'The Daily Flight',
        'One flight a day, the same for everyone: the region, its fruit, its rivals and the bird’s patience come from the date. Your first flight of the day is the one that counts, and it gives you a line to share.',
      ),
      part(
        'Hunters, rivals and your tail',
        'A bird of the region hunts on foot. It walks after the nearest snake; when it stops and bobs its head, a peck is coming. A peck on your body knocks a fruit loose, and the hunter goes after it: your moment to slip away. A peck on your head ends the flight. It freezes while the flying bird is low overhead.',
        'A head that runs into another snake’s body ends that snake: run into a rival and you are caught; cut across a rival’s path and it may run into you, spilling what it ate.',
        'Space sheds the last third of your tail, at the cost of a third of the fruit you carry. It wriggles where it fell for a few seconds; hunters and the bird may go for it, and a rival running into it is cut off. You can shed again after fifteen seconds.',
      ),
      part('Keys', 'W A S D or arrows: steer. Space: shed the tail. Enter: fly from the briefing. After a flight, R flies again and H goes back to the Hall. Backspace goes back to the expedition from any page; Esc on the expedition page goes back to the Hall.'),
    ),
  );
}

const starRow = (stars) => '★'.repeat(stars) + '☆'.repeat(3 - stars);

function challengesView() {
  return page(
    'Challenges',
    el('p', { class: 'desk-lead' }, 'Single games apart from the expedition, each with its own field and three stars to earn.'),
    el(
      'div',
      { class: 'desk-regions desk-challenges' },
      CHALLENGES.map((challenge, index) => {
        const record = progress.challenges[challenge.id];
        return el(
          'button',
          {
            class: 'desk-region',
            type: 'button',
            onclick: () => showDesk(`chal:${challenge.id}`),
            'data-testid': `desk-challenge-${challenge.id}`,
            'data-autofocus': index === 0 ? true : null,
          },
          el('span', { class: 'desk-swatch', style: `background:${window.TalonGame.themes[challengeRegion(challenge).theme]?.swatch ?? '#888'}` }),
          el('b', {}, challenge.name),
          el('span', {}, challenge.blurb),
          el(
            'span',
            { class: 'desk-small' },
            el('span', { class: 'desk-stars', 'aria-label': `${record?.stars ?? 0} of 3 stars` }, starRow(record?.stars ?? 0)),
            record ? ` · best ${record.best} ${challenge.unit}` : ' · not played yet',
          ),
        );
      }),
    ),
  );
}

function challengeBriefing(challenge) {
  const record = progress.challenges[challenge.id];
  return page(
    challenge.name,
    el('p', { class: 'desk-lead' }, challenge.blurb),
    el('ul', { class: 'desk-rules' }, challenge.rules.map((line) => el('li', {}, line))),
    el('p', { class: 'desk-goal' }, el('b', {}, `Stars at ${challenge.stars.join(' · ')} ${challenge.unit}`)),
    el('p', { class: 'desk-small' }, record ? `Your best: ${record.best} ${challenge.unit} · ${starRow(record.stars)}` : 'Not played yet.'),
    el(
      'div',
      { class: 'desk-row' },
      el('button', { class: 'desk-btn desk-btn-primary', type: 'button', onclick: () => startChallenge(challenge), 'data-autofocus': true, 'data-testid': 'desk-play' }, 'Play ', el('kbd', {}, 'Enter')),
      el('button', { class: 'desk-btn', type: 'button', onclick: () => showDesk('challenges') }, '← Challenges'),
    ),
  );
}

function endingView() {
  const cleared = REGIONS.filter((r) => isCleared(r, progress.bestHaul)).length;
  return page(
    'The expedition’s end',
    el(
      'div',
      { class: 'desk-ending', 'data-testid': 'desk-ending-page' },
      el('p', { class: 'desk-lead' }, 'Eight fields, eight birds, and every one of them left circling an empty patch of ground. The horned owl was the last to watch you go.'),
      el('p', {}, `${cleared} of ${REGIONS.length} regions cleared · ${progress.fruitSecured} fruit brought home · ${progress.divesDodged} dives dodged · ${progress.escapes} escapes in ${progress.flights} flights.`),
      el('p', {}, `${progress.stamps.length} of ${STAMPS_IN_ALL} stamps · ${progress.pages.length} of ${PAGES.length} field-book pages.`),
      el('p', {}, 'Every region stays open. Fly them again for the stamps still blank and the pages still empty, or take the Daily Flight with everyone else.'),
    ),
  );
}

// ------------------------------------------------------------------ a flight

function startFlight(region, dailyKey) {
  const daily = dailyKey ? dailyFlight(dailyKey) : null;
  flight = {
    region,
    daily: dailyKey,
    number: daily?.number ?? 0,
    startedAt: performance.now(),
    pausedAt: null,
    fruit: 0,
    dodges: 0,
    locks: 0,
    rivalsAte: 0,
    rivalsTaken: 0,
    rivalsCutOff: 0,
    cause: null,
    left: region.harvest,
    bare: false,
    toldEnough: false,
  };
  menu.hidden = true;
  report.hidden = true;
  run.hidden = false;
  setOnDesk(false);
  subtitle.textContent = daily ? `Daily Flight #${daily.number} · ${region.name}` : `${region.name} · ${region.bird}`;
  window.TalonGame.begin({
    theme: region.theme,
    tuning: region.tuning,
    rules: flightRules(region),
    random: daily ? seededRandom(daily.seed) : undefined,
    best: progress.bestHaul[region.id] ?? 0,
  });
  say(daily ? 'Gather what you can before it is all gone; then the edges open.' : `Bring home ${region.goal} to clear ${region.name}. The edges open when the last fruit is gone.`, 4000);
  renderRun();
  window.clearInterval(runTicker);
  runTicker = window.setInterval(renderRun, 500);
  (document.activeElement instanceof HTMLElement ? document.activeElement : null)?.blur();
}

function startChallenge(challenge) {
  const region = challengeRegion(challenge);
  flight = {
    challenge,
    region,
    daily: null,
    number: 0,
    startedAt: performance.now(),
    pausedAt: null,
    fruit: 0,
    dodges: 0,
    locks: 0,
    rivalsAte: 0,
    rivalsTaken: 0,
    rivalsCutOff: 0,
    cause: null,
    left: Infinity,
    bare: false,
    toldEnough: true,
  };
  menu.hidden = true;
  report.hidden = true;
  run.hidden = false;
  setOnDesk(false);
  subtitle.textContent = `${challenge.name} · a challenge`;
  window.TalonGame.begin({ theme: region.theme, tuning: region.tuning, rules: challengeRules(challenge), best: progress.challenges[challenge.id]?.best ?? 0 });
  say(challenge.blurb, 4000);
  renderRun();
  window.clearInterval(runTicker);
  runTicker = window.setInterval(renderRun, 500);
  (document.activeElement instanceof HTMLElement ? document.activeElement : null)?.blur();
}

/** A challenge has ended: its score, its stars, the Hall told, and the report. */
function endChallenge(how) {
  if (!flight?.challenge) return;
  const done = flight;
  const challenge = done.challenge;
  const result = challenge.result(window.TalonGame.modeApi);
  const outcome = recordChallenge(progress, { id: challenge.id, score: result.score, thresholds: challenge.stars });
  progress = outcome.progress;
  save('progress', progress);
  for (const id of outcome.packages) install(id);
  reportChallenge({ score: result.score, newStars: outcome.newStars, seconds: (performance.now() - done.startedAt) / 1000 });
  flight = null;
  window.clearInterval(runTicker);
  run.hidden = true;
  banner.hidden = true;
  window.setTimeout(() => showChallengeReport(challenge, how, result, outcome), how === 'caught' ? 950 : 450);
}

const CHALLENGE_ENDS = { full: 'The field is full!', time: 'Time!', caught: 'Caught' };

function showChallengeReport(challenge, how, result, outcome) {
  const card = el(
    'section',
    { class: `desk-card ${how === 'caught' ? 'desk-caught' : 'desk-escaped'}`, role: 'dialog', 'aria-labelledby': 'desk-report-title', 'data-testid': 'desk-report' },
    el('span', { class: 'desk-small' }, `${challenge.name} · a challenge`),
    el('h2', { id: 'desk-report-title' }, CHALLENGE_ENDS[how] ?? 'Over'),
    el('p', { class: 'desk-haul' }, result.headline),
    el('p', { class: 'desk-stars desk-stars-big', 'aria-label': `${outcome.stars} of 3 stars` }, starRow(outcome.stars)),
    outcome.newStars ? el('p', { class: 'desk-news' }, `${outcome.newStars} new ${outcome.newStars === 1 ? 'star' : 'stars'}!`) : null,
    outcome.newBest ? el('p', { class: 'desk-news' }, 'A new best!') : null,
    el('p', { class: 'desk-small' }, `Stars at ${challenge.stars.join(' · ')} ${challenge.unit}`),
    el(
      'div',
      { class: 'desk-row' },
      el('button', { class: 'desk-btn desk-btn-primary', type: 'button', 'data-choice': 'again', 'data-autofocus': true, onclick: () => startChallenge(challenge) }, 'Play again ', el('kbd', {}, 'R')),
      el('button', { class: 'desk-btn', type: 'button', 'data-choice': 'menu', onclick: () => showDesk('challenges') }, 'Challenges'),
      hostedInHall ? el('button', { class: 'desk-btn', type: 'button', 'data-choice': 'hall', onclick: leaveForHall }, 'Back to the Hall ', el('kbd', {}, 'H')) : null,
    ),
  );
  report.replaceChildren(card);
  report.hidden = false;
  requestAnimationFrame(() => card.querySelector('[data-autofocus]')?.focus());
}

function summary(escaped, edge) {
  return {
    escaped,
    fruit: flight.fruit,
    dodges: flight.dodges,
    locks: flight.locks,
    edge: edge ?? null,
    seconds: (performance.now() - flight.startedAt) / 1000,
    rivalsAte: flight.rivalsAte,
    rivalsTaken: flight.rivalsTaken,
    rivalsCutOff: flight.rivalsCutOff,
    bare: flight.bare,
  };
}

/** Whether the tail can be shed now, or how soon. */
function shedLine() {
  const wait = window.TalonGame.peek().shedReadyIn;
  return wait > 0 ? `tail again in ${Math.ceil(wait / 1000)} s` : 'Space: shed the tail';
}

function renderRun() {
  if (!flight) return;
  if (flight.challenge) {
    const api = window.TalonGame.modeApi;
    run.replaceChildren(
      el('p', { class: 'desk-status', 'data-testid': 'desk-status' }, el('b', {}, flight.challenge.name), ` · ${flight.challenge.status(api)}`, flight.challenge.id === 'survival' ? ` · ${shedLine()}` : ''),
    );
    return;
  }
  const live = summary(false, null);
  const goal = flight.daily
    ? el('b', {}, `🍎 ${flight.fruit} carried`)
    : el('b', { class: flight.fruit >= flight.region.goal ? 'desk-enough' : '' }, `🍎 ${flight.fruit} of ${flight.region.goal}`);
  const status = el(
    'p',
    { class: 'desk-status', 'data-testid': 'desk-status' },
    goal,
    ` · ${flight.bare ? 'the field is bare' : `${flight.left} left on the field`}`,
    flight.region.rivals ? ` · rivals ate ${flight.rivalsAte}` : '',
    flight.rivalsTaken ? ` · the bird took ${flight.rivalsTaken}` : '',
    flight.rivalsCutOff ? ` · you cut off ${flight.rivalsCutOff}` : '',
    ` · 🪶 ${flight.dodges} dodged`,
    ` · ${shedLine()}`,
  );
  const items = flight.daily
    ? [el('li', {}, `Daily Flight #${flight.number}: your first finished flight today counts`)]
    : (CONTRACTS[flight.region.id] ?? []).map((contract) => {
        const done = progress.stamps.includes(stampKey(flight.region.id, contract));
        return el(
          'li',
          { class: done ? 'desk-done' : '' },
          el('span', { class: 'desk-stamp' }, done ? '◆' : '◇'),
          contract.text,
          contract.progress && !done ? el('span', { class: 'desk-progress' }, ` ${contract.progress({ ...live, escaped: true })}`) : null,
        );
      });
  run.replaceChildren(status, el('ul', { class: 'desk-contracts desk-contracts-run' }, items));
}

function endFlight(escaped, edge) {
  if (!flight) return;
  const done = flight;
  const s = summary(escaped, edge);
  const outcome = recordFlight(progress, { regionId: done.region.id, summary: s, daily: done.daily });
  progress = outcome.progress;
  save('progress', progress);
  for (const id of outcome.packages) install(id);
  reportFlight(s, { stamps: outcome.stamps.length, opened: Boolean(outcome.opened), daily: outcome.firstDaily });
  flight = null;
  window.clearInterval(runTicker);
  run.hidden = true;
  banner.hidden = true;
  window.setTimeout(() => showReport(done, s, outcome), escaped ? 450 : 950);
}

/** How a flight that did not get away ended, in the report. */
const CAUGHT_BY = {
  bird: 'dropped as the talons closed',
  rival: 'spilled as you ran into a rival',
  peck: 'scattered by a peck to the head',
  self: 'spilled as you ran into yourself',
};

function haulLine(done, s) {
  if (!s.escaped) return `🍎 ${s.fruit} ${CAUGHT_BY[done.cause] ?? CAUGHT_BY.bird}`;
  if (!s.fruit) return 'Away empty-handed: it still counts';
  return `🍎 ${s.fruit} brought home`;
}

function goalLine(done, s, outcome) {
  if (done.daily) return el('p', { class: 'desk-small' }, 'Daily Flights do not clear or open regions of the expedition.');
  if (!s.escaped) {
    return s.fruit >= done.region.goal
      ? el('p', { class: 'desk-small' }, `You had enough to clear ${done.region.name}, but fruit only counts once you get away.`)
      : null;
  }
  if (outcome.firstClear) return el('p', { class: 'desk-news desk-cleared-news' }, `${done.region.name} cleared!`);
  if (s.fruit >= done.region.goal) return el('p', { class: 'desk-small' }, `Enough to clear ${done.region.name} again.`);
  return el('p', { class: 'desk-small' }, `${done.region.goal} needed to clear ${done.region.name}.`);
}

function showReport(done, s, outcome) {
  const contracts = done.daily ? [] : CONTRACTS[done.region.id] ?? [];
  const lines = [];
  if (outcome.completed) lines.push(el('p', { class: 'desk-news' }, 'The expedition is complete!'));
  if (outcome.opened) lines.push(el('p', { class: 'desk-news' }, `New region open: ${outcome.opened.name}, where the ${outcome.opened.bird.toLowerCase()} hunts.`));
  if (outcome.newBest) lines.push(el('p', { class: 'desk-news' }, `A new best escape in ${done.region.name}.`));
  for (const key of outcome.pages) {
    const pageFound = PAGES.find((p) => p.key === key);
    if (pageFound) lines.push(el('p', { class: 'desk-news' }, `New in the field book: ${pageFound.name}.`));
  }
  if (done.daily) {
    lines.push(el('p', { class: 'desk-small' }, outcome.firstDaily ? 'Your first finished Daily Flight today: this one counts.' : 'Today’s Daily Flight was already recorded; this one was for fun.'));
  }
  const share = done.daily
    ? el('button', { class: 'desk-btn', type: 'button', 'data-choice': 'share', onclick: () => shareDaily(done, s) }, 'Share')
    : null;
  const ending = outcome.completed
    ? el('button', { class: 'desk-btn desk-btn-primary', type: 'button', 'data-choice': 'ending', 'data-autofocus': true, onclick: () => showDesk('ending') }, 'Read the ending')
    : null;
  const details = [
    `🪶 ${s.dodges} ${s.dodges === 1 ? 'dive' : 'dives'} dodged`,
    done.region.rivals ? `rivals ate ${s.rivalsAte}` : null,
    done.rivalsTaken ? `the bird took ${done.rivalsTaken} ${done.rivalsTaken === 1 ? 'rival' : 'rivals'}` : null,
    done.rivalsCutOff ? `you cut off ${done.rivalsCutOff} ${done.rivalsCutOff === 1 ? 'rival' : 'rivals'}` : null,
    s.bare ? 'the field was bare' : null,
    `${Math.round(s.seconds)} s in the open`,
  ].filter(Boolean);
  const card = el(
    'section',
    { class: `desk-card ${s.escaped ? 'desk-escaped' : 'desk-caught'}`, role: 'dialog', 'aria-labelledby': 'desk-report-title', 'data-testid': 'desk-report' },
    el('span', { class: 'desk-small' }, done.daily ? `Daily Flight #${done.number} · ${done.region.name}` : `${done.region.name} · ${done.region.bird}`),
    el('h2', { id: 'desk-report-title' }, s.escaped ? 'Escaped!' : 'Caught'),
    el('p', { class: 'desk-haul' }, haulLine(done, s)),
    goalLine(done, s, outcome),
    el('p', { class: 'desk-small' }, details.join(' · ')),
    contracts.length
      ? el(
          'ul',
          { class: 'desk-contracts' },
          contracts.map((contract) => {
            const key = stampKey(done.region.id, contract);
            const fresh = outcome.stamps.includes(key);
            const stamped = progress.stamps.includes(key);
            return el('li', { class: fresh ? 'desk-fresh' : stamped ? 'desk-done' : '' }, el('span', { class: 'desk-stamp' }, stamped ? '◆' : '◇'), contract.text, fresh ? el('em', {}, ' stamped!') : null);
          }),
        )
      : null,
    lines,
    el(
      'div',
      { class: 'desk-row' },
      ending,
      el('button', { class: `desk-btn${ending ? '' : ' desk-btn-primary'}`, type: 'button', 'data-choice': 'again', 'data-autofocus': ending ? null : true, onclick: () => startFlight(done.region, done.daily) }, 'Fly again ', el('kbd', {}, 'R')),
      el('button', { class: 'desk-btn', type: 'button', 'data-choice': 'menu', onclick: () => showDesk() }, 'Expedition'),
      hostedInHall ? el('button', { class: 'desk-btn', type: 'button', 'data-choice': 'hall', onclick: leaveForHall }, 'Back to the Hall ', el('kbd', {}, 'H')) : null,
      share,
    ),
  );
  report.replaceChildren(card);
  report.hidden = false;
  requestAnimationFrame(() => card.querySelector('[data-autofocus]')?.focus());
}

async function shareDaily(done, s) {
  const line = dailyShareLine({ number: done.number, regionName: done.region.name, escaped: s.escaped, fruit: s.fruit, dodges: s.dodges });
  let copied = false;
  try {
    await navigator.clipboard.writeText(line);
    copied = true;
  } catch (_) {
    // No clipboard here: the line is shown to copy by hand.
  }
  const note = report.querySelector('.desk-share') ?? el('p', { class: 'desk-share desk-small', role: 'status' });
  note.textContent = copied ? `Copied: ${line}` : line;
  report.querySelector('.desk-card')?.append(note);
}

// ------------------------------------------------------------------ wiring

function onGameEvent(event) {
  if (event.type === 'frame') {
    if (!posterSent && !menu.hidden && performance.now() - deskOpenedAt > 3000) {
      posterSent = true;
      offerPoster(event.canvas);
    }
    return;
  }
  if (!flight) return;
  if (event.type === 'mode-say') return say(event.text, event.ms);
  if (flight.challenge) {
    if (event.type === 'challenge-over') return endChallenge(event.reason);
    if (event.type === 'caught') return endChallenge('caught');
    if (event.type === 'shed') say('Tail shed. Let the hunters have it.', 2000);
    return;
  }
  if (event.type === 'start') flight.left = event.left;
  else if (event.type === 'pickup') {
    flight.fruit = event.score;
    flight.left = event.left;
    if (!flight.daily && !flight.toldEnough && flight.fruit >= flight.region.goal && !flight.bare) {
      flight.toldEnough = true;
      say(`Enough to clear ${flight.region.name}. Keep it till the last fruit is gone and the edges open.`, 4000);
    }
  } else if (event.type === 'rival-ate') {
    flight.rivalsAte = event.rivalsAte;
    flight.left = event.left;
  } else if (event.type === 'shed') {
    flight.fruit = event.score;
    say(event.lost ? `Tail shed, and ${event.lost} fruit with it. Let the hunters have it.` : 'Tail shed. Let the hunters have it.', 2500);
  } else if (event.type === 'pecked') {
    flight.fruit = event.score;
    flight.left = event.left;
  } else if (event.type === 'hunter-ate') {
    flight.left = event.left;
  } else if (event.type === 'withered') {
    flight.left = event.left;
  } else if (event.type === 'rival-out') {
    flight.rivalsCutOff = event.rivalsCutOff;
    flight.left = event.left;
  } else if (event.type === 'rival-taken') {
    flight.rivalsTaken = event.rivalsTaken;
  } else if (event.type === 'edge-closed') {
    say(`The edges are closed while fruit is left (${event.left} to go).`, 2500);
    return;
  } else if (event.type === 'leaving') {
    say('Away! Out of the bird’s reach.', 2500);
    return;
  } else if (event.type === 'bare') {
    flight.bare = true;
    flight.left = 0;
    say('The field is bare: every edge is open. Leave before the bird’s dives quicken!');
  } else if (event.type === 'dodged') flight.dodges++;
  // Only lock-ons at the player count (for the calm contracts); the bird may hunt a rival instead.
  else if (event.type === 'lock' && event.quarry === 'you') flight.locks++;
  else if (event.type === 'escape') return endFlight(true, event.edge);
  else if (event.type === 'caught') {
    flight.cause = event.cause ?? 'bird';
    return endFlight(false, null);
  }
  else return;
  renderRun();
}

function onKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (flight && event.code === 'Space') {
    event.preventDefault();
    window.TalonGame.shedTail();
    return;
  }
  if (!report.hidden) {
    const key = event.key.toLowerCase();
    const choice = key === 'r' ? 'again' : key === 'h' ? 'hall' : null;
    const button = choice && report.querySelector(`[data-choice="${choice}"]`);
    if (button) {
      event.preventDefault();
      button.click();
    }
    return;
  }
  if (!menu.hidden) {
    if (event.key === 'Backspace' && view !== 'expedition') {
      event.preventDefault();
      showDesk();
    } else if (event.key === 'Enter' && view.startsWith('chal:') && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      startChallenge(challengeById(view.slice(5)));
    } else if (event.key === 'Enter' && view.startsWith('brief:') && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      startFlight(regionById(view.slice(6)), null);
    }
  }
}

function start() {
  window.TalonGame.on(onGameEvent);
  followHall(
    () => {
      window.TalonGame.setPaused(true);
      if (flight && flight.pausedAt === null) flight.pausedAt = performance.now();
    },
    () => {
      window.TalonGame.setPaused(false);
      if (flight && flight.pausedAt !== null) {
        flight.startedAt += performance.now() - flight.pausedAt;
        flight.pausedAt = null;
      }
    },
    (reduced) => window.TalonGame.setReducedMotion(reduced),
  );
  document.addEventListener('keydown', onKey);
  showDesk();
  window.__talon = {
    get flight() {
      return flight;
    },
    get progress() {
      return progress;
    },
  };
}

if (window.TalonGame) start();
else document.addEventListener('talon-ready', start, { once: true });
