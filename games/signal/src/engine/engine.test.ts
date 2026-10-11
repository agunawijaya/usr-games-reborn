import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { hasGlyph } from '../codecs/banner';
import { canPunch, punchCard, readCard } from '../codecs/bcd';
import { bestRotation, keywordShift, rotate } from '../codecs/caesar';
import { characterFor, morseFor } from '../codecs/morse';
import { punchTape, readTape } from '../codecs/ppt';
import { canSend, decodeSteps, encodeSemaphore } from '../codecs/semaphore';
import { CHAPTERS } from './chapters';
import {
  cipherTextOf,
  dailyMessage,
  dailyShareLine,
  foolsTheMachine,
  freeStep,
  readingTurn,
  splitPhrase,
  trickCipher,
} from './generate';
import { knownAt, lessonText, MORSE_LADDER, SEMAPHORE_LADDER, wordsFrom } from './ladder';
import { normalize, type Step } from './message';
import { PHRASES } from './phrases';
import {
  completeStep,
  revealStep,
  startRun,
  starsFor,
  submitAnswer,
  useHelp,
  useHint,
} from './run';

/** Solves a step with the codecs alone, as a perfect player would, and returns the reading. */
function solve(step: Step): string {
  switch (step.machine) {
    case 'telegraph':
      return normalize(
        step.text
          .split(' ')
          .map((word) => [...word].map((char) => characterFor(morseFor(char)!)).join(''))
          .join(' '),
      );
    case 'cipher': {
      const secret = cipherTextOf(step);
      return normalize(
        step.keyword
          ? keywordShift(secret, step.keyword, -1)
          : rotate(secret, readingTurn(step.shift)),
      );
    }
    case 'punch':
      return normalize(readCard(punchCard(step.text).map((column) => column.holes)));
    case 'tape':
      return normalize(readTape(punchTape(step.text)));
    case 'printer':
      return normalize(step.text);
    case 'semaphore':
      return normalize(decodeSteps(encodeSemaphore(step.text)));
  }
}

