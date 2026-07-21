#!/usr/bin/env node

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const BOOKS = [21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10];
const REPORT_PATH = path.join(ROOT, 'data', 'ielts-academic', 'online-verification-10-21.json');

function credentials() {
  const rows = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const [secretId, secretKey] = rows[1].split(',').map((value) => value.trim());
  return { secretId, secretKey };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function itemId(item) {
  return String(item && (item._id || item.id) || '');
}

function publicRequest(cloudPath, method = 'HEAD') {
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  const target = new URL(encodeURI(`${baseUrl}/${cloudPath}`));
  return new Promise((resolve) => {
    const request = https.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || undefined,
      path: `${target.pathname}${target.search}`,
      method
    }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode || 0));
    });
    request.setTimeout(60000, () => request.destroy());
    request.on('error', () => resolve(0));
    request.end();
  });
}

function publicJson(cloudPath) {
  const startedAt = Date.now();
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  return new Promise((resolve, reject) => {
    https.get(encodeURI(`${baseUrl}/${cloudPath}`), (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if (response.statusCode !== 200) return reject(new Error(`public-json-${response.statusCode}:${cloudPath}`));
        resolve({ data: JSON.parse(Buffer.concat(chunks).toString('utf8')), wallMs: Date.now() - startedAt });
      });
    }).on('error', reject);
  });
}

function oldBook21Ids() {
  const root = path.join(ROOT, 'data', 'ielts-academic', 'cambridge-21');
  return {
    writing: JSON.parse(fs.readFileSync(path.join(root, 'writing', 'index.json'), 'utf8')).map(itemId),
    listening: JSON.parse(fs.readFileSync(path.join(root, 'listening', 'index.json'), 'utf8')).map(itemId),
    speaking: JSON.parse(fs.readFileSync(path.join(root, 'speaking', 'index.json'), 'utf8')).map(itemId)
  };
}

function groupBookNumber(group) {
  if (group.key === 'IELTS Academic') return 21;
  const match = String(group.key || '').match(/(\d+)$/);
  return Number(match && match[1] || 0);
}

