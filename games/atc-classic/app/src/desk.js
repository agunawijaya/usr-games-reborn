// Control Room 1986 — the controller's desk: the game menu's licence card and its three ways to
// work a shift (Career, Open shift, Daily Traffic), the briefing clipboard before a shift, the
// briefing card in the sidebar, the printed shift report and the logbook drawer. main.js owns the
// state and passes it in; this module only draws and reports what the player chose.

import { ASSIGNMENTS, isEndorsed, isUnlocked, nextRankNeed, RANKS, rankIndex, STAMPS_PER_ASSIGNMENT, stampTotal } from './career.js';
import { reportLines } from './report.js';
import { hoursOnDuty } from './service.js';

const SECTOR_NAMES = { easy: 'Easy', default: 'Default', killer: 'Killer' };
const SECTOR_NOTES = {
  easy: 'training · slow · 1 airport',
  default: 'reference · Ed James map',
  killer: 'fast · punishing · 3 airports',
};
export const TABS = ['career', 'open', 'daily'];

const esc = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function stampMarks(earned, of) {
  return Array.from({ length: of }, (_, i) => `<i class="${i < earned ? 'on' : ''}"></i>`).join('');
}

function chevrons(rank) {
  // One bar a rank above Trainee, the chief's star on top.
  const bars = Array.from({ length: Math.min(rank, 4) }, () => '<i></i>').join('');
  return `<span class="rank-mark" aria-hidden="true">${rank >= 5 ? '<b>★</b>' : ''}${bars || '<em>—</em>'}</span>`;
}

// —— the licence card ————————————————————————————————————————————————————————————

/**
 * @param {{ career: import('./career.js').CareerRecord, service: import('./service.js').ServiceRecord, licence: string }} view
 */
export function licenceCard({ career, service, licence }) {
  const rank = rankIndex(career);
  const need = nextRankNeed(career);
  const endorsements = Object.keys(SECTOR_NAMES)
    .map((key) => `<span class="endorse ${isEndorsed(career, key) ? 'on' : ''}">${SECTOR_NAMES[key].toUpperCase()}</span>`)
    .join('');
  const row = (label, value) => `<div class="svc-row"><span>${label}</span><b>${esc(value)}</b></div>`;
  return `
    <section class="licence" aria-label="Controller licence">
      <div class="licence-head"><span>CONTROLLER LICENCE</span><span>No. ${esc(licence)}</span></div>
      <div class="licence-rank">${chevrons(rank)}<span>${esc(RANKS[rank].title.toUpperCase())}</span></div>
      ${
        need
          ? `<div class="licence-next"><div class="bar"><i style="width:${Math.round(Math.min(1, need.share) * 100)}%"></i></div>
             <small>${esc(need.rank)}: ${esc(need.text)}</small></div>`
          : '<div class="licence-next"><small>The top of the room.</small></div>'
      }
      <div class="licence-label">ENDORSEMENTS</div>
      <div class="endorsements">${endorsements}</div>
      <div class="licence-label">SERVICE RECORD</div>
      ${row('Shifts worked', service.shifts)}
      ${row('Planes home', service.planesHome)}
      ${row('Hours on duty', hoursOnDuty(service))}
      ${row('Stamps', `${service.stamps}`)}
      ${row('Career stamps', `${stampTotal(career)} / ${ASSIGNMENTS.length * STAMPS_PER_ASSIGNMENT}`)}
    </section>`;
}

// —— the three panels ——————————————————————————————————————————————————————————

function careerPanel(career, selected) {
  const rows = ASSIGNMENTS.map((a, i) => {
    const open = isUnlocked(career, i);
    const best = career.passed[a.id];
    const classes = ['assignment', open ? '' : 'locked', i === selected ? 'selected' : '', best !== undefined ? 'passed' : '']
      .filter(Boolean)
      .join(' ');
    return `
      <button type="button" class="${classes}" data-assignment="${i}" ${open ? '' : 'disabled'}
        aria-pressed="${i === selected}" aria-label="Assignment ${i + 1}, ${esc(a.title)}, ${SECTOR_NAMES[a.sector]}, bring ${a.target} home${best !== undefined ? `, ${best} stamps` : open ? '' : ', locked'}">
        <span class="a-no">${String(i + 1).padStart(2, '0')}</span>
        <span class="a-title">${esc(a.title)}</span>
        <span class="a-sector">${SECTOR_NAMES[a.sector].toUpperCase()}</span>
        <span class="a-target">${a.target} HOME</span>
        <span class="stamps">${open ? stampMarks(best ?? 0, STAMPS_PER_ASSIGNMENT) : 'LOCKED'}</span>
      </button>`;
  }).join('');
  const chosen = ASSIGNMENTS[selected];
  return `
    <div class="panel-career">
      <div class="assignments" role="group" aria-label="Assignments">${rows}</div>
      <p class="panel-note">${esc(chosen.note)}</p>
    </div>`;
}

