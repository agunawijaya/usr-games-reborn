// Control Room 1986 inside /usr/games Reborn. The Hall runs this page in a frame and listens over
// the bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge
// script is missing or reports `hosted: false`, and every call below does nothing.
//
// What the Hall hears comes from the engine's own tick events and from the commands the player
// types, both passed on by main.js. A shift has no winning state: it runs until a plane is lost,
// so a shift that brought at least one plane home counts as a win (ADR 0011). The cheat panel only
// suggests what to type; the player still types every command, so it does not change what a
// shift earns.

const hall = globalThis.UsrGamesBridge?.connectToHall({ id: 'atc-classic' }) ?? null;
const installed = new Set();
const XP_PER_PLANE = 3;
/** main.js has a pilot call "minimum fuel" once a plane in the air is down to this much fuel. */
const MINIMUM_FUEL = 6;
const STEADY_SHIFT = 5;
const FULL_BOARD = 10;
const DOUBLE_SHIFT = 25;

function install(id) {
  if (!hall || installed.has(id)) return;
  installed.add(id);
  hall.achievement(id);
}

// The title screen is the game menu: Escape there leads back to the Hall. The game hides it for
// good when the first shift begins (the "hiding" class, then display: none); later shifts start
// straight from the loss screen. Its help overlay opens only once a shift is under way, and the
// game marks the Escape that closes it as handled, so the bridge leaves that key alone.
const title = document.getElementById('title-screen');
if (hall?.hosted && title) {
  const report = () => hall.setTitleScreen(!title.classList.contains('hiding'));
  new MutationObserver(report).observe(title, { attributes: true, attributeFilter: ['class'] });
  report();
}

let shift = null;

/**
 * Called by startNewGame once the new shift's first plane is on the radar. A shift that was still
 * running is being abandoned (the sidebar's sector buttons start a new one at once): it reports
 * as quit, unless not a single tick had passed.
 */
export function noteShiftStarted(game) {
  if (shift && shift.game.clock > 0) reportShift(shift, 'quit');
  shift = {
    game,
    sector: game.playfield.name,
    startedAt: performance.now(),
    landings: 0,
    exits: 0,
    // Flights the packages follow, by radar letter. A letter returns only after its plane has
    // gone, so each set forgets a letter when its plane arrives or a new one takes it.
    circled: new Set(),
    beaconBound: new Set(),
    lowOnFuel: new Set(),
  };
}

/** After every command the engine accepted. */
export function noteCommand(cmd, plane) {
  if (!shift) return;
  if (cmd.action === 'circle') shift.circled.add(plane.letter);
  if (cmd.action === 'towardsBeacon') shift.beaconBound.add(plane.letter);
}

function forgetFlight(letter) {
  shift.circled.delete(letter);
  shift.beaconBound.delete(letter);
  shift.lowOnFuel.delete(letter);
}

function noteArrival(letter) {
  if (shift.circled.has(letter)) install('holding-pattern');
  if (shift.beaconBound.has(letter)) install('on-the-beacon');
  if (shift.lowOnFuel.has(letter)) install('minimum-fuel');
  if (shift.sector === 'Killer') install('fast-lane');
  forgetFlight(letter);
}

function noteSafePlanes(safe) {
  if (safe >= STEADY_SHIFT) install('steady-hands');
  if (safe >= FULL_BOARD) install('full-board');
  if (safe >= DOUBLE_SHIFT) install('double-shift');
  if (safe >= STEADY_SHIFT && shift.sector === 'Default') install('reference-sector');
  if (safe >= STEADY_SHIFT && shift.sector === 'Killer') install('rush-hour');
}

/**
 * After every tick, with the events the engine returned. A tick that loses a plane counts
 * nothing: the engine stops before it adds that tick's arrivals to the score, so they do not count
 * here either.
 */
export function noteTick(game, events) {
  if (!shift || shift.game !== game || game.lost) return;
  for (const event of events) {
    if (event.type === 'spawn') forgetFlight(event.plane);
    if (event.type === 'takeoff') install('cleared-for-takeoff');
    if (event.type === 'land') {
      shift.landings += 1;
      install('wheels-down');
      noteArrival(event.plane);
    }
    if (event.type === 'exit') {
      shift.exits += 1;
      install('handed-off');
      noteArrival(event.plane);
    }
  }
  for (const plane of game.air) {
    if (plane.fuel <= MINIMUM_FUEL) shift.lowOnFuel.add(plane.letter);
  }
  noteSafePlanes(game.safePlanes);
}

function reportShift(record, outcome) {
  if (!hall) return;
  const planesSafe = record.game.safePlanes;
  const earnsXp = outcome !== 'quit' && planesSafe > 0;
  hall.result({
    outcome,
    score: planesSafe,
    stats: { planesSafe, landings: record.landings, exits: record.exits },
    xpEvents: earnsXp
      ? [{ id: 'planes-safe', xp: Math.min(25, planesSafe * XP_PER_PLANE) }]
      : [],
    durationSeconds: Math.round((performance.now() - record.startedAt) / 1000),
  });
}

/** Called by endGame: a plane was lost, which is the only way a shift ends on its own. */
export function noteShiftEnded(game) {
  if (!shift || shift.game !== game) return;
  reportShift(shift, game.safePlanes > 0 ? 'win' : 'loss');
  shift = null;
}

// Key art for the Hall: the radar a few seconds into the first shift, with a plane in the air.
const POSTER_AFTER_MS = 6000;
let posterSent = false;

export function posterWanted(game) {
  return (
    !!hall?.hosted &&
    !posterSent &&
    !!shift &&
    shift.game === game &&
    game.air.length > 0 &&
    performance.now() - shift.startedAt > POSTER_AFTER_MS
  );
}

/** Call right after drawing the radar, in the same task (see the bridge's posterFromCanvas). */
export function offerPoster(canvas) {
  posterSent = true;
  hall.posterFromCanvas(canvas);
}
