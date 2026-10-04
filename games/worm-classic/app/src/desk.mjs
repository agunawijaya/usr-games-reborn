// Orchard Crawl — the orchard desk: the game menu (the season's eight orchards, the Daily Orchard,
// the free orchard, the challenges, the almanac, records, settings and how to play), the briefing
// before a crawl,
// the ledger beside the field while it lasts, the pause menu, the report after it, and the ending
// once Midnight is cleared. The game itself stays in index.html; the desk starts each crawl
// through `window.OrchardGame` with an orchard's rules (orchards.mjs) and listens to what happens.

import { PAGES } from './almanac.mjs';
import {
  CHALLENGE_POINTS_IN_ALL,
  FAMILIES,
  MEDAL_NAMES,
  challengeById,
  challengeOpen,
  maxPoints,
  pointsFor,
} from './challenges.mjs';
import { dailyNumber, dailyOrchard, dailyShareLine, dailyStreams, localDateKey } from './daily.mjs';
import {
  followHall,
  hallLevel,
  hostedInHall,
  install,
  leaveForHall,
  offerPoster,
  reportCrawl,
  setOnDesk,
} from './hall.mjs';
import {
  CREATURE_LINES,
  FENCE_NAMES,
  ORCHARDS,
  crawlRules,
  freeRules,
  openOrchards,
  orchardById,
  seasonComplete,
} from './orchards.mjs';
import {
  FREE_MILESTONE,
  STARS_IN_ALL,
  challengePoints,
  clearedOrchards,
  freshProgress,
  recordChallenge,
  recordCrawl,
  starCount,
} from './progress.mjs';
import { holdSound, play, setLevel, setSoundOn, wakeSound } from './sound.mjs';
import { emptySummary, onCourse, starsOf } from './stars.mjs';
import { loadSaved, save } from './store.mjs';

const game = () => window.OrchardGame;
const menu = document.getElementById('deskMenu');
const run = document.getElementById('deskRun');
const overlay = document.getElementById('deskReport');
const subtitle = document.getElementById('deskSubtitle');

const freshOptions = () => ({
  sound: true,
  steady: false,
  free: { mode: 'pure', speed: 'progressive', fence: 'none', creatures: [], theme: 'neon-grid' },
});

let progress = loadSaved('progress', freshProgress);
let options = loadSaved('options', freshOptions);
/**
 * The crawl under way, or null on the desk. `startedAt` is on the orchard's own clock, which
 * stands still while the game is paused.
 * @type {null | { kind: 'orchard' | 'daily' | 'free' | 'challenge',
 *   orchard: import('./orchards.mjs').Orchard, dailyKey: string | null, number: number,
 *   mode: 'pure' | 'wild' | null, challenge: import('./challenges.mjs').Challenge | null,
 *   judging: object | null, startedAt: number, summary: import('./stars.mjs').CrawlSummary,
 *   burrowOpen: boolean, ended: boolean }}
 */
let crawl = null;
let view = 'orchards';
let playerPaused = false;
let hallPaused = false;
let posterSent = false;
/** The look of the orchard crawling behind the desk, so moving between pages does not restart it. */
let shownTheme = null;
const deskOpenedAt = performance.now();

/** Today's date, or the one in `?date=YYYY-MM-DD` when testing a Daily Orchard. */
function todayKey() {
  const asked = new URLSearchParams(location.search).get('date');
  return asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : localDateKey();
}

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

const button = (label, onclick, extra = {}) =>
  el('button', { class: `desk-btn${extra.primary ? ' desk-btn-primary' : ''}`, type: 'button', onclick, ...extra, primary: null }, ...[label].flat());

const kbd = (key) => el('kbd', {}, key);
/** "a 7", but "an 8". */
const aNumber = (n) => `${n === 8 ? 'an' : 'a'} ${n}`;
const starRow = (held) => ['home', 'points', 'feat'].map((id) => (held.includes(id) ? '★' : '☆')).join('');
const heldStars = (orchard) => progress.stars[orchard.id] ?? [];
const orchardNumber = (orchard) => ORCHARDS.indexOf(orchard) + 1;

// The moments that change a crawl are told in the line above the field, in place of the
// orchard's name for a few seconds: a note laid over the field would hide whatever is coming in
// at its edge.
let subtitleText = '';
let newsTimer = 0;

function setSubtitle(text) {
  subtitleText = text;
  window.clearTimeout(newsTimer);
  subtitle.classList.remove('is-news');
  subtitle.textContent = text;
}

function say(text, ms = 3200) {
  window.clearTimeout(newsTimer);
  subtitle.textContent = text;
  subtitle.classList.add('is-news');
  newsTimer = window.setTimeout(() => {
    subtitle.classList.remove('is-news');
    subtitle.textContent = subtitleText;
  }, ms);
}

function focusFirst(container) {
  requestAnimationFrame(() =>
    (container.querySelector('[data-autofocus]') ?? container.querySelector('button:not([disabled])'))?.focus(),
  );
}

// ------------------------------------------------------------------ the desk (game menu)

function showDesk(next = 'orchards') {
  view = next;
  crawl = null;
  playerPaused = false;
  overlay.hidden = true;
  run.hidden = true;
  menu.hidden = false;
  document.body.classList.remove('is-crawling');
  // Behind a briefing, the orchard about to be crawled; behind the free orchard, the chosen look;
  // behind a challenge, its own.
  const theme =
    next === 'free'
      ? options.free.theme
      : next.startsWith('challenge:')
        ? challengeById(next.slice(10)).theme
        : orchardById(next.startsWith('brief:') ? next.slice(6) : progress.lastOrchard).theme;
  if (game().state !== 'menu' || theme !== shownTheme) {
    game().showMenu(theme);
    shownTheme = theme;
  }
  game().setPaused(hallPaused);
  holdSound(hallPaused);
  setSubtitle('A season in eight orchards');
  setOnDesk(next === 'orchards');
  menu.replaceChildren(deskView(next));
  focusFirst(menu);
}

/** Draws the current desk page again after a choice, keeping the focus on the same control. */
function redraw() {
  const focused = document.activeElement?.getAttribute?.('data-testid');
  showDesk(view);
  if (focused) requestAnimationFrame(() => menu.querySelector(`[data-testid="${focused}"]`)?.focus());
}

function deskView(which) {
  if (which === 'almanac') return almanacView();
  if (which === 'records') return recordsView();
  if (which === 'help') return page('How to play', helpSections());
  if (which === 'settings') return page('Settings', settingsPanel());
  if (which === 'free') return freeView();
  if (which === 'ending') return endingView();
  if (which === 'challenges') return challengesView();
  if (which.startsWith('challenge:')) return challengeBriefingView(challengeById(which.slice(10)));
  if (which.startsWith('brief:')) return briefingView(orchardById(which.slice(6)));
  return orchardsView();
}

function page(title, ...content) {
  return pageBackTo('orchards', '← Orchards', title, ...content);
}

/** A desk page whose back button (and Backspace or Esc) goes to `back`. */
function pageBackTo(back, label, title, ...content) {
  return el(
    'section',
    { class: 'desk-page', 'aria-labelledby': 'desk-page-title' },
    el(
      'header',
      { class: 'desk-head' },
      button(label, () => showDesk(back), { 'data-testid': 'desk-back' }),
      el('h1', { id: 'desk-page-title' }, title),
    ),
    ...content,
  );
}

/** Where Backspace or Esc leads from a desk page. */
function backFrom(which) {
  return which.startsWith('challenge:') ? 'challenges' : 'orchards';
}

