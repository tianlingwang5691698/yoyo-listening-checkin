const cloud = require('wx-server-sdk');
const CloudBaseManager = require('@cloudbase/manager-node');
const https = require('https');
const { peppaTranscriptBuildStatus } = require('./transcripts/peppa_build_status');

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
const UNLOCK1_AUDIO_ROOT = 'A1/Unlock1/Unlock1 听口音频Class Audio';
const UNLOCK1_SCRIPT_PATH = `${UNLOCK1_AUDIO_ROOT}/Unlock 2e Listening and Speaking 1 Scripts.pdf`;
const UNLOCK1_TRAINING_POOL_COLLECTION = 'unlock1AudioTrainingPool';
const UNLOCK1_MIN_DURATION_SEC = 60;
const STORAGE_ROOTS = {
  newconcept1: NEW_CONCEPT1_AUDIO_ROOT,
  newconcept2: NEW_CONCEPT2_AUDIO_ROOT,
  peppa: 'A1/Peppa',
  unlock1: UNLOCK1_AUDIO_ROOT,
  song: 'A1/Super simple songs'
};
const STORAGE_ROOT_CANDIDATES = {
  newconcept1: [NEW_CONCEPT1_AUDIO_ROOT, 'A1/NewConcept1', 'A1/New Concept 1', 'A1/new-concept-1-us'],
  newconcept2: [NEW_CONCEPT2_AUDIO_ROOT, 'A2/NewConcept2', 'A2/New Concept 2', 'A2/new-concept-2-us', 'A2/Newconcept2'],
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
  const baseUrl = String(CLOUD_ASSET_BASE_URL || '').replace(/\/+$/, '');
  const normalizedPath = String(cloudPath || '').replace(/^\/+/, '');
  if (!baseUrl || !normalizedPath) {
    return '';
  }
  return `${baseUrl}/${encodeURI(normalizedPath)}`;
}

