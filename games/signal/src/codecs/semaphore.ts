/**
 * Flag semaphore, the owner's addition: no BSD original sent it. The chart follows the 1911
 * Boy Scouts Handbook and the 1913 Admiralty Handbook of Signalling, checked against the US Navy's
 * Signalman course (1996) and the Canadian navy's manual; see docs/NOTES.md for the references.
 *
 * Directions are as the reader sees the signaller, facing them: 0 down, 1 low-left, 2 left,
 * 3 high-left, 4 up, 5 high-right, 6 right, 7 low-right. `near` is the flag on the reader's left
 * (the signaller's right hand), `far` the one on the reader's right (the left hand).
 */
export type Direction = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Pose {
  near: Direction;
  far: Direction;
}

export const DIRECTION_NAMES = [
  'down',
  'low left',
  'left',
  'high left',
  'up',
  'high right',
  'right',
  'low right',
] as const;

/** On-screen angle of a direction (0 points right, π/2 down), for drawing arms. */
export function directionAngle(direction: number): number {
  return Math.PI / 2 + (direction * Math.PI) / 4;
}

const pose = (near: Direction, far: Direction): Pose => ({ near, far });

/** The letters, hand by hand as the 1911 handbook gives them. */
export const LETTER_POSES: Readonly<Record<string, Pose>> = {
  A: pose(1, 0),
  B: pose(2, 0),
  C: pose(3, 0),
  D: pose(4, 0),
  E: pose(0, 5),
  F: pose(0, 6),
  G: pose(0, 7),
  H: pose(1, 2),
  I: pose(1, 3),
  J: pose(4, 6),
  K: pose(1, 4),
  L: pose(1, 5),
  M: pose(1, 6),
  N: pose(1, 7),
  O: pose(2, 3),
  P: pose(2, 4),
  Q: pose(2, 5),
  R: pose(2, 6),
  S: pose(2, 7),
  T: pose(3, 4),
  U: pose(3, 5),
  V: pose(4, 7),
  W: pose(6, 5),
  X: pose(7, 5),
  Y: pose(3, 6),
  Z: pose(6, 7),
};

/** "Numerals follow": after it, A–I stand for 1–9 and K for 0. */
export const NUMERALS_SIGN = pose(4, 5);
/** J doubles as "letters follow" after a run of numerals. */
export const LETTERS_SIGN = LETTER_POSES.J!;
/** Cancels the word or group just sent. */
export const ANNUL_SIGN = pose(3, 7);
/** Both flags down, crossed in front: the space between words, and the pause in a double letter. */
export const REST = pose(0, 0);
/** "Error" is E sent eight times or more. */
export const ERROR_REPEATS = 8;

const DIGIT_LETTERS = 'KABCDEFGHI';

/** The teaching circles of the 1911 handbook: each holds one hand still while the other moves. */
export const CIRCLES: readonly (readonly string[])[] = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  ['H', 'I', 'K', 'L', 'M', 'N'],
  ['O', 'P', 'Q', 'R', 'S'],
  ['T', 'U', 'Y'],
  ['J', 'V'],
  ['W', 'X', 'Z'],
];

/** A pose with its flags as a set: which hand holds which flag cannot be seen, only where. */
export function poseKey(p: Pose): string {
  return [p.near, p.far].sort((a, b) => a - b).join('-');
}

export function samePose(a: Pose, b: Pose): boolean {
  return poseKey(a) === poseKey(b);
}

/** The pose turned upside down, as the US Navy course pairs "opposite" letters. */
export function opposite(p: Pose): Pose {
  return { near: ((p.far + 4) % 8) as Direction, far: ((p.near + 4) % 8) as Direction };
}

/** What a pose reads as: a letter, a sign, or null. */
export function readPose(p: Pose): string | null {
  const key = poseKey(p);
  for (const [letter, letterPose] of Object.entries(LETTER_POSES)) {
    if (poseKey(letterPose) === key) return letter;
  }
  if (key === poseKey(NUMERALS_SIGN)) return '#';
  if (key === poseKey(ANNUL_SIGN)) return 'annul';
  if (key === poseKey(REST)) return ' ';
  return null;
}

