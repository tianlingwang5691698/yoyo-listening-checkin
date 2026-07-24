#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'data/dictionary-import/ielts-phonetics-v2');
const OUTPUT_LISTS = path.join(OUTPUT_ROOT, 'ielts');
const CHECKPOINT = path.join(OUTPUT_ROOT, 'checkpoint.json');
const REPORT = path.join(OUTPUT_ROOT, 'phonetic-report.json');
const RUNTIME_MAP = path.join(ROOT, 'pages/reading/shared/ielts-phonetics-v2.js');
const CONCURRENCY = Math.max(1, Math.min(10, Number(process.env.IELTS_PHONETIC_CONCURRENCY || 6)));
const REMOTE_BASE = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
const agent = new https.Agent({ keepAlive: true, maxSockets: CONCURRENCY });

const ARPABET = {
  AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', EH: 'ɛ', ER: 'ɝ', EY: 'eɪ',
  IH: 'ɪ', IY: 'iː', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'uː',
  B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ', K: 'k', L: 'l',
  M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'r', S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v',
  W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ'
};
const VOWELS = new Set(['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']);
const VALID_ONSETS = new Set([
  'P R', 'P L', 'B R', 'B L', 'T R', 'T W', 'D R', 'D W', 'K R', 'K L', 'K W', 'G R', 'G L', 'G W',
  'F R', 'F L', 'TH R', 'TH W', 'SH R', 'CH R', 'S P', 'S T', 'S K', 'S M', 'S N', 'S L', 'S W',
  'S P R', 'S P L', 'S T R', 'S K R', 'S K W'
]);
const IPA_VOWELS = 'iɪeæɑɒɔʊuʌɜəa';
const BEFORE_VOWEL = `[ˈˌ]?[${IPA_VOWELS}]`;
const NARROW_IPA = /[ɾʔʍɫɨʉɐɘ]|[\u0300-\u0360\u0362-\u036f]|-/u;
const HEADWORD_CORRECTIONS = new Map(Object.entries({
  headqvarters: 'headquarters',
  borand: 'brand',
  buffal: 'buffalo',
  verlapping: 'overlapping',
  bistr: 'bistro',
  iandfill: 'landfill',
  bubbble: 'bubble',
  fagade: 'facade',
  'as iffthough': 'as if/though',
  hithert: 'hitherto',
  induige: 'indulge',
  mosquit: 'mosquito',
  overtill: 'overfill',
  agiie: 'agile',
  verexploit: 'overexploit'
}));
const MANUAL_PHONETICS = new Map(Object.entries({
  'as if/though': '/əz ɪf; əz ðəʊ/'
}));

function clean(value) {
  return String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

function wordKey(value) {
  return clean(value).toLowerCase();
}

function correctHeadword(value) {
  const key = wordKey(value);
  return HEADWORD_CORRECTIONS.get(key) || clean(value);
}

function requestJson(url, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const request = https.get({
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: `${parsed.pathname}${parsed.search}`,
      agent,
      headers: { 'User-Agent': 'YoyoIELTSPhoneticBuilder/2.0' }
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if (response.statusCode !== 200) return resolve(null);
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { resolve(null); }
      });
    }).on('error', () => resolve(null));
    request.setTimeout(timeoutMs, () => request.destroy());
  });
}

