// Orchard Crawl — what a crawl changes: an orchard's stars and best, the almanac, the Daily
// record and the totals, and the packages that follow. Pure: it takes the saved progress and
// returns the next one with a list of what is new, so the desk can tell the player and the Hall.

import { PAGES, pagesFound } from './almanac.mjs';
import { CHALLENGES, pointsFor } from './challenges.mjs';
import { ORCHARDS, openOrchards, orchardById, seasonComplete } from './orchards.mjs';
import { STARS_PER_ORCHARD, newStars, starsOf } from './stars.mjs';

/**
 * @typedef {import('./stars.mjs').CrawlSummary} CrawlSummary
 * @typedef {{ best: Record<string, number>, stars: Record<string, string[]>, pages: string[],
 *   dailies: Record<string, { home: boolean, score: number, apples: number, stars: number }>,
 *   crawls: number, homes: number, crashes: number, apples: number, frogs: number,
 *   longest: number, bestBite: number, dailyCrawls: number,
 *   freeBest: { pure: number, wild: number }, lastOrchard: string,
 *   challenges: Record<string, { done: boolean, medal?: number, tries: number }> }} Progress
 * @typedef {{ kind: 'orchard' | 'daily' | 'free', orchardId?: string, mode?: 'pure' | 'wild',
 *   dailyKey?: string, summary: CrawlSummary }} Crawl
 */

/** @returns {Progress} */
export function freshProgress() {
  return {
    best: {},
    stars: {},
    pages: [],
    dailies: {},
    crawls: 0,
    homes: 0,
    crashes: 0,
    apples: 0,
    frogs: 0,
    longest: 0,
    bestBite: 0,
    dailyCrawls: 0,
    freeBest: { pure: 0, wild: 0 },
    lastOrchard: ORCHARDS[0].id,
    challenges: {},
  };
}

export const STARS_IN_ALL = ORCHARDS.length * STARS_PER_ORCHARD;
const DAYS_KEPT = 60;
/** The milestone a free crawl, which only ever ends in a crash, counts as a win from (ADR 0011). */
export const FREE_MILESTONE = 100;
export const BIG_BITE = 20;
export const HEDGE_LENGTH = 100;
export const OLD_RULES_SCORE = 150;

/** Orchards whose burrow has been reached at least once. */
export function clearedOrchards(progress) {
  return ORCHARDS.filter((o) => progress.stars[o.id]?.includes('home')).map((o) => o.id);
}

export function starCount(progress) {
  return Object.values(progress.stars).reduce((sum, held) => sum + held.length, 0);
}

/** Whether a crawl was played one apple at a time, the 1980 way. */
function pureCrawl(crawl) {
  if (crawl.kind === 'free') return crawl.mode === 'pure';
  return orchardById(crawl.orchardId).apples === 'single';
}

/** @param {Progress} before @param {Crawl} crawl */
export function recordCrawl(before, crawl) {
  const { summary } = crawl;
  const next = structuredClone(before);
  next.crawls++;
  if (summary.home) next.homes++;
  else next.crashes++;
  next.apples += summary.harvested;
  next.frogs += summary.frogs;
  next.longest = Math.max(next.longest, summary.length);
  next.bestBite = Math.max(next.bestBite, summary.bestBite);

  let stars = [];
  let opened = null;
  let firstClear = false;
  let newBest = false;
  if (crawl.kind === 'orchard') {
    const orchard = orchardById(crawl.orchardId);
    const held = before.stars[orchard.id] ?? [];
    stars = newStars(orchard, summary, held);
    next.stars[orchard.id] = starsOf(orchard)
      .map((star) => star.id)
      .filter((id) => held.includes(id) || stars.includes(id));
    next.lastOrchard = orchard.id;
    if (summary.home && summary.score > (before.best[orchard.id] ?? -1)) {
      newBest = before.best[orchard.id] !== undefined;
      next.best[orchard.id] = summary.score;
    }
    firstClear = stars.includes('home');
    if (firstClear) {
      const after = ORCHARDS[ORCHARDS.indexOf(orchard) + 1];
      if (after) opened = after;
    }
  }

  let firstDaily = false;
  if (crawl.kind === 'daily' && crawl.dailyKey && !before.dailies[crawl.dailyKey]) {
    firstDaily = true;
    next.dailyCrawls++;
    const orchard = orchardById(crawl.orchardId);
    next.dailies[crawl.dailyKey] = {
      home: summary.home,
      score: summary.score,
      apples: summary.harvested,
      stars: starsOf(orchard).filter((star) => star.met(summary)).length,
    };
    const keys = Object.keys(next.dailies).sort().slice(-DAYS_KEPT);
    next.dailies = Object.fromEntries(keys.map((key) => [key, next.dailies[key]]));
  }

  if (crawl.kind === 'free' && crawl.mode) {
    next.freeBest[crawl.mode] = Math.max(next.freeBest[crawl.mode] ?? 0, summary.score);
  }

  const pages = pagesFound(summary, before.pages);
  next.pages.push(...pages);
  return {
    progress: next,
    stars,
    pages,
    opened,
    firstClear,
    newBest,
    firstDaily,
    completed: firstClear && seasonComplete(clearedOrchards(next)),
    packages: packagesEarned(next, summary, pureCrawl(crawl)),
  };
}

