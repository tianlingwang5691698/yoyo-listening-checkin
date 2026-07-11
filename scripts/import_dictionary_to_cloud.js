#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const appConfig = require('../app-config');

let cloudbase;
try {
  cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
} catch (error) {
  cloudbase = require('@cloudbase/node-sdk');
}

const ROOT = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'data', 'dictionary-import', 'output');
const COLLECTION = 'wordDictionary';
const LEVELS = ['junior', 'senior'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeDoc(entry) {
  const wordLower = String(entry.wordLower || entry.word || '').trim().toLowerCase();
  return {
    word: String(entry.word || wordLower).trim(),
    wordLower,
    level: String(entry.level || '').trim(),
    phonetic: String(entry.phonetic || '').trim(),
    definitions: Array.isArray(entry.definitions) ? entry.definitions.filter(Boolean) : [],
    example: String(entry.example || '').trim(),
    source: entry.source || 'local-import',
    updatedAt: new Date().toISOString()
  };
}

async function ensureCollection(db) {
  try {
    await db.collection(COLLECTION).limit(1).get();
  } catch (error) {
    throw new Error(`collection ${COLLECTION} is not ready; create it in CloudBase console first. ${error.message || error}`);
  }
}

async function upsertBatch(db, docs, apply) {
  let inserted = 0;
  let updated = 0;
  for (const doc of docs) {
    const currentResult = await db.collection(COLLECTION)
      .where({ wordLower: doc.wordLower, level: doc.level })
      .limit(1)
      .get();
    const current = currentResult && currentResult.data && currentResult.data[0];
    if (!apply) {
      if (current && current._id) updated += 1;
      else inserted += 1;
      continue;
    }
    if (current && current._id) {
      await db.collection(COLLECTION).doc(current._id).update({ data: doc });
      updated += 1;
    } else {
      await db.collection(COLLECTION).add({
        data: Object.assign({}, doc, { createdAt: doc.updatedAt })
      });
      inserted += 1;
    }
  }
  return { inserted, updated };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const onlyArg = process.argv.find((arg) => arg.startsWith('--level='));
  const levels = onlyArg ? [onlyArg.split('=')[1]].filter((level) => LEVELS.includes(level)) : LEVELS;
  if (!levels.length) {
    throw new Error('level must be junior or senior');
  }

  const app = cloudbase.init({
    env: appConfig.cloudEnvId
  });
  const db = app.database();
  await ensureCollection(db);

  const result = {};
  for (const level of levels) {
    const filePath = path.join(OUTPUT_DIR, `word-dictionary-${level}.json`);
    const docs = readJson(filePath).map(normalizeDoc).filter((doc) => doc.wordLower && doc.level);
    result[level] = Object.assign({ total: docs.length }, await upsertBatch(db, docs, apply));
  }

  console.log(JSON.stringify({
    envId: appConfig.cloudEnvId,
    collection: COLLECTION,
    mode: apply ? 'apply' : 'dry-run',
    result
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
