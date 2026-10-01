# @usr-games/bridge

The bridge connects the Hall to a **hosted game**: a finished game that runs in an `<iframe>` served
from `/play/<id>/` on the same origin as the Hall. It is one small, dependency-free module speaking a
versioned `postMessage` protocol, so any game (plain HTML and JavaScript or a Vite app) can join the
Hall with one line and a handful of calls.

Native games do not use the bridge; they mount directly through the kit contract.

## Joining the Hall

**Static games** (no build step) include the classic build with one script tag. From
`/play/<id>/index.html` the relative path always reaches the shared copy, whatever the site base is:

```html
<script src="../../bridge/bridge.js"></script>
<script>
  const hall = UsrGamesBridge.connectToHall({ id: 'pom' });
</script>
```

**Games with their own Vite build** import the package and let their bundler include it:

```js
import { connectToHall } from '@usr-games/bridge';

const hall = connectToHall({ id: 'robots', onPause: pauseTheGame, onResume: resumeTheGame });
```

Then report what happens:

```js
hall.setTitleScreen(true); // on your own title screen: Escape now leads back to the Hall
hall.result({ outcome: 'win', score: 1240, stats: { robotsCrashed: 31 }, durationSeconds: 240 });
hall.achievement('chain-of-five'); // one of the packages listed in your manifest
hall.navigate('game-menu'); // or 'hall', from your own quit or menu action
```

### API

```ts
connectToHall(options: {
  id: string;
  onHello?: (hello: HelloPayload) => void;
  onAppearanceChange?: (appearance: AppearancePayload) => void;
  onSettingsChange?: (settings: BridgeSettings) => void;
  onPause?: () => void;
  onResume?: () => void;
  applyTokens?: boolean; // write the Hall's theme tokens as CSS custom properties on :root
}): HallConnection;

interface HallConnection {
  readonly hosted: boolean;
  state(): HelloPayload | null;
  result(result: ResultPayload): void;
  achievement(id: string): void;
  navigate(to: 'hall' | 'game-menu'): void;
  setTitleScreen(active: boolean): void;
  requestSettings(): void;
  poster(image: string, width: number, height: number): void; // key art, see "Game art"
  posterFromCanvas(canvas: HTMLCanvasElement, quality?: number): void; // the same, from a canvas
  disconnect(): void;
}
```

The Hall side lives in `@usr-games/bridge/host`:

```ts
createBridgeHost(options: {
  iframe: HTMLIFrameElement;
  gameId: string;
  hello: () => HelloPayload; // built fresh on every `ready`
  origin?: string; // defaults to the Hall's own origin
  onReady?, onResult?, onAchievement?, onNavigate?, onRequestSettings?, onTitleScreen?, onPoster?
}): { sendAppearance(p), sendSettings(s), pause(), resume(), destroy() };
```

### Standalone

Opened on its own, outside the Hall, `connectToHall` returns a connection with `hosted: false`, and
every call is a harmless no-op. A game never needs a second code path.

## Protocol v1

Every message is an envelope `{ protocol: 'usr-games-bridge', version: 1, type, payload }`.

```mermaid
sequenceDiagram
    participant Hall
    participant Frame as Game frame
    Hall->>Frame: load /play/id/
    Frame->>Hall: ready { id }
    Note over Frame: repeats ready after 250, 500, 1000, 2000 and 4000 ms until hello arrives
    Hall->>Frame: hello { version, gameId, appearance, theme, tokens, settings }
    Frame->>Hall: title-screen { active: true }
    Hall->>Frame: appearance-changed, settings-changed, pause, resume
    Frame->>Hall: result, achievement
    Frame->>Hall: navigate { to: hall or game-menu }
```

| Direction   | Type                 | Payload                                                                                                                                                                |
| ----------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hall → game | `hello`              | `version`, `gameId`, `appearance` (`light`/`dark`), `theme` (the palette: `phosphor`/`manual`/`sunset`/`console`/`holo`), `tokens` (CSS custom properties), `settings` |
| Hall → game | `appearance-changed` | `appearance`, `theme`, `tokens`, `reducedMotion`                                                                                                                       |
| Hall → game | `settings-changed`   | `settings`: `volume` (0–1), `muted`, `reducedMotion`, `colorBlindPalette`, `language`                                                                                  |
| Hall → game | `pause`, `resume`    | empty                                                                                                                                                                  |
| game → Hall | `ready`              | `id`, which must match the catalog id the frame was opened for                                                                                                         |
| game → Hall | `result`             | `outcome` (`win`/`loss`/`draw`/`complete`/`quit`), optional `score`, `stats`, `xpEvents`, `daily`, `durationSeconds`                                                   |
| game → Hall | `achievement`        | `id` of one of the game's packages                                                                                                                                     |
| game → Hall | `navigate`           | `to`: `hall` or `game-menu`                                                                                                                                            |
| game → Hall | `request-settings`   | empty; the Hall answers with `settings-changed`                                                                                                                        |
| game → Hall | `title-screen`       | `active`: whether the game is on its own title screen                                                                                                                  |
| game → Hall | `poster`             | `image` (a `data:image/png`, `jpeg` or `webp` base64 URL, at most about 1.5 MB), `width`, `height` (whole pixels, at most 4096)                                        |

The Hall answers every `ready` with a fresh `hello`, so a reloaded frame (the strip's "Game menu"
reloads it) always starts with the current appearance and settings. Changes sent before the game's
first `ready` are dropped rather than queued, because the hello carries the current state anyway. A
pause is the exception: if the Hall is paused when the game announces itself, `pause` follows the hello.

