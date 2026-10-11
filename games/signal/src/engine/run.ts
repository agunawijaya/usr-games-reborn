import { type Message, normalize, sameAnswer } from './message';

/**
 * One go at a message, step by step: what was tried, how long it took, what help was asked
 * for, and the three stars at the end. Pure: the clock is passed in.
 */
export interface MessageRun {
  message: Message;
  step: number;
  /** Seconds on the game clock when the run began. */
  startedAt: number;
  /** Seconds taken, set when the run ends. */
  seconds: number | null;
  wrongTries: number;
  /** Letters revealed by a hint, or late letters in a sending step. */
  slips: number;
  hints: number;
  /** Help that costs the third star (charts, the scope) was used. */
  helped: boolean;
  revealed: boolean;
  answers: string[];
}

export function startRun(message: Message, now: number): MessageRun {
  return {
    message,
    step: 0,
    startedAt: now,
    seconds: null,
    wrongTries: 0,
    slips: 0,
    hints: 0,
    helped: false,
    revealed: false,
    answers: [],
  };
}

export function currentStep(run: MessageRun) {
  return run.message.steps[run.step]!;
}

export function isFinished(run: MessageRun): boolean {
  return run.seconds !== null;
}

/** Moves on after a step, finishing the run after the last one. */
function advance(run: MessageRun, answer: string, now: number): MessageRun {
  const answers = [...run.answers, normalize(answer)];
  const last = run.step >= run.message.steps.length - 1;
  return {
    ...run,
    answers,
    step: last ? run.step : run.step + 1,
    seconds: last ? Math.max(0, now - run.startedAt) : null,
  };
}

/** A typed answer: right moves on, wrong is counted and changes nothing else. */
export function submitAnswer(
  run: MessageRun,
  answer: string,
  now: number,
): { run: MessageRun; right: boolean } {
  if (isFinished(run)) return { run, right: false };
  if (sameAnswer(answer, currentStep(run).text))
    return { run: advance(run, answer, now), right: true };
  return { run: { ...run, wrongTries: run.wrongTries + 1 }, right: false };
}

/**
 * A step the machine judges itself (keying, flags, punching, turning the wheel): it reports
 * how many letters went wrong and how many were late.
 */
export function completeStep(
  run: MessageRun,
  outcome: { wrong: number; late: number },
  now: number,
): MessageRun {
  if (isFinished(run)) return run;
  const next = advance(run, currentStep(run).text, now);
  return { ...next, wrongTries: next.wrongTries + outcome.wrong, slips: next.slips + outcome.late };
}

export function useHint(run: MessageRun): MessageRun {
  return { ...run, hints: run.hints + 1 };
}

/** Records help that costs the third star; free help is not recorded. */
export function useHelp(run: MessageRun): MessageRun {
  return run.message.help === 'costs-star' ? { ...run, helped: true } : run;
}

/** Gives up on the current step: the answer is shown and the step counts as done. */
export function revealStep(run: MessageRun, now: number): MessageRun {
  if (isFinished(run)) return run;
  return { ...advance(run, currentStep(run).text, now), revealed: true };
}

export interface Stars {
  accuracy: boolean;
  speed: boolean;
  unaided: boolean;
  count: number;
}

export function starsFor(run: MessageRun): Stars {
  const accuracy = !run.revealed && run.wrongTries === 0;
  const speed =
    !run.revealed && run.slips === 0 && run.seconds !== null && run.seconds <= run.message.par;
  const unaided = !run.revealed && run.hints === 0 && !run.helped;
  return { accuracy, speed, unaided, count: [accuracy, speed, unaided].filter(Boolean).length };
}

/** "2:47" */
export function clockText(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
