#!/usr/bin/env node
// Writes docs/walkthrough.md from real games: both routes of
// src/engine/routes.js are played on seed 7 (the transcripts the real binary
// replays in tests/golden/walkthrough-*-seed7.out) and surveyed on 200 seeds.
//
//   node scripts/make-walkthrough-doc.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { playRoute, TARGET } from '../src/engine/routes.js';
import { DAYFILE, NIGHTFILE } from '../src/engine/battlestar.js';

const here = dirname(fileURLToPath(import.meta.url));
const SEED = 7;
const SURVEY = 200;

const roomName = (r, night) => {
  const n = ((night ? NIGHTFILE : DAYFILE)[r]?.name || `room ${r}`).trim().replace(/\.$/, '');
  return `${n} (${r})`;
};

/** Splits a game into phases by what just happened. */
function phases(rows, full) {
  const out = [];
  let cur = null;
  const open = (title) => { cur = { title, rows: [] }; out.push(cur); };
  let stage = 0;
  const titles = full
    ? ['Escape the battlestar', 'Fly to the island', 'The goddess', 'Arm yourself, fill the afternoon, go down by day', 'Night: armour, the Dark Lord, the talisman', 'The hunt for Power', 'Back to the goddess: the gifts and the end']
    : ['Escape the battlestar', 'Fly to the island', 'The goddess', 'Arm yourself, fill the afternoon, go down by day', 'Night: armour, the Dark Lord, the talisman', 'Back to the goddess: the gifts and the end'];
  open(titles[0]);
  rows.forEach((row, k) => {
    cur.rows.push(row);
    const next = rows[k + 1];
    const advance = () => { stage++; if (next) open(titles[stage]); };
    if (stage === 0 && row.cmd === 'launch') advance();
    else if (stage === 1 && row.cmd === 'land') advance();
    else if (stage === 2 && row.cmd === 'love goddess') advance();
    else if (stage === 3 && row.cmd === 'sleep') advance();
    else if (stage === 4 && /^take (talisman|amulet)$/.test(row.cmd) && !(next && /^take (talisman|amulet)$/.test(next.cmd))) advance();
    else if (full && stage === 5 && next && next.kind === 'planner' && next.goal !== 'Recover') advance();
  });
  return out;
}

/** Folds runs of the same command (pacing, fight rounds, kisses) into one line. */
function fold(rows) {
  const out = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    const same = last && last.cmd === r.cmd && last.kind === r.kind &&
      (r.kind === 'fight' || r.why === last.why || (r.kind === 'planner' && r.goal && r.goal === last.goal));
    if (same) { last.n++; last.room = r.room; last.night = r.night; last.t = r.t; last.last = r; } else out.push({ ...r, n: 1, last: r });
  }
  return out;
}

const esc = (s) => String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

function table(rows, startNo) {
  const lines = ['| # | Type | Then you are | Why |', '|--:|---|---|---|'];
  let no = startNo;
  let prevWhy = null;
  for (const r of fold(rows)) {
    const from = no;
    no += r.n;
    const num = r.n > 1 ? `${from}–${no - 1}` : `${from}`;
    let cmd = `\`${r.cmd}\``;
    if (r.n > 1) cmd += ` ×${r.n}`;
    let why = r.why;
    if (r.kind === 'dogfight') cmd = '`q` (in the dogfight)';
    if (r.kind === 'fight' && !why) why = 'Fight.';
    // say why once per stretch of the same goal
    const shown = why === prevWhy ? '〃' : why;
    prevWhy = why;
    why = shown;
    lines.push(`| ${num} | ${cmd} | ${esc(roomName(r.room, r.night))}, turn ${r.t} | ${esc(why)} |`);
  }
  return { md: lines.join('\n'), next: no };
}

