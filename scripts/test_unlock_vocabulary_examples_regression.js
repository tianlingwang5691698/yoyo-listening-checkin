#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const CloudBase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const FINAL = path.join(ROOT, 'data', 'unlock-vocabulary', 'examples-final');

function credential() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function getJson(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '');
  const url = encodeURI(`${base}/${cloudPath}?regression=${Date.now()}-${Math.random()}`);
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    execFile('curl', ['-fsSL', '--max-time', '15', '-H', 'Cache-Control: no-cache', url], { encoding: 'buffer', maxBuffer: 2 * 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(error);
      try { resolve({ rows: JSON.parse(stdout.toString('utf8')), bytes: stdout.length, wallMs: Date.now() - startedAt }); } catch (parseError) { reject(parseError); }
    });
  });
}

async function getJsonWithRetry(cloudPath) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await getJson(cloudPath);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

async function invokeBook(manager, level) {
  const startedAt = Date.now();
  const response = await manager.functions.invokeFunction('yoyo', { action: 'getDictionaryBook', payload: { level } });
  const wallMs = Date.now() - startedAt;
  if (response.ErrMsg) throw new Error(`${level}:${response.ErrMsg}`);
  const result = JSON.parse(response.RetMsg || '{}');
  if (!Array.isArray(result.rows) || result.rows.some((row) => !String(row.example || '').trim())) throw new Error(`${level}:invalid-result`);
  return { level, wallMs, functionMs: Number(response.Duration || 0), bytes: Buffer.byteLength(response.RetMsg || ''), total: result.total };
}

async function main() {
  const storage = [];
  for (let level = 1; level <= 4; level += 1) {
    for (let unit = 1; unit <= 8; unit += 1) {
      for (const section of ['ls', 'rw']) {
        const cloudPath = `dictionary_books/unlock-v2/level-${level}/unit-${unit}/${section}.json`;
        const localPath = path.join(FINAL, `level-${level}`, `unit-${unit}`, `${section}.json`);
        const expected = JSON.parse(fs.readFileSync(localPath, 'utf8'));
        const remote = await getJsonWithRetry(cloudPath);
        if (remote.rows.length !== expected.length) throw new Error(`count-mismatch:${cloudPath}`);
        if (remote.rows.some((row) => !String(row.example || '').trim())) throw new Error(`missing-example:${cloudPath}`);
        storage.push({ cloudPath, total: remote.rows.length, bytes: remote.bytes, wallMs: remote.wallMs });
      }
    }
  }

  const keys = credential();
  const manager = CloudBase.init({ ...keys, envId: appConfig.cloudEnvId });
  const samples = ['unlock-1-u3-ls', 'unlock-2-u7-ls', 'unlock-3-u1-rw', 'unlock-4-u8-rw'];
  const calls = [];
  for (const level of samples) {
    calls.push(await invokeBook(manager, level));
    calls.push(await invokeBook(manager, level));
  }
  const maxWallMs = Math.max(...calls.map((item) => item.wallMs));
  const maxFunctionMs = Math.max(...calls.map((item) => item.functionMs));
  if (maxWallMs >= 1200) throw new Error(`performance-regression:max-wall-${maxWallMs}ms`);
  const report = {
    storageBooks: storage.length,
    storageRows: storage.reduce((sum, item) => sum + item.total, 0),
    storageMaxMs: Math.max(...storage.map((item) => item.wallMs)),
    storageMaxBytes: Math.max(...storage.map((item) => item.bytes)),
    cloudCalls: calls,
    maxWallMs,
    maxFunctionMs,
    thresholdMs: 1200,
    passed: true
  };
  fs.writeFileSync(path.join(FINAL, 'performance-regression.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
