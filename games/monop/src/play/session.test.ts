import { describe, expect, it } from 'vitest';
import { makeRules } from '../engine/rules';
import type { SeatSetup } from '../engine/types';
import { PlaySession, type SessionOptions, type Stagehand } from './session';

/** A stage that shows nothing and takes no time. */
const STAGE: Stagehand = {
  play: async () => {},
  say: async () => {},
  wait: async () => {},
  refresh: () => {},
};

const SEATS: SeatSetup[] = [
  { name: 'You', kind: 'human', token: 'tugboat' },
  { name: 'Dex', kind: 'ai', token: 'kite', personality: 'dealmaker', difficulty: 'medium' },
  { name: 'Marlowe', kind: 'ai', token: 'gull', personality: 'builder', difficulty: 'medium' },
];

/** Starts a session and resolves when it first waits for the person. */
function settled(options: SessionOptions): Promise<PlaySession> {
  return new Promise((resolve) => {
    const session = new PlaySession({ ...options, onSettle: (s) => resolve(s) }, STAGE);
    session.start();
  });
}

/** Plays the person's turns plainly: buy what can be bought, otherwise roll or end. */
async function playTurns(session: PlaySession, moves: number): Promise<void> {
  for (let i = 0; i < moves && !session.over; i++) {
    const phase = session.state.phase;
    const action =
      phase.kind === 'buy'
        ? ({ type: 'buy' } as const)
        : phase.kind === 'after' && !phase.rollAgain
          ? ({ type: 'endTurn' } as const)
          : ({ type: 'roll' } as const);
    const reason = await session.act(action);
    if (reason) await session.act({ type: phase.kind === 'buy' ? 'decline' : 'endTurn' });
  }
}

describe('a game in progress', () => {
  const options: SessionOptions = {
    board: 'harbour',
    seed: 'resume',
    rules: makeRules('standard', 'quick'),
    seats: SEATS,
  };

  it('saves as plain data and picks up exactly where it stopped', async () => {
    const first = await settled(options);
    await playTurns(first, 12);
    const saved = first.saved();
    expect(JSON.parse(JSON.stringify(saved))).toEqual(saved);
    const resumed = await settled({ ...options, resume: saved });
    expect(resumed.state).toEqual(first.state);
    expect(resumed.ledger).toEqual(first.ledger);
    expect(resumed.chronicle.worth.length).toBe(first.chronicle.worth.length);
    // The saved copy is the session's own: playing on does not change what was saved.
    await playTurns(resumed, 6);
    expect(resumed.state.turns).toBeGreaterThan(saved.state.turns);
    expect(saved.state.turns).toBe(first.state.turns);
  });
});
