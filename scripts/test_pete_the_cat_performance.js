#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const ROOT = path.join(__dirname, '..');
const BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'pete-the-cat', 'A2', 'pete-the-cat');
const catalogEngine = require('../cloudfunctions/yoyo/lib/catalog-engine');
const listeningPlanEngine = require('../cloudfunctions/yoyo/lib/listening-plan-engine');

async function main() {
  const summarySamples = [];
  for (let index = 0; index < 100; index += 1) {
    const startedAt = performance.now();
    const rows = listeningPlanEngine.buildMaterialEntries('A2', {
      getCatalogSummary: catalogEngine.getCatalogSummary
    });
    if (!rows.find((item) => item.category === 'petethecat' && item.totalCount === 40)) {
      throw new Error('Pete the Cat A2 summary missing');
    }
    summarySamples.push(performance.now() - startedAt);
  }

  const refreshStartedAt = performance.now();
  await catalogEngine.refreshRuntimeCatalogs(true, ['petethecat']);
  const staticRefreshMs = performance.now() - refreshStartedAt;
  const tasks = catalogEngine.getCatalog('petethecat');
  const report = {
    passed: tasks.length === 40
      && Math.max(...summarySamples) < 300
      && staticRefreshMs < 1200,
    category: 'petethecat',
    taskCount: tasks.length,
    cacheThresholdMs: 300,
    coldThresholdMs: 1200,
    summaryMaxMs: Number(Math.max(...summarySamples).toFixed(3)),
    summaryAverageMs: Number((summarySamples.reduce((sum, value) => sum + value, 0) / summarySamples.length).toFixed(3)),
    staticRefreshMs: Number(staticRefreshMs.toFixed(3)),
    scanMode: catalogEngine.getResourceDebugSnapshot().petethecatScanMode || 'static-manifest'
  };
  fs.writeFileSync(path.join(BUILD_ROOT, 'performance-regression.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
