import { expect, type Page, test } from '@playwright/test';
import { runInHall } from '../../../packages/bridge/testing/hall';

/**
 * The player's safe zones for native games (docs/ARCHITECTURE.md, "The player's safe zones"),
 * checked against the six native games in every Hall style, by day and by night: on a game's own
 * menu there is no Pause pill; in play the pill sits inside the top-right 220 × 64 px, the toasts
 * stack in the bottom-left 64 px up and at most 400 px wide, and no text or control of the game
 * lies under either. Each game is started its own way, so a game that changes its menu may need
 * its line in START updated here.
 */

type Style = 'console' | 'holo' | 'machine-room';
const STYLES: readonly Style[] = ['console', 'holo', 'machine-room'];
const APPEARANCES = ['light', 'dark'] as const;

const START: Record<string, (page: Page) => Promise<void>> = {
  atc: async (page) => {
    await page
      .getByRole('button', { name: /^Endless/ })
      .first()
      .click();
    await page.getByRole('button', { name: /Harbour Lights/ }).click();
  },
  lightkeeper: async (page) => {
    await page.getByTestId('lk-menu-open').click();
    await page.getByTestId('lk-open-code').fill('test-40');
    await page.getByTestId('lk-open-begin').click();
    await page.getByTestId('lk-begin').click();
  },
  zoomies: async (page) => {
    await page.getByTestId('zm-menu-house').click();
    await page.getByTestId('zm-room-hallway').click();
    await page.getByTestId('zm-intro').waitFor();
    await page.keyboard.press('Enter');
  },
  wump: async (page) => {
    await page.getByRole('button', { name: /Tutorial/ }).click();
  },
  worm: async (page) => {
    await page.getByRole('button', { name: /^Endless/ }).click();
  },
  snake: async (page) => {
    await page.getByRole('button', { name: /Start a run/ }).click();
    await page.getByTestId('fp-map').waitFor();
    await page.keyboard.press('Enter');
  },
  figurehead: async (page) => {
    await page.getByTestId('fh-menu-daily').click();
    await page.getByTestId('fh-make-sail').click();
    await page.getByTestId('fh-panel').waitFor();
  },
  canfield: async (page) => {
    await page.getByTestId('td-menu-new').click();
    await page.getByTestId('td-deal-go').click();
    await page.getByTestId('td-play').waitFor();
  },
};

/**
 * Known exceptions, each with its KNOWN-ISSUES row: Hush the Wumpus keeps its room card (and, on
 * a short screen, its tip card) in the bottom-left corner, where the toasts stack (#49).
 */
const UNDER_TOASTS_ALLOWED: Record<string, RegExp> = {
  wump: /^(span|strong)\.(hw-room__|hw-coach__|)/,
};

/** Three toasts as the player draws them, so the stack's real size and place are measured. */
async function showThreeToasts(page: Page) {
  await page.evaluate(() => {
    const stack = document.querySelector('[data-testid="pl-toasts"]')!;
    for (const xp of ['+30 XP', '+60 XP', '+115 XP']) {
      const card = document.createElement('div');
      card.className = 'pl-toast pl-toast--xp';
      card.innerHTML = `<p class="pl-toast__lead">${xp}</p><ul class="pl-toast__list"><li class="pl-toast__item">Achievement unlocked: a long achievement name</li></ul>`;
      stack.append(card);
    }
  });
}

/** The game's visible text and controls that the element at `selector` lies over. */
function underneath(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const zone = document.querySelector(sel)!.getBoundingClientRect();
    const hits: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('.pl-stage *')) {
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (!ownText && !el.matches('button, a, input, select')) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.opacity === '0') continue;
      const apart =
        box.right <= zone.left ||
        box.left >= zone.right ||
        box.bottom <= zone.top ||
        box.top >= zone.bottom;
      if (!apart) hits.push(`${el.tagName.toLowerCase()}.${el.classList[0] ?? ''}`);
    }
    return hits;
  }, selector);
}

const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];

for (const id of Object.keys(START)) {
  for (const style of STYLES) {
    for (const appearance of APPEARANCES) {
      for (const size of SIZES) {
        // Every style and look at the smallest desktop size; the largest once per style.
        if (size.width === 1920 && appearance === 'light') continue;
        test(`${id} · ${style} · ${appearance} · ${size.width}: the pill and the toasts keep to their zones`, async ({
          page,
        }) => {
          await page.setViewportSize(size);
          await runInHall(page, id, { style, appearance });
          await expect(page.locator('.pl-corner')).toBeVisible({ timeout: 30_000 });
          await expect(page.getByTestId('pl-pause-button')).toBeHidden();

          await START[id]!(page);
          const pill = page.getByTestId('pl-pause-button');
          await expect(pill).toBeVisible({ timeout: 15_000 });
          const pillBox = (await pill.boundingBox())!;
          expect(pillBox.x).toBeGreaterThanOrEqual(size.width - 220);
          expect(pillBox.y + pillBox.height).toBeLessThanOrEqual(64);
          expect(await underneath(page, '[data-testid="pl-pause-button"]')).toEqual([]);

          await showThreeToasts(page);
          const stack = (await page.getByTestId('pl-toasts').boundingBox())!;
          expect(stack.x).toBeLessThanOrEqual(30);
          expect(stack.width).toBeLessThanOrEqual(400);
          expect(stack.y + stack.height).toBeLessThanOrEqual(size.height - 64 + 1);
          const allowed = UNDER_TOASTS_ALLOWED[id];
          const under = await underneath(page, '[data-testid="pl-toasts"]');
          expect(under.filter((hit) => !allowed?.test(hit))).toEqual([]);
        });
      }
    }
  }
}
