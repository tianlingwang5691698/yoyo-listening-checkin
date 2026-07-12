#!/usr/bin/env node

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
const credentialPath = path.join(ROOT, 'SecretKey.csv');
const BOOKS = [1, 2, 3, 4].flatMap((level) => [1, 2, 3, 4, 5, 6, 7, 8].flatMap((unit) => ['ls', 'rw'].map((section) => ({
  key: `unlock-${level}-u${unit}-${section}`,
  localPath: path.join(ROOT, 'data', 'unlock-vocabulary', 'output', `unlock-${level}-u${unit}-${section}.json`),
  cloudPath: `dictionary_books/unlock-v2/level-${level}/unit-${unit}/${section}.json`
}))));

function status(cloudPath) {
  const url = `${String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '')}/${cloudPath}`;
  return new Promise((resolve, reject) => {
    const request = https.request(encodeURI(url), { method: 'HEAD' }, (response) => {
      response.resume();
      resolve(response.statusCode || 0);
    });
    request.on('error', reject);
    request.end();
  });
}

async function verifiedStatus(cloudPath, attempts = 8) {
  let remoteStatus = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    remoteStatus = await status(cloudPath);
    if (remoteStatus === 200) return remoteStatus;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return remoteStatus;
}

function readCredential() {
  if (!fs.existsSync(credentialPath)) return {};
  const lines = fs.readFileSync(credentialPath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return {};
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0] || '', secretKey: values[1] || '' };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const existing = [];
  for (const book of BOOKS) {
    if (!fs.existsSync(book.localPath)) throw new Error(`missing local file: ${book.localPath}`);
    const remoteStatus = await status(book.cloudPath);
    if (remoteStatus === 200) existing.push(book.cloudPath);
  }
  if (existing.length) throw new Error(`target exists; refusing overwrite: ${existing.join(' | ')}`);
  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', books: BOOKS }, null, 2));
    return;
  }
  const credential = readCredential();
  if (!credential.secretId || !credential.secretKey) throw new Error('SecretKey.csv is missing valid SDK credentials');
  const app = cloudbase.init({ env: appConfig.cloudEnvId, secretId: credential.secretId, secretKey: credential.secretKey });
  const results = [];
  for (const book of BOOKS) {
    const result = await app.uploadFile({
      cloudPath: book.cloudPath,
      fileContent: fs.createReadStream(book.localPath)
    });
    results.push({ key: book.key, cloudPath: book.cloudPath, fileID: result.fileID || result.fileId || '' });
  }
  for (const book of BOOKS) {
    const remoteStatus = await verifiedStatus(book.cloudPath);
    if (remoteStatus !== 200) throw new Error(`post-upload verify failed: ${book.cloudPath}:${remoteStatus}`);
  }
  console.log(JSON.stringify({ envId: appConfig.cloudEnvId, results }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
