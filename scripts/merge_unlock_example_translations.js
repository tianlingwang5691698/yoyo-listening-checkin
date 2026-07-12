#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const TRANSLATIONS = path.join(ROOT, 'data', 'unlock-vocabulary', 'example-translations');
const BACKUP = path.join(ROOT, 'data', 'unlock-vocabulary', 'backups', '2026-07-13-before-example-meanings');
const OUTPUT = path.join(ROOT, 'data', 'unlock-vocabulary', 'example-meanings-final');

function cloudPath(level, unit, section) {
  return `dictionary_books/unlock-v2/level-${level}/unit-${unit}/${section}.json`;
}

function localPath(root, level, unit, section) {
  return path.join(root, `level-${level}`, `unit-${unit}`, `${section}.json`);
}

function downloadJson(target) {
  const base = String(appConfig.cloudAssetBaseUrl).replace(/\/+$/, '');
  const url = new URL(encodeURI(`${base}/${target}?backup=${Date.now()}-${Math.random()}`));
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Cache-Control': 'no-cache' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if (response.statusCode !== 200) return reject(new Error(`download-http-${response.statusCode}:${target}`));
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

function translationKey(item) {
  return `${item.level}:${item.unit}:${String(item.section).toLowerCase()}:${item.index}`;
}

async function main() {
  const files = ['unlock1.json', 'unlock2.json', 'unlock34.json'];
  const items = files.flatMap((file) => JSON.parse(fs.readFileSync(path.join(TRANSLATIONS, file), 'utf8')));
  const byKey = new Map(items.map((item) => [translationKey(item), item]));
  if (byKey.size !== items.length) throw new Error(`duplicate-translation-key:${items.length - byKey.size}`);
  let total = 0;
  const levels = {};
  for (let level = 1; level <= 4; level += 1) {
    levels[level] = 0;
    for (let unit = 1; unit <= 8; unit += 1) {
      for (const section of ['ls', 'rw']) {
        const remoteRows = await downloadJson(cloudPath(level, unit, section));
        const backupPath = localPath(BACKUP, level, unit, section);
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.writeFileSync(backupPath, `${JSON.stringify(remoteRows, null, 2)}\n`);
        const nextRows = remoteRows.map((row, index) => {
          const key = `${level}:${unit}:${section}:${index}`;
          const item = byKey.get(key);
          if (!item) throw new Error(`translation-missing:${key}:${row.word}`);
          if (String(item.word || '') !== String(row.word || '')) throw new Error(`word-mismatch:${key}:${row.word}:${item.word}`);
          if (String(item.example || '') !== String(row.example || '')) throw new Error(`example-mismatch:${key}:${row.word}`);
          const exampleMeaning = String(item.exampleMeaning || '').replace(/\s+/g, ' ').trim();
          if (!exampleMeaning || !/[\u3400-\u9fff]/.test(exampleMeaning)) throw new Error(`translation-invalid:${key}:${row.word}`);
          total += 1;
          levels[level] += 1;
          return { ...row, exampleMeaning };
        });
        const targetPath = localPath(OUTPUT, level, unit, section);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, `${JSON.stringify(nextRows, null, 2)}\n`);
      }
    }
  }
  if (total !== byKey.size) throw new Error(`unused-translations:${byKey.size - total}`);
  const report = { books: 64, total, levels, empty: 0, passed: true };
  fs.writeFileSync(path.join(OUTPUT, 'merge-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
