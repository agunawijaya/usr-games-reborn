// Broken Well — the desk: everything around a shift. The game menu, the trail of twelve shifts,
// the briefing before one, the report after it, the logbook, Free Dig settings and the Daily
// Shift. The page (index.html) starts shifts through window.BrokenWellPlay and this module reads
// its live game through window.game; the rules of play themselves are untouched.

import { clearedCount, emptyCareer, nextShift, rankOf, recordShift, SHIFTS, totalStars } from './career.mjs';
import { addToLogbook, chronicleLines, emptyLogbook } from './chronicle.mjs';
import { dailyShareLine, dailyShift, localDateKey } from './daily.mjs';
import {
  hostedInHall,
  install,
  leaveForHall,
  offerPoster,
  onHallAppearance,
  onHallPause,
  onHallReducedMotion,
  onHallSound,
  reportShift,
  setOnGameMenu,
} from './hall.mjs';
import { taskText, tasksMet } from './quests.mjs';
import { hasReachedTarget, startRun, summarize } from './run.mjs';
import { loadSaved, save } from './store.mjs';

const play = globalThis.BrokenWellPlay;
const params = new URLSearchParams(globalThis.location?.search ?? '');
/** Today's date; `?date=YYYY-MM-DD` stands in for it, so a Daily Shift can be replayed and tested. */
const todayKey = () => params.get('date') ?? localDateKey();

const state = {
  career: loadSaved('career', emptyCareer),
  logbook: loadSaved('logbook', emptyLogbook),
  daily: loadSaved('daily', () => ({})),
};

let run = null;
let paused = false;

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

function kbd(label) {
  return h('kbd', { class: 'desk-key' }, label);
}

function seals(met, total) {
  return h(
    'span',
    { class: 'desk-seals', 'aria-label': `${met} of ${total} contracts met` },
    ...Array.from({ length: total }, (_, i) =>
      h('span', { class: i < met ? 'seal is-earned' : 'seal', 'aria-hidden': 'true' }, i < met ? '◆' : '◇'),
    ),
  );
}

// —— the desk itself ——

const root = h('div', { id: 'desk', class: 'desk', role: 'dialog', 'aria-modal': 'true' });
document.getElementById('game-container').append(root);

function show(name, panel, { menu = false } = {}) {
  root.replaceChildren(panel);
  root.className = `desk open desk--${name}`;
  root.setAttribute('aria-label', panel.dataset.label ?? 'Broken Well');
  document.body.dataset.desk = name;
  setOnGameMenu(menu);
  // preventScroll: a long panel (the trail of twelve shifts) must open at its top, not auto-scroll
  // down to whichever button happens to carry the initial focus.
  const first = panel.querySelector('[data-focus]') ?? panel.querySelector('button');
  first?.focus({ preventScroll: true });
  panel.scrollTop = 0;
}

function closeDesk() {
  root.className = 'desk';
  root.replaceChildren();
  document.body.dataset.desk = 'play';
  setOnGameMenu(false);
}

// —— the game menu ——

function showMenu() {
  const career = state.career;
  const next = nextShift(career);
  const rank = rankOf(career);
  const daily = dailyShift(todayKey());
  const done = state.daily[daily.key];
  const panel = h(
    'section',
    { class: 'desk-panel desk-menu', 'data-label': 'Game menu' },
    h('h1', { class: 'desk-title' }, 'Broken Well'),
    h('p', { class: 'desk-lede' }, 'A foreman’s shaft never holds its shape. Clear what the quarry gives you, hold back what rises.'),
    h('p', { class: 'desk-rank' }, 'Rank: ', h('strong', {}, rank.name), ` · ${clearedCount(career)} of ${SHIFTS.length} shifts cleared`),
    h(
      'div',
      { class: 'desk-menu-grid' },
      button(`Continue — Shift ${next.number}: ${next.name}`, () => showBriefing(next, 'career')),
      button(`Daily Shift — #${daily.number}${done ? ' (done)' : ''}`, () => showDailyBriefing(daily)),
      button('The Shifts', showTrail),
      button('Free Dig', showFreeDig),
      button('Logbook', showLogbook),
      button('How to play', () => showHowToPlay(showMenu)),
    ),
  );
  show('menu', panel, { menu: true });
}

