// pom engine — faithful JavaScript port of BSD pom(6).
//
// Original: pom.c, NetBSD 1.14 (2004), BSDGames.
//   Copyright (c) 1989, 1993 The Regents of the University of California.
//   All rights reserved. This code is derived from software posted to USENET.
//   Phase of the Moon -- Keith E. Brandt, VIII 1984.
//   Updated to the Third Edition of Duffett-Smith's book, Paul Janzen, IX 1998.
// Upstream: https://github.com/vattam/BSDGames/blob/master/pom/pom.c
//
// Based on routines from "Practical Astronomy with Your Calculator" (3rd ed.)
// by Peter Duffett-Smith. The "sec NN #M" comments give the section and step
// of the book, exactly as the C source does.
//
// This module is DOM-free and GL-free so `node --test` can exercise it.
// Time is expressed in whole or fractional Unix seconds (C `time_t`).
// Time-zone behaviour (C `localtime` / `mktime`) is injected as a "zone"
// object so tests can pin a zone; the browser uses `localZone()`.

export const PI = 3.14159265358979323846;

// The EPOCH in the third edition of the book is 1990 Jan 0.0 TDT.
// Like the original, we do not correct for the difference between UTC and TDT.
export const EPOCH_MINUS_1970 = 20 * 365 + 5 - 1; // 20 years, 5 leaps, back 1 day to Jan 0
export const EPSILONg = 279.403303; // solar ecliptic long at EPOCH
export const RHOg = 282.768422;     // solar ecliptic long of perigee at EPOCH
export const ECCEN = 0.016713;      // solar orbit eccentricity
export const lzero = 318.351648;    // lunar mean long at EPOCH
export const Pzero = 36.340410;     // lunar mean long of perigee at EPOCH
export const Nzero = 318.510107;    // lunar mean long of node at EPOCH

export const SYNODIC_MONTH = 29.530588853; // days, for display only (moon "age")

export const USAGE = 'usage: pom [[[[[cc]yy]mm]dd]HH]';
export const ILLEGAL = 'pom: illegal time format';
export const OUT_OF_RANGE = 'pom: specified date is outside allowed range';

/** Convert degrees to radians (pom.c `dtor`). */
export function dtor(deg) {
  return deg * PI / 180;
}

/** Adjust value so 0 <= deg <= 360 (pom.c `adj360`, same loop semantics). */
export function adj360(deg) {
  for (;;) {
    if (deg < 0) deg += 360;
    else if (deg > 360) deg -= 360;
    else return deg;
  }
}

/**
 * The heart of pom: returns both the raw Moon–Sun elongation D (degrees,
 * NOT normalised, exactly as the C code computes it) and the phase
 * percentage 50 * (1 - cos D).
 */
export function potmDetail(days) {
  let N = 360 * days / 365.242191;                    // sec 46 #3
  N = adj360(N);
  let Msol = N + EPSILONg - RHOg;                     // sec 46 #4
  Msol = adj360(Msol);
  let Ec = 360 / PI * ECCEN * Math.sin(dtor(Msol));   // sec 46 #5
  let LambdaSol = N + Ec + EPSILONg;                  // sec 46 #6
  LambdaSol = adj360(LambdaSol);
  let l = 13.1763966 * days + lzero;                  // sec 65 #4
  l = adj360(l);
  let Mm = l - (0.1114041 * days) - Pzero;            // sec 65 #5
  Mm = adj360(Mm);
  let Nm = Nzero - (0.0529539 * days);                // sec 65 #6
  Nm = adj360(Nm);                                    // (unused, as in the original)
  const Ev = 1.2739 * Math.sin(dtor(2 * (l - LambdaSol) - Mm)); // sec 65 #7
  const Ac = 0.1858 * Math.sin(dtor(Msol));           // sec 65 #8
  const A3 = 0.37 * Math.sin(dtor(Msol));
  const Mmprime = Mm + Ev - Ac - A3;                  // sec 65 #9
  Ec = 6.2886 * Math.sin(dtor(Mmprime));              // sec 65 #10
  const A4 = 0.214 * Math.sin(dtor(2 * Mmprime));     // sec 65 #11
  const lprime = l + Ev + Ec - Ac + A4;               // sec 65 #12
  const V = 0.6583 * Math.sin(dtor(2 * (lprime - LambdaSol))); // sec 65 #13
  const ldprime = lprime + V;                         // sec 65 #14
  const D = ldprime - LambdaSol;                      // sec 67 #2
  return { D, percent: 50.0 * (1 - Math.cos(dtor(D))) }; // sec 67 #3
}

/** pom.c `potm`: phase of the moon as a percentage (0 = New, 100 = Full). */
export function potm(days) {
  return potmDetail(days).percent;
}

