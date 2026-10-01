// Scripted moments for screenshots (scripts/snap.mjs). Each scene sets up a
// seeded match through window.__hunt, plays engine steps and render frames,
// and stops at the moment worth looking at. Deterministic: same seed, same
// keys, same picture (apart from GPU rounding).

const FACE = { '<': 123, '>': 125, '^': 105, v: 33 };

// play `steps` engine steps, rendering `per` frames of `ms` each in between
async function play(page, steps, per = 6, ms = 1000 / 60) {
  await page.evaluate(([s, p, m]) => {
    for (let i = 0; i < s; i++) {
      window.__hunt.step(1);
      window.__hunt.frames(p, m);
    }
  }, [steps, per, ms]);
}
// step until the human faces a long open corridor (the beam reaches far)
async function untilCorridor(page, max, len = 8) {
  return page.evaluate(([mx, want]) => {
    const H = window.__hunt;
    const DX = { 123: -1, 125: 1, 105: 0, 33: 0 };
    const DY = { 123: 0, 125: 0, 105: -1, 33: 1 };
    for (let i = 0; i < mx; i++) {
      H.step(1);
      H.frames(1, 16.7);
      const me = H.me();
      if (!me || me.flying >= 0 || !(me.face in DX)) continue;
      let n = 0;
      let x = me.x;
      let y = me.y;
      for (;;) {
        x += DX[me.face];
        y += DY[me.face];
        const c = H.g.maze[y * 51 + x];
        if (c !== 32) break;
        n++;
      }
      if (n >= want) return { step: H.g.step, run: n };
    }
    return null;
  }, [max, len]);
}
async function frames(page, n, ms = 1000 / 60) {
  await page.evaluate(([c, m]) => window.__hunt.frames(c, m), [n, ms]);
}
// run until an event of type t appears in a step (max n steps); then render
// `after` ms of frames so the effect is mid-flight.
async function until(page, t, n, afterMs, pred = '') {
  return page.evaluate(([type, max, after, p]) => {
    const H = window.__hunt;
    const test = p ? new Function('e', 'g', `return ${p}`) : null;
    for (let i = 0; i < max; i++) {
      const before = H.g.step;
      H.step(1);
      const ev = H.g.ev;
      const hit = ev.find((e) => e.t === type && (!test || test(e, H.g)));
      if (hit) {
        const k = Math.max(1, Math.round(after / 16.7));
        H.frames(k, 16.7);
        return { step: before + 1, hit };
      }
      H.frames(6, 16.7);
    }
    return null;
  }, [t, n, afterMs, pred]);
}

