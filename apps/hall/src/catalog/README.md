# The Hall catalog

`catalog.json` lists every game the Hall knows, one line per game, in display order:

```json
{ "id": "atc", "source": "placeholder" }
```

- `"source": "placeholder"` reads `placeholders/<id>.json`: a planned game with working-title copy.
- `"source": "game"` reads `games/<id>/manifest.json`: the game's own manifest, once it exists.

A game session flips only its own line from `placeholder` to `game` at the very end of its prompt.
The placeholder file may stay; the catalog check reports unused placeholders as a note, not an error.

`fixtures` lists test games (the bridge fixtures). The Hall loads them only in development and in
builds made with `pnpm build --fixtures`; they never appear in a production catalog.

Every manifest is validated by `validateManifest` from `@usr-games/kit` in unit tests and by
`pnpm check:catalog`.
