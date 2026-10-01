// Battlestar — Pajamas to Paradise: the page. Glues the faithful engine,
// the scene composer and renderer, the console, the side panel, hints,
// Override, saves and sound together.

import { Battlestar, C, OBJDES } from '../engine/battlestar.js';
import { nextHint } from '../engine/planner.js';
import { autopilotKey } from '../engine/flight.js';
import { composeRoom, relativeExits, ROOM_CLASS } from '../scene/composer.js';
import { Console } from './console.js';
import { Panel, drawWorldMap, skyText } from './panel.js';
import { assist } from './helpers.js';
import { store } from './store.js';
import { FlightController } from './flight.js';
import { Soundscape } from '../audio/audio.js';
import { afterStageFrame, noteAutoplayUsed, noteEvents, noteGameStarted, reportGameOver } from '../hall.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const reduceMotionOS = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const settings = store.settings({
  quality: 'auto', contrast: false, motion: reduceMotionOS, turnBased: reduceMotionOS, strict: false, sound: false,
});
if (params.get('q')) settings.quality = params.get('q');
if (params.get('hc')) settings.contrast = params.get('hc') === '1';
if (params.get('motion') === 'reduce') settings.motion = true;

const BIOME_LABEL = { ship: 'the battlestar', space: 'deep space', air: 'over the island', coast: 'the coast', forest: 'the rainforest', cave: 'under the island' };

// ---------------------------------------------------------------- state
let game = null;
let stage = null;
let quality = 'text';
let gpuInfo = { ok: false };
let flight = null;
let autoplay = null;
let lastPrompt = '>-: ';
let ended = false;
const panel = new Panel();
const sound = new Soundscape();
const con = new Console(
  { log: $('log'), form: $('cmdline'), input: $('cmd'), prompt: $('prompt'), suggest: $('suggest') },
  { onCommand: (line) => submit(line, true), getGame: () => game, onKey: consoleKey },
);

// ---------------------------------------------------------------- renderer
async function initRenderer() {
  document.body.classList.toggle('hc', settings.contrast);
  document.body.classList.toggle('reduce-motion', settings.motion);
  if (settings.quality === 'text') { textMode('chosen'); return; }
  let mod;
  try {
    mod = await import('../render/stage.js');
  } catch (e) {
    console.error(e);
    textMode('the renderer failed to load');
    return;
  }
  gpuInfo = mod.probeGL();
  if (!gpuInfo.ok) { textMode('WebGL2 is not available'); return; }
  quality = settings.quality === 'auto' ? (gpuInfo.software ? 'low' : 'high') : settings.quality;
  try {
    stage = new mod.Stage($('scene'), { quality, software: gpuInfo.software, reducedMotion: settings.motion, highContrast: settings.contrast });
    stage.afterFrame = afterStageFrame;
    // modelled art style A (the default), or ?style=legacy|b for comparison
    stage.artStyle = ['a', 'b', 'legacy'].includes(params.get('style')) ? params.get('style') : 'a';
  } catch (e) {
    console.error(e);
    textMode('WebGL could not start');
  }
}

function textMode(why) {
  quality = 'text';
  $('scene').hidden = true;
  $('scene-fallback').hidden = false;
  $('scene-fallback').dataset.why = why;
}

// ---------------------------------------------------------------- engine driving
function newGame({ seed, username, snapshot = null, resume = 'start', overrides } = {}) {
  stopAutoplay();
  if (flight) { flight.dispose(); flight = null; }
  ended = false;
  game = new Battlestar({
    seed: seed ?? (Math.floor(Math.random() * 30000) + 1),
    username: username || '',
    snapshot, resume, overrides,
    onSave: (name, snap) => store.save(name, snap, { room: snap.position, turn: snap.ourtime, seed: game.seed, username: game.username }),
  });
  con.clear();
  noteGameStarted();
  if (snapshot && resume === 'prompt') con.note('Welcome back. (Autosave restored at the prompt.)');
  const r = game.start();
  handle(r, null);
  if (stage && game) stage.show(composeRoom(game), null);
  history.replaceState(null, '', `${location.pathname}?seed=${game.seed}${game.username ? `&user=${encodeURIComponent(game.username)}` : ''}`);
}

