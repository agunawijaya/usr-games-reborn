# Deeds & Dice — changes from the original

Original: `monop` from the BSD games, by Ken Arnold (1980, sourced from its manual page; the code
is © 1980, 1993 The Regents of the University of California).

## The soul we kept

Roll, land, buy, build, trade, and survive the rent. The game is won by turning streets into whole
districts and districts into towers, and by striking the deal that gets you there. Every rule of
the original program is still here, played exactly as it played, as the Berkeley 1980 rule set.

## Changes

| Area         | Original                                                   | Reborn                                                                                | Why                                                                             |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Presentation | Text prompts on a terminal, board printed on request       | Three living miniature towns in 3D, a flat Map view, panels for every number          | A property game is about watching a town grow                                   |
| Opponents    | None: a referee for 1–9 people at one terminal             | Rivals with five personalities and three levels; people and rivals mixed, 1–6 seats   | Most players today play alone                                                   |
| Trading      | One yes or no at the shared keyboard                       | Offers and counter-offers with a reason in one sentence, and a fairness meter         | Negotiation is the heart of the game once someone answers back                  |
| Rules        | One set (the bank lends; no auction with two players left) | Standard and Berkeley 1980, plus three house rules                                    | Standard is how most people play; Berkeley keeps the original honest            |
| Debt         | Fix-it loop for the current player only                    | Everyone below zero fixes it in turn; the creditor is remembered                      | The original never made players pushed under by a card pay up                   |
| Length       | Until one player is left                                   | Quick (about 30 minutes, richest wins) or Classic (until one is left)                 | A session that fits an evening                                                  |
| Help         | `?` lists the valid answers                                | A coach: landing heat, payback times, trade meter, the recap's turning point          | Shows the maths the rivals use                                                  |
| Saving       | Save and restore by dumping the heap                       | The game saves itself whenever it waits for you                                       | Leaving the Hall loses nothing                                                  |
| Content      | The classic US board's names, prices, rents and cards      | Three boards of our own names, cards and tokens; our own economy, tuned by simulation | Those names, texts and numbers belong to a commercial game, not to the BSD code |
| New play     | —                                                          | 24 scenarios, a Daily Deal, a career with titles and packages                         | Reasons to come back that the original never needed                             |

## Quirks and bugs in the original

| Quirk                                                           | Kept?           | Note                                                               |
| --------------------------------------------------------------- | --------------- | ------------------------------------------------------------------ |
| The bank lends: buying never checks cash                        | yes             | As Berkeley 1980                                                   |
| No auction once two players are left                            | yes             | As Berkeley 1980; it counts players still in, as the original does |
| Resigning to the bank leaves lots unowned, unmortgaged and bare | yes             | Both rule sets                                                     |
| A utility's rent takes a fresh roll                             | yes             | Berkeley 1980                                                      |
| Trading a lot out of a built district strands its buildings     | yes             | Berkeley 1980; Standard forbids the trade until they are sold      |
| The income tax as a guess between a tenth and the flat sum      | yes             | Berkeley 1980                                                      |
| Doubles onto the go-to-lock-up space keep the turn              | fixed           | A bug                                                              |
| A player in debt on their own lot "resigns to themselves"       | fixed           | A bug                                                              |
| Debt enforced only on the current player                        | fixed           | Everyone below zero fixes it                                       |
| Exactly zero coins counts as debt                               | fixed           | Zero is fine                                                       |
| The dice can very rarely roll a 7                               | fixed           | Six faces                                                          |
| Only one pardon card goes back to its deck on resignation       | fixed           | Both go back                                                       |
| The biased shuffle                                              | fixed           | A fair shuffle, dealt in a cycle as before                         |
| The beauty-contest card pays 11                                 | kept, in spirit | Our second-prize card pays 11, as a nod                            |
| Save and restore cannot work in this copy                       | dropped         | The game saves itself instead                                      |

Details and evidence (file and line in the original) are in [NOTES.md](NOTES.md).

## Derived logic or data

The rules of play are adapted from `monop`'s C source (`execute.c`, `rent.c`, `houses.c`,
`morg.c`, `jail.c`, `cards.c`, `trade.c`, `spec.c`) in TypeScript and our own words. This covers:

- the order of a turn and three doubles to the lock-up;
- the lock-up's three tries;
- rent for groups, transit stops and utilities;
- even building and selling, mortgage at half and lifting at a tenth more;
- the debt and fix-it flow, and resignation;
- the card effect types;
- the two-players-left auction rule.

The notice is in [`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt) and
the row in [`CREDITS.md`](../../../CREDITS.md). No text, board name, card wording, price, rent
table or layout from the original's data files is used.

## Names

- **Our title** is _Deeds & Dice_. The boards are _Harbour City_, _Ring Colony_ and _Pop-up 1904_.
- **Every space, district, deck, card, token and rival is named by us.** Transit stops are ferries,
  shuttle pads or railway halts; the jail is the lock-up; the start is a pay-day space.
- **The commercial game's name** appears only in [`CREDITS.md`](../../../CREDITS.md), as the game
  the original's manual names.
