// Broadside — Wooden Walls: the game controller.
//
// Owns the engine state and this turn's orders; hands the engine's events
// to the Fleet cinematic; drives the camera director, HUD, labels, input and
// audio. The engine (src/engine) never sees any of this. For /usr/games
// Reborn it also hosts the game menu (src/career/): the Sea Service, the
// Daily Engagement, the historical actions and the service record, with a
// battle report at the end. The first lieutenant's counsel, a full set of
// orders for each turn, is a testing aid kept out of sight: Ctrl+Alt+C, or
// ?counsel=1 in the address, shows it.

import * as THREE from 'three';
import * as E from './engine/index.js';
import { suggestHelm } from './engine/hints.js';
import { createWorld, CELL } from './render/world.js';
import { createFx } from './render/fx.js';
import { Fleet } from './render/fleet.js';
import { Director } from './render/camera.js';
import { createTactical, NATION_COLOR } from './render/tactical.js';
import { createRain } from './render/weather.js';
import { createAudio } from './audio/audio.js';
import * as HUD from './ui/hud.js';
import * as Menu from './ui/menu.js';
import {
  followHall, hallPaused, hostedInHall, leaveForHall, noteBattleStarted, noteTurn, offerPoster, posterWanted,
  reportBattle,
} from './hall.js';
import { createDeck } from './career/deck.js';
import { counsel } from './career/counsel.js';
import { createLog, noteTurn as logTurn } from './career/logbook.js';
import { settleBattle } from './career/progress.js';
import { planAction, planDaily, planFree, actionOfPlan } from './career/plans.js';
import { actionAfter, actionById } from './career/service.js';
import { localDateKey } from './career/daily.js';
import { counselHtml, reportButtons, reportHtml, reportShareLine, stripHtml } from './career/report.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.get('reduced') === '1';
const quality = params.get('quality') || store.get('broadside.quality', 'high');
const MOOD = Object.fromEntries(E.PLAYABLE.map((f) => [f.id, f.mood]));
const VERSION = 'Broadside — Wooden Walls 1.0 (after BSD sail 1.x, Dave Riggle / Ed Wang / Craig Leres)';

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
const canvas = $('scene');
let world;
try {
  world = createWorld(canvas, { quality });
} catch (err) {
  document.body.innerHTML = `<p style="color:#eee;padding:24px;font-family:Georgia,serif">This page needs WebGL 2. (${err.message})</p>`;
  throw err;
}
const fx = createFx(world.scene, { quality, reducedMotion: reduced });
const audio = createAudio();
const fleet = new Fleet(world, fx, audio);
const director = new Director(1);
director.reduced = reduced;
const tactical = createTactical(world.scene);
const rain = createRain(world.scene, { quality });
audio.setCamera(director.persp);

let st = null; // engine state (authoritative)
let cfg = null; // { scenarioId, playerShip, captain, initialLoad, seed, plan }
let log = null; // the player's logbook for this battle (career/logbook.js)
let report = null; // { buttons, share, shownAt } while the battle report is up
let orders = {};
let me = -1;
let hint = null;
let view = 'orbit'; // orbit | tactical
let pendingEnd = false;
let history = [];
let histIdx = -1;
let turnEvents = [];
const labels = [];

