#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const voice = require('../utils/dictionary-voice');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock3-third-edition');
const OUTPUT = path.join(SOURCE, 'regression-report.json');
const agent = new https.Agent({ keepAlive: true, maxSockets: 8 });

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
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

const probeCache = new Map();
function probeText(value) {
  const text = String(value || '').trim();
  if (!probeCache.has(text)) {
    probeCache.set(text, (async () => {
      const attempts = [];
      for (const url of voice.buildDictionaryVoiceUrls(text)) {
        const response = await requestBuffer(url);
        attempts.push({ type: Number(new URL(url).searchParams.get('type')), ...response });
        if (response.status === 200 && response.bytes > 800 && /audio/i.test(response.contentType)) {
          return { playable: true, attempts };
        }
      }
      return { playable: false, attempts };
    })());
  }
  return probeCache.get(text);
}

async function main() {
  const clean = readJson(path.join(SOURCE, 'clean-report.json'));
  const increment = readJson(path.join(SOURCE, 'increment-report.json'));
  const candidates = readJson(path.join(SOURCE, 'new-candidate.json'));
  const rows = [];
  const books = [];
  for (let unit = 1; unit <= 8; unit += 1) {
    for (const section of ['ls', 'rw']) {
      const file = path.join(SOURCE, `unit-${unit}-${section}.json`);
      const bookRows = readJson(file);
      rows.push(...bookRows);
      books.push({ unit, section: section.toUpperCase(), rows: bookRows.length, bytes: fs.statSync(file).size });
    }
  }

  const purePosPattern = /^\/?(?:adj|adv|phr|prep|conj|det|pron|n|v)(?:[./]+(?:adj|adv|n|v))*\/?$/i;
  const purePosPhonetics = rows.filter((row) => purePosPattern.test(String(row.phonetic || '').replace(/\s+/g, '')))
    .map((row) => ({ word: row.word, phonetic: row.phonetic, sourcePage: row.sourcePage }));
  const noIconRows = rows.filter((row) => !voice.canUseDictionaryVoice(row.word))
    .map((row) => ({ word: row.word, sourcePage: row.sourcePage }));
  const missingCandidateFields = candidates.filter((row) => !row.example || !row.exampleMeaning || !row.definitions?.length);
  const corruptPhoneticPattern = /[0-9A-Z|ıõỗ“”"]/;
  const corruptPhonetics = candidates.filter((row) => row.phonetic && corruptPhoneticPattern.test(row.phonetic))
    .map((row) => ({ word: row.word, phonetic: row.phonetic, candidateKey: row.candidateKey }));
  const phraseRows = rows.filter((row) => voice.buildDictionaryVoiceSegments(row.word).length > 1);
  const phraseTexts = Array.from(new Set(phraseRows.map((row) => voice.normalizeDictionaryVoiceText(row.word))));
  const phraseResults = await mapLimit(phraseTexts, 8, async (audioText) => {
    const whole = await probeText(audioText);
    const segments = voice.buildDictionaryVoiceSegments(audioText);
    const segmentResults = whole.playable ? [] : await mapLimit(segments, 3, async (segment) => ({ segment, ...(await probeText(segment)) }));
    return {
      audioText,
      wholePlayable: whole.playable,
      finalPlayable: whole.playable || (segmentResults.length > 0 && segmentResults.every((item) => item.playable)),
      wholeAttempts: whole.attempts,
      segmentResults
    };
  });
  const failedPhrases = phraseResults.filter((item) => !item.finalPlayable);
  const report = {
    generatedAt: new Date().toISOString(),
    books,
    bookCount: books.length,
    rawNumberedRows: clean.rawTotal,
    allNumberedRowsComplete: clean.allNumberedRowsComplete,
    uniqueThirdEditionRows: rows.length,
    onlineOldRows: increment.oldTotal,
    newCandidateRows: candidates.length,
    examplesComplete: missingCandidateFields.length === 0,
    purePosPhoneticCount: purePosPhonetics.length,
    canShowVoiceIcon: rows.length - noIconRows.length,
    noIconCount: noIconRows.length,
    phraseRows: phraseRows.length,
    uniquePhraseAudioTexts: phraseTexts.length,
    wholePlayablePhrases: phraseResults.filter((item) => item.wholePlayable).length,
    finalPlayablePhrases: phraseResults.filter((item) => item.finalPlayable).length,
    wordFallbackPhrases: phraseResults.filter((item) => !item.wholePlayable && item.finalPlayable).length,
    failedPhraseCount: failedPhrases.length,
    largestBookBytes: Math.max(...books.map((book) => book.bytes)),
    purePosPhonetics,
    noIconRows,
    missingCandidateFields: missingCandidateFields.map((row) => row.candidateKey || row.word),
    corruptPhonetics,
    failedPhrases
  };
  report.ready = report.bookCount === 16
    && report.rawNumberedRows === 954
    && report.allNumberedRowsComplete
    && report.uniqueThirdEditionRows === 948
    && report.newCandidateRows === increment.newTotal
    && report.examplesComplete
    && report.corruptPhonetics.length === 0
    && report.purePosPhoneticCount === 0
    && report.noIconCount === 0
    && report.failedPhraseCount === 0
    && report.largestBookBytes < 1024 * 1024;
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    output: path.relative(ROOT, OUTPUT),
    ready: report.ready,
    rawNumberedRows: report.rawNumberedRows,
    uniqueThirdEditionRows: report.uniqueThirdEditionRows,
    newCandidateRows: report.newCandidateRows,
    purePosPhoneticCount: report.purePosPhoneticCount,
    noIconCount: report.noIconCount,
    phraseRows: report.phraseRows,
    uniquePhraseAudioTexts: report.uniquePhraseAudioTexts,
    wholePlayablePhrases: report.wholePlayablePhrases,
    finalPlayablePhrases: report.finalPlayablePhrases,
    wordFallbackPhrases: report.wordFallbackPhrases,
    failedPhraseCount: report.failedPhraseCount,
    largestBookBytes: report.largestBookBytes
  }, null, 2));
  if (!report.ready) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
