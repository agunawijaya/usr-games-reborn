import type { Expedition, Senses, TurnEvent } from './expedition';
import { sense } from './expedition';
import type { RuleSet } from './rules';

/**
 * What the explorer can know, and what follows from it. Only rooms stood in tell anything: the
 * tunnels leading out of them and what was felt there. Nothing here looks at where the hazards
 * really are; the Scout assist, the Scout bot and the notebook all reason from these notes alone.
 */

export type Verdict = 'no' | 'maybe' | 'yes';

export interface RoomBelief {
  pit: Verdict;
  bats: Verdict;
  wumpus: Verdict;
}

export interface Odds {
  pit: number;
  bats: number;
  wumpus: number;
}

export interface Notes {
  rules: RuleSet;
  size: number;
  /** The counts the expedition announced at the start. */
  announced: { bats: number; pits: number };
  /** The tunnels out of every room stood in. */
  tunnels: Map<number, readonly number[]>;
  /** What was felt in each room, the last time the explorer stood there. */
  sensed: Map<number, Senses>;
  /** When each smell was taken; a smell from before the wumpus may have moved no longer holds. */
  smellEpoch: Map<number, number>;
  /** Rooms stood in since the wumpus last may have moved. */
  stoodSince: Set<number>;
  /** Grows each time the wumpus may have moved: after a miss, or a bump that woke it. */
  epoch: number;
  /** Rooms with a pit for certain: the explorer fell in and caught the ledge. */
  ledges: Set<number>;
  /** Rooms with bats for certain: they carried the explorer off from there. */
  roosts: Set<number>;
}

export function notesFor(expedition: Expedition, announced: { bats: number; pits: number }): Notes {
  const notes: Notes = {
    rules: expedition.rules,
    size: expedition.cave.size,
    announced,
    tunnels: new Map(),
    sensed: new Map(),
    smellEpoch: new Map(),
    stoodSince: new Set(),
    epoch: 0,
    ledges: new Set(),
    roosts: new Set(),
  };
  standIn(notes, expedition);
  return notes;
}

/** Writes down the room the explorer now stands in: its tunnels and what is felt there. */
function standIn(notes: Notes, expedition: Expedition): void {
  const room = expedition.player;
  notes.tunnels.set(room, expedition.cave.tunnels[room] ?? []);
  notes.sensed.set(room, sense(expedition));
  notes.smellEpoch.set(room, notes.epoch);
  notes.stoodSince.add(room);
}

/** Updates the notes after a turn, from what the explorer could see happen. */
export function observe(notes: Notes, expedition: Expedition, events: readonly TurnEvent[]): void {
  for (const event of events) {
    if (event.kind === 'carried') notes.roosts.add(event.from);
    if (event.kind === 'ledge') notes.ledges.add(event.room);
    // A miss may have woken the wumpus without a sound; a bump that woke it was heard.
    if (event.kind === 'dart' || (event.kind === 'stirred' && event.why === 'bump')) {
      notes.epoch += 1;
      notes.stoodSince.clear();
    }
  }
  if (!expedition.ending) standIn(notes, expedition);
}

function exitsOf(notes: Notes, room: number): readonly number[] {
  return (notes.tunnels.get(room) ?? []).filter((to) => to >= 1 && to <= notes.size);
}

/** Every room the explorer knows of: rooms stood in and the rooms their tunnels lead to. */
export function knownRooms(notes: Notes): Set<number> {
  const rooms = new Set<number>();
  for (const [room] of notes.tunnels) {
    rooms.add(room);
    for (const to of exitsOf(notes, room)) rooms.add(to);
  }
  return rooms;
}

function clearedOf(notes: Notes, hazard: 'pit' | 'bats'): Set<number> {
  const cleared = new Set<number>();
  const certain = hazard === 'pit' ? notes.ledges : notes.roosts;
  for (const [room, senses] of notes.sensed) {
    if (!certain.has(room)) cleared.add(room);
    const felt = hazard === 'pit' ? senses.pit : senses.bats;
    if (!felt) for (const next of exitsOf(notes, room)) cleared.add(next);
  }
  return cleared;
}