function normalizeLearnerIpa(value) {
  const body = clean(value).replace(/^[/\[]+|[/\]]+$/g, '').trim();
  if (!body || /[［］]/.test(body)) return '';
  let normalized = body
    .replace(/\((?:ɹ|r)\)/gu, '')
    .replace(/[()]/g, '')
    .replace(/[.·]/g, '')
    .replace(/͡/g, '')
    .replace(/ɝ(?=[ˈˌ]?[iɪeæɑɒɔʊuʌɜəa])/gu, 'ɜːr')
    .replace(/ɝ/g, 'ɜː')
    .replace(/ɚ(?=[ˈˌ]?[iɪeæɑɒɔʊuʌɜəa])/gu, 'ər')
    .replace(/ɚ/g, 'ə')
    .replace(/ɹ/g, 'r')
    .replace(/ɛ/g, 'e')
    .replace(/oʊ/g, 'əʊ')
    .replace(/ː{2,}/g, 'ː');
  const nonRhotic = `(?!${BEFORE_VOWEL})`;
  [
    ['aɪr', 'aɪə'], ['aʊr', 'aʊə'], ['ɜːr', 'ɜː'], ['ɑː?r', 'ɑː'],
    ['ɔː?r', 'ɔː'], ['er', 'eə'], ['ɪr', 'ɪə'], ['ʊr', 'ʊə'], ['ər', 'ə']
  ].forEach(([pattern, replacement]) => {
    normalized = normalized.replace(new RegExp(`${pattern}${nonRhotic}`, 'gu'), replacement);
  });
  return `/${normalized}/`;
}

function needsFallbackIpa(value) {
  const body = clean(value).replace(/^[/\[]+|[/\]]+$/g, '').trim();
  return !body || /[［］]/.test(body) || NARROW_IPA.test(body);
}

function extractDictionaryIpa(payload) {
  if (!Array.isArray(payload)) return '';
  const candidates = [];
  payload.forEach((entry) => {
    (entry.phonetics || []).forEach((item) => {
      const value = needsFallbackIpa(item && item.text) ? '' : normalizeLearnerIpa(item && item.text);
      if (value) candidates.push({ value, rank: /[-_]uk\./i.test(String(item.audio || '')) ? 0 : (/[-_]us\./i.test(String(item.audio || '')) ? 2 : 1) });
    });
    const value = needsFallbackIpa(entry.phonetic) ? '' : normalizeLearnerIpa(entry.phonetic);
    if (value) candidates.push({ value, rank: 1 });
  });
  candidates.sort((left, right) => left.rank - right.rank || left.value.length - right.value.length);
  return candidates.length ? candidates[0].value : '';
}

function arpabetToIpa(pronunciation) {
  const tokens = clean(pronunciation).split(/\s+/).map((token) => {
    const match = token.match(/^([A-Z]+)([012])?$/);
    if (!match || !ARPABET[match[1]]) return null;
    const symbol = match[1] === 'AH' && match[2] === '0' ? 'ə' : (match[1] === 'ER' && match[2] === '0' ? 'ɚ' : ARPABET[match[1]]);
    return { base: match[1], stress: match[2] || '', symbol };
  }).filter(Boolean);
  const stressAt = {};
  let previousVowel = -1;
  tokens.forEach((token, index) => {
    if (!VOWELS.has(token.base)) return;
    if (token.stress === '1' || token.stress === '2') {
      let onsetStart = previousVowel < 0 ? 0 : index;
      const cluster = tokens.slice(previousVowel + 1, index).map((item) => item.base);
      for (let length = Math.min(3, cluster.length); length >= 1; length -= 1) {
        const onset = cluster.slice(cluster.length - length);
        if ((length === 1 && onset[0] !== 'NG') || VALID_ONSETS.has(onset.join(' '))) {
          onsetStart = index - length;
          break;
        }
      }
      stressAt[onsetStart] = token.stress === '1' ? 'ˈ' : 'ˌ';
    }
    previousVowel = index;
  });
  const output = tokens.map((token, index) => `${stressAt[index] || ''}${token.symbol}`);
  return output.length ? normalizeLearnerIpa(`/${output.join('')}/`) : '';
}

async function fetchDictionaryIpa(word) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ipa = extractDictionaryIpa(await requestJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`));
    if (ipa) return ipa;
  }
  return '';
}

async function fetchDatamuseIpa(word) {
  const payload = await requestJson(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=r&max=8`);
  if (!Array.isArray(payload)) return '';
  const exact = payload.find((item) => wordKey(item.word) === wordKey(word));
  const tag = exact && (exact.tags || []).find((item) => String(item).startsWith('pron:'));
  return tag ? arpabetToIpa(String(tag).slice(5)) : '';
}

