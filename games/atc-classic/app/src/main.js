// atc/fancy-web — Orchestration: DOM, input, render loop, audio.
// Wires the headless engine (engine.js) to the CRT canvas + command line.

import {
  createGame, tick, spawnPlane, executeCommand, snapshot,
  STATUS, FEATURE, DISPLACEMENT, MAXDIR, DIR_NAMES,
} from './engine.js';
import { PLAYFIELDS } from './playfields.js';
import { parseCommand, describeCommand, PARSE } from './parser.js';
import * as chatter from './chatter.js';
import { hintForPlane, sortHintsByPriority } from './hints.js';
import {
  hostedInHall, leaveForHall, noteCommand, noteShiftEnded, noteShiftStarted, noteTick, offerPoster,
  onHallPause, posterWanted,
} from './hall.js';
import {
  ASSIGNMENTS, isUnlocked, newCareer, nextAssignmentIndex, nextRankNeed, RANKS, rankIndex,
  withShift as withCareerShift,
} from './career.js';
import {
  createTracker, describeTask, FULL_SHIFT_MINUTES, generateTasks, taskProgress, taskState, tasksDone,
  trackCommand, trackFullShift, trackRefusal, trackTick,
} from './briefing.js';
import { dailyNumber, dailySector, dailySeed, dailyShareLine, localDateKey, seededRandom } from './daily.js';
import { licenceNumber, newService, withPage, withShift as withServiceShift } from './service.js';
import { loadSaved, save } from './store.js';
import {
  hideOverlay, printReport, renderBriefingCard, renderDesk, showBriefing, showLogbook, TABS,
} from './desk.js';

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const radar = $('radar');
const ctx = radar.getContext('2d');
const bezelTop = $('bezel-top');
const info = $('info');
const cmdInput = $('cmd-input');
const hint = $('hint');
const planesPanel = $('planes');
const eventsLog = $('events');
const gameOverEl = $('game-over');
const briefingOverlay = $('briefing-overlay');
const logbookOverlay = $('logbook-overlay');
const briefingCardEl = $('briefing-card');
const titleDesk = $('title-desk');
const playfieldPicker = $('playfield-picker');
const shiftTimerEl = $('shift-timer');
const nextTickEl = $('next-tick');
const audioToggle = $('audio-toggle');
const helpOverlay = $('help-overlay');
const helpClose = $('help-close');
// Note: bezel "? help" button was removed 2026-09-21 per user request.
// The `?` key still opens this modal. Access to the full tutorial is
// now exclusively via keyboard + first-visit auto-show.
const subToggleBtn = $('sub-toggle');
const voiceToggleBtn = $('voice-toggle');
const subtitleBar = $('subtitle-bar');
const subtitleSpeakerEl = $('subtitle-speaker');
const subtitleTextEl = $('subtitle-text');
const helpFloatPanel = $('help-panel');
const helpPanelBtn = $('help-panel-btn');
const helpPanelClose = $('help-panel-close');

const cheatLivePanel = $('cheat-live-panel');
const cheatLiveList = $('cheat-live-list');
const cheatLiveEmpty = $('cheat-live-empty');
const cheatBtn = $('cheat-btn');
const cheatLiveClose = $('cheat-live-close');

const titleScreen = $('title-screen');
const titleBeginBtn = $('title-begin');
const titleRadarCanvas = $('title-radar-canvas');

const HELP_SEEN_KEY = 'atc-fancyweb-help-seen';
const SOUND_ON_KEY = 'atc-fancyweb-sound';
const VOICE_ON_KEY = 'atc-fancyweb-voice';
const SUBS_ON_KEY = 'atc-fancyweb-subs';
const HELP_PANEL_KEY = 'atc-fancyweb-help-panel';
const LAST_SECTOR_KEY = 'atc-fancyweb-sector';

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------

let game = null;
let currentPlayfieldKey = (() => {
  try {
    const v = localStorage.getItem(LAST_SECTOR_KEY);
    if (v && PLAYFIELDS[v]) return v;
  } catch (_) {}
  return 'easy';
})();
let gameStarted = false;
let tickTimer = null;
let nextTickAt = 0;
let cmdBuffer = '';
let audioEnabled = loadBool(SOUND_ON_KEY, true);
let voiceEnabled = loadBool(VOICE_ON_KEY, false); // default off — TTS can be startling
let subsEnabled = loadBool(SUBS_ON_KEY, true);
let helpPanelVisible = loadBool(HELP_PANEL_KEY, true);   // static reference — user requested default on
// The cheat panel is the owner's testing aid for checking that a shift can be won by hand: it is
// kept out of sight, and opens with ?cheat=1 in the address or Ctrl+Alt+C, for this visit only.
let cheatLiveVisible = new URLSearchParams(location.search).has('cheat');
let audioCtx = null;
let ambientBed = null;
let ttsVoice = null;
let subtitleHideTimer = null;
let subtitleSeq = 0;    // increments per subtitle so stale timers can no-op
let shiftStart = Date.now();
let paused = false;
// The clock stops while any of these holds: the tutorial is open, the briefing is being read, the
// Hall's pause menu is up, the page is hidden.
const pauseReasons = new Set();
let pausedAt = 0;        // timestamp when pause began
let pausedRemainingMs = 0; // ms remaining on the tick when paused
const SHIFT_LENGTH_MS = FULL_SHIFT_MINUTES * 60 * 1000; // 15 min compressed shift

// The career, the service record and the logbook live in the browser (store.js).
let career = loadSaved('career', newCareer);
let service = loadSaved('service', newService);
let logbook = loadSaved('logbook', () => []);
// From the clock rather than Math.random, which the tests seed for the engine's traffic.
const licence = loadSaved('licence', () => licenceNumber(Date.now() % 9000));
save('licence', licence);
/** What the game menu's desk shows: the tab, the assignment and the open-shift sector chosen. */
let desk = { tab: 'career', assignment: nextAssignmentIndex(career), ...loadSaved('desk', () => ({})) };
if (!isUnlocked(career, desk.assignment)) desk.assignment = nextAssignmentIndex(career);
let logbookPage = 0;
/**
 * The shift being worked: how it was chosen, its briefing and what the report will need.
 * @type {null | { mode: 'career' | 'open' | 'daily', sectorKey: string, assignmentIndex: number,
 *   dateKey: string, tracker: ReturnType<typeof createTracker>, orders: number, refused: number,
 *   over: boolean, briefing: boolean, rankBefore: number, fullShift: boolean }}
 */
let current = null;
let stopPrinting = null;
let reportButtons = [];

// ---------------------------------------------------------------------------
// Canvas sizing
// ---------------------------------------------------------------------------

let cellPx = 30;
let originX = 0, originY = 0;

// Radar sweep (cosmetic — doesn't affect gameplay)
let sweepAngle = -Math.PI / 2; // start pointing up (N)
let lastFrameMs = 0;
const SWEEP_PERIOD_MS = 6000; // one revolution per 6 seconds (~10 rpm — realistic 1980s radar)

// Plane afterglow trails — mirror BSD engine state for cosmetic purposes only
const planeTrails = new Map(); // letter -> array of {x, y, alt}
const MAX_TRAIL = 4;

// Track which planes have already had a "low fuel" chatter line, so we
// don't emit it repeatedly every tick as they approach empty.
const fuelWarned = new Set();

// Fake callsigns for display (grammar still uses A-Z)
const callsigns = new Map(); // letter -> "UAL42" etc.
const AIRLINES = ['UAL', 'DAL', 'AAL', 'SWA', 'FDX', 'JBU', 'ACA', 'BAW', 'DLH', 'AFR', 'KLM', 'QFA', 'ANA', 'JAL', 'CPA'];
const AIRLINES_NAMES = {
  UAL: 'United', DAL: 'Delta', AAL: 'American', SWA: 'Southwest',
  FDX: 'FedEx', JBU: 'JetBlue', ACA: 'AirCanada', BAW: 'Speedbird',
  DLH: 'Lufthansa', AFR: 'AirFrance', KLM: 'KLM', QFA: 'Qantas',
  ANA: 'AllNippon', JAL: 'JapanAir', CPA: 'Cathay',
};

function fitCanvas() {
  const parent = radar.parentElement;
  const rect = parent.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const cssW = rect.width;
  const cssH = rect.height;
  radar.style.width = cssW + 'px';
  radar.style.height = cssH + 'px';
  radar.width = Math.floor(cssW * dpr);
  radar.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!game) return;
  const pf = game.playfield;
  const marginPx = 32;
  const availW = cssW - marginPx * 2;
  const availH = cssH - marginPx * 2;
  cellPx = Math.floor(Math.min(availW / (pf.width - 1), availH / (pf.height - 1)));
  const gridW = cellPx * (pf.width - 1);
  const gridH = cellPx * (pf.height - 1);
  originX = (cssW - gridW) / 2;
  originY = (cssH - gridH) / 2;
}

