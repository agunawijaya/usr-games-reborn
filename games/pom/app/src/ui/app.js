// Selene app controller: time state, render loop, and every interaction.
// The engine (../engine) answers "what phase?"; the renderer paints it;
// this module keeps them in step and preserves pom's one-line answer.

import {
  phaseState, describe, runPom, parseTime, localZone, toCompressed,
  PHASE_NAMES, SYNODIC_MONTH, ILLEGAL,
} from '../engine/pom.js';
import { upcomingEvents, eventsBetween } from '../engine/events.js';
import { Renderer, sunVector, surfaceRotation } from '../render/renderer.js';
import { featureAt } from '../render/features.js';
import { Calendar, paintMoon } from './calendar.js';
import {
  followHallMotion, noteMomentVisited, notePomAnswered, noteTimelapseFinished, noteTimelapseStarted, offerPoster,
  posterWanted,
} from '../hall.js';

const HOUR = 3600;
const DAY = 86400;
const WINDOW = 30 * DAY;          // scrubber span
const TIMELAPSE_S = 14;           // seconds of wall time for one lunar month
const $ = (id) => document.getElementById(id);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const nowSec = () => Date.now() / 1000;
const floorHour = (t, zone) => {
  const lt = zone.localtime(t);
  return zone.mktime({ ...lt, min: 0, sec: 0 });
};

