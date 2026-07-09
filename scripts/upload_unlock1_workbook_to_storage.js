#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');

const appConfig = require('../data/app-config');

let cloudbase;
try {
  cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
} catch (error) {
  cloudbase = require('@cloudbase/node-sdk');
}

const ROOT = path.join(__dirname, '..');
const BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'unlock1-workbook', 'A1', 'unlock1');
const manifestPath = path.join(BUILD_ROOT, 'manifest.json');
const bundlePath = path.join(BUILD_ROOT, 'bundle-draft.json');
const credentialPath = path.join(ROOT, 'SecretKey.csv');

function normalizeCloudPath(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

function assetUrl(cloudPath) {
  return `${String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '')}/${encodeURI(normalizeCloudPath(cloudPath))}`;
}

function headStatus(cloudPath) {
  return new Promise((resolve) => {
    const request = https.request(assetUrl(cloudPath), { method: 'HEAD' }, (response) => {
      response.resume();
      resolve(response.statusCode || 0);
    });
    request.on('error', () => resolve(0));
    request.end();
  });
}

function readLocalCredential() {
  if (!fs.existsSync(credentialPath)) {
    return {};
  }
  const lines = fs.readFileSync(credentialPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return {};
  }
  const values = lines[1].split(',').map((item) => item.trim());
  return {
    secretId: values[0] || '',
    secretKey: values[1] || '',
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyHeadStatus(cloudPath, maxAttempts = 6) {
  let status = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    status = await headStatus(cloudPath);
    if (status >= 200 && status < 400) {
      return status;
    }
    if (attempt < maxAttempts) {
      await wait(1000 * attempt);
    }
  }
  return status;
}

async function uploadItem(app, item, maxAttempts = 5) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await app.uploadFile({
        cloudPath: item.cloudPath,
        fileContent: fs.createReadStream(item.localPath),
      });
      return Object.assign({}, item, {
        fileID: result.fileID || result.fileId || '',
        attempts: attempt,
      });
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await wait(1000 * attempt);
      }
    }
  }
  throw lastError;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const transcriptOnly = process.argv.includes('--transcript-only');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const transcriptPath = manifest.meta.transcriptCloudPath;
  const audioItems = manifest.tracks.map((track) => ({
    type: 'audio',
    title: track.title,
    localPath: track.sourcePath,
    cloudPath: track.audioCloudPath,
  }));
  const transcriptItem = {
    type: 'transcript',
    title: 'unlock1 workbook sentence bundle',
    localPath: bundlePath,
    cloudPath: transcriptPath,
  };
  const items = transcriptOnly ? [transcriptItem] : audioItems.concat([transcriptItem]);

  const missing = items.filter((item) => !fs.existsSync(item.localPath));
  if (missing.length) {
    throw new Error(`missing local files: ${missing.map((item) => item.localPath).join(' | ')}`);
  }

  const checks = [];
  for (const item of items) {
    const status = await headStatus(item.cloudPath);
    checks.push(Object.assign({}, item, { status, exists: status >= 200 && status < 400 }));
  }
  const existing = checks.filter((item) => item.exists);
  if (existing.length) {
    throw new Error(`target exists, aborting to avoid overwrite: ${existing.map((item) => item.cloudPath).join(' | ')}`);
  }

  if (!apply) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      envId: appConfig.cloudEnvId,
      count: items.length,
      audioCount: items.filter((item) => item.type === 'audio').length,
      transcriptCount: 1,
      transcriptPath,
      sample: checks.slice(0, 5).map((item) => ({
        type: item.type,
        cloudPath: item.cloudPath,
        preflightStatus: item.status,
      })),
    }, null, 2));
    return;
  }

  const credential = readLocalCredential();
  if (credential.secretId && credential.secretKey) {
    process.env.TENCENTCLOUD_SECRETID = process.env.TENCENTCLOUD_SECRETID || credential.secretId;
    process.env.TENCENTCLOUD_SECRETKEY = process.env.TENCENTCLOUD_SECRETKEY || credential.secretKey;
  }
  const app = cloudbase.init({
    env: appConfig.cloudEnvId,
    secretId: credential.secretId || undefined,
    secretKey: credential.secretKey || undefined,
  });
  const uploaded = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    uploaded.push(await uploadItem(app, item));
    console.log(`${index + 1}/${items.length} ${item.cloudPath}`);
  }

  const verify = [];
  for (const item of uploaded) {
    const status = await verifyHeadStatus(item.cloudPath);
    verify.push({ cloudPath: item.cloudPath, status });
  }
  const failed = verify.filter((item) => item.status < 200 || item.status >= 400);
  if (failed.length) {
    throw new Error(`post-upload verify failed: ${failed.map((item) => `${item.cloudPath}:${item.status}`).join(' | ')}`);
  }

  console.log(JSON.stringify({
    mode: 'apply',
    envId: appConfig.cloudEnvId,
    count: uploaded.length,
    audioCount: uploaded.filter((item) => item.type === 'audio').length,
    transcriptCount: uploaded.filter((item) => item.type === 'transcript').length,
    transcriptPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
