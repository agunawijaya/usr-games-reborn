import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { emptyProgression } from '../../../packages/kit/src/progression/state';

/**
 * Holo Collection: cards, the holo lean, keyboard play, the flip, the album, settings, about,
 * the server closet, the rank-up card reveal and axe on every screen by day and by night.
 */

const scene = (name: string, appearance = 'light') =>
  `/?scene=${name}&appearance=${appearance}&freeze=1`;

/** A scene opened on any route, as any of the demo players, still or live. */
function sceneAt(
  route: string,
  options: { appearance?: 'light' | 'dark'; player?: string; freeze?: boolean } = {},
) {
  const params = new URLSearchParams({
    scene: 'holo-home',
    appearance: options.appearance ?? 'light',
    route,
  });
  if (options.player) params.set('player', options.player);
  if (options.freeze ?? true) params.set('freeze', '1');
  return `/?${params}`;
}

interface Seed {
  xp?: number;
  celebrated?: 'guest' | 'user' | 'staff' | 'wheel' | 'root';
  appearance?: 'light' | 'dark';
  motion?: 'full' | 'reduce';
}

/**
 * A real save in the browser's storage, written once per tab before the Hall starts, so a
 * reload reads back whatever the test changed. By default ada is Level 17 with two foils.
 */
async function seedHolo(page: Page, seed: Seed = {}) {
  const progression = {
    ...emptyProgression(),
    xp: seed.xp ?? 8_805,
    celebratedRank: seed.celebrated ?? 'staff',
  };
  const settings = {
    style: 'holo',
    appearance: seed.appearance ?? 'light',
    motion: seed.motion ?? 'full',
  };
  await page.addInitScript(
    (saved) => {
      if (window.top !== window || window.sessionStorage.getItem('holo-seeded')) return;
      window.sessionStorage.setItem('holo-seeded', 'yes');
      window.localStorage.clear();
      const save = (key: string, data: unknown) =>
        window.localStorage.setItem(
          `usr-games:hall:${key}`,
          JSON.stringify({ v: 2, savedAt: '', data }),
        );
      save('settings', saved.settings);
      save('profile', {
        username: 'ada',
        guest: false,
        createdOn: null,
        hintsSeen: ['esc-menu'],
        styleChosen: true,
      });
      save('progression', saved.progression);
    },
    { settings, progression },
  );
}

async function axeViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map(
    (v) =>
      `${v.id}: ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(' | ')}`,
  );
}

test('Home shows today’s pick and every game as a card, set by set', async ({ page }) => {
  await page.goto(scene('holo-home'));
  await expect(page.locator('html')).toHaveAttribute('data-style', 'holo');
  await expect(page.locator('.hc-card--pick')).toContainText('Broadside');
  await expect(page.locator('.hc-card__sticker')).toContainText('Daily #');
  await expect(page.locator('.hc-grid .hc-card')).toHaveCount(30);
  await expect(page.locator('.hc-card--asleep')).toHaveCount(22);
  await expect(page.locator('.hc-level')).toContainText('Level');
});

test('a card leans toward the pointer and settles when the pointer leaves', async ({ page }) => {
  await page.goto(scene('holo-home'));
  const card = page.locator('[data-hero-hover]');
  await card.scrollIntoViewIfNeeded();
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.2, { steps: 5 });
  await expect(card).toHaveClass(/is-lifted/);
  await expect.poll(() => card.evaluate((el) => el.style.getPropertyValue('--hc-ry'))).not.toBe('');
  await page.mouse.move(5, 5);
  await expect(card).not.toHaveClass(/is-lifted/);
});

test('the keyboard walks the grid, opens a card, flips it and comes back', async ({ page }) => {
  await page.goto(scene('holo-home'));
  const first = page.locator('.hc-set--arcade .hc-card').first();
  await first.focus();
  await expect(first).toHaveClass(/is-lifted/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.hc-set--arcade .hc-card').nth(1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/game\//);
  await expect(page.locator('.hc-flip')).toHaveClass(/is-flipped/);
  await expect(page.locator('.hc-back__heading').first()).toHaveText('How to play');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/$/);
});

test('the weekly quests open and close with the keyboard', async ({ page }) => {
  await page.goto(scene('holo-home'));
  const button = page.locator('[data-focus-key="popover:quests"]');
  await button.click();
  await expect(page.locator('#hc-quests')).toBeVisible();
  await expect(page.locator('.hc-quest')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(page.locator('#hc-quests')).toHaveCount(0);
  await expect(page.locator('[data-focus-key="popover:quests"]')).toBeFocused();
});

test('the album sorts by rarity and the style switch leaves for another style', async ({
  page,
}) => {
  await page.goto(scene('holo-album'));
  await expect(page.locator('.hc-album-head__title')).toContainText('cards collected');
  await page.getByRole('button', { name: 'By rarity' }).click();
  await expect(page.locator('.hc-album__page .hc-set__title').first()).toHaveText('Rare');
  await page.locator('[data-focus-key="popover:look"]').click();
  await page.getByRole('button', { name: 'Machine Room' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'machine-room');
});

test('reduced motion keeps cards upright', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/?scene=holo-home&appearance=dark');
  const card = page.locator('[data-hero-hover]');
  // Scenes pin motion to "full"; wait for the style to paint, then switch the room to reduced.
  await card.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduce'));
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1, { steps: 4 });
  const transform = await card
    .locator('.hc-card__tilt')
    .evaluate((el) => getComputedStyle(el).transform);
  expect(transform).toBe('none');
  await context.close();
});

