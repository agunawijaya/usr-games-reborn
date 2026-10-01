#!/usr/bin/env node
// Frame-rate under stress: 8 bots in the Ricochet arena, and every half
// second a random bot is handed ammo and a bomb or a big slime to throw,
// so explosions and slime never stop. Real time (requestAnimationFrame).
//   node scripts/perf.mjs gpu-high gpu-low cpu        (default: gpu-high gpu-low)
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const runs = process.argv.slice(2).length ? process.argv.slice(2) : ['gpu-high', 'gpu-low'];
const ARGS = {
  gpu: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  cpu: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'],
};
const port = 8600 + Math.floor(Math.random() * 90);
const server = await startServer(port);
const secs = +(process.env.SECS || 12);
for (const run of runs) {
  const [dev, q = 'auto'] = run.split('-');
  const browser = await chromium.launch({ args: ARGS[dev] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/?autostart=1&seed=77&bots=8&difficulty=mixed&arena=ricochet&view=modern&quality=${q}`);
  await page.waitForFunction(() => window.__ready === true && window.__hunt.g, null, { timeout: 240000 });
  const load = Date.now() - t0;
  const r = await page.evaluate(async (S) => {
    const H = window.__hunt;
    const heavy = ['G', '5', 'O', 'p', 'P', 'F', 'g'];
    let k = 0;
    const feeder = setInterval(() => {
      const g = H.g;
      for (let i = 0; i < g.np; i++) g.slots[i].ammo = Math.max(g.slots[i].ammo, 150);
      const p = g.slots[(k++ * 5) % g.np];
      if (p && p.q.length < 2) p.q.push(heavy[k % heavy.length].charCodeAt(0));
    }, 500);
    const times = [];
    let last = performance.now();
    let maxParticles = 0;
    let maxBullets = 0;
    await new Promise((done) => {
      const end = last + S * 1000;
      const f = (now) => {
        times.push(now - last);
        last = now;
        maxParticles = Math.max(maxParticles, H.renderer ? H.renderer.particles.n : 0);
        maxBullets = Math.max(maxBullets, H.g.bullets.length);
        if (now < end) requestAnimationFrame(f); else done();
      };
      requestAnimationFrame(f);
    });
    clearInterval(feeder);
    times.shift();
    const sorted = [...times].sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    return {
      fps: +(1000 / avg).toFixed(1), p95ms: +p95.toFixed(1), frames: times.length,
      profile: H.renderer ? H.renderer.profile : 'none', gpu: H.gpu.name || '',
      maxParticles, maxBullets, steps: H.g.step,
    };
  }, secs);
  console.log(`${run.padEnd(9)} load ${(load / 1000).toFixed(1)} s  ${JSON.stringify(r)}`);
  await browser.close();
}
server.close();