/** Elongation normalised to [0, 360): 0 New, 90 First Q, 180 Full, 270 Last Q. */
export function elongation(days) {
  const D = potmDetail(days).D % 360;
  return D < 0 ? D + 360 : D;
}

/** Days since 1990 Jan 0.0, as main() computes them. */
export function daysSinceEpoch(tSeconds) {
  return (tSeconds - EPOCH_MINUS_1970 * 86400) / 86400.0;
}

/**
 * C printf("%1.0f") for non-negative values: round to nearest,
 * ties to even (glibc default rounding mode on the exact binary value).
 */
export function cRound0(x) {
  const f = Math.floor(x);
  const diff = x - f; // exact for doubles in pom's range
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/**
 * The phase-naming logic of pom.c main(), returned as data.
 * `tmpt` and `now` are Unix seconds; tense compares whole seconds (time_t).
 */
export function describe(tmpt, now) {
  const days = daysSinceEpoch(tmpt);
  let today = potm(days) + 0.5;
  const t = Math.floor(tmpt);
  const n = Math.floor(now);
  const tense = t < n ? 'was' : t === n ? 'is' : 'will be';

  let key;
  let label;
  let pct = null;
  if (Math.trunc(today) === 100) {
    key = 'full';
    label = 'Full';
  } else if (!Math.trunc(today)) {
    key = 'new';
    label = 'New';
  } else {
    const tomorrow = potm(days + 1);
    if (Math.trunc(today) === 50) {
      // today is 0.5 too big, but it doesn't matter here
      // since the phase is changing fast enough
      key = tomorrow > today ? 'first-quarter' : 'last-quarter';
      label = tomorrow > today ? 'at the First Quarter' : 'at the Last Quarter';
    } else {
      today -= 0.5; // Now it might matter
      const dir = tomorrow > today ? 'Waxing' : 'Waning';
      pct = cRound0(today);
      if (today > 50) {
        key = `${dir.toLowerCase()}-gibbous`;
        label = `${dir} Gibbous (${pct}% of Full)`;
      } else {
        key = `${dir.toLowerCase()}-crescent`;
        label = `${dir} Crescent (${pct}% of Full)`;
      }
    }
  }
  return { tense, key, label, pct, sentence: `The Moon ${tense} ${label}` };
}

/** Short human names for describe().key, used by the UI. */
export const PHASE_NAMES = {
  new: 'New Moon',
  'waxing-crescent': 'Waxing Crescent',
  'first-quarter': 'First Quarter',
  'waxing-gibbous': 'Waxing Gibbous',
  full: 'Full Moon',
  'waning-gibbous': 'Waning Gibbous',
  'last-quarter': 'Last Quarter',
  'waning-crescent': 'Waning Crescent',
};

/**
 * Continuous phase state for rendering. Everything visual is derived
 * from pom's own elongation D, so the terminator is never faked.
 */
export function phaseState(tSeconds) {
  const days = daysSinceEpoch(tSeconds);
  const { D, percent } = potmDetail(days);
  let e = D % 360;
  if (e < 0) e += 360;
  return {
    days,
    elongation: e,                 // degrees, 0..360
    percent,                       // pom's 0..100
    illuminated: percent / 100,    // lit fraction of the disc, = (1 - cos D) / 2
    waxing: e < 180,
    age: (e / 360) * SYNODIC_MONTH // days since New, for display
  };
}

// ---------------------------------------------------------------------------
// Time zones — stand-ins for C localtime(3) / mktime(3) / strftime %Z.
// ---------------------------------------------------------------------------

/** The browser's / process's local zone (what pom uses). */
export function localZone() {
  let fmt = null;
  return {
    id: 'local',
    mktime({ year, mon, mday, hour, min = 0, sec = 0 }) {
      const d = new Date(2000, 0, 1, 0, 0, 0, 0);
      d.setFullYear(year, mon, mday);
      d.setHours(hour, min, sec, 0);
      return d.getTime() / 1000;
    },
    localtime(t) {
      const d = new Date(t * 1000);
      return {
        year: d.getFullYear(), mon: d.getMonth(), mday: d.getDate(),
        hour: d.getHours(), min: d.getMinutes(), sec: d.getSeconds(), wday: d.getDay(),
      };
    },
    abbrev(t) {
      try {
        fmt ??= new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' });
        const part = fmt.formatToParts(new Date(t * 1000)).find((p) => p.type === 'timeZoneName');
        return part ? part.value : 'local';
      } catch {
        return 'local';
      }
    },
  };
}

/** A fixed-offset zone (minutes east of UTC), e.g. fixedZone(420, 'WIB'). */
export function fixedZone(offsetMinutes, abbrev) {
  const off = offsetMinutes * 60;
  return {
    id: abbrev,
    mktime({ year, mon, mday, hour, min = 0, sec = 0 }) {
      const d = new Date(0);
      d.setUTCFullYear(year, mon, mday);
      d.setUTCHours(hour, min, sec, 0);
      return d.getTime() / 1000 - off;
    },
    localtime(t) {
      const d = new Date((t + off) * 1000);
      return {
        year: d.getUTCFullYear(), mon: d.getUTCMonth(), mday: d.getUTCDate(),
        hour: d.getUTCHours(), min: d.getUTCMinutes(), sec: d.getUTCSeconds(), wday: d.getUTCDay(),
      };
    },
    abbrev() {
      return abbrev;
    },
  };
}

// ---------------------------------------------------------------------------
// Date parsing — pom.c parsetime(), same right-to-left fall-through.
// ---------------------------------------------------------------------------

/**
 * Parse pom's compressed [[[[[cc]yy]mm]dd]HH] argument.
 * Unspecified fields default to the current local date; minutes and
 * seconds are zeroed. Returns { ok: true, t } or { ok: false, error }.
 */
export function parseTime(arg, { now, zone }) {
  const p = String(arg);
  if (!/^[0-9]*$/.test(p)) return { ok: false, error: ILLEGAL };

  const lt = zone.localtime(now);
  lt.sec = 0;
  lt.min = 0;
  let i = 0;
  const atoi2 = () => {
    const v = (p.charCodeAt(i) - 48) * 10 + (p.charCodeAt(i + 1) - 48);
    i += 2;
    return v;
  };

  let yearset = false;
  switch (p.length) {
    case 10: // yyyy
      lt.year = atoi2() * 100;
      yearset = true;
    // FALLTHROUGH
    case 8: // yy
      if (yearset) {
        lt.year += atoi2();
      } else {
        lt.year = atoi2();
        if (lt.year < 69) lt.year += 100; // hack for 2000
        lt.year += 1900;
      }
    // FALLTHROUGH
    case 6: // mm
      lt.mon = atoi2();
      if (lt.mon > 12 || !lt.mon) return { ok: false, error: ILLEGAL };
      --lt.mon; // time struct is 0 - 11
    // FALLTHROUGH
    case 4: // dd
      lt.mday = atoi2();
      if (lt.mday > 31 || !lt.mday) return { ok: false, error: ILLEGAL };
    // FALLTHROUGH
    case 2: // HH
      lt.hour = atoi2();
      if (lt.hour > 23) return { ok: false, error: ILLEGAL };
      break;
    default:
      return { ok: false, error: ILLEGAL };
  }
  const t = zone.mktime(lt);
  if (!Number.isFinite(t)) return { ok: false, error: OUT_OF_RANGE };
  return { ok: true, t };
}

// ---------------------------------------------------------------------------
// Output formatting — strftime("%a %Y %b %e %H:%M:%S (%Z)").
// ---------------------------------------------------------------------------

const WDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n) => String(n).padStart(2, '0');

