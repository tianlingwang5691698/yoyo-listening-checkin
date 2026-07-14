#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'data', 'transcript-build', 'little-bear', 'Pre A1', 'little-bear', 'catalog-items.json');
const targetPath = path.join(root, 'cloudfunctions', 'yoyo', 'data', 'static-catalog-manifests.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const target = JSON.parse(fs.readFileSync(targetPath, 'utf8'));

if (source.length !== 17 || source.some((item) => item.category !== 'littlebear' || item.transcriptStatus !== 'ready')) {
  throw new Error('Little Bear safe catalog is incomplete');
}
target.categories = target.categories || {};
target.categories.littlebear = source;
target.generatedAt = new Date().toISOString();
fs.writeFileSync(targetPath, `${JSON.stringify(target, null, 2)}\n`);
console.log(`littlebear=${source.length}`);
