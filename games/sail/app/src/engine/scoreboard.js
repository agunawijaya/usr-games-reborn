// "Top ten sailors" (sail -s / sail -s -l).
//
// The original kept a binary log file of the ten best captains, ranked by
// net points = points scored / the points value of their own ship, and only
// inserted a new captain if they beat an existing row (sail/misc.c:196-244,
// sail/lo_main.c). This is the same ranking as pure functions over a plain
// array; the UI persists it in localStorage instead of /var/games.

export const NLOG = 10;

export function netPoints(points, shipPts) {
  return shipPts > 0 ? points / shipPts : 0;
}

// entry: { captain, login, ship, scenario, points, shipPts, date }
export function recordScore(board, entry) {
  const rows = Array.isArray(board) ? board.slice(0, NLOG) : [];
  const net = netPoints(entry.points, entry.shipPts);
  if (net <= 0) return { board: rows, rank: -1 };
  const row = { ...entry, net };
  let rank = rows.findIndex((r) => net > r.net);
  if (rank < 0) {
    if (rows.length >= NLOG) return { board: rows, rank: -1 };
    rank = rows.length;
  }
  rows.splice(rank, 0, row);
  return { board: rows.slice(0, NLOG), rank };
}

// Text rendering in the spirit of the original lo_main output.
export function formatBoard(board, { logins = false } = {}) {
  if (!board.length) return ['Nobody has played sail yet.'];
  const out = [`Sail log (${board.length} of the top ${NLOG} sailors):`];
  board.forEach((r, i) => {
    const who = logins && r.login ? `${r.captain} (${r.login})` : r.captain;
    out.push(`${String(i + 1).padStart(2)}. ${who} — ${r.points} points (net ${r.net.toFixed(2)}) in the ${r.ship}, "${r.scenario}"`);
  });
  return out;
}
