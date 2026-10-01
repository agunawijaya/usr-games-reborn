// The eight species of the abyss, one per original flavor character
// (worms.c:167-169: O * # $ % 0 @ ~). Worm n is species n % 8, exactly as
// the original picks flavor[n % sizeof(flavor)].
//
// core/rim are linear-light colours (the shader tone-maps them).
// pattern selects the body markings in the worm shader.

export const SPECIES = Object.freeze([
  { ch: 'O', name: 'Lantern worm', core: [0.10, 0.95, 0.85], rim: [0.35, 0.85, 1.00], pattern: 0, rings: 1.0, pulse: 0.55, width: 1.00, sway: 0.10 },
  { ch: '*', name: 'Starlight polychaete', core: [1.00, 0.25, 0.75], rim: [0.75, 0.45, 1.00], pattern: 1, rings: 1.0, pulse: 0.90, width: 0.92, sway: 0.12 },
  { ch: '#', name: 'Banded ribbon worm', core: [0.20, 0.45, 1.00], rim: [0.45, 0.85, 1.00], pattern: 2, rings: 1.0, pulse: 0.40, width: 1.05, sway: 0.08 },
  { ch: '$', name: 'Gilded bristleworm', core: [1.00, 0.62, 0.12], rim: [1.00, 0.85, 0.40], pattern: 3, rings: 2.0, pulse: 0.70, width: 0.95, sway: 0.10 },
  { ch: '%', name: 'Twin-lamp worm', core: [0.62, 0.28, 1.00], rim: [0.25, 1.00, 0.55], pattern: 4, rings: 1.0, pulse: 0.50, width: 1.00, sway: 0.10 },
  { ch: '0', name: 'Halo worm', core: [0.25, 0.90, 1.00], rim: [0.85, 1.00, 1.00], pattern: 5, rings: 1.0, pulse: 1.10, width: 1.08, sway: 0.08 },
  { ch: '@', name: 'Coral spiral worm', core: [1.00, 0.38, 0.22], rim: [1.00, 0.70, 0.45], pattern: 6, rings: 1.0, pulse: 0.60, width: 1.00, sway: 0.11 },
  { ch: '~', name: 'Glass eel-worm', core: [0.45, 1.00, 0.25], rim: [0.70, 1.00, 0.85], pattern: 7, rings: 0.5, pulse: 0.80, width: 0.78, sway: 0.24 },
]);

export const speciesOf = (n) => SPECIES[n % SPECIES.length];
