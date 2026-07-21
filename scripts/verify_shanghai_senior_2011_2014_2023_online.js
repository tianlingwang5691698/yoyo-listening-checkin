#!/usr/bin/env node

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'transcript-build', 'audio-performance', 'shanghai-senior-2011-2014-2023-online.json');
const PAPERS = [
  { session: 'autumn', year: 2011, reading: 7, writing: 1, listening: 24, readingRevision: 1 },
  { session: 'autumn', year: 2012, reading: 7, writing: 2, listening: 24, readingRevision: 1 },
  { session: 'autumn', year: 2013, reading: 0, writing: 2, listening: 24, readingRevision: 0 },
  { session: 'autumn', year: 2014, reading: 7, writing: 2, listening: 24, readingRevision: 2 },
  { session: 'spring', year: 2023, reading: 6, writing: 3, listening: 20, readingRevision: 2 },
  { session: 'autumn', year: 2023, reading: 7, writing: 3, listening: 20, readingRevision: 2 }
];

function credentials() {
  const rows = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const [secretId, secretKey] = rows[1].split(',').map((value) => value.trim());
  return { secretId, secretKey };
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
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
          try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (error) { data = null; }
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

  const materialCall = await invoke('getMaterialIndex', { catalogVersion: 'senior-2026-v4' });
  const readingCall = await invoke('getReadingHome', { directoryOnly: true, directoryVersion: 'senior-2026-v4' });
  const grammarCall = await invoke('getGrammarHome', { examId: 'autumn' });
  const materialIds = (key) => (materialCall.data[key] || []).map((item) => item._id || item.id);
  const groups = ((((readingCall.data.categoryTree || [])[0] || {}).groups) || []);
  const groupFor = (session) => groups.find((item) => item.key === (session === 'spring' ? '春考' : '秋考')) || {};

  const rows = [];
  for (const paper of PAPERS) {
    const writing = readJson(`data/writing-senior-${paper.session}/writing-prompts.json`).filter((item) => Number(item.year) === paper.year);
    const listening = readJson(`data/listening-senior-${paper.session}/listening-practice.json`).find((item) => Number(item.year) === paper.year);
    const writingKey = paper.session === 'spring' ? 'writingSeniorSpring' : 'writingSeniorAutumn';
    const listeningKey = paper.session === 'spring' ? 'listeningSeniorSpring' : 'listeningSeniorAutumn';
    const writingDetails = [];
    for (const item of writing) {
      const detail = await invoke('getMaterialItem', { moduleId: 'writing', itemId: item._id });
      writingDetails.push({ id: item._id, visible: materialIds(writingKey).includes(item._id), present: !!detail.data.item });
    }
    const listeningDetail = await invoke('getMaterialItem', { moduleId: 'listening', itemId: listening._id });
    const publicAudio = await getPublic(listening.audioCloudPath);
    const fileId = `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${listening.audioCloudPath}`;
    const tempResult = await app.getTempFileURL({ fileList: [fileId] });
    let reading = { status: 0, count: 0, visible: false };
    if (paper.readingRevision) {
      const revisionPath = paper.readingRevision > 1 ? `/v${paper.readingRevision}` : '';
      const cloudPath = `_content/reading-senior-${paper.session}/years/${paper.year}${revisionPath}/reading-passages.json`;
      const publicReading = await getPublic(cloudPath, true);
      reading = {
        cloudPath,
        status: publicReading.status,
        count: Array.isArray(publicReading.data) ? publicReading.data.length : 0,
        visible: (groupFor(paper.session).districts || []).some((item) => item.key === `sh-${paper.session}-${paper.year}`)
      };
    }
    rows.push({
      ...paper,
      readingOnline: reading,
      writingOnline: writingDetails,
      listeningOnline: {
        id: listening._id,
        visible: materialIds(listeningKey).includes(listening._id),
        present: !!listeningDetail.data.item,
        questionCount: (listeningDetail.data.item && listeningDetail.data.item.questions || []).length,
        durationSec: Number(listeningDetail.data.item && listeningDetail.data.item.durationSec || 0),
        publicStatus: publicAudio.status,
        tempReady: !!(((tempResult.fileList || [])[0] || {}).tempFileURL)
      }
    });
  }

  const grammarCount = (grammarCall.data.topicTypes || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
  const complete = rows.every((paper) => (
    (paper.readingRevision === 0 || (paper.readingOnline.status === 200 && paper.readingOnline.count === paper.reading && paper.readingOnline.visible))
    && paper.writingOnline.length === paper.writing && paper.writingOnline.every((item) => item.visible && item.present)
    && paper.listeningOnline.visible
    && paper.listeningOnline.present
    && paper.listeningOnline.questionCount === paper.listening
    && paper.listeningOnline.durationSec > 900
    && paper.listeningOnline.publicStatus === 200
    && paper.listeningOnline.tempReady
  )) && grammarCount === 64;
  const report = {
    passed: complete,
    checkedAt: new Date().toISOString(),
    calls: {
      material: { wallMs: materialCall.wallMs, functionMs: materialCall.functionMs },
      reading: { wallMs: readingCall.wallMs, functionMs: readingCall.functionMs },
      grammar: { wallMs: grammarCall.wallMs, functionMs: grammarCall.functionMs }
    },
    grammarCount,
    rows
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
