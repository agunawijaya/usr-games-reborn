// Every picture of the five rooms is drawn in code: each painter returns one SVG, asks for nothing
// from the network or the old reference folder, and keeps its ids to itself so two copies of a
// picture can share a page.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alchemist } from '../src/art/alchemist.mjs';
import { captain } from '../src/art/captain.mjs';
import { templeCourt, templeCourtBowed } from '../src/art/court.mjs';
import { bat, candelabrum, cloaked, count, cryptWall, werewolf } from '../src/art/crypt.mjs';
import { barrel, chest, flotsam, FLOTSAM, holdWall, wallTorch } from '../src/art/hold.mjs';
import { atom, distillation, droppingFunnel, labWall, periodicChart, proportions, teslaCoil } from '../src/art/lab.mjs';
import { remains, REMAINS } from '../src/art/remains.mjs';
import { apis, deity, GODS, lotusTorch, mummy, sarcophagus, sphinx } from '../src/art/tomb.mjs';
import { astronaut, bridge, GASES, spaceBackdrop, spaceplane, trussStation, wheelStation } from '../src/art/void.mjs';
import { waterSurface } from '../src/art/water.mjs';

const painters = {
  captain, holdWall, wallTorch, barrel, chest,
  labWall, periodicChart, proportions, atom, teslaCoil, distillation, droppingFunnel, alchemist,
  sarcophagus, sphinx, apis, mummy, templeCourt, templeCourtBowed, lotusTorch,
  cryptWall, count, werewolf, cloaked, candelabrum, bat,
  spaceBackdrop, bridge, trussStation, wheelStation, spaceplane, astronaut,
};

/** Every picture, each drawn with the id prefix given. */
function everyPicture(prefix) {
  const pictures = Object.entries(painters).map(([name, paint]) => [name, paint({ id: `${prefix}-${name}` })]);
  for (const god of GODS) pictures.push([`deity:${god}`, deity(god, { id: `${prefix}-${god}` })]);
  for (const kind of FLOTSAM) pictures.push([`flotsam:${kind}`, flotsam(kind, { id: `${prefix}-fl-${kind}` })]);
  for (const kind of new Set(REMAINS)) pictures.push([`remains:${kind}`, remains(kind, { id: `${prefix}-rm-${kind}` })]);
  pictures.push(['water', waterSurface()]);
  return pictures;
}

test('every painter returns a single SVG drawn in code', () => {
  for (const [name, markup] of everyPicture('t')) {
    assert.match(markup, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" /, name);
    assert.ok(markup.endsWith('</svg>'), `${name} closes its svg`);
    assert.equal(markup.match(/<svg /g).length, 1, `${name} is one picture`);
    assert.doesNotMatch(markup, /references\//, `${name} uses no reference file`);
    assert.doesNotMatch(markup, /<image|href="(?!#)/, `${name} links to nothing outside itself`);
    const urls = markup.match(/https?:\/\/[^\s"')]+/g) ?? [];
    assert.deepEqual([...new Set(urls)], ['http://www.w3.org/2000/svg'], `${name} names no address but the SVG namespace`);
    assert.doesNotMatch(markup, /NaN|undefined/, `${name} has no broken numbers`);
  }
});

test('two copies of a picture never share an id', () => {
  const ids = new Map();
  for (const prefix of ['a', 'b']) {
    for (const [name, markup] of everyPicture(prefix)) {
      if (name === 'water') continue;
      for (const [, id] of markup.matchAll(/ id="([^"]+)"/g)) {
        assert.ok(id.startsWith(`${prefix}-`), `${name}: id ${id} carries its prefix`);
        assert.ok(!ids.has(id) || ids.get(id) === name, `${id} is used by ${ids.get(id)} and ${name}`);
        ids.set(id, name);
      }
    }
  }
});

test('every url(#…) a picture uses points at something it defines', () => {
  for (const [name, markup] of everyPicture('u')) {
    const defined = new Set([...markup.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    for (const [, ref] of markup.matchAll(/url\(#([^)]+)\)/g)) {
      assert.ok(defined.has(ref), `${name} refers to #${ref}, which it does not define`);
    }
  }
});

test('the mummy, the bats, the water and the Count keep the parts the rooms animate', () => {
  assert.match(mummy({ id: 'm' }), /m-sway[\s\S]*m-reach[\s\S]*m-loll/);
  assert.match(bat({ id: 'b' }), /<animate attributeName="d"/);
  assert.match(waterSurface(), /<animateTransform attributeName="transform" type="translate"/);
  assert.match(cloaked({ id: 'c' }), /c-clip-shoulders/);
});

test('the doktor has a pose for every miss, from upright to flat out', () => {
  const doktor = alchemist({ id: 'd' });
  for (let misses = 1; misses <= 6; misses++) {
    assert.ok(doktor.includes(`[data-slump="${misses}"] .d-torso { transform: rotate(`), `pose ${misses}`);
  }
  assert.match(doktor, /\[data-slump="6"\] \.d-dazed/);
});

test('the bridge watches four gases, nominal at the start and in danger at the sixth miss', () => {
  const deck = bridge({ id: 'v' });
  for (const key of ['o2', 'co2', 'nh3', 'h2s']) assert.match(deck, new RegExp(`data-gas="${key}" data-level="ok"`), key);
  assert.match(deck, /data-part="master" data-level="ok"/);
  for (const gas of GASES) {
    assert.equal(gas.readings.length, 7, `${gas.key} has a reading for every miss`);
    const [first, last] = [gas.readings[0], gas.readings[6]];
    if (gas.falling) assert.ok(first >= gas.warn && last < gas.crit, `${gas.key} falls from nominal to danger`);
    else assert.ok(first < gas.warn && last >= gas.crit, `${gas.key} rises from nominal to danger`);
  }
});
