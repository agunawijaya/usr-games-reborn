import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateManifest } from '@usr-games/kit/manifest';
import { PACKAGES } from '../modes/packages';
import { MINDS } from './ai/minds';
import { playGame } from './autoplay';

/**
 * The three opponents in order, Beginner below Classic below Sharp, locked on small seeded
 * samples of short games so the suite stays quick. The full 2,000-game runs to 121 are in
 * NOTES.md (`pnpm --filter @usr-games/game-cribbage simulate`). The samples are seeded, so the
 * counts below are exact today; the tolerances leave room for small changes to the minds.
 */

describe('balance', () => {
  it('Classic beats Beginner most of the time', () => {
    let classic = 0;
    for (let i = 0; i < 200; i++) {
      const swap = i % 2 === 1;
      const game = playGame(
        { length: 61, counting: 'automatic' },
        `lockb:${i}`,
        swap ? [MINDS.beginner, MINDS.classic] : [MINDS.classic, MINDS.beginner],
      );
      if (game.state.winner === (swap ? 1 : 0)) classic++;
    }
    // 159 of 200 when written.
    expect(classic).toBeGreaterThanOrEqual(150);
  });

  it('Sharp comes out ahead of Classic over the same deals', () => {
    let sharp = 0;
    let margin = 0;
    for (let i = 0; i < 30; i++) {
      // Each deal twice, seats swapped, so the cards' luck mostly cancels.
      const first = playGame({ length: 61, counting: 'automatic' }, `lock:${i}`, [
        MINDS.sharp,
        MINDS.classic,
      ]);
      const second = playGame({ length: 61, counting: 'automatic' }, `lock:${i}`, [
        MINDS.classic,
        MINDS.sharp,
      ]);
      if (first.state.winner === 0) sharp++;
      if (second.state.winner === 1) sharp++;
      margin +=
        first.state.scores[0] -
        first.state.scores[1] +
        second.state.scores[1] -
        second.state.scores[0];
    }
    // 33 of 60 and +1.33 points a game when written.
    expect(sharp).toBeGreaterThanOrEqual(30);
    expect(margin / 60).toBeGreaterThan(0);
  });
});

describe('the manifest', () => {
  it('validates and lists the same packages as the game', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../../manifest.json', import.meta.url), 'utf8'),
    );
    const result = validateManifest(manifest);
    expect(result.ok ? [] : result.errors).toEqual([]);
    expect(manifest.packages.map((p: { id: string }) => p.id)).toEqual(PACKAGES.map((p) => p.id));
    expect(manifest.inspiredBy).toEqual({
      program: 'cribbage',
      originalTitle: 'cribbage',
      uiTitle: 'the Berkeley cribbage',
      year: 1980,
    });
  });
});
