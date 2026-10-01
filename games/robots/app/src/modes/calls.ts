// Jumbotron calls: at the start of a wave the big screen may call for
// something extra. Meeting the call pays a bonus and stamps it on your trophy
// wall. Calls are picked from the wave's seed, so a daily showdown shows
// everyone the same calls.

import { RNG } from '../game/rng';
import { HYPE_TIERS } from './hype';
import type { MatchPlan } from './plans';

export type CallKind = 'no-teleport' | 'chain' | 'hype' | 'quick' | 'wait-crashes' | 'close-calls' | 'no-wait';

export type Call = Readonly<{ kind: CallKind; target: number; text: string; reward: number }>;

/** What happened during the wave so far, enough to judge any call. */
export type WaveRecord = Readonly<{
  turns: number;
  teleports: number;
  bestChain: number;
  peakTier: number;
  waitCrashes: number;
  closeCalls: number;
  waited: boolean;
}>;

export const EMPTY_WAVE: WaveRecord = { turns: 0, teleports: 0, bestChain: 0, peakTier: 0, waitCrashes: 0, closeCalls: 0, waited: false };

export const CALL_NAMES: Readonly<Record<CallKind, string>> = {
  'no-teleport': 'Feet on the glass',
  chain: 'Chain gang',
  hype: 'Raise the roof',
  quick: 'Against the clock',
  'wait-crashes': 'Patience pays',
  'close-calls': 'Living dangerously',
  'no-wait': 'Never stand still',
};

export function describeCall(kind: CallKind, target: number): string {
  switch (kind) {
    case 'no-teleport': return 'Clear this wave without teleporting';
    case 'chain': return `Make a chain of ${target}`;
    case 'hype': return `Get the crowd to ${HYPE_TIERS[target].name}`;
    case 'quick': return `Clear this wave in ${target} turns or fewer`;
    case 'wait-crashes': return `Crash ${target} robots while you wait`;
    case 'close-calls': return `Survive ${target} close calls`;
    case 'no-wait': return 'Clear this wave without waiting';
  }
}

export function makeCall(kind: CallKind, target: number, robots: number): Call {
  return { kind, target, text: describeCall(kind, target), reward: 100 + 5 * robots };
}

/** The call for one wave, or null on a quiet wave (about one in four). */
export function callForWave(plan: MatchPlan, level: number, robots: number, seed: number): Call | null {
  if (!plan.calls) return null;
  const rng = new RNG((seed ^ Math.imul(level, 0x9e3779b1)) >>> 0);
  if (rng.next() < 0.25) return null;
  const kinds: CallKind[] = ['chain', 'hype', 'quick', 'close-calls'];
  if (plan.teleports !== 0) kinds.push('no-teleport');
  if (plan.allowWait) kinds.push('wait-crashes', 'no-wait');
  const kind = rng.pick(kinds);
  switch (kind) {
    case 'chain': return makeCall(kind, robots >= 30 ? 5 : robots >= 20 ? 4 : 3, robots);
    case 'hype': return makeCall(kind, robots >= 30 ? 3 : 2, robots);
    case 'quick': return makeCall(kind, 20 + Math.round(robots * 0.6), robots);
    case 'wait-crashes': return makeCall(kind, Math.max(3, Math.round(robots / 8)), robots);
    case 'close-calls': return makeCall(kind, robots >= 30 ? 5 : 3, robots);
    default: return makeCall(kind, 0, robots);
  }
}

/** Calls you can still meet during the wave are shown as met only once the wave is cleared. */
export function callMet(call: Call, wave: WaveRecord, cleared: boolean): boolean {
  switch (call.kind) {
    case 'no-teleport': return cleared && wave.teleports === 0;
    case 'chain': return wave.bestChain >= call.target;
    case 'hype': return wave.peakTier >= call.target;
    case 'quick': return cleared && wave.turns <= call.target;
    case 'wait-crashes': return wave.waitCrashes >= call.target;
    case 'close-calls': return wave.closeCalls >= call.target;
    case 'no-wait': return cleared && !wave.waited;
  }
}

/** Calls that can no longer be met this wave (so the screen can say so). */
export function callLost(call: Call, wave: WaveRecord): boolean {
  switch (call.kind) {
    case 'no-teleport': return wave.teleports > 0;
    case 'quick': return wave.turns > call.target;
    case 'no-wait': return wave.waited;
    default: return false;
  }
}

/** Stamps on the trophy wall: bronze for the first, silver at five, gold at fifteen. */
export const STAMP_LEVELS = [1, 5, 15] as const;

export function stampLevel(count: number): 0 | 1 | 2 | 3 {
  if (count >= STAMP_LEVELS[2]) return 3;
  if (count >= STAMP_LEVELS[1]) return 2;
  if (count >= STAMP_LEVELS[0]) return 1;
  return 0;
}
