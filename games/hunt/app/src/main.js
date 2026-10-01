// Hunt — Ricochet: the browser host. It owns the clock and the DOM; the
// engine (src/engine) owns the rules. Every engine step: the human's queued
// key and the bots' keys execute, the world moves, and the renderer, the
// HUD, the classic terminal and the sound are told what happened.

import * as H from './engine/hunt.js';
import * as K from './engine/constants.js';
import { createMatch, tick, BOT_KINDS, ARENAS } from './engine/match.js';
import { addBot } from './bots/index.js';
import { setOverride, overrideActive, OVERRIDE_FLAGS } from './engine/override.js';
import { trajectory, liveTerrain } from './engine/trajectory.js';
import { createClock, advance, SPEEDS, stepSeconds } from './clock.js';
import { createViewState, updateView } from './view.js';
import { renderClassic } from './classic.js';
import { Input, QUEUE_MAX } from './input.js';
import { Hud } from './ui/hud.js';
import { Sound } from './audio.js';
import { playerColor, FFA, YOU } from './render/palette.js';
import { SIZE_OF } from './render/coach.js';
import { ACTION_LABEL } from './keymap.js';
import {
  leaveFromSetup, noteEvents, noteMatchStarted, offerPoster, posterWanted, reportMatchEnded,
} from './hall.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const W = K.WIDTH;

// ------------------------------------------------------------- settings
const DEFAULTS = {
  name: 'you', mode: 'ffa', bots: '4', difficulty: 'mixed', arena: 'ricochet', seed: 1985,
  speed: 'standard', enter: 'c', scheme: 'modern', view: 'modern', quality: 'auto', camera: 'overview',
};
let settings = { ...DEFAULTS };
// v2: Ricochet became the default arena, v3: Mixed the default bots (Classic Otto
// circles in Ricochet); a choice remembered from before each change is dropped once
const SETTINGS_V = 3;
try {
  const saved = JSON.parse(localStorage.getItem('hunt.settings') || '{}');
  if (!(saved.v >= 2)) delete saved.arena;
  if (!(saved.v >= 3)) delete saved.difficulty;
  Object.assign(settings, saved);
} catch { /* defaults */ }
for (const k of Object.keys(DEFAULTS)) if (params.has(k)) settings[k] = params.get(k);
// quality=lite is a URL-only test switch (the menu offers auto/low/high), so it is never remembered
const save = () => { try { localStorage.setItem('hunt.settings', JSON.stringify({ ...settings, v: SETTINGS_V, quality: settings.quality === 'lite' ? 'auto' : settings.quality })); } catch { /* ignore */ } };

const NOTES = {
  mode: { ffa: 'Everyone for themselves.', teams: 'Two teams (hunt teams are digits: 1 and 2). Friendly fire hurts — and costs you a kill.' },
  difficulty: Object.fromEntries(Object.entries(BOT_KINDS).map(([k, v]) => [k, `${v.label}: ${v.note}.`]).concat([['mixed', 'One of each, in turn.']])),
  arena: ARENAS,
  speed: { relaxed: '8 steps per second.', standard: '10 steps per second — one step is one pass of huntd.', frantic: '14 steps per second.' },
};

// ------------------------------------------------------------- state
let g = null;
let humanName = 'you';
let vs = createViewState();
let clock = createClock(10);
let renderer = null;
let running = false;
let paused = false;
let coachOn = false;
let classicState = {};
let lastMe = null;
let lastWeapon = 'f';
let deathInfo = null;
const colorIndex = new Map();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hud = new Hud();
const audio = new Sound();

// ------------------------------------------------------------- WebGL probe
function probeGpu() {
  if (params.get('nogl') === '1') return { gl: false };
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return { gl: false };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const name = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const soft = /swiftshader|llvmpipe|software|basic render/i.test(String(name));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { gl: true, soft, name };
  } catch {
    return { gl: false };
  }
}
const gpu = probeGpu();
// Auto: High on a GPU, Lite on a software renderer (SwiftShader, llvmpipe)
const profileFor = (q) => (q === 'high' || q === 'low' || q === 'lite' ? q : gpu.soft ? 'lite' : 'high');

