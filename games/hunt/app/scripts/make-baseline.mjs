#!/usr/bin/env node
// Records tests/fixtures/baseline.json: state hashes of seeded matches with
// every Override flag off. Regenerate ONLY for a deliberate engine change
// that the golden traces (tests/golden.test.js) also accept.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASELINE_MATCHES, chain } from '../tests/lib/baseline.js';

const out = BASELINE_MATCHES.map((cfg) => ({ cfg, hashes: chain(cfg).hashes }));
const file = join(dirname(fileURLToPath(import.meta.url)), '../tests/fixtures/baseline.json');
writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`baseline: ${out.length} matches x ${out[0].hashes.length} hashes -> tests/fixtures/baseline.json`);
