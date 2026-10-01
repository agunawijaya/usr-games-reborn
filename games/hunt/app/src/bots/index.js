// Bot roster. Every bot is a player that types keys into its own typeahead,
// exactly like a human (or like otto.c on its own client); the engine gives
// no bot any information its screen would not show. See port ADR 003.
//
//   otto   Classic Otto — otto.c ported literally (src/bots/otto.js)
//   novice extension: Otto's reflexes slowed down, rarely throws grenades
//   sharp  extension: Sharpshooter — plans multi-bounce ricochets and leads
//          moving targets (src/bots/sharp.js)

import { otto, newOttoBrain } from './otto.js';
import { novice } from './novice.js';
import { sharp } from './sharp.js';
import { glibcSeed } from '../engine/rng.js';
import { nameOf } from '../engine/hunt.js';

export const BOT_KINDS = {
  otto: { label: 'Classic Otto', note: 'otto.c, bugs and all — a wall-follower made for perfect mazes (it circles in the Ricochet arena)' },
  novice: { label: 'Novice', note: 'reacts late, shoots straight lines only, rarely uses grenades' },
  sharp: { label: 'Sharpshooter', note: 'plans multi-bounce ricochets, leads targets, hunts' },
};

export function addBot(g, name, kind = 'otto', rseed = 1) {
  g.bots[name] = { kind, rs: glibcSeed(rseed), brain: newOttoBrain(), wait: 0 };
}

// Called by step() once the world has moved: a bot whose typeahead has run
// out types its next keys. Flying players cannot act (execute.c:85-97).
export function runBots(g) {
  for (let n = 0; n < g.np; n++) {
    const pp = g.slots[n];
    const b = g.bots[nameOf(g, pp)];
    if (!b || pp.q.length || pp.flying >= 0) continue;
    if (g.cheats.freezeBots) continue;
    let cmd;
    switch (b.kind) {
      case 'novice': cmd = novice(g, pp, b); break;
      case 'sharp': cmd = sharp(g, pp, b); break;
      default: cmd = otto(g, pp, b.brain, b.rs); break;
    }
    if (cmd === null) continue;
    g.ev.push({ t: 'bot', id: pp.id, name: nameOf(g, pp), cmd });
    for (const c of cmd) pp.q.push(c.charCodeAt(0));
    if (cmd.length) pp.typed = true;
  }
}
