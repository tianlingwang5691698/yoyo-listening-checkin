#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'data', 'dictionary-import', 'school-examples-v1');
const REPORT = path.join(SOURCE, 'phonetic-backfill-report.json');
const REMOTE_BASE = 'https://796f-youshengenglish-6glk12rd6c6e719b-1419984942.tcb.qcloud.la';

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if ((response.statusCode || 500) >= 400) return reject(new Error(`http-${response.statusCode}:${url}`));
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const phonetics = new Map();
  for (const stage of ['junior', 'senior']) {
    const rows = await requestJson(`${REMOTE_BASE}/dictionary_books/word-dictionary-${stage}.json?phonetics=20260718`);
    rows.forEach((row) => {
      const word = clean(row.word || row.wordLower).toLowerCase();
      const phonetic = clean(row.phonetic);
      if (word && phonetic && !phonetics.has(word)) phonetics.set(word, phonetic);
    });
  }

  const report = { sources: ['word-dictionary-junior.json', 'word-dictionary-senior.json'], stages: {}, missing: [] };
  for (const [stage, count] of [['junior', 32], ['senior', 40]]) {
    const stats = { files: count, rows: 0, preserved: 0, backfilled: 0, missing: 0 };
    for (let list = 1; list <= count; list += 1) {
      const file = path.join(SOURCE, stage, `list-${list}.json`);
      const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
      rows.forEach((row) => {
        stats.rows += 1;
        if (clean(row.phonetic)) {
          stats.preserved += 1;
          return;
        }
        const phonetic = phonetics.get(clean(row.word || row.wordLower).toLowerCase()) || '';
        if (phonetic) {
          row.phonetic = phonetic;
          stats.backfilled += 1;
        } else {
          stats.missing += 1;
          report.missing.push({ stage, list, word: row.word || row.wordLower || '' });
        }
      });
      fs.writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`);
    }
    report.stages[stage] = stats;
  }
  report.generatedAt = new Date().toISOString();
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