function orchardsView() {
  const cleared = clearedOrchards(progress);
  const open = openOrchards(cleared);
  const today = dailyOrchard(todayKey());
  const played = progress.dailies[today.key];
  // The orchard to crawl next: the first open one not yet cleared (or the last, once all are).
  const next = ORCHARDS.find((o) => open.includes(o.id) && !cleared.includes(o.id)) ?? ORCHARDS[ORCHARDS.length - 1];
  const card = (orchard, index) => {
    const isOpen = open.includes(orchard.id);
    const held = heldStars(orchard);
    const best = progress.best[orchard.id];
    return el(
      'button',
      {
        class: `desk-orchard${isOpen ? '' : ' is-locked'}${cleared.includes(orchard.id) ? ' is-cleared' : ''}${orchard === next ? ' is-next' : ''}`,
        type: 'button',
        disabled: !isOpen,
        onclick: () => showDesk(`brief:${orchard.id}`),
        'data-testid': `desk-orchard-${orchard.id}`,
        'aria-label': `${index + 1}. ${orchard.name}: ${orchard.brings}${isOpen ? `, ${held.length} of 3 stars` : ', closed'}`,
      },
      el('span', { class: 'desk-swatch', style: `background:${game().themes[orchard.theme]?.swatch ?? '#888'}` }),
      el('b', {}, `${index + 1}. ${orchard.name}`),
      el('span', { class: 'desk-brings' }, orchard.brings),
      isOpen
        ? el('span', { class: 'desk-small' }, el('span', { class: 'desk-stars', 'aria-hidden': 'true' }, starRow(held)), best === undefined ? '' : ` · best ${best}`)
        : el('span', { class: 'desk-small' }, `Clear ${ORCHARDS[index - 1].name} to open`),
    );
  };
  const complete = seasonComplete(cleared);
  return el(
    'section',
    { class: 'desk-page desk-home', 'aria-labelledby': 'desk-title' },
    el(
      'header',
      { class: 'desk-hero' },
      el(
        'div',
        { class: 'desk-hero-text' },
        el('h1', { id: 'desk-title', class: 'desk-title' }, 'Orchard Crawl'),
        el('p', { class: 'desk-tag' }, 'Numbered apples, hungry neighbours, and a burrow to crawl home to.'),
        // Straight into the next orchard, without its briefing: a card below opens the briefing.
        button(['▶ Crawl ', `${orchardNumber(next)}. ${next.name} `, kbd('Enter')], () => startCrawl({ kind: 'orchard', orchard: next }), {
          primary: true,
          'data-autofocus': true,
          'data-testid': 'desk-continue',
        }),
      ),
      el(
        'div',
        { class: 'desk-daily' },
        el(
          'div',
          {},
          el('b', {}, `Daily Orchard #${today.number} · ${today.orchard.name}`),
          el('span', {}, played ? `Today: ${played.home ? 'home' : 'crashed'} with ${played.score} points. Crawl again for fun.` : 'The same orchard and the same apples for everyone today.'),
        ),
        button('Crawl today’s', () => startCrawl({ kind: 'daily', orchard: today.orchard, dailyKey: today.key }), { 'data-testid': 'desk-daily' }),
      ),
    ),
    el(
      'h2',
      {},
      'The season',
      complete ? button('Read the ending', () => showDesk('ending'), { class: 'desk-btn desk-btn-small', 'data-testid': 'desk-ending' }) : null,
    ),
    el('div', { class: 'desk-orchards' }, ORCHARDS.map(card)),
    el(
      'div',
      { class: 'desk-links' },
      el('span', { class: 'desk-small', 'data-testid': 'desk-tally' }, `${cleared.length}/${ORCHARDS.length} orchards · ${starCount(progress)}/${STARS_IN_ALL} stars · ${progress.pages.length}/${PAGES.length} almanac pages`),
      button('Free orchard', () => showDesk('free'), { 'data-testid': 'desk-free' }),
      button(['Challenges ', el('span', { class: 'desk-count' }, `${challengePoints(progress)}/${CHALLENGE_POINTS_IN_ALL}`)], () => showDesk('challenges'), {
        'data-testid': 'desk-challenges',
      }),
      button('Almanac', () => showDesk('almanac'), { 'data-testid': 'desk-almanac' }),
      button('Records', () => showDesk('records'), { 'data-testid': 'desk-records' }),
      button('How to play', () => showDesk('help'), { 'data-testid': 'desk-help' }),
      button('Settings', () => showDesk('settings'), { 'data-testid': 'desk-settings' }),
    ),
  );
}

/** Small portraits of an orchard's creatures, drawn by the game itself. */
function creatureStrip(orchard) {
  const kinds = orchard.creatures.length ? orchard.creatures : [];
  return el(
    'ul',
    { class: 'desk-creatures' },
    kinds.map((kind) =>
      el('li', {}, portrait(kind === 'wasps' ? 'wasp' : kind, orchard.theme, true), el('span', {}, CREATURE_LINES[kind])),
    ),
  );
}

/** One of the game's own drawings in a frame; something not yet met shows as its shadow. */
function portrait(kind, theme, seen) {
  const canvas = el('canvas', { width: 320, height: 240, class: `desk-portrait${seen ? '' : ' is-unseen'}`, 'aria-hidden': 'true' });
  game().portrait(kind, canvas, theme);
  return el('span', { class: 'desk-portrait-frame' }, canvas);
}

function briefingView(orchard) {
  const best = progress.best[orchard.id];
  const index = ORCHARDS.indexOf(orchard);
  const after = ORCHARDS[index + 1];
  const held = heldStars(orchard);
  return page(
    `${index + 1}. ${orchard.name}`,
    el('p', { class: 'desk-lead' }, orchard.lead),
    el(
      'p',
      { class: 'desk-goal', 'data-testid': 'desk-goal' },
      el('b', {}, `Eat ${orchard.harvest} apples and your burrow opens.`),
      ` Crawl into it to clear ${orchard.name}${after ? ` and open ${after.name}` : ' and end the season'}.`,
    ),
    el(
      'p',
      { class: 'desk-small' },
      `${orchard.apples === 'single' ? 'One apple on the grid at a time.' : 'Ten apples on the grid at once.'} The ground: ${FENCE_NAMES[orchard.fence]}. `,
      best === undefined ? 'You have not come home here yet.' : `Your best crawl home here: ${best} points.`,
    ),
    orchard.creatures.length ? creatureStrip(orchard) : null,
    el('h2', {}, 'Stars'),
    el(
      'ul',
      { class: 'desk-starlist' },
      starsOf(orchard).map((star) => {
        const done = held.includes(star.id);
        return el('li', { class: done ? 'is-done' : '' }, el('span', { class: 'desk-star', 'aria-label': done ? 'earned' : 'not yet' }, done ? '★' : '☆'), star.text);
      }),
    ),
    el(
      'div',
      { class: 'desk-row' },
      button(['Crawl ', kbd('Enter')], () => startCrawl({ kind: 'orchard', orchard }), { primary: true, 'data-autofocus': true, 'data-testid': 'desk-crawl' }),
    ),
  );
}

function choiceRow(label, choices, current, pick, testid) {
  return el(
    'div',
    { class: 'desk-choice', role: 'group', 'aria-label': label },
    el('span', { class: 'desk-choice-label' }, label),
    el(
      'div',
      { class: 'desk-pills' },
      choices.map(([value, text, extra = {}]) =>
        el(
          'button',
          {
            class: 'desk-pill',
            type: 'button',
            'aria-pressed': String(Array.isArray(current) ? current.includes(value) : current === value),
            onclick: () => pick(value),
            'data-testid': `${testid}-${value}`,
            ...extra,
          },
          text,
        ),
      ),
    ),
  );
}

