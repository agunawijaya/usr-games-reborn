#!/usr/bin/env node
// Generates a complete winning command script with the hint planner, in the
// same input mode a pipe gives the original program (dogfight keys come from
// stdin, so the Cylon is escaped with `q`). The script is written into
// tests/golden/cases.json as case `walkthrough-seed<N>`, so that
// `npm run golden` can replay it on the real binary and the golden test can
// prove it wins there too.
//
//   node scripts/make-walkthrough.mjs 1 7 42      # seeds

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scriptedWalkthrough } from '../src/engine/autoplay.js';

const here = dirname(fileURLToPath(import.meta.url));
const casesFile = join(here, '../tests/golden/cases.json');

{
  const seeds = process.argv.slice(2).map(Number);
  const cases = JSON.parse(readFileSync(casesFile, 'utf8'));
  for (const seed of seeds.length ? seeds : [1]) {
    const { input, won, stuck, g } = scriptedWalkthrough(seed);
    console.log(`seed ${seed}: ${won ? 'WON' : 'not won'} in ${input.length} commands, ${g.ourtime} turns`);
    if (!won) { console.log('  stuck:', stuck); continue; }
    const name = `walkthrough-seed${seed}`;
    const c = { name, seed, input };
    const i = cases.findIndex((x) => x.name === name);
    if (i >= 0) cases[i] = c; else cases.push(c);
  }
  writeFileSync(casesFile, JSON.stringify(cases, null, 1) + '\n');
}
