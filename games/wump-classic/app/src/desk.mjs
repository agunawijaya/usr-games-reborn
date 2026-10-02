// The Rune Gates — the desk: everything around a delve. The game menu, the trail of twelve
// delves, the briefing before one, the chronicle after it, the ledger and the lore codex. The page
// (index.html) starts delves through window.RuneGatesPlay and tells this module what happens
// through window.RuneGatesDesk; the rules of play are untouched.

import { clearedCount, DELVES, delveById, emptyCareer, isOpen, nextDelve, rankOf, recordDelve, totalStars } from './career.mjs';
import { addToLedger, chronicleLines, emptyLedger } from './chronicle.mjs';
import { emptyCodex, newPages, PAGES } from './codex.mjs';
import { dailyDelve, dailyShareLine, localDateKey } from './daily.mjs';
import { hostedInHall, install, leaveForHall, offerPoster, onHallPause, reportDelve, setOnGameMenu } from './hall.mjs';
import { taskText, tasksMet } from './quests.mjs';
import { noteChart, noteMove as runMove, noteShot as runShot, startRun, summarize } from './run.mjs';
import { loadSaved, save } from './store.mjs';

const play = globalThis.RuneGatesPlay;
const params = new URLSearchParams(globalThis.location?.search ?? '');
/** Today's date; `?date=YYYY-MM-DD` stands in for it, so a Daily Delve can be replayed and tested. */
const todayKey = () => params.get('date') ?? localDateKey();

const state = {
  career: loadSaved('career', emptyCareer),
  ledger: loadSaved('ledger', emptyLedger),
  codex: loadSaved('codex', emptyCodex),
  daily: loadSaved('daily', () => ({})),
  droneHeard: loadSaved('drone', () => false),
};

/** The delve under way, if any, and how to play it again. */
let run = null;
let runStartedAt = 0;
let lastStart = null;
let current = null;

// —— building blocks ——

function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) node.append(child);
  return node;
}

function button(label, onclick, extra = {}) {
  return h('button', { type: 'button', class: 'desk-btn', onclick, ...extra }, label);
}

function key(label) {
  return h('kbd', { class: 'desk-key' }, label);
}

function seals(met, total = 3) {
  return h(
    'span',
    { class: 'desk-seals', 'aria-label': `${met} of ${total} seals` },
    ...Array.from({ length: total }, (_, i) => h('span', { class: i < met ? 'seal is-earned' : 'seal', 'aria-hidden': 'true' }, i < met ? '◆' : '◇')),
  );
}

/** A line of the delvers' script along a shallow arch, drawn by the same code as the gates. */
function inscription(phrase, width, height) {
  const canvas = h('canvas', { class: 'desk-inscription', width: String(width * 2), height: String(height * 2), 'aria-hidden': 'true' });
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.strokeStyle = '#b4f4fb';
  ctx.fillStyle = '#b4f4fb';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#67e8f9';
  ctx.shadowBlur = 8;
  globalThis.RuneArt?.inscribeArc(ctx, phrase, width / 2, height * 2.9, width * 0.62, height * 2.55, Math.PI * 1.32, Math.PI * 1.68, 15, 1.5);
  return canvas;
}

// —— the desk itself ——

const root = h('div', { id: 'desk', class: 'desk', role: 'dialog', 'aria-modal': 'true' });
document.getElementById('game-container').append(root);

function isOpenDesk() {
  return root.classList.contains('open');
}

function show(name, panel, { menu = false } = {}) {
  current = name;
  root.replaceChildren(panel);
  root.className = `desk open desk--${name}`;
  root.setAttribute('aria-label', panel.dataset.label ?? 'The Rune Gates');
  document.body.dataset.desk = name;
  setOnGameMenu(menu);
  const first = panel.querySelector('[data-focus]') ?? panel.querySelector('button');
  first?.focus();
}

function closeDesk() {
  current = null;
  root.className = 'desk';
  root.replaceChildren();
  document.body.dataset.desk = 'play';
  setOnGameMenu(false);
}

// —— the game menu ——