// —— the briefing ——

function contractList(tasks, shiftNumber) {
  return h(
    'ul',
    { class: 'desk-task-list' },
    ...tasks.map(([kind, n]) => h('li', {}, taskText([kind, n ?? shiftNumber]))),
  );
}

function showBriefing(shift, kind) {
  const panel = h(
    'section',
    { class: 'desk-panel desk-briefing', 'data-label': 'Shift briefing' },
    h('h2', { class: 'desk-title' }, `Shift ${shift.number}: ${shift.name}`),
    h('p', { class: 'desk-site' }, shift.site),
    h('p', { class: 'desk-idea' }, shift.idea),
    h('h3', {}, 'Your contracts'),
    contractList(shift.tasks, shift.number),
    h('div', { class: 'desk-actions' }, button('Begin the shift', () => beginRun({ kind, name: shift.name, shiftId: shift.id, tasks: shift.tasks }, shift.options), { 'data-focus': true }), button('Back', showMenu)),
  );
  show('briefing', panel);
}

function showDailyBriefing(daily) {
  const panel = h(
    'section',
    { class: 'desk-panel desk-briefing', 'data-label': 'Daily Shift briefing' },
    h('h2', { class: 'desk-title' }, `Daily Shift #${daily.number}`),
    h('p', { class: 'desk-site' }, daily.name),
    h('h3', {}, 'Your contracts'),
    contractList(daily.tasks, daily.number),
    h(
      'div',
      { class: 'desk-actions' },
      button('Begin the shift', () => beginRun({ kind: 'daily', name: daily.name, dailyKey: daily.key, tasks: daily.tasks }, daily.options), { 'data-focus': true }),
      button('Back', showMenu),
    ),
  );
  show('briefing', panel);
}

// —— Free Dig: the original port's settings screen, re-themed ——

function showFreeDig() {
  const fields = {
    preset: 'normal',
    mode: 'marathon',
    startLevel: 1,
    rubbleHeight: 0,
    rubbleDensity: 50,
    targetLines: 15,
    surviveRows: 10,
  };
  const presetSelect = h(
    'select',
    { class: 'desk-select' },
    ...['normal', 'canyon', 'split', 'hourglass', 'donut', 'staircase', 'tower', 'wide'].map((p) =>
      h('option', { value: p }, p.charAt(0).toUpperCase() + p.slice(1)),
    ),
  );
  const modeSelect = h('select', { class: 'desk-select' }, h('option', { value: 'marathon' }, 'The Long Dig'), h('option', { value: 'survival' }, 'The Rising Flood'));
  const rubbleHeightInput = h('input', { type: 'range', min: '0', max: '12', value: '0' });
  const rubbleDensityInput = h('input', { type: 'range', min: '20', max: '90', value: '50' });
  const targetInput = h('input', { type: 'number', min: '1', max: '99', value: '15' });

  const panel = h(
    'section',
    { class: 'desk-panel desk-settings', 'data-label': 'Free Dig settings' },
    h('h2', { class: 'desk-title' }, 'Free Dig'),
    h('p', { class: 'desk-lede' }, 'Pick a well, a starting rubble stack and a mode. No contracts, no rank, just the shape you want to practise against.'),
    h('label', { class: 'desk-field' }, 'Well shape', presetSelect),
    h('label', { class: 'desk-field' }, 'Mode', modeSelect),
    h('label', { class: 'desk-field' }, 'Starting rubble height', rubbleHeightInput),
    h('label', { class: 'desk-field' }, 'Rubble density', rubbleDensityInput),
    h('label', { class: 'desk-field' }, 'Lines to clear (Long Dig)', targetInput),
    h(
      'div',
      { class: 'desk-actions' },
      button(
        'Start digging',
        () => {
          const options = {
            preset: presetSelect.value,
            mode: modeSelect.value,
            startLevel: 1,
            rubbleHeight: Number(rubbleHeightInput.value),
            rubbleDensity: Number(rubbleDensityInput.value) / 100,
            targetLines: Number(targetInput.value),
            surviveRows: 20,
          };
          beginRun({ kind: 'free', name: 'Free Dig', tasks: [] }, options);
        },
        { 'data-focus': true },
      ),
      button('Back', showMenu),
    ),
  );
  show('settings', panel);
}

