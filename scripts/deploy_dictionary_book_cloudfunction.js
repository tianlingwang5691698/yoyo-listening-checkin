#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');

function credential() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const manager = new CloudBaseManager({ ...credential(), envId: appConfig.cloudEnvId });
  const existing = await manager.functions.getFunctionDetail('dictionary-book').catch(() => null);
  const preflight = {
    mode: apply ? 'apply' : 'dry-run',
    functionName: 'dictionary-book',
    exists: !!existing,
    runtime: (existing && existing.Runtime) || 'Nodejs16.13',
    memorySize: (existing && existing.MemorySize) || 128
  };
  if (!apply) {
    console.log(JSON.stringify(preflight, null, 2));
    return;
  }
  await manager.functions.createFunction({
    force: true,
    func: {
      name: 'dictionary-book',
      runtime: preflight.runtime,
      handler: 'index.main',
      memorySize: preflight.memorySize,
      timeout: 10,
      installDependency: false
    },
    functionRootPath: path.join(ROOT, 'cloudfunctions'),
    functionPath: path.join(ROOT, 'cloudfunctions', 'dictionary-book')
  });
  const after = await manager.functions.getFunctionDetail('dictionary-book');
  console.log(JSON.stringify({ ...preflight, status: after.Status, modifiedAfter: after.ModTime }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
