#!/usr/bin/env node
// Regenerates src/engine/data/world.js from the upstream battlestar sources.
//
// The original C source is NOT part of this repository (root
// ATTRIBUTION.md, AGENTS.md section 9). Fetch it from
// https://github.com/vattam/BSDGames and pass the battlestar directory:
//
//   node scripts/extract-data.mjs <path-to>/battlestar
//
// With no argument it looks for ../../../../BSDGames-master/battlestar
// (the gitignored upstream checkout at the repo root, if present).
//
// Only DATA is transcribed: the room table (dayfile.c / nightfile.c), the
// object placements (dayobjs.c / nightobjs.c), the object tables
// (globals.c), the vocabulary (words.c) and the numeric #defines
// (extern.h). No C code is copied. See docs/decisions/003-upstream-text.md.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(process.argv[2] || join(here, '../../../../../BSDGames-master/battlestar'));
if (!existsSync(join(src, 'dayfile.c'))) {
  console.error(`usage: node scripts/extract-data.mjs <path-to>/battlestar  (not found: ${src})`);
  process.exit(1);
}
const read = (f) => readFileSync(join(src, f), 'latin1');

// ---------------------------------------------------------------- tokenizer
// Tokens: {t:'str', v, line} {t:'num', v} {t:'id', v} {t:'p', v} ('{', '}', ',', '|', '=', ';', '[', ']')
function tokenize(text) {
  const toks = [];
  let i = 0;
  let line = 1;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      line += (text.slice(i, end).match(/\n/g) || []).length;
      i = end + 2;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') { while (i < n && text[i] !== '\n') i++; continue; }
    if (c === '#') { while (i < n && text[i] !== '\n') { if (text[i] === '\\' && text[i + 1] === '\n') { i++; line++; } i++; } continue; }
    if (c === '"') {
      const startLine = line;
      let v = '';
      i++;
      while (text[i] !== '"') {
        let ch = text[i];
        if (ch === '\\') {
          const e = text[i + 1];
          i += 2;
          if (e === '\n') { line++; continue; }            // line continuation
          if (e === '\r' && text[i] === '\n') { i++; line++; continue; }
          if (e === 'n') v += '\n';
          else if (e === 't') v += '\t';
          else if (e === '\\') v += '\\';
          else if (e === '"') v += '"';
          else if (e === '\'') v += '\'';
          else if (e === '0') v += '\0';
          else throw new Error(`unknown escape \\${e} at line ${line}`);
          continue;
        }
        if (ch === '\n') throw new Error(`newline in string at line ${line}`);
        v += ch;
        i++;
      }
      i++;
      const prev = toks[toks.length - 1];
      if (prev && prev.t === 'str' && prev.open) prev.v += v; // adjacent literal concatenation
      else toks.push({ t: 'str', v, line: startLine, open: true });
      continue;
    }
    // any non-string token closes string concatenation
    const last = toks[toks.length - 1];
    if (last && last.t === 'str') last.open = false;
    if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(text[i + 1]))) {
      let j = i + 1;
      while (j < n && /[0-9xXa-fA-F]/.test(text[j])) j++;
      toks.push({ t: 'num', v: Number(text.slice(i, j)), line });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(text[j])) j++;
      toks.push({ t: 'id', v: text.slice(i, j), line });
      i = j;
      continue;
    }
    toks.push({ t: 'p', v: c, line });
    i++;
  }
  for (const t of toks) delete t.open;
  return toks;
}

// Parses a brace initializer starting at toks[k] === '{'. Returns [value, nextIndex].
// Scalars: strings, numbers, identifiers (resolved via defs), NULL, and A|B|C.
function parseInit(toks, k, defs) {
  if (toks[k].v !== '{') throw new Error(`expected { at line ${toks[k].line}`);
  k++;
  const out = [];
  while (toks[k].v !== '}') {
    if (toks[k].v === '{') {
      const [v, nk] = parseInit(toks, k, defs);
      out.push(v);
      k = nk;
    } else {
      let val = scalar(toks[k], defs);
      const line = toks[k].line;
      k++;
      while (toks[k].v === '|') { val |= scalar(toks[k + 1], defs); k += 2; }
      out.push(typeof val === 'string' ? { s: val, line } : val);
    }
    if (toks[k].v === ',') k++;
  }
  return [out, k + 1];
}
function scalar(tok, defs) {
  if (tok.t === 'str') return tok.v;
  if (tok.t === 'num') return tok.v;
  if (tok.t === 'id') {
    if (tok.v === 'NULL') return null;
    if (tok.v in defs) return defs[tok.v];
    throw new Error(`unknown identifier ${tok.v} at line ${tok.line}`);
  }
  throw new Error(`unexpected token ${tok.v} at line ${tok.line}`);
}
function findArray(toks, name) {
  for (let k = 0; k < toks.length; k++) {
    if (toks[k].t === 'id' && toks[k].v === name && toks[k + 1] && toks[k + 1].v === '[') {
      let j = k;
      while (toks[j].v !== '=') j++;
      return j + 1;
    }
  }
  throw new Error(`array ${name} not found`);
}

