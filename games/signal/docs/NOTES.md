# Dits & Daws — notes

The lab notebook: what the five BSD programs really do, the research behind the semaphore chart
and the card code, how the codecs were proved against the originals, and the decisions taken.
Dates are 2026-10-11 unless stated.

## Sources studied

All read-only in `E:\Projects\BSDGames\BSDGames-master`; nothing copied into the repo except the
tables the credits name (see "Derived data" below).

| File                                              | What we learned                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `caesar/caesar.c`, `caesar.6`, `rot13.in`         | The breaker's table and scoring, the fixed-rotation mode, the 2048-byte guess, rot13 as `caesar 13`                  |
| `morse/morse.c` (no manual of its own)            | The table with twelve punctuation marks, the spoken default, `-s`, `-d`, SK, line noise                              |
| `bcd/bcd.c`, `bcd/bcd.6` (also covers ppt, morse) | Hayman's deduced hole table, Bruce's fix, the 48-column card, the manual's switches and its typo                     |
| `ppt/ppt.c`                                       | Eight-hole rows with the feed hole after the fifth, `-d` reading and its "lost sync" stop                            |
| `banner/banner.c`, `banner/banner.6`              | The glyph program and its interpreter, 132 columns, `-w` scrunching, undocumented `-d` and `-t`, the stdin quirk     |
| `Makefile.bsd`, `Makefrag` of each                | `rot13` is installed as a script calling `caesar 13`; `morse` and `ppt` are hidden games with no manual of their own |

## The hooks, verified

| Hook (from the prompt)                                       | Verdict                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| morse says "daw", not "dah", and ends with SK                | **True, and stronger than stated:** the dit/daw words are the program's _default_ output, not a mode; `-s` switches to dots and dashes (`morse.c:264`). Every message ends with `...-.-`, commented `SK` (`morse.c:197`); spoken, that is "dit dit dit daw dit daw". Decoding swallows SK silently (`morse.c:228`).                                      |
| caesar is an automatic codebreaker on a log scale            | **True.** It dots the letter counts of the first 2048 bytes with log frequencies, "to weight low probs REAL low" (`caesar.c:102–104`), tries all 26 rotations (`caesar.c:123`) and prints the text turned by the first best one. A commented-out `+= 13` on that loop shows someone once tried only 0 and 13.                                            |
| its manual lists the frequencies from E (13 %) to Z (0.07 %) | **True, but it is not the code's table.** The manual (`caesar.6:57–64`) ranks ETAONRISHD… with E 13 and Z rarest. The code (`caesar.c:72–76`, "taken from some unix documentation") has E 12.37, puts S third, and calls J the rarest letter. The game shows both and scores with the code's.                                                            |
| rot13 hid spoilers on USENET                                 | **True** (`caesar.6:69–72`); `rot13` is just `caesar 13` (`rot13.in`).                                                                                                                                                                                                                                                                                   |
| bcd was rebuilt by detective work; "These may be wrong"      | **True** (`bcd.c:52–60`, Steve Hayman, 1989). Dyane Bruce (`bcd.c:66–76`, 1993) found Q and R sharing a code and four bad entries. **Mystery solved** below: the old program used the GE-625/635 card code, Q = R came from Bell Labs' own 1979 table, and Hayman's deduction slipped one place from the backslash on.                                   |
| ppt punches paper tape and can read it back                  | **True** (`ppt -d`, `ppt.c:92–112`). Rows are the byte's bits, high bit left, with the feed hole between the fifth and sixth hole (`ppt.c:142`).                                                                                                                                                                                                         |
| banner prints "a large, high quality banner" on 132 columns  | **True** (`banner.6:44`, `banner.c:58`). The manual's list of missing characters is exact: our glyph table has 84 characters and lacks precisely `< > [ ] \ ^ _ { \| } ~`. Undocumented: the backquote prints the double quote's glyph (`banner.c:76`). `", '` and `&` are indeed "funny looking (but in a useful way)" (`banner.6:56–58`).              |
| `-w` "skips rows and columns", "grainier"                    | **True** (`banner.6:59–64`, "Sometimes it runs letters together"). One mask, `print[i * 132 / width]`, picks the kept columns _and_ the kept lines inside every glyph (`banner.c:1062–1065`, `1142`), which is where the grain comes from. The scaling code that would have done it properly sits disabled under `#ifdef notdef` (`banner.c:1155–1158`). |

