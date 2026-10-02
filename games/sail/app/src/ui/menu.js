// The historical actions (scenario and ship selection), the top ten and help.
// Mirrors the original's start-up dialogue (sail/pl_main.c:64-254):
// scenario list -> ship list -> "Your name, Captain?" -> initial broadsides.
// The game menu itself and the battle report live in src/career/.

import {
  SCENARIOS, SPECS, COUNTRY, CLASS_NAME, QUAL_NAME, FEATURED, STAGED, PLAYABLE,
} from '../engine/index.js';
import { recordScore, formatBoard } from '../engine/scoreboard.js';
import { NATION_COLOR } from '../render/tactical.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BOARD_KEY = 'broadside.topTen.v1';

export function loadBoard() {
  try { return JSON.parse(localStorage.getItem(BOARD_KEY) || '[]'); } catch { return []; }
}
function saveBoard(b) {
  try { localStorage.setItem(BOARD_KEY, JSON.stringify(b)); } catch { /* private mode */ }
}

export function open(id) {
  const el = $(id);
  el.classList.add('open');
  const f = el.querySelector('button, input, select');
  if (f) setTimeout(() => f.focus(), 30);
}
export function close(id) { $(id).classList.remove('open'); }

// Escape on a page behind the game menu goes back a step; the key is marked as used so the
// Hall's bridge does not take it as a trip home.
function backOnEscape(el, onBack) {
  el.onkeydown = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    onBack();
  };
}

// Step 1: the scenario list, the historical actions page of the game menu.
export function showScenarios(onChoose, onBack) {
  const playable = new Set(PLAYABLE.map((f) => f.id));
  const el = $('menu');
  el.innerHTML = `<div class="panel rivets">
    <div class="deck-head"><button class="btn" id="histBack">← Game menu</button>
    <h1 id="menuTitle">Historical Actions</h1><span class="deck-meta"></span></div>
    <p class="tag">Any action of the original, from any ship and either side. Points from these battles go into the top ten.</p>
    <div class="featured">${FEATURED.map((f) => {
      const sc = SCENARIOS[f.id];
      return `<button class="card" data-sc="${f.id}"><span class="n">${f.id})</span> <b>${esc(sc.name)}</b><br>
        <span class="n">${f.tag} · ${f.year} · ${sc.ships.length} ships · wind ${sc.windspeed}</span>
        <small>${esc(f.blurb)}</small></button>`;
    }).join('')}</div>
    <details><summary>More historical actions (${STAGED.length})</summary>
      <div class="more">${[...STAGED].sort((a, b) => a.year - b.year).map((f) => {
        const sc = SCENARIOS[f.id];
        return `<button class="card small" data-sc="${f.id}" title="${esc(f.blurb)}"><span class="n">${f.year}</span> <b>${esc(sc.name)}</b><br>
          <span class="n">${f.tag} · ${sc.ships.length} ships · wind ${sc.windspeed}</span></button>`;
      }).join('')}</div>
    </details>
    <details><summary>All 32 scenarios of the original</summary>
      <p class="tag">Numbers and names as in <span class="kbd">sail</span>'s menu. The historical actions are staged; the fictional ones (the Flying Dutchman, Star Trek, …) run in the engine's test suite and will open when they get their own staging (ADR 003).</p>
      <div class="scen">${SCENARIOS.map((sc) => `<span class="n">${sc.id})</span><span>${sc.ships.length}</span>
        <button data-sc="${sc.id}" ${playable.has(sc.id) ? '' : 'disabled title="Not staged in this release"'}>${esc(sc.name)}</button>`).join('')}</div>
    </details>
  </div>`;
  el.querySelectorAll('[data-sc]').forEach((b) => { b.onclick = () => showShips(+b.dataset.sc, onChoose, onBack); });
  $('histBack').onclick = onBack;
  backOnEscape(el, onBack);
  open('menu');
}

