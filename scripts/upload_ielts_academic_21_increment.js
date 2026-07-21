#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const LOCAL_ROOT = path.join(ROOT, 'data', 'ielts-academic', 'cambridge-21');
const CLOUD_ROOT = '_content/ielts-academic/cambridge-21';
const REPORT_PATH = path.join(LOCAL_ROOT, 'upload-report.json');

function sha1(body) {
  return crypto.createHash('sha1').update(body).digest('hex');
}

function credentials() {
  const rows = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const values = rows[1].split(',').map((value) => value.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function request(cloudPath, method = 'GET') {
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  const url = encodeURI(`${baseUrl}/${cloudPath}`);
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode || 0,
        body: Buffer.concat(chunks),
        headers: response.headers
      }));
    });
    req.setTimeout(30000, () => req.destroy(new Error(`request-timeout:${cloudPath}`)));
    req.on('error', reject);
    req.end();
  });
}

function addEntry(entries, localPath, cloudPath) {
  const body = fs.readFileSync(localPath);
  entries.push({ localPath, cloudPath, body, sha1: sha1(body) });
}

function addDirectory(entries, localDir, cloudDir, extension) {
  fs.readdirSync(localDir).filter((name) => !extension || name.endsWith(extension)).sort().forEach((name) => {
    addEntry(entries, path.join(localDir, name), `${cloudDir}/${name}`);
  });
}

function buildEntries() {
  const entries = [];
  addEntry(entries, path.join(LOCAL_ROOT, 'listening', 'index.json'), `${CLOUD_ROOT}/listening/index.json`);
  addDirectory(entries, path.join(LOCAL_ROOT, 'listening', 'items-v1'), `${CLOUD_ROOT}/listening/items-v1`, '.json');
  addDirectory(entries, path.join(LOCAL_ROOT, 'listening', 'audio'), `${CLOUD_ROOT}/listening/audio`, '.mp3');
  addEntry(entries, path.join(LOCAL_ROOT, 'reading', 'reading-passages.json'), `${CLOUD_ROOT}/reading/reading-passages.json`);
  addEntry(entries, path.join(LOCAL_ROOT, 'writing', 'index.json'), `${CLOUD_ROOT}/writing/index.json`);
  addDirectory(entries, path.join(LOCAL_ROOT, 'writing', 'items-v1'), `${CLOUD_ROOT}/writing/items-v1`, '.json');
  addEntry(entries, path.join(LOCAL_ROOT, 'speaking', 'index.json'), `${CLOUD_ROOT}/speaking/index.json`);
  addDirectory(entries, path.join(LOCAL_ROOT, 'speaking', 'items-v1'), `${CLOUD_ROOT}/speaking/items-v1`, '.json');
  addDirectory(entries, path.join(LOCAL_ROOT, 'assets', 'pages'), `${CLOUD_ROOT}/assets/pages`, '.jpg');
  if (new Set(entries.map((entry) => entry.cloudPath)).size !== entries.length) {
    throw new Error('duplicate-cloud-path');
  }
  return entries;
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
  const entries = buildEntries();
  const report = {
    mode: apply ? 'apply' : 'dry-run',
    total: entries.length,
    added: [],
    reused: [],
    conflicts: [],
    missingAfterUpload: []
  };
  await mapLimit(entries, 10, async (entry) => {
    const existing = await request(entry.cloudPath, 'HEAD');
    if (existing.statusCode === 404) {
      report.added.push(entry.cloudPath);
      return;
    }
    if (existing.statusCode < 200 || existing.statusCode >= 400) {
      report.conflicts.push({ cloudPath: entry.cloudPath, reason: `http-${existing.statusCode}` });
      return;
    }
    const downloaded = await request(entry.cloudPath, 'GET');
    if (downloaded.statusCode === 200 && sha1(downloaded.body) === entry.sha1) {
      report.reused.push(entry.cloudPath);
      return;
    }
    report.conflicts.push({ cloudPath: entry.cloudPath, reason: 'same-path-different-content' });
  });
  if (report.conflicts.length) {
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    throw new Error(`upload-conflicts:${report.conflicts.length}`);
  }
  if (apply) {
    const app = cloudbase.init(Object.assign({ env: appConfig.cloudEnvId }, credentials()));
    const additions = new Set(report.added);
    await mapLimit(entries.filter((entry) => additions.has(entry.cloudPath)), 6, async (entry) => {
      await app.uploadFile({ cloudPath: entry.cloudPath, fileContent: entry.body });
    });
    await mapLimit(entries, 10, async (entry) => {
      const check = await request(entry.cloudPath, entry.cloudPath.endsWith('.json') ? 'GET' : 'HEAD');
      if (check.statusCode !== 200) {
        report.missingAfterUpload.push({ cloudPath: entry.cloudPath, statusCode: check.statusCode });
        return;
      }
      if (entry.cloudPath.endsWith('.json') && sha1(check.body) !== entry.sha1) {
        report.missingAfterUpload.push({ cloudPath: entry.cloudPath, statusCode: 200, reason: 'json-sha1-mismatch' });
      }
    });
    if (report.missingAfterUpload.length) {
      fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
      throw new Error(`upload-verification-failed:${report.missingAfterUpload.length}`);
    }
  }
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    mode: report.mode,
    total: report.total,
    added: report.added.length,
    reused: report.reused.length,
    conflicts: report.conflicts.length,
    missingAfterUpload: report.missingAfterUpload.length,
    report: REPORT_PATH
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