function buildCloudFileId(cloudPath) {
  const normalizedPath = String(cloudPath || '').replace(/^\/+/, '');
  if (!CLOUD_ENV_ID || !CLOUD_BUCKET || !normalizedPath) {
    return '';
  }
  return `cloud://${CLOUD_ENV_ID}.${CLOUD_BUCKET}/${normalizedPath}`;
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
    await db.collection(collectionName).limit(1).get();
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
  if (category !== 'newconcept1' && category !== 'newconcept2') {
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
  const syncGranularity = String(options.syncGranularity || (track && track.syncGranularity) || 'word').trim() || 'word';
  return Object.assign({}, track, {
    syncGranularity,
    lines: Array.isArray(track && track.lines)
      ? track.lines.map((line) => {
        const normalizedLine = normalizeTranscriptLine(line);
        return Object.assign({}, normalizedLine, {
          words: syncGranularity === 'line' ? [] : normalizedLine.words,
          startLabel: formatTranscriptMsLabel(normalizedLine.startMs)
        });
      })
      : []
  });
}

function formatTranscriptMsLabel(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function mergeTranscriptTrackMaps(...maps) {
  return Object.assign({}, ...maps.filter(Boolean));
}

function downloadJsonFromCdn(cloudPath) {
  return new Promise((resolve, reject) => {
    const url = buildCloudAssetUrl(cloudPath);
    if (!url) {
      reject(new Error('cdn-url-unavailable'));
      return;
    }
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`cdn-http-${response.statusCode || 0}`));
        response.resume();
        return;
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function downloadCloudJson(cloudPath) {
  try {
    return await downloadJsonFromCdn(cloudPath);
  } catch (error) {
    // Fall back to storage APIs when CDN access is unavailable or stale.
  }
  const tempPath = `/tmp/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${normalizeCloudPath(cloudPath).split('/').pop()}`;
  const fileID = buildCloudFileId(cloudPath);
  let localPath = '';
  if (fileID) {
    const result = await cloud.downloadFile({
      fileID
    });
    localPath = result && result.tempFilePath ? result.tempFilePath : '';
  }
  if (!localPath) {
    const manager = getStorageManager();
    if (!manager) {
      throw new Error('storage-manager-unavailable');
    }
    localPath = await manager.storage.downloadFile({
      cloudPath,
      localPath: tempPath
    });
  }
  const text = require('fs').readFileSync(localPath, 'utf8');
  return JSON.parse(text);
}

async function getTranscriptTrackMap(category) {
  const key = String(category || '').trim();
  if (!key) {
    return {};
  }
  const now = Date.now();
  if (runtimeTranscriptTrackMaps[key] && runtimeTranscriptTrackMapExpiresAt[key] > now) {
    return runtimeTranscriptTrackMaps[key];
  }
  const cloudPaths = Array.isArray(TRANSCRIPT_BUNDLE_PATHS[key])
    ? TRANSCRIPT_BUNDLE_PATHS[key]
    : [TRANSCRIPT_BUNDLE_PATHS[key]];
  let trackMap = {};
  let errorText = '';
  for (const cloudPath of (cloudPaths || []).filter(Boolean)) {
    try {
      trackMap = await downloadCloudJson(cloudPath);
      errorText = '';
      break;
    } catch (error) {
      errorText = String((error && (error.errMsg || error.message)) || error || 'unknown-error');
    }
  }
  runtimeTranscriptTrackMaps[key] = trackMap || {};
  runtimeTranscriptTrackMapExpiresAt[key] = now + TRANSCRIPT_BUNDLE_TTL_MS;
  runtimeTranscriptTrackDebug[key] = {
    loadedAt: now,
    error: errorText,
    cloudCount: Object.keys(trackMap || {}).length
  };
  return runtimeTranscriptTrackMaps[key];
}

function findTranscriptTrack(transcriptTrackMap, task) {
  const candidates = [
    task && task.transcriptTrackId,
    task && task.contentId,
    task && task.title,
    task && task.audioTitle,
    task && task.displayTitle,
    task && getBaseName(task.audioCloudPath),
    task && getBaseName(task.audioUrl)
  ].concat((task && task.transcriptTrackCandidates) || []).filter(Boolean);
  for (const trackId of candidates) {
    if (transcriptTrackMap[trackId]) {
      return transcriptTrackMap[trackId];
    }
  }
  const normalizedCandidates = new Set(candidates.flatMap(getTrackSlugVariants));
  const matchedKey = Object.keys(transcriptTrackMap || {}).find((trackId) => {
    const track = transcriptTrackMap[trackId] || {};
    const trackCandidates = [
      trackId,
      track.trackId,
      track.contentId,
      track.title,
      track.audioTitle,
      track.fileName,
      track.audioFileName
    ].filter(Boolean).flatMap(getTrackSlugVariants);
    return trackCandidates.some((item) => normalizedCandidates.has(item));
  });
  return matchedKey ? transcriptTrackMap[matchedKey] : null;
}

function shouldLazyTranscriptCategory(category) {
  return category === 'newconcept1' || category === 'newconcept2';
}

async function getTranscriptBundle(task) {
  if (shouldLazyTranscriptCategory(task && task.category) && (!task || !task.transcriptTrackId) && !(task && task.transcriptTrackCandidates && task.transcriptTrackCandidates.length)) {
    return {
      transcriptTrack: null,
      transcriptLines: []
    };
  }
  const transcriptTrackMap = await getTranscriptTrackMap(task && task.category);
  const transcriptTrack = findTranscriptTrack(transcriptTrackMap, task);
  if (!task || !transcriptTrack) {
    return {
      transcriptTrack: null,
      transcriptLines: []
    };
  }
  const normalizedTrack = normalizeTranscriptTrack(transcriptTrack, {
    syncGranularity: task && task.category === 'song' ? 'line' : undefined
  });
  return {
    transcriptTrack: normalizedTrack,
    transcriptLines: normalizedTrack.lines
  };
}

function getStaticCatalogMap() {
  return {
    newconcept1: [],
    newconcept2: [],
    peppa: peppaTasks,
    unlock1: unlockTasks,
    song: songTasks
  };
}

function getStorageManager() {
  if (storageManager) {
    return storageManager;
  }
  const secretId = process.env.TENCENTCLOUD_SECRETID || process.env.SECRETID;
  const secretKey = process.env.TENCENTCLOUD_SECRETKEY || process.env.SECRETKEY;
  const token = process.env.TENCENTCLOUD_SESSIONTOKEN || process.env.TOKEN;
  if (!CLOUD_ENV_ID || !secretId || !secretKey) {
    return null;
  }
  storageManager = new CloudBaseManager({
    secretId,
    secretKey,
    token,
    envId: CLOUD_ENV_ID
  });
  return storageManager;
}

function normalizeCloudPath(path) {
  return String(path || '').replace(/^\/+|\/+$/g, '');
}

function getParentFolder(path) {
  const parts = normalizeCloudPath(path).split('/');
  parts.pop();
  return parts.join('/');
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
  const fileName = normalizeCloudPath(path).split('/').pop() || '';
  return fileName.replace(/\.[^.]+$/i, '');
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
    const res = await db.collection(UNLOCK1_TRAINING_POOL_COLLECTION).limit(500).get();
    const allRecords = (res.data || []).map((item) => Object.assign({}, item, {
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
  const manager = getStorageManager();
  if (!manager) {
    throw new Error('storage-manager-unavailable');
  }
  const storage = manager.storage;
  const result = await storage.listDirectoryFiles(normalizeCloudPath(cloudPath));
  const rawFiles = Array.isArray(result) ? result : ((((result || {}).data || {}).files || []));
  const normalizedRoot = normalizeCloudPath(cloudPath);
  const firstItem = rawFiles[0] || null;
  storageDebugShapes[normalizedRoot] = firstItem ? Object.keys(firstItem).sort() : [];
  return rawFiles.map((item) => {
    const normalizedCloudPath = normalizeCloudPath(item.cloud_path || item.cloudPath || item.Key || '');
    return {
      cloudPath: normalizedCloudPath,
      fileId: item.fileid || item.fileID || item.fileId || buildCloudFileId(normalizedCloudPath),
      size: Number(item.size || item.Size || 0)
    };
  });
}

function formatStorageError(error) {
  if (!error) {
    return '';
  }
  if (error.errMsg) {
    return error.errMsg;
  }
  if (error.message) {
    return error.message;
  }
  return String(error);
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
  return runtimeCatalogs;
}

function getResourceDebugSnapshot() {
  return Object.assign({}, runtimeCatalogDebug || summarizeRuntimeCatalogDebug({}));
}

const CATEGORY_ORDER = ['newconcept1', 'peppa', 'unlock1', 'song', 'newconcept2'];
const CATEGORY_LABELS = {
  newconcept1: 'New Concept 1',
  newconcept2: 'New Concept 2',
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
  if (category === 'newconcept2') {
    return Object.prototype.hasOwnProperty.call(catalogs, 'newconcept2') ? (catalogs.newconcept2 || []) : staticCatalogs.newconcept2;
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
  return CATEGORY_LABELS[category] || category;
}

function getMediaDisplayName(filePath) {
  if (!filePath) return '';
  const parts = String(filePath).split('/').filter(Boolean);
  return (parts[parts.length - 1] || '').replace(/\.[a-z0-9]+$/i, '');
}

function getTaskPresentation(task) {
  const title = String((task && task.title) || '').trim();
  if (!task) {
    return { displayTitle: '', displaySubtitle: '', coverVariant: 'song', coverBadge: '' };
  }
  if (task.category === 'peppa') {
    const match = title.match(/^S(\d)(\d{2})\s+(.+)$/i);
    if (match) {
      return {
        displayTitle: match[3],
        displaySubtitle: `${Number(match[1])}-${Number(match[2])}`,
        coverVariant: 'peppa',
        coverBadge: 'Peppa'
      };
    }
  }
  if (task.category === 'newconcept1' || task.category === 'newconcept2') {
    const levelNumber = task.category === 'newconcept1' ? 1 : 2;
    return {
      displayTitle: title,
      displaySubtitle: `New Concept English ${levelNumber}`,
      coverVariant: 'unlock',
      coverBadge: `New Concept ${levelNumber}`,
      coverMeta: `New Concept English ${levelNumber}`
    };
  }
  if (task.category === 'unlock1') {
    const match = title.match(/Unlock2e_A1_(\d+\.\d+)/i);
    return {
      displayTitle: match ? match[1] : title,
      displaySubtitle: 'A1 Listen & Speak',
      coverVariant: 'unlock',
      coverBadge: 'Unlock-1'
    };
  }
  if (task.category === 'song') {
    const match = title.match(/^0*([0-9]+)(?:[.\s_-]+)(.+)$/);
    return {
      displayTitle: match ? match[2].trim() : (title || 'Daily Song'),
      displaySubtitle: match ? `Song ${Number(match[1])}` : 'Super Simple Songs',
      coverVariant: 'song',
      coverBadge: 'Song'
    };
  }
  return {
    displayTitle: 'Daily Song',
      displaySubtitle: '等待 Songs 音频',
    coverVariant: 'song',
    coverBadge: 'Song'
  };
}

function getTaskReward(category, progress, task) {
  const nextStep = Math.min((progress && progress.playCount || 0) + 1, (task && task.repeatTarget) || 3);
  if (category === 'peppa') {
    return {
      rewardBadge: progress && progress.completedToday ? 'MUDDY BOOTS' : `PEPPA ${nextStep}`,
      rewardTitle: progress && progress.completedToday ? '泥坑探险章拿到了' : '泥坑探险线',
      rewardCopy: progress && progress.completedToday ? '这一集今天已经顺利通关。' : '前两遍盲听，最后一遍带文本高亮。'
    };
  }
  if (category === 'newconcept1' || category === 'newconcept2') {
    return {
      rewardBadge: category === 'newconcept1' ? 'NCE 1' : 'NCE 2',
      rewardTitle: category === 'newconcept1' ? 'New Concept 1' : 'New Concept 2',
      rewardCopy: progress && progress.completedToday ? '今天这条已经完成。' : '按三遍节奏听，第二遍专心盲听。'
    };
  }
  if (category === 'unlock1') {
    return {
      rewardBadge: progress && progress.completedToday ? 'UNLOCKED' : `UNLOCK ${nextStep}`,
      rewardTitle: progress && progress.completedToday ? '学习徽章已点亮' : '学习任务线',
      rewardCopy: progress && progress.completedToday ? '这一条已经听满 3 遍。'
        : nextStep < 3 ? '先把这条学习音频稳稳听完。'
          : (task && task.transcriptTrackId ? '最后一遍会带着文本一起听，像把这一关认真收尾。' : '最后一遍先按纯听力完成，文本高亮正在分批接入。')
    };
  }
  return {
    rewardBadge: progress && progress.completedToday ? 'SING STAR' : `SONG ${nextStep}`,
    rewardTitle: progress && progress.completedToday ? 'Songs 小星星到手了' : 'Songs 星星线',
    rewardCopy: progress && progress.completedToday ? '今天这首歌已经完成。' : ((task && task.syncGranularity === 'line') ? '这条 Songs 按句级文本同步，先把整句节奏听稳。' : '放入 Songs 后就会开始轮换。')
  };
}

function decorateTask(task, progress, category) {
  if (!task) {
    const emptyTask = category === 'unlock1'
      ? {
        taskId: 'unlock1-pending',
        category: 'unlock1',
        title: 'Unlock 1',
        subtitle: '检查云端 Unlock1 目录',
        audioUrl: '',
        audioCloudPath: '',
        audioFileId: '',
        audioSource: 'none',
        repeatTarget: 3,
        durationSec: 0,
        coverTone: 'peach',
        transcriptTrackId: null,
        textSource: null
      }
      : songPlaceholder;
    const base = getTaskPresentation(emptyTask);
    return Object.assign({}, emptyTask, base, {
      category,
      categoryLabel: getCategoryLabel(category),
      audioCompactTitle: '',
      playCount: 0,
      playStepText: '0/3',
      currentPass: 1,
      textUnlocked: false,
      completedToday: false,
      isPendingAsset: true,
      note: category === 'unlock1'
        ? 'Unlock1 音频暂时未就绪，先检查训练池或云目录。'
        : '把 Songs 音频放进来后，这里就会开始轮换。',
      rewardBadge: category === 'unlock1' ? 'UNLOCK 1' : 'SONG 1',
      rewardTitle: category === 'unlock1' ? '学习任务线' : 'Songs 星星线',
      rewardCopy: category === 'unlock1'
        ? 'Unlock1 素材恢复后，这条奖励线会继续推进。'
        : '把 Songs 音频和 bundle 放进来后，这条奖励线就会亮起来。'
    });
  }
  const base = getTaskPresentation(task);
  const completedCount = Math.min(progress.playCount, task.repeatTarget);
  const currentPass = progress.completedToday ? task.repeatTarget : Math.min(progress.playCount + 1, task.repeatTarget);
  const textUnlocked = progress.playCount >= task.repeatTarget - 1 || progress.completedToday;
  const transcriptTrackId = task.transcriptTrackId || null;
  const reward = getTaskReward(category, progress, Object.assign({}, task, { transcriptTrackId }));
  return Object.assign({}, task, base, {
    category,
    categoryLabel: getCategoryLabel(category),
    transcriptTrackId,
    syncGranularity: task.syncGranularity || 'word',
    audioDisplayName: getMediaDisplayName(task.audioUrl),
    audioCompactTitle: category === 'peppa'
      ? [base.displaySubtitle, base.displayTitle].filter(Boolean).join(' · ')
      : category === 'unlock1'
        ? [base.coverBadge, base.displayTitle].filter(Boolean).join(' · ')
        : [base.displayTitle, base.displaySubtitle].filter(Boolean).join(' · '),
    playCount: progress.playCount,
    playStepText: `${completedCount}/${task.repeatTarget}`,
    currentPass,
    textUnlocked,
    transcriptVisible: currentPass !== 2,
    completedToday: progress.completedToday,
    transcriptStatus: transcriptTrackId ? 'ready' : (task.textSource ? 'pending' : 'none'),
    transcriptBatch: task.transcriptBatch || null,
    note: currentPass < task.repeatTarget ? `先完成第 ${currentPass} 遍。`
      : (transcriptTrackId ? ((task.syncGranularity === 'line') ? '最后一遍会带句级文本。' : '最后一遍会带文本。') : task.textSource ? '最后一遍这条的逐句高亮还在准备中。' : '最后一遍按纯听力完成。'),
    rewardBadge: reward.rewardBadge,
    rewardTitle: reward.rewardTitle,
    rewardCopy: reward.rewardCopy
  });
}

function makeInviteCode() {
  return `YOYO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function makeChildLoginCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function makeUniqueChildLoginCode() {
  for (let i = 0; i < 12; i += 1) {
    const childLoginCode = makeChildLoginCode();
    const existing = (await db.collection('children').where({ childLoginCode }).limit(1).get()).data[0];
    if (!existing) {
      return childLoginCode;
    }
  }
  throw new Error('孩子 ID 生成失败，请稍后再试');
}

function buildAvatarTextFromNickname(nickname) {
  const text = String(nickname || '').trim();
  if (!text) {
    return 'YY';
  }
  const compact = text.replace(/\s+/g, '');
  if (compact === '佑佑') {
    return 'YY';
  }
  return compact.slice(0, 2).toUpperCase();
}

async function getMember(openId) {
  const res = await db.collection('familyMembers').where({ openId }).limit(1).get();
  return res.data[0] || null;
}

function getMemberIdentityKey(member) {
  return String((member && (member.openId || member.userId || member.memberId)) || '');
}

function normalizeAndDedupeMembers(members) {
  const unique = new Map();
  (members || []).forEach((member) => {
    const normalized = Object.assign({}, member, {
      studyRole: normalizeStudyRole(member)
    });
    const key = getMemberIdentityKey(normalized);
    if (!key) {
      unique.set(normalized.memberId || `member-${unique.size}`, normalized);
      return;
    }
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, normalized);
      return;
    }
    const existingUpdatedAt = String(existing.updatedAt || existing.createdAt || '');
    const nextUpdatedAt = String(normalized.updatedAt || normalized.createdAt || '');
    if (nextUpdatedAt >= existingUpdatedAt) {
      unique.set(key, Object.assign({}, normalized, {
        joinedFamilyAt: [existing.joinedFamilyAt, normalized.joinedFamilyAt, existing.createdAt, normalized.createdAt]
          .filter(Boolean)
          .sort()[0] || normalized.joinedFamilyAt || normalized.createdAt || ''
      }));
    }
  });
  return Array.from(unique.values()).sort((a, b) => {
    if (a.studyRole !== b.studyRole) {
      return a.studyRole === 'student' ? -1 : 1;
    }
    return String(a.joinedFamilyAt || a.createdAt || '').localeCompare(String(b.joinedFamilyAt || b.createdAt || ''));
  });
}

function buildUserId(openId) {
  return `user-${String(openId || '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

async function ensureUser(openId) {
  if (!openId) {
    const error = new Error('登录状态暂时不可用，请稍后再试');
    error.code = 'login-unavailable';
    throw error;
  }
  const now = new Date().toISOString();
  const existing = (await db.collection('users').where({ openId }).limit(1).get()).data[0];
  if (existing) {
    await db.collection('users').doc(existing._id).update({
      data: {
        lastLoginAt: now,
        updatedAt: now
      }
    });
    return Object.assign({}, existing, {
      lastLoginAt: now,
      updatedAt: now
    });
  }
  const user = {
    userId: buildUserId(openId),
    openId,
    unionId: '',
    nickName: '',
    avatarUrl: '',
    phoneNumberMasked: '',
    phoneBound: false,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now
  };
  await db.collection('users').add({ data: user });
  return user;
}

async function getFamily(familyId) {
  const res = await db.collection('families').doc(familyId).get().catch(() => ({ data: null }));
  return res.data || null;
}

async function getChild(familyId) {
  const res = await db.collection('children').where({ familyId }).limit(1).get();
  let child = res.data[0] || null;
  if (!child) {
    return null;
  }
  if (!/^\d{6}$/.test(String(child.childLoginCode || ''))) {
    const childLoginCode = await makeUniqueChildLoginCode();
    await db.collection('children').doc(child._id).update({
      data: {
        childLoginCode,
        updatedAt: new Date().toISOString()
      }
    });
    child = Object.assign({}, child, { childLoginCode });
  }
  return Object.assign({}, child, {
    avatarText: buildAvatarTextFromNickname(child.nickname || child.avatarText)
  });
}

async function updateChildProfile(familyId, payload) {
  const child = await getChild(familyId);
  if (!child) {
    throw new Error('孩子档案不存在');
  }
  const nickname = String((payload && payload.nickname) || '').trim();
  if (!nickname) {
    throw new Error('先填写孩子昵称');
  }
  const nextData = {
    nickname,
    avatarText: buildAvatarTextFromNickname(nickname),
    updatedAt: new Date().toISOString()
  };
  await db.collection('children').doc(child._id).update({
    data: nextData
  });
}

function normalizeStudyRole(member) {
  const studyRole = String((member && member.studyRole) || '').trim();
  if (studyRole === 'student' || studyRole === 'parent') {
    return studyRole;
  }
  return member && member.role === 'owner' ? 'student' : 'parent';
}

async function setExclusiveStudyRole(member, studyRole) {
  const now = new Date().toISOString();
  if (studyRole === 'student') {
    const familyMembers = (await db.collection('familyMembers').where({ familyId: member.familyId }).get()).data;
    await Promise.all(familyMembers
      .filter((item) => item._id)
      .map((item) => db.collection('familyMembers').doc(item._id).update({
        data: {
          studyRole: item.memberId === member.memberId ? 'student' : 'parent',
          updatedAt: now
        }
      })));
    return;
  }
  await db.collection('familyMembers').doc(member._id).update({
    data: {
      studyRole: 'parent',
      updatedAt: now
    }
  });
}

async function upsertFamilyMemberForFamily(openId, userId, familyId, displayName) {
  const memberRes = await db.collection('familyMembers').where({ openId }).get();
  let joinedMemberId = '';
  const existingMember = memberRes.data.find((item) => item.familyId === familyId) || memberRes.data[0];
  const now = new Date().toISOString();
  if (existingMember) {
    joinedMemberId = existingMember.memberId;
    await db.collection('familyMembers').doc(existingMember._id).update({
      data: {
        userId,
        familyId,
        displayName,
        role: existingMember.familyId === familyId ? (existingMember.role || 'parent') : 'parent',
        studyRole: existingMember.familyId === familyId ? normalizeStudyRole(existingMember) : 'parent',
        joinedFamilyAt: existingMember.familyId === familyId
          ? (existingMember.joinedFamilyAt || existingMember.createdAt || now)
          : now,
        updatedAt: now
      }
    });
  } else {
    joinedMemberId = `member-${Date.now()}`;
    await db.collection('familyMembers').add({
      data: {
        memberId: joinedMemberId,
        userId,
        familyId,
        openId,
        role: 'parent',
        studyRole: 'parent',
        displayName,
        subscriptionEnabled: false,
        joinedFamilyAt: now,
        createdAt: now
      }
    });
  }
  const preferenceRes = await db.collection('subscriptionPreferences').where({ memberId: joinedMemberId }).limit(1).get();
  if (preferenceRes.data[0]) {
    await db.collection('subscriptionPreferences').doc(preferenceRes.data[0]._id).update({
      data: {
        familyId
      }
    });
  } else if (joinedMemberId) {
    await db.collection('subscriptionPreferences').add({
      data: {
        memberId: joinedMemberId,
        familyId,
        dailyReportEnabled: false,
        lastAuthorizedAt: ''
      }
    });
  }
  return joinedMemberId;
}

async function ensureBootstrap(openId) {
  const user = await ensureUser(openId);
  let member = await getMember(openId);
  if (!member) {
    const familyId = `family-${Date.now()}`;
    const familyDoc = {
      familyId,
      name: '听力打卡家庭',
      inviteCode: makeInviteCode(),
      ownerOpenId: openId,
      createdAt: new Date().toISOString()
    };
    await db.collection('families').doc(familyId).set({ data: familyDoc });
    member = {
      familyId,
      memberId: `member-${Date.now()}`,
      userId: user.userId,
      openId,
      role: 'owner',
      studyRole: 'student',
      displayName: '我',
      subscriptionEnabled: false,
      joinedFamilyAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    await db.collection('familyMembers').add({ data: member });
    await db.collection('subscriptionPreferences').add({
      data: {
        memberId: member.memberId,
        familyId,
        dailyReportEnabled: false,
        lastAuthorizedAt: ''
      }
    });
    await db.collection('children').add({
      data: Object.assign({}, childTemplate, {
        familyId,
        childLoginCode: await makeUniqueChildLoginCode(),
        avatarText: buildAvatarTextFromNickname(childTemplate.nickname)
      })
    });
  } else if (!member.userId) {
    await db.collection('familyMembers').doc(member._id).update({
      data: {
        userId: user.userId
      }
    });
    member = Object.assign({}, member, { userId: user.userId });
  }
  if (!member.studyRole) {
    const studyRole = normalizeStudyRole(member);
    await db.collection('familyMembers').doc(member._id).update({
      data: {
        studyRole,
        updatedAt: new Date().toISOString()
      }
    });
    member = Object.assign({}, member, { studyRole });
  }
  const family = await getFamily(member.familyId);
  const child = await getChild(member.familyId);
  const members = normalizeAndDedupeMembers((await db.collection('familyMembers').where({ familyId: member.familyId }).get()).data);
  const subscriptionPreference = (await db.collection('subscriptionPreferences').where({ memberId: member.memberId }).limit(1).get()).data[0] || {
    memberId: member.memberId,
    familyId: member.familyId,
    dailyReportEnabled: !!member.subscriptionEnabled,
    lastAuthorizedAt: ''
  };
  return { user, family, member, child, members, subscriptionPreference };
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
  const res = await db.collection('dailyTaskProgress').where({ progressId }).limit(1).get();
  return res.data[0] || null;
}

async function saveProgressRecord(record) {
  const existing = await db.collection('dailyTaskProgress').where({
    familyId: record.familyId,
    childId: record.childId,
    date: record.date,
    category: record.category,
    taskId: record.taskId
  }).limit(1).get();
  if (existing.data[0]) {
    await db.collection('dailyTaskProgress').doc(existing.data[0]._id).update({ data: record });
  } else {
    await db.collection('dailyTaskProgress').add({ data: record });
  }
}

async function getChildProgressRecords(scope) {
  return (await db.collection('dailyTaskProgress').where({
    familyId: scope.familyId,
    childId: scope.childId
  }).get()).data;
}

async function getCheckins(scope) {
  return (await db.collection('dailyCheckins').where({
    familyId: scope.familyId,
    childId: scope.childId
  }).get()).data;
}

function getUniqueDates(records) {
  return Array.from(new Set(records.map((item) => item.date))).sort((a, b) => b.localeCompare(a));
}

function addDays(date, delta) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + delta);
  return next.toISOString().slice(0, 10);
}

function diffDays(a, b) {
  const left = new Date(`${a}T00:00:00`).getTime();
  const right = new Date(`${b}T00:00:00`).getTime();
  return Math.round((left - right) / (24 * 60 * 60 * 1000));
}

function computeStreak(records, today) {
  const uniqueDates = getUniqueDates(records);
  if (!uniqueDates.length) return 0;
  if (uniqueDates[0] !== today && diffDays(today, uniqueDates[0]) > 1) return 0;
  let streak = uniqueDates[0] === today ? 1 : 0;
  let cursor = uniqueDates[0] === today ? today : addDays(today, -1);
  if (uniqueDates[0] !== today && uniqueDates[0] === addDays(today, -1)) {
    streak = 1;
    cursor = uniqueDates[0];
  }
  for (let i = 1; i < uniqueDates.length; i += 1) {
    const expected = addDays(cursor, -1);
    if (uniqueDates[i] === expected) {
      streak += 1;
      cursor = uniqueDates[i];
    } else {
      break;
    }
  }
  return streak;
}

const PLAN_SLOT_COUNT = 24;
const PLAN_PHASES = [
  { key: 'round-1', label: '第1轮', startDay: 1, length: 38, batchSize: 1 },
  { key: 'round-2', label: '第2轮', startDay: 39, length: 8, batchSize: 3 },
  { key: 'round-3', label: '第3轮', startDay: 47, length: 6, batchSize: 4 }
];
const TOTAL_PLAN_DAYS = PLAN_PHASES.reduce((sum, phase) => sum + phase.length, 0);

function getPlanPhase(dayIndex) {
  return PLAN_PHASES.find((phase) => dayIndex >= phase.startDay && dayIndex < phase.startDay + phase.length) || PLAN_PHASES[0];
}

function getPlanCategoryOrder(dayIndex) {
  return ['newconcept1', 'peppa', 'unlock1', 'song'];
}

function getPlanCategoryBatchSize(dayIndex, category) {
  if (category === 'newconcept1') {
    return 2;
  }
  const phase = getPlanPhase(dayIndex);
  return phase.batchSize;
}

function getPlanDayIndex(checkins) {
  const completedDays = Array.isArray(checkins) ? checkins.length : 0;
  return (completedDays % TOTAL_PLAN_DAYS) + 1;
}

function getPlanDayIndexForDate(checkins, date) {
  const records = Array.isArray(checkins) ? checkins : [];
  const sameDay = records.find((item) => item.date === date && item.planDayIndex);
  if (sameDay) {
    return Number(sameDay.planDayIndex) || 1;
  }
  const previousCount = records.filter((item) => String(item.date || '') < date).length;
  return (previousCount % TOTAL_PLAN_DAYS) + 1;
}

function getDatePart(value) {
  return String(value || '').slice(0, 10);
}

function getCompletedDateSet(checkins) {
  return new Set((Array.isArray(checkins) ? checkins : []).map((item) => item.date).filter(Boolean));
}

function getEarliestMissedDate(checkins, today, planStartDate) {
  const completedDates = getCompletedDateSet(checkins);
  let cursor = planStartDate || today;
  while (cursor < today) {
    if (!completedDates.has(cursor)) {
      return cursor;
    }
    cursor = addDays(cursor, 1);
  }
  return '';
}

function hasCatchupToday(checkins, today) {
  return (Array.isArray(checkins) ? checkins : []).some((item) => (
    item.planRunType === 'catchup' && getDatePart(item.completedAt) === today
  ));
}

function getPlanStartDate(ctx, today) {
  return getDatePart((ctx && ctx.family && ctx.family.createdAt) || today) || today;
}

function buildCatchupState(checkins, today, planStartDate, todayDone) {
  const missedDate = getEarliestMissedDate(checkins, today, planStartDate);
  const usedToday = hasCatchupToday(checkins, today);
  const canCatchup = !!(todayDone && missedDate && !usedToday);
  const planDayIndex = canCatchup ? getPlanDayIndex(checkins) : 0;
  return {
    canCatchup,
    missedDate,
    planDayIndex,
    usedToday,
    reason: canCatchup
      ? 'ready'
      : (!todayDone ? 'finish-current-plan-first' : usedToday ? 'catchup-used-today' : 'no-missed-date')
  };
}

function getPlanCatalog(category) {
  if (category === 'newconcept1') {
    return getCatalog(category).slice(0, 76);
  }
  return getCatalog(category).slice(0, PLAN_SLOT_COUNT);
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
  const tasks = getCatalog(category).slice(0, options.limit || 1);
  const task = tasks[0] ? decorateTask(tasks[0], buildEmptyProgress(), category) : buildCategorySummary([], category);
  return {
    category,
    categoryLabel: getCategoryLabel(category),
    totalCount: getCatalog(category).length,
    completedCount: 0,
    todayTask: task,
    isPendingAsset: !tasks.length || task.isPendingAsset,
    todayTaskCount: tasks.length ? 1 : 0
  };
}

async function listDirectAudioTasksForCategory(category) {
  const roots = STORAGE_ROOT_CANDIDATES[category] || [STORAGE_ROOTS[category]];
  for (const rootPath of roots.filter(Boolean)) {
    try {
      const files = await listDirectoryFiles(rootPath);
      const audioFiles = files.filter((item) => AUDIO_FILE_PATTERN.test(item.cloudPath)).sort(sortFilesByPath);
      if (!audioFiles.length) {
        continue;
      }
      return audioFiles.map((file, index) => {
        const audioBaseName = getBaseName(file.cloudPath);
        const inferred = inferNewConceptTaskMeta(category, audioBaseName, index);
        return buildCloudTask(null, {
          taskId: inferred.taskId,
          category,
          title: inferred.title,
          subtitle: inferred.subtitle,
          repeatTarget: 3,
          durationSec: 180,
          coverTone: inferred.coverTone,
          transcriptTrackId: inferred.transcriptTrackId,
          transcriptTrackCandidates: inferred.transcriptTrackCandidates,
          transcriptStatus: 'ready',
          transcriptBatch: inferred.transcriptBatch,
          syncGranularity: inferred.syncGranularity,
          audioTitle: audioBaseName,
          audioUrl: buildCloudAssetUrl(file.cloudPath),
          audioCloudPath: file.cloudPath,
          audioFileId: file.fileId,
          audioSource: 'static-cloud-url',
          textSource: inferred.textSource
        });
      });
    } catch (error) {
      // try next candidate root
    }
  }
  return [];
}

async function resolveStandaloneCategoryTasks(category, childId, date) {
  if (category !== 'newconcept2') {
    return [];
  }
  const tasks = await listDirectAudioTasksForCategory(category);
  return tasks.map((task) => Object.assign({}, task, {
    planDayIndex: 1,
    planPhase: 'level',
    planPhaseLabel: 'A2',
    targetDate: date,
    planRunType: 'level'
  }));
}

function getPlanIndicesForDay(dayIndex, category) {
  const phase = getPlanPhase(dayIndex);
  const dayOffset = dayIndex - phase.startDay;
  const batchSize = getPlanCategoryBatchSize(dayIndex, category);
  const startIndex = dayOffset * batchSize;
  const indices = [];
  for (let step = 0; step < batchSize; step += 1) {
    indices.push(startIndex + step);
  }
  return {
    phase,
    indices,
    batchSize
  };
}

function buildPlanForDay(dayIndex) {
  const phase = getPlanPhase(dayIndex);
  const byCategory = {};
  const flatTasks = [];
  getPlanCategoryOrder(dayIndex).forEach((category) => {
    const { indices, batchSize } = getPlanIndicesForDay(dayIndex, category);
    const catalog = getPlanCatalog(category);
    const tasks = indices
      .map((index) => catalog[index] || null)
      .filter(Boolean);
    byCategory[category] = tasks;
    tasks.forEach((task, slotIndex) => {
      flatTasks.push(Object.assign({}, task, {
        planDayIndex: dayIndex,
        planPhase: phase.key,
        planPhaseLabel: phase.label,
        planBatchSize: batchSize,
        planSlotIndex: slotIndex + 1,
        planSlotCount: tasks.length
      }));
    });
  });
  return {
    dayIndex,
    phase,
    byCategory,
    flatTasks
  };
}

function decoratePlanTasks(progressRecords, childId, date, plan, options = {}) {
  return getPlanCategoryOrder(plan.dayIndex).flatMap((category) => (
    decoratePlannedTasks(progressRecords, childId, category, date, plan.byCategory[category] || [], {
      planRunType: options.planRunType || 'normal',
      targetDate: date,
      planDayIndex: plan.dayIndex
    })
  ));
}

function buildEmptyProgress() {
  return {
    playCount: 0,
    textUnlocked: false,
    completedToday: false
  };
}

function getTaskProgressForDate(progressRecords, childId, category, date, taskId, options = {}) {
  const exact = progressRecords.find((item) => (
    item.childId === childId
      && item.category === category
      && item.date === date
      && item.taskId === taskId
  ));
  if (exact) {
    return exact;
  }
  if (options.allowLegacyRecord) {
    const legacy = progressRecords.find((item) => (
      item.childId === childId
        && item.category === category
        && item.date === date
        && !item.taskId
    ));
    if (legacy) {
      return legacy;
    }
  }
  return buildEmptyProgress();
}

function decoratePlannedTasks(progressRecords, childId, category, date, tasks, options = {}) {
  return tasks.map((task, index) => {
    const plannedTask = Object.assign({}, task, {
      planPhase: task.planPhase || (options.planDayIndex ? getPlanPhase(options.planDayIndex).key : ''),
      planPhaseLabel: task.planPhaseLabel || (options.planDayIndex ? getPlanPhase(options.planDayIndex).label : ''),
      planDayIndex: options.planDayIndex || task.planDayIndex || 0
    });
    const progress = getTaskProgressForDate(
      progressRecords,
      childId,
      category,
      date,
      plannedTask.taskId,
      { allowLegacyRecord: tasks.length === 1 && index === 0 }
    );
    return Object.assign({}, decorateTask(plannedTask, progress, category), {
      planRunType: options.planRunType || 'normal',
      targetDate: options.targetDate || date,
      planDayIndex: plannedTask.planDayIndex
    });
  });
}

function buildCategorySummary(categoryTasks, category) {
  if (!categoryTasks.length) {
    return decorateTask(null, buildEmptyProgress(), category);
  }
  const nextTask = categoryTasks.find((item) => !item.completedToday) || categoryTasks[0];
  return Object.assign({}, nextTask, {
    plannedTaskCount: categoryTasks.length,
    completedTaskCount: categoryTasks.filter((item) => item.completedToday).length
  });
}

function buildStats(progressRecords, checkins, childId) {
  const completedProgress = progressRecords.filter((item) => item.childId === childId && item.completedToday);
  const totalMinutes = completedProgress.reduce((sum, item) => {
    const task = getCatalog(item.category).find((entry) => entry.taskId === item.taskId);
    return task ? sum + Math.round((task.durationSec * task.repeatTarget) / 60) : sum;
  }, 0);
  const today = new Date().toISOString().slice(0, 10);
  const latestCheckin = checkins.slice().sort((a, b) => {
    const left = String(a.completedAt || a.date || '');
    const right = String(b.completedAt || b.date || '');
    return right.localeCompare(left);
  })[0] || null;
  return {
    streakDays: computeStreak(checkins, today),
    completedDays: checkins.length,
    completedLessons: checkins.length,
    completedTasks: completedProgress.length,
    totalMinutes,
    lastCheckinAt: latestCheckin ? latestCheckin.completedAt || '' : '',
    lastCheckinDate: latestCheckin ? latestCheckin.date || '' : ''
  };
}

async function maybeCreateCheckin(scope, progressRecords, date, options = {}) {
  const checkins = await getCheckins(scope);
  const planRunType = options.planRunType || 'normal';
  const planDayIndex = Number(options.planDayIndex || 0) || getPlanDayIndex(checkins);
  const todayPlan = buildPlanForDay(planDayIndex);
  const plannedTasks = todayPlan.flatTasks;
  const activeTasks = plannedTasks.filter((task) => !task.isPendingAsset);
  const allDone = activeTasks.every((task, index) => {
    const progress = getTaskProgressForDate(
      progressRecords,
      scope.childId,
      task.category,
      date,
      task.taskId,
      { allowLegacyRecord: activeTasks.length === 1 && index === 0 }
    );
    return !!progress.completedToday;
  });
  if (!allDone) return null;
  const recordId = `${scope.familyId}_${scope.childId}_${date}`;
  const existing = checkins.find((item) => item.recordId === recordId || item.date === date);
  const streakSnapshot = computeStreak(checkins.filter((item) => item.recordId !== recordId), date) + (existing ? 0 : 1);
  const next = {
    recordId,
    userId: scope.userId,
    openId: scope.openId,
    memberId: scope.memberId,
    familyId: scope.familyId,
    childId: scope.childId,
    date,
    completedAt: new Date().toISOString(),
    streakSnapshot,
    completedCategories: Array.from(new Set(activeTasks.map((task) => task.category))),
    planDayIndex: todayPlan.dayIndex,
    planPhase: todayPlan.phase.key,
    planRunType,
    makeupForDate: planRunType === 'catchup' ? date : ''
  };
  if (existing) {
    await db.collection('dailyCheckins').doc(existing._id).update({ data: next });
  } else {
    await db.collection('dailyCheckins').add({ data: next });
  }
  await upsertDailyReport(scope, date);
  return next;
}

async function clearTodayUnconfirmedListens(ctx) {
  const today = new Date().toISOString().slice(0, 10);
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
  await Promise.all(candidates.map((item) => db.collection('dailyTaskProgress').doc(item._id).update({
    data: {
      playCount: 0,
      textUnlocked: false,
      completedToday: false,
      updatedAt: now,
      lastUndoAt: now,
      lastUndoByMemberId: scope.memberId
    }
  })));
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
  const progressRecords = await getChildProgressRecords(scope);
  const checkins = await getCheckins(scope);
  const todayPlan = buildPlanForDay(getPlanDayIndexForDate(checkins, date));
  const groupedTasks = getPlanCategoryOrder(todayPlan.dayIndex).map((category) => ({
    category,
    tasks: decoratePlannedTasks(progressRecords, scope.childId, category, date, todayPlan.byCategory[category] || [], {
      planRunType: 'normal',
      targetDate: date,
      planDayIndex: todayPlan.dayIndex
    })
  }));
  const items = groupedTasks.flatMap((group) => group.tasks.map((task) => ({
    category: group.category,
    categoryLabel: task.categoryLabel,
    taskId: task.taskId,
    title: task.audioCompactTitle || task.displayTitle || task.title,
    playCount: task.playCount || 0,
    repeatTarget: task.repeatTarget || 3,
    completedToday: !!task.completedToday
  })));
  const report = {
    reportId: `${scope.familyId}_${scope.childId}_${date}`,
    userId: scope.userId,
    openId: scope.openId,
    memberId: scope.memberId,
    familyId: scope.familyId,
    childId: scope.childId,
    date,
    completedCategories: Array.from(new Set(items.filter((item) => item.completedToday).map((item) => item.category))),
    totalMinutes: items.reduce((sum, item) => {
      if (!item.completedToday) {
        return sum;
      }
      const task = getCatalog(item.category).find((entry) => entry.taskId === item.taskId);
      return task ? sum + Math.round((task.durationSec * task.repeatTarget) / 60) : sum;
    }, 0),
    streakSnapshot: (checkins.find((item) => item.date === date) || {}).streakSnapshot || 0,
    planDayIndex: todayPlan.dayIndex,
    planPhase: todayPlan.phase.key,
    items,
    pushStatus: 'in-app-ready',
    inAppVisible: true,
    updatedAt: new Date().toISOString()
  };
  const subscribers = (await db.collection('familyMembers').where({ familyId: scope.familyId, subscriptionEnabled: true }).get()).data;
  if (subscribers.length) {
    report.pushStatus = 'subscription-ready';
  }
  const existing = await db.collection('dailyReports').where({
    familyId: scope.familyId,
    childId: scope.childId,
    date
  }).limit(1).get();
  if (existing.data[0]) {
    await db.collection('dailyReports').doc(existing.data[0]._id).update({ data: report });
  } else {
    await db.collection('dailyReports').add({ data: report });
  }
  return report;
}

async function getDashboardData(ctx) {
  const today = new Date().toISOString().slice(0, 10);
  const scope = getUserScope(ctx);
  const progressRecords = await getChildProgressRecords(scope);
  const checkins = await getCheckins(scope);
  const planDayIndex = getPlanDayIndex(checkins);
  const todayPlan = buildPlanForDay(planDayIndex);
  const categorySummaries = getPlanCategoryOrder(todayPlan.dayIndex).map((category) => {
    const plannedTasks = decoratePlannedTasks(progressRecords, ctx.child.childId, category, today, todayPlan.byCategory[category] || [], {
      planRunType: 'normal',
      targetDate: today,
      planDayIndex: todayPlan.dayIndex
    });
    return buildCategorySummary(plannedTasks, category);
  });
  const dailyTasks = decoratePlanTasks(progressRecords, ctx.child.childId, today, todayPlan, {
    planRunType: 'normal'
  });
  const activeTaskCount = dailyTasks.filter((item) => !item.isPendingAsset).length;
  const completedTaskCountToday = dailyTasks.filter((item) => item.completedToday).length;
  const todayDone = activeTaskCount > 0 && activeTaskCount === completedTaskCountToday;
  const catchupState = buildCatchupState(checkins, today, getPlanStartDate(ctx, today), todayDone);
  return {
    user: ctx.user,
    currentUser: ctx.user,
    currentMember: ctx.member,
    family: ctx.family,
    child: Object.assign({}, ctx.child, {
      totalCompleted: checkins.length,
      streakDays: buildStats(progressRecords, checkins, ctx.child.childId).streakDays
    }),
    stats: buildStats(progressRecords, checkins, ctx.child.childId),
    planDayIndex,
    planPhase: todayPlan.phase.key,
    planPhaseLabel: todayPlan.phase.label,
    planTaskCount: activeTaskCount,
    peppaTask: categorySummaries.find((item) => item.category === 'peppa'),
    unlockTask: categorySummaries.find((item) => item.category === 'unlock1'),
    songTask: categorySummaries.find((item) => item.category === 'song'),
    categorySummaries,
    dailyTasks,
    planDebug: {
      day1Categories: getPlanCategoryOrder(planDayIndex),
      catalogCounts: {
        newconcept1: getCatalog('newconcept1').length,
        peppa: getCatalog('peppa').length,
        unlock1: getCatalog('unlock1').length,
        song: getCatalog('song').length
      },
      todayTaskCounts: getPlanCategoryOrder(planDayIndex).reduce((acc, category) => {
        acc[category] = (todayPlan.byCategory[category] || []).length;
        return acc;
      }, {})
    },
    catchupState,
    activeTaskCount,
    completedTaskCountToday,
    allDailyDone: todayDone
  };
}

async function handleAction(event, context) {
  const action = String((event && event.action) || '').trim();
  const requestedCategory = String((event && event.payload && event.payload.category) || '').trim();
  let catalogCategories = ['newconcept1', 'song'];
  if (action === 'getLevelOverview') {
    catalogCategories = ['newconcept1', 'newconcept2', 'song'];
  } else if (action === 'getTaskDetail' || action === 'markTaskListened') {
    if (requestedCategory === 'newconcept1' || requestedCategory === 'newconcept2' || requestedCategory === 'song' || requestedCategory === 'unlock1') {
      catalogCategories = [requestedCategory];
    } else {
      catalogCategories = [];
    }
  } else if (action === 'getTaskTranscript') {
    catalogCategories = [];
  } else if (action === 'getFamilyPage' || action === 'refreshInviteCode' || action === 'joinFamily' || action === 'joinFamilyByChildCode' || action === 'updateChildProfile' || action === 'setStudyRole' || action === 'updateSubscription' || action === 'bootstrap') {
    catalogCategories = [];
  }
  await refreshRuntimeCatalogs(false, catalogCategories);
  await ensureRequiredCollectionsReady();
  const { OPENID } = cloud.getWXContext();
  const ctx = await ensureBootstrap(OPENID);
  const today = new Date().toISOString().slice(0, 10);

  if (action === 'bootstrap') {
    return ctx;
  }
  if (action === 'getDashboard') {
    return getDashboardData(ctx);
  }
  if (action === 'getLevelOverview') {
    const dashboard = await getDashboardData(ctx);
    const progressRecords = await getChildProgressRecords(getUserScope(ctx));
    const a2DirectTasks = await listDirectAudioTasksForCategory('newconcept2');
    const a2Overview = a2DirectTasks.length
      ? [{
        category: 'newconcept2',
        categoryLabel: getCategoryLabel('newconcept2'),
        totalCount: a2DirectTasks.length,
        completedCount: 0,
        todayTask: decorateTask(a2DirectTasks[0], buildEmptyProgress(), 'newconcept2'),
        isPendingAsset: false,
        todayTaskCount: 1
      }]
      : [buildLevelCatalogEntry('newconcept2', { limit: 1 })];
    return {
      user: ctx.user,
      currentUser: ctx.user,
      currentMember: ctx.member,
      child: ctx.child,
      level,
      stats: dashboard.stats,
      categories: getPlanCategoryOrder(dashboard.planDayIndex).map((category) => {
        const task = dashboard.categorySummaries.find((item) => item.category === category);
        const fallbackTask = buildCategorySummary([], category);
        const todayTask = task || fallbackTask;
        return {
          category,
          categoryLabel: getCategoryLabel(category),
          totalCount: getPlanCatalog(category).length,
          completedCount: (dashboard.stats.completedTasks || 0),
          todayTask,
          isPendingAsset: todayTask.isPendingAsset,
          todayTaskCount: todayTask.plannedTaskCount || 0
        };
      }),
      a2Categories: a2Overview,
      levelDebug: {
        newconcept2CatalogCount: getCatalog('newconcept2').length,
        newconcept2DirectCount: a2DirectTasks.length,
        resourceDebug: getResourceDebugSnapshot()
      },
      planDayIndex: dashboard.planDayIndex,
      planPhaseLabel: dashboard.planPhaseLabel
    };
  }
  if (action === 'getTaskDetail') {
    const dashboard = await getDashboardData(ctx);
    let planRunType = String((event.payload && event.payload.planRunType) || 'normal');
    let targetDate = String((event.payload && event.payload.targetDate) || today).slice(0, 10);
    if (
      planRunType === 'catchup'
      && (!dashboard.catchupState.canCatchup || targetDate !== dashboard.catchupState.missedDate)
    ) {
      planRunType = 'normal';
      targetDate = today;
    }
    const targetPlanDayIndex = planRunType === 'catchup'
      ? Number((event.payload && event.payload.planDayIndex) || 0) || dashboard.catchupState.planDayIndex || dashboard.planDayIndex
      : dashboard.planDayIndex;
    const targetPlan = planRunType === 'catchup'
      ? buildPlanForDay(targetPlanDayIndex)
      : null;
    const progressRecords = await getChildProgressRecords(getUserScope(ctx));
    const categoryTasks = event.payload.category === 'newconcept2'
      ? decoratePlannedTasks(progressRecords, ctx.child.childId, event.payload.category, targetDate, await resolveStandaloneCategoryTasks('newconcept2', ctx.child.childId, targetDate), {
        planRunType: 'level',
        targetDate,
        planDayIndex: 1
      })
      : planRunType === 'catchup'
      ? decoratePlannedTasks(progressRecords, ctx.child.childId, event.payload.category, targetDate, targetPlan.byCategory[event.payload.category] || [], {
        planRunType: 'catchup',
        targetDate,
        planDayIndex: targetPlan.dayIndex
      })
      : dashboard.dailyTasks.filter((item) => item.category === event.payload.category);
    const task = categoryTasks.find((item) => item.taskId === event.payload.taskId)
      || categoryTasks.find((item) => !item.completedToday)
      || categoryTasks[0]
      || decorateTask(null, buildEmptyProgress(), event.payload.category);
    const scope = getUserScope(ctx);
    const history = progressRecords
      .filter((item) => item.category === event.payload.category && item.completedToday)
      .map((item) => ({
        date: item.date,
        taskTitle: item.taskId,
        playCount: item.playCount
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    const todayRecord = (await getCheckins(scope)).find((item) => item.date === today) || null;
    const checkinReady = normalizeStudyRole(ctx.member) === 'student'
      && planRunType === 'normal'
      && targetDate === today
      && dashboard.allDailyDone
      && !todayRecord;
    return {
      user: ctx.user,
      currentUser: ctx.user,
      currentMember: ctx.member,
      child: ctx.child,
      stats: dashboard.stats,
      task,
      progress: {
        playCount: task.playCount,
        playStepText: task.playStepText,
        currentPass: task.currentPass,
        repeatTarget: task.repeatTarget,
        textUnlocked: task.textUnlocked,
        transcriptVisible: task.transcriptVisible,
        completedToday: task.completedToday
      },
      categoryTasks,
      categoryTaskCount: categoryTasks.length,
      categoryCompletedCount: categoryTasks.filter((item) => item.completedToday).length,
      planDayIndex: targetPlanDayIndex,
      planPhaseLabel: planRunType === 'catchup' ? (targetPlan.phase.label || dashboard.planPhaseLabel) : dashboard.planPhaseLabel,
      planRunType,
      targetDate,
      scriptSource: task.textSource || null,
      transcriptTrack: null,
      transcriptLines: [],
      transcriptPendingLoad: true,
      todayRecord,
      history,
      studyWriteAllowed: normalizeStudyRole(ctx.member) === 'student',
      studyWriteMessage: normalizeStudyRole(ctx.member) === 'student' ? '' : '家长模式，不计入打卡',
      checkinReady
    };
  }
  if (action === 'getTaskTranscript') {
    let task = Object.assign({}, event.payload && event.payload.taskSnapshot ? event.payload.taskSnapshot : {}, {
      category: requestedCategory || ((event.payload && event.payload.taskSnapshot && event.payload.taskSnapshot.category) || ''),
      taskId: String((event.payload && event.payload.taskId) || ((event.payload && event.payload.taskSnapshot && event.payload.taskSnapshot.taskId) || '')).trim()
    });
    if (requestedCategory === 'newconcept2') {
      const standaloneTasks = await resolveStandaloneCategoryTasks('newconcept2', ctx.child.childId, today);
      task = standaloneTasks.find((item) => item.taskId === task.taskId) || standaloneTasks[0] || task;
    }
    task = task.taskId ? task : decorateTask(null, buildEmptyProgress(), requestedCategory);
    const transcriptBundle = await getTranscriptBundle(task);
    return {
      task,
      scriptSource: task.textSource || null,
      transcriptTrack: transcriptBundle.transcriptTrack,
      transcriptLines: transcriptBundle.transcriptLines,
      transcriptPendingLoad: false
    };
  }
  if (action === 'markTaskListened') {
    const category = event.payload.category;
    const scope = getUserScope(ctx);
    const progressRecords = await getChildProgressRecords(scope);
    const checkins = await getCheckins(scope);
    const planRunType = String((event.payload && event.payload.planRunType) || 'normal');
    const targetDate = String((event.payload && event.payload.targetDate) || today).slice(0, 10);
    if (normalizeStudyRole(ctx.member) !== 'student') {
      return Object.assign(
        await handleAction({ action: 'getTaskDetail', payload: { category, taskId: event.payload.taskId, planRunType, targetDate, planDayIndex: event.payload.planDayIndex } }, context),
        {
          studyWriteAllowed: false,
          studyWriteMessage: '家长模式，不计入打卡'
        }
      );
    }
    if (planRunType === 'catchup') {
      const normalPlan = buildPlanForDay(getPlanDayIndex(checkins));
      const normalTasks = decoratePlanTasks(progressRecords, ctx.child.childId, today, normalPlan, {
        planRunType: 'normal'
      });
      const normalDone = normalTasks.length > 0 && normalTasks.every((item) => item.completedToday);
      const catchupState = buildCatchupState(checkins, today, getPlanStartDate(ctx, today), normalDone);
      const requestedPlanDayIndex = Number((event.payload && event.payload.planDayIndex) || 0);
      if (
        !catchupState.canCatchup
        || targetDate !== catchupState.missedDate
        || (requestedPlanDayIndex && requestedPlanDayIndex !== catchupState.planDayIndex)
      ) {
        throw new Error('请先完成当前计划后，再追赶一批任务');
      }
    }
    const todayPlan = buildPlanForDay(
      planRunType === 'catchup'
        ? (Number((event.payload && event.payload.planDayIndex) || 0) || getPlanDayIndex(checkins))
        : getPlanDayIndex(checkins)
    );
    const categoryTasks = category === 'newconcept2'
      ? decoratePlannedTasks(progressRecords, ctx.child.childId, category, targetDate, await resolveStandaloneCategoryTasks('newconcept2', ctx.child.childId, targetDate), {
        planRunType: 'level',
        targetDate,
        planDayIndex: 1
      })
      : decoratePlannedTasks(progressRecords, ctx.child.childId, category, targetDate, todayPlan.byCategory[category] || [], {
        planRunType,
        targetDate,
        planDayIndex: todayPlan.dayIndex
      });
    const task = categoryTasks.find((item) => item.taskId === event.payload.taskId)
      || categoryTasks.find((item) => !item.completedToday)
      || categoryTasks[0];
    if (!task || task.isPendingAsset || task.completedToday) {
      return handleAction({ action: 'getTaskDetail', payload: { category, taskId: event.payload.taskId, planRunType, targetDate, planDayIndex: todayPlan.dayIndex } }, context);
    }
    const nextPlayCount = Math.min((task.playCount || 0) + 1, task.repeatTarget);
    const record = {
      progressId: `${scope.familyId}_${scope.childId}_${targetDate}_${category}_${task.taskId}`,
      userId: scope.userId,
      openId: scope.openId,
      memberId: scope.memberId,
      familyId: scope.familyId,
      childId: scope.childId,
      category,
      date: targetDate,
      taskId: task.taskId,
      playCount: nextPlayCount,
      repeatTarget: task.repeatTarget,
      textUnlocked: nextPlayCount >= task.repeatTarget - 1,
      completedToday: nextPlayCount >= task.repeatTarget,
      planDayIndex: todayPlan.dayIndex,
      planRunType,
      targetDate,
      makeupForDate: planRunType === 'catchup' ? targetDate : '',
      updatedAt: new Date().toISOString()
    };
    await saveProgressRecord(record);
    if (planRunType === 'catchup') {
      const nextProgressRecords = await getChildProgressRecords(scope);
      await maybeCreateCheckin(scope, nextProgressRecords, targetDate, {
        planRunType,
        planDayIndex: todayPlan.dayIndex
      });
    }
    return handleAction({ action: 'getTaskDetail', payload: { category, planRunType, targetDate, planDayIndex: todayPlan.dayIndex } }, context);
  }
  if (action === 'completeTodayCheckin') {
    if (normalizeStudyRole(ctx.member) !== 'student') {
      throw new Error('家长模式不计入打卡');
    }
    const scope = getUserScope(ctx);
    const progressRecords = await getChildProgressRecords(scope);
    const checkins = await getCheckins(scope);
    const planDayIndex = getPlanDayIndex(checkins);
    const checkin = await maybeCreateCheckin(scope, progressRecords, today, {
      planRunType: 'normal',
      planDayIndex
    });
    if (!checkin) {
      throw new Error('今天还没全部听完');
    }
    const dashboard = await getDashboardData(ctx);
    return {
      user: ctx.user,
      currentUser: ctx.user,
      currentMember: ctx.member,
      family: ctx.family,
      child: dashboard.child,
      stats: dashboard.stats,
      todayRecord: checkin,
      dailyTasks: dashboard.dailyTasks,
      activeTaskCount: dashboard.activeTaskCount,
      completedTaskCountToday: dashboard.completedTaskCountToday,
      allDailyDone: dashboard.allDailyDone,
      checkinReady: false
    };
  }
  if (action === 'getProfileData') {
    const dashboard = await getDashboardData(ctx);
    return {
      user: ctx.user,
      currentUser: ctx.user,
      child: Object.assign({}, ctx.child, dashboard.stats),
      level,
      familyReady: true,
      family: ctx.family,
      members: ctx.members,
      currentMember: ctx.member,
      subscriptionPreference: ctx.subscriptionPreference
    };
  }
  if (action === 'getHeatmap') {
    const days = Number(event.payload.days || 28);
    const scope = getUserScope(ctx);
    const records = await getCheckins(scope);
    const progressRecords = await getChildProgressRecords(scope);
    const counts = {};
    records.forEach((item) => {
      counts[item.date] = (counts[item.date] || 0) + 1;
    });
    const todayPlan = buildPlanForDay(getPlanDayIndex(records));
    const todayTasks = decoratePlanTasks(progressRecords, ctx.child.childId, today, todayPlan, {
      planRunType: 'normal'
    });
    const todayDone = todayTasks.length > 0 && todayTasks.every((item) => item.completedToday);
    const catchupState = buildCatchupState(records, today, getPlanStartDate(ctx, today), todayDone);
    const catchupPlan = catchupState.canCatchup ? buildPlanForDay(catchupState.planDayIndex) : null;
    const catchupTasks = catchupPlan
      ? decoratePlanTasks(progressRecords, ctx.child.childId, catchupState.missedDate, catchupPlan, {
        planRunType: 'catchup'
      })
      : [];
    const heatmap = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = addDays(today, -i);
      const count = counts[date] || 0;
      heatmap.push({
        date,
        shortDate: date.slice(5),
        count,
        intensity: Math.min(count, 3),
        completed: count > 0,
        isCatchupTarget: catchupState.missedDate === date
      });
    }
    return {
      heatmap,
      catchupState,
      catchupTasks
    };
  }
  if (action === 'getMonthHeatmap') {
    const year = Number(event.payload.year || today.slice(0, 4));
    const month = Number(event.payload.month || today.slice(5, 7));
    const monthText = `${year}-${String(month).padStart(2, '0')}`;
    const scope = getUserScope(ctx);
    const records = await getCheckins(scope);
    const progressRecords = await getChildProgressRecords(scope);
    const counts = {};
    records.forEach((item) => {
      if (String(item.date || '').slice(0, 7) === monthText) {
        counts[item.date] = (counts[item.date] || 0) + 1;
      }
    });
    const todayPlan = buildPlanForDay(getPlanDayIndex(records));
    const todayTasks = decoratePlanTasks(progressRecords, ctx.child.childId, today, todayPlan, {
      planRunType: 'normal'
    });
    const todayDone = todayTasks.length > 0 && todayTasks.every((item) => item.completedToday);
    const catchupState = buildCatchupState(records, today, getPlanStartDate(ctx, today), todayDone);
    const daysInMonth = new Date(year, month, 0).getDate();
    const heatmap = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${monthText}-${String(day).padStart(2, '0')}`;
      const count = counts[date] || 0;
      heatmap.push({
        date,
        shortDate: date.slice(5),
        count,
        intensity: Math.min(count, 3),
        completed: count > 0,
        isToday: date === today,
        isCatchupTarget: catchupState.missedDate === date
      });
    }
    return {
      year,
      month,
      heatmap,
      catchupState
    };
  }
  if (action === 'getDailyReportByDate') {
    const date = String((event.payload && event.payload.date) || today).slice(0, 10);
    const scope = getUserScope(ctx);
    const report = await upsertDailyReport(scope, date);
    return {
      report
    };
  }
  if (action === 'getParentDashboard') {
    const dashboard = await getDashboardData(ctx);
    const scope = getUserScope(ctx);
    const recentReports = [];
    for (let i = 0; i < 7; i += 1) {
      const date = addDays(today, -i);
      recentReports.push(await upsertDailyReport(scope, date));
    }
    return {
      user: ctx.user,
      currentUser: ctx.user,
      family: ctx.family,
      child: ctx.child,
      stats: dashboard.stats,
      todayReport: recentReports[0],
      recentReports,
      members: ctx.members,
      subscriptionPreference: ctx.subscriptionPreference
    };
  }
  if (action === 'getFamilyPage') {
    return {
      user: ctx.user,
      currentUser: ctx.user,
      family: ctx.family,
      currentMember: ctx.member,
      members: ctx.members,
      child: ctx.child,
      subscriptionPreference: ctx.subscriptionPreference
    };
  }
  if (action === 'refreshInviteCode') {
    const inviteCode = makeInviteCode();
    await db.collection('families').doc(ctx.family.familyId).update({ data: { inviteCode } });
    return handleAction({ action: 'getFamilyPage', payload: {} }, context);
  }
  if (action === 'joinFamily') {
    const inviteCode = String((event.payload && event.payload.inviteCode) || '').trim();
    const target = (await db.collection('families').where({ inviteCode }).limit(1).get()).data[0];
    if (!target) {
      throw new Error('邀请码不正确');
    }
    const displayName = String((event.payload && event.payload.displayName) || '').trim() || '新家长';
    await upsertFamilyMemberForFamily(OPENID, ctx.user.userId, target.familyId, displayName);
    return handleAction({ action: 'getFamilyPage', payload: {} }, context);
  }
  if (action === 'joinFamilyByChildCode') {
    const childLoginCode = String((event.payload && event.payload.childLoginCode) || '').replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(childLoginCode)) {
      throw new Error('请输入 6 位孩子 ID');
    }
    const targetChild = (await db.collection('children').where({ childLoginCode }).limit(1).get()).data[0];
    if (!targetChild || !targetChild.familyId) {
      throw new Error('没有找到这个孩子 ID');
    }
    const displayName = String((event.payload && event.payload.displayName) || '').trim() || '新家长';
    await upsertFamilyMemberForFamily(OPENID, ctx.user.userId, targetChild.familyId, displayName);
    return handleAction({ action: 'getFamilyPage', payload: {} }, context);
  }
  if (action === 'updateChildProfile') {
    await updateChildProfile(ctx.family.familyId, event.payload || {});
    return handleAction({ action: 'getFamilyPage', payload: {} }, context);
  }
  if (action === 'setStudyRole') {
    const studyRole = String((event.payload && event.payload.studyRole) || '').trim();
    if (studyRole !== 'student' && studyRole !== 'parent') {
      throw new Error('设备身份不可用');
    }
    await setExclusiveStudyRole(ctx.member, studyRole);
    return handleAction({ action: 'getFamilyPage', payload: {} }, context);
  }
  if (action === 'undoLastListened') {
    const result = await clearTodayUnconfirmedListens(ctx);
    if (normalizeStudyRole(ctx.member) === 'student') {
      await setExclusiveStudyRole(ctx.member, 'parent');
    }
    const familyPage = await handleAction({ action: 'getFamilyPage', payload: {} }, context);
    return Object.assign({}, familyPage, result);
  }
  if (action === 'updateSubscription') {
    const enabled = !!(event.payload && event.payload.enabled);
    const memberRes = await db.collection('familyMembers').where({ openId: OPENID }).limit(1).get();
    if (memberRes.data[0]) {
      await db.collection('familyMembers').doc(memberRes.data[0]._id).update({
        data: {
          subscriptionEnabled: enabled
        }
      });
      const preferenceRes = await db.collection('subscriptionPreferences').where({ memberId: memberRes.data[0].memberId }).limit(1).get();
      const prefData = {
        memberId: memberRes.data[0].memberId,
        familyId: memberRes.data[0].familyId,
        dailyReportEnabled: enabled,
        lastAuthorizedAt: enabled ? new Date().toISOString() : ''
      };
      if (preferenceRes.data[0]) {
        await db.collection('subscriptionPreferences').doc(preferenceRes.data[0]._id).update({ data: prefData });
      } else {
        await db.collection('subscriptionPreferences').add({ data: prefData });
      }
    }
    return handleAction({ action: 'getFamilyPage', payload: {} }, context);
  }
  throw new Error(`unsupported action: ${action}`);
}

exports.main = async (event, context) => {
  const result = await handleAction(event, context);
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return result;
  }
  return Object.assign({}, result, {
    resourceDebug: getResourceDebugSnapshot()
  });
};
