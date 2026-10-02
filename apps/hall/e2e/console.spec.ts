import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { SHIPPED } from './catalog';
import {
  emptyProgression,
  PROGRESSION_VERSION,
  type RankId,
  rankById,
} from '@usr-games/kit/progression';

/**
 * Console Home: the rail drives the hero, game pages open and close by keyboard, the quests
 * sheet and the style menu behave like real dialogs and menus; the profile, Settings, About
 * and the server closet work for new, regular and root players; the rank-up moment plays once;
 * and axe finds nothing on any of them, by day or by night.
 */

type Appearance = 'light' | 'dark';
type ScenePlayer = 'new' | 'root' | 'rankup';

async function openScene(page: Page, scene: string, appearance: Appearance = 'dark') {
  await page.goto(`/?scene=${scene}&appearance=${appearance}`);
  await expect(page.locator('html')).toHaveAttribute('data-style', 'console');
  await expect(page.locator('.ch-app')).toBeVisible();
}

/** A route in the demo scene, for ada (a month in) or one of the other scene players. */
async function openRoute(
  page: Page,
  route: string,
  options: { player?: ScenePlayer; appearance?: Appearance; freeze?: boolean } = {},
) {
  const params = new URLSearchParams({
    scene: 'console-home',
    appearance: options.appearance ?? 'dark',
    route,
  });
  if (options.player) params.set('player', options.player);
  if (options.freeze) params.set('freeze', '1');
  await page.goto(`/?${params}`);
  await expect(page.locator('html')).toHaveAttribute('data-style', 'console');
  await expect(page.locator('.ch-app')).toBeVisible();
}

/**
 * A real browser save instead of a scene, for anything that must survive a reload or follow
 * the motion setting. It is written once per tab (a session flag), so reloads read what the
 * Hall saved since.
 */
async function seedSave(
  page: Page,
  options: { rank?: RankId; celebrated?: RankId; motion?: 'full' | 'reduce' } = {},
) {
  const rank = options.rank ?? 'staff';
  const progression = {
    ...emptyProgression(),
    xp: rankById(rank).threshold + 40,
    celebratedRank: options.celebrated ?? rank,
  };
  await page.addInitScript(
    ({ progression, version, motion }) => {
      if (window.top !== window || window.sessionStorage.getItem('seeded')) return;
      window.sessionStorage.setItem('seeded', '1');
      window.localStorage.clear();
      const save = (key: string, v: number, data: unknown) =>
        window.localStorage.setItem(
          `usr-games:hall:${key}`,
          JSON.stringify({ v, savedAt: '', data }),
        );
      save('settings', 2, { style: 'console', appearance: 'light', motion });
      save('profile', 2, {
        username: 'grace',
        guest: false,
        createdOn: '2026-09-01',
        hintsSeen: ['esc-menu'],
        styleChosen: true,
      });
      save('progression', version, progression);
    },
    { progression, version: PROGRESSION_VERSION, motion: options.motion ?? 'full' },
  );
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}

test('the rail starts on Today’s pick and the hero follows the keyboard', async ({ page }) => {
  await openScene(page, 'console-home');
  // Today's pick is one shipped game, chosen by the scene's pinned date.
  const selected = page.locator('.ch-tile.is-selected');
  const pick = (await selected.getAttribute('data-game')) ?? '';
  expect(SHIPPED.map((game) => game.id)).toContain(pick);
  await expect(page.locator('.ch-hero__layer').last().locator('.ch-hero__title')).toContainText(
    SHIPPED.find((game) => game.id === pick)!.title.split(' — ')[0]!,
  );
  await expect(page.locator('.ch-eyebrow--pick').last()).toContainText('Today’s pick');

  await selected.focus();
  await page.keyboard.press('ArrowRight');
  const next = page.locator('.ch-tile.is-selected');
  await expect(next).not.toHaveAttribute('data-game', pick);
  await expect(next).toBeFocused();
  const nextTitle = await next.locator('.ch-tile__title').textContent();
  await expect(page.locator('.ch-hero__layer').last().locator('.ch-hero__title')).toHaveText(
    nextTitle ?? '',
  );
});