function submit(line, typed) {
  if (!game || ended) return;
  if (flight) return;
  const req = game.request;
  if (!req || req.kind !== 'line') return;
  let send = line;
  let note = null;
  if (req.prompt === '>-: ' || req.prompt === '<fight!>-: ') {
    const a = assist(line, { strict: settings.strict });
    if (a.rewritten) { send = a.line; note = `${a.line}   (${a.note})`; }
  }
  con.echo(req.prompt, line, note);
  const r = game.send(send);
  handle(r, line);
}

function handle(r, typedLine) {
  // text: everything but the trailing prompt
  const segs = r.segments.slice();
  if (segs.length && segs[segs.length - 1].t === 'prompt' && r.request) segs.pop();
  const text = segs.map((s) => s.s).join('');
  con.write(text.replace(/^\n+/, '\n'), game.room(game.position).name);
  if (typedLine && /^\s*(north|south|east|west|n|s|e|w|go north|go south)\b/i.test(typedLine) && /How's that\?/.test(text)) {
    con.note('Battlestar has no compass directions: move with ahead, back, left, right, up and down.');
  }
  lastPrompt = r.request?.kind === 'line' ? r.request.prompt : lastPrompt;
  con.setPrompt(lastPrompt);
  events(r.events);
  noteEvents(game, r.events);
  refreshUI(r.events);
  if (r.request?.kind === 'flight') startFlight(r.request.sim);
  if (r.ended) gameOver(r);
  else if (game.atMainPrompt) {
    const snap = game.snapshot();
    store.autosave(snap, { room: game.position, turn: game.ourtime, seed: game.seed, username: game.username, name: game.room(game.position).name });
  }
  if (!$('hint-panel').hidden) showHint();
}

function events(evs) {
  if (!stage) { for (const e of evs) sound.event(e); return; }
  for (const e of evs) {
    sound.event(e);
    switch (e.type) {
      case 'explosions': stage.fx('shake', { amount: 0.5 }); break;
      case 'shipExplodes': case 'bomb': case 'gasExplosion': case 'fire':
        stage.fx('flash', { amount: 1, color: [1, 0.85, 0.6] }); stage.fx('shake', { amount: 1.5 }); break;
      case 'grenade': stage.fx('flash', { amount: 0.7, color: [1, 0.8, 0.5] }); stage.fx('shake', { amount: 1 }); break;
      case 'crash': stage.fx('flash', { amount: 1, color: [1, 0.6, 0.3] }); stage.fx('shake', { amount: 1.6 }); break;
      case 'strike': stage.fx('flash', { amount: 0.25, color: [1, 1, 1] }); stage.fx('shake', { amount: 0.3 }); break;
      case 'wounded': stage.fx('flash', { amount: 0.45, color: [0.8, 0.05, 0.02] }); stage.fx('shake', { amount: 0.7 }); break;
      case 'match': stage.fx('flash', { amount: 0.15, color: [1, 0.7, 0.3] }); break;
      case 'wizard': case 'win': stage.fx('flash', { amount: 0.8, color: [1, 0.85, 0.45] }); break;
      case 'die': stage.fx('flash', { amount: 0.9, color: [0.3, 0.0, 0.0] }); break;
      case 'launch': stage.fx('shake', { amount: 1.0 }); break;
      default: stage.fx(e.type, e);
    }
  }
}