for (const name of ['holo-home', 'holo-album'] as const) {
  for (const appearance of ['light', 'dark'] as const) {
    test(`axe: ${name} ${appearance === 'light' ? 'Day' : 'Night'}`, async ({ page }) => {
      await page.goto(scene(name, appearance));
      await expect(page.locator('#screen')).not.toBeEmpty();
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

for (const appearance of ['light', 'dark'] as const) {
  test(`axe: game page ${appearance === 'light' ? 'Day' : 'Night'}`, async ({ page }) => {
    await page.goto(sceneAt('#/game/robots', { appearance }));
    await expect(page.locator('.hc-flip')).toHaveClass(/is-flipped/);
    expect(await axeViolations(page)).toEqual([]);
  });
}

test('settings show every section, with finishes locked until their level', async ({ page }) => {
  await page.goto(sceneAt('#/settings'));
  await expect(page.locator('.hc-page--settings h1')).toHaveText('Make the Hall yours');
  await expect(page.locator('.set-section')).toHaveCount(9);
  const finish = (id: string) => page.locator(`input[type="radio"][value="${id}"]`);
  await expect(finish('finish-galaxy')).toBeEnabled();
  await expect(finish('finish-gold')).toBeDisabled();
  await expect(page.locator('.set-choice.is-locked').first()).toContainText('Unlocks at Level 25');
  await page.locator('.set-choice', { has: finish('finish-galaxy') }).click();
  await expect(page.locator('.hc-app')).toHaveClass(/hc-finish-galaxy/);
  await expect(page.locator('.hc-settings-sample__caption')).toHaveText('Galaxy foil');
});

test('settings persist across a reload: finish, appearance and volume', async ({ page }) => {
  await seedHolo(page);
  await page.goto('/#/settings');
  await expect(page.locator('.hc-page--settings')).toBeVisible();
  await page.locator('.set-choice', { has: page.locator('input[value="finish-prism"]') }).click();
  await page.locator('.set-choice', { has: page.locator('input[value="dark"]') }).click();
  await page.locator('input[type="range"]').fill('70');
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
  await page.reload();
  await expect(page.locator('.hc-page--settings')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
  await expect(page.locator('.hc-app')).toHaveClass(/hc-finish-prism/);
  await expect(page.locator('input[value="finish-prism"]')).toBeChecked();
  await expect(page.locator('input[type="range"]')).toHaveValue('70');
});

test('the style can be switched from Settings', async ({ page }) => {
  await seedHolo(page);
  await page.goto('/#/settings');
  await page.locator('.set-choice', { has: page.locator('input[value="console"]') }).click();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'console');
});

test('Forget my data asks first, then wipes everything and returns to the login', async ({
  page,
}) => {
  await seedHolo(page);
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Forget my data…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Forget everything?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep my data' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.hc-page--settings')).toBeVisible();
  await page.getByRole('button', { name: 'Forget my data…' }).click();
  await dialog.getByRole('button', { name: 'Forget everything' }).click();
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.locator('html')).toHaveAttribute('data-style', 'login');
});

test('the section list jumps to a section and the keyboard sets the volume', async ({ page }) => {
  await seedHolo(page);
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Sound' }).focus();
  await page.keyboard.press('Enter');
  const volume = page.locator('input[type="range"]');
  await expect(volume).toBeFocused();
  const before = Number(await volume.inputValue());
  await page.keyboard.press('ArrowRight');
  await expect(volume).toHaveValue(String(before + 5));
});

test('About tells the story and credits every original', async ({ page }) => {
  await page.goto(sceneAt('#/about'));
  await expect(page.locator('.hc-page--about h1')).toContainText('games with a long story');
  await expect(page.locator('.ab-section')).toHaveCount(4);
  await expect(page.locator('.ab-credit').first()).toContainText('reborn from');
  await expect(page.locator('.hc-about-fan .hc-card')).toHaveCount(3);
});

test('the footer reaches About, Settings and the closet door', async ({ page }) => {
  await page.goto(sceneAt('#/'));
  const footer = page.locator('.hc-footer');
  await expect(footer.getByRole('link', { name: /The server closet/ })).toContainText('Level 40');
  await footer.getByRole('link', { name: 'About these games' }).click();
  await expect(page).toHaveURL(/#\/about$/);
  await expect(page.locator('.hc-page--about')).toBeVisible();
});

test('a first-day album is warm, with every level card still to earn', async ({ page }) => {
  await page.goto(sceneAt('#/home', { player: 'new' }));
  await expect(page.locator('.hc-album-stats')).toContainText('Starts with your first game');
  await expect(page.locator('.hc-album-stats')).toContainText('arrives at Level 2');
  await expect(page.locator('.hc-album__hint')).toContainText('Your album is ready');
  const levels = page.locator('.hc-album__page--levels');
  await expect(levels.locator('.hc-set__count')).toHaveText('0 / 4');
  await expect(levels.locator('.hc-card--level.hc-card--locked')).toHaveCount(4);
  await expect(page.locator('.hc-album-head__door')).toHaveCount(0);
});

test('at the top level the album opens the server closet', async ({ page }) => {
  await page.goto(sceneAt('#/home', { player: 'root' }));
  await expect(page.locator('.hc-album__page--levels .hc-card--earned')).toHaveCount(4);
  await page.locator('.hc-album-head__door').click();
  await expect(page).toHaveURL(/#\/closet$/);
  await expect(page.locator('.cl-canvas')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Switches on the wall' })).toBeVisible();
});

test('below the top level the closet stays locked and says how far it is', async ({ page }) => {
  await page.goto(sceneAt('#/closet'));
  await expect(page.locator('.cl-locked')).toBeVisible();
  await expect(page.locator('.cl-status')).toContainText('opens at Level 40');
  await expect(page.getByRole('progressbar', { name: 'Progress to the closet' })).toBeVisible();
  await expect(page.locator('.cl-canvas')).toHaveCount(0);
});

test('a rank-up reveals the new level card once, and Escape skips it', async ({ page }) => {
  await page.goto(sceneAt('#/', { player: 'rankup', freeze: false }));
  const reveal = page.getByRole('dialog', { name: /Level 10/ });
  await expect(reveal).toBeVisible();
  await expect(reveal).toContainText('Galaxy foil');
  await expect(page.getByRole('status').filter({ hasText: 'Level up!' })).toContainText(
    'You reached Level 10',
  );
  await expect(page.locator('.hc-rankup__skip')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.hc-rankup__skip')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.hc-rankup')).toHaveCount(0);
  // Away to the album, where the new card now sits, and back: the moment does not return.
  await page.evaluate(() => (location.hash = '#/home'));
  await expect(page.locator('.hc-levelcard--staff.hc-card--earned')).toBeVisible();
  await page.evaluate(() => (location.hash = '#/'));
  await expect(page.locator('.hc-card--pick')).toBeVisible();
  await expect(page.locator('.hc-rankup')).toHaveCount(0);
});

test('the reveal settles on its own, is acknowledged, and does not come back', async ({ page }) => {
  await seedHolo(page, { xp: 3_000, celebrated: 'user' });
  await page.goto('/#/');
  await expect(page.locator('.hc-rankup.is-playing')).toBeVisible();
  await expect(page.locator('.hc-rankup')).toHaveCount(0, { timeout: 5_000 });
  await page.reload();
  await expect(page.locator('.hc-card--pick, .hc-pick--empty').first()).toBeVisible();
  await expect(page.locator('.hc-rankup')).toHaveCount(0);
});

test('with reduced motion the reveal is a calm fade', async ({ page }) => {
  await seedHolo(page, { xp: 3_000, celebrated: 'user', motion: 'reduce' });
  await page.goto('/#/');
  await expect(page.locator('.hc-rankup.is-calm')).toBeVisible();
  const spin = await page
    .locator('.hc-rankup__spin')
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(spin).toBe('none');
  await page.locator('.hc-rankup__skip').click();
  await expect(page.locator('.hc-rankup')).toHaveCount(0);
});

test('a frozen scene holds the brightest moment of the reveal', async ({ page }) => {
  await page.goto(sceneAt('#/', { player: 'rankup' }));
  await expect(page.locator('.hc-rankup.is-frozen')).toBeVisible();
  await page.waitForTimeout(2_600);
  await expect(page.locator('.hc-rankup.is-frozen')).toBeVisible();
});

type Look = 'light' | 'dark';

const SCREENS: { name: string; url: (appearance: Look) => string }[] = [
  { name: 'settings', url: (appearance) => sceneAt('#/settings', { appearance }) },
  { name: 'about', url: (appearance) => sceneAt('#/about', { appearance }) },
  { name: 'closet (locked)', url: (appearance) => sceneAt('#/closet', { appearance }) },
  {
    name: 'closet (open)',
    url: (appearance) => sceneAt('#/closet', { appearance, player: 'root' }),
  },
  { name: 'rank-up', url: (appearance) => sceneAt('#/', { appearance, player: 'rankup' }) },
  {
    name: 'album (first day)',
    url: (appearance) => sceneAt('#/home', { appearance, player: 'new' }),
  },
];

for (const screen of SCREENS) {
  for (const appearance of ['light', 'dark'] as const) {
    test(`axe: ${screen.name} ${appearance === 'light' ? 'Day' : 'Night'}`, async ({ page }) => {
      await page.goto(screen.url(appearance));
      await expect(page.locator('#screen')).not.toBeEmpty();
      expect(await axeViolations(page)).toEqual([]);
    });
  }
}
