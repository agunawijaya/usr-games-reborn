import { worldName } from '../data/worlds';
import type { Beat, Refusal } from '../engine/beats';
import type { LossReason, Point, RankId, SystemId } from '../engine/types';

/**
 * Every word the player reads during a watch. The engine speaks in beats; this file turns
 * them into the log, the refusals and the end-of-watch lines.
 */

export function zoneLabel(at: Point): string {
  return `${'ABCDEFGH'[at.col] ?? '?'}${at.row + 1}`;
}

export function days(value: number): string {
  if (value < 0.1) return `${Math.max(0, value).toFixed(2)} days`;
  if (Math.abs(value - 1) < 0.05) return '1 day';
  return `${value.toFixed(1)} days`;
}

export function power(value: number): string {
  return Math.round(value).toLocaleString('en');
}

export const SYSTEM_NAMES: Record<SystemId, string> = {
  drive: 'Drive',
  'near-sensors': 'Near sensors',
  'far-sensors': 'Far sensors',
  beams: 'Beams',
  'flare-tubes': 'Flare tubes',
  thrusters: 'Thrusters',
  shield: 'Shield',
  computer: 'Computer',
  radio: 'Radio',
  'life-support': 'Life support',
  navigation: 'Navigation',
  shroud: 'Shroud',
  ferry: 'Ferry',
  launch: 'Launch',
};

/** What a system being down means, in one line. */
export const SYSTEM_DOWN: Record<SystemId, string> = {
  drive: 'No jumps between zones; thrusters only.',
  'near-sensors': 'The zone goes dark; sweep it with the lantern. Automatic beams are off.',
  'far-sensors': 'Neighbouring zones go uncharted.',
  beams: 'No beams.',
  'flare-tubes': 'No flares away from a harbour.',
  thrusters: 'No thruster moves.',
  shield: 'The shield cannot be raised.',
  computer: 'No previews and no automatic beams; the helm will not stop short of obstacles.',
  radio: 'Calls go unheard; no hails, no beacon.',
  'life-support': 'Air runs down every day away from a harbour.',
  navigation: 'Courses wander off their bearing.',
  shroud: 'No shroud.',
  ferry: 'The crew cannot be ferried down to a world if the Lantern is abandoned.',
  launch: 'No launch to leave the Lantern in.',
};

const REFUSALS: Record<Refusal, string> = {
  moored: 'Not while moored. Leave the harbour first.',
  'not-moored': 'The Lantern is not moored.',
  'system-down': 'That system is down.',
  'shield-up': 'Beams cannot fire through your own shield. Lower it first (G).',
  shrouded: 'Not while shrouded.',
  'no-gleaners': 'There are no gleaners in this zone.',
  'no-power': 'Not enough power for that.',
  'no-flares': 'No flares left. A harbour has more.',
  'no-harbour-near': 'Move beside a harbour to moor.',
  'no-harbours-left': 'No harbour is left to answer.',
  'not-unlocked': 'That comes with a later rank.',
  'ember-has-no-shroud': 'The Ember has no shroud.',
  'already-aboard-ember': 'The Ember is the last ship there is.',
  'bad-order': 'That order cannot be carried out.',
};

export function refusalText(beat: Extract<Beat, { type: 'refused' }>): string {
  if (beat.reason === 'system-down' && beat.system) {
    return `${SYSTEM_NAMES[beat.system]} is down. ${SYSTEM_DOWN[beat.system]}`;
  }
  return REFUSALS[beat.reason];
}

export const LOSS_LINES: Record<LossReason, { title: string; line: string }> = {
  'reserve-ran-dry': {
    title: 'The reserve ran dry',
    line: 'The swarm outlasted the watch. A relief fleet is on its way, and the crew is safe.',
  },
  'power-ran-out': {
    title: 'Out of power',
    line: 'The Lantern went dark between the stars. A tug brought her home.',
  },
  'lantern-disabled': {
    title: 'The Lantern was disabled',
    line: 'Gleaner fire drained her last power. The crew took the boats home, every one of them.',
  },
  rim: {
    title: 'Over the Rim',
    line: 'With the computer down, nothing stopped the Lantern at the edge. She drifted home weeks later.',
  },
  'own-flare-up': {
    title: 'Caught in the flare-up',
    line: 'The star the Lantern set off took the last of her power. The crew got clear in the boats.',
  },
  collapse: {
    title: 'A dying star',
    line: 'The star took the zone with it. The crew escaped in the boats; the Lantern did not.',
  },
  air: {
    title: 'Life support failed',
    line: 'The air ran out before the repairs were done. The crew sealed themselves in the boats and were picked up.',
  },
  'beacon-failed': {
    title: 'No lock',
    line: 'The harbour tried three times and could not bring the Lantern in. A tug found her, adrift.',
  },
  redline: {
    title: 'Torn apart at the redline',
    line: 'Past factor 9 the Lantern came apart. The boats were thrown clear.',
  },
  'into-a-star': {
    title: 'Into a star',
    line: 'The Lantern flew into a star. The boats made it out, just.',
  },
  'no-harbour-left': {
    title: 'No harbour left',
    line: 'With no harbour left to take the crew in, the watch is over.',
  },
  'no-crew': {
    title: 'Too few hands',
    line: 'With so many in the sickbay there was nobody left to run the ship.',
  },
};

