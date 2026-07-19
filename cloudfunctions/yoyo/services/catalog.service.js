const crypto = require('crypto');
const https = require('https');
const { CLOUD_ASSET_BASE_URL } = require('../lib/constants');

const MATERIAL_PATHS = {
  writingEm1: '_content/writing-em1/writing-prompts.json',
  writingEm2: '_content/writing-em2/writing-prompts.json',
  writingSeniorSpring: '_content/writing-senior-spring/writing-prompts.json',
  writingSeniorAutumn: '_content/writing-senior-autumn/writing-prompts.json',
  listeningEm1: '_content/listening-em1/listening-practice.json',
  listeningEm2: '_content/listening-em2/listening-practice.json',
  listeningSeniorSpring: '_content/listening-senior-spring/listening-practice.json',
  listeningSeniorAutumn: '_content/listening-senior-autumn/listening-practice.json'
};
const MATERIAL_ITEM_DIRS = {
  writingEm1: '_content/writing-em1/items-v1',
  writingEm2: '_content/writing-em2/items-v1',
  listeningEm1: '_content/listening-em1/items-v1',
  listeningEm2: '_content/listening-em2/items-v1',
  writingSeniorSpring: '_content/writing-senior-spring/items-v1',
  writingSeniorAutumn: '_content/writing-senior-autumn/items-v1',
  listeningSeniorSpring: '_content/listening-senior-spring/items-v1',
  listeningSeniorAutumn: '_content/listening-senior-autumn/items-v1'
};

let bundledMaterialIndex = null;
const materialItemCache = {};
const MATERIAL_ITEM_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

function getResourceDebugSnapshot() {
  return require('./shared.service').getResourceDebugSnapshot();
}

async function loadList(path) {
  try {
    const content = await require('../adapters/storage.adapter').downloadCloudJson(path);
    return Array.isArray(content) ? content : (content.items || content.prompts || content.sets || []);
  } catch (error) {
    return [];
  }
}

function slimWritingItem(item) {
  return {
    _id: item && item._id,
    id: item && item.id,
    title: item && item.title,
    year: item && item.year,
    city: item && item.city,
    district: item && item.district,
    examType: item && item.examType,
    stage: item && item.stage,
    category: item && item.category,
    contentType: item && item.contentType,
    contentRevision: item && item.contentRevision,
    paperId: item && item.paperId,
    paperOrder: item && item.paperOrder,
    questionCount: item && item.questionCount,
    minWords: item && item.minWords,
    maxWords: item && item.maxWords,
    score: item && item.score
  };
}

function slimMaterialItem(item) {
  return {
    _id: item && item._id,
    id: item && item.id,
    title: item && item.title,
    year: item && item.year,
    sourceYear: item && item.sourceYear,
    district: item && item.district,
    examType: item && item.examType,
    stage: item && item.stage,
    audioUrl: item && item.audioUrl,
    audioCloudPath: item && item.audioCloudPath,
    audioFileId: item && item.audioFileId,
    audioSource: item && item.audioSource,
    durationSec: Number(item && item.durationSec || 0),
    hasAudio: !!(item && item.hasAudio),
    hasTranscript: !!(item && item.hasTranscript)
  };
}

function loadBundledMaterialIndex() {
  if (bundledMaterialIndex) return bundledMaterialIndex;
  try {
    const raw = require('../data/material-directory.json');
    bundledMaterialIndex = {
      writingEm1: (raw.writingEm1 || []).map(slimWritingItem),
      writingEm2: (raw.writingEm2 || []).map(slimWritingItem),
      writingSeniorSpring: (raw.writingSeniorSpring || []).map(slimWritingItem),
      writingSeniorAutumn: (raw.writingSeniorAutumn || []).map(slimWritingItem),
      listeningEm1: (raw.listeningEm1 || []).map(slimMaterialItem),
      listeningEm2: (raw.listeningEm2 || []).map(slimMaterialItem),
      listeningSeniorSpring: (raw.listeningSeniorSpring || []).map(slimMaterialItem),
      listeningSeniorAutumn: (raw.listeningSeniorAutumn || []).map(slimMaterialItem)
    };
  } catch (error) {
    bundledMaterialIndex = null;
  }
  return bundledMaterialIndex;
}

function materialItemFileName(itemId) {
  return `${crypto.createHash('sha1').update(String(itemId || '')).digest('hex')}.json`;
}

function materialKeysFor(moduleId, itemId) {
  const prefix = moduleId === 'listening' ? 'listening' : 'writing';
  if (/^sh-em1-/i.test(itemId)) return [`${prefix}Em1`];
  if (/^sh-em2-/i.test(itemId)) return [`${prefix}Em2`];
  if (/^sh-spring-/i.test(itemId)) return [`${prefix}SeniorSpring`];
  if (/^sh-autumn-/i.test(itemId)) return [`${prefix}SeniorAutumn`];
  return [`${prefix}Em1`, `${prefix}Em2`, `${prefix}SeniorSpring`, `${prefix}SeniorAutumn`];
}

function matchesMaterialId(item, itemId) {
  return !!(item && [item._id, item.id, item.audioCloudPath, item.title]
    .some((value) => String(value || '').trim() === itemId));
}

function applyMaterialContentPatches(item) {
  if (!item || item._id !== 'sh-autumn-2010-translation') return item;
  const directions = String(item.directions || '').trim();
  if (!/\bin the$/i.test(directions)) return item;
  return Object.assign({}, item, { directions: `${directions} brackets.` });
}

