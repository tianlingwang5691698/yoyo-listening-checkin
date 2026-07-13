#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock3-third-edition');
const CANDIDATE = path.join(SOURCE, 'new-candidate.json');
const REPORT = path.join(SOURCE, 'phonetic-report.json');
const agent = new https.Agent({ keepAlive: true, maxSockets: 3 });
const MANUAL_PHONETICS = new Map(Object.entries({
  'domesticated': '/dəˈmestɪkeɪtɪd/',
  'neither...nor': '/ˈnaɪðə(r) ... nɔː(r)/',
  'natural resource': '/ˈnætʃrəl rɪˈzɔːs/',
  'drive-through': '/ˈdraɪv θruː/',
  'on the outskirts': '/ɒn ði ˈaʊtskɜːts/',
  'come down with': '/kʌm daʊn wɪð/',
  'join in': '/dʒɔɪn ɪn/',
  'work out': '/wɜːk aʊt/',
  'in addition': '/ɪn əˈdɪʃən/',
  'thesis statement': '/ˈθiːsɪs ˈsteɪtmənt/',
  'thrifting': '/ˈθrɪftɪŋ/',
  'throw away': '/θrəʊ əˈweɪ/',
  'sustainability strategy': '/səˌsteɪnəˈbɪləti ˈstrætədʒi/',
  'classic cars': '/ˈklæsɪk kɑːz/',
  'shortage': '/ˈʃɔːtɪdʒ/',
  'decrease sharply': '/dɪˈkriːs ˈʃɑːpli/',
  'a sharp rise': '/ə ʃɑːp raɪz/',
  'fluctuate considerably': '/ˈflʌktʃueɪt kənˈsɪdərəbli/',
  'increase slightly': '/ɪnˈkriːs ˈslaɪtli/'
  ,'suspension': '/səˈspenʃən/'
  ,'solution': '/səˈluːʃən/'
}));

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function fetchJson(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  return new Promise((resolve) => {
    const request = https.get(url, { agent, headers: { 'User-Agent': 'Unlock3VocabularyBuilder/1.0' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if (response.statusCode !== 200) return resolve(null);
        try { return resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (_) { return resolve(null); }
      });
    }).on('error', () => resolve(null));
    request.setTimeout(10000, () => request.destroy());
  });
}

function extractPhonetic(payload) {
  if (!Array.isArray(payload)) return '';
  for (const entry of payload) {
    const values = [entry.phonetic, ...(Array.isArray(entry.phonetics) ? entry.phonetics.map((item) => item && item.text) : [])];
    const found = values.find((value) => /^\/.+\/$/.test(String(value || '').trim()));
    if (found) return String(found).trim();
  }
  return '';
}

function norm(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

async function main() {
  const candidates = JSON.parse(fs.readFileSync(CANDIDATE, 'utf8'));
  const unitIndex = new Map();
  for (let unit = 1; unit <= 8; unit += 1) {
    for (const section of ['ls', 'rw']) {
      const rows = JSON.parse(fs.readFileSync(path.join(SOURCE, `unit-${unit}-${section}.json`), 'utf8'));
      for (const row of rows) unitIndex.set(`u${unit}-${section}-${norm(row.word)}`, row);
    }
  }
  for (const row of candidates) {
    const current = unitIndex.get(row.candidateKey);
    if (!current) continue;
    row.phonetic = current.phonetic;
    row.phoneticSource = current.phoneticSource;
  }
  const targetRows = candidates.filter((row) => !String(row.phonetic || '').trim() && !MANUAL_PHONETICS.has(norm(row.word)) && /^[A-Za-z]+(?:[-'][A-Za-z]+)*$/.test(row.word) && row.phoneticSource !== 'manual-source-audit');
  const targets = Array.from(new Map(targetRows.map((row) => [norm(row.word), row.word])).entries());
  const phonetics = new Map(MANUAL_PHONETICS);
  const misses = [];
  let cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      const [key, word] = targets[cursor++];
      let phonetic = '';
      for (let attempt = 0; attempt < 3 && !phonetic; attempt += 1) {
        phonetic = extractPhonetic(await fetchJson(key));
        if (!phonetic) await wait(250 * (attempt + 1));
      }
      if (phonetic) phonetics.set(key, phonetic);
      else misses.push(word);
      await wait(80);
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));

  for (const row of candidates) {
    const phonetic = phonetics.get(norm(row.word));
    if (!phonetic) continue;
    row.phonetic = phonetic;
    row.phoneticSource = MANUAL_PHONETICS.has(norm(row.word)) ? 'manual-reviewed-phonetic' : 'dictionaryapi.dev';
  }
  fs.writeFileSync(CANDIDATE, `${JSON.stringify(candidates, null, 2)}\n`);

  let updated = 0;
  for (let unit = 1; unit <= 8; unit += 1) {
    for (const section of ['ls', 'rw']) {
      const file = path.join(SOURCE, `unit-${unit}-${section}.json`);
      const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const row of rows) {
        const phonetic = phonetics.get(norm(row.word));
        if (!phonetic) continue;
        row.phonetic = phonetic;
        row.phoneticSource = MANUAL_PHONETICS.has(norm(row.word)) ? 'manual-reviewed-phonetic' : 'dictionaryapi.dev';
        updated += 1;
      }
      fs.writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`);
    }
  }

  const report = {
    newCandidates: candidates.length,
    eligibleSingleWords: candidates.filter((row) => /^[A-Za-z]+(?:[-'][A-Za-z]+)*$/.test(row.word)).length,
    attemptedThisRun: targetRows.length,
    uniqueSingleWordsProbed: targets.length,
    resolvedPhonetics: candidates.filter((row) => String(row.phonetic || '').trim()).length,
    dictionaryPhonetics: candidates.filter((row) => row.phoneticSource === 'dictionaryapi.dev').length,
    manualPhonetics: candidates.filter((row) => String(row.phoneticSource || '').startsWith('manual')).length,
    updatedUnitRows: updated,
    misses: misses.length,
    missedWords: misses.sort(),
    blankCandidatePhonetics: candidates.filter((row) => !String(row.phonetic || '').trim()).map((row) => row.candidateKey || row.word)
  };
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