// —— the trail of shifts ——

function showTrail() {
  const career = state.career;
  const items = SHIFTS.map((shift, index) => {
    const record = career.shifts[shift.id];
    const open = index === 0 || career.shifts[SHIFTS[index - 1].id]?.cleared;
    const label = `Shift ${shift.number}: ${shift.name}`;
    return h(
      'li',
      { class: record?.cleared ? 'is-cleared' : open ? 'is-open' : 'is-locked' },
      open
        ? button(label, () => showBriefing(shift, 'career'))
        : h('span', { class: 'desk-locked' }, label, ' — locked'),
      record ? seals(record.stars, shift.tasks.length) : null,
    );
  });
  const panel = h(
    'section',
    { class: 'desk-panel desk-trail', 'data-label': 'The Shifts' },
    h('h2', { class: 'desk-title' }, 'The Shifts'),
    h('p', {}, `${clearedCount(career)} of ${SHIFTS.length} cleared · ${totalStars(career)} contracts held in total`),
    h('ul', { class: 'desk-trail-list' }, ...items),
    h('div', { class: 'desk-actions' }, button('Back', showMenu, { 'data-focus': true })),
  );
  show('trail', panel);
}

// —— the logbook ——

function showLogbook() {
  const entries = state.logbook.map((entry) =>
    h('li', { class: 'desk-log-entry' }, h('h3', {}, entry.title), ...entry.lines.map((line) => h('p', {}, line))),
  );
  const panel = h(
    'section',
    { class: 'desk-panel desk-logbook', 'data-label': 'Logbook' },
    h('h2', { class: 'desk-title' }, 'Logbook'),
    entries.length > 0 ? h('ul', { class: 'desk-log-list' }, ...entries) : h('p', {}, 'Nothing logged yet. Finish a shift and it is written up here.'),
    h('div', { class: 'desk-actions' }, button('Back', showMenu, { 'data-focus': true })),
  );
  show('logbook', panel);
}

// —— how to play ——

function showHowToPlay(back) {
  const panel = h(
    'section',
    { class: 'desk-panel desk-help', 'data-label': 'How to play' },
    h('h2', { class: 'desk-title' }, 'How to play'),
    h('ul', { class: 'desk-help-list' },
      h('li', {}, kbd('←'), kbd('→'), ' or ', kbd('A'), kbd('D'), ' — move'),
      h('li', {}, kbd('↑'), ' or ', kbd('W'), kbd('X'), ' — rotate clockwise, ', kbd('Z'), ' counter-clockwise'),
      h('li', {}, kbd('↓'), ' or ', kbd('S'), ' — soft drop, ', kbd('Space'), ' — hard drop'),
      h('li', {}, kbd('Esc'), ' or ', kbd('P'), ' — pause'),
      h('li', {}, 'Each shift reshapes the well — a canyon, a split pillar, an hourglass neck and more. Clear the line target, or outlast the rising rubble in a flood shift.'),
      h('li', {}, 'The ghost outline shows where a piece will land. The side panel shows the next piece and this shift’s contracts.'),
    ),
    h('div', { class: 'desk-actions' }, button('Back', back, { 'data-focus': true })),
  );
  show('help', panel);
}

// —— pause ——

function showPauseMenu() {
  const panel = h(
    'section',
    { class: 'desk-panel desk-pause', 'data-label': 'Paused' },
    h('h2', { class: 'desk-title' }, 'Paused'),
    h(
      'div',
      { class: 'desk-menu-grid' },
      button('Resume', resumePlay, { 'data-focus': true }),
      button('Restart this shift', () => beginRun({ ...run, tasks: run.tasks }, run.options)),
      button('How to play', () => showHowToPlay(showPauseMenu)),
      button('Free Dig settings', showFreeDig),
      button('Game menu', () => confirmLeave('menu')),
      button('Back to the Hall', () => confirmLeave('hall')),
    ),
  );
  show('pause', panel);
}