function showMenu() {
  const career = state.career;
  const next = nextDelve(career);
  const rank = rankOf(career);
  const daily = dailyDelve(todayKey());
  const done = state.daily[daily.key];
  const panel = h(
    'section',
    { class: 'desk-panel desk-menu', 'data-label': 'Game menu' },
    inscription(': walk softly · the deep is awake :', 380, 70),
    h('h1', { class: 'desk-title' }, 'The Rune Gates'),
    h('p', { class: 'desk-lede' }, 'Follow the draft, the stench and the wings to the wumpus’s chamber, and loose a crooked arrow into it.'),
    h(
      'p',
      { class: 'desk-rank', 'data-testid': 'rank' },
      h('strong', {}, rank.name),
      ` · ${clearedCount(career)} of ${DELVES.length} delves cleared · ${totalStars(career)} seals`,
    ),
    h(
      'nav',
      { class: 'desk-menu-list', 'aria-label': 'Game menu' },
      menuItem('Continue', `Delve ${next.number} · ${next.name}`, () => showBriefing({ kind: 'career', delve: next }), true),
      menuItem('The Delves', `${clearedCount(career)} of ${DELVES.length} cleared`, showTrail),
      menuItem(
        'Daily Delve',
        done ? `#${daily.number} · ${done.slain ? `slain in ${done.moves} moves` : 'delved'}` : `#${daily.number} · ${daily.name}`,
        () => showBriefing({ kind: 'daily', daily }),
      ),
      menuItem('Free delve', 'choose the cave yourself', openFreeSetup),
      menuItem('Ledger', `${state.ledger.length} chronicles`, showLedger),
      menuItem('Lore codex', `${state.codex.length} of ${PAGES.length} pages`, showCodex),
      menuItem('How to play', 'senses, arrows, keys', () => play.openLore()),
    ),
    h('p', { class: 'desk-credit' }, 'After wump from the BSD games, and Gregory Yob’s 1973 cave hunt.'),
  );
  show('menu', panel, { menu: true });
}

function menuItem(label, note, onclick, primary = false) {
  return h(
    'button',
    { type: 'button', class: primary ? 'desk-menu-item is-primary' : 'desk-menu-item', onclick, 'data-focus': primary || undefined },
    h('span', { class: 'desk-menu-label' }, label),
    h('span', { class: 'desk-menu-note' }, note),
  );
}

function openFreeSetup() {
  // The game's own setup dialog starts a free delve; the menu stays underneath it.
  document.getElementById('modal-settings').classList.add('open');
  document.getElementById('set-level')?.focus();
}

// —— the trail of delves ——

function showTrail() {
  const career = state.career;
  const halls = [...new Set(DELVES.map((d) => d.hall))];
  const panel = h(
    'section',
    { class: 'desk-panel desk-wide', 'data-label': 'The Delves' },
    pageHead('The Delves', 'Twelve delves, each deeper than the last. Slay the wumpus in one to open the gate to the next.'),
    h(
      'div',
      { class: 'desk-trail' },
      ...halls.map((hall) =>
        h(
          'section',
          { class: 'desk-hall' },
          h('h2', { class: 'desk-hall-name' }, hall),
          h(
            'ol',
            { class: 'desk-delves' },
            ...DELVES.filter((d) => d.hall === hall).map((delve) => {
              const index = DELVES.indexOf(delve);
              const record = career.delves[delve.id];
              const open = isOpen(career, index);
              return h(
                'li',
                {},
                h(
                  'button',
                  {
                    type: 'button',
                    class: `desk-delve${record?.cleared ? ' is-cleared' : ''}${open ? '' : ' is-locked'}`,
                    disabled: !open,
                    onclick: () => showBriefing({ kind: 'career', delve }),
                    'aria-label': `Delve ${delve.number}: ${delve.name}. ${open ? delve.idea : 'Clear the delve before it to open this gate.'}`,
                  },
                  h('span', { class: 'desk-delve-number' }, String(delve.number)),
                  h('span', { class: 'desk-delve-text' }, h('strong', {}, delve.name), h('small', {}, open ? delve.idea : 'The gate is still shut.')),
                  open ? seals(record?.stars ?? 0) : null,
                ),
              );
            }),
          ),
        ),
      ),
    ),
  );
  show('trail', panel);
}

function pageHead(title, lede) {
  return h(
    'header',
    { class: 'desk-head' },
    button('← Game menu', showMenu, { class: 'desk-btn desk-back' }),
    h('div', {}, h('h1', { class: 'desk-page-title' }, title), lede ? h('p', { class: 'desk-lede' }, lede) : null),
  );
}

