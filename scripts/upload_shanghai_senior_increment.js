#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
const appConfig = require('../app-config');

const ROOT = path.join(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'data', 'imports', 'shanghai-senior-1990-2023', 'formal');
const MODULES = [
  ['reading-senior-spring', 'reading-passages.json'],
  ['reading-senior-autumn', 'reading-passages.json'],
  ['writing-senior-spring', 'writing-prompts.json'],
  ['writing-senior-autumn', 'writing-prompts.json'],
  ['listening-senior-spring', 'listening-practice.json'],
  ['listening-senior-autumn', 'listening-practice.json']
];
const GRAMMAR_MODULES = ['grammar-senior-spring', 'grammar-senior-autumn'];

function sha1(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
}

function itemFileName(id) {
  return `${sha1(Buffer.from(String(id || '')))}.json`;
}

function credentials() {
  const rows = fs.readFileSync(path.join(ROOT, 'SecretKey.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const values = rows[1].split(',').map((value) => value.trim());
  return { secretId: values[0], secretKey: values[1] };
}

function request(cloudPath, method = 'GET') {
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  const url = encodeURI(`${baseUrl}/${cloudPath}`);
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ statusCode: response.statusCode || 0, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(10000, () => req.destroy(new Error(`request-timeout:${cloudPath}`)));
    req.on('error', reject);
    req.end();
  });
}

function addFile(entries, localPath, cloudPath) {
  const body = fs.readFileSync(localPath);
  entries.push({ localPath, cloudPath, body, sha1: sha1(body) });
}

function addJson(entries, localPath, cloudPath, value) {
  const body = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  entries.push({ localPath, cloudPath, body, sha1: sha1(body) });
}

function buildEntries(selectedSessions, selectedYears, selectedModules = new Set(['reading', 'writing', 'listening', 'grammar'])) {
  const entries = [];
  MODULES.filter(([moduleName]) => selectedSessions.has(moduleName.endsWith('-spring') ? 'spring' : 'autumn')
    && selectedModules.has(moduleName.split('-')[0])).forEach(([moduleName, fileName]) => {
    const localPath = path.join(ROOT, 'data', moduleName, fileName);
    const items = JSON.parse(fs.readFileSync(localPath, 'utf8'));
    const selectedItems = items.filter((item) => !selectedYears.size || selectedYears.has(Number(item.year || item.sourceYear)));
    const years = Array.from(new Set(selectedItems.map((item) => Number(item.year || item.sourceYear)))).sort();
    years.forEach((year) => {
      const yearItems = selectedItems.filter((item) => Number(item.year || item.sourceYear) === year);
      const revision = Math.max(1, ...yearItems.map((item) => Number(item.contentRevision || (String(item._id || '').match(/-v(\d+)$/) || [])[1] || 1)));
      const yearRoot = `_content/${moduleName}/years/${year}${revision > 1 ? `/v${revision}` : ''}`;
      addJson(entries, `${localPath}#${year}`, `${yearRoot}/${fileName}`, yearItems);
    });
    const referencedAudio = new Set(selectedItems.map((item) => path.basename(String(item.audioCloudPath || ''))).filter(Boolean));
    if (moduleName.startsWith('writing-') || moduleName.startsWith('listening-')) {
      selectedItems.forEach((item) => {
        const id = String(item && (item._id || item.id) || '').trim();
        if (!id) throw new Error(`missing-item-id:${moduleName}`);
        const body = Buffer.from(JSON.stringify(item));
        entries.push({
          localPath: `${localPath}#${id}`,
          cloudPath: `_content/${moduleName}/items-v1/${itemFileName(id)}`,
          body,
          sha1: sha1(body)
        });
      });
    }
    if (moduleName.startsWith('writing-') || moduleName.startsWith('reading-')) {
      const seenImages = new Set();
      selectedItems.flatMap((item) => [
        ...(Array.isArray(item.images) ? item.images : []),
        ...(Array.isArray(item.questions) ? item.questions.flatMap((question) => Object.values(question.optionImages || {})) : [])
      ]).forEach((image) => {
        const cloudPath = String(image && image.cloudPath || '').trim();
        const localRelativePath = String(image && image.localPath || '').trim();
        if (!cloudPath || !localRelativePath || seenImages.has(cloudPath)) return;
        if (!cloudPath.startsWith(`_content/${moduleName}/years/`)) {
          throw new Error(`content-image-path-invalid:${cloudPath}`);
        }
        addFile(entries, path.join(ROOT, localRelativePath), cloudPath);
        seenImages.add(cloudPath);
      });
    }
    if (moduleName.startsWith('listening-')) {
      const audioDir = path.join(ROOT, 'data', moduleName, 'audio');
      if (fs.existsSync(audioDir)) {
        fs.readdirSync(audioDir).filter((name) => referencedAudio.has(name)).sort().forEach((name) => {
          addFile(entries, path.join(audioDir, name), `_content/${moduleName}/audio/${name}`);
        });
      }
    }
  });
  GRAMMAR_MODULES.filter((moduleName) => selectedModules.has('grammar') && selectedSessions.has(moduleName.endsWith('-spring') ? 'spring' : 'autumn')).forEach((moduleName) => {
    const moduleDir = path.join(ROOT, 'data', moduleName);
    const selectedYearList = Array.from(selectedYears).sort();
    const selectedYearDir = selectedYearList.length === 1 ? path.join(moduleDir, 'years', String(selectedYearList[0])) : '';
    const sourceDir = selectedYearDir && fs.existsSync(path.join(selectedYearDir, 'shanghai-senior-grammar-questions.json')) ? selectedYearDir : moduleDir;
    const questions = JSON.parse(fs.readFileSync(path.join(sourceDir, 'shanghai-senior-grammar-questions.json'), 'utf8'));
    const years = Array.from(new Set(questions.map((item) => Number(item.year)).filter((year) => !selectedYears.size || selectedYears.has(year)))).sort();
    if (!years.length) return;
    if (years.length !== 1 || questions.some((item) => Number(item.year) !== years[0])) {
      throw new Error(`grammar-upload-requires-one-clean-year:${moduleName}`);
    }
    const revision = Math.max(1, ...questions.map((item) => Number(item.classificationRevision || 1)));
    const cloudRoot = `_content/${moduleName}/years/${years[0]}${revision > 1 ? `/v${revision}` : ''}`;
    ['grammar-topic-types.json', 'shanghai-senior-grammar-by-topic.json', 'shanghai-senior-grammar-questions.json']
      .forEach((name) => addFile(entries, path.join(sourceDir, name), `${cloudRoot}/${name}`));
    const topicsDir = path.join(sourceDir, 'topics');
    fs.readdirSync(topicsDir).filter((name) => name.endsWith('.json')).sort().forEach((name) => {
      addFile(entries, path.join(topicsDir, name), `${cloudRoot}/topics/${name}`);
    });
  });
  const duplicates = entries.filter((entry, index) => entries.findIndex((row) => row.cloudPath === entry.cloudPath) !== index);
  if (duplicates.length) throw new Error(`duplicate-cloud-path:${duplicates[0].cloudPath}`);
  return entries;
}