function phraseParts(word) {
  return clean(word).split(/[\s/-]+/).map((item) => item.replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, '')).filter(Boolean);
}

async function resolvePhonetic(word, cache) {
  const key = wordKey(word);
  if (cache[key] && cache[key].phonetic) return cache[key];
  const rebuildSource = cache[key] && cache[key].source;
  if (MANUAL_PHONETICS.has(key)) {
    cache[key] = { phonetic: MANUAL_PHONETICS.get(key), source: 'manual-reviewed' };
    return cache[key];
  }
  let phonetic = '';
  let source = '';
  if (rebuildSource === 'rebuild-datamuse') {
    phonetic = await fetchDatamuseIpa(key);
    source = phonetic ? 'datamuse-cmudict' : '';
  } else if (rebuildSource !== 'rebuild-components') {
    phonetic = await fetchDictionaryIpa(key);
    source = phonetic ? 'dictionaryapi.dev' : '';
  }
  if (!phonetic && (rebuildSource === 'rebuild-components' || /[\s-]/.test(key))) {
    const parts = phraseParts(key);
    const values = [];
    for (const part of parts) {
      let value = await fetchDatamuseIpa(part);
      if (!value) value = await fetchDictionaryIpa(part);
      if (!value) {
        values.length = 0;
        break;
      }
      values.push(value.slice(1, -1));
    }
    if (values.length === parts.length && values.length) {
      phonetic = `/${values.join(' ')}/`;
      source = 'component-dictionaries';
    }
  }
  if (!phonetic) {
    phonetic = await fetchDatamuseIpa(key);
    if (phonetic) source = 'datamuse-cmudict';
  }
  cache[key] = { phonetic, source };
  return cache[key];
}

async function loadOnlineLists() {
  const lists = [];
  for (let list = 1; list <= 48; list += 1) {
    const cloudPath = `dictionary_books/word-lists-examples-v1/ielts/list-${list}.json`;
    const rows = await requestJson(`${REMOTE_BASE}/${cloudPath}`, 30000);
    if (!Array.isArray(rows)) throw new Error(`online-list-invalid:${list}`);
    lists.push({ list, cloudPath, rows });
  }
  return lists;
}

function readCheckpoint() {
  if (!fs.existsSync(CHECKPOINT)) return { version: 4, entries: {} };
  const value = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
  if (!value || !value.entries) return { version: 4, entries: {} };
  if (value.version === 2) {
    Object.values(value.entries).forEach((entry) => {
      if (entry.source === 'datamuse-cmudict') entry.source = 'rebuild-datamuse';
      else if (entry.source === 'component-dictionaries') entry.source = 'rebuild-components';
      if (String(entry.source).startsWith('rebuild-')) entry.phonetic = '';
    });
    value.version = 3;
  }
  if (value.version === 3) {
    Object.entries(value.entries).forEach(([key, entry]) => {
      if (entry.source === 'manual-reviewed') return;
      if (needsFallbackIpa(entry.phonetic)) {
        entry.source = /[\s-]/.test(key) ? 'rebuild-components' : 'rebuild-datamuse';
        entry.phonetic = '';
      } else {
        entry.phonetic = normalizeLearnerIpa(entry.phonetic);
      }
    });
    value.version = 4;
  }
  return value.version === 4 ? value : { version: 4, entries: {} };
}

function writeJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const lists = await loadOnlineLists();
  const checkpoint = readCheckpoint();
  const uniqueWords = Array.from(new Map(lists.flatMap((item) => item.rows).map((row) => {
    const corrected = correctHeadword(row.wordLower || row.word);
    return [wordKey(corrected), corrected];
  })).entries());
  let cursor = 0;
  let completedSinceWrite = 0;
  async function worker() {
    while (cursor < uniqueWords.length) {
      const index = cursor;
      cursor += 1;
      const [key, word] = uniqueWords[index];
      if (!checkpoint.entries[key] || !checkpoint.entries[key].phonetic) {
        checkpoint.entries[key] = await resolvePhonetic(word, checkpoint.entries);
        completedSinceWrite += 1;
        if (completedSinceWrite >= 25) {
          completedSinceWrite = 0;
          checkpoint.updatedAt = new Date().toISOString();
          writeJson(CHECKPOINT, checkpoint);
        }
      }
      if ((index + 1) % 100 === 0) console.log(`resolved ${index + 1}/${uniqueWords.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  checkpoint.updatedAt = new Date().toISOString();
  writeJson(CHECKPOINT, checkpoint);

  fs.mkdirSync(OUTPUT_LISTS, { recursive: true });
  const stats = { rows: 0, dictionaryApi: 0, componentDictionaries: 0, datamuse: 0, manualReviewed: 0, missing: 0 };
  const missing = [];
  const listReports = [];
  for (const item of lists) {
    const rows = item.rows.map((row) => {
      const originalWord = clean(row.word || row.wordLower);
      const correctedWord = correctHeadword(row.wordLower || row.word);
      const result = checkpoint.entries[wordKey(correctedWord)] || {};
      const next = Object.assign({}, row, {
        wordOriginal: correctedWord !== originalWord ? originalWord : undefined,
        word: correctedWord,
        wordLower: wordKey(correctedWord),
        phoneticOriginal: clean(row.phonetic),
        phonetic: normalizeLearnerIpa(result.phonetic),
        phoneticSource: result.source || 'missing'
      });
      stats.rows += 1;
      if (result.source === 'dictionaryapi.dev') stats.dictionaryApi += 1;
      else if (result.source === 'component-dictionaries') stats.componentDictionaries += 1;
      else if (result.source === 'datamuse-cmudict') stats.datamuse += 1;
      else if (result.source === 'manual-reviewed') stats.manualReviewed += 1;
      else {
        stats.missing += 1;
        missing.push({ list: item.list, word: correctedWord, wordOriginal: originalWord, original: clean(row.phonetic) });
      }
      return next;
    });
    writeJson(path.join(OUTPUT_LISTS, `list-${item.list}.json`), rows);
    listReports.push({ list: item.list, count: rows.length, missing: rows.filter((row) => !row.phonetic).length });
  }
  const fingerprints = {};
  lists.forEach((item) => {
    fingerprints[item.cloudPath] = crypto.createHash('sha256').update(JSON.stringify(item.rows)).digest('hex');
  });
  const report = {
    generatedAt: new Date().toISOString(),
    sourceRelease: 'word-lists-examples-v1',
    candidateRelease: 'ielts-phonetics-v2',
    phoneticStandard: 'learner-friendly-british-ipa',
    listCount: lists.length,
    uniqueWords: uniqueWords.length,
    correctedHeadwords: Array.from(HEADWORD_CORRECTIONS.entries()).map(([from, to]) => ({ from, to })),
    stats,
    listReports,
    missing,
    sourceFingerprints: fingerprints
  };
  writeJson(REPORT, report);
  const runtimePhonetics = {};
  uniqueWords.forEach(([key]) => {
    const result = checkpoint.entries[key];
    if (result && result.phonetic) runtimePhonetics[key] = normalizeLearnerIpa(result.phonetic);
  });
  fs.writeFileSync(RUNTIME_MAP, `// Generated by scripts/rebuild_ielts_phonetics.js.\nmodule.exports = ${JSON.stringify({
    phonetics: runtimePhonetics,
    headwordCorrections: Object.fromEntries(HEADWORD_CORRECTIONS)
  }, null, 2)};\n`);
  console.log(JSON.stringify({ listCount: report.listCount, uniqueWords: report.uniqueWords, stats: report.stats, report: path.relative(ROOT, REPORT) }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
