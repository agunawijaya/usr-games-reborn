// atc/fancy-web — ATC radio chatter phraseology generator
//
// Emits (subtitle-text, tts-text) pairs for game events. The subtitle
// text may contain visual prefixes like [PILOT] or [YOU] for clarity;
// the tts text strips those and uses aviation-standard phonetic
// spellings ("niner" for 9, digit-by-digit for headings).
//
// Two speakers:
//   PILOT — the aircraft crew (calls in on spawn, reads back, mayday)
//   YOU   — the controller (that is you, the player)
//
// Phraseology approximates real ATC / ICAO conventions for authenticity
// without pretending to be exhaustive. This is game-flavor, not a
// training tool.

import { DIR_NAMES } from './engine.js';

export const SPEAKER = { PILOT: 'PILOT', YOU: 'YOU' };

// Aviation-standard digit spelling.
const PHONETIC = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
  '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'niner',
};

const AIRLINE_CALLSIGNS = {
  UAL: 'United', DAL: 'Delta', AAL: 'American', SWA: 'Southwest',
  FDX: 'FedEx', JBU: 'JetBlue', ACA: 'Air Canada', BAW: 'Speedbird',
  DLH: 'Lufthansa', AFR: 'Air France', KLM: 'KLM', QFA: 'Qantas',
  ANA: 'All Nippon', JAL: 'Japan Air', CPA: 'Cathay',
};

/** Speak a callsign like "UAL42" as "United four two". */
export function speakCallsign(cs) {
  if (!cs) return '';
  const airline = cs.slice(0, 3);
  const num = cs.slice(3);
  const name = AIRLINE_CALLSIGNS[airline] || airline;
  const spoken = [...num].map(c => PHONETIC[c] || c).join(' ');
  return `${name} ${spoken}`;
}

/** Altitude digit → spoken thousands. e.g. 3 → "three thousand". */
function speakAltitude(alt) {
  if (alt === 0) return 'ground level';
  const digit = String(alt);
  const spoken = PHONETIC[digit] || digit;
  return `${spoken} thousand`;
}

/** Direction 0..7 → heading digits. e.g. 2 (E) = 090° → "zero niner zero". */
function speakHeadingFromDir(dir) {
  const deg = dir * 45;
  return String(deg).padStart(3, '0').split('').map(c => PHONETIC[c]).join(' ');
}

// ---------------------------------------------------------------------------
// Event → chatter builders
// Each returns { speaker, subtitle, tts } or null if no radio call.
// ---------------------------------------------------------------------------

/** Aircraft appears on radar from an exit. Pilot calls approach. */
export function chatterOnSpawn(callsign, altitude, atisLetter, sectorName) {
  const cs = speakCallsign(callsign);
  const subtitle = `Approach, ${callsign}, level ${altitude}000, information ${atisLetter}, requesting instructions.`;
  const tts = `Approach, ${cs}, level ${speakAltitude(altitude)}, information ${atisLetter}, requesting instructions.`;
  return { speaker: SPEAKER.PILOT, subtitle, tts };
}

/** Aircraft is sitting on the ground at an airport, waiting for clearance. */
export function chatterOnGroundReady(callsign, airportLabel) {
  const cs = speakCallsign(callsign);
  const subtitle = `Ground, ${callsign}, ready for departure airport ${airportLabel}.`;
  const tts = `Ground, ${cs}, ready for departure airport ${airportLabel}.`;
  return { speaker: SPEAKER.PILOT, subtitle, tts };
}