function refreshUI(evs = []) {
  if (!game) return;
  panel.update(game);
  const spec = composeRoom(game);
  document.body.className = document.body.className.replace(/\bbiome-\w+/g, '').replace(/\bnight\b/g, '').trim();
  document.body.classList.add(`biome-${spec.biome}`);
  if (spec.night) document.body.classList.add('night');
  document.body.classList.toggle('flying', spec.flying);
  document.body.classList.toggle('hc', settings.contrast);
  document.body.classList.toggle('reduce-motion', settings.motion);
  $('where-room').textContent = spec.light.dark ? 'Darkness' : spec.name;
  $('where-time').textContent = `turn ${game.ourtime} · ${skyText(game)}`;
  const title = document.querySelector('#scene-title .t-room');
  title.textContent = spec.light.dark ? "It's too dark to see anything in here!" : spec.name.replace(/\.$/, '');
  document.querySelector('#scene-title .t-sub').textContent = `${BIOME_LABEL[spec.biome]} · ${spec.night ? 'night' : spec.biome === 'ship' || spec.biome === 'space' || spec.biome === 'cave' ? `turn ${game.ourtime}` : 'day'}`;
  renderExits(spec);
  if (quality === 'text') {
    $('scene-fallback').innerHTML = '';
    const d = document.createElement('div');
    d.textContent = spec.light.dark ? "It's too dark to see anything in here!" : spec.name;
    $('scene-fallback').append(d);
  }
  if (stage && !flight) {
    const mv = [...evs].reverse().find((e) => e.type === 'move' || e.type === 'teleport' || e.type === 'launch' || e.type === 'land' || e.type === 'sleep');
    if (mv && (mv.type === 'move')) stage.show(spec, mv.verb || 'ahead');
    else if (mv && mv.type === 'launch') stage.show(spec, 'up');
    else if (mv && mv.type === 'land') stage.show(spec, 'down');
    else if (mv && mv.type === 'teleport') stage.show(spec, null, 'teleport');
    else if (mv && mv.type === 'sleep') stage.show(spec, null, 'sleep');
    else stage.refresh(spec);
  }
  sound.setScene(spec);
}

function renderExits(spec) {
  const box = $('exits');
  box.textContent = '';
  if (!game || ended || spec.light.dark && !spec.light.match) return;
  const ex = relativeExits(game);
  for (const k of ['ahead', 'left', 'right', 'back', 'up', 'down']) {
    if (!ex[k]) continue;
    const b = document.createElement('button');
    b.className = `ex-${k}`;
    b.textContent = { ahead: '▲ ahead', back: '▼ back', left: '◀ left', right: 'right ▶', up: '⤒ up', down: '⤓ down' }[k];
    b.title = `Type “${k}”`;
    b.addEventListener('click', () => { submit(k, false); con.focus(); });
    box.append(b);
  }
}

// ---------------------------------------------------------------- dogfight
function startFlight(sim) {
  document.body.classList.add('flight-on');
  $('flight-hud').hidden = false;
  $('fh-mode').textContent = settings.turnBased ? ' · turn-based' : '';
  if (stage) stage.setFlight(sim, { reducedMotion: settings.motion });
  con.note('DOGFIGHT — the command line is paused; steer with the arrow keys, F to fire, Q to break off.');
  flight = new FlightController(sim, {
    turnBased: settings.turnBased,
    autopilot: autoplay ? autopilotKey : null,
    onChange: (v, k) => {
      const m = v.messages.at(-1);
      $('fh-msg').textContent = v.done ? (v.outcome === 'destroyed' ? 'Target destroyed' : v.outcome === 'quit' ? 'Breaking off' : 'Out of time')
        : m ? m.text.replace(/\*/g, '').trim() : `torpedoes ${v.torps} · fuel ${v.fuel} · clock ${v.clock}`;
      sound.flight(v, k);
      if (stage?.cockpit) stage.cockpit.onChange?.(v, k);
    },
    onDone: () => {
      setTimeout(() => {
        flight?.dispose();
        flight = null;
        document.body.classList.remove('flight-on');
        $('flight-hud').hidden = true;
        if (stage) stage.setFlight(null);
        const r = game.resumeFlight();
        handle(r, null);
        con.focus();
      }, settings.motion ? 300 : 1400);
    },
  });
}

// ---------------------------------------------------------------- end of game
function gameOver(r) {
  ended = true;
  reportGameOver(game, r.endKind);
  stopAutoplay();
  const p = game.scorePost;
  if (p) store.post({ ...p, seed: game.seed });
  store.clearAutosave();
  const won = r.endKind === 'won';
  $('end-title').textContent = won ? 'You win!' : r.endKind === 'quit' ? 'Game over' : 'You have died';
  const tail = con.log.innerText.split('\n').slice(-14).join('\n');
  $('end-text').textContent = `${tail}\n\nPLEASURE ${game.pleasure} · POWER ${game.power} · EGO ${game.ego}\nRating: ${game.rate()} in ${game.ourtime} turns${game.cheated ? '\n[Override was used: this score is marked as cheated.]' : ''}`;
  setTimeout(() => $('dlg-end').showModal(), won ? 1600 : 900);
}

