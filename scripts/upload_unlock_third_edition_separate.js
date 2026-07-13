#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const appConfig = require('../app-config');
const voice = require('../utils/dictionary-voice');

let cloudbase;
try {
  cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
} catch (_) {
  cloudbase = require('@cloudbase/node-sdk');
}

const ROOT = path.join(__dirname, '..');
const THIRD_ROOT = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock-third-edition-final');
const REPORT_PATH = path.join(THIRD_ROOT, 'separate-upload-report.json');
const EXPECTED_THIRD = { 1: 946, 2: 1155, 3: 948, 4: 927 };
const EXPECTED_SECOND = { 1: 837, 2: 1317, 3: 908, 4: 357 };
const agent = new https.Agent({ keepAlive: true, maxSockets: 8 });

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
function equal(a, b) { return JSON.stringify(stable(a)) === JSON.stringify(stable(b)); }
function sha256(body) { return crypto.createHash('sha256').update(body).digest('hex'); }
function credentials() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}
function secondFile(level, unit, section) {
  const folder = level === 4 ? '2026-07-13-before-unlock4-third-edition' : '2026-07-13-before-unlock123-third-edition';
  return path.join(ROOT, 'data', 'unlock-vocabulary', 'backups', folder, `level-${level}`, `unit-${unit}`, `${section}.json`);
}
function remoteText(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '');
  const url = new URL(encodeURI(`${base}/${cloudPath}?unlockSeparate=${Date.now()}-${Math.random()}`));
  return new Promise((resolve, reject) => {
    https.get(url, { agent, headers: { 'Cache-Control': 'no-cache' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => response.statusCode === 200
        ? resolve(Buffer.concat(chunks).toString('utf8'))
        : reject(new Error(`http-${response.statusCode}:${cloudPath}`)));
    }).on('error', reject);
  });
}
function validateThirdRow(row, level, unit, section) {
  const label = `l${level}-u${unit}-${section}:${row && row.word}`;
  if (!row || Number(row.unlockLevel) !== level || String(row.section || '').toLowerCase() !== section) throw new Error(`section-invalid:${label}`);
  if (!Array.isArray(row.units) || !row.units.includes(unit)) throw new Error(`unit-invalid:${label}`);
  if (!String(row.word || '').trim() || !String(row.phonetic || '').trim()) throw new Error(`word-or-phonetic-missing:${label}`);
  if (!Array.isArray(row.definitions) || !row.definitions.some((item) => String(item || '').trim())) throw new Error(`definition-missing:${label}`);
  if (!String(row.example || '').trim() || !String(row.exampleMeaning || '').trim()) throw new Error(`example-missing:${label}`);
  if (String(row.source || '') !== 'unlock-third-edition') throw new Error(`source-invalid:${label}`);
  if (!voice.canUseDictionaryVoice(row.audioText || row.word)) throw new Error(`voice-invalid:${label}`);
  for (const key of ['candidateKey', 'exampleSource', 'phoneticSource', 'cleaningNote']) {
    if (Object.prototype.hasOwnProperty.call(row, key)) throw new Error(`internal-field:${key}:${label}`);
  }
}
async function build() {
  const books = [];
  for (let level = 1; level <= 4; level += 1) {
    let secondTotal = 0;
    let thirdTotal = 0;
    for (let unit = 1; unit <= 8; unit += 1) {
      for (const section of ['ls', 'rw']) {
        const oldRows = readJson(secondFile(level, unit, section));
        const thirdFile = path.join(THIRD_ROOT, `level-${level}`, `unit-${unit}`, `${section}.json`);
        const thirdRows = readJson(thirdFile);
        thirdRows.forEach((row) => validateThirdRow(row, level, unit, section));
        const keys = thirdRows.map((row) => String(row.wordLower || row.word).toLowerCase().trim());
        if (new Set(keys).size !== keys.length) throw new Error(`third-duplicate:l${level}-u${unit}-${section}`);
        const secondBody = `${JSON.stringify(oldRows, null, 2)}\n`;
        const thirdBody = `${JSON.stringify(thirdRows, null, 2)}\n`;
        if (Buffer.byteLength(secondBody) >= 1024 * 1024 || Buffer.byteLength(thirdBody) >= 1024 * 1024) throw new Error(`book-over-1mb:l${level}-u${unit}-${section}`);
        secondTotal += oldRows.length;
        thirdTotal += thirdRows.length;
        books.push({
          level, unit, section, oldRows, thirdRows, secondBody, thirdBody,
          secondCloudPath: `dictionary_books/unlock-v2/level-${level}/unit-${unit}/${section}.json`,
          thirdCloudPath: `dictionary_books/unlock-v3/level-${level}/unit-${unit}/${section}.json`,
          secondSha256: sha256(secondBody),
          thirdSha256: sha256(thirdBody),
          secondBytes: Buffer.byteLength(secondBody),
          thirdBytes: Buffer.byteLength(thirdBody)
        });
      }
    }
    if (secondTotal !== EXPECTED_SECOND[level]) throw new Error(`second-count:l${level}:${secondTotal}`);
    if (thirdTotal !== EXPECTED_THIRD[level]) throw new Error(`third-count:l${level}:${thirdTotal}`);
  }
  return books;
}
async function verifyRemote(cloudPath, expected) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      if (equal(JSON.parse(await remoteText(cloudPath)), expected)) return true;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}
async function main() {
  const books = await build();
  const apply = process.argv.includes('--apply');
  const report = {
    mode: apply ? 'apply' : 'dry-run',
    booksPerEdition: books.length,
    secondTotal: books.reduce((sum, item) => sum + item.oldRows.length, 0),
    thirdTotal: books.reduce((sum, item) => sum + item.thirdRows.length, 0),
    maxSecondBytes: Math.max(...books.map((item) => item.secondBytes)),
    maxThirdBytes: Math.max(...books.map((item) => item.thirdBytes)),
    levels: [1, 2, 3, 4].map((level) => ({
      level,
      second: books.filter((item) => item.level === level).reduce((sum, item) => sum + item.oldRows.length, 0),
      third: books.filter((item) => item.level === level).reduce((sum, item) => sum + item.thirdRows.length, 0)
    })),
    targets: books.map((item) => ({
      secondCloudPath: item.secondCloudPath,
      thirdCloudPath: item.thirdCloudPath,
      secondCount: item.oldRows.length,
      thirdCount: item.thirdRows.length,
      secondBytes: item.secondBytes,
      thirdBytes: item.thirdBytes,
      secondSha256: item.secondSha256,
      thirdSha256: item.thirdSha256
    }))
  };
  fs.mkdirSync(THIRD_ROOT, { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  if (!apply) return console.log(JSON.stringify(report, null, 2));
  if (!process.argv.includes('--confirm-separate-editions')) throw new Error('missing-confirm-separate-editions');

  for (const book of books) {
    const current = JSON.parse(await remoteText(book.secondCloudPath));
    if (current.length < book.oldRows.length || !equal(current.slice(0, book.oldRows.length), book.oldRows)) throw new Error(`second-baseline-changed:${book.secondCloudPath}`);
  }

  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials() });
  for (let index = 0; index < books.length; index += 1) {
    const book = books[index];
    await app.uploadFile({ cloudPath: book.thirdCloudPath, fileContent: Buffer.from(book.thirdBody, 'utf8') });
    if (!await verifyRemote(book.thirdCloudPath, book.thirdRows)) throw new Error(`third-verify-failed:${book.thirdCloudPath}`);
    console.log(`third ${index + 1}/${books.length} ${book.thirdCloudPath}`);
  }
  for (let index = 0; index < books.length; index += 1) {
    const book = books[index];
    await app.uploadFile({ cloudPath: book.secondCloudPath, fileContent: Buffer.from(book.secondBody, 'utf8') });
    if (!await verifyRemote(book.secondCloudPath, book.oldRows)) throw new Error(`second-verify-failed:${book.secondCloudPath}`);
    console.log(`second ${index + 1}/${books.length} ${book.secondCloudPath}`);
  }
  const finalReport = { ...report, uploadedThird: books.length, restoredSecond: books.length, verified: books.length * 2 };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(finalReport, null, 2)}\n`);
  console.log(JSON.stringify(finalReport, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
