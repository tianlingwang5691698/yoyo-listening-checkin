#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock4-third-edition', 'new-candidate.json');
const REPORT = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock4-third-edition', 'phonetic-report.json');

function fetchJson(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'UnlockVocabularyBuilder/1.0' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if (response.statusCode !== 200) return resolve(null);
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (_) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function extractPhonetic(payload) {
  if (!Array.isArray(payload) || !payload.length) return '';
  for (const entry of payload) {
    const values = [entry.phonetic, ...(Array.isArray(entry.phonetics) ? entry.phonetics.map((item) => item && item.text) : [])];
    const found = values.find((value) => /^\/.+\/$/.test(String(value || '').trim()));
    if (found) return String(found).trim();
  }
  return '';
}

async function main() {
  const rows = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const targets = rows.filter((row) => /^[A-Za-z]+(?:[-'][A-Za-z]+)*$/.test(row.word));
  let cursor = 0;
  let updated = 0;
  const misses = [];
  async function worker() {
    while (cursor < targets.length) {
      const row = targets[cursor++];
      const phonetic = extractPhonetic(await fetchJson(row.word.toLowerCase()));
      if (phonetic) {
        row.phonetic = phonetic;
        row.phoneticSource = 'dictionaryapi.dev';
        updated += 1;
      } else {
        misses.push(row.word);
      }
    }
  }
  await Promise.all(Array.from({ length: 12 }, worker));
  fs.writeFileSync(FILE, `${JSON.stringify(rows, null, 2)}\n`);
  const report = { total: rows.length, eligible: targets.length, updated, misses: misses.length, missedWords: misses.sort() };
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
