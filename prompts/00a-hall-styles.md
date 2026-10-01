# Prompt 00a — Addendum: two more Hall styles (Console Home and Holo Collection)

> Run in the SAME Claude Code session that is paused at the prompt 00 hero-frame checkpoint (or a new
> session in `E:\Projects\usr-games-reborn` if that one was closed). Runs ALONE.
> Recommended: Claude Opus 5.5, effort xhigh. **Owner checkpoint** after the new hero frames (§5).

## 0. What the owner decided
1. The 18 hero frames of prompt 00 are **approved as they are**. That look — the Unix machine room
   with its three palettes (Phosphor, Manual Page, Sunset Lab) — stays exactly as designed. From now
   on it is one Hall **style** called **Machine Room**.
2. The Hall gets **two more styles**, selectable by the player like the palettes in the original
   brief: **Console Home** and **Holo Collection**. The player picks a style on first visit and can
   change it any time in Settings. All three styles run on the same data layer (catalog, progression,
   settings) — prompt 00 already separates data from renderers; extend that, do not fork it.
3. Why: the owner expects most Gen-Z and Gen-Alpha players to skip a terminal-looking page. The two
   new styles speak their language: big living art, bold type, plain words, collectible feel.
   Machine Room remains for players who love the Unix flavour.

## 1. Read first
`CLAUDE.md`, the builder skill, prompt 00 (you ran it), this addendum. In your first message: confirm
that Stage 1 is complete, that the Machine Room frames stay untouched, and list what you will change in
the Hall architecture to host three styles.

## 2. Styles, palettes and appearance — the model
| Style | Palettes | Appearance |
|---|---|---|
| Machine Room | Phosphor · Manual Page · Sunset Lab (as built) | light / dark / system |
| Console Home | one signature palette (below) + level-unlocked accent skins | light / dark / system |
| Holo Collection | one signature palette (below) + level-unlocked foil finishes | light / dark / system |

- Settings: Style → (palette if the style has several) → Appearance. Switching is instant, animated,
  and remembered.
- **First visit:** after the login step, show the three styles as three large live previews, each
  rendering the real Home in miniature. **Console Home is pre-selected** (the most familiar for new
  players); the player can pick any.
- Machine Room keeps its Unix wording. Console Home and Holo Collection use **plain words only**:
  "Today's pick", "Weekly quests", "Streak", "Level", "Achievements", "Play". No PIDs, no cron
  expressions, no load average, no shell prompts in these two styles.
- Ranks stay (`guest → user → staff → wheel → root`) but in the two new styles they appear as a
  **level badge**: a large level number plus the rank name as a small tag (for example "Level 12 ·
  staff"). A one-line tooltip explains the Unix joke.

## 3. Console Home
The feel of a modern console home screen, designed for a desktop browser.
- **Hero stage:** the selected game fills the top ~60 % of the screen as **living key art** — its own
  code-drawn scene running silently (from the game's `demo`/poster, §4) with a soft vignette. Over it:
  the game's title in a big bold display face, tagline, level-appropriate call to action ("Play",
  "Continue", "Daily #31"), best score, and the achievement progress for that game.
- **Rail:** below the hero, one horizontal row of large tiles (about 16:9, 280–320 px wide at 1920);
  arrow keys, mouse wheel and hover move the selection; the hero cross-fades to the new game within
  300 ms. Category chips above the rail (All, Arcade, Strategy, Board, Cards, Words, Numbers, Stories,
  Toys).
- **Top bar:** level badge with XP bar, streak flame with the week's days, weekly quests button (opens
  a side sheet with the three quests in plain words), style/appearance switch, settings.
- **Today strip** folded into the hero when "Today's pick" is selected; the fortune line becomes a
  small "Did you know?" line about computing history.
- **Game detail:** pressing Enter or clicking the hero's "More" opens a full-screen detail page: big
  art, short description, how to play in three bullets, achievements as a row of cards, the history
  of the original in two sentences, related games.
