const cloud = require('wx-server-sdk');
const { peppaTranscriptBuildStatus } = require('../transcripts/peppa_build_status');
const { getWXContext } = require('../adapters/wx-context.adapter');
const userRepository = require('../repositories/user.repository');
const familyRepository = require('../repositories/family.repository');
const childRepository = require('../repositories/child.repository');
const progressRepository = require('../repositories/progress.repository');
const checkinRepository = require('../repositories/checkin.repository');
const reportRepository = require('../repositories/report.repository');
const subscriptionRepository = require('../repositories/subscription.repository');
const trainingPoolRepository = require('../repositories/training-pool.repository');
const storageAdapter = require('../adapters/storage.adapter');
const transcriptAdapter = require('../adapters/transcript.adapter');
const dateLib = require('../lib/china-date');
const taskPresenter = require('../lib/task-presenter');
const identityLib = require('../lib/identity');
const planLib = require('../lib/plan-runtime');
const taskEngine = require('../lib/task-engine');
const planEngine = require('../lib/plan-engine');
const checkinEngine = require('../lib/checkin-engine');
const reportEngine = require('../lib/report-engine');
const dashboardEngine = require('../lib/dashboard-engine');
const levelEngine = require('../lib/level-engine');
const requestContextEngine = require('../lib/request-context-engine');
const monitor = require('../lib/monitor');
const familyEngine = require('../lib/family-engine');
const bootstrapEngine = require('../lib/bootstrap-engine');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const CLOUD_ENV_ID_RAW = process.env.TCB_ENV || process.env.SCF_NAMESPACE || cloud.DYNAMIC_CURRENT_ENV;
const CLOUD_ENV_ID = typeof CLOUD_ENV_ID_RAW === 'string' ? CLOUD_ENV_ID_RAW : '';
const CLOUD_ASSET_BASE_URL = 'https://796f-youshengenglish-6glk12rd6c6e719b-1419984942.tcb.qcloud.la';
const CLOUD_BUCKET = '796f-youshengenglish-6glk12rd6c6e719b-1419984942';
const NEW_CONCEPT1_AUDIO_ROOT = 'A1/NewConcept1-US';
const NEW_CONCEPT2_AUDIO_ROOT = 'A2/NewConcept2-US';
const NEW_CONCEPT3_AUDIO_ROOT = 'B1/NewConcept3-US';
const NEW_CONCEPT4_AUDIO_ROOT = 'B2/NewConcept4-US';
const UNLOCK1_AUDIO_ROOT = 'A1/Unlock1/Unlock1 听口音频Class Audio';
const UNLOCK1_SCRIPT_PATH = `${UNLOCK1_AUDIO_ROOT}/Unlock 2e Listening and Speaking 1 Scripts.pdf`;
const UNLOCK1_TRAINING_POOL_COLLECTION = 'unlock1AudioTrainingPool';
const UNLOCK1_MIN_DURATION_SEC = 60;
const STORAGE_ROOTS = {
  newconcept1: NEW_CONCEPT1_AUDIO_ROOT,
  newconcept2: NEW_CONCEPT2_AUDIO_ROOT,
  newconcept3: NEW_CONCEPT3_AUDIO_ROOT,
  newconcept4: NEW_CONCEPT4_AUDIO_ROOT,
  peppa: 'A1/Peppa',
  unlock1: UNLOCK1_AUDIO_ROOT,
  song: 'A1/Super simple songs'
};
const STORAGE_ROOT_CANDIDATES = {
  newconcept1: [NEW_CONCEPT1_AUDIO_ROOT, 'A1/NewConcept1', 'A1/New Concept 1', 'A1/new-concept-1-us'],
  newconcept2: [NEW_CONCEPT2_AUDIO_ROOT, 'A2/NewConcept2', 'A2/New Concept 2', 'A2/new-concept-2-us', 'A2/Newconcept2'],
  newconcept3: [NEW_CONCEPT3_AUDIO_ROOT, 'B1/NewConcept3', 'B1/New Concept 3', 'B1/new-concept-3-us', 'B1/Newconcept3'],
  newconcept4: ['B2/NewConcept3-US/新概念英语（第4册）美音（MP3+LRC）', NEW_CONCEPT4_AUDIO_ROOT, 'B2/NewConcept4', 'B2/New Concept 4', 'B2/new-concept-4-us', 'B2/Newconcept4', 'B2/NewConcept3-US'],
  peppa: [STORAGE_ROOTS.peppa],
  unlock1: [UNLOCK1_AUDIO_ROOT, 'A1/Unlock1'],
  song: [STORAGE_ROOTS.song, 'A1/Super simple song']
};
const REQUIRED_COLLECTIONS = [
  'users',
  'families',
  'familyMembers',
  'children',
  'dailyTaskProgress',
  'dailyCheckins',
  'dailyReports',
  'subscriptionPreferences'
];
const TEMP_URL_TTL = 24 * 60 * 60;
const AUDIO_FILE_PATTERN = /\.(mp3|m4a|aac|wav)$/i;
const TRANSCRIPT_BUNDLE_TTL_MS = 5 * 60 * 1000;
const TRANSCRIPT_BUNDLE_PATHS = {
  newconcept1: ['_transcripts/A1/new-concept-1-us-line/bundle.json', '_transcripts/A1/new-concept-1-us/bundle.json', '_transcripts/A1/newconcept1-us/bundle.json'],
  newconcept2: ['_transcripts/A2/new-concept-2-us-line/bundle.json', '_transcripts/A2/new-concept-2-us/bundle.json', '_transcripts/A2/new-concept-2/bundle.json', '_transcripts/A2/newconcept2/bundle.json'],
  newconcept3: ['_transcripts/B1/new-concept-3-us-line/bundle.json', '_transcripts/B1/new-concept-3-us/bundle.json', '_transcripts/B1/newconcept3/bundle.json'],
  newconcept4: ['_transcripts/B2/new-concept-4-us-line/bundle.json', '_transcripts/B2/new-concept-4-us/bundle.json', '_transcripts/B2/newconcept4/bundle.json'],
  peppa: ['_transcripts/A1/peppa/bundle.json'],
  unlock1: ['_transcripts/A1/unlock1/bundle.json'],
  song: ['_transcripts/A1/songs/bundle.json']
};
let runtimeCatalogs = null;
let runtimeCatalogExpiresAt = 0;
let runtimeCatalogDebug = null;
let runtimeTranscriptTrackMaps = {};
let runtimeTranscriptTrackMapExpiresAt = {};
let runtimeTranscriptTrackDebug = {};
let storageManager = null;
let storageDebugShapes = {};
let unlock1TrainingPoolBootstrapState = {
  lastTriggeredAt: 0,
  lastFinishedAt: 0,
  lastResult: '',
  lastError: '',
  lastMode: '',
  lastStats: null
};

function buildCloudAssetUrl(cloudPath) {
  return storageAdapter.buildCloudAssetUrl(cloudPath);
}

function buildCloudFileId(cloudPath) {
  return storageAdapter.buildCloudFileId(cloudPath);
}

function isMissingCollectionError(error) {
  const message = String((error && (error.errMsg || error.message)) || '');
  return message.includes('DATABASE_COLLECTION_NOT_EXIST')
    || message.includes('database collection not exists')
    || message.includes('collection.get:fail')
    || message.includes('collection.where:fail')
    || message.includes('collection.add:fail')
    || message.includes('collection.doc:fail');
}

