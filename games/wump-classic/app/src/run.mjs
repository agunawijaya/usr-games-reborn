// The Rune Gates — one delve as it happens. The page passes on what the engine answered to every
// step and every arrow; this keeps the counts the quests read and the events the chronicle tells.
// Pure: the engine's game object is only read.

/**
 * @param {{ kind: 'career' | 'daily' | 'free', name: string, delveId?: string, dailyKey?: string, tasks?: unknown[] }} what
 * @param {object} game  the engine's WumpGame, freshly started
 */
export function startRun(what, game) {
  return {
    ...what,
    tasks: what.tasks ?? [],
    arrowsTotal: game.arrowNum,
    moves: 0,
    bumps: 0,
    batRides: 0,
    ledges: 0,
    arrowsFired: 0,
    slayingPath: 0,
    woke: false,
    chartOpened: false,
    ended: false,
    events: [{ type: 'start', room: game.playerLoc, cues: cuesOf(game) }],
  };
}

function cuesOf(game) {
  const cues = game.getSensoryCues(game.playerLoc);
  return { draft: cues.draft, stench: cues.stench, flutter: cues.flutter };
}

/** After every step the player tried, with the engine's answer. */
export function noteMove(run, target, res, game) {
  if (run.ended) return;
  run.moves += 1;
  if (res.wallHit) {
    run.bumps += 1;
    if (res.wokeWumpus) run.woke = true;
    run.events.push({ type: 'bump', to: target, woke: Boolean(res.wokeWumpus) });
    return;
  }
  run.events.push(res.jumped ? { type: 'magic', to: game.playerLoc } : { type: 'walk', to: target });
  if (res.batTransported) {
    run.batRides += 1;
    run.events.push({ type: 'bats', to: game.playerLoc });
  }
  if (res.pitOutcropSaved) {
    run.ledges += 1;
    run.events.push({ type: 'ledge', room: game.playerLoc });
  }
  if (game.status === 'IN_PROGRESS') run.events.push({ type: 'sense', room: game.playerLoc, cues: cuesOf(game) });
}

/** After every arrow, with the rooms the player named and the engine's answer. */
export function noteShot(run, path, res, game) {
  if (run.ended) return;
  run.arrowsFired += 1;
  if (res.wumpusMoved) run.woke = true;
  if (res.killedWumpus) run.slayingPath = path.length;
  run.events.push({
    type: 'shot',
    path,
    trajectory: res.trajectory ?? [],
    decayed: Boolean(res.flightDecayed),
    moved: Boolean(res.wumpusMoved),
    slain: Boolean(res.killedWumpus),
    self: Boolean(res.killedPlayer),
    from: game.playerLoc,
  });
}

export function noteChart(run) {
  if (!run.ended) run.chartOpened = true;
}

/** @returns {import('./quests.mjs').RunSummary & { status: string, room: number }} */
export function summarize(run, game) {
  return {
    slain: game.status === 'VICTORY',
    moves: run.moves,
    bumps: run.bumps,
    batRides: run.batRides,
    ledges: run.ledges,
    arrowsFired: run.arrowsFired,
    arrowsLeft: game.arrowsLeft,
    slayingPath: run.slayingPath,
    woke: run.woke,
    visited: game.visitedRooms.size,
    chartOpened: run.chartOpened,
    status: game.status,
    room: game.playerLoc,
  };
}