const cellToPx = (gx, gy) => ({ x: originX + gx * cellPx, y: originY + gy * cellPx });

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function loadBool(key, def) {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return def;
    return v === '1' || v === 'true';
  } catch (_) {
    return def;
  }
}

function saveBool(key, val) {
  try { localStorage.setItem(key, val ? '1' : '0'); } catch (_) {}
}

// ---------------------------------------------------------------------------
// Subtitle + TTS
// ---------------------------------------------------------------------------

/**
 * Show a subtitle line. If a TTS utterance is provided, subtitle
 * lifetime is tied to the utterance's `end` event (+ small grace
 * period). Otherwise falls back to a character-count timer sized
 * generously to match average speaking pace.
 *
 * A monotonic sequence number ensures that stale end-events from
 * previous utterances (e.g. after `speechSynthesis.cancel()`) don't
 * hide a fresh subtitle.
 */
function showSubtitle(speaker, text, ttsUtterance) {
  if (!subsEnabled || !text) return;
  const mySeq = ++subtitleSeq;
  subtitleSpeakerEl.textContent = speaker;
  subtitleSpeakerEl.classList.remove('pilot', 'you');
  subtitleSpeakerEl.classList.add(speaker.toLowerCase() === 'pilot' ? 'pilot' : 'you');
  subtitleTextEl.textContent = text;
  subtitleBar.classList.add('shown');
  if (subtitleHideTimer) { clearTimeout(subtitleHideTimer); subtitleHideTimer = null; }

  const hideIfCurrent = () => {
    if (mySeq !== subtitleSeq) return;
    subtitleBar.classList.remove('shown');
  };
  const scheduleHide = (delayMs) => {
    if (subtitleHideTimer) clearTimeout(subtitleHideTimer);
    subtitleHideTimer = setTimeout(hideIfCurrent, delayMs);
  };

  if (ttsUtterance) {
    // Sync with TTS: hide 800ms after speech ends. Also arm a generous
    // safety timer in case `end` never fires (some browsers drop it
    // when tab is backgrounded or utterance is very short).
    ttsUtterance.addEventListener('end', () => {
      if (mySeq !== subtitleSeq) return;
      scheduleHide(800);
    });
    ttsUtterance.addEventListener('error', () => {
      if (mySeq !== subtitleSeq) return;
      scheduleHide(800);
    });
    // safety fallback — ~130ms/char covers slower TTS voices
    scheduleHide(Math.max(6000, text.length * 130));
  } else {
    // No TTS — approximate reading pace at 95ms/char, min 4s.
    scheduleHide(Math.max(4000, text.length * 95));
  }
}

function hideSubtitle() {
  subtitleSeq++;   // invalidate any pending timers
  subtitleBar.classList.remove('shown');
  if (subtitleHideTimer) { clearTimeout(subtitleHideTimer); subtitleHideTimer = null; }
}

function pickTtsVoice() {
  if (!('speechSynthesis' in window)) return null;
  // /usr/games Reborn: only voices that run on this device. A network voice, which some
  // browsers offer, would send every radio line to an online speech service.
  const voices = window.speechSynthesis.getVoices().filter(v => v.localService);
  if (!voices.length) return null;
  // prefer en-US, then any en-*, then anything
  return voices.find(v => v.lang === 'en-US')
      || voices.find(v => v.lang && v.lang.startsWith('en'))
      || voices[0];
}

/** Start speaking a phrase. Returns the utterance (or null) so callers
 *  can hook `end` events (e.g. to time subtitle lifetime). */
function speak(text) {
  if (!voiceEnabled || !text) return null;
  if (!('speechSynthesis' in window)) return null;
  try {
    // cancel any in-flight utterance so we don't queue up backlog
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (!ttsVoice) ttsVoice = pickTtsVoice();
    // Without an on-device voice the browser's default might be a network one: subtitles only.
    if (!ttsVoice) return null;
    u.voice = ttsVoice;
    u.rate = 1.05;
    u.pitch = 0.95;
    u.volume = 0.9;
    window.speechSynthesis.speak(u);
    return u;
  } catch (_) { return null; }
}

/** Present a chatter line: subtitle + TTS. Safe with null.
 *  Subtitle lifetime is synced to TTS end event when voice is on. */
function emitChatter(line) {
  if (!line) return;
  const utterance = speak(line.tts);
  showSubtitle(line.speaker, line.subtitle, utterance);
}

// ---------------------------------------------------------------------------
// Audio: procedural ambient bed via Web Audio
// ---------------------------------------------------------------------------

function initAudio() {
  if (audioCtx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AC();
  ambientBed = createAmbientBed(audioCtx);
  if (ambientBed) ambientBed.master.gain.value = audioEnabled ? 0.10 : 0;
}

function createAmbientBed(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0.10;
  master.connect(ctx.destination);

  // Radar sweep hum: low 40 Hz drone
  const drone = ctx.createOscillator();
  drone.type = 'sawtooth';
  drone.frequency.value = 42;
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 220;
  droneFilter.Q.value = 0.7;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.35;
  drone.connect(droneFilter).connect(droneGain).connect(master);
  drone.start();

  // Higher CRT scanline whine: 15.7 kHz-ish, very quiet
  const whine = ctx.createOscillator();
  whine.type = 'sine';
  whine.frequency.value = 15700;
  const whineGain = ctx.createGain();
  whineGain.gain.value = 0.008;
  whine.connect(whineGain).connect(master);
  whine.start();

  // Slow LFO pulsing the drone gain slightly
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.13;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.15;
  lfo.connect(lfoGain).connect(droneGain.gain);
  lfo.start();

  return { master };
}

function playBeep(freq, duration = 0.08, type = 'square', vol = 0.15) {
  if (!audioEnabled || !audioCtx) return;
  const o = audioCtx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = audioCtx.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.005);
  g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
  o.connect(g).connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + duration);
}

function playRadarPing() { playBeep(1400, 0.08, 'sine', 0.09); }
function playTick()      { playBeep(180,  0.04, 'sine', 0.06); }
function playSpawn()     { playBeep(720,  0.15, 'triangle', 0.12); }
function playSuccess()   {
  playBeep(660,  0.08, 'sine', 0.10);
  setTimeout(() => playBeep(880, 0.08, 'sine', 0.10), 90);
  setTimeout(() => playBeep(1320, 0.15, 'sine', 0.10), 180);
}
function playLoss() {
  playBeep(120, 0.35, 'sawtooth', 0.22);
  setTimeout(() => playBeep(90, 0.35, 'sawtooth', 0.22), 100);
  setTimeout(() => playBeep(60, 0.6, 'sawtooth', 0.22), 250);
}
function playKeyClack() { playBeep(2200 + Math.random() * 400, 0.012, 'square', 0.03); }

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const PHOSPHOR = '#5eff8a';   // main green
const PHOSPHOR_DIM = '#2a8a45';
const PHOSPHOR_BRIGHT = '#c8ffdc';
const PHOSPHOR_AMBER = '#ffb14f';
const PHOSPHOR_RED = '#ff5252';

