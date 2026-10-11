import { expect, type Page, test } from '@playwright/test';
import { CHAPTERS } from '../src/engine/chapters';
import { dailyMessage } from '../src/engine/generate';
import { begin, go, keyMorse, log, nextMachine, openDesk, workStep } from './hook';

/**
 * Dits & Daws on its workbench: every machine played by keyboard and by mouse, a chained
 * message, the sandbox's code round trip, the Daily Signal's share line, and the ways out.
 */
const message = (id: string) => CHAPTERS.flatMap((c) => c.messages).find((m) => m.id === id)!;

async function play(page: Page, id: string) {
  await go(page, 'message', id);
  await begin(page);
  for (const [i, step] of message(id).steps.entries()) {
    if (i > 0) await nextMachine(page);
    await workStep(page, step);
  }
  await expect(page.getByTestId('dd-results')).toBeVisible({ timeout: 20_000 });
}

test.beforeEach(async ({ page }) => {
  await openDesk(page);
});

test('opens on the game menu and reaches the Signal Room', async ({ page }) => {
  await expect(page.getByTestId('dd-menu')).toBeVisible();
  await page.getByRole('button', { name: /The Signal Room/ }).click();
  await expect(page.getByTestId('dd-log')).toContainText('The first wire');
  await page.keyboard.press('1');
  await expect(page.getByTestId('dd-brief')).toContainText('Two sounds');
});

test('the telegraph: reading by typing, sending with Space', async ({ page }) => {
  await play(page, 'c1-m1');
  await expect(page.getByTestId('dd-results')).toContainText('★★★');
  await go(page, 'message', 'c1-m4');
  await begin(page);
  await keyMorse(page, 'I AM ON');
  await expect(page.getByTestId('dd-results')).toBeVisible({ timeout: 20_000 });
  expect((await log(page)).join('\n')).toContain('package first-dit');
});

test('the telegraph by mouse: pressing the key', async ({ page }) => {
  await go(page, 'freeRound', { machine: 'telegraph', mode: 'send', wpm: 12 });
  const key = page.locator('.dd-key-button');
  const box = (await key.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(600);
  expect((await log(page)).join('\n')).toContain('package first-daw');
});

test('the cipher wheel by keyboard, and by the scope with the mouse', async ({ page }) => {
  await play(page, 'c2-m1');
  await go(page, 'message', 'c2-m2');
  await begin(page);
  await page.getByRole('button', { name: 'Let the scope turn it' }).click();
  await page.getByRole('button', { name: /Read it/ }).click();
  await expect(page.getByTestId('dd-results')).toBeVisible({ timeout: 10_000 });
});

test('beats the machine on a message the scope gets wrong', async ({ page }) => {
  await play(page, 'c2-m5');
  expect((await log(page)).join('\n')).toContain('package beat-the-machine');
});

test('the card punch: reading, punching by keys and by clicking holes', async ({ page }) => {
  await play(page, 'c3-m1');
  await play(page, 'c3-m3');
  await go(page, 'freeRound', { machine: 'punch', mode: 'punch' });
  // One click on the card punches the hole under it.
  const surface = page.locator('.dd-card-surface');
  const box = (await surface.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.045, box.y + box.height * 0.2);
  await expect(page.getByRole('status').first()).toContainText(/Column 1/);
});

test('the tape reader: reading, then punching with the number keys', async ({ page }) => {
  await play(page, 'c4-m1');
  await play(page, 'c4-m3');
});

test('the banner printer: read it early and it turns upright', async ({ page }) => {
  await play(page, 'c5-m2');
  expect((await log(page)).join('\n')).toContain('package banner-day');
});

test('flags on the roof: reading, sending by keys, and choosing a position by mouse', async ({
  page,
}) => {
  await play(page, 'c6-m1');
  await play(page, 'c6-m3');
  expect((await log(page)).join('\n')).toContain('package flag-sender');
  await go(page, 'freeRound', { machine: 'semaphore', mode: 'send', limit: 8 });
  await page.getByRole('button', { name: 'Left flag up', exact: true }).click();
  await expect(page.getByRole('status').first()).toBeVisible();
});

test('a chained message: the sounder gives the turn for the wheel', async ({ page }) => {
  await play(page, 'c7-m1');
  expect((await log(page)).join('\n')).toContain('package chain-reaction');
});

test('make your own: a desk code opens as a friend’s message', async ({ page }) => {
  await go(page, 'sandbox');
  await page.getByTestId('dd-make-text').fill('LAMP STILL ON');
  await page.getByRole('radio', { name: 'Card punch' }).check();
  const code = (await page.getByTestId('dd-code').textContent())!.trim();
  expect(code).toMatch(/^DD1-C-0-/);
  expect(code).not.toContain('LAMP');
  await page.getByTestId('dd-friend-code').fill(code);
  await page.getByRole('button', { name: 'Open it' }).click();
  await begin(page);
  await workStep(page, { machine: 'punch', mode: 'read', text: 'LAMP STILL ON' });
  await expect(page.getByTestId('dd-results')).toBeVisible();
});

test('the Daily Signal: three machines and a share line', async ({ page }) => {
  await openDesk(page, '&date=2026-10-12');
  await go(page, 'daily');
  await begin(page);
  const daily = dailyMessage('signal:daily:2026-10-12');
  for (const [i, step] of daily.steps.entries()) {
    if (i > 0) await nextMachine(page);
    await workStep(page, step);
  }
  const line = page.getByTestId('dd-share-line');
  await expect(line).toHaveText(/^Dits & Daws #42 · cracked in \d+:\d\d · .+ · no hints$/, {
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Share' }).click();
  expect((await log(page)).join('\n')).toContain('share Dits & Daws #42');
});

test('every way out: Game menu and Back to the Hall from the results', async ({ page }) => {
  await play(page, 'c1-m1');
  await page.keyboard.press('KeyH');
  expect(await log(page)).toContain('navigate hall');
  await page.getByRole('button', { name: 'Game menu' }).click();
  await expect(page.getByTestId('dd-menu')).toBeVisible();
});
