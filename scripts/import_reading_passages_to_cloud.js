#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');

const cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const COLLECTION = 'readingPassages';
const SOURCE_PATHS = [
  '_content/reading-em1/reading-passages.json',
  '_content/reading/reading-passages.json'
];
const CONCURRENCY = 8;

function readCredential() {
  const credentialPath = path.join(ROOT, 'SecretKey.csv');
  if (!fs.existsSync(credentialPath)) return {};
  const lines = fs.readFileSync(credentialPath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return {};
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0] || '', secretKey: values[1] || '' };
}

function downloadJson(cloudPath) {
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  const url = encodeURI(`${baseUrl}/${String(cloudPath || '').replace(/^\/+/, '')}`);
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`reading-source-http-${response.statusCode}:${cloudPath}`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (error) {
          reject(new Error(`reading-source-json:${cloudPath}:${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function readPassages(apply) {
  const sources = await Promise.all(SOURCE_PATHS.map(async (cloudPath) => ({
    cloudPath,
    raw: await downloadJson(cloudPath)
  })));
  if (apply) {
    const backupDir = path.join(ROOT, 'data', 'cloud-backups', `reading-passages-${Date.now()}`);
    fs.mkdirSync(backupDir, { recursive: true });
    sources.forEach(({ cloudPath, raw }) => {
      const fileName = cloudPath.includes('reading-em1') ? 'reading-em1.json' : 'reading.json';
      fs.writeFileSync(path.join(backupDir, fileName), `${JSON.stringify(raw, null, 2)}\n`);
    });
  }
  const items = sources.flatMap(({ raw }) => {
    return Array.isArray(raw) ? raw : (raw.passages || raw.items || []);
  });
  const ids = new Set();
  return items.map((item) => {
    const id = String(item && item._id || '').trim();
    if (!id || ids.has(id)) throw new Error(`invalid-or-duplicate-reading-id:${id || 'empty'}`);
    if (!String(item.passage || '').trim() || !Array.isArray(item.questions) || !item.questions.length) {
      throw new Error(`invalid-reading-content:${id}`);
    }
    ids.add(id);
    return Object.assign({}, item, {
      _id: id,
      questionCount: item.questions.length
    });
  });
}

async function listExistingIds(db) {
  const ids = new Set();
  let offset = 0;
  while (true) {
    const result = await db.collection(COLLECTION).field({ _id: true }).skip(offset).limit(1000).get();
    const rows = (result && result.data) || [];
    rows.forEach((row) => ids.add(String(row._id || '')));
    if (rows.length < 1000) break;
    offset += rows.length;
  }
  return ids;
}

async function addIncrementally(db, docs) {
  let cursor = 0;
  let inserted = 0;
  async function worker() {
    while (cursor < docs.length) {
      const index = cursor;
      cursor += 1;
      await db.collection(COLLECTION).add(docs[index]);
      inserted += 1;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, docs.length) }, () => worker()));
  return inserted;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const credential = readCredential();
  if (!credential.secretId || !credential.secretKey) {
    throw new Error('SecretKey.csv is missing valid SDK credentials');
  }
  const app = cloudbase.init({
    env: appConfig.cloudEnvId,
    secretId: credential.secretId,
    secretKey: credential.secretKey
  });
  const db = app.database();
  await db.collection(COLLECTION).limit(1).get();
  const docs = await readPassages(apply);
  const beforeIds = await listExistingIds(db);
  const additions = docs.filter((doc) => !beforeIds.has(doc._id));
  const inserted = apply ? await addIncrementally(db, additions) : 0;
  const afterIds = apply ? await listExistingIds(db) : beforeIds;
  const missingAfter = apply ? docs.filter((doc) => !afterIds.has(doc._id)).map((doc) => doc._id) : [];
  if (apply && (inserted !== additions.length || missingAfter.length || beforeIds.size > afterIds.size)) {
    throw new Error(`reading-import-verification-failed:inserted=${inserted},expected=${additions.length},missing=${missingAfter.length}`);
  }
  console.log(JSON.stringify({
    envId: appConfig.cloudEnvId,
    collection: COLLECTION,
    mode: apply ? 'apply' : 'dry-run',
    sourceCount: docs.length,
    beforeCount: beforeIds.size,
    additions: additions.length,
    skippedExisting: docs.length - additions.length,
    inserted,
    afterCount: afterIds.size,
    missingAfter: missingAfter.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
