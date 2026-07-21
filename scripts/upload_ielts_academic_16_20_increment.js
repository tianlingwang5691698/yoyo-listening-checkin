#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const DEFAULT_BOOKS = [16, 17, 18, 19, 20];
const selectedBooks = process.argv.filter((value) => /^\d+$/.test(value)).map(Number);
const BOOKS = selectedBooks.length ? selectedBooks : DEFAULT_BOOKS;
const REPORT_PATH = path.join(ROOT, 'data', 'ielts-academic', `upload-${Math.min(...BOOKS)}-${Math.max(...BOOKS)}-report.json`);

function sha1(body) {
  return crypto.createHash('sha1').update(body).digest('hex');
}

function credentials() {
  const rows = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const [secretId, secretKey] = rows[1].split(',').map((value) => value.trim());
  return { secretId, secretKey };
}

function request(cloudPath, method = 'GET') {
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  return new Promise((resolve, reject) => {
    const req = https.request(encodeURI(`${baseUrl}/${cloudPath}`), { method }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ statusCode: response.statusCode || 0, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(60000, () => req.destroy(new Error(`request-timeout:${cloudPath}`)));
    req.on('error', reject);
    req.end();
  });
}

function readJson(localPath) {
  return JSON.parse(fs.readFileSync(localPath, 'utf8'));
}

function addEntry(entries, localPath, cloudPath) {
  const body = fs.readFileSync(localPath);
  entries.push({ localPath, cloudPath, body, sha1: sha1(body) });
}

function addDirectory(entries, localDir, cloudDir, extension) {
  fs.readdirSync(localDir).filter((name) => name.endsWith(extension)).sort().forEach((name) => {
    addEntry(entries, path.join(localDir, name), `${cloudDir}/${name}`);
  });
}

function addReferencedAssets(entries, items, key) {
  const seen = new Set();
  items.flatMap((item) => Array.isArray(item[key]) ? item[key] : []).forEach((asset) => {
    const localPath = path.join(ROOT, String(asset.localPath || ''));
    const cloudPath = String(asset.cloudPath || '');
    if (!cloudPath || !fs.existsSync(localPath) || seen.has(cloudPath)) return;
    seen.add(cloudPath);
    addEntry(entries, localPath, cloudPath);
  });
}

function buildEntries() {
  const entries = [];
  BOOKS.forEach((book) => {
    const localRoot = path.join(ROOT, 'data', 'ielts-academic', `cambridge-${book}`);
    const cloudRoot = `_content/ielts-academic/cambridge-${book}`;
    const report = readJson(path.join(localRoot, 'clean-report.json'));
    if (report.uncertainCount || report.errors.length || report.listeningQuestions !== 160 || report.readingQuestions !== 160 || report.writingTasks !== 8 || report.speakingTests !== 4) {
      throw new Error(`book-not-clean:${book}`);
    }
    addEntry(entries, path.join(localRoot, 'listening', 'index.json'), `${cloudRoot}/listening/index.json`);
    addDirectory(entries, path.join(localRoot, 'listening', 'items-v2'), `${cloudRoot}/listening/items-v2`, '.json');
    addDirectory(entries, path.join(localRoot, 'listening', 'audio'), `${cloudRoot}/listening/audio`, '.mp3');
    const questionVisualsDir = path.join(localRoot, 'assets', 'question-visuals-v1');
    if (fs.existsSync(questionVisualsDir)) {
      addDirectory(entries, questionVisualsDir, `${cloudRoot}/assets/question-visuals-v1`, '.jpg');
    }
    addEntry(entries, path.join(localRoot, 'reading', 'v2', 'reading-passages.json'), `${cloudRoot}/reading/v2/reading-passages.json`);
    addEntry(entries, path.join(localRoot, 'writing', 'index.json'), `${cloudRoot}/writing/index.json`);
    addDirectory(entries, path.join(localRoot, 'writing', 'items-v3'), `${cloudRoot}/writing/items-v3`, '.json');
    const writingItems = fs.readdirSync(path.join(localRoot, 'writing', 'items-v3')).filter((name) => name.endsWith('.json')).map((name) => readJson(path.join(localRoot, 'writing', 'items-v3', name)));
    addReferencedAssets(entries, writingItems, 'images');
    addEntry(entries, path.join(localRoot, 'speaking', 'index.json'), `${cloudRoot}/speaking/index.json`);
    addDirectory(entries, path.join(localRoot, 'speaking', 'items-v1'), `${cloudRoot}/speaking/items-v1`, '.json');
    const speakingItems = fs.readdirSync(path.join(localRoot, 'speaking', 'items-v1')).filter((name) => name.endsWith('.json')).map((name) => readJson(path.join(localRoot, 'speaking', 'items-v1', name)));
    addReferencedAssets(entries, speakingItems, 'images');
  });
  if (new Set(entries.map((entry) => entry.cloudPath)).size !== entries.length) throw new Error('duplicate-cloud-path');
  return entries;
}

async function mapLimit(items, limit, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index]);
    }
  }));
}

