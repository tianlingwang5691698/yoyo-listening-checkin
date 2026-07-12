#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const appConfig = require('../app-config');
const cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');

const ROOT = path.join(__dirname, '..');
const BACKUP = path.join(ROOT, 'data', 'unlock-vocabulary', 'backups', '2026-07-13-before-example-meanings');
const OUTPUT = path.join(ROOT, 'data', 'unlock-vocabulary', 'example-meanings-final');

function credential() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function withoutMeaning(row) {
  const copy = { ...row };
  delete copy.exampleMeaning;
  return copy;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function remoteText(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '');
  const url = new URL(encodeURI(`${base}/${cloudPath}?verify=${Date.now()}-${Math.random()}`));
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Cache-Control': 'no-cache' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => response.statusCode === 200 ? resolve(Buffer.concat(chunks).toString('utf8')) : reject(new Error(`verify-http-${response.statusCode}`)));
    }).on('error', reject);
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  const targets = [];
  for (let level = 1; level <= 4; level += 1) {
    for (let unit = 1; unit <= 8; unit += 1) {
      for (const section of ['ls', 'rw']) {
        const cloudPath = `dictionary_books/unlock-v2/level-${level}/unit-${unit}/${section}.json`;
        const before = JSON.parse(fs.readFileSync(path.join(BACKUP, `level-${level}`, `unit-${unit}`, `${section}.json`), 'utf8'));
        const after = JSON.parse(fs.readFileSync(path.join(OUTPUT, `level-${level}`, `unit-${unit}`, `${section}.json`), 'utf8'));
        if (before.length !== after.length) throw new Error(`count-changed:${cloudPath}`);
        for (let index = 0; index < before.length; index += 1) {
          if (JSON.stringify(stable(withoutMeaning(before[index]))) !== JSON.stringify(stable(withoutMeaning(after[index])))) throw new Error(`non-translation-field-changed:${cloudPath}:${index}`);
          if (String(before[index].exampleMeaning || '').trim()) throw new Error(`existing-translation-present:${cloudPath}:${index}`);
          if (!String(after[index].exampleMeaning || '').trim()) throw new Error(`translation-empty:${cloudPath}:${index}`);
        }
        const body = `${JSON.stringify(after, null, 2)}\n`;
        targets.push({ cloudPath, body, sha256: crypto.createHash('sha256').update(body).digest('hex'), total: after.length });
      }
    }
  }
  const report = { mode: apply ? 'apply' : 'dry-run', books: targets.length, translations: targets.reduce((sum, item) => sum + item.total, 0) };
  if (!apply) return console.log(JSON.stringify(report, null, 2));
  if (!process.argv.includes('--confirm-example-meaning-only')) throw new Error('missing-confirm-example-meaning-only');
  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credential() });
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    await app.uploadFile({ cloudPath: target.cloudPath, fileContent: Buffer.from(target.body) });
    let verified = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const text = await remoteText(target.cloudPath);
      if (crypto.createHash('sha256').update(text).digest('hex') === target.sha256) { verified = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    if (!verified) throw new Error(`verify-mismatch:${target.cloudPath}`);
    console.log(`uploaded ${index + 1}/${targets.length} ${target.cloudPath}`);
  }
  fs.writeFileSync(path.join(OUTPUT, 'upload-report.json'), `${JSON.stringify({ ...report, verified: targets.length }, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, verified: targets.length }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
