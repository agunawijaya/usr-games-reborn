import { describe, expect, it } from 'vitest';
import { makeRules } from '../engine/rules';
import { taxableWorth } from '../engine/state';
import type { SeatSetup } from '../engine/types';
import type { Director } from './director';
import { PlaySession, type Stagehand } from './session';
import { hudView } from './view';

const STAGE: Stagehand = {
  play: async () => {},
  say: async () => {},
  wait: async () => {},
  refresh: () => {},
};

const SEATS: SeatSetup[] = [
  { name: 'You', kind: 'human', token: 'tugboat' },
  { name: 'Dex', kind: 'ai', token: 'kite', personality: 'dealmaker', difficulty: 'medium' },
];

/** The view reads only the director's caption and log. */
const QUIET_DIRECTOR = { banner: null, log: [] } as unknown as Director;

function settled(): Promise<PlaySession> {
  return new Promise((resolve) => {
    const session = new PlaySession(
      {
        board: 'harbour',
        seed: 'tax',
        rules: makeRules('berkeley', 'quick'),
        seats: SEATS,
        onSettle: (s) => resolve(s),
      },
      STAGE,
    );
    session.start();
  });
}

describe('the action bar', () => {
  it('offers both sides of the Berkeley income tax, and either settles it', async () => {
    const session = await settled();
    session.state.phase = { kind: 'taxChoice' };
    const view = hudView(
      session,
      QUIET_DIRECTOR,
      { selected: null, panel: 'none', coach: false },
      { label: 'Quick game' },
    );
    expect(view.actions.map((a) => [a.id, a.enabled, a.primary ?? false])).toEqual([
      ['tax-flat', true, true],
      ['tax-tenth', true, false],
    ]);

    const before = session.state.seats[0]!.coins;
    const tenth = Math.floor(taxableWorth(session.state, 0) / 10);
    expect(await session.act({ type: 'taxChoice', choice: 'tenth' })).toBeNull();
    expect(session.state.seats[0]!.coins).toBe(before - tenth);
  });
});