// ------------------------------------------------------------------ formatting
function makeFormat(zone) {
  const zoneName = (t) => zone.abbrev(t);
  const dtf = (opts) => new Intl.DateTimeFormat('en-GB', opts);
  const eyebrow = dtf({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hm = dtf({ hour: '2-digit', minute: '2-digit', hour12: false });
  const ev = dtf({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const evY = dtf({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const dayLong = dtf({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const short = dtf({ day: 'numeric', month: 'short' });
  const safe = (f, t) => {
    try { return f.format(new Date(t * 1000)); } catch { return new Date(t * 1000).toISOString(); }
  };
  return {
    eyebrow: (t) => `${safe(eyebrow, t)} · ${safe(hm, t)} ${zoneName(t)}`,
    event: (t) => (Math.abs(t - nowSec()) > 300 * DAY ? safe(evY, t) : safe(ev, t)),
    dayLong: (t) => safe(dayLong, t),
    short: (t) => safe(short, t),
    relative(dt) {
      const a = Math.abs(dt);
      let s;
      if (a < HOUR) s = `${Math.round(a / 60)} min`;
      else if (a < 2 * DAY) s = `${Math.round(a / HOUR)} h`;
      else if (a < 60 * DAY) s = `${Math.round(a / DAY)} d`;
      else if (a < 730 * DAY) s = `${Math.round(a / (30.44 * DAY))} mo`;
      else s = `${Math.round(a / (365.25 * DAY))} y`;
      return dt >= 0 ? `in ${s}` : `${s} ago`;
    },
  };
}

// ------------------------------------------------------------------------ app
export function startApp() {
  const zone = localZone();
  const fmt = makeFormat(zone);
  const qs = new URLSearchParams(location.search);
  const media = (q) => window.matchMedia?.(q).matches ?? false;

  const S = {
    t: nowSec(),
    live: true,
    anchor: nowSec(),
    anim: null,          // { from, to, start, dur }
    lapse: null,         // { from, start }
    yaw: 0, pitch: 0, drag: null,
    hc: qs.get('hc') === '1' || media('(prefers-contrast: more)'),
    motion: qs.get('motion') !== '0' && !media('(prefers-reduced-motion: reduce)'),
    calendar: false,
    moonX: null,
    ready: 0,
    lastKey: '',
    lastTicks: '',
  };

  // ---- renderer -------------------------------------------------------------
  const canvas = $('sky');
  let renderer = null;
  try {
    renderer = new Renderer(canvas, { quality: qs.get('q') || 'auto', lowPrecision: qs.get('lp') === '1' });
  } catch (err) {
    console.warn('Selene: WebGL2 unavailable —', err.message);
    $('nogl').hidden = false;
    $('veil').classList.add('gone');
    document.body.classList.add('no-gl');
    // mini Moons need the shader: without WebGL2 the calendar has nothing to show
    const cal = $('btn-calendar');
    cal.disabled = true;
    cal.title = 'The Moon calendar needs WebGL2';
  }
  // A CPU-only (software) WebGL context gets the lite profile: smaller surface,
  // frozen twinkle and ripples, lower resolution, and frames drawn only on change.
  const lite = !!renderer?.lite;
  if (lite) {
    document.body.classList.add('lite');
    $('veil-note').hidden = false;
  }
  $('render-info').textContent = !renderer
    ? 'Rendering: unavailable (no WebGL2). Text mode.'
    : `Rendering: ${renderer.software ? 'CPU (software WebGL)' : 'GPU'}${lite ? ', lite profile' : ''}` +
      ` · surface ${renderer.texW}×${renderer.texH}` +
      `${renderer.floatRT ? '' : ', 8-bit'} · ${renderer.rendererName || 'unknown renderer'}`;

  // ---- initial time from ?date=<pom arg> -----------------------------------
  if (qs.get('date')) {
    const r = parseTime(qs.get('date'), { now: nowSec(), zone });
    if (r.ok) { S.t = r.t; S.live = false; S.anchor = r.t; }
  }
  if (S.hc) document.body.classList.add('hc');
  if (!S.motion) document.body.classList.add('still');

  // ---- layout --------------------------------------------------------------
  // ?zoom=, ?mx=, ?my= are inspection aids for close-up screenshots.
  const zoom = Number(qs.get('zoom')) || 1;
  const mx = Number(qs.get('mx')) || 0;
  const my = Number(qs.get('my')) || 0;
  function layout(w, h) {
    const L0 = baseLayout(w, h);
    L0.r *= zoom;
    if (mx) L0.x = w * mx;
    if (my) L0.y = h * my;
    return L0;
  }
  function baseLayout(w, h) {
    const mobile = w < 760;
    if (mobile) {
      const r = Math.min(w * 0.33, h * 0.17);
      return { mobile, r, x: w * 0.5, y: h * 0.27, horizon: h * 0.3 };
    }
    const drawer = S.calendar ? Math.min(392, w - 48) + 24 : 0;
    const avail = w - drawer;
    const r = Math.min(h * 0.2, avail * 0.17);
    const x = drawer ? Math.max(avail * 0.64, 480 + r) : w * 0.63;
    return { mobile, r, x: Math.min(x, avail - r - 30), y: h * 0.36, horizon: h * 0.25 };
  }

  // ---- time control --------------------------------------------------------
  function goTo(t, { animate = true, keepAnchor = false } = {}) {
    stopLapse();
    S.live = false;
    const target = t;
    if (animate && S.motion && Math.abs(target - S.t) > HOUR) {
      const span = Math.abs(target - S.t);
      S.anim = { from: S.t, to: target, start: performance.now(), dur: clamp(420 + Math.log10(span / HOUR) * 260, 420, 1500) };
    } else {
      S.anim = null;
      S.t = target;
    }
    if (!keepAnchor) S.anchor = target;
    syncInputs(target);
  }
  function goNow() {
    stopLapse();
    const t = nowSec();
    if (S.motion && Math.abs(t - S.t) > HOUR) {
      S.anim = { from: S.t, to: t, start: performance.now(), dur: 900, toLive: true };
    } else {
      S.anim = null;
      S.t = t;
      S.live = true;
    }
    S.anchor = t;
    syncInputs(t);
  }
  function step(dt) {
    const base = S.anim ? S.anim.to : S.t;
    goTo(floorHour(base, zone) + dt, { animate: Math.abs(dt) >= DAY });
  }

  function startLapse() {
    S.anim = null;
    S.live = false;
    S.lapse = { from: S.t, start: performance.now() };
    S.anchor = S.t + (SYNODIC_MONTH * DAY) / 2;
    $('btn-play').setAttribute('aria-pressed', 'true');
    noteTimelapseStarted();
  }
  function stopLapse() {
    if (!S.lapse) return;
    S.lapse = null;
    S.t = floorHour(S.t + HOUR / 2, zone);
    $('btn-play').setAttribute('aria-pressed', 'false');
    syncInputs(S.t);
  }

  // ---- inputs ----------------------------------------------------------------
  const inDate = $('in-date');
  const inPom = $('in-pom');
  const pad = (n) => String(n).padStart(2, '0');
  function syncInputs(t) {
    const lt = zone.localtime(t);
    if (lt.year >= 1 && lt.year <= 9999) {
      inDate.value = `${String(lt.year).padStart(4, '0')}-${pad(lt.mon + 1)}-${pad(lt.mday)}T${pad(lt.hour)}:00`;
    }
    if (document.activeElement !== inPom) inPom.value = S.live && !S.anim ? '' : toCompressed(t, zone);
  }
  inDate.addEventListener('change', () => {
    const m = /^(\d{4,})-(\d\d)-(\d\d)T(\d\d)/.exec(inDate.value);
    if (!m) return;
    goTo(zone.mktime({ year: +m[1], mon: +m[2] - 1, mday: +m[3], hour: +m[4] }));
  });
  let pomError = null;
  $('pom-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const arg = inPom.value.trim();
    if (arg === '') { goNow(); return; }
    const r = runPom(arg, { now: nowSec(), zone });
    const field = inPom.closest('.field');
    if (r.code !== 0) {
      pomError = { arg, text: r.stderr.trimEnd() };
      field.classList.remove('bad');
      void field.offsetWidth;
      field.classList.add('bad');
      S.lastKey = '';
      return;
    }
    field.classList.remove('bad');
    pomError = null;
    goTo(r.t);
    notePomAnswered();
  });
  inPom.addEventListener('input', () => {
    inPom.value = inPom.value.replace(/[^0-9]/g, '').slice(0, 10);
    if (pomError) { pomError = null; inPom.closest('.field').classList.remove('bad'); S.lastKey = ''; }
  });

  $('btn-prev').addEventListener('click', () => step(-DAY));
  $('btn-next').addEventListener('click', () => step(DAY));
  $('btn-now').addEventListener('click', goNow);
  $('btn-play').addEventListener('click', () => (S.lapse ? stopLapse() : startLapse()));

  // ---- toggles ---------------------------------------------------------------
  const drawer = $('calendar');
  let calendar = null;
  function setCalendar(open) {
    if (!renderer) open = false;
    S.calendar = open;
    drawer.hidden = !open;
    document.body.classList.toggle('cal-open', open);
    S.lastTicks = '';
    $('btn-calendar').setAttribute('aria-pressed', String(open));
    if (open && calendar) calendar.show(S.anim ? S.anim.to : S.t);
  }
  $('btn-calendar').addEventListener('click', () => setCalendar(!S.calendar));
  $('cal-close').addEventListener('click', () => setCalendar(false));

  function setHC(on) {
    S.hc = on;
    document.body.classList.toggle('hc', on);
    $('btn-contrast').setAttribute('aria-pressed', String(on));
    if (calendar) { calendar.hc = on; if (S.calendar) calendar.render(); }
    S.lastTicks = '';
  }
  $('btn-contrast').addEventListener('click', () => setHC(!S.hc));
  $('btn-contrast').setAttribute('aria-pressed', String(S.hc));

  const help = $('help');
  const openHelp = (on) => { help.hidden = !on; if (on) $('help-close').focus(); };
  $('btn-help').addEventListener('click', () => openHelp(true));
  $('help-close').addEventListener('click', () => openHelp(false));
  help.addEventListener('click', (e) => { if (e.target === help) openHelp(false); });

  // ---- tooltip ---------------------------------------------------------------
  const tip = $('tip');
  function showTip(e, html) {
    if (!e) { tip.classList.remove('show'); return; }
    tip.innerHTML = html;
    tip.hidden = false;
    const x = Math.min(e.clientX, innerWidth - 280);
    const y = Math.min(e.clientY, innerHeight - 120);
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
    tip.classList.add('show');
  }

  // ---- calendar --------------------------------------------------------------
  if (renderer) {
    calendar = new Calendar({
      renderer, zone, fmt,
      els: { grid: $('cal-grid'), title: $('cal-title'), events: $('events'), prev: $('cal-prev'), next: $('cal-next') },
      onPick: (t, opt) => goTo(opt?.exact ? t : t),
      onHover: showTip,
      getNow: nowSec,
    });
    calendar.hc = S.hc;
  }

  // ---- the Moon: hover to name features, drag to rock it ------------------------
  let L = layout(innerWidth, innerHeight);
  function moonPoint(e) {
    const r = L.r;
    const qx = (e.clientX - S.moonX) / r;
    const qy = (L.y - e.clientY) / r;
    const d2 = qx * qx + qy * qy;
    if (d2 >= 1) return null;
    return [qx, qy, Math.sqrt(1 - d2)];
  }
  canvas.addEventListener('pointermove', (e) => {
    if (S.drag) {
      const dx = (e.clientX - S.drag.x) / L.r;
      const dy = (e.clientY - S.drag.y) / L.r;
      S.yaw = clamp(S.drag.yaw + dx * 0.8, -0.5, 0.5);
      S.pitch = clamp(S.drag.pitch + dy * 0.8, -0.4, 0.4);
      showTip(null);
      return;
    }
    const n0 = moonPoint(e);
    canvas.classList.toggle('grab', !!n0);
    if (!n0 || !renderer?.baked) { showTip(null); return; }
    // selenographic point = R^T * n0 (R is column-major)
    const R = surfaceRotation(S.yaw, S.pitch);
    const p = [
      R[0] * n0[0] + R[1] * n0[1] + R[2] * n0[2],
      R[3] * n0[0] + R[4] * n0[1] + R[5] * n0[2],
      R[6] * n0[0] + R[7] * n0[1] + R[8] * n0[2],
    ];
    const lat = Math.asin(clamp(p[1], -1, 1)) * 180 / Math.PI;
    const lon = Math.atan2(p[0], p[2]) * 180 / Math.PI;
    const sun = sunVector(phaseState(S.t).elongation);
    const lit = n0[0] * sun[0] + n0[1] * sun[1] + n0[2] * sun[2] > 0;
    const f = featureAt(p);
    const where = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
    const light = lit ? 'in sunlight' : 'in the lunar night';
    if (f) {
      const size = f.kind === 'crater' ? `${f.dia} km crater` : 'lunar sea';
      showTip(e, `<b>${f.name}</b><i>${f.note}</i><span class="meta">${size} · ${where} · ${light}</span>`);
    } else {
      showTip(e, `<span class="meta" style="margin:0">${lit ? 'Highlands' : 'Lunar night'} · ${where}</span>`);
    }
  });
  canvas.addEventListener('pointerleave', () => { if (!S.drag) showTip(null); });
  canvas.addEventListener('pointerdown', (e) => {
    if (!moonPoint(e)) return;
    S.drag = { x: e.clientX, y: e.clientY, yaw: S.yaw, pitch: S.pitch };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('grabbing');
  });
  const endDrag = () => { S.drag = null; canvas.classList.remove('grabbing'); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ---- scrubber ----------------------------------------------------------------
  const track = $('scrub-track');
  const thumb = $('scrub-thumb');
  const ticks = $('scrub-ticks');
  let scrubbing = false;
  const tAtX = (clientX) => {
    const r = track.getBoundingClientRect();
    const f = clamp((clientX - r.left) / r.width, 0, 1);
    return S.anchor + (f - 0.5) * WINDOW;
  };
  track.addEventListener('pointerdown', (e) => {
    scrubbing = true;
    track.setPointerCapture(e.pointerId);
    stopLapse();
    S.anim = null;
    S.live = false;
    S.t = floorHour(tAtX(e.clientX) + HOUR / 2, zone);
    syncInputs(S.t);
    thumb.focus({ preventScroll: true });
  });
  track.addEventListener('pointermove', (e) => {
    if (!scrubbing) return;
    S.t = floorHour(tAtX(e.clientX) + HOUR / 2, zone);
    syncInputs(S.t);
  });
  const endScrub = () => {
    if (!scrubbing) return;
    scrubbing = false;
    // glide the window so the chosen moment returns to centre
    S.anchorAnim = { from: S.anchor, to: S.t, start: performance.now(), dur: S.motion ? 500 : 1 };
  };
  track.addEventListener('pointerup', endScrub);
  track.addEventListener('pointercancel', endScrub);

  function buildTicks() {
    const key = `${Math.round(S.anchor / HOUR)}|${S.hc}|${track.clientWidth}|${renderer?.baked}`;
    if (key === S.lastTicks) return;
    S.lastTicks = key;
    ticks.replaceChildren();
    const w = track.clientWidth || 1;
    const from = S.anchor - WINDOW / 2;
    const to = S.anchor + WINDOW / 2;
    let d = zone.mktime({ ...zone.localtime(from), hour: 0, min: 0, sec: 0 });
    let i = 0;
    while (d <= to) {
      if (d >= from) {
        const x = ((d - from) / WINDOW) * w;
        const lt = zone.localtime(d);
        const el = document.createElement('div');
        el.className = lt.wday === 1 ? 'tick week' : 'tick';
        el.style.left = `${x}px`;
        ticks.append(el);
        if (lt.wday === 1 && x > 24 && x < w - 24) {
          const lab = document.createElement('div');
          lab.className = 'tick-label';
          lab.style.left = `${x}px`;
          lab.textContent = fmt.short(d);
          ticks.append(lab);
        }
      }
      d = zone.mktime({ ...zone.localtime(d), mday: zone.localtime(d).mday + 1, hour: 0, min: 0, sec: 0 });
      if (++i > 40) break;
    }
    if (!renderer?.baked) return;
    for (const ev of eventsBetween(from, to)) {
      const x = ((ev.t - from) / WINDOW) * w;
      const el = document.createElement('div');
      el.className = 'tick-moon';
      el.style.left = `${x}px`;
      el.title = `${ev.name} · ${fmt.event(ev.t)}`;
      const cv = document.createElement('canvas');
      el.append(cv);
      ticks.append(el);
      paintMoon(renderer, cv, ev.t, 18, { hc: S.hc });
    }
  }

  thumb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      step((e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? DAY : HOUR));
    }
  });

  // ---- keyboard ----------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (!help.hidden && e.key === 'Escape') { openHelp(false); return; }
    if (e.key === 'Escape' && S.calendar) { setCalendar(false); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case 'ArrowLeft': step(e.shiftKey ? -DAY : -HOUR); break;
      case 'ArrowRight': step(e.shiftKey ? DAY : HOUR); break;
      case 'PageUp': goTo((S.anim ? S.anim.to : S.t) - SYNODIC_MONTH * DAY); break;
      case 'PageDown': goTo((S.anim ? S.anim.to : S.t) + SYNODIC_MONTH * DAY); break;
      case ' ': if (e.target instanceof HTMLButtonElement) return; S.lapse ? stopLapse() : startLapse(); break;
      case 'n': case 'N': goNow(); break;
      case 'c': case 'C': setCalendar(!S.calendar); break;
      case 'h': case 'H': setHC(!S.hc); break;
      case '?': openHelp(help.hidden); break;
      default: return;
    }
    e.preventDefault();
  });

  // ---- readout + caption ---------------------------------------------------------
  const readout = document.querySelector('.readout');
  const R = { date: $('r-date'), phase: $('r-phase'), illum: $('r-illum'), age: $('r-age'), elong: $('r-elong'), next: $('r-next') };
  const cap = $('caption');
  const capCmd = $('cap-cmd');
  const capOut = $('cap-out');
  function updateText(force = false) {
    const now = nowSec();
    const shownHour = S.live && !S.anim ? Math.floor(now) : floorHour(S.t, zone);
    const key = `${S.live && !S.anim}|${S.live ? Math.floor(now / 60) : shownHour}|${pomError?.arg ?? ''}`;
    if (!force && key === S.lastKey) return;
    S.lastKey = key;

    // pom's own answer — byte-for-byte the original program's output
    if (pomError) {
      capCmd.textContent = `pom ${pomError.arg}`;
      capOut.textContent = pomError.text;
      cap.classList.add('err');
    } else {
      const liveNow = S.live && !S.anim;
      const arg = liveNow ? undefined : toCompressed(shownHour, zone);
      const r = runPom(arg, { now, zone });
      capCmd.textContent = liveNow ? 'pom' : `pom ${arg}`;
      capOut.textContent = r.stdout.trimEnd();
      cap.classList.remove('err');
    }

    const t = S.live && !S.anim ? now : S.t;
    const d = describe(shownHour, now);
    $('btn-now').setAttribute('aria-pressed', String(S.live && !S.anim));
    // announce settled states only; timelapse and scrubbing would flood a screen reader
    readout.setAttribute('aria-live', S.lapse || S.anim || scrubbing ? 'off' : 'polite');
    const st = phaseState(t);
    R.date.textContent = fmt.eyebrow(t);
    R.phase.textContent = PHASE_NAMES[d.key];
    R.illum.innerHTML = `${(st.percent).toFixed(1)}<small>%</small>`;
    R.age.innerHTML = `${st.age.toFixed(1)}<small> days</small>`;
    R.elong.innerHTML = `${st.elongation.toFixed(1)}<small>°</small>`;
    const [nx] = upcomingEvents(t, 1);
    R.next.innerHTML = `<b>${nx.name}</b> ${fmt.relative(nx.t - t).replace(/^in /, 'in ')} · ${fmt.event(nx.t)}`;
    thumb.setAttribute('aria-valuetext', `${fmt.eyebrow(t)}: ${d.sentence}`);
    if (calendar && S.calendar) calendar.select(t);
  }

  // ---- frame loop -----------------------------------------------------------------
  let last = performance.now();
  let clock = 0;
  // adaptive resolution: shrink the drawing buffer if frames run long
  let resScale = lite ? 0.5 : 1;
  let resCeil = resScale;      // never climb back to a scale that proved too slow
  const resFloor = lite ? 0.3 : 0.5;
  let slow = 0;
  // With frozen shader time (lite or reduced motion) nothing moves unless the
  // state changes, so identical frames are skipped: zero CPU/GPU when idle.
  let shaderMotion = S.motion && !lite;
  let lastDrawKey = '';
  let drewLast = false;
  let settledHour = null;   // /usr/games Reborn: the hour the view last came to rest on
  const veilText = $('veil-text');
  // /usr/games Reborn: the Hall's reduced-motion setting, live (hall.js); ?motion=0 still wins.
  function setReducedMotion(reduced) {
    S.motion = !reduced && qs.get('motion') !== '0';
    shaderMotion = S.motion && !lite;
    document.body.classList.toggle('still', !S.motion);
  }
  function frame() {
    // one clock for everything (rAF timestamps can lag performance.now())
    const ms = performance.now();
    const dt = clamp((ms - last) / 1000, 0, 0.1);
    last = ms;
    if (shaderMotion) clock += dt;

    if (renderer && !renderer.baked) {
      const progress = renderer.bakeStep(lite ? 30 : 12);
      veilText.textContent = renderer.phase === 'compile'
        ? 'Compiling shaders…'
        : `Accreting the Moon… ${Math.floor(progress * 100)}%`;
      if (renderer.baked) {
        $('veil').classList.add('gone');
        S.lastTicks = '';
        if (S.calendar) calendar.render();
        window.__selene = { ready: true, bakeMs: renderer.bakeMs, compileMs: renderer.compileMs, tex: renderer.texW, floatRT: renderer.floatRT };
      }
    }
    if (renderer?.baked) S.ready = clamp(S.ready + dt / (S.motion ? 0.9 : 0.01), 0, 1);

    // time
    if (S.anim) {
      const k = clamp((ms - S.anim.start) / S.anim.dur, 0, 1);
      S.t = S.anim.from + (S.anim.to - S.anim.from) * easeInOut(k);
      if (k >= 1) {
        S.t = S.anim.to;
        if (S.anim.toLive) S.live = true;
        S.anim = null;
      }
    } else if (S.lapse) {
      const k = (ms - S.lapse.start) / 1000 / TIMELAPSE_S;
      const span = SYNODIC_MONTH * DAY;
      const f = S.motion ? easeInOut(clamp(k, 0, 1)) : Math.floor(clamp(k, 0, 1) * 29.5) / 29.5;
      S.t = S.lapse.from + span * f;
      if (k >= 1) {
        noteTimelapseFinished();
        stopLapse();
      }
    } else if (S.live) {
      S.t = nowSec();
    }
    if (S.anchorAnim) {
      const k = clamp((ms - S.anchorAnim.start) / S.anchorAnim.dur, 0, 1);
      S.anchor = S.anchorAnim.from + (S.anchorAnim.to - S.anchorAnim.from) * easeInOut(k);
      if (k >= 1) S.anchorAnim = null;
    }
    // keep the thumb inside the window
    if (!S.lapse && !scrubbing && !S.anchorAnim && Math.abs(S.t - S.anchor) > WINDOW * 0.42) S.anchor = S.t;

    // drag spring
    if (!S.drag) {
      const k = S.motion ? Math.exp(-dt * 5) : 0;
      S.yaw *= k;
      S.pitch *= k;
    }

    // layout (Moon glides aside when the drawer opens)
    const w = innerWidth;
    const h = innerHeight;
    L = layout(w, h);
    S.moonX = S.moonX === null ? L.x : S.moonX + (L.x - S.moonX) * (S.motion ? 1 - Math.exp(-dt * 6) : 1);

    // measure only frames that followed a real draw, or skipped frames look fast
    if (renderer?.baked && dt > 0 && drewLast) {
      slow = slow * 0.95 + (dt > 1 / 40 ? 1 : 0) * 0.05;
      if (slow > 0.6 && resScale > resFloor) { resCeil = resScale * 0.97; resScale = Math.max(resFloor, resScale * 0.85); slow = 0.3; }
      else if (slow < 0.02 && resScale < resCeil) { resScale = Math.min(resCeil, resScale * 1.05); slow = 0.1; }
    }
    drewLast = false;
    const liveNow = S.live && !S.anim;
    const drawKey = shaderMotion || !renderer?.baked ? '' : [
      liveNow ? Math.floor(S.t / 60) : S.t, S.yaw, S.pitch, S.moonX.toFixed(1), L.r, L.y, L.horizon,
      w, h, S.hc, S.ready, resScale, devicePixelRatio,
    ].join('|');
    if (renderer && (drawKey === '' || drawKey !== lastDrawKey)) {
      lastDrawKey = drawKey;
      drewLast = true;
      const st = phaseState(S.t);
      const view = {
        width: w, height: h, dpr: Math.min(devicePixelRatio || 1, 2) * resScale, time: clock,
        moon: { x: S.moonX, y: L.y, r: L.r },
        elongation: st.elongation, illuminated: st.illuminated,
        yaw: S.yaw, pitch: S.pitch, ready: S.ready, hc: S.hc, motion: shaderMotion, horizon: L.horizon,
      };
      // /usr/games Reborn: once, a full Moon for the Hall's key art, then this frame as usual,
      // all in one task so the player never sees the stand-in.
      if (S.ready >= 1 && posterWanted()) {
        renderer.render({ ...view, elongation: 180, illuminated: 1, yaw: 0, pitch: 0 });
        offerPoster(canvas);
      }
      renderer.render(view);
    }

    const frac = clamp((S.t - S.anchor) / WINDOW + 0.5, 0, 1);
    thumb.style.left = `${frac * 100}%`;
    thumb.setAttribute('aria-valuenow', ((S.t - S.anchor) / DAY).toFixed(1));
    buildTicks();
    updateText();
    const restingHour = !S.live && !S.anim && !S.lapse ? floorHour(S.t, zone) : null;
    if (restingHour !== settledHour) {
      settledHour = restingHour;
      if (restingHour !== null) noteMomentVisited(restingHour);
    }
    requestAnimationFrame(frame);
  }

  syncInputs(S.t);
  if (qs.get('calendar') === '1') setCalendar(true);
  updateText(true);
  requestAnimationFrame(frame);
  followHallMotion(setReducedMotion);
  window.__seleneApp = { S, goTo, goNow, startLapse, stopLapse, setCalendar, setHC, renderer };
}
