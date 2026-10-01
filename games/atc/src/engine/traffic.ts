/**
 * Who is flying. The rules only know a letter and whether a plane is a prop or a jet; Skyloom
 * gives every flight an invented carrier and number so the strips read like a real shift. Every
 * name here is made up for the game.
 */

export type FlightRole = 'scheduled' | 'medical' | 'mail';

export interface Carrier {
  name: string;
  /** Two-letter code printed on the strip. */
  code: string;
  /** Hue for the strip's carrier stripe, in degrees. */
  hue: number;
}

export interface Flight {
  carrier: Carrier;
  number: number;
  role: FlightRole;
}

export const CARRIERS: readonly Carrier[] = [
  { name: 'Larkline', code: 'LK', hue: 28 },
  { name: 'Kitefin', code: 'KF', hue: 196 },
  { name: 'Bluewren', code: 'BW', hue: 222 },
  { name: 'Ternway', code: 'TW', hue: 168 },
  { name: 'Lantern Air', code: 'LN', hue: 44 },
  { name: 'Driftwood', code: 'DW', hue: 18 },
  { name: 'Pebble Hop', code: 'PH', hue: 300 },
  { name: 'Saltmarsh', code: 'SM', hue: 140 },
  { name: 'Moonmoth', code: 'MM', hue: 262 },
  { name: 'Cloudberry', code: 'CB', hue: 340 },
];

/** Flights that are not airline traffic keep these fixed names. */
export const SPECIAL_CARRIERS: Readonly<Record<Exclude<FlightRole, 'scheduled'>, Carrier>> = {
  medical: { name: 'Medical', code: 'MD', hue: 4 },
  mail: { name: 'Night Post', code: 'NP', hue: 210 },
};

export function callsign(flight: Flight): string {
  return `${flight.carrier.name} ${flight.number}`;
}
