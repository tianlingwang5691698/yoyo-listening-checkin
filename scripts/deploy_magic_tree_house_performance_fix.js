#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const FUNCTION_ROOT = path.join(ROOT, 'cloudfunctions', 'yoyo');
const REPORT_PATH = path.join(ROOT, 'data', 'transcript-build', 'magic-tree-house', 'performance-fix-deploy.json');
const FILES = [
  'lib/constants.js',
  'lib/request-context-engine.js',
  'lib/catalog-engine.js'
];

function credentials() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
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
  FILES.forEach((file) => {
    if (!fs.existsSync(path.join(FUNCTION_ROOT, file))) throw new Error(`missing deploy file: ${file}`);
  });
  const manager = new CloudBaseManager({ ...credentials(), envId: appConfig.cloudEnvId });
  const before = await manager.functions.getFunctionDetail('yoyo');
  if (!apply) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      envId: appConfig.cloudEnvId,
      statusBefore: before.Status || '',
      modifiedBefore: before.ModTime || '',
      incrementalFiles: FILES
    }, null, 2));
    return;
  }
  const requestIds = [];
  for (const file of FILES) {
    const result = await manager.functions.updateFunctionIncrementalCode({
      func: { name: 'yoyo', runtime: before.Runtime || 'Nodejs16.13' },
      functionRootPath: FUNCTION_ROOT,
      addFiles: file
    });
    requestIds.push({ file, requestId: result.RequestId || '' });
    await waitActive(manager);
  }
  const after = await manager.functions.getFunctionDetail('yoyo');
  const report = {
    mode: 'applied',
    envId: appConfig.cloudEnvId,
    functionName: 'yoyo',
    statusAfter: after.Status || '',
    modifiedAfter: after.ModTime || '',
    incrementalFiles: FILES,
    requestIds
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
