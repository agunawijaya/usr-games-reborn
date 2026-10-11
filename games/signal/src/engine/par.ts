import { bannerLength, FULL_WIDTH } from '../codecs/banner';
import { morseTiming, scheduleMessage } from '../codecs/morse';
import type { Step } from './message';

/** Printer lines per second: a brisk line printer, slowed so a banner can be watched. */
export const PRINT_LINES_PER_SECOND = 22;

/** Seconds the printer takes over a banner at a width (narrow banners skip lines). */
export function printSeconds(text: string, width: number): number {
  return (bannerLength(text) * Math.min(width, FULL_WIDTH)) / FULL_WIDTH / PRINT_LINES_PER_SECOND;
}

/** Seconds the sounder takes to send a step's message once. */
export function soundSeconds(text: string, wpm: number, spacingWpm: number): number {
  return scheduleMessage(text, morseTiming(wpm, spacingWpm)).duration / 1000;
}

const letters = (text: string) => text.replace(/\s/g, '').length;

/**
 * The time for the speed star, generous enough for a careful first try: the machine's own
 * playing time where it has one, plus thinking time per character.
 */
export function parFor(step: Step): number {
  switch (step.machine) {
    case 'telegraph':
      return step.mode === 'read'
        ? Math.round(
            soundSeconds(step.text, step.wpm, step.spacingWpm) * 2 + 10 + letters(step.text) * 2,
          )
        : Math.round(letters(step.text) * 6 + 15);
    case 'cipher':
      return step.keyword ? 150 : 75;
    case 'punch':
      return Math.round(letters(step.text) * (step.mode === 'read' ? 6 : 12) + 20);
    case 'tape':
      return Math.round(letters(step.text) * (step.mode === 'read' ? 9 : 12) + 20);
    case 'printer':
      return Math.round(printSeconds(step.text, step.width) + 15);
    case 'semaphore':
      return step.mode === 'read'
        ? Math.round(step.text.length * step.hold * 1.6 + 15)
        : Math.round(letters(step.text) * step.limit + 10);
  }
}