/** The orders each rank brings, read before its first watch. */
export const STANDING_ORDERS: Record<RankId, { intro: string; added: string[] }> = {
  1: {
    intro:
      'Your first watch. Gleaners have settled in a few zones; stop them before the reserve runs dry.',
    added: [
      'Worlds call for help when gleaners attack them. Answer before the deadline, or the light goes out.',
    ],
  },
  2: {
    intro: 'More of the Reach is yours to keep.',
    added: [
      'Gleaners can besiege a harbour, and take it if nobody comes.',
      'Hail a worn-down gleaner: if it takes the shutdown code, its ore is yours to bring home.',
    ],
  },
  3: {
    intro: 'The swarm is cannier now.',
    added: [
      'A hit can knock the radio out. Calls still happen; you hear about them when it is fixed.',
      'Long-range snares can drag the Lantern across the Reach.',
    ],
  },
  4: {
    intro: 'Old stars, old dangers.',
    added: [
      'Stars can die and take their whole zone with them.',
      'The flare tubes can fire a spread of three (hold Shift).',
    ],
  },
  5: {
    intro: 'The Admiralty trusts you with its best ship.',
    added: [
      'The reactor no longer recharges in flight. Only a harbour fills it.',
      'The Lantern carries a shroud: unseen, unhit, and unable to fire.',
    ],
  },
  6: {
    intro: 'The last rank. The original called this level impossible.',
    added: [
      'One harbour in the whole Reach.',
      'The drive goes to 10. Past 9 lies the redline, where time itself slips.',
    ],
  },
};

export type Tone = 'good' | 'bad' | 'radio' | 'info' | 'warn';

export interface LogLine {
  text: string;
  tone: Tone;
}

