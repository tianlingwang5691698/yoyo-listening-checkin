#!/usr/bin/env node

const path = require('path');

const appConfig = require('../data/app-config');

let cloudbase;
try {
  cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
} catch (error) {
  cloudbase = require('@cloudbase/node-sdk');
}

const ROOT = path.join(__dirname, '..');
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
];

async function main() {
  const dryRun = !process.argv.includes('--apply');
  const onlyArg = process.argv.find((arg) => arg.startsWith('--level='));
  const books = onlyArg ? BOOKS.filter((book) => book.level === onlyArg.split('=')[1]) : BOOKS;
  if (!books.length) throw new Error('level must be junior or senior');
  const app = cloudbase.init({ env: appConfig.cloudEnvId });
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