## Verified behaviour of the originals

### caesar

- `caesar N` turns letters forward by `N` (any non-negative number, modulo 26 in effect); a negative
  one is refused (`caesar.c:156–157`). Case is kept; everything else passes through.
- The guess reads only the first 2048 bytes (`LINELENGTH`), then turns the whole input by it.
- Ties go to the smaller rotation; a text with no letters comes back unturned (rotation 0).
- The constant `log(26/100)` added to every weight never changes the winner.
- Short texts with rare letters fool it: "Jazz quiz" turned by 5 does not come back. The game's
  "beat the machine" messages are built from that weakness.

### morse

- Table: A–Z, 0–9 and `. , : ? ' - / ( ) " = +` (`morse.c:52–110`). No `! @ & ; _ $`; unknown
  characters are skipped silently when sending.
- With arguments, each argument ends with an empty line; the input form sends a blank line for
  each whitespace character. The commented "could show BT for a pause" (`morse.c:244`) never sends one.
- `-d` reads runs of `.` and `-`; every second blank between runs prints a space; a run of ten
  marks prints one `x` and swallows the rest of the run _and_ the character after it
  (`morse.c:160–170`); an unknown run prints `x`, "line noise" (`morse.c:230`); a run with no
  character after it at the very end is lost.
- The manual's `-d` line says "dots and slashes" (`bcd.6:68`) where it means dashes.

### bcd

- One card per argument, or per line of input; text is cut to 48 columns (`COLUMNS`,
  `bcd.c:154–169`) and ASCII lower case is upper-cased first. A character without a pattern
  leaves a blank on the printed top line.
- Rows print as `]` where punched, otherwise the row's digit; the 12, 11 and 0 rows print blanks.
  The original old `bcd` printed a hole as `[`, a backspace, five control-A's and `]`
  (`bcd.c:201–203`).
- The table's upper half (bytes 128–255) repeats the lower half shifted by one place; the
  lower-case rows are shifted too, which upper-casing hides.

### ppt

- Edges of eleven underscores; one row per byte; arguments are joined by one blank with no
  newline added. `-d` finds the first `.` on a line and reads fixed offsets around it; anything
  not a blank counts as a hole; the first line without a dot after the tape began ends the
  reading ("lost sync?").

### banner

- Each glyph is a little program: spans of `#` on the current line, then "print this line n
  times"; the byte with 64 added ends the glyph (`banner.c:82–89`, `1136–1162`). A line is
  printed up to the end of the _last_ span set, remembered across blank lines, so trailing
  blanks vary.
- `'!'` starts at byte 3 of the table, skipping a two-line gap at byte 2 that belongs to no
  character.
- Reading from standard input drops the last character, assuming it is a newline
  (`banner.c:1079–1080`): `echo -n Hi | banner` prints only H.
- `-d` dumps the tables and `-t` traces the interpreter; neither is in the manual.
- The bounds check is `pc > NBYTES` where it should be `>=` (`banner.c:1131`).

## The card code, solved (research 2026-10-11)

Research by a sub-agent against primary sources, checked here against the decoded table:

- The original `bcd` survives as `3BSD/usr/src/games/bcd.c` (1979-02-12; the same table in
  4BSD), in the Unix Heritage Society archive. V7 shipped only the binary.
- Its table is the **GE-625/635 "Standard Character Set" card code** (GE CPB-1004F, 1969,
  Appendix F): every one of its 64 entries matches the GE manual except **R, which it gives Q's
  code**. So the Q = R bug that Dyane Bruce fixed in 1993 was Bell Labs' own, inherited through
  Hayman's deduction. `+` as 12-0 is a GE-only trait; IBM never punched plus that way.
