const { peppaTranscriptBuildStatus } = require('../transcripts/peppa_build_status');
const trainingPoolRepository = require('../repositories/training-pool.repository');
const storageAdapter = require('../adapters/storage.adapter');
const transcriptAdapter = require('../adapters/transcript.adapter');
const monitor = require('./monitor');

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
const AUDIO_FILE_PATTERN = /\.(mp3|m4a|aac|wav)$/i;
let runtimeCatalogs = null;
let runtimeCatalogExpiresAt = 0;
let runtimeCatalogDebug = null;
let storageDebugShapes = {};
let unlock1TrainingPoolBootstrapState = {
  lastTriggeredAt: 0,
  lastFinishedAt: 0,
  lastResult: '',
  lastError: '',
  lastMode: '',
  lastStats: null
};

function isMissingCollectionError(error) {
  const message = String((error && (error.errMsg || error.message)) || '');
  return message.includes('DATABASE_COLLECTION_NOT_EXIST')
    || message.includes('database collection not exists')
    || message.includes('collection.get:fail')
    || message.includes('collection.where:fail')
    || message.includes('collection.add:fail')
    || message.includes('collection.doc:fail');
}

function buildCloudAssetUrl(cloudPath) {
  return storageAdapter.buildCloudAssetUrl(cloudPath);
}

function buildCloudFileId(cloudPath) {
  return storageAdapter.buildCloudFileId(cloudPath);
}

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


module.exports = {
  AUDIO_FILE_PATTERN,
  STORAGE_ROOTS,
  STORAGE_ROOT_CANDIDATES,
  buildCloudAssetUrl,
  getBaseName,
  listDirectoryFiles,
  sortFilesByPath,
  inferNewConceptTaskMeta,
  buildCloudTask,
  getStaticCatalogMap,
  refreshRuntimeCatalogs,
  getResourceDebugSnapshot,
  getCatalog,
  getTranscriptBundle,
  songPlaceholder
};
