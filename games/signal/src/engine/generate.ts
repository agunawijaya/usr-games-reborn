import { createRng, type Rng } from '@usr-games/kit';
import { bestRotation, keywordShift, rotate } from '../codecs/caesar';
import { holdSeconds } from '../codecs/semaphore';
import { lessonText, MORSE_LADDER, SEMAPHORE_LADDER } from './ladder';
import { MACHINES, type MachineId, type Message, type Step } from './message';
import { parFor } from './par';
import { PHRASES } from './phrases';

/**
 * Messages made on the spot: free play at any machine, the "beat the machine" ciphers the
 * scope gets wrong, and the Daily Signal, a three-machine chain everyone gets the same day.
 * Everything is seeded, so a seed always makes the same message.
 */

/** Short messages heavy in rare letters, the kind that fool the codebreaker. */
const ODD_PHRASES: readonly string[] = [
  'PIZZA JAZZ QUIZ',
  'JUKEBOX JAZZ',
  'FIZZY JAM',
  'QUIZ BOX',
  'JAZZ VIBES',
  'ZIGZAG JUMP',
  'FUZZY OX',
  'WAX JUKEBOX',
  'JAZZ QUIZ',
  'BUZZY BEES',
];

/** The rotation that reads a message the sender turned by `shift`. */
export function readingTurn(shift: number): number {
  return (26 - (((shift % 26) + 26) % 26)) % 26;
}

/**
 * True when the automatic codebreaker gets this turned message wrong. The scores of a text's 26
 * turns are the same set whatever the sender's shift, so this depends on the text (and, through
 * ties, a little on the shift).
 */
export function foolsTheMachine(plain: string, shift: number): boolean {
  const secret = rotate(plain, shift);
  return rotate(secret, bestRotation(secret)) !== plain;
}

/** A cipher the scope reads correctly: a text and a non-zero shift it is not fooled by. */
function scopeCipher(texts: readonly string[], rng: Rng): Step {
  for (let attempt = 0; attempt < 400; attempt++) {
    const text = rng.pick(texts);
    const shift = rng.int(1, 25);
    if (!foolsTheMachine(text, shift)) return { machine: 'cipher', mode: 'crack', text, shift };
  }
  return { machine: 'cipher', mode: 'crack', text: 'THE SIGNAL IS CLEAR', shift: 3 };
}

/** A "beat the machine" cipher: rejection-sampled until the scope's guess is wrong. */
export function trickCipher(rng: Rng): Step {
  for (let attempt = 0; attempt < 200; attempt++) {
    const text = rng.pick(ODD_PHRASES);
    const shift = rng.int(1, 25);
    if (foolsTheMachine(text, shift)) return { machine: 'cipher', mode: 'crack', text, shift };
  }
  return { machine: 'cipher', mode: 'crack', text: 'PIZZA JAZZ QUIZ', shift: 11 };
}

export type FreeKind =
  | { machine: 'telegraph'; mode: 'learn'; lesson: number; wpm: number; spacingWpm: number }
  | { machine: 'telegraph'; mode: 'read'; wpm: number; spacingWpm: number }
  | { machine: 'telegraph'; mode: 'send'; wpm: number }
  | { machine: 'cipher'; mode: 'crack' | 'keyword' | 'trick' }
  | { machine: 'punch'; mode: 'read' | 'punch' }
  | { machine: 'tape'; mode: 'read' | 'punch' }
  | { machine: 'printer'; mode: 'read'; width: number }
  | { machine: 'semaphore'; mode: 'learn'; lesson: number }
  | { machine: 'semaphore'; mode: 'read'; level: number }
  | { machine: 'semaphore'; mode: 'send'; limit: number };

const shortPhrase = (rng: Rng, longest: number) => {
  const fitting = PHRASES.filter((phrase) => phrase.length <= longest);
  return rng.pick(fitting.length > 0 ? fitting : PHRASES);
};

/** One step of free play. */
export function freeStep(kind: FreeKind, rng: Rng): Step {
  switch (kind.machine) {
    case 'telegraph':
      if (kind.mode === 'learn') {
        return {
          machine: 'telegraph',
          mode: 'read',
          text: lessonText(MORSE_LADDER, kind.lesson, rng, 4),
          wpm: kind.wpm,
          spacingWpm: kind.spacingWpm,
          newLetters: MORSE_LADDER[kind.lesson],
        };
      }
      if (kind.mode === 'read') {
        return {
          machine: 'telegraph',
          mode: 'read',
          text: shortPhrase(rng, 18),
          wpm: kind.wpm,
          spacingWpm: kind.spacingWpm,
        };
      }
      return { machine: 'telegraph', mode: 'send', text: shortPhrase(rng, 12), wpm: kind.wpm };
    case 'cipher': {
      if (kind.mode === 'trick') return trickCipher(rng);
      if (kind.mode === 'keyword') {
        const text = rng.pick(PHRASES.filter((phrase) => phrase.length >= 14));
        const keyword = rng.pick(['KEY', 'DESK', 'LAMP', 'WIRE', 'TAPE', 'FLAG', 'OWL', 'SEA']);
        return { machine: 'cipher', mode: 'crack', text, shift: 0, keyword };
      }
      return scopeCipher(
        PHRASES.filter((phrase) => phrase.length >= 14),
        rng,
      );
    }
    case 'punch':
      return {
        machine: 'punch',
        mode: kind.mode,
        text: kind.mode === 'read' ? shortPhrase(rng, 24) : shortPhrase(rng, 12),
      };
    case 'tape':
      return {
        machine: 'tape',
        mode: kind.mode,
        text: shortPhrase(rng, kind.mode === 'read' ? 14 : 9),
      };
    case 'printer':
      return { machine: 'printer', mode: 'read', text: shortPhrase(rng, 12), width: kind.width };
    case 'semaphore':
      if (kind.mode === 'learn') {
        return {
          machine: 'semaphore',
          mode: 'read',
          text: lessonText(SEMAPHORE_LADDER, kind.lesson, rng, 3),
          hold: holdSeconds(Math.min(2, kind.lesson)),
          scene: 'rooftop',
        };
      }
      if (kind.mode === 'read') {
        return {
          machine: 'semaphore',
          mode: 'read',
          text: shortPhrase(rng, 14),
          hold: holdSeconds(kind.level),
          scene: kind.level >= 4 ? 'ship' : 'rooftop',
        };
      }
      return {
        machine: 'semaphore',
        mode: 'send',
        text: shortPhrase(rng, 9).split(' ')[0]!,
        limit: kind.limit,
        scene: 'rooftop',
      };
  }
}

