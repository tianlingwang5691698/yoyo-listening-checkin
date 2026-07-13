#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const voice = require('../utils/dictionary-voice');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock4-third-edition');
const BACKUP = path.join(ROOT, 'data', 'unlock-vocabulary', 'backups', '2026-07-13-before-unlock4-third-edition', 'level-4');
const OUTPUT = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock-third-edition-final', 'level-4');
const EXPECTED_ROWS = 927;
const EXPECTED_REVIEWED = 727;
const EXPECTED_BACKUP = 200;
const PUBLIC_FIELDS = [
  'word',
  'wordLower',
  'level',
  'unlockLevel',
  'section',
  'units',
  'phonetic',
  'definitions',
  'example',
  'exampleMeaning',
  'source',
  'sourceFiles'
];
const POS_ONLY = /^(?:n|v|adj|adv|prep|pron|conj|phr)(?:\/(?:n|v|adj|adv|prep|pron|conj|phr))*$/;
const agent = new https.Agent({ keepAlive: true, maxSockets: 8 });

// Values below are from the printed third-edition PDF or a valid occurrence of
// the same headword in the third/second-edition data. They are reviewed data,
// not generated guesses.
const REVIEWED_PHONETICS = new Map(Object.entries({
  household: '/ˈhaʊshəʊld/',
  alternative: '/ɔːlˈtɜːnətɪv/',
  vacation: '/veɪˈkeɪʃən/',
  prescription: '/prɪˈskrɪpʃən/',
  conventional: '/kənˈvenʃənəl/',
  fraction: '/ˈfrækʃən/',
  decline: '/dɪˈklaɪn/',
  irrigation: '/ˌɪrɪˈɡeɪʃən/',
  sympathetic: '/ˌsɪmpəˈθetɪk/',
  despite: '/dɪˈspaɪt/',
  recycled: '/ˌriːˈsaɪkəld/',
  consumption: '/kənˈsʌmpʃən/',
  offshore: '/ˌɒfˈʃɔː/',
  unlike: '/ʌnˈlaɪk/',
  dependent: '/dɪˈpendənt/',
  'ageing population': '/ˈeɪdʒɪŋ ˌpɒpjuˈleɪʃən/',
  luxury: '/ˈlʌkʃəri/',
  'connect with': '/kəˈnekt wɪð/',
  'according to': '/əˈkɔːdɪŋ tuː/'
}));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeWord(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function rowKey(unit, section, word) {
  return `${unit}|${String(section).toLowerCase()}|${normalizeWord(word)}`;
}

function sourceFile(unit, section) {
  return path.join(SOURCE, `unit-${unit}-${section}.json`);
}

function bookFile(root, unit, section) {
  return path.join(root, `unit-${unit}`, `${section}.json`);
}

function normalizePhonetic(value) {
  return String(value || '')
    .trim()
    .replace(/ı/g, 'ɪ')
    .replace(/[“”"]/g, 'ˈ');
}

function validPhonetic(value) {
  const text = normalizePhonetic(value);
  if (!/^\/.+\/$/.test(text) || /[\u4e00-\u9fffıỗ“”"]/.test(text)) return false;
  const inner = text.slice(1, -1).trim().toLowerCase().replace(/[.\s]/g, '');
  return !!inner && !POS_ONLY.test(inner);
}

function addToIndex(index, row, unit, section) {
  const key = rowKey(unit, section, row.wordLower || row.word);
  if (index.has(key)) throw new Error(`duplicate-index:${key}`);
  index.set(key, row);
}

function addPhonetic(pool, word, value) {
  const key = normalizeWord(word);
  const phonetic = normalizePhonetic(value);
  if (validPhonetic(phonetic) && !pool.has(key)) pool.set(key, phonetic);
}

function choosePhonetic({ source, candidate, backup, phoneticPool }) {
  const word = normalizeWord(source.word);
  const reviewed = REVIEWED_PHONETICS.get(word);
  const options = [
    candidate && candidate.phonetic,
    backup && backup.phonetic,
    source.phonetic,
    phoneticPool.get(word),
    reviewed
  ];
  const selected = options.map(normalizePhonetic).find(validPhonetic);
  if (!selected) throw new Error(`phonetic-missing:${source.word}`);
  return selected;
}

function completeExample(row) {
  return String(row && row.example || '').trim() && String(row && row.exampleMeaning || '').trim();
}

function validateRow(row, unit, section) {
  const label = `U${unit}-${section}:${row.word}`;
  if (JSON.stringify(Object.keys(row)) !== JSON.stringify(PUBLIC_FIELDS)) throw new Error(`field-schema:${label}`);
  if (!row.word || row.wordLower !== normalizeWord(row.word)) throw new Error(`word-invalid:${label}`);
  if (row.level !== `unlock4-${section}` || row.unlockLevel !== 4 || row.section !== section.toUpperCase()) throw new Error(`route-invalid:${label}`);
  if (!Array.isArray(row.units) || row.units.length !== 1 || row.units[0] !== unit) throw new Error(`unit-invalid:${label}`);
  if (!validPhonetic(row.phonetic)) throw new Error(`phonetic-invalid:${label}:${row.phonetic}`);
  if (!Array.isArray(row.definitions) || !row.definitions.length || row.definitions.some((value) => !String(value || '').trim())) throw new Error(`definition-invalid:${label}`);
  if (!row.example || !row.exampleMeaning) throw new Error(`example-invalid:${label}`);
  if (row.source !== 'unlock-third-edition' || !Array.isArray(row.sourceFiles) || !row.sourceFiles.length) throw new Error(`source-invalid:${label}`);
  if (!voice.canUseDictionaryVoice(row.word)) throw new Error(`voice-text-invalid:${label}`);
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
function probeText(text) {
  const normalized = voice.normalizeDictionaryVoiceText(text);
  if (!probeCache.has(normalized)) {
    probeCache.set(normalized, (async () => {
      for (const url of voice.buildDictionaryVoiceUrls(normalized)) {
        const response = await requestBuffer(url);
        if (response.status === 200 && response.bytes > 800 && /audio/i.test(response.contentType)) return true;
      }
      return false;
    })());
  }
  return probeCache.get(normalized);
}

async function main() {
  const cleanReport = readJson(path.join(SOURCE, 'clean-report.json'));
  if (cleanReport.total !== EXPECTED_ROWS) throw new Error(`clean-report-count:${cleanReport.total}`);

  const sourceBooks = [];
  const sourceRows = [];
  const backupRows = [];
  for (let unit = 1; unit <= 8; unit += 1) {
    for (const section of ['ls', 'rw']) {
      const rows = readJson(sourceFile(unit, section));
      const expected = cleanReport.sections.find((item) => item.unit === unit && String(item.section).toLowerCase() === section);
      if (!expected || expected.count !== rows.length) throw new Error(`section-count:U${unit}-${section}:${rows.length}`);
      sourceBooks.push({ unit, section, rows });
      sourceRows.push(...rows.map((row) => ({ row, unit, section })));
      backupRows.push(...readJson(bookFile(BACKUP, unit, section)).map((row) => ({ row, unit, section })));
    }
  }
  if (sourceRows.length !== EXPECTED_ROWS) throw new Error(`source-count:${sourceRows.length}`);

  const reviewedRows = ['examples-u1-3.json', 'examples-u4-6.json', 'examples-u7-8.json']
    .flatMap((file) => readJson(path.join(SOURCE, file)));
  const candidateRows = readJson(path.join(SOURCE, 'new-candidate.json'));
  if (reviewedRows.length !== EXPECTED_REVIEWED || candidateRows.length !== EXPECTED_REVIEWED) {
    throw new Error(`reviewed-count:${reviewedRows.length}:${candidateRows.length}`);
  }

  const reviewedIndex = new Map();
  const candidateIndex = new Map();
  const backupIndex = new Map();
  for (const row of reviewedRows) addToIndex(reviewedIndex, row, row.units[0], row.section);
  for (const row of candidateRows) addToIndex(candidateIndex, row, row.units[0], row.section);
  for (const item of backupRows) addToIndex(backupIndex, item.row, item.unit, item.section);

  const phoneticPool = new Map();
  for (const item of sourceRows) addPhonetic(phoneticPool, item.row.word, item.row.phonetic);
  for (const row of candidateRows) addPhonetic(phoneticPool, row.word, row.phonetic);
  for (const item of backupRows) addPhonetic(phoneticPool, item.row.word, item.row.phonetic);

  let reviewedCount = 0;
  let backupCount = 0;
  const generated = [];
  for (const book of sourceBooks) {
    const seen = new Set();
    const rows = book.rows.map((source) => {
      const key = rowKey(book.unit, book.section, source.word);
      const reviewed = reviewedIndex.get(key);
      const candidate = candidateIndex.get(key);
      const backup = backupIndex.get(key);
      if (reviewed && backup) throw new Error(`ambiguous-example:${key}`);
      if (reviewed) reviewedCount += 1;
      else if (backup) backupCount += 1;
      else throw new Error(`example-source-missing:${key}`);
      if (!!reviewed !== !!candidate) throw new Error(`candidate-review-mismatch:${key}`);
      const exampleSource = reviewed || backup;
      if (!completeExample(exampleSource)) throw new Error(`example-incomplete:${key}`);
      const row = {
        word: String(source.word || '').trim(),
        wordLower: normalizeWord(source.word),
        level: `unlock4-${book.section}`,
        unlockLevel: 4,
        section: book.section.toUpperCase(),
        units: [book.unit],
        phonetic: choosePhonetic({ source, candidate, backup, phoneticPool }),
        definitions: Array.isArray(source.definitions) ? source.definitions.map((value) => String(value || '').trim()).filter(Boolean) : [],
        example: String(exampleSource.example).trim(),
        exampleMeaning: String(exampleSource.exampleMeaning).trim(),
        source: 'unlock-third-edition',
        sourceFiles: Array.isArray(source.sourceFiles) ? source.sourceFiles.map((value) => String(value || '').trim()).filter(Boolean) : []
      };
      validateRow(row, book.unit, book.section);
      if (seen.has(row.wordLower)) throw new Error(`duplicate-book-word:${key}`);
      seen.add(row.wordLower);
      return row;
    });
    generated.push({ unit: book.unit, section: book.section, rows });
  }

  if (reviewedCount !== EXPECTED_REVIEWED || backupCount !== EXPECTED_BACKUP) {
    throw new Error(`example-source-count:${reviewedCount}:${backupCount}`);
  }

  const allRows = generated.flatMap((book) => book.rows);
  const phraseRows = allRows.filter((row) => voice.buildDictionaryVoiceSegments(row.word).length > 1);
  const phraseTexts = Array.from(new Set(phraseRows.map((row) => voice.normalizeDictionaryVoiceText(row.word))));
  let completed = 0;
  const results = await mapLimit(phraseTexts, 8, async (audioText) => {
    const wholePlayable = await probeText(audioText);
    const segments = voice.buildDictionaryVoiceSegments(audioText);
    const finalPlayable = wholePlayable || (await mapLimit(segments, 3, probeText)).every(Boolean);
    completed += 1;
    if (completed % 20 === 0 || completed === phraseTexts.length) console.log(`[unlock4-voice] ${completed}/${phraseTexts.length}`);
    return { audioText, wholePlayable, finalPlayable };
  });
  const failed = results.filter((result) => !result.finalPlayable);
  if (failed.length) throw new Error(`voice-failed:${JSON.stringify(failed)}`);

  const sizes = [];
  for (const book of generated) {
    const target = bookFile(OUTPUT, book.unit, book.section);
    const body = `${JSON.stringify(book.rows, null, 2)}\n`;
    if (Buffer.byteLength(body) >= 1024 * 1024) throw new Error(`book-too-large:${target}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
    sizes.push(Buffer.byteLength(body));
  }

  console.log(JSON.stringify({
    books: generated.length,
    rows: allRows.length,
    reviewedExamples: reviewedCount,
    backupExamples: backupCount,
    requiredFieldsComplete: true,
    internalFields: 0,
    phraseRows: phraseRows.length,
    uniquePhraseAudioTexts: phraseTexts.length,
    wholePlayablePhrases: results.filter((result) => result.wholePlayable).length,
    finalPlayablePhrases: results.filter((result) => result.finalPlayable).length,
    maxBookBytes: Math.max(...sizes),
    output: path.relative(ROOT, OUTPUT)
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