function writeReport(report) {
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const entries = buildEntries();
  const backupRoot = path.join(ROOT, 'data', 'ielts-academic', 'online-backups', new Date().toISOString().replace(/[:.]/g, '-'));
  const report = { mode: apply ? 'apply' : 'dry-run', total: entries.length, added: [], reused: [], conflicts: [], publicFailures: [], tempAudioFailures: [], backups: [] };
  await mapLimit(entries, 8, async (entry) => {
    const existing = await request(entry.cloudPath);
    if (existing.statusCode === 404) {
      report.added.push(entry.cloudPath);
      return;
    }
    if (existing.statusCode !== 200) {
      report.conflicts.push({ cloudPath: entry.cloudPath, reason: `http-${existing.statusCode}` });
      return;
    }
    if (entry.cloudPath.endsWith('.json')) {
      const backupPath = path.join(backupRoot, entry.cloudPath);
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.writeFileSync(backupPath, existing.body);
      report.backups.push(path.relative(ROOT, backupPath));
    }
    if (sha1(existing.body) === entry.sha1) report.reused.push(entry.cloudPath);
    else report.conflicts.push({ cloudPath: entry.cloudPath, reason: 'same-path-different-content' });
  });
  if (report.conflicts.length) {
    writeReport(report);
    throw new Error(`upload-conflicts:${report.conflicts.length}`);
  }
  if (apply) {
    const keys = credentials();
    const app = cloudbase.init({ env: appConfig.cloudEnvId, ...keys });
    const additions = new Set(report.added);
    await mapLimit(entries.filter((entry) => additions.has(entry.cloudPath)), 6, async (entry) => {
      await app.uploadFile({ cloudPath: entry.cloudPath, fileContent: entry.body });
    });
    await mapLimit(entries, 8, async (entry) => {
      const result = await request(entry.cloudPath, entry.cloudPath.endsWith('.json') ? 'GET' : 'HEAD');
      if (result.statusCode !== 200 || (entry.cloudPath.endsWith('.json') && sha1(result.body) !== entry.sha1)) {
        report.publicFailures.push(entry.cloudPath);
      }
    });
    const audioPaths = entries.filter((entry) => entry.cloudPath.endsWith('.mp3')).map((entry) => entry.cloudPath);
    await mapLimit(audioPaths, 20, async (cloudPath) => {
      const fileId = `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${cloudPath}`;
      const result = await app.getTempFileURL({ fileList: [fileId] });
      const item = (result.fileList || [])[0] || {};
      if (!(item.tempFileURL || item.download_url)) report.tempAudioFailures.push(cloudPath);
    });
  }
  writeReport(report);
  console.log(JSON.stringify({ mode: report.mode, total: report.total, added: report.added.length, reused: report.reused.length, conflicts: report.conflicts.length, publicFailures: report.publicFailures.length, tempAudioFailures: report.tempAudioFailures.length, report: REPORT_PATH }, null, 2));
  if (report.publicFailures.length || report.tempAudioFailures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