export function formatHeader(t, zone) {
  const lt = zone.localtime(t);
  return `${WDAY[lt.wday]} ${lt.year} ${MON[lt.mon]} ${String(lt.mday).padStart(2, ' ')} ` +
    `${pad2(lt.hour)}:${pad2(lt.min)}:${pad2(lt.sec)} (${zone.abbrev(t)})`;
}

/** Build the compressed ccyymmddHH argument that names hour-floor of t. */
export function toCompressed(t, zone) {
  const lt = zone.localtime(t);
  return `${String(lt.year).padStart(4, '0')}${pad2(lt.mon + 1)}${pad2(lt.mday)}${pad2(lt.hour)}`;
}

/**
 * Run pom exactly as the command line would: `pom` or `pom <arg>`.
 * Returns { stdout, stderr, code, t } — byte-for-byte what the original
 * binary prints (verified against golden fixtures from /usr/games/pom).
 */
export function runPom(arg, { now, zone }) {
  let tmpt;
  let head = '';
  if (arg !== undefined && arg !== null) {
    const r = parseTime(arg, { now, zone });
    if (!r.ok) {
      const stderr = r.error === ILLEGAL ? `${ILLEGAL}\n${USAGE}\n` : `${r.error}\n`;
      return { stdout: '', stderr, code: 1, t: null };
    }
    tmpt = r.t;
    head = `${formatHeader(tmpt, zone)}:  `;
  } else {
    tmpt = Math.floor(now);
  }
  const d = describe(tmpt, now);
  return { stdout: `${head}${d.sentence}\n`, stderr: '', code: 0, t: tmpt, report: d };
}
