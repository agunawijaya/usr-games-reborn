import { describe, expect, it } from 'vitest';
import { LINES, lineFor } from './lines';
import { StepQueue } from './steps';

describe('the step queue', () => {
  it('plays steps in order on its own clock, starting and ending each once', () => {
    const queue = new StepQueue();
    const seen: string[] = [];
    queue.push(
      { duration: 1, start: () => seen.push('a+'), end: () => seen.push('a-') },
      { duration: 0.5, start: () => seen.push('b+'), end: () => seen.push('b-') },
    );
    queue.advance(0.4);
    expect(seen).toEqual(['a+']);
    queue.advance(0.8);
    expect(seen).toEqual(['a+', 'a-', 'b+']);
    expect(queue.busy).toBe(true);
    queue.advance(1);
    expect(seen).toEqual(['a+', 'a-', 'b+', 'b-']);
    expect(queue.busy).toBe(false);
  });

  it('flushes everything, including steps an ending adds', () => {
    const queue = new StepQueue();
    let ended = 0;
    queue.push({ duration: 5, end: () => queue.push({ duration: 5, end: () => ended++ }) });
    queue.flush();
    expect(ended).toBe(1);
    expect(queue.busy).toBe(false);
  });
});

describe('the rivals’ lines', () => {
  it('start with a capital even when a rank opens them', () => {
    expect(lineFor('cat', 'asks', 0, 'sevens')).toBe('Sevens. Now.');
    expect(lineFor('otter', 'asks', 0, 'twos')).toBe('Got any twos?');
  });

  it('are short, and fill in every rank they mention', () => {
    for (const lines of Object.values(LINES)) {
      for (const [moment, options] of Object.entries(lines)) {
        for (const line of options) {
          expect(line.length, line).toBeLessThanOrEqual(48);
          if (moment === 'asks') expect(line).toContain('{rank}');
        }
      }
    }
  });
});
