// Rain on Still Water — boot, clock and wiring.
//
// One engine (src/engine/, byte-faithful to rain.c), one clock
// (timeline.js, ADR-003), two views of it: the modern pond and the
// classic terminal. Split view shows both, frame for frame.
//
// URL parameters (all optional):
//   d=120            the -d delay (0..999; 0 = 9600-baud pacing)
//   view=split       modern | split | classic
//   q=low            force a quality profile (high | low)
//   seed=1           the random() seed (the original never seeds: 1)
//   reduced          behave as if prefers-reduced-motion were set
//   nogl             pretend WebGL2 is missing (the fallback)
//   skip=a,b         diagnostics: leave out render passes
//                    (sim, env, scene, particles, bloom)
import { createRain, parseDelay, frameMs } from './engine/rain.js';
import {
  createTimeline, advance, takeDue, setDelay, inFlight,
} from './engine/timeline.js';
import { termToWorld, createPond } from './render/geometry.js';
import { createClassic } from './ui/classic.js';
import { createControls, sliderToDelay, delayToSlider } from './ui/controls.js';
import { createAudio } from './audio/audio.js';
import { noteDelay, noteSound, noteView, offerPoster, posterWanted } from './hall.js';

const qs = new URLSearchParams(location.search);
const reducedMotion = qs.has('reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches;

let delayError = null;
function initialDelay() {
  if (qs.has('d')) {
    const p = parseDelay(qs.get('d'));
    if (!p.error) return p.delay;
    delayError = p.error; // shown once the page is up, as rain would print it
  }
  // reduced motion: a drizzle (ADR-003)
  return reducedMotion ? 400 : 120;
}

const rain = createRain({ COLS: 80, LINES: 24, seed: +(qs.get('seed') || 1), delay: initialDelay() });
const timeline = createTimeline(rain);
const audio = createAudio();
const classic = createClassic(document.getElementById('term'));
const canvas = document.getElementById('pond');

let renderer = null;
let view = ['modern', 'split', 'classic'].includes(qs.get('view')) ? qs.get('view') : 'modern';
const forcedQuality = qs.get('q');
const soundPond = createPond(16 / 9, 'low');

const dropsPerSecond = () => 1000 / frameMs(rain);
// Drops per second -> 0..1: a drizzle at -d 999, a downpour at -d 1.
const rainAmount = () => Math.min(1, Math.max(0, Math.log10(dropsPerSecond()) / 3));

// A drop keeps the same spot inside its terminal cell for its whole life
// (ADR-004): a hash of the frame it was born in.
function jitter(born) {
  let h = Math.imul(born ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return [((h & 0xffff) / 0xffff) - 0.5, (((h >>> 16) & 0xffff) / 0xffff) - 0.5];
}
function dropWorld(pond, frame, ev) {
  const born = frame - 1 - ev.age;
  const [jx, jy] = jitter(born);
  return termToWorld(pond, rain, ev.x, ev.y, jx * 0.9, jy * 0.9);
}

// ---------------------------------------------------------------- controls
const ui = createControls({
  onDelay: (d) => changeDelay(d),
  onStep: (dir) => {
    const cur = rain.delay > 0 ? rain.delay : 120;
    changeDelay(sliderToDelay(delayToSlider(cur) + dir * 60));
  },
  onView: (v) => {
    if (v === 'toggle-classic') v = view === 'classic' ? 'modern' : 'classic';
    if (v === 'toggle-split') v = view === 'split' ? 'modern' : 'split';
    noteView(v);
    setView(v);
  },
  onQuality: () => {
    if (!renderer) return;
    renderer.setQuality(renderer.profileName === 'high' ? 'low' : 'high');
    ui.showQuality(renderer.profileName, true);
    resize();
    ui.say(renderer.profileName === 'high' ? 'Quality: High' : 'Quality: Low');
  },
  onSound: async () => {
    const on = audio.isMuted();
    await audio.setMuted(!on);
    ui.showSound(on);
    noteSound(on);
    audio.setRain(rainAmount());
  },
});

function changeDelay(d) {
  setDelay(timeline, d, performance.now());
  noteDelay(d);
  ui.showDelay(d, dropsPerSecond());
  audio.setRain(rainAmount());
}

function setView(v) {
  if (!renderer && v !== 'classic') v = 'classic';
  view = v;
  ui.showView(view, !!renderer);
  resize();
}

function resize() {
  classic.fit();
  if (!renderer || view === 'classic') return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(canvas.clientWidth * dpr, canvas.clientHeight * dpr);
}

// ---------------------------------------------------------------- adaptive quality
// On a slow machine (a software rasteriser, an old laptop) drop to Low
// once, early, instead of stuttering. Never when the URL forces quality.
const perf = { t0: 0, frames: 0, time: 0, done: !!forcedQuality };
function watchPerformance(now, dt) {
  if (perf.done || !renderer || view === 'classic') return;
  if (!perf.t0) perf.t0 = now;
  const age = (now - perf.t0) / 1000;
  if (age < 2) return;
  perf.frames++;
  perf.time += dt;
  if (age > 5) {
    const fps = perf.frames / perf.time;
    if (fps < 40 && renderer.profileName === 'high') {
      renderer.setQuality('low');
      ui.showQuality('low', true);
      resize();
      ui.say(`Switched to Low quality (${fps.toFixed(0)} fps on High). Press Q to switch back.`);
    }
    perf.done = true;
  }
}

// ---------------------------------------------------------------- loop
let lastNow = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - lastNow) / 1000);
  lastNow = now;
  advance(timeline, now);
  const due = takeDue(timeline, now);
  const dps = dropsPerSecond();
  const drawModern = renderer && view !== 'classic';

  for (const f of due) {
    for (const ev of f.events) {
      if (ev.age > 4) continue;
      // (without the modern view, sound still needs to know where drops are)
      const pond = renderer?.pond || soundPond;
      const w = dropWorld(pond, f.frame, ev);
      if (drawModern) renderer.drop(ev.age, w.x, w.z, reducedMotion ? 0.6 : 1);
      if ((ev.age === 0 || ev.age === 3) && !ev.phantom) audio.plink(ev.age, w.az, w.r, dps);
    }
  }
  if (timeline.shown && view !== 'modern') classic.show(timeline.shown.text);

  if (drawModern) {
    // the engine's newest drops, still in the air (ADR-003 rule 2)
    const falling = [];
    for (const f of inFlight(timeline)) {
      const w = dropWorld(renderer.pond, f.frame, f.events[0]);
      falling.push([w.x, w.z, (f.t + timeline.latency - now) / 1000]);
    }
    renderer.frame(now / 1000, dt, {
      rain: rainAmount(),
      falling,
      streaks: reducedMotion ? 0.4 : 1,
    });
    if (posterWanted()) offerPoster(canvas);
    watchPerformance(now, dt);
    // (ms since navigation; the first frame is when shaders really compile)
    if (!window.__firstFrame) window.__firstFrame = performance.now();
  } else if (renderer) {
    renderer.impulses.length = 0;
  }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- boot
