#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const appConfig = require('../app-config');
const cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');

const ROOT = path.join(__dirname, '..');
const DATASETS = [
  { name: 'em2', cloudRoot: '_content/grammar' },
  { name: 'em1', cloudRoot: '_content/grammar-em1' }
];
const SOURCE_WATERMARK_RE = /[\[【（(]\s*来源\s*[:：]?[^\]】）)]*[\]】）)]/giu;
const UNCLOSED_SOURCE_WATERMARK_RE = /[\[【（(]\s*来源\s*[:：]?[^\]】）)]*$/giu;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function credentials() {
  const filePath = path.join(ROOT, 'SecretKey.csv');
  const rows = fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length < 2) throw new Error('SecretKey.csv has no credential row');
  const values = rows[1].split(',').map((value) => value.trim());
  if (!values[0] || !values[1]) throw new Error('SecretKey.csv credentials are incomplete');
  return { secretId: values[0], secretKey: values[1] };
}

function request(cloudPath) {
  const base = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  const url = encodeURI(`${base}/${cloudPath.replace(/^\/+/, '')}?grammarClean=${Date.now()}-${Math.random()}`);
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Cache-Control': 'no-cache' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        body: Buffer.concat(chunks)
      }));
    }).on('error', reject);
  });
}

async function download(cloudPath) {
  const response = await request(cloudPath);
  if (response.statusCode !== 200) {
    throw new Error(`grammar-clean-download-http-${response.statusCode}:${cloudPath}`);
  }
  return {
    cloudPath,
    body: response.body,
    value: JSON.parse(response.body.toString('utf8'))
  };
}

function stripSourceWatermarks(value) {
  const text = String(value || '');
  const cleaned = text
    .replace(SOURCE_WATERMARK_RE, '')
    .replace(UNCLOSED_SOURCE_WATERMARK_RE, '');
  return cleaned === text ? text : cleaned.replace(/\s+/g, ' ').trim();
}

function cleanQuestions(value, cloudPath) {
  const changes = [];
  const visit = (node) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (node._id && typeof node.prompt === 'string' && node.options && typeof node.options === 'object') {
      const fields = [['prompt', node]];
      for (const key of ['A', 'B', 'C', 'D']) fields.push([key, node.options, `options.${key}`]);
      fields.forEach(([key, owner, field = key]) => {
        const oldValue = owner[key];
        const newValue = stripSourceWatermarks(oldValue);
        if (newValue === oldValue) return;
        owner[key] = newValue;
        changes.push({
          _id: node._id,
          field,
          oldValue,
          newValue,
          oldValueHash: sha256(String(oldValue)),
          newValueHash: sha256(String(newValue))
        });
      });
    }
    Object.values(node).forEach(visit);
  };
  visit(value);
  return changes.map((item) => ({ cloudPath, ...item }));
}

function topicIds(byTopic) {
  const groups = Array.isArray(byTopic) ? byTopic : [];
  return groups.map((group) => String(group.topicId || '')).filter(Boolean);
}

async function loadDataset(dataset) {
  const primaryPaths = [
    `${dataset.cloudRoot}/grammar-topic-types.json`,
    `${dataset.cloudRoot}/shanghai-em2-grammar-by-topic.json`,
    `${dataset.cloudRoot}/shanghai-em2-grammar-questions.json`
  ];
  const primary = await Promise.all(primaryPaths.map(download));
  const byTopic = primary.find((item) => item.cloudPath.endsWith('shanghai-em2-grammar-by-topic.json'));
  const topics = await Promise.all(topicIds(byTopic.value).map((topicId) => {
    const fileName = `${sha1(topicId)}.json`;
    return download(`${dataset.cloudRoot}/topics/${fileName}`);
  }));
  return [...primary, ...topics];
}

async function verify(cloudPath, expectedHash) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await request(cloudPath);
    if (response.statusCode === 200 && sha256(response.body) === expectedHash) return;
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new Error(`grammar-clean-verify-failed:${cloudPath}`);
}

async function main() {
  const apply = process.argv.includes('--apply');
  if (apply && !process.argv.includes('--confirm-grammar-watermark-fix')) {
    throw new Error('missing --confirm-grammar-watermark-fix');
  }
  const datasets = await Promise.all(DATASETS.map(loadDataset));
  const files = datasets.flat();
  const changes = [];
  const changedFiles = [];
  files.forEach((file) => {
    const fileChanges = cleanQuestions(file.value, file.cloudPath);
    if (!fileChanges.length) return;
    const newBody = Buffer.from(`${JSON.stringify(file.value, null, 2)}\n`);
    changes.push(...fileChanges);
    changedFiles.push({
      cloudPath: file.cloudPath,
      oldBody: file.body,
      oldHash: sha256(file.body),
      newBody,
      newHash: sha256(newBody),
      changedFields: fileChanges.length
    });
  });
  const uniqueQuestionIds = [...new Set(changes.map((item) => item._id))].sort();
  const report = {
    schemaVersion: 1,
    mode: apply ? 'apply' : 'dry-run',
    envId: appConfig.cloudEnvId,
    reason: 'remove_source_watermarks_from_grammar_prompt_options',
    scannedFiles: files.length,
    changedFiles: changedFiles.length,
    changedQuestionCount: uniqueQuestionIds.length,
    changedFieldOccurrences: changes.length,
    questionIds: uniqueQuestionIds,
    files: changedFiles.map(({ cloudPath, oldHash, newHash, changedFields }) => ({
      cloudPath,
      oldHash,
      newHash,
      changedFields
    })),
    changes
  };
  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(ROOT, 'data', 'cloud-backups', `grammar-source-clean-${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  changedFiles.forEach((file) => {
    const backupPath = path.join(backupDir, file.cloudPath.replace(/^_content\//, ''));
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.writeFileSync(backupPath, file.oldBody);
  });
  fs.writeFileSync(path.join(backupDir, 'clean-report.json'), `${JSON.stringify(report, null, 2)}\n`);

  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials() });
  for (const file of changedFiles) {
    await app.uploadFile({ cloudPath: file.cloudPath, fileContent: file.newBody });
    await verify(file.cloudPath, file.newHash);
  }
  console.log(JSON.stringify({
    ...report,
    backupDir: path.relative(ROOT, backupDir),
    uploadedFiles: changedFiles.length,
    verifiedFiles: changedFiles.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