function createMissingCollectionsError(missingCollections) {
  const missing = missingCollections.filter(Boolean);
  const message = [
    `cloud-env-not-ready: 当前云环境 ${CLOUD_ENV_ID || 'unknown'} 缺少数据库集合`,
    missing.join(', '),
    '请先在 CloudBase 控制台手动创建这些空集合，再重新部署 yoyo 并刷新首页。'
  ].join(' | ');
  const error = new Error(message);
  error.code = 'cloud-env-not-ready';
  error.missingCollections = missing;
  error.envId = CLOUD_ENV_ID || '';
  return error;
}

async function checkCollectionReady(collectionName) {
  try {
    await require('../adapters/db.adapter').collection(collectionName).limit(1).get();
    return true;
  } catch (error) {
    if (isMissingCollectionError(error)) {
      return false;
    }
    throw error;
  }
}

async function ensureRequiredCollectionsReady() {
  const results = await Promise.all(REQUIRED_COLLECTIONS.map(async (collectionName) => ({
    collectionName,
    ready: await checkCollectionReady(collectionName)
  })));
  const missingCollections = results.filter((item) => !item.ready).map((item) => item.collectionName);
  if (missingCollections.length) {
    throw createMissingCollectionsError(missingCollections);
  }
}

const childTemplate = {
  childId: 'child-yoyo',
  nickname: '佑佑',
  avatarText: 'YY',
  currentLevel: 'A1',
  ageLabel: '启蒙阶段',
  welcomeLine: '今天听三遍，小耳朵慢慢就会越来越灵。'
};

const level = {
  levelId: 'A1',
  name: 'A1 纯音频听力',
  description: '每天三项音频任务，前两遍盲听，第三遍再看文本。'
};

const peppaDurationOverrides = {
  'S101 Muddy Puddles': 311
};

const peppaTasks = peppaTranscriptBuildStatus.map((item, index) => ({
  taskId: item.taskId || `peppa-${index + 1}`,
  category: 'peppa',
  title: item.fileName,
  subtitle: 'Peppa Pig Season 1',
  audioUrl: buildCloudAssetUrl(`A1/Peppa/第1季/${item.fileName}.mp3`),
  audioCloudPath: `A1/Peppa/第1季/${item.fileName}.mp3`,
  audioFileId: buildCloudFileId(`A1/Peppa/第1季/${item.fileName}.mp3`),
  audioSource: 'static-cloud-url',
  repeatTarget: 3,
  durationSec: peppaDurationOverrides[item.fileName] || 300,
  coverTone: 'sunrise',
  transcriptTrackId: item.trackId || null,
  textSource: {
    sourceType: 'pdf',
    title: 'Peppa Pig Season 1 Script',
    filePath: buildCloudAssetUrl('A1/Peppa/第1季/PeppaPig第1季英文剧本台词.pdf')
  }
}));

const unlockAudioFiles = [
  ['Unlock2e_A1_1.2', 85], ['Unlock2e_A1_1.5', 145], ['Unlock2e_A1_2.2', 120], ['Unlock2e_A1_2.3', 65],
  ['Unlock2e_A1_2.5', 132], ['Unlock2e_A1_3.3', 160], ['Unlock2e_A1_3.5', 156], ['Unlock2e_A1_3.6', 64],
  ['Unlock2e_A1_4.2', 163], ['Unlock2e_A1_4.3', 89], ['Unlock2e_A1_4.4', 165], ['Unlock2e_A1_4.9', 62],
  ['Unlock2e_A1_5.3', 158], ['Unlock2e_A1_5.6', 156], ['Unlock2e_A1_6.2', 215], ['Unlock2e_A1_6.5', 184],
  ['Unlock2e_A1_6.6', 93], ['Unlock2e_A1_7.2', 66], ['Unlock2e_A1_7.3', 200], ['Unlock2e_A1_7.4', 176],
  ['Unlock2e_A1_7.9', 68], ['Unlock2e_A1_8.3', 177], ['Unlock2e_A1_8.5', 159], ['Unlock2e_A1_8.6', 69]
];

const unlockTrackMap = {
  'unlock1-1': { trackId: 'track-unlock1-1-2', status: 'ready', batch: 1 },
  'unlock1-2': { trackId: 'track-unlock1-1-5', status: 'ready', batch: 1 },
  'unlock1-3': { trackId: 'track-unlock1-2-2', status: 'ready', batch: 1 },
  'unlock1-4': { trackId: 'track-unlock1-2-3', status: 'ready', batch: 1 },
  'unlock1-5': { trackId: 'track-unlock1-2-5', status: 'ready', batch: 1 },
  'unlock1-6': { trackId: 'track-unlock1-3-3', status: 'ready', batch: 1 },
  'unlock1-7': { trackId: 'track-unlock1-3-5', status: 'ready', batch: 2 },
  'unlock1-8': { trackId: 'track-unlock1-3-6', status: 'ready', batch: 2 },
  'unlock1-9': { trackId: 'track-unlock1-4-2', status: 'ready', batch: 2 },
  'unlock1-10': { trackId: 'track-unlock1-4-3', status: 'ready', batch: 2 },
  'unlock1-11': { trackId: 'track-unlock1-4-4', status: 'ready', batch: 2 },
  'unlock1-12': { trackId: 'track-unlock1-4-9', status: 'ready', batch: 2 },
  'unlock1-13': { trackId: 'track-unlock1-5-3', status: 'ready', batch: 3 },
  'unlock1-14': { trackId: 'track-unlock1-5-6', status: 'ready', batch: 3 },
  'unlock1-15': { trackId: 'track-unlock1-6-2', status: 'ready', batch: 3 },
  'unlock1-16': { trackId: 'track-unlock1-6-5', status: 'ready', batch: 3 },
  'unlock1-17': { trackId: 'track-unlock1-6-6', status: 'ready', batch: 3 },
  'unlock1-18': { trackId: 'track-unlock1-7-2', status: 'ready', batch: 3 },
  'unlock1-19': { trackId: 'track-unlock1-7-3', status: 'ready', batch: 4 },
  'unlock1-20': { trackId: 'track-unlock1-7-4', status: 'ready', batch: 4 },
  'unlock1-21': { trackId: 'track-unlock1-7-9', status: 'ready', batch: 4 },
  'unlock1-22': { trackId: 'track-unlock1-8-3', status: 'ready', batch: 4 },
  'unlock1-23': { trackId: 'track-unlock1-8-5', status: 'ready', batch: 4 },
  'unlock1-24': { trackId: 'track-unlock1-8-6', status: 'ready', batch: 4 }
};

const unlockTasks = unlockAudioFiles.map((item, index) => {
  const taskId = `unlock1-${index + 1}`;
  const transcriptMeta = unlockTrackMap[taskId] || { trackId: null, status: 'pending', batch: Math.floor(index / 6) + 1 };
  return {
    taskId,
    category: 'unlock1',
    title: item[0],
    subtitle: `Unlock 1 第 ${index + 1} 条`,
    audioUrl: buildCloudAssetUrl(`${UNLOCK1_AUDIO_ROOT}/${item[0]}.mp3`),
    audioCloudPath: `${UNLOCK1_AUDIO_ROOT}/${item[0]}.mp3`,
    audioFileId: buildCloudFileId(`${UNLOCK1_AUDIO_ROOT}/${item[0]}.mp3`),
    audioSource: 'static-cloud-url',
    repeatTarget: 3,
    durationSec: item[1],
    coverTone: index % 2 === 0 ? 'peach' : 'berry',
    transcriptTrackId: transcriptMeta.trackId,
    transcriptStatus: transcriptMeta.status,
    transcriptBatch: transcriptMeta.batch,
    textSource: {
      sourceType: 'pdf',
      title: 'Unlock 2e Listening and Speaking 1 Scripts',
      filePath: buildCloudAssetUrl(UNLOCK1_SCRIPT_PATH)
    }
  };
});

