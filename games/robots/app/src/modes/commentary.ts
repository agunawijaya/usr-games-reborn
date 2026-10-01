// The play-by-play. Short lines in the commentators' own words, picked in
// turn so the same moment rarely sounds the same twice in a row.

const LINES = {
  bonk: ['And down they go!', 'Two robots, one square. You know what happens next.', 'A crunch on the glass!', 'That is a pile-up!', 'Scrap metal, folks.'],
  chain: ['A chain! The stands are on their feet!', 'One after another, like dominoes!', 'They just keep falling!'],
  reaction: ['CHAIN REACTION! Listen to this crowd!', 'Is there anything left out there?', 'Unbelievable sequence!'],
  stuck: ['Straight into the scrap heap!', 'Right into the wreckage. Lovely.'],
  close: ['Inches! Inches from a robot!', 'Too close for comfort, and still standing!', 'Ice in the veins out there.'],
  teleport: ['A teleport! Where will we land?', 'Out of there in a flash!', 'Gone! And back, somewhere else.'],
  wave: ['{n} robots beam onto the glass.', 'Here they come: {n} of them.', 'Wave {w}, and {n} robots looking for you.'],
  clear: ['Wave cleared! What a performance!', 'Not a robot left standing!', 'Clean glass! Take a bow.'],
  loud: ['The crowd is getting loud!', 'You can hear them now!'],
  roaring: ['Hear that roar?', 'The stadium is shaking!'],
  showtime: ["IT'S SHOWTIME! Fireworks over the stands!", 'SHOWTIME! Every crash counts four times now!'],
  calm: ['The crowd catches its breath.', 'A quieter moment in the stands.'],
  call: ['Call complete: {c}!', 'The big screen lights up: {c}, done!'],
  missed: ['That call has slipped away: {c}.'],
  caught: ['Caught! And the whole stadium rises to applaud the run.', 'Got you at last. What a run, though!', 'Caught! Hear that applause? That is for you.'],
  won: ['MATCH WON! The tour rolls on!', 'Victory! Pack the bags, next stadium!'],
  advance: ['Skipped ahead and cleared it: a bonus of {b}!'],
} as const;

export type LineKind = keyof typeof LINES;

const turns: Partial<Record<LineKind, number>> = {};

export function line(kind: LineKind, fill: Readonly<Record<string, string | number>> = {}): string {
  const options = LINES[kind];
  const index = turns[kind] ?? 0;
  turns[kind] = index + 1;
  let text: string = options[index % options.length];
  for (const [key, value] of Object.entries(fill)) text = text.replace(`{${key}}`, String(value));
  return text;
}