function render() {
  if (!game) return;
  const pf = game.playfield;
  const w = radar.clientWidth;
  const h = radar.clientHeight;

  // clear
  ctx.fillStyle = 'rgba(4, 8, 5, 1)';
  ctx.fillRect(0, 0, w, h);

  // faint dot grid
  ctx.fillStyle = 'rgba(60, 180, 100, 0.22)';
  for (let y = 0; y < pf.height; y++) {
    for (let x = 0; x < pf.width; x++) {
      const p = cellToPx(x, y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // range rings — concentric circles from grid center (cosmetic radar aesthetic)
  drawRangeRings();

  // compass card — 360° tick marks + numeric bearings around outside
  drawCompassCard();

  // border
  const bl = cellToPx(0, 0);
  const br = cellToPx(pf.width - 1, pf.height - 1);
  ctx.strokeStyle = 'rgba(94, 255, 138, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.strokeRect(bl.x - cellPx / 2, bl.y - cellPx / 2,
                 br.x - bl.x + cellPx, br.y - bl.y + cellPx);

  // airways
  ctx.strokeStyle = 'rgba(94, 255, 138, 0.16)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 6]);
  for (const line of pf.lines) {
    const a = cellToPx(line.x1, line.y1);
    const b = cellToPx(line.x2, line.y2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // rotating radar sweep (cosmetic; below features)
  drawRadarSweep(w, h);

  // exits — numbers at border
  ctx.font = `600 ${Math.floor(cellPx * 0.7)}px "VT323", monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = PHOSPHOR_DIM;
  for (const ex of pf.exits) {
    const p = cellToPx(ex.x, ex.y);
    // draw the exit label just outside the border
    let dx = 0, dy = 0;
    if (ex.x === 0) dx = -cellPx * 0.7;
    else if (ex.x === pf.width - 1) dx = cellPx * 0.7;
    if (ex.y === 0) dy = -cellPx * 0.7;
    else if (ex.y === pf.height - 1) dy = cellPx * 0.7;
    ctx.fillText(ex.label, p.x + dx, p.y + dy);
    // small bracket at the border cell
    ctx.strokeStyle = 'rgba(94, 255, 138, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, cellPx * 0.35, 0, Math.PI * 2);
    ctx.stroke();
  }

  // beacons — asterisks
  ctx.fillStyle = PHOSPHOR;
  for (const bc of pf.beacons) {
    const p = cellToPx(bc.x, bc.y);
    ctx.fillText('*' + bc.label, p.x, p.y);
  }

  // airports — arrow + label
  ctx.fillStyle = PHOSPHOR;
  for (const ap of pf.airports) {
    const p = cellToPx(ap.x, ap.y);
    drawArrow(p.x, p.y, ap.dir, cellPx * 0.7, PHOSPHOR, 2.5);
    ctx.fillStyle = PHOSPHOR_DIM;
    ctx.font = `${Math.floor(cellPx * 0.45)}px "VT323", monospace`;
    ctx.fillText('A' + ap.label, p.x, p.y + cellPx * 0.9);
    ctx.font = `600 ${Math.floor(cellPx * 0.7)}px "VT323", monospace`;
    ctx.fillStyle = PHOSPHOR;
  }

  // radar afterglow — draw all trails before the live blips
  for (const p of game.air) {
    drawPlaneTrail(p);
  }

  // planes on ground (at airports)
  for (const p of game.ground) {
    drawPlane(p, PHOSPHOR_AMBER, true);
  }

  // planes in air
  for (const p of game.air) {
    let color = PHOSPHOR;
    if (p.status === STATUS.IGNORED) color = PHOSPHOR_DIM;
    if (p.status === STATUS.MARKED) color = PHOSPHOR_BRIGHT;
    if (p.fuel < 5) color = PHOSPHOR_RED;
    drawPlane(p, color, false);
  }

  // crash marker
  if (game.lost && game.lostPlane) {
    const p = [...game.air, ...game.ground].find(pl => pl.letter === game.lostPlane);
    if (p) {
      const pt = cellToPx(p.xpos, p.ypos);
      ctx.strokeStyle = PHOSPHOR_RED;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, cellPx * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pt.x - cellPx * 0.6, pt.y - cellPx * 0.6);
      ctx.lineTo(pt.x + cellPx * 0.6, pt.y + cellPx * 0.6);
      ctx.moveTo(pt.x + cellPx * 0.6, pt.y - cellPx * 0.6);
      ctx.lineTo(pt.x - cellPx * 0.6, pt.y + cellPx * 0.6);
      ctx.stroke();
    }
  }
}

function drawPlane(p, color, onGround) {
  const pt = cellToPx(p.xpos, p.ypos);

  // heading arrow (behind letter)
  if (!onGround) {
    drawArrow(pt.x, pt.y, p.dir, cellPx * 0.55, color, 2);
  }

  // letter (large)
  ctx.font = `700 ${Math.floor(cellPx * 0.9)}px "VT323", monospace`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillText(p.letter, pt.x, pt.y);
  ctx.shadowBlur = 0;

  // ATC data block: FL050 heading + dest, stacked below the letter
  ctx.textAlign = 'left';
  ctx.font = `${Math.floor(cellPx * 0.38)}px "VT323", monospace`;
  ctx.fillStyle = color;
  const flStr = 'FL' + String(p.altitude).padStart(2, '0') + '0';
  const hdgStr = DIR_NAMES[p.dir % MAXDIR];
  const destStr = p.destType === FEATURE.EXIT
    ? '→X' + game.playfield.exits[p.destNo].label
    : '→A' + game.playfield.airports[p.destNo].label;
  const dataX = pt.x + cellPx * 0.35;
  const dataY0 = pt.y + cellPx * 0.15;
  ctx.fillText(flStr, dataX, dataY0);
  ctx.fillText(hdgStr + ' ' + destStr, dataX, dataY0 + cellPx * 0.42);
  ctx.textAlign = 'center';
}

function drawPlaneTrail(p) {
  const trail = planeTrails.get(p.letter);
  if (!trail) return;
  // trail may include the current position as the last entry (recorded after tick)
  // Iterate over all but the most recent, drawing decayed blips.
  const priorCount = Math.max(0, trail.length - 1);
  for (let i = 0; i < priorCount; i++) {
    const t = trail[i];
    const age = priorCount - i;   // 1 = most recent prior; higher = older
    const alpha = 0.45 * Math.pow(0.55, age - 1);
    const pt = cellToPx(t.x, t.y);
    ctx.fillStyle = `rgba(94, 255, 138, ${alpha})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, cellPx * (0.30 - age * 0.03), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRangeRings() {
  const pf = game.playfield;
  const bl = cellToPx(0, 0);
  const br = cellToPx(pf.width - 1, pf.height - 1);
  const cx = (bl.x + br.x) / 2;
  const cy = (bl.y + br.y) / 2;
  // Constrain to grid rectangle so rings don't spill past the border.
  const maxR = Math.min(br.x - cx, br.y - cy) * 0.95;
  const rings = [0.33, 0.66, 1.0];
  const labels = ['10', '20', '30'];  // nominal NM (cosmetic — no real scale)

  ctx.strokeStyle = 'rgba(94, 255, 138, 0.12)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  for (const rf of rings) {
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * rf, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // range labels at 4 o'clock position (down-right)
  ctx.fillStyle = 'rgba(94, 255, 138, 0.32)';
  ctx.font = `${Math.floor(cellPx * 0.34)}px "VT323", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let i = 0; i < rings.length; i++) {
    const angle = Math.PI / 4;  // 45° down-right
    const rx = cx + Math.cos(angle) * maxR * rings[i] + 3;
    const ry = cy + Math.sin(angle) * maxR * rings[i] + 3;
    ctx.fillText(labels[i] + 'NM', rx, ry);
  }
}

function drawCompassCard() {
  const pf = game.playfield;
  const bl = cellToPx(0, 0);
  const br = cellToPx(pf.width - 1, pf.height - 1);
  const cx = (bl.x + br.x) / 2;
  const cy = (bl.y + br.y) / 2;
  // Position compass card just outside the grid border.
  const rOuter = Math.max(br.x - cx, br.y - cy) + cellPx * 0.9;
  const rTickIn = rOuter - cellPx * 0.25;
  const rTickInMajor = rOuter - cellPx * 0.45;

  // Tick marks
  ctx.strokeStyle = 'rgba(94, 255, 138, 0.22)';
  ctx.lineWidth = 1;
  for (let deg = 0; deg < 360; deg += 10) {
    const rad = (deg - 90) * Math.PI / 180;   // 0° = up (N), CW
    const major = deg % 30 === 0;
    const rIn = major ? rTickInMajor : rTickIn;
    const cosT = Math.cos(rad), sinT = Math.sin(rad);
    ctx.beginPath();
    ctx.moveTo(cx + cosT * rIn, cy + sinT * rIn);
    ctx.lineTo(cx + cosT * rOuter, cy + sinT * rOuter);
    ctx.stroke();
  }

  // Numeric bearings every 30°
  ctx.fillStyle = 'rgba(94, 255, 138, 0.55)';
  ctx.font = `${Math.floor(cellPx * 0.32)}px "VT323", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const rLabel = rOuter + cellPx * 0.35;
  for (let deg = 0; deg < 360; deg += 30) {
    const rad = (deg - 90) * Math.PI / 180;
    const x = cx + Math.cos(rad) * rLabel;
    const y = cy + Math.sin(rad) * rLabel;
    const label = String(deg).padStart(3, '0');
    ctx.fillText(label, x, y);
  }
}

function drawRadarSweep(canvasW, canvasH) {
  if (!game) return;
  const pf = game.playfield;
  // center of the drawn grid
  const bl = cellToPx(0, 0);
  const br = cellToPx(pf.width - 1, pf.height - 1);
  const cx = (bl.x + br.x) / 2;
  const cy = (bl.y + br.y) / 2;
  // radius = distance to corner + a little
  const r = Math.hypot(br.x - cx, br.y - cy) + cellPx;

  // trailing sector (fan of thin wedges, alpha fades away from leading edge)
  const trailArc = Math.PI / 2.5; // 72° trail
  const steps = 22;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sweepAngle);
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const alpha = 0.16 * (1 - t) * (1 - t);
    ctx.fillStyle = `rgba(94, 255, 138, ${alpha})`;
    const a0 = -trailArc * t;
    const a1 = -trailArc * ((i + 1) / steps);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a0, a1, true);
    ctx.closePath();
    ctx.fill();
  }
  // leading sweep line
  const grad = ctx.createLinearGradient(0, 0, r, 0);
  grad.addColorStop(0, 'rgba(94, 255, 138, 0.0)');
  grad.addColorStop(0.4, 'rgba(94, 255, 138, 0.35)');
  grad.addColorStop(1, 'rgba(200, 255, 220, 0.75)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(94, 255, 138, 0.6)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawArrow(cx, cy, dir, len, color, width) {
  const d = DISPLACEMENT[dir % MAXDIR];
  const angle = Math.atan2(d.dy, d.dx);
  const tipX = cx + Math.cos(angle) * len;
  const tipY = cy + Math.sin(angle) * len;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tipX, tipY);
  // arrowhead
  const head = len * 0.35;
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - Math.cos(angle - 0.5) * head, tipY - Math.sin(angle - 0.5) * head);
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - Math.cos(angle + 0.5) * head, tipY - Math.sin(angle + 0.5) * head);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// UI panels
// ---------------------------------------------------------------------------

function renderPlanesPanel() {
  if (!game) return;
  const all = [...game.air, ...game.ground];
  const rows = all.map(p => {
    const destName = p.destType === FEATURE.EXIT
      ? `Exit ${game.playfield.exits[p.destNo].label}`
      : `Airport ${game.playfield.airports[p.destNo].label}`;
    const origName = p.origType === FEATURE.EXIT
      ? `Exit ${game.playfield.exits[p.origNo].label}`
      : `Airport ${game.playfield.airports[p.origNo].label}`;
    const type = p.planeType === 1 ? 'JET' : 'prop';
    const dirName = DIR_NAMES[p.dir];
    const fuelClass = p.fuel < 5 ? 'fuel-critical' : (p.fuel < 12 ? 'fuel-warn' : '');
    const statusClass = 'status-' + p.status.toLowerCase();
    const cs = callsigns.get(p.letter) || '';
    const airline = cs.slice(0, 3);
    const airlineFull = AIRLINES_NAMES[airline] || airline;
    const flightNum = cs.slice(3);
    return `
      <div class="plane-row ${statusClass}">
        <span class="plane-letter">${p.letter}</span>
        <span class="plane-detail">
          <b>${cs || '—'}</b> <span class="callsign-name">${airlineFull} ${flightNum}</span><br>
          ${type} · ${origName} → ${destName}<br>
          FL${String(p.altitude).padStart(2,'0')}0, hdg ${dirName},
          <span class="${fuelClass}">fuel ${p.fuel}</span>
        </span>
      </div>`;
  }).join('');
  planesPanel.innerHTML = rows || '<div class="empty">— no traffic —</div>';
}

function renderInfoStrip() {
  if (!game) return;
  info.textContent = `PLANES ${game.safePlanes} SAFE / ${game.lost ? 1 : 0} LOST  ·  SCORE ${game.safePlanes}  ·  CLOCK ${game.clock}`;
}

function renderBezel() {
  if (!game) return;
  const pf = game.playfield;
  // Cosmetic METAR-style string. Values derived from the clock so they
  // "evolve" during a shift but are purely decorative.
  const wind = String(((game.clock * 17) % 36) + 1).padStart(3, '0') + '10KT';
  const vis = '10SM';
  const clouds = ['CLR', 'FEW040', 'SCT080', 'BKN050'][(game.clock >> 2) % 4];
  const temp = 15 + ((game.clock * 3) % 15);
  const dew = 5 + ((game.clock * 2) % 10);
  const altHg = 'A' + (2985 + ((game.clock * 7) % 40));
  const atis = 'ABCDEFGH'[game.clock % 8];
  document.getElementById('bezel-sector').textContent = pf.displayName;
  document.getElementById('bezel-metar').textContent =
    `${wind} ${vis} ${clouds} ${temp}/${dew} ${altHg}`;
  document.getElementById('bezel-atis').textContent = `ATIS INFO ${atis}`;
}

let shiftEndedAt = 0;

function renderShiftTimer() {
  const nowRef = current?.over && shiftEndedAt ? shiftEndedAt : paused ? pausedAt : Date.now();
  const elapsed = nowRef - shiftStart;
  const remaining = Math.max(0, SHIFT_LENGTH_MS - elapsed);
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  shiftTimerEl.textContent = `SHIFT ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function renderNextTick() {
  if (paused) {
    nextTickEl.textContent = 'PAUSED';
    nextTickEl.style.color = 'var(--red)';
    return;
  }
  nextTickEl.style.color = '';
  const remaining = Math.max(0, nextTickAt - Date.now());
  const s = (remaining / 1000).toFixed(1);
  nextTickEl.textContent = `NEXT TICK ${s}s`;
}

function pushEvent(msg, cls = '') {
  const el = document.createElement('div');
  el.className = 'event ' + cls;
  el.textContent = msg;
  eventsLog.prepend(el);
  while (eventsLog.children.length > 12) eventsLog.lastChild.remove();
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

function renderCmdLine() {
  cmdInput.textContent = cmdBuffer;
}

function renderHint() {
  if (cmdBuffer.length === 0) {
    hint.textContent = 'Type plane letter (A-Z), then action.  Empty Enter = force tick.  ? = help';
    return;
  }
  const parsed = parseCommand(cmdBuffer);
  if (parsed.status === PARSE.PARTIAL) {
    hint.textContent = 'Next: ' + (parsed.next || []).join('  |  ');
  } else if (parsed.status === PARSE.OK) {
    hint.textContent = '↵ = execute:  ' + describeCommand(parsed.cmd);
  } else {
    hint.textContent = 'ERR: ' + parsed.error;
  }
}

function submitCommand() {
  if (cmdBuffer.length === 0) {
    // empty enter = force immediate tick
    doTick(true);
    return;
  }
  const parsed = parseCommand(cmdBuffer);
  if (parsed.status !== PARSE.OK) {
    pushEvent('✗ ' + (parsed.error || 'incomplete'), 'err');
    playBeep(180, 0.15, 'sawtooth', 0.12);
    noteRefusal();
    return;
  }
  const res = executeCommand(game, parsed.cmd);
  if (!res.ok) {
    pushEvent('✗ ' + res.error, 'err');
    playBeep(180, 0.15, 'sawtooth', 0.12);
    noteRefusal();
    return;
  }
  noteCommand(parsed.cmd, res.plane);
  if (current) {
    current.orders += 1;
    trackCommand(current.tracker, parsed.cmd, res.plane);
  }
  // Controller radio call
  const cs = callsigns.get(res.plane.letter);
  emitChatter(chatter.chatterOnCommand(cs, parsed.cmd, res.plane));

  pushEvent('› ' + describeCommand(parsed.cmd), 'cmd');
  playRadarPing();
  cmdBuffer = '';
  renderCmdLine();
  renderHint();
  renderPlanesPanel();
  renderCheatLive();
}

function noteRefusal() {
  if (!current) return;
  current.refused += 1;
  trackRefusal(current.tracker);
  renderBriefingSidebar();
}

// ---------------------------------------------------------------------------
// Tick + game loop
// ---------------------------------------------------------------------------

function scheduleNextTick() {
  const ms = game.playfield.updateSecs * 1000;
  nextTickAt = Date.now() + ms;
  if (tickTimer) clearTimeout(tickTimer);
  tickTimer = setTimeout(() => doTick(false), ms);
}

function doTick(forced) {
  if (!game || game.lost || current?.over) return;
  const pf = game.playfield;
  const res = tick(game);
  noteTick(game, res.events);
  // A tick that loses a plane counts nothing, as the engine leaves its arrivals out of the score.
  if (current && !game.lost) trackTick(current.tracker, res.events, game.air);
  if (forced) playTick();
  for (const ev of res.events) {
    if (ev.type === 'spawn') {
      assignCallsign(ev.plane);
      const cs = callsigns.get(ev.plane);
      const plane = [...game.air, ...game.ground].find(p => p.letter === ev.plane);
      const atisLetter = 'ABCDEFGH'[game.clock % 8];
      if (plane) {
        if (plane.origType === FEATURE.EXIT) {
          emitChatter(chatter.chatterOnSpawn(cs, plane.altitude, atisLetter, pf.name));
        } else {
          const airport = pf.airports[plane.origNo];
          emitChatter(chatter.chatterOnGroundReady(cs, airport.label));
        }
      }
      pushEvent(`⟴ new: ${ev.plane} · ${cs || ''}`, 'spawn');
      playSpawn();
    }
    if (ev.type === 'takeoff') {
      pushEvent(`⤒ takeoff: ${labelWithCallsign(ev.plane)}`, 'takeoff');
    }
    if (ev.type === 'land')  {
      const cs = callsigns.get(ev.plane);
      const airport = pf.airports[ev.airport];
      if (cs && airport) emitChatter(chatter.chatterOnLand(cs, airport.label));
      pushEvent(`✓ ${labelWithCallsign(ev.plane)} landed`, 'ok');
      playSuccess();
      callsigns.delete(ev.plane);
      planeTrails.delete(ev.plane);
      fuelWarned.delete(ev.plane);
    }
    if (ev.type === 'exit')  {
      const cs = callsigns.get(ev.plane);
      const exit = pf.exits[ev.exit];
      if (cs && exit) emitChatter(chatter.chatterOnExit(cs, exit.label));
      pushEvent(`✓ ${labelWithCallsign(ev.plane)} exited`, 'ok');
      playSuccess();
      callsigns.delete(ev.plane);
      planeTrails.delete(ev.plane);
      fuelWarned.delete(ev.plane);
    }
    if (ev.type === 'beacon') {
      const cs = callsigns.get(ev.plane);
      const beacon = pf.beacons[ev.beacon];
      if (cs && beacon) emitChatter(chatter.chatterOnBeacon(cs, beacon.label));
      pushEvent(`◎ ${labelWithCallsign(ev.plane)} @ beacon ${ev.beacon}`);
    }
    if (ev.type === 'loss')  {
      const cs = callsigns.get(ev.plane);
      if (cs) emitChatter(chatter.chatterOnLoss(cs, ev.reason));
      pushEvent(`✗ LOST ${labelWithCallsign(ev.plane)}: ${ev.reason}`, 'err');
      playLoss();
    }
  }

  // fuel-low chatter for any plane that has just entered the danger zone
  for (const p of game.air) {
    if (p.fuel <= 6 && !fuelWarned.has(p.letter)) {
      fuelWarned.add(p.letter);
      const cs = callsigns.get(p.letter);
      if (cs) emitChatter(chatter.chatterOnFuelWarn(cs));
    }
  }

  updateTrails();
  renderInfoStrip();
  renderBezel();
  renderPlanesPanel();
  renderCheatLive();
  renderBriefingSidebar();

  if (game.lost) {
    endShift('lost');
    return;
  }
  const assignment = current?.mode === 'career' ? ASSIGNMENTS[current.assignmentIndex] : null;
  if (assignment && game.safePlanes >= assignment.target) {
    pushEvent('◇ relief controller on position', 'meta');
    endShift('relieved');
    return;
  }
  scheduleNextTick();
}

function updateTrails() {
  const currentLetters = new Set();
  for (const p of game.air) {
    currentLetters.add(p.letter);
    if (!planeTrails.has(p.letter)) planeTrails.set(p.letter, []);
    const trail = planeTrails.get(p.letter);
    trail.push({ x: p.xpos, y: p.ypos, alt: p.altitude });
    while (trail.length > MAX_TRAIL + 1) trail.shift();
  }
  for (const letter of [...planeTrails.keys()]) {
    if (!currentLetters.has(letter)) planeTrails.delete(letter);
  }
}

function assignCallsign(letter) {
  if (callsigns.has(letter)) return;
  const airline = AIRLINES[Math.floor(Math.random() * AIRLINES.length)];
  const num = 1 + Math.floor(Math.random() * 9999);
  callsigns.set(letter, `${airline}${num}`);
}

function labelWithCallsign(letter) {
  const cs = callsigns.get(letter);
  return cs ? `${letter} ${cs}` : letter;
}

/** Seconds on position in this shift, pauses left out. */
function secondsOnPosition() {
  return Math.max(0, Math.floor(((paused ? pausedAt : Date.now()) - shiftStart) / 1000));
}

function assignmentOf(shift) {
  return shift.mode === 'career' ? ASSIGNMENTS[shift.assignmentIndex] : null;
}

/** The briefing as the report and the logbook list it: the target first on an assignment. */
function briefingResults(shift, passed) {
  const assignment = assignmentOf(shift);
  const done = tasksDone(shift.tracker);
  return [
    ...(assignment ? [{ text: `Bring ${assignment.target} planes home`, done: passed }] : []),
    ...shift.tracker.tasks.map((task, i) => ({ text: describeTask(task, game.playfield), done: done[i] })),
  ];
}

/**
 * A plane was lost, or on an assignment the relief arrived: save the career, the service record
 * and the logbook, tell the Hall, and print the report.
 * @param {'lost' | 'relieved'} ended
 */
function endShift(ended) {
  if (!current || current.over) return;
  const shift = current;
  const seconds = secondsOnPosition();
  shift.over = true;
  shiftEndedAt = Date.now();
  clearTimeout(tickTimer);
  const passed = ended === 'relieved';
  const assignment = assignmentOf(shift);
  const tasks = briefingResults(shift, passed);
  const stamps = tasks.filter((task) => task.done).length;
  if (assignment) {
    career = withCareerShift(career, assignment.id, passed, stamps);
    save('career', career);
  }
  const rank = rankIndex(career);
  const promoted = rank > shift.rankBefore;
  const need = nextRankNeed(career);
  const summary = {
    mode: shift.mode,
    dateKey: shift.dateKey,
    sectorName: game.playfield.name,
    assignment: assignment
      ? { number: shift.assignmentIndex + 1, total: ASSIGNMENTS.length, title: assignment.title, target: assignment.target }
      : null,
    daily: shift.mode === 'daily' ? { number: dailyNumber(shift.dateKey) } : null,
    safe: game.safePlanes,
    landings: shift.tracker.landings,
    exits: shift.tracker.exits,
    takeoffs: shift.tracker.takeoffs,
    orders: shift.orders,
    refused: shift.refused,
    seconds,
    ended,
    lostPlane: game.lostPlane ?? null,
    lostReason: game.lostReason ?? null,
    tasks,
    rank: { title: RANKS[rank].title, promoted, next: need ? `${need.rank}, ${need.text}` : null },
  };
  service = withServiceShift(service, summary, shift.sectorKey);
  save('service', service);
  logbook = withPage(logbook, summary);
  save('logbook', logbook);
  noteShiftEnded(game, { mode: shift.mode, passed, stamps, promoted });
  if (passed) {
    playSuccess();
    if (assignment && shift.assignmentIndex + 1 < ASSIGNMENTS.length) desk.assignment = shift.assignmentIndex + 1;
    saveDesk();
  }
  printShiftReport(summary, shift);
}

/** The ways on from a report, in the order of the collection's results: the way on first. */
function reportButtonsFor(summary, shift) {
  const buttons = [];
  if (shift.mode === 'daily') {
    buttons.push({ key: 'S', label: 'COPY SHARE LINE', action: 'share', primary: true });
    buttons.push({ key: 'R', label: 'FLY IT AGAIN', action: 'again' });
  } else if (shift.mode === 'career' && summary.ended === 'relieved' && shift.assignmentIndex + 1 < ASSIGNMENTS.length) {
    buttons.push({ key: 'ENTER', label: 'NEXT ASSIGNMENT', action: 'next', primary: true });
    buttons.push({ key: 'R', label: 'AGAIN', action: 'again' });
  } else {
    buttons.push({ key: 'R', label: shift.mode === 'career' ? 'TRY AGAIN' : 'NEW SHIFT', action: 'again', primary: true });
  }
  buttons.push({ key: 'M', label: 'GAME MENU', action: 'menu' });
  if (hostedInHall) buttons.push({ key: 'H', label: '← BACK TO THE HALL', action: 'hall' });
  return buttons;
}

function printShiftReport(summary, shift) {
  reportButtons = reportButtonsFor(summary, shift);
  const share =
    shift.mode === 'daily'
      ? dailyShareLine({
          number: dailyNumber(shift.dateKey),
          sectorName: summary.sectorName,
          safe: summary.safe,
          tasksDone: summary.tasks.map((task) => task.done),
        })
      : null;
  stopPrinting = printReport(gameOverEl, summary, reportButtons, { reducedMotion: prefersReducedMotion(), share });
  gameOverEl.dataset.share = share ?? '';
}

function prefersReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** What a report button does; the keys in onKeyDown lead here too. */
function reportAction(action) {
  const shift = current;
  if (!shift) return;
  switch (action) {
    case 'next':
      startNewGame(planForAssignment(shift.assignmentIndex + 1));
      break;
    case 'again':
      startNewGame({ ...shift, assignmentIndex: shift.assignmentIndex });
      break;
    case 'menu':
      showTitle();
      break;
    case 'hall':
      leaveForHall();
      break;
    case 'share': {
      const line = gameOverEl.dataset.share;
      const shown = gameOverEl.querySelector('.share-line span');
      navigator.clipboard?.writeText(line).then(
        () => { if (shown) shown.textContent = `${line}  · copied`; },
        () => { if (shown) shown.textContent = line; },
      );
      break;
    }
  }
}

function planForAssignment(index) {
  const assignment = ASSIGNMENTS[index];
  return { mode: 'career', sectorKey: assignment.sector, assignmentIndex: index };
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

function onKeyDown(e) {
  if (e.repeat) return;

  // The testing aid's hidden switch (see cheatLiveVisible).
  if (e.ctrlKey && e.altKey && e.code === 'KeyC') {
    setCheatLiveVisible(!cheatLiveVisible);
    e.preventDefault();
    return;
  }

  if (logbookOverlay.classList.contains('shown')) {
    logbookKey(e);
    return;
  }

  // The game menu: the desk's keys, Enter or Space begins the chosen shift.
  if (!gameStarted) {
    deskKey(e);
    return;
  }

  if (briefingOverlay.classList.contains('shown')) {
    if (e.key === 'Enter' || e.key === ' ') {
      takePosition();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      showTitle();
      e.preventDefault();
    }
    return;
  }

  // Help overlay: ? or Escape toggles/closes
  if (helpOverlay.classList.contains('shown')) {
    if (e.key === 'Escape' || e.key === '?') {
      hideHelp();
      e.preventDefault();
    }
    return;
  }
  if (e.key === '?') {
    showHelp();
    e.preventDefault();
    return;
  }

  // Help reference panel — always available, does NOT pause
  if (e.key === '\\') {
    setHelpPanelVisible(!helpPanelVisible);
    e.preventDefault();
    return;
  }

  if (gameOverEl.classList.contains('shown')) {
    reportKey(e);
    return;
  }

  if (!audioCtx) {
    initAudio();  // browsers require user gesture
  }

  if (e.key === 'Enter') {
    submitCommand();
    e.preventDefault();
    return;
  }
  if (e.key === 'Backspace') {
    cmdBuffer = cmdBuffer.slice(0, -1);
    renderCmdLine(); renderHint();
    playKeyClack();
    e.preventDefault();
    return;
  }
  if (e.key === 'Escape') {
    cmdBuffer = '';
    renderCmdLine(); renderHint();
    e.preventDefault();
    return;
  }
  if (e.key.length === 1 && /^[A-Za-z0-9+\-@]$/.test(e.key)) {
    cmdBuffer += e.key;
    renderCmdLine(); renderHint();
    playKeyClack();
    e.preventDefault();
  }
}

/** On the report: the first key finishes the printing; then each key is a button. */
function reportKey(e) {
  const actions = gameOverEl.querySelector('.report-actions');
  if (actions?.hidden) {
    stopPrinting?.();
    e.preventDefault();
    return;
  }
  const key = e.key === ' ' || e.key === 'Enter' ? 'ENTER' : e.key.toUpperCase();
  const primary = reportButtons.find((b) => b.primary);
  const button = reportButtons.find((b) => b.key === key) ?? (key === 'ENTER' ? primary : null);
  if (!button) return;
  e.preventDefault();
  reportAction(button.action);
}

function deskKey(e) {
  const key = e.key;
  if (key === 'Enter' || key === ' ') {
    hideTitleAndBegin();
    e.preventDefault();
  } else if (/^[1-3]$/.test(key)) {
    setDeskTab(TABS[Number(key) - 1]);
  } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const at = TABS.indexOf(desk.tab);
    setDeskTab(TABS[(at + (key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]);
    e.preventDefault();
  } else if (key === 'ArrowUp' || key === 'ArrowDown') {
    moveDeskSelection(key === 'ArrowDown' ? 1 : -1);
    e.preventDefault();
  } else if (key === 'l' || key === 'L') {
    openLogbook();
  }
}

function logbookKey(e) {
  if (e.key === 'Escape' || e.key === 'l' || e.key === 'L') {
    hideOverlay(logbookOverlay);
    e.preventDefault();
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const last = Math.max(0, logbook.length - 1);
    logbookPage = Math.min(last, Math.max(0, logbookPage + (e.key === 'ArrowDown' ? 1 : -1)));
    showLogbook(logbookOverlay, logbook, logbookPage);
    e.preventDefault();
  }
}

function showHelp() {
  helpOverlay.classList.add('shown');
  pauseGame('help');
}

function hideHelp() {
  helpOverlay.classList.remove('shown');
  try { localStorage.setItem(HELP_SEEN_KEY, '1'); } catch (_) {}
  resumeGame('help');
}

function setHelpPanelVisible(v) {
  helpPanelVisible = v;
  saveBool(HELP_PANEL_KEY, v);
  helpFloatPanel.classList.toggle('shown', v);
  helpPanelBtn.classList.toggle('active', v);
}

function setCheatLiveVisible(v) {
  cheatLiveVisible = v;
  cheatLivePanel.classList.toggle('shown', v);
  cheatBtn.classList.toggle('active', v);
  if (v) renderCheatLive();
}

function renderCheatLive() {
  if (!game || !cheatLiveVisible) return;
  const pf = game.playfield;
  const rows = [];
  for (const p of game.ground) {
    // Ground planes can't collide with air planes yet — no need to pass others.
    const hint = hintForPlane(p, pf, true);
    if (hint) rows.push({ letter: p.letter, hint });
  }
  for (const p of game.air) {
    // Pass sibling air planes for collision-avoidance projections.
    const hint = hintForPlane(p, pf, false, game.air);
    if (hint) rows.push({ letter: p.letter, hint });
  }
  const sorted = sortHintsByPriority(rows);

  if (!sorted.length) {
    cheatLiveEmpty.style.display = '';
    cheatLiveList.innerHTML = '';
    return;
  }
  cheatLiveEmpty.style.display = 'none';
  cheatLiveList.innerHTML = sorted.map(({ letter, hint }) => {
    const cs = callsigns.get(letter) || letter;
    let cmdHtml;
    if (hint.command) {
      cmdHtml = `<span class="hint-cmd">${hint.command}</span>`;
    } else if (hint.tag === 'EXECUTING') {
      cmdHtml = `<span class="hint-done">✓ command accepted — plane executing</span>`;
    } else {
      cmdHtml = `<span class="hint-done">✓ nothing to type</span>`;
    }
    return `
      <div class="hint-row priority-${hint.priority}">
        <div class="letter">${letter}</div>
        <div class="hint-body">
          <div class="hint-cs">${cs}</div>
          <div><span class="hint-tag">${hint.tag}</span>${cmdHtml}</div>
          <div class="hint-explain">${hint.explain}</div>
        </div>
      </div>`;
  }).join('');
}

function pauseGame(reason) {
  pauseReasons.add(reason);
  if (reason === 'hall' || reason === 'hidden') quietRoom(true);
  if (paused || !game || game.lost || current?.over) return;
  paused = true;
  pausedAt = Date.now();
  pausedRemainingMs = Math.max(0, nextTickAt - pausedAt);
  if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
}

function resumeGame(reason) {
  pauseReasons.delete(reason);
  if (!pauseReasons.has('hall') && !pauseReasons.has('hidden')) quietRoom(false);
  if (!paused || pauseReasons.size > 0) return;
  paused = false;
  // shift the wall-clock deadlines forward by the pause duration
  const pauseDuration = Date.now() - pausedAt;
  shiftStart += pauseDuration;
  nextTickAt = Date.now() + pausedRemainingMs;
  tickTimer = setTimeout(() => doTick(false), pausedRemainingMs);
}

/** While the Hall's pause menu is up or the page is hidden, the room hum and the radio go quiet. */
function quietRoom(quiet) {
  if (ambientBed) ambientBed.master.gain.value = quiet || !audioEnabled ? 0 : 0.10;
  if (quiet && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

// ---------------------------------------------------------------------------
// Game lifecycle
// ---------------------------------------------------------------------------

/**
 * Sets up a shift and opens its briefing; the clock waits until the controller takes the position.
 * @param {{ mode: 'career' | 'open' | 'daily', sectorKey: string, assignmentIndex?: number }} plan
 */
function startNewGame(plan = { mode: 'open', sectorKey: currentPlayfieldKey }) {
  currentPlayfieldKey = plan.sectorKey;
  const pf = PLAYFIELDS[currentPlayfieldKey];
  const dateKey = localDateKey();
  // The Daily's traffic and briefing come from the date, the same for every controller.
  const seed = plan.mode === 'daily' ? dailySeed(dateKey) : Math.floor(Math.random() * 1e9);
  game = createGame(pf, { seed });
  const assignment = plan.mode === 'career' ? ASSIGNMENTS[plan.assignmentIndex ?? 0] : null;
  const tasks = assignment ? assignment.tasks : plan.mode === 'daily' ? dailyTasks(dateKey) : generateTasks(pf, Math.random);
  current = {
    mode: plan.mode,
    sectorKey: plan.sectorKey,
    assignmentIndex: plan.assignmentIndex ?? 0,
    dateKey,
    tracker: createTracker(tasks),
    orders: 0,
    refused: 0,
    over: false,
    briefing: true,
    rankBefore: rankIndex(career),
    fullShift: false,
  };
  hideOverlay(gameOverEl);
  stopPrinting = null;
  planeTrails.clear();
  callsigns.clear();
  fuelWarned.clear();
  paused = false;
  pauseReasons.delete('help');
  pauseReasons.delete('briefing');
  hideSubtitle();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  // seed initial plane so screen isn't empty
  const first = spawnPlane(game);
  if (first) {
    assignCallsign(first.letter);
    const cs = callsigns.get(first.letter);
    if (first.origType === FEATURE.EXIT) {
      emitChatter(chatter.chatterOnSpawn(cs, first.altitude, 'A', pf.name));
    } else {
      emitChatter(chatter.chatterOnGroundReady(cs, pf.airports[first.origNo].label));
    }
  }
  shiftStart = Date.now();
  cmdBuffer = '';
  eventsLog.innerHTML = '';
  document.querySelectorAll('.pf-btn').forEach((b) => b.classList.toggle('active', b.dataset.pf === currentPlayfieldKey));
  fitCanvas();
  renderBezel();
  renderInfoStrip();
  renderCmdLine();
  renderHint();
  renderPlanesPanel();
  scheduleNextTick();
  pushEvent(`◇ shift start · sector ${pf.name}`, 'meta');
  renderCheatLive();
  noteShiftStarted(game);
  renderBriefingSidebar();
  openBriefing();
}

/** The clipboard before the shift: the clock waits behind it. */
function openBriefing() {
  const shift = current;
  const pf = game.playfield;
  const assignment = assignmentOf(shift);
  const tasks = shift.tracker.tasks.map((task) => describeTask(task, pf));
  if (assignment) {
    showBriefing(briefingOverlay, {
      kicker: `ASSIGNMENT ${shift.assignmentIndex + 1} OF ${ASSIGNMENTS.length}`,
      title: assignment.title,
      sector: `SECTOR ${pf.name.toUpperCase()} · A TICK EVERY ${pf.updateSecs} SECONDS`,
      note: assignment.note,
      target: assignment.target,
      tasks,
    });
  } else if (shift.mode === 'daily') {
    showBriefing(briefingOverlay, {
      kicker: `DAILY TRAFFIC #${dailyNumber(shift.dateKey)} · ${shift.dateKey}`,
      title: 'Today’s traffic',
      sector: `SECTOR ${pf.name.toUpperCase()} · A TICK EVERY ${pf.updateSecs} SECONDS`,
      note: 'The same planes and the same three tasks for every controller today. Keep the room going as long as you can.',
      target: null,
      tasks,
    });
  } else {
    showBriefing(briefingOverlay, {
      kicker: 'OPEN SHIFT',
      title: `The ${pf.name} sector`,
      sector: `A TICK EVERY ${pf.updateSecs} SECONDS · NEW TRAFFIC UNTIL A PLANE IS LOST`,
      note: 'Three tasks for this shift. Each one done earns a commendation stamp.',
      target: null,
      tasks,
    });
  }
  pauseGame('briefing');
}