/** The packages (manifest.json) this progress and this crawl have earned. */
export function packagesEarned(progress, summary, pure = false) {
  const cleared = clearedOrchards(progress);
  const ids = [];
  if (summary.home) ids.push('first-home');
  if (summary.bestBite >= BIG_BITE) ids.push('big-bite');
  if (progress.frogs > 0) ids.push('frog');
  if (pure && summary.score >= OLD_RULES_SCORE) ids.push('old-rules');
  if (progress.dailyCrawls >= 7) ids.push('daily-seven');
  if (progress.longest >= HEDGE_LENGTH) ids.push('hedge');
  if (summary.rivalCrashes > 0) ids.push('out-crawled');
  if (summary.gardenerSeenOff > 0) ids.push('brim');
  if (PAGES.every((page) => progress.pages.includes(page.id))) ids.push('almanac');
  if (openOrchards(cleared).includes(ORCHARDS[ORCHARDS.length - 1].id)) ids.push('night-shift');
  if (starCount(progress) >= STARS_IN_ALL) ids.push('all-stars');
  if (seasonComplete(cleared)) ids.push('season-end');
  return ids;
}

/** Points earned in the challenges so far. */
export function challengePoints(progress) {
  return CHALLENGES.reduce((sum, c) => sum + pointsFor(c, progress.challenges[c.id]), 0);
}

/**
 * What a challenge crawl changes: its result (done, the best medal) and the totals.
 * @param {Progress} before
 * @param {import('./challenges.mjs').Challenge} challenge
 * @param {{ success: boolean, medal?: number }} outcome
 * @param {CrawlSummary} summary
 */
export function recordChallenge(before, challenge, outcome, summary) {
  const next = structuredClone(before);
  next.challenges ??= {};
  next.crawls++;
  if (summary.home) next.homes++;
  else if (!outcome.success) next.crashes++;
  next.apples += summary.harvested;
  next.frogs += summary.frogs;
  next.longest = Math.max(next.longest, summary.length);
  next.bestBite = Math.max(next.bestBite, summary.bestBite);
  const held = before.challenges?.[challenge.id] ?? { done: false, medal: 0, tries: 0 };
  const result = {
    done: held.done || outcome.success,
    medal: Math.max(held.medal ?? 0, outcome.medal ?? 0),
    tries: held.tries + 1,
  };
  next.challenges[challenge.id] = result;
  const gained = pointsFor(challenge, result) - pointsFor(challenge, held);
  const firstDone = outcome.success && !held.done;
  const opened = firstDone ? (CHALLENGES.find((c) => c.family === challenge.family && c.tier === challenge.tier + 1) ?? null) : null;
  const pages = pagesFound(summary, before.pages);
  next.pages.push(...pages);
  return {
    progress: next,
    gained,
    firstDone,
    newMedal: (outcome.medal ?? 0) > (held.medal ?? 0) ? outcome.medal : 0,
    opened,
    pages,
    packages: packagesEarned(next, summary, false),
  };
}
