import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * The Machine Room's end-to-end pass: Home, the directory filters, man pages with keyboard
 * sections, the home directory, palette and appearance persistence, reduced motion, and axe on
 * every screen in every palette and appearance.
 */

/** A player who already chose the Machine Room, so the first-visit style picker stays away. */
async function seedMachineRoom(page: Page) {
  await page.evaluate(() => {
    window.localStorage.clear();
    const save = (key: string, v: number, data: unknown) =>
      window.localStorage.setItem(
        `usr-games:hall:${key}`,
        JSON.stringify({ v, savedAt: '', data }),
      );
    save('settings', 2, { style: 'machine-room' });
    save('profile', 2, {
      username: null,
      guest: true,
      createdOn: null,
      hintsSeen: [],
      styleChosen: true,
    });
  });
}

async function freshHall(page: Page, path = '/') {
  await page.goto('/');
  // The login writes the profile as it mounts; seed only after it has, or the seed is lost.
  await expect(page.locator('.lg-page')).toBeAttached();
  await seedMachineRoom(page);
  // The store reads the seed only on load; the path itself may be a hash-only change.
  await page.reload();
  await expect(page.locator('.console .prompt')).toBeVisible();
  if (path !== '/') await page.goto(path);
}

test('Home lists every planned game as a process with the today strip above', async ({ page }) => {
  await freshHall(page);
  await expect(page.locator('.today__cron')).toBeVisible();
  await expect(page.locator('.today__fortune blockquote')).not.toBeEmpty();
  await expect(page.locator('.proc')).toHaveCount(30);
  await expect(page.locator('.proc--sleeping')).toHaveCount(22);
  await expect(page.locator('.topline')).toContainText('30 total');
});

test('directory filters narrow the list, and Back returns to every directory', async ({ page }) => {
  await freshHall(page);
  await page.getByRole('link', { name: 'cards', exact: true }).click();
  await expect(page).toHaveURL(/#\/games\/cards$/);
  await expect(page.locator('.shelf')).toHaveCount(1);
  await expect(page.locator('.proc')).toHaveCount(5);
  await page.goBack();
  await expect(page.locator('.proc')).toHaveCount(30);
});

test('sorting A–Z flattens the rack into one shelf in title order', async ({ page }) => {
  await freshHall(page, '/#/?sort=az');
  await expect(page.locator('.shelf')).toHaveCount(1);
  const titles = await page.locator('.proc__title').allTextContents();
  expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, 'en')));
});

test('a man page opens from its tile and arrow keys walk its sections', async ({ page }) => {
  await freshHall(page);
  await page.locator('.proc[data-game="atc"]').click();
  await expect(page).toHaveURL(/#\/man\/atc$/);
  await expect(page.locator('.manpage__header')).toContainText('ATC(6)');
  await expect(page.locator('.console .prompt')).toContainText('man atc');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#man-name')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#man-synopsis')).toBeFocused();
  await expect(page.locator('.button--sleeping')).toContainText('Coming soon');
});

test('the home directory shows the rank, exact XP and the package tree', async ({ page }) => {
  await page.goto('/?scene=profile&theme=phosphor&appearance=dark&freeze=1');
  await expect(page.locator('.homedir__rank')).toContainText('staff');
  await expect(page.locator('.xp-caption__to')).toContainText('XP to wheel');
  await expect(page.locator('.tree__folder').first()).toContainText('hall/');
});

test('theme and appearance persist across a reload', async ({ page }) => {
  await freshHall(page);
  const themeButton = page.locator('[data-focus-key="tool-theme"]');
  await themeButton.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'manual');
  await page.locator('[data-focus-key="tool-appearance"]').click();
  const appearance = await page.locator('html').getAttribute('data-appearance');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'manual');
  await expect(page.locator('html')).toHaveAttribute('data-appearance', appearance ?? '');
});

test('reduced motion is honoured from the operating system', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await freshHall(page);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  const blink = await page.locator('.cursor').evaluate((el) => getComputedStyle(el).animationName);
  expect(blink).toBe('none');
  await context.close();
});

test('the keyboard reaches the directories and a process tile with a visible focus ring', async ({
  page,
}) => {
  await freshHall(page);
  await page.locator('#screen').focus();
  let focusedTile = false;
  for (let i = 0; i < 40 && !focusedTile; i++) {
    await page.keyboard.press('Tab');
    focusedTile = await page.evaluate(
      () => document.activeElement?.classList.contains('proc') ?? false,
    );
  }
  expect(focusedTile).toBe(true);
  const outline = await page.evaluate(
    () => getComputedStyle(document.activeElement as Element).outlineStyle,
  );
  expect(outline).toBe('solid');
});