/** Enter on the briefing: the clock starts, and a first visit opens the tutorial. */
function takePosition() {
  if (!current) return;
  current.briefing = false;
  hideOverlay(briefingOverlay);
  resumeGame('briefing');
  try {
    if (!localStorage.getItem(HELP_SEEN_KEY)) setTimeout(() => showHelp(), 300);
  } catch (_) {}
}

function renderBriefingSidebar() {
  if (!current || !game) {
    briefingCardEl.innerHTML = '<div class="empty">— no briefing —</div>';
    return;
  }
  const assignment = assignmentOf(current);
  const heading = assignment
    ? `${String(current.assignmentIndex + 1).padStart(2, '0')} · ${assignment.title.toUpperCase()}`
    : current.mode === 'daily'
      ? `DAILY TRAFFIC #${dailyNumber(current.dateKey)}`
      : 'OPEN SHIFT';
  renderBriefingCard(briefingCardEl, {
    heading,
    target: assignment ? { have: game.safePlanes, need: assignment.target } : null,
    tasks: current.tracker.tasks.map((task) => ({
      text: describeTask(task, game.playfield),
      state: taskState(current.tracker, task),
      progress: taskProgress(current.tracker, task),
    })),
  });
}

/** Fifteen minutes on position completes the briefing's full-shift task. */
function checkFullShift() {
  if (!current || current.over || current.fullShift || paused) return;
  if (Date.now() - shiftStart < SHIFT_LENGTH_MS) return;
  current.fullShift = true;
  trackFullShift(current.tracker);
  pushEvent('◇ full shift worked', 'meta');
  renderBriefingSidebar();
}

