// Broadside inside /usr/games Reborn. The Hall runs this page in a frame and listens over the
// bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge script
// is missing or reports `hosted: false`, and every call below does nothing.
//
// What the Hall hears comes from what the game already knows: the events each turn resolves to,
// and the result the engine settles on when a battle ends (engine/turn.js, checkEnd).

const hall = globalThis.UsrGamesBridge?.connectToHall({ id: 'sail' }) ?? null;
const installed = new Set();
const XP_PER_SHIP_TAKEN = 8;
const GALE = 5;
const FLEET_ACTION = 10;

// The Hall's Game menu reloads this page. The game keeps a battle in sessionStorage so that its
// own quality switch (a navigation, not a reload) can carry on; after a reload asked for by the
// Hall, the player wants the scenario list instead.
if (hall?.hosted && performance.getEntriesByType('navigation')[0]?.type === 'reload') {
  try {
    sessionStorage.removeItem('broadside.battle');
  } catch {
    // Storage may be unavailable; the game then never resumes anyway.
  }
}

function install(id) {
  if (!hall || installed.has(id)) return;
  installed.add(id);
  hall.achievement(id);
}

// The scenario list is the game menu: Escape there leads back to the Hall. The same overlay also
// shows the ship choice and the top ten, which are steps inside the game, and the help overlay
// can open over it (Escape then closes the help, not the game).
const menu = document.getElementById('menu');
const help = document.getElementById('help');
let onTitle = null;
function watchTitle() {
  const helpOpen = !!help?.classList.contains('open');
  const active = !helpOpen && menu.classList.contains('open') && !!menu.querySelector('[data-sc]');
  if (active === onTitle) return;
  onTitle = active;
  hall?.setTitleScreen(active);
}
if (hall?.hosted && menu) {
  const observer = new MutationObserver(watchTitle);
  observer.observe(menu, { attributes: true, attributeFilter: ['class'], childList: true });
  if (help) observer.observe(help, { attributes: true, attributeFilter: ['class'] });
  watchTitle();
  // The help closes on Escape without marking the key as used; mark it here, before anything
  // else sees it, so the bridge does not also take it as a trip back to the Hall.
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && help?.classList.contains('open')) event.preventDefault();
    },
    { capture: true },
  );
}

let battle = null;

export function noteBattleStarted() {
  battle = { startedAt: performance.now(), shipsTaken: 0, broadsidesFired: 0 };
}

/** The events of one resolved turn; `me` is the player's ship index. */
export function noteTurn(events, me) {
  if (!battle) return;
  for (const event of events) {
    if (event.t === 'fire' && event.from === me) {
      battle.broadsidesFired += 1;
      install('open-fire');
      if (event.rake) install('down-her-length');
      if (event.sternrake) install('stern-rake');
    }
    if ((event.t === 'strike' || event.t === 'capture') && event.by === me) {
      battle.shipsTaken += 1;
      install(event.t === 'strike' ? 'colours-come-down' : 'prize-crew');
      if (battle.shipsTaken >= 2) install('a-brace-of-prizes');
    }
  }
}

const OUTCOMES = {
  victory: 'win',
  captured: 'loss',
  lost: 'loss',
  struck: 'loss',
  nightfall: 'draw',
  hurricane: 'draw',
  quit: 'quit',
};

export function reportBattle(st, me) {
  if (!hall || !battle) return;
  const reason = st.result?.reason;
  const outcome = OUTCOMES[reason] ?? 'complete';
  if (outcome === 'win') {
    install('the-day-is-yours');
    if (st.windspeed >= GALE) install('heavy-weather');
    if (st.ships.length >= FLEET_ACTION) install('line-of-battle');
  }
  if (outcome !== 'quit') install('see-it-through');
  const { shipsTaken, broadsidesFired } = battle;
  hall.result({
    outcome,
    score: Math.max(0, Math.round(st.ships[me]?.points ?? 0)),
    stats: { shipsTaken, broadsidesFired, turns: st.turn },
    xpEvents:
      shipsTaken > 0 ? [{ id: 'ships-taken', xp: Math.min(25, shipsTaken * XP_PER_SHIP_TAKEN) }] : [],
    durationSeconds: Math.round((performance.now() - battle.startedAt) / 1000),
  });
  battle = null;
}

// Key art for the Hall: the fleets at sea a few seconds into the first battle, once the opening
// sweep has settled. Before any battle the Hall shows its own key art for the game.
const POSTER_AFTER_MS = 7000;
let posterSent = false;

export function posterWanted() {
  return (
    !!hall?.hosted &&
    !posterSent &&
    !!battle &&
    performance.now() - battle.startedAt > POSTER_AFTER_MS
  );
}

/** Call right after drawing the canvas, in the same task (see the bridge's posterFromCanvas). */
export function offerPoster(canvas) {
  posterSent = true;
  hall.posterFromCanvas(canvas);
}