/**
 * The chance of a pit or of bats in each known room, given everything felt so far. Every room not
 * cleared could hold one, the announced number are spread among them, and each feeling needs at
 * least one of them through its tunnels. The odds are the share of layouts, among all that fit the
 * notes, that put a hazard in each room: found by wandering through those layouts one swap at a
 * time (a Markov chain whose every step keeps the notes true), which stays quick in a 250-room cave.
 */
function hazardOdds(notes: Notes, hazard: 'pit' | 'bats'): Map<number, number> {
  const cleared = clearedOf(notes, hazard);
  const certain = hazard === 'pit' ? notes.ledges : notes.roosts;
  const known = knownRooms(notes);
  const odds = new Map<number, number>();

  // Each feeling not yet explained by a certain hazard needs one of its open rooms.
  const needs: number[][] = [];
  for (const [room, senses] of notes.sensed) {
    const felt = hazard === 'pit' ? senses.pit : senses.bats;
    if (!felt) continue;
    const exits = exitsOf(notes, room);
    if (exits.some((next) => certain.has(next))) continue;
    needs.push(exits.filter((next) => !cleared.has(next)));
  }
  const open: number[] = [];
  for (let room = 1; room <= notes.size; room++) {
    if (!cleared.has(room) && !certain.has(room)) open.push(room);
  }
  const total = hazard === 'pit' ? notes.announced.pits : notes.announced.bats;
  const count = Math.min(open.length, Math.max(0, total - certain.size));
  const shares = layoutShares(open, count, needs, notes.size, seedOf(notes, hazard));

  for (const room of known) {
    if (certain.has(room)) odds.set(room, 1);
    else if (cleared.has(room)) odds.set(room, 0);
    // Sampling can miss a possible room; only a cleared room, or no hazard left to place, is safe.
    else odds.set(room, count === 0 ? 0 : Math.max(shares.get(room) ?? 0, 0.002));
  }
  return odds;
}

function seedOf(notes: Notes, hazard: string): number {
  let h = hazard === 'pit' ? 17 : 31;
  for (const room of notes.tunnels.keys()) h = Math.imul(h ^ room, 2654435761) >>> 0;
  return (h ^ (notes.epoch * 97) ^ notes.ledges.size ^ (notes.roosts.size << 8)) >>> 0;
}