/** A sector button in the sidebar starts an open shift there, leaving the current one. */
function selectPlayfield(key) {
  currentPlayfieldKey = key;
  try { localStorage.setItem(LAST_SECTOR_KEY, key); } catch (_) {}
  desk.sectorKey = key;
  saveDesk();
  if (gameStarted) startNewGame({ mode: 'open', sectorKey: key });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function saveDesk() {
  save('desk', { tab: desk.tab, assignment: desk.assignment, sectorKey: desk.sectorKey });
}

function renderTitleDesk() {
  const dateKey = localDateKey();
  const recent = Object.entries(service.dailies)
    .filter(([key]) => key !== dateKey)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 4)
    .map(([, record]) => record);
  renderDesk(titleDesk, {
    tab: desk.tab,
    career,
    service,
    licence,
    assignment: desk.assignment,
    sectorKey: desk.sectorKey ?? currentPlayfieldKey,
    daily: {
      number: dailyNumber(dateKey),
      dateKey,
      sectorKey: dailySector(dateKey),
      flown: service.dailies[dateKey] ?? null,
      recent,
      tasks: dailyTasks(dateKey).map((task) => describeTask(task, PLAYFIELDS[dailySector(dateKey)])),
    },
  });
}

/** The Daily's briefing, drawn from the day's seed so every controller gets the same three. */
function dailyTasks(dateKey) {
  return generateTasks(PLAYFIELDS[dailySector(dateKey)], seededRandom(dailySeed(dateKey) ^ 0x9e3779b9));
}