function openPanel(sectorKey, service) {
  const best = Object.keys(SECTOR_NAMES)
    .map((key) => `<div class="best-cell"><span>${SECTOR_NAMES[key].toUpperCase()}</span><b>${service.bestOpen[key] ?? '—'}</b></div>`)
    .join('');
  const buttons = Object.keys(SECTOR_NAMES)
    .map(
      (key) => `
      <button type="button" class="title-sector-btn ${key === sectorKey ? 'active' : ''}" data-pf="${key}" aria-pressed="${key === sectorKey}">
        ${SECTOR_NAMES[key].toUpperCase()}<small>${SECTOR_NOTES[key]}</small>
        <small class="best">best ${service.bestOpen[key] ?? '—'}</small>
      </button>`,
    )
    .join('');
  return `
    <div class="panel-open">
      <div id="title-sectors">${buttons}</div>
      <p class="panel-note">The 1986 way: new traffic until a plane is lost. Every shift comes with
      three tasks on the clipboard, one commendation stamp each.</p>
      <div class="licence-label">BEST OPEN SHIFTS · PLANES HOME</div>
      <div class="best-row">${best}</div>
    </div>`;
}

function dailyPanel(daily) {
  const flown = daily.flown
    ? `Flown today: <b>${daily.flown.safe} home</b> · ${daily.flown.tasksDone.map((d) => (d ? '■' : '□')).join('')}. Fly it again for practice; the first flight is the one on record.`
    : 'Not flown yet today. The first flight is the one on record.';
  const recent = daily.recent.length
    ? `<div class="recent">${daily.recent
        .map((d) => `<div class="svc-row"><span>#${d.number} · ${esc(d.sectorName)}</span><b>${d.safe} home ${d.tasksDone.map((x) => (x ? '■' : '□')).join('')}</b></div>`)
        .join('')}</div>`
    : '';
  return `
    <div class="panel-daily">
      <div class="daily-head"><span>TODAY’S TRAFFIC</span><b>#${daily.number}</b></div>
      <div class="daily-sector">SECTOR ${SECTOR_NAMES[daily.sectorKey].toUpperCase()} · ${esc(daily.dateKey)}</div>
      <p class="panel-note">The same planes, the same moments and the same three tasks for every controller today.
      ${flown}</p>
      <div class="licence-label">TODAY’S BRIEFING</div>
      <ol class="daily-tasks">${daily.tasks.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      ${recent}
    </div>`;
}

/**
 * The whole desk under the title.
 * @param {HTMLElement} host
 * @param {object} view   tab, career, service, licence, selected assignment, sector, daily, hosted
 */
export function renderDesk(host, view) {
  const tabLabels = { career: 'CAREER', open: 'OPEN SHIFT', daily: `DAILY TRAFFIC #${view.daily.number}` };
  const tabs = TABS.map(
    (tab, i) =>
      `<button type="button" class="desk-tab ${tab === view.tab ? 'active' : ''}" data-tab="${tab}" aria-pressed="${tab === view.tab}">
        <kbd>${i + 1}</kbd> ${tabLabels[tab]}</button>`,
  ).join('');
  const panel =
    view.tab === 'career'
      ? careerPanel(view.career, view.assignment)
      : view.tab === 'open'
        ? openPanel(view.sectorKey, view.service)
        : dailyPanel(view.daily);
  host.innerHTML = `
    <div class="desk-tabs" role="group" aria-label="How to work the shift">${tabs}
      <button type="button" class="desk-tab logbook-btn" data-logbook><kbd>L</kbd> LOGBOOK</button></div>
    <div class="desk">
      ${licenceCard(view)}
      <div class="desk-panel">${panel}</div>
    </div>`;
}

// —— the briefing clipboard and the sidebar card ——————————————————————————————————————

/**
 * @param {HTMLElement} host
 * @param {{ kicker: string, title: string, sector: string, note: string, target: number | null, tasks: string[] }} brief
 */
export function showBriefing(host, brief) {
  const target = brief.target
    ? `<li class="target">Bring <b>${brief.target}</b> planes home; then your relief takes over.</li>`
    : '';
  host.innerHTML = `
    <div class="clipboard" role="dialog" aria-modal="true" aria-labelledby="brief-title">
      <div class="clip" aria-hidden="true"></div>
      <div class="brief-kicker">${esc(brief.kicker)}</div>
      <h2 id="brief-title">${esc(brief.title)}</h2>
      <div class="brief-sector">${esc(brief.sector)}</div>
      <p class="brief-note">${esc(brief.note)}</p>
      <ol class="brief-tasks">${target}${brief.tasks.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      <div class="brief-keys"><span><kbd>ENTER</kbd> take the position</span><span><kbd>ESC</kbd> game menu</span></div>
    </div>`;
  host.classList.add('shown');
}

export function hideOverlay(host) {
  host.classList.remove('shown');
  host.innerHTML = '';
}

