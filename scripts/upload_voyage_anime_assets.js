#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const appConfig = require('../app-config');

let cloudbase;
try {
  cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
} catch (_) {
  cloudbase = require('@cloudbase/node-sdk');
}

const ROOT = path.resolve(__dirname, '..');
const RELEASE = '20260727-anime-v1';
const NAMES = [
  'ad-shanks-sunny.jpg',
  'ad-luffy-zoro-sunny.jpg',
  'home-luffy-nami-sunny.jpg',
  'subpages/listening-usopp-radio.jpg',
  'subpages/reading-robin-library.jpg',
  'subpages/grammar-robin-zoro-map.jpg',
  'subpages/writing-nami-robin-log.jpg',
  'subpages/speaking-sanji-usopp.jpg',
  'subpages/vocabulary-chopper-franky.jpg',
  'subpages/record-brook-chopper.jpg',
  'subpages/parent-jinbe-robin.jpg',
  'subpages/profile-luffy-sunny.jpg'
];
const ASSETS = NAMES.map((name) => ({
  name,
  localPath: path.join(ROOT, 'assets', 'voyage-anime-v1', name),
  cloudPath: `_assets/themes/voyage/${RELEASE}/${name}`
}));

function credentials() {
  const rows = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = rows[1].split(',').map((value) => value.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function publicUrl(cloudPath) {
  return `${String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '')}/${encodeURI(cloudPath)}`;
}

function headStatus(cloudPath) {
  return new Promise((resolve, reject) => {
    const request = https.request(publicUrl(cloudPath), { method: 'HEAD' }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode || 0));
    });
    request.setTimeout(10000, () => request.destroy(new Error(`request-timeout:${cloudPath}`)));
    request.on('error', reject);
    request.end();
  });
}

async function waitForAvailable(cloudPath) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const status = await headStatus(cloudPath);
    if (status === 200) return status;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return headStatus(cloudPath);
}

async function main() {
  const apply = process.argv.includes('--apply');
  ASSETS.forEach((asset) => {
    if (!fs.existsSync(asset.localPath)) throw new Error(`missing:${asset.localPath}`);
  });

  const statuses = [];
  for (const asset of ASSETS) {
    const status = await headStatus(asset.cloudPath);
    statuses.push({ asset, status });
    if (apply && status === 200) throw new Error(`target-exists:${asset.cloudPath}`);
  }

  if (apply) {
    const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials() });
    for (const { asset } of statuses) {
      await app.uploadFile({ cloudPath: asset.cloudPath, fileContent: fs.createReadStream(asset.localPath) });
    }
  }

  const results = [];
  for (const { asset, status } of statuses) {
    const finalStatus = apply ? await waitForAvailable(asset.cloudPath) : status;
    results.push({
      name: asset.name,
      cloudPath: asset.cloudPath,
      url: publicUrl(asset.cloudPath),
      status: finalStatus
    });
  }
  if (apply && results.some((item) => item.status !== 200)) throw new Error('upload-verification-failed');
  console.log(JSON.stringify({ apply, release: RELEASE, results }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