function setDeskTab(tab) {
  desk.tab = tab;
  saveDesk();
  renderTitleDesk();
}

function moveDeskSelection(step) {
  if (desk.tab === 'career') {
    let next = desk.assignment + step;
    while (next >= 0 && next < ASSIGNMENTS.length && !isUnlocked(career, next)) next += step;
    if (next >= 0 && next < ASSIGNMENTS.length) desk.assignment = next;
  } else if (desk.tab === 'open') {
    const keys = Object.keys(PLAYFIELDS);
    const at = keys.indexOf(desk.sectorKey ?? currentPlayfieldKey);
    desk.sectorKey = keys[(at + step + keys.length) % keys.length];
  }
  saveDesk();
  renderTitleDesk();
}

/** The shift the desk is set to. */
function planFromDesk() {
  if (desk.tab === 'career') return planForAssignment(desk.assignment);
  if (desk.tab === 'daily') return { mode: 'daily', sectorKey: dailySector(localDateKey()) };
  return { mode: 'open', sectorKey: desk.sectorKey ?? currentPlayfieldKey };
}

function openLogbook() {
  logbookPage = 0;
  showLogbook(logbookOverlay, logbook, logbookPage);
}

/** Clicks on the desk: tabs, assignments, sectors and the logbook. */
function onDeskClick(e) {
  const target = e.target.closest('button');
  if (!target) return;
  if (target.dataset.tab) setDeskTab(target.dataset.tab);
  else if (target.dataset.assignment !== undefined) {
    desk.assignment = Number(target.dataset.assignment);
    saveDesk();
    renderTitleDesk();
  } else if (target.dataset.pf) {
    desk.sectorKey = target.dataset.pf;
    saveDesk();
    renderTitleDesk();
  } else if (target.dataset.logbook !== undefined) openLogbook();
}

