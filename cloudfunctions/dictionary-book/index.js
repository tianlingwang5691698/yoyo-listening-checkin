const https = require('https');
const zlib = require('zlib');

const CLOUD_ASSET_BASE_URL = 'https://796f-youshengenglish-6glk12rd6c6e719b-1419984942.tcb.qcloud.la';
const CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const cache = {};
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 4 });
const STANDARD_BOOKS = {
  junior: {
    level: 'junior',
    title: '新东方 初中英语词汇词根+联想记忆法：乱序版',
    cloudPath: 'dictionary_books/word-dictionary-junior.json'
  },
  senior: {
    level: 'senior',
    title: '高中英语词汇 乱序',
    cloudPath: 'dictionary_books/word-dictionary-senior.json'
  }
};

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function resolveBook(level) {
  const normalizedLevel = normalize(level);
  if (STANDARD_BOOKS[normalizedLevel]) return STANDARD_BOOKS[normalizedLevel];
  const match = normalizedLevel.match(/^unlock-(?:(v3)-)?([1-4])-u([1-8])-(ls|rw)$/);
  if (!match) return null;
  const edition = match[1] ? 3 : 2;
  const unlockLevel = Number(match[2]);
  const unit = Number(match[3]);
  const section = match[4];
  return {
    level: edition === 3 ? `unlock-v3-${unlockLevel}-u${unit}-${section}` : `unlock-${unlockLevel}-u${unit}-${section}`,
    title: `Unlock ${unlockLevel} ${edition === 3 ? '第三版' : '第二版'} Unit ${unit} ${section.toUpperCase()} 词汇表`,
    cloudPath: `dictionary_books/unlock-v${edition}/level-${unlockLevel}/unit-${unit}/${section}.json`
  };
}

function downloadJson(cloudPath) {
  return new Promise((resolve, reject) => {
    const url = `${CLOUD_ASSET_BASE_URL}/${cloudPath}`;
    https.get(encodeURI(url), {
      agent: httpsAgent,
      headers: { 'Accept-Encoding': 'gzip, br' }
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`dictionary-book-http-${response.statusCode || 0}`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        try {
          const compressed = Buffer.concat(chunks);
          const encoding = String(response.headers['content-encoding'] || '').toLowerCase();
          const body = encoding === 'gzip'
            ? zlib.gunzipSync(compressed)
            : encoding === 'br'
              ? zlib.brotliDecompressSync(compressed)
              : compressed;
          resolve(JSON.parse(body.toString('utf8')));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function main(event) {
  if (!event || event.action !== 'getDictionaryBook') throw new Error('dictionary-book-action-invalid');
  const book = resolveBook(event.payload && event.payload.level);
  if (!book) throw new Error('dictionary-book-invalid');
  const current = cache[book.cloudPath];
  const cacheHit = !!(current && Date.now() - current.savedAt < CACHE_MAX_AGE_MS);
  const rows = cacheHit ? current.rows : await downloadJson(book.cloudPath);
  if (!cacheHit) cache[book.cloudPath] = { savedAt: Date.now(), rows };
  return {
    level: book.level,
    title: book.title,
    cloudPath: book.cloudPath,
    total: Array.isArray(rows) ? rows.length : 0,
    rows: Array.isArray(rows) ? rows : [],
    resourceDebug: { service: 'dictionary-book-light', cacheHit }
  };
}

exports.main = main;
exports._test = { resolveBook };
