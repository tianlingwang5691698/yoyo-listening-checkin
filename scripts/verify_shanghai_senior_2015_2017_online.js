#!/usr/bin/env node

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'transcript-build', 'audio-performance', 'shanghai-senior-2015-2017-online.json');
const PAPERS = [
  { session: 'autumn', year: 2015, reading: 7, writing: 2, listening: 1 },
  { session: 'autumn', year: 2016, reading: 7, writing: 2, listening: 1 },
  { session: 'spring', year: 2017, reading: 7, writing: 3, listening: 1 },
  { session: 'autumn', year: 2017, reading: 7, writing: 3, listening: 1 }
];

function credentials() {
  const rows = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const [secretId, secretKey] = rows[1].split(',').map((value) => value.trim());
  return { secretId, secretKey };
}

function getPublic(cloudPath, parseJson = false) {
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  return new Promise((resolve) => {
    https.get(encodeURI(`${baseUrl}/${cloudPath}`), (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        let data = null;
        if (parseJson) {
          try {
            data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch (error) {
            data = null;
          }
        }
        resolve({ status: response.statusCode || 0, data });
      });
    }).on('error', () => resolve({ status: 0, data: null }));
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

  const materialCall = await invoke('getMaterialIndex', {});
  const readingCall = await invoke('getReadingHome', { directoryOnly: true, directoryVersion: 'senior-2026-v3' });
  const materialIds = (key) => (materialCall.data[key] || []).map((item) => item._id || item.materialItemId);
  const groups = ((((readingCall.data.categoryTree || [])[0] || {}).groups) || []);
  const groupFor = (session) => groups.find((item) => item.key === (session === 'spring' ? '春考' : '秋考')) || {};

  const reading = [];
  const writing = [];
  const listening = [];
  for (const paper of PAPERS) {
    const prefix = `sh-${paper.session}-${paper.year}`;
    const readingPath = `_content/reading-senior-${paper.session}/years/${paper.year}/v2/reading-passages.json`;
    const readingFile = await getPublic(readingPath, true);
    const readingRows = Array.isArray(readingFile.data) ? readingFile.data : [];
    reading.push({
      ...paper,
      path: readingPath,
      status: readingFile.status,
      count: readingRows.length,
      questionCount: readingRows.reduce((sum, item) => sum + (item.questions || []).length, 0),
      directoryVisible: (groupFor(paper.session).districts || []).some((item) => item.key === prefix)
    });

    const writingItems = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `writing-senior-${paper.session}`, 'writing-prompts.json'), 'utf8'))
      .filter((item) => Number(item.year) === paper.year);
    const writingKey = paper.session === 'spring' ? 'writingSeniorSpring' : 'writingSeniorAutumn';
    const writingDetails = [];
    for (const item of writingItems) {
      const detail = await invoke('getMaterialItem', { moduleId: 'writing', itemId: item._id });
      writingDetails.push({
        id: item._id,
        visible: materialIds(writingKey).includes(item._id),
        present: !!detail.data.item,
        questionCount: (detail.data.item && detail.data.item.questions || []).length,
        requirementCount: (detail.data.item && detail.data.item.requirements || []).length
      });
    }
    writing.push({ ...paper, items: writingDetails });

    const listeningItem = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `listening-senior-${paper.session}`, 'listening-practice.json'), 'utf8'))
      .find((item) => Number(item.year) === paper.year);
    const detail = await invoke('getMaterialItem', { moduleId: 'listening', itemId: listeningItem._id });
    const listeningKey = paper.session === 'spring' ? 'listeningSeniorSpring' : 'listeningSeniorAutumn';
    listening.push({
      ...paper,
      id: listeningItem._id,
      cloudPath: listeningItem.audioCloudPath,
      visible: materialIds(listeningKey).includes(listeningItem._id),
      present: !!detail.data.item,
      questionCount: (detail.data.item && detail.data.item.questions || []).length,
      durationSec: Number(detail.data.item && detail.data.item.durationSec || 0)
    });
  }

  const fileList = listening.map((item) => `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${item.cloudPath}`);
  const tempResult = await app.getTempFileURL({ fileList });
  for (let index = 0; index < listening.length; index += 1) {
    const publicResult = await getPublic(listening[index].cloudPath);
    listening[index].publicStatus = publicResult.status;
    listening[index].tempReady = !!((tempResult.fileList || [])[index] || {}).tempFileURL;
    listening[index].tempCode = ((tempResult.fileList || [])[index] || {}).code || '';
  }

  const assetPaths = [
    '_content/reading-senior-autumn/years/2015/assets/sh-autumn-2015-reading-1-234e0a58eb.png',
    '_content/writing-senior-autumn/years/2015/assets/sh-autumn-2015-writing-1-8afcd7b0f9.png'
  ];
  const assets = [];
  for (const cloudPath of assetPaths) assets.push({ cloudPath, status: (await getPublic(cloudPath)).status });

  const passed = reading.every((item) => item.status === 200 && item.count === item.reading && item.directoryVisible)
    && writing.every((paper) => paper.items.length === paper.writing && paper.items.every((item) => item.visible && item.present))
    && listening.every((item) => item.visible && item.present && item.questionCount === (item.year === 2015 || item.year === 2016 ? 24 : 20)
      && item.publicStatus === 200 && item.tempReady)
    && assets.every((item) => item.status === 200)
    && !(groupFor('spring').districts || []).some((item) => ['sh-spring-2015', 'sh-spring-2016'].includes(item.key));
  const report = {
    passed,
    checkedAt: new Date().toISOString(),
    calls: {
      material: { wallMs: materialCall.wallMs, functionMs: materialCall.functionMs },
      reading: { wallMs: readingCall.wallMs, functionMs: readingCall.functionMs }
    },
    reading,
    writing,
    listening,
    assets,
    missingSource: [
      { session: 'spring', year: 2015 },
      { session: 'spring', year: 2016 }
    ]
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