async function makeRenderer() {
  if (!gpu.gl) {
    document.body.classList.add('nogl');
    settings.view = 'classic';
    return null;
  }
  try {
    const { Renderer } = await import('./render/renderer.js');
    const r = new Renderer($('gl'), { profile: profileFor(settings.quality), reduced });
    r.resize($('gl').clientWidth || innerWidth, $('gl').clientHeight || innerHeight);
    await r.warmUp();
    r.on('sfx', (name, x, y, e) => sfx(name, x, y, e));
    r.on('hurt', (e) => {
      const me = g && H.findPlayer(g, humanName);
      if (me && e.who === me.id && e.amt > 0 && !manual) {
        $('flashred').style.opacity = reduced ? '0.25' : '0.45';
        setTimeout(() => { $('flashred').style.opacity = '0'; }, 140);
        sfx('hurt', me.x, me.y);
      }
    });
    return r;
  } catch (err) {
    console.error(err);
    document.body.classList.add('nogl');
    settings.view = 'classic';
    return null;
  }
}

// ------------------------------------------------------------- colours
function colorOf(pp) {
  if (!g || !pp) return YOU;
  const name = H.nameOf(g, pp);
  const team = String.fromCharCode(H.ident(g, pp)?.team ?? 32);
  if (!colorIndex.has(name)) colorIndex.set(name, colorIndex.size);
  const c = playerColor(g, name, team.trim(), colorIndex.get(name) - (g.humans.includes(name) ? 0 : 1));
  return c;
}

// ------------------------------------------------------------- sound
function sfx(name, x, y, e) {
  if (audio.muted) return;
  let pan = 0;
  let near = 0.6;
  const me = g && H.findPlayer(g, humanName);
  if (x != null && renderer && renderer.w) {
    const [sx] = renderer.project(x, y);
    pan = (sx / renderer.w) * 2 - 1;
  } else if (x != null) {
    pan = (x / W) * 2 - 1;
  }
  if (x != null && me) near = Math.max(0, 1 - Math.hypot(x - me.x, y - me.y) / 28);
  if (name === 'move' && e && me && e.id !== me.id) near *= 0.3;
  audio.play(name, pan, near, e || {});
}

// ------------------------------------------------------------- match
function startMatch() {
  save();
  humanName = (settings.name || 'you').replace(/[^\x20-\x7e]/g, '').slice(0, 10) || 'you';
  const botNames = ['otto', 'rookie', 'ace'];
  if (botNames.some((b) => humanName.startsWith(b))) humanName = `me-${humanName}`.slice(0, 10);
  g = createMatch({
    seed: +settings.seed | 0, arena: settings.arena, mode: settings.mode, bots: +settings.bots,
    difficulty: settings.difficulty, human: humanName, enter: settings.enter, rejoinDelay: 20,
  });
  colorIndex.clear();
  colorIndex.set(humanName, 0);
  vs = createViewState();
  clock = createClock(SPEEDS[settings.speed] || 10);
  classicState = {};
  deathInfo = null;
  lastMe = null;
  hud.feed = [];
  hud.pings = [];
  hud.buildWeapons(settings.scheme, input.modern);
  $('help-keys').innerHTML = hud.helpKeys(settings.scheme, input.modern);
  applyView();
  syncFrame([], true);
  running = true;
  paused = false;
  input.enabled = true;
  document.body.classList.remove('in-menu');
  for (const id of ['setup', 'pause', 'respawn']) $(id).classList.remove('on');
  buildOverride();
  noteMatchStarted();
  const warp = +(params.get('warp') || 0);
  if (warp) warpSteps(warp);
}

function warpSteps(n) {
  for (let i = 0; i < n; i++) {
    const me = H.findPlayer(g, humanName);
    if (me && params.get('fuzz') === '1' && me.q.length < 1) {
      const keys = 'hjklhjklHJKLff';
      H.key(g, me, keys[(g.step * 7 + 3) % keys.length]);
    }
    tick(g);
  }
  syncFrame([], true);
}

function oneStep() {
  const me0 = H.findPlayer(g, humanName);
  input.stepRepeat(me0 ? me0.q.length : 1);
  const events = tick(g);
  syncFrame(events, false);
}

