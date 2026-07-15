#!/usr/bin/env node
const fs = require('fs');
const https = require('https');
const path = require('path');
const CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data/transcript-build/unlock-workbook-third-edition/online-regression.json');
const EXPECTED = [
  ['A1', 'unlock1workbookthirdedition', 12, '_transcripts/A1/unlock1-workbook-third-edition/bundle-wordaligned-v2.json'],
  ['A2', 'unlock2workbookthirdedition', 16, '_transcripts/A2/unlock2-workbook-third-edition/bundle-wordaligned-v1.json'],
  ['B1', 'unlock3workbookthirdedition', 13, '_transcripts/B1/unlock3-workbook-third-edition/bundle-wordaligned-v1.json'],
  ['B2', 'unlock4workbookthirdedition', 15, '_transcripts/B2/unlock4-workbook-third-edition/bundle-wordaligned-v1.json']
];
function credentials() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}
function requestJson(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '');
  return new Promise((resolve, reject) => {
    https.get(`${base}/${encodeURI(cloudPath)}?onlineRegression=${Date.now()}-${Math.random()}`, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if (response.statusCode !== 200) return reject(new Error(`${cloudPath}:${response.statusCode}`));
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      });
    }).on('error', reject);
  });
}
async function main() {
  const manager = new CloudBaseManager({ ...credentials(), envId: appConfig.cloudEnvId });
  const detail = await manager.functions.getFunctionDetail('yoyo');
  const results = [];
  for (const [levelId, category, count, cloudPath] of EXPECTED) {
    const bundle = await requestJson(cloudPath);
    const onlineCount = Object.keys(bundle).length;
    if (onlineCount !== count) throw new Error(`${category} expected ${count}, got ${onlineCount}`);
    results.push({ levelId, category, count: onlineCount, cloudPath });
  }
  const report = { passed: detail.Status === 'Active', functionStatus: detail.Status, modifiedAt: detail.ModTime, results };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => { console.error(error.stack || error); process.exit(1); });
