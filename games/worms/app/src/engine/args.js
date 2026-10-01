// Command-line parsing exactly as worms.c does it (worms.c:204-238):
// getopt(argc, argv, "d:fl:n:t") with glibc's GNU getopt behaviour, plus
// C's strtoul()/atoi() conversions, including their overflow quirks.
//
// Original: worms.c, NetBSD 1.16 (2004), BSDGames.
//   Copyright (c) 1980, 1993 The Regents of the University of California.
//   Eric P. Scott, Caltech High Energy Physics, October 1980.
// Upstream: https://github.com/vattam/BSDGames/blob/master/worms/worms.c

export const USAGE = 'usage: worms [-ft] [-d delay] [-l length] [-n number]';
export const DEFAULTS = Object.freeze({ delay: 0, length: 16, number: 3, field: false, trail: false });

const ULONG_MAX = (1n << 64n) - 1n;
const LONG_MAX = (1n << 63n) - 1n;
const LONG_MIN = -(1n << 63n);
const isSpace = (c) => c === ' ' || (c >= '\t' && c <= '\r');

/** Leading whitespace, optional sign, decimal digits; returns { neg, digits }. */
function scanInteger(str) {
  let i = 0;
  while (i < str.length && isSpace(str[i])) i++;
  let neg = false;
  if (str[i] === '+' || str[i] === '-') {
    neg = str[i] === '-';
    i++;
  }
  let digits = '';
  while (i < str.length && str[i] >= '0' && str[i] <= '9') digits += str[i++];
  return { neg, digits };
}

/** (unsigned int)strtoul(s, NULL, 10) on an LP64 system. */
export function cStrtoulToUint(str) {
  const { neg, digits } = scanInteger(str);
  if (!digits) return 0;
  let v = BigInt(digits);
  if (v > ULONG_MAX) v = ULONG_MAX; // ERANGE clamps before negation
  if (neg) v = (-v) & ULONG_MAX; // strtoul negates in unsigned arithmetic
  return Number(v & 0xffffffffn); // cast to unsigned int
}

/** atoi(s) on glibc: (int)strtol(s, NULL, 10). */
export function cAtoi(str) {
  const { neg, digits } = scanInteger(str);
  if (!digits) return 0;
  let v = BigInt(digits);
  if (neg) v = -v;
  if (v > LONG_MAX) v = LONG_MAX;
  if (v < LONG_MIN) v = LONG_MIN;
  return Number(BigInt.asIntN(32, v)); // truncate to int
}

/**
 * Parse worms' arguments (without argv[0]).
 * Returns { ok: true, opts } or { ok: false, stderr, code: 1 }, where stderr
 * is exactly what the original prints (program name `worms`).
 */
export function parseArgs(argv) {
  const opts = { ...DEFAULTS };
  const fail = (line) => ({ ok: false, stderr: `${line}\n`, code: 1 });
  const usage = (line) => ({ ok: false, stderr: `${line}\n${USAGE}\n`, code: 1 });

  // GNU getopt permutes: operands are skipped, options anywhere are seen,
  // and "--" ends option processing.
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') break;
    if (arg.length < 2 || arg[0] !== '-') continue; // operand (ignored by worms)
    for (let j = 1; j < arg.length; j++) {
      const ch = arg[j];
      if (ch === 'f') { opts.field = true; continue; }
      if (ch === 't') { opts.trail = true; continue; }
      if (ch === 'd' || ch === 'l' || ch === 'n') {
        let optarg;
        if (j + 1 < arg.length) optarg = arg.slice(j + 1);
        else if (i + 1 < argv.length) optarg = argv[++i];
        else return usage(`worms: option requires an argument -- '${ch}'`);
        if (ch === 'd') {
          const d = cStrtoulToUint(optarg);
          if (d < 1 || d > 1000) return fail('worms: invalid delay (1-1000)');
          opts.delay = d; // milliseconds (the C code then multiplies by 1000 to get us)
        } else if (ch === 'l') {
          const l = cAtoi(optarg);
          if (l < 2 || l > 1024) return fail('worms: invalid length (2 - 1024).');
          opts.length = l;
        } else {
          const n = cAtoi(optarg);
          if (n < 1) return fail('worms: invalid number of worms.');
          opts.number = n;
        }
        break; // the rest of this argv element was the option argument
      }
      return usage(`worms: invalid option -- '${ch}'`);
    }
  }
  return { ok: true, opts };
}

/** Render options back into the shortest equivalent command line. */
export function formatArgs(opts) {
  const parts = ['worms'];
  const flags = `${opts.field ? 'f' : ''}${opts.trail ? 't' : ''}`;
  if (flags) parts.push(`-${flags}`);
  if (opts.delay) parts.push(`-d ${opts.delay}`);
  if (opts.length !== DEFAULTS.length) parts.push(`-l ${opts.length}`);
  if (opts.number !== DEFAULTS.number) parts.push(`-n ${opts.number}`);
  return parts.join(' ');
}

/** Split a shell-ish string into argv (whitespace; single and double quotes). */
export function splitArgs(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  if (out[0] === 'worms') out.shift();
  return out;
}
