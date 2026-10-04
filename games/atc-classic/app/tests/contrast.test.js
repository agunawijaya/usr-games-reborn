// The radar's lettering reaches AA contrast against the screen behind it.
// Run: node --test tests/contrast.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { contrastRatio, RADAR_BACKGROUND, RADAR_LETTERING } from '../src/palette.js';

test('every colour the radar writes in reaches 4.5:1 on the radar', () => {
  for (const [what, colour] of Object.entries(RADAR_LETTERING)) {
    const ratio = contrastRatio(colour, RADAR_BACKGROUND);
    assert.ok(ratio >= 4.5, `${what} (${colour}) is ${ratio.toFixed(2)}:1`);
  }
});

test('the contrast arithmetic matches known pairs', () => {
  assert.equal(contrastRatio('#ffffff', '#000000').toFixed(1), '21.0');
  assert.equal(contrastRatio('#000000', '#000000').toFixed(1), '1.0');
  assert.equal(contrastRatio('rgba(255, 255, 255, 0)', '#000000').toFixed(1), '1.0', 'transparent text has no contrast');
});
