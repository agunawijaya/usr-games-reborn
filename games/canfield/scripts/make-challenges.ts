import { writeFileSync } from 'node:fs';
import { createRng } from '@usr-games/kit';
import { type CardId, rankOf } from '@usr-games/kit/cards';
import { shuffledDeal } from '../src/engine/deals';
import { openDeal, type Move, type RuleSet } from '../src/engine/rules';
import { solve, type SolveGoal } from '../src/engine/solver';
import { type Challenge, type Condition, encodeMove } from '../src/modes/challenges';

/**
 * Finds the twenty-four challenge deals and proves each goal reachable with a line of play,
 * then writes `src/modes/challenges.json`. Deterministic: the same seeds give the same file.
 * `pnpm --filter @usr-games/game-canfield exec tsx scripts/make-challenges.ts`
 */

interface Found {
  deal: CardId[];
  line: Move[];
}

const BUDGET = 200_000;

function solveDeal(
  deal: CardId[],
  rules: RuleSet,
  options: { maxRuns?: number; goal?: SolveGoal; budget?: number } = {},
) {
  return solve(openDeal(deal, rules).layout, {
    nodeBudget: options.budget ?? BUDGET,
    maxRuns: options.maxRuns,
    goal: options.goal,
  });
}

/** The first seeded deal the solver wins whose difficulty and base suit the slot. */
function findWin(
  prefix: string,
  test: (deal: CardId[], nodes: number) => boolean = () => true,
  maxRuns?: number,
): Found {
  for (let k = 0; k < 5000; k++) {
    const deal = shuffledDeal(`${prefix}/${k}`);
    const verdict = solveDeal(deal, 'standard', { maxRuns });
    if (verdict.result === 'winnable' && test(deal, verdict.nodes))
      return { deal, line: verdict.line };
  }
  throw new Error(`no deal for ${prefix}`);
}

/** A deal lost under Standard rules that Relaxed rules can win. */
function findRelaxedOnly(prefix: string, minNodes = 0): Found {
  for (let k = 0; k < 5000; k++) {
    const deal = shuffledDeal(`${prefix}/${k}`);
    if (solveDeal(deal, 'standard', { budget: 400_000 }).result !== 'unwinnable') continue;
    const relaxed = solveDeal(deal, 'relaxed');
    if (relaxed.result === 'winnable' && relaxed.nodes >= minNodes)
      return { deal, line: relaxed.line };
  }
  throw new Error(`no relaxed-only deal for ${prefix}`);
}

/** A deal the solver cannot win quickly that still lets `count` cards home. */
function findHome(prefix: string, count: number): Found {
  for (let k = 0; k < 5000; k++) {
    const deal = shuffledDeal(`${prefix}/${k}`);
    if (solveDeal(deal, 'standard', { budget: 60_000 }).result === 'winnable') continue;
    const verdict = solveDeal(deal, 'standard', { goal: { home: count } });
    if (verdict.result === 'winnable') return { deal, line: verdict.line };
  }
  throw new Error(`no deal for ${count} home`);
}

/** A seeded deal whose reserve can be emptied before the talon first turns over. */
function findReserve(prefix: string): Found {
  for (let k = 0; k < 20_000; k++) {
    const deal = shuffledDeal(`${prefix}/${k}`);
    const verdict = solveDeal(deal, 'standard', {
      maxRuns: 1,
      goal: 'empty-reserve',
      budget: 20_000,
    });
    if (verdict.result === 'winnable') return { deal, line: verdict.line };
  }
  throw new Error(`no deal for ${prefix}`);
}

/**
 * Swaps cards in a random deal, keeping each swap that lets the goal come no further away,
 * until the goal is reached within the run limit. `keepBase` leaves the base card alone.
 */
function climb(
  prefix: string,
  maxRuns: number,
  goal: SolveGoal,
  keepBase = false,
  baseRank?: number,
): Found {
  const rng = createRng(`${prefix}:climb`);
  let deal = shuffledDeal(prefix);
  if (baseRank !== undefined) {
    const at = deal.findIndex((card, i) => i !== 13 && rankOf(card) === baseRank);
    [deal[13], deal[at]] = [deal[at]!, deal[13]!];
  }
  const score = (candidate: CardId[]) => {
    const verdict = solveDeal(candidate, 'standard', { maxRuns, goal, budget: 20_000 });
    return { value: verdict.result === 'winnable' ? 100 : verdict.bestHome, verdict };
  };
  let best = score(deal);
  for (let i = 0; i < 40_000 && best.value < 100; i++) {
    const next = [...deal];
    const a = rng.int(0, 51);
    const b = rng.int(0, 51);
    if (keepBase && (a === 13 || b === 13)) continue;
    [next[a], next[b]] = [next[b]!, next[a]!];
    const tried = score(next);
    if (tried.value >= best.value) {
      best = tried;
      deal = next;
    }
  }
  if (best.verdict.result !== 'winnable') throw new Error(`climb failed for ${prefix}`);
  return { deal, line: best.verdict.line };
}

const base = (rank: number) => (deal: CardId[]) => rankOf(deal[13]!) === rank;
const between = (low: number, high: number) => (_: CardId[], nodes: number) =>
  nodes >= low && nodes <= high;

const W: Condition = { kind: 'win' };

interface Slot {
  set: string;
  title: string;
  rules: RuleSet;
  conditions: Condition[];
  find: () => Found;
}