- **Coming-soon games** show a procedural poster (the game's emblem, accent colour and a slow
  animated pattern) with "Coming soon"; they are not launchable.
- Palette — Day: bright warm white, deep ink type, each game's accent colour bleeding softly into the
  UI around the hero. Night: near-black blue, the same accents glowing, never neon-on-black for body
  text (AA).
- Accent skins unlocked by rank (e.g. aurora, sunset, citrus, mint) tint the chrome only.

## 4. Holo Collection
Games and achievements as **collectible holographic cards**.
- **Home:** a tidy grid of large portrait cards (about 5:7, 220–260 px wide at 1920) on a soft
  surface, grouped by category with bold headings. Each card has: the game's poster art, title,
  tagline, a rarity-style frame colour by category, player best and achievement count ("7 / 12").
- **The holo effect (signature):** on hover or keyboard focus a card lifts and **tilts toward the
  pointer** (max 12°), with a moving specular highlight and a foil pattern (rainbow sheen, sparkles
  or etched lines — different per category) drawn in code (CSS/WebGL shader, zero raster). Cards the
  player has mastered (all achievements) get a stronger "gold foil" finish. Reduced motion: no tilt,
  a static sheen; keyboard focus still visible.
- **Today's pick** is a single oversized card at the top, slowly breathing, with the daily number.
- **Profile = the album:** every achievement across the collection is a card slot; earned ones are
  full foil cards, unearned ones are soft silhouettes with the hint text. Sort by game or by rarity.
  Level badge, streak and weekly quests sit in a header strip above the album.
- **Game detail:** the card flips (a short 3D flip, 400 ms; reduced motion: cross-fade) to reveal the
  back: description, how to play in three bullets, achievements, history, related games, "Play".
- Palette — Day: pastel paper (lilac, mint, peach) with crisp dark type, playful rounded display
  face. Night: deep plum/indigo table with the foil catching light. Foil finishes unlocked by rank
  (prism, galaxy, gold, chrome) change the sheen only.

## 5. Game art hook (small contract addition)
Both new styles need real game art, not icons.
- Add an optional `poster(canvas, { seed, appearance, size, animate })` to the native game contract:
  draws a key-art frame (animated when `animate` is true) from the game's own renderer. Fall back to
  `demo(seed)` when a game has no poster, and to the procedural emblem poster for coming-soon games.
- Hosted games (adopted in prompt 01) provide art through the bridge: a `poster` message with a
  snapshot the game renders itself, or a build-time still frame generated from a live render.
  Document this in the bridge README so prompt 01 can follow it.
- Performance: only the Console Home hero runs animated art at full size; rail tiles and cards use
  frozen frames rendered once and cached, animating only the focused one. Keep Hall first load under
  250 KB JS gzipped per style (styles load lazily; the chosen style loads first).

## 6. Hero frames — OWNER CHECKPOINT
Build live scenes (not mockups) at 1920×1080 into `docs/media/hall/hero/`:
- Console Home: Home with a selected game in the hero; the game detail page — each in Day and Night.
- Holo Collection: Home with one card tilted under the pointer; the profile album — each in Day and
  Night.
- The first-visit style picker in Day and Night.
That is 10 frames. Use placeholder posters that look like real key art (draw them in code for 3–4 of
the planned games; they can be replaced by each game later). Critique at least five rounds: "Would a
16-year-old who has never seen a terminal want to click something here within three seconds?" and
"Would this be the README hero image?" Then **stop and wait for the owner.**

## 7. After approval
Continue prompt 00 from Stage 3 for **all three styles**: every screen of prompt 00 §9.1 in each
style (Machine Room as designed; the two new styles as above), then sound, critique, final checks.
Extend the e2e suite and screenshots to 3 styles × their palettes × light/dark. Update
`docs/ARCHITECTURE.md` and the ADR "themes as renderers" into "Hall styles and palettes".

## 8. Scope
Same as prompt 00 §15. No game folders. No commits.
