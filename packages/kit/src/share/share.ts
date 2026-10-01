import { dailyNumber, type DateKey } from '../daily/daily';

/**
 * Share strings are plain text that reads well in any chat: a title, the daily number, an
 * emoji grid and a line or two. They never contain a URL, so sharing never advertises or
 * tracks anything.
 */

export type ShareCell = 'hit' | 'near' | 'miss' | 'empty' | 'special';

const SQUARES: Record<'standard' | 'colorBlind', Record<ShareCell, string>> = {
  standard: { hit: '🟩', near: '🟨', miss: '⬛', empty: '⬜', special: '🟪' },
  colorBlind: { hit: '🟦', near: '🟧', miss: '⬛', empty: '⬜', special: '🟪' },
};

export function emojiGrid(rows: readonly (readonly ShareCell[])[], colorBlind = false): string {
  const squares = SQUARES[colorBlind ? 'colorBlind' : 'standard'];
  return rows.map((row) => row.map((cell) => squares[cell]).join('')).join('\n');
}

export interface ShareInput {
  title: string;
  /** Adds "#N" from the kit's daily numbering. */
  daily?: DateKey;
  headline?: string;
  grid?: readonly (readonly ShareCell[])[];
  lines?: readonly string[];
  colorBlind?: boolean;
}

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;

export function composeShare(input: ShareInput): string {
  const titleLine = input.daily ? `${input.title} #${dailyNumber(input.daily)}` : input.title;
  const parts = [input.headline ? `${titleLine} · ${input.headline}` : titleLine];
  if (input.grid && input.grid.length > 0) parts.push(emojiGrid(input.grid, input.colorBlind));
  if (input.lines) parts.push(...input.lines);
  return parts.join('\n').replace(URL_PATTERN, '').trim();
}

export type ShareOutcome = 'shared' | 'copied' | 'unavailable';

/** Uses the system share sheet where there is one, the clipboard otherwise. */
export async function shareText(text: string, nav: Navigator = navigator): Promise<ShareOutcome> {
  try {
    if (typeof nav.share === 'function' && nav.canShare?.({ text }) !== false) {
      await nav.share({ text });
      return 'shared';
    }
  } catch (error) {
    // Dismissing the share sheet is a choice, not a failure worth reporting.
    if (error instanceof DOMException && error.name === 'AbortError') return 'unavailable';
  }
  try {
    await nav.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'unavailable';
  }
}

/** Saves text or a Blob to the player's disk without any server round trip. */
export function downloadFile(filename: string, content: string | Blob, mime = 'text/plain'): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