const songTasks = [];
const songPlaceholder = {
  taskId: 'song-pending',
  category: 'song',
  title: 'Daily Song',
  subtitle: '检查云端 Songs 目录',
  audioUrl: '',
  audioCloudPath: '',
  audioFileId: '',
  audioSource: 'none',
  repeatTarget: 3,
  durationSec: 0,
  coverTone: 'mint',
  transcriptTrackId: null,
  syncGranularity: 'line',
  textSource: null
};

function slugifyTrackIdPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/i, '')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getTrackSlugVariants(value) {
  const text = String(value || '');
  return Array.from(new Set([
    slugifyTrackIdPart(text),
    slugifyTrackIdPart(text.replace(/&/g, ' ')),
    slugifyTrackIdPart(text.replace(/&/g, '-')),
    slugifyTrackIdPart(text.replace(/&/g, ' and '))
  ].filter(Boolean)));
}

function inferNewConceptTaskMeta(category, audioBaseName, index) {
  if (!['newconcept1', 'newconcept2', 'newconcept3', 'newconcept4'].includes(category)) {
    return null;
  }
  const levelNumber = category === 'newconcept1' ? 1 : 2;
  const levelId = category === 'newconcept1' ? 'A1' : 'A2';
  const seriesSlug = category === 'newconcept1' ? 'new-concept-1-us' : 'new-concept-2';
  const shortSeriesSlug = category === 'newconcept1' ? 'nce1-us' : 'nce2';
  const audioSlugs = getTrackSlugVariants(audioBaseName);
  const audioSlug = audioSlugs[0] || '';
  const ordinal = String(index + 1).padStart(3, '0');
  const pairedOrdinalMatch = String(audioBaseName || '').match(/^(\d{3})&/);
  const pairedOrdinal = pairedOrdinalMatch ? pairedOrdinalMatch[1] : ordinal;
  const candidates = Array.from(new Set(audioSlugs.flatMap((slug) => [
    `track-${seriesSlug}-${slug}`,
    `${seriesSlug}-${slug}`,
    `track-${shortSeriesSlug}-${pairedOrdinal}`,
    `${shortSeriesSlug}-${pairedOrdinal}`,
    `track-${slug}`,
    slug
  ]).concat([
    `track-${seriesSlug}-${ordinal}`,
    `${seriesSlug}-${ordinal}`,
    audioBaseName
  ]).filter(Boolean)));
  return {
    taskId: `${category}-${index + 1}`,
    title: audioBaseName,
    subtitle: `New Concept English ${levelNumber}`,
    transcriptTrackId: candidates[0] || null,
    transcriptTrackCandidates: candidates,
    transcriptBatch: Math.floor(index / 24) + 1,
    syncGranularity: 'line',
    coverTone: category === 'newconcept1' ? 'peach' : 'berry',
    textSource: {
      sourceType: 'transcript-bundle',
      title: `${levelId} New Concept English ${levelNumber}`,
      filePath: ''
    }
  };
}

function normalizeTranscriptWord(word, lineId, index) {
  const startMs = Number(word && word.startMs);
  const endMs = Number(word && word.endMs);
  return {
    wordId: String((word && word.wordId) || `${lineId}-w${index + 1}`),
    text: String((word && word.text) || '').trim(),
    startMs: Number.isFinite(startMs) ? startMs : 0,
    endMs: Number.isFinite(endMs) ? Math.max(endMs, startMs + 1) : 1
  };
}

function normalizeTranscriptLine(line) {
  const lineId = String((line && line.lineId) || '');
  const startMs = Number((line && line.startMs) || 0);
  const endMs = Math.max(Number((line && line.endMs) || startMs), startMs + 1);
  const words = Array.isArray(line && line.words)
    ? line.words.map((word, index) => normalizeTranscriptWord(word, lineId, index))
    : [];
  return Object.assign({}, line, {
    lineId,
    text: String((line && line.text) || '').trim(),
    startMs,
    endMs,
    words
  });
}

function normalizeTranscriptTrack(track, options = {}) {
  return transcriptAdapter.normalizeTranscriptTrack(track, options);
}

function formatTranscriptMsLabel(ms) {
  return transcriptAdapter.formatTranscriptMsLabel(ms);
}

function mergeTranscriptTrackMaps(...maps) {
  return Object.assign({}, ...maps.filter(Boolean));
}

function downloadJsonFromCdn(cloudPath) {
  return storageAdapter.downloadJsonFromCdn(cloudPath);
}

async function downloadCloudJson(cloudPath) {
  return storageAdapter.downloadCloudJson(cloudPath);
}

async function getTranscriptTrackMap(category) {
  return transcriptAdapter.getTranscriptTrackMap(category);
}

function findTranscriptTrack(transcriptTrackMap, task) {
  return transcriptAdapter.findTranscriptTrack(transcriptTrackMap, task);
}

function shouldLazyTranscriptCategory(category) {
  return ['newconcept1', 'newconcept2', 'newconcept3', 'newconcept4'].includes(category);
}

async function getTranscriptBundle(task) {
  const startedAt = Date.now();
  const result = await transcriptAdapter.getTranscriptBundle(task);
  monitor.logPerf('cloudfn', 'getTranscriptBundle', Date.now() - startedAt, {
    category: String((task && task.category) || '')
  });
  return result;
}

function getStaticCatalogMap() {
  return {
    newconcept1: [],
    newconcept2: [],
    newconcept3: [],
    newconcept4: [],
    peppa: peppaTasks,
    unlock1: unlockTasks,
    song: songTasks
  };
}

function getStorageManager() {
  return storageAdapter.getStorageManager();
}

function normalizeCloudPath(path) {
  return storageAdapter.normalizeCloudPath(path);
}

function getParentFolder(path) {
  return storageAdapter.getParentFolder(path);
}

function findNearestParentPdf(pdfByFolder, cloudPath) {
  let folder = getParentFolder(cloudPath);
  while (folder) {
    if (pdfByFolder[folder]) {
      return pdfByFolder[folder];
    }
    folder = getParentFolder(folder);
  }
  return null;
}

function getBaseName(path) {
  return storageAdapter.getBaseName(path);
}