for (const scene of ['home', 'man', 'profile'] as const) {
  for (const theme of ['phosphor', 'manual', 'sunset'] as const) {
    for (const appearance of ['light', 'dark'] as const) {
      test(`axe: ${scene} in ${theme} ${appearance}`, async ({ page }) => {
        await page.goto(`/?scene=${scene}&theme=${theme}&appearance=${appearance}&freeze=1`);
        await expect(page.locator('#screen')).not.toBeEmpty();
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
      });
    }
  }
}

/** A development screenshot scene with the room on any route, for any demo player. */
function roomScene(
  options: {
    theme?: 'phosphor' | 'manual' | 'sunset';
    appearance?: 'light' | 'dark';
    route?: string;
    player?: 'new' | 'root' | 'rankup';
    freeze?: boolean;
  } = {},
): string {
  const params = new URLSearchParams({
    scene: 'home',
    theme: options.theme ?? 'phosphor',
    appearance: options.appearance ?? 'dark',
  });
  if (options.route) params.set('route', options.route);
  if (options.player) params.set('player', options.player);
  if (options.freeze ?? true) params.set('freeze', '1');
  return `/?${params}`;
}

const configSheet = (page: Page) => page.locator('.config__sheet');

test('settings keep the palette, appearance and volume across a reload', async ({ page }) => {
  await freshHall(page, '/#/settings');
  await expect(page.locator('.page-head__title')).toHaveText('Settings');
  await page.locator('.set-section--palette .set-choice', { hasText: 'Manual Page' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'manual');
  await page.locator('.set-section--appearance .set-choice', { hasText: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
  await page.locator('.set-range__input').fill('70');
  await expect(configSheet(page)).toContainText('70%');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'manual');
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
  await expect(page.locator('.set-range__input')).toHaveValue('70');
  await expect(configSheet(page)).toContainText('manual');
});

test('choosing another style in Settings hands the Hall over to it', async ({ page }) => {
  await freshHall(page, '/#/settings');
  await page.locator('.set-section--style .set-choice', { hasText: 'Console Home' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'console');
  await expect(page).toHaveURL(/#\/settings$/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'console');
});

test('Forget my data asks first, then wipes everything and returns to the login', async ({
  page,
}) => {
  await freshHall(page, '/#/settings');
  const forget = page.getByRole('button', { name: 'Forget my data…' });
  await forget.click();
  const dialog = page.getByRole('dialog', { name: 'Forget everything?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep my data' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/#\/settings$/);

  await forget.click();
  await dialog.getByRole('button', { name: 'Forget everything' }).click();
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.locator('.lg-page')).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/#\/login$/);
});

test('Forget my data leaves no progress behind in storage', async ({ page }) => {
  await freshHall(page, '/#/man/atc');
  await expect(page.locator('.manpage__header')).toBeVisible();
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Forget my data…' }).click();
  await page.getByRole('button', { name: 'Forget everything' }).click();
  await expect(page).toHaveURL(/#\/login$/);
  const kept = await page.evaluate(() =>
    Object.keys(window.localStorage).filter((key) => key.startsWith('usr-games:hall:progression')),
  );
  expect(kept).toEqual([]);
});

test('About tells the story and credits every original program', async ({ page }) => {
  await freshHall(page, '/#/about');
  await expect(page.locator('.page-head__title')).toHaveText('About this machine');
  await expect(page.locator('.console .prompt')).toContainText('cat /etc/motd');
  await expect(page.locator('.ab-content')).toContainText('bsd-games');
  await expect(page.locator('.ab-credit')).toHaveCount(30);
});

test('the footer leads to About, Settings and the closet from every screen', async ({ page }) => {
  await freshHall(page);
  const footer = page.getByRole('navigation', { name: 'About the machine' });
  await footer.getByRole('link', { name: /About/ }).click();
  await expect(page).toHaveURL(/#\/about$/);
  await footer.getByRole('link', { name: /The server closet/ }).click();
  await expect(page).toHaveURL(/#\/closet$/);
});

test('the closet stays shut below root and opens for root', async ({ page }) => {
  await page.goto(roomScene({ route: '#/closet' }));
  await expect(page.locator('.cl-locked')).toBeVisible();
  await expect(page.locator('.page-head__err')).toContainText('Permission denied');
  await expect(page.locator('.cl-status')).toContainText('you are staff');

  await page.goto(roomScene({ route: '#/closet', player: 'root' }));
  await expect(page.locator('.cl-canvas')).toBeVisible();
  await expect(page.locator('.console .prompt')).toContainText('root');
  const fan = page.locator('.cl-switch', { hasText: 'Fan' });
  await expect(fan).toHaveAttribute('aria-pressed', 'true');
  await fan.click();
  await expect(page.locator('.cl-switch', { hasText: 'Fan' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('the home directory links to the closet', async ({ page }) => {
  await page.goto(roomScene({ route: '#/home' }));
  await page.locator('.homedir__closet').click();
  await expect(page).toHaveURL(/#\/closet$/);
});

test('a rank-up plays once: skippable, announced, then never replayed', async ({ page }) => {
  await page.goto(roomScene({ player: 'rankup', freeze: false }));
  const moment = page.getByRole('dialog', { name: /You are now/ });
  await expect(moment).toBeVisible();
  await expect(moment.locator('.rank-up__rank')).toHaveText('staff');
  await expect(page.getByRole('status').filter({ hasText: 'Rank up' })).toContainText(
    'you are now staff',
  );
  await expect(moment.getByRole('button', { name: /Skip/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.rank-up')).toHaveCount(0);
  await expect(page.locator('#screen')).toBeFocused();
  await expect(page.locator('.prompt__user')).toHaveText('staff');

  await page.locator('.room__footer-link', { hasText: 'About' }).click();
  await expect(page).toHaveURL(/#\/about$/);
  await page.goBack();
  await expect(page.locator('.proc').first()).toBeVisible();
  await expect(page.locator('.rank-up')).toHaveCount(0);
});

test('a rank-up settles on its own after two seconds', async ({ page }) => {
  await page.goto(roomScene({ player: 'rankup', freeze: false }));
  await expect(page.locator('.rank-up')).toBeVisible();
  await expect(page.locator('.rank-up')).toHaveCount(0, { timeout: 4_000 });
  await expect(page.locator('.rank-chip__rank')).toHaveText('staff');
});

test('with reduced motion a rank-up is a still cross-fade, and a reload does not replay it', async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  // Reading a man page saves the progression; then the save is nudged past staff's threshold.
  await freshHall(page, '/#/man/atc');
  await expect(page.locator('.manpage__header')).toBeVisible();
  await page.evaluate(() => {
    const key = 'usr-games:hall:progression';
    const save = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    save.data.xp = 3_000;
    window.localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await expect(page.locator('.rank-up')).toHaveClass(/is-still/);
  await expect(page.locator('.rank-up__sweep')).toBeHidden();
  await expect(page.locator('.rank-up__rank')).toHaveText('staff');
  await expect(page.locator('.prompt__user')).toHaveText('staff');
  await page.locator('.rank-up__skip').click();
  await expect(page.locator('.rank-up')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.manpage__header')).toBeVisible();
  await expect(page.locator('.rank-up')).toHaveCount(0);
  await context.close();
});

test('Settings work from the keyboard alone', async ({ page }) => {
  await freshHall(page, '/#/settings');
  await page.locator('#screen').focus();
  const focusedName = () =>
    page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name ?? '');
  let onPalette = false;
  for (let i = 0; i < 30 && !onPalette; i++) {
    await page.keyboard.press('Tab');
    onPalette = (await focusedName()).endsWith('-palette');
  }
  expect(onPalette).toBe(true);
  const ring = await page.evaluate(
    () => getComputedStyle(document.activeElement!.closest('.set-choice')!).outlineStyle,
  );
  expect(ring).toBe('solid');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'manual');
  await expect(page.locator('input[name$="-palette"][value="manual"]')).toBeFocused();

  let onMute = false;
  for (let i = 0; i < 20 && !onMute; i++) {
    await page.keyboard.press('Tab');
    onMute = (await focusedName()).endsWith('-mute');
  }
  expect(onMute).toBe(true);
  await page.keyboard.press('Space');
  await expect(configSheet(page)).toContainText(/muted\s+= on/);
});

const QUIET_SCREENS: { name: string; route: string; player?: 'root' | 'rankup' }[] = [
  { name: 'settings', route: '#/settings' },
  { name: 'about', route: '#/about' },
  { name: 'closet door', route: '#/closet' },
  { name: 'open closet', route: '#/closet', player: 'root' },
  { name: 'rank-up', route: '#/', player: 'rankup' },
];

for (const screen of QUIET_SCREENS) {
  for (const theme of ['phosphor', 'manual', 'sunset'] as const) {
    for (const appearance of ['light', 'dark'] as const) {
      test(`axe: ${screen.name} in ${theme} ${appearance}`, async ({ page }) => {
        await page.goto(
          roomScene({ theme, appearance, route: screen.route, player: screen.player }),
        );
        await expect(page.locator('#screen')).not.toBeEmpty();
        if (screen.player === 'rankup') await expect(page.locator('.rank-up')).toBeVisible();
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          results.violations.map(
            (v) =>
              `${v.id}: ${v.nodes
                .map((n) => n.target.join(' '))
                .slice(0, 3)
                .join(' | ')}`,
          ),
        ).toEqual([]);
      });
    }
  }
}