function downloadMaterialItemJson(cloudPath) {
  const baseUrl = String(CLOUD_ASSET_BASE_URL || '').replace(/\/+$/, '');
  const url = encodeURI(`${baseUrl}/${cloudPath}`);
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`material-item-http-${response.statusCode || 0}`));
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
    });
    request.setTimeout(3000, () => request.destroy(new Error('material-item-timeout')));
    request.on('error', reject);
  });
}

async function loadMaterialItemJson(cloudPath) {
  try {
    return await downloadMaterialItemJson(cloudPath);
  } catch (error) {
    return require('../adapters/storage.adapter').downloadCloudJson(cloudPath, { skipCdn: true });
  }
}

async function loadMaterialItem(moduleId, itemId) {
  const cached = materialItemCache[itemId];
  if (cached && Date.now() - cached.savedAt < MATERIAL_ITEM_CACHE_MAX_AGE_MS) return cached.item;
  const fileName = materialItemFileName(itemId);
  const keys = materialKeysFor(moduleId, itemId);
  const candidates = await Promise.all(keys.map(async (key) => {
    try {
      return await loadMaterialItemJson(`${MATERIAL_ITEM_DIRS[key]}/${fileName}`);
    } catch (error) {
      return null;
    }
  }));
  const item = applyMaterialContentPatches(candidates.find((candidate) => matchesMaterialId(candidate, itemId)) || null);
  if (item) materialItemCache[itemId] = { savedAt: Date.now(), item };
  return item;
}

async function getMaterialIndex(event) {
  const moduleId = String((event && event.payload && event.payload.moduleId) || '').trim();
  const shouldLoadWriting = !moduleId || moduleId === 'writing';
  const shouldLoadListening = !moduleId || moduleId === 'listening';
  const bundled = loadBundledMaterialIndex();
  if (bundled) {
    return {
      writingEm1: shouldLoadWriting ? bundled.writingEm1 : [],
      writingEm2: shouldLoadWriting ? bundled.writingEm2 : [],
      writingSeniorSpring: shouldLoadWriting ? bundled.writingSeniorSpring : [],
      writingSeniorAutumn: shouldLoadWriting ? bundled.writingSeniorAutumn : [],
      listeningEm1: shouldLoadListening ? bundled.listeningEm1 : [],
      listeningEm2: shouldLoadListening ? bundled.listeningEm2 : [],
      listeningSeniorSpring: shouldLoadListening ? bundled.listeningSeniorSpring : [],
      listeningSeniorAutumn: shouldLoadListening ? bundled.listeningSeniorAutumn : []
    };
  }
  const [writingEm1, writingEm2, writingSeniorSpring, writingSeniorAutumn, listeningEm1, listeningEm2, listeningSeniorSpring, listeningSeniorAutumn] = await Promise.all([
    shouldLoadWriting ? loadList(MATERIAL_PATHS.writingEm1) : [],
    shouldLoadWriting ? loadList(MATERIAL_PATHS.writingEm2) : [],
    shouldLoadWriting ? loadList(MATERIAL_PATHS.writingSeniorSpring) : [],
    shouldLoadWriting ? loadList(MATERIAL_PATHS.writingSeniorAutumn) : [],
    shouldLoadListening ? loadList(MATERIAL_PATHS.listeningEm1) : [],
    shouldLoadListening ? loadList(MATERIAL_PATHS.listeningEm2) : [],
    shouldLoadListening ? loadList(MATERIAL_PATHS.listeningSeniorSpring) : [],
    shouldLoadListening ? loadList(MATERIAL_PATHS.listeningSeniorAutumn) : []
  ]);
  return {
    writingEm1: writingEm1.map(slimWritingItem),
    writingEm2: writingEm2.map(slimWritingItem),
    writingSeniorSpring: writingSeniorSpring.map(slimWritingItem),
    writingSeniorAutumn: writingSeniorAutumn.map(slimWritingItem),
    listeningEm1: listeningEm1.map(slimMaterialItem),
    listeningEm2: listeningEm2.map(slimMaterialItem),
    listeningSeniorSpring: listeningSeniorSpring.map(slimMaterialItem),
    listeningSeniorAutumn: listeningSeniorAutumn.map(slimMaterialItem)
  };
}

async function getMaterialItem(event) {
  const payload = (event && event.payload) || {};
  const moduleId = String(payload.moduleId || '').trim();
  const rawItemId = String(payload.itemId || '').trim();
  let itemId = rawItemId;
  try {
    itemId = decodeURIComponent(rawItemId);
  } catch (error) {
    itemId = rawItemId;
  }
  if (!itemId) {
    return { item: null };
  }
  const directItem = await loadMaterialItem(moduleId, itemId);
  if (directItem) {
    return { item: directItem };
  }
  const paths = moduleId === 'listening'
    ? [MATERIAL_PATHS.listeningEm1, MATERIAL_PATHS.listeningEm2, MATERIAL_PATHS.listeningSeniorSpring, MATERIAL_PATHS.listeningSeniorAutumn]
    : [MATERIAL_PATHS.writingEm1, MATERIAL_PATHS.writingEm2, MATERIAL_PATHS.writingSeniorSpring, MATERIAL_PATHS.writingSeniorAutumn];
  const lists = await Promise.all(paths.map(loadList));
  const item = lists.flat().find((row) => row && [
    row._id,
    row.id,
    row.audioCloudPath,
    row.title
  ].some((value) => String(value || '').trim() === itemId)) || null;
  return { item };
}

module.exports = {
  getResourceDebugSnapshot,
  getMaterialIndex,
  getMaterialItem
};