function getFileExt(path) {
  const match = normalizeCloudPath(path).match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUnlock1Unit(value) {
  const text = normalizeKey(value)
    .replace(/^unlock[-\s_]*2e[-\s_]*a1[-\s_]*/i, '')
    .replace(/^unlock[-\s_]*1[-\s_]*/i, '')
    .replace(/[^0-9.]+/g, '')
    .trim();
  return text;
}

function inferSongOrdinal(value) {
  const text = getBaseName(value).replace(/^0+/, '').trim();
  const match = text.match(/^(\d+)(?:[.\s_-]+)(.+)$/);
  if (!match) {
    return null;
  }
  const number = Number(match[1]);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return {
    number,
    padded: String(number).padStart(3, '0'),
    title: match[2].trim()
  };
}

function inferSongTaskMeta(value) {
  const ordinal = inferSongOrdinal(value);
  if (!ordinal) {
    return null;
  }
  return {
    taskId: `super-simple-songs-${ordinal.number}`,
    title: `${ordinal.padded} ${ordinal.title}`,
    subtitle: 'Super Simple Songs',
    transcriptTrackId: `track-sss-${ordinal.padded}`,
    transcriptBatch: Math.floor((ordinal.number - 1) / 100) + 1,
    syncGranularity: 'line'
  };
}

function buildStaticTaskLookup(items) {
  const map = {};
  items.forEach((item) => {
    map[normalizeKey(item.title)] = item;
    map[normalizeKey(getBaseName(item.audioCloudPath || item.audioUrl))] = item;
    const normalizedUnit = normalizeUnlock1Unit(item.title);
    if (normalizedUnit) {
      map[normalizedUnit] = item;
    }
  });
  return map;
}

function shouldUseUnlock1TrainingPool(trainingPool) {
  return !!(trainingPool && trainingPool.collectionReady && trainingPool.eligibleReady);
}

async function getEligibleUnlock1TrainingPool() {
  try {
    const allRecords = (await trainingPoolRepository.listAll(500)).map((item) => Object.assign({}, item, {
      cloudPath: normalizeCloudPath(item.cloudPath),
      fileID: item.fileID || buildCloudFileId(item.cloudPath),
      title: String(item.title || '').trim()
    }));
    const records = allRecords.filter((item) => item.status === 'eligible');
    const byFileID = {};
    const byCloudPath = {};
    const byTitle = {};
    records.forEach((record) => {
      if (record.fileID) {
        byFileID[record.fileID] = record;
      }
      if (record.cloudPath) {
        byCloudPath[normalizeKey(record.cloudPath)] = record;
      }
      if (record.title) {
        byTitle[normalizeKey(record.title)] = record;
        const normalizedUnit = normalizeUnlock1Unit(record.title);
        if (normalizedUnit) {
          byTitle[normalizedUnit] = record;
        }
      }
      const normalizedUnit = normalizeUnlock1Unit(record.cloudPath);
      if (normalizedUnit) {
        byTitle[normalizedUnit] = record;
      }
    });
    return {
      ready: true,
      collectionReady: true,
      eligibleReady: records.length > 0,
      records,
      totalCount: records.length,
      totalRecordCount: allRecords.length,
      byFileID,
      byCloudPath,
      byTitle,
      error: ''
    };
  } catch (error) {
    if (isMissingCollectionError(error)) {
      return {
        ready: false,
        collectionReady: false,
        eligibleReady: false,
        records: [],
        totalCount: 0,
        totalRecordCount: 0,
        byFileID: {},
        byCloudPath: {},
        byTitle: {},
        error: `${UNLOCK1_TRAINING_POOL_COLLECTION} not ready`
      };
    }
    return {
      ready: false,
      collectionReady: false,
      eligibleReady: false,
      records: [],
      totalCount: 0,
      totalRecordCount: 0,
      byFileID: {},
      byCloudPath: {},
      byTitle: {},
      error: formatStorageError(error)
    };
  }
}

function getUnlock1TrainingPoolBootstrapSnapshot() {
  return Object.assign({}, unlock1TrainingPoolBootstrapState, {
    lastStats: unlock1TrainingPoolBootstrapState.lastStats || null
  });
}

async function triggerUnlock1TrainingPoolBootstrap(reason) {
  unlock1TrainingPoolBootstrapState.lastTriggeredAt = Date.now();
  unlock1TrainingPoolBootstrapState.lastFinishedAt = Date.now();
  unlock1TrainingPoolBootstrapState.lastMode = 'manual-required';
  unlock1TrainingPoolBootstrapState.lastResult = 'manual-required';
  unlock1TrainingPoolBootstrapState.lastError = `训练池未就绪，请先手动部署并执行 unlock1-preprocess.scanUnlock1Audio（原因：${reason}）`;
  unlock1TrainingPoolBootstrapState.lastStats = null;
  return {
    triggered: false,
    reason,
    state: getUnlock1TrainingPoolBootstrapSnapshot()
  };
}

async function ensureUnlock1TrainingPoolPrepared(trainingPool) {
  if (shouldUseUnlock1TrainingPool(trainingPool)) {
    return {
      trainingPool,
      bootstrapState: getUnlock1TrainingPoolBootstrapSnapshot()
    };
  }
  const bootstrap = await triggerUnlock1TrainingPoolBootstrap(
    trainingPool && trainingPool.ready
      ? 'training-pool-empty'
      : 'training-pool-not-ready'
  );
  return {
    trainingPool,
    bootstrapState: bootstrap.state || getUnlock1TrainingPoolBootstrapSnapshot()
  };
}

function findUnlock1TrainingRecord(file, matchedStatic, trainingPool) {
  if (!trainingPool || !trainingPool.ready) {
    return null;
  }
  const byFileID = trainingPool.byFileID || {};
  const byCloudPath = trainingPool.byCloudPath || {};
  const byTitle = trainingPool.byTitle || {};
  const staticTitle = matchedStatic ? matchedStatic.title : '';
  return byFileID[file.fileId]
    || byCloudPath[normalizeKey(file.cloudPath)]
    || byTitle[normalizeKey(getBaseName(file.cloudPath))]
    || byTitle[normalizeUnlock1Unit(file.cloudPath)]
    || byTitle[normalizeKey(staticTitle)]
    || byTitle[normalizeUnlock1Unit(staticTitle)]
    || null;
}

async function listDirectoryFiles(cloudPath) {
  const files = await storageAdapter.listDirectoryFiles(cloudPath);
  const normalizedRoot = normalizeCloudPath(cloudPath);
  const firstItem = files[0] || null;
  storageDebugShapes[normalizedRoot] = firstItem ? Object.keys(firstItem).sort() : [];
  return files;
}

function formatStorageError(error) {
  return storageAdapter.formatStorageError(error);
}

function createCloudTextSource(pdfFile, titleFallback) {
  if (!pdfFile) {
    return null;
  }
  return {
    sourceType: 'pdf',
    title: getBaseName(pdfFile.cloudPath) || titleFallback,
    filePath: pdfFile.cloudPath,
    fileId: pdfFile.fileId
  };
}

function buildCloudTask(baseTask, overrides) {
  return Object.assign({}, baseTask || {}, overrides, {
    audioUrl: overrides.audioUrl,
    audioCloudPath: overrides.audioCloudPath,
    audioFileId: overrides.audioFileId,
    audioSource: overrides.audioSource || (baseTask && baseTask.audioSource) || 'none',
    textSource: overrides.textSource || (baseTask ? baseTask.textSource : null)
  });
}

function sortFilesByPath(left, right) {
  return normalizeCloudPath(left.cloudPath).localeCompare(normalizeCloudPath(right.cloudPath), 'zh-Hans-CN', {
    numeric: true,
    sensitivity: 'base'
  });
}

async function buildCloudCatalogFromRoot(category, rootPath, staticItems, options) {
  const files = await listDirectoryFiles(rootPath);
  const audioFiles = files.filter((item) => AUDIO_FILE_PATTERN.test(item.cloudPath)).sort(sortFilesByPath);
  const pdfByFolder = {};
  files.filter((item) => /\.pdf$/i.test(item.cloudPath)).forEach((item) => {
    pdfByFolder[getParentFolder(item.cloudPath)] = item;
  });
  const staticLookup = buildStaticTaskLookup(staticItems);
  const trainingPool = options && options.trainingPool;
  const useUnlock1TrainingPool = category === 'unlock1' && shouldUseUnlock1TrainingPool(trainingPool);
  const audioEntries = category === 'unlock1'
    ? audioFiles.map((file, index) => {
      const audioBaseName = getBaseName(file.cloudPath);
      const matchedStatic = staticLookup[normalizeKey(audioBaseName)]
        || staticLookup[normalizeUnlock1Unit(audioBaseName)]
        || null;
      const trainingRecord = findUnlock1TrainingRecord(file, matchedStatic, trainingPool);
      return {
        file,
        index,
        matchedStatic,
        trainingRecord,
        resolvedDurationSec: trainingRecord ? Number(trainingRecord.durationSec || 0) : Number((matchedStatic && matchedStatic.durationSec) || 0)
      };
    }).filter((entry) => {
      if (useUnlock1TrainingPool) {
        return !!entry.trainingRecord;
      }
      return !!entry.matchedStatic && entry.resolvedDurationSec >= UNLOCK1_MIN_DURATION_SEC;
    })
    : audioFiles.map((file, index) => ({
      file,
      index,
      matchedStatic: staticLookup[normalizeKey(getBaseName(file.cloudPath))] || null,
      trainingRecord: null
    }));
  const unlock1ExcludedShortCount = category === 'unlock1'
    ? audioFiles.length - audioEntries.length
    : undefined;
  const sampleAudioFile = category === 'unlock1'
    ? ((audioEntries[0] && audioEntries[0].file) || null)
    : (audioFiles[0] || null);

  const tasks = audioEntries.map((entry) => {
    const { file, index, matchedStatic, trainingRecord } = entry;
    const audioBaseName = getBaseName(file.cloudPath);
    const folderPdf = findNearestParentPdf(pdfByFolder, file.cloudPath);
    const inferredSongTask = category === 'song' ? inferSongTaskMeta(audioBaseName) : null;
    const inferredNewConceptTask = inferNewConceptTaskMeta(category, audioBaseName, index);
    const title = matchedStatic
      ? matchedStatic.title
      : ((trainingRecord && trainingRecord.title) || (inferredSongTask && inferredSongTask.title) || (inferredNewConceptTask && inferredNewConceptTask.title) || audioBaseName);
    const subtitle = matchedStatic
      ? matchedStatic.subtitle
      : ((inferredSongTask && inferredSongTask.subtitle) || (inferredNewConceptTask && inferredNewConceptTask.subtitle) || getParentFolder(file.cloudPath).split('/').pop() || rootPath.split('/').pop());
    const transcriptTrackId = matchedStatic
      ? matchedStatic.transcriptTrackId
      : ((inferredSongTask && inferredSongTask.transcriptTrackId) || (inferredNewConceptTask && inferredNewConceptTask.transcriptTrackId));
    const syncGranularity = matchedStatic
      ? String(matchedStatic.syncGranularity || 'word')
      : ((inferredSongTask && inferredSongTask.syncGranularity) || (inferredNewConceptTask && inferredNewConceptTask.syncGranularity) || 'word');
    return buildCloudTask(matchedStatic, {
      taskId: matchedStatic
        ? matchedStatic.taskId
        : ((inferredSongTask && inferredSongTask.taskId) || (inferredNewConceptTask && inferredNewConceptTask.taskId) || `${category}-${index + 1}`),
      category,
      title,
      subtitle,
      repeatTarget: matchedStatic ? matchedStatic.repeatTarget : 3,
      durationSec: trainingRecord ? trainingRecord.durationSec : (matchedStatic ? matchedStatic.durationSec : 180),
      coverTone: matchedStatic ? matchedStatic.coverTone : ((inferredNewConceptTask && inferredNewConceptTask.coverTone) || (category === 'song' ? 'mint' : 'sunrise')),
      transcriptTrackId,
      transcriptStatus: matchedStatic ? matchedStatic.transcriptStatus : (transcriptTrackId ? 'ready' : (folderPdf ? 'pending' : 'none')),
      transcriptBatch: matchedStatic ? matchedStatic.transcriptBatch : ((inferredSongTask && inferredSongTask.transcriptBatch) || (inferredNewConceptTask && inferredNewConceptTask.transcriptBatch) || null),
      transcriptTrackCandidates: inferredNewConceptTask ? inferredNewConceptTask.transcriptTrackCandidates : undefined,
      syncGranularity,
      audioTitle: (trainingRecord && trainingRecord.title) || audioBaseName,
      audioUrl: buildCloudAssetUrl(file.cloudPath),
      audioCloudPath: file.cloudPath,
      audioFileId: file.fileId,
      audioSource: 'static-cloud-url',
      textSource: inferredNewConceptTask
        ? inferredNewConceptTask.textSource
        : category === 'song'
        ? {
          sourceType: 'transcript-bundle',
          title: 'Super Simple Songs Lyrics',
          filePath: ''
        }
        : createCloudTextSource(folderPdf, `${title} Script`)
    });
  });
  return {
    tasks,
    debug: {
      root: rootPath,
      audioCount: category === 'unlock1' ? audioEntries.length : audioFiles.length,
      samplePath: sampleAudioFile ? sampleAudioFile.cloudPath : '',
      pdfCount: Object.keys(pdfByFolder).length,
      rawStorageShape: (storageDebugShapes[normalizeCloudPath(rootPath)] || []).join(','),
      scanMode: 'manager-scan',
      scanError: '',
      listMode: category === 'unlock1'
        ? (useUnlock1TrainingPool ? 'training-pool' : 'catalog-fallback')
        : 'manager-scan',
      trainingPoolReady: category === 'unlock1' ? !!(trainingPool && trainingPool.ready) : undefined,
      trainingPoolCollectionReady: category === 'unlock1' ? !!(trainingPool && trainingPool.collectionReady) : undefined,
      trainingPoolEligibleReady: category === 'unlock1' ? !!(trainingPool && trainingPool.eligibleReady) : undefined,
      trainingPoolEligibleCount: category === 'unlock1' ? ((trainingPool && trainingPool.totalCount) || 0) : undefined,
      rawAudioCount: category === 'unlock1' ? audioFiles.length : undefined,
      filteredAudioCount: category === 'unlock1' ? audioEntries.length : undefined,
      excludedShortCount: unlock1ExcludedShortCount,
      minDurationRule: category === 'unlock1' ? UNLOCK1_MIN_DURATION_SEC : undefined
    }
  };
}

async function buildCloudCatalogForCategory(category, staticItems) {
  const roots = STORAGE_ROOT_CANDIDATES[category] || [STORAGE_ROOTS[category]];
  let trainingPool = category === 'unlock1'
    ? await getEligibleUnlock1TrainingPool()
    : null;
  let bootstrapState = null;
  if (category === 'unlock1' && !shouldUseUnlock1TrainingPool(trainingPool)) {
    const ensured = await ensureUnlock1TrainingPoolPrepared(trainingPool);
    trainingPool = ensured.trainingPool;
    bootstrapState = ensured.bootstrapState;
  }
  const errors = [];
  const emptyScans = [];
  for (let index = 0; index < roots.length; index += 1) {
    const rootPath = roots[index];
    try {
      const result = await buildCloudCatalogFromRoot(category, rootPath, staticItems, {
        trainingPool
      });
      if (result.tasks.length) {
        return {
          tasks: result.tasks,
          debug: Object.assign({}, result.debug, {
            selectedRoot: rootPath,
            rootCandidates: roots,
            listMode: category === 'unlock1'
              ? (shouldUseUnlock1TrainingPool(trainingPool) ? 'training-pool' : 'catalog-fallback')
              : result.debug.listMode,
            trainingPoolReady: trainingPool ? trainingPool.ready : undefined,
            trainingPoolCollectionReady: trainingPool ? trainingPool.collectionReady : undefined,
            trainingPoolEligibleReady: trainingPool ? trainingPool.eligibleReady : undefined,
            trainingPoolEligibleCount: trainingPool ? trainingPool.totalCount : undefined,
            trainingPoolTotalCount: trainingPool ? trainingPool.totalRecordCount : undefined,
            bootstrapState: category === 'unlock1' ? bootstrapState : undefined
          })
        };
      }
      emptyScans.push(result.debug);
    } catch (error) {
      errors.push(`${rootPath}: ${formatStorageError(error)}`);
    }
  }
  return {
    tasks: [],
    debug: {
      root: roots[0] || '',
      selectedRoot: roots[0] || '',
      rootCandidates: roots,
      audioCount: 0,
      samplePath: '',
      pdfCount: 0,
      rawStorageShape: (storageDebugShapes[normalizeCloudPath(roots[0] || '')] || []).join(','),
      scanMode: errors.length ? 'static-fallback' : 'manager-scan',
      scanError: errors.join(' | '),
      emptyRoots: emptyScans.map((item) => item.root),
      listMode: category === 'unlock1'
        ? (shouldUseUnlock1TrainingPool(trainingPool) ? 'training-pool' : 'catalog-fallback')
        : (errors.length ? 'static-fallback' : 'manager-scan'),
      trainingPoolReady: trainingPool ? trainingPool.ready : undefined,
      trainingPoolCollectionReady: trainingPool ? trainingPool.collectionReady : undefined,
      trainingPoolEligibleReady: trainingPool ? trainingPool.eligibleReady : undefined,
      trainingPoolEligibleCount: trainingPool ? trainingPool.totalCount : undefined,
      trainingPoolTotalCount: trainingPool ? trainingPool.totalRecordCount : undefined,
      rawAudioCount: category === 'unlock1' ? 0 : undefined,
      filteredAudioCount: category === 'unlock1' ? 0 : undefined,
      excludedShortCount: category === 'unlock1' ? 0 : undefined,
      minDurationRule: category === 'unlock1' ? UNLOCK1_MIN_DURATION_SEC : undefined,
      trainingPoolError: trainingPool && trainingPool.error ? trainingPool.error : '',
      bootstrapState: category === 'unlock1' ? bootstrapState : undefined
    }
  };
}

function summarizeRuntimeCatalogDebug(categoryDebugMap) {
  const categories = Object.values(categoryDebugMap || {}).filter(Boolean);
  const unlock1 = categoryDebugMap.unlock1 || {};
  const song = categoryDebugMap.song || {};
  const modes = new Set(categories.map((item) => item.scanMode).filter(Boolean));
  let storageScanMode = 'manager-scan';
  if (modes.has('static-fallback') && modes.size > 1) {
    storageScanMode = 'mixed';
  } else if (modes.has('static-fallback')) {
    storageScanMode = 'static-fallback';
  }
  return {
    storageScanMode,
    storageScanError: categories.map((item) => item.scanError).filter(Boolean).join(' | '),
    rawStorageShape: categories.map((item) => item.rawStorageShape).filter(Boolean).join(' | '),
    unlock1Root: unlock1.selectedRoot || unlock1.root || '',
    unlock1AudioCount: unlock1.audioCount || 0,
    unlock1SamplePath: unlock1.samplePath || '',
    unlock1ListMode: unlock1.listMode || '',
    unlock1TrainingPoolReady: unlock1.trainingPoolReady,
    unlock1TrainingPoolCollectionReady: unlock1.trainingPoolCollectionReady,
    unlock1TrainingPoolEligibleReady: unlock1.trainingPoolEligibleReady,
    unlock1TrainingPoolEligibleCount: unlock1.trainingPoolEligibleCount || 0,
    unlock1TrainingPoolTotalCount: unlock1.trainingPoolTotalCount || 0,
    unlock1RawAudioCount: unlock1.rawAudioCount || 0,
    unlock1FilteredAudioCount: unlock1.filteredAudioCount || 0,
    unlock1ExcludedShortCount: unlock1.excludedShortCount || 0,
    unlock1MinDurationRule: unlock1.minDurationRule || UNLOCK1_MIN_DURATION_SEC,
    unlock1TrainingPoolError: unlock1.trainingPoolError || '',
    unlock1BootstrapTriggeredAt: unlock1.bootstrapState ? unlock1.bootstrapState.lastTriggeredAt || 0 : 0,
    unlock1BootstrapFinishedAt: unlock1.bootstrapState ? unlock1.bootstrapState.lastFinishedAt || 0 : 0,
    unlock1BootstrapMode: unlock1.bootstrapState ? unlock1.bootstrapState.lastMode || '' : '',
    unlock1BootstrapResult: unlock1.bootstrapState ? unlock1.bootstrapState.lastResult || '' : '',
    unlock1BootstrapError: unlock1.bootstrapState ? unlock1.bootstrapState.lastError || '' : '',
    songRoot: song.selectedRoot || song.root || '',
    songAudioCount: song.audioCount || 0,
    songSamplePath: song.samplePath || ''
  };
}

function mergeCatalogDebug(...debugEntries) {
  const merged = {};
  debugEntries.filter(Boolean).forEach((entry) => {
    Object.keys(entry).forEach((key) => {
      merged[key] = entry[key];
    });
  });
  return merged;
}

async function refreshRuntimeCatalogs(force, categories) {
  const startedAt = Date.now();
  const now = Date.now();
  const targetCategories = Array.from(new Set((categories && categories.length ? categories : ['newconcept1', 'peppa', 'unlock1', 'song']).filter(Boolean)));
  const hasAllRequested = runtimeCatalogs && targetCategories.every((category) => Array.isArray(runtimeCatalogs[category]));
  if (!force && hasAllRequested && runtimeCatalogExpiresAt > now) {
    return runtimeCatalogs;
  }
  const staticMap = getStaticCatalogMap();
  const entries = await Promise.all(targetCategories.map(async (category) => {
    const result = await buildCloudCatalogForCategory(category, staticMap[category] || []);
    return { category, result };
  }));
  const nextCatalogs = Object.assign({}, runtimeCatalogs || getStaticCatalogMap());
  const nextDebug = Object.assign({}, runtimeCatalogDebug || {});
  entries.forEach(({ category, result }) => {
    if (category === 'unlock1') {
      const staticUnlock1Filtered = (staticMap.unlock1 || []).filter((item) => Number(item.durationSec || 0) >= UNLOCK1_MIN_DURATION_SEC);
      nextCatalogs.unlock1 = result.debug && result.debug.listMode === 'training-pool'
        ? result.tasks
        : (result.tasks.length ? result.tasks : staticUnlock1Filtered);
    } else if (category === 'peppa') {
      nextCatalogs.peppa = result.tasks.length ? result.tasks : staticMap.peppa;
    } else {
      nextCatalogs[category] = result.tasks;
    }
    nextDebug[category] = result.debug;
  });
  runtimeCatalogs = nextCatalogs;
  runtimeCatalogDebug = summarizeRuntimeCatalogDebug(nextDebug);
  runtimeCatalogExpiresAt = now + 5 * 60 * 1000;
  monitor.logPerf('cloudfn', 'refreshRuntimeCatalogs', Date.now() - startedAt, {
    categories: targetCategories.join(',')
  });
  return runtimeCatalogs;
}

function getResourceDebugSnapshot() {
  return Object.assign({}, runtimeCatalogDebug || summarizeRuntimeCatalogDebug({}));
}

const CATEGORY_ORDER = ['newconcept1', 'peppa', 'unlock1', 'song', 'newconcept2'];
const CATEGORY_LABELS = {
  newconcept1: 'New Concept 1',
  newconcept2: 'New Concept 2',
  newconcept3: 'New Concept 3',
  newconcept4: 'New Concept 4',
  peppa: 'Peppa',
  unlock1: 'Unlock 1',
  song: 'Songs'
};

function getCatalog(category) {
  const staticCatalogs = getStaticCatalogMap();
  const catalogs = runtimeCatalogs || {};
  if (category === 'newconcept1') {
    return Object.prototype.hasOwnProperty.call(catalogs, 'newconcept1') ? (catalogs.newconcept1 || []) : staticCatalogs.newconcept1;
  }
  if (['newconcept2', 'newconcept3', 'newconcept4'].includes(category)) {
    return Object.prototype.hasOwnProperty.call(catalogs, category) ? (catalogs[category] || []) : staticCatalogs[category];
  }
  if (category === 'peppa') {
    return Object.prototype.hasOwnProperty.call(catalogs, 'peppa') ? (catalogs.peppa || []) : staticCatalogs.peppa;
  }
  if (category === 'unlock1') {
    return Object.prototype.hasOwnProperty.call(catalogs, 'unlock1') ? (catalogs.unlock1 || []) : staticCatalogs.unlock1;
  }
  if (category === 'song') {
    return Object.prototype.hasOwnProperty.call(catalogs, 'song') ? (catalogs.song || []) : staticCatalogs.song;
  }
  return [];
}

function getCategoryLabel(category) {
  return taskPresenter.getCategoryLabel(category);
}

function getMediaDisplayName(filePath) {
  if (!filePath) return '';
  const parts = String(filePath).split('/').filter(Boolean);
  return (parts[parts.length - 1] || '').replace(/\.[a-z0-9]+$/i, '');
}

function getTaskPresentation(task) {
  return taskPresenter.getTaskPresentation(task);
}

function getTaskReward(category, progress, task) {
  return taskPresenter.getTaskReward(category, progress, task);
}

function decorateTask(task, progress, category) {
  return taskPresenter.decorateTask(task, progress, category, {
    songPlaceholder,
    getMediaDisplayName
  });
}

function makeInviteCode() {
  return identityLib.makeInviteCode();
}

function makeChildLoginCode() {
  return identityLib.makeChildLoginCode();
}

async function makeUniqueChildLoginCode() {
  for (let i = 0; i < 12; i += 1) {
    const childLoginCode = makeChildLoginCode();
    const existing = await childRepository.findByLoginCode(childLoginCode);
    if (!existing) {
      return childLoginCode;
    }
  }
  throw new Error('孩子 ID 生成失败，请稍后再试');
}

function buildAvatarTextFromNickname(nickname) {
  return identityLib.buildAvatarTextFromNickname(nickname);
}

async function getMember(openId) {
  return familyRepository.findMemberByOpenId(openId);
}

function getMemberIdentityKey(member) {
  return identityLib.getMemberIdentityKey(member);
}

function normalizeAndDedupeMembers(members) {
  return identityLib.normalizeAndDedupeMembers(members);
}

function buildUserId(openId) {
  return identityLib.buildUserId(openId);
}

async function ensureUser(openId) {
  return bootstrapEngine.ensureUser(openId, {
    findUserByOpenId: (nextOpenId) => userRepository.findByOpenId(nextOpenId),
    updateUserById: (id, data) => userRepository.updateById(id, data),
    createUser: (user) => userRepository.create(user),
    buildUserId
  });
}

async function getFamily(familyId) {
  return familyRepository.getFamilyById(familyId);
}

async function getChild(familyId) {
  return bootstrapEngine.getChild(familyId, {
    findChildByFamilyId: (nextFamilyId) => childRepository.findByFamilyId(nextFamilyId),
    updateChildById: (id, data) => childRepository.updateById(id, data),
    makeUniqueChildLoginCode,
    buildAvatarTextFromNickname
  });
}

async function updateChildProfile(familyId, payload) {
  return familyEngine.updateChildProfile(familyId, payload, {
    getChild,
    updateChildById: (id, data) => childRepository.updateById(id, data),
    buildAvatarTextFromNickname
  });
}

function normalizeStudyRole(member) {
  return identityLib.normalizeStudyRole(member);
}

async function setExclusiveStudyRole(member, studyRole) {
  return familyEngine.setExclusiveStudyRole(member, studyRole, {
    findMembersByFamilyId: (familyId) => familyRepository.findMembersByFamilyId(familyId),
    updateMemberById: (id, data) => familyRepository.updateMemberById(id, data)
  });
}

async function upsertFamilyMemberForFamily(openId, userId, familyId, displayName) {
  return familyEngine.upsertFamilyMemberForFamily(openId, userId, familyId, displayName, {
    findMembersByOpenId: (nextOpenId) => familyRepository.findMembersByOpenId(nextOpenId),
    updateMemberById: (id, data) => familyRepository.updateMemberById(id, data),
    createMember: (data) => familyRepository.createMember(data),
    normalizeStudyRole,
    findSubscriptionByMemberId: (memberId) => subscriptionRepository.findByMemberId(memberId),
    updateSubscriptionById: (id, data) => subscriptionRepository.updateById(id, data),
    createSubscription: (data) => subscriptionRepository.create(data)
  });
}

async function leaveCurrentFamily(ctx) {
  return familyEngine.leaveCurrentFamily(ctx, {
    findFamilyByOwnerOpenId: (ownerOpenId) => familyRepository.findFamilyByOwnerOpenId(ownerOpenId),
    updateMemberById: (id, data) => familyRepository.updateMemberById(id, data),
    deleteMemberById: (id) => familyRepository.deleteMemberById(id),
    findSubscriptionByMemberId: (memberId) => subscriptionRepository.findByMemberId(memberId),
    updateSubscriptionById: (id, data) => subscriptionRepository.updateById(id, data),
    createSubscription: (data) => subscriptionRepository.create(data),
    deleteSubscriptionById: (id) => subscriptionRepository.deleteById(id)
  });
}

async function ensureBootstrap(openId) {
  return bootstrapEngine.ensureBootstrap(openId, {
    findUserByOpenId: (nextOpenId) => userRepository.findByOpenId(nextOpenId),
    updateUserById: (id, data) => userRepository.updateById(id, data),
    createUser: (user) => userRepository.create(user),
    buildUserId,
    getMember,
    createFamily: (familyId, data) => familyRepository.createFamily(familyId, data),
    createMember: (data) => familyRepository.createMember(data),
    updateMemberById: (id, data) => familyRepository.updateMemberById(id, data),
    createSubscription: (data) => subscriptionRepository.create(data),
    createChild: (data) => childRepository.create(data),
    makeInviteCode,
    makeUniqueChildLoginCode,
    buildAvatarTextFromNickname,
    childTemplate,
    normalizeStudyRole,
    getFamily,
    getChild,
    normalizeAndDedupeMembers,
    findMembersByFamilyId: (familyId) => familyRepository.findMembersByFamilyId(familyId),
    findSubscriptionByMemberId: (memberId) => subscriptionRepository.findByMemberId(memberId)
  });
}

function getUserScope(ctx) {
  return {
    userId: ctx.user.userId,
    openId: ctx.user.openId,
    memberId: ctx.member.memberId,
    familyId: ctx.family.familyId,
    childId: ctx.child.childId
  };
}

async function getProgressRecord(scope, category, date) {
  const progressId = `${scope.familyId}_${scope.childId}_${date}_${category}`;
  return progressRepository.findByProgressId(progressId);
}

async function saveProgressRecord(record) {
  await progressRepository.upsert({
    familyId: record.familyId,
    childId: record.childId
  }, record);
}

async function getChildProgressRecords(scope) {
  return progressRepository.findByScope(scope);
}

async function getCheckins(scope) {
  return checkinRepository.findByScope(scope);
}

const addDays = dateLib.addDays;
const getTodayString = dateLib.getTodayString;
const computeStreak = dateLib.computeStreak;

const PLAN_SLOT_COUNT = planLib.PLAN_SLOT_COUNT;
const PLAN_PHASES = planLib.PLAN_PHASES;
const TOTAL_PLAN_DAYS = planLib.TOTAL_PLAN_DAYS;

function getPlanPhase(dayIndex) {
  return planLib.getPlanPhase(dayIndex);
}

function getPlanCategoryOrder(dayIndex) {
  return planLib.getPlanCategoryOrder(dayIndex);
}

function getPlanDayIndex(checkins) {
  return planLib.getPlanDayIndex(checkins);
}

function getPlanDayIndexForDate(checkins, date) {
  return planLib.getPlanDayIndexForDate(checkins, date);
}

function getPlanStartDate(ctx, today, checkins) {
  return planLib.getPlanStartDate(ctx, today, checkins);
}

function buildCatchupState(checkins, today, planStartDate, todayDone) {
  return planLib.buildCatchupState(checkins, today, planStartDate, todayDone);
}

function getPlanCatalog(category) {
  return planEngine.getPlanCatalog(category, {
    getCatalog,
    planSlotCount: PLAN_SLOT_COUNT
  });
}

function buildLevelCategoryOverview(progressRecords, childId, category, date, options = {}) {
  const tasks = getCatalog(category).slice(0, options.limit || PLAN_SLOT_COUNT);
  const plannedTasks = decoratePlannedTasks(progressRecords, childId, category, date, tasks, {
    planRunType: options.planRunType || 'level',
    targetDate: date,
    planDayIndex: options.planDayIndex || 1
  });
  const todayTask = buildCategorySummary(plannedTasks, category);
  return {
    category,
    categoryLabel: getCategoryLabel(category),
    totalCount: tasks.length,
    completedCount: plannedTasks.filter((item) => item.completedToday).length,
    todayTask,
    isPendingAsset: todayTask.isPendingAsset,
    todayTaskCount: todayTask.plannedTaskCount || 0
  };
}

function buildLevelCatalogEntry(category, options = {}) {
  return levelEngine.buildLevelCatalogEntry(category, options, {
    getCatalog,
    decorateTask,
    buildEmptyProgress,
    buildCategorySummary,
    getCategoryLabel
  });
}

async function resolveStandaloneCategoryTasks(category, childId, date) {
  return levelEngine.resolveStandaloneCategoryTasks(category, childId, date, {
    storageRootCandidates: STORAGE_ROOT_CANDIDATES,
    storageRoots: STORAGE_ROOTS,
    listDirectoryFiles,
    audioFilePattern: AUDIO_FILE_PATTERN,
    sortFilesByPath,
    getBaseName,
    inferNewConceptTaskMeta,
    buildCloudTask,
    buildCloudAssetUrl
  });
}

function buildPlanForDay(dayIndex) {
  return planEngine.buildPlanForDay(dayIndex, {
    getCatalog,
    planSlotCount: PLAN_SLOT_COUNT,
    planLib
  });
}

function decoratePlanTasks(progressRecords, childId, date, plan, options = {}) {
  return planEngine.decoratePlanTasks(progressRecords, childId, date, plan, options, {
    decoratePlannedTasks,
    planLib
  });
}

function buildEmptyProgress() {
  return taskEngine.buildEmptyProgress();
}

function getTaskProgressForDate(progressRecords, childId, category, date, taskId, options = {}) {
  return taskEngine.getTaskProgressForDate(progressRecords, childId, category, date, taskId, options);
}

function decoratePlannedTasks(progressRecords, childId, category, date, tasks, options = {}) {
  return taskEngine.decoratePlannedTasks(progressRecords, childId, category, date, tasks, options, {
    getPlanPhase,
    decorateTask
  });
}

function buildCategorySummary(categoryTasks, category) {
  return taskEngine.buildCategorySummary(categoryTasks, category, {
    decorateTask
  });
}

function buildStats(progressRecords, checkins, childId) {
  return taskEngine.buildStats(progressRecords, checkins, childId, {
    getCatalog,
    computeStreak
  });
}

async function maybeCreateCheckin(scope, progressRecords, date, options = {}) {
  return checkinEngine.maybeCreateCheckin(scope, progressRecords, date, options, {
    getCheckins,
    getPlanDayIndex,
    buildPlanForDay,
    getTaskProgressForDate,
    computeStreak,
    upsertCheckin: (existing, next) => checkinRepository.upsertByRecordId(existing, next),
    upsertDailyReport
  });
}

async function clearTodayUnconfirmedListens(ctx) {
  const today = getTodayString();
  const scope = getUserScope(ctx);
  const todayRecord = (await getCheckins(scope)).find((item) => item.date === today);
  if (todayRecord) {
    throw new Error('今天已经打卡，不能清掉记录');
  }
  const progressRecords = await getChildProgressRecords(scope);
  const candidates = progressRecords
    .filter((item) => item.date === today && Number(item.playCount || 0) > 0)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  if (!candidates.length) {
    throw new Error('今天没有可清掉的播放记录');
  }
  const now = new Date().toISOString();
  await progressRepository.bulkResetByIds(candidates.map((item) => item._id), {
    playCount: 0,
    textUnlocked: false,
    completedToday: false,
    updatedAt: now,
    lastUndoAt: now,
    lastUndoByMemberId: scope.memberId
  });
  await upsertDailyReport(scope, today);
  return {
    cleared: {
      date: today,
      taskCount: candidates.length,
      playCount: candidates.reduce((sum, item) => sum + Number(item.playCount || 0), 0)
    }
  };
}

async function upsertDailyReport(scope, date) {
  return reportEngine.upsertDailyReport(scope, date, {
    getChildProgressRecords,
    getCheckins,
    buildPlanForDay,
    getPlanDayIndexForDate,
    getPlanCategoryOrder,
    decoratePlannedTasks,
    getCatalog,
    findFamilyMembersByFamilyId: (familyId) => familyRepository.findMembersByFamilyId(familyId),
    upsertReport: (nextScope, nextDate, report) => reportRepository.upsert(nextScope, nextDate, report)
  });
}

async function getDashboardData(ctx, options = {}) {
  return dashboardEngine.getDashboardData(ctx, {
    getTodayString,
    getUserScope,
    getChildProgressRecords,
    getCheckins,
    getPlanDayIndexForDate,
    buildPlanForDay,
    getPlanCategoryOrder,
    decoratePlannedTasks,
    buildCategorySummary,
    decoratePlanTasks,
    buildStats,
    buildCatchupState,
    getPlanStartDate,
    getCatalog,
    getCategoryLabel
  }, options);
}

async function prepareRequestContext(event) {
  return requestContextEngine.prepareRequestContext(event, {
    refreshRuntimeCatalogs,
    ensureRequiredCollectionsReady,
    getWXContext,
    ensureBootstrap,
    getTodayString
  });
}

module.exports = {
  getResourceDebugSnapshot,
  prepareRequestContext,
  getDashboardData,
  getUserScope,
  getChildProgressRecords,
  getCheckins,
  getPlanDayIndex,
  getPlanDayIndexForDate,
  buildPlanForDay,
  decoratePlannedTasks,
  decoratePlanTasks,
  resolveStandaloneCategoryTasks,
  buildCategorySummary,
  getPlanCatalog,
  getCatalog,
  getCategoryLabel,
  addDays,
  getTodayString,
  buildLevelCatalogEntry,
  buildEmptyProgress,
  decorateTask,
  getTranscriptBundle,
  upsertDailyReport,
  buildCatchupState,
  getPlanStartDate,
  normalizeStudyRole,
  maybeCreateCheckin,
  saveProgressRecord,
  level,
  ensureBootstrap,
  updateChildProfile,
  setExclusiveStudyRole,
  upsertFamilyMemberForFamily,
  leaveCurrentFamily,
  clearTodayUnconfirmedListens
};