/** One step a signaller makes: a pose and what it means. */
export interface SemaphoreStep {
  pose: Pose;
  /** The message character it carries, or a sign's name. */
  meaning: string;
  /** `rest` is a space between words; `pause` the brief drop inside a double letter. */
  kind: 'letter' | 'digit' | 'numerals' | 'letters' | 'rest' | 'pause';
}

/**
 * A message as the signaller sends it: rest between words and between the two halves of a
 * double letter, the numerals sign before digits and J before letters that follow them.
 * Characters semaphore cannot send are dropped.
 */
export function encodeSemaphore(text: string): SemaphoreStep[] {
  const steps: SemaphoreStep[] = [];
  let numerals = false;
  let previous: string | null = null;
  const rest = () => {
    if (steps.length > 0 && steps[steps.length - 1]!.kind !== 'rest') {
      steps.push({ pose: REST, meaning: ' ', kind: 'rest' });
    }
  };
  const pause = () => steps.push({ pose: REST, meaning: '', kind: 'pause' });
  for (const raw of text.toUpperCase()) {
    if (/\s/.test(raw)) {
      rest();
      previous = null;
      continue;
    }
    if (/[0-9]/.test(raw)) {
      if (!numerals) {
        steps.push({ pose: NUMERALS_SIGN, meaning: '#', kind: 'numerals' });
        numerals = true;
        previous = null;
      }
      const letter = DIGIT_LETTERS[Number(raw)]!;
      if (previous === letter) pause();
      steps.push({ pose: LETTER_POSES[letter]!, meaning: raw, kind: 'digit' });
      previous = letter;
      continue;
    }
    const letterPose = LETTER_POSES[raw];
    if (!letterPose) continue;
    if (numerals) {
      steps.push({ pose: LETTERS_SIGN, meaning: 'J', kind: 'letters' });
      numerals = false;
      previous = null;
    }
    if (previous === raw) pause();
    steps.push({ pose: letterPose, meaning: raw, kind: 'letter' });
    previous = raw;
  }
  return steps;
}

/**
 * Reads a sequence of poses back to text, following the numerals and letters signs. A rest
 * reads as a space, so the pause inside a double letter splits its word here; a reader on the
 * roof tells the two apart by how long the flags stay down.
 */
export function decodeSemaphore(poses: readonly Pose[]): string {
  let out = '';
  let numerals = false;
  for (const p of poses) {
    const meaning = readPose(p);
    if (meaning === null) out += '?';
    else if (meaning === ' ') {
      if (out.length > 0 && !out.endsWith(' ')) out += ' ';
    } else if (meaning === '#') numerals = true;
    else if (meaning === 'annul') out = out.replace(/\S*\s?$/, '');
    else if (numerals && meaning === 'J') numerals = false;
    else if (numerals && DIGIT_LETTERS.includes(meaning))
      out += String(DIGIT_LETTERS.indexOf(meaning));
    else out += meaning;
  }
  return out.trimEnd();
}

/** Reads steps back with their kinds known, so a double letter's pause stays inside its word. */
export function decodeSteps(steps: readonly SemaphoreStep[]): string {
  return steps
    .map((step) =>
      step.kind === 'letter' || step.kind === 'digit'
        ? step.meaning
        : step.kind === 'rest'
          ? ' '
          : '',
    )
    .join('')
    .trim();
}

/** Whether semaphore can carry a character: letters, digits and spaces. */
export function canSend(char: string): boolean {
  return /[A-Za-z0-9\s]/.test(char);
}

/* ------------------------------------------------------------------ judging */

export type Verdict = 'right' | 'late' | 'wrong';

/**
 * Judges one sent letter: the right pose inside the time is right, the right pose after it is
 * late, anything else is wrong.
 */
export function judgeSend(target: Pose, sent: Pose, seconds: number, limit: number): Verdict {
  if (!samePose(target, sent)) return 'wrong';
  return seconds <= limit ? 'right' : 'late';
}

/**
 * Seconds a reader gets per letter at each step of the ladder: from a patient scout's pace
 * (the 1911 First Class test asked for 16 letters a minute) up to a navy signalman's 15 words a
 * minute, about 0.8 seconds a letter.
 */
export function holdSeconds(level: number): number {
  const ladder = [3.6, 3, 2.4, 1.9, 1.5, 1.2, 1, 0.8];
  return ladder[Math.max(0, Math.min(ladder.length - 1, level))]!;
}
