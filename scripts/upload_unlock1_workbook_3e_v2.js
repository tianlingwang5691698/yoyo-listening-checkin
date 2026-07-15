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
const BUILD = path.join(ROOT, 'data/transcript-build/unlock1-workbook-third-edition-v2/A1/unlock1');
const BUNDLE = path.join(BUILD, 'bundle-wordaligned-v2.json');
const REPORT = path.join(BUILD, 'upload-report-v2.json');
const V1_BACKUP = path.join(ROOT, 'data/transcript-build/unlock1-workbook-third-edition-v2/cloud-backup/bundle-wordaligned-v1-before-v2.json');
const V1_PATH = '_transcripts/A1/unlock1-workbook-third-edition/bundle-wordaligned-v1.json';
const V2_PATH = '_transcripts/A1/unlock1-workbook-third-edition/bundle-wordaligned-v2.json';

function sha1(value) { return crypto.createHash('sha1').update(value).digest('hex'); }
function request(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '');
  return new Promise((resolve, reject) => {
    https.get(`${base}/${encodeURI(cloudPath)}?unlock1WorkbookV2=${Date.now()}-${Math.random()}`, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode || 0, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}
function credentials() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}
async function main() {
  const apply = process.argv.includes('--apply');
  const local = fs.readFileSync(BUNDLE);
  if (Object.keys(JSON.parse(local.toString('utf8'))).length !== 12) throw new Error('v2 bundle count must be 12');
  const [v1, v2] = await Promise.all([request(V1_PATH), request(V2_PATH)]);
  const v1Backup = fs.readFileSync(V1_BACKUP);
  if (v1.status !== 200 || sha1(v1.body) !== sha1(v1Backup)) throw new Error('online v1 changed after backup');
  if (v2.status === 200 && sha1(v2.body) !== sha1(local)) throw new Error('online v2 exists with different content');
  const preflight = { mode: apply ? 'apply' : 'dry-run', v1Unchanged: true, v2ExistsSame: v2.status === 200, uploadCount: v2.status === 200 ? 0 : 1 };
  if (!apply) return console.log(JSON.stringify(preflight, null, 2));
  if (v2.status !== 200) {
    const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials() });
    await app.uploadFile({ cloudPath: V2_PATH, fileContent: fs.createReadStream(BUNDLE) });
  }
  let verified = false;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const remote = await request(V2_PATH);
    if (remote.status === 200 && sha1(remote.body) === sha1(local)) { verified = true; break; }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }
  if (!verified) throw new Error('v2 verification failed');
  const v1After = await request(V1_PATH);
  if (sha1(v1After.body) !== sha1(v1Backup)) throw new Error('v1 changed after v2 upload');
  const report = { mode: 'apply', uploaded: v2.status === 200 ? 0 : 1, verified: true, v1Unchanged: true, v2TrackCount: 12 };
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => { console.error(error.stack || error); process.exit(1); });