/** Player-as-controller issues a command. Controller speaks. */
export function chatterOnCommand(callsign, cmd, plane) {
  if (!callsign) return null;
  const cs = speakCallsign(callsign);
  const label = callsign;

  switch (cmd.action) {
    case 'altitude': {
      const target = cmd.arg;
      const cur = plane.altitude;
      const verb = target > cur ? 'climb and maintain'
                : target < cur ? 'descend and maintain'
                : 'maintain';
      return {
        speaker: SPEAKER.YOU,
        subtitle: `${label}, ${verb} ${target}000.`,
        tts: `${cs}, ${verb} ${speakAltitude(target)}.`,
      };
    }
    case 'altitudeUp':
      return {
        speaker: SPEAKER.YOU,
        subtitle: `${label}, climb ${cmd.arg}000 feet.`,
        tts: `${cs}, climb ${speakAltitude(cmd.arg)}.`,
      };
    case 'altitudeDown':
      return {
        speaker: SPEAKER.YOU,
        subtitle: `${label}, descend ${cmd.arg}000 feet.`,
        tts: `${cs}, descend ${speakAltitude(cmd.arg)}.`,
      };
    case 'turn':
      return {
        speaker: SPEAKER.YOU,
        subtitle: `${label}, turn heading ${String(cmd.arg * 45).padStart(3, '0')}.`,
        tts: `${cs}, turn heading ${speakHeadingFromDir(cmd.arg)}.`,
      };
    case 'turnHardLeft':
      return {
        speaker: SPEAKER.YOU,
        subtitle: `${label}, turn left 90 degrees.`,
        tts: `${cs}, turn left, niner zero degrees.`,
      };
    case 'turnHardRight':
      return {
        speaker: SPEAKER.YOU,
        subtitle: `${label}, turn right 90 degrees.`,
        tts: `${cs}, turn right, niner zero degrees.`,
      };
    case 'circle':
      return {
        speaker: SPEAKER.YOU,
        subtitle: `${label}, enter right holding pattern, present position.`,
        tts: `${cs}, enter right holding pattern, present position.`,
      };
    case 'towardsBeacon':
      return {
        speaker: SPEAKER.YOU,
        subtitle: `${label}, proceed direct beacon ${cmd.arg}.`,
        tts: `${cs}, proceed direct beacon ${cmd.arg}.`,
      };
    case 'towardsAirport':
      return {
        speaker: SPEAKER.YOU,
        subtitle: `${label}, cleared direct airport ${cmd.arg}.`,
        tts: `${cs}, cleared direct airport ${cmd.arg}.`,
      };
    case 'towardsExit':
      return {
        speaker: SPEAKER.YOU,
        subtitle: `${label}, cleared exit ${cmd.arg}.`,
        tts: `${cs}, cleared exit ${cmd.arg}.`,
      };
    case 'mark':
    case 'ignore':
    case 'unmark':
      return null; // administrative status, no radio call
    default:
      return null;
  }
}

/** Aircraft lands successfully. Controller farewells. */
export function chatterOnLand(callsign, airportLabel) {
  const cs = speakCallsign(callsign);
  return {
    speaker: SPEAKER.YOU,
    subtitle: `${callsign}, welcome to airport ${airportLabel}. Contact ground, good day.`,
    tts: `${cs}, welcome to airport ${airportLabel}. Contact ground, good day.`,
  };
}

/** Aircraft exits successfully. Controller hands off. */
export function chatterOnExit(callsign, exitLabel) {
  const cs = speakCallsign(callsign);
  return {
    speaker: SPEAKER.YOU,
    subtitle: `${callsign}, contact center, good day.`,
    tts: `${cs}, contact center, good day.`,
  };
}

/** Aircraft is running low on fuel. Pilot declares. */
export function chatterOnFuelWarn(callsign) {
  const cs = speakCallsign(callsign);
  return {
    speaker: SPEAKER.PILOT,
    subtitle: `${callsign}, minimum fuel, requesting priority.`,
    tts: `${cs}, minimum fuel, requesting priority.`,
  };
}

/** Game-losing event. Pilot declares emergency. */
export function chatterOnLoss(callsign, reason) {
  const cs = speakCallsign(callsign);
  const shortReason = reason.replace(/\.$/, '');
  return {
    speaker: SPEAKER.PILOT,
    subtitle: `MAYDAY MAYDAY MAYDAY. ${callsign}. ${shortReason}.`,
    tts: `Mayday, mayday, mayday. ${cs}. ${shortReason}.`,
  };
}

/** Aircraft reaches beacon while delayed. Pilot reports. */
export function chatterOnBeacon(callsign, beaconLabel) {
  const cs = speakCallsign(callsign);
  return {
    speaker: SPEAKER.PILOT,
    subtitle: `${callsign}, over beacon ${beaconLabel}.`,
    tts: `${cs}, over beacon ${beaconLabel}.`,
  };
}

/** Idle atmospheric chatter — fired occasionally when nothing else is
 *  happening, to keep the room feeling alive. */
const AMBIENT_LINES = [
  { speaker: SPEAKER.PILOT, subtitle: '{cs}, radar contact, level {alt}000.',      tts: '{tcs}, radar contact, level {talt}.' },
  { speaker: SPEAKER.PILOT, subtitle: '{cs}, wilco.',                              tts: '{tcs}, wilco.' },
  { speaker: SPEAKER.PILOT, subtitle: '{cs}, roger.',                              tts: '{tcs}, roger.' },
  { speaker: SPEAKER.PILOT, subtitle: '{cs}, request higher, if able.',            tts: '{tcs}, request higher, if able.' },
  { speaker: SPEAKER.PILOT, subtitle: '{cs}, we have traffic in sight.',           tts: '{tcs}, we have traffic in sight.' },
];

export function chatterAmbient(callsign, plane) {
  if (!callsign || !plane) return null;
  const tmpl = AMBIENT_LINES[Math.floor(Math.random() * AMBIENT_LINES.length)];
  const cs = callsign;
  const tcs = speakCallsign(callsign);
  const alt = plane.altitude;
  const talt = speakAltitude(alt);
  return {
    speaker: tmpl.speaker,
    subtitle: tmpl.subtitle.replaceAll('{cs}', cs).replaceAll('{alt}', alt),
    tts: tmpl.tts.replaceAll('{tcs}', tcs).replaceAll('{talt}', talt),
  };
}