function survey(name) {
  const res = [];
  for (let s = 1; s <= SURVEY; s++) {
    const r = playRoute(s, name);
    const g = r.g;
    const ok = r.won && (name !== 'full' || (g.pleasure >= TARGET.pleasure && g.power >= TARGET.power && g.ego >= TARGET.ego));
    res.push({ s, ok, n: r.input.length, t: g.ourtime });
  }
  const ok = res.filter((x) => x.ok);
  const avg = (k) => Math.round(ok.reduce((a, x) => a + x[k], 0) / ok.length);
  return { ok: ok.length, lost: res.filter((x) => !x.ok).map((x) => x.s), n: avg('n'), t: avg('t'), min: Math.min(...ok.map((x) => x.n)), max: Math.max(...ok.map((x) => x.n)) };
}

function walkthrough(name, full) {
  const r = playRoute(SEED, name);
  if (!r.won) throw new Error(`${name} does not win on seed ${SEED}`);
  const g = r.g;
  const parts = [];
  let no = 1;
  for (const p of phases(r.rows, full)) {
    const t = table(p.rows, no);
    no = t.next;
    parts.push(`### ${p.title}\n\n${t.md}`);
  }
  return { md: parts.join('\n\n'), n: r.input.length, t: g.ourtime, score: [g.pleasure, g.power, g.ego], rating: g.rate() };
}

const fast = walkthrough('fastest', false);
const full = walkthrough('full', true);
const sFast = survey('fastest');
const sFull = survey('full');

