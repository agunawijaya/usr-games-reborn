// Abyssal Worms — the logbook: the marks of sightings on the floor, the species card, and a panel
// with four pages (Sightings, Journal, Daily Dive, Postcards). The app controller (ui/app.js)
// calls in after every engine step and every frame; the logbook never steers the worms.

import { SightingWatch, KINDS, KIND_IDS, headOf } from './sightings.js';
import { journalPage, speciesIndexOf, wormAt, SPECIES_NOTES } from './journal.js';
import { dailyDive, diveShareLine, localDateKey } from './dive.js';
import {
  addPostcard, loadLog, logDiveFind, logSighting, logSpecies, removePostcard, saveLog,
} from './store.js';
import { noteDiveFinished, noteJournal, noteSighting } from '../hall.js';

const $ = (id) => document.getElementById(id);
const PAGES = ['sightings', 'journal', 'dive', 'postcards'];

/**
 * @param {{ world: () => any, grid: () => any, cell: () => number, seed: () => number,
 *   scene: () => { seed: number, opts: any, cell: number, view: string },
 *   openScene: (scene: { seed: number, opts: any, cell?: number, view?: string }) => void,
 *   reducedMotion: () => boolean }} app
 */
export function createLogbook(app) {
  let log = loadLog();
  let watch = new SightingWatch(app.seed());
  let page = 'sightings';
  let meetNext = 0;
  /** @type {null | { x: number, y: number, until: number }} */
  let highlight = null;
  /** The dive in progress, and the scene to go back to after it. */
  let dive = null;
  let before = null;

  const marks = $('marks');
  const ctx = marks.getContext('2d');
  const panel = $('logbook');
  const toast = $('log-toast');
  const button = $('btn-log');
  let toastTimer = 0;

  // ---------------------------------------------------------------- the floor

  /** A new abyss: a new watch, seeded from it, so a dive's blooms come at the same moments. */
  function onRestart(now) {
    watch = new SightingWatch(app.seed(), now);
    highlight = null;
  }

  function afterStep(world, now) {
    const fresh = watch.afterStep(world, now);
    watch.follow(world);
    if (fresh) marks.dataset.sighting = fresh.kind;
  }

  function toCell(clientX, clientY) {
    const g = app.grid();
    const cell = app.cell();
    if (!g) return null;
    return { x: Math.floor((clientX - g.origin[0]) / cell), y: Math.floor((clientY - g.origin[1]) / cell) };
  }

  /** A click on the floor: a sighting if there is one there, otherwise the worm under it. */
  function onPointer(clientX, clientY, now) {
    const at = toCell(clientX, clientY);
    if (!at) return;
    const sighting = watch.tryLog(at.x, at.y, now);
    if (sighting) return logged(sighting);
    const worm = wormAt(app.world(), at.x, at.y);
    if (worm !== null) meet(worm, now);
  }

  /** L: log the sighting on show, wherever it is. */
  function logActive(now) {
    const sighting = watch.tryLog(null, null, now);
    if (sighting) logged(sighting);
    else say('Nothing to log just now: watch the floor for a ring of light.');
  }

  /** J: meet the next worm in the abyss. */
  function meetNextWorm(now) {
    const world = app.world();
    if (!world?.worms.length) return;
    meetNext %= world.worms.length;
    meet(meetNext++, now);
  }

  function logged(sighting) {
    delete marks.dataset.sighting;
    log = logSighting(log, sighting.kind);
    let note = `${KINDS[sighting.kind].name} — logged. ${KINDS[sighting.kind].note}`;
    if (dive) {
      const result = logDiveFind(log, dive, sighting.kind);
      log = result.log;
      if (dive.seek.includes(sighting.kind)) {
        const found = log.dives[dive.key]?.length ?? 0;
        note += ` Dive #${dive.number}: ${found} of ${dive.seek.length} found.`;
      }
      if (result.finished) {
        note = `Dive #${dive.number} finished: all three sightings found.`;
        noteDiveFinished(dive.seek.length);
      }
    }
    saveLog(log);
    noteSighting(KIND_IDS.filter((kind) => log.sightings[kind]).length);
    say(note);
    render();
  }

  function meet(worm, now) {
    const index = speciesIndexOf(worm);
    const first = !log.species.includes(index);
    log = logSpecies(log, index);
    saveLog(log);
    noteJournal(log.species.length);
    const head = headOf(app.world(), worm);
    if (head) highlight = { x: head[0], y: head[1], until: now + 1.6 };
    const species = journalPage(index);
    say(`${species.name}${first ? ' — new in the journal.' : '.'} ${species.note}`);
    render();
  }

  function say(text) {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 5200);
  }

  /** The marks over the abyss: a ring where a sighting is, a glow for a bloom, a ring round a worm met. */
  function draw(now) {
    const g = app.grid();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(innerWidth * dpr);
    const h = Math.round(innerHeight * dpr);
    if (marks.width !== w || marks.height !== h) {
      marks.width = w;
      marks.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (!g) return;
    const cell = app.cell();
    const centre = (x, y) => [g.origin[0] + (x + 0.5) * cell, g.origin[1] + (y + 0.5) * cell];
    const still = app.reducedMotion();
    const s = watch.active;
    if (s && now <= s.until) {
      const [cx, cy] = centre(s.x, s.y);
      const age = now - s.born;
      const fade = Math.min(1, age * 3, (s.until - now) * 1.5);
      const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(age * 5);
      if (s.kind === 'bloom') {
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 4);
        glow.addColorStop(0, `rgba(255, 240, 200, ${0.55 * fade})`);
        glow.addColorStop(1, 'rgba(255, 240, 200, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      const halo = ctx.createRadialGradient(cx, cy, cell * 1.2, cx, cy, cell * 3.2);
      halo.addColorStop(0, 'rgba(160, 255, 235, 0)');
      halo.addColorStop(0.7, `rgba(160, 255, 235, ${0.16 * fade})`);
      halo.addColorStop(1, 'rgba(160, 255, 235, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(215, 255, 245, ${(0.6 + 0.4 * pulse) * fade})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([cell * 0.5, cell * 0.35]);
      ctx.lineDashOffset = still ? 0 : -age * cell * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * (2.2 + 0.4 * pulse), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (highlight && now <= highlight.until) {
      const [cx, cy] = centre(highlight.x, highlight.y);
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, (highlight.until - now) * 1.2)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- the panel

  const el = (tag, attributes = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null || value === undefined || value === false) continue;
      if (name.startsWith('on') && typeof value === 'function') node.addEventListener(name.slice(2), value);
      else if (name === 'class') node.className = value;
      else node.setAttribute(name, value === true ? '' : String(value));
    }
    for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) node.append(child);
    return node;
  };

  function toggle(on = panel.hidden) {
    panel.hidden = !on;
    button.setAttribute('aria-pressed', String(on));
    if (on) render();
  }

  function render() {
    if (panel.hidden) return;
    const tabs = el(
      'div',
      { class: 'seg small', role: 'tablist', 'aria-label': 'Logbook pages' },
      PAGES.map((id) =>
        el('button', {
          type: 'button', role: 'tab', 'aria-selected': String(page === id), 'data-page': id,
          onclick: () => { page = id; render(); },
        }, { sightings: 'Sightings', journal: 'Journal', dive: 'Daily Dive', postcards: 'Postcards' }[id]),
      ),
    );
    panel.replaceChildren(el('h2', {}, 'Logbook'), tabs, pageView());
  }

  function pageView() {
    if (page === 'journal') return journalView();
    if (page === 'dive') return diveView();
    if (page === 'postcards') return postcardsView();
    return sightingsView();
  }

  function sightingsView() {
    return el(
      'div', { class: 'log-page' },
      el('p', { class: 'fine' }, 'Now and then a ring of light marks something on the floor. Click it while it lasts, or press L.'),
      el('ul', { class: 'log-list' }, KIND_IDS.map((kind) => {
        const count = log.sightings[kind] ?? 0;
        return el('li', { class: count ? '' : 'unseen' },
          el('b', {}, KINDS[kind].name),
          el('span', {}, count ? `${KINDS[kind].note} Logged ${count}×.` : 'Not yet seen.'));
      })),
    );
  }

  function journalView() {
    return el(
      'div', { class: 'log-page' },
      el('p', { class: 'fine' }, `${log.species.length} of ${SPECIES_NOTES.length} species. Click a worm to meet it, or press J.`),
      el('ul', { class: 'log-list' }, SPECIES_NOTES.map((_, index) => {
        const met = log.species.includes(index);
        const species = journalPage(index);
        return el('li', { class: met ? '' : 'unseen' },
          el('b', {}, el('code', {}, species.glyph), ' ', met ? species.name : '—'),
          el('span', {}, met ? species.note : 'Not met yet.'));
      })),
    );
  }

  function diveView() {
    const today = dailyDive(localDateKey());
    const found = log.dives[today.key] ?? [];
    const done = found.length >= today.seek.length;
    return el(
      'div', { class: 'log-page' },
      el('p', {}, el('b', {}, `Daily Dive #${today.number}`), ` · ${today.worms} worms, ${today.length} long`),
      el('p', { class: 'fine' }, 'The same abyss and the same blooms for everyone today (at the same window size). Find these three sightings:'),
      el('ul', { class: 'log-list' }, today.seek.map((kind) => el('li', { class: found.includes(kind) ? '' : 'unseen' },
        el('b', {}, `${found.includes(kind) ? '✓' : '·'} ${KINDS[kind].name}`), el('span', {}, KINDS[kind].note)))),
      el('div', { class: 'row buttons' },
        dive
          ? el('button', { type: 'button', class: 'btn', onclick: endDive, 'data-testid': 'dive-leave' }, 'Back to my abyss')
          : el('button', { type: 'button', class: 'btn', onclick: () => startDive(today), 'data-testid': 'dive-start' }, done ? 'Dive again' : 'Start today’s dive'),
        done ? el('button', { type: 'button', class: 'btn', onclick: () => share(today, found), 'data-testid': 'dive-share' }, 'Share') : null),
      done ? el('p', { class: 'fine' }, 'Finished today. Your first finished dive of the day is the one that counts.') : null,
    );
  }

  function postcardsView() {
    return el(
      'div', { class: 'log-page' },
      el('p', { class: 'fine' }, 'Keep the scene you are watching (its seed and its flags) and come back to it whenever you like.'),
      el('div', { class: 'row buttons' }, el('button', { type: 'button', class: 'btn', onclick: keepPostcard, 'data-testid': 'postcard-keep' }, 'Keep this scene')),
      log.postcards.length
        ? el('ul', { class: 'log-list' }, log.postcards.map((card, index) => el('li', {},
            el('b', {}, `seed ${card.seed} · ${card.opts.number} worms · ${card.opts.length} long${card.opts.trail ? ' · trail' : ''}${card.opts.field ? ' · field' : ''}`),
            el('span', {}, `Kept ${card.savedOn}`),
            el('div', { class: 'row buttons' },
              el('button', { type: 'button', class: 'btn', onclick: () => app.openScene(card) }, 'Open'),
              el('button', { type: 'button', class: 'btn', onclick: () => { log = removePostcard(log, index); saveLog(log); render(); } }, 'Remove')))))
        : el('p', { class: 'fine' }, 'No postcards yet.'),
    );
  }

  function startDive(today) {
    before = app.scene();
    dive = today;
    app.openScene({ seed: today.seed, opts: { ...before.opts, number: today.worms, length: today.length, field: false } });
    say(`Daily Dive #${today.number}: find ${today.seek.map((kind) => KINDS[kind].name.toLowerCase()).join(', ')}.`);
    render();
  }

  function endDive() {
    dive = null;
    if (before) app.openScene(before);
    before = null;
    render();
  }

  function keepPostcard() {
    log = addPostcard(log, { ...app.scene(), savedOn: localDateKey() });
    saveLog(log);
    say('Postcard kept.');
    render();
  }

  async function share(today, found) {
    const line = diveShareLine(today.number, today.seek.map((kind) => found.includes(kind)));
    try {
      await navigator.clipboard.writeText(line);
      say(`Copied: ${line}`);
    } catch (_) {
      say(line);
    }
  }

  button.addEventListener('click', () => toggle());

  return {
    onRestart, afterStep, onPointer, logActive, meetNextWorm, draw, toggle,
    get open() { return !panel.hidden; },
    get forTests() { return { watch, log, dive }; },
  };
}
