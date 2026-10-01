// Written by scripts/tour-search.ts: the seed of every Grand Tour match and its score target.
export const TOUR_SEEDS: Readonly<Record<string, { seed: number; target: number }>> = {
  'opening-night': { seed: 3213136727, target: 160 },
  'second-leg': { seed: 1548079137, target: 220 },
  'double-header': { seed: 981618701, target: 840 },
  'the-crunch': { seed: 3274649555, target: 880 },
  'short-fuse': { seed: 661948178, target: 440 },
  'triple-bill': { seed: 3401218292, target: 2420 },
  'full-house': { seed: 618483090, target: 1350 },
  'clockwork': { seed: 3884049286, target: 1340 },
  'no-way-out': { seed: 2355411708, target: 930 },
  'overtime': { seed: 689035352, target: 3040 },
  'beyond-forty': { seed: 1619935749, target: 1980 },
  'grand-final': { seed: 4152160292, target: 5260 },
};
