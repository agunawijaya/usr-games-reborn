import { isMagic, tunnelsFrom } from '../engine/cave';
import {
  type DartFlight,
  type Expedition,
  sense,
  type Senses,
  type TurnEvent,
} from '../engine/expedition';
import type { Notes } from '../engine/knowledge';
import { placeMouths } from '../render/chamber-shape';
import type { ChamberScene, MouthView } from '../render/chamber';
import type { Point } from '../render/hand';
import type { MapScene, NotebookMark } from '../render/map';
import type { SenseLine } from '../ui/play-screen';

/**
 * Turns the engine's state into what the screen draws: the chamber with its mouths placed in the
 * direction of their rooms on the map, the map scene, and the plain-words lines of the field notes.
 */

export type Marks = ReadonlyMap<number, ReadonlySet<NotebookMark>>;

export function chamberFor(
  expedition: Expedition,
  layout: readonly Point[],
  marks: Marks,
  time: number,
  room = expedition.player,
): ChamberScene {
  const { cave } = expedition;
  const here = layout[room]!;
  const tunnels = tunnelsFrom(cave, room);
  const directions = tunnels.map((to, i) => {
    if (isMagic(cave, to) || to === room) {
      return { to, angle: -Math.PI / 2 + (i - tunnels.length / 2) * 0.7 };
    }
    const there = layout[to]!;
    return { to, angle: Math.atan2(there.y - here.y, there.x - here.x) };
  });
  const keyOf = new Map(tunnels.map((to, i) => [to, i + 1]));
  const mouths: MouthView[] = placeMouths(directions).map((plan) => ({
    ...plan,
    magic: isMagic(cave, plan.to),
    marks: marks.get(plan.to) ?? new Set(),
    key: keyOf.get(plan.to) ?? 0,
    visited: expedition.visited.includes(plan.to),
  }));
  return {
    room,
    mouths,
    senses: sense(expedition, room),
    strongSmell: expedition.rules === 'standard',
    explorer: 'here',
    lantern: 1,
    time,
  };
}

export function mapFor(
  expedition: Expedition,
  notes: Notes,
  layout: readonly Point[],
  marks: Marks,
  time: number,
): MapScene {
  return {
    cave: expedition.cave,
    layout,
    here: expedition.player,
    visited: expedition.visited,
    sensed: notes.sensed,
    marks,
    rules: expedition.rules,
    time,
  };
}

/** One line of field notes for what was felt on arriving in a room, in our own words. */
export function senseLine(room: number, senses: Senses, rules: Expedition['rules']): SenseLine {
  const parts: string[] = [];
  let tone: SenseLine['tone'] = 'calm';
  if (senses.wumpus > 0) {
    tone = 'whiff';
    if (rules === 'classic') parts.push('a whiff of wumpus somewhere near');
    else
      parts.push(
        senses.wumpus === 1
          ? 'a strong whiff: wumpus next door'
          : 'a faint whiff: wumpus two rooms off',
      );
  }
  if (senses.pit) {
    if (tone === 'calm') tone = 'draft';
    parts.push('a cold draft from a pit');
  }
  if (senses.bats) {
    if (tone === 'calm') tone = 'bats';
    parts.push('wings fluttering');
  }
  if (parts.length === 0) return { room, text: 'Still air. Nothing nearby.', tone };
  const sentence = parts.join(', ');
  return { room, text: sentence[0]!.toUpperCase() + sentence.slice(1) + '.', tone };
}

/** Field-note lines for turn events that are not simply arriving somewhere quiet. */
export function eventLine(event: TurnEvent, here: number): SenseLine | null {
  switch (event.kind) {
    case 'carried':
      return {
        room: event.to,
        text: `Bats swept you up in ${event.from} and dropped you here.`,
        tone: 'event',
      };
    case 'ledge':
      return {
        room: event.room,
        text: 'A pit! You caught the ledge and climbed back.',
        tone: 'event',
      };
    case 'shimmered':
      return {
        room: event.to,
        text: 'The tunnel shimmered and set you down somewhere new.',
        tone: 'event',
      };
    case 'bumped':
      return {
        room: event.from,
        text: `No tunnel to ${event.toward} from here. Bonk.`,
        tone: 'event',
      };
    case 'stirred':
      // A wumpus woken by a miss moves in silence, as in the original; a bump is heard.
      return event.why === 'bump'
        ? {
            room: here,
            text: 'The bump echoed. Somewhere, the wumpus grumbled and shuffled.',
            tone: 'event',
          }
        : null;
    default:
      return null;
  }
}

/** A field-notes line for where a dart went, told plainly. */
export function flightLine(flight: DartFlight, here: number): SenseLine {
  const last = flight.hops[flight.hops.length - 1];
  const landed = flight.landed;
  const shimmered = flight.hops.some((hop) => hop.kind === 'magic');
  let text: string;
  switch (flight.stop) {
    case 'deflected':
      text = `No tunnel from ${last?.from ?? here} to ${last?.asked ?? '?'}: the dart veered into ${landed}.`;
      break;
    case 'string-broke':
      text = `The string snapped after the third room; the dart dropped in ${landed}.`;
      break;
    case 'wavered':
      text = `The dart wavered after the fourth room and dropped in ${landed}.`;
      break;
    default:
      text = `The dart flew ${flight.hops.map((hop) => hop.to).join(' → ')} and came down in ${landed}.`;
  }
  if (shimmered) text += ' It shimmered through a magic tunnel on the way.';
  return { room: here, text, tone: 'event' };
}
