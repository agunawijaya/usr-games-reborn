import type { HelpRule, MachineId, Message, Step } from './message';
import { parFor } from './par';

/**
 * The Signal Room: seven chapters of six messages. You are the night operator in a little
 * room at the top of an old exchange, where every way of sending a message still stands on the
 * desk; tonight the machines start receiving, one after another, from someone who signs "K.".
 * Every word here is ours.
 */
export interface Chapter {
  number: number;
  title: string;
  machine: MachineId | 'all';
  opening: string;
  messages: Message[];
}

type Draft = Omit<Message, 'id' | 'par' | 'help'> & { help?: HelpRule };

function chapter(
  number: number,
  title: string,
  machine: MachineId | 'all',
  opening: string,
  drafts: Draft[],
): Chapter {
  return {
    number,
    title,
    machine,
    opening,
    messages: drafts.map((draft, i) => ({
      ...draft,
      id: `c${number}-m${i + 1}`,
      help: draft.help ?? (i < 2 ? 'free' : 'costs-star'),
      par: draft.steps.reduce((sum, step) => sum + parFor(step), 0),
    })),
  };
}

const morse = (text: string, wpm: number, spacingWpm: number, newLetters?: string): Step => ({
  machine: 'telegraph',
  mode: 'read',
  text,
  wpm,
  spacingWpm,
  newLetters,
});
const key = (text: string, wpm = 12): Step => ({ machine: 'telegraph', mode: 'send', text, wpm });
const wheel = (text: string, shift: number, keyword?: string): Step =>
  keyword
    ? { machine: 'cipher', mode: 'crack', text, shift, keyword }
    : { machine: 'cipher', mode: 'crack', text, shift };
const card = (mode: 'read' | 'punch', text: string): Step => ({ machine: 'punch', mode, text });
const tape = (mode: 'read' | 'punch', text: string): Step => ({ machine: 'tape', mode, text });
const banner = (text: string, width = 132): Step => ({
  machine: 'printer',
  mode: 'read',
  text,
  width,
});
const flagsIn = (text: string, hold: number): Step => ({
  machine: 'semaphore',
  mode: 'read',
  text,
  hold,
  scene: 'rooftop',
});
const flagsOut = (text: string, limit: number): Step => ({
  machine: 'semaphore',
  mode: 'send',
  text,
  limit,
  scene: 'rooftop',
});

