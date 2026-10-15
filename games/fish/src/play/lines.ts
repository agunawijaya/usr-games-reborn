import type { RivalKind } from '../render/pond-view';

/**
 * What each rival says, in their own voice. Otto is cheerful and a bit scattered, Hazel precise
 * and a little grand, Miso cool and quietly pleased with herself. Every line is short enough to
 * read in a glance and kind enough for any age.
 */

export type LineKind =
  'goFish' | 'delighted' | 'grumpy' | 'asks' | 'luckyCast' | 'book' | 'tauntWin' | 'tauntLose';

export const LINES: Readonly<Record<RivalKind, Readonly<Record<LineKind, readonly string[]>>>> = {
  otter: {
    goFish: ['Nope! Go fish!', 'Not a one. Fish away!', 'Hmm… nope! Splash splash!'],
    delighted: ['Ooh, thank you!', 'For me? Hooray!', 'Yes! My turn still?'],
    grumpy: ['Aw, my favourites!', 'Hey, I needed those…', 'Oh, otter-ly unfair!'],
    asks: ['Got any {rank}?', 'Ooh — {rank}? Please?'],
    luckyCast: ['Look what I caught!', 'A {rank}! Lucky me!'],
    book: ['Four of them! Wheee!', 'Into the bucket!'],
    tauntWin: ['Did you hide a fish up your sleeve?'],
    tauntLose: ['I win! Wait… I win? I win!'],
  },
  heron: {
    goFish: ['None here. Do go fish.', 'I have none, dear. Go fish.', 'Not today. Fish, please.'],
    delighted: ['Just as I remembered.', 'Splendid. I’ll keep those.', 'Thank you, darling.'],
    grumpy: ['Hmph. Well taken.', 'How very observant.', 'I shall remember that.'],
    asks: ['May I have your {rank}?', 'Your {rank}, if you please.'],
    luckyCast: ['Precisely the {rank} I wanted.', 'As expected.'],
    book: ['A complete set. Lovely.', 'Into the bucket, neatly.'],
    tauntWin: ['You must have a monocle of your own.'],
    tauntLose: ['My memory never fails me. Well, rarely.'],
  },
  cat: {
    goFish: ['Nope. Go fish.', 'Not a whisker of one. Fish!', 'Mrrp. Go fish.'],
    delighted: ['Purrfect.', 'I knew you had them.', 'Mine now. Mrrr.'],
    grumpy: ['…Fine. Take them.', 'Hiss. Lucky guess.', 'I was saving those.'],
    asks: ['{rank}. Now.', 'I’ll take your {rank}.'],
    luckyCast: ['Naturally.', 'The pond agrees with me.'],
    book: ['Four. As planned.', 'Purrfect set.'],
    tauntWin: ['You peeked. Admit it, you peeked.'],
    tauntLose: ['Nine lives, nine wins. Mrrp.'],
  },
};

/** A line for the moment, chosen by a number the caller keeps (so replays say the same). */
export function lineFor(kind: RivalKind, moment: LineKind, pick: number, rank?: string): string {
  const options = LINES[kind][moment];
  const line = options[Math.abs(pick) % options.length]!;
  const said = rank ? line.replace('{rank}', rank) : line;
  // A rank can open the line ("Sevens. Now."): every line starts with a capital.
  return said.charAt(0).toUpperCase() + said.slice(1);
}
