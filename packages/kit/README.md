# @usr-games/kit

The shared runtime for native games and the Hall: seeded randomness, dates and daily numbers,
colour and contrast, versioned saves, settings, appearance tokens, a synthesiser, input actions,
sharing, packages (achievements), the manifest schema, the game contract, usernames and the
progression engine.

The kit is plain TypeScript with no runtime dependencies and no network access. It exports source
directly; Vite compiles it inside the Hall and each game. Only the wave's named **kit owner**
changes it; everyone else proposes **kit candidates** (see [`AGENTS.md`](../../AGENTS.md)).

```ts
import { createRng, dailySeed, createSaveSlot } from '@usr-games/kit';
import { applyResult, RANKS } from '@usr-games/kit/progression';
import { themeTokens } from '@usr-games/kit/tokens';
import { validateManifest } from '@usr-games/kit/manifest';
```

| Entry point                  | Contents                                                            |
| ---------------------------- | ------------------------------------------------------------------- |
| `@usr-games/kit`             | Everything except progression                                       |
| `@usr-games/kit/progression` | The progression engine, rules, ranks, cron jobs, streaks, cosmetics |
| `@usr-games/kit/tokens`      | Palette definitions and token helpers                               |
| `@usr-games/kit/manifest`    | Manifest types and validation                                       |

Every module has unit tests next to it (`*.test.ts`); run them with `pnpm vitest run --project kit`.

## rng — seeded random numbers

sfc32 with a string-hashing seed expander: fast, good quality for games, and serialisable, so a save
can resume the exact stream.

```ts
const rng = createRng(dailySeed('wump'));
rng.int(1, 6); // inclusive
rng.pick(['north', 'east']);
rng.shuffle(deck); // returns a copy
rng.weighted([
  { value: 'rare', weight: 1 },
  { value: 'common', weight: 9 },
]);
const ai = rng.split('ai'); // independent labelled stream; does not advance rng
const saved = rng.state(); // [a, b, c, d] — JSON-safe
const resumed = restoreRng(saved);
```

Also `next()`, `nextUint32()`, `float(min, max)`, `chance(p)` and `hashString(text)` (32-bit FNV-1a).

## daily — dates, daily numbers and weeks

All keys use the player's **local** calendar; arithmetic between keys is done on UTC dates so
daylight-saving shifts never add or lose a day.

| Function                                                                                         | Returns                                                  |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `localDateKey(date?)`                                                                            | `'2026-09-28'`                                           |
| `dailyNumber(key?)`                                                                              | The public `#N` (`#1` on `DAILY_EPOCH`, 2026-09-01)      |
| `dailySeed(gameId, key?)`                                                                        | `'wump:daily:2026-09-28'`                                |
| `isoWeekKey(key?)` / `weekSeed(key?)`                                                            | `'2026-W40'` / `'week:2026-W40'` (weeks start on Monday) |
| `daysBetween(a, b)`, `addDays(key, n)`, `weekdayIndex(key)`, `weekStartKey(key)`, `isDateKey(v)` | Calendar helpers                                         |

## color — contrast and colour maths

WCAG relative luminance and contrast, OKLCH conversion, and `ensureContrast`, which moves a colour's
lightness (keeping its hue) until it reads on a background.

```ts
contrastRatio('#0a6e38', '#ecf3ee'); // 5.64
meetsContrast(fg, bg, AA_TEXT); // AA_TEXT 4.5, AA_LARGE_TEXT 3, AA_UI 3
ensureContrast('#e8a23c', '#f6f1e7'); // a darker amber that passes 4.5:1
```

Also `parseHex`, `isHexColor`, `toHex`, `relativeLuminance`, `hexToOklch`, `oklchToHex`, `mixHex`,
`withAlpha`.

## storage — versioned saves

Everything is stored under the `usr-games:` prefix as `usr-games:<scope>:<key>`, where scope is
`hall` or a game id, inside an envelope `{ v, savedAt, data }`.

```ts
const scores = createSaveSlot({
  storage: browserStorage(), // localStorage, or memory when blocked
  scope: 'wump',
  key: 'scores',
  version: 2,
  defaults: () => ({ best: 0, plays: 0 }),
  migrations: { 2: (v1) => ({ ...(v1 as { best: number }), plays: 0 }) },
  isValid: (v): v is Scores => typeof v === 'object' && v !== null && 'best' in v,
});
scores.update((s) => ({ ...s, plays: s.plays + 1 }));
```

