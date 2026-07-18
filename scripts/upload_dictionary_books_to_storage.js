#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const appConfig = require('../app-config');

let cloudbase;
try {
  cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
} catch (error) {
  cloudbase = require('@cloudbase/node-sdk');
}

const ROOT = path.join(__dirname, '..');
function credential() {
  const lines = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').trim().split(/\r?\n/);
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0], secretKey: values[1] };
}
const BOOKS = [
  {
    level: 'junior',
    localPath: path.join(ROOT, 'data', 'dictionary-import', 'output', 'word-dictionary-junior.json'),
    cloudPath: 'dictionary_books/word-dictionary-junior.json'
  },
  {
    level: 'senior',
    localPath: path.join(ROOT, 'data', 'dictionary-import', 'output', 'word-dictionary-senior.json'),
    cloudPath: 'dictionary_books/word-dictionary-senior.json'
  }
].concat(...[['junior', 32], ['senior', 40]].map(([level, count]) => Array.from({ length: count }, (_, index) => ({
  level: `${level}-list-${index + 1}`,
  localPath: path.join(ROOT, 'data', 'dictionary-import', 'output', level, `list-${index + 1}.json`),
  cloudPath: `dictionary_books/word-lists-v1/${level}/list-${index + 1}.json`
}))));

async function main() {
  const dryRun = !process.argv.includes('--apply');
  const onlyArg = process.argv.find((arg) => arg.startsWith('--level='));
  const onlyLevel = onlyArg ? onlyArg.split('=')[1] : '';
  const includeLegacy = process.argv.includes('--include-legacy');
  const books = BOOKS.filter((book) => {
    if (!includeLegacy && (book.level === 'junior' || book.level === 'senior')) return false;
    if (!onlyLevel) return true;
    return book.level === onlyLevel || book.level.startsWith(`${onlyLevel}-list-`);
  });
  if (!books.length) throw new Error('level must be junior, senior, or a list level');
  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credential() });
  const results = [];
  for (const book of books) {
    if (dryRun) {
      results.push({ level: book.level, localPath: book.localPath, cloudPath: book.cloudPath, mode: 'dry-run' });
      continue;
    }
    const result = await app.uploadFile({
      cloudPath: book.cloudPath,
      fileContent: require('fs').createReadStream(book.localPath)
    });
    results.push({ level: book.level, cloudPath: book.cloudPath, fileID: result.fileID || result.fileId || '' });
  }
  console.log(JSON.stringify({ envId: appConfig.cloudEnvId, results }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