function representable(step: Step): boolean {
  const chars = [...step.text].filter((char) => char !== ' ');
  switch (step.machine) {
    case 'telegraph':
      return chars.every((char) => morseFor(char) !== null);
    case 'cipher':
      return /^[A-Z ,.!?']+$/.test(step.text);
    case 'punch':
      return chars.every(canPunch) && step.text.length <= 48;
    case 'tape':
      return chars.every((char) => char.charCodeAt(0) < 128);
    case 'printer':
      return [...step.text].every(hasGlyph);
    case 'semaphore':
      return chars.every(canSend);
  }
}

describe('the Signal Room', () => {
  it('has seven chapters of six messages', () => {
    expect(CHAPTERS).toHaveLength(7);
    for (const chapter of CHAPTERS) expect(chapter.messages).toHaveLength(6);
    const ids = CHAPTERS.flatMap((chapter) => chapter.messages.map((message) => message.id));
    expect(new Set(ids).size).toBe(42);
  });

  it('can solve every step of every message with the codecs alone', () => {
    for (const chapter of CHAPTERS) {
      for (const message of chapter.messages) {
        for (const step of message.steps) {
          expect(representable(step), `${message.id} ${step.text}`).toBe(true);
          expect(solve(step), message.id).toBe(normalize(step.text));
        }
      }
    }
  });

  it('teaches chapter one two letters at a time and only uses letters already heard', () => {
    let known = '';
    for (const message of CHAPTERS[0]!.messages) {
      const step = message.steps[0]!;
      if (step.machine === 'telegraph' && step.mode === 'read') known += step.newLetters ?? '';
      for (const char of step.text.replace(/\s/g, ''))
        expect(known, `${message.id} uses ${char}`).toContain(char);
    }
    expect(known).toBe(knownAt(MORSE_LADDER, 5));
  });

  it('lets the scope crack chapter two, except the message meant to fool it', () => {
    const [m1, m2, m3, m4, m5] = CHAPTERS[1]!.messages;
    for (const message of [m1!, m2!, m3!, m4!]) {
      const step = message.steps[0]! as Extract<Step, { machine: 'cipher' }>;
      expect(foolsTheMachine(step.text, step.shift), message.id).toBe(false);
    }
    const trick = m5!.steps[0]! as Extract<Step, { machine: 'cipher' }>;
    expect(foolsTheMachine(trick.text, trick.shift)).toBe(true);
  });

  it('keeps the chained hints honest', () => {
    const chain = CHAPTERS[6]!.messages;
    const turn = chain[0]!.steps[1]! as Extract<Step, { machine: 'cipher' }>;
    expect(chain[0]!.steps[0]!.text).toBe('TURN SEVEN');
    expect(readingTurn(turn.shift)).toBe(7);
    expect(chain[1]!.steps[0]!.text).toContain(chain[1]!.steps[1]!.text);
    const squint = chain[2]!.steps[1]! as Extract<Step, { machine: 'printer' }>;
    expect(squint.width).toBeLessThanOrEqual(33);
    const rot = chain[3]!.steps[1]! as Extract<Step, { machine: 'cipher' }>;
    expect(chain[3]!.steps[0]!.text).toBe(`ROT ${readingTurn(rot.shift)}`);
    expect(chain[4]!.steps.map((step) => step.machine)).toEqual(['punch', 'telegraph', 'tape']);
    expect(chain[5]!.steps.map((step) => step.text).join(' ')).toBe(
      'WELCOME OPERATOR THE DESK IS YOURS',
    );
  });

  it('gives every message a reachable par', () => {
    for (const chapter of CHAPTERS) {
      for (const message of chapter.messages) {
        expect(message.par).toBeGreaterThan(10);
        expect(message.par).toBeLessThan(400);
      }
    }
  });
});

describe('ladders', () => {
  it('cover the alphabet, the digits and the punctuation', () => {
    expect(
      knownAt(MORSE_LADDER, 99)
        .replace(/[^A-Z]/g, '')
        .split('')
        .sort()
        .join(''),
    ).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(knownAt(SEMAPHORE_LADDER, 99)).toContain('0');
  });

  it('make practice from the letters known so far', () => {
    for (let lesson = 0; lesson < MORSE_LADDER.length; lesson++) {
      const known = knownAt(MORSE_LADDER, lesson);
      const text = lessonText(MORSE_LADDER, lesson, createRng(`lesson-${lesson}`));
      for (const char of text.replace(/\s/g, '')) expect(known).toContain(char);
    }
    expect(wordsFrom('ETAN')).toContain('TEA');
  });
});

describe('generated messages', () => {
  it('always fools the machine in a trick round', () => {
    for (let i = 0; i < 40; i++) {
      const step = trickCipher(createRng(`trick-${i}`)) as Extract<Step, { machine: 'cipher' }>;
      expect(foolsTheMachine(step.text, step.shift)).toBe(true);
    }
  });

  it('makes free steps every machine can carry', () => {
    const rng = createRng('free');
    const kinds = [
      { machine: 'telegraph', mode: 'learn', lesson: 3, wpm: 15, spacingWpm: 8 },
      { machine: 'telegraph', mode: 'read', wpm: 15, spacingWpm: 10 },
      { machine: 'telegraph', mode: 'send', wpm: 12 },
      { machine: 'cipher', mode: 'crack' },
      { machine: 'cipher', mode: 'keyword' },
      { machine: 'punch', mode: 'read' },
      { machine: 'punch', mode: 'punch' },
      { machine: 'tape', mode: 'read' },
      { machine: 'tape', mode: 'punch' },
      { machine: 'printer', mode: 'read', width: 44 },
      { machine: 'semaphore', mode: 'learn', lesson: 2 },
      { machine: 'semaphore', mode: 'read', level: 3 },
      { machine: 'semaphore', mode: 'send', limit: 5 },
    ] as const;
    for (let round = 0; round < 20; round++) {
      for (const kind of kinds) {
        const step = freeStep(kind, rng);
        expect(representable(step), `${kind.machine} ${step.text}`).toBe(true);
      }
    }
  });

  it('cracks free ciphers with the scope', () => {
    const rng = createRng('scope');
    for (let i = 0; i < 40; i++) {
      const step = freeStep({ machine: 'cipher', mode: 'crack' }, rng) as Extract<
        Step,
        { machine: 'cipher' }
      >;
      expect(rotate(cipherTextOf(step), bestRotation(cipherTextOf(step)))).toBe(step.text);
    }
  });

  it('builds the same Daily Signal from the same seed, across three machines', () => {
    const a = dailyMessage('signal:daily:2026-10-11');
    const b = dailyMessage('signal:daily:2026-10-11');
    expect(a).toEqual(b);
    expect(new Set(a.steps.map((step) => step.machine)).size).toBe(a.steps.length);
    for (let day = 1; day <= 60; day++) {
      const daily = dailyMessage(`signal:daily:2026-11-${day}`);
      const phrase = daily.steps.map((step) => step.text).join(' ');
      expect(PHRASES).toContain(phrase);
      for (const step of daily.steps) expect(solve(step)).toBe(normalize(step.text));
    }
  });

  it('writes the share line the way the prompt asks', () => {
    const daily = dailyMessage('x');
    expect(dailyShareLine(42, 167, daily.steps, false)).toMatch(
      /^Dits & Daws #42 · cracked in 2:47 · .+ · no hints$/,
    );
  });

  it('splits phrases on whole words', () => {
    expect(splitPhrase('MEET AT THE CLOCK', 3)).toEqual(['MEET', 'AT THE', 'CLOCK']);
  });
});

describe('a run and its stars', () => {
  const message = CHAPTERS[0]!.messages[2]!;

  it('earns all three stars for a quick, clean, unaided answer', () => {
    let run = startRun(message, 10);
    run = submitAnswer(run, 'it is not a test', 40).run;
    expect(starsFor(run)).toEqual({ accuracy: true, speed: true, unaided: true, count: 3 });
  });

  it('counts wrong tries, hints, paid help and the clock', () => {
    let run = startRun(message, 0);
    run = submitAnswer(run, 'IT IS NOT A TOAST', 5).run;
    run = useHint(run);
    run = useHelp(run);
    run = submitAnswer(run, 'IT IS NOT A TEST', message.par + 5).run;
    expect(starsFor(run).count).toBe(0);
  });

  it('gives no stars for a revealed answer but still finishes', () => {
    const run = revealStep(startRun(message, 0), 3);
    expect(run.seconds).toBe(3);
    expect(starsFor(run).count).toBe(0);
  });

  it('walks a chain step by step', () => {
    const chain = CHAPTERS[6]!.messages[4]!;
    let run = startRun(chain, 0);
    run = submitAnswer(run, 'listen', 5).run;
    run = completeStep(run, { wrong: 0, late: 0 }, 9);
    expect(run.seconds).toBeNull();
    run = submitAnswer(run, 'last one', 20).run;
    expect(run.seconds).toBe(20);
  });
});
