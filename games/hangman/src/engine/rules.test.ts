import { describe, expect, it } from 'vitest';
import { dailyShareLine, dailyWord } from './daily';
import {
  guess,
  lighthouseLetter,
  newRound,
  type Round,
  revealed,
  useLighthouse,
  WAVES_ALLOWED,
  wrongLetters,
} from './round';
import {
  addWord,
  average,
  averageWithWordInPlay,
  EMPTY_TALLY,
  LOST_WORD_SCORE,
  wordScore,
} from './score';

function play(word: string, letters: string): Round {
  let round = newRound(word);
  for (const letter of letters) {
    const outcome = guess(round, letter);
    if (outcome.kind === 'hit' || outcome.kind === 'miss') round = outcome.round;
  }
  return round;
}

describe('a round', () => {
  it('allows seven wrong letters, as the original did', () => {
    expect(WAVES_ALLOWED).toBe(7);
    const almost = play('lantern', 'bcdfghi');
    expect(almost.waves).toBe(7);
    expect(almost.status).toBe('lost');
    expect(play('lantern', 'bcdfgh').status).toBe('playing');
  });

  it('reveals every copy of a right letter at once', () => {
    const outcome = guess(newRound('seashell'), 's');
    expect(outcome.kind).toBe('hit');
    if (outcome.kind === 'hit') expect(outcome.positions).toEqual([0, 3]);
  });

  it('turns away a repeated letter without a wave', () => {
    const round = play('harbor', 'hz');
    expect(guess(round, 'z')).toEqual({ kind: 'repeat', letter: 'z' });
    expect(guess(round, 'h')).toEqual({ kind: 'repeat', letter: 'h' });
    expect(round.waves).toBe(1);
  });

  it('turns away anything that is not a letter, and takes capitals as letters', () => {
    expect(guess(newRound('harbor'), '7').kind).toBe('not-a-letter');
    expect(guess(newRound('harbor'), ' ').kind).toBe('not-a-letter');
    expect(guess(newRound('harbor'), 'ab').kind).toBe('not-a-letter');
    expect(guess(newRound('harbor'), 'H').kind).toBe('hit');
  });

  it('is won when every letter is found', () => {
    const round = play('dune', 'xdune');
    expect(round.status).toBe('won');
    expect(round.waves).toBe(1);
    expect(guess(round, 'q')).toEqual({ kind: 'over' });
  });

  it('shows the word with gaps and lists wrong letters in order', () => {
    const round = play('harbor', 'rzoq');
    expect(revealed(round)).toEqual([null, null, 'r', null, 'o', 'r']);
    expect(wrongLetters(round)).toEqual(['z', 'q']);
  });
});

describe('the tide average', () => {
  it('scores a lost word as nine, two more than the seven waves allowed', () => {
    expect(LOST_WORD_SCORE).toBe(9);
    expect(wordScore(play('lantern', 'bcdfghi'))).toBe(9);
    expect(wordScore(play('lantern', 'bclantre'))).toBe(2);
  });

  it('averages finished words like golf: lower is better', () => {
    let tally = EMPTY_TALLY;
    expect(average(tally)).toBeNull();
    tally = addWord(tally, 2);
    tally = addWord(tally, 9);
    tally = addWord(tally, 1);
    expect(average(tally)).toBe(4);
  });

  it('counts the word in play in the running figure, as the original did', () => {
    const tally = addWord(addWord(EMPTY_TALLY, 2), 4);
    expect(averageWithWordInPlay(tally, 3)).toBe(3);
    expect(averageWithWordInPlay(EMPTY_TALLY, 0)).toBe(0);
  });
});

describe('the Lighthouse', () => {
  it('chooses the hidden letter that fills the most slots', () => {
    expect(lighthouseLetter(newRound('banana'))).toBe('a');
    expect(lighthouseLetter(play('banana', 'a'))).toBe('n');
  });

  it('breaks ties toward the letter more common in English', () => {
    expect(lighthouseLetter(newRound('quiz'))).toBe('i');
  });

  it('costs a wave and reveals the letter', () => {
    const outcome = useLighthouse(newRound('banana'))!;
    expect(outcome.letter).toBe('a');
    expect(outcome.positions).toEqual([1, 3, 5]);
    expect(outcome.round.waves).toBe(1);
    expect(outcome.round.lighthouseUses).toBe(1);
  });

  it('is out of reach when one more wave would bring the castle down', () => {
    const six = play('lantern', 'bcdfgh');
    expect(six.waves).toBe(6);
    expect(lighthouseLetter(six)).toBeNull();
    expect(useLighthouse(six)).toBeNull();
  });
});

describe('the Daily Word', () => {
  const pool = ['anchor', 'breeze', 'coral', 'dune', 'eddy', 'ferry', 'gull'];

  it('gives everyone the same word on the same day', () => {
    expect(dailyWord(pool, 42)).toBe(dailyWord(pool, 42));
  });

  it('uses every word in the pool before any comes back', () => {
    const days = pool.map((_, i) => dailyWord(pool, i + 1));
    expect(new Set(days).size).toBe(pool.length);
    expect(dailyWord(pool, pool.length + 1)).toBe(days[0]);
  });

  it('shares waves, never the word', () => {
    const round = play('coral', 'zcxoral');
    expect(dailyShareLine('Before the Tide', 42, round)).toBe(
      'Before the Tide #42 · 🏰 2 waves · 🟨🟨⬜⬜⬜⬜⬜',
    );
    expect(dailyShareLine('Before the Tide', 42, play('coral', 'bdefghi'))).toBe(
      'Before the Tide #42 · 🌊 the tide won · 🟨🟨🟨🟨🟨🟨🟨',
    );
    expect(dailyShareLine('Before the Tide', 7, play('dune', 'dune'))).toContain('not a single');
  });
});
