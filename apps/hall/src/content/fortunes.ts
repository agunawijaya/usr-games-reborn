import { createRng, type DateKey, daysBetween } from '@usr-games/kit';

/**
 * The fortune of the day. Every line is written for this collection: short, all-ages notes on
 * computing history and on play. None of it comes from the original fortune files.
 */
export const FORTUNES: readonly string[] = [
  'The first computer bug on record was a real moth, taped into a logbook in 1947.',
  'Unix got its name as a pun on Multics, the bigger system it grew out of.',
  'Old terminals drew one character at a time. Patience was part of the game.',
  'A daemon on Unix is just a helpful background process. No horns required.',
  'Ctrl+C asks a program to stop. Asking nicely is a good habit everywhere.',
  'Before search engines, you typed man and the machine explained itself.',
  'Section 6 of the Unix manual is where the games live.',
  'One reason Unix exists: Ken Thompson wanted a better home for his Space Travel game.',
  'A pixel is a promise: tiny, square-ish and doing its best.',
  'There is no wrong way to play a screensaver.',
  'grep is named after an old editor command: g/re/p, global regular expression print.',
  'The first computer mouse had a wooden shell.',
  'Rest your eyes: look at something far away for twenty seconds.',
  'Your high score is between you and the machine. The machine is not telling.',
  'Some of these games are older than the people who rebuilt them.',
  'A kilobyte was once plenty of room for a game. Programmers were very tidy.',
  'The word software was in print by 1958.',
  'A game of noughts and crosses ran on the EDSAC computer in 1952.',
  'Tennis for Two was played on an oscilloscope in 1958.',
  'Spacewar! was written for a PDP-1 in 1962 and shared freely between labs.',
  'The first message sent over the ARPANET was “lo”. The system crashed before “login” finished.',
  'Take a break when your shoulders creep up toward your ears.',
  'Every master of a game was once very bad at it.',
  'In many 1970s labs you booked your time on the computer in advance.',
  'A teletype printed every keystroke on paper. Typos lasted forever.',
  'In 1843 Ada Lovelace wrote that an engine might one day compose music.',
  'Grace Hopper handed out 30-centimetre wires to show how far light travels in a nanosecond.',
  'Emoji began as a set of 176 tiny pictures for Japanese phones in 1999.',
  'Every process has a parent. Yours is probably a shell.',
  'The cron in cron jobs comes from chronos, the Greek word for time.',
  'rot13 is its own undo button: apply it twice and you are back where you started.',
  'In Morse code a single dot stands for E, the most common letter in English.',
  'A punch card held one line of a program. Dropping the deck was a very bad day.',
  'Early game makers drew their characters on graph paper, square by square.',
  'Hello, world became famous through a 1978 book about the C language.',
  'Bit is short for binary digit, a word John Tukey made popular.',
  'There are 10 kinds of people: those who read binary and those who do not.',
  'Winning is fun. Working out why you lost is a close second.',
  'Mistyped a command? The machine forgives you. So should you.',
  'The computer that guided Apollo 11 had about four kilobytes of erasable memory.',
  'Many early monitors glowed green or amber: one colour, one phosphor, plenty of charm.',
  'The QWERTY layout was made for typewriters, long before keyboards had screens.',
  'Unix time counts the seconds since the first moment of 1970.',
  'In 2038 old 32-bit Unix clocks run out of room. Most machines are ready already.',
  'The first webcam watched a coffee pot in a Cambridge computer lab.',
  'Some old games saved your progress as a password you wrote down on paper.',
  'A kind word to another player costs nothing and can make their whole evening.',
  'Nothing in this room is racing you. Play at your own pace.',
  'Pressing Tab to finish a command felt like magic the first time.',
  'BSD stands for Berkeley Software Distribution, from the University of California.',
  'The programs in /usr/games were written by students, researchers and hobbyists, often just for fun.',
  'Colossal Cave began as a map of a real cave system in Kentucky.',
  'The cave-hunting game behind wump was first written in BASIC in the early 1970s.',
  'A good puzzle feels impossible for a minute and obvious forever after.',
  'Screensavers were invented to stop still images burning into old screens.',
  'The first game you loved is allowed to stay your favourite.',
  'Blink, stretch, sip some water. The processes will wait.',
  'Every expert once typed their first ls and wondered what it meant.',
  'A cursor blinking in the dark is an invitation.',
  'The machine hums a little louder when someone new logs in.',
];

const INDICES = FORTUNES.map((_, index) => index);

function cycleOrder(cycle: number): number[] {
  return createRng(`fortunes:${cycle}`).shuffle(INDICES);
}

/**
 * The same line for everyone on the same day. Days walk through a shuffled cycle of all sixty
 * lines, so nothing repeats for two months and never two days running, even across cycles.
 */
export function fortuneFor(day: DateKey): string {
  const dayNumber = daysBetween('2026-01-01', day);
  const cycle = Math.floor(dayNumber / FORTUNES.length);
  const position = dayNumber - cycle * FORTUNES.length;
  const order = cycleOrder(cycle);
  const previousLast = cycleOrder(cycle - 1)[FORTUNES.length - 1];
  if (order[0] === previousLast) [order[0], order[1]] = [order[1] as number, order[0] as number];
  return FORTUNES[order[position] as number] as string;
}

/**
 * Lines that are advice or encouragement rather than history; the "Did you know?" line in the
 * plain-word styles skips them and keeps to facts.
 */
const NOT_FACTS = new Set([
  'A pixel is a promise: tiny, square-ish and doing its best.',
  'There is no wrong way to play a screensaver.',
  'Rest your eyes: look at something far away for twenty seconds.',
  'Your high score is between you and the machine. The machine is not telling.',
  'Some of these games are older than the people who rebuilt them.',
  'Take a break when your shoulders creep up toward your ears.',
  'Every master of a game was once very bad at it.',
  'Every process has a parent. Yours is probably a shell.',
  'There are 10 kinds of people: those who read binary and those who do not.',
  'Winning is fun. Working out why you lost is a close second.',
  'Mistyped a command? The machine forgives you. So should you.',
  'A kind word to another player costs nothing and can make their whole evening.',
  'Nothing in this room is racing you. Play at your own pace.',
  'Pressing Tab to finish a command felt like magic the first time.',
  'A good puzzle feels impossible for a minute and obvious forever after.',
  'The first game you loved is allowed to stay your favourite.',
  'Blink, stretch, sip some water. The processes will wait.',
  'Every expert once typed their first ls and wondered what it meant.',
  'A cursor blinking in the dark is an invitation.',
  'The machine hums a little louder when someone new logs in.',
]);

export const FACTS: readonly string[] = FORTUNES.filter((line) => !NOT_FACTS.has(line));

/** Today's "Did you know?" line: the same for everyone, walking through the facts in turn. */
export function didYouKnowFor(day: DateKey): string {
  const dayNumber = daysBetween('2026-01-01', day);
  const index = ((dayNumber % FACTS.length) + FACTS.length) % FACTS.length;
  return FACTS[
    createRng(`facts:${Math.floor(dayNumber / FACTS.length)}`).shuffle(FACTS.map((_, i) => i))[
      index
    ] as number
  ] as string;
}
