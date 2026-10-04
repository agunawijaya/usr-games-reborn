// Abyssal Worms: the app controller. Owns the engine world, the clock that
// decides when an engine step happens, both renderers, audio and the UI.

import {
  createWorld, step, stepInterval, setNumber, setLength, setTrail, setField,
} from '../engine/worms.js';
import { parseArgs, splitArgs, formatArgs, DEFAULTS } from '../engine/args.js';
import { WormRenderer } from '../render/renderer.js';
import { ClassicView } from '../render/classic.js';
import { Ambience } from '../audio/ambience.js';
import { createLogbook } from '../log/logbook.js';
import {
  followHall, isHeldStill,
  noteCommandLine, noteLettersEaten, noteOptions, noteSplitMoved, noteView, offerPoster, posterWanted,
} from '../hall.js';

const $ = (id) => document.getElementById(id);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const IDLE_MS = 3200;

export function startApp() {
  const qs = new URLSearchParams(location.search);
  const media = (q) => window.matchMedia?.(q).matches ?? false;

  // ---- options: ?args= goes through the faithful getopt port ------------------
  let opts = { ...DEFAULTS };
  let bootError = null;
  if (qs.has('args')) {
    const r = parseArgs(splitArgs(qs.get('args')));
    if (r.ok) opts = r.opts;
    else bootError = r.stderr.trimEnd();
  }
  const S = {
    opts,
    seed: Number(qs.get('seed')) >>> 0 || 1,
    cell: clamp(Number(qs.get('cell')) || 14, 8, 36),
    quality: qs.get('q') === 'low' ? 'low' : 'high',
    motion: qs.get('motion') !== '0' && !media('(prefers-reduced-motion: reduce)'),
    view: ['classic', 'split', 'modern'].includes(qs.get('view')) ? qs.get('view') : 'modern',
    split: 0.5,
    muted: true,
    paused: false,
  };

  // ---- renderers ---------------------------------------------------------------
  const canvas = $('abyss');
  const classicCanvas = $('classic');
  let renderer = null;
  try {
    renderer = new WormRenderer(canvas);
    if (renderer.software && !qs.has('q')) S.quality = 'low';
  } catch (err) {
    console.warn('Abyssal Worms: WebGL2 unavailable,', err.message);
  }
  const classic = new ClassicView(classicCanvas);
  if (!renderer) {
    S.view = 'classic';
    for (const b of document.querySelectorAll('[data-view]')) if (b.dataset.view !== 'classic') b.disabled = true;
    showNotice('This browser can’t run WebGL2, so the abyss can’t be drawn. Here is the original terminal view instead.');
  } else if (renderer.software) {
    showNotice('No GPU found: running the abyss at Low quality.', 6000);
  }
  $('render-info').textContent = renderer
    ? `Renderer: ${renderer.software ? 'CPU (software WebGL)' : 'GPU'} · ${renderer.rendererName || 'unknown'}`
    : 'Renderer: none (no WebGL2). Classic view only.';

  const audio = new Ambience();

  // ---- world -------------------------------------------------------------------
  let world = null;
  let logbook = null;     // created once the controls exist, below
  let grid = null;
  let clock = 0;          // real seconds since start (trail ages)
  let anim = 0;           // animation seconds (frozen under reduced motion)
  let acc = 0;            // time since the last engine step
  let dpr = 1;

  function layoutGrid() {
    const w = innerWidth;
    const h = innerHeight;
    const cols = Math.max(2, Math.floor(w / S.cell));
    const rows = Math.max(2, Math.floor(h / S.cell));
    return { w, h, cols, rows, origin: [(w - cols * S.cell) / 2, (h - rows * S.cell) / 2] };
  }

  /** A fresh launch, as if `worms` had just been started in a terminal of this size. */
  function restart() {
    grid = layoutGrid();
    world = createWorld({ cols: grid.cols, rows: grid.rows, ...S.opts, seed: S.seed });
    acc = 0;
    logbook?.onRestart(clock);
    renderer?.setWorld(world, clock);
    classic.invalidate();
    syncUI();
  }

  function interval() {
    const ms = stepInterval(S.opts.delay, S.opts.number);
    // reduced motion: never faster than ~7 steps a second
    return (S.motion ? ms : Math.max(ms, 150)) / 1000;
  }

  function doStep() {
    step(world);
    logbook?.afterStep(world, clock);
    if (S.opts.field) noteLettersEaten(world.ate.length);
    renderer?.onStep(clock);
    // a head landing on an occupied cell: two worms (or one) crossing
    for (const i of world.placed) {
      if (world.ref[i] >= 2) {
        audio.crossing(i % world.cols, panOf);
        break;
      }
    }
  }
  const panOf = (x) => (grid ? (x / Math.max(1, grid.cols - 1)) * 1.6 - 0.8 : 0);

  // ---- live flag changes (port ADR-003) -------------------------------------------
  function applyOpts(next, { fresh = false } = {}) {
    const prev = S.opts;
    S.opts = next;
    noteOptions(prev, next);
    if (fresh || !world) { restart(); return; }
    if (next.length !== prev.length) setLength(world, next.length);
    if (next.number !== prev.number) setNumber(world, next.number);
    if (next.trail !== prev.trail) {
      setTrail(world, next.trail);
      if (!next.trail) renderer?.clearTrails();
    }
    if (next.field !== prev.field) setField(world, next.field);
    renderer?.onStep(clock, { snap: true });
    classic.invalidate();
    syncUI();
  }

  // ---- UI wiring -------------------------------------------------------------------
  const inN = $('in-n'), numN = $('num-n'), inL = $('in-l'), numL = $('num-l');
  const inD = $('in-d'), valD = $('val-d'), inF = $('in-f'), inT = $('in-t');
  const inArgs = $('in-args'), argErr = $('arg-err');
  const inCell = $('in-cell'), valCell = $('val-cell');

  function syncUI() {
    const o = S.opts;
    inN.value = Math.min(o.number, 64); numN.value = o.number;
    inL.value = Math.min(o.length, 256); numL.value = o.length;
    inD.value = o.delay;
    valD.textContent = o.delay ? `${o.delay} ms` : `terminal`;
    valD.title = o.delay ? '' : `No -d: about ${Math.round(stepInterval(0, o.number))} ms a step, like a 9600-baud terminal`;
    inF.checked = o.field; inT.checked = o.trail;
    inCell.value = S.cell; valCell.textContent = `${S.cell} px`;
    if (document.activeElement !== inArgs) inArgs.value = formatArgs(o).replace(/^worms\s*/, '');
    $('cmd-text').textContent = formatArgs(o);
    $('val-seed').textContent = `seed ${S.seed}${S.seed === 1 ? ' (glibc default)' : ''}`;
    document.body.className = document.body.className.replace(/view-\S+/g, '').trim();
    document.body.classList.add(`view-${S.view}`);
    for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-checked', String(b.dataset.view === S.view));
    for (const b of document.querySelectorAll('[data-q]')) b.setAttribute('aria-checked', String(b.dataset.q === S.quality));
    $('divider').hidden = S.view !== 'split';
    document.documentElement.style.setProperty('--split', `${S.split * 100}%`);
    $('btn-sound').setAttribute('aria-pressed', String(!S.muted));
    $('btn-sound').setAttribute('aria-label', S.muted ? 'Sound off' : 'Sound on');
  }

  const setNum = (key, v, lo, hi) => {
    v = Math.round(Number(v));
    if (!Number.isFinite(v)) return;
    applyOpts({ ...S.opts, [key]: clamp(v, lo, hi) });
  };
  inN.addEventListener('input', () => setNum('number', inN.value, 1, 256));
  numN.addEventListener('change', () => setNum('number', numN.value, 1, 256));
  inL.addEventListener('input', () => setNum('length', inL.value, 2, 1024));
  numL.addEventListener('change', () => setNum('length', numL.value, 2, 1024));
  inD.addEventListener('input', () => applyOpts({ ...S.opts, delay: Number(inD.value) }));
  inF.addEventListener('change', () => applyOpts({ ...S.opts, field: inF.checked }));
  inT.addEventListener('change', () => applyOpts({ ...S.opts, trail: inT.checked }));
  $('argform').addEventListener('submit', (e) => {
    e.preventDefault();
    const r = parseArgs(splitArgs(inArgs.value));
    if (!r.ok) {
      argErr.textContent = r.stderr.trimEnd();
      argErr.hidden = false;
      return;
    }
    argErr.hidden = true;
    applyOpts(r.opts, { fresh: true });   // a new command line is a new launch
    noteCommandLine();
  });
  inArgs.addEventListener('input', () => { argErr.hidden = true; });
  inCell.addEventListener('input', () => { S.cell = Number(inCell.value); restart(); });
  $('btn-restart').addEventListener('click', restart);
  $('btn-seed').addEventListener('click', () => { S.seed = (Math.random() * 4294967295) >>> 0 || 1; restart(); });
  let userPickedQuality = qs.has('q');
  for (const b of document.querySelectorAll('[data-q]')) b.addEventListener('click', () => { S.quality = b.dataset.q; userPickedQuality = true; syncUI(); });
  for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => setView(b.dataset.view));

  function setView(v) {
    if (!renderer) v = 'classic';
    S.view = v;
    noteView(v);
    classic.invalidate();
    syncUI();
  }

  const panel = $('panel');
  const togglePanel = (on = panel.hidden) => {
    panel.hidden = !on;
    $('btn-settings').setAttribute('aria-pressed', String(on));
    if (on) logbook.toggle(false);
  };
  $('btn-settings').addEventListener('click', () => togglePanel());

  const toggleSound = () => {
    S.muted = !S.muted;
    audio.setMuted(S.muted);
    syncUI();
  };
  $('btn-sound').addEventListener('click', toggleSound);

  followHall({
    audio,
    setMuted: (muted) => { S.muted = muted; audio.setMuted(muted); syncUI(); },
    setReducedMotion: (reduced) => { S.motion = !reduced; },
  });

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  $('btn-full').addEventListener('click', toggleFull);

  // split divider
  const divider = $('divider');
  let dragging = false;
  divider.addEventListener('pointerdown', (e) => { dragging = true; divider.setPointerCapture(e.pointerId); });
  divider.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    S.split = clamp(e.clientX / innerWidth, 0.04, 0.96);
    syncUI();
    noteSplitMoved();
  });
  divider.addEventListener('pointerup', () => { dragging = false; });
  divider.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      S.split = clamp(S.split + (e.key === 'ArrowLeft' ? -0.02 : 0.02), 0.04, 0.96);
      syncUI();
      noteSplitMoved();
      e.preventDefault();
    }
  });

  // ---- the logbook: sightings, the journal, the Daily Dive, postcards (src/log/) ----
  logbook = createLogbook({
    world: () => world,
    grid: () => grid,
    cell: () => S.cell,
    seed: () => S.seed,
    reducedMotion: () => !S.motion,
    scene: () => ({ seed: S.seed, opts: { ...S.opts }, cell: S.cell, view: S.view }),
    openScene: (scene) => {
      S.seed = scene.seed;
      if (scene.cell) S.cell = scene.cell;
      if (scene.view) setView(scene.view);
      applyOpts({ ...S.opts, ...scene.opts }, { fresh: true });
    },
  });
  $('btn-log').addEventListener('click', () => { if (logbook.open) togglePanel(false); });
  window.addEventListener('pointerdown', (e) => {
    if (e.target === canvas || e.target === classicCanvas) logbook.onPointer(e.clientX, e.clientY, clock);
  });

  // keyboard
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      if (!panel.hidden || logbook.open) e.preventDefault();
      togglePanel(false);
      logbook.toggle(false);
      return;
    }
    if (k === 'b') { togglePanel(false); logbook.toggle(); e.preventDefault(); return; }
    if (k === 'l') { logbook.logActive(clock); e.preventDefault(); return; }
    if (k === 'j') { logbook.meetNextWorm(clock); e.preventDefault(); return; }
    if (k === 'f') toggleFull();
    else if (k === 's') togglePanel();
    else if (k === 'm') toggleSound();
    else if (k === 'r') restart();
    else if (k === 'c') setView(S.view === 'classic' ? 'modern' : 'classic');
    else if (k === 'v') setView(S.view === 'split' ? 'modern' : 'split');
    else if (k === ' ') S.paused = !S.paused;
    else return;
    e.preventDefault();
  });

  // idle: the UI and cursor fade away, like a screensaver should
  let lastActivity = performance.now();
  const wake = () => {
    lastActivity = performance.now();
    document.body.classList.remove('idle');
  };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, wake, { passive: true });

  function showNotice(text, ms = 0) {
    const n = $('notice');
    n.textContent = text;
    n.hidden = false;
    if (ms) setTimeout(() => { n.hidden = true; }, ms);
  }

  // resize = a new terminal: restart, debounced
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const g = layoutGrid();
      if (!grid || g.cols !== grid.cols || g.rows !== grid.rows) restart();
      else grid = g;
    }, 250);
  });

  // ---- frame loop ----------------------------------------------------------------
  let last = performance.now();
  let revealed = false;
  let slow = 0;           // EMA of "this frame missed 40 fps"
  function frame() {
    const now = performance.now();
    if (isHeldStill()) { last = now; requestAnimationFrame(frame); return; }
    const rawDt = (now - last) / 1000;
    const dt = clamp(rawDt, 0, 0.1);
    last = now;
    // keep it smooth on weak GPUs: drop to Low once, unless the user chose
    if (revealed && S.quality === 'high' && !userPickedQuality && S.view !== 'classic' && document.visibilityState === 'visible') {
      slow = slow * 0.97 + (rawDt > 1 / 40 ? 1 : 0) * 0.03;
      if (slow > 0.5) {
        S.quality = 'low';
        slow = 0;
        syncUI();
        showNotice('Frames were slow, so the abyss switched to Low quality. You can switch back in Settings.', 7000);
      }
    }
    clock += dt;
    if (S.motion) anim += dt;
    if (!panel.hidden || logbook.open || now - lastActivity < IDLE_MS) document.body.classList.remove('idle');
    else document.body.classList.add('idle');

    const iv = interval();
    if (!S.paused) acc += dt;
    let steps = 0;
    while (acc >= iv && steps < 12) {
      acc -= iv;
      doStep();
      steps++;
    }
    if (steps === 12) acc = 0;           // fell far behind: don't spiral
    const f = S.paused ? Math.min(acc / iv, 0.999) : acc / iv;

    const cssDpr = Math.min(devicePixelRatio || 1, 2);
    dpr = S.quality === 'high' ? cssDpr : Math.min(cssDpr, 1) * 0.75;
    if (renderer && S.view !== 'classic') {
      const ok = renderer.render({
        width: grid.w, height: grid.h, dpr, cell: S.cell, origin: grid.origin,
        f: clamp(f, 0, 1), time: clock, animTime: anim, high: S.quality === 'high', motion: S.motion,
        glow: 1, bloom: S.quality === 'high' ? 0.85 : 0.7, exposure: 0.92, field: S.opts.field, trail: S.opts.trail,
      });
      if (ok && !revealed) {
        revealed = true;
        $('veil').classList.add('gone');
      }
      if (ok && posterWanted()) offerPoster(canvas);
    }
    if (S.view !== 'modern') {
      classic.draw(world, { width: grid.w, height: grid.h, dpr: cssDpr, cell: S.cell, origin: grid.origin });
      if (!revealed && (!renderer || S.view === 'classic')) {
        revealed = true;
        $('veil').classList.add('gone');
      }
    }
    audio.update(world, panOf);
    logbook.draw(clock);
    window.__abyss = { ready: revealed, S, world, renderer, audio, logbook: logbook.forTests };
    requestAnimationFrame(frame);
  }

  restart();
  // ?warm=N: run N engine steps before the first frame (reproducible screenshots)
  const warm = clamp(Number(qs.get('warm')) || 0, 0, 20000);
  for (let i = 0; i < warm; i++) doStep();
  if (warm) renderer?.onStep(clock, { snap: true });
  if (bootError) {
    showNotice(bootError);
  }
  $('veil-text').textContent = renderer ? 'Descending…' : '';
  requestAnimationFrame(frame);
}
