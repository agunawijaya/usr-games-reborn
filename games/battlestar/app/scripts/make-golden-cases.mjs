#!/usr/bin/env node
// Expands the golden-case catalogue below into tests/golden/cases.json.
//
// Each case is a list of steps: a string is sent as one input line;
// { goto: N } expands to the relative moves (ahead/left/...) that walk to
// room N from wherever the engine currently is; { su: [room, time] } expands
// to the eight answers of the wizard `su` prompt. Expansion runs the engine,
// so it knows the facing at every step. The real binary then judges the
// resulting input (scripts/golden-capture.mjs), and tests/golden.test.js
// requires the engine to match it byte for byte.
//
// Walkthrough cases (walkthrough-seed*) are generated separately by
// scripts/make-walkthrough.mjs and are preserved here.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Battlestar } from '../src/engine/battlestar.js';
import { route, relativeVerb } from '../src/engine/planner.js';

const here = dirname(fileURLToPath(import.meta.url));
const casesFile = join(here, '../tests/golden/cases.json');

const su = (room, time = '') => ({ su: [room, time] });

const CATALOGUE = [
  {
    name: '01-parser', seed: 3,
    note: 'blank lines, unknown words, case, adjectives, commas, long words, stale words, every verb once',
    steps: ['', '   ', 'xyzzy', 'LOOK', 'Look', 'lo', 'take', 'take the knife', 'take the old knife', 'get knife',
      'i', 'inven', 'abcdefghijklmnopqrstuvwxyz look', 'right, right', 'back,back', 'take off pajamas', 'i',
      'wear pajamas', 'take pajamas', 'put on pajamas', 'i', 'put down pajamas', 'put', 'put pajamas', 'drop',
      'drop all', 'take all', 'wear all', 'take off all', 'i', 'kiss', 'love', 'drink', 'eat', 'eat knife',
      'eat pajamas', 'sleep', 'swim', 'jump', 'dig', 'bury', 'open door', 'open', 'ride', 'drive', 'light',
      'follow', 'use', 'use compass', 'use amulet', 'shoot', 'kill', 'smite', 'stab man', 'su', 'time', 'score',
      'points', 'verbose', 'look', 'brief', 'look', 'launch', 'land', 'give', 'give pajamas to man', 'throw',
      'kick', 'kick door', 'climb up', 'make love', 'up', 'down', 'left', 'ahead', ',', 'and', 'take knife and',
      'take , knife', 'wear pajamas, look', 'take pajamas and pajamas', 'kiss the goddess', 'the', 'q'],
  },
  {
    name: '02-ship-items', seed: 5,
    note: 'weights and bulk, inventory report, taking bodies, the bomb, matches',
    steps: [{ goto: 24 }, 'take matches', 'light match', 'look', 'i', { goto: 21 }, 'take knife', 'take body',
      'take maid', 'i', 'drop body', 'kill maid', 'bury body', { goto: 20 }, 'take laser', 'i', 'wear laser', 'i',
      'draw laser', 'draw all', 'wear knife', 'i', { goto: 19 }, 'take bomb', 'take warhead', 'i', 'look',
      'drop warhead'],
  },
  {
    name: '03-ship-explodes', seed: 9,
    note: 'dawdling on the battlestar: explosions from turn 21, death after turn 30',
    expect: ['Explosions rock the battlestar.', 'frozen void of space and killed.'],
    steps: ['right', ...Array(20).fill('back'), 'score', ...Array(12).fill('back')],
  },
  {
    name: '04-magnesium-door', seed: 12,
    note: 'shooting the presidential suite door',
    steps: [{ goto: 20 }, 'take laser', 'open door', 'shoot door'],
  },
  {
    name: '05-grenades', seed: 14, username: 'riggle',
    note: 'throwing a grenade into the next room, then at your feet',
    expect: ['A thundering explosion nearby', 'The ground is charred here.', 'You are blown into shreds'],
    steps: [{ goto: 26 }, 'take grenade', 'i', 'throw grenade back', 'look', 'back', 'look', 'back',
      'take grenade', 'throw grenade'],
  },
  {
    name: '06-wizard', seed: 21, username: 'riggle',
    note: 'hereditary wizard: su, thin-air takes, gust of wind, digging, horse, car',
    steps: ['i', 'take laser', 'take shovel', 'up', 'i', su(144), 'dig', 'look', 'take all', su(236),
      'ride horse', 'look', su(237), 'drive car', 'look', 'score', su(144, '99'), 'right', 'time', 'score'],
  },
  {
    name: '07-anti-wizard', seed: 22, username: 'root',
    note: 'an anti-wizard login: tiny carrying limits, woodsmen and elves on the ship',
    steps: ['i', 'right', 'right', 'take amulet', 'i'],
  },
  {
    name: '08-darkness-and-gas', seed: 23, username: 'chris',
    note: 'caves are dark without a light; a match in the gas-filled kitchen',
    steps: [su(257), 'look', 'take matches', 'light match', 'look', 'look', su(268), 'look', su(217), 'look',
      'light match'],
  },
  {
    name: '09-elf-fight', seed: 31, username: 'edward',
    note: 'the day elf at 146: every fight verb, escape, then a laser kill',
    steps: ['take laser', 'take knife', su(146), 'look', 'xyzzy', 'kill', 'drop knife', 'draw laser', 'back',
      su(146), 'shoot', 'look', 'score'],
  },
  {
    name: '10-woodsman', seed: 32, username: 'ken',
    note: 'the woodsman at 172 fought with a two-handed sword',
    steps: ['take two-handed', su(172), 'kill', 'kill', 'kill', 'kill', 'kill', 'kill', 'kill', 'kill', 'look'],
  },
  {
    name: '11-goddess-violence', seed: 33, username: 'dmr',
    note: 'the bathing goddess: kiss/take/follow, and the grim alternatives',
    steps: ['take knife', su(126), 'look', 'kiss goddess', 'follow', 'kiss goddess', 'kiss goddess', 'kiss goddess',
      'love goddess', 'take medallion', 'give ring to goddess', 'take ring', 'give ring to goddess',
      'rape goddess'],
  },
  {
    name: '12-oldtimer-map', seed: 34, username: 'yee',
    note: 'giving coins to the old-timer at the clubhouse bar draws the catacomb map',
    steps: ['take coins', su(235), 'look', 'kiss timer', 'give coins to timer', 'look'],
  },
  {
    name: '13-dusk-and-dawn', seed: 35, username: 'comay',
    note: 'time passing outside: sunset text, night objects, sunrise',
    expect: ['The dying sun sinks into the ocean', 'The natives are having a festive luau', 'Dew lit sunbeams'],
    steps: [su(80, '100'), 'time', 'right', 'time', 'look', su(92), 'look', 'time', 'sleep', su(80, '200'), { goto: 106 }, 'time',
      'look', 'back', 'time'],
  },
  {
    name: '14-flight-crash', seed: 36,
    note: 'launching, flying low and crashing (down instead of land)',
    expect: ["You're flying too low.  We're going to crash!", 'The viper explodes into the ground'],
    steps: [{ goto: 7 }, 'launch', 'right', 'ahead', 'ahead', 'q', '', 'ahead', 'ahead', 'down', 'left', 'down',
      'i', 'look'],
  },
  {
    name: '15-sleep-and-eat', seed: 37, username: 'riggle',
    note: 'eating needs a knife and has limits; sleeping outside and in; exhaustion',
    steps: [su(109, '120'), 'take papayas', 'eat papayas', 'take knife', 'eat papayas', 'take all', 'eat all',
      'sleep', 'look', su(263, '140'), 'sleep', 'i', su(80, '147'), 'right', 'back', 'right', 'back', 'right',
      'back', 'i'],
  },
  {
    name: '16-jumping', seed: 38, username: 'ken',
    note: 'jumping off the gallery and the chasm; shooting and throwing at doors',
    expect: ['The wooden door splinters.', 'The door is unhinged.', 'Ahhhhhhh...'],
    steps: ['take laser', su(30), 'open door', 'shoot door', 'look', su(189), 'open door', 'shoot door',
      'look', 'open door', su(3), 'jump', 'i', su(232), 'jump', 'look'],
  },
];