- **Hayman's deduction slipped by one place from the backslash on**: his `\ ] ^ _` are the old
  program's `] ^ _` and `` ` ``, and the backquote read one entry past the old 64-entry table, which
  is why `_` comes out as the nonsense 0-1-6-7-8-9. The GE codes are `\` 12-7-8, `]` 12-4-8,
  `^` 11-0, `_` 0-2-8. A shell `read` eating the backslash would explain it; that is our
  inference, not his.
- Against the IBM 029 keypunch, the table agrees on space, `# $ % & ( ) * , - . / ; @`, digits
  and letters, and differs on `! " ' + : < = > ? _ |`; `[ \ ] ^ { } ~` are not 029 characters.

References: TUHS `3BSD/usr/src/games/bcd.c` and `4BSD/usr/src/games/bcd.c`; GE-625/635
Programming Reference Manual CPB-1004F (July 1969), Appendix F, on bitsavers.org; Douglas W.
Jones, "Punched Card Codes", University of Iowa. The game keeps Hayman's table, as the prompt
asks, and offers "what the real code was" as a note per character.

## Flag semaphore chart (research 2026-10-11)

The alphabet was checked letter by letter against five sources, which agree on every letter;
all draw the signaller facing the reader:

1. _Boy Scouts Handbook_, 1st ed., Boy Scouts of America, 1911, pp. 206–208 (Project Gutenberg
   29558).
2. Admiralty, _Handbook of Signalling_, 1913 (transcribed at gwpda.org).
3. US Navy, _Signalman 3 & 2_, NAVEDTRA 14244, 1996, Appendix II.
4. Wikipedia, "Flag semaphore", citing a UK Scout Association sheet (chart geometry checked).
5. Royal Canadian Navy, BRCN 3038 (1963), via "Visual Signalling in the RCN – Semaphore".

Decisions taken from them:

- Hands as the 1911 handbook gives them; which hand holds a crossing flag cannot be seen, so the
  judge compares the _shape_ (the two directions as a set) and accepts either hand.
- Special signs: numerals (right hand up, left hand high right; then A–I = 1–9, K = 0), J for
  "letters follow", annul, both flags down and crossed for rest and space, and "error" as eight
  E's. Baden-Powell's 1908 text has known mistakes and is not used.
- Built-in check, locked as a test: turning every pose upside down maps letters to letters, and
  only D, L and R (and the annul sign) map to themselves, as the US Navy course says.
- Teaching circles (1911): A–G; H–N without J; O–S; T, U, Y; J, V; W, X, Z.
- Pace: the 1911 First Class test asked for 16 letters a minute (about 3.7 s a letter); navies
  15 words a minute (about 0.8 s). The reading ladder runs 3.6 s down to 0.8 s.
- Between words the flags drop to rest; a double letter rests between its halves.

## Proving the codecs

The five programs were built with gcc 13 in WSL from copies in the session's scratch folder
(outside the repo), with `__RCSID` and `__COPYRIGHT` defined away. A scratch script ran them on
58 inputs of our own (all modes and quirks above, banner at widths 132, 80, 40, 20 and 8) and
saved their outputs to `src/codecs/fixtures/originals.json`: short outputs verbatim, long ones as
a SHA-256 and length. `src/codecs/originals.test.ts` reproduces all 58 byte for byte.

## Derived data

- `src/codecs/morse.ts`: the morse table (`morse.c`).
- `src/codecs/caesar.ts`: both frequency tables and the scoring (`caesar.c`, `caesar.6`).
- `src/codecs/bcd.ts`: the 256-entry hole table (`bcd.c`).
- `src/codecs/banner-glyphs.ts`: the glyphs, converted once from `banner.c`'s byte program into
  our own row-group form by a scratch script.
- `src/codecs/ppt.ts`: the row layout only (no table).

All under the BSD-3-Clause notice of the Regents of the University of California
(`LICENSES/BSD-3-Clause-UCB.txt`) and credited in `CREDITS.md`.

## Decisions log