$('dlg-end').addEventListener('close', () => {
  const v = $('dlg-end').returnValue;
  if (v === 'scores') {
    const list = store.fame().slice(-15).reverse();
    con.note('— Hall of fame —');
    for (const e of list) con.note(`${new Date(e.at).toLocaleDateString()}  ${e.ch === '!' ? '!' : ' '} ${String(e.rating).padEnd(18)} ${e.username || 'player'}  ${e.wizard}${e.cheated ? ' [cheated]' : ''}`);
  }
  openTitle();
});

// ---------------------------------------------------------------- hints & autoplay
function showHint() {
  if (!game) return;
  const h = nextHint(game, flight ? { kind: 'flight' } : game.request);
  const p = $('hint-panel');
  p.querySelector('.hint-goal').textContent = h.goal;
  p.querySelector('.hint-why').textContent = h.why;
  p.querySelector('.hint-cmd code').textContent = h.cmd ?? '—';
  $('hint-do').disabled = !h.cmd && h.cmd !== '';
}
function toggleHints(force) {
  const p = $('hint-panel');
  p.hidden = force === undefined ? !p.hidden : !force;
  if (!p.hidden) showHint();
}
$('btn-hints').addEventListener('click', () => toggleHints());
document.querySelector('[data-close="hint-panel"]').addEventListener('click', () => toggleHints(false));
$('hint-do').addEventListener('click', () => {
  const h = nextHint(game, game.request);
  if (h.cmd !== null && h.cmd !== undefined) submit(h.cmd, false);
  con.focus();
});
$('hint-auto').addEventListener('click', () => (autoplay ? stopAutoplay() : startAutoplay()));
function startAutoplay() {
  noteAutoplayUsed();
  $('hint-auto').setAttribute('aria-pressed', 'true');
  autoplay = setInterval(() => {
    if (!game || ended) return stopAutoplay();
    if (flight) return;
    const h = nextHint(game, game.request);
    if (h.cmd === null || h.cmd === undefined) return stopAutoplay();
    submit(h.cmd, false);
  }, +params.get('autodelay') || (settings.motion ? 700 : 1300));
}
function stopAutoplay() {
  clearInterval(autoplay);
  autoplay = null;
  $('hint-auto').setAttribute('aria-pressed', 'false');
}

// ---------------------------------------------------------------- Override
let worldPick = null;
function openOverride() {
  const d = $('dlg-override');
  for (const cb of d.querySelectorAll('[data-flag]')) cb.checked = !!game?.ovr[cb.dataset.flag];
  $('ovr-reveal').checked = panel.reveal;
  worldPick = drawWorldMap($('worldmap'), game, panel.reveal);
  d.showModal();
}
$('btn-override').addEventListener('click', openOverride);
for (const cb of document.querySelectorAll('#dlg-override [data-flag]')) {
  cb.addEventListener('change', () => {
    if (!game) return;
    game.setOverrides({ [cb.dataset.flag]: cb.checked });
    refreshUI();
  });
}
$('ovr-reveal').addEventListener('change', (e) => {
  panel.reveal = e.target.checked;
  if (e.target.checked && game) game.cheated = true;
  worldPick = drawWorldMap($('worldmap'), game, panel.reveal);
  refreshUI();
});
$('ovr-daynight').addEventListener('click', () => {
  if (!game?.atMainPrompt) { con.note('Override actions work only between commands.'); return; }
  const r = game.override('daynight');
  if (r) handle(r, null);
  worldPick = drawWorldMap($('worldmap'), game, panel.reveal);
});
$('worldmap').addEventListener('click', (e) => {
  if (!game || !worldPick) return;
  const rect = e.target.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (e.target.width / rect.width);
  const y = (e.clientY - rect.top) * (e.target.height / rect.height);
  const room = worldPick(x, y);
  if (!room) return;
  if (!game.atMainPrompt) { con.note('Override actions work only between commands.'); return; }
  const r = game.override('teleport', room);
  if (r) handle(r, null);
  worldPick = drawWorldMap($('worldmap'), game, panel.reveal);
});
$('btn-map').addEventListener('click', openOverride);

