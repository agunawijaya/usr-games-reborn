// Public surface of the headless rain engine: no DOM, no clock, no
// Math.random. Everything is a function of (seed, terminal size, delay).
export { createRandom, next } from './random.js';
export {
  STAGES, MIN_COLS, MIN_LINES, parseDelay, createRain, step, screenText, cloneRain,
  frameMs, BAUD_BYTES_PER_S,
} from './rain.js';