export const SCENES = {
  // A quiet corner of the maze: the light cone, remembered ghosts, darkness.
  'quiet-maze': {
    query: 'autostart=1&seed=1985&bots=2&difficulty=novice&arena=classic&view=modern&mode=ffa',
    async run(page) {
      await page.evaluate(() => window.__hunt.autopilot('otto', 5));
      await play(page, 160, 1);
      const r = await untilCorridor(page, 400, 9);
      await frames(page, 12);
      return r;
    },
  },
  'quiet-follow': {
    query: 'autostart=1&seed=1985&bots=2&difficulty=novice&arena=classic&view=modern&mode=ffa&camera=follow',
    async run(page) {
      await page.evaluate(() => window.__hunt.autopilot('otto', 5));
      await play(page, 120, 1);
      const r = await untilCorridor(page, 400, 9);
      await frames(page, 12);
      return r;
    },
  },
  // A firefight in the Ricochet arena: a shot bouncing off a mirror,
  // watched from close by (monitor view: see-all).
  firefight: {
    query: 'autostart=1&seed=7&bots=6&difficulty=sharp&arena=ricochet&view=modern&mode=ffa&flags=seeAll',
    async run(page) {
      await play(page, 40, 1);
      const r = await until(page, 'bounce', 800, 45);
      if (r) await page.evaluate(([x, y]) => window.__hunt.focus(x, y, 15), [r.hit.x, r.hit.y]);
      await frames(page, 1);
      return r;
    },
  },
  // A grenade (or bigger) mid-shockwave, close by.
  'grenade-blast': {
    query: 'autostart=1&seed=31&bots=6&difficulty=mixed&arena=veteran&view=modern&mode=ffa&flags=seeAll',
    async run(page) {
      await play(page, 20, 1);
      const r = await until(page, 'boom', 1500, 90, 'e.size >= 2');
      if (r) await page.evaluate(([x, y]) => window.__hunt.focus(x, y, 16), [r.hit.x, r.hit.y]);
      await frames(page, 1);
      return r;
    },
  },
  // Slime spreading through corridors.
  'slime-spread': {
    query: 'autostart=1&seed=20260924&bots=6&difficulty=otto&arena=classic&view=modern&mode=ffa&flags=seeAll',
    async run(page) {
      await play(page, 10, 1);
      const r = await until(page, 'splat', 2000, 30);
      if (r) await page.evaluate(([x, y]) => window.__hunt.focus(x, y, 15), [r.hit.x, r.hit.y]);
      await play(page, 3, 7);
      return r;
    },
  },
  // A big bomb (7x7 or larger) demolishing masonry.
  bomb: {
    query: 'autostart=1&seed=99&bots=4&difficulty=otto&arena=classic&view=modern&mode=ffa&flags=seeAll',
    async run(page) {
      await play(page, 30, 1);
      // hand a bot a bomb and let it throw it
      await page.evaluate(() => { const g = window.__hunt.g; const p = g.slots[1]; p.ammo = 200; p.q = ['G'.charCodeAt(0)]; });
      const r = await until(page, 'boom', 60, 150, 'e.size >= 4');
      if (r) await page.evaluate(([x, y]) => window.__hunt.focus(x, y, 20), [r.hit.x, r.hit.y]);
      await frames(page, 1);
      return r;
    },
  },
  // Deaths: a burst of light shards.
  death: {
    query: 'autostart=1&seed=5&bots=6&difficulty=sharp&arena=veteran&view=modern&mode=ffa&flags=seeAll',
    async run(page) {
      await play(page, 10, 1);
      const r = await until(page, 'death', 1500, 90, "e.name !== 'you'");
      if (r) await page.evaluate(([x, y]) => window.__hunt.focus(x, y, 12), [r.hit.x, r.hit.y]);
      await frames(page, 1);
      return r;
    },
  },
  // A re-entry: the respawn beam.
  respawn: {
    query: 'autostart=1&seed=5&bots=6&difficulty=sharp&arena=veteran&view=modern&mode=ffa&flags=seeAll',
    async run(page) {
      await play(page, 10, 1);
      const r = await until(page, 'enter', 2000, 700, "e.name !== 'you'");
      if (r) await page.evaluate(([x, y]) => window.__hunt.focus(x, y, 12), [r.hit.x, r.hit.y]);
      await frames(page, 1);
      return r;
    },
  },
  // A cloaked player in view: refraction shimmer.
  cloak: {
    query: 'autostart=1&seed=12&bots=3&difficulty=novice&arena=classic&view=modern&mode=ffa&flags=seeAll',
    async run(page) {
      await play(page, 4, 1);
      const r = await page.evaluate(() => {
        const H = window.__hunt;
        const g = H.g;
        const p = g.slots.slice(0, g.np).find((q) => q.cloak >= 0 && q !== H.me()) || g.slots[1];
        p.cloak = 30;
        return { x: p.x, y: p.y };
      });
      await page.evaluate(([x, y]) => window.__hunt.focus(x, y, 7), [r.x, r.y]);
      await frames(page, 30);
      return r;
    },
  },
  // Flying: thrown by a wall growing back (or entering flying).
  flying: {
    query: 'autostart=1&seed=8&bots=3&difficulty=novice&arena=classic&view=modern&mode=ffa&flags=seeAll&enter=f',
    async run(page) {
      await page.evaluate(() => { const me = window.__hunt.me(); window.__hunt.focus(me.x, me.y, 16); });
      await play(page, 2, 3);
      return page.evaluate(() => { const me = window.__hunt.me(); return me && { x: me.x, y: me.y, flying: me.flying }; });
    },
  },
  // The Coach: a multi-bounce ricochet preview in the Ricochet arena.
  coach: {
    query: 'autostart=1&seed=7&bots=2&difficulty=novice&arena=ricochet&view=modern&mode=ffa&coach=1&camera=follow',
    async run(page) {
      // find a free cell and facing whose shot banks off 3+ mirrors
      const r = await page.evaluate(() => {
        const H = window.__hunt;
        const faces = [123, 125, 105, 33];
        let best = null;
        for (let y = 1; y < 22; y++) {
          for (let x = 1; x < 50; x++) {
            if (H.g.maze[y * 51 + x] !== 32) continue;
            for (const f of faces) {
              H.place(x, y, f);
              const p = H.plan();
              if (!p) continue;
              const n = p.tr.bounces.length;
              if (p.tr.end.kind === 'wall' && n >= 3 && n <= 6 && (!best || n > best.n || (n === best.n && p.tr.cells.length < best.len))) {
                best = { x, y, f, n, len: p.tr.cells.length };
              }
            }
          }
        }
        if (best) H.place(best.x, best.y, best.f);
        return best;
      });
      await frames(page, 40);
      return r;
    },
  },
  // Classic terminal next to the modern arena, same engine state.
  split: {
    query: 'autostart=1&seed=1985&bots=3&difficulty=novice&arena=veteran&view=split&mode=ffa',
    async run(page) {
      await page.evaluate(() => window.__hunt.autopilot('otto', 5));
      await play(page, 140, 1);
      const r = await untilCorridor(page, 400, 8);
      await frames(page, 12);
      return r;
    },
  },
  // The terminal on its own (what a no-WebGL browser gets).
  terminal: {
    query: 'autostart=1&seed=1985&bots=3&difficulty=novice&arena=veteran&view=classic&mode=ffa',
    async run(page) {
      await page.evaluate(() => window.__hunt.autopilot('otto', 5));
      await play(page, 220, 1);
      return { step: await page.evaluate(() => window.__hunt.g.step) };
    },
  },
  // The Override panel open, a flag on: badge + cheated score.
  override: {
    query: 'autostart=1&seed=7&bots=5&difficulty=sharp&arena=ricochet&view=modern&mode=ffa&override=1',
    async run(page) {
      await page.evaluate(() => { window.__hunt.override('god', true); window.__hunt.autopilot('sharp', 3); });
      await play(page, 90, 1);
      await page.evaluate(() => { window.__hunt.override('revealMines', true); window.__hunt.override('seeAll', true); });
      await play(page, 2, 10);
      return null;
    },
  },
  setup: {
    query: '',
    async run(page) { await frames(page, 2); return null; },
  },
};

void FACE;
