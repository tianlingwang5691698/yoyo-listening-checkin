#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const credentialPath = path.join(ROOT, 'SecretKey.csv');

function readCredential() {
  if (!fs.existsSync(credentialPath)) return {};
  const lines = fs.readFileSync(credentialPath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return {};
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0] || '', secretKey: values[1] || '' };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const credential = readCredential();
  if (!credential.secretId || !credential.secretKey) throw new Error('SecretKey.csv is missing valid SDK credentials');
  const manager = new CloudBaseManager({
    secretId: credential.secretId,
    secretKey: credential.secretKey,
    envId: appConfig.cloudEnvId
  });
  const before = await manager.functions.getFunctionDetail('yoyo');
  const preflight = {
    mode: apply ? 'preflight-before-apply' : 'dry-run',
    envId: appConfig.cloudEnvId,
    functionName: 'yoyo',
    statusBefore: before.Status || '',
    runtime: before.Runtime || 'Nodejs16.13',
    modifiedBefore: before.ModTime || '',
    functionPath: path.join(ROOT, 'cloudfunctions', 'yoyo')
  };
  if (!apply) {
    console.log(JSON.stringify(preflight, null, 2));
    return;
  }
  const result = await manager.functions.updateFunctionCode({
    func: {
      name: 'yoyo',
      runtime: before.Runtime || 'Nodejs16.13',
      handler: before.Handler || 'index.main',
      installDependency: true,
      isWaitInstall: true
    },
    functionRootPath: path.join(ROOT, 'cloudfunctions'),
    functionPath: path.join(ROOT, 'cloudfunctions', 'yoyo')
  });
  const after = await manager.functions.getFunctionDetail('yoyo');
  console.log(JSON.stringify({
    mode: 'apply',
    envId: appConfig.cloudEnvId,
    functionName: 'yoyo',
    requestId: result.RequestId || '',
    statusAfter: after.Status || '',
    runtime: after.Runtime || '',
    modifiedAfter: after.ModTime || ''
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