function resize() {
  const { w, h } = world.resize();
  director.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------
// Battle lifecycle
// ---------------------------------------------------------------------------
// Demo/photo parameter: ?stage=<ship>:<key>=<v>,...;<ship>:... edits the
// initial state (e.g. stage=1:hull=4,rig1=0,rig2=1,explode=1,struck=1) so
// damage states can be shown and screenshotted without playing to them.
function applyStage(s) {
  const spec = params.get('stage');
  if (!spec) return;
  for (const part of spec.split(';')) {
    const [idx, kv] = part.split(':');
    if (idx === 'w' && kv) {
      // w:speed=7,dir=2 — weather
      for (const pair of kv.split(',')) {
        const [k, v] = pair.split('=');
        if (k === 'speed') s.windspeed = +v;
        if (k === 'dir') s.winddir = +v;
        if (k === 'change') s.windchange = +v;
        if (k === 'turn') s.turn = +v;
      }
      continue;
    }
    const sp = s.ships[+idx];
    if (!sp || !kv) continue;
    for (const pair of kv.split(',')) {
      const [k, v] = pair.split('=');
      if (k in sp.specs) sp.specs[k] = +v;
      else if (k in sp) sp[k] = +v;
    }
  }
}

const dayParam = /^\d{4}-\d{2}-\d{2}$/.test(params.get('day') ?? '') ? params.get('day') : null;
const today = () => dayParam ?? localDateKey();
const storedCaptain = () => store.get('broadside.captain', 'Hornblower');

/** Battles from the game menu: a plan fought with the stored captain's name and round shot. */
function launch(plan, extra = {}) {
  const c = {
    scenarioId: plan.scenarioId,
    playerShip: plan.ship,
    captain: extra.captain ?? storedCaptain(),
    initialLoad: extra.initialLoad ?? { L: 'round', R: 'round' },
    plan,
  };
  if (plan.seed !== undefined) c.seed = plan.seed;
  Menu.close('menu');
  Menu.close('end');
  startBattle(c);
}

function startBattle(c, saved = null, savedLog = null) {
  cfg = { seed: (Math.random() * 2 ** 31) >>> 0, ...c };
  cfg.plan ??= planFree(cfg.scenarioId, cfg.playerShip ?? 0, cfg.seed);
  st = saved || E.createGame(cfg);
  if (!saved) applyStage(st);
  noteBattleStarted();
  document.body.classList.remove('nobattle');
  me = st.players[0] ?? -1;
  log = savedLog ?? (me >= 0 ? createLog(st, me) : null);
  report = null;
  orders = {};
  pendingEnd = false;
  fx.clear();
  world.atmo.setMood(MOOD[st.scenarioId] || 'golden');
  world.setWind(st.windspeed, st.winddir, true);
  fleet.load(st);
  buildLabels();
  const v = fleet.visuals[me];
  director.follow = v ? () => v.root.position : null;
  // fleets start in close line: stand further off so no neighbour is cut in half
  director.orbit.dist = st.ships.length > 4 ? 290 : 190;
  director.orbit.yaw = v ? v.root.rotation.y + 2.3 : 0.8;
  director.orbit.pitch = 0.2;
  director.tactical.center.copy(fleet.centroid());
  director.tactical.halfH = Math.max(260, fleet.extent().radius * 1.1);
  director.updateOrtho();
  $('log').innerHTML = '';
  $('meta').textContent = `· ${cfg.plan.mode === 'free' ? st.name : cfg.plan.name}`;
  HUD.logLine(`${st.name} — scenario ${st.scenarioId}.`, 'turn');
  if (v) HUD.logLine(`Captain ${st.ships[me].captain} assuming command of the ${st.ships[me].name}.`, 'me');
  newTurn();
  save();
  if (!saved && !reduced && params.get('intro') !== '0') intro();
}

function intro() {
  // a slow establishing sweep over the fleet before handing over
  const ext = fleet.extent();
  director.mode = 'cinematic';
  director.play({ ...director.establishShot(ext.center, ext.radius, 4, director.orbit.yaw + 1.2), cut: true });
  setTimeout(() => {
    director.play(director.establishShot(ext.center, ext.radius * 0.8, 3, director.orbit.yaw + 0.3));
  }, 200);
  setTimeout(() => { if (!fleet.playing) director.mode = view === 'tactical' ? 'tactical' : 'orbit'; }, 3200);
}

function newTurn() {
  orders = {};
  hint = me >= 0 && st.ships[me].dir && !st.over ? suggestHelm(st, me)?.helm ?? null : null;
  refreshHud();
}

function refreshHud() {
  if (!st) return;
  const ms = st.ships[me];
  renderStrip();
  renderCounsel();
  if (ms) {
    HUD.renderSlate(st, ms);
    const input = HUD.renderOrders(st, ms, orders, {
      hint,
      helm: onHelm,
      fire: (s, a) => { const f = { ...(orders.fire || {}) }; f[s] = f[s] === a ? undefined : a; orders.fire = f; refreshHud(); },
      load: (s, w) => { const l = { ...(orders.load || {}) }; l[s] = l[s] === w ? undefined : w; orders.load = l; refreshHud(); },
      set: (patch) => { Object.assign(orders, patch); refreshHud(); },
      patch: (p) => { orders = E.mergeOrders(orders, p); refreshHud(); },
      commit,
    });
    wireCommandLine(input);
  }
  HUD.renderVane(st, ms);
  HUD.renderRoster(st, me, focusShip);
  const poses = ms && orders.move ? E.tracePath(ms, E.validateMove(st, ms, orders.move).movebuf) : null;
  tactical.update(st, ms, poses, fleet.centroid());
}

function onHelm(ch) {
  const cur = orders.move || '';
  if (ch === 'back') orders.move = cur.slice(0, -1) || undefined;
  else if (ch === 'd') orders.move = 'd';
  else orders.move = (cur === 'd' ? '' : cur) + ch;
  refreshHud();
  $('cmd')?.focus();
}

function wireCommandLine(input) {
  if (!input) return;
  input.onkeydown = (e) => {
    if (fleet.playing && (e.key === ' ' || e.key === 'Escape' || e.key === 'Enter')) {
      e.preventDefault();
      fleet.finish();
      return;
    }
    // "/" focuses the command line; when it already has focus, don't type it
    if ((e.key === '/' || e.key === ':') && input.value === '') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = input.value;
      input.value = '';
      if (text.trim()) {
        history.push(text);
        histIdx = history.length;
      }
      runCommand(text);
    } else if (e.key === 'Escape') {
      input.blur();
    } else if (e.key === 'ArrowUp') {
      if (histIdx > 0) input.value = history[--histIdx];
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (histIdx < history.length - 1) input.value = history[++histIdx];
      else { histIdx = history.length; input.value = ''; }
      e.preventDefault();
    }
    e.stopPropagation();
  };
  input.oninput = () => {
    // live ghost path while typing a helm string
    const t = input.value.trim();
    const ms = st.ships[me];
    if (/^[lrbd0-7]+$/.test(t) && ms) tactical.helm(E.tracePath(ms, E.validateMove(st, ms, t).movebuf), ms);
  };
}

