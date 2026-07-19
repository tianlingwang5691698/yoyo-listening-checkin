#!/usr/bin/env node

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'transcript-build', 'audio-performance', 'shanghai-senior-2024-2026-online.json');

function credentials() {
  const rows = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const [secretId, secretKey] = rows[1].split(',').map((value) => value.trim());
  return { secretId, secretKey };
}

function publicStatus(cloudPath) {
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  return new Promise((resolve) => {
    const request = https.request(encodeURI(`${baseUrl}/${cloudPath}`), { method: 'HEAD' }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode || 0));
    });
    request.setTimeout(10000, () => request.destroy());
    request.on('error', () => resolve(0));
    request.end();
  });
}

async function main() {
  const targets = [
    ['spring', 2024],
    ['autumn', 2024],
    ['spring', 2025]
  ].map(([session, year]) => {
    const items = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `listening-senior-${session}`, 'listening-practice.json'), 'utf8'));
    const item = items.find((row) => Number(row.year) === year);
    if (!item || !item.audioCloudPath) throw new Error(`listening-audio-missing:${session}:${year}`);
    return { session, year, itemId: item._id, cloudPath: item.audioCloudPath };
  });
  const keys = credentials();
  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...keys });
  const fileList = targets.map((item) => `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${item.cloudPath}`);
  const tempResult = await app.getTempFileURL({ fileList });
  const rows = await Promise.all(targets.map(async (target, index) => ({
    ...target,
    tempReady: !!((tempResult.fileList || [])[index] || {}).tempFileURL,
    tempCode: ((tempResult.fileList || [])[index] || {}).code || '',
    publicStatus: await publicStatus(target.cloudPath)
  })));
  const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
  const manager = CloudBaseManager.init({ envId: appConfig.cloudEnvId, ...keys });
  const invoke = async (action, payload) => {
    const startedAt = Date.now();
    const response = await manager.functions.invokeFunction('yoyo', { action, payload });
    if (response.ErrMsg) throw new Error(`${action}:${response.ErrMsg}`);
    return {
      data: JSON.parse(response.RetMsg || '{}'),
      wallMs: Date.now() - startedAt,
      functionMs: Number(response.Duration || 0)
    };
  };
  const materialCall = await invoke('getMaterialIndex', {});
  const readingCall = await invoke('getReadingHome', { directoryOnly: true, directoryVersion: 'senior-2026-v3' });
  const materialIds = (key) => (materialCall.data[key] || []).map((item) => item._id || item.materialItemId);
  const readingGroups = ((((readingCall.data.categoryTree || [])[0] || {}).groups) || []);
  const springReading = readingGroups.find((item) => item.key === '春考') || {};
  const autumnReading = readingGroups.find((item) => item.key === '秋考') || {};
  const onlineDirectory = {
    material: {
      wallMs: materialCall.wallMs,
      functionMs: materialCall.functionMs,
      writingSpring: materialIds('writingSeniorSpring').filter((item) => /sh-spring-202[456]-/.test(item)),
      writingAutumn: materialIds('writingSeniorAutumn').filter((item) => /sh-autumn-202[456]-/.test(item)),
      listeningSpring: materialIds('listeningSeniorSpring').filter((item) => /sh-spring-202[456]-/.test(item)),
      listeningAutumn: materialIds('listeningSeniorAutumn').filter((item) => /sh-autumn-202[456]-/.test(item))
    },
    reading: {
      wallMs: readingCall.wallMs,
      functionMs: readingCall.functionMs,
      springCount: Number(springReading.count || 0),
      autumnCount: Number(autumnReading.count || 0),
      springPapers: (springReading.districts || []).filter((item) => /sh-spring-202[456]/.test(item.key)).map((item) => item.key),
      autumnPapers: (autumnReading.districts || []).filter((item) => /sh-autumn-202[456]/.test(item.key)).map((item) => item.key)
    }
  };
  const expected = {
    writingSpring: 9,
    writingAutumn: 6,
    listeningSpring: ['sh-spring-2024-listening', 'sh-spring-2025-listening'],
    listeningAutumn: ['sh-autumn-2024-listening'],
    springReadingCount: 42,
    autumnReadingCount: 56,
    springPapers: ['sh-spring-2026', 'sh-spring-2025', 'sh-spring-2024'],
    autumnPapers: ['sh-autumn-2025', 'sh-autumn-2024']
  };
  const directoryPassed = onlineDirectory.material.writingSpring.length === expected.writingSpring
    && onlineDirectory.material.writingAutumn.length === expected.writingAutumn
    && onlineDirectory.material.listeningSpring.join(',') === expected.listeningSpring.join(',')
    && onlineDirectory.material.listeningAutumn.join(',') === expected.listeningAutumn.join(',')
    && onlineDirectory.reading.springCount === expected.springReadingCount
    && onlineDirectory.reading.autumnCount === expected.autumnReadingCount
    && onlineDirectory.reading.springPapers.join(',') === expected.springPapers.join(',')
    && onlineDirectory.reading.autumnPapers.join(',') === expected.autumnPapers.join(',');
  const report = {
    passed: rows.every((item) => item.tempReady && item.publicStatus === 200) && directoryPassed,
    checkedAt: new Date().toISOString(),
    rows,
    onlineDirectory,
    expected
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