function syncFrame(events, instant) {
  const me = H.findPlayer(g, humanName);
  const monitor = !me; // while down, watch the whole arena, like hunt -m
  const seeAll = g.cheats.seeAll || monitor;
  updateView(g, me, vs, { all: seeAll });
  if (me) lastMe = { ...me };
  if (renderer) {
    renderer.onStep(g, events, me, vs, {
      stepDur: stepSeconds(clock), seeAll, revealMines: g.cheats.revealMines, colorOf, instant,
    });
  }
  hud.onEvents(g, me, events, colorOf);
  noteEvents(g, me, events, humanName);
  hud.update(g, me, { colorOf, cheated: g.cheated, humanName, lastMe });
  // the human's death / re-entry
  const died = events.find((e) => e.t === 'death' && e.name === humanName);
  if (died) {
    deathInfo = { text: died.text, at: g.step };
    classicState.death = died.text;
    showRespawn();
  }
  if (me && deathInfo) {
    deathInfo = null;
    classicState.death = null;
    $('respawn').classList.remove('on');
  }
  if (deathInfo) updateRespawn();
  for (const e of events) if (e.t === 'msg' && me && e.to === me.id) classicState.message = e.text;
  if (settings.view !== 'modern') renderClassic($('term'), g, me, classicState);
  $('b-override').classList.toggle('on', overrideActive(g));
  for (const cb of document.querySelectorAll('#over-body input[data-flag]')) cb.checked = !!g.cheats[cb.dataset.flag];
  $('b-slow').classList.toggle('on', !!g.cheats.slowMotion);
  if (coachOn) updateCoachPanel(me);
  for (const e of events) {
    if (e.t === 'fire' && me && e.id === me.id) {
      lastWeapon = { [K.SHOT]: 'f', [K.GRENADE]: 'g', [K.SATCHEL]: 'F', [K.SLIME]: 'o' }[e.type] || (e.charge >= 49 ? 'G' : 'f');
    }
  }
}

function showRespawn() {
  $('r-cause').textContent = deathInfo.text;
  $('respawn').classList.add('on');
  const cur = settings.enter;
  for (const b of $('respawn').querySelectorAll('button')) b.classList.toggle('on', b.dataset.enter === cur);
  updateRespawn();
}

function updateRespawn() {
  const j = g.joinq.find((q) => q.name === humanName);
  const left = j ? Math.max(0, j.at - g.step) : 0;
  $('r-cd').textContent = j ? `Re-entering in ${(left * stepSeconds(clock)).toFixed(1)} s — choose how:` : 'Re-entering…';
}

function chooseEnter(v) {
  settings.enter = v;
  save();
  const st = { c: K.Q_CLOAK, s: K.Q_SCAN, f: K.Q_FLY }[v];
  const j = g && g.joinq.find((q) => q.name === humanName);
  if (j) j.status = st;
  for (const b of $('respawn').querySelectorAll('button')) b.classList.toggle('on', b.dataset.enter === v);
}

// ------------------------------------------------------------- coach
function coachPlan() {
  if (!coachOn || !g) return null;
  const me = H.findPlayer(g, humanName);
  if (!me || me.flying >= 0) return null;
  const live = liveTerrain(g);
  // the coach knows the walls; it does not reveal players you cannot see
  const terrain = (y, x) => {
    const c = live(y, x);
    if (K.isPlayer(c) && !(x === me.x && y === me.y) && !g.cheats.seeAll && !vs.lit[y * W + x]) return K.SPACE;
    return c;
  };
  const tr = trajectory(terrain, me.x, me.y, me.face, { maxCells: 220, maxBounces: 16 });
  const extra = K.FACES.filter((f) => f !== me.face).map((f) => trajectory(terrain, me.x, me.y, f, { maxCells: 120, maxBounces: 8 }));
  return { x: me.x, y: me.y, tr, extra, size: SIZE_OF[lastWeapon] || 1, face: me.face };
}

