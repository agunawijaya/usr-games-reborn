/**
 * Writes manifest.json from the game's own definitions, so the package list there can never
 * drift from the one the game installs. `tsx scripts/write-manifest.ts [status]`
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PACKAGES } from '../src/game/packages';

const status = process.argv[2] ?? 'coming-soon';
const manifest = {
  id: 'letters',
  title: 'Chain Letter',
  tagline: 'Trace the letters. Find the words. Beat the dictionary.',
  teaser:
    'Sixteen letter cubes, three minutes, and a dictionary that knows every word hiding in them. Drag across neighbouring letters to chain words together, light up the grid, and see how much of the board you can claim. A 1988 word hunt from a Vancouver computer lab, reborn.',
  category: 'words',
  directory: '/usr/games/words',
  players: { min: 1, max: 2 },
  sessionMinutes: [3, 6],
  status,
  accent: '#ff6a5c',
  emblem: 'M5 30h12v12H5zM18 18h12v12H18zM31 6h12v12H31zM11 36L24 24L37 12',
  inspiredBy: {
    program: 'boggle',
    originalTitle: 'bog',
    uiTitle: 'the 1988 letter-cube word hunt',
    year: 1988,
  },
  daily: true,
  kind: 'native',
  build: { kind: 'native' },
  manPage: {
    synopsis:
      'Chain Letter — trace words through touching letter cubes, then see every word the board held and your share of it.',
    description:
      "Barry Brachman's word hunt from the University of British Columbia, written in 1988 for a Sun 3 and an Atari 1040ST, reborn with cubes you can almost pick up. You play against the dictionary: when the bell rings, the board lights up with every word it held and your share of them becomes your board-reading level. The 1988 rule switches return as the Echo and Mirror cards, alongside a Daily Grid, a Duel with an AI word-hunter, and a word book for rare finds.",
    seeAlso: ['hangman', 'quiz'],
  },
  howToPlay: [
    'Drag across touching cubes, diagonals included, to spell a word; or type it and press Enter.',
    'Points grow with length, and quick finds build a chain up to ×3.',
    'When time is up you see every word the board held; your share of them is the number to beat.',
  ],
  cronGoals: [
    { id: 'words', stat: 'wordsFound', label: 'Find {n} words in Chain Letter', min: 20, max: 80 },
    {
      id: 'long-words',
      stat: 'longWords',
      label: 'Find {n} words of six letters or more in Chain Letter',
      min: 3,
      max: 12,
    },
  ],
  packages: PACKAGES.map(({ id, title, description, tier }) => ({ id, title, description, tier })),
};

writeFileSync(
  fileURLToPath(new URL('../manifest.json', import.meta.url)),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
