// atc/fancy-web — Orchestration: DOM, input, render loop, audio.
// Wires the headless engine (engine.js) to the CRT canvas + command line.

import {
  createGame, tick, spawnPlane, executeCommand, snapshot,
  STATUS, FEATURE, DISPLACEMENT, MAXDIR, DIR_NAMES,
} from './engine.js';
import { PLAYFIELDS } from './playfields.js';
import { parseCommand, describeCommand, PARSE } from './parser.js';
import * as chatter from './chatter.js';
import { planTraffic } from './planner.js';
import {
  hallLevel, hallReducedMotion, hostedInHall, leaveForHall, noteCommand, noteShiftEnded, noteShiftStarted,
  noteTick, offerPoster, onHallPause, onHallSound, posterWanted,
} from './hall.js';
import {
  ASSIGNMENTS, FLUENT_ORDERS, isUnlocked, newCareer, nextAssignmentIndex, nextRankNeed, RANKS, rankIndex,
  withShift as withCareerShift, withTypedOrders,
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
import { newCallsign, radioName } from './carriers.js';
import { explainTyped } from './orders.js';
import { createOrderPanel } from './orderpanel.js';
import {
  PHOSPHOR, PHOSPHOR_AMBER, PHOSPHOR_BRIGHT, PHOSPHOR_DIM, PHOSPHOR_RED, RADAR_BACKGROUND,
  RADAR_SCALE_TEXT,
} from './palette.js';
import { newSettings, nextTextSize, orderButtonsOn, TEXT_SCALE, TEXT_SIZE_LABELS, withDefaults } from './settings.js';
import { refreshMenu, showConfirm, showMenu } from './sheets.js';
import { hideTip, placeTip, TIP_TEXT } from './tips.js';

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
// How to play opens with the `?` key, from the pause menu, and by itself on a first visit.
const subToggleBtn = $('sub-toggle');
const voiceToggleBtn = $('voice-toggle');
const subtitleBar = $('subtitle-bar');
const subtitleSpeakerEl = $('subtitle-speaker');
const subtitleTextEl = $('subtitle-text');
const helpFloatPanel = $('help-panel');
const helpPanelBtn = $('help-panel-btn');
const helpPanelClose = $('help-panel-close');
const appEl = $('app');
const screenEl = $('screen');
const orderPanelEl = $('order-panel');
const menuOverlay = $('menu-overlay');
const tipEl = $('tip');
const pauseBtn = $('pause-btn');

const cheatLivePanel = $('cheat-live-panel');
const cheatLiveList = $('cheat-live-list');
const cheatLiveEmpty = $('cheat-live-empty');
const cheatBtn = $('cheat-btn');
const cheatLiveClose = $('cheat-live-close');

const titleScreen = $('title-screen');
const titleBeginBtn = $('title-begin');
const titleScope = $('title-scope');

const HELP_SEEN_KEY = 'atc-fancyweb-help-seen';
const SOUND_ON_KEY = 'atc-fancyweb-sound';
const VOICE_ON_KEY = 'atc-fancyweb-voice';
const SUBS_ON_KEY = 'atc-fancyweb-subs';
const LAST_SECTOR_KEY = 'atc-fancyweb-sector';
/** A button types its command a key at a time this fast, then leaves it on the line a beat. */
const BUTTON_KEY_MS = 25;
const BUTTON_BEAT_MS = 320;
/** How long a landing's or a handoff's flash and stamp last on the radar and on its strip. */
const MOMENT_MS = 900;
const STAMP_MS = 1800;
/** Under reduced motion the radar has no sweep: each tick's positions fade in this slowly. */
const FADE_IN_MS = 700;

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
/** The order buttons, the radar's text size, the reference card and the tips (settings.js). */
let settings = withDefaults(loadSaved('settings', newSettings));
/** The plane the order panel is for: its radar letter, or null. */
let selectedLetter = null;
/** True while the command line holds only the letter a selection put there, nothing typed. */
let lineFromSelection = false;
/** A button's command being typed on the command line: its timer, and how to stop it. */
let typing = null;
/** Landings and handoffs being celebrated: the flash on the radar and the stamped strip. */
const moments = [];
/** When the last tick moved the planes, for the reduced-motion fade-in. */
let lastTickAt = 0;
/** What the first-shift tips need: the tip showing, and the last command a button typed. */
let tipShowing = null;
let lastButtonTyped = '';
let firstShiftTips = false;
/** The way out of an open question (the pause menu or a confirm): what Escape does. */
let menuEscape = null;

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

// Callsigns for the strips and the radio, from invented carriers (carriers.js); the command
// grammar still uses the radar letters A-Z.
const callsigns = new Map(); // letter -> "HBM412" etc.

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
function showSubtitle(speaker, text, ttsUtterance, moment = false) {
  if (!subsEnabled || !text) return;
  const mySeq = ++subtitleSeq;
  subtitleBar.classList.toggle('moment', moment);
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
  // In the Hall the radio is as loud as the Hall's sound allows, and says nothing while it is muted.
  const volume = hallLevel(0.9);
  if (volume === 0) return null;
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
    u.volume = volume;
    window.speechSynthesis.speak(u);
    return u;
  } catch (_) { return null; }
}

/** Present a chatter line: subtitle + TTS. Safe with null.
 *  Subtitle lifetime is synced to TTS end event when voice is on. A `moment` line (a landing or a
 *  handoff) is highlighted. */
function emitChatter(line, { moment = false } = {}) {
  if (!line) return;
  const utterance = speak(line.tts);
  showSubtitle(line.speaker, line.subtitle, utterance, moment);
}

// ---------------------------------------------------------------------------
// Audio: procedural ambient bed via Web Audio
// ---------------------------------------------------------------------------

