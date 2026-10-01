#!/usr/bin/env node
// README screenshots -> media/. GPU set first, then the CPU-only Lite view.
//   node scripts/shots.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const media = join(here, '..', 'media');
const run = (env, ...jobs) => execFileSync(process.execPath, [join(here, 'snap.mjs'), media, ...jobs], { stdio: 'inherit', env: { ...process.env, ...env } });

run({},
  '01-setup=setup', '02-quiet-maze=quiet-maze', '03-light-cone=quiet-follow', '04-ricochet=firefight',
  '05-coach=coach', '06-grenade=grenade-blast', '07-bomb=bomb', '08-slime=slime-spread', '09-death=death',
  '10-split=split', '11-terminal=terminal', '12-override=override');
run({ GPU: 'cpu' }, '13-cpu-lite=quiet-follow');
