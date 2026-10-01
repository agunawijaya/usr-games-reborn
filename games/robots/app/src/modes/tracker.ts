// The run tracker: everything the gamified layer keeps on top of the rules.
// Game.tsx tells it what each turn did; it answers with points (the crowd's
// multiplier included), the hype, the wave's call, and moments worth telling
// the player about. It never changes the game state.

import { type Call, callForWave, callLost, callMet, type CallKind, EMPTY_WAVE, makeCall, type WaveRecord } from './calls';
import { hypeAfter, tierIndex, tierOf } from './hype';
import type { MatchPlan } from './plans';
import { scoreTarget, TOUR } from './tour';

/** The original's bonus for clearing the level you skipped ahead to (60 robots' worth). */
export const ADVANCE_BONUS = 600;
export const ROBOT_POINTS = 10;

export type TurnReport = Readonly<{
  crashed: number;
  /** How much the original's score went up this turn (crashes plus any wait bonus paid). */
  classicGain: number;
  teleported: boolean;
  waited: boolean;
  /** Distance to the nearest robot after the turn (Infinity when none are left). */
  nearest: number;
  cleared: boolean;
  caught: boolean;
}>;

export type TrackerEvent =
  | { type: 'tier'; from: number; to: number }
  | { type: 'call-met'; call: Call }
  | { type: 'call-lost'; call: Call }
  | { type: 'advance-bonus'; points: number };

export type RunRecord = WaveRecord & Readonly<{
  wavesCleared: number;
  robotsCrashed: number;
  peakHype: number;
  callsMet: number;
}>;

export type RunSummary = Readonly<{
  points: number;
  classicScore: number;
  record: RunRecord;
  stamps: readonly CallKind[];
  /** Tour only: [won, score target, challenge]. */
  stars: readonly [boolean, boolean, boolean] | null;
  won: boolean;
}>;

export class RunTracker {
  points = 0;
  classicScore = 0;
  hype: number;
  chain = 0;
  wave: WaveRecord = EMPTY_WAVE;
  call: Call | null = null;
  callState: 'open' | 'met' | 'lost' = 'open';
  private run: RunRecord;
  private stamps: CallKind[] = [];
  private firstWave = true;
  private matchWon = false;

  constructor(
    readonly plan: MatchPlan,
    private readonly seed: number,
  ) {
    this.hype = plan.startHype;
    this.run = { ...EMPTY_WAVE, peakTier: tierIndex(this.hype), wavesCleared: 0, robotsCrashed: 0, peakHype: this.hype, callsMet: 0 };
  }

  get multiplier(): number {
    return tierOf(this.hype).multiplier;
  }

  startWave(level: number, robots: number): void {
    this.wave = { ...EMPTY_WAVE, peakTier: tierIndex(this.hype) };
    this.chain = 0;
    this.call = callForWave(this.plan, level, robots, this.seed);
    this.callState = 'open';
  }

  turn(t: TurnReport): TrackerEvent[] {
    const events: TrackerEvent[] = [];
    this.chain = t.crashed > 0 ? this.chain + t.crashed : 0;
    // Crashes pay at the crowd's volume before this turn: hype you built earlier is what pays.
    const crashPoints = t.crashed * ROBOT_POINTS;
    this.points += crashPoints * this.multiplier + Math.max(0, t.classicGain - crashPoints);
    this.classicScore += t.classicGain;
    const closeCall = !t.caught && !t.cleared && t.nearest <= 1;
    const before = tierIndex(this.hype);
    this.hype = hypeAfter(this.hype, { crashed: t.crashed, chain: this.chain, waited: t.waited, teleported: t.teleported, closeCall }, this.plan.hypeGain);
    const after = tierIndex(this.hype);
    if (after !== before) events.push({ type: 'tier', from: before, to: after });
    this.wave = {
      turns: this.wave.turns + 1,
      teleports: this.wave.teleports + (t.teleported ? 1 : 0),
      bestChain: Math.max(this.wave.bestChain, this.chain),
      peakTier: Math.max(this.wave.peakTier, after),
      waitCrashes: this.wave.waitCrashes + (t.waited ? t.crashed : 0),
      closeCalls: this.wave.closeCalls + (closeCall ? 1 : 0),
      waited: this.wave.waited || t.waited,
    };
    this.run = {
      turns: this.run.turns + 1,
      teleports: this.run.teleports + (t.teleported ? 1 : 0),
      bestChain: Math.max(this.run.bestChain, this.chain),
      peakTier: Math.max(this.run.peakTier, after),
      waitCrashes: this.run.waitCrashes + (t.waited ? t.crashed : 0),
      closeCalls: this.run.closeCalls + (closeCall ? 1 : 0),
      waited: this.run.waited || t.waited,
      wavesCleared: this.run.wavesCleared + (t.cleared ? 1 : 0),
      robotsCrashed: this.run.robotsCrashed + t.crashed,
      peakHype: Math.max(this.run.peakHype, this.hype),
      callsMet: this.run.callsMet,
    };
    if (this.call && this.callState === 'open') {
      if (callMet(this.call, this.wave, t.cleared)) {
        this.callState = 'met';
        this.points += this.call.reward;
        this.stamps.push(this.call.kind);
        this.run = { ...this.run, callsMet: this.run.callsMet + 1 };
        events.push({ type: 'call-met', call: this.call });
      } else if (callLost(this.call, this.wave)) {
        events.push({ type: 'call-lost', call: this.call });
        this.callState = 'lost';
      }
    }
    if (t.cleared && this.firstWave && this.plan.startWave > 1) {
      this.points += ADVANCE_BONUS;
      this.classicScore += ADVANCE_BONUS;
      events.push({ type: 'advance-bonus', points: ADVANCE_BONUS });
    }
    if (t.cleared) this.firstWave = false;
    return events;
  }

  /** Called when the final wave of a tour match is cleared. */
  winMatch(): void {
    this.matchWon = true;
  }

  summary(): RunSummary {
    const won = this.matchWon;
    let stars: RunSummary['stars'] = null;
    if (this.plan.mode === 'tour' && this.plan.tourIndex !== undefined) {
      const match = TOUR[this.plan.tourIndex];
      const challenge = makeCall(match.challenge.kind, match.challenge.target, 0);
      stars = [won, won && this.points >= scoreTarget(match), won && callMet(challenge, this.run, won)];
    }
    return { points: this.points, classicScore: this.classicScore, record: this.run, stamps: [...this.stamps], stars, won };
  }
}
