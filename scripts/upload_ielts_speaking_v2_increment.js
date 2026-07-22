#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'ielts-academic', 'speaking-v2-upload-report.json');

function sha1(body) {
  return crypto.createHash('sha1').update(body).digest('hex');
}

function credentials() {
  const rows = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const [secretId, secretKey] = rows[1].split(',').map((value) => value.trim());
  return { secretId, secretKey };
}

function request(cloudPath) {
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  return new Promise((resolve, reject) => {
    const req = https.get(encodeURI(`${baseUrl}/${cloudPath}`), (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ statusCode: response.statusCode || 0, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(60000, () => req.destroy(new Error(`request-timeout:${cloudPath}`)));
    req.on('error', reject);
  });
}

function entries() {
  const rows = [];
  for (let book = 10; book <= 21; book += 1) {
    const directory = path.join(ROOT, 'data', 'ielts-academic', `cambridge-${book}`, 'speaking', 'items-v2');
    const names = fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort();
    if (names.length !== 4) throw new Error(`book-${book}-items-v2:${names.length}`);
    names.forEach((name) => {
      const localPath = path.join(directory, name);
      const body = fs.readFileSync(localPath);
      rows.push({
        localPath,
        cloudPath: `_content/ielts-academic/cambridge-${book}/speaking/items-v2/${name}`,
        body,
        sha1: sha1(body)
      });
    });
  }
  return rows;
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
  const files = entries();
  const report = { mode: apply ? 'apply' : 'dry-run', total: files.length, added: [], reused: [], conflicts: [], publicFailures: [] };
  await mapLimit(files, 8, async (entry) => {
    const existing = await request(entry.cloudPath);
    if (existing.statusCode === 404) return report.added.push(entry.cloudPath);
    if (existing.statusCode === 200 && sha1(existing.body) === entry.sha1) return report.reused.push(entry.cloudPath);
    report.conflicts.push({ cloudPath: entry.cloudPath, reason: existing.statusCode === 200 ? 'same-path-different-content' : `http-${existing.statusCode}` });
  });
  writeReport(report);
  if (report.conflicts.length) throw new Error(`upload-conflicts:${report.conflicts.length}`);
  if (apply) {
    const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials() });
    const additions = new Set(report.added);
    await mapLimit(files.filter((entry) => additions.has(entry.cloudPath)), 6, async (entry) => {
      await app.uploadFile({ cloudPath: entry.cloudPath, fileContent: entry.body });
    });
    await mapLimit(files, 8, async (entry) => {
      const existing = await request(entry.cloudPath);
      if (existing.statusCode !== 200 || sha1(existing.body) !== entry.sha1) report.publicFailures.push(entry.cloudPath);
    });
    writeReport(report);
  }
  console.log(JSON.stringify({ mode: report.mode, total: report.total, added: report.added.length, reused: report.reused.length, conflicts: report.conflicts.length, publicFailures: report.publicFailures.length, report: REPORT_PATH }, null, 2));
  if (report.publicFailures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
