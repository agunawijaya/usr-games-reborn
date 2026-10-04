// Control Room 1986 — who is flying. The rules only know a radar letter; the room gives every
// flight a carrier and a number so the strips and the radio read like a real shift. Every carrier,
// code and radio name here is invented for the game (docs/NOTES.md, "Our own names").

/** @typedef {{ code: string, radio: string }} Carrier */

/** @type {readonly Carrier[]} */
export const CARRIERS = [
  { code: 'HBM', radio: 'Hornbeam' },
  { code: 'QLW', radio: 'Quailwood' },
  { code: 'MRW', radio: 'Merrow' },
  { code: 'SVF', radio: 'Silverfen' },
  { code: 'BCK', radio: 'Bracken' },
  { code: 'ELW', radio: 'Elderwood' },
  { code: 'GYF', radio: 'Greyfell' },
  { code: 'STW', radio: 'Stackwind' },
  { code: 'LMP', radio: 'Lamplight' },
  { code: 'TLM', radio: 'Tallowmere' },
  { code: 'CPW', radio: 'Copperwing' },
  { code: 'DLF', radio: 'Dalefold' },
  { code: 'FNW', radio: 'Fernway' },
  { code: 'THD', radio: 'Thistledown' },
  { code: 'RVM', radio: 'Ravenmoor' },
];

const BY_CODE = new Map(CARRIERS.map((carrier) => [carrier.code, carrier]));

/** A strip's callsign, such as "HBM412": a carrier code and a flight number from 1 to 9999. */
export function newCallsign(random = Math.random) {
  const carrier = CARRIERS[Math.floor(random() * CARRIERS.length)];
  const number = 1 + Math.floor(random() * 9999);
  return `${carrier.code}${number}`;
}

/** The radio name for a callsign's carrier ("HBM412" → "Hornbeam"); the code itself if unknown. */
export function radioName(callsign) {
  const code = callsign.slice(0, 3);
  return BY_CODE.get(code)?.radio ?? code;
}
