#!/usr/bin/env node

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'transcript-build', 'audio-performance', 'shanghai-senior-2018-2020-online.json');
const YEARS = [2018, 2019, 2020];

function credentials() {
  const rows = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const [secretId, secretKey] = rows[1].split(',').map((value) => value.trim());
  return { secretId, secretKey };
}

function publicStatus(cloudPath) {
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  return new Promise((resolve) => {
    const request = https.get(encodeURI(`${baseUrl}/${cloudPath}`), (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode || 0));
    });
    request.setTimeout(10000, () => request.destroy());
    request.on('error', () => resolve(0));
    request.end();
  });
}

async function main() {
  const keys = credentials();
  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...keys });
  const manager = CloudBaseManager.init({ envId: appConfig.cloudEnvId, ...keys });
  const invoke = async (action, payload) => {
    const startedAt = Date.now();
    const response = await manager.functions.invokeFunction('yoyo', { action, payload });
    if (response.ErrMsg) throw new Error(`${action}:${response.ErrMsg}`);
    return { data: JSON.parse(response.RetMsg || '{}'), wallMs: Date.now() - startedAt, functionMs: Number(response.Duration || 0) };
  };

  const targets = ['spring', 'autumn'].flatMap((session) => {
    const items = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `listening-senior-${session}`, 'listening-practice.json'), 'utf8'));
    return YEARS.map((year) => {
      const item = items.find((row) => Number(row.year) === year);
      if (!item || !item.audioCloudPath) throw new Error(`listening-audio-missing:${session}:${year}`);
      return { session, year, itemId: item._id, cloudPath: item.audioCloudPath };
    });
  });
  const fileList = targets.map((item) => `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${item.cloudPath}`);
  const tempResult = await app.getTempFileURL({ fileList });
  const audio = await Promise.all(targets.map(async (target, index) => ({
    ...target,
    tempReady: !!((tempResult.fileList || [])[index] || {}).tempFileURL,
    tempCode: ((tempResult.fileList || [])[index] || {}).code || '',
    publicStatus: await publicStatus(target.cloudPath)
  })));

  const materialCall = await invoke('getMaterialIndex', {});
  const readingCall = await invoke('getReadingHome', { directoryOnly: true, directoryVersion: 'senior-2026-v3' });
  const materialIds = (key) => (materialCall.data[key] || []).map((item) => item._id || item.materialItemId);
  const groups = ((((readingCall.data.categoryTree || [])[0] || {}).groups) || []);
  const expectedPaperIds = (session) => YEARS.map((year) => `sh-${session}-${year}`);
  const expectedWritingIds = (session) => YEARS.flatMap((year) => ['summary-writing', 'translation', 'writing'].map((suffix) => `sh-${session}-${year}-${suffix}`));
  const expectedListeningIds = (session) => YEARS.map((year) => `sh-${session}-${year}-listening`);
  const directory = {};
  for (const session of ['spring', 'autumn']) {
    const group = groups.find((item) => item.key === (session === 'spring' ? '春考' : '秋考')) || {};
    directory[session] = {
      readingCount: Number(group.count || 0),
      readingPapers: (group.districts || []).map((item) => item.key).filter((key) => expectedPaperIds(session).includes(key)),
      writingIds: materialIds(session === 'spring' ? 'writingSeniorSpring' : 'writingSeniorAutumn').filter((id) => expectedWritingIds(session).includes(id)),
      listeningIds: materialIds(session === 'spring' ? 'listeningSeniorSpring' : 'listeningSeniorAutumn').filter((id) => expectedListeningIds(session).includes(id))
    };
  }
  const passed = audio.every((item) => item.tempReady && item.publicStatus === 200)
    && directory.spring.readingCount === 63
    && directory.autumn.readingCount === 77
    && ['spring', 'autumn'].every((session) => directory[session].readingPapers.length === 3
      && directory[session].writingIds.length === 9
      && directory[session].listeningIds.length === 3);
  const report = {
    passed,
    checkedAt: new Date().toISOString(),
    audio,
    calls: {
      material: { wallMs: materialCall.wallMs, functionMs: materialCall.functionMs },
      reading: { wallMs: readingCall.wallMs, functionMs: readingCall.functionMs }
    },
    directory
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
