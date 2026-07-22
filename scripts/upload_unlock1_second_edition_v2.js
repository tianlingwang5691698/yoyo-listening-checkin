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
const BUILD = path.join(ROOT, 'data', 'transcript-build', 'unlock1-second-edition-v2', 'A1', 'unlock1');
const BUNDLE = path.join(BUILD, 'bundle-wordaligned-v2.json');
const V1_BACKUP = path.join(BUILD, 'cloud-backup', 'bundle-v1-before-v2-20260722.json');
const PREFLIGHT = path.join(BUILD, 'upload-preflight.json');
const REPORT = path.join(BUILD, 'upload-report.json');
const V1_PATH = '_transcripts/A1/unlock1/bundle.json';
const V2_PATH = '_transcripts/A1/unlock1/bundle-wordaligned-v2.json';

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function request(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '');
  const url = `${base}/${encodeURI(cloudPath)}?unlock1SecondEditionV2=${Date.now()}-${Math.random()}`;
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        body: Buffer.concat(chunks)
      }));
    }).on('error', reject);
  });
}

function credentials() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

async function verifyV2(local) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const remote = await request(V2_PATH);
    if (remote.status === 200 && sha1(remote.body) === sha1(local)) return true;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }
  return false;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const local = fs.readFileSync(BUNDLE);
  const backup = fs.readFileSync(V1_BACKUP);
  const localBundle = JSON.parse(local.toString('utf8'));
  if (Object.keys(localBundle).length !== 24) throw new Error('v2 bundle count must be 24');

  const [v1, v2] = await Promise.all([request(V1_PATH), request(V2_PATH)]);
  if (v1.status !== 200 || sha1(v1.body) !== sha1(backup)) {
    throw new Error('online v1 changed after backup');
  }
  if (v2.status === 200 && sha1(v2.body) !== sha1(local)) {
    throw new Error('online v2 exists with different content');
  }

  const preflight = {
    mode: apply ? 'preflight-before-apply' : 'dry-run',
    envId: appConfig.cloudEnvId,
    v1Path: V1_PATH,
    v2Path: V2_PATH,
    v1Unchanged: true,
    v2ExistsSame: v2.status === 200,
    uploadCount: v2.status === 200 ? 0 : 1,
    v2TrackCount: 24
  };
  fs.writeFileSync(PREFLIGHT, `${JSON.stringify(preflight, null, 2)}\n`);
  if (!apply) {
    console.log(JSON.stringify(preflight, null, 2));
    return;
  }

  if (v2.status !== 200) {
    const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials() });
    await app.uploadFile({ cloudPath: V2_PATH, fileContent: fs.createReadStream(BUNDLE) });
  }
  if (!(await verifyV2(local))) throw new Error('v2 verification failed');

  const v1After = await request(V1_PATH);
  if (v1After.status !== 200 || sha1(v1After.body) !== sha1(backup)) {
    throw new Error('v1 changed after v2 upload');
  }
  const report = {
    mode: 'apply',
    envId: appConfig.cloudEnvId,
    uploaded: v2.status === 200 ? 0 : 1,
    verified: true,
    v1Unchanged: true,
    v2TrackCount: 24,
    v2Sha1: sha1(local)
  };
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
