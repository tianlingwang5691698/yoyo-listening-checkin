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
const REPORT_PATH = path.join(LOCAL_ROOT, 'upload-v2-report.json');

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
  return new Promise((resolve, reject) => {
    const req = https.request(encodeURI(`${baseUrl}/${cloudPath}`), { method }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ statusCode: response.statusCode || 0, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(30000, () => req.destroy(new Error(`request-timeout:${cloudPath}`)));
    req.on('error', reject);
    req.end();
  });
}

function addDirectory(entries, localDir, cloudDir) {
  fs.readdirSync(localDir).filter((name) => name.endsWith('.json')).sort().forEach((name) => {
    const body = fs.readFileSync(path.join(localDir, name));
    entries.push({ cloudPath: `${cloudDir}/${name}`, body, sha1: sha1(body) });
  });
}

function addAssetDirectory(entries, localDir, cloudDir) {
  fs.readdirSync(localDir).filter((name) => name.endsWith('.jpg')).sort().forEach((name) => {
    const body = fs.readFileSync(path.join(localDir, name));
    entries.push({ cloudPath: `${cloudDir}/${name}`, body, sha1: sha1(body) });
  });
}

function buildEntries() {
  const entries = [];
  addDirectory(entries, path.join(LOCAL_ROOT, 'listening', 'items-v2'), `${CLOUD_ROOT}/listening/items-v2`);
  addDirectory(entries, path.join(LOCAL_ROOT, 'writing', 'items-v2'), `${CLOUD_ROOT}/writing/items-v2`);
  addAssetDirectory(entries, path.join(LOCAL_ROOT, 'writing', 'visuals-v2'), `${CLOUD_ROOT}/writing/visuals-v2`);
  const readingBody = fs.readFileSync(path.join(LOCAL_ROOT, 'reading', 'v2', 'reading-passages.json'));
  entries.push({
    cloudPath: `${CLOUD_ROOT}/reading/v2/reading-passages.json`,
    body: readingBody,
    sha1: sha1(readingBody)
  });
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

async function main() {
  const apply = process.argv.includes('--apply');
  const entries = buildEntries();
  const report = { mode: apply ? 'apply' : 'dry-run', total: entries.length, added: [], reused: [], conflicts: [], missingAfterUpload: [] };
  await mapLimit(entries, 8, async (entry) => {
    const existing = await request(entry.cloudPath, 'GET');
    if (existing.statusCode === 404) return report.added.push(entry.cloudPath);
    if (existing.statusCode === 200 && sha1(existing.body) === entry.sha1) return report.reused.push(entry.cloudPath);
    report.conflicts.push({ cloudPath: entry.cloudPath, reason: existing.statusCode === 200 ? 'same-path-different-content' : `http-${existing.statusCode}` });
  });
  if (report.conflicts.length) throw new Error(`upload-conflicts:${report.conflicts.length}`);
  if (apply) {
    const app = cloudbase.init(Object.assign({ env: appConfig.cloudEnvId }, credentials()));
    const additions = new Set(report.added);
    await mapLimit(entries.filter((entry) => additions.has(entry.cloudPath)), 6, async (entry) => {
      await app.uploadFile({ cloudPath: entry.cloudPath, fileContent: entry.body });
    });
    await mapLimit(entries, 8, async (entry) => {
      const check = await request(entry.cloudPath, 'GET');
      if (check.statusCode !== 200 || sha1(check.body) !== entry.sha1) {
        report.missingAfterUpload.push(entry.cloudPath);
      }
    });
  }
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ mode: report.mode, total: report.total, added: report.added.length, reused: report.reused.length, conflicts: report.conflicts.length, missingAfterUpload: report.missingAfterUpload.length }, null, 2));
  if (report.missingAfterUpload.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
