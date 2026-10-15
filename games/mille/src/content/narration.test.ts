import { describe, expect, it } from 'vitest';
import type { HandEvent } from '../engine/hand';
import { narrate } from './narration';

const names = ['You', 'Your rival'];
const line = (event: HandEvent) =>
  narrate(
    event,
    (seat) => names[seat]!,
    (side) => (side === 0 ? 'you' : 'your rival'),
    () => 'm25',
  );

describe('the line of play', () => {
  it('speaks to the player and about the rival with verbs that agree', () => {
    const drive = { type: 'play', kind: 'm100', side: 0, coup: false } as const;
    expect(line({ ...drive, seat: 0 } as HandEvent)).toBe('You drive 100 miles.');
    expect(line({ ...drive, seat: 1, side: 1 } as HandEvent)).toBe('Your rival drives 100 miles.');
    const coup = { type: 'play', kind: 'runFlats', side: 0, coup: true, seat: 0 } as const;
    expect(line(coup as HandEvent)).toBe('Coup fourré! You parry with Run-Flat Tyres: +300.');
  });
});