function freeView() {
  const free = options.free;
  const setFree = (patch) => {
    options = { ...options, free: { ...options.free, ...patch } };
    save('options', options);
    redraw();
  };
  const wild = free.mode === 'wild';
  return page(
    'Free orchard',
    el('p', { class: 'desk-lead' }, 'The port as it always played: pick the rules and crawl for as long as you last. No harvest and no burrow here, just your score.'),
    el(
      'div',
      { class: 'desk-free' },
      choiceRow('Apples', [['pure', 'One at a time (the 1980 rule)'], ['wild', 'A full orchard']], free.mode, (mode) => setFree({ mode }), 'free-mode'),
      choiceRow('Pace', [['classic', 'Classic · 3×'], ['fast', 'Fast · 6×'], ['progressive', 'Speeds up · 3→6×']], free.speed, (speed) => setFree({ speed }), 'free-speed'),
      choiceRow('Fence', Object.keys(FENCE_NAMES).map((key) => [key, FENCE_NAMES[key]]), free.fence, (fence) => setFree({ fence }), 'free-fence'),
      choiceRow(
        'Creatures',
        ['bird', 'wasps', 'rival', 'gardener'].map((key) => [key, key === 'wasps' ? 'Wasps' : key[0].toUpperCase() + key.slice(1), { disabled: !wild }]),
        free.creatures,
        (key) => setFree({ creatures: free.creatures.includes(key) ? free.creatures.filter((c) => c !== key) : [...free.creatures, key] }),
        'free-creature',
      ),
      wild ? null : el('p', { class: 'desk-small' }, 'Creatures come with a full orchard. The frog always does.'),
      choiceRow(
        'Look',
        Object.entries(game().themes).map(([key, theme]) => [key, [el('span', { class: 'desk-dot', style: `background:${theme.swatch}` }), theme.name]]),
        free.theme,
        (theme) => setFree({ theme }),
        'free-look',
      ),
    ),
    el(
      'div',
      { class: 'desk-row' },
      button(['Crawl ', kbd('Enter')], () => startCrawl({ kind: 'free', orchard: ORCHARDS[0], mode: free.mode }), { primary: true, 'data-testid': 'desk-free-crawl' }),
      el('span', { class: 'desk-small' }, `Best: ${progress.freeBest.pure} one at a time · ${progress.freeBest.wild} full orchard`),
    ),
  );
}

function almanacView() {
  return page(
    'Almanac',
    el('p', { class: 'desk-lead' }, `${progress.pages.length} of ${PAGES.length} pages. A page fills in the first time you really meet what it is about.`),
    el(
      'div',
      { class: 'desk-almanac' },
      PAGES.map((entry) => {
        const found = progress.pages.includes(entry.id);
        return el(
          'article',
          { class: `desk-entry${found ? '' : ' is-unseen'}`, 'data-testid': `almanac-${entry.id}` },
          portrait(entry.portrait, 'savanna', found),
          el('b', {}, found ? entry.name : 'Not yet met'),
          el('p', {}, found ? entry.note : entry.how),
        );
      }),
    ),
  );
}

function recordsView() {
  const days = Object.entries(progress.dailies).sort(([a], [b]) => b.localeCompare(a)).slice(0, 8);
  return page(
    'Records',
    el(
      'div',
      { class: 'desk-records' },
      el(
        'section',
        {},
        el('h2', {}, 'The season'),
        el(
          'ol',
          {},
          ORCHARDS.map((o) => el('li', {}, el('b', {}, o.name), ` ${starRow(heldStars(o))} · ${progress.best[o.id] === undefined ? 'not home yet' : `best ${progress.best[o.id]}`}`)),
        ),
      ),
      el(
        'section',
        {},
        el('h2', {}, 'Daily Orchards'),
        days.length
          ? el('ol', {}, days.map(([key, d]) => el('li', {}, el('b', {}, `#${dailyNumber(key)}`), ` ${d.home ? 'home' : 'crashed'} · ${d.score} pts · 🍎${d.apples} · ${'★'.repeat(d.stars)}${'☆'.repeat(3 - d.stars)}`)))
          : el('p', {}, 'None yet. Today’s is on the orchards page.'),
      ),
      el(
        'section',
        {},
        el('h2', {}, 'All told'),
        el('p', {}, `${progress.crawls} crawls · ${progress.homes} home · ${progress.crashes} crashes`),
        el('p', {}, `${progress.apples} apples eaten · ${progress.frogs} frogs caught`),
        el('p', {}, `Longest worm ${progress.longest} · best single bite ${progress.bestBite}`),
        el('p', {}, `Free orchard best: ${progress.freeBest.pure} one at a time · ${progress.freeBest.wild} full orchard`),
        el('p', {}, `${starCount(progress)}/${STARS_IN_ALL} stars · ${progress.pages.length}/${PAGES.length} almanac pages · ${progress.dailyCrawls} Daily Orchards`),
        el('p', {}, `Challenges: ${challengePoints(progress)} of ${CHALLENGE_POINTS_IN_ALL} points`),
      ),
    ),
  );
}

function helpSections() {
  const part = (title, ...lines) => el('section', {}, el('h2', {}, title), lines.map((line) => el('p', {}, line)));
  return el(
    'div',
    { class: 'desk-help' },
    part(
      'The crawl',
      'Steer the worm with W A S D or the arrow keys; between presses it keeps crawling the way it faces, one cell at a time, and it cannot turn straight back. The edge of the orchard, the fences and your own body are hard: crawl into any of them and the crawl is over.',
    ),
    part(
      'Numbers and chains',
      'Every apple carries a number from 1 to 9. Eat it and you grow by that many cells over the next moves; the bite scores all the growing you still have to do. So an apple eaten while you are still growing from the last one scores the two together: that is a chain, and the side panel shows how much is still to come.',
      'Big numbers score more and make you longer. Small numbers keep you short and nimble. Every apple counts the same towards the harvest.',
    ),
    part(
      'The harvest and the burrow',
      'Each orchard has a harvest: eat that many apples and your burrow opens somewhere you can reach. Crawl into it and you are home, safe from everything, and the orchard is cleared. You may keep eating first for more points, but the orchard only gets busier.',
    ),
    part(
      'Stars',
      'Every orchard has three stars, earned on a crawl that comes home: one for coming home, one for the orchard’s points, one for its feat. Clear an orchard to open the next; clear Midnight to end the season.',
    ),
    part(
      'Who lives in the orchards',
      'The frog hops through now and then: catch it for 50. The bird swoops for the biggest ripe apple. An apple left over-ripe hatches a wasp that chases your head. A rival worm eats the same apples and crashes like you do. The gardener walks in and follows the nearest worm for a while. The almanac fills in as you meet them.',
    ),
    part(
      'The free orchard and the Daily Orchard',
      'The free orchard is the port as it always played: one apple at a time or a full orchard, your pace, your fence, your creatures, and no burrow. The Daily Orchard is one crawl a day, the same for everyone; your first finished crawl of the day counts and gives you a line to share.',
    ),
    part(
      'Challenges',
      'Single crawls apart from the season, each with one goal: fill a bed or the whole orchard, draw a zigzag with your body, follow a zigzag lane through the hedge, never go straight too long, grow to an exact length, eat the numbers in order, turn only right, or score one huge bite. Each tier opens the next and is worth points; the three King Drift families are weighted, the hardest worth most.',
    ),
    part(
      'Keys',
      'W A S D or arrows: steer. Esc or P: pause. Enter: crawl from a briefing. After a crawl, R crawls again and H goes back to the Hall. Backspace or Esc goes back to the orchards from any page; Esc on the orchards page goes back to the Hall.',
    ),
  );
}

