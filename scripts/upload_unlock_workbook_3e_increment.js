#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const appConfig = require('../app-config');

let cloudbase;
try {
  cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
} catch (error) {
  cloudbase = require('@cloudbase/node-sdk');
}

const ROOT = path.join(__dirname, '..');
const CREDENTIAL = path.join(ROOT, 'SecretKey.csv');
const LEVELS = [
  { level: 'A1', number: 1, oldPath: '_transcripts/A1/unlock1/workbook-bundle-wordaligned-v2.json', oldBackup: 'a1-old.json' },
  { level: 'A2', number: 2, oldPath: '_transcripts/A2/unlock2/workbook-bundle-wordaligned-v1.json', oldBackup: 'a2-old.json' },
  { level: 'B1', number: 3, oldPath: '_transcripts/B1/unlock3/bundle.json', oldBackup: 'b1-old.json' },
  { level: 'B2', number: 4, oldPath: '_transcripts/B2/unlock4/workbook-bundle-wordaligned-v1.json', oldBackup: 'b2-old.json' }
];

function sha1(value) { return crypto.createHash('sha1').update(value).digest('hex'); }
function url(cloudPath) { return `${appConfig.cloudAssetBaseUrl.replace(/\/+$/, '')}/${encodeURI(cloudPath)}?unlockWorkbook3e=${Date.now()}-${Math.random()}`; }
function request(cloudPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = https.request(url(cloudPath), { method }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}
function credentials() {
  const lines = fs.readFileSync(CREDENTIAL, 'utf8').split(/\r?\n/).filter(Boolean);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}
async function upload(app, item) {
  return app.uploadFile({ cloudPath: item.cloudPath, fileContent: fs.createReadStream(item.localPath) });
}
async function verified(item) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const remote = await request(item.cloudPath);
    if (remote.status >= 200 && remote.status < 400 && sha1(remote.body) === item.sha1) return true;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }
  return false;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const items = [];
  for (const cfg of LEVELS) {
    const category = `unlock${cfg.number}workbookthirdedition`;
    const buildRoot = path.join(ROOT, 'data', 'transcript-build', `unlock${cfg.number}-workbook-third-edition`, cfg.level, `unlock${cfg.number}`);
    const section = JSON.parse(fs.readFileSync(path.join(buildRoot, 'manifest-section.json'), 'utf8'))[category];
    const report = JSON.parse(fs.readFileSync(path.join(buildRoot, 'clean-report.json'), 'utf8'));
    if (report.validationErrorCount || section.tracks.length !== report.eligibleCount) {
      throw new Error(`${category} has blocking validation errors or inconsistent eligible tracks`);
    }
    for (const track of section.tracks) {
      const bundleTrack = JSON.parse(fs.readFileSync(path.join(buildRoot, 'bundle-draft.json'), 'utf8'))[track.transcriptTrackId];
      items.push({ type: 'audio', category, cloudPath: track.cloudPath, localPath: bundleTrack.sourcePath, sha1: track.sha1 });
    }
    const bundlePath = path.join(buildRoot, 'bundle-draft.json');
    items.push({ type: 'transcript', category, cloudPath: section.meta.transcriptCloudPath, localPath: bundlePath, sha1: sha1(fs.readFileSync(bundlePath)) });

    const backupPath = path.join(ROOT, 'data/transcript-build/unlock-workbook-third-edition/cloud-backup', cfg.oldBackup);
    const liveOld = await request(cfg.oldPath);
    if (liveOld.status !== 200 || sha1(liveOld.body) !== sha1(fs.readFileSync(backupPath))) {
      throw new Error(`${cfg.oldPath} changed after backup`);
    }
  }
  const checks = [];
  for (const item of items) {
    const remote = await request(item.cloudPath);
    const exists = remote.status >= 200 && remote.status < 400;
    if (exists && sha1(remote.body) !== item.sha1) throw new Error(`target differs: ${item.cloudPath}`);
    checks.push({ ...item, exists });
  }
  const pending = checks.filter((item) => !item.exists);
  const preflight = { mode: apply ? 'apply' : 'dry-run', total: items.length, upload: pending.length, existingSame: items.length - pending.length };
  fs.writeFileSync(path.join(ROOT, 'data/transcript-build/unlock-workbook-third-edition/upload-preflight.json'), `${JSON.stringify(preflight, null, 2)}\n`);
  if (!apply) return console.log(JSON.stringify(preflight, null, 2));
  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials() });
  for (let index = 0; index < pending.length; index += 1) {
    await upload(app, pending[index]);
    console.log(`${index + 1}/${pending.length} ${pending[index].cloudPath}`);
  }
  for (const item of items) {
    if (!await verified(item)) throw new Error(`verify failed: ${item.cloudPath}`);
  }
  const report = { mode: 'apply', uploaded: pending.length, verified: items.length, oldBundlesUnchanged: true };
  fs.writeFileSync(path.join(ROOT, 'data/transcript-build/unlock-workbook-third-edition/upload-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(error.stack || error); process.exit(1); });