/** Back to the game menu from a shift: the shift is left as it is and nothing more counts. */
function showTitle() {
  clearTimeout(tickTimer);
  tickTimer = null;
  if (current) current.over = true;
  hideOverlay(gameOverEl);
  hideOverlay(briefingOverlay);
  helpOverlay.classList.remove('shown');
  pauseReasons.clear();
  paused = false;
  gameStarted = false;
  renderTitleDesk();
  titleScreen.style.display = '';
  // A frame later, so the fade back in runs.
  requestAnimationFrame(() => titleScreen.classList.remove('hiding'));
}

// Small looping radar sweep drawn behind the title text. Uses the same
// palette as the main game so the title feels like a fragment of the
// eventual console.
function startTitleRadarLoop() {
  const canvas = titleRadarCanvas;
  const cctx = canvas.getContext('2d');
  let angle = -Math.PI / 2;
  let last = performance.now();
  let stopped = false;
  function fit() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fit();
  window.addEventListener('resize', fit);
  function frame(now) {
    if (stopped) return;
    const dt = now - last; last = now;
    angle += (dt / 5000) * Math.PI * 2;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    cctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const r = Math.hypot(cx, cy);

    // faint grid dots
    cctx.fillStyle = 'rgba(94, 255, 138, 0.06)';
    const spacing = 22;
    for (let y = spacing / 2; y < h; y += spacing) {
      for (let x = spacing / 2; x < w; x += spacing) {
        cctx.beginPath();
        cctx.arc(x, y, 0.9, 0, Math.PI * 2);
        cctx.fill();
      }
    }

    // range rings
    cctx.strokeStyle = 'rgba(94, 255, 138, 0.10)';
    cctx.lineWidth = 1;
    for (const rf of [0.32, 0.55, 0.8]) {
      cctx.beginPath();
      cctx.arc(cx, cy, r * rf * 0.7, 0, Math.PI * 2);
      cctx.stroke();
    }

    // sweep trail (fan)
    cctx.save();
    cctx.translate(cx, cy);
    cctx.rotate(angle);
    const trailArc = Math.PI / 2.2;
    const steps = 18;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const a = 0.11 * (1 - t) * (1 - t);
      cctx.fillStyle = `rgba(94, 255, 138, ${a})`;
      const a0 = -trailArc * t;
      const a1 = -trailArc * ((i + 1) / steps);
      cctx.beginPath();
      cctx.moveTo(0, 0);
      cctx.arc(0, 0, r, a0, a1, true);
      cctx.closePath();
      cctx.fill();
    }
    // leading line
    const grad = cctx.createLinearGradient(0, 0, r, 0);
    grad.addColorStop(0, 'rgba(94, 255, 138, 0.0)');
    grad.addColorStop(0.5, 'rgba(94, 255, 138, 0.28)');
    grad.addColorStop(1, 'rgba(200, 255, 220, 0.55)');
    cctx.strokeStyle = grad;
    cctx.lineWidth = 1.5;
    cctx.beginPath();
    cctx.moveTo(0, 0);
    cctx.lineTo(r, 0);
    cctx.stroke();
    cctx.restore();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return () => { stopped = true; };
}