test('Enter opens the game page and Escape returns with the same game selected', async ({
  page,
}) => {
  await openScene(page, 'console-home');
  await page.locator('.ch-tile.is-selected').focus();
  await page.keyboard.press('ArrowRight');
  const id = await page.locator('.ch-tile.is-selected').getAttribute('data-game');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`#/game/${id}$`));
  await expect(page.locator('.ch-detail__title')).toBeVisible();
  await expect(page.locator('.ch-step')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator('.ch-tile.is-selected')).toHaveAttribute('data-game', id ?? '');
});

test('plain words only: no process ids, paths, cron lines or prompts', async ({ page }) => {
  await openScene(page, 'console-home');
  const text = (await page.locator('.ch-app').innerText()).replace('/usr/games', '');
  expect(text).not.toMatch(/PID|\/usr\/games\/|\* \* \*|load average|\$ /);
  await expect(page.locator('.ch-level')).toContainText('Level');
});

test('the weekly quests sheet opens, traps focus and gives it back', async ({ page }) => {
  await openScene(page, 'console-home');
  const button = page.getByRole('button', { name: /Weekly quests/ });
  await button.click();
  const sheet = page.getByRole('dialog', { name: 'Weekly quests' });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.ch-quest')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(button).toBeFocused();
});

test('the style menu switches to another style', async ({ page }) => {
  await openScene(page, 'console-home');
  await page.getByRole('button', { name: 'Style and appearance' }).click();
  const menu = page.getByRole('menu', { name: 'Style and appearance' });
  await expect(menu.getByRole('menuitemradio', { name: 'Console Home' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await menu.getByRole('menuitemradio', { name: 'Machine Room' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'machine-room');
});

for (const scene of ['console-home', 'console-detail'] as const) {
  for (const appearance of ['light', 'dark'] as const) {
    test(`axe: ${scene} in ${appearance === 'light' ? 'Day' : 'Night'}`, async ({ page }) => {
      await page.goto(`/?scene=${scene}&appearance=${appearance}&freeze=1`);
      await expect(page.locator('.ch-app')).toBeVisible();
      await page.waitForTimeout(400);
      await expectNoAxeViolations(page);
    });
  }
}

test.describe('the profile', () => {
  test('ada sees her level, week, achievements, games, looks and the closet door', async ({
    page,
  }) => {
    await openRoute(page, '#/home');
    await expect(page.locator('#ch-profile-name')).toHaveText('ada');
    // ada's month of play is simulated over the shipped games, so her level grows with them.
    await expect(page.locator('.ch-profile-hero__rank')).toContainText(/Level \d+/);
    await expect(page.locator('.ch-rank-chip')).toContainText('staff');
    await expect(page.locator('.ch-quests-card .ch-quest')).toHaveCount(3);
    await expect(page.locator('.ch-games tbody tr')).toHaveCount(8);
    await expect(page.locator('.ch-skin')).toHaveCount(5);
    await expect(page.locator('.ch-skin.is-locked')).toHaveCount(2);
    await expect(page.locator('.ch-door')).toContainText('opens at Level 40');

    const hall = page.locator('.ch-set').first();
    await hall.locator('summary').click();
    await expect(hall.locator('.ch-set__item')).toHaveCount(10);
    await expect(hall.locator('.ch-set__item.is-earned').first()).toContainText('Earned');
  });

  test('a first-day player is invited in, with nothing to feel behind on', async ({ page }) => {
    await openRoute(page, '#/home', { player: 'new' });
    await expect(page.locator('.ch-profile-hero__since')).toContainText('Joined today');
    await expect(page.locator('.ch-profile-hero__rank')).toContainText('Level 1');
    await expect(page.locator('.ch-games')).toHaveCount(0);
    await expect(page.locator('.ch-profile-invite a')).toContainText('Start with Today’s pick');
    await expect(page.locator('.ch-achievements--next .ch-achievement')).not.toHaveCount(0);
  });

  test('a root player has every skin and an open door', async ({ page }) => {
    await openRoute(page, '#/home', { player: 'root' });
    await expect(page.locator('.ch-skin.is-locked')).toHaveCount(0);
    await expect(page.locator('.ch-door.is-open')).toContainText('Step inside');
  });

  test('wearing a skin tints the chrome and keeps focus on the button', async ({ page }) => {
    await openRoute(page, '#/home');
    const mint = page.getByRole('button', { name: 'Wear the Mint skin' });
    await mint.click();
    await expect(page.locator('.ch-app')).toHaveAttribute('data-skin', 'skin-mint');
    await expect(mint).toHaveAttribute('aria-pressed', 'true');
    await expect(mint).toBeFocused();
  });
});

test.describe('settings', () => {
  test('skin, appearance and volume survive a reload', async ({ page }) => {
    await seedSave(page);
    await page.goto('/#/settings');
    await expect(page.locator('.ch-settings')).toBeVisible();
    await page.locator('.set-choice', { hasText: 'Citrus' }).click();
    await page.locator('.set-choice:has(input[value="dark"])').click();
    await page.locator('.set-range__input').fill('60');
    await expect(page.locator('.ch-app')).toHaveAttribute('data-skin', 'skin-citrus');
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');

    await page.reload();
    await expect(page.locator('.ch-app')).toHaveAttribute('data-skin', 'skin-citrus');
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
    await expect(page.locator('input[value="skin-citrus"]')).toBeChecked();
    await expect(page.locator('.set-range__input')).toHaveValue('60');
  });

  test('locked skins say which level opens them and cannot be chosen', async ({ page }) => {
    await openRoute(page, '#/settings');
    const sunset = page.locator('.set-choice', { hasText: 'Sunset' });
    await expect(sunset).toContainText('Unlocks at Level 40');
    await expect(sunset.locator('input')).toBeDisabled();
    await expect(sunset.locator('.set-choice__media[aria-hidden="true"] .ch-swatch')).toHaveCount(
      1,
    );
    // The swatches come with the panel: changing a setting re-renders it, swatches and all.
    await page.locator('[data-section="appearance"] .set-choice', { hasText: /^Day$/ }).click();
    await expect(page.locator('[data-section="palette"] .ch-swatch')).toHaveCount(5);
  });

  test('the section list jumps to a section and moves focus there', async ({ page }) => {
    await openRoute(page, '#/settings');
    await page.getByRole('button', { name: 'Sound', exact: true }).click();
    await expect(page.locator('[data-section="sound"]')).toBeFocused();
  });

  test('another style can be chosen right here', async ({ page }) => {
    await openRoute(page, '#/settings');
    await page.locator('.set-choice', { hasText: 'Holo Collection' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-style', 'holo');
  });

  test('Forget my data asks first, then starts over at the login', async ({ page }) => {
    await seedSave(page);
    await page.goto('/#/settings');
    const forget = page.getByRole('button', { name: 'Forget my data…' });
    await forget.click();
    const dialog = page.getByRole('dialog', { name: 'Forget everything?' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/#\/settings$/);

    await forget.click();
    await dialog.getByRole('button', { name: 'Forget everything' }).click();
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.locator('.lg-page')).toBeVisible();
  });

  test('Forget my data leaves no progress behind in storage', async ({ page }) => {
    await seedSave(page);
    await page.goto('/#/settings');
    await page.getByRole('button', { name: 'Forget my data…' }).click();
    await page.getByRole('button', { name: 'Forget everything' }).click();
    await expect(page).toHaveURL(/#\/login$/);
    const progression = await page.evaluate(() =>
      window.localStorage.getItem('usr-games:hall:progression'),
    );
    expect(progression).toBeNull();
  });
});

test('About tells the story and credits the people behind every original', async ({ page }) => {
  await openRoute(page, '#/about');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Old games, new life');
  await expect(page.locator('.ab-credits__group')).not.toHaveCount(0);
  await expect(page.locator('.ab-credits')).toContainText('Ken Arnold');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/$/);
});

test.describe('the server closet', () => {
  test('stays shut below the top level and says how far it is', async ({ page }) => {
    await openRoute(page, '#/closet');
    await expect(page.locator('.cl-locked')).toBeVisible();
    await expect(page.locator('.cl-status')).toContainText('opens at Level 40');
    await expect(page.locator('.cl-bar')).toHaveAttribute('role', 'progressbar');
  });

  test('opens at root, with switches that work and Escape back to the profile', async ({
    page,
  }) => {
    await openRoute(page, '#/closet', { player: 'root' });
    await expect(page.locator('.cl-canvas')).toBeVisible();
    const fan = page.getByRole('button', { name: /^Fan/ });
    await expect(fan).toHaveAttribute('aria-pressed', 'true');
    await fan.click();
    await expect(page.getByRole('button', { name: /^Fan/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/#\/home$/);
  });
});

test.describe('the rank-up moment', () => {
  test('plays once, can be skipped, and leaves the new skin one click away', async ({ page }) => {
    await openRoute(page, '#/', { player: 'rankup' });
    await expect(page.locator('.ch-rankup')).toBeVisible();
    await expect(page.locator('.ch-app > [role="status"]')).toContainText('Level up!');
    // The kit's plain welcome for the new rank, not the Machine Room's Unix one.
    await expect(page.locator('.ch-rankup__line')).toHaveText(
      'A regular here. The games have started to know your face.',
    );
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await expect(page.locator('.ch-rankup')).toHaveCount(0);
    const keepsake = page.locator('.ch-keepsake');
    await expect(keepsake).toContainText('staff');
    await keepsake.getByRole('button', { name: 'Wear it' }).click();
    await expect(page.locator('.ch-app')).toHaveAttribute('data-skin', 'skin-citrus');

    await page.evaluate(() => (window.location.hash = '#/home'));
    await expect(page.locator('.ch-profile')).toBeVisible();
    await page.evaluate(() => (window.location.hash = '#/'));
    await expect(page.locator('.ch-home')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.locator('.ch-rankup')).toHaveCount(0);
  });

  test('settles on its own after two seconds', async ({ page }) => {
    await openRoute(page, '#/', { player: 'rankup' });
    await expect(page.locator('.ch-rankup')).toBeVisible();
    await expect(page.locator('.ch-rankup')).toHaveCount(0, { timeout: 4000 });
    await expect(page.locator('.ch-keepsake')).toBeVisible();
  });

  test('with reduced motion it simply fades, and Escape skips it', async ({ page }) => {
    await seedSave(page, { rank: 'staff', celebrated: 'user', motion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.ch-rankup.is-still')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ch-rankup')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.ch-home')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.locator('.ch-rankup')).toHaveCount(0);
  });
});

test('keyboard only: the level badge opens the profile, Escape goes back Home', async ({
  page,
}) => {
  await openScene(page, 'console-home');
  await page.locator('.ch-level').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.locator('#ch-profile-name')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/$/);
});

test('the style menu leads on to all settings', async ({ page }) => {
  await openScene(page, 'console-home');
  await page.getByRole('button', { name: 'Style and appearance' }).click();
  const menu = page.getByRole('menu', { name: 'Style and appearance' });
  await expect(menu.getByRole('menuitemradio', { name: 'Console Home' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitem', { name: 'About these games' })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/settings$/);
});

const PAGES: { name: string; route: string; player?: ScenePlayer }[] = [
  { name: 'profile', route: '#/home' },
  { name: 'first-day profile', route: '#/home', player: 'new' },
  { name: 'settings', route: '#/settings' },
  { name: 'about', route: '#/about' },
  { name: 'closet door', route: '#/closet' },
  { name: 'closet', route: '#/closet', player: 'root' },
  { name: 'rank-up', route: '#/', player: 'rankup' },
];

for (const { name, route, player } of PAGES) {
  for (const appearance of ['light', 'dark'] as const) {
    test(`axe: ${name} in ${appearance === 'light' ? 'Day' : 'Night'}`, async ({ page }) => {
      await openRoute(page, route, { appearance, freeze: true, ...(player ? { player } : {}) });
      await page.waitForTimeout(400);
      await expectNoAxeViolations(page);
    });
  }
}
