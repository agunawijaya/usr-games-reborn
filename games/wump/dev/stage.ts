import { createRng } from '@usr-games/kit';
import { isMagic, tunnelsFrom } from '../src/engine/cave';
import { type Expedition, move, sense, startExpedition } from '../src/engine/expedition';
import { deduce, isProvenSafe, type Notes, notesFor, observe } from '../src/engine/knowledge';
import { randomFrom } from '../src/engine/random';
import type { CaveRecipe, RuleSet } from '../src/engine/rules';
import { eventLine, senseLine } from '../src/play/views';
import type { NotebookMark } from '../src/render/map';
import type { SenseLine } from '../src/ui/play-screen';

/**
 * Staging for documentation scenes: plays a real expedition forward with a guide who knows where
 * everything is, so a scene can open mid-expedition without anyone falling in a pit on the way.
 * Everything drawn afterwards comes from the game's own engine, notes and renderer.
 */

export interface Staged {
  expedition: Expedition;
  notes: Notes;
  log: SenseLine[];
  marks: Map<number, Set<NotebookMark>>;
}

export interface StageWish {
  recipe: CaveRecipe;
  rules: RuleSet;
  /** How many rooms to have stood in. */
  rooms: number;
  /** What the last room must sense. */
  want: (expedition: Expedition) => boolean;
  firstSeed?: number;
}

function hazardous(expedition: Expedition, room: number): boolean {
  return expedition.pits[room]! || expedition.bats[room]! || room === expedition.wumpus;
}

function note(expedition: Expedition, log: SenseLine[]): void {
  log.push(senseLine(expedition.player, sense(expedition), expedition.rules));
}

/** Tries seeds in order until a guided walk ends somewhere that matches the wish. */
export function stageExpedition(wish: StageWish): Staged {
  for (let seed = wish.firstSeed ?? 0; seed < (wish.firstSeed ?? 0) + 4000; seed++) {
    const staged = tryWalk(wish, seed);
    if (staged) return staged;
  }
  throw new Error('No cave matched the staging wish');
}

function tryWalk(wish: StageWish, seed: number): Staged | null {
  const expedition = startExpedition(
    wish.recipe,
    wish.rules,
    randomFrom(createRng(`stage-${seed}`)),
  );
  const notes = notesFor(expedition, { bats: wish.recipe.bats, pits: wish.recipe.pits });
  const log: SenseLine[] = [];
  const pick = createRng(`walk-${seed}`);
  note(expedition, log);
  for (let step = 0; step < 30; step++) {
    if (expedition.visited.length >= wish.rooms && wish.want(expedition)) {
      return { expedition, notes, log, marks: notebookFor(notes) };
    }
    const options = tunnelsFrom(expedition.cave, expedition.player).filter(
      (to) =>
        !isMagic(expedition.cave, to) && !hazardous(expedition, to) && to !== expedition.player,
    );
    const fresh = options.filter((to) => !expedition.visited.includes(to));
    const choices = fresh.length > 0 ? fresh : options;
    if (choices.length === 0) return null;
    const events = move(expedition, pick.pick(choices));
    for (const event of events) {
      const line = eventLine(event, expedition.player);
      if (line) log.push(line);
    }
    if (expedition.ending) return null;
    observe(notes, expedition, events);
    note(expedition, log);
  }
  return null;
}

/** The marks a careful player would have pencilled in by now. */
export function notebookFor(notes: Notes): Map<number, Set<NotebookMark>> {
  const marks = new Map<number, Set<NotebookMark>>();
  const add = (room: number, mark: NotebookMark) => {
    const set = marks.get(room) ?? new Set<NotebookMark>();
    set.add(mark);
    marks.set(room, set);
  };
  for (const [room, belief] of deduce(notes)) {
    if (notes.sensed.has(room)) continue;
    if (isProvenSafe(belief)) add(room, 'safe');
    if (belief.pit !== 'no') add(room, 'pit');
    if (belief.bats !== 'no') add(room, 'bats');
    if (belief.wumpus !== 'no') add(room, 'wumpus');
  }
  return marks;
}