function updateCoachPanel(me) {
  const p = coachPlan();
  if (!p || !me) { $('coach-body').innerHTML = '<div class="line">—</div>'; return; }
  const end = p.tr.end;
  const what = end.kind === 'wall' ? 'hits a wall' : end.kind === 'door' ? 'enters a door — scatters at random' : end.kind === 'player' ? (end.x === me.x && end.y === me.y ? 'COMES BACK AT YOU' : 'HITS A PLAYER') : 'out of range';
  const cells = p.tr.cells.length;
  const secs = (Math.ceil(cells / K.BULSPD) * stepSeconds(clock)).toFixed(2);
  const weapon = { f: 'shot', g: 'grenade 3×3', F: 'satchel 5×5', G: 'bomb 7×7', o: 'slime' }[lastWeapon] || 'shot';
  $('coach-body').innerHTML = [
    `<div class="line">weapon  ${weapon}</div>`,
    `<div class="line">bounces ${p.tr.bounces.length}${p.tr.bounces.length ? ` (${p.tr.bounces.map((b) => String.fromCharCode(b.mirror)).join(' ')})` : ''}</div>`,
    `<div class="line">path    ${cells} cells · ${secs} s</div>`,
    `<div class="line">ends    ${what}</div>`,
  ].join('');
}

// ------------------------------------------------------------- override
function buildOverride() {
  $('over-body').innerHTML = OVERRIDE_FLAGS.map((f) => `<label><input type="checkbox" data-flag="${f.key}" ${g && g.cheats[f.key] ? 'checked' : ''}> ${f.label}<small>${f.hint}</small></label>`).join('');
  for (const cb of $('over-body').querySelectorAll('input')) {
    cb.addEventListener('change', () => {
      setOverride(g, cb.dataset.flag, cb.checked);
      cb.blur();
      syncFrame([], false);
    });
  }
}

// ------------------------------------------------------------- views
function applyView() {
  document.body.classList.remove('view-modern', 'view-split', 'view-classic');
  if (!renderer) settings.view = 'classic';
  document.body.classList.add(`view-${settings.view}`);
  for (const seg of document.querySelectorAll('[data-opt="view"]')) mark(seg, settings.view);
  resize();
  // split: the terminal shows the whole map, so the 3D half follows you
  if (renderer) renderer.setCameraMode(settings.view === 'split' ? 'follow' : settings.camera);
}

function resize() {
  const cw = $('gl').clientWidth || innerWidth;
  const ch = $('gl').clientHeight || innerHeight;
  if (renderer) renderer.resize(cw, ch);
  const term = $('term');
  const availW = settings.view === 'split' ? innerWidth * 0.47 : innerWidth * 0.94;
  const availH = innerHeight * 0.86;
  const fs = Math.max(7, Math.min(availW / (80 * 0.61), availH / (24 * 1.18)));
  term.style.fontSize = `${fs.toFixed(2)}px`;
}
addEventListener('resize', resize);

// ------------------------------------------------------------- menus
function mark(seg, v) { for (const b of seg.querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === String(v)); }

function bindSegments() {
  for (const seg of document.querySelectorAll('.seg[data-opt]')) {
    const opt = seg.dataset.opt;
    mark(seg, settings[opt]);
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      settings[opt] = b.dataset.v;
      for (const s2 of document.querySelectorAll(`.seg[data-opt="${opt}"]`)) mark(s2, settings[opt]);
      const note = document.querySelector(`[data-note="${opt}"]`);
      if (note && NOTES[opt]) note.textContent = NOTES[opt][settings[opt]] || '';
      if (opt === 'view' && running) applyView();
      if (opt === 'camera' && renderer) renderer.setCameraMode(settings.camera);
      if (opt === 'quality' && renderer) renderer.setQuality(profileFor(settings.quality));
      save();
    });
    const note = document.querySelector(`[data-note="${opt}"]`);
    if (note && NOTES[opt]) note.textContent = NOTES[opt][settings[opt]] || '';
  }
  $('o-name').value = settings.name;
  $('o-name').addEventListener('input', () => { settings.name = $('o-name').value; });
  $('o-seed').value = settings.seed;
  $('o-seed').addEventListener('input', () => { settings.seed = +$('o-seed').value | 0; });
  $('o-rand').addEventListener('click', () => { settings.seed = Math.floor(Math.random() * 99999); $('o-seed').value = settings.seed; });
  $('o-start').addEventListener('click', () => startMatch());
  $('o-help').addEventListener('click', () => { $('help-keys').innerHTML = hud.helpKeys(settings.scheme, input.modern); $('help').classList.add('on'); });
  $('h-close').addEventListener('click', () => $('help').classList.remove('on'));
  $('p-resume').addEventListener('click', () => setPaused(false));
  $('p-restart').addEventListener('click', () => { reportMatchEnded(g, humanName); startMatch(); });
  $('p-new').addEventListener('click', () => { reportMatchEnded(g, humanName); running = false; input.enabled = false; $('pause').classList.remove('on'); $('setup').classList.add('on'); document.body.classList.add('in-menu'); });
  $('p-help').addEventListener('click', () => $('help').classList.add('on'));
  $('p-keys').addEventListener('click', () => openKeys());
  $('o-keys').addEventListener('click', () => openKeys());
  $('k-close').addEventListener('click', () => { $('keys').classList.remove('on'); input.capture = null; });
  $('k-reset').addEventListener('click', () => { input.resetBindings(); openKeys(); });
  for (const b of $('respawn').querySelectorAll('button')) b.addEventListener('click', () => chooseEnter(b.dataset.enter));
  $('sound').addEventListener('click', async () => {
    const on = await audio.toggle();
    $('sound').textContent = on ? 'SOUND: ON' : 'SOUND: OFF';
    $('sound').setAttribute('aria-pressed', String(on));
  });
}

