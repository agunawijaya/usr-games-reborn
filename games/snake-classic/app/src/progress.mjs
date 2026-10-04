// Talon's Shadow — what a flight changes: best hauls, stamps, the field book, the Daily record
// and the totals, and the packages that follow; and what a challenge changes: its best and its
// stars. Pure: it takes the saved progress and returns the
// next one with a list of what is new, so the desk can tell the player and the Hall.

import { pagesFound, PAGES } from './book.mjs';
import { CHALLENGES, starsFor } from './challenges.mjs';
import { newStamps, STAMPS_IN_ALL } from './contracts.mjs';
import { expeditionComplete, isCleared, openRegions, REGIONS, regionById, regionOpenedBy } from './regions.mjs';

/**
 * @typedef {import('./contracts.mjs').FlightSummary} FlightSummary
 * @typedef {{ bestHaul: Record<string, number>, stamps: string[], pages: string[],
 *   dailies: Record<string, { escaped: boolean, fruit: number, dodges: number }>,
 *   flights: number, escapes: number, catches: number, fruitSecured: number, divesDodged: number,
 *   dailyFlights: number, lastRegion: string,
 *   challenges: Record<string, { best: number, stars: number, plays: number }> }} Progress
 */

/** @returns {Progress} */
export function freshProgress() {
  return {
    bestHaul: {},
    stamps: [],
    pages: [],
    dailies: {},
    flights: 0,
    escapes: 0,
    catches: 0,
    fruitSecured: 0,
    divesDodged: 0,
    dailyFlights: 0,
    lastRegion: REGIONS[0].id,
    challenges: {},
  };
}

const DAYS_KEPT = 60;

/**
 * @param {Progress} before
 * @param {{ regionId: string, summary: FlightSummary, daily: string | null }} flight
 *   `daily` is the date key when this was the Daily Flight
 */
export function recordFlight(before, { regionId, summary, daily }) {
  const next = structuredClone(before);
  next.flights++;
  next.divesDodged += summary.dodges;
  if (summary.escaped) {
    next.escapes++;
    next.fruitSecured += summary.fruit;
  } else {
    next.catches++;
  }
  const bestBefore = before.bestHaul[regionId];
  const region = regionById(regionId);
  const stamps = daily ? [] : newStamps(regionId, summary, before.stamps);
  const opened = !daily && summary.escaped ? regionOpenedBy(regionId, summary.fruit, bestBefore) : null;
  if (!daily) {
    next.lastRegion = regionId;
    if (summary.escaped && summary.fruit > (bestBefore ?? -1)) next.bestHaul[regionId] = summary.fruit;
    next.stamps.push(...stamps);
  }
  const pages = pagesFound(regionId, summary, before.pages);
  next.pages.push(...pages);
  let firstDaily = false;
  if (daily && !before.dailies[daily]) {
    firstDaily = true;
    next.dailyFlights++;
    next.dailies[daily] = { escaped: summary.escaped, fruit: summary.fruit, dodges: summary.dodges };
    const keys = Object.keys(next.dailies).sort().slice(-DAYS_KEPT);
    next.dailies = Object.fromEntries(keys.map((key) => [key, next.dailies[key]]));
  }
  const newBest = summary.escaped && !daily && summary.fruit > (bestBefore ?? 0) && (bestBefore ?? 0) > 0;
  const firstClear = !daily && !isCleared(region, before.bestHaul) && isCleared(region, next.bestHaul);
  return {
    progress: next,
    stamps,
    pages,
    opened,
    firstDaily,
    newBest,
    firstClear,
    completed: firstClear && expeditionComplete(next.bestHaul),
    packages: packagesEarned(next, summary),
  };
}

/**
 * A challenge played: its best score and its stars are kept (the most ever earned).
 * @param {Progress} before
 * @param {{ id: string, score: number, thresholds: number[] }} played
 */
export function recordChallenge(before, { id, score, thresholds }) {
  const next = structuredClone(before);
  const was = next.challenges[id] ?? { best: 0, stars: 0, plays: 0 };
  const stars = starsFor(score, thresholds);
  next.challenges[id] = { best: Math.max(was.best, score), stars: Math.max(was.stars, stars), plays: was.plays + 1 };
  return {
    progress: next,
    stars,
    newBest: was.plays > 0 && score > was.best,
    newStars: Math.max(0, stars - was.stars),
    packages: challengePackages(next),
  };
}

/** The packages the challenges have earned: a star in every one, and a field filled to the last cell. */
export function challengePackages(progress) {
  const ids = [];
  if (CHALLENGES.every((c) => (progress.challenges[c.id]?.stars ?? 0) >= 1)) ids.push('challenger');
  if ((progress.challenges.fill?.best ?? 0) >= 100) ids.push('full-field');
  return ids;
}

/** The packages (manifest.json) this progress and this flight have earned. */
export function packagesEarned(progress, summary) {
  const ids = [];
  if (summary.escaped && summary.fruit > 0) ids.push('first-escape');
  if (summary.escaped && summary.fruit === 0) ids.push('empty-handed');
  if (summary.dodges >= 5) ids.push('dodger');
  if (progress.dailyFlights >= 7) ids.push('daily-flier');
  if (progress.stamps.length > 0) ids.push('first-stamp');
  if (openRegions(progress.bestHaul).includes(REGIONS[REGIONS.length - 1].id)) ids.push('into-the-night');
  if (summary.escaped && summary.fruit >= 15) ids.push('full-basket');
  if (PAGES.every((page) => progress.pages.includes(page.key))) ids.push('field-guide');
  if (progress.stamps.length >= STAMPS_IN_ALL) ids.push('stamp-collector');
  if (expeditionComplete(progress.bestHaul)) ids.push('owl-light');
  return ids;
}
