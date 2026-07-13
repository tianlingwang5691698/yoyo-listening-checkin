#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const CloudBase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock-third-edition-final');
const UPLOAD_REPORT = path.join(DATA, 'separate-upload-report.json');
const OUTPUT = path.join(DATA, 'separate-performance-regression.json');

function credential() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}
function sha256(body) { return crypto.createHash('sha256').update(body).digest('hex'); }
function getJson(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '');
  const url = encodeURI(`${base}/${cloudPath}?editionRegression=${Date.now()}-${Math.random()}`);
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    execFile('curl', ['-fsSL', '--max-time', '15', '-H', 'Cache-Control: no-cache', url], { encoding: 'buffer', maxBuffer: 2 * 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(new Error(`https-failed:${cloudPath}:${error.message}`));
      try {
        resolve({ rows: JSON.parse(stdout.toString('utf8')), bytes: stdout.length, sha256: sha256(stdout), wallMs: Date.now() - startedAt });
      } catch (parseError) { reject(parseError); }
    });
  });
}
async function invoke(manager, functionName, level) {
  const startedAt = Date.now();
  const response = await manager.functions.invokeFunction(functionName, { action: 'getDictionaryBook', payload: { level } });
  const wallMs = Date.now() - startedAt;
  if (response.ErrMsg) throw new Error(`${functionName}:${response.ErrMsg}`);
  const result = JSON.parse(response.RetMsg || '{}');
  if (!Array.isArray(result.rows) || result.rows.length !== Number(result.total || 0)) throw new Error(`${functionName}:invalid-result:${level}`);
  if (result.rows.some((row) => !String(row.example || '').trim() || !String(row.exampleMeaning || '').trim())) throw new Error(`${functionName}:example-missing:${level}`);
  return { functionName, level, total: result.total, wallMs, functionMs: Number(response.Duration || 0), cacheHit: Boolean(result.resourceDebug && result.resourceDebug.cacheHit) };
}
async function main() {
  const upload = JSON.parse(fs.readFileSync(UPLOAD_REPORT, 'utf8'));
  if (upload.uploadedThird !== 64 || upload.restoredSecond !== 64 || upload.verified !== 128) throw new Error('upload-report-incomplete');
  const storage = [];
  for (let offset = 0; offset < upload.targets.length; offset += 8) {
    const batch = upload.targets.slice(offset, offset + 8);
    const results = await Promise.all(batch.flatMap(async (target) => {
      const [second, third] = await Promise.all([getJson(target.secondCloudPath), getJson(target.thirdCloudPath)]);
      if (second.rows.length !== target.secondCount || second.sha256 !== target.secondSha256) throw new Error(`second-mismatch:${target.secondCloudPath}`);
      if (third.rows.length !== target.thirdCount || third.sha256 !== target.thirdSha256) throw new Error(`third-mismatch:${target.thirdCloudPath}`);
      return [
        { edition: 2, cloudPath: target.secondCloudPath, count: second.rows.length, bytes: second.bytes, wallMs: second.wallMs },
        { edition: 3, cloudPath: target.thirdCloudPath, count: third.rows.length, bytes: third.bytes, wallMs: third.wallMs }
      ];
    }));
    storage.push(...results.flat());
  }

  const manager = CloudBase.init({ ...credential(), envId: appConfig.cloudEnvId });
  const coldKeys = ['unlock-1-u1-ls', 'unlock-2-u4-rw', 'unlock-4-u8-ls', 'unlock-v3-1-u1-ls', 'unlock-v3-2-u4-rw', 'unlock-v3-4-u8-ls'];
  const coldCalls = [];
  for (const key of coldKeys) coldCalls.push(await invoke(manager, 'dictionary-book', key));
  const warmCalls = [];
  for (const key of coldKeys) warmCalls.push(await invoke(manager, 'dictionary-book', key));
  const yoyoCall = await invoke(manager, 'yoyo', 'unlock-v3-3-u8-rw');
  const coldMisses = coldCalls.filter((item) => !item.cacheHit);
  const maxColdWallMs = Math.max(...(coldMisses.length ? coldMisses : coldCalls).map((item) => item.wallMs));
  const maxWarmWallMs = Math.max(...warmCalls.map((item) => item.wallMs));
  const report = {
    passed: storage.length === 128 && maxColdWallMs < 1200,
    storageFiles: storage.length,
    secondRows: storage.filter((item) => item.edition === 2).reduce((sum, item) => sum + item.count, 0),
    thirdRows: storage.filter((item) => item.edition === 3).reduce((sum, item) => sum + item.count, 0),
    storageMaxBytes: Math.max(...storage.map((item) => item.bytes)),
    storageMaxWallMs: Math.max(...storage.map((item) => item.wallMs)),
    coldCalls,
    warmCalls,
    yoyoCall,
    maxColdWallMs,
    maxWarmWallMs,
    target600msMet: maxColdWallMs < 600,
    hardThresholdMs: 1200
  };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) throw new Error(`unlock-editions-regression:${maxColdWallMs}ms`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
