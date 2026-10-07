import type { Page } from '@playwright/test';
import { inGame } from '../../../packages/bridge/testing/hall';

/** Truthy inside the game's page once every picture is drawn and the game is listening. */
export const READY =
  "document.documentElement.dataset.artReady === 'true' && Boolean(window.__gallows)";

export type Room = 'pirate' | 'lab' | 'temple' | 'crypt' | 'void';

/** Opens a room through the game's own picker, as the player's click does, with a new cipher. */
export async function enterRoom(page: Page, room: Room) {
  await inGame(page, `window.__gallows.setTheme(${JSON.stringify(room)})`);
}

/** Guesses every letter of the cipher: the door opens. */
export async function solveCipher(page: Page) {
  const target = await inGame<string>(page, 'window.__gallows.target');
  for (const letter of new Set(target))
    await inGame(page, `window.__gallows.guess(${JSON.stringify(letter)})`);
}

/** Guesses letters that are not in the cipher until the room wins. */
export async function loseCipher(page: Page) {
  const target = await inGame<string>(page, 'window.__gallows.target');
  const wrong = [...'QZXJKVWYBFGPMHUDCLSNTOIRAE']
    .filter((letter) => !target.includes(letter))
    .slice(0, 6);
  for (const letter of wrong)
    await inGame(page, `window.__gallows.guess(${JSON.stringify(letter)})`);
}

/** The packages the Hall has installed for this game so far. */
export async function installedPackages(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('usr-games:hall:progression');
    const packages = raw
      ? (JSON.parse(raw) as { data?: { packages?: Record<string, unknown> } }).data?.packages
      : null;
    return Object.keys(packages ?? {}).filter((key) => key.includes('hangman-classic'));
  });
}
