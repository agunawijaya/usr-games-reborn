#!/usr/bin/env node
// Captures golden transcripts from the REAL battlestar binary.
//
// Requirements (see docs/notes.md "Golden transcripts"): WSL (or Linux)
// with the Debian `bsdgames` package (/usr/games/battlestar) and gcc.
//
// How it pins the randomness: battlestar seeds rand() with srand(getpid())
// (init.c). The binary is setgid, so LD_PRELOAD is ignored; we run a plain
// copy of it with a tiny LD_PRELOAD shim whose getpid() returns $FAKEPID.
// The engine seeded with the same number then replays the same rand() stream.
//
// Every case in tests/golden/cases.json is piped into the binary exactly as
// listed (one string per line). The raw output is written to
// tests/golden/<name>.out. Curses output from dogfights is kept raw; the test
// strips it (see tests/golden.test.js).
//
//   node scripts/golden-capture.mjs            # all cases
//   node scripts/golden-capture.mjs 07-fights  # cases whose name contains the text

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '../tests/golden');
const cases = JSON.parse(readFileSync(join(dir, 'cases.json'), 'utf8'));
const filter = process.argv[2] || '';

const isWin = process.platform === 'win32';
const sh = (script) => (isWin
  ? execFileSync('wsl.exe', ['-e', 'bash', '-lc', script], { maxBuffer: 1 << 26 })
  : execFileSync('bash', ['-lc', script], { maxBuffer: 1 << 26 }));
const toPosix = (p) => (isWin ? sh(`wslpath -a '${p.replace(/\\/g, '/')}'`).toString().trim() : p);

// One-time setup of the shim and a non-setgid copy of the binary.
sh(`set -e; mkdir -p /tmp/bsgolden && cd /tmp/bsgolden
cat > fakepid.c <<'SHIM'
#define _GNU_SOURCE
#include <sys/types.h>
#include <stdlib.h>
#include <pwd.h>
#include <dlfcn.h>
pid_t getpid(void) { const char *s = getenv("FAKEPID"); return s ? atoi(s) : 4242; }
/* FAKEUSER is the login name battlestar checks against its wizard lists. */
struct passwd *getpwuid(uid_t uid) {
  static struct passwd *(*real)(uid_t);
  static struct passwd p;
  const char *n = getenv("FAKEUSER");
  struct passwd *r;
  if (!real) real = (struct passwd *(*)(uid_t))dlsym(RTLD_NEXT, "getpwuid");
  r = real(uid);
  if (!n) return r;
  if (r) p = *r;
  p.pw_name = (char *)n;
  return &p;
}
SHIM
gcc -shared -fPIC -o fakepid.so fakepid.c -ldl
cp /usr/games/battlestar ./bs && chmod 755 ./bs`);

const tmp = mkdtempSync(join(tmpdir(), 'bsgolden-'));
let n = 0;
for (const c of cases) {
  if (filter && !c.name.includes(filter)) continue;
  const inFile = join(tmp, `${c.name}.in`);
  writeFileSync(inFile, c.input.map((l) => l + '\n').join(''));
  const env = `BATTLESTAR_QUIET=1 HOME=/tmp/bsgolden TERM=${c.term || 'vt100'} COLUMNS=80 LINES=24 ` +
    `LD_PRELOAD=/tmp/bsgolden/fakepid.so FAKEPID=${c.seed}` + (c.username ? ` FAKEUSER=${c.username}` : '');
  const out = sh(`cd /tmp/bsgolden && ${env} timeout 60 ./bs < '${toPosix(inFile)}' 2>&1 || true`);
  writeFileSync(join(dir, `${c.name}.out`), out);
  n++;
  console.log(`${c.name}: ${out.length} bytes`);
}
console.log(`captured ${n} case(s)`);
