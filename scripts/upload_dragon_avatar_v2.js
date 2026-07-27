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
const RELEASE = '20260727-avatar-v2';
const NAME = 'avatar-young-goku-v2.jpg';
const LOCAL_PATH = path.join(ROOT, 'assets', 'dragon-classic-v1', NAME);
const CLOUD_PATH = `_assets/themes/dragon/${RELEASE}/${NAME}`;

function credentials() {
  const rows = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = rows[1].split(',').map((value) => value.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function publicUrl() {
  return `${String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '')}/${encodeURI(CLOUD_PATH)}`;
}

function headStatus() {
  return new Promise((resolve, reject) => {
    const request = https.request(publicUrl(), { method: 'HEAD' }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode || 0));
    });
    request.setTimeout(10000, () => request.destroy(new Error(`request-timeout:${CLOUD_PATH}`)));
    request.on('error', reject);
    request.end();
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  if (!fs.existsSync(LOCAL_PATH)) throw new Error(`missing:${LOCAL_PATH}`);
  const before = await headStatus();
  if (apply && before === 200) throw new Error(`target-exists:${CLOUD_PATH}`);

  if (apply) {
    const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials() });
    await app.uploadFile({ cloudPath: CLOUD_PATH, fileContent: fs.createReadStream(LOCAL_PATH) });
  }

  let status = before;
  if (apply) {
    for (let attempt = 0; attempt < 12 && status !== 200; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      status = await headStatus();
    }
  }
  if (apply && status !== 200) throw new Error('upload-verification-failed');
  console.log(JSON.stringify({ apply, release: RELEASE, name: NAME, cloudPath: CLOUD_PATH, url: publicUrl(), status }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
