// Deep Space Command — ranks, earned by the commendations won on the Frontier Tour. A rank is
// never taken away: stars only ever go up.

export const RANKS = [
  { title: 'Ensign', stars: 0 },
  { title: 'Lieutenant', stars: 3 },
  { title: 'Lieutenant Commander', stars: 7 },
  { title: 'Commander', stars: 12 },
  { title: 'Captain', stars: 18 },
  { title: 'Commodore', stars: 24 },
  { title: 'Admiral', stars: 30 },
];

export function rankFor(stars) {
  let rank = RANKS[0];
  for (const candidate of RANKS) if (stars >= candidate.stars) rank = candidate;
  return rank;
}

export function nextRank(stars) {
  return RANKS.find((rank) => rank.stars > stars) ?? null;
}

/** All stars earned on the tour so far. */
export function tourStars(tour) {
  return Object.values(tour.sorties).reduce(
    (sum, entry) => sum + (entry.stars ?? []).filter(Boolean).length,
    0,
  );
}