// ---------------------------------------------------------------- saves, settings, help
$('btn-save').addEventListener('click', () => {
  if (!game?.atMainPrompt) { con.note('You can save between commands.'); return; }
  con.focus();
  submit('save', false);
});
$('btn-load').addEventListener('click', () => {
  const ul = $('save-list');
  ul.textContent = '';
  const list = store.list();
  if (!list.length) ul.innerHTML = '<li class="empty">No saved games yet.</li>';
  for (const e of list) {
    const li = document.createElement('li');
    li.innerHTML = '<div class="meta"><b></b><br><span></span></div><button type="button" class="primary">Load</button><button type="button">Delete</button>';
    li.querySelector('b').textContent = e.name;
    li.querySelector('span').textContent = `room ${e.room} · turn ${e.turn} · ${new Date(e.at).toLocaleString()}`;
    li.querySelectorAll('button')[0].addEventListener('click', () => {
      const snap = store.load(e.name);
      $('dlg-saves').close();
      if (snap) newGame({ snapshot: snap, resume: 'start', username: e.username, seed: e.seed });
    });
    li.querySelectorAll('button')[1].addEventListener('click', () => { store.remove(e.name); li.remove(); });
    ul.append(li);
  }
  $('dlg-saves').showModal();
});
$('btn-new').addEventListener('click', openTitle);
$('btn-help').addEventListener('click', () => $('dlg-help').showModal());
$('btn-settings').addEventListener('click', () => {
  const d = $('dlg-settings');
  for (const r of d.querySelectorAll('[name=quality]')) r.checked = r.value === (settings.quality === 'auto' ? quality : settings.quality);
  $('s-contrast').checked = settings.contrast;
  $('s-motion').checked = settings.motion;
  $('s-turnbased').checked = settings.turnBased;
  $('s-strict').checked = settings.strict;
  $('s-gpu').textContent = gpuInfo.ok ? `Renderer: ${gpuInfo.name}${gpuInfo.software ? ' (software — Low quality chosen automatically)' : ''}${stage ? ` · ${stage.info().fps} fps` : ''}` : 'WebGL2 is not available: text mode.';
  d.showModal();
});
$('dlg-settings').addEventListener('close', () => {
  const d = $('dlg-settings');
  const q = [...d.querySelectorAll('[name=quality]')].find((r) => r.checked)?.value || settings.quality;
  const needReload = q !== (settings.quality === 'auto' ? quality : settings.quality) || $('s-motion').checked !== settings.motion;
  settings.quality = q;
  settings.contrast = $('s-contrast').checked;
  settings.motion = $('s-motion').checked;
  settings.turnBased = $('s-turnbased').checked;
  settings.strict = $('s-strict').checked;
  store.saveSettings(settings);
  if (stage) stage.highContrast = settings.contrast;
  refreshUI();
  if (needReload) location.reload();
});
$('btn-sound').addEventListener('click', () => {
  settings.sound = !settings.sound;
  sound.setMuted(!settings.sound);
  $('btn-sound').setAttribute('aria-pressed', String(settings.sound));
  $('btn-sound').querySelector('use').setAttribute('href', settings.sound ? '#i-sound-on' : '#i-sound-off');
  $('btn-sound').querySelector('span').textContent = settings.sound ? 'Sound on' : 'Sound off';
  $('btn-sound').title = settings.sound ? 'Sound is on — click to mute' : 'Sound is off — click to unmute';
  if (game) sound.setScene(composeRoom(game));
});