// Step 2: "Which ship?" then captain and initial broadsides.
function showShips(id, onChoose, onBack) {
  const sc = SCENARIOS[id];
  const el = $('menu');
  el.innerHTML = `<div class="panel rivets">
    <h1 id="menuTitle">${esc(sc.name)}</h1>
    <p class="tag">Scenario ${id} · wind ${sc.windspeed} · choose your ship</p>
    <table class="ships"><thead><tr><th>#</th><th>Nation</th><th>Ship</th><th>Class</th><th>Guns</th><th>Crew</th><th>Pts</th><th></th></tr></thead><tbody>
    ${sc.ships.map((s, i) => {
      const sp = SPECS[s.spec];
      return `<tr><td>${i}</td><td><span class="glyph" style="background:${NATION_COLOR[s.nationality]}">${COUNTRY[s.nationality][0].toLowerCase()}</span> ${COUNTRY[s.nationality]}</td>
        <td><b>${esc(s.name)}</b></td><td>${CLASS_NAME[sp.class]}</td><td>${sp.guns}</td><td>${QUAL_NAME[sp.qual]}</td><td>${sp.pts}</td>
        <td><button class="btn" data-ship="${i}">Take command</button></td></tr>`;
    }).join('')}</tbody></table>
    <div id="captainForm" style="margin-top:12px; display:none">
      <p><label>Your name, Captain? <input id="captain" value="${esc(localStorage.getItem('broadside.captain') || 'Hornblower')}" maxlength="19"></label></p>
      <p>Initial broadsides (loaded with care before battle — a little more effective):
        <label>port <select id="initL">${['round', 'double', 'chain', 'grape'].map((w) => `<option>${w}</option>`).join('')}</select></label>
        <label>starboard <select id="initR">${['round', 'double', 'chain', 'grape'].map((w) => `<option>${w}</option>`).join('')}</select></label></p>
      <p><button class="btn primary" id="sail">Set sail</button> <button class="btn" id="back">Back</button></p>
    </div>
  </div>`;
  let ship = null;
  el.querySelectorAll('[data-ship]').forEach((b) => {
    b.onclick = () => {
      ship = +b.dataset.ship;
      el.querySelectorAll('[data-ship]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      $('captainForm').style.display = 'block';
      $('captain').focus();
      $('captain').select();
    };
  });
  const go = () => {
    const captain = $('captain').value.trim() || 'no name';
    try { localStorage.setItem('broadside.captain', captain); } catch { /* ignore */ }
    close('menu');
    onChoose({ scenarioId: id, playerShip: ship, captain, initialLoad: { L: $('initL').value, R: $('initR').value } });
  };
  el.querySelector('#captainForm').addEventListener('keydown', (e) => { if (e.key === 'Enter' && ship !== null) go(); });
  $('sail').onclick = go;
  $('back').onclick = () => showScenarios(onChoose, onBack);
  backOnEscape(el, () => showScenarios(onChoose, onBack));
  open('menu');
}

export function showBoard(onBack) {
  const el = $('menu');
  const lines = formatBoard(loadBoard(), { logins: true });
  el.innerHTML = `<div class="panel rivets"><h1 id="menuTitle">Top Ten Sailors</h1>
    <p class="tag">Ranked by net points — points won ÷ your own ship's value — as in <span class="kbd">sail -s -l</span>.</p>
    <pre style="font-family:var(--mono);font-size:14px;white-space:pre-wrap">${lines.map(esc).join('\n')}</pre>
    <button class="btn" id="bBack">← Game menu</button></div>`;
  $('bBack').onclick = onBack;
  backOnEscape(el, onBack);
  open('menu');
}

export function showHelp() {
  const el = $('help');
  el.innerHTML = `<div class="panel rivets" style="max-width:820px">
    <h1 id="helpTitle">How to command</h1>
    <p class="tag">Each turn you give orders, then press <b>Make it so</b> (or Enter on an empty command line). Your broadsides fire first, at the positions you see; then every ship moves; then the computer captains fire; then boarders fight.</p>
    <h3>Helm (the original grammar)</h3>
    <p><span class="kbd">3</span> three squares ahead · <span class="kbd">l</span>/<span class="kbd">r</span> turn left/right (the bow stays put, the stern swings) · <span class="kbd">l1r1r2</span> compound · <span class="kbd">d</span> drift.
    The prompt <span class="kbd">move (7, 4)</span> is your allowance: moves including turns, and turns. A <span class="kbd">'</span> means you are drifting and must make headway before turning more than once. You cannot sail into the wind; turning closer to it cuts your allowance.</p>
    <h3>Command line</h3>
    <p><span class="kbd">f l h</span> fire port at the hull · <span class="kbd">f r r</span> starboard at the rigging · <span class="kbd">f</span> both ·
       <span class="kbd">ld l d</span> load port with double (2 turns) · <span class="kbd">ld b r</span> both with round · <span class="kbd">L</span> unload ·
       <span class="kbd">c</span> battle/full sails · <span class="kbd">rp h</span> repair hull (all hands: no firing, loading, sail change or turning) ·
       <span class="kbd">g b0</span> grapple · <span class="kbd">g b0 u</span> ungrapple · <span class="kbd">u b0</span> unfoul · <span class="kbd">b b0 2</span> board with 2 sections · <span class="kbd">b repel 1</span> · <span class="kbd">B</span> recall ·
       <span class="kbd">i</span> / <span class="kbd">I</span> identify · <span class="kbd">F f?</span> lookout.</p>
    <h3>Shot</h3>
    <p>Round (range 10) · double (range 1, two turns to load, extra effective) · chain (range 3, rigging only) · grape (range 1, crews). Beyond range 6 you can only aim at the rigging. Carronades reach 2. Raking fire down the length of a ship is deadly — from astern most of all. Full sails double the rigging damage you take.</p>
    <h3>Keys</h3>
    <p><span class="kbd">/</span> command line · <span class="kbd">Enter</span> on an empty line: make it so · <span class="kbd">Space</span>/<span class="kbd">Esc</span> skip the cinematic · <span class="kbd">T</span> chart view · <span class="kbd">Q</span> quality · <span class="kbd">M</span> sound · <span class="kbd">←→↑↓</span> orbit · <span class="kbd">+</span>/<span class="kbd">−</span> zoom · <span class="kbd">1</span>–<span class="kbd">9</span> look at a ship · <span class="kbd">0</span> your ship · <span class="kbd">?</span> this page. Mouse: drag to orbit (chart: pan), wheel to zoom, click a ship to look at it.</p>
    <p><button class="btn" id="helpClose">Close</button></p></div>`;
  $('helpClose').onclick = () => close('help');
  el.onkeydown = (e) => { if (e.key === 'Escape') close('help'); };
  open('help');
}

/** Enter a finished battle in the top ten, as the original's log did. Returns the board and the
 *  captain's place in it (-1 when not entered). */
export function recordInTopTen(st, me) {
  let board = loadBoard();
  if (!me) return { board, rank: -1 };
  const res = recordScore(board, {
    captain: me.captain || 'no name', login: 'you', ship: me.name, scenario: st.name,
    points: me.points, shipPts: me.max.pts, date: new Date().toISOString().slice(0, 10),
  });
  board = res.board;
  saveBoard(board);
  return { board, rank: res.rank };
}
