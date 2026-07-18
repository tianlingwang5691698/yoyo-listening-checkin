#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const appConfig = require('../app-config');
let cloudbase;
try { cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk'); } catch (_) { cloudbase = require('@cloudbase/node-sdk'); }

const ROOT = path.join(__dirname, '..');
const TARGET = process.env.VOCABULARY_TARGET === 'ielts' ? 'ielts' : 'school';
const SOURCE = path.join(ROOT, 'data', 'dictionary-import', TARGET === 'ielts' ? 'ielts-examples-v1' : 'school-examples-v1');
const RELEASE = TARGET === 'ielts' ? 'word-lists-examples-v1' : 'word-lists-examples-v2';

function assetUrl(cloudPath) {
  return `${String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '')}/${encodeURI(cloudPath)}`;
}

function headStatus(cloudPath) {
  return new Promise((resolve, reject) => {
    const request = https.request(assetUrl(cloudPath), { method: 'HEAD' }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode || 0));
    });
    request.on('error', reject);
    request.end();
  });
}

function credential() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credential() });
  const results = [];
  const pending = [];
  const books = TARGET === 'ielts' ? [['ielts', 48]] : [['junior', 32], ['senior', 40]];
  for (const [stage, count] of books) {
    for (let list = 1; list <= count; list += 1) {
      const localPath = path.join(SOURCE, stage, `list-${list}.json`);
      const cloudPath = `dictionary_books/${RELEASE}/${stage}/list-${list}.json`;
      if (!fs.existsSync(localPath)) throw new Error(`missing:${localPath}`);
      pending.push({ stage, list, localPath, cloudPath });
    }
  }
  if (apply) {
    for (const item of pending) {
      const status = await headStatus(item.cloudPath);
      if (status === 200) throw new Error(`target-exists:${item.cloudPath}`);
    }
  }
  for (const item of pending) {
      const { stage, list, localPath, cloudPath } = item;
      if (apply) {
        const result = await app.uploadFile({ cloudPath, fileContent: fs.createReadStream(localPath) });
        results.push({ stage, list, cloudPath, fileID: result.fileID || result.fileId || '' });
      } else {
        results.push({ stage, list, cloudPath, localPath, mode: 'dry-run' });
      }
  }
  console.log(JSON.stringify({ envId: appConfig.cloudEnvId, apply, count: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
