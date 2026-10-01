# Fonts

Every typeface in the Hall is self-hosted from its `@fontsource` package (no font CDN, no network
request at run time) and licensed under the SIL Open Font License 1.1. The full licence text is in
[`OFL-1.1.txt`](OFL-1.1.txt). The copyright lines below are copied from each package's `LICENSE`
file.

| Font                           | Package                                    | Used for                                          | Copyright line                                                                                                                 |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Atkinson Hyperlegible Next     | `@fontsource/atkinson-hyperlegible-next`   | Body text in every theme                          | Copyright 2020-2024 The Atkinson Hyperlegible Next Project Authors (https://github.com/googlefonts/atkinson-hyperlegible-next) |
| IBM Plex Mono                  | `@fontsource/ibm-plex-mono`                | Prompts, paths and numbers                        | Copyright 2017 IBM Corp. All rights reserved.                                                                                  |
| VT323                          | `@fontsource/vt323`                        | Display type in the Phosphor theme                | Copyright 2011, The VT323 Project Authors (peter.hull@oikoi.com)                                                               |
| Source Serif 4 (variable)      | `@fontsource-variable/source-serif-4`      | Display type in the Manual Page theme             | Google Inc. (the only holder named in the package's licence file)                                                              |
| Fraunces (variable)            | `@fontsource-variable/fraunces`            | Display type in the Sunset Lab theme              | Copyright 2020 The Fraunces Project Authors (github.com/undercasetype/Fraunces)                                                |
| Bricolage Grotesque (variable) | `@fontsource-variable/bricolage-grotesque` | Display type in Console Home and the style picker | Copyright 2022 The Bricolage Grotesque Project Authors (https://github.com/ateliertriay/bricolage)                             |
| Fredoka (variable)             | `@fontsource-variable/fredoka`             | Display type in Holo Collection                   | Copyright 2016 The Fredoka Project Authors (https://github.com/hafontia/Fredoka-One)                                           |

Adopted games (prompt 01, [ADR 0011](../docs/adr/0011-adopting-finished-games.md)) used to load
their fonts from a CDN. They now carry Latin woff2 files copied from the same `@fontsource`
packages into their own folders (`app/src/ui/fonts/` or `app/src/fonts/`), under the family names
their styles already use:

| Font                          | Package                                   | Used by                                | Copyright line                                                                                                                |
| ----------------------------- | ----------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Cormorant Garamond (variable) | `@fontsource-variable/cormorant-garamond` | Selene; Pajamas to Paradise            | Copyright 2015 The Cormorant Project Authors (github.com/CatharsisFonts/Cormorant)                                            |
| Inter (variable)              | `@fontsource-variable/inter`              | Selene; Abyssal Worms                  | Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)                                                      |
| JetBrains Mono (variable)     | `@fontsource-variable/jetbrains-mono`     | Selene; Abyssal Worms; Hunt — Ricochet | Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)                                |
| Orbitron (variable)           | `@fontsource-variable/orbitron`           | Robots; Trek — Deep Space              | Copyright 2018 The Orbitron Project Authors (https://github.com/theleagueof/orbitron)                                         |
| Rajdhani                      | `@fontsource/rajdhani`                    | Robots; Pajamas to Paradise            | Copyright (c) 2014 Indian Type Foundry (info@indiantypefoundry.com)                                                           |
| Chakra Petch                  | `@fontsource/chakra-petch`                | Hunt — Ricochet                        | Copyright 2018 The Chakra Petch Project Authors (https://github.com/m4rc1e/Chakra-Petch.git)                                  |
| IBM Plex Mono                 | `@fontsource/ibm-plex-mono`               | Pajamas to Paradise                    | Copyright 2017 IBM Corp. All rights reserved.                                                                                 |
| Share Tech Mono               | `@fontsource/share-tech-mono`             | Trek — Deep Space; Control Room 1986   | Copyright (c) 2012, Carrois Type Design, Ralph du Carrois (www.carrois.com post@carrois.com), with Reserved Font Name 'Share' |
| VT323                         | `@fontsource/vt323`                       | Control Room 1986                      | Copyright 2011, The VT323 Project Authors (peter.hull@oikoi.com)                                                              |

Only the Latin subsets are imported. When a font is added or swapped, update this table,
[`../CREDITS.md`](../CREDITS.md) and ADR [0008](../docs/adr/0008-fonts.md) in the same change.