async function mapLimit(items, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const sessionArg = process.argv.find((value) => value.startsWith('--sessions='));
  const selectedSessions = new Set((sessionArg ? sessionArg.slice('--sessions='.length) : 'spring,autumn').split(',').filter((value) => ['spring', 'autumn'].includes(value)));
  const yearsArg = process.argv.find((value) => value.startsWith('--years='));
  const selectedYears = new Set((yearsArg ? yearsArg.slice('--years='.length) : '').split(',').filter(Boolean).map(Number));
  const modulesArg = process.argv.find((value) => value.startsWith('--modules='));
  const selectedModules = new Set((modulesArg ? modulesArg.slice('--modules='.length) : 'reading,writing,listening,grammar').split(',').filter((value) => ['reading', 'writing', 'listening', 'grammar'].includes(value)));
  if (!selectedSessions.size) throw new Error('no-valid-session-selected');
  if (!selectedModules.size) throw new Error('no-valid-module-selected');
  const entries = buildEntries(selectedSessions, selectedYears, selectedModules);
  const results = [];
  await mapLimit(entries, 8, async (entry) => {
    const remote = await request(entry.cloudPath);
    if (remote.statusCode === 404) {
      results.push({ cloudPath: entry.cloudPath, action: 'add', bytes: entry.body.length, sha1: entry.sha1 });
      return;
    }
    if (remote.statusCode !== 200) throw new Error(`remote-status-${remote.statusCode}:${entry.cloudPath}`);
    const remoteSha1 = sha1(remote.body);
    if (remoteSha1 !== entry.sha1) throw new Error(`immutable-path-conflict:${entry.cloudPath}:${remoteSha1}:${entry.sha1}`);
    results.push({ cloudPath: entry.cloudPath, action: 'reuse', bytes: entry.body.length, sha1: entry.sha1 });
  });
  results.sort((a, b) => a.cloudPath.localeCompare(b.cloudPath));
  const summary = {
    mode: apply ? 'preflight-before-apply' : 'dry-run',
    total: results.length,
    add: results.filter((item) => item.action === 'add').length,
    reuse: results.filter((item) => item.action === 'reuse').length,
    conflict: 0,
    missing: 0,
    results
  };
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'upload-preflight.json'), `${JSON.stringify(summary, null, 2)}\n`);
  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', total: summary.total, add: summary.add, reuse: summary.reuse }, null, 2));
    return;
  }
  const app = cloudbase.init(Object.assign({ env: appConfig.cloudEnvId }, credentials()));
  const additions = entries.filter((entry) => results.find((item) => item.cloudPath === entry.cloudPath).action === 'add');
  await mapLimit(additions, 5, async (entry) => {
    await app.uploadFile({ cloudPath: entry.cloudPath, fileContent: entry.body });
  });
  const verified = [];
  await mapLimit(entries, 8, async (entry) => {
    const remote = await request(entry.cloudPath);
    if (remote.statusCode !== 200 || sha1(remote.body) !== entry.sha1) {
      throw new Error(`post-upload-verify-failed:${entry.cloudPath}:${remote.statusCode}`);
    }
    verified.push(entry.cloudPath);
  });
  const report = { mode: 'apply', total: entries.length, added: additions.length, reused: entries.length - additions.length, verified: verified.length };
  fs.writeFileSync(path.join(REPORT_DIR, 'upload-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