function settingsPanel(after = redraw) {
  const toggle = (label, note, value, flip, testid) =>
    el(
      'div',
      { class: 'desk-setting' },
      el('button', { class: 'desk-pill', type: 'button', role: 'switch', 'aria-checked': String(value), onclick: flip, 'data-testid': testid }, `${label}: ${value ? 'on' : 'off'}`),
      el('span', { class: 'desk-small' }, note),
    );
  return el(
    'div',
    { class: 'desk-settings' },
    toggle(
      'Sound',
      hostedInHall ? 'The Hall’s volume and mute still decide how loud.' : 'Bites, the frog, the creatures and the way home.',
      options.sound,
      () => {
        options = { ...options, sound: !options.sound };
        save('options', options);
        setSoundOn(options.sound);
        after();
      },
      'setting-sound',
    ),
    toggle(
      'Steady pace',
      'The worm keeps the Classic pace however long it grows, instead of speeding up as it does in the port.',
      options.steady,
      () => {
        options = { ...options, steady: !options.steady };
        save('options', options);
        game().setSteadyPace(options.steady);
        after();
      },
      'setting-steady',
    ),
  );
}

// ------------------------------------------------------------------ the challenges

const resultOf = (challenge) => progress.challenges?.[challenge.id];

function challengeMark(challenge) {
  const result = resultOf(challenge);
  if (Array.isArray(challenge.points)) return result?.medal ? MEDAL_NAMES[result.medal - 1] : 'no medal yet';
  return result?.done ? '✓ done' : '';
}

function challengesView() {
  const earned = challengePoints(progress);
  const drift = FAMILIES.filter((f) => f.group === 'King Drift');
  const driftEarned = drift.flatMap((f) => f.challenges).reduce((sum, c) => sum + pointsFor(c, resultOf(c)), 0);
  const driftAll = drift.flatMap((f) => f.challenges).reduce((sum, c) => sum + maxPoints(c), 0);
  const familyBlock = (family) =>
    el(
      'section',
      { class: 'desk-family', 'data-testid': `family-${family.id}` },
      el('div', { class: 'desk-family-head' }, el('b', {}, family.name), el('span', { class: 'desk-small' }, family.lead)),
      el(
        'div',
        { class: 'desk-tiers' },
        family.challenges.map((challenge) => {
          const open = challengeOpen(challenge, progress.challenges ?? {});
          const result = resultOf(challenge);
          const done = result?.done;
          return el(
            'button',
            {
              class: `desk-tier${done ? ' is-done' : ''}${open ? '' : ' is-locked'}`,
              type: 'button',
              disabled: !open,
              onclick: () => showDesk(`challenge:${challenge.id}`),
              'data-testid': `challenge-${challenge.id}`,
            },
            el('b', {}, challenge.name),
            el(
              'span',
              { class: 'desk-small' },
              open ? `${challengeMark(challenge) || 'not yet'} · ${Array.isArray(challenge.points) ? `up to ${maxPoints(challenge)}` : challenge.points} ${maxPoints(challenge) === 1 ? 'point' : 'points'}` : 'Finish the one before',
            ),
          );
        }),
      ),
    );
  return page(
    'Challenges',
    el(
      'p',
      { class: 'desk-lead' },
      `Single crawls with one goal each, apart from the season. ${earned} of ${CHALLENGE_POINTS_IN_ALL} points; King Drift ${driftEarned} of ${driftAll}.`,
    ),
    el(
      'div',
      { class: 'desk-families' },
      FAMILIES.filter((f) => f.group !== 'King Drift').slice(0, 2).map(familyBlock),
      el(
        'section',
        { class: 'desk-group', 'aria-label': 'King Drift' },
        el('h2', {}, 'King Drift', el('span', { class: 'desk-small' }, ' weighted: the zigzag ×1, the lane ×2, no long straights ×3')),
        drift.map(familyBlock),
      ),
      FAMILIES.filter((f) => f.group !== 'King Drift').slice(2).map(familyBlock),
    ),
  );
}

function challengeBriefingView(challenge) {
  const family = FAMILIES.find((f) => f.id === challenge.family);
  const result = resultOf(challenge);
  const medals = Array.isArray(challenge.points)
    ? el(
        'ul',
        { class: 'desk-starlist' },
        challenge.points.map((points, i) =>
          el('li', { class: (result?.medal ?? 0) > i ? 'is-done' : '' }, el('span', { class: 'desk-star' }, (result?.medal ?? 0) > i ? '★' : '☆'), `${MEDAL_NAMES[i]}: ${[25, 50, 75, 100][i]}% · ${points} points`),
        ),
      )
    : null;
  return pageBackTo(
    'challenges',
    '← Challenges',
    challenge.name,
    el('p', { class: 'desk-lead' }, `${family.group ? `${family.group} · ` : ''}${family.name}: ${family.lead}`),
    el('p', { class: 'desk-goal', 'data-testid': 'challenge-goal' }, el('b', {}, challenge.goal)),
    el(
      'p',
      { class: 'desk-small' },
      Array.isArray(challenge.points) ? 'A crash ends it; the medal is for the most you filled.' : `${challenge.points} ${challenge.points === 1 ? 'point' : 'points'} when done.`,
      result ? ` Tried ${result.tries} ${result.tries === 1 ? 'time' : 'times'}${challengeMark(challenge) ? `; ${challengeMark(challenge)}` : ''}.` : '',
    ),
    medals,
    el(
      'div',
      { class: 'desk-row' },
      button(['Start ', kbd('Enter')], () => startCrawl({ kind: 'challenge', challenge }), { primary: true, 'data-autofocus': true, 'data-testid': 'challenge-start' }),
    ),
  );
}

function endingView() {
  const cleared = clearedOrchards(progress);
  return page(
    'The season’s end',
    el(
      'div',
      { class: 'desk-ending', 'data-testid': 'desk-ending-page' },
      el('p', { class: 'desk-lead' }, 'Eight orchards, from the old green grid to the last apple under the moon, and every one of them ended the same way: a full worm, a dark little burrow, and the orchard carrying on without you.'),
      el('p', {}, `${cleared.length} of ${ORCHARDS.length} orchards cleared · ${starCount(progress)} of ${STARS_IN_ALL} stars · ${progress.apples} apples eaten · ${progress.frogs} frogs caught.`),
      el('p', {}, `${progress.homes} crawls home in ${progress.crawls} · longest worm ${progress.longest} · best single bite ${progress.bestBite} · ${progress.pages.length} of ${PAGES.length} almanac pages.`),
      el('p', {}, 'Every orchard stays open. Crawl them again for the stars still empty, try the free orchard by the 1980 rule, or take the Daily Orchard with everyone else.'),
    ),
  );
}

// ------------------------------------------------------------------ a crawl

