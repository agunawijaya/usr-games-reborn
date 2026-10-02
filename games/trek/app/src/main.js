// trek/procedural-web — DOM, input, HUD and orchestration.
//
// The HUD code follows trek/fancy-web's main.js line for line where it can
// (same panels, same text, same keys) so the two ports compare fairly;
// what changes is the renderer behind it (src/render/) and the additions:
// the Captain's Override, sound, quality, the no-WebGL fallback and, for
// /usr/games Reborn, Deep Space Command (src/career/): the game menu with
// the Frontier Tour, the Daily Patrol, free missions and the service record.
//
// The bridge computer's hints (the cheat panel) are a testing aid kept out
// of sight: Ctrl+Alt+C, or cheat=1 in the address, shows them.
//
// URL parameters (all optional):
//   seed=N difficulty=novice|standard|expert autostart=1
//   mission=daily|<sortie id>  day=YYYY-MM-DD   (with autostart, for captures)
//   quality=high|low  hud=0  sound=1  cheat=1  ref=0|1  help=0  reduced=1
//   cmds=phaser 500;torpedo 3   (typed after start, for captures)
//   capture=1                   (preserve the drawing buffer for screenshots)

import {
  createGame, executeCommand, snapshot, SYSTEM_ORDER,
  OVERRIDE_FLAGS, OVERRIDE_LABELS, setOverride, clearOverrides, anyOverrideActive,
  isQuadrantVisible, overrideResupply, overrideWarpTo,
} from './engine.js';
import { parseCommand, PARSE, describeCommand } from './parser.js';
import { computeHints } from './hints.js';
import { parseOverride, describeOverride, OVERRIDE_KEY, OVERRIDE_HELP } from './override.js';
import { AudioEngine } from './audio.js';
import {
  hostedInHall, leaveForHall, noteCommand, noteMissionStarted, offerPoster, posterWanted, reportMission,
} from './hall.js';
import { webglAvailable } from './render/core.js';
import { createLog, noteOrder } from './career/orders.js';
import { settleMission } from './career/progress.js';
import { createDeck } from './career/deck.js';
import { ordersStripHtml, reportButtons, reportHtml, reportShareLine } from './career/report.js';
import { planFreeMission, planPatrol, planSortie, sortieAfter } from './career/plans.js';
import { sortieById } from './career/missions.js';
import { localDateKey } from './career/daily.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);

// DOM refs
const cmdBuffer = $('cmd-buffer');
const cmdHint = $('cmd-hint');
const eventLog = $('event-log-body');
const shipStatusHost = $('ship-status-body');
const systemsHost = $('systems-body');
const sectorInfoHost = $('sector-info-body');
const stardateEl = $('stardate');
const sectorEl = $('sector-label');
const viewButtons = document.querySelectorAll('#view-toggles button[data-view]');
const gameOverEl = $('game-over');
const gameOverInner = $('game-over-inner');
const titleScreen = $('title-screen');
const deckHost = $('deck');
const ordersStrip = $('orders-strip');
const stratOverlay = $('strategic');
const helpOverlay = $('help-overlay');
const refPanel = $('ref-panel');
const refBtn = $('ref-btn');
const cheatPanel = $('cheat-panel');
const cheatList = $('cheat-list');
const cheatEmpty = $('cheat-empty');
const overridePanel = $('override-panel');
const overrideBtn = $('override-btn');
const overrideList = $('override-list');
const overrideBadge = $('override-badge');
const cheatedTag = $('cheated-tag');
const soundBtn = $('sound-btn');
const qualityBtn = $('quality-btn');

const HELP_SEEN_KEY = 'trek-procweb-help-seen';
const REF_VISIBLE_KEY = 'trek-procweb-ref-visible';
const SOUND_KEY = 'trek-procweb-sound';
const QUALITY_KEY = 'trek-procweb-quality';

const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const seedParam = qs.get('seed');
const freeSeed = seedParam !== null && seedParam !== '' ? Number(seedParam) : undefined;
const dayParam = /^\d{4}-\d{2}-\d{2}$/.test(qs.get('day') ?? '') ? qs.get('day') : null;
const today = () => dayParam ?? localDateKey();

/** After the report appears, Enter and Space wait this long, so a last order's Enter is not taken
 *  as a choice on the report. */
const REPORT_SETTLE_MS = 700;

