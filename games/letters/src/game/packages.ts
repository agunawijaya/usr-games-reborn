import { definePackages } from '@usr-games/kit';

/** Chain Letter's twelve packages. Descriptions invite; none asks for more than one good round. */
export const PACKAGES = definePackages('letters', [
  {
    id: 'first-chain',
    title: 'First link',
    description: 'Trace your first word.',
    tier: 'core',
  },
  {
    id: 'qu-word',
    title: 'Quick on the Qu',
    description: 'Find a word that runs through the Qu cube.',
    tier: 'core',
  },
  {
    id: 'combo-x3',
    title: 'Chain reaction',
    description: 'Keep finding words until the chain reaches ×3.',
    tier: 'core',
  },
  {
    id: 'daily-regular',
    title: 'Morning reader',
    description: 'Play seven Daily Grids.',
    tier: 'core',
  },
  {
    id: 'eight-letters',
    title: 'Long stretch',
    description: 'Find a word of eight letters or more.',
    tier: 'extra',
  },
  {
    id: 'coverage-50',
    title: 'Half the board',
    description: 'Find half of the words on a timed board.',
    tier: 'extra',
  },
  {
    id: 'echo-master',
    title: 'Echo chamber',
    description: 'Reach a third of an Echo board, where cubes come back.',
    tier: 'extra',
  },
  {
    id: 'mirror-master',
    title: 'Mirror image',
    description: 'Reach a third of a Mirror board, where a cube can repeat at once.',
    tier: 'extra',
  },
  {
    id: 'average-climber',
    title: 'Sharper eye',
    description: 'Raise your board-reading level by ten points.',
    tier: 'extra',
  },
  {
    id: 'coverage-75',
    title: 'Three quarters',
    description: 'Find three words in four on a timed board.',
    tier: 'rare',
  },
  {
    id: 'mega-grid',
    title: 'Mega reader',
    description: 'Finish a timed round on the 6×6 Mega grid.',
    tier: 'rare',
  },
  {
    id: 'beat-the-hunter',
    title: 'Out-read the Lexicon',
    description: 'Win a Duel against the strongest hunter.',
    tier: 'rare',
  },
]);

export type PackageId =
  | 'first-chain'
  | 'qu-word'
  | 'combo-x3'
  | 'daily-regular'
  | 'eight-letters'
  | 'coverage-50'
  | 'echo-master'
  | 'mirror-master'
  | 'average-climber'
  | 'coverage-75'
  | 'mega-grid'
  | 'beat-the-hunter';
