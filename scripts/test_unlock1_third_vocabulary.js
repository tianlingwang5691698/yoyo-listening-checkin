#!/usr/bin/env node
const fs = require('fs');
const https = require('https');
const path = require('path');
const voice = require('../utils/dictionary-voice');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock1-third-edition');
const agent = new https.Agent({ keepAlive: true, maxSockets: 8 });

function request(url, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const req = https.get(url, { agent }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: Number(res.statusCode || 0), bytes: Buffer.concat(chunks).length, type: String(res.headers['content-type'] || '') }));
    }).on('error', () => resolve({ status: 0, bytes: 0, type: '' }));
    req.setTimeout(timeoutMs, () => req.destroy());
  });
}

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  const output = new Array(items.length);
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

async function playable(text) {
  for (const url of voice.buildDictionaryVoiceUrls(text)) {
    const result = await request(url);
    if (result.status === 200 && result.bytes > 800 && /audio/i.test(result.type)) return true;
  }
  return false;
}

async function main() {
  const rows = [];
  const books = [];
  let oldRowsUnchanged = true;
  let finalInvalidRows = 0;
  for (let unit = 1; unit <= 8; unit += 1) {
    for (const section of ['ls', 'rw']) {
      const file = path.join(DATA, `unit-${unit}-${section}.json`);
      const bookRows = JSON.parse(fs.readFileSync(file, 'utf8'));
      const oldFile = path.join(DATA, 'online-base', 'level-1', `unit-${unit}`, `${section}.json`);
      const finalFile = path.join(DATA, 'increment-final', 'level-1', `unit-${unit}`, `${section}.json`);
      const oldRows = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
      const finalRows = JSON.parse(fs.readFileSync(finalFile, 'utf8'));
      oldRowsUnchanged = oldRowsUnchanged && JSON.stringify(oldRows) === JSON.stringify(finalRows.slice(0, oldRows.length));
      finalInvalidRows += finalRows.slice(oldRows.length).filter((row) => !row.word || !row.example || !row.exampleMeaning).length;
      books.push({ unit, section, rows: bookRows.length, bytes: fs.statSync(file).size, oldRows: oldRows.length, finalRows: finalRows.length, finalBytes: fs.statSync(finalFile).size });
      rows.push(...bookRows);
    }
  }
  const purePos = /^\/(?:adj|adv|n|v|phr|prep|conj|det|pron|num)\.?\/$/i;
  const invalid = rows.filter((row) => !row.word || !row.audioText || !row.definitions?.length || !row.example || !row.exampleMeaning || purePos.test(row.phonetic || ''));
  const noIcon = rows.filter((row) => !voice.canUseDictionaryVoice(voice.normalizeDictionaryVoiceText(row.audioText || row.word)));
  const phraseTexts = [...new Set(rows.map((row) => voice.normalizeDictionaryVoiceText(row.audioText || row.word)).filter((text) => voice.buildDictionaryVoiceSegments(text).length > 1))];
  const phraseResults = await mapLimit(phraseTexts, 8, async (text) => {
    const whole = await playable(text);
    const segments = voice.buildDictionaryVoiceSegments(text);
    const fallback = whole ? true : (await mapLimit(segments, 3, playable)).every(Boolean);
    return { text, wholePlayable: whole, finalPlayable: fallback };
  });
  const start = process.hrtime.bigint();
  for (let index = 0; index < 20000; index += 1) voice.normalizeDictionaryVoiceText(rows[index % rows.length].audioText);
  const normalizationMsPerRow = Number(process.hrtime.bigint() - start) / 1e6 / 20000;
  const report = {
    books: books.length,
    rows: rows.length,
    maxBookBytes: Math.max(...books.map((book) => book.bytes)),
    maxFinalBookBytes: Math.max(...books.map((book) => book.finalBytes)),
    oldRowsUnchanged,
    finalInvalidRows,
    invalidRows: invalid.length,
    noIconRows: noIcon.length,
    phrases: phraseTexts.length,
    wholePlayable: phraseResults.filter((item) => item.wholePlayable).length,
    finalPlayable: phraseResults.filter((item) => item.finalPlayable).length,
    noAudio: phraseResults.filter((item) => !item.finalPlayable),
    normalizationMsPerRow,
    booksDetail: books
  };
  fs.writeFileSync(path.join(DATA, 'voice-performance-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, booksDetail: undefined }, null, 2));
  if (invalid.length || noIcon.length || report.noAudio.length || !oldRowsUnchanged || finalInvalidRows || report.maxFinalBookBytes >= 1024 * 1024) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