function startCrawl({ kind, orchard = ORCHARDS[0], dailyKey = null, mode = null, challenge = null }) {
  const daily = kind === 'daily' ? dailyOrchard(dailyKey) : null;
  crawl = {
    kind,
    orchard,
    dailyKey,
    number: daily?.number ?? 0,
    mode,
    challenge,
    judging: challenge ? challenge.begin() : null,
    startedAt: 0,
    summary: emptySummary(),
    burrowOpen: false,
    ended: false,
  };
  playerPaused = false;
  menu.hidden = true;
  overlay.hidden = true;
  run.hidden = false;
  document.body.classList.add('is-crawling');
  setOnDesk(false);
  const free = kind === 'free';
  setSubtitle(
    challenge
      ? `Challenge · ${challenge.name}`
      : free
        ? `Free orchard · ${mode === 'pure' ? 'one apple at a time' : 'a full orchard'}`
        : daily
          ? `Daily Orchard #${daily.number} · ${orchard.name}`
          : `${orchardNumber(orchard)}. ${orchard.name} · ${orchard.brings.toLowerCase()}`,
  );
  // Steady pace is for the season; a challenge keeps the pace it was made for.
  game().setSteadyPace(challenge ? false : options.steady);
  shownTheme = null;
  game().begin({
    theme: challenge ? challenge.theme : free ? options.free.theme : orchard.theme,
    rules: challenge ? challenge.rules() : free ? freeRules(options.free) : crawlRules(orchard),
    streams: daily ? dailyStreams(dailyKey) : undefined,
    best: free ? progress.freeBest[mode] : kind === 'orchard' ? (progress.best[orchard.id] ?? 0) : 0,
  });
  crawl.startedAt = game().peek().clock;
  game().setPaused(hallPaused);
  holdSound(hallPaused);
  buildLedger();
  if (challenge) say(challenge.goal, 4200);
  else if (!free) say(`Eat ${orchard.harvest} apples to open your burrow.`);
  (document.activeElement instanceof HTMLElement ? document.activeElement : null)?.blur();
}

// The ledger beside the field: built once a crawl, then only its numbers change.
const ledger = {};

function buildLedger() {
  if (crawl.challenge) return buildChallengeLedger();
  const free = crawl.kind === 'free';
  const where = free ? 'Free orchard' : crawl.kind === 'daily' ? `Daily #${crawl.number} · ${crawl.orchard.name}` : `${orchardNumber(crawl.orchard)}. ${crawl.orchard.name}`;
  ledger.count = el('b', { class: 'run-count', 'data-testid': 'run-harvest' });
  ledger.bar = el('i');
  ledger.harvestNote = el('p', { class: 'run-note', 'data-testid': 'run-harvest-note' });
  ledger.points = el('b', { class: 'run-points', 'data-testid': 'run-points' });
  ledger.chain = el('p', { class: 'run-note', 'data-testid': 'run-chain' });
  ledger.stars = el('ul', { class: 'run-stars', 'data-testid': 'run-stars' });
  ledger.creatures = el('ul', { class: 'run-creatures', 'aria-live': 'polite' });
  run.replaceChildren(
    el(
      'header',
      { class: 'run-head' },
      el('span', { class: 'run-where' }, where),
      button(['Pause ', kbd('Esc')], () => pauseCrawl(), { class: 'desk-btn desk-btn-small', 'data-testid': 'run-pause' }),
    ),
    free
      ? null
      : el('section', { class: 'run-block' }, el('span', { class: 'run-label' }, 'Harvest'), ledger.count, el('div', { class: 'run-bar', 'aria-hidden': 'true' }, ledger.bar), ledger.harvestNote),
    el('section', { class: 'run-block' }, el('span', { class: 'run-label' }, 'Points'), ledger.points, ledger.chain),
    free ? null : el('section', { class: 'run-block' }, el('span', { class: 'run-label' }, 'Stars'), ledger.stars),
    el('section', { class: 'run-block' }, el('span', { class: 'run-label' }, 'In the orchard'), ledger.creatures),
    el('p', { class: 'run-keys desk-small' }, 'Steer ', kbd('W'), kbd('A'), kbd('S'), kbd('D'), ' or arrows'),
  );
  refreshLedger();
}

/** Beside a challenge: its goal, how it stands, the points and who is about. */
function buildChallengeLedger() {
  const challenge = crawl.challenge;
  ledger.status = el('b', { class: 'run-status', 'data-testid': 'run-challenge' });
  ledger.points = el('b', { class: 'run-points', 'data-testid': 'run-points' });
  ledger.chain = el('p', { class: 'run-note', 'data-testid': 'run-chain' });
  ledger.creatures = el('ul', { class: 'run-creatures', 'aria-live': 'polite' });
  const rules = challenge.rules();
  run.replaceChildren(
    el(
      'header',
      { class: 'run-head' },
      el('span', { class: 'run-where' }, 'Challenge'),
      button(['Pause ', kbd('Esc')], () => pauseCrawl(), { class: 'desk-btn desk-btn-small', 'data-testid': 'run-pause' }),
    ),
    el('section', { class: 'run-block' }, el('span', { class: 'run-label' }, challenge.name), el('p', { class: 'run-note' }, challenge.goal)),
    el('section', { class: 'run-block' }, el('span', { class: 'run-label' }, 'Now'), ledger.status),
    el('section', { class: 'run-block' }, el('span', { class: 'run-label' }, 'Points'), ledger.points, ledger.chain),
    el('section', { class: 'run-block' }, el('span', { class: 'run-label' }, 'In the orchard'), ledger.creatures),
    el(
      'p',
      { class: 'run-keys desk-small' },
      rules.turns === 'right' ? 'Right turns only: the worm takes only the clockwise turn. ' : 'Steer ',
      rules.turns === 'right' ? null : [kbd('W'), kbd('A'), kbd('S'), kbd('D'), ' or arrows'],
    ),
  );
  refreshLedger();
}

let lastCreatureLine = '';

function refreshLedger() {
  if (!crawl || crawl.ended) return;
  const s = crawl.summary;
  const peek = game().peek();
  const free = crawl.kind === 'free';
  if (crawl.challenge) ledger.status.textContent = crawl.challenge.status(crawl.judging, peek);
  else if (!free) {
    const goal = crawl.orchard.harvest;
    ledger.count.textContent = `🍎 ${Math.min(s.harvested, goal)} / ${goal}${s.harvested > goal ? ` (+${s.harvested - goal})` : ''}`;
    ledger.bar.style.width = `${Math.min(100, (s.harvested / goal) * 100)}%`;
    ledger.harvestNote.textContent = crawl.burrowOpen
      ? 'Your burrow is open: crawl in to finish.'
      : s.harvested >= goal
        ? 'Finding a spot for your burrow…'
        : `${goal - s.harvested} more to open your burrow.`;
    ledger.harvestNote.classList.toggle('is-open', crawl.burrowOpen);
    ledger.stars.replaceChildren(
      ...starsOf(crawl.orchard).map((star) => {
        const held = crawl.kind === 'orchard' && heldStars(crawl.orchard).includes(star.id);
        const going = star.id === 'home' ? crawl.burrowOpen : onCourse(star, s);
        const status = going
          ? star.id === 'home'
            ? 'the burrow is open'
            : 'on course: now come home'
          : star.progress
            ? star.progress(s)
            : held
              ? 'earned before'
              : '';
        return el(
          'li',
          { class: [going ? 'is-going' : '', held ? 'is-held' : ''].join(' ').trim() },
          el('span', { class: 'desk-star', 'aria-label': held ? 'earned' : 'not yet earned' }, held ? '★' : '☆'),
          el('span', {}, star.text, status ? el('span', { class: 'run-progress' }, status) : null),
        );
      }),
    );
  }
  ledger.points.textContent = String(peek.score);
  ledger.chain.textContent = peek.growing > 0 ? `Still growing ${peek.growing}: a bite now scores ${peek.growing} + its number.` : 'Not growing: the next bite scores just its number.';
  const line = creatureLines(peek);
  if (line.join('|') !== lastCreatureLine) {
    lastCreatureLine = line.join('|');
    ledger.creatures.replaceChildren(...line.map((text) => el('li', {}, text)));
  }
}

