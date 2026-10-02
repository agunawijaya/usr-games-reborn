// The battle's logbook: what the player's ship did, counted from the orders given and the events
// each turn resolved to. Commendations are judged against it when the battle ends. Pure.

export function createLog(st, me) {
  const ms = st.ships[me];
  return {
    broadsides: 0,
    rakes: 0,
    sternRakes: 0,
    struckToGuns: 0,
    boardedPrizes: 0,
    repairs: 0,
    fullSailTurns: 0,
    mastLost: false,
    lowestHull: ms.specs.hull,
    startHull: ms.max.hull,
    startCrew: ms.max.crew1 + ms.max.crew2 + ms.max.crew3,
  };
}

/** One resolved turn: `orders` are what the player gave, `st` the state after it. */
export function noteTurn(log, events, st, me, orders = {}) {
  for (const e of events) {
    if (e.t === 'fire' && e.from === me) {
      log.broadsides += 1;
      if (e.rake) log.rakes += 1;
      if (e.sternrake) log.sternRakes += 1;
    }
    if (e.t === 'strike' && e.by === me) log.struckToGuns += 1;
    if (e.t === 'capture' && e.by === me) log.boardedPrizes += 1;
  }
  if (orders.repair) log.repairs += 1;
  const ms = st.ships[me];
  if (ms.FS) log.fullSailTurns += 1;
  log.lowestHull = Math.min(log.lowestHull, ms.specs.hull);
  // A mast once shot away counts as lost, even if a jury mast goes up later.
  const rig = [ms.specs.rig1, ms.specs.rig2, ms.specs.rig3, ms.specs.rig4];
  const max = [ms.max.rig1, ms.max.rig2, ms.max.rig3, ms.max.rig4];
  if (rig.some((r, i) => max[i] > 0 && r <= 0)) log.mastLost = true;
}