function hideTitleAndBegin() {
  if (gameStarted) return;
  gameStarted = true;
  // Init audio here — this is inside a user gesture, so browsers allow it.
  if (!audioCtx) initAudio();
  titleScreen.classList.add('hiding');
  setTimeout(() => { if (gameStarted) titleScreen.style.display = 'none'; }, 700);
  // The briefing opens first; the first-time tutorial follows when the position is taken.
  startNewGame(planFromDesk());
}

function boot() {
  desk.sectorKey ??= currentPlayfieldKey;
  renderTitleDesk();
  titleDesk.addEventListener('click', onDeskClick);
  startTitleRadarLoop();
  titleBeginBtn.addEventListener('click', hideTitleAndBegin);
  briefingOverlay.addEventListener('click', (e) => {
    if (e.target === briefingOverlay) takePosition();
  });
  gameOverEl.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (button) reportAction(button.dataset.action);
  });
  logbookOverlay.addEventListener('click', (e) => {
    const row = e.target.closest('[data-page]');
    if (row) {
      logbookPage = Number(row.dataset.page);
      showLogbook(logbookOverlay, logbook, logbookPage);
    } else if (e.target === logbookOverlay) hideOverlay(logbookOverlay);
  });
  // The Hall's pause, and a hidden page on its own, stop the clock.
  onHallPause(() => pauseGame('hall'), () => resumeGame('hall'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame('hidden');
    else resumeGame('hidden');
  });

  // playfield picker buttons in the sidebar (post-title)
  for (const key of Object.keys(PLAYFIELDS)) {
    const b = document.createElement('button');
    b.className = 'pf-btn';
    b.dataset.pf = key;
    b.textContent = PLAYFIELDS[key].name;
    if (key === currentPlayfieldKey) b.classList.add('active');
    b.addEventListener('click', () => selectPlayfield(key));
    playfieldPicker.appendChild(b);
  }

  function refreshToggleButtons() {
    audioToggle.textContent = audioEnabled ? '♪ sound on' : '♪ sound off';
    audioToggle.classList.toggle('active', audioEnabled);
    voiceToggleBtn.textContent = voiceEnabled ? '◉ voice on' : '◉ voice off';
    voiceToggleBtn.classList.toggle('active', voiceEnabled);
    subToggleBtn.textContent = subsEnabled ? '✎ subs on' : '✎ subs off';
    subToggleBtn.classList.toggle('active', subsEnabled);
    subtitleBar.classList.toggle('hidden-mode', !subsEnabled);
    helpPanelBtn.classList.toggle('active', helpPanelVisible);
    cheatBtn.classList.toggle('active', cheatLiveVisible);
  }
  refreshToggleButtons();
  setHelpPanelVisible(helpPanelVisible);
  setCheatLiveVisible(cheatLiveVisible);

  helpPanelBtn.addEventListener('click', () => setHelpPanelVisible(!helpPanelVisible));
  helpPanelClose.addEventListener('click', () => setHelpPanelVisible(false));
  cheatBtn.addEventListener('click', () => setCheatLiveVisible(!cheatLiveVisible));
  cheatLiveClose.addEventListener('click', () => setCheatLiveVisible(false));

  audioToggle.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    saveBool(SOUND_ON_KEY, audioEnabled);
    if (ambientBed) ambientBed.master.gain.value = audioEnabled ? 0.10 : 0;
    refreshToggleButtons();
  });

  voiceToggleBtn.addEventListener('click', () => {
    voiceEnabled = !voiceEnabled;
    saveBool(VOICE_ON_KEY, voiceEnabled);
    if (!voiceEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    // Prime the voice cache — some browsers load voices asynchronously.
    if (voiceEnabled && 'speechSynthesis' in window) ttsVoice = pickTtsVoice();
    refreshToggleButtons();
  });

  subToggleBtn.addEventListener('click', () => {
    subsEnabled = !subsEnabled;
    saveBool(SUBS_ON_KEY, subsEnabled);
    if (!subsEnabled) hideSubtitle();
    refreshToggleButtons();
  });

  // Some browsers populate voices asynchronously.
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => { ttsVoice = pickTtsVoice(); };
  }

  helpClose.addEventListener('click', hideHelp);
  helpOverlay.addEventListener('click', (e) => {
    // click outside the inner panel closes
    if (e.target === helpOverlay) hideHelp();
  });

  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', () => { fitCanvas(); render(); });

  // Do NOT auto-start the game. Wait for BEGIN SHIFT on the title screen.
  // Ambient audio requires a user gesture anyway; deferring both to the
  // click is intentional. First-time help modal is also deferred to
  // hideTitleAndBegin() so the modal appears against the actual game
  // instead of a blank page.

  // render loop
  function frame(nowMs) {
    // advance sweep angle
    if (lastFrameMs === 0) lastFrameMs = nowMs;
    const dt = nowMs - lastFrameMs;
    lastFrameMs = nowMs;
    sweepAngle += (dt / SWEEP_PERIOD_MS) * Math.PI * 2;
    if (sweepAngle > Math.PI * 2) sweepAngle -= Math.PI * 2;

    render();
    if (posterWanted(game)) offerPoster(radar);
    checkFullShift();
    renderShiftTimer();
    renderNextTick();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
