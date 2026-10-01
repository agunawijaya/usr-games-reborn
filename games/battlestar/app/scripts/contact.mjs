#!/usr/bin/env node
// Builds a contact sheet from a folder of screenshots (for reviewing many rooms at once).
//   node scripts/contact.mjs <dir> <out.png> [cols] [names...]
import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const [dir, out, cols = 3, ...names] = process.argv.slice(2);
const files = (names.length ? names.map((n) => `${n}.png`) : readdirSync(dir).filter((f) => f.endsWith('.png') && !f.startsWith('contact'))).sort();
const tiles = files.map((f) => `<figure><img src="data:image/png;base64,${readFileSync(join(dir, f)).toString('base64')}"><figcaption>${f.replace('.png', '')}</figcaption></figure>`).join('');
const html = `<style>body{margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;font:14px sans-serif;color:#ddd}
figure{margin:0;position:relative}img{width:100%;display:block}figcaption{position:absolute;left:6px;top:4px;background:#000a;padding:1px 6px}</style>${tiles}`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1800, height: 1000 } });
await p.setContent(html);
await p.waitForTimeout(300);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log(out, files.length, 'tiles');
