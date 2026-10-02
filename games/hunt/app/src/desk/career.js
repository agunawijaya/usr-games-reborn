// The career: ten matches that climb from one rookie among the mirrors to a
// full arena of sharpshooters. Each match is won by tagging its number of
// rivals before being hit out three times. Pure data and rules, no DOM, so the
// simulation (scripts/career-sim.mjs) and the tests use it as is.

export const MATCHES = [
  {
    id: 'first-light',
    title: 'First Light',
    lede: 'One rookie among the mirrors. Find them, face them, tag them twice.',
    arena: 'ricochet',
    seed: 11,
    roster: ['novice'],
    goal: { tags: 2, lives: 3 },
  },
  {
    id: 'two-to-chase',
    title: 'Two to Chase',
    lede: 'Two rookies now. Keep moving, and remember that every shot tells them where you are.',
    arena: 'ricochet',
    seed: 23,
    roster: ['novice', 'novice'],
    goal: { tags: 3, lives: 3 },
  },
  {
    id: 'old-robot',
    title: 'The Old Robot',
    lede: 'Two copies of the original robot player, walking the walls of the plain maze the way they did in 1985.',
    arena: 'classic',
    seed: 41,
    roster: ['otto', 'otto'],
    goal: { tags: 3, lives: 3 },
  },
  {
    id: 'crowded-corridors',
    title: 'Crowded Corridors',
    lede: 'Three rivals in a maze that has been blown open and grown back. Doors scatter shots.',
    arena: 'veteran',
    seed: 53,
    roster: ['novice', 'novice', 'otto'],
    goal: { tags: 4, lives: 3 },
  },
  {
    id: 'mirror-maze',
    title: 'Mirror Maze',
    lede: 'Three rivals among the glass. Every hit flips a mirror, so read the room again after each shot.',
    arena: 'ricochet',
    seed: 67,
    roster: ['novice', 'otto', 'novice'],
    goal: { tags: 4, lives: 3 },
  },
  {
    id: 'one-sharp-eye',
    title: 'One Sharp Eye',
    lede: 'A sharpshooter: it aims ahead of you and comes looking. Corners are your friends.',
    arena: 'ricochet',
    seed: 79,
    roster: ['sharp'],
    goal: { tags: 3, lives: 3 },
  },
  {
    id: 'busy-night',
    title: 'Busy Night',
    lede: 'Four rivals, one of them sharp. Let them tag each other and pick your moments.',
    arena: 'veteran',
    seed: 83,
    roster: ['sharp', 'novice', 'novice', 'otto'],
    goal: { tags: 5, lives: 3 },
  },
  {
    id: 'two-sharp-eyes',
    title: 'Two Sharp Eyes',
    lede: 'Two sharpshooters in the mirror arena, where their bank shots come from everywhere.',
    arena: 'ricochet',
    seed: 97,
    roster: ['sharp', 'sharp'],
    goal: { tags: 4, lives: 3 },
  },
  {
    id: 'full-house',
    title: 'Full House',
    lede: 'Five rivals in the old maze. Slime rolls far down a crowded corridor.',
    arena: 'veteran',
    seed: 101,
    roster: ['sharp', 'otto', 'novice', 'novice', 'otto'],
    goal: { tags: 5, lives: 3 },
  },
  {
    id: 'grand-final',
    title: 'Grand Final',
    lede: 'Everyone at once in the mirror arena. Six tags take the night.',
    arena: 'ricochet',
    seed: 1985,
    roster: ['sharp', 'sharp', 'otto', 'novice'],
    goal: { tags: 6, lives: 3 },
  },
];

export const matchById = (id) => MATCHES.find((m) => m.id === id) ?? null;

// The arenas and rivals in the desk's own words.
export const ARENA_TEXT = {
  classic: 'Classic: the original maze, long corridors and dead ends, no mirrors until blown walls grow back.',
  veteran: 'Veteran: as if every wall had been blown up and grown back once; a few mirrors and doors.',
  ricochet: 'Ricochet: a maze with loops, its lone pillars turned into mirrors. Bank shots everywhere.',
};
export const RIVAL_TEXT = {
  novice: 'Novice: reacts late and fires only in straight lines.',
  otto: 'Classic Otto: the original robot player, following the walls.',
  sharp: 'Sharpshooter: aims through mirrors, ahead of where you are going, and comes looking for you.',
};

// Stars for a won match: three if never hit out, two if hit out once, one
// otherwise. A lost match earns none and never lowers a best.
export function starsFor(outcome, hitOut) {
  if (outcome !== 'won') return 0;
  return hitOut === 0 ? 3 : hitOut === 1 ? 2 : 1;
}

export const RANKS = [
  { wins: 0, title: 'Cadet' },
  { wins: 2, title: 'Runner' },
  { wins: 4, title: 'Marksman' },
  { wins: 6, title: 'Mirror Reader' },
  { wins: 8, title: 'Maze Master' },
  { wins: 10, title: 'Champion of the Maze' },
];

export const emptyCareer = () => ({ best: {} });
export const bestStars = (career, id) => career.best[id] ?? 0;
export const winsOf = (career) => MATCHES.filter((m) => bestStars(career, m.id) > 0).length;
export const starsOf = (career) => MATCHES.reduce((sum, m) => sum + bestStars(career, m.id), 0);
export const MAX_STARS = MATCHES.length * 3;

export function rankOf(career) {
  const wins = winsOf(career);
  return RANKS.filter((rank) => wins >= rank.wins).pop();
}

/** A match opens once the one before it has been won. */
export const isUnlocked = (career, index) => index === 0 || bestStars(career, MATCHES[index - 1].id) > 0;

/** The first open match not yet won, or null once every match is won. */
export function nextMatch(career) {
  return MATCHES.find((m, i) => isUnlocked(career, i) && bestStars(career, m.id) === 0) ?? null;
}

/** The match after `id` if it is open, for the results screen's Next. */
export function matchAfter(career, id) {
  const index = MATCHES.findIndex((m) => m.id === id);
  return index >= 0 && index + 1 < MATCHES.length && isUnlocked(career, index + 1) ? MATCHES[index + 1] : null;
}

/** Records a finished match. Returns the new career, whether the stars are a new best, and a new rank if any. */
export function recordResult(career, id, stars) {
  const before = rankOf(career);
  const updated = { ...career, best: { ...career.best, [id]: Math.max(bestStars(career, id), stars) } };
  const after = rankOf(updated);
  return { career: updated, newBest: stars > bestStars(career, id), promotion: after !== before ? after : null };
}
