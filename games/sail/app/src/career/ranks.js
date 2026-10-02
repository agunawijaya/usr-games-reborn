// Ranks of the Sea Service, earned by its commendations. A rank is never taken away.

export const RANKS = [
  { title: 'Midshipman', stars: 0 },
  { title: 'Lieutenant', stars: 3 },
  { title: 'Commander', stars: 7 },
  { title: 'Post-Captain', stars: 12 },
  { title: 'Commodore', stars: 18 },
  { title: 'Rear-Admiral', stars: 24 },
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

/** Every star earned in the Sea Service so far. */
export function serviceStars(service) {
  return Object.values(service.actions).reduce((sum, entry) => sum + (entry.stars ?? []).filter(Boolean).length, 0);
}