function runCommand(text) {
  if (!st || me < 0) return;
  const r = E.parseCommand(st, me, text);
  if (r.kind === 'commit') return commit();
  if (r.kind === 'error') return HUD.logLine(r.msg, 'hit');
  if (r.kind === 'order') {
    orders = E.mergeOrders(orders, r.patch);
    HUD.logLine(r.say, 'me');
    refreshHud();
    setTimeout(() => $('cmd')?.focus(), 0);
    return;
  }
  if (r.kind === 'quit') {
    st = { ...st, over: true, result: { reason: 'quit', text: 'You have given up your command.' } };
    return endBattle();
  }
  if (r.kind === 'query') {
    if (r.what === 'help') return Menu.showHelp();
    if (r.what === 'version') return HUD.logLine(VERSION);
    const ms = st.ships[me];
    const list = r.what === 'all' ? st.ships.filter((s) => s !== ms)
      : r.ship != null ? [st.ships[r.ship]].filter(Boolean) : [E.closestenemy(st, ms, 0, 1)].filter(Boolean);
    if (!list.length) HUD.logLine('No more ships left.');
    for (const sp of list) eyeball(ms, sp);
  }
}

// "Sail ho!" — the original's eyeball() (sail/pl_4.c:121-136).
function eyeball(ms, sp) {
  if (!sp.dir) return;
  const who = sp.captain ? sp.captain : sp.struck ? '(struck)' : sp.captured >= 0 ? '(captured)' : '(computer)';
  let i = E.portside(ms, sp, 1) - ms.dir;
  if (i <= 0) i += 8;
  HUD.logLine(`Sail ho! (range ${E.range(ms, sp)}, ${who})`);
  HUD.logLine(`${sp.name} (${E.glyph(st, sp)}) ${E.COUNTRY[sp.nationality]} ${E.CLASS_NAME[sp.specs.class]} ${E.DIRECTION_NAME[i]}.`);
}

function commit() {
  if (!st || st.over || fleet.playing) return;
  audio.start();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  const before = st;
  const res = E.resolveTurn(before, me >= 0 ? { [me]: orders } : {});
  turnEvents = res.events;
  st = res.state;
  noteTurn(res.events, me);
  if (log) logTurn(log, res.events, st, me, orders);
  HUD.logLine(`— Turn ${st.turn} —`, 'turn');
  const skip = params.get('cine') === '0';
  document.body.classList.add('cinematic');
  $('cine').classList.toggle('on', !skip);
  director.mode = view === 'tactical' ? 'tactical' : 'cinematic';
  fleet.onBeat = onBeat;
  fleet.onDone = onTurnShown;
  fleet.play(res.events, st, { reduced, speed: reduced ? 1.5 : 1 });
  if (skip) fleet.finish();
  save();
}

function onTurnShown() {
  document.body.classList.remove('cinematic');
  $('cine').classList.remove('on');
  $('caption').textContent = '';
  for (const e of turnEvents) {
    if (e.t !== 'msg') continue;
    const mine = e.ship === me;
    const hit = /strik|captured|sinking|exploding|Rake|dismasted|parted|shot away|shattered/.test(e.text);
    HUD.logLine(e.text, mine ? 'me' : hit ? 'hit' : '');
  }
  $('status').textContent = `Turn ${st.turn} resolved.`;
  director.mode = view === 'tactical' ? 'tactical' : 'orbit';
  audio.setWind(st.windspeed, world.atmo.state.rain);
  if (st.over) return endBattle();
  newTurn();
  $('cmd')?.focus();
  if (fleet.onBeatHook) fleet.onBeatHook('idle');
  if (autoTurns > 0) setTimeout(autoStep, 50);
}

