import type { DeckId } from '../boards/layout';
import { BOARDS, type BoardId } from '../boards/themes';

/**
 * The two decks. Their effects follow the kinds of card the 1980 program could play (collect,
 * collect from everyone, pay, pay everyone, go to a space, go back, go to the lock-up, the
 * nearest transit or utility, repairs per building, a card to keep); every board words them
 * its own way. Deck a is mostly money, deck b mostly movement. Second prize in deck a pays 11:
 * a nod to the original's own card file, whose beauty contest paid 11 rather than the usual 10.
 * The amounts, the repair rates and the spaces the movement cards send a token to are our own.
 */

export type CardEffect =
  | { readonly kind: 'collect'; readonly amount: number }
  | { readonly kind: 'collectEach'; readonly amount: number }
  | { readonly kind: 'pay'; readonly amount: number }
  | { readonly kind: 'payEach'; readonly amount: number }
  | { readonly kind: 'advance'; readonly to: number }
  | { readonly kind: 'back'; readonly spaces: number }
  | { readonly kind: 'lockup' }
  | { readonly kind: 'nearestTransit' }
  | { readonly kind: 'nearestUtility' }
  | { readonly kind: 'repairs'; readonly storey: number; readonly landmark: number }
  | { readonly kind: 'free' };

const collect = (amount: number): CardEffect => ({ kind: 'collect', amount });
const pay = (amount: number): CardEffect => ({ kind: 'pay', amount });
const advance = (to: number): CardEffect => ({ kind: 'advance', to });

export const EFFECTS: Readonly<Record<DeckId, readonly CardEffect[]>> = {
  a: [
    { kind: 'free' },
    collect(180),
    collect(120),
    collect(60),
    collect(30),
    collect(11),
    collect(90),
    { kind: 'collectEach', amount: 15 },
    pay(110),
    pay(45),
    pay(55),
    { kind: 'repairs', storey: 35, landmark: 110 },
    advance(0),
    { kind: 'lockup' },
    collect(40),
    collect(160),
  ],
  b: [
    { kind: 'free' },
    { kind: 'nearestTransit' },
    { kind: 'nearestTransit' },
    { kind: 'nearestUtility' },
    { kind: 'back', spaces: 3 },
    { kind: 'lockup' },
    advance(0),
    advance(23),
    advance(13),
    advance(15),
    advance(37),
    { kind: 'repairs', storey: 30, landmark: 90 },
    { kind: 'payEach', amount: 40 },
    pay(20),
    collect(55),
    collect(140),
  ],
};

