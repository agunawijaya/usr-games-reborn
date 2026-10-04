import { contrastRatio, mixHex } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { PALETTES } from './look';

/** Lines are what the game is made of: each must reach 3:1 against every part of its ground. */
describe('line contrast', () => {
  it('holds by day, from the sunlit top of the pavement to its shaded foot', () => {
    const p = PALETTES.chalk;
    const grounds = [mixHex(p.ground[0], '#ffffff', 0.12), p.ground[0], p.ground[1]];
    for (const ink of [p.players[0].ink, p.players[1].ink, p.neutral.ink, p.lensEdge]) {
      for (const ground of grounds)
        expect(contrastRatio(ink, ground), `${ink} on ${ground}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('holds by night on the sign board', () => {
    const p = PALETTES.neon;
    for (const ink of [p.players[0].ink, p.players[1].ink, p.neutral.ink, p.lens, p.dot]) {
      for (const ground of [p.ground[0], p.ground[1], p.groundDetail]) {
        expect(contrastRatio(ink, ground), `${ink} on ${ground}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
