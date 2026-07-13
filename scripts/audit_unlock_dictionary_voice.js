#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const appConfig = require('../app-config');
const voice = require('../utils/dictionary-voice');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data', 'unlock-vocabulary', 'audits', 'youdao-audit-2026-07-13.json');
const agent = new https.Agent({ keepAlive: true, maxSockets: 10 });

function requestBuffer(url, timeoutMs = 5000) {
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

async function getJson(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  const result = await requestBuffer(`${base}/${cloudPath}?audit=${Date.now()}-${Math.random()}`, 10000);
  if (result.status !== 200) throw new Error(`dictionary-http-${result.status}:${cloudPath}`);
  return new Promise((resolve, reject) => {
    https.get(`${base}/${cloudPath}?audit=json-${Date.now()}-${Math.random()}`, { agent }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

const probeCache = new Map();
function probeText(text) {
  const key = String(text || '').trim();
  if (!probeCache.has(key)) {
    probeCache.set(key, (async () => {
      const attempts = [];
      for (const url of voice.buildDictionaryVoiceUrls(key)) {
        const result = await requestBuffer(url);
        attempts.push({ type: Number(new URL(url).searchParams.get('type')), ...result });
        if (result.status === 200 && result.bytes > 800 && /audio/i.test(result.contentType)) {
          return { playable: true, attempts };
        }
      }
      return { playable: false, attempts };
    })());
  }
  return probeCache.get(key);
}

async function main() {
  const books = [];
  for (let level = 1; level <= 4; level += 1) {
    for (let unit = 1; unit <= 8; unit += 1) {
      for (const section of ['ls', 'rw']) {
        books.push({ level, unit, section, cloudPath: `dictionary_books/unlock-v2/level-${level}/unit-${unit}/${section}.json` });
      }
    }
  }
  const bookRows = await mapLimit(books, 8, async (book) => ({ ...book, rows: await getJson(book.cloudPath) }));
  const rows = bookRows.flatMap((book) => book.rows.map((item, index) => {
    const word = String(item.word || item.wordLower || '').trim();
    const audioText = voice.normalizeDictionaryVoiceText(word);
    return {
      level: book.level,
      unit: book.unit,
      section: book.section,
      index,
      word,
      audioText,
      canSpeak: voice.canUseDictionaryVoice(audioText),
      isPhrase: voice.buildDictionaryVoiceSegments(audioText).length > 1
    };
  }));
  const phraseRows = rows.filter((row) => row.isPhrase);
  const uniqueTexts = Array.from(new Set(phraseRows.filter((row) => row.canSpeak).map((row) => row.audioText)));
  let completed = 0;
  const results = await mapLimit(uniqueTexts, 8, async (audioText) => {
    const whole = await probeText(audioText);
    const segments = voice.buildDictionaryVoiceSegments(audioText);
    let segmentResults = [];
    if (!whole.playable && segments.length > 1) {
      segmentResults = await mapLimit(segments, 3, async (segment) => ({ segment, ...(await probeText(segment)) }));
    }
    completed += 1;
    if (completed % 250 === 0 || completed === uniqueTexts.length) {
      console.log(`[audit] ${completed}/${uniqueTexts.length}`);
    }
    return {
      audioText,
      wholePlayable: whole.playable,
      finalPlayable: whole.playable || (segmentResults.length > 0 && segmentResults.every((item) => item.playable)),
      wholeAttempts: whole.attempts,
      segmentResults
    };
  });
  const resultMap = new Map(results.map((item) => [item.audioText, item]));
  const auditedRows = phraseRows.map((row) => ({ ...row, ...(resultMap.get(row.audioText) || { wholePlayable: false, finalPlayable: false }) }));
  const noIconRows = rows.filter((row) => !row.canSpeak);
  const noAudioRows = auditedRows.filter((row) => row.canSpeak && !row.finalPlayable);
  const report = {
    generatedAt: new Date().toISOString(),
    books: books.length,
    rows: rows.length,
    phraseRows: phraseRows.length,
    uniquePhraseAudioTexts: uniqueTexts.length,
    canShowIcon: rows.length - noIconRows.length,
    noIconCount: noIconRows.length,
    wholePlayablePhraseCount: auditedRows.filter((row) => row.wholePlayable).length,
    finalPlayablePhraseCount: auditedRows.filter((row) => row.finalPlayable).length,
    wordFallbackPhraseCount: auditedRows.filter((row) => !row.wholePlayable && row.finalPlayable).length,
    noAudioCount: noAudioRows.length,
    noIconRows,
    noAudioRows
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT), ...report, noIconRows: undefined, noAudioRows: undefined }, null, 2));
  if (noIconRows.length || noAudioRows.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