function expand(c) {
  const g = new Battlestar({ seed: c.seed, username: c.username || '', flightMode: 'stdin', keepTranscript: true });
  let r = g.start();
  const input = [];
  const send = (line) => {
    input.push(line);
    if (!r.ended) r = g.send(line);
  };
  for (const step of c.steps) {
    if (r.ended) break;
    if (typeof step === 'string') send(step);
    else if (step.goto) {
      let guard = 0;
      while (!r.ended && g.position !== step.goto && guard++ < 60) {
        const path = route(g, step.goto, { allowAmulet: false });
        if (!path) throw new Error(`${c.name}: no route to ${step.goto} from ${g.position}`);
        const s0 = path[0];
        send(typeof s0.cmd === 'string' ? s0.cmd : relativeVerb(g.direction, s0.cmd.abs));
      }
    } else if (step.su) {
      const [room, time] = step.su;
      send('su');
      for (const v of [String(room), String(time), '', '', '', '', '', '']) send(v);
    }
  }
  const text = g.transcript.join('');
  for (const e of c.expect || []) if (!text.includes(e)) throw new Error(`${c.name}: never printed "${e}"`);
  return { name: c.name, seed: c.seed, ...(c.username ? { username: c.username } : {}), note: c.note, input };
}

const old = JSON.parse(readFileSync(casesFile, 'utf8'));
const walkthroughs = old.filter((c) => c.name.startsWith('walkthrough-') || c.name.startsWith('probe-'));
const cases = [...CATALOGUE.map(expand), ...walkthroughs];
writeFileSync(casesFile, JSON.stringify(cases, null, 1) + '\n');
console.log(`wrote ${cases.length} cases`);