function endBattle() {
  if (pendingEnd) return;
  pendingEnd = true;
  autoTurns = 0;
  const plan = cfg.plan;
  const summary = me >= 0 && log ? settleBattle(plan, st, me, log) : { earned: [], newlyEarned: [], rating: null, rankBefore: '', rankAfter: '' };
  reportBattle(st, me, plan, summary);
  if (fleet.onBeatHook) fleet.onBeatHook('end');
  refreshHud();
  const r = st.result || {};
  HUD.logLine(r.text || 'The battle is over.', 'turn');
  if (r.reason === 'hurricane') {
    // the hurricane destroys all ships (sail.6): send them down in the storm
    fleet.visuals.forEach((v, i) => setTimeout(() => { v.startPlunge(); fx.founder(v.root.position); }, 600 + i * 500));
  }
  try { sessionStorage.removeItem('broadside.battle'); } catch { /* ignore */ }
  setTimeout(() => showReport(plan, summary), r.reason === 'hurricane' ? 4200 : 1400);
}

// ---------------------------------------------------------------------------
// Battle report, strip and counsel
// ---------------------------------------------------------------------------
/** After the report appears, keys wait this long, so the Enter that made the last turn so is not
 *  also taken as a choice on the report. */
const REPORT_SETTLE_MS = 700;

function showReport(plan, summary) {
  const ms = st.ships[me];
  const { board, rank } = Menu.recordInTopTen(st, ms);
  const buttons = reportButtons(plan, st, summary, hostedInHall);
  report = { buttons, share: reportShareLine(plan, st, summary), shownAt: performance.now() };
  const el = $('end');
  el.innerHTML = reportHtml({ plan, st, me: ms, summary, rank, board, buttons });
  el.onclick = (e) => {
    const b = e.target.closest('[data-report]');
    if (b) reportAction(b.dataset.report);
  };
  el.onkeydown = onReportKey;
  Menu.open('end');
  setTimeout(() => el.querySelector('.btn.primary')?.focus({ preventScroll: true }), 40);
}

function reportAction(action) {
  const plan = cfg.plan;
  switch (action) {
    case 'next':
      launch(planAction(actionAfter(actionOfPlan(plan))));
      break;
    case 'again':
      if (plan.mode === 'free') {
        Menu.close('end');
        startBattle({ ...cfg });
      } else launch(plan);
      break;
    case 'menu':
      Menu.close('end');
      showGameMenu();
      break;
    case 'hall':
      leaveForHall();
      break;
    case 'look':
      Menu.close('end');
      break;
    case 'share': {
      const shown = $('end').querySelector('.share-line span');
      navigator.clipboard?.writeText(report.share).then(
        () => { if (shown) shown.textContent = `${report.share}  · copied`; },
        () => { if (shown) shown.textContent = report.share; },
      );
      break;
    }
  }
}

function onReportKey(e) {
  if (!report || e.ctrlKey || e.metaKey || e.altKey) return;
  if (performance.now() - report.shownAt < REPORT_SETTLE_MS) {
    if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
    return;
  }
  if (e.key === 'Escape') { e.preventDefault(); reportAction('menu'); return; }
  const b = report.buttons.find((x) => x.key === e.key.toUpperCase());
  if (b) { e.preventDefault(); reportAction(b.action); }
}

function renderStrip() {
  const el = $('strip');
  if (!el) return;
  const plan = cfg?.plan;
  const show = !!plan && !!log && plan.mode !== 'free';
  el.hidden = !show;
  if (show) el.innerHTML = stripHtml(plan, st, me, log);
}

let counselShown = params.get('counsel') === '1';
function renderCounsel() {
  const el = $('counsel');
  el.hidden = !counselShown || !st || me < 0;
  if (el.hidden) return;
  const advice = counsel(st, me);
  el.innerHTML = counselHtml(advice);
  const apply = $('counselApply');
  if (apply && advice) apply.onclick = () => { orders = { ...advice.orders }; refreshHud(); };
}
function toggleCounsel() {
  counselShown = !counselShown;
  renderCounsel();
}
// The testing aid: no button and no help line mention it. Caught before the command line, which
// keeps every other key for itself.
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.altKey && e.code === 'KeyC') {
    e.preventDefault();
    e.stopPropagation();
    toggleCounsel();
  }
}, { capture: true });

