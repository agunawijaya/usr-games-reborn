// Deep-space command inside /usr/games Reborn. The Hall runs this page in a frame and listens
// over the bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge
// script is missing or reports `hosted: false`, and every call below does nothing.
//
// What the Hall hears comes from the game's own state, from the effects each command returns
// (engine.js) and from the settled mission (career/progress.js). Missions played with the override
// panel earn no packages, no XP events and no score.

const hall = globalThis.UsrGamesBridge?.connectToHall({ id: 'trek' }) ?? null;
const installed = new Set();
const XP_PER_SHIP = 2;
const XP_PER_COMMENDATION = 3;
const LOW_HULL = 25;
const CROWDED_QUADRANT = 3;

/** True inside the Hall's frame; on its own the game has no Hall to go back to. */
export const hostedInHall = Boolean(hall?.hosted);

/** The game menu's and the report's "Back to the Hall". */
export function leaveForHall() {
  hall?.navigate('hall');
}

function install(id) {
  if (!hall || installed.has(id)) return;
  installed.add(id);
  hall.achievement(id);
}

// The title screen's first page is the game menu: Escape there leads back to the Hall. The pages
// behind it (the tour, the patrol, a free mission, the record) and the help over it keep Escape
// for themselves, to go back a step.
const title = document.getElementById('title-screen');
const deck = document.getElementById('deck');
if (hall?.hosted && title && deck) {
  const report = () =>
    hall.setTitleScreen(title.classList.contains('shown') && (deck.dataset.page ?? 'menu') === 'menu');
  const watch = new MutationObserver(report);
  watch.observe(title, { attributes: true, attributeFilter: ['class'] });
  watch.observe(deck, { attributes: true, attributeFilter: ['data-page'] });
  report();
}

let session = null;

const quadrantOf = (game) => game.galaxy.quadrants[game.ship.qy][game.ship.qx];
const chartedQuadrants = (game) =>
  game.galaxy.quadrants.flat().filter((quadrant) => quadrant.scanned).length;

export function noteMissionStarted(game) {
  session = {
    startedAt: performance.now(),
    docked: false,
    lowestHull: game.ship.hull,
    crowdedQuadrant: null,
    chartedAtStart: chartedQuadrants(game),
  };
}

function noteEffect(effect) {
  if (effect.type === 'dock') {
    session.docked = true;
    install('safe-harbour');
  }
  if (effect.type === 'torpedo' && effect.destroyedKlingon) {
    install('true-aim');
    if (effect.destroyedKlingon.type === 'super') install('flagship-down');
  }
  if (effect.type === 'phaser') {
    const downed = effect.damages.filter((damage) => damage.destroyed);
    if (downed.length >= 2) install('double-volley');
    if (downed.some((damage) => damage.type === 'super')) install('flagship-down');
  }
}

/** After every command the game carried out. */
export function noteCommand(game, effects) {
  if (!session || game.cheated) return;
  for (const effect of effects) noteEffect(effect);
  if (game.kills >= 1) install('opening-volley');
  session.lowestHull = Math.min(session.lowestHull, game.ship.hull);
  // A quadrant counts as secured when one that held three or more hostiles is emptied.
  const here = quadrantOf(game);
  if (here.klingons >= CROWDED_QUADRANT) session.crowdedQuadrant = here;
  else if (session.crowdedQuadrant === here && here.klingons === 0) install('sector-secured');
  if (chartedQuadrants(game) === 64) install('full-survey');
}

function installCareerPackages(mission, summary) {
  const all = summary.earned.length > 0 && summary.earned.every(Boolean);
  if (all && mission.mode !== 'free') install('full-marks');
  if (mission.mode === 'tour' && mission.sortie.number === 1 && summary.earned[0]) install('first-sortie');
  if (mission.mode === 'daily' && summary.earned[0]) install('on-patrol');
  if (summary.rankAfter !== 'Ensign') install('promoted');
  if (summary.tourWon) install('tour-complete');
}

/**
 * The end of a mission: a win, a loss, or the player abandoning it. `mission` is its plan and
 * `summary` what settling it saved (career/progress.js).
 */
export function reportMission(game, won, mission, summary) {
  if (!hall || !session) return;
  const clean = !game.cheated;
  const outcome = won ? 'win' : game.lost ? 'loss' : 'quit';
  if (clean && won) {
    install('mission-accomplished');
    if (game.difficulty === 'standard') install('steady-hand');
    if (game.difficulty === 'expert') install('hardest-level');
    if (session.lowestHull <= LOW_HULL) install('hold-together');
    if (!session.docked) install('self-reliant');
  }
  if (clean) installCareerPackages(mission, summary);
  const shipsDisabled = clean ? game.kills : 0;
  const commendations = clean ? summary.earned.filter(Boolean).length : 0;
  const xpEvents = [];
  if (shipsDisabled > 0) xpEvents.push({ id: 'ships-disabled', xp: Math.min(25, shipsDisabled * XP_PER_SHIP) });
  if (commendations > 0) xpEvents.push({ id: 'commendations', xp: commendations * XP_PER_COMMENDATION });
  hall.result({
    outcome,
    ...(clean ? { score: game.kills } : {}),
    stats: {
      shipsDisabled,
      quadrantsCharted: clean ? Math.max(0, chartedQuadrants(game) - session.chartedAtStart) : 0,
      commendations,
    },
    xpEvents,
    daily: mission.mode === 'daily',
    durationSeconds: Math.round((performance.now() - session.startedAt) / 1000),
  });
  session = null;
}

// Key art for the Hall: the tactical view a few seconds into the first mission.
const POSTER_AFTER_MS = 6000;
let posterSent = false;

export function posterWanted() {
  return (
    !!hall?.hosted && !posterSent && !!session && performance.now() - session.startedAt > POSTER_AFTER_MS
  );
}

/** Call right after drawing the canvas, in the same task (see the bridge's posterFromCanvas). */
export function offerPoster(canvas) {
  posterSent = true;
  hall.posterFromCanvas(canvas);
}