function confirmLeave(to) {
  const panel = h(
    'section',
    { class: 'desk-panel desk-confirm', 'data-label': 'Leave this shift?' },
    h('h2', {}, 'Leave this shift?'),
    h('p', {}, 'The quarry keeps no record of a shift walked away from early.'),
    h(
      'div',
      { class: 'desk-actions' },
      button('Keep digging', showPauseMenu, { 'data-focus': true }),
      button('Leave', () => endRun('quit', to)),
    ),
  );
  show('confirm', panel);
}

function togglePause() {
  const game = play.current();
  if (!run || !game || game.gameOver) return;
  if (paused) {
    resumePlay();
    return;
  }
  paused = true;
  game.paused = true;
  play.setRunning(false);
  showPauseMenu();
}

function resumePlay() {
  paused = false;
  const game = play.current();
  if (game) game.paused = false;
  closeDesk();
  play.setRunning(true);
}

// —— running and ending a shift ——

function beginRun(what, options) {
  run = startRun(what, options);
  const game = play.begin(options);
  window.game = game;
  paused = false;
  closeDesk();
  play.setRunning(true);
  play.setContracts(run.tasks.map(([kind, n]) => taskText([kind, n ?? 0])));
}

/** Called every frame while a shift is live; the engine is the source of truth for the ending. */
function checkShiftEnd() {
  if (!run) return;
  const game = play.current();
  if (!game) return;
  if (game.gameOver) {
    endRun('loss');
    return;
  }
  if (hasReachedTarget(game, run.options)) {
    endRun('win');
  }
}

function endRun(outcome, navigateTo) {
  if (!run) {
    if (navigateTo === 'hall') leaveForHall();
    else showMenu();
    return;
  }
  const game = play.current();
  play.setRunning(false);
  const summary = summarize(run, game, outcome === 'win');
  const met = tasksMet(run.tasks, summary);
  const contractsMet = met.filter(Boolean).length;

  let promoted = false;
  let rankName = null;
  if (run.kind === 'career' && run.shiftId) {
    const result = recordShift(state.career, run.shiftId, { cleared: summary.cleared, contractsMet, score: summary.score });
    state.career = result.career;
    save('career', state.career);
    promoted = result.promoted;
    rankName = result.rank.name;
  }

  let dailyLine = null;
  if (run.kind === 'daily' && outcome !== 'quit') {
    state.daily = { ...state.daily, [run.dailyKey]: true };
    save('daily', state.daily);
    const daily = dailyShift(run.dailyKey);
    dailyLine = dailyShareLine({ number: daily.number, cleared: summary.cleared, piecesLocked: summary.piecesLocked, score: summary.score, sealsMet: met });
  }

  const title = outcome === 'win' ? 'Shift cleared!' : outcome === 'loss' ? 'The stack topped out' : 'Shift logged';
  const lines = chronicleLines(run, summary);
  state.logbook = addToLogbook(state.logbook, { title: `${run.name} — ${title}`, lines });
  save('logbook', state.logbook);

  reportShift(outcome === 'quit' ? 'quit' : outcome === 'win' ? 'win' : 'loss', summary, {
    contractsMet,
    promoted,
    daily: run.kind === 'daily',
    seconds: summary.seconds,
  });

  installEarnedPackages(run, summary, outcome, contractsMet);

  if (navigateTo === 'hall') {
    run = null;
    leaveForHall();
    return;
  }
  if (navigateTo === 'menu') {
    run = null;
    showMenu();
    return;
  }
  showReport(outcome, run, summary, met, promoted, rankName, dailyLine, lines);
}