/**
 * The sidebar's briefing card during a shift.
 * @param {HTMLElement} host
 * @param {{ heading: string, target: { have: number, need: number } | null, tasks: { text: string, state: string, progress: string }[] }} card
 */
export function renderBriefingCard(host, card) {
  const mark = { done: '✓', holding: '·', broken: '✗', open: ' ' };
  const target = card.target
    ? `<div class="bc-row ${card.target.have >= card.target.need ? 'done' : ''}"><span class="bc-mark">[${card.target.have >= card.target.need ? '✓' : ' '}]</span><span>Bring ${card.target.need} home</span><b>${Math.min(card.target.have, card.target.need)}/${card.target.need}</b></div>`
    : '';
  host.innerHTML = `
    <div class="bc-heading">${esc(card.heading)}</div>
    ${target}
    ${card.tasks
      .map(
        (t) =>
          `<div class="bc-row ${t.state}"><span class="bc-mark">[${mark[t.state] ?? ' '}]</span><span>${esc(t.text)}</span><b>${esc(t.progress)}</b></div>`,
      )
      .join('')}`;
}

// —— the printed report ————————————————————————————————————————————————————————————

/**
 * Prints the report line by line on green-bar paper, then shows the ways on.
 * @param {HTMLElement} host
 * @param {import('./report.js').ShiftSummary} summary
 * @param {{ key: string, label: string, action: string, primary?: boolean }[]} buttons
 * @param {{ reducedMotion: boolean, share?: string | null }} options
 * @returns {() => void} stops the printing
 */
export function printReport(host, summary, buttons, options) {
  const lines = reportLines(summary);
  host.innerHTML = `
    <div class="printout" role="dialog" aria-modal="true" aria-label="Shift report">
      <div class="paper"><pre class="report-text" aria-live="polite"></pre></div>
      ${options.share ? `<div class="share-line"><span>${esc(options.share)}</span></div>` : ''}
      <div class="report-actions" hidden>
        ${buttons
          .map(
            (b) =>
              `<button type="button" class="report-btn ${b.primary ? 'primary' : ''}" data-action="${b.action}">${esc(b.label)} <kbd>${esc(b.key)}</kbd></button>`,
          )
          .join('')}
      </div>
    </div>`;
  host.classList.add('shown');
  const pre = host.querySelector('.report-text');
  const actions = host.querySelector('.report-actions');
  const write = (count) => {
    pre.innerHTML = lines
      .slice(0, count)
      .map((l) => `<span class="rl ${l.style}">${esc(l.text)}</span>`)
      .join('\n');
  };
  let printed = 0;
  let timer = 0;
  const finish = () => {
    clearTimeout(timer);
    write(lines.length);
    actions.hidden = false;
    actions.querySelector('.primary')?.focus();
  };
  const next = () => {
    printed += 1;
    write(printed);
    if (printed >= lines.length) finish();
    else timer = setTimeout(next, 55);
  };
  if (options.reducedMotion) finish();
  else timer = setTimeout(next, 120);
  // A key or a click on the paper finishes the printing at once.
  host.querySelector('.paper').addEventListener('click', finish);
  return finish;
}

// —— the logbook drawer ————————————————————————————————————————————————————————————

/**
 * @param {HTMLElement} host
 * @param {import('./report.js').ShiftSummary[]} pages
 * @param {number} selected
 */
export function showLogbook(host, pages, selected) {
  const list = pages.length
    ? pages
        .map((page, i) => {
          const what =
            page.mode === 'career' && page.assignment
              ? `${String(page.assignment.number).padStart(2, '0')} ${page.assignment.title}`
              : page.mode === 'daily' && page.daily
                ? `Daily #${page.daily.number}`
                : 'Open shift';
          const stamps = page.tasks.filter((t) => t.done).length;
          return `<button type="button" class="log-row ${i === selected ? 'selected' : ''}" data-page="${i}" aria-pressed="${i === selected}">
            <span>${esc(page.dateKey)}</span><span>${esc(what)}</span><span>${esc(page.sectorName)}</span>
            <b>${page.safe} home</b><span class="stamps">${stampMarks(stamps, page.tasks.length)}</span></button>`;
        })
        .join('')
    : '<p class="panel-note">No shifts on file yet. Every shift you work is printed and kept here.</p>';
  const page = pages[selected];
  host.innerHTML = `
    <div class="logbook" role="dialog" aria-modal="true" aria-labelledby="logbook-title">
      <div class="logbook-head"><h2 id="logbook-title">LOGBOOK</h2><span><kbd>ESC</kbd> close</span></div>
      <div class="logbook-body">
        <div class="log-list">${list}</div>
        <div class="paper">${page ? `<pre class="report-text">${reportLines(page)
          .map((l) => `<span class="rl ${l.style}">${esc(l.text)}</span>`)
          .join('\n')}</pre>` : ''}</div>
      </div>
    </div>`;
  host.classList.add('shown');
}