| Date       | Decision                                                                                                                                                                                              | Why                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 2026-10-11 | Cards keep the original's 48 columns                                                                                                                                                                  | It is what `bcd` printed; 80 tiny columns would not read on screen                       |
| 2026-10-11 | Only ASCII is punched                                                                                                                                                                                 | The table's upper half is a shifted copy, an artefact of the deduction                   |
| 2026-10-11 | Banner glyphs drawn as inked cells at line-printer proportions (10 across, 6 down to the inch)                                                                                                        | Turned upright the original's letters keep their shape; a loupe shows the real `#` marks |
| 2026-10-11 | Semaphore judged by shape, either hand                                                                                                                                                                | The references disagree on which hand crosses; the reader cannot see it                  |
| 2026-10-11 | Keys: Q W E / A D / Z X C for the reader's left flag, the number pad (or U I O / J L / M , .) for the right                                                                                           | The prompt's clusters; a second cluster for laptops without a number pad                 |
| 2026-10-11 | **Owner approved the hero frames and all five decisions** ("ok, lanjut"): 48 columns, Hayman's table in play with the GE note, the key clusters, land and sea flags, the kit sim row logged not fixed | Checkpoint of prompt 14                                                                  |
| 2026-10-12 | The register lays marks out by code units in rows, not by time                                                                                                                                        | With Farnsworth spacing, marks laid out by time made dits and daws look alike            |
| 2026-10-12 | First lessons of punching, taping and flag sending keep their charts free                                                                                                                             | They introduce a new way of working, not a new code                                      |
| 2026-10-12 | Ladders move on only after a lesson read with every letter right                                                                                                                                      | No step up on a guess                                                                    |

## Balance: par times and help

Par times come from `src/engine/par.ts`: the telegraph's own playing time twice over plus ten
seconds and two a letter; 75 seconds for a cipher (150 with a key word); six seconds a
character to read a card, twelve to punch one; nine and twelve for tape; the printer's own time
plus fifteen seconds; the flags' hold times plus a little, or the per-letter limit when sending.
All 42 campaign pars fall between 10 and 400 seconds (locked in `engine.test.ts`). Help is free
in the first two messages of every chapter and in the first lesson of each new way of working.

Session length at par: a single message takes 19 seconds (a short banner) to a little over three
minutes (a chained message); a chapter of six runs from about two and a half minutes (the
printer's) to about thirteen (the chained messages of chapter 7). A Daily Signal's par was 76 to
183 seconds over 60 days. That is the manifest's 3–15 minutes for a sitting of one chapter; the
kit's model says 3–10 (KNOWN-ISSUES #58).

## Performance

Measured on the workbench at 1920 × 1080 (Chromium with the GPU, 2026-10-12): main-thread paint
time per frame, average and worst over 150 frames.

| Screen             | Morning avg / worst (ms) | Night avg / worst (ms) |
| ------------------ | ------------------------ | ---------------------- |
| Game menu (desk)   | 1.1 / 2.5                | 1.4 / 2.2              |
| Signal Room (desk) | 1.1 / 2.4                | 0.3 / 0.9              |
| Telegraph          | 0.3 / 0.7                | 0.3 / 0.8              |
| Cipher wheel       | 0.9 / 2.1                | 0.9 / 2.0              |
| Card punch         | 0.6 / 1.3                | 0.5 / 1.1              |
| Tape reader        | 0.2 / 0.7                | 0.2 / 0.6              |
| Banner printer     | 0.6 / 1.4                | 0.5 / 1.2              |
| Flags on the roof  | 0.2 / 0.6                | 0.6 / 1.7              |

Before caching the still layers (the room, the close desk, the banner's paper and ink), the
printer and the cipher wheel spent long enough per frame to drop below 60 fps. Every screen now
sits far inside the 16.7 ms of a frame.

## Tests

- 111 unit tests (`pnpm vitest run --project signal`): the 58 comparisons with the originals,
  codec round trips and properties, the Morse key reader, the semaphore chart, every campaign
  message solved by the codecs, chained hints, 60 days of Daily Signals, stars, desk codes and
  the manifest.
- 13 workbench browser tests: every machine by keyboard and by mouse, a chained message, the
  sandbox round trip, the Daily Signal share line, and the ways out.
- 6 Hall browser tests (`--project hall`): the game menu with no outside requests, a message
  reaching the Hall's save, a package installing, the pause menu's order, the safe zones, and
  every way back to the Hall.

## Open questions

- The kit's simulation model lists `signal` at 3–10 minutes where the manifest says 3–15
  (KNOWN-ISSUES #58); the kit owner decides.