Corrupt or invalid saves fall back to defaults; saves from a newer version are left untouched on
disk. `forgetAllData(storage)` removes every collection key ("Forget my data");
`forgetScope(storage, id)` removes one game's. `memoryStorage()` is for tests.

## settings — the player's preferences

```ts
interface Settings {
  style: 'console' | 'holo' | 'machine-room'; // the Hall style; Console Home for new players
  appearance: 'light' | 'dark' | 'system';
  theme: 'phosphor' | 'manual' | 'sunset'; // the Machine Room palette
  consoleSkin: string; // a rank-unlocked Console Home accent, or 'default'
  holoFinish: string; // a rank-unlocked Holo Collection foil, or 'default'
  volume: number; // 0–1, 0.35 by default: quiet
  muted: boolean;
  motion: 'system' | 'reduce' | 'full';
  colorBlindPalette: boolean;
  language: 'en';
  bindings: Record<string, Record<string, string[]>>; // game id → action → codes
}
```

`createSettingsStore({ storage, environment })` persists them and exposes `get()`, `resolved()`
(`{ settings, appearance, reducedMotion }` with `system` resolved), `update(patch)`, `reset()` and
`subscribe(listener)`, which also fires when the OS preference changes while `system` is chosen.
`browserPreferences()` reads the OS through `matchMedia`; `fixedPreferences(dark, reduced)` is for
tests. `sanitizeSettings(value)` keeps only valid fields. `paletteOf(settings)` names the palette in
use: the Machine Room's `theme`, or `console` / `holo` for the other styles. Settings saved before
styles existed migrate to version 2 with `style: 'machine-room'`, so those players keep the look they
knew.

## tokens — appearance tokens

Five palettes, each designed twice (light and dark), in `src/tokens/themes.ts`: the Machine Room's
**Phosphor**, **Manual Page** and **Sunset Lab**, and the signature palettes of **Console Home** and
**Holo Collection** (see ADR 0010, Hall styles and palettes). Every token becomes a
CSS custom property named `--ug-<kebab-name>`:

