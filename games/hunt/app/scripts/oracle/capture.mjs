#!/usr/bin/env node
// Builds the hunt(6) C oracle and captures golden traces from it.
//
// Requirements: WSL (or Linux) with gcc. The original C source is NOT part of
// this repository (root AGENTS.md section 9). Fetch it from
// https://github.com/vattam/BSDGames and pass the hunt directory:
//
//   node scripts/oracle/capture.mjs [<path-to>/hunt] [filter]
//
// With no path it uses ../../../../../../BSDGames-master/hunt (the gitignored
// upstream checkout at the repo root, if present). The upstream files are
// copied into /tmp/hunt-oracle (outside the repo), hunt.h gets an include
// guard, and scripts/oracle/harness.c is compiled there with the Linux build's
// game flags (hunt/Makeconfig). Every tests/golden/scenarios/<name>.hunt script
// is piped into the oracle; its JSON-lines output goes to
// tests/golden/<name>.jsonl.gz, which tests/golden.test.js replays through the
// JavaScript engine.

import { readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const port = resolve(here, '..', '..');
const args = process.argv.slice(2);
const srcArg = args.find((a) => existsSync(join(a, 'huntd', 'shots.c')));
const filter = args.find((a) => a !== srcArg) || '';
const upstream = resolve(srcArg || join(port, '../../../../BSDGames-master/hunt'));
if (!existsSync(join(upstream, 'huntd', 'shots.c'))) {
  console.error(`upstream hunt sources not found at ${upstream}\nusage: node scripts/oracle/capture.mjs <path-to>/hunt [filter]`);
  process.exit(1);
}

const isWin = process.platform === 'win32';
const sh = (script, input) => (isWin
  ? execFileSync('wsl.exe', ['-e', 'bash', '-lc', script], { input, maxBuffer: 1 << 28 })
  : execFileSync('bash', ['-lc', script], { input, maxBuffer: 1 << 28 }));
const toPosix = (p) => (isWin ? sh(`wslpath -a '${p.replace(/\\/g, '/')}'`).toString().trim() : p);

const up = toPosix(upstream);
const harness = toPosix(join(here, 'harness.c'));
// Game flags from hunt/Makeconfig (hunt_GAME_PARAM) + the Linux system flags
// that change data layout (INTERNET, BSD_RELEASE=44). -fwrapv pins the signed
// overflow in driver.c's RN macro to the wrap-around every real build gets.
const FLAGS = [
  '-DRANDOM', '-DREFLECT', '-DMONITOR', '-DOOZE', '-DFLY', '-DVOLCANO', '-DBOOTS', '-DOTTO',
  '-DINTERNET', '-DBSD_RELEASE=44', '-DINFTIM=-1', '-DSIGNAL_TYPE=void', `-DHUNTD='"/usr/games/huntd"'`,
  `-D'__RCSID(x)='`, `-D'__COPYRIGHT(x)='`,
].join(' ');
sh(`set -e; rm -rf /tmp/hunt-oracle; mkdir -p /tmp/hunt-oracle; cd /tmp/hunt-oracle
cp '${up}'/huntd/*.c '${up}'/huntd/*.h '${up}'/hunt/otto.c .
mv hunt.h hunt_upstream.h
printf '#ifndef HUNT_H_ORACLE_GUARD\\n#define HUNT_H_ORACLE_GUARD\\n#include "hunt_upstream.h"\\n#endif\\n' > hunt.h
cp '${harness}' harness.c
gcc -O1 -fwrapv -w ${FLAGS} -I. harness.c -o harness`);
console.log('oracle built: /tmp/hunt-oracle/harness');

const scenDir = join(port, 'tests', 'golden', 'scenarios');
for (const file of readdirSync(scenDir).filter((f) => f.endsWith('.hunt')).sort()) {
  const name = file.replace(/\.hunt$/, '');
  if (filter && !name.includes(filter)) continue;
  const script = readFileSync(join(scenDir, file));
  const out = sh('/tmp/hunt-oracle/harness', script).toString();
  writeFileSync(join(port, 'tests', 'golden', `${name}.jsonl.gz`), gzipSync(out, { level: 9 }));
  rmSync(join(port, 'tests', 'golden', `${name}.jsonl`), { force: true });
  console.log(`${name}.jsonl  ${out.split('\n').filter(Boolean).length} records, ${(out.length / 1024).toFixed(1)} KB`);
}