// —— the briefing ——

function caveFacts(options) {
  const chambers = options.mode === 'dodecahedron' ? 20 : options.roomNum;
  const plan = options.mode === 'dodecahedron' ? 'the twelve-faced plan' : 'dug by chance';
  return `${chambers} chambers, ${plan} · ${options.level === 'HARD' ? 'hard level' : 'easy level'} · ${options.arrowNum} arrows · ${options.batNum} bat roosts · ${options.pitNum} pits${options.level === 'HARD' ? ' and more' : ''}`;
}

function showBriefing(what) {
  const isDaily = what.kind === 'daily';
  const delve = what.delve;
  const daily = what.daily;
  const tasks = isDaily ? daily.tasks : delve.tasks;
  const options = isDaily ? daily.options : delve.options;
  const record = isDaily ? null : state.career.delves[delve.id];
  const already = isDaily ? state.daily[daily.key] : null;
  const start = () =>
    beginDelve(
      isDaily
        ? { kind: 'daily', name: `Daily Delve #${daily.number} · ${daily.name}`, dailyKey: daily.key, tasks, options }
        : { kind: 'career', name: `Delve ${delve.number} · ${delve.name}`, delveId: delve.id, tasks, options },
    );
  const panel = h(
    'section',
    { class: 'desk-panel desk-briefing', 'data-label': 'Briefing' },
    pageHead(isDaily ? `Daily Delve #${daily.number}` : `Delve ${delve.number} · ${delve.name}`, isDaily ? `${daily.name}. The same cave for every delver today.` : delve.idea),
    h('p', { class: 'desk-facts' }, caveFacts(options)),
    h('h2', { class: 'desk-subhead' }, 'Your quests'),
    h(
      'ul',
      { class: 'desk-tasks' },
      ...tasks.map((task) => h('li', {}, h('span', { class: 'seal', 'aria-hidden': 'true' }, '◇'), ' ', taskText(task))),
    ),
    h(
      'p',
      { class: 'desk-note' },
      isDaily
        ? already
          ? 'You have delved here today already; this one is for practice and will not count.'
          : 'Only your first delve of the day counts.'
        : record
          ? `Best so far: ${record.stars} of 3 seals${record.cleared ? `, cleared in ${record.bestMoves} moves` : ''}. Tries: ${record.tries}.`
          : 'A seal for every quest met on a delve whose wumpus you slay.',
    ),
    h('div', { class: 'desk-actions' }, h('button', { type: 'button', class: 'desk-btn is-primary', onclick: start, 'data-focus': true }, 'Begin the delve ', key('Enter'))),
  );
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target === panel.querySelector('.is-primary')) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      start();
    }
  });
  show('briefing', panel);
}

// —— a delve ——

function beginDelve(what) {
  abandonRun();
  lastStart = what;
  const game = play.begin(what.options, null);
  run = startRun(what, game);
  runStartedAt = performance.now();
  document.body.classList.toggle('free-delve', what.kind === 'free');
  closeDesk();
  showIntro(game);
}

function showIntro(game) {
  const banner = document.getElementById('banner-notify');
  banner.textContent = `${run.name}. You step through the rune gate into Chamber ${game.playerLoc}. Listen closely to the cave…`;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 3800);
}

/** A delve left half-way reports a quit; one not yet begun reports nothing. */
function abandonRun() {
  if (!run || run.ended) return;
  run.ended = true;
  if (run.moves + run.arrowsFired === 0) return;
  const game = play.current();
  reportDelve('quit', summarize(run, game), { seals: 0, promoted: false, daily: false, seconds: secondsSince(runStartedAt) });
}

function secondsSince(start) {
  return Math.round((performance.now() - start) / 1000);
}

function leaveDelve() {
  if (run && !run.ended && run.moves + run.arrowsFired > 0) {
    confirmLeave();
    return;
  }
  abandonRun();
  showMenu();
}

