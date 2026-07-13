#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const voice = require('../utils/dictionary-voice');

const ROOT = path.join(__dirname, '..');
const LEVELS = [1, 3];
const EXPECTED = { 1: 946, 3: 948 };
const OUTPUT = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock-third-edition-final');
const BACKUP = path.join(ROOT, 'data', 'unlock-vocabulary', 'backups', '2026-07-13-before-unlock123-third-edition');
const INTERNAL_FIELDS = new Set(['audioText', 'candidateKey', 'exampleSource', 'phoneticSource', 'cleaningNote']);
const agent = new https.Agent({ keepAlive: true, maxSockets: 8 });
const MANUAL_PHONETICS = new Map(Object.entries({
  dirt: '/dɜːt/',
  burn: '/bɜːn/',
  salesperson: '/ˈseɪlzpɜːsn/',
  roadworks: '/ˈrəʊdwɜːks/',
  message: '/ˈmesɪdʒ/',
  'shoe shop': '/ˈʃuː ʃɒp/',
  'computer shop': '/kəmˈpjuːtə ʃɒp/',
  'factory worker': '/ˈfæktri ˈwɜːkə/',
  thousand: '/ˈθaʊznd/',
  learn: '/lɜːn/',
  understand: '/ˌʌndəˈstænd/',
  terminal: '/ˈtɜːmɪnl/',
  adult: '/ˈædʌlt/',
  nut: '/nʌt/',
  recharge: '/ˌriːˈtʃɑːdʒ/'
}));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function bookFile(root, unit, section) {
  return path.join(root, `unit-${unit}`, `${section}.json`);
}

function sourceFile(root, unit, section) {
  return path.join(root, `unit-${unit}-${section}.json`);
}

function loadReferenceRows(level, sourceRoot) {
  const roots = [
    path.join(BACKUP, `level-${level}`),
    path.join(sourceRoot, 'increment-final', `level-${level}`)
  ];
  const rows = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (let unit = 1; unit <= 8; unit += 1) {
      for (const section of ['ls', 'rw']) {
        const file = bookFile(root, unit, section);
        if (fs.existsSync(file)) rows.push(...readJson(file));
      }
    }
  }
  return rows;
}