const doc = `# Walkthroughs — *Battlestar — Pajamas to Paradise*

Two complete walkthroughs, from waking up in the stateroom to **You win!**:

1. **[The fastest win](#1-the-fastest-win)** — ${fast.n} commands, ${fast.t} turns.
2. **[The full score](#2-the-full-score)** — a win with every scale at its
   top title: Pleasure ${TARGET.pleasure}+ (*Marquis De Sade*), Power
   ${TARGET.power}+ (*Sauron the Great*), Ego ${TARGET.ego}+ (*Mr. Roarke*) —
   ${full.n} commands, ${full.t} turns, final score ${full.score.join(' / ')}.

Both are generated from real games by \`scripts/make-walkthrough-doc.mjs\`
(the routes are in \`src/engine/routes.js\`), and both are proven:

- the exact commands below win on **the real 1979 program** — they are replayed
  on the Debian binary in \`tests/golden/walkthrough-fastest-seed7.out\` and
  \`walkthrough-full-seed7.out\`, byte for byte identical to this port;
- the same routes were played on ${SURVEY} different seeds: the fastest won
  ${sFast.ok} (${sFast.min}–${sFast.max} commands, ${sFast.t} turns on average),
  the full score was reached in ${sFull.ok} (${sFull.min}–${sFull.max}
  commands)${sFast.lost.length ? `; the only losses (seed ${[...new Set([...sFast.lost, ...sFull.lost])].join(', ')}) are a Dark Lord fight that went wrong` : ''};
- \`tests/walkthrough.test.js\` keeps them winning.

The canonical walkthroughs in [\`../../../docs/walkthrough.md\`](../../../docs/walkthrough.md)
cannot be played (compass words that do not exist, invented rooms and
points; see [notes §2.5](./notes.md#25-walkthroughs)); these replace them for
this port.

## How to follow them

- **Start a new game with seed ${SEED}** (the seed field in *New game*, or open
  \`index.html?fresh=1&seed=${SEED}\`). With that seed every line below happens
  exactly as printed. With another seed the fights go differently (how many
  blows, which wounds), and wounds change a few steps after them — drinking
  the potion, putting something down, a rest. The route stays the same:
  play the fights by the rules in [Fights](#fights) and carry on.
- **Directions are relative** to the way you face (\`ahead\`, \`back\`,
  \`left\`, \`right\`, \`up\`, \`down\`), exactly as in the original: type the
  commands in order and your facing will match.
- **Type each command once per line**: \`back ×19\` means nineteen times.
- The dogfight in space is played with the keyboard; press **q** to break
  off (winning it gives no points).
- The hint panel (\`Hints\`) follows the port's own safe line (close to
  walkthrough 1, with longer waits); it can take over at any point.

## Fights

The Dark Lord (room 266) must be **wounded, not killed**: once he has lost
more than a third of his strength, retreat (\`back\`) while you carry the
amulet — he snatches it and flees. Follow him (\`follow\`); in the pit he
corners you — \`back\` again at once, and his talisman and the amulet fall
where you land. Never carry the medallion into that fight.

How hard you hit shows in the message after each \`kill\` (points of his
strength of 100):

| The game says | He loses |
|---|--:|
| "You swung wide and missed." / "He checked your blow." / "…one less thread." | 0 |
| "He's bleeding." / "A trickle of blood…" / "A huge purple bruise…" | 1 |
| "He staggers back quavering." / "He jumps back…" / "His shirt falls open…" | 5 |
| "A bloody gash opens up…" / "The steel bites home…" / "You pierce him…" | 10 |
| "You smite him to the ground." / "…sends him to his knees." / "…collapses stunned." | 20 |
| "His ribs crack…" | 30 |
| "You shatter his upheld arm…" / "With a mighty lunge…" | 55 |

Retreat as soon as the total passes **33**. The two-handed sword hits
hardest; every item you *wear* weakens your blow by one point, and the coat
of mail and helmet make his blows far less dangerous.

Elves and woodsmen: \`draw laser\` (it costs no time in a fight), then
\`shoot\` — one shot kills either.

## Scoring

What the program counts (\`command*.c\`), and what these walkthroughs use:

| Scale | Earned by | Used here |
|---|---|---|
| Pleasure | a kiss (+1, no time), helping the bathing goddess out (+1), loving the goddess (+15), loving the native girl (+5, ten turns) | all |
| Power | winning a fight (+2: elf, woodsman, Dark Lord), killing the goddess at the end (+5), loving the girl (+1); giving an artifact to the goddess costs 5 | all |
| Ego | giving anything (+1; +3 to the native girl, +6 for the ring or bracelet to the goddess, +6 per artifact to the goddess), burying a corpse (+2); shooting the goddess costs 10 | gifts, ring |

The title (\`score\`) comes from the highest scale: Pleasure 5/20/35 →
*junior voyeur*, *Don Juan*, *Marquis De Sade*; Power 5/8/13/22 → *Samurai*,
*Klingon*, *Darth Vader*, *Sauron the Great*; Ego 5/10/20 → *philanthropist*,
*Tattoo*, *Mr. Roarke*. Kisses and the girl can be repeated, so no score has
a ceiling; "full score" here means the top title on all three scales at
once. The program also awards Power and Pleasure for assault ("ravage") and
for killing harmless people; these walkthroughs use neither.

---

## 1. The fastest win

${fast.n} commands and ${fast.t} turns on seed ${SEED}; ${sFast.min}–${sFast.max} commands on
other seeds. The idea: the goddess must be won on the first day and the
Dark Lord met at night (the ladder into the mine exists only at night), so
the afternoon has to pass. One visit to the native girl fills ten turns
with a single command, and a nap underground (where no thief comes)
shortens the wait. Final score ${fast.score.join(' / ')}, rating *${fast.rating}*.

${fast.md}

---

## 2. The full score

${full.n} commands and ${full.t} turns on seed ${SEED}. The same opening, then the
difference: once the talisman is won, **before** handing over the artifacts,
go hunting — every elf and woodsman is worth 2 Power, and the laser kills
each with one shot. While you still hold the amulet it can carry you back
to the goddess's valley at any time (on foot it cannot be entered again).
Sleep only in the bungalow bedroom (218) — outdoors a thief comes in the
night, and an artifact he takes is gone for good. Take the ring from that
bedroom; give it to the goddess after the three artifacts (Ego +6), top up
Pleasure with kisses (they take no time), and strike the last blow with a
blade — a halberd, left by every elf — because shooting her costs 10 Ego.

Final score **${full.score.join(' / ')}** (Pleasure / Power / Ego) — *Marquis De
Sade*, *Sauron the Great* and *Mr. Roarke* at once (the game names the
highest: *${full.rating}*).

${full.md}
`;

writeFileSync(join(here, '../docs/walkthrough.md'), doc);
console.log(`docs/walkthrough.md: fastest ${fast.n} commands, full ${full.n} commands; survey fastest ${sFast.ok}/${SURVEY}, full ${sFull.ok}/${SURVEY}`);
