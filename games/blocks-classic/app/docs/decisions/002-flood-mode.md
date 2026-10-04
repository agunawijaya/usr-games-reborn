# ADR 002 — Starting rubble and the rising flood (inherited from the fancy-web port)

## Status

Accepted (carried over from the owner's fancy-web port; summarised here in our own words).

## Context

The BSD original offers only an endless, empty-well Marathon. The fancy-web port added a second kind
of pressure: a starting stack the player can configure (height and hole density), and a Survival
mode where a row of that same stack rises from the bottom at a shortening interval as the level
climbs.

## Decision

Keep both mechanics, renamed to fit the quarry theme: a "starting rubble" stack (`rubbleHeight`,
`rubbleDensity` in the engine's config) and "the flood" (`mode: 'survival'`), where
`addRubbleRow()` shifts the well up by one row and fills the new bottom row with rubble, always
leaving at least one hole. If the active piece now overlaps rubble it is pushed upward; if there is
nowhere to push it to, the shift ends.

## Consequences

- Half the career's twelve shifts use a flood well; their contracts and the Daily Shift's
  weekend wells read `game.rubbleRowsSurvived` as their clear target (`src/run.mjs`,
  `hasReachedTarget`).
- Free Dig exposes the same two controls the fancy-web port's settings screen did, just re-skinned
  under the game menu instead of a separate start screen.
