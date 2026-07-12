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
const DATA = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock4-third-edition');
const BACKUP = path.join(ROOT, 'data', 'unlock-vocabulary', 'backups', '2026-07-13-before-unlock4-third-edition', 'level-4');
const FINAL = path.join(DATA, 'increment-final', 'level-4');

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

function remoteText(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '');
  const url = new URL(encodeURI(`${base}/${cloudPath}?unlock4third=${Date.now()}-${Math.random()}`));
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Cache-Control': 'no-cache' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => response.statusCode === 200
        ? resolve(Buffer.concat(chunks).toString('utf8'))
        : reject(new Error(`http-${response.statusCode}:${cloudPath}`)));
    }).on('error', reject);
  });
}

function build() {
  const canonical = readJson(path.join(DATA, 'new-candidate.json'));
  const reviewed = ['u1-3', 'u4-6', 'u7-8'].flatMap((name) => readJson(path.join(DATA, `examples-${name}.json`)));
  const reviews = new Map(reviewed.map((row) => [row.candidateKey, row]));
  if (reviews.size !== canonical.length) throw new Error(`review-count-mismatch:${reviews.size}:${canonical.length}`);
  const additions = canonical.map((row) => {
    const review = reviews.get(row.candidateKey);
    if (!review) throw new Error(`review-missing:${row.candidateKey}`);
    const example = String(review.example || '').replace(/\s+/g, ' ').trim();
    const exampleMeaning = String(review.exampleMeaning || '').replace(/\s+/g, ' ').trim();
    if (!example || !exampleMeaning) throw new Error(`example-missing:${row.candidateKey}`);
    const next = { ...row, example, exampleMeaning };
    delete next.candidateKey;
    return next;
  });

  const books = [];
  for (let unit = 1; unit <= 8; unit += 1) {
    for (const section of ['ls', 'rw']) {
      const oldPath = path.join(BACKUP, `unit-${unit}`, `${section}.json`);
      const oldRows = readJson(oldPath);
      const added = additions.filter((row) => row.units[0] === unit && row.section.toLowerCase() === section);
      const oldWords = new Set(oldRows.map((row) => String(row.wordLower || row.word || '').toLowerCase().trim()));
      if (added.some((row) => oldWords.has(String(row.wordLower || row.word).toLowerCase().trim()))) throw new Error(`duplicate-old-word:u${unit}-${section}`);
      const rows = [...oldRows, ...added];
      if (!equal(rows.slice(0, oldRows.length), oldRows)) throw new Error(`old-row-changed:u${unit}-${section}`);
      const target = path.join(FINAL, `unit-${unit}`, `${section}.json`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const body = `${JSON.stringify(rows, null, 2)}\n`;
      fs.writeFileSync(target, body);
      if (Buffer.byteLength(body) >= 1024 * 1024) throw new Error(`book-over-1mb:u${unit}-${section}`);
      books.push({
        unit, section, oldPath, oldRows, added, rows, target, body,
        bytes: Buffer.byteLength(body), sha256: sha256(body),
        cloudPath: `dictionary_books/unlock-v2/level-4/unit-${unit}/${section}.json`
      });
    }
  }
  return books;
}

async function main() {
  const books = build();
  for (const book of books) {
    const current = JSON.parse(await remoteText(book.cloudPath));
    if (!equal(current, book.oldRows)) throw new Error(`remote-changed-since-backup:${book.cloudPath}`);
  }
  const report = {
    mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
    books: books.length,
    oldTotal: books.reduce((sum, book) => sum + book.oldRows.length, 0),
    addedTotal: books.reduce((sum, book) => sum + book.added.length, 0),
    finalTotal: books.reduce((sum, book) => sum + book.rows.length, 0),
    maxBytes: Math.max(...books.map((book) => book.bytes)),
    targets: books.map((book) => ({ cloudPath: book.cloudPath, old: book.oldRows.length, added: book.added.length, final: book.rows.length, bytes: book.bytes, sha256: book.sha256 }))
  };
  fs.writeFileSync(path.join(DATA, 'increment-upload-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (!process.argv.includes('--apply')) return console.log(JSON.stringify(report, null, 2));
  if (!process.argv.includes('--confirm-additive-merge')) throw new Error('missing-confirm-additive-merge');
  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials() });
  for (let index = 0; index < books.length; index += 1) {
    const book = books[index];
    await app.uploadFile({ cloudPath: book.cloudPath, fileContent: Buffer.from(book.body, 'utf8') });
    let verified = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const remote = await remoteText(book.cloudPath);
      const rows = JSON.parse(remote);
      if (rows.length === book.rows.length && equal(rows.slice(0, book.oldRows.length), book.oldRows) && equal(rows.slice(book.oldRows.length), book.added)) {
        verified = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    if (!verified) throw new Error(`post-upload-verify-failed:${book.cloudPath}`);
    console.log(`uploaded ${index + 1}/${books.length} ${book.cloudPath}`);
  }
  console.log(JSON.stringify({ ...report, uploaded: books.length, verified: books.length }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