// ---------------------------------------------------------------- extern.h
const defs = {};
for (const m of read('extern.h').matchAll(/^#define\s+([A-Z_][A-Z0-9_]*)\s+(-?\d+)\b/gm)) defs[m[1]] = Number(m[2]);
// Computed ones used by the tables.
defs.NUMOFOBJECTS = 64;

// ---------------------------------------------------------------- rooms
function rooms(file, arrayName) {
  const toks = tokenize(read(file));
  const [arr] = parseInit(toks, findArray(toks, arrayName), defs);
  if (arr.length !== defs.NUMOFROOMS + 1) throw new Error(`${file}: ${arr.length} rooms`);
  return arr.map((r, idx) => {
    if (idx === 0) return null;
    const [name, link, desc] = r;
    if (link.length !== 8) throw new Error(`${file} room ${idx}: ${link.length} links`);
    return { name: name.s, link, desc: desc.s, line: name.line };
  });
}
const day = rooms('dayfile.c', 'dayfile');
const night = rooms('nightfile.c', 'nightfile');

// ---------------------------------------------------------------- objs
function objs(file, arrayName) {
  const toks = tokenize(read(file));
  const [arr] = parseInit(toks, findArray(toks, arrayName), defs);
  const out = [];
  for (const [room, obj] of arr) { if (room === 0) break; out.push([room, obj]); }
  return out;
}
const dayobjs = objs('dayobjs.c', 'dayobjs');
const nightobjs = objs('nightobjs.c', 'nightobjs');

// ---------------------------------------------------------------- globals.c
const gtoks = tokenize(read('globals.c'));
const flagDefs = { ...defs, OBJ_PLURAL: 1, OBJ_AN: 2, OBJ_PERSON: 4, OBJ_NONOBJ: 8 };
const table = (name) => parseInit(gtoks, findArray(gtoks, name), flagDefs)[0]
  .map((v) => (v && typeof v === 'object' && 's' in v ? v.s : v));
const objdes = table('objdes');
const objsht = table('objsht');
const ouch = table('ouch');
const objwt = table('objwt');
const objcumber = table('objcumber');
const objflags = table('objflags');
for (const [nm, t, len] of [['objdes', objdes, 64], ['objsht', objsht, 64], ['ouch', ouch, 13],
  ['objwt', objwt, 64], ['objcumber', objcumber, 64], ['objflags', objflags, 64]]) {
  if (t.length !== len) throw new Error(`${nm}: ${t.length} entries`);
}

// ---------------------------------------------------------------- words.c
const wtoks = tokenize(read('words.c'));
const [wl] = parseInit(wtoks, findArray(wtoks, 'wlist'), defs);
const wlist = [];
for (const e of wl) {
  if (e[0] === null) break;
  wlist.push([e[0].s, e[1], e[2]]);
}

// ---------------------------------------------------------------- emit
const wanted = ['KNIFE', 'SWORD', 'LAND', 'WOODSMAN', 'TWO_HANDED', 'CLEAVER', 'BROAD', 'MAIL', 'HELM', 'SHIELD',
  'MAID', 'BODY', 'VIPER', 'LAMPON', 'SHOES', 'CYLON', 'PAJAMAS', 'ROBE', 'AMULET', 'MEDALION', 'TALISMAN',
  'DEADWOOD', 'MALLET', 'LASER', 'BATHGOD', 'NORMGOD', 'GRENADE', 'CHAIN', 'ROPE', 'LEVIS', 'MACE', 'SHOVEL',
  'HALBERD', 'COMPASS', 'CRASH', 'ELF', 'FOOT', 'COINS', 'MATCHES', 'MAN', 'PAPAYAS', 'PINEAPPLE', 'KIWI',
  'COCONUTS', 'MANGO', 'RING', 'POTION', 'BRACELET', 'GIRL', 'GIRLTALK', 'DARK', 'TIMER', 'CHAR', 'BOMB',
  'DEADGOD', 'DEADTIME', 'DEADNATIVE', 'NATIVE', 'HORSE', 'CAR', 'POT', 'BAR', 'BLOCK', 'NUMOFOBJECTS',
  'UP', 'DOWN', 'AHEAD', 'BACK', 'RIGHT', 'LEFT', 'TAKE', 'USE', 'LOOK', 'QUIT', 'NORTH', 'SOUTH', 'EAST', 'WEST',
  'SU', 'DROP', 'TAKEOFF', 'DRAW', 'PUTON', 'WEARIT', 'PUT', 'INVEN', 'EVERYTHING', 'AND', 'KILL', 'RAVAGE',
  'UNDRESS', 'THROW', 'LAUNCH', 'LANDIT', 'LIGHT', 'FOLLOW', 'KISS', 'LOVE', 'GIVE', 'SMITE', 'SHOOT', 'ON', 'OFF',
  'TIME', 'SLEEP', 'DIG', 'EAT', 'SWIM', 'DRINK', 'DOOR', 'SAVE', 'RIDE', 'DRIVE', 'SCORE', 'BURY', 'JUMP', 'KICK',
  'OPEN', 'VERBOSE', 'BRIEF', 'AUXVERB', 'ARM', 'RIBS', 'SPINE', 'SKULL', 'INCISE', 'NECK', 'NUMOFINJURIES',
  'CANTLAUNCH', 'LAUNCHED', 'CANTSEE', 'CANTMOVE', 'JINXED', 'DUG', 'NUMOFNOTES', 'ROOMDESC', 'NUMOFROOMS',
  'LINELENGTH', 'TODAY', 'TONIGHT', 'CYCLE', 'TANKFULL', 'TORPEDOES', 'MAXWEIGHT', 'MAXCUMBER',
  'FINAL', 'GARDEN', 'POOLS', 'DOCK', 'VERB', 'OBJECT', 'NOUNS', 'PREPS', 'ADJS', 'CONJ', 'WORDLEN', 'NWORD'];
const C = {};
for (const k of wanted) {
  if (!(k in defs)) throw new Error(`missing #define ${k}`);
  C[k] = defs[k];
}

const js = (v) => JSON.stringify(v);
const roomLines = (arr) => arr.map((r, i) => (r === null ? '  null,' :
  `  /* ${i} */ { name: ${js(r.name)}, link: ${js(r.link)},\n    desc: ${js(r.desc)} },`)).join('\n');

const header = `// GENERATED by scripts/extract-data.mjs -- do not edit by hand.
//
// Data tables transcribed from the upstream battlestar sources
// (https://github.com/vattam/BSDGames/tree/master/battlestar):
//   dayfile.c, nightfile.c   room names, exit links, descriptions
//   dayobjs.c, nightobjs.c   initial object placements
//   globals.c                objdes, objsht, ouch, objwt, objcumber, objflags
//   words.c                  the parser vocabulary (wlist)
//   extern.h                 numeric constants
// Only data is transcribed; no C code is copied (see
// docs/decisions/003-upstream-text.md). Original notice:
//
//   Copyright (c) 1983, 1993
//       The Regents of the University of California.  All rights reserved.
//   Battlestar - a stellar-tropical adventure game. Originally written by
//   His Lordship, Admiral David W. Horatio Riggle, on the Cory PDP-11/70,
//   University of California, Berkeley.
//   Redistribution and use in source and binary forms, with or without
//   modification, are permitted provided that the conditions of the BSD
//   3-clause licence are met (see the upstream files for the full text).
//
// Room link order: [north, south, east, west, up, access, down, flyhere].
`;

const out = `${header}
export const C = Object.freeze(${JSON.stringify(C, null, 0).replace(/,"/g, ', "')});

/** dayfile[0..275]; index 0 is unused (null). */
export const DAYFILE = [
${roomLines(day)}
];

/** nightfile[0..275]; index 0 is unused (null). */
export const NIGHTFILE = [
${roomLines(night)}
];

/** [room, object] pairs, dayobjs.c order (order matters only for bit setting, not output). */
export const DAYOBJS = ${js(dayobjs)};
export const NIGHTOBJS = ${js(nightobjs)};

export const OBJDES = ${JSON.stringify(objdes, null, 1)};
export const OBJSHT = ${js(objsht)};
export const OUCH = ${js(ouch)};
export const OBJWT = ${js(objwt)};
export const OBJCUMBER = ${js(objcumber)};
export const OBJFLAGS = ${js(objflags)};

/** words.c wlist: [string, value, article(word type)], in table order. */
export const WLIST = ${js(wlist)};
`;

const dest = join(here, '../src/engine/data/world.js');
writeFileSync(dest, out);
console.log(`wrote ${dest}: ${day.length - 1} day rooms, ${night.length - 1} night rooms, ` +
  `${dayobjs.length} dayobjs, ${nightobjs.length} nightobjs, ${wlist.length} words`);
