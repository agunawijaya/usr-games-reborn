import type { Outcome, StyleId } from '@usr-games/kit';

/**
 * How the player speaks. Console Home and Holo Collection use plain words; the Machine Room
 * keeps a light Unix flavour in captions. The navigation labels themselves are the same in every
 * style, so a player who switches styles never has to relearn where "Back to the Hall" is.
 */

export type Wording = 'plain' | 'unix';

export function wordingFor(style: StyleId): Wording {
  return style === 'machine-room' ? 'unix' : 'plain';
}

export const LABELS = {
  back: '← Back to the Hall',
  gameMenu: 'Game menu',
  resume: 'Resume',
  howToPlay: 'How to play',
  settings: 'Settings',
  playAgain: 'Play again',
  pause: 'Pause',
} as const;

const HEADLINES: Record<Outcome, string> = {
  win: 'You won',
  loss: 'Round over',
  draw: 'A draw',
  complete: 'Done',
  quit: 'Round over',
};

export function outcomeHeadline(outcome: Outcome): string {
  return HEADLINES[outcome];
}

/** The Machine Room's caption under the headline: the process's exit status. */
export function exitStatus(outcome: Outcome): string {
  const code = { win: 0, complete: 0, draw: 2, loss: 1, quit: 130 }[outcome];
  return `[process exited with status ${code}]`;
}