function creatureLines(peek) {
  const lines = [];
  if (peek.apples.some((a) => a.rotten)) lines.push('An apple has gone over');
  if (peek.frog) lines.push('A frog is about: 50 points');
  if (peek.bird) lines.push(peek.bird.state === 'retreat' ? 'The bird is leaving' : 'The bird is after an apple');
  if (peek.wasps.length) lines.push('A wasp is chasing you!');
  if (peek.rival) lines.push(`A rival worm, ${peek.rival.segments.length} long`);
  if (peek.gardener) lines.push(peek.gardener.state === 'leaving' ? 'The gardener is going' : 'The gardener is following the nearest worm!');
  const season = crawl?.kind === 'orchard' || crawl?.kind === 'daily';
  if (!lines.length) lines.push(season && crawl.orchard.creatures.length ? 'All quiet for now' : 'Just you and the apples');
  return lines;
}

function elapsedSeconds() {
  return (game().peek().clock - crawl.startedAt) / 1000;
}

/** @param {'home' | 'filled' | 'success' | 'crash'} ending */
function endCrawl(ending) {
  if (!crawl || crawl.ended) return;
  if (crawl.challenge) return endChallenge(ending);
  const home = ending === 'home' || ending === 'filled';
  crawl.ended = true;
  const done = crawl;
  const s = done.summary;
  const peek = game().peek();
  s.home = home;
  s.score = peek.score;
  s.seconds = elapsedSeconds();
  if (!home) s.length = peek.length;
  const outcome = recordCrawl(progress, {
    kind: done.kind,
    orchardId: done.orchard.id,
    mode: done.mode ?? undefined,
    dailyKey: done.dailyKey ?? undefined,
    summary: s,
  });
  progress = outcome.progress;
  save('progress', progress);
  for (const id of outcome.packages) install(id);
  const win = done.kind === 'free' ? s.score >= FREE_MILESTONE : home;
  reportCrawl(s, { kind: done.kind, stars: outcome.stars.length, firstClear: outcome.firstClear, daily: outcome.firstDaily, win });
  if (outcome.stars.length) window.setTimeout(() => play.star(), 500);
  // Home: a moment to see the worm look out of its burrow before the report covers it.
  window.setTimeout(() => showReport(done, s, outcome), home ? 800 : 900);
}

function endChallenge(ending) {
  crawl.ended = true;
  const done = crawl;
  const s = done.summary;
  const peek = game().peek();
  s.home = ending === 'home';
  s.score = peek.score;
  s.seconds = elapsedSeconds();
  s.length = Math.max(s.length, peek.length);
  const result = done.challenge.outcome(done.judging, ending);
  const outcome = recordChallenge(progress, done.challenge, result, s);
  progress = outcome.progress;
  save('progress', progress);
  for (const id of outcome.packages) install(id);
  reportCrawl(s, { kind: 'challenge', stars: 0, firstClear: false, daily: false, win: result.success, challengePoints: outcome.gained });
  if (result.success) window.setTimeout(() => play.star(), 400);
  window.setTimeout(() => showChallengeReport(done, s, result, outcome), ending === 'crash' ? 900 : ending === 'home' ? 800 : 350);
}

function showChallengeReport(done, s, result, outcome) {
  crawl = null;
  setSubtitle(subtitleText);
  run.hidden = true;
  document.body.classList.remove('is-crawling');
  const challenge = done.challenge;
  const family = FAMILIES.find((f) => f.id === challenge.family);
  const medal = Array.isArray(challenge.points) && result.medal ? MEDAL_NAMES[result.medal - 1] : null;
  const news = [];
  if (outcome.gained) news.push(el('p', { class: 'desk-news is-good' }, `+${outcome.gained} challenge ${outcome.gained === 1 ? 'point' : 'points'}: ${challengePoints(progress)} of ${CHALLENGE_POINTS_IN_ALL}.`));
  if (outcome.opened) {
    news.push(
      el(
        'p',
        { class: 'desk-news' },
        'Next one open: ',
        button(outcome.opened.name, () => showDesk(`challenge:${outcome.opened.id}`), { class: 'desk-btn desk-btn-small', 'data-choice': 'next' }),
      ),
    );
  }
  for (const id of outcome.pages) {
    const entry = PAGES.find((p) => p.id === id);
    if (entry) news.push(el('p', { class: 'desk-news' }, `New in the almanac: ${entry.name}.`));
  }
  const card = el(
    'section',
    { class: `desk-card ${result.success ? 'is-home' : 'is-crashed'}`, role: 'dialog', 'aria-labelledby': 'desk-report-title', 'data-testid': 'desk-report' },
    el('span', { class: 'desk-small' }, `${family.group ? `${family.group} · ` : ''}${family.name}`),
    el('h2', { id: 'desk-report-title' }, result.success ? (medal ? `${medal[0].toUpperCase()}${medal.slice(1)}!` : 'Done!') : 'Not this time'),
    el('p', { class: 'desk-haul' }, challenge.name),
    result.success ? null : el('p', { class: 'desk-why' }, CRASH_LINES[s.reason] ?? 'The crawl is over.'),
    el('p', { class: 'desk-small' }, `${challenge.status(done.judging, game().peek())} · ${s.score} points · ${Math.round(s.seconds)} s`),
    news,
    el(
      'div',
      { class: 'desk-row' },
      button(['Try again ', kbd('R')], () => startCrawl({ kind: 'challenge', challenge }), { primary: true, 'data-choice': 'again', 'data-autofocus': true }),
      button('Challenges', () => showDesk('challenges'), { 'data-choice': 'menu' }),
      hostedInHall ? button(['Back to the Hall ', kbd('H')], leaveForHall, { 'data-choice': 'hall' }) : null,
    ),
  );
  overlay.replaceChildren(card);
  overlay.hidden = false;
  focusFirst(card);
}

const CRASH_LINES = {
  straight: 'Straight on for one cell too many.',
  order: 'That was not the number that came next.',
  over: 'One cell too long: past the length you were after.',
  wall: 'Into the edge of the orchard.',
  self: 'Tangled in your own tail.',
  fence: 'Into a fence.',
  wasp: 'The wasp caught up.',
  gardener: 'The gardener got there first.',
  'rival-head': 'Head to head with the rival worm.',
  'rival-body': 'Into the rival worm.',
};

