#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'pete-the-cat', 'A2', 'pete-the-cat');
const SOURCE_PATH = path.join(BUILD_ROOT, 'catalog-items.json');
const TARGET_PATH = path.join(ROOT, 'cloudfunctions', 'yoyo', 'data', 'static-catalog-manifests.json');

const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
const target = JSON.parse(fs.readFileSync(TARGET_PATH, 'utf8'));
if (!Array.isArray(source) || source.length !== 40) {
  throw new Error(`expected 40 Pete the Cat catalog items, got ${Array.isArray(source) ? source.length : 'invalid'}`);
}
const categories = target.categories || (target.categories = {});
const existing = categories.petethecat;
const isLocalA1Draft = Array.isArray(existing)
  && existing.length === 40
  && existing.every((item) => item.category === 'petethecat' && String(item.audioCloudPath || '').startsWith('A1/Pete the Cat/'));
if (existing && JSON.stringify(existing) !== JSON.stringify(source) && !isLocalA1Draft) {
  throw new Error('existing petethecat static manifest differs; refusing implicit overwrite');
}
categories.petethecat = source;
fs.writeFileSync(TARGET_PATH, `${JSON.stringify(target, null, 2)}\n`);
console.log(JSON.stringify({ category: 'petethecat', count: source.length, target: TARGET_PATH }, null, 2));
