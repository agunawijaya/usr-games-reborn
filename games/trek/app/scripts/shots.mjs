#!/usr/bin/env node
// Regenerates the README screenshots in media/ (npm run shots).
// Every shot is a real game state reached by typed commands (cmds=) under a
// fake clock (clock=ms), so re-running gives the same pictures.
// The comparison pairs live in media/compare/ (npm run compare).
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const media = join(here, '..', 'media');
const base = 'index.html?seed=428&difficulty=standard&help=0&capture=1';
const enc = (cmds) => encodeURIComponent(cmds);
const fight = 'shields up;move 1.5 1';
const jobs = [
  `01-title=index.html?help=0&capture=1&clock=2500`,
  `02-tactical-starbase=${base}&autostart=1&cmds=${enc('shields up')}&clock=2600`,
  `03-phaser=${base}&autostart=1&cmds=${enc(fight + ';phaser 400')}&clock=500&after=420`,
  `04-explosion=${base}&autostart=1&cmds=${enc(fight + ';phaser 400;torpedo 4.5')}&clock=500&after=1450`,
  `05-galaxy-chart=${base}&autostart=1&cmds=${enc(fight + ';lrscan;view')}&clock=6400`,
  `06-warp=${base}&autostart=1&cmds=${enc(fight)}&clock=1350`,
  `07-override=${base}&autostart=1&cmds=${enc('override;override map on;override shields on;override energy on;shields up;move 1.5 1')}&clock=6200`,
  `08-lineup=lab.html?view=ships&qx=5&qy=2&dist=15&tilt=28&info=0&clock=1500`,
  `09-starbase=lab.html?view=base&qx=1&qy=6&dist=11&tilt=38&info=0&clock=1500`,
];
const r = spawnSync(process.execPath, [join(here, 'snap.mjs'), media, ...jobs], { stdio: 'inherit' });
if (r.status) process.exit(r.status);
// No-GPU tiers: CPU-only WebGL (Lite) and no WebGL at all (2D fallback).
const cpu = spawnSync(process.execPath, [join(here, 'snap.mjs'), media, `10-no-gpu-lite=${base}&autostart=1&cmds=${enc(fight + ';phaser 400')}&clock=500&after=420`], { stdio: 'inherit', env: { ...process.env, GPU: 'cpu' } });
const nogl = spawnSync(process.execPath, [join(here, 'snap.mjs'), media, `11-no-webgl=${base}&autostart=1&cmds=${enc(fight + ';phaser 400')}&settle=4000`], { stdio: 'inherit', env: { ...process.env, GPU: 'nogl' } });
process.exit(cpu.status || nogl.status || 0);
