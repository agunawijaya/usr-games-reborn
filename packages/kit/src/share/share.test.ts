import { describe, expect, it } from 'vitest';
import { composeShare, emojiGrid, shareText } from './share';

describe('composeShare', () => {
  it('builds a URL-free daily share with its number and grid', () => {
    const text = composeShare({
      title: 'Cave hunt',
      daily: '2026-09-28',
      headline: 'found it in 4',
      grid: [
        ['miss', 'near', 'hit'],
        ['hit', 'hit', 'empty'],
      ],
      lines: ['see you tomorrow at https://example.com'],
    });
    expect(text).toBe('Cave hunt #28 · found it in 4\n⬛🟨🟩\n🟩🟩⬜\nsee you tomorrow at');
    expect(text).not.toMatch(/https?:|www\./);
  });

  it('swaps colours for the colour-blind palette', () => {
    expect(emojiGrid([['hit', 'near']], true)).toBe('🟦🟧');
  });
});

describe('shareText', () => {
  it('prefers the share sheet, then the clipboard', async () => {
    const shared: string[] = [];
    const withSheet = { share: async ({ text }: { text: string }) => void shared.push(text) };
    expect(await shareText('hi', withSheet as unknown as Navigator)).toBe('shared');

    const copied: string[] = [];
    const withClipboard = {
      clipboard: { writeText: async (text: string) => void copied.push(text) },
    };
    expect(await shareText('hi', withClipboard as unknown as Navigator)).toBe('copied');
    expect(shared).toEqual(['hi']);
    expect(copied).toEqual(['hi']);
  });

  it('reports when neither is available', async () => {
    const nothing = { clipboard: { writeText: async () => Promise.reject(new Error('denied')) } };
    expect(await shareText('hi', nothing as unknown as Navigator)).toBe('unavailable');
  });
});
