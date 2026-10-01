import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** The very first visit: the boot sequence, the login, then the style picker. */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.goto('/');
});

test('a first visit boots to the login and any key skips the boot', async ({ page }) => {
  await expect(page).toHaveURL(/#\/login$/);
  await page.keyboard.press('Space');
  await expect(page.locator('.lg-page')).toHaveClass(/is-booted/);
  await expect(page.locator('#lg-name')).toBeFocused();
  await expect(page.locator('.lg-tip')).toContainText('Esc');
});

test('a name is checked kindly, then the style picker follows', async ({ page }) => {
  await page.keyboard.press('Enter');
  await page.fill('#lg-name', 'r');
  await page.click('.lg-button--primary');
  await expect(page.locator('#lg-error')).toContainText('at least 2');
  await page.fill('#lg-name', 'Grace Hopper');
  await page.click('.lg-button--primary');
  await expect(page).toHaveURL(/#\/welcome$/);
  await expect(page.locator('.sp-kicker')).toContainText('grace-hopper');
});

test('playing as a guest also leads to the picker, and the choice sticks', async ({ page }) => {
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Play as guest' }).click();
  await expect(page).toHaveURL(/#\/welcome$/);
  await page.locator('.sp-start').click();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'console');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'console');
});

test('with reduced motion the boot is instant', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.lg-page')).toHaveClass(/is-booted/);
  await context.close();
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`axe: the login in ${colorScheme}`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.lg-page')).toHaveClass(/is-booted/);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await context.close();
  });
}
