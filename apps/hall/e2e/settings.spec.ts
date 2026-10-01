import { expect, type Page, test } from '@playwright/test';

/**
 * The settings panel every style shares: choosing a style from the keyboard is deliberate (the
 * arrow keys only move the choice; Enter or the button applies it), while a click applies at once.
 */

async function openSettings(page: Page, scene: string) {
  await page.goto(`/?scene=${scene}&appearance=light&route=${encodeURIComponent('#/settings')}`);
  await expect(page.locator('input[type="radio"][value="console"]').first()).toBeAttached();
}

const styleRadio = (page: Page, style: string) =>
  page.locator(`.set-group input[type="radio"][value="${style}"]`);

test('arrow keys move the style choice without leaving the page; Enter applies it', async ({
  page,
}) => {
  await openSettings(page, 'console-home');
  await styleRadio(page, 'console').focus();
  await page.keyboard.press('ArrowRight');
  await expect(styleRadio(page, 'holo')).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'console');
  const apply = page.locator('.set-apply');
  await expect(apply).toBeVisible();
  await expect(apply).toContainText('Switch to Holo Collection');

  await page.keyboard.press('ArrowRight');
  await expect(apply).toContainText('Switch to Machine Room');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(apply).toBeHidden();

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-style', 'holo');
});

test('the switch button applies the style picked with the arrow keys', async ({ page }) => {
  await openSettings(page, 'holo-home');
  await styleRadio(page, 'holo').focus();
  await page.keyboard.press('ArrowRight');
  await page.locator('.set-apply').click();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'machine-room');
});

test('a click on a style applies it at once', async ({ page }) => {
  await openSettings(page, 'home');
  await page.locator('.set-choice', { has: page.locator('input[value="console"]') }).click();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'console');
});
