// Moon calendar drawer: a month grid of shader-rendered mini Moons plus the
// list of upcoming principal phases. Every mini Moon is drawn by the same
// fragment shader as the hero Moon (Renderer.renderMini).

import { phaseState, toCompressed } from '../engine/pom.js';
import { monthGrid, upcomingEvents } from '../engine/events.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const SHORT = { new: 'New', 'first-quarter': '1st Q', full: 'Full', 'last-quarter': 'Last Q' };

/** Paint a mini Moon for Unix time t into a canvas (CSS size px). */
export function paintMoon(renderer, canvas, t, cssSize, { hc = false } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.round(cssSize * dpr);
  if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
  const s = phaseState(t);
  const img = renderer.renderMini(size, s.elongation, s.illuminated, { hc });
  if (img) canvas.getContext('2d').putImageData(img, 0, 0);
}

export class Calendar {
  constructor({ renderer, zone, els, onPick, onHover, getNow, fmt }) {
    this.r = renderer;
    this.zone = zone;
    this.els = els;
    this.onPick = onPick;
    this.onHover = onHover;
    this.getNow = getNow;
    this.fmt = fmt;
    this.year = 0;
    this.mon = 0;
    this.hc = false;
    this.selT = 0;
    els.prev.addEventListener('click', () => this.shift(-1));
    els.next.addEventListener('click', () => this.shift(1));
  }

  show(t) {
    const lt = this.zone.localtime(t);
    this.year = lt.year;
    this.mon = lt.mon;
    this.selT = t;
    this.render();
  }

  shift(d) {
    let m = this.mon + d;
    let y = this.year;
    while (m < 0) { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    this.year = y;
    this.mon = m;
    this.render();
  }

  select(t) {
    const prev = this.zone.localtime(this.selT);
    this.selT = t;
    const lt = this.zone.localtime(t);
    for (const b of this.els.grid.querySelectorAll('.cal-day')) {
      b.classList.toggle('sel', lt.year === this.year && lt.mon === this.mon && Number(b.dataset.mday) === lt.mday);
    }
    if (prev.year !== lt.year || prev.mon !== lt.mon || prev.mday !== lt.mday) this.renderEvents();
  }

  render() {
    const { grid, title } = this.els;
    const now = this.getNow();
    const g = monthGrid(this.year, this.mon, { zone: this.zone, now });
    title.textContent = `${MONTHS[this.mon]} ${this.year}`;
    grid.replaceChildren();
    for (const d of DOW) {
      const h = document.createElement('div');
      h.className = 'cal-dow';
      h.textContent = d;
      h.setAttribute('role', 'columnheader');
      grid.append(h);
    }
    for (let i = 0; i < g.lead; i++) {
      const b = document.createElement('div');
      b.className = 'cal-blank';
      grid.append(b);
    }
    const today = this.zone.localtime(now);
    const sel = this.zone.localtime(this.selT);
    for (const day of g.days) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cal-day';
      b.dataset.mday = day.mday;
      if (today.year === this.year && today.mon === this.mon && today.mday === day.mday) b.classList.add('today');
      if (sel.year === this.year && sel.mon === this.mon && sel.mday === day.mday) b.classList.add('sel');
      const cv = document.createElement('canvas');
      cv.setAttribute('aria-hidden', 'true');
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = day.mday;
      const ev = document.createElement('span');
      ev.className = 'ev';
      ev.textContent = day.events.length ? SHORT[day.events[0].key] : '';
      b.append(cv, num, ev);
      const arg = toCompressed(day.t, this.zone);
      b.setAttribute('aria-label', `${day.mday} ${MONTHS[this.mon]}: ${day.report.sentence}`);
      b.addEventListener('click', () => this.onPick(day.t));
      b.addEventListener('pointerenter', (e) => this.onHover(e, `<b>${this.fmt.dayLong(day.t)}</b><code>$ pom ${arg}</code><span class="meta">${day.report.sentence}</span>`));
      b.addEventListener('pointerleave', () => this.onHover(null));
      grid.append(b);
      paintMoon(this.r, cv, day.t, 34, { hc: this.hc });
    }
    this.renderEvents();
  }

  /** The next principal phases after the selected moment. */
  renderEvents() {
    const { events } = this.els;
    const now = this.getNow();
    events.replaceChildren();
    for (const ev of upcomingEvents(this.selT - 1, 8)) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      const cv = document.createElement('canvas');
      cv.setAttribute('aria-hidden', 'true');
      const mid = document.createElement('span');
      mid.innerHTML = `<span class="name">${ev.name}</span><span class="when">${this.fmt.event(ev.t)}</span>`;
      const rel = document.createElement('span');
      rel.className = 'rel';
      rel.textContent = this.fmt.relative(ev.t - now);
      b.append(cv, mid, rel);
      b.setAttribute('aria-label', `${ev.name}, ${this.fmt.event(ev.t)}, ${rel.textContent}`);
      b.addEventListener('click', () => this.onPick(ev.t, { exact: true }));
      li.append(b);
      events.append(li);
      paintMoon(this.r, cv, ev.t, 28, { hc: this.hc });
    }
  }
}