/** Wraps a free step as a one-step message. */
export function freeMessage(kind: FreeKind, seed: string): Message {
  const step = freeStep(kind, createRng(seed));
  return {
    id: `free-${kind.machine}`,
    title: 'Free desk',
    story: '',
    reply: '',
    steps: [step],
    help: 'free',
    par: parFor(step),
  };
}

/* ------------------------------------------------------------------ the Daily Signal */

/** Emoji for each machine in the daily share line. */
export const MACHINE_EMOJI: Record<MachineId, string> = {
  telegraph: '📻',
  cipher: '🔐',
  punch: '🗂️',
  tape: '🎞️',
  printer: '🖨️',
  semaphore: '🚩',
};

/** Reads one fragment of the daily phrase at a machine, at a middling difficulty. */
function carry(machine: MachineId, text: string, rng: Rng): Step {
  switch (machine) {
    case 'telegraph':
      return { machine, mode: 'read', text, wpm: 15, spacingWpm: 10 };
    case 'cipher': {
      let shift = rng.int(1, 25);
      for (let tries = 0; tries < 30 && foolsTheMachine(text, shift); tries++)
        shift = rng.int(1, 25);
      return { machine, mode: 'crack', text, shift };
    }
    case 'punch':
      return { machine, mode: 'read', text };
    case 'tape':
      return { machine, mode: 'read', text };
    case 'printer':
      return { machine, mode: 'read', text, width: 66 };
    case 'semaphore':
      return { machine, mode: 'read', text, hold: 2.4, scene: 'rooftop' };
  }
}

/** Splits a phrase into `parts` runs of whole words, as even as the words allow. */
export function splitPhrase(phrase: string, parts: number): string[] {
  const words = phrase.split(' ');
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < parts; i++) {
    const remaining = parts - i;
    const take = Math.max(1, Math.round((words.length - start) / remaining));
    out.push(words.slice(start, start + take).join(' '));
    start += take;
  }
  return out.filter((part) => part.length > 0);
}

/**
 * Today's message: a phrase of at least three words, split across three machines chosen by
 * the day's seed. The answer is the whole phrase, read in order.
 */
export function dailyMessage(seed: string): Message {
  const rng = createRng(seed);
  const phrase = rng.pick(PHRASES.filter((p) => p.split(' ').length >= 3));
  const parts = splitPhrase(phrase, 3);
  // Deal the machines so that whichever piece goes to the wheel is one the scope can read.
  let machines = rng.shuffle(MACHINES).slice(0, parts.length);
  for (let deal = 0; deal < 40; deal++) {
    const wheel = machines.indexOf('cipher');
    if (wheel < 0 || !foolsTheMachine(parts[wheel]!, 1)) break;
    machines = rng.shuffle(MACHINES).slice(0, parts.length);
  }
  const steps = parts.map((part, i) => carry(machines[i]!, part, rng.split(`step-${i}`)));
  return {
    id: 'daily',
    title: 'Daily Signal',
    story:
      'Today’s message comes in three pieces, each on a different machine. Read them in order.',
    reply: 'Logged for today.',
    steps,
    help: 'costs-star',
    par: steps.reduce((sum, step) => sum + parFor(step), 0),
  };
}

/** `Dits & Daws #42 · cracked in 2:47 · 📻🔐🗂️ · no hints` */
export function dailyShareLine(
  number: number,
  seconds: number,
  steps: readonly Step[],
  hints: boolean,
): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  const time = `${minutes}:${String(rest).padStart(2, '0')}`;
  const icons = steps.map((step) => MACHINE_EMOJI[step.machine]).join('');
  return `Dits & Daws #${number} · cracked in ${time} · ${icons} · ${hints ? 'with hints' : 'no hints'}`;
}

/** The keyword variant written out, for the board and for tests. */
export function cipherTextOf(step: Extract<Step, { machine: 'cipher' }>): string {
  return step.keyword ? keywordShift(step.text, step.keyword) : rotate(step.text, step.shift);
}
