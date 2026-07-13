#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const voice = require('../utils/dictionary-voice');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock2-third-edition');
const agent = new https.Agent({ keepAlive: true, maxSockets: 8 });

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }

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

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
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

async function main() {
  const clean = readJson(path.join(DATA, 'clean-report.json'));
  const candidates = readJson(path.join(DATA, 'new-candidate.json'));
  const rows = [];
  let maxBytes = 0;
  for (let unit = 1; unit <= 8; unit += 1) {
    for (const section of ['ls', 'rw']) {
      const file = path.join(DATA, `unit-${unit}-${section}.json`);
      maxBytes = Math.max(maxBytes, fs.statSync(file).size);
      const book = readJson(file);
      const keys = new Set();
      for (const row of book) {
        const key = String(row.wordLower || row.word || '').toLowerCase().trim();
        if (keys.has(key)) throw new Error(`duplicate:${unit}-${section}:${key}`);
        keys.add(key);
        if (!row.word || !row.wordLower || !row.phonetic || !row.definitions?.length || !row.example || !row.exampleMeaning) {
          throw new Error(`missing-field:${unit}-${section}:${key}`);
        }
        const compactPhonetic = row.phonetic.toLowerCase().replace(/[\s/.'_-]/g, '');
        if (['n', 'v', 'adj', 'adv', 'phr', 'prep', 'pron', 'det', 'conj', 'num'].includes(compactPhonetic)) {
          throw new Error(`pos-as-phonetic:${unit}-${section}:${key}:${row.phonetic}`);
        }
        const audioText = voice.normalizeDictionaryVoiceText(row.word);
        if (!voice.canUseDictionaryVoice(audioText)) throw new Error(`voice-invalid:${unit}-${section}:${row.word}`);
        rows.push({ unit, section, word: row.word, audioText });
      }
    }
  }
  if (clean.sections.some((item) => item.rawCount !== item.expectedNumberedRows || item.sequenceMismatches.length)) {
    throw new Error('source-number-sequence-mismatch');
  }
  if (candidates.some((row) => !row.example || !row.exampleMeaning)) throw new Error('candidate-example-missing');

  const phrases = Array.from(new Map(
    rows
      .filter((row) => voice.buildDictionaryVoiceSegments(row.word).length > 1)
      .map((row) => [row.audioText, row.word])
  ), ([audioText, word]) => ({ word, audioText }));
  const phraseResults = await mapLimit(phrases, 6, async (item) => {
    const whole = await probeUrls(voice.buildDictionaryVoiceUrls(item.audioText));
    const segments = whole.playable ? [] : await mapLimit(
      voice.buildDictionaryVoiceSegments(item.audioText),
      3,
      async (segment) => ({ segment, ...(await probeUrls(voice.buildDictionaryVoiceSegmentUrls(segment))) })
    );
    return {
      ...item,
      wholePlayable: whole.playable,
      finalPlayable: whole.playable || (segments.length > 0 && segments.every((entry) => entry.playable)),
      wholeAttempts: whole.attempts,
      segments,
    };
  });
  const noAudio = phraseResults.filter((item) => !item.finalPlayable);
  if (noAudio.length) throw new Error(`phrase-audio-failed:${noAudio.map((item) => item.word).join(',')}`);

  const started = process.hrtime.bigint();
  for (let index = 0; index < 10000; index += 1) {
    const row = rows[index % rows.length];
    voice.normalizeDictionaryVoiceText(row.word);
    voice.canUseDictionaryVoice(row.audioText);
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  const voiceReport = {
    rows: rows.length,
    canShowVoiceIcon: rows.length,
    thirdEditionPhrases: phrases.length,
    wholePlayable: phraseResults.filter((item) => item.wholePlayable).length,
    finalPlayable: phraseResults.filter((item) => item.finalPlayable).length,
    fallbackPlayable: phraseResults.filter((item) => !item.wholePlayable && item.finalPlayable).length,
    noAudio: noAudio.length,
    phrases: phraseResults,
  };
  const performance = {
    files: 16,
    rows: rows.length,
    maxJsonBytes: maxBytes,
    underOneMegabyte: maxBytes < 1024 * 1024,
    normalizationIterations: 10000,
    normalizationElapsedMs: Number(elapsedMs.toFixed(3)),
    averageMsPerRow: Number((elapsedMs / 10000).toFixed(6)),
  };
  writeJson(path.join(DATA, 'voice-report.json'), voiceReport);
  writeJson(path.join(DATA, 'performance-regression.json'), performance);
  console.log(JSON.stringify({ ...voiceReport, phrases: undefined, performance }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
