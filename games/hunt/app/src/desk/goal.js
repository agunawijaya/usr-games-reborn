// A match with a goal is won by tagging its number of rivals before being hit
// out its number of times. Tags are the engine's `gkills`: rivals only, never
// yourself or a teammate. Rivals tagging each other never end a match, so
// how fast it goes is up to the player. Pure, no DOM.

const scoreOf = (g, name) => g.scores.find((row) => row.name === name);

/** 'won', 'lost' or null while the match goes on. goal: { tags, lives }. */
export function goalOutcome(g, name, goal) {
  if (!goal) return null;
  const mine = scoreOf(g, name);
  if (!mine) return null;
  if (mine.gkills >= goal.tags) return 'won';
  if (mine.deaths >= goal.lives) return 'lost';
  return null;
}

/** What the result screen and the Hall need about one player at the end of a match. */
export function matchSummary(g, name) {
  const mine = scoreOf(g, name);
  return {
    tags: mine?.gkills ?? 0,
    hitOut: mine?.deaths ?? 0,
    entries: mine?.entries ?? 0,
  };
}
