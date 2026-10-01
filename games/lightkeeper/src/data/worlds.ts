/**
 * The thirty-two inhabited worlds of the Reach, each a light on the keeper's chart. The 1976
 * program had a table of system names borrowed from its television source; these are ours.
 */

export interface World {
  name: string;
  /** One line for the gazetteer. */
  note: string;
}

export const WORLDS: readonly World[] = [
  { name: 'Amberlee', note: 'Orchard moons that glow at harvest.' },
  { name: 'Bellwether', note: 'Its bells are rung for every ship that passes.' },
  { name: 'Cinderfall', note: 'Warm ash beaches and a sky of slow sparks.' },
  { name: 'Driftmoor', note: 'Floating peat islands, tethered by kelp ropes.' },
  { name: 'Elderglass', note: 'A city blown from one enormous bubble of glass.' },
  { name: 'Fenlight', note: 'Marsh lanterns kept lit by a guild of children.' },
  { name: 'Gloaming', note: 'Forever at dusk, and proud of it.' },
  { name: 'Hollowmere', note: 'A lake inside a mountain inside a lake.' },
  { name: 'Ivydell', note: 'The vines here hum when it is about to rain.' },
  { name: 'Juniper Tor', note: 'Sheep, wind and the best bread in the Reach.' },
  { name: 'Kestrelholm', note: 'Falconers who race their birds against comets.' },
  { name: 'Lowtide', note: 'The sea goes out for a week and comes back singing.' },
  { name: 'Marrowdeep', note: 'Miners who sing to the stone before they cut.' },
  { name: 'Nettlefold', note: 'Every house has a garden on its roof.' },
  { name: 'Oriel', note: 'A library world; quiet, please.' },
  { name: 'Pennywhistle', note: 'Famous for its tin flutes and long summers.' },
  { name: 'Quillon', note: 'Mapmakers who drew the first chart of the Reach.' },
  { name: 'Rookhaven', note: 'Clever black birds run the post office.' },
  { name: 'Saltgrass', note: 'Prairies of silver grass that taste of the sea.' },
  { name: 'Thistlewick', note: 'Candlemakers, and their candles never smoke.' },
  { name: 'Umbermouth', note: 'A river delta wide enough to see from orbit.' },
  { name: 'Vesperhall', note: 'Evening choirs that echo between three moons.' },
  { name: 'Willowkeep', note: 'A forest that keeps the oldest records in its rings.' },
  { name: 'Yarrowby', note: 'Herbalists, healers and very patient goats.' },
  { name: 'Zephyrine', note: 'Kite cities that never touch the ground.' },
  { name: 'Brindle', note: 'Striped hills, striped cats, striped scarves.' },
  { name: 'Copperkettle', note: 'Tea plantations under a green sun.' },
  { name: 'Dovecote', note: 'A world of towers and the birds that live in them.' },
  { name: 'Emberlyn', note: 'Glassblowers who use the heat of a young volcano.' },
  { name: 'Foxglove', note: 'Purple valleys, and a festival every new moon.' },
  { name: 'Larkspur', note: 'Its dawn chorus can be heard from the harbour.' },
  { name: 'Snowberry', note: 'Winter for half the year, cocoa for all of it.' },
];

export function worldName(index: number | null): string {
  if (index === null) return 'an empty system';
  return WORLDS[index]?.name ?? `World ${index + 1}`;
}