function confirmLeave() {
  const panel = h(
    'section',
    { class: 'desk-panel desk-confirm', 'data-label': 'Leave this delve?' },
    h('h1', { class: 'desk-page-title' }, 'Leave this delve?'),
    h('p', { class: 'desk-lede' }, 'It ends here and does not count.'),
    h(
      'div',
      { class: 'desk-actions' },
      h('button', { type: 'button', class: 'desk-btn is-primary', 'data-focus': true, onclick: closeDesk }, 'Keep delving'),
      button('Leave', () => {
        abandonRun();
        showMenu();
      }),
    ),
  );
  show('confirm', panel);
}

// —— the end of a delve ——

function finishRun(isVictory, title, message, game) {
  if (!run || run.ended) run = startRun({ kind: 'free', name: 'Free delve' }, game);
  run.ended = true;
  const summary = summarize(run, game);
  const met = tasksMet(run.tasks, summary);
  const sealCount = met.filter(Boolean).length;
  const notes = [];
  let promoted = false;
  let counted = false;

  if (run.kind === 'career') {
    const result = recordDelve(state.career, run.delveId, { slain: summary.slain, seals: sealCount, moves: summary.moves });
    state.career = result.career;
    save('career', state.career);
    promoted = result.promoted;
    if (result.firstClear) notes.push('The gate to the next delve stands open.');
    if (result.newStars > 0) notes.push(`${result.newStars === 1 ? 'A new seal' : `${result.newStars} new seals`} for this delve.`);
    if (promoted) notes.push(`You are now a ${result.rank.name}.`);
  }
  if (run.kind === 'daily' && !state.daily[run.dailyKey]) {
    counted = true;
    state.daily = {
      ...state.daily,
      [run.dailyKey]: { number: dailyDelve(run.dailyKey).number, slain: summary.slain, moves: summary.moves, arrowsLeft: summary.arrowsLeft, sealsMet: met },
    };
    save('daily', state.daily);
  }

  const lines = chronicleLines(run, { title, message });
  state.ledger = addToLedger(state.ledger, {
    when: `${todayKey()}`,
    heading: run.name,
    slain: summary.slain,
    moves: summary.moves,
    arrowsLeft: summary.arrowsLeft,
    seals: sealCount,
    lines,
  });
  save('ledger', state.ledger);

  const delve = run.delveId ? delveById(run.delveId) : null;
  const found = newPages(state.codex, {
    run,
    summary,
    delve,
    daily: run.kind === 'daily',
    cleared: clearedCount(state.career),
    droneHeard: state.droneHeard,
  });
  if (found.length > 0) {
    state.codex = [...state.codex, ...found];
    save('codex', state.codex);
  }

  installPackages(summary, sealCount, counted, game);
  reportDelve(summary.slain ? 'win' : 'loss', summary, {
    seals: sealCount,
    promoted,
    daily: counted,
    seconds: secondsSince(runStartedAt),
  });
  showReport({ title, message, summary, met, lines, notes, found, counted });
  return true;
}

function installPackages(summary, sealCount, counted, game) {
  if (summary.slain) install('first-slay');
  if (summary.slain && summary.arrowsFired === 1) install('single-arrow');
  if (summary.slayingPath >= 3) install('crooked-flight');
  if (summary.batRides > 0) install('bat-rider');
  if (summary.ledges > 0) install('outcrop');
  if (summary.slain && game.level === 'HARD') install('hard-gate');
  if (sealCount > 0) install('first-seal');
  if (totalStars(state.career) >= 18) install('sealbearer');
  if (clearedCount(state.career) >= 6) install('gate-warden');
  if (clearedCount(state.career) >= DELVES.length) install('master-delver');
  if (counted) install('daily-delver');
  if (state.codex.length >= PAGES.length) install('loremaster');
}