const SLOTS: Slot[] = [
  {
    set: 'Seedlings',
    title: 'First steps',
    rules: 'standard',
    conditions: [W],
    find: () => findWin('c01', between(0, 400)),
  },
  {
    set: 'Seedlings',
    title: 'Hands off the counter',
    rules: 'standard',
    conditions: [W, { kind: 'no-insight' }],
    find: () => findWin('c02', between(0, 1500)),
  },
  {
    set: 'Seedlings',
    title: 'Seventh heaven',
    rules: 'standard',
    conditions: [W],
    find: () => findWin('c03', base(7)),
  },
  {
    set: 'Seedlings',
    title: 'Half the deck',
    rules: 'standard',
    conditions: [{ kind: 'cards-home', count: 26 }],
    find: () => findHome('c04', 26),
  },
  {
    set: 'Seedlings',
    title: 'Five minutes',
    rules: 'standard',
    conditions: [W, { kind: 'time', seconds: 300 }],
    find: () => findWin('c05', between(0, 600)),
  },
  {
    set: 'Seedlings',
    title: 'Thirteen down',
    rules: 'standard',
    conditions: [{ kind: 'reserve-first-pass' }],
    find: () => findReserve('c06'),
  },
  {
    set: 'Stems',
    title: 'Three passes',
    rules: 'standard',
    conditions: [W, { kind: 'max-passes', passes: 3 }],
    find: () => climb('c07', 3, 'win'),
  },
  {
    set: 'Stems',
    title: 'Clean hands',
    rules: 'standard',
    conditions: [W, { kind: 'clean-hands' }],
    find: () => findWin('c08', between(1500, 20000)),
  },
  {
    set: 'Stems',
    title: 'Thirty-nine home',
    rules: 'standard',
    conditions: [{ kind: 'cards-home', count: 39 }],
    find: () => findHome('c09', 39),
  },
  {
    set: 'Stems',
    title: 'Round the corner',
    rules: 'standard',
    conditions: [W],
    find: () => findWin('c10', base(13)),
  },
  {
    set: 'Stems',
    title: 'Loosened rules',
    rules: 'relaxed',
    conditions: [W],
    find: () => findRelaxedOnly('c11'),
  },
  {
    set: 'Stems',
    title: 'From the ace',
    rules: 'standard',
    conditions: [W],
    find: () => findWin('c12', base(1)),
  },
  {
    set: 'Leaves',
    title: 'Two passes',
    rules: 'standard',
    conditions: [W, { kind: 'max-passes', passes: 2 }],
    find: () => climb('c13', 2, 'win'),
  },
  {
    set: 'Leaves',
    title: 'Nerve',
    rules: 'standard',
    conditions: [W, { kind: 'no-insight' }, { kind: 'clean-hands' }],
    find: () => findWin('c14', between(5000, 60000)),
  },
  {
    set: 'Leaves',
    title: 'A courtly start',
    rules: 'standard',
    conditions: [W],
    find: () => findWin('c15', base(12)),
  },
  {
    set: 'Leaves',
    title: 'Forty-five home',
    rules: 'standard',
    conditions: [{ kind: 'cards-home', count: 45 }],
    find: () => findHome('c16', 45),
  },
  {
    set: 'Leaves',
    title: 'Three minutes',
    rules: 'standard',
    conditions: [W, { kind: 'time', seconds: 180 }],
    find: () => findWin('c17', between(0, 300)),
  },
  {
    set: 'Leaves',
    title: 'The long way round',
    rules: 'relaxed',
    conditions: [W],
    find: () => findRelaxedOnly('c18', 2000),
  },
  {
    set: 'Blooms',
    title: 'One pass',
    rules: 'standard',
    conditions: [W, { kind: 'max-passes', passes: 1 }],
    find: () => climb('c19', 1, 'win'),
  },
  {
    set: 'Blooms',
    title: 'The stubborn one',
    rules: 'standard',
    conditions: [W],
    find: () => findWin('c20', between(40000, 200000)),
  },
  {
    set: 'Blooms',
    title: 'One pass, no peeking',
    rules: 'standard',
    conditions: [W, { kind: 'max-passes', passes: 1 }, { kind: 'no-insight' }],
    find: () => climb('c21', 1, 'win'),
  },
  {
    set: 'Blooms',
    title: 'Forty-eight home',
    rules: 'standard',
    conditions: [{ kind: 'cards-home', count: 48 }],
    find: () => findHome('c22', 48),
  },
  {
    set: 'Blooms',
    title: 'Two passes, clean hands',
    rules: 'standard',
    conditions: [W, { kind: 'max-passes', passes: 2 }, { kind: 'clean-hands' }],
    find: () => climb('c23', 2, 'win'),
  },
  {
    set: 'Blooms',
    title: 'One pass from a seven',
    rules: 'standard',
    conditions: [W, { kind: 'max-passes', passes: 1 }],
    find: () => climb('c24', 1, 'win', true, 7),
  },
];

const challenges: Challenge[] = SLOTS.map((slot, i) => {
  const started = performance.now();
  const found = slot.find();
  const number = i + 1;
  process.stdout.write(
    `${String(number).padStart(2)} ${slot.title.padEnd(26)} base ${rankOf(found.deal[13]!)} · ${found.line.length} moves · ${((performance.now() - started) / 1000).toFixed(1)} s\n`,
  );
  return {
    id: `c${String(number).padStart(2, '0')}`,
    number,
    set: slot.set,
    title: slot.title,
    rules: slot.rules,
    conditions: slot.conditions,
    deal: found.deal,
    proof: found.line.map(encodeMove),
  };
});

const target = new URL('../src/modes/challenges.json', import.meta.url);
writeFileSync(target, `${JSON.stringify(challenges)}\n`);
process.stdout.write(`wrote ${challenges.length} challenges\n`);