function initAudio() {
  if (audioCtx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AC();
  ambientBed = createAmbientBed(audioCtx);
  if (ambientBed) ambientBed.master.gain.value = audioEnabled ? hallLevel(0.10) : 0;
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
  g.gain.linearRampToValueAtTime(hallLevel(vol), audioCtx.currentTime + 0.005);
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

// The radar's colours live in palette.js, where a test checks its lettering for contrast.

const reducedMotionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;

/** Reduced motion as the Hall sets it, or on its own as the system does. */
function motionReduced() {
  return hallReducedMotion() ?? reducedMotionQuery?.matches ?? false;
}

/**
 * The smallest lettering the radar uses: 12 px in a window about 720 pixels high, 14 px from about
 * 1080 up, so data blocks stay readable however small the grid's cells get.
 */
function readablePx() {
  const height = window.innerHeight;
  return height >= 1000 ? 14 : height >= 850 ? 13 : 12;
}

/** A size of radar lettering: a share of a grid cell, never under `least`, at the chosen text size. */
function radarPx(cellShare, least = readablePx()) {
  return Math.round(Math.max(cellPx * cellShare, least) * TEXT_SCALE[settings.textSize]);
}

function radarFont(cellShare, weight = '400', least = readablePx()) {
  return `${weight} ${radarPx(cellShare, least)}px "VT323", monospace`;
}

function render() {
  if (!game) return;
  const pf = game.playfield;
  const w = radar.clientWidth;
  const h = radar.clientHeight;
  const now = performance.now();
  const reduced = motionReduced();

  // clear
  ctx.fillStyle = RADAR_BACKGROUND;
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

  // rotating radar sweep (cosmetic; below features); under reduced motion there is none
  if (!reduced) drawRadarSweep(w, h);

  // exits — numbers at border
  ctx.font = radarFont(0.7, '600', 16);
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
    ctx.font = radarFont(0.5);
    ctx.fillText('A' + ap.label, p.x, p.y + cellPx * 0.95);
    ctx.font = radarFont(0.7, '600', 16);
    ctx.fillStyle = PHOSPHOR;
  }

  // radar afterglow — draw all trails before the live blips
  for (const p of game.air) {
    drawPlaneTrail(p);
  }

  // Without the sweep, each tick's new positions fade in slowly instead.
  if (reduced) ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, (now - lastTickAt) / FADE_IN_MS);

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
  ctx.globalAlpha = 1;

  const selected = selectedLetter && [...game.air, ...game.ground].find((p) => p.letter === selectedLetter);
  if (selected) drawSelection(selected);
  drawMoments(now, reduced);

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
  const letterPx = radarPx(1, 22);

  // heading arrow, from the letter's edge outwards
  if (!onGround) {
    drawArrow(pt.x, pt.y, p.dir, letterPx * 0.42 + cellPx * 0.5, color, 2, letterPx * 0.42);
  }

  // letter (large), with a dark rim that keeps it clear of the trails and the sweep behind it
  ctx.font = `400 ${letterPx}px "VT323", monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = RADAR_BACKGROUND;
  ctx.strokeText(p.letter, pt.x, pt.y);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  ctx.fillText(p.letter, pt.x, pt.y);
  ctx.shadowBlur = 0;

  // ATC data block: FL050, then heading and destination. It sits across from where the plane is
  // heading, so the arrow never runs through it.
  const dataPx = radarPx(0.5);
  ctx.font = `${dataPx}px "VT323", monospace`;
  ctx.fillStyle = color;
  const flStr = 'FL' + String(p.altitude).padStart(2, '0') + '0';
  const hdgStr = DIR_NAMES[p.dir % MAXDIR];
  const destStr = p.destType === FEATURE.EXIT
    ? '→X' + game.playfield.exits[p.destNo].label
    : '→A' + game.playfield.airports[p.destNo].label;
  const step = onGround ? { dx: -1, dy: -1 } : DISPLACEMENT[p.dir % MAXDIR];
  let sideX = step.dx > 0 ? -1 : 1;
  const sideY = step.dy > 0 ? -1 : 1;
  // Near the sector's edge the block stays inside, below or above the arrow rather than across it.
  const nearEdge = sideX < 0 ? p.xpos < 3 : p.xpos > game.playfield.width - 4;
  if (nearEdge) sideX = -sideX;
  const clearOfArrow = nearEdge && step.dy === 0 ? dataPx * 0.55 : 0;
  ctx.textAlign = sideX > 0 ? 'left' : 'right';
  const dataX = pt.x + sideX * letterPx * 0.64;
  const firstY = sideY > 0 ? pt.y + dataPx * 0.45 + clearOfArrow : pt.y - dataPx * 1.35 - clearOfArrow;
  ctx.fillText(flStr, dataX, firstY);
  ctx.fillText(hdgStr + ' ' + destStr, dataX, firstY + dataPx * 0.9);
  ctx.textAlign = 'center';
}

/** Amber corner brackets round the plane the order panel is for. */
function drawSelection(p) {
  const pt = cellToPx(p.xpos, p.ypos);
  const r = radarPx(1, 22) * 0.62;
  const arm = r * 0.4;
  ctx.strokeStyle = PHOSPHOR_AMBER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const cx = pt.x + sx * r;
    const cy = pt.y + sy * r;
    ctx.moveTo(cx - sx * arm, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy - sy * arm);
  }
  ctx.stroke();
}

/**
 * A plane home or handed off: a ring opens from where it arrived in the sweep's colour, with the
 * word for it, gone in under a second. Under reduced motion the ring and the word stand still.
 */
function drawMoments(now, reduced) {
  const pf = game.playfield;
  for (const moment of moments) {
    const age = now - moment.at;
    if (age > MOMENT_MS) continue;
    const t = age / MOMENT_MS;
    const pt = cellToPx(moment.x, moment.y);
    const alpha = reduced ? 1 : 1 - t * t;
    const radius = reduced ? cellPx * 1.3 : cellPx * (0.5 + 1.9 * (1 - (1 - t) * (1 - t)));
    ctx.save();
    ctx.globalAlpha = alpha;
    if (!reduced) {
      ctx.fillStyle = PHOSPHOR_BRIGHT;
      ctx.shadowColor = PHOSPHOR;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, cellPx * 0.45 * (1 - t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = PHOSPHOR_BRIGHT;
    ctx.lineWidth = 3;
    ctx.shadowColor = PHOSPHOR;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // The word sits on the side of the arrival facing into the sector.
    const word = moment.kind === 'land' ? 'HOME' : 'HANDED OFF';
    ctx.font = radarFont(0.7, '400', 20);
    ctx.textBaseline = 'middle';
    const inward = moment.x <= 1 ? 'left' : moment.x >= pf.width - 2 ? 'right' : 'center';
    ctx.textAlign = inward === 'left' ? 'left' : inward === 'right' ? 'right' : 'center';
    const dx = inward === 'left' ? cellPx * 1.4 : inward === 'right' ? -cellPx * 1.4 : 0;
    const dy = inward === 'center' ? (moment.y <= 2 ? cellPx * 1.9 : -cellPx * 1.9) : 0;
    // A dark rim keeps the word clear of the ring it sits by.
    ctx.lineWidth = 6;
    ctx.strokeStyle = RADAR_BACKGROUND;
    ctx.strokeText(word, pt.x + dx, pt.y + dy);
    ctx.fillStyle = PHOSPHOR_BRIGHT;
    ctx.fillText(word, pt.x + dx, pt.y + dy);
    ctx.restore();
  }
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
  ctx.fillStyle = RADAR_SCALE_TEXT;
  ctx.font = radarFont(0.34);
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
  ctx.fillStyle = RADAR_SCALE_TEXT;
  ctx.font = radarFont(0.32);
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

function drawArrow(cx, cy, dir, len, color, width, from = 0) {
  const d = DISPLACEMENT[dir % MAXDIR];
  const angle = Math.atan2(d.dy, d.dx);
  const tipX = cx + Math.cos(angle) * len;
  const tipY = cy + Math.sin(angle) * len;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angle) * from, cy + Math.sin(angle) * from);
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

const DIR_WORDS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

function placeName(type, index) {
  const pf = game.playfield;
  return type === FEATURE.EXIT ? `Exit ${pf.exits[index].label}` : `Airport ${pf.airports[index].label}`;
}

/** What a screen reader says for a strip: the same facts as the strip, in words. */
function stripLabel(p, cs) {
  const kind = p.planeType === 1 ? 'jet' : 'prop';
  const climbing = p.newAltitude > p.altitude ? `, climbing to ${p.newAltitude}` : p.newAltitude < p.altitude ? `, descending to ${p.newAltitude}` : '';
  const heading = p.newDir === MAXDIR ? 'circling' : `heading ${DIR_WORDS[p.dir]}`;
  const fuel = p.fuel < 5 ? ', fuel critical' : p.fuel < 12 ? ', fuel low' : '';
  const waiting = p.delayed ? `, turns at beacon ${game.playfield.beacons[p.delayedBeaconNo]?.label}` : '';
  return `${p.letter}, ${cs ? `${radioName(cs)} ${cs.slice(3)}, ` : ''}${kind}, ${placeName(p.origType, p.origNo)} to ${placeName(p.destType, p.destNo)}, ${p.altitude} thousand feet${climbing}, ${heading}, fuel ${p.fuel}${fuel}${waiting}`;
}

function stripHtml(p, pressable) {
  const cs = callsigns.get(p.letter) || '';
  const fuelClass = p.fuel < 5 ? 'fuel-critical' : (p.fuel < 12 ? 'fuel-warn' : '');
  const level = (n) => `FL${String(n).padStart(2, '0')}0`;
  const altitude = p.newAltitude === p.altitude ? level(p.altitude) : `${level(p.altitude)}→${String(p.newAltitude).padStart(2, '0')}0`;
  const waiting = p.delayed ? ` <span class="waiting">· turns at *${game.playfield.beacons[p.delayedBeaconNo]?.label}</span>` : '';
  const detail = `
    <span class="plane-letter" aria-hidden="true">${p.letter}</span>
    <span class="plane-detail" aria-hidden="true">
      <b>${cs || '—'}</b> <span class="callsign-name">${cs ? `${radioName(cs)} ${cs.slice(3)}` : ''}</span><br>
      ${p.planeType === 1 ? 'JET' : 'prop'} · ${placeName(p.origType, p.origNo)} → ${placeName(p.destType, p.destNo)}<br>
      ${altitude}, hdg ${p.newDir === MAXDIR ? 'circle' : DIR_NAMES[p.dir]}, <span class="${fuelClass}">fuel ${p.fuel}</span>${waiting}
    </span>`;
  const selected = p.letter === selectedLetter;
  const label = stripLabel(p, cs);
  const row = pressable
    ? `<button type="button" class="plane-row" data-plane="${p.letter}" aria-pressed="${selected}" aria-label="${label}">${detail}</button>`
    : `<div class="plane-row" role="group" aria-label="${label}">${detail}</div>`;
  return `<li class="strip status-${p.status.toLowerCase()}${selected ? ' selected' : ''}">${row}</li>`;
}

/** A plane just home or handed off keeps its strip a moment, stamped. */
function arrivedStripHtml(moment) {
  const word = moment.kind === 'land' ? 'HOME' : 'HANDED OFF';
  const cs = moment.cs ?? '';
  const where = placeName(moment.kind === 'land' ? FEATURE.AIRPORT : FEATURE.EXIT, moment.place).toLowerCase();
  return `<li class="strip arrived"><div class="plane-row" role="group" aria-label="${moment.letter}, ${cs ? `${radioName(cs)} ${cs.slice(3)}, ` : ''}${word.toLowerCase()}">
    <span class="plane-letter" aria-hidden="true">${moment.letter}</span>
    <span class="plane-detail" aria-hidden="true"><b>${cs || '—'}</b><br>${where}<br>&nbsp;</span>
    <span class="stamp" aria-hidden="true">${word}</span></div></li>`;
}

function renderPlanesPanel() {
  if (!game) return;
  const now = performance.now();
  const pressable = orderButtonsShowing();
  const arrived = moments.filter((m) => now - m.at < STAMP_MS).map(arrivedStripHtml).join('');
  const rows = [...game.air, ...game.ground].map((p) => stripHtml(p, pressable)).join('');
  // A strip that had the keyboard focus keeps it across the redraw.
  const focused = planesPanel.contains(document.activeElement) ? document.activeElement.dataset.plane : null;
  planesPanel.innerHTML = arrived + rows || '<li class="empty">— no traffic —</li>';
  if (focused) planesPanel.querySelector(`[data-plane="${focused}"]`)?.focus();
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
  if (lineFromSelection) {
    hint.textContent = `Pick an order for ${cmdBuffer}, or type the rest (a altitude · t turn · c circle).  Enter = tick`;
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

/**
 * Enter on the command line, or the end of a button's typing: sends the order. Returns whether the
 * engine accepted it.
 * @param {'typed' | 'button'} source
 */
function submitCommand(source = 'typed') {
  if (cmdBuffer.length === 0 || lineFromSelection) {
    // An empty line forces the next tick at once, as in the original; so does a line holding only
    // the letter a click on a plane put there, since nothing was typed.
    doTick(true);
    return false;
  }
  const parsed = parseCommand(cmdBuffer);
  if (parsed.status !== PARSE.OK) {
    pushEvent('✗ ' + (parsed.error || 'incomplete'), 'err');
    playBeep(180, 0.15, 'sawtooth', 0.12);
    noteRefusal();
    return false;
  }
  const res = executeCommand(game, parsed.cmd);
  if (!res.ok) {
    pushEvent('✗ ' + res.error, 'err');
    playBeep(180, 0.15, 'sawtooth', 0.12);
    noteRefusal();
    return false;
  }
  noteCommand(parsed.cmd, res.plane);
  if (current) {
    current.orders += 1;
    if (source === 'button') current.buttonOrders += 1;
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
  refreshOrderPanel();
  if (tipShowing === 'watch') noteTipDone('watch');
  return true;
}

function noteRefusal() {
  if (!current) return;
  current.refused += 1;
  trackRefusal(current.tracker);
  renderBriefingSidebar();
}

// ---------------------------------------------------------------------------
// Order buttons: click a plane or its strip, press an order, and it is typed for you
// ---------------------------------------------------------------------------

const orderPanel = createOrderPanel(orderPanelEl, {
  onPress: pressOrder,
  onClose: deselectPlane,
  onReference: openReferenceAt,
});

function orderButtonsShowing() {
  return orderButtonsOn(settings, service);
}

function planeByLetter(letter) {
  return game ? [...game.air, ...game.ground].find((p) => p.letter === letter) ?? null : null;
}

/** A shift the controller is working: begun, not on its briefing, not over. */
function onPosition() {
  return Boolean(gameStarted && game && current && !current.over && !current.briefing);
}

/** A click on a plane or its strip: the panel opens with its orders, its letter on the command line. */
function selectPlane(letter) {
  if (!orderButtonsShowing() || !onPosition() || !planeByLetter(letter)) return;
  stopTyping();
  selectedLetter = letter;
  cmdBuffer = letter;
  lineFromSelection = true;
  renderCmdLine();
  renderHint();
  renderPlanesPanel();
  refreshOrderPanel();
  noteTipDone('select');
}

function deselectPlane() {
  stopTyping();
  selectedLetter = null;
  if (lineFromSelection) {
    cmdBuffer = '';
    lineFromSelection = false;
    renderCmdLine();
    renderHint();
  }
  renderPlanesPanel();
  refreshOrderPanel();
}

/** The panel follows the selected plane; with no plane selected it shows how to pick one. */
function refreshOrderPanel() {
  if (!orderButtonsShowing()) {
    orderPanel.hide();
    return;
  }
  const plane = selectedLetter ? planeByLetter(selectedLetter) : null;
  if (!plane) {
    if (selectedLetter && lineFromSelection) {
      cmdBuffer = '';
      lineFromSelection = false;
      renderCmdLine();
      renderHint();
    }
    selectedLetter = null;
  }
  if (plane && onPosition()) orderPanel.show(plane, game.playfield, callsigns.get(plane.letter) ?? '');
  else orderPanel.idle();
}

/**
 * A pressed order button types its command on the command line a key at a time, leaves it there
 * a beat, then sends it through the same path as Enter, so what the engine receives is exactly
 * what a player would have typed. Under reduced motion the command appears whole.
 */
function pressOrder(button) {
  if (typing || !onPosition() || paused) return;
  const text = button.typed;
  orderPanel.setBusy(true);
  cmdBuffer = text[0];
  lineFromSelection = false;
  renderCmdLine();
  renderHint();
  let next = 1;
  const send = () => {
    typing = null;
    orderPanel.setBusy(false);
    if (!onPosition() || !planeByLetter(text[0])) {
      // The plane left or the shift ended while the order was being typed: nothing is sent.
      cmdBuffer = '';
      renderCmdLine();
      renderHint();
      refreshOrderPanel();
      return;
    }
    if (submitCommand('button')) {
      lastButtonTyped = text;
      orderPanel.clearDelay();
      orderPanel.showEcho(text, button.parts, button.ref);
      noteTipDone('press');
    }
    // The plane stays selected for its next order, its letter waiting on the line again.
    if (selectedLetter && planeByLetter(selectedLetter) && cmdBuffer === '') {
      cmdBuffer = selectedLetter;
      lineFromSelection = true;
      renderCmdLine();
      renderHint();
    }
    refreshOrderPanel();
    showNextTip();
  };
  const step = () => {
    if (next < text.length) {
      cmdBuffer += text[next++];
      renderCmdLine();
      renderHint();
      playKeyClack();
      typing.timer = setTimeout(step, BUTTON_KEY_MS);
    } else {
      typing.timer = setTimeout(send, BUTTON_BEAT_MS);
    }
  };
  typing = { timer: 0, text, send };
  if (motionReduced()) {
    cmdBuffer = text;
    renderCmdLine();
    renderHint();
    typing.timer = setTimeout(send, BUTTON_BEAT_MS);
  } else {
    typing.timer = setTimeout(step, BUTTON_KEY_MS);
  }
}

/** Enter while a button's command is being typed sends it at once. */
function finishTyping() {
  if (!typing) return;
  clearTimeout(typing.timer);
  cmdBuffer = typing.text;
  typing.send();
}

/** Any other key while a button's command is being typed drops it: the keys are the player's. */
function stopTyping() {
  if (!typing) return;
  clearTimeout(typing.timer);
  typing = null;
  orderPanel.setBusy(false);
  cmdBuffer = '';
  lineFromSelection = false;
  renderCmdLine();
  renderHint();
}

/** "In the reference": the card opens beside the radar on the line the order came from. */
function openReferenceAt(ref) {
  setHelpPanelVisible(true);
  const sectionEl = helpFloatPanel.querySelector(`[data-ref="${ref}"]`);
  if (!sectionEl) return;
  sectionEl.scrollIntoView({ block: 'nearest', behavior: motionReduced() ? 'auto' : 'smooth' });
  sectionEl.classList.add('picked');
  setTimeout(() => sectionEl.classList.remove('picked'), 2400);
}

/** Clicks on the radar select the plane under the pointer (with the order buttons on). */
function planeAtPoint(clientX, clientY) {
  if (!game) return null;
  const rect = radar.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let best = null;
  let bestDistance = cellPx * 0.9;
  for (const p of [...game.air, ...game.ground]) {
    const pt = cellToPx(p.xpos, p.ypos);
    // The data block to the lower right of the letter counts as part of the plane too.
    const dx = x - pt.x;
    const dy = y - pt.y;
    const distance = dx > 0 && dx < cellPx * 2 && dy > -cellPx * 0.5 && dy < cellPx ? Math.min(Math.hypot(dx, dy), cellPx * 0.6) : Math.hypot(dx, dy);
    if (distance < bestDistance) {
      best = p;
      bestDistance = distance;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// First-shift tips: select a plane · press an order · watch what it typed
// ---------------------------------------------------------------------------

function tipDone(id) {
  return settings.tipsDone.includes(id);
}

function noteTipDone(id) {
  if (!firstShiftTips || tipDone(id)) return;
  settings = { ...settings, tipsDone: [...settings.tipsDone, id] };
  saveSettings();
  showNextTip();
}

/** The tip that fits the moment, or none: they show only on a new career's first shift. */
function showNextTip() {
  const quiet =
    !firstShiftTips || !orderButtonsShowing() || !onPosition() || paused ||
    helpOverlay.classList.contains('shown') || menuOverlay.classList.contains('shown');
  let tip = null;
  if (!quiet) {
    if (!tipDone('select') && !selectedLetter) {
      const plane = game.air[0] ?? game.ground[0];
      if (plane) {
        const rect = radar.getBoundingClientRect();
        const pt = cellToPx(plane.xpos, plane.ypos);
        const reach = cellPx * 3.2;
        const at = { left: rect.left + pt.x - reach, right: rect.left + pt.x + reach, top: rect.top + pt.y - cellPx, bottom: rect.top + pt.y + cellPx };
        const side = pt.x > rect.width / 2 ? 'left' : 'right';
        tip = { id: 'select', step: 1, html: TIP_TEXT.select(plane.letter), at, side };
      }
    } else if (!tipDone('press') && selectedLetter && tipDone('select')) {
      const heading = orderPanelEl.querySelector('.op-section') ?? orderPanelEl;
      tip = { id: 'press', step: 2, html: TIP_TEXT.press(), at: heading.getBoundingClientRect(), side: 'left' };
    } else if (!tipDone('watch') && tipDone('press') && lastButtonTyped) {
      tip = { id: 'watch', step: 3, html: TIP_TEXT.watch(lastButtonTyped.replace(/[<>&]/g, '')), at: cmdInput.getBoundingClientRect(), side: 'above' };
    }
  }
  tipShowing = tip?.id ?? null;
  if (tip) placeTip(tipEl, tip);
  else hideTip(tipEl);
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
      if (cs && airport) emitChatter(chatter.chatterOnLand(cs, airport.label), { moment: true });
      pushEvent(`✓ ${labelWithCallsign(ev.plane)} landed`, 'ok');
      celebrate('land', ev.plane, cs, ev.airport, airport);
      callsigns.delete(ev.plane);
      planeTrails.delete(ev.plane);
      fuelWarned.delete(ev.plane);
    }
    if (ev.type === 'exit')  {
      const cs = callsigns.get(ev.plane);
      const exit = pf.exits[ev.exit];
      if (cs && exit) emitChatter(chatter.chatterOnExit(cs, exit.label), { moment: true });
      pushEvent(`✓ ${labelWithCallsign(ev.plane)} handed off`, 'ok');
      celebrate('exit', ev.plane, cs, ev.exit, exit);
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

  lastTickAt = performance.now();
  updateTrails();
  renderInfoStrip();
  renderBezel();
  renderPlanesPanel();
  renderCheatLive();
  renderBriefingSidebar();
  refreshOrderPanel();
  showNextTip();

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

/**
 * The signature moment of the room: a plane home or handed off flashes where it arrived, its strip
 * is stamped HOME or HANDED OFF, its radio line is picked out and a short climbing tone plays.
 * Nothing waits for it; the shift plays straight on.
 */
function celebrate(kind, letter, cs, place, at) {
  if (!at) return;
  moments.push({ kind, letter, cs, place, x: at.x, y: at.y, at: performance.now() });
  playSuccess();
  // The strip keeps its stamp a moment, then goes; old moments are forgotten.
  setTimeout(() => {
    const now = performance.now();
    while (moments.length && now - moments[0].at >= STAMP_MS) moments.shift();
    renderPlanesPanel();
  }, STAMP_MS + 20);
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
  callsigns.set(letter, newCallsign());
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
  if (assignment) career = withCareerShift(career, assignment.id, passed, stamps);
  const typedByHand = shift.orders - shift.buttonOrders;
  const fluent = !career.fluent && typedByHand >= FLUENT_ORDERS;
  career = withTypedOrders(career, typedByHand, shift.dateKey);
  save('career', career);
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
    buttonOrders: shift.buttonOrders,
    fluent,
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
  clearTimeout(typing?.timer);
  typing = null;
  selectedLetter = null;
  lineFromSelection = false;
  refreshOrderPanel();
  showNextTip();
  printShiftReport(summary, shift);
}

/**
 * The ways on from a report, in the collection's results order: Play again (R) · Game menu ·
 * Back to the Hall (H). When the career goes on, the next assignment comes first; the Daily's
 * share line comes last.
 */
function reportButtonsFor(summary, shift) {
  const buttons = [];
  const careerGoesOn = shift.mode === 'career' && summary.ended === 'relieved' && shift.assignmentIndex + 1 < ASSIGNMENTS.length;
  if (careerGoesOn) buttons.push({ key: 'ENTER', label: 'NEXT ASSIGNMENT', action: 'next', primary: true });
  buttons.push({ key: 'R', label: 'PLAY AGAIN', action: 'again', primary: !careerGoesOn });
  buttons.push({ key: 'M', label: 'GAME MENU', action: 'menu' });
  if (hostedInHall) buttons.push({ key: 'H', label: '← BACK TO THE HALL', action: 'hall' });
  if (shift.mode === 'daily') buttons.push({ key: 'S', label: 'COPY SHARE LINE', action: 'share' });
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
  stopPrinting = printReport(gameOverEl, summary, reportButtons, { reducedMotion: motionReduced(), share });
  gameOverEl.dataset.share = share ?? '';
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

  // AltGr reaches the page as Ctrl+Alt on Windows and types characters such as @, so it passes;
  // other Ctrl and Cmd keys are the browser's. Alt with a letter is a settings key.
  const altGr = e.ctrlKey && e.altKey;
  if (!altGr && (e.ctrlKey || e.metaKey)) return;
  if (e.altKey && !altGr) {
    if (settingsKey(e)) e.preventDefault();
    return;
  }

  if (menuOverlay.classList.contains('shown')) {
    if (e.key === 'Escape') {
      menuEscape?.();
      e.preventDefault();
    }
    return;
  }

  if (logbookOverlay.classList.contains('shown')) {
    logbookKey(e);
    return;
  }

  // Help overlay: ? or Escape closes it, on the game menu as during a shift.
  if (helpOverlay.classList.contains('shown')) {
    if (e.key === 'Escape' || e.key === '?') {
      hideHelp();
      e.preventDefault();
    }
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

  if (e.key === '?') {
    showHelp();
    e.preventDefault();
    return;
  }

  // Reference card — always available, does NOT pause
  if (e.key === '\\') {
    setHelpPanelVisible(!settings.reference);
    e.preventDefault();
    return;
  }

  if (gameOverEl.classList.contains('shown')) {
    reportKey(e);
    return;
  }

  // A button reached with Tab takes Enter and Space itself, as on any page.
  if ((e.key === 'Enter' || e.key === ' ') && keyboardControl(e.target)) return;

  if (!audioCtx) {
    initAudio();  // browsers require user gesture
  }

  if (e.key === 'Enter') {
    if (typing) finishTyping();
    else submitCommand();
    e.preventDefault();
    return;
  }
  if (e.key === 'Backspace') {
    stopTyping();
    leaveTheButtons();
    cmdBuffer = cmdBuffer.slice(0, -1);
    renderCmdLine(); renderHint();
    playKeyClack();
    e.preventDefault();
    return;
  }
  if (e.key === 'Escape') {
    stopTyping();
    cmdBuffer = '';
    lineFromSelection = false;
    if (selectedLetter) deselectPlane();
    renderCmdLine(); renderHint();
    e.preventDefault();
    return;
  }
  if (e.key.length === 1 && /^[A-Za-z0-9+\-@]$/.test(e.key)) {
    stopTyping();
    leaveTheButtons();
    cmdBuffer += e.key;
    renderCmdLine(); renderHint();
    playKeyClack();
    e.preventDefault();
  }
}

function isFocusedControl(target) {
  return target instanceof HTMLElement && target !== document.body && target.matches('button, a[href], [role="button"]');
}

/**
 * True after Tab moved the focus, false after a pointer press. The browser's own :focus-visible
 * cannot tell: any key pressed counts as keyboard use there, the Enter that should tick included.
 */
let focusFromTab = false;
document.addEventListener('keydown', (e) => { if (e.key === 'Tab') focusFromTab = true; }, true);
document.addEventListener('pointerdown', () => { focusFromTab = false; }, true);

/**
 * A control the keyboard reached (Tab), which takes Enter and Space itself. A button the mouse
 * clicked keeps the focus too, but Enter then still sends the command line, as it always has.
 */
function keyboardControl(target) {
  return isFocusedControl(target) && focusFromTab;
}

/**
 * A key typed by hand: the order panel closes and the keys go to the command line, the keyboard
 * focus with them, so the next Enter sends the line rather than pressing a button.
 */
function leaveTheButtons() {
  lineFromSelection = false;
  if (isFocusedControl(document.activeElement)) document.activeElement.blur();
  if (selectedLetter) {
    selectedLetter = null;
    renderPlanesPanel();
    refreshOrderPanel();
  }
}

/** Alt with a letter: the settings' keys, on the game menu as during a shift. */
function settingsKey(e) {
  switch (e.code) {
    case 'KeyP':
      togglePause();
      return true;
    case 'KeyO':
      setSetting('orderButtons', !orderButtonsShowing());
      return true;
    case 'KeyT':
      setSetting('textSize', nextTextSize(settings.textSize));
      return true;
    case 'KeyS':
      setSetting('subs', !subsEnabled);
      return true;
    case 'KeyV':
      setSetting('voice', !voiceEnabled);
      return true;
    case 'KeyM':
      setSetting('sound', !audioEnabled);
      return true;
    default:
      return false;
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
  // A report button reached with Tab takes Enter and Space itself.
  if ((e.key === 'Enter' || e.key === ' ') && keyboardControl(e.target)) return;
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
    const focused = document.activeElement;
    // The logbook, the settings and the begin button are pressed as they are; any other choice on
    // the desk reached with Tab applies first, then the shift begins.
    if (focused === titleBeginBtn || (isFocusedControl(focused) && ('logbook' in focused.dataset || 'settings' in focused.dataset))) return;
    if (isFocusedControl(focused) && titleDesk.contains(focused)) focused.click();
    hideTitleAndBegin();
    e.preventDefault();
  } else if (key === '?') {
    showHelp();
    e.preventDefault();
  } else if (key === 's' || key === 'S') {
    openSettings();
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
  showNextTip();
}

function hideHelp() {
  helpOverlay.classList.remove('shown');
  try { localStorage.setItem(HELP_SEEN_KEY, '1'); } catch (_) {}
  resumeGame('help');
  showNextTip();
}

/** The reference card, docked beside the radar; closed until the controller opens it, then remembered. */
function setHelpPanelVisible(v) {
  if (settings.reference !== v) {
    settings = { ...settings, reference: v };
    saveSettings();
  }
  helpFloatPanel.classList.toggle('shown', v);
  helpPanelBtn.classList.toggle('active', v);
  helpPanelBtn.setAttribute('aria-pressed', String(v));
  applySheet();
}

function saveSettings() {
  save('settings', settings);
}

/** The sheet beside the radar shows while it has something in it: the order panel or the reference card. */
function applySheet() {
  appEl.classList.toggle('with-sheet', orderButtonsShowing() || settings.reference);
}

/** Every switch of the room in one place: the settings sheet, the bezel buttons and the Alt keys. */
function setSetting(name, value) {
  switch (name) {
    case 'orderButtons':
      settings = { ...settings, orderButtons: value };
      saveSettings();
      if (!value) {
        stopTyping();
        if (lineFromSelection) cmdBuffer = '';
        lineFromSelection = false;
        selectedLetter = null;
        renderCmdLine();
        renderHint();
      }
      applySheet();
      renderPlanesPanel();
      refreshOrderPanel();
      showNextTip();
      if (onPosition()) pushEvent(`◇ order buttons ${value ? 'on' : 'off'}`, 'meta');
      break;
    case 'textSize':
      settings = { ...settings, textSize: value };
      saveSettings();
      if (onPosition()) pushEvent(`◇ radar text: ${TEXT_SIZE_LABELS[value].toLowerCase()}`, 'meta');
      break;
    case 'reference':
      setHelpPanelVisible(value);
      break;
    case 'subs':
      subsEnabled = value;
      saveBool(SUBS_ON_KEY, value);
      if (!value) hideSubtitle();
      break;
    case 'voice':
      voiceEnabled = value;
      saveBool(VOICE_ON_KEY, value);
      if (!value && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      // Prime the voice cache — some browsers load voices asynchronously.
      if (value && 'speechSynthesis' in window) ttsVoice = pickTtsVoice();
      break;
    case 'sound':
      audioEnabled = value;
      saveBool(SOUND_ON_KEY, value);
      quietRoom(pauseReasons.has('hall') || pauseReasons.has('hidden'));
      break;
  }
  refreshToggleButtons();
  if (menuOverlay.classList.contains('shown') && menuView) refreshMenu(menuOverlay, menuView());
}

function refreshToggleButtons() {
  audioToggle.textContent = audioEnabled ? '♪ sound on' : '♪ sound off';
  audioToggle.classList.toggle('active', audioEnabled);
  audioToggle.setAttribute('aria-pressed', String(audioEnabled));
  voiceToggleBtn.textContent = voiceEnabled ? '◉ voice on' : '◉ voice off';
  voiceToggleBtn.classList.toggle('active', voiceEnabled);
  voiceToggleBtn.setAttribute('aria-pressed', String(voiceEnabled));
  subToggleBtn.textContent = subsEnabled ? '✎ subs on' : '✎ subs off';
  subToggleBtn.classList.toggle('active', subsEnabled);
  subToggleBtn.setAttribute('aria-pressed', String(subsEnabled));
  subtitleBar.classList.toggle('hidden-mode', !subsEnabled);
  helpPanelBtn.classList.toggle('active', settings.reference);
  cheatBtn.classList.toggle('active', cheatLiveVisible);
}

// ---------------------------------------------------------------------------
// The pause menu, the settings and the questions before leaving a shift
// ---------------------------------------------------------------------------

/** How the open menu draws itself again after a change; null with no menu open. */
let menuView = null;
let confirmAnswers = null;

function settingValues() {
  return {
    orderButtons: orderButtonsShowing(),
    textSize: settings.textSize,
    reference: settings.reference,
    subs: subsEnabled,
    voice: voiceEnabled,
    sound: audioEnabled,
  };
}

function openPause() {
  if (!onPosition()) return;
  stopTyping();
  pauseGame('menu');
  menuView = () => ({ mode: 'pause', hosted: hostedInHall, values: settingValues() });
  showMenu(menuOverlay, menuView());
  menuOverlay.querySelector('[data-action="resume"]')?.focus();
  menuEscape = closeMenu;
  showNextTip();
}

/** The settings on their own, from the game menu. */
function openSettings() {
  menuView = () => ({ mode: 'settings', hosted: hostedInHall, values: settingValues() });
  showMenu(menuOverlay, menuView());
  menuOverlay.querySelector('[data-setting]')?.focus();
  menuEscape = closeMenu;
}

function closeMenu() {
  hideOverlay(menuOverlay);
  menuView = null;
  menuEscape = null;
  confirmAnswers = null;
  resumeGame('menu');
  showNextTip();
}

function togglePause() {
  if (menuOverlay.classList.contains('shown')) {
    if (menuView?.().mode === 'pause') closeMenu();
  } else if (onPosition() && !helpOverlay.classList.contains('shown') && !gameOverEl.classList.contains('shown')) {
    openPause();
  }
}

/**
 * Asks before a shift under way is left. The clock waits while the question is open; "keep
 * working" goes back to where the controller was (the pause menu, or the shift).
 */
function askToLeave(question, onYes, onNo = closeMenu) {
  stopTyping();
  pauseGame('menu');
  menuView = null;
  showConfirm(menuOverlay, question);
  confirmAnswers = {
    yes: () => {
      hideOverlay(menuOverlay);
      menuEscape = null;
      confirmAnswers = null;
      pauseReasons.delete('menu');
      onYes();
    },
    no: onNo,
  };
  menuEscape = onNo;
}

/** Clicks in the pause menu, the settings and the questions. */
function onMenuClick(e) {
  if (e.target === menuOverlay) {
    menuEscape?.();
    return;
  }
  const el = e.target.closest('button');
  if (!el) return;
  if (el.dataset.setting) {
    const raw = el.dataset.value;
    setSetting(el.dataset.setting, raw === 'true' ? true : raw === 'false' ? false : raw);
    return;
  }
  switch (el.dataset.action) {
    case 'resume':
    case 'close':
      closeMenu();
      break;
    case 'toggle-orders':
      setSetting('orderButtons', !orderButtonsShowing());
      break;
    case 'how-to-play':
      // The tutorial holds the clock itself, so the menu's own pause can go.
      hideOverlay(menuOverlay);
      menuView = null;
      menuEscape = null;
      showHelp();
      resumeGame('menu');
      break;
    case 'menu':
      askToLeave(
        { title: 'LEAVE THE SHIFT?', text: 'Back to the game menu. This shift stops here and is not printed or logged.', yes: 'GAME MENU', no: 'KEEP WORKING' },
        showTitle,
        openPause,
      );
      break;
    case 'hall':
      askToLeave(
        { title: 'BACK TO THE HALL?', text: 'This shift stops here and is not printed or logged.', yes: 'BACK TO THE HALL', no: 'KEEP WORKING' },
        leaveForHall,
        openPause,
      );
      break;
    case 'confirm-yes':
      confirmAnswers?.yes();
      break;
    case 'confirm-no':
      confirmAnswers?.no();
      break;
  }
}

function setCheatLiveVisible(v) {
  cheatLiveVisible = v;
  cheatLivePanel.classList.toggle('shown', v);
  cheatBtn.classList.toggle('active', v);
  if (v) renderCheatLive();
}

/** The testing aid: what to type for every plane, from the planner (planner.js). */
function renderCheatLive() {
  if (!game || !cheatLiveVisible) return;
  const sorted = planTraffic(game);

  if (!sorted.length) {
    cheatLiveEmpty.style.display = '';
    cheatLiveList.innerHTML = '';
    return;
  }
  cheatLiveEmpty.style.display = 'none';
  cheatLiveList.innerHTML = sorted.map(({ letter, hint }) => {
    const cs = callsigns.get(letter) || letter;
    let cmdHtml;
    if (hint.commands.length) {
      cmdHtml = hint.commands.map((command) => `<span class="hint-cmd">${command}</span>`).join(' ');
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
  if (ambientBed) ambientBed.master.gain.value = quiet || !audioEnabled ? 0 : hallLevel(0.10);
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
    buttonOrders: 0,
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
  moments.length = 0;
  stopTyping();
  selectedLetter = null;
  lineFromSelection = false;
  lastButtonTyped = '';
  // The tips belong to a new career's first shift.
  firstShiftTips = service.shifts === 0;
  paused = false;
  pauseReasons.delete('help');
  pauseReasons.delete('briefing');
  pauseReasons.delete('menu');
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
  applySheet();
  refreshOrderPanel();
  showNextTip();
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
  lastTickAt = performance.now();
  refreshOrderPanel();
  showNextTip();
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

/** A shift with something to lose: a tick has passed or an order been given, and it is not over. */
function shiftUnderWay() {
  return Boolean(gameStarted && current && !current.over && game && (game.clock > 0 || current.orders > 0));
}

/**
 * A sector button in the sidebar starts an open shift there. A shift under way is left only once
 * the controller says so.
 */
function selectPlayfield(key) {
  const go = () => {
    currentPlayfieldKey = key;
    try { localStorage.setItem(LAST_SECTOR_KEY, key); } catch (_) {}
    desk.sectorKey = key;
    saveDesk();
    if (gameStarted) startNewGame({ mode: 'open', sectorKey: key });
  };
  if (!shiftUnderWay()) {
    go();
    return;
  }
  askToLeave({
    title: 'SWITCH SECTOR?',
    text: `An open shift in ${PLAYFIELDS[key].name.toUpperCase()} starts at once. This shift stops here and is not printed or logged.`,
    yes: 'SWITCH SECTOR',
    no: 'KEEP WORKING',
  }, go);
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
  else if (target.dataset.settings !== undefined) openSettings();
}

/** Back to the game menu from a shift: the shift is left as it is and nothing more counts. */
function showTitle() {
  clearTimeout(tickTimer);
  tickTimer = null;
  if (current) current.over = true;
  stopTyping();
  selectedLetter = null;
  lineFromSelection = false;
  hideOverlay(gameOverEl);
  hideOverlay(briefingOverlay);
  hideOverlay(menuOverlay);
  menuView = null;
  menuEscape = null;
  helpOverlay.classList.remove('shown');
  pauseReasons.clear();
  paused = false;
  gameStarted = false;
  // The console behind the game menu is out of reach of Tab until a shift begins.
  appEl.inert = true;
  showNextTip();
  renderTitleDesk();
  titleScreen.style.display = '';
  // A frame later, so the fade back in runs.
  requestAnimationFrame(() => titleScreen.classList.remove('hiding'));
}

/**
 * The miniature scope beside the title: a crisp ring, a sweep and three blips that light as it
 * passes. Under reduced motion it stands still, every blip lit.
 */
function startTitleScope() {
  const size = 112;
  const dpr = window.devicePixelRatio || 1;
  titleScope.width = size * dpr;
  titleScope.height = size * dpr;
  const c = titleScope.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const centre = size / 2;
  const radius = size / 2 - 3;
  const blips = [{ at: 0.45, angle: -2.2 }, { at: 0.72, angle: 0.5 }, { at: 0.3, angle: 2.4 }];
  let angle = -Math.PI / 2;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = now - last;
    last = now;
    if (titleScreen.style.display === 'none') return;
    const still = motionReduced();
    if (!still) angle = (angle + (dt / 4000) * Math.PI * 2) % (Math.PI * 2);
    c.clearRect(0, 0, size, size);
    c.fillStyle = '#020a05';
    c.beginPath();
    c.arc(centre, centre, radius, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(94, 255, 138, 0.22)';
    c.lineWidth = 1;
    for (const share of [0.33, 0.66]) {
      c.beginPath();
      c.arc(centre, centre, radius * share, 0, Math.PI * 2);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(centre - radius, centre);
    c.lineTo(centre + radius, centre);
    c.moveTo(centre, centre - radius);
    c.lineTo(centre, centre + radius);
    c.stroke();
    if (!still) {
      c.save();
      c.translate(centre, centre);
      c.rotate(angle);
      for (let i = 0; i < 16; i++) {
        c.fillStyle = `rgba(94, 255, 138, ${0.2 * (1 - i / 16) ** 2})`;
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, radius, -(i / 16) * 1.3, -((i + 1) / 16) * 1.3, true);
        c.closePath();
        c.fill();
      }
      c.strokeStyle = 'rgba(200, 255, 220, 0.85)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(radius, 0);
      c.stroke();
      c.restore();
    }
    for (const blip of blips) {
      // A blip is brightest just after the sweep has passed it, then fades until the next pass.
      const behind = (((angle - blip.angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const glow = still ? 1 : Math.max(0.25, 1 - behind / (Math.PI * 1.6));
      c.fillStyle = `rgba(200, 255, 220, ${glow})`;
      c.shadowColor = PHOSPHOR;
      c.shadowBlur = 6 * glow;
      c.beginPath();
      c.arc(centre + Math.cos(blip.angle) * radius * blip.at, centre + Math.sin(blip.angle) * radius * blip.at, 2.6, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
    }
    c.strokeStyle = PHOSPHOR;
    c.lineWidth = 2;
    c.shadowColor = PHOSPHOR;
    c.shadowBlur = 8;
    c.beginPath();
    c.arc(centre, centre, radius, 0, Math.PI * 2);
    c.stroke();
    c.shadowBlur = 0;
  }
  requestAnimationFrame(frame);
}

function hideTitleAndBegin() {
  if (gameStarted) return;
  gameStarted = true;
  // Init audio here — this is inside a user gesture, so browsers allow it.
  if (!audioCtx) initAudio();
  titleScreen.classList.add('hiding');
  appEl.inert = false;
  // The menu fades out, or under reduced motion goes at once.
  if (motionReduced()) titleScreen.style.display = 'none';
  else setTimeout(() => { if (gameStarted) titleScreen.style.display = 'none'; }, 700);
  // The briefing opens first; the first-time tutorial follows when the position is taken.
  startNewGame(planFromDesk());
}

function boot() {
  desk.sectorKey ??= currentPlayfieldKey;
  // The console behind the game menu is out of reach of Tab until a shift begins.
  appEl.inert = true;
  renderTitleDesk();
  titleDesk.addEventListener('click', onDeskClick);
  startTitleScope();
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

  refreshToggleButtons();
  setHelpPanelVisible(settings.reference);
  setCheatLiveVisible(cheatLiveVisible);

  helpPanelBtn.addEventListener('click', () => setHelpPanelVisible(!settings.reference));
  helpPanelClose.addEventListener('click', () => setHelpPanelVisible(false));
  cheatBtn.addEventListener('click', () => setCheatLiveVisible(!cheatLiveVisible));
  cheatLiveClose.addEventListener('click', () => setCheatLiveVisible(false));
  pauseBtn.addEventListener('click', togglePause);
  menuOverlay.addEventListener('click', onMenuClick);

  // Order buttons: a click on a plane on the radar, or on its strip, selects it.
  radar.addEventListener('click', (e) => {
    if (!orderButtonsShowing() || !onPosition()) return;
    const plane = planeAtPoint(e.clientX, e.clientY);
    if (plane) selectPlane(plane.letter);
    else if (selectedLetter) deselectPlane();
  });
  radar.addEventListener('mousemove', (e) => {
    const over = orderButtonsShowing() && onPosition() && planeAtPoint(e.clientX, e.clientY);
    radar.style.cursor = over ? 'pointer' : '';
  });
  // A click on a strip leaves the keyboard focus where it was, as the order buttons do.
  planesPanel.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-plane]')) e.preventDefault();
  });
  planesPanel.addEventListener('click', (e) => {
    const strip = e.target.closest('[data-plane]');
    if (strip) selectPlane(strip.dataset.plane);
  });
  // A tip's ✕: dismissed, and never shown again.
  tipEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-tip-close]') && tipShowing) noteTipDone(tipShowing);
  });
  // The radar refits whenever its screen changes size: the window, or the sheet opening beside it.
  new ResizeObserver(() => {
    fitCanvas();
    render();
    showNextTip();
  }).observe(screenEl);
  applySheet();

  audioToggle.addEventListener('click', () => setSetting('sound', !audioEnabled));
  // In the Hall the sound switch follows the Hall's mute, for this visit only: the choice the
  // game saves is the one made on its own switch.
  onHallSound((on) => {
    audioEnabled = on;
    quietRoom(pauseReasons.has('hall') || pauseReasons.has('hidden'));
    if (!on && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    refreshToggleButtons();
  });

  voiceToggleBtn.addEventListener('click', () => setSetting('voice', !voiceEnabled));
  subToggleBtn.addEventListener('click', () => setSetting('subs', !subsEnabled));

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