/** The log for one order; shots and beam hits are folded into a line each. */
export function logLines(beats: readonly Beat[]): LogLine[] {
  const lines: LogLine[] = [];
  const say = (text: string, tone: Tone = 'info') => lines.push({ text, tone });
  let volley: { hits: number; total: number; absorbed: number } | null = null;
  let beams: { hits: number; total: number; stopped: number } | null = null;
  const flushVolley = () => {
    if (!volley) return;
    const through = volley.total - volley.absorbed;
    say(
      volley.absorbed > 0
        ? `Gleaner fire: ${volley.hits} ${volley.hits === 1 ? 'shot' : 'shots'}, ${power(volley.total)} in all; the shield took ${power(volley.absorbed)}.`
        : `Gleaner fire: ${volley.hits} ${volley.hits === 1 ? 'shot' : 'shots'}, ${power(through)} straight into the Lantern's power.`,
      'bad',
    );
    volley = null;
  };
  const flushBeams = () => {
    if (!beams) return;
    const hits = `Beams: ${beams.hits} ${beams.hits === 1 ? 'hit' : 'hits'} for ${power(beams.total)}`;
    if (beams.stopped === 0) say(`${hits}.`);
    else
      say(
        `${hits}, and ${beams.stopped === 1 ? 'a gleaner' : `${beams.stopped} gleaners`} went dark.`,
        'good',
      );
    beams = null;
  };
  for (const beat of beats) {
    if (beat.type !== 'shot') flushVolley();
    const partOfVolley =
      beat.type === 'beam' ||
      (beat.type === 'gleaner-stopped' && beat.by === 'beams') ||
      beat.type === 'clock';
    if (!partOfVolley) flushBeams();
    switch (beat.type) {
      case 'shot':
        volley ??= { hits: 0, total: 0, absorbed: 0 };
        volley.hits++;
        volley.total += beat.hit;
        volley.absorbed += beat.absorbed;
        break;
      case 'beam':
        beams ??= { hits: 0, total: 0, stopped: 0 };
        beams.hits++;
        beams.total += beat.hit;
        break;
      case 'refused':
        say(refusalText(beat), 'warn');
        break;
      case 'drive-set':
        say(`Drive set to factor ${beat.factor}.`);
        break;
      case 'shield':
        say(beat.up ? `Shield raised (${beat.energy} power).` : 'Shield lowered.');
        break;
      case 'shroud':
        say(beat.on ? 'Shroud on. The gleaners will lose sight of the Lantern.' : 'Shroud off.');
        break;
      case 'gleaner-left':
        say(`A gleaner slipped away to ${zoneLabel(beat.toZone)}.`);
        break;
      case 'gleaner-arrived':
        say('A new gleaner rolled off the forge, right here.', 'bad');
        break;
      case 'critical':
        say(
          `Critical hit: ${SYSTEM_NAMES[beat.system].toLowerCase()} damaged, ${days(beat.days)} to repair.`,
          'bad',
        );
        break;
      case 'shield-knocked-down':
        say('The shield was knocked down.', 'bad');
        break;
      case 'injured':
        say(`${beat.count} crew hurt; the sickbay has them.`, 'bad');
        break;
      case 'harbour-shelters':
        say('The harbour’s shield takes the gleaners’ fire.');
        break;
      case 'beams-wasted':
        if (beat.energy >= 20) say(`${power(beat.energy)} power spent on empty space.`);
        break;
      case 'flare':
        say(
          flareLine(beat),
          beat.end === 'gleaner'
            ? 'info'
            : beat.end === 'world' || beat.end === 'harbour'
              ? 'bad'
              : 'info',
        );
        break;
      case 'gleaner-hit':
        say(`The flare hit: a gleaner lost ${power(beat.damage)} charge but is still running.`);
        break;
      case 'gleaner-stopped':
        if (beat.by === 'beams' && beams) beams.stopped++;
        else say(stoppedLine(beat.by), 'good');
        break;
      case 'nova':
        say(
          beat.leftHole ? 'The star flared up and fell into a black hole!' : 'The star flared up!',
          'warn',
        );
        break;
      case 'nova-fizzled':
        say('The star shrugged the flare off.');
        break;
      case 'nova-scorch':
        say(`The flare-up scorched the Lantern: ${power(beat.damage)} power.`, 'bad');
        break;
      case 'collapse':
        if (beat.here) say('A star is dying in this zone!', 'bad');
        else if (beat.heard)
          say(`A star died in ${zoneLabel(beat.zone)}; the zone is gone.`, 'radio');
        break;
      case 'world-destroyed':
        say(
          beat.byUs
            ? `${worldName(beat.world)} was lost in the flare-up. Its light will not come back.`
            : `${worldName(beat.world)} was lost with its star.`,
          'bad',
        );
        break;
      case 'harbour-lost':
        if (beat.heard) say(`The harbour at ${zoneLabel(beat.zone)} is gone.`, 'bad');
        break;
      case 'damaged':
        break;
      case 'repaired':
        say(`${SYSTEM_NAMES[beat.system]} repaired.`, 'good');
        break;
      case 'navigation-needs-harbour':
        say(
          'Navigation works again, but it needs a harbour to calibrate. Courses will wander.',
          'warn',
        );
        break;
      case 'travel':
        say(travelLine(beat));
        break;
      case 'drive-strained':
        say(`The drive strained and cut out early: ${days(beat.days)} of repairs.`, 'bad');
        break;
      case 'stopped-short':
        say('The computer stopped the Lantern short of an obstacle.', 'warn');
        break;
      case 'rammed':
        say(
          beat.what === 'gleaner'
            ? 'The Lantern rammed a gleaner!'
            : beat.what === 'harbour'
              ? 'The Lantern rammed the harbour!'
              : 'The Lantern is flying into a star!',
          'bad',
        );
        break;
      case 'snared':
        say(`A long-range snare! The Lantern was dragged to ${zoneLabel(beat.to)}.`, 'bad');
        break;
      case 'black-hole':
        say(`Into a black hole… and out again at ${zoneLabel(beat.to)}.`, 'warn');
        break;
      case 'rim':
        say(
          `The computer pulled back from the Rim; the Lantern came out at ${zoneLabel(beat.to)}.`,
          'warn',
        );
        break;
      case 'redline':
        say(redlineLine(beat), beat.event === 'calm' ? 'info' : 'warn');
        break;
      case 'call':
        if (beat.heard)
          say(
            `Gleaners are attacking ${worldName(beat.world)} (${zoneLabel(beat.zone)})!`,
            'radio',
          );
        break;
      case 'siege':
        if (beat.heard) say(`The harbour at ${zoneLabel(beat.zone)} is besieged!`, 'radio');
        break;
      case 'world-fell':
        if (beat.heard)
          say(`${worldName(beat.world)} has gone dark. Its forge is building gleaners now.`, 'bad');
        break;
      case 'swarm-grew':
        if (!beat.here) say(`The swarm grew at ${zoneLabel(beat.zone)}.`, 'bad');
        break;
      case 'world-relit':
        say(
          beat.wasDark
            ? `${worldName(beat.world)} is lit again!`
            : `${worldName(beat.world)} is safe.`,
          'good',
        );
        break;
      case 'siege-lifted':
        say(`The siege of ${zoneLabel(beat.zone)} is lifted.`, 'good');
        break;
      case 'moored':
        say(
          beat.salvage > 0
            ? `Moored. Power, flares and shield are full, and ${beat.salvage} ore delivered.`
            : 'Moored. Power, flares and shield are full.',
          'good',
        );
        break;
      case 'unmoored':
        say('Left the harbour.');
        break;
      case 'hail':
        say(
          beat.accepted
            ? `The gleaner took the shutdown code (${beat.chance}% chance). ${beat.salvage} ore salvaged.`
            : `The gleaner ignored the shutdown code (${beat.chance}% chance).`,
          beat.accepted ? 'good' : 'info',
        );
        break;
      case 'rest':
        say(
          beat.cut
            ? `Rested ${days(beat.days)}, until news cut it short.`
            : `Rested ${days(beat.days)}.`,
        );
        break;
      case 'raid':
        say('Gleaners attacked during the rest.', 'bad');
        break;
      case 'swept':
        say('The lantern swept the dark.');
        break;
      case 'beacon':
        say(
          beat.rescued
            ? `The harbour at ${zoneLabel(beat.harbour)} brought the Lantern in on try ${beat.tries.length}.`
            : 'The harbour could not lock on.',
          beat.rescued ? 'good' : 'bad',
        );
        break;
      case 'abandoned':
        say(
          beat.crewSafe
            ? `The crew went down to the world below; you took the launch to ${zoneLabel(beat.to)} and the old Ember.`
            : `The crew took the boats home; you took the launch to ${zoneLabel(beat.to)} and the old Ember.`,
          'warn',
        );
        break;
      case 'radio-backlog':
        say(
          `The radio is back: ${beat.count} ${beat.count === 1 ? 'message' : 'messages'} came in at once.`,
          'radio',
        );
        break;
      case 'won':
        say('The last gleaner is stopped. The Reach is safe.', 'good');
        break;
      case 'lost':
        say(LOSS_LINES[beat.reason].title, 'bad');
        break;
      default:
    }
  }
  flushVolley();
  flushBeams();
  return lines;
}