// ---------------------------------------------------------------- keyboard
function consoleKey(e) {
  if (e.key === '`' && !e.shiftKey) { e.preventDefault(); toggleHints(); return true; }
  if (e.key === '~' || (e.key === '`' && e.shiftKey)) { e.preventDefault(); openOverride(); return true; }
  return false;
}
window.addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return; // already handled by the command line (consoleKey)
  if (flight) return;
  if (document.querySelector('dialog[open]')) return;
  if (e.key === 'F1') { e.preventDefault(); $('dlg-help').showModal(); return; }
  if (e.key === '`' && !e.shiftKey) { e.preventDefault(); toggleHints(); return; }
  if (e.key === '~' || (e.key === '`' && e.shiftKey)) { e.preventDefault(); openOverride(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') { e.preventDefault(); openOverride(); return; }
  if (e.key === 'Escape') { toggleHints(false); return; }
  if (document.activeElement !== $('cmd') && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) con.focus();
});

// ---------------------------------------------------------------- title / start
function openTitle() {
  const d = $('dlg-title');
  const auto = store.autoload();
  $('b-continue').hidden = !auto;
  if (auto) $('b-continue').textContent = `Continue — ${auto.meta?.name || 'your game'} (turn ${auto.meta?.turn ?? '?'})`;
  $('f-seed').value = params.get('seed') || String(Math.floor(Math.random() * 30000) + 1);
  $('f-user').value = params.get('wizard') === '1' ? 'riggle' : (params.get('user') || '');
  d.showModal();
}
$('dlg-title').addEventListener('close', () => {
  const v = $('dlg-title').returnValue;
  if (v === 'continue') {
    const auto = store.autoload();
    if (auto) { newGame({ snapshot: auto.snapshot, resume: 'prompt', username: auto.meta?.username, seed: auto.meta?.seed }); con.focus(); return; }
  }
  const seed = parseInt($('f-seed').value, 10) || undefined;
  newGame({ seed, username: $('f-user').value.trim().toLowerCase() });
  con.focus();
});

// ---------------------------------------------------------------- boot
await initRenderer();
sound.setMuted(!settings.sound);
if (params.get('autostart') === '1' || params.get('fresh') === '1') {
  newGame({ seed: parseInt(params.get('seed'), 10) || 1, username: params.get('wizard') === '1' ? 'riggle' : (params.get('user') || '') });
} else openTitle();

// A small scripting surface for the screenshot and smoke scripts.
window.__bs = {
  get game() { return game; },
  get stage() { return stage; },
  send: (line) => submit(line, false),
  newGame,
  teleport: (room) => { const r = game.override('teleport', room); if (r) handle(r, null); },
  hint: () => nextHint(game, game.request),
  refresh: () => refreshUI(),
  mapPoint: (room) => worldPick?.where(room) ?? null,
  sound: () => ({ muted: sound.muted, state: sound.ctx?.state ?? 'none', bed: sound.bed?.key ?? null, ...sound.level() }),
  play: (recipe) => sound.play(recipe),
  spec: () => composeRoom(game),
  quality: () => quality,
  /** Screenshot hook: put the player somewhere without the Override mark. */
  place({ room, night, facing, items = [], worn = [], dark = false, time, rested = true } = {}) {
    const g = game;
    if (night !== undefined && night !== g.isNight) g.convert(night ? C.TONIGHT : C.TODAY);
    if (time !== undefined) { g.ourtime = time; g.rythmn = time - (time % 100); }
    // a posed scene shows a fed, rested player unless asked otherwise
    if (rested) { g.snooze = Math.max(g.snooze, g.ourtime + 100); g.ate = Math.max(g.ate, g.ourtime + 50); }
    g.position = room;
    if (facing) g.direction = { n: C.NORTH, s: C.SOUTH, e: C.EAST, w: C.WEST }[facing] || facing;
    g.inven.fill(0);
    g.wear.fill(0);
    for (const o of items) g.inven[o >> 5] |= 1 << (o & 31);
    for (const o of worn) g.wear[o >> 5] |= 1 << (o & 31);
    g.notes[C.CANTSEE] = dark ? 1 : 0;
    g.notes[C.LAUNCHED] = g.room(room).link[7] ? 1 : 0;
    g.beenthere[room] = Math.max(1, g.beenthere[room]);
    g.whichway(g.room(room));
    con.write(`
	${g.room(room).name}
`, g.room(room).name);
    refreshUI();
    if (stage) stage.show(composeRoom(g), null, 'instant');
  },
};
window.__ready = true;
