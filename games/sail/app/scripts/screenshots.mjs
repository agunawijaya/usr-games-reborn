#!/usr/bin/env node
// Regenerates the port's screenshots in media/ (npm run shots).
// Every shot is a real game state reached through URL parameters:
//   scenario/ship/seed  the battle        stage=...   hand-placed positions/damage
//   auto=N              play N turns       last=show   show the final turn's cinematic
//   readyAt=fire|end|idle  capture moment  hud=0       photo mode (no panels)
//   focus/yaw/pitch/dist   camera framing
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const media = join(here, '..', 'media');
const duel = 'stage=0:row=10,col=38,dir=3;1:row=13,col=38,dir=3';
const jobs = [
  '00-title=index.html?settle=3000',
  `01-calm-sea=index.html?scenario=13&ship=1&seed=4&intro=0&hud=0&stage=0:row=7,col=46,dir=3;1:row=11,col=38,dir=3&focus=1&yaw=215&pitch=6&dist=150&settle=4000`,
  '02-rough-sea=index.html?scenario=10&ship=0&seed=2&intro=0&hud=0&focus=0&yaw=160&pitch=7&dist=170&settle=4000',
  `03-broadside=index.html?scenario=13&ship=1&seed=4&intro=0&${duel}&auto=1&cine=0&last=show&readyAt=fire&readyDelay=700`,
  '04-damaged-ship=index.html?scenario=18&ship=0&seed=3&intro=0&hud=0&stage=4:row=11,col=64,dir=3,hull=0,rig1=0,rig2=2,rig3=4,struck=1,explode=1&focus=4&yaw=150&pitch=10&dist=165&settle=6000',
  '05-tactical=index.html?scenario=18&ship=0&seed=4&intro=0&view=tactical&auto=2&cine=0&readyAt=idle',
  '06-storm=index.html?scenario=17&ship=0&seed=5&intro=0&hud=0&stage=w:speed=7,dir=2;0:row=10,col=30,dir=2&yaw=200&pitch=8&dist=160&settle=6000',
  '07-command=index.html?scenario=13&ship=1&seed=4&intro=0',
  '08-night=index.html?scenario=1&ship=0&seed=3&intro=0&hud=0&stage=0:row=10,col=40,dir=2;1:row=7,col=45,dir=2&focus=0&yaw=330&pitch=9&dist=170&settle=4000',
  '09-lake=index.html?scenario=14&ship=0&seed=3&intro=0&hud=0&stage=0:row=10,col=40,dir=8;1:row=12,col=44,dir=8;2:row=6,col=33,dir=2&focus=0&yaw=210&pitch=6&dist=150&settle=4000',
];
const r = spawnSync(process.execPath, [join(here, 'snap.mjs'), media, ...jobs], { stdio: 'inherit' });
process.exit(r.status ?? 1);
