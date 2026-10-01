// Command-line grammar.
//
// The original read single keystrokes and then prompted (sail/pl_2.c:45-160):
// 'm' asked "move (7, 4):", 'f' asked "Aim for hull or rigging?", 'l' asked
// "Reload with (round, double, chain, grape)?" and so on. A turn-based port
// has no prompts racing a 7-second clock, so each prompt's answer is typed
// on the same line as its key. A bare helm string is a move order, exactly
// what you would have typed at the move prompt.
//
//   l1r1r2            helm order (also: m l1r1r2). The last one wins.
//   f  [l|r|b] [h|r]  fire port / starboard / both, at hull or rigging
//   ld [l|r|b] <r|d|c|g>   load an empty broadside (round/double/chain/grape)
//   L                 unload both broadsides
//   c  [full|battle]  change sail (toggle when no argument)
//   rp <h|g|r>        repair hull / guns / rigging (all hands, nothing else)
//   g  <ship> [u]     grapple (or ungrapple) a ship alongside
//   u  <ship>         try to unfoul
//   b  <ship> <n>     send n crew sections to board;  b repel <n>
//   B                 recall all boarding parties ("hands to stations")
//   i  [ship] / I     identify nearest ship / all ships
//   F  <glyph>        lookout for a ship by its glyph (e.g. f1, b?)
//   go | .            make it so: end the turn
//   ?  / help         command summary
//
// <ship> may be a glyph (b0, F1, !2), a #index, or a name prefix.

import { glyph } from './state.js';

const HELM = /^[lrbd0-7]+$/;
const SIDE = { l: ['L'], p: ['L'], port: ['L'], left: ['L'], r: ['R'], s: ['R'], starboard: ['R'], right: ['R'], b: ['L', 'R'], both: ['L', 'R'] };
const SHOT = { r: 'round', round: 'round', d: 'double', double: 'double', c: 'chain', chain: 'chain', g: 'grape', grape: 'grape' };
const REPAIR = { h: 'hull', hull: 'hull', g: 'guns', guns: 'guns', r: 'rigging', rigging: 'rigging' };

