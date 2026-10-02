// Selene inside /usr/games Reborn. The Hall runs this page in a frame and listens over the
// bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge
// script is missing or reports `hosted: false`, and every call below does nothing.
//
// Selene is a toy, so the Hall grants a small amount of XP once a day for a visit in which the
// player really travelled through time, and six small packages for moments pom can recognise.

import { upcomingEvents, eventsBetween } from './engine/events.js';

const HOUR = 3600;
const DAY = 86400;
const NEAR_AN_EVENT = 12 * HOUR;
const CENTURY = 100 * 365.25 * DAY;

// Selene makes no sound, so of the Hall's settings only reduced motion reaches it: app.js
// hands over its motion switch (followHallMotion) and the Hall's choice flips it, live.
let applyReducedMotion = null;
let hallReducedMotion = null;

const hall = globalThis.UsrGamesBridge?.connectToHall({
  id: 'pom',
  onReducedMotion(reduced) {
    hallReducedMotion = reduced;
    applyReducedMotion?.(reduced);
  },
}) ?? null;
const openedAt = performance.now();
const installed = new Set();
let visitReported = false;
let timelapseWatched = false;

/** app.js calls this once with its motion switch; the Hall's latest choice applies at once. */
export function followHallMotion(apply) {
  applyReducedMotion = apply;
  if (hallReducedMotion !== null) apply(hallReducedMotion);
}

function install(id) {
  if (!hall || installed.has(id)) return;
  installed.add(id);
  hall.achievement(id);
}

function reportVisit() {
  if (!hall || visitReported) return;
  visitReported = true;
  hall.result({
    outcome: 'complete',
    durationSeconds: Math.round((performance.now() - openedAt) / 1000),
  });
}

// A timelapse only counts when it played in view from start to finish; a hidden tab lets the
// clock run on and would jump straight to the end.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) timelapseWatched = false;
});

function localMonthAround(t) {
  const start = new Date(t * 1000);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return [start.getTime() / 1000, end.getTime() / 1000];
}

function holdsTwoFullMoons(t) {
  const [from, to] = localMonthAround(t);
  return eventsBetween(from, to).filter((event) => event.key === 'full').length >= 2;
}

function isNextEvent(key, t, upcoming) {
  const next = upcoming.find((event) => event.key === key);
  return !!next && Math.abs(t - next.t) <= NEAR_AN_EVENT;
}

/** The view has come to rest on a moment the player chose (not the live "now"). */
export function noteMomentVisited(t) {
  if (!hall) return;
  reportVisit();
  const now = Date.now() / 1000;
  // The next four principal phases always hold one full and one new Moon.
  const upcoming = upcomingEvents(now, 4);
  if (isNextEvent('full', t, upcoming)) install('next-full-moon');
  if (isNextEvent('new', t, upcoming)) install('next-new-moon');
  if (Math.abs(t - now) >= CENTURY) install('century-hop');
  if (holdsTwoFullMoons(t)) install('two-full-moons');
}

export function noteTimelapseStarted() {
  timelapseWatched = !document.hidden;
  reportVisit();
}

export function noteTimelapseFinished() {
  if (timelapseWatched) install('full-lunation');
  timelapseWatched = false;
}

export function notePomAnswered() {
  reportVisit();
  install('ask-pom');
}

// Key art for the Hall: a full Moon over Selene's sky, offered once per visit after the first
// frames have settled (stars and lake at their full brightness).
const POSTER_AFTER_MS = 1500;
let posterSent = false;

export function posterWanted() {
  return !!hall?.hosted && !posterSent && performance.now() - openedAt > POSTER_AFTER_MS;
}

/** Call right after drawing the canvas, in the same task (see the bridge's posterFromCanvas). */
export function offerPoster(canvas) {
  posterSent = true;
  hall.posterFromCanvas(canvas);
}