function showReport(done, s, outcome) {
  crawl = null;
  setSubtitle(subtitleText);
  run.hidden = true;
  document.body.classList.remove('is-crawling');
  const orchard = done.orchard;
  const free = done.kind === 'free';
  const kicker = free
    ? `Free orchard · ${done.mode === 'pure' ? 'one apple at a time' : 'a full orchard'}`
    : done.kind === 'daily'
      ? `Daily Orchard #${done.number} · ${orchard.name}`
      : `${orchardNumber(orchard)}. ${orchard.name}`;
  const news = [];
  if (outcome.completed) news.push(el('p', { class: 'desk-news is-big' }, 'The season is complete!'));
  if (outcome.firstClear) news.push(el('p', { class: 'desk-news is-good' }, `${orchard.name} cleared!`));
  if (outcome.opened) {
    news.push(
      el(
        'p',
        { class: 'desk-news' },
        `New orchard open: ${outcome.opened.name}, with ${outcome.opened.brings.toLowerCase()}. `,
        button(`Go to ${outcome.opened.name}`, () => showDesk(`brief:${outcome.opened.id}`), { class: 'desk-btn desk-btn-small', 'data-choice': 'next' }),
      ),
    );
  }
  if (outcome.newBest) news.push(el('p', { class: 'desk-news' }, `A new best for ${orchard.name}.`));
  for (const id of outcome.pages) {
    const entry = PAGES.find((p) => p.id === id);
    if (entry) news.push(el('p', { class: 'desk-news' }, `New in the almanac: ${entry.name}.`));
  }
  if (done.kind === 'daily') {
    news.push(el('p', { class: 'desk-small' }, outcome.firstDaily ? 'Your first finished Daily Orchard today: this one counts.' : 'Today’s Daily Orchard was already recorded; this one was for fun.'));
  }
  if (free && s.score >= FREE_MILESTONE) news.push(el('p', { class: 'desk-small' }, `Past ${FREE_MILESTONE} points: the Hall counts this one as a win.`));
  // Three big stars under the title: those this crawl earned light up, the new ones with a pop.
  const shine = free
    ? null
    : el(
        'p',
        { class: 'desk-bigstars', 'data-testid': 'report-stars', 'aria-label': `${starsOf(orchard).filter((star) => star.met(s)).length} of 3 stars this crawl` },
        starsOf(orchard).map((star) =>
          el('span', { class: `${star.met(s) ? 'is-on' : ''}${outcome.stars.includes(star.id) ? ' is-fresh' : ''}`, 'aria-hidden': 'true' }, star.met(s) ? '★' : '☆'),
        ),
      );
  const stars = free
    ? null
    : el(
        'ul',
        { class: 'desk-starlist' },
        starsOf(orchard).map((star) => {
          const fresh = outcome.stars.includes(star.id);
          const held = done.kind === 'orchard' ? heldStars(orchard).includes(star.id) : star.met(s);
          return el(
            'li',
            { class: fresh ? 'is-fresh' : held ? 'is-done' : '' },
            el('span', { class: 'desk-star' }, held ? '★' : '☆'),
            star.text,
            fresh ? el('em', {}, ' new!') : null,
          );
        }),
      );
  const share = done.kind === 'daily' ? button('Share', () => shareDaily(done, s), { 'data-choice': 'share' }) : null;
  const ending = outcome.completed ? button('Read the ending', () => showDesk('ending'), { primary: true, 'data-choice': 'ending' }) : null;
  const card = el(
    'section',
    { class: `desk-card ${s.home ? 'is-home' : 'is-crashed'}`, role: 'dialog', 'aria-labelledby': 'desk-report-title', 'data-testid': 'desk-report' },
    el('span', { class: 'desk-small' }, kicker),
    el('div', { class: 'desk-report-head' }, el('h2', { id: 'desk-report-title' }, s.home ? 'Home!' : 'Crashed'), shine),
    s.home ? null : el('p', { class: 'desk-why' }, CRASH_LINES[s.reason] ?? 'The crawl is over.'),
    el('p', { class: 'desk-haul' }, `${s.score} points · 🍎 ${s.harvested} eaten · length ${s.length}`),
    el(
      'p',
      { class: 'desk-small' },
      [
        `best bite ${s.bestBite}`,
        s.frogs ? `${s.frogs} ${s.frogs === 1 ? 'frog' : 'frogs'}` : null,
        s.stolen ? `the bird took ${s.stolen}` : null,
        s.rivalCrashes ? 'the rival crashed' : null,
        `${Math.round(s.seconds)} s`,
      ]
        .filter(Boolean)
        .join(' · '),
    ),
    !s.home && !free ? el('p', { class: 'desk-small' }, 'Stars are earned on a crawl that comes home.') : null,
    stars,
    news,
    el(
      'div',
      { class: 'desk-row' },
      ending,
      button(['Crawl again ', kbd('R')], () => startCrawl({ kind: done.kind, orchard: done.orchard, dailyKey: done.dailyKey, mode: done.mode }), {
        primary: !ending,
        'data-choice': 'again',
        'data-autofocus': ending ? null : true,
      }),
      button('Game menu', () => showDesk(free ? 'free' : 'orchards'), { 'data-choice': 'menu' }),
      hostedInHall ? button(['Back to the Hall ', kbd('H')], leaveForHall, { 'data-choice': 'hall' }) : null,
      share,
    ),
  );
  overlay.replaceChildren(card);
  overlay.hidden = false;
  focusFirst(card);
}

async function shareDaily(done, s) {
  const stars = starsOf(done.orchard).filter((star) => star.met(s)).length;
  const line = dailyShareLine({ number: done.number, orchardName: done.orchard.name, home: s.home, apples: s.harvested, score: s.score, stars });
  let copied = false;
  try {
    await navigator.clipboard.writeText(line);
    copied = true;
  } catch {
    // No clipboard here: the line is shown to copy by hand.
  }
  const note = overlay.querySelector('.desk-share') ?? el('p', { class: 'desk-share desk-small', role: 'status' });
  note.textContent = copied ? `Copied: ${line}` : line;
  overlay.querySelector('.desk-card')?.append(note);
}

// ------------------------------------------------------------------ pausing

function applyPause() {
  const held = playerPaused || hallPaused;
  game().setPaused(held);
  holdSound(held);
}

function pauseCrawl() {
  if (!crawl || crawl.ended || playerPaused) return;
  if (game().state !== 'playing') return;
  playerPaused = true;
  applyPause();
  showPauseCard('menu');
}

function resumeCrawl() {
  if (!playerPaused) return;
  playerPaused = false;
  overlay.hidden = true;
  applyPause();
  (document.activeElement instanceof HTMLElement ? document.activeElement : null)?.blur();
}

/** Asks before a crawl is thrown away; `leave` runs once the player says so. */
function confirmLeaving(what, leave) {
  showPauseCard('confirm', { what, leave });
}

function leaveCrawl(next) {
  crawl = null;
  playerPaused = false;
  applyPause();
  next();
}

function showPauseCard(which, detail = {}) {
  const back = button('← Back', () => showPauseCard('menu'), { 'data-testid': 'pause-back' });
  let body;
  if (which === 'help') body = [back, el('div', { class: 'desk-pause-scroll' }, helpSections())];
  else if (which === 'settings') body = [back, settingsPanel(() => showPauseCard('settings'))];
  else if (which === 'confirm') {
    body = [
      el('p', { class: 'desk-lead' }, `${detail.what}? This crawl will not be recorded.`),
      el(
        'div',
        { class: 'desk-row' },
        button('Leave the crawl', () => leaveCrawl(detail.leave), { primary: true, 'data-testid': 'pause-leave' }),
        button('Stay', () => showPauseCard('menu'), { 'data-autofocus': true }),
      ),
    ];
  } else {
    body = [
      el(
        'div',
        { class: 'desk-pause-list' },
        button(['Resume ', kbd('Esc')], resumeCrawl, { primary: true, 'data-autofocus': true, 'data-testid': 'pause-resume' }),
        button('Restart this crawl', () => {
          const again = crawl;
          confirmLeaving('Start this crawl again', () =>
            startCrawl({ kind: again.kind, orchard: again.orchard, dailyKey: again.dailyKey, mode: again.mode, challenge: again.challenge }),
          );
        }),
        button('How to play', () => showPauseCard('help')),
        button('Settings', () => showPauseCard('settings'), { 'data-testid': 'pause-settings' }),
        button(
          'Game menu',
          () =>
            crawl?.challenge
              ? confirmLeaving('Go back to the challenges', () => showDesk('challenges'))
              : confirmLeaving('Go back to the orchards', () => showDesk()),
          { 'data-testid': 'pause-menu' },
        ),
        hostedInHall ? button('Back to the Hall', () => confirmLeaving('Go back to the Hall', leaveForHall)) : null,
      ),
    ];
  }
  const card = el(
    'section',
    { class: 'desk-card desk-pause', role: 'dialog', 'aria-labelledby': 'desk-pause-title', 'data-testid': 'pause-card' },
    el('h2', { id: 'desk-pause-title' }, which === 'help' ? 'How to play' : which === 'settings' ? 'Settings' : 'Paused'),
    body,
  );
  overlay.replaceChildren(card);
  overlay.hidden = false;
  focusFirst(card);
}