/** A tiny seeded generator, so the same notes always give the same odds. */
function stream(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function layoutShares(
  open: readonly number[],
  count: number,
  needs: readonly number[][],
  size: number,
  seed: number,
): Map<number, number> {
  const shares = new Map<number, number>();
  if (count === 0 || open.length === 0) return shares;
  if (count >= open.length) {
    for (const room of open) shares.set(room, 1);
    return shares;
  }
  const random = stream(seed);
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
  const filled = new Uint8Array(size + 2);
  const placed: number[] = [];
  // A first layout that fits: one hazard for each unexplained feeling, the rest anywhere open.
  for (const need of needs) {
    if (need.some((room) => filled[room])) continue;
    if (placed.length >= count || need.length === 0) return fallbackShares(open, count, needs);
    const room = pick(need);
    filled[room] = 1;
    placed.push(room);
  }
  while (placed.length < count) {
    const room = pick(open);
    if (filled[room]) continue;
    filled[room] = 1;
    placed.push(room);
  }
  const needsOf = new Map<number, number[][]>();
  for (const need of needs)
    for (const room of need) needsOf.set(room, [...(needsOf.get(room) ?? []), need]);
  const stillMet = (from: number, to: number) =>
    (needsOf.get(from) ?? []).every((need) =>
      need.some((room) => room !== from && (filled[room] || room === to)),
    );

  const tally = new Float64Array(size + 2);
  const steps = 1600;
  const burn = 300;
  let samples = 0;
  for (let step = 0; step < steps; step++) {
    const index = Math.floor(random() * placed.length);
    const from = placed[index]!;
    const to = pick(open);
    if (!filled[to] && stillMet(from, to)) {
      filled[from] = 0;
      filled[to] = 1;
      placed[index] = to;
    }
    if (step >= burn && step % 2 === 0) {
      for (const room of placed) tally[room] = tally[room]! + 1;
      samples += 1;
    }
  }
  for (const room of open) shares.set(room, tally[room]! / samples);
  return shares;
}

/** When the notes cannot all be met (bats or the count were misjudged), share each feeling out evenly. */
function fallbackShares(
  open: readonly number[],
  count: number,
  needs: readonly number[][],
): Map<number, number> {
  const shares = new Map<number, number>();
  const escape = new Map<number, number>();
  for (const need of needs) {
    for (const room of need) escape.set(room, (escape.get(room) ?? 1) * (1 - 1 / need.length));
  }
  const background = Math.min(1, count / Math.max(1, open.length));
  for (const room of open) shares.set(room, escape.has(room) ? 1 - escape.get(room)! : background);
  return shares;
}

/**
 * The rooms the wumpus may be in, from the smells taken since it last may have moved. Under
 * Standard rules a smell tells one room or two; under Classic, only "near".
 */
export function wumpusCandidates(notes: Notes): Set<number> {
  const all = new Set<number>();
  for (let room = 1; room <= notes.size; room++) if (!notes.stoodSince.has(room)) all.add(room);
  let candidates = new Set(all);
  const near = (room: number): Set<number> => {
    // Rooms two tunnels away: through a room stood in we know where; through any other, anywhere.
    const reach = new Set<number>();
    for (const next of exitsOf(notes, room)) {
      if (!notes.tunnels.has(next)) return new Set(all);
      for (const beyond of exitsOf(notes, next)) reach.add(beyond);
    }
    return reach;
  };
  for (const [room, senses] of notes.sensed) {
    if (notes.smellEpoch.get(room) !== notes.epoch) continue;
    const exits = new Set(exitsOf(notes, room));
    if (senses.wumpus === 0) {
      for (const next of exits) {
        candidates.delete(next);
        if (notes.tunnels.has(next))
          for (const beyond of exitsOf(notes, next)) candidates.delete(beyond);
      }
    } else if (notes.rules === 'standard' && senses.wumpus === 1) {
      candidates = new Set([...candidates].filter((r) => exits.has(r)));
    } else if (notes.rules === 'standard') {
      const two = near(room);
      candidates = new Set([...candidates].filter((r) => !exits.has(r) && two.has(r)));
    } else {
      const two = near(room);
      candidates = new Set([...candidates].filter((r) => exits.has(r) || two.has(r)));
    }
  }
  // Notes that contradict each other mean the wumpus moved unheard; start again from scratch.
  return candidates.size > 0 ? candidates : all;
}

/** The odds of each hazard in every known room. */
export function odds(notes: Notes): Map<number, Odds> {
  const pits = hazardOdds(notes, 'pit');
  const bats = hazardOdds(notes, 'bats');
  const candidates = wumpusCandidates(notes);
  const result = new Map<number, Odds>();
  for (const room of knownRooms(notes)) {
    result.set(room, {
      pit: pits.get(room) ?? 0,
      bats: bats.get(room) ?? 0,
      wumpus: candidates.has(room) ? 1 / candidates.size : 0,
    });
  }
  return result;
}

function verdict(chance: number): Verdict {
  return chance <= 0 ? 'no' : chance >= 1 ? 'yes' : 'maybe';
}

/** The odds as a careful note-taker would write them: no, maybe or yes. */
export function deduce(notes: Notes): Map<number, RoomBelief> {
  const beliefs = new Map<number, RoomBelief>();
  for (const [room, o] of odds(notes)) {
    beliefs.set(room, { pit: verdict(o.pit), bats: verdict(o.bats), wumpus: verdict(o.wumpus) });
  }
  return beliefs;
}

/** A room every hazard has been cleared from: safe to walk into. */
export function isProvenSafe(belief: RoomBelief | Odds | undefined): boolean {
  if (!belief) return false;
  const clear = (v: Verdict | number) => v === 'no' || v === 0;
  return clear(belief.pit) && clear(belief.bats) && clear(belief.wumpus);
}