async function boot() {
  ui.showDelay(rain.delay, dropsPerSecond());
  ui.showSound(false);
  let fallback = qs.has('nogl') ? 'no-webgl2' : null;
  if (!fallback) {
    try {
      const { createRenderer } = await import('./render/renderer.js');
      const r = await createRenderer(canvas, {
        quality: forcedQuality || undefined,
        reducedMotion,
        skip: (qs.get('skip') || '').split(',').filter(Boolean),
      });
      if (r && !r.error) renderer = r;
      else fallback = r.error;
    } catch (e) {
      console.error(e);
      fallback = 'renderer-error';
    }
  }
  if (!renderer) {
    document.body.dataset.fallback = fallback;
    ui.say(fallback === 'no-float-targets'
      ? 'This GPU cannot render the pond (no float render targets) — showing the classic terminal.'
      : 'WebGL2 is not available here — showing the classic terminal, exactly as in 1980.', 8000);
  }
  if (delayError) ui.say(`rain: ${delayError} — using -d ${rain.delay}`, 8000);
  ui.showQuality(renderer ? renderer.profileName : 'low', !!renderer);
  setView(view);
  addEventListener('resize', resize);
  document.addEventListener('fullscreenchange', resize);
  if (renderer?.software && !forcedQuality) {
    ui.say('Running without a GPU (software rendering): Low quality.', 6000);
  }
  requestAnimationFrame(loop);

  // hooks for the screenshot and UI scripts
  window.__rain = {
    timeline,
    rain,
    setView,
    setDelay: changeDelay,
    view: () => view,
    audio: () => ({ muted: audio.isMuted(), state: audio.state(), level: audio.level() }),
  };
  setInterval(() => {
    window.__info = {
      ...(renderer ? renderer.info() : { fallback }),
      view,
      delay: rain.delay,
      frame: rain.frame,
      fps: renderer ? Math.round(1 / Math.max(1e-3, renderer.avgDt || 0.016)) : null,
    };
  }, 500);
  window.__ready = true;
}

boot();