// State
let game = null;
let mission = null;         // the plan being flown (career/plans.js)
let log = null;             // its orders and their effects (career/orders.js)
let missionEnded = false;
let quitArmed = false;
let deck = null;
let report = null;          // { buttons, share, shownAt } while the mission report is up
let currentView = 'combat';
let cmdText = '';
const selectedDifficulty = ['novice', 'standard', 'expert'].includes(qs.get('difficulty')) ? qs.get('difficulty') : 'standard';
let view = null;            // Renderer (WebGL) or Fallback2D
let busyUntil = 0;
let endTimer = null;
let qualityPinned = !!qs.get('quality') || !!store.get(QUALITY_KEY, '');
const audio = new AudioEngine();
const reducedParam = qs.get('reduced') === '1';

// ---------------------------------------------------------------------------
// HUD rendering (same markup as fancy-web)
// ---------------------------------------------------------------------------

function pct(v, m) { return Math.max(0, Math.min(100, Math.round((v / m) * 100))); }
function fillClass(v, m) {
  const p = pct(v, m);
  if (p < 25) return 'crit';
  if (p < 50) return 'warn';
  return '';
}
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function renderHUD() {
  if (!game) return;
  const snap = snapshot(game);
  const ov = snap.overrides;
  stardateEl.textContent = `Stardate ${snap.stardate.toFixed(1)} / ${snap.stardateEnd.toFixed(1)}${ov.freezeClock ? ' ❄' : ''}`;
  sectorEl.textContent = `Sector ${snap.ship.qx + 1}-${snap.ship.qy + 1}`;

  const shieldsMax = snap.ship.shieldsMax;
  const inf = (on, cls) => on ? 'inf' : cls;
  shipStatusHost.innerHTML = `
    <div class="row"><span class="label">SHIELDS</span>
      <div class="bar"><div class="fill ${inf(ov.invulnerable, fillClass(snap.ship.shields, shieldsMax))}" style="width:${ov.invulnerable ? 100 : pct(snap.ship.shields, shieldsMax)}%"></div></div>
      <span class="val">${ov.invulnerable ? '∞' : snap.ship.shields}${snap.ship.shieldsUp ? '↑' : '↓'}</span>
    </div>
    <div class="row"><span class="label">HULL</span>
      <div class="bar"><div class="fill ${fillClass(snap.ship.hull, 100)}" style="width:${Math.max(0, snap.ship.hull)}%"></div></div>
      <span class="val">${snap.ship.hull}%</span>
    </div>
    <div class="row"><span class="label">ENERGY</span>
      <div class="bar"><div class="fill ${inf(ov.infiniteEnergy, fillClass(snap.ship.energy, 10000))}" style="width:${ov.infiniteEnergy ? 100 : pct(snap.ship.energy, 10000)}%"></div></div>
      <span class="val">${ov.infiniteEnergy ? '∞' : snap.ship.energy}</span>
    </div>
    <div class="row"><span class="label">TORPS</span>
      <div class="bar"><div class="fill ${inf(ov.infiniteTorpedoes, fillClass(snap.ship.torpedoes, 10))}" style="width:${ov.infiniteTorpedoes ? 100 : pct(snap.ship.torpedoes, 10)}%"></div></div>
      <span class="val">${ov.infiniteTorpedoes ? '∞' : `${snap.ship.torpedoes} / 10`}</span>
    </div>
  `;

  const SYS_LABELS = {
    warp: 'Warp Engines', impulse: 'Impulse', phasers: 'Phasers',
    torpedoes: 'Torpedoes', shields: 'Shields', sensors: 'Sensors',
    computer: 'Computer', lifeSupport: 'Life Support',
  };
  systemsHost.innerHTML = SYSTEM_ORDER.map(s => {
    const dmg = snap.ship.systems[s];
    const cls = dmg === 0 ? 'ok' : dmg <= 3 ? 'warn' : 'crit';
    const label = dmg === 0 ? 'OK' : dmg <= 3 ? 'WEAK' : 'DAMAGED';
    return `<div class="sys-row"><span class="name">${SYS_LABELS[s]}</span><span class="state ${cls}">${label}</span></div>`;
  }).join('');

  sectorInfoHost.innerHTML = `
    <div class="row"><span class="lbl">Klingons here</span><span class="v ${snap.quadrant.klingonCount > 0 ? 'danger' : ''}">${snap.quadrant.klingonCount}</span></div>
    <div class="row"><span class="lbl">Starbases here</span><span class="v">${snap.quadrant.starbaseCount}</span></div>
    <div class="row"><span class="lbl">Stars here</span><span class="v">${snap.quadrant.contents.stars.length}</span></div>
    <div class="row"><span class="lbl">Klingons remaining</span><span class="v danger">${snap.klingonsRemaining}</span></div>
    <div class="row"><span class="lbl">Stardate remaining</span><span class="v">${(snap.stardateEnd - snap.stardate).toFixed(1)}</span></div>
    <div class="row"><span class="lbl">Docked</span><span class="v">${snap.ship.docked ? 'YES' : '—'}</span></div>
  `;

  eventLog.innerHTML = snap.events.slice(-12).reverse().map(e => {
    let cls = '';
    if (e.tag === 'kill' || e.tag === 'phaser' || e.tag === 'win') cls = 'ok';
    else if (e.tag === 'hit' || e.tag === 'loss') cls = 'hit';
    else if (e.tag === 'damage' || e.tag === 'miss') cls = 'warn';
    else if (e.tag === 'override') cls = 'ovr';
    return `<div class="evt ${cls}">${escapeHtml(e.msg)} <small>· sd ${e.stardate.toFixed(1)}</small></div>`;
  }).join('');

  overrideBadge.classList.toggle('shown', anyOverrideActive(game));
  cheatedTag.classList.toggle('shown', game.cheated);
  ordersStrip.innerHTML = ordersStripHtml(mission, game, log);
  renderCheat();
  renderOverridePanel();
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function refreshHint() {
  const ovr = parseOverride(cmdText);
  if (ovr) {
    cmdHint.textContent = ovr.ok ? '↵ ' + describeOverride(ovr.cmd) : ovr.error;
    return;
  }
  const parsed = parseCommand(cmdText);
  if (parsed.status === PARSE.OK) {
    cmdHint.textContent = '↵ ' + describeCommand(parsed.cmd);
  } else if (cmdText.trim() === '') {
    cmdHint.textContent = 'phaser · torpedo · move · srscan · lrscan · shields up|down|<n> · dock · damages · help · quit';
  } else {
    cmdHint.textContent = parsed.error || 'Unknown command';
  }
}

function clearBuffer() {
  cmdText = '';
  cmdBuffer.textContent = '';
}

function now() { return performance.now(); }

/** Run a command line (typed or scripted). */
function runCommandText(text) {
  if (!game || game.won || game.lost || missionEnded) return;
  const ovr = parseOverride(text);
  if (ovr) {
    if (!ovr.ok) { cmdHint.textContent = 'ERR: ' + ovr.error; return; }
    handleOverride(ovr.cmd);
    return;
  }
  const parsed = parseCommand(text);
  if (parsed.status !== PARSE.OK) return;
  const cmd = parsed.cmd;
  if (cmd.action === 'help') {
    cmdHint.textContent = cmd.text + '\n' + OVERRIDE_HELP;
    return;
  }
  // Abandoning a mission throws it away, so it takes the order twice.
  if (cmd.action === 'quit') {
    if (quitArmed) { endGame(false, 'Mission abandoned'); return; }
    quitArmed = true;
    cmdHint.textContent = 'Abandon this mission? Type quit again to confirm; any other order carries on.';
    return;
  }
  quitArmed = false;
  const prev = { sx: game.ship.sx, sy: game.ship.sy, qx: game.ship.qx, qy: game.ship.qy };
  const prevHostiles = snapshot(game).quadrant.klingonCount;
  const res = executeCommand(game, cmd);
  if (!res.ok) {
    cmdHint.textContent = 'ERR: ' + res.error;
    audio.play('impact');
    return;
  }
  noteOrder(log, game, cmd.action, res.effects || []);
  playEffects(res.effects || [], prev, prevHostiles);
  if (cmd.action === 'damages') cmdHint.textContent = damageReport();
  else if (cmd.action === 'computer') cmdHint.textContent = computerReadout();
}

function playEffects(effects, prev, prevHostiles) {
  noteCommand(game, effects);
  const dur = view ? view.play(effects, { prev, getSnap: () => snapshot(game), audio }) : 0;
  view?.sync(snapshot(game));
  const snap = snapshot(game);
  const moved = snap.quadrant.qx !== prev.qx || snap.quadrant.qy !== prev.qy;
  if ((moved && snap.quadrant.klingonCount > 0) || (!moved && prevHostiles === 0 && snap.quadrant.klingonCount > 0)) {
    setTimeout(() => audio.play('klaxon'), moved ? dur * 0.55 * 1000 : 0);
  }
  if (effects.some(e => e.type === 'lrscan')) view?.pulseScan?.();
  updateChart();
  busyUntil = Math.max(busyUntil, now() + dur * 1000);
  renderHUD();
  if (game.won || game.lost) {
    clearTimeout(endTimer);
    const delay = Math.min(4000, Math.max(500, dur * 1000 + 700));
    endTimer = setTimeout(() => endGame(game.won, game.won ? `All Klingons destroyed at stardate ${game.stardate.toFixed(1)}` : game.lostReason), delay);
  }
}

function submitCommand() {
  const text = cmdText;
  clearBuffer();
  const before = cmdHint.textContent;
  runCommandText(text);
  if (cmdHint.textContent === before) refreshHint();
}

function damageReport() {
  const s = game.ship.systems;
  return 'DAMAGE REPORT · ' + SYSTEM_ORDER.map(k => `${k} ${s[k] === 0 ? 'ok' : s[k] <= 3 ? 'weak(' + s[k] + ')' : 'DAMAGED(' + s[k] + ')'}`).join(' · ');
}

function computerReadout() {
  const snap = snapshot(game);
  const hs = computeHints(snap).filter(h => h.cmd);
  return 'COMPUTER · ' + (hs.length ? hs.slice(0, 3).map(h => `${h.tag}: ${h.cmd}`).join(' · ') : 'no course computed');
}

// ---------------------------------------------------------------------------
// Captain's Override
// ---------------------------------------------------------------------------

const OVERRIDE_HINTS = {
  revealMap: 'galaxy chart shows every quadrant',
  infiniteEnergy: 'energy is never spent',
  infiniteTorpedoes: 'torpedo count never drops',
  invulnerable: 'fire never touches shields, hull or systems',
  freezeClock: 'commands stop advancing the stardate',
  oneShot: 'any phaser hit destroys its target',
  instantWarp: 'click the Galaxy Chart to jump anywhere',
};

function handleOverride(cmd) {
  const prev = { sx: game.ship.sx, sy: game.ship.sy, qx: game.ship.qx, qy: game.ship.qy };
  const prevHostiles = snapshot(game).quadrant.klingonCount;
  let res = { ok: true, effects: [] };
  switch (cmd.action) {
    case 'panel': toggleOverridePanel(); return;
    case 'status':
      cmdHint.textContent = 'OVERRIDES · ' + OVERRIDE_FLAGS.map(f => `${OVERRIDE_LABELS[f]} ${game.overrides[f] ? 'ON' : 'off'}`).join(' · ');
      return;
    case 'clear': res = clearOverrides(game); break;
    case 'resupply': res = overrideResupply(game); break;
    case 'toggle': res = setOverride(game, cmd.flag, !game.overrides[cmd.flag]); break;
    case 'set': res = setOverride(game, cmd.flag, cmd.on); break;
    case 'warpTo':
      if (!game.overrides.instantWarp) setOverride(game, 'instantWarp', true);
      res = overrideWarpTo(game, cmd.qx, cmd.qy);
      break;
    default: return;
  }
  if (!res.ok) { cmdHint.textContent = 'ERR: ' + res.error; return; }
  if (res.effects.some(e => e.type === 'override' && e.on && e.changed)) audio.play('resupply');
  playEffects(res.effects, prev, prevHostiles);
  cmdHint.textContent = cmd.action === 'resupply' ? "CAPTAIN'S OVERRIDE · repaired and resupplied" : "CAPTAIN'S OVERRIDE · " + (describeOverride(cmd));
  updateArmed();
}

function renderOverridePanel() {
  if (!game) return;
  overrideList.innerHTML = OVERRIDE_FLAGS.map(f => `
    <div class="ovr-row ${game.overrides[f] ? 'on' : ''}" data-flag="${f}">
      <div class="ovr-switch"></div>
      <div class="ovr-name">${OVERRIDE_LABELS[f]}${f === 'instantWarp' ? ' (click chart)' : ''}<small>${OVERRIDE_HINTS[f]}</small></div>
    </div>`).join('');
}

function setOverridePanelVisible(v) {
  overridePanel.classList.toggle('shown', v);
  overrideBtn.classList.toggle('active', v);
  if (v) renderOverridePanel();
}
function toggleOverridePanel() { setOverridePanelVisible(!overridePanel.classList.contains('shown')); }

function updateArmed() {
  const armed = !!game && game.overrides.instantWarp && currentView === 'strategic' && !game.won && !game.lost;
  stratOverlay.classList.toggle('armed', armed);
  view?.setWarpArmed?.(armed);
}

// ---------------------------------------------------------------------------
// End of mission
// ---------------------------------------------------------------------------

function endGame(won, reason) {
  if (missionEnded) return;
  missionEnded = true;
  clearTimeout(endTimer);
  const summary = settleMission(mission, game, log);
  reportMission(game, won, mission, summary);
  const buttons = reportButtons(mission, game, summary, hostedInHall);
  report = { buttons, share: reportShareLine(mission, game, summary), shownAt: now() };
  const abandoned = !won && !game.lost;
  gameOverInner.innerHTML = reportHtml({ mission, game, log, summary, reason, abandoned, buttons });
  gameOverEl.classList.add('shown');
  gameOverInner.querySelector('.report-btn.primary')?.focus({ preventScroll: true });
}

/** What a report button does; its key in onKeyDown leads here too. */
function reportAction(action) {
  switch (action) {
    case 'next':
      startMission(planSortie(sortieAfter(mission.sortie)));
      break;
    case 'again':
      startMission(mission.mode === 'free' ? planFreeMission(mission.difficulty, freeSeed) : mission);
      break;
    case 'menu':
      showTitle();
      break;
    case 'hall':
      leaveForHall();
      break;
    case 'share': {
      const shown = gameOverInner.querySelector('.share-line span');
      navigator.clipboard?.writeText(report.share).then(
        () => { if (shown) shown.textContent = `${report.share}  · copied`; },
        () => { if (shown) shown.textContent = report.share; },
      );
      break;
    }
  }
}

function onReportKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if ((e.key === 'Enter' || e.key === ' ') && now() - report.shownAt < REPORT_SETTLE_MS) { e.preventDefault(); return; }
  if (e.key === 'Escape') { reportAction('menu'); e.preventDefault(); return; }
  const button = report.buttons.find(b => b.key === e.key.toUpperCase());
  if (button) { reportAction(button.action); e.preventDefault(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && !gameOverInner.contains(document.activeElement)) {
    gameOverInner.querySelector('.report-btn.primary')?.focus({ preventScroll: true });
    e.preventDefault();
  }
}

// ---------------------------------------------------------------------------
// Panels (same behaviour as fancy-web)
// ---------------------------------------------------------------------------

function showHelp() { helpOverlay.classList.add('shown'); }
function hideHelp() {
  helpOverlay.classList.remove('shown');
  store.set(HELP_SEEN_KEY, '1');
}
function setRefVisible(v) {
  refPanel.classList.toggle('shown', v);
  refBtn.classList.toggle('active', v);
  store.set(REF_VISIBLE_KEY, v ? '1' : '0');
}
function toggleRefPanel() { setRefVisible(!refPanel.classList.contains('shown')); }
function setCheatVisible(v) {
  cheatPanel.classList.toggle('shown', v);
  if (v) renderCheat();
}
function toggleCheatPanel() { setCheatVisible(!cheatPanel.classList.contains('shown')); }

function renderCheat() {
  if (!game || !cheatPanel.classList.contains('shown')) return;
  const hints = computeHints(snapshot(game));
  if (!hints.length) {
    cheatEmpty.style.display = '';
    cheatList.innerHTML = '';
    return;
  }
  cheatEmpty.style.display = 'none';
  cheatList.innerHTML = hints.slice(0, 5).map(h => {
    const badge = h.priority === 'urgent' ? '!' : h.priority === 'ok' ? '·' : '▸';
    const cmdHtml = h.cmd ? `<span class="hint-cmd">${escapeHtml(h.cmd)}</span>` : `<span class="hint-done">no command — advisory</span>`;
    return `
      <div class="hint-row priority-${h.priority}">
        <div class="hint-badge">${badge}</div>
        <div class="hint-content">
          <div class="hint-line"><span class="hint-tag">${h.tag}</span>${cmdHtml}</div>
          <div class="hint-explain">${escapeHtml(h.explain)}</div>
        </div>
      </div>`;
  }).join('');
}

function toggleView(v) {
  currentView = v;
  viewButtons.forEach(b => b.classList.toggle('active', b.dataset.view === v));
  stratOverlay.classList.toggle('shown', v === 'strategic');
  if (view) view.setMode(v === 'strategic' ? 'chart' : 'tactical');
  updateChart();
  updateArmed();
}

function updateChart() {
  if (!game || !view) return;
  view.setChartState(snapshot(game), (x, y) => isQuadrantVisible(game, x, y));
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function onKeyDown(e) {
  // The testing aid: no button and no help line mention it.
  if (e.ctrlKey && e.altKey && e.code === 'KeyC') { toggleCheatPanel(); e.preventDefault(); return; }
  if (e.repeat) return;
  if (helpOverlay.classList.contains('shown')) {
    if (e.key === 'Escape' || e.key === '?') { hideHelp(); e.preventDefault(); }
    return;
  }
  if (titleScreen.classList.contains('shown')) {
    if (e.key === '?') { showHelp(); e.preventDefault(); return; }
    if (deck.handleKey(e)) e.preventDefault();
    return;
  }
  if (gameOverEl.classList.contains('shown')) {
    if (e.key === '?') { showHelp(); e.preventDefault(); return; }
    onReportKey(e);
    return;
  }
  // Global shortcuts (in-game)
  if (e.key === '?') { showHelp(); e.preventDefault(); return; }
  if (e.key === '\\') { toggleRefPanel(); e.preventDefault(); return; }
  if (e.key === OVERRIDE_KEY) { toggleOverridePanel(); e.preventDefault(); return; }

  if (e.key === 'Enter') { submitCommand(); e.preventDefault(); return; }
  if (e.key === 'Backspace') {
    cmdText = cmdText.slice(0, -1);
    cmdBuffer.textContent = cmdText;
    refreshHint();
    e.preventDefault();
    return;
  }
  if (e.key === 'Escape') { clearBuffer(); refreshHint(); return; }
  // Toggle views — only when the command buffer is empty, so the 'v' in
  // "move" still reaches the command line.
  if ((e.key === 'v' || e.key === 'V') && cmdText === '' && !e.ctrlKey && !e.metaKey) {
    toggleView(currentView === 'combat' ? 'strategic' : 'combat');
    e.preventDefault();
    return;
  }
  if (e.key.length === 1 && /^[A-Za-z0-9 .\-]$/.test(e.key)) {
    cmdText += e.key;
    cmdBuffer.textContent = cmdText;
    refreshHint();
    e.preventDefault();
  }
}

function onChartPointer(e) {
  if (!view?.pickQuadrant || !stratOverlay.classList.contains('armed')) return;
  const q = view.pickQuadrant(e.clientX, e.clientY);
  if (e.type === 'pointermove') { view.setChartHover(q); return; }
  if (e.type === 'click' && q) {
    if (q.qx === game.ship.qx && q.qy === game.ship.qy) { cmdHint.textContent = 'ERR: Already in that quadrant'; return; }
    handleOverride({ action: 'warpTo', qx: q.qx, qy: q.qy });
    toggleView('combat');
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

function showTitle() {
  gameOverEl.classList.remove('shown');
  report = null;
  titleScreen.classList.add('shown');
  document.body.classList.add('in-title');
  deck.show('menu');
  view?.showTitle();
}

function startMission(plan) {
  mission = plan;
  game = createGame({ difficulty: plan.difficulty, seed: plan.seed });
  log = createLog(game);
  missionEnded = false;
  quitArmed = false;
  report = null;
  noteMissionStarted(game);
  clearBuffer();
  clearTimeout(endTimer);
  titleScreen.classList.remove('shown');
  document.body.classList.remove('in-title');
  gameOverEl.classList.remove('shown');
  currentView = 'combat';
  stratOverlay.classList.remove('shown', 'armed');
  viewButtons.forEach(b => b.classList.toggle('active', b.dataset.view === 'combat'));
  view?.startGame(snapshot(game));
  updateChart();
  refreshHint();
  renderHUD();
  if (qs.get('help') !== '0' && !store.get(HELP_SEEN_KEY, '')) setTimeout(() => showHelp(), 400);
  const cmds = qs.get('cmds');
  if (cmds) runScript(cmds.split(';').map(s => s.trim()).filter(Boolean));
}

/** The plan autostart=1 launches: mission=daily, mission=<sortie id>, or a free mission. */
function autostartPlan() {
  const wanted = qs.get('mission');
  if (wanted === 'daily') return planPatrol(today());
  const sortie = wanted ? sortieById(wanted) : null;
  return sortie ? planSortie(sortie) : planFreeMission(selectedDifficulty, freeSeed);
}

/** Type a list of commands one after another, waiting for each shot. */
function runScript(lines) {
  const next = () => {
    window.__trek.scriptLeft = lines.length;
    if (!lines.length || !game || game.won || game.lost) { window.__trek.scriptDone = true; return; }
    const line = lines.shift();
    window.__trek.scriptLeft = lines.length;
    window.__trek.lastCommandAt = now();
    if (line.startsWith('wait ')) { setTimeout(next, Number(line.slice(5)) || 0); return; }
    if (line === 'view') { toggleView(currentView === 'combat' ? 'strategic' : 'combat'); setTimeout(next, 50); return; }
    runCommandText(line);
    setTimeout(next, Math.max(60, busyUntil - now() + 60));
  };
  window.__trek.scriptDone = false;
  window.__trek.scriptLeft = lines.length;
  setTimeout(next, 150);
}

function setSound(on) {
  audio.setMuted(!on);
  soundBtn.textContent = on ? '♪ sound on' : '♪ sound off';
  soundBtn.classList.toggle('active', on);
  soundBtn.title = on ? 'Sound is on — click to mute' : 'Sound is off — click to turn it on';
  store.set(SOUND_KEY, on ? '1' : '0');
}

function setQualityLabel() {
  if (!view?.profile) { qualityBtn.style.display = 'none'; return; }
  qualityBtn.textContent = { high: '◐ high', low: '◑ low', lite: '○ lite' }[view.profile.name] ?? view.profile.name;
}

async function makeView() {
  const canvas = $('gl');
  if (webglAvailable()) {
    try {
      const { Renderer } = await import('./render/renderer.js');
      const want = qs.get('quality') || store.get(QUALITY_KEY, 'auto');
      const r = new Renderer(canvas, { quality: want, preserve: qs.get('capture') === '1' });
      r.setReducedMotion(reducedParam || r.reduced);
      r.chart.attachLabels($('chart-labels'));
      return glAdapter(r);
    } catch (err) {
      console.error('WebGL renderer failed, using 2D fallback', err);
    }
  }
  document.body.classList.add('nogl');
  canvas.style.display = 'none';
  const fb = $('fallback');
  fb.style.display = 'block';
  const { Fallback2D } = await import('./fallback2d.js');
  return new Fallback2D(fb);
}

/** Uniform surface over the WebGL renderer (the 2D fallback has the same). */
function glAdapter(r) {
  const tac = r.tactical;
  return {
    renderer: r,
    get profile() { return r.profile; },
    gpuName: r.gpu.name,
    software: r.gpu.software,
    showTitle() {
      r.mode = 'title';
      tac.showcase = true;
      tac.resize(r.W, r.H, window.innerWidth, window.innerHeight);
      tac.enterQuadrant(showcaseSnap());
      tac.player.turn = null;
      tac.player.heading = tac.player.targetHeading = 0.55;   // cruising north-east
    },
    startGame(snap) {
      r.mode = 'tactical';
      tac.showcase = false;
      tac.resize(r.W, r.H, window.innerWidth, window.innerHeight);
      if (tac.player) { tac.player.turn = null; tac.player.heading = tac.player.targetHeading = 0; }
      tac.enterQuadrant(snap);
    },
    play: (effects, ctx) => tac.play(effects, ctx),
    sync: (snap) => tac.sync(snap),
    setMode(m) { r.mode = m; },
    setChartState: (snap, vis) => r.chart.setState(snap, vis),
    pulseScan: () => r.chart.pulseScan(),
    setWarpArmed: (v) => r.chart.setArmed(v),
    pickQuadrant: (x, y) => r.chart.pick(x, y),
    chartScreenPoint: (qx, qy) => r.chart.screenPoint(qx, qy),
    setChartHover: (q) => r.chart.setHover(q),
    frame: (t) => r.frame(t),
    resize: () => r.resize(),
    get fps() { return r.fps; },
    get animating() { return r.animating; },
    setQuality(name) { r.setQuality(name); },
  };
}

/** A hand-set quadrant for the title screen's live backdrop. */
function showcaseSnap() {
  return {
    quadrant: {
      qx: 1, qy: 6,
      contents: {
        stars: [{ sx: 5, sy: 0 }],
        starbase: { sx: 9, sy: 3 },
        klingons: [{ id: 'SHOW-1', sx: 9, sy: 9, type: 'battlecruiser', destroyed: false }],
      },
    },
    ship: { sx: 0, sy: 8, shieldsUp: false, hull: 100 },
    overrides: {},
  };
}

async function boot() {
  view = await makeView();
  deck = createDeck({
    host: deckHost,
    hosted: hostedInHall,
    freeLevel: selectedDifficulty,
    freeSeed,
    dateKey: today,
    onLaunch: startMission,
    onLeave: leaveForHall,
    onPage: (page) => { titleScreen.dataset.page = page; },
  });
  document.addEventListener('keydown', onKeyDown);
  gameOverInner.addEventListener('click', (e) => {
    const button = e.target.closest('[data-report]');
    if (button) reportAction(button.dataset.report);
  });
  viewButtons.forEach(b => b.addEventListener('click', () => toggleView(b.dataset.view)));
  $('help-btn').addEventListener('click', showHelp);
  $('help-close').addEventListener('click', hideHelp);
  helpOverlay.addEventListener('click', (e) => { if (e.target === helpOverlay) hideHelp(); });
  refBtn.addEventListener('click', toggleRefPanel);
  $('ref-close').addEventListener('click', () => setRefVisible(false));
  $('cheat-close').addEventListener('click', () => setCheatVisible(false));
  overrideBtn.addEventListener('click', toggleOverridePanel);
  $('override-close').addEventListener('click', () => setOverridePanelVisible(false));
  overrideList.addEventListener('click', (e) => {
    const row = e.target.closest('.ovr-row');
    if (!row || !game) return;
    handleOverride({ action: 'toggle', flag: row.dataset.flag });
  });
  $('ovr-resupply').addEventListener('click', () => game && handleOverride({ action: 'resupply' }));
  $('ovr-clear').addEventListener('click', () => game && handleOverride({ action: 'clear' }));
  stratOverlay.addEventListener('pointermove', onChartPointer);
  stratOverlay.addEventListener('click', onChartPointer);
  soundBtn.addEventListener('click', () => setSound(audio.muted));
  qualityBtn.addEventListener('click', () => {
    if (!view?.setQuality) return;
    const order = ['high', 'low', 'lite'];
    const next = order[(order.indexOf(view.profile.name) + 1) % order.length];
    view.setQuality(next);
    qualityPinned = true;
    store.set(QUALITY_KEY, next);
    setQualityLabel();
  });
  window.addEventListener('resize', () => view?.resize());
  // Keyboard-driven game: never leave focus on a clicked button, or the
  // next Enter / Space would press it again as well as run the command.
  // The menu and the report are the exception: there Enter means that button.
  document.addEventListener('click', (e) => {
    const button = e.target.closest?.('button');
    if (button && !button.closest('#title-screen, #game-over')) button.blur();
  });

  setRefVisible((qs.get('ref') ?? store.get(REF_VISIBLE_KEY, '1')) === '1');
  setCheatVisible(qs.get('cheat') === '1');
  if (qs.get('hud') === '0') document.body.classList.add('hud-off');
  // Sound stays off until the player asks (a stored "on" still needs a click).
  soundBtn.textContent = '♪ sound off';
  if (qs.get('sound') === '1') setSound(true);
  setQualityLabel();
  if (view.software) $('gpu-note').innerHTML = 'No GPU detected — running the <b>Low</b> profile. Everything still works; it just draws less.';

  window.__trek = {
    ready: false, frames: 0,
    get game() { return game; },
    get mission() { return mission; },
    get log() { return log; },
    get page() { return titleScreen.classList.contains('shown') ? deck.page : report ? 'report' : 'mission'; },
    get fps() { return view?.fps ?? 0; },
    get busy() { return now() < busyUntil; },
    run: (text) => runCommandText(text),
    view: (v) => toggleView(v),
    profile: () => view?.profile?.name ?? '2d',
    gpu: () => view?.gpuName ?? 'none',
    get renderer() { return view?.renderer ?? null; },   // debugging / capture scripts
    chartPoint: (qx, qy) => view?.chartScreenPoint?.(qx, qy) ?? null,
  };

  showTitle();
  if (qs.get('autostart') === '1') startMission(autostartPlan());

  let lastFrame = 0;
  let slowSince = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    // Frame caps: a hard cap on software rasterisers, and an idle cap
    // (Lite) when nothing but ambient motion is on screen.
    let cap = view?.profile?.fpsCap || 0;
    const idle = view?.profile?.idleFps || 0;
    if (idle && !view.animating) cap = cap ? Math.min(cap, idle) : idle;
    if (cap && t - lastFrame < 1000 / cap - 2) return;
    lastFrame = t;
    view.frame(t);
    if (posterWanted()) offerPoster(document.body.classList.contains('nogl') ? $('fallback') : $('gl'));
    window.__trek.frames++;
    if (window.__trek.frames === 4) window.__trek.ready = true;
    // Auto-downgrade High → Low if the machine can't keep up (unless the
    // player chose a quality themselves).
    // High → Low below 28 fps, Low → Lite below 18 fps, each after 3 s.
    const step = { high: ['low', 28], low: ['lite', 18] }[view.profile?.name];
    if (!qualityPinned && step && window.__trek.frames > 120) {
      if (view.fps < step[1]) {
        slowSince = slowSince || t;
        if (t - slowSince > 3000) {
          view.setQuality(step[0]);
          setQualityLabel();
          cmdHint.textContent = `Frame rate low — switched to the ${step[0] === 'low' ? 'Low' : 'Lite'} quality profile (bezel button to change).`;
          slowSince = 0;
        }
      } else slowSince = 0;
    }
  }
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
