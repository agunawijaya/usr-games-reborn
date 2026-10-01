// The pond layout: every terminal cell lands on visible water inside the
// simulation, for any window shape (port ADR-004).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRain } from '../src/engine/rain.js';
import {
  createPond, termToWorld, worldToGrid, project, hitWater, WAVE_SPEED,
} from '../src/render/geometry.js';

const ASPECTS = [16 / 9, 21 / 9, 4 / 3, 1, 0.8, 9 / 16];

test('the horizon sits a third of the way down; the camera looks at water', () => {
  const { cam } = createPond(16 / 9);
  const far = project(cam, [0, 0, 1e6]);
  assert.ok(Math.abs(far.y - (1 - 2 * 0.32)) < 1e-3);
  assert.equal(hitWater(cam, 0, 0.5), null, 'sky above the horizon');
  assert.ok(hitWater(cam, 0, -1).z > 1 && hitWater(cam, 0, -1).z < 2.5);
});

test('every terminal cell (corners and jitter included) is on screen and in the grid', () => {
  const rain = createRain();
  for (const aspect of ASPECTS) {
    for (const quality of ['high', 'low']) {
      const pond = createPond(aspect, quality);
      for (const x of [2, 3, 40, rain.COLS - 3]) {
        for (const y of [2, 12, rain.LINES - 3]) {
          for (const j of [-0.5, 0, 0.5]) {
            const w = termToWorld(pond, rain, x, y, j, j);
            const p = project(pond.cam, [w.x, 0, w.z]);
            assert.ok(Math.abs(p.x) <= 1 && p.y >= -1 && p.y <= 1, `${aspect} ${x},${y} on screen`);
            const g = worldToGrid(pond, w.x, w.z);
            const mu = pond.sponge / pond.Nu;
            const mv = pond.sponge / pond.Nv;
            assert.ok(g.u > mu && g.u < 1 - mu && g.v > mv && g.v < 1 - mv, `${aspect} ${x},${y} in grid`);
          }
        }
      }
    }
  }
});

test('the whole visible water inside the terminal range is simulated', () => {
  for (const aspect of ASPECTS) {
    const pond = createPond(aspect, 'high');
    for (const nx of [-1, -0.5, 0, 0.5, 1]) {
      const h = hitWater(pond.cam, nx, -1);
      const g = worldToGrid(pond, h.x, h.z);
      assert.ok(g.u >= 0 && g.u <= 1 && g.v >= 0, `${aspect} bottom edge ${nx}`);
    }
  }
});

test('grid cells are square and the time step is stable (CFL)', () => {
  for (const aspect of ASPECTS) {
    for (const quality of ['high', 'low']) {
      const p = createPond(aspect, quality);
      assert.ok(p.Nu <= 1024 && p.Nv <= 1024, `${aspect} ${quality} ${p.Nu}x${p.Nv}`);
      const courant = (WAVE_SPEED * p.dt) / (p.cell * p.r0);
      assert.ok(courant <= 0.5 + 1e-9, `courant ${courant}`);
      assert.ok(p.substeps <= 4);
    }
  }
});

test('rows run far to near, columns left to right', () => {
  const rain = createRain();
  const pond = createPond(16 / 9);
  const top = termToWorld(pond, rain, 40, 2);
  const bottom = termToWorld(pond, rain, 40, rain.LINES - 3);
  assert.ok(top.r > bottom.r * 4);
  assert.ok(termToWorld(pond, rain, 2, 10).x < 0 && termToWorld(pond, rain, rain.COLS - 3, 10).x > 0);
});
