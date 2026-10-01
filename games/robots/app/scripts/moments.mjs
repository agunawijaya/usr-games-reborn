// Stages the big moments and photographs them (for review and for media/):
//   node scripts/moments.mjs <outdir> [only]    (dev server on APP_URL, default :5199)
// Each moment loads the page fresh, sets a hand-made board through the
// window.__rr hook, plays one action and takes shots at fixed delays.
import { chromium } from 'playwright';

const [out, only = ''] = process.argv.slice(2);
const url = (process.env.APP_URL ?? 'http://localhost:5173/') + (process.env.QUERY ? `?${process.env.QUERY}` : '');
const args = process.env.GPU === 'cpu' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];

const far = [{ x: 5, y: 4 }, { x: 55, y: 20 }, { x: 9, y: 19 }, { x: 50, y: 3 }];
const board = (player, robots, piles = [], extra = {}) => ({
  level: 2, score: 120, player, piles, waitBonus: 0, status: 'playing',
  robots: [...robots, ...far].map((r, i) => ({ id: 900 + i, ...r })), ...extra,
});

const MOMENTS = {
  // four pairs meet round you at once: x8, slow motion, MELTDOWN
  chain: {
    zoom: 34,
    state: board({ x: 30, y: 11 }, [
      { x: 26, y: 10 }, { x: 26, y: 12 }, { x: 34, y: 10 }, { x: 34, y: 12 },
      { x: 29, y: 7 }, { x: 31, y: 7 }, { x: 29, y: 15 }, { x: 31, y: 15 },
    ], [{ x: 24, y: 6 }]),
    act: { kind: 'move', direction: 'stay' },
    shots: [0, 120, 260, 420, 700, 1100, 2400],
  },
  // a close look: robots closing in, one pile smouldering
  close: {
    zoom: 52,
    state: board({ x: 30, y: 11 }, [{ x: 32, y: 10 }, { x: 28, y: 13 }, { x: 33, y: 13 }], [{ x: 28, y: 9 }]),
    shots: [1500],
  },
  // heaps up close: a fresh one (glowing scorch) next to an old one
  wreck: {
    zoom: 55,
    state: board({ x: 30, y: 11 }, [{ x: 27, y: 10 }, { x: 27, y: 12 }, { x: 33, y: 13 }], [{ x: 31, y: 9 }]),
    act: { kind: 'move', direction: 'stay' },
    shots: [500, 2500],
  },
  teleport: {
    zoom: 22,
    state: board({ x: 30, y: 11 }, [{ x: 32, y: 10 }, { x: 28, y: 13 }, { x: 31, y: 12 }]),
    act: { kind: 'teleport' },
    shots: [0, 150, 350, 700, 1400],
  },
  teleportClose: {
    zoom: 44,
    state: board({ x: 30, y: 11 }, [{ x: 32, y: 10 }, { x: 28, y: 13 }, { x: 31, y: 12 }]),
    act: { kind: 'teleport' },
    shots: [100, 250, 400, 600],
  },
  death: {
    zoom: 40,
    state: board({ x: 30, y: 11 }, [{ x: 31, y: 11 }, { x: 33, y: 13 }]),
    act: { kind: 'move', direction: 'stay' },
    shots: [100, 400, 900, 2600],
  },
  // the crowd boos and throws its rubbish (wider view)
  booed: {
    zoom: 22,
    state: board({ x: 30, y: 11 }, [{ x: 31, y: 11 }, { x: 33, y: 13 }]),
    act: { kind: 'move', direction: 'stay' },
    shots: [1600, 3000, 5000, 8500],
  },
  // the crowd up close, cheering a chain (the Mexican wave starts at ×4)
  fans: {
    zoom: 48,
    state: board({ x: 8, y: 2 }, [{ x: 4, y: 1 }, { x: 4, y: 3 }, { x: 12, y: 1 }, { x: 12, y: 3 }]),
    act: { kind: 'move', direction: 'stay' },
    shots: [900, 2200],
  },
  // the last two robots crash: sector clear, then the jump
  clear: {
    zoom: 0,
    state: board({ x: 30, y: 11 }, [{ x: 26, y: 10 }, { x: 26, y: 12 }], [], { robots: [{ id: 1, x: 26, y: 10 }, { id: 2, x: 26, y: 12 }] }),
    act: { kind: 'move', direction: 'stay' },
    shots: [1500, 2600, 3800, 5200],
    then: 'advance',
    thenShots: [300, 650, 1000, 1600, 2600],
  },
};

const browser = await chromium.launch({ args });
for (const [name, m] of Object.entries(MOMENTS)) {
  if (only && !only.split(',').includes(name)) continue;
  const page = await browser.newPage({ viewport: { width: +(process.env.W || 1600), height: +(process.env.H || 900) } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errs.push(msg.text()); });
  await page.goto(url);
  await page.waitForFunction(() => !!window.__rr, null, { timeout: 60000 });
  await page.waitForTimeout(4200); // the opening: star, zoom in, robots beam down
  // zoom 0: keep the game's own fitted view
  await page.evaluate(([s, z]) => { if (z) window.__rr.setZoom(z); window.__rr.setState(s); }, [m.state, m.zoom]);
  await page.waitForTimeout(1600);
  const snap = async (tag, delays) => {
    let t = 0;
    for (const d of delays) {
      await page.waitForTimeout(d - t);
      t = d;
      await page.screenshot({ path: `${out}/${name}-${tag}${String(d).padStart(4, '0')}.png` });
    }
  };
  if (m.act) await page.evaluate((a) => window.__rr.act(a), m.act);
  await snap('', m.shots);
  if (m.then === 'advance') {
    await page.evaluate(() => window.__rr.advance());
    await snap('warp', m.thenShots);
  }
  console.log(name, errs.length ? 'ERRORS: ' + errs.slice(0, 3).join(' | ') : 'ok');
  await page.close();
}
await browser.close();