// Controls panel: click a Modern binding, press the new key.
function openKeys() {
  const label = (code) => (code ? code.replace('Key', '').replace('Digit', '').replace('Arrow', '') : '—');
  const actions = Object.keys(ACTION_LABEL);
  const rows = actions.map((a) => {
    const code = Object.keys(input.modern).find((c) => input.modern[c] === a);
    return `<span>${ACTION_LABEL[a]}</span><button data-act="${a}">${label(code)}</button>`;
  });
  $('keys-list').innerHTML = rows.join('');
  for (const b of $('keys-list').querySelectorAll('button')) {
    b.addEventListener('click', () => {
      for (const o of $('keys-list').querySelectorAll('button')) o.classList.remove('wait');
      b.classList.add('wait');
      b.textContent = 'press…';
      input.capture = (code) => {
        input.capture = null;
        if (code !== 'Escape') input.rebind(code, b.dataset.act);
        openKeys();
        hud.buildWeapons(settings.scheme, input.modern);
      };
    });
  }
  $('keys').classList.add('on');
}

function setPaused(p) {
  paused = p;
  clock.paused = p;
  $('pause').classList.toggle('on', p);
  input.enabled = !p && running;
}

function onUi(action) {
  if (!running) {
    if (action === 'help') $('help').classList.toggle('on');
    if (action === 'pause') {
      if ($('help').classList.contains('on')) $('help').classList.remove('on');
      else if (!$('keys').classList.contains('on')) leaveFromSetup();
    }
    return;
  }
  switch (action) {
    case 'pause':
      if ($('help').classList.contains('on')) { $('help').classList.remove('on'); return; }
      setPaused(!paused);
      break;
    case 'help': $('help').classList.toggle('on'); break;
    case 'coach':
      coachOn = !coachOn;
      $('coachp').classList.toggle('on', coachOn);
      $('b-coach').classList.toggle('on', coachOn);
      if (coachOn) updateCoachPanel(H.findPlayer(g, humanName));
      break;
    case 'override': $('overp').classList.toggle('on'); break;
    case 'scores': $('scores').style.display = $('scores').style.display === 'none' ? '' : 'none'; break;
    case 'view': {
      const order = renderer ? ['modern', 'split', 'classic'] : ['classic'];
      settings.view = order[(order.indexOf(settings.view) + 1) % order.length];
      applyView();
      syncFrame([], false);
      break;
    }
    case 'camera':
      settings.camera = settings.camera === 'follow' ? 'overview' : 'follow';
      for (const seg of document.querySelectorAll('[data-opt="camera"]')) mark(seg, settings.camera);
      if (renderer) renderer.setCameraMode(settings.camera);
      break;
    default: break;
  }
}

const input = new Input({
  canvas: $('gl'),
  onUi,
  onKey: (ch) => {
    if (!g) return false;
    const me = H.findPlayer(g, humanName);
    if (!me) {
      // while down: C / S / F pick how to re-enter
      return false;
    }
    if (me.q.length >= QUEUE_MAX) { sfx('bell', me.x, me.y); return false; }
    H.key(g, me, ch);
    return true;
  },
  getMe: () => (g ? H.findPlayer(g, humanName) : null),
  getScreenPos: (x, y) => (renderer ? renderer.project(x, y) : null),
  getScheme: () => settings.scheme,
});
addEventListener('keydown', (e) => {
  if (!deathInfo || !running) return;
  const v = { c: 'c', s: 's', f: 'f' }[e.key.toLowerCase()];
  if (v) chooseEnter(v);
});