// ---------------------------------------------------------------------------
// The game menu
// ---------------------------------------------------------------------------
const deck = createDeck({
  host: $('menu'),
  hosted: hostedInHall,
  dateKey: today,
  open: () => { $('menu').onkeydown = null; Menu.open('menu'); },
  onLaunch: (plan) => launch(plan),
  onHistoric: () => Menu.showScenarios((c) => startBattle(c), () => deck.show('menu')),
  onTopTen: () => Menu.showBoard(() => deck.show('menu')),
  onHelp: () => Menu.showHelp(),
  onLeave: leaveForHall,
});

function showGameMenu() {
  if (st) document.body.classList.add('nobattle');
  deck.show('menu');
}

// ---------------------------------------------------------------------------
// Cinematic beats -> camera shots + captions
// ---------------------------------------------------------------------------
let lastShot = 0;
function onBeat(b) {
  if (fleet.onBeatHook) fleet.onBeatHook(b.kind);
  const V = fleet.visuals;
  const cap = (t) => { $('caption').textContent = t; };
  if (director.mode === 'tactical') {
    if (b.kind === 'broadside' || b.kind === 'rake') cap(fireCaption(b.e));
    return;
  }
  const now = performance.now();
  switch (b.kind) {
    case 'broadside':
    case 'rake': {
      const e = b.e;
      const from = V[e.from];
      const to = V[e.to];
      cap(fireCaption(e));
      if (reduced && now - lastShot < 4000) break;
      lastShot = now;
      director.play(b.kind === 'rake' ? director.rakeShot(from, to, b.dur) : director.broadsideShot(from, to, e.side, b.dur));
      director.addShake(e.load === 4 ? 0.9 : 0.5);
      break;
    }
    case 'move': {
      const mv = V[me] && !V[me].v.hidden ? V[me] : null;
      const ext = fleet.extent();
      director.play(mv && st.ships.length <= 4 ? director.followShot(mv, b.dur) : director.establishShot(ext.center, ext.radius, b.dur, director.orbit.yaw));
      cap(b.ships.includes(me) ? 'Helm answers. The fleet manoeuvres.' : 'The ships manoeuvre.');
      break;
    }
    case 'sink':
      director.play({ ...director.impactShot(V[b.ship], 4), cut: true });
      cap(`${st.ships[b.ship].name} founders and goes down.`);
      break;
    case 'explode':
      director.play({ ...director.impactShot(V[b.ship], 3), cut: true });
      director.addShake(1.2);
      cap(`${st.ships[b.ship].name} blows up!`);
      break;
    case 'wind': {
      const e = b.e;
      cap(`The wind ${e.speed > e.prevSpeed ? 'rises' : e.speed < e.prevSpeed ? 'eases' : 'shifts'}: ${E.WIND_NAME[e.speed]}, toward ${E.COMPASS[e.dir]}.`);
      if (e.speed === 7) cap('The glass falls like a stone — HURRICANE!');
      break;
    }
    case 'grapple':
      cap(b.e.t === 'board' ? 'Boarders away!' : b.e.t === 'grapple' ? (b.e.ok ? 'Grapnels bite!' : 'The grapnels fall short.') : 'Cutting free…');
      break;
    case 'melee':
      director.play(director.impactShot(V[b.e.a], 1.6));
      cap(`Hand-to-hand on the ${st.ships[b.e.a].name}'s decks: ${b.e.killedA} and ${b.e.killedB} fall.`);
      break;
    case 'capture':
      cap(`${st.ships[b.e.ship].name} is taken by the ${st.ships[b.e.by].name}!`);
      break;
    case 'overthrown':
      cap(`The prize crew of the ${st.ships[b.e.ship].name} is overthrown!`);
      break;
    default:
      break;
  }
}