function showReport({ title, message, summary, met, lines, notes, found, counted }) {
  const ended = run;
  const next = ended.kind === 'career' ? nextAfter(ended.delveId) : null;
  const share = ended.kind === 'daily' ? shareLineFor(ended, summary, met) : null;
  const actions = [
    h('button', { type: 'button', class: 'desk-btn is-primary', 'data-focus': true, onclick: playAgain }, 'Play again ', key('R')),
    button('Game menu', showMenu),
    hostedInHall ? h('button', { type: 'button', class: 'desk-btn', onclick: leaveForHall }, 'Back to the Hall ', key('H')) : null,
    next ? h('button', { type: 'button', class: 'desk-btn', onclick: () => showBriefing({ kind: 'career', delve: next }) }, `Next: ${next.name} `, key('N')) : null,
    share ? button('Copy share line', () => copyShare(share)) : null,
  ];
  const tasksDone =
    ended.tasks.length > 0
      ? h(
          'ul',
          { class: 'desk-tasks desk-tasks--done' },
          ...ended.tasks.map((task, i) =>
            h('li', { class: met[i] ? 'is-met' : '' }, h('span', { class: met[i] ? 'seal is-earned' : 'seal', 'aria-hidden': 'true' }, met[i] ? '◆' : '◇'), ' ', taskText(task)),
          ),
        )
      : null;
  // Two columns: how it ended on the left, the chronicle of the delve on the right.
  const panel = h(
    'section',
    { class: `desk-panel desk-report ${summary.slain ? 'is-victory' : 'is-defeat'}`, 'data-label': 'Chronicle of the delve', 'data-testid': 'report' },
    h(
      'div',
      { class: 'desk-report-main' },
      h('p', { class: 'desk-kicker' }, ended.name),
      h('h1', { class: 'desk-report-title' }, title),
      h('p', { class: 'desk-report-message' }, message),
      tasksDone,
      h(
        'dl',
        { class: 'desk-stats' },
        stat('Moves', summary.moves),
        stat('Arrows left', summary.arrowsLeft),
        stat('Bat rides', summary.batRides),
        stat('Chambers seen', summary.visited),
      ),
      ...notes.map((note) => h('p', { class: 'desk-note' }, note)),
      found.length > 0 ? h('p', { class: 'desk-note desk-found' }, `New in the lore codex: ${found.map((id) => PAGES.find((p) => p.id === id).title).join(', ')}.`) : null,
      ended.kind === 'daily' ? h('p', { class: 'desk-note' }, counted ? 'Your Daily Delve is in the ledger.' : 'Practice: only the first delve of the day counts.') : null,
      share ? h('p', { class: 'desk-share', 'data-testid': 'share-line' }, share) : null,
    ),
    h('div', { class: 'desk-report-side' }, h('h2', { class: 'desk-subhead' }, 'Chronicle'), h('ol', { class: 'desk-chronicle' }, ...lines.map((line) => h('li', {}, line)))),
    h('div', { class: 'desk-actions' }, ...actions),
  );
  show('report', panel);
}

function stat(label, value) {
  return h('div', { class: 'desk-stat' }, h('dt', {}, label), h('dd', {}, String(value)));
}

function nextAfter(delveId) {
  const index = DELVES.findIndex((d) => d.id === delveId);
  const next = DELVES[index + 1];
  return next && isOpen(state.career, index + 1) ? next : null;
}

function shareLineFor(ended, summary, met) {
  const record = state.daily[ended.dailyKey];
  return dailyShareLine({
    number: dailyDelve(ended.dailyKey).number,
    slain: record ? record.slain : summary.slain,
    moves: record ? record.moves : summary.moves,
    arrowsLeft: record ? record.arrowsLeft : summary.arrowsLeft,
    sealsMet: record ? record.sealsMet : met,
  });
}

function copyShare(line) {
  const done = () => {
    const banner = document.getElementById('banner-notify');
    banner.textContent = 'Share line copied.';
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 2200);
  };
  navigator.clipboard?.writeText(line).then(done, done) ?? done();
}

function playAgain() {
  if (!lastStart) {
    showMenu();
    return;
  }
  // The Daily Delve replays the same cave; a career delve or a free one digs a new one.
  beginDelve(lastStart);
}

// —— the ledger ——

function showLedger() {
  const panel = h(
    'section',
    { class: 'desk-panel desk-wide', 'data-label': 'Ledger' },
    pageHead('Ledger', 'The chronicles of your last thirty delves, newest first.'),
    state.ledger.length === 0
      ? h('p', { class: 'desk-note' }, 'Nothing written yet. Every delve you finish is written up here.')
      : h(
          'ol',
          { class: 'desk-ledger' },
          ...state.ledger.map((entry) =>
            h(
              'li',
              {},
              h(
                'details',
                {},
                h(
                  'summary',
                  {},
                  h('strong', {}, entry.heading),
                  ` · ${entry.when} · ${entry.slain ? `slain in ${entry.moves} moves` : `lost after ${entry.moves} moves`} · `,
                  seals(entry.seals),
                ),
                h('ol', { class: 'desk-chronicle' }, ...entry.lines.map((line) => h('li', {}, line))),
              ),
            ),
          ),
        ),
  );
  show('ledger', panel);
}

