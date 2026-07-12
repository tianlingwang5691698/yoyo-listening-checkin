#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const CloudBase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock4-third-edition');
const FINAL = path.join(DATA, 'increment-final', 'level-4');
const BACKUP = path.join(ROOT, 'data', 'unlock-vocabulary', 'backups', '2026-07-13-before-unlock4-third-edition', 'level-4');

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

async function invoke(manager, functionName, level) {
  const startedAt = Date.now();
  const response = await manager.functions.invokeFunction(functionName, { action: 'getDictionaryBook', payload: { level } });
  const wallMs = Date.now() - startedAt;
  if (response.ErrMsg) throw new Error(`${functionName}:${response.ErrMsg}`);
  const result = JSON.parse(response.RetMsg || '{}');
  if (!Array.isArray(result.rows) || result.rows.some((row) => !String(row.example || '').trim() || !String(row.exampleMeaning || '').trim())) {
    throw new Error(`${functionName}:invalid-result`);
  }
  return { functionName, level, wallMs, functionMs: Number(response.Duration || 0), total: result.total, cacheHit: Boolean(result.resourceDebug && result.resourceDebug.cacheHit) };
}

async function main() {
  const storage = [];
  for (let unit = 1; unit <= 8; unit += 1) {
    for (const section of ['ls', 'rw']) {
      const cloudPath = `dictionary_books/unlock-v2/level-4/unit-${unit}/${section}.json`;
      const expected = JSON.parse(fs.readFileSync(path.join(FINAL, `unit-${unit}`, `${section}.json`), 'utf8'));
      const old = JSON.parse(fs.readFileSync(path.join(BACKUP, `unit-${unit}`, `${section}.json`), 'utf8'));
      const remote = await getJson(cloudPath);
      if (JSON.stringify(remote.rows) !== JSON.stringify(expected)) throw new Error(`remote-content-mismatch:${cloudPath}`);
      if (JSON.stringify(remote.rows.slice(0, old.length)) !== JSON.stringify(old)) throw new Error(`old-prefix-changed:${cloudPath}`);
      if (remote.rows.slice(old.length).some((row) => !row.example || !row.exampleMeaning)) throw new Error(`new-example-missing:${cloudPath}`);
      storage.push({ cloudPath, total: remote.rows.length, added: remote.rows.length - old.length, bytes: remote.bytes, wallMs: remote.wallMs });
    }
  }

  const manager = CloudBase.init({ ...credential(), envId: appConfig.cloudEnvId });
  const calls = [];
  for (const level of ['unlock-4-u1-rw', 'unlock-4-u2-ls', 'unlock-4-u3-rw', 'unlock-4-u4-ls', 'unlock-4-u5-rw', 'unlock-4-u6-ls', 'unlock-4-u7-rw', 'unlock-4-u8-ls']) {
    calls.push(await invoke(manager, 'dictionary-book', level));
  }
  for (const level of ['unlock-4-u1-ls', 'unlock-4-u8-rw']) {
    calls.push(await invoke(manager, 'dictionary-book', level));
    calls.push(await invoke(manager, 'dictionary-book', level));
  }
  calls.push(await invoke(manager, 'yoyo', 'unlock-4-u8-rw'));
  const lightCalls = calls.filter((item) => item.functionName === 'dictionary-book');
  const cacheMissCalls = lightCalls.filter((item) => !item.cacheHit);
  const maxLightWallMs = Math.max(...lightCalls.map((item) => item.wallMs));
  const report = {
    passed: maxLightWallMs < 1200,
    storageBooks: storage.length,
    storageRows: storage.reduce((sum, item) => sum + item.total, 0),
    addedRows: storage.reduce((sum, item) => sum + item.added, 0),
    storageMaxBytes: Math.max(...storage.map((item) => item.bytes)),
    storageMaxMs: Math.max(...storage.map((item) => item.wallMs)),
    calls,
    cacheMissCalls,
    maxCacheMissWallMs: cacheMissCalls.length ? Math.max(...cacheMissCalls.map((item) => item.wallMs)) : 0,
    maxLightWallMs,
    target600msMet: maxLightWallMs < 600,
    hardThresholdMs: 1200
  };
  fs.writeFileSync(path.join(DATA, 'performance-regression.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) throw new Error(`dictionary-book-performance-regression:${maxLightWallMs}ms`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
