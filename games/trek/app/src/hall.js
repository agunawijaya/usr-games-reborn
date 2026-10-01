// Deep-space command inside /usr/games Reborn. The Hall runs this page in a frame and listens
// over the bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge
// script is missing or reports `hosted: false`, and every call below does nothing.
//
// What the Hall hears comes from the game's own state and from the effects each command
// returns (engine.js). Missions played with the override panel earn no packages, no XP events and
// no score.

const hall = globalThis.UsrGamesBridge?.connectToHall({ id: 'trek' }) ?? null;
const installed = new Set();
const XP_PER_SHIP = 2;
const LOW_HULL = 25;
const CROWDED_QUADRANT = 3;

function install(id) {
  if (!hall || installed.has(id)) return;
  installed.add(id);
  hall.achievement(id);
}

// The title screen is the game menu: Escape there leads back to the Hall (help, open over it,
// keeps Escape for itself).
const title = document.getElementById('title-screen');
if (hall?.hosted && title) {
  const report = () => hall.setTitleScreen(title.classList.contains('shown'));
  new MutationObserver(report).observe(title, { attributes: true, attributeFilter: ['class'] });
  report();
}

let mission = null;

const quadrantOf = (game) => game.galaxy.quadrants[game.ship.qy][game.ship.qx];
const chartedQuadrants = (game) =>
  game.galaxy.quadrants.flat().filter((quadrant) => quadrant.scanned).length;

export function noteMissionStarted(game) {
  mission = {
    startedAt: performance.now(),
    docked: false,
    lowestHull: game.ship.hull,
    crowdedQuadrant: null,
    chartedAtStart: chartedQuadrants(game),
  };
}

function noteEffect(effect) {
  if (effect.type === 'dock') {
    mission.docked = true;
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
  if (!mission || game.cheated) return;
  for (const effect of effects) noteEffect(effect);
  if (game.kills >= 1) install('opening-volley');
  mission.lowestHull = Math.min(mission.lowestHull, game.ship.hull);
  // A quadrant counts as secured when one that held three or more hostiles is emptied.
  const here = quadrantOf(game);
  if (here.klingons >= CROWDED_QUADRANT) mission.crowdedQuadrant = here;
  else if (mission.crowdedQuadrant === here && here.klingons === 0) install('sector-secured');
  if (chartedQuadrants(game) === 64) install('full-survey');
}

/** The end of a mission: a win, a loss, or the player aborting it. */
export function reportMission(game, won) {
  if (!hall || !mission) return;
  const clean = !game.cheated;
  const outcome = won ? 'win' : game.lost ? 'loss' : 'quit';
  if (clean && won) {
    install('mission-accomplished');
    if (game.difficulty === 'standard') install('steady-hand');
    if (game.difficulty === 'expert') install('hardest-level');
    if (mission.lowestHull <= LOW_HULL) install('hold-together');
    if (!mission.docked) install('self-reliant');
  }
  const shipsDisabled = clean ? game.kills : 0;
  hall.result({
    outcome,
    ...(clean ? { score: game.kills } : {}),
    stats: {
      shipsDisabled,
      quadrantsCharted: clean ? Math.max(0, chartedQuadrants(game) - mission.chartedAtStart) : 0,
    },
    xpEvents:
      shipsDisabled > 0 ? [{ id: 'ships-disabled', xp: Math.min(25, shipsDisabled * XP_PER_SHIP) }] : [],
    durationSeconds: Math.round((performance.now() - mission.startedAt) / 1000),
  });
  mission = null;
}

// Key art for the Hall: the tactical view a few seconds into the first mission.
const POSTER_AFTER_MS = 6000;
let posterSent = false;

export function posterWanted() {
  return (
    !!hall?.hosted && !posterSent && !!mission && performance.now() - mission.startedAt > POSTER_AFTER_MS
  );
}

/** Call right after drawing the canvas, in the same task (see the bridge's posterFromCanvas). */
export function offerPoster(canvas) {
  posterSent = true;
  hall.posterFromCanvas(canvas);
}
