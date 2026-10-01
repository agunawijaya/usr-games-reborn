# Baseline engine fixture

Frozen, byte-for-byte copies of `src/engine.js` and `src/galaxy.js` from
[`../../../../fancy-web/src/`](../../../../fancy-web/src/) at commit
`fbe3bb0` — the engine the procedural-web port started from.

**Do not edit these files.** They exist only so
[`../../baseline-regression.test.js`](../../baseline-regression.test.js)
can replay seeded games through the original engine and through this
port's engine (with every Captain's Override flag off) and prove the two
are identical step by step. The test also pins the SHA-256 of
`engine.js` here so an accidental edit fails the suite.
