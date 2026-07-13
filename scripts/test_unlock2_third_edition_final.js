#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const voice = require('../utils/dictionary-voice');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock2-third-edition');
const FINAL = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock-third-edition-final', 'level-2');
const FIELDS = [
  'word', 'wordLower', 'level', 'unlockLevel', 'section', 'units', 'phonetic',
  'definitions', 'example', 'exampleMeaning', 'source', 'sourceFiles', 'sourcePage'
];
const agent = new https.Agent({ keepAlive: true, maxSockets: 8 });

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}
function equal(a, b) { return JSON.stringify(stable(a)) === JSON.stringify(stable(b)); }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(items.length, limit) }, run));
  return output;
}

function requestBuffer(url, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const request = https.get(url, { agent }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: Number(response.statusCode || 0),
        bytes: Buffer.concat(chunks).length,
        contentType: String(response.headers['content-type'] || '')
      }));
    }).on('error', () => resolve({ status: 0, bytes: 0, contentType: '' }));
    request.setTimeout(timeoutMs, () => request.destroy());
  });
}

async function probeUrls(urls) {
  const attempts = [];
  for (const url of urls) {
    const response = await requestBuffer(url);
    attempts.push({ type: Number(new URL(url).searchParams.get('type')), ...response });
    if (response.status === 200 && response.bytes > 800 && /audio/i.test(response.contentType)) {
      return { playable: true, attempts };
    }
  }
  return { playable: false, attempts };
}

async function probePhrase(audioText) {
  let whole = await probeUrls(voice.buildDictionaryVoiceUrls(audioText));
  if (!whole.playable) {
    await delay(250);
    const retry = await probeUrls(voice.buildDictionaryVoiceUrls(audioText));
    whole = { playable: retry.playable, attempts: [...whole.attempts, ...retry.attempts] };
  }
  const segments = whole.playable ? [] : await mapLimit(
    voice.buildDictionaryVoiceSegments(audioText),
    3,
    async (segment) => {
      let result = await probeUrls(voice.buildDictionaryVoiceSegmentUrls(segment));
      if (!result.playable) {
        await delay(250);
        const retry = await probeUrls(voice.buildDictionaryVoiceSegmentUrls(segment));
        result = { playable: retry.playable, attempts: [...result.attempts, ...retry.attempts] };
      }
      return { segment, ...result };
    }
  );
  return {
    wholePlayable: whole.playable,
    finalPlayable: whole.playable || (segments.length > 0 && segments.every((item) => item.playable)),
    wholeAttempts: whole.attempts,
    segments,
  };
}

async function main() {
  const rows = [];
  const books = [];
  for (let unit = 1; unit <= 8; unit += 1) {
    for (const section of ['ls', 'rw']) {
      const source = readJson(path.join(SOURCE, `unit-${unit}-${section}.json`));
      const finalFile = path.join(FINAL, `unit-${unit}`, `${section}.json`);
      const finalRows = readJson(finalFile);
      const projection = source.map((row) => Object.fromEntries(FIELDS.map((field) => [field, row[field]])));
      if (!equal(projection, finalRows)) throw new Error(`source-projection-mismatch:u${unit}-${section}`);
      if (finalRows.some((row) => Object.keys(row).join('|') !== FIELDS.join('|'))) {
        throw new Error(`formal-schema-mismatch:u${unit}-${section}`);
      }
      for (const row of finalRows) {
        const audioText = voice.normalizeDictionaryVoiceText(row.word);
        if (!voice.canUseDictionaryVoice(audioText)) throw new Error(`voice-icon-invalid:u${unit}-${section}:${row.word}`);
        rows.push({ unit, section, word: row.word, audioText });
      }
      books.push({ unit, section: section.toUpperCase(), rows: finalRows.length, bytes: fs.statSync(finalFile).size });
    }
  }
  if (books.length !== 16 || rows.length !== 1155) throw new Error(`count-mismatch:${books.length}:${rows.length}`);

  const phraseMap = new Map();
  for (const row of rows) {
    if (voice.buildDictionaryVoiceSegments(row.audioText).length > 1 && !phraseMap.has(row.audioText)) {
      phraseMap.set(row.audioText, row.word);
    }
  }
  const phrases = Array.from(phraseMap, ([audioText, word]) => ({ word, audioText }));
  const phraseResults = await mapLimit(phrases, 6, async (item) => ({ ...item, ...(await probePhrase(item.audioText)) }));
  const failedPhrases = phraseResults.filter((item) => !item.finalPlayable);
  if (failedPhrases.length) throw new Error(`phrase-audio-failed:${failedPhrases.map((item) => item.word).join(',')}`);

  const start = process.hrtime.bigint();
  for (let index = 0; index < 10000; index += 1) {
    const row = rows[index % rows.length];
    voice.normalizeDictionaryVoiceText(row.word);
    voice.canUseDictionaryVoice(row.audioText);
  }
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  const report = {
    edition: 'third',
    unlockLevel: 2,
    books: books.length,
    rows: rows.length,
    sourceProjectionExact: true,
    formalSchemaOnly: true,
    canShowVoiceIcon: rows.length,
    uniquePhrases: phrases.length,
    wholePlayablePhrases: phraseResults.filter((item) => item.wholePlayable).length,
    finalPlayablePhrases: phraseResults.filter((item) => item.finalPlayable).length,
    wordFallbackPhrases: phraseResults.filter((item) => !item.wholePlayable && item.finalPlayable).length,
    failedPhraseCount: failedPhrases.length,
    maxBookBytes: Math.max(...books.map((book) => book.bytes)),
    underOneMegabyte: books.every((book) => book.bytes < 1024 * 1024),
    normalizationIterations: 10000,
    normalizationElapsedMs: Number(elapsedMs.toFixed(3)),
    averageMsPerRow: Number((elapsedMs / 10000).toFixed(6)),
    booksDetail: books,
    phraseResults,
  };
  writeJson(path.join(FINAL, 'validation-report.json'), report);
  console.log(JSON.stringify({ ...report, phraseResults: undefined, booksDetail: undefined }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
