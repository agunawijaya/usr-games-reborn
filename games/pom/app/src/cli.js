#!/usr/bin/env node
// Terminal front-end for the Selene engine: behaves like the original
//   pom [[[[[cc]yy]mm]dd]HH]
// Usage: node src/cli.js [arg]
import { runPom, localZone } from './engine/pom.js';

const r = runPom(process.argv[2], { now: Date.now() / 1000, zone: localZone() });
process.stdout.write(r.stdout);
process.stderr.write(r.stderr);
process.exitCode = r.code;
