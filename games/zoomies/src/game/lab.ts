import { createPatternMind, PIP_PATTERN } from '../rivals/pip';
import { playNight } from '../rivals/run';

/**
 * The Pattern Lab: a pattern plays five fixed Long Nights by itself, exactly as Pip's
 * Y H B J N L U K does, and the two totals are compared. The nights never change, so a score
 * means the same thing on every device and every day.
 */

export const LAB_NIGHTS = ['lab-1', 'lab-2', 'lab-3', 'lab-4', 'lab-5'] as const;

export interface LabResult {
  readonly pattern: string;
  readonly nights: readonly { seed: string; score: number; waves: number }[];
  readonly total: number;
}

export function runPattern(pattern: string): LabResult {
  const nights = LAB_NIGHTS.map((seed) => {
    const run = playNight(seed, createPatternMind(pattern), {
      maxWaves: 30,
      maxTurnsPerWave: 1500,
    });
    return { seed, score: run.score, waves: run.wavesCleared };
  });
  return { pattern, nights, total: nights.reduce((sum, n) => sum + n.score, 0) };
}

let pipCache: LabResult | null = null;

export function pipResult(): LabResult {
  pipCache ??= runPattern(PIP_PATTERN);
  return pipCache;
}