| Token                                 | CSS variable                                      | Role                                     |
| ------------------------------------- | ------------------------------------------------- | ---------------------------------------- |
| `bg`, `bg2`                           | `--ug-bg`, `--ug-bg-2`                            | Page background and its gradient partner |
| `surface`, `surface2`                 | `--ug-surface`, `--ug-surface-2`                  | Panels and raised panels                 |
| `line`, `lineStrong`                  | `--ug-line`, `--ug-line-strong`                   | Hairlines; component edges (3:1)         |
| `ink`, `ink2`                         | `--ug-ink`, `--ug-ink-2`                          | Text and secondary text                  |
| `accent`, `accent2`, `accentInk`      | `--ug-accent`, `--ug-accent-2`, `--ug-accent-ink` | Palette accents; text on an accent fill  |
| `mark`                                | `--ug-mark`                                       | Section marks (the manual's red)         |
| `good`, `warn`, `bad`                 | `--ug-good`, `--ug-warn`, `--ug-bad`              | Status colours                           |
| `glow`, `focus`, `shadow`             | `--ug-glow`, `--ug-focus`, `--ug-shadow`          | Bloom, focus rings (3:1), shadows        |
| `fontBody`, `fontMono`, `fontDisplay` | `--ug-font-body`, …                               | Font stacks                              |
| `radius`                              | `--ug-radius`                                     | Corner radius                            |

**Contract** (tested for all ten palette × appearance combinations and their colour-blind variants): `ink`, `ink2`,
`accent`, `accent2`, `mark` and the status colours reach 4.5:1 on `bg`, `bg2`, `surface` and
`surface2`; `accentInk` reaches 4.5:1 on `accent`; `focus` and `lineStrong` reach 3:1 on `bg`.

```ts
const tokens = themeTokens({ theme: 'manual', appearance: 'dark', colorBlindPalette: false });
applyTokens(document.documentElement, tokens);
const accent = accentFor(manifest.accent, tokens); // your brand colour, legible on this palette
readToken(element, 'accent'); // live value, for canvas drawing
```

Also `PALETTES`, `THEMES` (the Machine Room three), `PHOSPHOR`, `MANUAL`, `SUNSET`, `CONSOLE`, `HOLO`,
`tokensToCss`, `tokenVariable`. `themeTokens` accepts any palette id as `theme`.

## audio — the synthesiser

No audio files: sounds are patches (lists of voices) built from oscillators, noise, envelopes and a
low-pass filter. The `AudioContext` starts lazily on the first sound after a user gesture; volume
and mute follow settings.

```ts
const synth = createSynth({ getVolume: () => s.volume, isMuted: () => s.muted });
synth.play({ name: 'move', voices: [{ wave: 'triangle', frequency: 440, duration: 0.08 }] });
const hum = synth.drone(HALL_PATCHES.bootHum); // later: hum.stop(0.6)
settings.subscribe(() => synth.refresh());
```

`HALL_PATCHES` holds the Hall's voice: `keyClick`, `select`, `back`, `bootHum`, `rankUp`. Also
`volumeToGain` (perceptual curve) and `patchDuration`.

## input — actions instead of keys

Bindings use `KeyboardEvent.code` (layout independent), `Mouse0`–`Mouse2` and `Pad0`–`Pad16`
(standard gamepad mapping).

```ts
const input = createInput({
  target: window,
  defaults: { up: ['ArrowUp', 'KeyW'], fire: ['Space', 'Mouse0'] },
  overrides: settings.get().bindings.wump,
  onBindingsChange: (overrides) => saveBindings('wump', overrides),
});
input.on(({ action, pressed }) => {
  /* … */
});
input.isDown('up');
input.rebind('fire', ['KeyF']); // returns actions that lost a key to it
input.pollGamepads(); // once per frame
```

Held actions are released when the window loses focus. `mergeBindings`, `findConflicts` and
`describeCode` (`'KeyW'` → `W`, `'ArrowLeft'` → `←`) support remapping screens.

## share — URL-free share strings

```ts
composeShare({
  title: 'Cave hunt',
  daily: '2026-09-28', // adds "#28"
  headline: 'found it in 4',
  grid: [['miss', 'near', 'hit']], // ⬛🟨🟩 (🟦🟧 with the colour-blind palette)
});
await shareText(text); // 'shared' | 'copied' | 'unavailable'
downloadFile('run.txt', text);
```

Any URL in the text is removed: sharing never advertises or tracks.

## achievements — packages

```ts
export const PACKAGES = definePackages('wump', [
  { id: 'first-catch', title: 'First catch', description: 'Find the creature once.', tier: 'core' },
  {
    id: 'no-arrows-wasted',
    title: 'Clean shot',
    description: 'Win with your first arrow.',
    tier: 'rare',
  },
]);
```

Tiers are worth `TIER_XP` (core 30, extra 60, rare 120); an explicit `xp` must be 10–250. Ids are
kebab-case and unique per scope. `packageKey('wump', 'first-catch')` is `'wump/first-catch'`;
`packagePath('ada', 'wump', 'first-catch')` is `/home/ada/wump/first-catch.pkg`. Also
`validatePackages`, `packageXp`.

## manifest — the game's description

`GameManifest` fields: `id`, `title`, `tagline` (≤ 64), `teaser` (≤ 320), `category`, `directory`
(`/usr/games/<category>`), `players`, `sessionMinutes` (`[shortest, longest]`), `status`
(`coming-soon` · `adopting` · `shipped` · `unlisted`), `accent`, `emblem` (SVG path data on a 48×48
grid, drawn as a 3 px round stroke), `inspiredBy { program, originalTitle, uiTitle, year }`,
`daily`, `kind` (`native` · `hosted`), `build` (`native`, or `hosted-static` / `hosted-vite` with
`source` and `output: 'play/<id>/'`), `manPage { synopsis, description, seeAlso }`, and optional
`cronGoals`, `packages` and `controls`: the remappable actions the Hall lists in Settings, each
`{ action, label, keys }` with `KeyboardEvent.code` values (or `Mouse0`–`Mouse2`, `Pad0`–`Pad16`).
Remaps are saved in `settings.bindings[gameId][action]`.

`validateManifest(value)` returns `{ ok: true, value }` or `{ ok: false, errors }` with every
problem listed. Also `CATEGORIES`, `GAME_STATUSES`, `directoryFor`, `hostedOutput`,
`averageSessionMinutes`, `GAME_ID_PATTERN`.

## contract — native games

```ts
const game: GameModule = {
  achievements: PACKAGES,
  mount(host, context) {
    const tokens = context.appearance().tokens;
    const stop = context.onAppearanceChange((state) => redraw(state));
    context.pauseMenuItems([
      { id: 'restart', label: 'Restart round', shortcut: 'R', run: restart },
    ]);
    context.setOnTitleScreen(true);
    // … on game over:
    const receipt = context.reportResult({ outcome: 'win', score: 120, presentation: 'game' });
    return { unmount: () => stop(), playAgain: startRound }; // playAgain is optional
  },
  demo(seed, appearance) {
    return { element, setAppearance, setVisible, destroy }; // silent attract mode
  },
};
export default game;
```

Optional `poster(canvas, options)` draws the game's key art for Console Home and Holo Collection
with the game's own renderer; without it the Hall uses the demo, then placeholder art, then a
procedural poster from the emblem and accent. Hosted games send a still over the bridge instead
(`poster` message).

`GameContext` offers `gameId`, `settings()`, `appearance()` (theme, appearance, tokens, your legible
accent, reduced motion), `onAppearanceChange`, `onSettingsChange`, `audio`, `save(...)`, `daily`
(`number()`, `seed()`, `dateKey()`), `reportResult`, `installPackage(id)`, `share`,
`pauseMenuItems`, `onPause`, `onResume`, `setOnTitleScreen`, `openSettings`, `forgetData` and
`navigate('game-menu' | 'hall')`.

`GameResult`: `outcome` (`win` · `loss` · `draw` · `complete` · `quit`), `score?`, `stats?`
(counters such as `{ planesLanded: 12 }`), `xpEvents?` (`{ id, xp }`), `daily?`,
`durationSeconds?`, `presentation` (`'hall'` or `'game'`). The returned `ResultReceipt` carries
`xpGained`, `packagesInstalled`, `rankChange` and `cronJobsCompleted`.

## profile — usernames

`validateUsername(input)` returns `{ ok: true, name }` or `{ ok: false, reason }` with kind,
plain-language reasons. Names are 2–16 characters, start with a letter, use letters, digits, `-` and
`_`, avoid reserved system names (`root`, `wheel`, `guest` …) and pass a small all-ages screen.
`normalizeUsername` lower-cases and turns spaces into dashes.

## progression — ranks, XP, cron jobs, streaks

A pure engine: every function takes a state and returns a new one with a receipt. No DOM, no clock,
no storage; the caller passes today's date key and the shipped games.

```ts
const context = { today: localDateKey(), shippedGames };
let state = emptyProgression();
state = recordLogin(state, context).state;
const update = applyResult(state, gameInfo, result, context);
update.xpGained; // total
update.lines; // [{ source: 'session', label, xp }, { source: 'first-win', … }, …]
update.packagesInstalled;
update.rankBefore;
update.rankAfter;
state = update.state;
pendingRankUp(state); // { from, to } until acknowledgeRank(state) is saved
```

| Module          | Main exports                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine`        | `applyResult`, `installGamePackage`, `recordLogin`, `recordManPageRead`, `recordThemeSeen`, `recordStyleSeen`, `syncWeek`, `pendingRankUp`, `acknowledgeRank` |
| `levels`        | `levelForXp` (Level 1–99, an even split of each rank's XP band), `firstLevelOfRank`, `MAX_LEVEL`, `RANK_TOOLTIP`                                              |
| `rules`         | `XP_RULES`, `sessionXp`, `sameGameMultiplier`, `eventsXp`, `applySoftCap`, `isToy`, `GameInfo`                                                                |
| `ranks`         | `RANKS` (each with its welcome in Unix words, `flavour`, and in plain words, `plainFlavour`), `RANK_IDS`, `rankForXp`, `nextRank`, `rankProgress`             |
| `cron`          | `generateCronJobs(week, shippedGames)`, `advanceCronJobs`, `JOBS_PER_WEEK`, `plainLabel` / `questLabel` (the plain-word quest names)                          |
| `streak`        | `registerActivity`, `streakAsOf`, `FREEZES_PER_WEEK`                                                                                                          |
| `hall-packages` | `HALL_PACKAGES` (ten collection-wide packages) and their conditions                                                                                           |
| `cosmetics`     | `COSMETICS`, `unlockedCosmetics`, `cosmeticsForRank` (each with its source)                                                                                   |
| `state`         | `ProgressionState`, `emptyProgression`, `isProgressionState`                                                                                                  |

The numbers and their reasons are in [ADR 0005](../../docs/adr/0005-progression-rules.md). The
simulations live in `src/progression/sim/`: `pnpm sim [runs]` prints the balance report, and
`sim/targets.test.ts` locks the targets (see
[`docs/NOTES-progression.md`](../../docs/NOTES-progression.md)).
