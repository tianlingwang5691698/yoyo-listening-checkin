#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const FUNCTION_ROOT = path.join(ROOT, 'cloudfunctions', 'yoyo');
const MANIFEST_RELATIVE_PATH = 'data/static-catalog-manifests.json';
const MANIFEST_PATH = path.join(FUNCTION_ROOT, MANIFEST_RELATIVE_PATH);

function credentials() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function validateManifest() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const routes = [
    ...(manifest.categories.magictreehouse || []),
    ...(manifest.categories.magictreehouseb1 || [])
  ];
  if (routes.length !== 52) throw new Error(`expected 52 Magic Tree House routes, got ${routes.length}`);
  const paths = routes.map((item) => item.textSource && item.textSource.filePath);
  if (paths[0] !== '_transcripts/A2/magic-tree-house/tracks-v5/track-magic-tree-house-001.json') {
    throw new Error('episode 001 is not routed to tracks-v5');
  }
  if (paths.slice(1).some((item) => !String(item || '').includes('/tracks-v4/'))) {
    throw new Error('episodes 002-052 must remain on tracks-v4');
  }
  return { routeCount: routes.length, v5RouteCount: paths.filter((item) => item.includes('/tracks-v5/')).length };
}

async function waitActive(manager) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const detail = await manager.functions.getFunctionDetail('yoyo');
    if (detail.Status === 'Active') return detail;
    if (String(detail.Status || '').includes('Failed')) throw new Error(`yoyo status: ${detail.Status}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('yoyo did not become Active within 120 seconds');
}

async function main() {
  const apply = process.argv.includes('--apply');
  const manifest = validateManifest();
  const manager = new CloudBaseManager({ ...credentials(), envId: appConfig.cloudEnvId });
  const before = await manager.functions.getFunctionDetail('yoyo');
  const preflight = {
    mode: apply ? 'preflight-before-apply' : 'dry-run',
    envId: appConfig.cloudEnvId,
    functionName: 'yoyo',
    statusBefore: before.Status || '',
    modifiedBefore: before.ModTime || '',
    incrementalFile: MANIFEST_RELATIVE_PATH,
    ...manifest
  };
  if (!apply) {
    console.log(JSON.stringify(preflight, null, 2));
    return;
  }
  const result = await manager.functions.updateFunctionIncrementalCode({
    func: { name: 'yoyo', runtime: before.Runtime || 'Nodejs16.13' },
    functionRootPath: FUNCTION_ROOT,
    addFiles: MANIFEST_RELATIVE_PATH
  });
  const after = await waitActive(manager);
  console.log(JSON.stringify({
    mode: 'applied',
    envId: appConfig.cloudEnvId,
    functionName: 'yoyo',
    requestId: result.RequestId || '',
    statusAfter: after.Status || '',
    modifiedAfter: after.ModTime || '',
    incrementalFile: MANIFEST_RELATIVE_PATH,
    ...manifest
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
