# 0001 — A season of orchards, each ending in a burrow

- **Status:** Accepted (the direction by the owner, 2026-10-03; the numbers tuned in the session)
- **Date:** 2026-10-03

## Context

The owner asked for the earlier fancy-web port of `worm` to join the Hall with a gamification of
its own, and had said of its sibling _Talon’s Shadow_ that every game must have an ending. As
built, a crawl ended only in a crash, as worm always did: there was no objective beyond the score,
and the port’s Wild mode creatures were switched on and off by hand. Asked to choose, the owner
picked the title _Orchard Crawl_ and a season of orchards following the port’s eight looks, each
introducing one creature or fence, with a harvest that ends the level, three stars, an ending after
Midnight, a Daily Orchard, an almanac, records and twelve achievements; the port’s Pure (1980) and
Wild play were to stay as they were.

## Decision

- **Eight orchards from the eight looks**, crawled in order, each a set of the port’s own settings
  and bringing in one new thing: Neon Grid (one apple at a time, the 1980 rule), Savanna (the full
  orchard of ten apples, and the frog), River (fences), Jungle (the thief bird), Desert (wasps),
  Aztec (a rival worm), Origami (the gardener), Midnight (all of them). `src/orchards.mjs`.
- **A harvest and a burrow.** An orchard asks for a number of apples (10 to 14), not points: small
  numbers keep the worm short, big ones score, and every apple counts the same towards the
  harvest. Once it is eaten a burrow opens on a free cell 6 to 14 steps from the head that the worm
  can reach (`src/burrow.mjs`); crawling in ends the crawl, and the worm slides in out of reach of
  everything. Staying out for points is allowed.
- **Three stars:** home, the orchard’s points, and a feat about what the orchard brings in. Stars
  are earned only on a crawl that comes home, and kept.
- **The season ends** when Midnight is cleared; its closing page stays to be read again.
- **The creatures come sooner in the season** (`SEASON_TIMING`): a crawl lasts a minute or so, and
  at the port’s timings a frog first came after half a minute and the gardener after most of one,
  so a crawl home would never meet them. The free orchard keeps the port’s timings.
- **The page runs on its own clock** and draws from three seeded streams, so the Hall’s pause holds
  everything still and a Daily Orchard deals everyone the same apples.
- **The free orchard** keeps the port’s Pure and Wild play with all its choices; it has no harvest,
  a crash ends it, and past 100 points the Hall counts it as a win (ADR 0011 of the collection).

## Consequences

- Crawls are short (a median of half a minute to a minute for a careful bot), and a session is a
  few of them; the manifest says 2–12 minutes.
- The worm speeds up as it grows, as the port does, so most crawls end at the port’s fastest pace;
  the Steady pace setting is there for players who want the Classic one throughout.
- The numbers (harvests, points, timings) were tuned against a bot (NOTES.md) and are the
  session’s, to be revisited after the owner plays.
