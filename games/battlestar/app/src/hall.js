// The starship adventure inside /usr/games Reborn. The Hall runs this page in a frame and listens
// over the bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge
// script is missing or reports `hosted: false`, and every call below does nothing.
//
// What the Hall hears comes from the events each command already returns (engine/battlestar.js)
// and from the score the engine posts when the game ends. Games begun under a wizard's name,
// played with the override panel or handed to the autoplay earn no packages, no XP events and no
// score. (Becoming a wizard in play, by holding the three charms, is part of the game and counts.)

const hall = globalThis.UsrGamesBridge?.connectToHall({ id: 'battlestar' }) ?? null;
const installed = new Set();
const FAR_TRAVELLER = 150;
const GENEROUS = 20;
const ROOMS_PER_XP = 10;
const XP_PER_FIGHT = 5;

function install(id) {
  if (!hall || installed.has(id)) return;
  installed.add(id);
  hall.achievement(id);
}

// The title dialog is the game menu. Closing it any way starts a game, so on the Hall's behalf
// Escape there (with nothing open over it) is taken before the dialog sees it, and leads back to
// the Hall instead.
const title = document.getElementById('dlg-title');
if (hall?.hosted && title) {
  const report = () => hall.setTitleScreen(title.open);
  new MutationObserver(report).observe(title, { attributes: true, attributeFilter: ['open'] });
  report();
  window.addEventListener(
    'keydown',
    (event) => {
      const onTop = [...document.querySelectorAll('dialog[open]')].pop();
      if (event.key !== 'Escape' || onTop !== title) return;
      event.preventDefault();
      event.stopPropagation();
      hall.navigate('hall');
    },
    { capture: true },
  );
}

let run = null;

const honest = (game) => !game.cheated && !game.wiz && !run?.autoplayed;
const roomsVisited = (game) => game.card(game.beenthere, game.beenthere.length);

export function noteGameStarted() {
  run = { startedAt: performance.now(), fightsWon: 0, autoplayed: false };
}

/** The hint panel's autoplay was switched on: the rest of this game plays itself. */
export function noteAutoplayUsed() {
  if (run) run.autoplayed = true;
}

const PACKAGE_FOR_EVENT = {
  land: 'touchdown',
  napkinMap: 'napkin-map',
  darkLordFlees: 'outwitted',
  wedding: 'prince-liverwort',
  cylonDestroyed: 'clean-shot',
  seaCaveOpens: 'low-tide',
  wizard: 'three-charms',
  dusk: 'island-night',
};

/** The events of one command. */
export function noteEvents(game, events) {
  if (!run || !game || !honest(game)) return;
  for (const event of events) {
    const id = PACKAGE_FOR_EVENT[event.type];
    if (id) install(id);
    if (event.type === 'launch' && event.from === 7) install('out-of-pajamas');
    if (event.type === 'teleport' && event.how === 'amulet') install('amulet-hop');
    if (event.type === 'fightWon') run.fightsWon += 1;
  }
  if (roomsVisited(game) >= FAR_TRAVELLER) install('surveyor');
  if (game.ego >= GENEROUS) install('generous-heart');
}

const OUTCOMES = { won: 'win', died: 'loss', quit: 'quit' };

/** The game ended: `endKind` is won, died or quit. */
export function reportGameOver(game, endKind) {
  if (!hall || !run) return;
  const clean = honest(game);
  const rooms = roomsVisited(game);
  const xpEvents = [];
  if (clean && rooms >= ROOMS_PER_XP) {
    xpEvents.push({ id: 'places-explored', xp: Math.min(25, Math.floor(rooms / ROOMS_PER_XP)) });
  }
  if (clean && run.fightsWon > 0) {
    xpEvents.push({ id: 'fights-won', xp: Math.min(25, run.fightsWon * XP_PER_FIGHT) });
  }
  hall.result({
    outcome: OUTCOMES[endKind] ?? 'complete',
    ...(clean ? { score: Math.max(game.pleasure, game.power, game.ego) } : {}),
    stats: { placesExplored: clean ? rooms : 0, turns: game.ourtime },
    xpEvents,
    durationSeconds: Math.round((performance.now() - run.startedAt) / 1000),
  });
  run = null;
}

// Key art for the Hall: the scene some seconds into the first game.
const POSTER_AFTER_MS = 8000;
let posterSent = false;

/** The stage calls this after drawing each frame, in the same task as the drawing. */
export function afterStageFrame(canvas) {
  if (!hall?.hosted || posterSent || !run || performance.now() - run.startedAt < POSTER_AFTER_MS) {
    return;
  }
  posterSent = true;
  hall.posterFromCanvas(canvas);
}