// ------------------------------------------------------------------ what the orchard tells us

const RIVAL_CRASHES = new Set(['wall', 'self', 'your-body', 'fence']);
let lastLedgerRefresh = 0;

/** A challenge's verdict on a move or a bite: the orchard ends the crawl there. */
function judge(verdict) {
  if (!verdict) return;
  if (verdict.kind === 'success') game().succeed(verdict.reason);
  else game().fail(verdict.reason);
}

function onGameEvent(event) {
  if (event.type === 'frame') {
    if (!posterSent && !menu.hidden && performance.now() - deskOpenedAt > 3000) {
      posterSent = true;
      offerPoster(event.canvas);
    }
    if (crawl && !crawl.ended && performance.now() - lastLedgerRefresh > 120) {
      lastLedgerRefresh = performance.now();
      refreshLedger();
    }
    return;
  }
  if (!crawl || crawl.ended) return;
  const s = crawl.summary;
  switch (event.type) {
    case 'bite':
      s.harvested = event.harvested;
      s.bestBite = Math.max(s.bestBite, event.points);
      if (event.points > event.value) s.chains++;
      s.length = event.length;
      if (event.rotten) s.rottenEaten++;
      play.bite(event.value, event.points > event.value);
      if (event.points >= 20) say(`A chain! That bite scored ${event.points}.`, 2200);
      if ((crawl.kind === 'orchard' || crawl.kind === 'daily') && s.harvested === crawl.orchard.harvest) say('Harvest in! Your burrow is opening.', 2600);
      if (crawl.challenge?.onBite) judge(crawl.challenge.onBite(crawl.judging, event));
      break;
    case 'moved':
      if (crawl.challenge?.onMove) judge(crawl.challenge.onMove(crawl.judging, game().peek()));
      return;
    case 'frog-caught':
      s.frogs++;
      play.frog();
      say('Caught the frog: 50 points!', 2000);
      break;
    case 'bird-arrived':
      s.birdVisits++;
      break;
    case 'bird-stole':
      s.stolen++;
      play.stolen();
      say(`The bird took ${aNumber(event.value)}.`, 2000);
      break;
    case 'wasp-hatched':
      s.waspsHatched++;
      play.hatch();
      say('A wasp hatched from a spoiled apple. Keep moving!', 2600);
      break;
    case 'rival-arrived':
      say('A rival worm has come for the apples.', 2400);
      break;
    case 'rival-gone':
      if (RIVAL_CRASHES.has(event.cause)) {
        s.rivalCrashes++;
        play.rivalGone();
        say('The rival worm crashed.', 2000);
      }
      break;
    case 'gardener-arrived':
      s.gardenerVisits++;
      play.gardener();
      say('The gardener is here. Keep your distance!', 2600);
      break;
    case 'gardener-left':
      if (game().state === 'playing') {
        s.gardenerSeenOff++;
        say('The gardener has gone.', 2000);
      }
      break;
    case 'burrow-open':
      crawl.burrowOpen = true;
      play.burrowOpen();
      break;
    case 'burrowing': {
      const peek = game().peek();
      s.length = peek.length;
      play.home();
      break;
    }
    case 'home':
      return endCrawl('home');
    case 'filled':
      s.reason = 'filled';
      return endCrawl('filled');
    case 'success':
      return endCrawl('success');
    case 'crash':
      s.reason = event.reason;
      play.crash();
      return endCrawl('crash');
    default:
      return;
  }
  refreshLedger();
}

// ------------------------------------------------------------------ keys

function onKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  wakeSound();
  const key = event.key;
  if (crawl && !crawl.ended) {
    if (!playerPaused && (key === 'Escape' || key === 'p' || key === 'P')) {
      event.preventDefault();
      pauseCrawl();
    } else if (playerPaused && key === 'Escape') {
      event.preventDefault();
      if (overlay.querySelector('[data-testid="pause-back"]')) showPauseCard('menu');
      else resumeCrawl();
    }
    return;
  }
  if (!overlay.hidden) {
    const lower = key.toLowerCase();
    const choice = lower === 'r' ? 'again' : lower === 'h' ? 'hall' : key === 'Escape' ? 'menu' : null;
    const target = choice && overlay.querySelector(`[data-choice="${choice}"]`);
    if (target) {
      event.preventDefault();
      target.click();
    }
    return;
  }
  if (!menu.hidden) {
    const onSubPage = view !== 'orchards';
    if (onSubPage && (key === 'Backspace' || key === 'Escape') && !(event.target instanceof HTMLInputElement)) {
      event.preventDefault();
      showDesk(backFrom(view));
    } else if (key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      if (view.startsWith('challenge:')) {
        event.preventDefault();
        startCrawl({ kind: 'challenge', challenge: challengeById(view.slice(10)) });
      } else if (view.startsWith('brief:')) {
        event.preventDefault();
        startCrawl({ kind: 'orchard', orchard: orchardById(view.slice(6)) });
      } else if (view === 'free') {
        event.preventDefault();
        startCrawl({ kind: 'free', orchard: ORCHARDS[0], mode: options.free.mode });
      }
    }
  }
}

// ------------------------------------------------------------------ wiring

/** The page's appearance: the Hall's when it has said, else the system's. */
function setAppearance(appearance) {
  document.documentElement.dataset.appearance = appearance === 'dark' ? 'dark' : 'light';
}

function start() {
  game().on(onGameEvent);
  // The page set its appearance before its first paint (index.html); on its own it then follows
  // the system's changes, in the Hall the Hall's.
  const system = window.matchMedia?.('(prefers-color-scheme: dark)');
  system?.addEventListener?.('change', (e) => {
    if (!hostedInHall) setAppearance(e.matches ? 'dark' : 'light');
  });
  // On its own the page follows the system's reduced motion; in the Hall, the Hall's setting
  // (which may differ from the system's) replaces it as soon as the Hall says.
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (motion?.matches) {
    game().setReducedMotion(true);
    document.documentElement.dataset.motion = 'reduce';
  }
  setSoundOn(options.sound);
  followHall({
    pause: () => {
      hallPaused = true;
      applyPause();
    },
    resume: () => {
      hallPaused = false;
      applyPause();
    },
    motion: (reduced) => {
      game().setReducedMotion(reduced);
      document.documentElement.dataset.motion = reduced ? 'reduce' : 'full';
    },
    sound: () => setLevel(hallLevel),
    appearance: setAppearance,
  });
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', wakeSound, { once: true });
  showDesk();
  window.loadingAt?.(0.9);
  // The page shows itself once the game menu is drawn. Its appearance was read from the Hall's
  // frame before the first paint, so there is no need to wait for the Hall's greeting. A hidden
  // page cannot take focus, so the menu's first control is focused again once it shows.
  requestAnimationFrame(() => {
    window.loadingAt?.(1);
    document.documentElement.classList.remove('is-starting');
    if (!menu.hidden) focusFirst(menu);
  });
  window.__orchard = {
    get crawl() {
      return crawl;
    },
    get progress() {
      return progress;
    },
    get view() {
      return view;
    },
  };
}

if (window.OrchardGame) start();
else document.addEventListener('orchard-ready', start, { once: true });