## Escape and the title screen

The Hall cannot hear keys pressed inside the frame. While the game has reported
`title-screen { active: true }`, the bridge listens for Escape inside the frame and sends
`navigate { to: 'hall' }` for it. If the game handles Escape itself there (to close a dialog, for
example), it calls `event.preventDefault()` and the bridge leaves the key alone. The bridge decides only after the page has
handled the key, so it does not matter whether the game added its listener before the bridge or after. During play, Escape
belongs to the game.

## Game art (posters)

Console Home and Holo Collection show every game as real key art, not an icon: the Console Home
hero, its rail tiles and the Holo cards. Native games draw it with the contract's `poster()`.
Hosted games have two routes, in order of preference:

1. **A snapshot the game renders itself.** Once the game has drawn something worth showing (its
   title screen, or a still of play), it sends it:

   ```js
   const hall = UsrGamesBridge.connectToHall({ id: 'pom' });
   // After the title screen has been drawn:
   hall.poster(canvas.toDataURL('image/webp', 0.8), canvas.width, canvas.height);
   ```

   `hall.posterFromCanvas(canvas)` does the scaling and encoding for you: it draws the canvas
   into one at most 1280 pixels wide (`POSTER_MAX_WIDTH`) and sends it as WebP. Call it in the
   same task as the drawing, right after the render call, because a WebGL canvas may be cleared
   once the browser has shown the frame. The adopted games do exactly that (see
   `games/pom/app/src/hall.js` and `games/robots/app/src/hall.ts`).

   The Hall keeps the latest poster for that game in memory and uses it wherever it shows the
   game's art. Only inline PNG, JPEG or WebP data URLs pass validation: no remote URLs (the Hall
   makes no network requests) and no SVG (which can carry script). Aim for 16:9 at about
   1280×720 so the art reads both as a wide hero and as a portrait card crop; keep the strongest
   detail right of centre, because the Console Home hero puts the title bottom-left.

2. **A still generated at build time.** A game that cannot snapshot itself (for example, one
   that never draws until the player starts) gets a still frame rendered from a live run during
   `pnpm build` into `dist/play/<id>/poster.webp`. The file exists only in `dist/`: it is never
   committed, because the repository holds no raster files (ADR 0002). Prompt 01 adds that step to
   the build script for the games that need it.

Until either route supplies art, the Hall draws a procedural poster from the game's emblem and
accent colour, so every game always has something beautiful to show.

## Security

- **Same origin only.** Hosted games are served by the Hall's own site. Both sides accept a message
  only when `event.origin` is that origin and `event.source` is the expected window (the frame's
  `contentWindow` for the Hall, `window.parent` for the game).
- **Explicit target origin.** Every `postMessage` names the origin; `'*'` is never used.
- **Strict schema.** `parseHallMessage` and `parseGameMessage` drop anything that is not exactly a v1
  message: unknown types or keys, wrong value types, non-finite numbers, oversize strings, maps and
  lists (see `LIMITS` in `src/protocol.ts`). The game side also validates its own output and warns
  in the console instead of sending something the Hall would drop.

## Builds

`pnpm --filter @usr-games/bridge build` writes `dist/bridge.mjs` (ES module) and `dist/bridge.js`
(classic script defining `window.UsrGamesBridge`). Both are left unminified so a game author reading
them in the browser's developer tools sees real names. `build.ts` exports
`buildBridge({ outDir?, write? })`, which the Hall's dev server uses to serve `/bridge/*` from memory
and the site build uses to write `dist/bridge/`.

## Fixtures

Two tiny test games, never listed in the Hall, prove the whole path end to end:

- `fixture/`: plain HTML and JavaScript, `hosted-static`, loading `bridge.js` with one script tag.
- `fixture-vite/`: the same game bundled by its own Vite build with the bridge imported as a
  package, `hosted-vite`, built with `--base /play/fixture-vite/`.

Both show the appearance they received (`#appearance`) and offer `#start`, `#win`, `#lose`,
`#unlock`, `#to-menu` and `#to-hall` for the end-to-end tests.

## Testing a hosted game in the Hall

`packages/bridge/testing/` holds the Playwright helpers every adopted game's own suite uses
(`games/<id>/playwright.config.ts`, `games/<id>/e2e/`), so each game is tested the same way: inside
the Hall, in its frame.

- `hall.ts`: `hostedSuiteConfig()` (the Hall dev server on `HALL_PORT`, default 5173),
  `runInHall(page, id)` (a signed-in guest opens the Hall, then the game), `waitForGame` and
  `inGame` (evaluate in the game's page, for its own test hooks), `toasts`, `savedGameStats` (what
  the Hall's progression save holds for the game), `watchForeignRequests` (every request that
  leaves the Hall's origin), and `describeWaysOut(game)`, the navigation-standard tests: Back to the
  Hall, Game menu, the browser's Back button and, for games with a title screen, Escape there.
- `shots.ts`: `describeScenes(game, media, scenes)` takes one documentation screenshot per scene at
  1280×720 (a scene may reopen the game's page with its own staging parameters), saved as WebP under
  800 KB; `GPU_LAUNCH_ARGS` let headless Chromium draw WebGL on the machine's GPU, where the adopted
  games keep their full looks.

## Tests

`pnpm vitest run --project bridge` covers the validators, the full handshake and message flow
between a host and a game through a simulated pair of windows (origin and source checks, retries,
Escape on the title screen, cleanup), the fixture manifests and the in-memory build.