// ------------------------------------------------------------- loop
let last = performance.now();
let fpsAcc = 0;
let fpsN = 0;
let lowFor = 0;
const manual = params.get('manual') === '1';

function frame(dt) {
  if (running && g && !paused && !manual) {
    clock.slow = g.cheats.slowMotion ? 0.25 : 1;
    const n = advance(clock, dt);
    for (let i = 0; i < n; i++) oneStep();
  }
  if (renderer && g && settings.view !== 'classic') {
    renderer.frame(dt, { coachPlan: coachPlan() });
    if (posterWanted()) offerPoster($('gl'));
  }
  if (g) {
    const me = H.findPlayer(g, humanName);
    hud.drawRadar(me || lastMe, (me || lastMe)?.face);
  }
  // fps + automatic quality downgrade (High -> Low if the GPU cannot keep up)
  fpsAcc += dt;
  fpsN++;
  if (fpsAcc > 1) {
    const fps = fpsN / fpsAcc;
    window.__fps = fps;
    if (params.get('fps') === '1') $('fps').textContent = `${fps.toFixed(0)} fps · ${renderer?.profile ?? 'terminal'}`;
    if (renderer && renderer.profile !== 'lite' && settings.quality === 'auto' && running && fps < 38) {
      lowFor++;
      if (lowFor >= 3) { renderer.setQuality(renderer.profile === 'high' ? 'low' : 'lite'); lowFor = 0; }
    } else lowFor = 0;
    fpsAcc = 0;
    fpsN = 0;
  }
}

function raf(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  frame(dt);
  requestAnimationFrame(raf);
}

// ------------------------------------------------------------- boot
(async () => {
  renderer = await makeRenderer();
  bindSegments();
  if (!renderer) {
    for (const seg of document.querySelectorAll('[data-opt="view"]')) for (const b of seg.querySelectorAll('button')) b.disabled = b.dataset.v !== 'classic';
  }
  if (renderer) renderer.setCameraMode(settings.camera);
  resize();
  if (params.get('autostart') === '1') startMatch();
  if (params.get('coach') === '1') onUi('coach');
  if (params.get('override') === '1') $('overp').classList.add('on');
  for (const f of (params.get('flags') || '').split(',')) if (g && OVERRIDE_FLAGS.some((o) => o.key === f)) setOverride(g, f, true);
  if (!manual) requestAnimationFrame(raf);
  window.__hunt = {
    get g() { return g; },
    get renderer() { return renderer; },
    get settings() { return settings; },
    me: () => (g ? H.findPlayer(g, humanName) : null),
    key: (s) => { const me = g && H.findPlayer(g, humanName); if (me) H.key(g, me, s); },
    step: (n = 1) => { for (let i = 0; i < n; i++) oneStep(); },
    warp: (n) => warpSteps(n),
    frame: (ms = 16.7) => frame(ms / 1000),
    frames: (count, ms = 16.7) => { for (let i = 0; i < count; i++) frame(ms / 1000); },
    override: (k, v = true) => { setOverride(g, k, v); syncFrame([], false); },
    view: (v) => { settings.view = v; applyView(); syncFrame([], false); },
    camera: (c) => { settings.camera = c; renderer?.setCameraMode(c); },
    coach: () => onUi('coach'),
    plan: () => coachPlan(),
    focus: (x, y, dist = 14) => renderer?.setFocus(x == null ? null : { x, y, dist }),
    start: (o = {}) => { Object.assign(settings, o); startMatch(); },
    // play the human with a bot brain (attract mode, scripted screenshots)
    autopilot: (kind = 'sharp', seed = 99) => { if (g) { addBot(g, humanName, kind, seed); } },
    place: (x, y, face) => {
      const me = H.findPlayer(g, humanName);
      g.maze[me.y * W + me.x] = me.over;
      me.over = g.maze[y * W + x];
      me.x = x; me.y = y; me.face = face;
      g.maze[y * W + x] = me.face;
      syncFrame([], true);
    },
    gpu,
  };
  window.__ready = true;
})();