function installEarnedPackages(finishedRun, summary, outcome, contractsMet) {
  if (outcome !== 'win') return;
  install('first-shift');
  if (summary.quads >= 1) install('first-quad');
  if (finishedRun.kind === 'daily') install('daily-digger');
  if (contractsMet === finishedRun.tasks.length && finishedRun.tasks.length > 0) install('clean-shift');
  if (finishedRun.shiftId === 'canyon-cut') install('canyon-cleared');
  if (summary.rubbleRowsSurvived >= 10) install('flood-holder');
  if (summary.quads >= 3) install('quad-trio');
  if (finishedRun.kind === 'free') install('free-digger');
  const rank = rankOf(state.career);
  if (rank.name === 'Foreman') install('foreman-rank');
  if (rank.name === 'Quarry Warden') install('quarry-warden');
  if (rank.name === 'Master of the Broken Well') install('master-of-the-well');
  if (totalStars(state.career) >= 24) install('sealbearer');
}

function showReport(outcome, finishedRun, summary, met, promoted, rankName, dailyLine, logLines) {
  const title = outcome === 'win' ? 'Shift cleared!' : outcome === 'loss' ? 'The stack topped out' : 'Shift logged';
  run = null;
  const panel = h(
    'section',
    { class: 'desk-panel desk-report', 'data-label': 'Report', 'data-testid': 'report' },
    h('h2', { class: 'desk-report-title' }, title),
    h(
      'p',
      {},
      `Score ${summary.score} · ${summary.lines} line${summary.lines === 1 ? '' : 's'} · ${summary.piecesLocked} piece${summary.piecesLocked === 1 ? '' : 's'}`,
    ),
    finishedRun.tasks.length > 0 ? h('div', {}, h('h3', {}, 'Contracts'), seals(met.filter(Boolean).length, finishedRun.tasks.length)) : null,
    promoted ? h('p', { class: 'desk-promoted' }, `Promoted to ${rankName}.`) : null,
    dailyLine ? h('p', { class: 'desk-share', 'data-testid': 'share-line' }, dailyLine) : null,
    h('h3', {}, 'From the logbook'),
    h('ul', { class: 'desk-chronicle' }, ...logLines.map((line) => h('li', {}, line))),
    h(
      'div',
      { class: 'desk-actions' },
      button('Play again (R)', () => beginRun({ ...finishedRun, tasks: finishedRun.tasks }, finishedRun.options), { 'data-focus': true }),
      button('Game menu', showMenu),
      button('Back to the Hall (H)', leaveForHall),
    ),
  );
  show('report', panel);
}

// —— keyboard, Hall sound and pause ——

document.addEventListener('keydown', (event) => {
  if (document.body.dataset.desk === 'play' && (event.key === 'Escape' || event.key === 'p' || event.key === 'P')) {
    togglePause();
    return;
  }
  if (document.body.dataset.desk === 'report') {
    if (event.key === 'r' || event.key === 'R') root.querySelector('.desk-actions button')?.click();
    if (event.key === 'h' || event.key === 'H') leaveForHall();
  }
  if (document.body.dataset.desk === 'help' && event.key === 'Escape') {
    event.preventDefault();
    root.querySelector('.desk-actions button')?.click();
  }
});

onHallPause(
  () => {
    if (document.body.dataset.desk === 'play') {
      paused = true;
      const game = play.current();
      if (game) game.paused = true;
      play.setRunning(false);
    }
  },
  () => {
    if (document.body.dataset.desk === 'play' && paused) {
      paused = false;
      const game = play.current();
      if (game) game.paused = false;
      play.setRunning(true);
    }
  },
);
onHallSound((level) => play.setSoundLevel(level));
onHallReducedMotion((reduced) => play.setReducedMotion(reduced));
if (!hostedInHall && globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
  play.setReducedMotion(true);
}
onHallAppearance((appearance) => {
  document.documentElement.dataset.theme = appearance === 'light' ? 'light' : 'dark';
  offerPoster(appearance);
});
// Outside the Hall, the system's own light/dark preference picks the well's look.
if (!hostedInHall && globalThis.matchMedia?.('(prefers-color-scheme: light)').matches) {
  document.documentElement.dataset.theme = 'light';
}

window.BrokenWellDesk = { checkShiftEnd, togglePause };

showMenu();

