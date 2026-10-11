# ADR 0002 — Messages, judges and generators instead of an opponent

- Status: accepted
- Date: 2026-10-12

## Context

Dits & Daws has no computer opponent. Its challenge is reading and sending: a campaign of 42
written messages, free play at every machine, a Daily Signal, and codes friends send each
other. Every message must be solvable, every judge fair, and the whole thing deterministic for
tests and for the daily.

## Decision

- **Messages are data** (`src/engine/message.ts`, `chapters.ts`): a list of steps, each naming a
  machine, a mode and the text, plus the knobs that machine needs (speeds, turns, widths, hold
  times). The campaign's 42 messages are written by hand; free play and the Daily Signal are
  generated from our own phrase bank with the kit's seeded RNG (`generate.ts`).
- **Solvability is proved by tests** (`engine.test.ts`): every step of every chapter, every
  generated free step and sixty days of Daily Signals are solved by the codecs alone, as a
  perfect player would. Chained messages are checked link by link (the morse says the turn the
  wheel needs, the flags give the rotation, the tape names the printer's width).
- **The cipher's "beat the machine" messages are found, not hoped for**: the old codebreaker's
  verdict depends on the text, not on the shift (a text's 26 turns score the same set whatever
  the sender did), so trick messages are drawn from short, rare-letter phrases and kept only if
  the scope's guess is wrong; ordinary ciphers are kept only if it is right.
- **Judges are small and explicit**: typed answers compare letters, digits and single spaces
  only (case and punctuation never cost a star); the key reader learns the operator's own unit
  and splits dits from daws at √3 units; the flag judge compares the two directions as a set, so
  either hand may cross; a letter is right inside its time, late inside twice its time, and
  wrong after that.
- **Stars are honest and visible before play**: every letter right, inside the par time
  (computed from the machine's own playing time plus thinking time per character), and without
  hints or the charts where they cost a star.

## Consequences

- No simulation of an opponent is needed; the balance work is the par times and the ladders,
  checked in tests and by playing every message through the browser suite.
- A new message only needs a step list; the tests reject one the codecs cannot carry or solve.