// —— the lore codex ——

function showCodex() {
  const panel = h(
    'section',
    { class: 'desk-panel desk-wide', 'data-label': 'Lore codex' },
    pageHead('Lore codex', `${state.codex.length} of ${PAGES.length} pages found. Each is found by doing something for the first time.`),
    h(
      'ol',
      { class: 'desk-codex' },
      ...PAGES.map((page) => {
        const found = state.codex.includes(page.id);
        return h(
          'li',
          {},
          h(
            'button',
            { type: 'button', class: found ? 'desk-page' : 'desk-page is-hidden', disabled: !found, onclick: () => showPage(page) },
            h('strong', {}, found ? page.title : '— unwritten —'),
            h('small', {}, found ? 'Read' : page.hint),
          ),
        );
      }),
    ),
  );
  show('codex', panel);
}

function showPage(page) {
  const panel = h(
    'section',
    { class: 'desk-panel desk-lore', 'data-label': page.title },
    h('header', { class: 'desk-head' }, button('← Lore codex', showCodex, { class: 'desk-btn desk-back' })),
    inscription(`: ${page.title.toLowerCase()} :`, 420, 64),
    h('h1', { class: 'desk-page-title' }, page.title),
    ...page.text.map((paragraph) => h('p', {}, paragraph)),
  );
  show('page', panel);
}

// —— keys ——

const BACK_TO = { trail: showMenu, briefing: showMenu, ledger: showMenu, codex: showMenu, page: showCodex, report: showMenu };

window.addEventListener(
  'keydown',
  (event) => {
    if (!isOpenDesk() || document.querySelector('.modal-backdrop.open')) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const keyName = event.key.toLowerCase();
    if (keyName === 'escape') {
      // On the game menu Escape is the Hall's (the bridge takes it there); elsewhere it goes back.
      if (current === 'confirm') {
        event.preventDefault();
        closeDesk();
      } else if (BACK_TO[current]) {
        event.preventDefault();
        BACK_TO[current]();
      }
      return;
    }
    if (current !== 'report') return;
    if (keyName === 'r') {
      event.preventDefault();
      playAgain();
    } else if (keyName === 'h' && hostedInHall) {
      event.preventDefault();
      leaveForHall();
    } else if (keyName === 'n' && run?.kind === 'career') {
      const next = nextAfter(run.delveId);
      if (next) {
        event.preventDefault();
        showBriefing({ kind: 'career', delve: next });
      }
    }
  },
  true,
);

// —— what the page tells the desk ——

globalThis.RuneGatesDesk = {
  ownsKeys: () => isOpenDesk() && !document.querySelector('.modal-backdrop.open'),
  noteMove(target, res, game) {
    if (!run || run.ended) run = startRun({ kind: 'free', name: 'Free delve' }, game);
    runMove(run, target, res, game);
  },
  noteShot(path, res, game) {
    if (!run || run.ended) run = startRun({ kind: 'free', name: 'Free delve' }, game);
    runShot(run, path, res, game);
  },
  noteMap() {
    if (run) noteChart(run);
  },
  noteDrone(on) {
    if (on && !state.droneHeard) {
      state.droneHeard = true;
      save('drone', true);
    }
  },
  /** The game's own setup dialog has started a free delve. */
  noteNewGame(game) {
    abandonRun();
    // Play again repeats the same choices with a freshly dug cave.
    lastStart = { kind: 'free', name: 'Free delve', tasks: [], options: { ...game.options, seed: null } };
    run = startRun(lastStart, game);
    runStartedAt = performance.now();
    document.body.classList.add('free-delve');
    closeDesk();
  },
  finishRun,
};

document.getElementById('btn-desk-menu')?.addEventListener('click', leaveDelve);
onHallPause(
  () => play.pauseSound(),
  () => play.resumeSound(),
);

showMenu();
// The Hall's key art: the cave behind the menu, once it has been drawn for a moment.
setTimeout(() => offerPoster(play.layers()), 2500);
