import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** The first-visit style picker: three live previews, Console Home pre-selected, remembered. */

/** A player who has logged in but not picked a style yet. */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // The login writes the profile as it mounts; seed only after it has, or the seed is lost.
  await expect(page.locator('.lg-page')).toBeAttached();
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      'usr-games:hall:profile',
      JSON.stringify({
        v: 2,
        savedAt: '',
        data: { username: 'ada', guest: false, createdOn: null, hintsSeen: [], styleChosen: false },
      }),
    );
  });
  await page.goto('/');
});

test('after login the picker opens with Console Home pre-selected', async ({ page }) => {
  await expect(page).toHaveURL(/#\/welcome$/);
  await expect(page.locator('.sp-card')).toHaveCount(3);
  await expect(page.locator('input[name="hall-style"][value="console"]')).toBeChecked();
  await expect(page.locator('.sp-start')).toContainText('Console Home');
});

test('arrow keys change the choice and Start remembers it across a reload', async ({ page }) => {
  await page.locator('input[name="hall-style"][value="console"]').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('input[name="hall-style"][value="machine-room"]')).toBeChecked();
  await expect(page.locator('.sp-start')).toContainText('Machine Room');
  await page.locator('.sp-start').click();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'machine-room');
  await expect(page.locator('.console .prompt')).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'machine-room');
});

test('each preview shows that style’s real Home', async ({ page }) => {
  await expect(
    page.locator('.sp-card[data-style="machine-room"] .sp-frame .proc').first(),
  ).toBeAttached();
  await expect(page.locator('.sp-card[data-style="console"] .sp-frame > *').first()).toBeAttached();
  await expect(page.locator('.sp-card[data-style="holo"] .sp-frame > *').first()).toBeAttached();
});

for (const appearance of ['light', 'dark'] as const) {
  test(`axe: the picker by ${appearance === 'light' ? 'day' : 'night'}`, async ({ page }) => {
    await page.goto(`/?scene=picker&appearance=${appearance}&freeze=1`);
    await expect(page.locator('.sp-card')).toHaveCount(3);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('.sp-frame')
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}
