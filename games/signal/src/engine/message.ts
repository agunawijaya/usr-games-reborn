/**
 * A message is what the night operator works on: one step at one machine, or a chain of steps
 * where each machine's answer leads to the next. Steps say what the player sees and what
 * counts as the right answer; nothing here knows how a machine is drawn.
 */
export type MachineId = 'telegraph' | 'cipher' | 'punch' | 'tape' | 'printer' | 'semaphore';

export const MACHINES: readonly MachineId[] = [
  'telegraph',
  'cipher',
  'punch',
  'tape',
  'printer',
  'semaphore',
];

export const MACHINE_NAMES: Record<MachineId, string> = {
  telegraph: 'Telegraph',
  cipher: 'Cipher wheel',
  punch: 'Card punch',
  tape: 'Tape reader',
  printer: 'Banner printer',
  semaphore: 'Flags on the roof',
};

export type Step =
  /** Hear and watch a message on the sounder; type what it says. */
  | {
      machine: 'telegraph';
      mode: 'read';
      text: string;
      wpm: number;
      spacingWpm: number;
      newLetters?: string;
    }
  /** Key a message with the telegraph key. */
  | { machine: 'telegraph'; mode: 'send'; text: string; wpm: number }
  /**
   * Turn the wheel until the message reads. `shift` is how far the sender turned it; with a
   * keyword, every letter has its own shift from the keyword in turn.
   */
  | { machine: 'cipher'; mode: 'crack'; text: string; shift: number; keyword?: string }
  | { machine: 'punch'; mode: 'read' | 'punch'; text: string }
  | { machine: 'tape'; mode: 'read' | 'punch'; text: string }
  /** Read the banner as it prints; `width` below 132 is the original's grainy `-w`. */
  | { machine: 'printer'; mode: 'read'; text: string; width: number }
  /** `hold` is seconds per pose when reading; `limit` is seconds per letter when sending. */
  | { machine: 'semaphore'; mode: 'read'; text: string; hold: number; scene: 'rooftop' | 'ship' }
  | { machine: 'semaphore'; mode: 'send'; text: string; limit: number; scene: 'rooftop' | 'ship' };

/** Whether help (charts, the scope, row names) is free, costs the third star, or is put away. */
export type HelpRule = 'free' | 'costs-star';

export interface Message {
  id: string;
  title: string;
  /** The telegram before the work: what arrives and why. Our own words. */
  story: string;
  /** What the operator notes afterwards. */
  reply: string;
  steps: Step[];
  help: HelpRule;
  /** Seconds for the speed star. */
  par: number;
}

/** The text the player must end a step with. */
export function answerOf(step: Step): string {
  return step.text;
}

/**
 * Answers are compared on letters, digits and single spaces only: case, punctuation and extra
 * blanks never cost a star.
 */
export function normalize(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sameAnswer(given: string, expected: string): boolean {
  return normalize(given) === normalize(expected);
}

/**
 * Letter-by-letter marks for a wrong answer, so the player sees where it went wrong without
 * being told the answer: right, wrong, or missing, aligned on the expected text.
 */
export function markAnswer(given: string, expected: string): Array<'right' | 'wrong' | 'missing'> {
  const a = normalize(given);
  const b = normalize(expected);
  return [...b].map((char, i) => {
    if (i >= a.length) return 'missing';
    return a[i] === char ? 'right' : 'wrong';
  });
}

/** How many characters of the answer are right, 0–1. */
export function accuracy(given: string, expected: string): number {
  const marks = markAnswer(given, expected);
  return marks.length === 0 ? 1 : marks.filter((m) => m === 'right').length / marks.length;
}