function validPhonetic(value) {
  const text = String(value || '').trim();
  return !!text && !/[0-9A-Z|ıõỗ“”"]/.test(text);
}

function cleanRow(row, level, unit, section, referenceIndex) {
  const key = norm(row.wordLower || row.word);
  const references = referenceIndex.get(key) || [];
  const phoneticReference = references.find((item) => validPhonetic(item.phonetic));
  const exampleReference = references.find((item) => String(item.example || '').trim() && String(item.exampleMeaning || '').trim());
  const definitionReference = references.find((item) => Array.isArray(item.definitions) && item.definitions.some((value) => String(value || '').trim()));
  const result = {
    word: String(row.word || '').trim(),
    wordLower: key,
    level: `unlock${level}-${section}`,
    unlockLevel: level,
    section: section.toUpperCase(),
    units: [unit],
    phonetic: String(validPhonetic(row.phonetic)
      ? row.phonetic
      : (phoneticReference && phoneticReference.phonetic) || MANUAL_PHONETICS.get(key) || '').trim(),
    definitions: (Array.isArray(row.definitions) && row.definitions.some((value) => String(value || '').trim())
      ? row.definitions
      : (definitionReference && definitionReference.definitions) || []).map((value) => String(value || '').trim()).filter(Boolean),
    example: String(row.example || (exampleReference && exampleReference.example) || '').trim(),
    exampleMeaning: String(row.exampleMeaning || (exampleReference && exampleReference.exampleMeaning) || '').trim(),
    source: 'unlock-third-edition',
    sourceFiles: Array.isArray(row.sourceFiles) ? row.sourceFiles.map((value) => String(value || '').trim()).filter(Boolean) : [],
    sourcePage: Number(row.sourcePage || 0)
  };
  if (Number(row.sourceRow || 0)) result.sourceRow = Number(row.sourceRow);
  if (Number(row.sourceIndex || 0)) result.sourceIndex = Number(row.sourceIndex);
  return result;
}

function validateRow(row, level, unit, section) {
  const label = `L${level}-U${unit}-${section}:${row.word}`;
  if (!row.word || !row.wordLower) throw new Error(`word-missing:${label}`);
  if (row.unlockLevel !== level || row.section !== section.toUpperCase() || row.units.length !== 1 || row.units[0] !== unit) throw new Error(`route-mismatch:${label}`);
  if (!row.phonetic) throw new Error(`phonetic-missing:${label}`);
  if (!row.definitions.length) throw new Error(`definition-missing:${label}`);
  if (!row.example || !row.exampleMeaning) throw new Error(`example-missing:${label}`);
  if (row.source !== 'unlock-third-edition' || !row.sourceFiles.length || !row.sourcePage) throw new Error(`source-missing:${label}`);
  if (!voice.canUseDictionaryVoice(row.word)) throw new Error(`voice-icon-invalid:${label}`);
  for (const key of Object.keys(row)) if (INTERNAL_FIELDS.has(key)) throw new Error(`internal-field:${label}:${key}`);
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
  const key = String(text || '').trim();
  if (!probeCache.has(key)) {
    probeCache.set(key, (async () => {
      for (const url of voice.buildDictionaryVoiceUrls(key)) {
        const response = await requestBuffer(url);
        if (response.status === 200 && response.bytes > 800 && /audio/i.test(response.contentType)) return true;
      }
      return false;
    })());
  }
  return probeCache.get(key);
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const allRows = [];
  const books = [];
  for (const level of LEVELS) {
    const sourceRoot = path.join(ROOT, 'data', 'unlock-vocabulary', `unlock${level}-third-edition`);
    const sourceRows = [];
    for (let unit = 1; unit <= 8; unit += 1) {
      for (const section of ['ls', 'rw']) sourceRows.push(...readJson(sourceFile(sourceRoot, unit, section)));
    }
    if (sourceRows.length !== EXPECTED[level]) throw new Error(`source-count:L${level}:${sourceRows.length}`);
    const referenceIndex = new Map();
    for (const row of [...loadReferenceRows(level, sourceRoot), ...sourceRows]) {
      const key = norm(row.wordLower || row.word);
      if (!referenceIndex.has(key)) referenceIndex.set(key, []);
      referenceIndex.get(key).push(row);
    }
    let levelRows = 0;
    for (let unit = 1; unit <= 8; unit += 1) {
      for (const section of ['ls', 'rw']) {
        const source = readJson(sourceFile(sourceRoot, unit, section));
        const seen = new Set();
        const rows = source.map((row) => cleanRow(row, level, unit, section, referenceIndex));
        for (const row of rows) {
          validateRow(row, level, unit, section);
          if (seen.has(row.wordLower)) throw new Error(`duplicate:L${level}-U${unit}-${section}:${row.word}`);
          seen.add(row.wordLower);
        }
        const target = bookFile(path.join(OUTPUT, `level-${level}`), unit, section);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const body = `${JSON.stringify(rows, null, 2)}\n`;
        fs.writeFileSync(target, body);
        books.push({ level, unit, section, rows: rows.length, bytes: Buffer.byteLength(body), file: path.relative(ROOT, target) });
        allRows.push(...rows);
        levelRows += rows.length;
      }
    }
    if (levelRows !== EXPECTED[level]) throw new Error(`final-count:L${level}:${levelRows}`);
  }

  const phraseRows = allRows.filter((row) => voice.buildDictionaryVoiceSegments(row.word).length > 1);
  const phraseTexts = Array.from(new Set(phraseRows.map((row) => voice.normalizeDictionaryVoiceText(row.word))));
  let completed = 0;
  const phraseResults = await mapLimit(phraseTexts, 8, async (audioText) => {
    const wholePlayable = await probeText(audioText);
    const segments = voice.buildDictionaryVoiceSegments(audioText);
    const finalPlayable = wholePlayable || (await mapLimit(segments, 3, probeText)).every(Boolean);
    completed += 1;
    if (completed % 100 === 0 || completed === phraseTexts.length) console.log(`[third-edition-voice] ${completed}/${phraseTexts.length}`);
    return { audioText, wholePlayable, finalPlayable };
  });
  const failedPhrases = phraseResults.filter((item) => !item.finalPlayable);
  const report = {
    generatedAt: new Date().toISOString(),
    levels: LEVELS.map((level) => ({ level, rows: books.filter((book) => book.level === level).reduce((sum, book) => sum + book.rows, 0) })),
    books: books.length,
    rows: allRows.length,
    maxBookBytes: Math.max(...books.map((book) => book.bytes)),
    requiredFieldsComplete: true,
    corruptPhoneticCount: allRows.filter((row) => !validPhonetic(row.phonetic)).length,
    internalFieldCount: allRows.reduce((sum, row) => sum + Object.keys(row).filter((key) => INTERNAL_FIELDS.has(key)).length, 0),
    phraseRows: phraseRows.length,
    uniquePhraseAudioTexts: phraseTexts.length,
    wholePlayablePhrases: phraseResults.filter((item) => item.wholePlayable).length,
    finalPlayablePhrases: phraseResults.filter((item) => item.finalPlayable).length,
    wordFallbackPhrases: phraseResults.filter((item) => !item.wholePlayable && item.finalPlayable).length,
    failedPhraseCount: failedPhrases.length,
    failedPhrases,
    files: books
  };
  report.ready = report.books === 32
    && report.rows === EXPECTED[1] + EXPECTED[3]
    && report.internalFieldCount === 0
    && report.corruptPhoneticCount === 0
    && report.failedPhraseCount === 0
    && report.maxBookBytes < 1024 * 1024;
  const reportFile = path.join(OUTPUT, 'build-report.json');
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, files: undefined, failedPhrases: undefined, output: path.relative(ROOT, reportFile) }, null, 2));
  if (!report.ready) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
