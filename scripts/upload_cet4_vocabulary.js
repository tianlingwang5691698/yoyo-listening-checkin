#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const appConfig = require('../app-config');
let cloudbase;
try { cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk'); } catch (_) { cloudbase = require('@cloudbase/node-sdk'); }

const ROOT = path.join(__dirname, '..');
const DATA_ROOT = path.join(ROOT, 'data', 'dictionary-import', 'cet4-v1');
const FINAL_ROOT = path.join(DATA_ROOT, 'cet4');
const REPORT_PATH = path.join(DATA_ROOT, 'upload-report.json');
const REMOTE_BASE = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');

function credential() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function request(cloudPath, query = '') {
  return new Promise((resolve, reject) => {
    https.get(`${REMOTE_BASE}/${encodeURI(cloudPath)}${query}`, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode || 0, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

async function verify(cloudPath, localBody, hash) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const remote = await request(cloudPath, `?sha256=${hash}&attempt=${attempt}`);
    if (remote.status === 200) {
      try {
        const rows = JSON.parse(remote.body.toString('utf8'));
        if (Array.isArray(rows) && sha256(remote.body) === hash && remote.body.equals(localBody)) return { verified: true, count: rows.length };
      } catch (_) {}
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  return { verified: false, count: 0 };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const cleanReport = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, 'clean-report.json'), 'utf8'));
  if (cleanReport.rejectedCount || cleanReport.duplicateCount || cleanReport.missingFieldCount) throw new Error('clean-report-not-publishable');
  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credential() });
  const results = [];
  let conflicts = 0;
  for (let list = 1; list <= 35; list += 1) {
    const localPath = path.join(FINAL_ROOT, `list-${list}.json`);
    const localBody = fs.readFileSync(localPath);
    const localRows = JSON.parse(localBody.toString('utf8'));
    const hash = sha256(localBody);
    const cloudPath = `dictionary_books/cet4-v1/cet4/list-${list}.json`;
    const remote = await request(cloudPath);
    if (remote.status === 200) {
      if (!remote.body.equals(localBody)) {
        results.push({ list, cloudPath, status: 'conflict', oldCount: JSON.parse(remote.body.toString('utf8')).length, newCount: localRows.length, bytes: localBody.length, sha256: hash });
        conflicts += 1;
      } else {
        results.push({ list, cloudPath, status: 'reuse', oldCount: localRows.length, newCount: localRows.length, bytes: localBody.length, sha256: hash, verified: true });
      }
      continue;
    }
    if (remote.status !== 404) throw new Error(`remote-check-failed:${cloudPath}:${remote.status}`);
    const entry = { list, cloudPath, status: apply ? 'pending-upload' : 'add', oldCount: 0, newCount: localRows.length, bytes: localBody.length, sha256: hash, verified: false };
    results.push(entry);
  }
  if (conflicts) throw new Error(`upload-conflicts:${conflicts}`);
  if (apply) {
    for (const entry of results.filter((item) => item.status === 'pending-upload')) {
      const localPath = path.join(FINAL_ROOT, `list-${entry.list}.json`);
      const localBody = fs.readFileSync(localPath);
      await app.uploadFile({ cloudPath: entry.cloudPath, fileContent: fs.createReadStream(localPath) });
      const verification = await verify(entry.cloudPath, localBody, entry.sha256);
      if (!verification.verified) throw new Error(`upload-verify-failed:${entry.cloudPath}`);
      Object.assign(entry, { status: 'added', verified: true, verifiedCount: verification.count });
    }
  }
  const report = {
    envId: appConfig.cloudEnvId,
    apply,
    targetRelease: 'dictionary_books/cet4-v1/cet4',
    added: results.filter((item) => item.status === 'added').length,
    pendingAdd: results.filter((item) => item.status === 'add').length,
    reused: results.filter((item) => item.status === 'reuse').length,
    conflicts,
    verified: results.filter((item) => item.verified).length,
    results,
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
