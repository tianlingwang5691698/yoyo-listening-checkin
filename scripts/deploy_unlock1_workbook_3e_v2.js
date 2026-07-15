#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const FUNCTION_ROOT = path.join(ROOT, 'cloudfunctions');
const FILES = ['data/unlock-series-manifests.json', 'lib/constants.js'];
const REPORT = path.join(ROOT, 'data/transcript-build/unlock1-workbook-third-edition-v2/deploy-report-v2.json');

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
  throw new Error('yoyo did not become Active');
}
async function main() {
  const apply = process.argv.includes('--apply');
  const manager = new CloudBaseManager({ ...credentials(), envId: appConfig.cloudEnvId });
  const before = await waitActive(manager);
  if (!apply) return console.log(JSON.stringify({ mode: 'dry-run', statusBefore: before.Status, files: FILES }, null, 2));
  const requests = [];
  for (const file of FILES) {
    const result = await manager.functions.updateFunctionIncrementalCode({
      func: { name: 'yoyo', runtime: before.Runtime || 'Nodejs16.13' },
      functionRootPath: FUNCTION_ROOT,
      addFiles: file,
    });
    requests.push({ file, requestId: result.RequestId || '' });
    await waitActive(manager);
  }
  const after = await manager.functions.getFunctionDetail('yoyo');
  const report = { mode: 'applied', statusAfter: after.Status, modifiedAfter: after.ModTime, files: FILES, requests };
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => { console.error(error.stack || error); process.exit(1); });