/** Each board's wording, in the same order as the effects. `{start}`, `{lockup}` and `{to}` name spaces. */
const TEXTS: Readonly<Record<BoardId, Readonly<Record<DeckId, readonly string[]>>>> = {
  harbour: {
    a: [
      'A friend on the harbour watch owes you one. Keep this card to walk out of {lockup}.',
      'Your kite design wins the regatta poster prize. Collect 180.',
      'A crate of old ship’s lanterns sells well. Collect 120.',
      'Your aunt sends a postal order for your birthday. Collect 60.',
      'You return a lost sailor’s cap and get a reward. Collect 30.',
      'Second place in the sandcastle contest. Collect 11.',
      'The ferry company refunds a cancelled crossing. Collect 90.',
      'It’s your birthday on the pier! Every player gives you 15.',
      'The harbour master fines you for a tangled mooring. Pay 110.',
      'Your bicycle needs a new chain and two tyres. Pay 45.',
      'Seagulls steal your fish supper. Buy another for 55.',
      'Salt spray eats the paint. Pay 35 for each storey and 110 for each landmark you own.',
      'A tide-table mix-up: go straight to {start} and collect your pay.',
      'You fished in the reserved basin. Go to {lockup}, straight there, no pay on the way.',
      'Your sea shanty gets played on the radio. Collect 40.',
      'A ship in a bottle you built goes to a collector. Collect 160.',
    ],
    b: [
      'The harbour watch is pardoning one sailor this week. Keep this card to leave {lockup}.',
      'Catch the next boat: go to the nearest ferry. If it is owned, pay its owner twice the fare.',
      'All aboard! Move to the nearest ferry; an owner charges you double.',
      'Power cut on your street: go to the nearest utility. If it is owned, roll and pay twelve times the dice.',
      'Wrong turn at the fish market. Go back three spaces.',
      'Caught racing your tugboat in the harbour. Go to {lockup}, straight there.',
      'Payday comes early. Go to {start} and collect your pay.',
      'The beacon is lit on {to}. Go there, collecting pay if you pass {start}.',
      'Street party on {to}! Go there, collecting pay if you pass {start}.',
      'Take the morning boat from {to}. Go there, collecting pay if you pass {start}.',
      'A sunset stroll to {to}. Go there.',
      'The city inspects chimneys and railings. Pay 30 for each storey and 90 for each landmark.',
      'You are the harbour festival host. Pay every player 40.',
      'A parking ticket on the promenade. Pay 20.',
      'The city returns an overpaid water bill. Collect 55.',
      'Your mural wins the city prize. Collect 140.',
    ],
  },
  colony: {
    a: [
      'Medical lifts your quarantine early. Keep this card to leave {lockup}.',
      'Your algae recipe wins the galley contest. Collect 180.',
      'Spare oxygen credits are paid back. Collect 120.',
      'A message from home, with a little gift. Collect 60.',
      'You found a lost bolt in the airlock. The engineers give you 30.',
      'Second prize in the low-gravity juggling show. Collect 11.',
      'Your meteor-watch report is published. Collect 90.',
      'It’s your birthday in orbit! Every player sends you 15.',
      'Your rover dented a dome. Pay 110 for the patch.',
      'Your helmet visor needs polishing. Pay 45.',
      'A check-up at the medbay costs 55.',
      'Dust storm! Pay 35 for each storey and 110 for each landmark to clean the solar panels.',
      'Shift change: go to {start} and collect your pay.',
      'You opened the wrong hatch. Go to {lockup}, straight there.',
      'Your space-garden tomatoes sell out. Collect 40.',
      'Your model of the colony goes on show. Collect 160.',
    ],
    b: [
      'The council signs a pardon for you. Keep this card to leave {lockup}.',
      'Shuttle boarding now: go to the nearest pad. If it is owned, pay its owner double.',
      'Priority launch: move to the nearest pad; an owner charges you twice the fare.',
      'Your air filter needs swapping: go to the nearest utility. If it is owned, roll and pay twelve times the dice.',
      'Low gravity! You bounce back three spaces.',
      'An unregistered spacewalk. Go to {lockup}, straight there.',
      'Pay day on the ring: go to {start} and collect your pay.',
      'Star party at {to}. Go there, collecting pay if you pass {start}.',
      'Pillow fight in {to}! Go there, collecting pay if you pass {start}.',
      'Your shuttle leaves from {to}. Go there, collecting pay if you pass {start}.',
      'The captain invites you to {to}. Go there.',
      'Hull inspection. Pay 30 for each storey and 90 for each landmark.',
      'You host the ring-wide picnic. Pay every player 40.',
      'Your rover was parked on a landing zone. Pay 20.',
      'A refund on unused water rations. Collect 55.',
      'Your star chart is chosen for the observatory. Collect 140.',
    ],
  },
  popup: {
    a: [
      'A letter from the magistrate sets you free. Keep this card to leave the {lockup}.',
      'Your pressed-flower album wins first prize at the fair. Collect 180.',
      'Great-uncle’s pocket watch fetches a fine price. Collect 120.',
      'A birthday postal order arrives. Collect 60.',
      'You return a lost umbrella and are thanked handsomely. Collect 30.',
      'Second prize in the village flower show. Collect 11.',
      'The railway refunds a late train. Collect 90.',
      'It’s your birthday! Every player sends you 15.',
      'The vet’s visit for your sneezing cat costs 110.',
      'New boots from the cobbler. Pay 45.',
      'Your hat blows into the river. A new one costs 55.',
      'Spring cleaning! Pay 35 for each storey and 110 for each landmark.',
      'Go to {start} and collect your pay.',
      'Caught racing your penny-farthing on the pavement. Go to the {lockup}, straight there.',
      'Your sponge cake wins the tea-room ribbon. Collect 40.',
      'Your paper-cut silhouettes sell at the exhibition. Collect 160.',
    ],
    b: [
      'Hear ye! The mayor grants a pardon. Keep this card to leave the {lockup}.',
      'All aboard! Go to the nearest halt. If it is owned, pay its owner double.',
      'The express is leaving: move to the nearest halt; an owner charges you twice.',
      'The gas lamps need lighting: go to the nearest utility. If it is owned, roll and pay twelve times the dice.',
      'You forgot your gloves. Go back three spaces.',
      'Hear ye! Noise after dark. Go to the {lockup}, straight there.',
      'Hear ye! Pay day. Go to {start} and collect your pay.',
      'A lecture on the stars at {to}. Go there, collecting pay if you pass {start}.',
      'A towpath picnic on {to}. Go there, collecting pay if you pass {start}.',
      'Catch the morning train from {to}. Go there, collecting pay if you pass {start}.',
      'Tea at {to}. Go there.',
      'The parish inspects chimneys and drains. Pay 30 for each storey and 90 for each landmark.',
      'You judge the pie contest. Pay every player 40 for their pies.',
      'A fine for letting your goat roam. Pay 20.',
      'Your savings earn a little interest. Collect 55.',
      'Your inventions are shown at the Exhibition. Collect 140.',
    ],
  },
};

export const DECK_SIZE = 16;

/** A card's words on a board, with its spaces named. */
export function cardText(board: BoardId, deck: DeckId, card: number): string {
  const theme = BOARDS[board];
  const effect = EFFECTS[deck][card]!;
  const to = effect.kind === 'advance' ? theme.spaces[effect.to]! : '';
  return TEXTS[board][deck][card]!.replaceAll('{start}', theme.spaces[0]!)
    .replaceAll('{lockup}', theme.spaces[10]!)
    .replaceAll('{to}', to);
}
