#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'cloudfunctions', 'yoyo', 'data', 'material-directory.json');
const SOURCES = [
  { key: 'writingEm1', cloudPath: '_content/writing-em1/writing-prompts.json', itemDir: '_content/writing-em1/items-v1' },
  { key: 'writingEm2', cloudPath: '_content/writing-em2/writing-prompts.json', itemDir: '_content/writing-em2/items-v1' },
  { key: 'writingSeniorSpring', cloudPath: '_content/writing-senior-spring/writing-prompts.json', itemDir: '_content/writing-senior-spring/items-v1', localPath: 'data/writing-senior-spring/writing-prompts.json' },
  { key: 'writingSeniorAutumn', cloudPath: '_content/writing-senior-autumn/writing-prompts.json', itemDir: '_content/writing-senior-autumn/items-v1', localPath: 'data/writing-senior-autumn/writing-prompts.json' },
  { key: 'listeningEm1', cloudPath: '_content/listening-em1/listening-practice.json', itemDir: '_content/listening-em1/items-v1' },
  { key: 'listeningEm2', cloudPath: '_content/listening-em2/listening-practice.json', itemDir: '_content/listening-em2/items-v1' },
  { key: 'listeningSeniorSpring', cloudPath: '_content/listening-senior-spring/listening-practice.json', itemDir: '_content/listening-senior-spring/items-v1', localPath: 'data/listening-senior-spring/listening-practice.json' },
  { key: 'listeningSeniorAutumn', cloudPath: '_content/listening-senior-autumn/listening-practice.json', itemDir: '_content/listening-senior-autumn/items-v1', localPath: 'data/listening-senior-autumn/listening-practice.json' }
];
const EXPECTED_COUNTS = { writingEm1: 159, writingEm2: 181, writingSeniorSpring: 0, writingSeniorAutumn: 2, listeningEm1: 67, listeningEm2: 76, listeningSeniorSpring: 0, listeningSeniorAutumn: 1 };

function request(cloudPath, method = 'GET') {
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  const url = encodeURI(`${baseUrl}/${cloudPath}`);
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method }, (response) => {
      if (method === 'HEAD') {
        response.resume();
        resolve({ statusCode: response.statusCode, body: '' });
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function downloadJson(cloudPath) {
  const response = await request(cloudPath);
  if (response.statusCode !== 200) throw new Error(`material-source-http-${response.statusCode}:${cloudPath}`);
  return JSON.parse(response.body);
}

function itemId(item) {
  return String(item && (item._id || item.id) || '').trim();
}

function itemFileName(id) {
  return `${crypto.createHash('sha1').update(id).digest('hex')}.json`;
}

function slimWritingItem(item) {
  return {
    _id: item._id, id: item.id, title: item.title, year: item.year, city: item.city,
    district: item.district, examType: item.examType, stage: item.stage,
    category: item.category, contentType: item.contentType,
    contentRevision: item.contentRevision, paperId: item.paperId,
    paperOrder: item.paperOrder, questionCount: item.questionCount,
    minWords: item.minWords, score: item.score
  };
}

function slimListeningItem(item) {
  return {
    _id: item._id, id: item.id, title: item.title, year: item.year,
    sourceYear: item.sourceYear, district: item.district, examType: item.examType,
    stage: item.stage, audioUrl: item.audioUrl, audioCloudPath: item.audioCloudPath,
    audioFileId: item.audioFileId, audioSource: item.audioSource,
    durationSec: Number(item.durationSec || 0),
    hasAudio: !!item.hasAudio, hasTranscript: !!item.hasTranscript
  };
}

function readSecrets() {
  const rows = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const values = rows[1].split(',').map((value) => value.trim());
  return { secretId: values[0], secretKey: values[1] };
}

async function mapLimit(items, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const downloaded = await Promise.all(SOURCES.map(async (source) => {
    const raw = source.localPath
      ? JSON.parse(fs.readFileSync(path.join(ROOT, source.localPath), 'utf8'))
      : await downloadJson(source.cloudPath);
    const items = Array.isArray(raw) ? raw : (raw.items || raw.prompts || raw.sets || []);
    if (items.length !== EXPECTED_COUNTS[source.key]) {
      throw new Error(`material-count-mismatch:${source.key}:${items.length}`);
    }
    if (new Set(items.map(itemId)).size !== items.length || items.some((item) => !itemId(item))) {
      throw new Error(`material-id-invalid:${source.key}`);
    }
    return { source, items };
  }));

  const directory = {};
  downloaded.forEach(({ source, items }) => {
    const slim = source.key.startsWith('writing') ? slimWritingItem : slimListeningItem;
    directory[source.key] = items.map(slim);
  });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(directory)}\n`);

  const uploads = downloaded.flatMap(({ source, items }) => items.map((item) => ({
    cloudPath: `${source.itemDir}/${itemFileName(itemId(item))}`,
    body: Buffer.from(JSON.stringify(item))
  })));
  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', count: uploads.length, manifest: OUTPUT_PATH }));
    return;
  }

  const app = cloudbase.init(Object.assign({ env: appConfig.cloudEnvId }, readSecrets()));
  let added = 0;
  let skipped = 0;
  await mapLimit(uploads, 8, async (entry) => {
    const existing = await request(entry.cloudPath, 'HEAD');
    if (existing.statusCode >= 200 && existing.statusCode < 400) {
      skipped += 1;
      return;
    }
    await app.uploadFile({ cloudPath: entry.cloudPath, fileContent: entry.body });
    added += 1;
  });
  console.log(JSON.stringify({ mode: 'apply', total: uploads.length, added, skipped }));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
