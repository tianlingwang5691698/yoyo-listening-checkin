#!/usr/bin/env node

const crypto = require('crypto');
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

const ROOT = path.join(__dirname, '..');
const BACKUP = path.join(ROOT, 'data', 'unlock-vocabulary', 'backups', '2026-07-13-before-examples');
const CANDIDATE = path.join(ROOT, 'data', 'unlock-vocabulary', 'examples-candidate');
const FINAL = path.join(ROOT, 'data', 'unlock-vocabulary', 'examples-final');

function books() {
  return [1, 2, 3, 4].flatMap((level) => [1, 2, 3, 4, 5, 6, 7, 8].flatMap((unit) => ['ls', 'rw'].map((section) => ({
    level,
    unit,
    section,
    cloudPath: `dictionary_books/unlock-v2/level-${level}/unit-${unit}/${section}.json`,
    backupPath: path.join(BACKUP, `level-${level}`, `unit-${unit}`, `${section}.json`),
    candidatePath: path.join(CANDIDATE, `level-${level}`, `unit-${unit}`, `${section}.json`),
    finalPath: path.join(FINAL, `level-${level}`, `unit-${unit}`, `${section}.json`)
  }))));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function withoutExample(row) {
  const copy = { ...row };
  delete copy.example;
  delete copy.exampleSource;
  return copy;
}

function cleanRows(rows) {
  return rows.map((row) => {
    const copy = { ...row, example: String(row.example || '').replace(/\s+/g, ' ').trim() };
    delete copy.exampleSource;
    return copy;
  });
}

function validateBook(book) {
  const oldRows = readJson(book.backupPath);
  const nextRows = cleanRows(readJson(book.candidatePath));
  if (oldRows.length !== nextRows.length) throw new Error(`row-count-changed:${book.cloudPath}:${oldRows.length}->${nextRows.length}`);
  let changed = 0;
  for (let index = 0; index < oldRows.length; index += 1) {
    if (JSON.stringify(stable(withoutExample(oldRows[index]))) !== JSON.stringify(stable(withoutExample(nextRows[index])))) {
      throw new Error(`non-example-field-changed:${book.cloudPath}:${index}:${oldRows[index].word}`);
    }
    const before = String(oldRows[index].example || '').trim();
    const after = String(nextRows[index].example || '').trim();
    if (!after) throw new Error(`empty-example:${book.cloudPath}:${index}:${oldRows[index].word}`);
    if (before && before !== after) throw new Error(`existing-example-changed:${book.cloudPath}:${index}:${oldRows[index].word}`);
    if (!before && after) changed += 1;
  }
  fs.mkdirSync(path.dirname(book.finalPath), { recursive: true });
  const body = `${JSON.stringify(nextRows, null, 2)}\n`;
  fs.writeFileSync(book.finalPath, body);
  return { ...book, total: nextRows.length, changed, body, sha256: crypto.createHash('sha256').update(body).digest('hex') };
}

function credential() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function getRemote(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '');
  const url = new URL(encodeURI(`${base}/${cloudPath}?verify=${Date.now()}`));
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Cache-Control': 'no-cache' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if (response.statusCode !== 200) return reject(new Error(`verify-http-${response.statusCode}:${cloudPath}`));
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    }).on('error', reject);
  });
}

async function main() {
  const checked = books().map(validateBook);
  const changedBooks = checked.filter((book) => book.changed > 0);
  const report = {
    mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
    books: checked.length,
    changedBooks: changedBooks.length,
    addedExamples: changedBooks.reduce((sum, book) => sum + book.changed, 0),
    unchangedUnlock4Books: checked.filter((book) => book.level === 4 && book.changed === 0).length,
    targets: changedBooks.map((book) => ({ cloudPath: book.cloudPath, total: book.total, addedExamples: book.changed, sha256: book.sha256 }))
  };
  fs.writeFileSync(path.join(FINAL, 'upload-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (!process.argv.includes('--confirm-example-only-overwrite')) throw new Error('missing-confirm-example-only-overwrite');
  const keys = credential();
  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...keys });
  for (let index = 0; index < changedBooks.length; index += 1) {
    const book = changedBooks[index];
    await app.uploadFile({ cloudPath: book.cloudPath, fileContent: Buffer.from(book.body, 'utf8') });
    let verified = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const remote = await getRemote(book.cloudPath);
      const remoteHash = crypto.createHash('sha256').update(remote).digest('hex');
      if (remoteHash === book.sha256) { verified = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    if (!verified) throw new Error(`post-upload-content-mismatch:${book.cloudPath}`);
    console.log(`uploaded ${index + 1}/${changedBooks.length} ${book.cloudPath}`);
  }
  console.log(JSON.stringify({ ...report, uploaded: changedBooks.length, verified: changedBooks.length }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
