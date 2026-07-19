#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');

const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'cloudfunctions', 'yoyo', 'data', 'reading-directory.json');
const SOURCE_PATHS = [
  '_content/reading-em1/reading-passages.json',
  '_content/reading/reading-passages.json'
];
const LOCAL_SOURCE_PATHS = [
  'data/reading-senior-spring/reading-passages.json',
  'data/reading-senior-autumn/reading-passages.json'
];

function downloadJson(cloudPath) {
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  const url = encodeURI(`${baseUrl}/${cloudPath}`);
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`reading-directory-http-${response.statusCode}:${cloudPath}`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const sources = await Promise.all(SOURCE_PATHS.map(downloadJson));
  LOCAL_SOURCE_PATHS.forEach((localPath) => {
    sources.push(JSON.parse(fs.readFileSync(path.join(ROOT, localPath), 'utf8')));
  });
  const passages = sources.flatMap((raw) => Array.isArray(raw) ? raw : (raw.passages || raw.items || []));
  const directory = passages.map((item) => ({
    _id: item._id,
    title: item.title,
    year: item.year || '',
    district: item.district || '',
    examType: item.examType || '',
    section: item.section || '',
    sectionLabel: item.sectionLabel || '',
    paperId: item.paperId || '',
    paperTitle: item.paperTitle || '',
    paperOrder: Number(item.paperOrder || 0),
    difficultyLevel: Number(item.difficultyLevel || 0),
    difficultyLabel: item.difficultyLabel || '',
    questionCount: Array.isArray(item.questions) ? item.questions.length : Number(item.questionCount || 0),
    status: item.status || 'sample'
  }));
  if (directory.length !== 925 || new Set(directory.map((item) => item._id)).size !== directory.length) {
    throw new Error(`reading-directory-validation-failed:${directory.length}`);
  }
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(directory)}\n`);
  console.log(JSON.stringify({ output: OUTPUT_PATH, count: directory.length, bytes: fs.statSync(OUTPUT_PATH).size }));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
