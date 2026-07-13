#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEVELS = [1, 2];
const agent = new https.Agent({ keepAlive: true, maxSockets: 8 });
const MANUAL = new Map(Object.entries({
  california: '/ˌkælɪˈfɔːniə/',
  'from..to': '/frəm ... tuː/',
  'between...and': '/bɪˈtwiːn ... ænd/',
  'go fishing': '/ɡəʊ ˈfɪʃɪŋ/',
  'community greenhouse': '/kəˈmjuːnəti ˈɡriːnhaʊs/',
  'national park': '/ˌnæʃənəl ˈpɑːk/',
  'app developer': '/æp dɪˈveləpə/',
  'air pollution': '/eə pəˈluːʃən/',
  'neither...nor': '/ˈnaɪðə ... nɔː/',
  'square kilometres': '/skweə kɪˈlɒmɪtəz/',
  'the latest news': '/ðə ˈleɪtɪst njuːz/',
  southeast: '/ˌsaʊθˈiːst/',
  dirty: '/ˈdɜːti/',
  healthy: '/ˈhelθi/',
  walk: '/wɔːk/',
  waste: '/weɪst/',
  truck: '/trʌk/',
  happy: '/ˈhæpi/',
  green: '/ɡriːn/',
  live: '/lɪv/',
  presentation: '/ˌprezənˈteɪʃən/',
  share: '/ʃeə/',
  late: '/leɪt/',
  luxury: '/ˈlʌkʃəri/',
  fantastic: '/fænˈtæstɪk/',
  train: '/treɪn/',
  english: '/ˈɪŋɡlɪʃ/',
  judo: '/ˈdʒuːdəʊ/',
  noisy: '/ˈnɔɪzi/',
  popular: '/ˈpɒpjələ/',
  contactless: '/ˈkɒntæktləs/',
  finish: '/ˈfɪnɪʃ/',
  fast: '/fɑːst/',
  pay: '/peɪ/',
  inside: '/ˌɪnˈsaɪd/',
  'air-conditioned': '/ˌeə kənˈdɪʃənd/',
  important: '/ɪmˈpɔːtənt/',
  enjoy: '/ɪnˈdʒɔɪ/',
  subscription: '/səbˈskrɪpʃən/'
  ,sunbathe: '/ˈsʌnbeɪð/'
  ,'small business': '/smɔːl ˈbɪznɪs/'
  ,waterfall: '/ˈwɔːtəfɔːl/'
  ,judge: '/dʒʌdʒ/'
}));
const MANUAL_POS = new Map(Object.entries({
  alpaca: 'n.', minus: 'adj.', chemical: 'n.', depression: 'n.', green: 'adj./n.',
  live: 'v.', work: 'v./n.', visit: 'v./n.', salesperson: 'n.', popular: 'adj.',
  late: 'adj./adv.', thousand: 'num./n.', 'clean power': 'n.', 'look after': 'phr.',
  planet: 'n.', cheap: 'adj.'
}));

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function norm(value) { return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function invalid(value) {
  const text = String(value || '').trim();
  return !text
    || /[\u3400-\u9fff]/.test(text)
    || /[ıỗ"]/.test(text)
    || /\d{3,}/.test(text)
    || /(?:^|\/)\s*(?:n|v|adj|adv|phr|prep|pron|conj)\.?\s*(?:\/|$)/i.test(text);
}
function sanitizePhonetic(value) {
  return String(value || '').replace(/ı/g, 'ɪ').replace(/"/g, 'ˈ').trim();
}
function fetchJson(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  return new Promise((resolve) => {
    const request = https.get(url, { agent, headers: { 'User-Agent': 'UnlockVocabularyBuilder/1.0' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if (response.statusCode !== 200) return resolve(null);
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (_) { resolve(null); }
      });
    }).on('error', () => resolve(null));
    request.setTimeout(8000, () => request.destroy());
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

async function main() {
  const report = { levels: [] };
  for (const level of LEVELS) {
    const source = path.join(ROOT, 'data', 'unlock-vocabulary', `unlock${level}-third-edition`);
    const candidateFile = path.join(source, 'new-candidate.json');
    const candidates = readJson(candidateFile);
    const singles = Array.from(new Set(candidates
      .filter((row) => invalid(row.phonetic))
      .map((row) => norm(row.word))
      .filter((word) => /^[a-z]+(?:[-'][a-z]+)*$/.test(word) && !MANUAL.has(word))));
    const fetched = await mapLimit(singles, 8, async (word) => [word, extractPhonetic(await fetchJson(word))]);
    const phonetics = new Map(fetched.filter(([, phonetic]) => phonetic));
    for (const [word, phonetic] of MANUAL) phonetics.set(word, phonetic);

    const candidateKeys = new Set(candidates.map((row) => `${row.units[0]}-${String(row.section).toLowerCase()}-${norm(row.word)}`));
    let updated = 0;
    for (let unit = 1; unit <= 8; unit += 1) {
      for (const section of ['ls', 'rw']) {
        const file = path.join(source, `unit-${unit}-${section}.json`);
        const rows = readJson(file);
        for (const row of rows) {
          if (!candidateKeys.has(`${unit}-${section}-${norm(row.word)}`)) continue;
          row.phonetic = sanitizePhonetic(row.phonetic);
          const phonetic = phonetics.get(norm(row.word));
          if (phonetic) {
            row.phonetic = phonetic;
            row.phoneticSource = MANUAL.has(norm(row.word)) ? 'manual-reviewed' : 'dictionaryapi.dev';
            updated += 1;
          }
          const definitionPos = MANUAL_POS.get(norm(row.word));
          if (definitionPos && Array.isArray(row.definitions) && row.definitions.length) {
            const meaning = String(row.definitions[0]).replace(/^(?:n|v|adj|adv|phr|prep|pron|conj|num)(?:\.\/(?:n|v|adj|adv|num)\.)*\s*/i, '').trim();
            row.definitions[0] = `${definitionPos} ${meaning}`;
          }
        }
        writeJson(file, rows);
      }
    }
    const byKey = new Map();
    for (let unit = 1; unit <= 8; unit += 1) {
      for (const section of ['ls', 'rw']) {
        for (const row of readJson(path.join(source, `unit-${unit}-${section}.json`))) byKey.set(`${unit}-${section}-${norm(row.word)}`, row);
      }
    }
    const refreshed = candidates.map((row) => ({ ...byKey.get(`${row.units[0]}-${String(row.section).toLowerCase()}-${norm(row.word)}`), candidateKey: row.candidateKey }));
    const invalidRows = refreshed.filter((row) => invalid(row.phonetic)).map((row) => ({ word: row.word, phonetic: row.phonetic }));
    writeJson(candidateFile, refreshed);
    const missingDefinitionPos = refreshed.filter((row) => !/^(?:n|v|adj|adv|phr|prep|pron|conj|det|num)(?:\.|\.\/(?:n|v|adj|adv|num)\.)/i.test(String(row.definitions && row.definitions[0] || ''))).map((row) => ({ word: row.word, definition: row.definitions && row.definitions[0] }));
    report.levels.push({ level, candidates: refreshed.length, singleWordsProbed: singles.length, dictionaryPhonetics: fetched.filter(([, value]) => value).length, updated, invalidCount: invalidRows.length, invalidRows, missingDefinitionPosCount: missingDefinitionPos.length, missingDefinitionPos });
  }
  const output = path.join(ROOT, 'data', 'unlock-vocabulary', 'unlock12-third-edition-phonetic-report.json');
  writeJson(output, report);
  console.log(JSON.stringify(report, null, 2));
  if (report.levels.some((item) => item.invalidCount || item.missingDefinitionPosCount)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