export function findShip(st, ref, me) {
  if (ref == null || ref === '') return null;
  const s = String(ref).trim();
  if (/^#\d+$/.test(s)) return st.ships[+s.slice(1)] || null;
  if (/^\d+$/.test(s)) return st.ships[+s] || null;
  const byGlyph = st.ships.filter((sp) => sp.dir !== 0 && sp !== me
    && (glyph(st, sp).toLowerCase() === s.toLowerCase()
      || (s.length === 2 && s[1] === '?' && glyph(st, sp)[0].toLowerCase() === s[0].toLowerCase())));
  if (byGlyph.length) return byGlyph[0];
  const low = s.toLowerCase();
  return st.ships.find((sp) => sp !== me && sp.name.toLowerCase().startsWith(low)) || null;
}

export function parseCommand(st, meIdx, text) {
  const me = st.ships[meIdx];
  // a leading "/" or ":" (the keys that focus the command line) is ignored
  const raw = String(text || '').trim().replace(/^[/:]+\s*/, '');
  if (!raw || raw === '.' || /^(go|end|make it so)$/i.test(raw)) return { kind: 'commit' };
  if (HELM.test(raw)) return { kind: 'order', patch: { move: raw }, say: `Helm order: ${raw}` };
  const [cmd0, ...rest] = raw.split(/\s+/);
  const args = rest.map((a) => a.toLowerCase());
  const err = (msg) => ({ kind: 'error', msg });
  switch (cmd0) {
    case 'm': case 'move':
      if (!args.length) return err('move what? e.g. m l1r1r2');
      return { kind: 'order', patch: { move: args.join('') }, say: `Helm order: ${args.join('')}` };
    case 'f': case 'fire': {
      let sides = ['L', 'R'];
      let aim = 'hull';
      // "f r r": the first l/r/b picks the side, a later r means rigging.
      args.forEach((a, i) => {
        if (i === 0 && SIDE[a]) sides = SIDE[a];
        else if (a === 'h' || a === 'hull') aim = 'hull';
        else if (a === 'r' || a === 'rig' || a === 'rigging') aim = 'rigging';
        else if (SIDE[a]) sides = SIDE[a];
        else aim = null;
      });
      if (!aim) return err('fire: f [l|r|b] [h|r]  e.g. "f l h" = port broadside at the hull');
      const fire = {};
      for (const s of sides) fire[s] = aim;
      return { kind: 'order', patch: { fire }, say: `Fire ${sides.map((s) => (s === 'L' ? 'port' : 'starboard')).join(' and ')} (aim ${aim})` };
    }
    case 'ld': case 'load': {
      let sides = null;
      let shot = null;
      for (const a of args) {
        if (!sides && SIDE[a]) sides = SIDE[a];
        else if (SHOT[a]) shot = SHOT[a];
        else return err(`load: don't understand "${a}"`);
      }
      if (!shot) return err('load with what? round, double, chain or grape');
      if (!sides) sides = ['L', 'R'];
      const load = {};
      for (const s of sides) load[s] = shot;
      return { kind: 'order', patch: { load }, say: `Load ${sides.map((s) => (s === 'L' ? 'port' : 'starboard')).join(' and ')} with ${shot}` };
    }
    case 'L': return { kind: 'order', patch: { unload: true }, say: 'Unload both broadsides' };
    case 'c': case 'sails': {
      const a = args[0];
      const want = a === 'full' || a === 'f' ? 'full' : a === 'battle' || a === 'b' ? 'battle' : (me.FS ? 'battle' : 'full');
      return { kind: 'order', patch: { sails: want }, say: want === 'full' ? 'Set full sails' : 'Reduce to battle sails' };
    }
    case 'rp': case 'repair': {
      const k = REPAIR[args[0]];
      if (!k) return err('repair what? hull, guns or rigging');
      return { kind: 'order', patch: { repair: k }, say: `Repair ${k}` };
    }
    case 'g': case 'grapple': {
      const sp = findShip(st, args[0], me);
      if (!sp) return err('grapple which ship?');
      const action = args[1] === 'u' ? 'u' : 'g';
      return { kind: 'order', patch: { grapple: [{ target: sp.index, action }] }, say: `${action === 'u' ? 'Ungrapple' : 'Grapple'} ${sp.name}` };
    }
    case 'u': case 'unfoul': {
      const sp = findShip(st, args[0], me);
      if (!sp) return err('unfoul which ship?');
      return { kind: 'order', patch: { unfoul: [sp.index] }, say: `Try to unfoul ${sp.name}` };
    }
    case 'b': case 'board': {
      if (args[0] === 'repel' || args[0] === 'r') {
        const n = Math.max(0, Math.min(3, +args[1] || 0));
        return { kind: 'order', patch: { repel: n }, say: `${n} section(s) to repel boarders` };
      }
      const sp = findShip(st, args[0], me);
      if (!sp) return err('board which ship?');
      const n = Math.max(1, Math.min(3, +args[1] || 1));
      return { kind: 'order', patch: { board: [{ target: sp.index, sections: n }] }, say: `${n} section(s) to board ${sp.name}` };
    }
    case 'B': return { kind: 'order', patch: { recall: true }, say: "Hands to stations! (recall boarders)" };
    case 'i': case 'I': case 'F': case 'identify':
      return { kind: 'query', what: cmd0 === 'I' ? 'all' : 'ship', ship: args[0] ? findShip(st, args[0], me)?.index ?? -1 : null };
    case 'v': case 'version': return { kind: 'query', what: 'version' };
    case '?': case 'help': return { kind: 'query', what: 'help' };
    case 'Q': case 'quit': return { kind: 'quit' };
    default:
      return err(`Unknown command "${cmd0}". Type ? for help.`);
  }
}

// Merge an order patch into the current turn's orders (arrays accumulate,
// objects merge per side, scalars replace — "only the last command counts").
export function mergeOrders(orders, patch) {
  const o = { ...orders };
  for (const [k, v] of Object.entries(patch)) {
    if (Array.isArray(v)) o[k] = [...(o[k] || []).filter((x) => !v.some((y) => y.target === (x.target ?? x))), ...v];
    else if (v && typeof v === 'object') o[k] = { ...(o[k] || {}), ...v };
    else o[k] = v;
  }
  return o;
}

// Art-directed scenarios (ADR 003). Ids are the ORIGINAL menu numbers.
// `mood` picks the time of day and weather palette (render/atmosphere.js).
// FEATURED get large cards in the menu; STAGED are the rest of the
// historical actions, also playable.
export const FEATURED = [
  { id: 13, mood: 'golden', tag: 'Frigate duel', year: 1813, blurb: 'Off Boston light, Broke\'s drilled Shannon waits for the green-crewed Chesapeake. A classic single-ship action in a fresh breeze.' },
  { id: 10, mood: 'gale', tag: 'Frigate duel in a gale', year: 1812, blurb: 'Old Ironsides against the Guerriere, far out in the Atlantic south-east of Halifax. A gale is blowing: heavy seas favour the flush-decked frigate.' },
  { id: 21, mood: 'tropic', tag: 'Frigate vs. ship of the line', year: 1808, blurb: 'Forester\'s Lydia, 36, meets the Spanish 50-gun Natividad in the Pacific. Speed and nerve against weight of metal.' },
  { id: 17, mood: 'dusk', tag: 'High seas', year: 1797, blurb: 'Two frigates harry a French 74 on a lee shore in rising seas — the storm keeps her lower ports shut. The man page\'s own example.' },
  { id: 18, mood: 'haze', tag: 'Line battle', year: 1801, blurb: 'Saumarez\'s squadron against Spanish and French ships of the line in the Gut of Gibraltar. Ten ships, three nations, 112-gun three-deckers.' },
];

export const STAGED = [
  { id: 0, mood: 'overcast', tag: 'Sloop duel', year: 1778, blurb: 'John Paul Jones takes the Ranger to the mouth of Belfast Lough and draws HMS Drake out to fight.' },
  { id: 1, mood: 'night', tag: 'Night action', year: 1779, blurb: 'Bonhomme Richard against Serapis off Flamborough Head, fought on into the night by the light of the moon.' },
  { id: 2, mood: 'gale', tag: 'Line battle in a gale', year: 1781, blurb: 'Arbuthnot and Des Touches off the Chesapeake capes: two lines of battle in foul weather.' },
  { id: 3, mood: 'tropic', tag: 'Line battle', year: 1782, blurb: 'Suffren against Hughes: ten ships of the line in the Indian Ocean, one of their five hard-fought battles.' },
  { id: 4, mood: 'haze', tag: 'Frigate duel', year: 1793, blurb: 'Pellew\'s Nymphe closes the Cleopatre off Start Point in the first frigate action of the war with revolutionary France.' },
  { id: 5, mood: 'dusk', tag: 'Duel of 74s', year: 1798, blurb: 'Mars and Hercule fight side by side at anchor in the fading light off the Breton coast.' },
  { id: 6, mood: 'overcast', tag: 'Frigate vs. corvette', year: 1798, blurb: 'Off the Gironde in December, the little Baionnaise dares to lay the Ambuscade aboard.' },
  { id: 7, mood: 'tropic', tag: 'Quasi-War', year: 1799, blurb: 'Truxtun\'s Constellation against the Insurgente off Nevis, in a fresh Caribbean blow.' },
  { id: 8, mood: 'night', tag: 'Night action', year: 1800, blurb: 'Constellation and Vengeance trade broadsides through a Caribbean night off Guadeloupe.' },
  { id: 9, mood: 'haze', tag: 'Frigate squadrons', year: 1811, blurb: 'Hoste\'s four ships against six French and Venetian frigates off Lissa in the Adriatic: "Remember Nelson!"' },
  { id: 11, mood: 'haze', tag: 'Frigate duel', year: 1812, blurb: 'Decatur\'s United States out-shoots the Macedonian at long range in the open Atlantic.' },
  { id: 12, mood: 'tropic', tag: 'Frigate duel', year: 1812, blurb: 'Old Ironsides meets HMS Java off the coast of Brazil.' },
  { id: 14, mood: 'lake', tag: 'Lake squadrons', year: 1813, blurb: 'Perry\'s brigs against the British squadron on Lake Erie, in light airs: "We have met the enemy and they are ours."' },
  { id: 15, mood: 'overcast', tag: 'Sloop duel', year: 1814, blurb: 'Blakeley\'s Wasp against the Reindeer in the western approaches to the Channel.' },
  { id: 16, mood: 'night', tag: 'One against two', year: 1815, blurb: 'Constitution against Cyane and Levant off Madeira, fought on by moonlight.' },
  { id: 19, mood: 'lake', tag: 'Lake squadrons', year: 1814, blurb: 'Macdonough\'s little squadron against the Confiance in Plattsburgh Bay on Lake Champlain.' },
  { id: 20, mood: 'overcast', tag: 'The chase', year: 1815, blurb: 'Decatur\'s President runs for the open sea in winter weather with a British squadron in pursuit.' },
];

export const PLAYABLE = [...FEATURED, ...STAGED];