async function main() {
  const keys = credentials();
  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...keys });
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

  const materialCold = await invoke('getMaterialIndex', { catalogVersion: 'ielts-academic-10-21-v1' });
  const readingCold = await invoke('getReadingHome', { directoryOnly: true, directoryVersion: 'ielts-academic-10-21-v1' });
  if (process.argv.includes('--backup-only')) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(ROOT, 'data', 'ielts-academic', 'online-backups', `catalog-before-10-15-${stamp}.json`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify({ checkedAt: new Date().toISOString(), material: materialCold, reading: readingCold }, null, 2)}\n`);
    console.log(JSON.stringify({ backup: target }, null, 2));
    return;
  }

  const materialWarm = await invoke('getMaterialIndex', { catalogVersion: 'ielts-academic-10-21-v1' });
  const readingWarm = await invoke('getReadingHome', { directoryOnly: true, directoryVersion: 'ielts-academic-10-21-v1' });
  const material = materialWarm.data;
  assert((material.writingIelts || []).length === 96, 'writing-count');
  assert((material.listeningIelts || []).length === 48, 'listening-count');
  assert((material.speakingIelts || []).length === 48, 'speaking-count');

  const oldIds = oldBook21Ids();
  assert(oldIds.writing.every((id) => (material.writingIelts || []).some((item) => itemId(item) === id)), 'old-writing-ids');
  assert(oldIds.listening.every((id) => (material.listeningIelts || []).some((item) => itemId(item) === id)), 'old-listening-ids');
  assert(oldIds.speaking.every((id) => (material.speakingIelts || []).some((item) => itemId(item) === id)), 'old-speaking-ids');

  const groups = (((readingWarm.data.categoryTree || [])[0] || {}).groups || [])
    .filter((group) => group.key === 'IELTS Academic' || /^Cambridge IELTS \d+$/.test(String(group.key || '')))
    .sort((left, right) => groupBookNumber(right) - groupBookNumber(left));
  assert(groups.map(groupBookNumber).join(',') === BOOKS.join(','), 'reading-book-order');
  groups.forEach((group) => {
    assert(group.count === 12, `reading-count-${groupBookNumber(group)}`);
    assert((group.districts || []).length === 4, `reading-tests-${groupBookNumber(group)}`);
    assert((group.districts || []).every((district) => district.count === 3), `reading-passages-${groupBookNumber(group)}`);
  });

  const samples = [];
  for (const book of BOOKS) {
    const byBook = (items) => items.filter((item) => Number(item.bookNumber || 21) === book);
    const writingSummary = byBook(material.writingIelts || []).find((item) => Number(item.paperOrder) === 1);
    const listeningSummary = byBook(material.listeningIelts || [])[0];
    const speakingSummary = byBook(material.speakingIelts || [])[0];
    assert(writingSummary && listeningSummary && speakingSummary, `material-summary-${book}`);

    const [writingCall, listeningCall, speakingCall] = await Promise.all([
      invoke('getMaterialItem', { moduleId: 'writing', itemId: itemId(writingSummary) }),
      invoke('getMaterialItem', { moduleId: 'listening', itemId: itemId(listeningSummary) }),
      invoke('getMaterialItem', { moduleId: 'speaking', itemId: itemId(speakingSummary) })
    ]);
    const writing = writingCall.data.item;
    const listening = listeningCall.data.item;
    const speaking = speakingCall.data.item;
    assert(writing && (writing.images || []).length === 1, `writing-detail-${book}`);
    assert(listening && (listening.questions || []).length === 40 && String(listening.transcript || '').length >= 8000, `listening-detail-${book}`);
    assert(speaking && [1, 2, 3].every((part) => (speaking.exercises || []).some((item) => item.part === part)), `speaking-detail-${book}`);

    const audioStatus = await publicRequest(listening.audioCloudPath);
    const imageStatus = await publicRequest(writing.images[0].cloudPath);
    const fileId = `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${listening.audioCloudPath}`;
    const tempResult = await app.getTempFileURL({ fileList: [fileId] });
    const tempReady = !!((((tempResult || {}).fileList || [])[0] || {}).tempFileURL || (((tempResult || {}).fileList || [])[0] || {}).download_url);
    assert([200, 206].includes(audioStatus) && imageStatus === 200 && tempReady, `assets-${book}`);

    const group = groups.find((item) => groupBookNumber(item) === book);
    const passageSummary = (((group.districts || [])[0] || {}).passages || [])[0];
    const readingCall = await publicJson(`_content/ielts-academic/cambridge-${book}/reading/${book === 21 ? '' : 'v2/'}reading-passages.json`);
    const readingRows = Array.isArray(readingCall.data) ? readingCall.data : (readingCall.data.passages || readingCall.data.items || []);
    const passage = readingRows.find((item) => itemId(item) === itemId(passageSummary));
    assert(passage && (String(passage.passage || '').length >= 1000 || (passage.images || []).length) && (passage.questions || []).length >= 13, `reading-detail-${book}`);
    samples.push({
      book,
      writingId: itemId(writing),
      listeningId: itemId(listening),
      speakingId: itemId(speaking),
      readingId: itemId(passage),
      durationSec: Number(listening.durationSec || 0),
      audioStatus,
      imageStatus,
      tempReady,
      detailWallMs: Math.max(writingCall.wallMs, listeningCall.wallMs, speakingCall.wallMs, readingCall.wallMs)
    });
  }

  const report = {
    passed: true,
    checkedAt: new Date().toISOString(),
    counts: { writing: 96, listening: 48, speaking: 48, reading: 144 },
    timings: {
      materialCold: materialCold.wallMs,
      materialWarm: materialWarm.wallMs,
      readingCold: readingCold.wallMs,
      readingWarm: readingWarm.wallMs
    },
    samples
  };
  assert(Object.values(report.timings).every((value) => value < 10000), 'catalog-performance');
  assert(samples.every((item) => item.detailWallMs < 10000), 'detail-performance');
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify({ passed: false, checkedAt: new Date().toISOString(), error: error.message }, null, 2)}\n`);
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