function flareLine(beat: Extract<Beat, { type: 'flare' }>): string {
  const misfire = beat.misfire ? 'The tube misfired. ' : '';
  switch (beat.end) {
    case 'gleaner':
      return `${misfire}Flare away, straight into a gleaner.`;
    case 'star':
      return `${misfire}The flare struck a star.`;
    case 'hole':
      return `${misfire}The flare fell into a black hole.`;
    case 'world':
      return `${misfire}The flare struck a world!`;
    case 'harbour':
      return `${misfire}The flare struck the harbour!`;
    default:
      return `${misfire}The flare missed and burnt out at the zone's edge.`;
  }
}

function stoppedLine(by: Extract<Beat, { type: 'gleaner-stopped' }>['by']): string {
  switch (by) {
    case 'beams':
      return 'A gleaner went dark under the beams.';
    case 'flare':
      return 'The flare stopped a gleaner.';
    case 'nova':
      return 'The flare-up stopped a gleaner.';
    case 'ram':
      return 'The ram stopped a gleaner.';
    default:
      return 'A gleaner powered down.';
  }
}

function travelLine(beat: Extract<Beat, { type: 'travel' }>): string {
  const sameZone =
    beat.from.zone.row === beat.to.zone.row && beat.from.zone.col === beat.to.zone.col;
  const cost = `${days(beat.days)}, ${power(beat.energy)} power`;
  if (beat.engine === 'override')
    return `Emergency override! The computer hurled the Lantern to ${zoneLabel(beat.to.zone)}.`;
  if (sameZone) return `Moved across the zone (${cost}).`;
  return `Jumped to ${zoneLabel(beat.to.zone)} (${cost}).`;
}

function redlineLine(beat: Extract<Beat, { type: 'redline' }>): string {
  switch (beat.event) {
    case 'calm':
      return 'Past the redline… and the ship held steady.';
    case 'forward':
      return `A time portal! ${days(beat.days)} slipped by in a blink.`;
    case 'back':
      return `A time portal, backwards! The Reach rewinds ${days(beat.days)}; the Lantern keeps everything she did.`;
    case 'shaken':
      return 'The redline shook every system aboard.';
    default:
      return 'The Lantern is coming apart!';
  }
}