function fireCaption(e) {
  const from = st.ships[e.from].name;
  const to = st.ships[e.to].name;
  const shot = E.LOAD_WORD[e.load];
  if (e.sternrake) return `Stern rake! ${to} splintering!`;
  if (e.rake) return `${from} rakes the ${to}!`;
  if (e.miss) return `${from}'s ${shot} shot falls short.`;
  const msgs = e.damage && e.damage.msgs.length ? ` — ${e.damage.msgs[0]}` : '';
  return `${from} fires ${shot} into the ${to}${msgs}`;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------
function buildLabels() {
  const root = $('labels');
  root.innerHTML = '';
  labels.length = 0;
  for (const v of fleet.visuals) {
    const el = document.createElement('div');
    el.className = 'shiplabel';
    el.onclick = () => focusShip(v.index);
    root.appendChild(el);
    labels.push(el);
  }
}

const proj = new THREE.Vector3();
function updateLabels(camera) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const tacticalMode = director.mode === 'tactical';
  const hideAll = document.body.classList.contains('cinematic') && !tacticalMode;
  fleet.visuals.forEach((v, i) => {
    const el = labels[i];
    const sp = fleet.display?.ships[i];
    if (!el || !sp || v.v.hidden || hideAll) {
      if (el) el.style.display = 'none';
      return;
    }
    proj.copy(v.root.position).setY(tacticalMode ? 0 : v.rig.masts[0].H * 1.05 + v.dim.F);
    proj.project(camera);
    if (proj.z > 1 || proj.z < -1) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.style.left = `${((proj.x + 1) / 2) * w}px`;
    el.style.top = `${((1 - proj.y) / 2) * h - (tacticalMode ? 14 : 0)}px`;
    const nat = E.capship(fleet.display, sp).nationality;
    const g = E.glyph(fleet.display, sp);
    const zoomedIn = tacticalMode && director.tactical.halfH < 360;
    const name = zoomedIn || i === me ? ` ${sp.name}${i === me ? ' (you)' : ''}` : '';
    const html = `<span class="g" style="background:${NATION_COLOR[nat]}">${g}</span>${name}`;
    if (el.innerHTML !== html) el.innerHTML = html;
  });
}

function focusShip(i) {
  const v = fleet.visuals[i];
  if (!v) return;
  director.follow = () => v.root.position;
  if (director.mode === 'tactical') director.tactical.center.copy(v.root.position);
  if (st && i !== me && st.ships[me]) eyeball(st.ships[me], st.ships[i]);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
function setView(v) {
  view = v;
  $('btnView').setAttribute('aria-pressed', v === 'tactical');
  if (!fleet.playing) director.mode = v === 'tactical' ? 'tactical' : 'orbit';
  if (v === 'tactical') director.tactical.center.copy(fleet.centroid());
  refreshHud();
}
$('btnView').onclick = () => setView(view === 'tactical' ? 'orbit' : 'tactical');
$('btnQuality').textContent = quality === 'high' ? 'High' : 'Low';
$('btnQuality').onclick = () => {
  store.set('broadside.quality', quality === 'high' ? 'low' : 'high');
  save();
  const u = new URL(location.href);
  u.searchParams.delete('quality');
  location.href = u.toString();
};
$('btnSound').onclick = () => {
  audio.start();
  audio.setMuted(!audio.muted);
  $('btnSound').setAttribute('aria-pressed', !audio.muted);
  store.set('broadside.muted', audio.muted ? '1' : '0');
};
if (store.get('broadside.muted', '0') === '1') audio.setMuted(true);
$('btnSound').setAttribute('aria-pressed', !audio.muted);
// /usr/games Reborn: inside the Hall its sound and reduced motion take over (src/hall.js).
followHall({
  audio,
  soundButton: $('btnSound'),
  setReducedMotion(on) {
    reduced = on || params.get('reduced') === '1';
    director.reduced = reduced;
    fx.reduced = reduced;
  },
});
$('btnHelp').onclick = () => Menu.showHelp();

window.addEventListener('keydown', (e) => {
  if (document.querySelector('.overlay.open')) return;
  if (fleet.playing && (e.key === ' ' || e.key === 'Escape' || e.key === 'Enter')) {
    e.preventDefault();
    fleet.finish();
    return;
  }
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
  const k = e.key;
  if (k === '/' || k === ':') { e.preventDefault(); $('cmd')?.focus(); return; }
  if (k === 'Enter' && tag !== 'button') { e.preventDefault(); commit(); return; }
  if (k === 't' || k === 'T') setView(view === 'tactical' ? 'orbit' : 'tactical');
  else if (k === 'q' || k === 'Q') $('btnQuality').click();
  else if (k === 'm' || k === 'M') $('btnSound').click();
  else if (k === '?') Menu.showHelp();
  else if (k === 'ArrowLeft') director.mode === 'tactical' ? director.panTactical(-60, 0) : director.orbitBy(-0.12, 0, 1);
  else if (k === 'ArrowRight') director.mode === 'tactical' ? director.panTactical(60, 0) : director.orbitBy(0.12, 0, 1);
  else if (k === 'ArrowUp') director.mode === 'tactical' ? director.panTactical(0, -60) : director.orbitBy(0, 0.06, 1);
  else if (k === 'ArrowDown') director.mode === 'tactical' ? director.panTactical(0, 60) : director.orbitBy(0, -0.06, 1);
  else if (k === '+' || k === '=') director.mode === 'tactical' ? director.panTactical(0, 0, 0.85) : director.orbitBy(0, 0, 0.85);
  else if (k === '-' || k === '_') director.mode === 'tactical' ? director.panTactical(0, 0, 1.18) : director.orbitBy(0, 0, 1.18);
  else if (k === '0' && me >= 0) focusShip(me);
  else if (/^[1-9]$/.test(k)) focusShip(+k - 1 >= me ? +k : +k - 1);
  else return;
  e.preventDefault();
});

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, moved: 0 };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  drag.x = e.clientX;
  drag.y = e.clientY;
  if (director.mode === 'tactical') {
    const s = (director.tactical.halfH * 2) / canvas.clientHeight;
    director.panTactical(-dx * s, -dy * s);
  } else director.orbitBy(-dx * 0.005, dy * 0.004, 1);
});
canvas.addEventListener('pointerup', (e) => {
  if (drag && drag.moved < 5) pick(e);
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const z = Math.exp(e.deltaY * 0.0012);
  if (director.mode === 'tactical') director.panTactical(0, 0, z);
  else director.orbitBy(0, 0, z);
}, { passive: false });