export const CHAPTERS: readonly Chapter[] = [
  chapter(
    1,
    'The first wire',
    'telegraph',
    'Just after midnight the sounder on the desk starts to click. Nobody has used that wire in years.',
    [
      {
        title: 'Two sounds',
        story:
          'Short and long: a dit and a daw. Four sounds to begin with, E, T, A and N. Listen, watch the lamp, and write down what comes.',
        reply: 'Tea at ten. Somebody out there keeps old habits.',
        steps: [morse('TEA AT TEN', 12, 5, 'ETAN')],
      },
      {
        title: 'Nine o’clock',
        story:
          'The same hand again, a little quicker. Two new sounds join the four you know: I and M.',
        reply: 'Nine. Two hours from now. The lamp hums and waits.',
        steps: [morse('MEET ME AT NINE', 12, 6, 'IM')],
      },
      {
        title: 'Not a test',
        story:
          'S is three dits, O is three daws. The sender seems to want you to be sure of something.',
        reply: 'Not a test. Then who is at the other end?',
        steps: [morse('IT IS NOT A TEST', 13, 7, 'SO')],
      },
      {
        title: 'Answer back',
        help: 'free',
        story:
          'Tell them someone is at the desk. Tap the key for a dit, hold it for a daw, and leave a gap between letters.',
        reply: 'The sounder pauses, then clicks twice. They heard you.',
        steps: [key('I AM ON')],
      },
      {
        title: 'Another room',
        story: 'A longer message now, and two more sounds: H, four dits, and R, dit daw dit.',
        reply: 'Another room. The wire has to run somewhere.',
        steps: [morse('THERE IS ANOTHER ROOM', 14, 8, 'HR')],
      },
      {
        title: 'Where the wires end',
        story:
          'The last message comes quick and sure, from someone who has done this for years. New tonight: D and W.',
        reply: 'Where the wires end... The drawer under the desk is not locked.',
        steps: [morse('WHERE THE WIRES END', 15, 10, 'DW')],
      },
    ],
  ),
  chapter(
    2,
    'The turning wheel',
    'cipher',
    'In the drawer: a brass wheel, a frequency scope and a note in neat capitals, signed K.',
    [
      {
        title: 'A brass wheel',
        story:
          'The note says: every letter was turned three places along. Turn the wheel until the board reads; the scope lights when it looks like English.',
        reply: 'Three places along, the oldest trick there is. It reads.',
        steps: [wheel('THE WHEEL WAS LEFT FOR YOU', 3)],
      },
      {
        title: 'Thirteen',
        story:
          'Thirteen places is a famous turn. Turn it twice and you are home again, which made it handy for hiding the end of a story.',
        reply: 'Turned thirteen, and thirteen back.',
        steps: [wheel('PEOPLE HID SPOILERS THIS WAY', 13)],
      },
      {
        title: 'The common letters',
        story:
          'No hint about the turn this time. English leans hard on E and T, and the scope knows by how much.',
        reply: 'Find the E and the rest follows.',
        steps: [wheel('LOOK FOR THE COMMON LETTERS', 7)],
      },
      {
        title: 'Every letter counts',
        story:
          'K. writes that the scope weighs rare letters heavily: one stray Z can sink a wrong guess.',
        reply: 'The scope never guesses: it counts.',
        steps: [wheel('THE SCOPE COUNTS EVERY LETTER', 18)],
      },
      {
        title: 'Odd letters out',
        story:
          'A warning in the margin: a short message full of odd letters fools the scope. Trust your eyes over its light.',
        reply: 'The scope was sure, and wrong. You were not.',
        steps: [wheel('PIZZA JAZZ QUIZ', 11)],
      },
      {
        title: 'A word for a key',
        story:
          'Not one turn but four, taking turns letter by letter. The key word is DESK: D turns three, E four, S eighteen, K ten.',
        reply: 'Four turns in a ring. The cards are next.',
        steps: [wheel('THE CARDS COME NEXT', 0, 'DESK')],
      },
    ],
  ),
  chapter(
    3,
    'Holes in the stack',
    'punch',
    'Behind the printer, a box of stiff manila cards, each with a single line punched into it.',
    [
      {
        title: 'Zones and digits',
        story:
          'One column, one character. A hole in the top three rows says which part of the alphabet; one hole below says where in it.',
        reply: 'Punched in 1964, and still readable.',
        steps: [card('read', 'PUNCHED IN 1964')],
      },
      {
        title: 'Twelve, eleven, zero',
        story:
          'The top rows are called twelve, eleven and zero. Twelve and one make A; eleven and one make J; zero and two make S.',
        reply: 'Zone and digit. It is a little like a map.',
        steps: [card('read', 'ZONE AND DIGIT')],
      },
      {
        title: 'Punch one back',
        help: 'free',
        story:
          'Punch a card in reply: arrow keys pick a hole, Space punches it, Enter moves to the next column.',
        reply: 'A clean card. It drops into the stacker.',
        steps: [card('punch', 'HELLO DESK')],
      },
      {
        title: 'One line each',
        story: 'The chart goes away now, unless you ask for it. Read the card by its holes.',
        reply: 'One card, one line: the rule of the box.',
        steps: [card('read', 'ONE CARD ONE LINE')],
      },
      {
        title: 'See you on tape',
        story: 'K. asks for a longer card. Punch it by hand.',
        reply: 'The punch thunks along the row like a small train.',
        steps: [card('punch', 'SEE YOU ON TAPE')],
      },
      {
        title: 'Q and R',
        story:
          'An old card with a story: for fourteen years, a table of these codes gave two letters the very same holes.',
        reply: 'Fixed in 1993. Somebody noticed when it printed a cover page wrong.',
        steps: [card('read', 'Q AND R SHARED A CODE')],
      },
    ],
  ),
  chapter(
    4,
    'The ticker ribbon',
    'tape',
    'A reel of yellow paper tape is waiting in the pigeonholes, wound tight, with a tag: READ ME.',
    [
      {
        title: 'Eight holes',
        story:
          'Eight holes across, and the small sprocket hole between. For a capital letter the hole worth 64 is punched; the five worth 16, 8, 4, 2 and 1 count the letter, A as 1.',
        reply: 'T is twenty, A is one, P is sixteen, E is five.',
        steps: [tape('read', 'TAPE')],
      },
      {
        title: 'Numbers too',
        story:
          'Digits punch the holes worth 32 and 16, then count from zero. A row with only the 32 hole is a space.',
        reply: 'Eight holes. Of course.',
        steps: [tape('read', '8 HOLES')],
      },
      {
        title: 'Punch a greeting',
        help: 'free',
        story:
          'Punch two rows of your own. Keys 1 to 8 punch the holes from left to right; Enter feeds the tape on.',
        reply: 'Hi, says the tape, in eight-hole capitals.',
        steps: [tape('punch', 'HI')],
      },
      {
        title: 'Read it back',
        story: 'A longer strip, and the hole values are hidden now, unless you ask for them.',
        reply: 'The reader is happy: it reads its own tapes back.',
        steps: [tape('read', 'READ IT BACK')],
      },
      {
        title: 'Sprocket',
        story: 'K. asks for a word that names the little hole in the middle. Punch it.',
        reply: 'Every row with its sprocket, every sprocket in its place.',
        steps: [tape('punch', 'SPROCKET')],
      },
      {
        title: 'Something big',
        story: 'The last strip on the reel is short. Something larger is on its way.',
        reply: 'Behind you, the printer clears its throat.',
        steps: [tape('read', 'A BANNER IS COMING')],
      },
    ],
  ),
  chapter(
    5,
    'Banner day',
    'printer',
    'The printer wakes by itself and starts to chatter, feeding fan-fold paper sideways.',
    [
      {
        title: 'Sideways',
        story:
          'The printer writes big letters on their side, down the paper. Read it as soon as you can: the earlier, the better.',
        reply: 'Hello to you too.',
        steps: [banner('HELLO')],
      },
      {
        title: 'Look up',
        story:
          'Tilt your head. The letters are turned a quarter, their tops towards the right edge.',
        reply: 'Look up? At what?',
        steps: [banner('LOOK UP')],
      },
      {
        title: 'Half size',
        story:
          'The printer is told to print narrow, so it skips lines and columns, as the original did. The letters go grainy.',
        reply: 'Grainy, but still news.',
        steps: [banner('BIG NEWS', 66)],
      },
      {
        title: 'Squint',
        story: 'Narrower still. Squint a little: the shapes are all there.',
        reply: 'Wave back at whom?',
        steps: [banner('WAVE BACK', 44)],
      },
      {
        title: 'A third of a banner',
        story: 'Thirty-three columns of one hundred and thirty-two. Every fourth line survives.',
        reply: 'The roof. There is someone on the roof.',
        steps: [banner('ROOFTOP', 33)],
      },
      {
        title: 'Now',
        story: 'The last banner of the night comes out narrow and fast.',
        reply: 'Through the window, across the street: two flags.',
        steps: [banner('SEE THE ROOF NOW', 44)],
      },
    ],
  ),
  chapter(
    6,
    'Flags on the roof',
    'semaphore',
    'Across the street, on the flat roof, someone in a red knitted cap holds up two flags.',
    [
      {
        title: 'The first circle',
        story:
          'Each letter is a pose, held for a beat. A to G need only one arm. The pose chart shows them.',
        reply: 'A badge? They are wearing one: a little brass key.',
        steps: [flagsIn('A BADGE', 3.6)],
      },
      {
        title: 'The second circle',
        story:
          'H to N keep one arm low on the left while the other moves. Between words, both flags drop and cross.',
        reply: 'A line. Of messages, perhaps.',
        steps: [flagsIn('MAKE A LINE', 3)],
      },
      {
        title: 'Send it back',
        help: 'free',
        story:
          'Your turn: set both arms for each letter before its clock runs out. Keys Q W E, A D, Z X C move the left flag; the number pad moves the right. You can drag the flags too.',
        reply: 'The figure across the street raises both flags high: received.',
        steps: [flagsOut('SIGNAL', 6)],
      },
      {
        title: 'Over here',
        story: 'Faster now, and the chart is yours to call up only if you need it.',
        reply: 'Over here, they say, and point at your window.',
        steps: [flagsIn('OVER HERE', 2.4)],
      },
      {
        title: 'Wave back',
        story: 'Send two words. Remember the rest between them: both flags down, crossed.',
        reply: 'They wave both flags, which needs no chart.',
        steps: [flagsOut('WAVE BACK', 4)],
      },
      {
        title: 'Every machine',
        story: 'A long message, sent briskly. Twenty letters, one beat each.',
        reply: 'Every machine at once? Tomorrow night, then.',
        steps: [flagsIn('MEET ME AT EVERY MACHINE', 1.9)],
      },
    ],
  ),
  chapter(
    7,
    'The whole desk',
    'all',
    'The next night every lamp on the desk lights at once. Each answer is the key to the next machine.',
    [
      {
        title: 'Turn seven',
        story: 'The sounder first, then the wheel. Listen for how far to turn it.',
        reply: 'All at once, as promised.',
        steps: [morse('TURN SEVEN', 15, 10), wheel('ALL MACHINES AT ONCE', 19)],
      },
      {
        title: 'The word to punch',
        story: 'A turned message tells you what to punch on a card.',
        reply: 'Dawn, punched in manila.',
        steps: [wheel('PUNCH THE WORD DAWN', 5), card('punch', 'DAWN')],
      },
      {
        title: 'Narrow',
        story: 'A strip of tape with instructions for the printer.',
        reply: 'The roof again.',
        steps: [tape('read', 'SQUINT'), banner('THE ROOF', 33)],
      },
      {
        title: 'By the numbers',
        story: 'The flags spell a turn for the wheel, with the numerals sign before the digits.',
        reply: 'Keep the lamp on. Of course.',
        steps: [flagsIn('ROT 13', 2.4), wheel('KEEP THE LAMP ON', 13)],
      },
      {
        title: 'Card, wire, tape',
        story: 'Three machines in a row. Each one says which comes next.',
        reply: 'Last one. The room is very quiet.',
        steps: [card('read', 'LISTEN'), morse('READ THE TAPE', 16, 12), tape('read', 'LAST ONE')],
      },
      {
        title: 'Signed, K.',
        story:
          'The wire, the roof and the printer, one after the other, for the last message of all.',
        reply: 'Signed K., who kept this desk for forty years, and sends you the key.',
        steps: [morse('WELCOME OPERATOR', 16, 12), flagsIn('THE DESK', 2), banner('IS YOURS')],
      },
    ],
  ),
];

export function messageById(
  id: string,
): { chapter: Chapter; message: Message; index: number } | null {
  for (const chapter of CHAPTERS) {
    const index = chapter.messages.findIndex((message) => message.id === id);
    if (index >= 0) return { chapter, message: chapter.messages[index]!, index };
  }
  return null;
}
