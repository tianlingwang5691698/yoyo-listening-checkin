#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const BUILD_ROOT = path.join(__dirname, '..', 'data', 'transcript-build', 'little-bear', 'Pre A1', 'little-bear');
const bundleText = fs.readFileSync(path.join(BUILD_ROOT, 'bundle-sentence-v1.json'), 'utf8');
const catalogText = fs.readFileSync(path.join(BUILD_ROOT, 'catalog-items.json'), 'utf8');

const samples = [];
for (let index = 0; index < 200; index += 1) {
  const startedAt = performance.now();
  const bundle = JSON.parse(bundleText);
  const catalog = JSON.parse(catalogText);
  if (Object.keys(bundle).length !== 17 || catalog.length !== 17) throw new Error('Little Bear count mismatch');
  samples.push(performance.now() - startedAt);
}
samples.sort((left, right) => left - right);
const p95Ms = samples[Math.floor(samples.length * 0.95)];
const report = {
  passed: p95Ms < 10,
  trackCount: 17,
  lineCount: 1786,
  bundleBytes: Buffer.byteLength(bundleText),
  catalogBytes: Buffer.byteLength(catalogText),
  parseP95Ms: Number(p95Ms.toFixed(3)),
  thresholdMs: 10,
};
fs.writeFileSync(path.join(BUILD_ROOT, 'performance-regression.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