const ray = new THREE.Raycaster();
function pick(e) {
  const r = canvas.getBoundingClientRect();
  const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(p, director.camera);
  const hits = ray.intersectObjects(fleet.visuals.map((v) => v.root), true);
  const hit = hits.find((h) => h.object.userData.shipIndex !== undefined);
  if (hit) focusShip(hit.object.userData.shipIndex);
}

// ---------------------------------------------------------------------------
// Persistence (survives reloads and the quality toggle)
// ---------------------------------------------------------------------------
function save() {
  if (!st || st.over) return;
  try { sessionStorage.setItem('broadside.battle', JSON.stringify({ cfg, st, log })); } catch { /* ignore */ }
}
function restore() {
  try {
    const s = JSON.parse(sessionStorage.getItem('broadside.battle') || 'null');
    if (s && s.st && !s.st.over) return s;
  } catch { /* ignore */ }
  return null;
}

// ---------------------------------------------------------------------------
// Auto-play (for demos, screenshots and smoke tests): ?auto=N plays N turns
// with the sailing master's helm and both broadsides every turn, or with the
// first lieutenant's counsel (&autoorders=counsel).
// ---------------------------------------------------------------------------
let autoTurns = +(params.get('auto') || 0);
function autoStep() {
  if (!st || st.over || autoTurns <= 0) return;
  autoTurns--;
  const ms = st.ships[me];
  if (ms && params.get('autoorders') === 'counsel') {
    orders = { ...(counsel(st, me)?.orders ?? {}) };
  } else if (ms && params.get('autoorders') !== 'none') {
    orders = { fire: { L: 'hull', R: 'hull' }, load: { L: 'round', R: 'round' }, move: hint || 'd' };
    if (params.get('autosails') === 'full') orders.sails = 'full';
  } else orders = {};
  if (autoTurns === 0 && params.get('last') === 'show') {
    // play the final turn's cinematic normally (for screenshots)
    const p = params.get('cine');
    params.set('cine', '1');
    commit();
    if (p !== null) params.set('cine', p);
  } else commit();
}

// ---------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------
let last = performance.now();
let fpsAcc = 0;
let fpsN = 0;
const ambient = new THREE.Color();
const focusPt = new THREE.Vector3();
const camFwd = new THREE.Vector3();
let menuYaw = 0;

