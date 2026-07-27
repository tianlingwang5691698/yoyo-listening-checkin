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
const RELEASE = '20260727-single-ship-v4';
const NAMES = [
  'ad-luffy-shanks-harbor-750x620-v4.jpg',
  'home-luffy-zoro-one-deck-750x520-v4.jpg'
];
const ASSETS = NAMES.map((name) => ({
  name,
  localPath: path.join(ROOT, 'assets', 'voyage-framed-v2', name),
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

async function main() {
  const apply = process.argv.includes('--apply');
  for (const asset of ASSETS) {
    if (!fs.existsSync(asset.localPath)) throw new Error(`missing:${asset.localPath}`);
    const status = await headStatus(asset.cloudPath);
    if (apply && status === 200) throw new Error(`target-exists:${asset.cloudPath}`);
  }

  if (apply) {
    const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials() });
    for (const asset of ASSETS) {
      await app.uploadFile({ cloudPath: asset.cloudPath, fileContent: fs.createReadStream(asset.localPath) });
    }
  }

  const results = [];
  for (const asset of ASSETS) {
    let status = await headStatus(asset.cloudPath);
    if (apply) {
      for (let attempt = 0; attempt < 24 && status !== 200; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        status = await headStatus(asset.cloudPath);
      }
    }
    results.push({ name: asset.name, cloudPath: asset.cloudPath, url: publicUrl(asset.cloudPath), status });
  }
  if (apply && results.some((item) => item.status !== 200)) throw new Error('upload-verification-failed');
  console.log(JSON.stringify({ apply, release: RELEASE, results }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