function frame(now) {
  if (hallPaused()) { last = now; requestAnimationFrame(frame); return; } // held still by the Hall
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const cam = director.camera;
  if (!st) {
    // title backdrop: a slow orbit over an empty sea
    menuYaw += dt * 0.03;
    director.mode = 'orbit';
    director.follow = null;
    director.orbit.target.set(0, 0, 0);
    director.orbit.yaw = menuYaw;
    director.orbit.pitch = 0.06;
    director.orbit.dist = 160;
  }
  focusPt.copy(director.mode === 'tactical' ? director.tactical.center : director.orbit.target);
  world.update(dt, cam, focusPt);
  const a = world.atmo;
  // canvas glows when the camera looks toward a low sun through it
  camFwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
  const backlit = Math.max(0, camFwd.dot(a.u.uSunDir.value)) ** 2 * a.u.uSunVis.value * (1 - Math.min(1, a.u.uSunDir.value.y * 1.5));
  fleet.update(dt, world.time, a.state.windVec, a.state.wind, a.u.uFlash.value * 0.4 + backlit * 0.55);
  ambient.copy(a.u.uHorizon.value).lerp(a.u.uZenith.value, 0.5).multiplyScalar(0.9);
  fx.update(dt, cam, a.state.windVec, a.state.wind, a.u.uSunDir.value, a.u.uSunColor.value, ambient, world.time);
  rain.update(dt, cam, a.state.windVec, a.state.wind, a.state.rain);
  if (a.state.bolt) audio.thunder();
  audio.tick(dt);
  director.update(dt);
  tactical.setVisible(!!st && (director.mode === 'tactical' || (!fleet.playing && !!orders.move)), director.mode === 'tactical');
  if (st && director.mode === 'tactical') tactical.pieces(fleet.visuals, fleet.display);
  document.body.classList.toggle('chart', director.mode === 'tactical');
  updateLabels(director.camera);
  world.render(director.camera, { vignette: director.mode === 'tactical' ? 0.25 : 0.55 });
  if (posterWanted()) offerPoster(canvas);
  fpsAcc += dt;
  fpsN++;
  if (fpsAcc > 1) {
    $('fps').textContent = `${Math.round(fpsN / fpsAcc)} fps · ${quality}`;
    window.__info = { fps: Math.round(fpsN / fpsAcc), particles: fx.count, turn: st?.turn };
    fpsAcc = 0;
    fpsN = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------------------
// Boot: resume, URL-configured battle, or the title menu
// ---------------------------------------------------------------------------
if (params.get('hud') === '0') document.body.classList.add('photo'); // photo mode
const resumed = restore();
if (params.get('scenario')) {
  const sc = +params.get('scenario');
  Menu.close('menu');
  startBattle({
    scenarioId: sc,
    playerShip: +(params.get('ship') ?? 0),
    captain: params.get('captain') || 'Hornblower',
    initialLoad: { L: params.get('initL') || 'round', R: params.get('initR') || 'round' },
    seed: +(params.get('seed') || 1),
  });
  if (params.get('view') === 'tactical') setView('tactical');
  // photo framing: &focus=<ship>&yaw=<deg>&pitch=<deg>&dist=<m>
  if (params.get('focus')) {
    const v = fleet.visuals[+params.get('focus')];
    if (v) director.follow = () => v.root.position;
  }
  if (params.get('yaw')) director.orbit.yaw = THREE.MathUtils.degToRad(+params.get('yaw'));
  if (params.get('pitch')) director.orbit.pitch = THREE.MathUtils.degToRad(+params.get('pitch'));
  if (params.get('dist')) director.orbit.dist = +params.get('dist');
  if (autoTurns > 0) setTimeout(autoStep, 300);
} else if (params.get('mission')) {
  // captures and tests: ?mission=daily or ?mission=<action id> (with &day=YYYY-MM-DD)
  const wanted = params.get('mission');
  const action = actionById(wanted);
  if (wanted === 'daily') launch(planDaily(today()));
  else if (action) launch(planAction(action));
  else showGameMenu();
  if (autoTurns > 0) setTimeout(autoStep, 300);
} else if (resumed) {
  Menu.close('menu');
  startBattle(resumed.cfg, resumed.st, resumed.log ?? null);
} else {
  showGameMenu();
}
window.addEventListener('pointerdown', () => audio.start(), { once: true });
window.addEventListener('keydown', () => audio.start(), { once: true });
window.__game = {
  get st() { return st; }, get plan() { return cfg?.plan ?? null; }, get log() { return log; },
  get menuPage() { return deck.page; },
  fleet, director, world, fx, commit, runCommand, setView,
};
// Screenshot hook: ?readyAt=fire|move|sink|explode|idle[&readyDelay=ms]
// holds window.__ready until that beat of the last auto-played turn.
window.__ready = !params.get('readyAt');
function readyHook(kind) {
  const want = params.get('readyAt');
  if (!want || window.__ready || autoTurns > 0) return;
  // 'idle' / 'end' are fallbacks so a screenshot never waits forever
  const match = want === kind || (want === 'fire' && (kind === 'broadside' || kind === 'rake')) || kind === 'idle' || kind === 'end';
  if (match) setTimeout(() => { window.__ready = true; }, +(params.get('readyDelay') || 800));
}
const prevBeat = onBeat;
fleet.onBeatHook = readyHook;
void prevBeat;
