const { peppaTranscriptBuildStatus } = require('../transcripts/peppa_build_status');
const { TRANSCRIPT_BUNDLE_PATHS, STATIC_MANIFEST_ONLY_CATEGORIES } = require('./constants');
const unlockSeriesManifests = require('../data/unlock-series-manifests.json');
const staticCatalogManifests = require('../data/static-catalog-manifests.json');
const peppaSeason1Sizes = require('../data/peppa-season-1-sizes');
const peppaSeason23Manifest = require('../data/peppa-season-2-3-manifest');
const trainingPoolRepository = require('../repositories/training-pool.repository');
const storageAdapter = require('../adapters/storage.adapter');
const transcriptAdapter = require('../adapters/transcript.adapter');
const monitor = require('./monitor');

const NEW_CONCEPT1_AUDIO_ROOT = 'A1/NewConcept1-US';
const NEW_CONCEPT2_AUDIO_ROOT = 'A2/NewConcept2-US';
const NEW_CONCEPT3_AUDIO_ROOT = 'B1/NewConcept3-US';
const NEW_CONCEPT4_AUDIO_ROOT = 'B2/NewConcept4-US';
const UNLOCK1_AUDIO_ROOT = 'A1/Unlock1/Unlock1 听口音频Class Audio';
const UNLOCK1_THIRD_EDITION_AUDIO_ROOT = 'A1/unlock1 第三版/Audio';
const UNLOCK1_WORKBOOK_AUDIO_ROOT = 'A1/unlock1 练习册/Audio';
const UNLOCK1_WORKBOOK_THIRD_EDITION_AUDIO_ROOT = 'A1/unlock1 练习册 第三版/Audio';
const UNLOCK2_AUDIO_ROOT = 'A2/Unlock2/Class Audio';
const UNLOCK2_THIRD_EDITION_AUDIO_ROOT = 'A2/unlock2 第三版/Audio';
const UNLOCK2_WORKBOOK_AUDIO_ROOT = 'A2/unlock2 练习册/Audio';
const UNLOCK2_WORKBOOK_THIRD_EDITION_AUDIO_ROOT = 'A2/unlock2 练习册 第三版/Audio';
const UNLOCK3_TEXTBOOK_AUDIO_ROOT = 'B1/Unlock3/Textbook Audio';
const UNLOCK3_THIRD_EDITION_AUDIO_ROOT = 'B1/unlock3 第三版/Audio';
const UNLOCK3_AUDIO_ROOT = 'B1/Unlock3/Class Audio';
const UNLOCK3_WORKBOOK_THIRD_EDITION_AUDIO_ROOT = 'B1/unlock3 练习册 第三版/Audio';
const UNLOCK4_AUDIO_ROOT = 'B2/Unlock4/Class Audio';
const UNLOCK4_THIRD_EDITION_AUDIO_ROOT = 'B2/unlock4 第三版/Audio';
const UNLOCK4_WORKBOOK_AUDIO_ROOT = 'B2/unlock4 练习册/Audio';
const UNLOCK4_WORKBOOK_THIRD_EDITION_AUDIO_ROOT = 'B2/unlock4 练习册 第三版/Audio';
const UNLOCK1_SCRIPT_PATH = `${UNLOCK1_AUDIO_ROOT}/Unlock 2e Listening and Speaking 1 Scripts.pdf`;
const UNLOCK1_TRAINING_POOL_COLLECTION = 'unlock1AudioTrainingPool';
const UNLOCK1_MIN_DURATION_SEC = 60;
const STORAGE_ROOTS = {
  newconcept1: NEW_CONCEPT1_AUDIO_ROOT,
  newconcept2: NEW_CONCEPT2_AUDIO_ROOT,
  newconcept3: NEW_CONCEPT3_AUDIO_ROOT,
  newconcept4: NEW_CONCEPT4_AUDIO_ROOT,
  peppa: 'A1/Peppa',
  littlebear: 'Pre A1/Little Bear/Audio',
  juniebjones: 'A1/Junie B. Jones/Audio',
  petethecat: 'A2/Pete the Cat/Audio',
  magictreehouse: 'A2/Magic Tree House/Audio',
  magictreehouseb1: 'B1/Magic Tree House/Audio',
  unlock1: UNLOCK1_AUDIO_ROOT,
  unlock1thirdedition: UNLOCK1_THIRD_EDITION_AUDIO_ROOT,
  unlock1workbook: UNLOCK1_WORKBOOK_AUDIO_ROOT,
  unlock1workbookthirdedition: UNLOCK1_WORKBOOK_THIRD_EDITION_AUDIO_ROOT,
  unlock2: UNLOCK2_AUDIO_ROOT,
  unlock2thirdedition: UNLOCK2_THIRD_EDITION_AUDIO_ROOT,
  unlock2workbook: UNLOCK2_WORKBOOK_AUDIO_ROOT,
  unlock2workbookthirdedition: UNLOCK2_WORKBOOK_THIRD_EDITION_AUDIO_ROOT,
  unlock3textbook: UNLOCK3_TEXTBOOK_AUDIO_ROOT,
  unlock3thirdedition: UNLOCK3_THIRD_EDITION_AUDIO_ROOT,
  unlock3: UNLOCK3_AUDIO_ROOT,
  unlock3workbookthirdedition: UNLOCK3_WORKBOOK_THIRD_EDITION_AUDIO_ROOT,
  unlock4: UNLOCK4_AUDIO_ROOT,
  unlock4thirdedition: UNLOCK4_THIRD_EDITION_AUDIO_ROOT,
  unlock4workbook: UNLOCK4_WORKBOOK_AUDIO_ROOT,
  unlock4workbookthirdedition: UNLOCK4_WORKBOOK_THIRD_EDITION_AUDIO_ROOT,
  song: 'A1/Super simple songs'
};
const STORAGE_ROOT_CANDIDATES = {
  newconcept1: [NEW_CONCEPT1_AUDIO_ROOT, `${NEW_CONCEPT1_AUDIO_ROOT}/新概念英语（第1册）美音（MP3+LRC）`, `${NEW_CONCEPT1_AUDIO_ROOT}/新概念英语（第一册）美音（MP3+LRC）`, 'A1/NewConcept1', 'A1/New Concept 1', 'A1/new-concept-1-us'],
  newconcept2: [NEW_CONCEPT2_AUDIO_ROOT, 'A2/NewConcept2-US/新概念英语（第2册）美音（MP3+LRC）', 'A2/NewConcept2-US/新概念英语（第二册）美音（MP3+LRC）', 'A2/NewConcept2-US/新概念英语第二册', 'A2/NewConcept2', 'A2/New Concept 2', 'A2/new-concept-2-us', 'A2/Newconcept2'],
  newconcept3: [NEW_CONCEPT3_AUDIO_ROOT, 'B1/NewConcept3-US/新概念英语（第3册）美音（MP3+LRC）', 'B1/NewConcept3-US/新概念英语（第三册）美音（MP3+LRC）', 'B1/NewConcept3-US/新概念英语第三册', 'B1/NewConcept3', 'B1/New Concept 3', 'B1/new-concept-3-us', 'B1/Newconcept3'],
  newconcept4: [NEW_CONCEPT4_AUDIO_ROOT, 'B2/NewConcept4-US/新概念英语（第4册）美音（MP3+LRC）', 'B2/NewConcept4-US/新概念英语（第四册）美音（MP3+LRC）', 'B2/NewConcept4-US/新概念英语第四册', 'B2/NewConcept4', 'B2/New Concept 4', 'B2/new-concept-4-us', 'B2/Newconcept4', 'B2/NewConcept3-US', 'B2/NewConcept3-US/新概念英语（第4册）美音（MP3+LRC）'],
  peppa: [`${STORAGE_ROOTS.peppa}/第1季`, `${STORAGE_ROOTS.peppa}/第2季`, `${STORAGE_ROOTS.peppa}/第3季`, STORAGE_ROOTS.peppa],
  littlebear: [STORAGE_ROOTS.littlebear],
  juniebjones: [STORAGE_ROOTS.juniebjones],
  petethecat: [STORAGE_ROOTS.petethecat],
  magictreehouse: [STORAGE_ROOTS.magictreehouse],
  magictreehouseb1: [STORAGE_ROOTS.magictreehouseb1],
  unlock1: [UNLOCK1_AUDIO_ROOT, 'A1/Unlock1'],
  unlock1thirdedition: [UNLOCK1_THIRD_EDITION_AUDIO_ROOT, 'A1/unlock1 第三版'],
  unlock1workbook: [UNLOCK1_WORKBOOK_AUDIO_ROOT, 'A1/unlock1 练习册'],
  unlock1workbookthirdedition: [UNLOCK1_WORKBOOK_THIRD_EDITION_AUDIO_ROOT, 'A1/unlock1 练习册 第三版'],
  unlock2: [UNLOCK2_AUDIO_ROOT, 'A2/Unlock2', 'A2/Unlock 2'],
  unlock2thirdedition: [UNLOCK2_THIRD_EDITION_AUDIO_ROOT, 'A2/unlock2 第三版'],
  unlock2workbook: [UNLOCK2_WORKBOOK_AUDIO_ROOT, 'A2/unlock2 练习册'],
  unlock2workbookthirdedition: [UNLOCK2_WORKBOOK_THIRD_EDITION_AUDIO_ROOT, 'A2/unlock2 练习册 第三版'],
  unlock3textbook: [UNLOCK3_TEXTBOOK_AUDIO_ROOT, 'B1/Unlock3/Textbook Audio'],
  unlock3thirdedition: [UNLOCK3_THIRD_EDITION_AUDIO_ROOT, 'B1/unlock3 第三版'],
  unlock3: [UNLOCK3_AUDIO_ROOT, 'B1/Unlock3', 'B1/Unlock 3'],
  unlock3workbookthirdedition: [UNLOCK3_WORKBOOK_THIRD_EDITION_AUDIO_ROOT, 'B1/unlock3 练习册 第三版'],
  unlock4: [UNLOCK4_AUDIO_ROOT, 'B2/Unlock4', 'B2/Unlock 4'],
  unlock4thirdedition: [UNLOCK4_THIRD_EDITION_AUDIO_ROOT, 'B2/unlock4 第三版'],
  unlock4workbook: [UNLOCK4_WORKBOOK_AUDIO_ROOT, 'B2/unlock4 练习册'],
  unlock4workbookthirdedition: [UNLOCK4_WORKBOOK_THIRD_EDITION_AUDIO_ROOT, 'B2/unlock4 练习册 第三版'],
  song: [STORAGE_ROOTS.song, 'A1/Super simple song']
};
const AUDIO_FILE_PATTERN = /\.(mp3|m4a|aac|wav)$/i;
const NEW_CONCEPT_AUDIO_MIN_SIZE = 100 * 1024;
const NON_AUDIO_FILE_PATTERN = /\.(lrc|srt|vtt|txt|json|pdf|jpg|jpeg|png|webp)$/i;
const RUNTIME_CATALOG_TTL_MS = 10 * 60 * 1000;
const NEW_CONCEPT_DISCOVERY_ROOTS = {
  newconcept1: ['A1'],
  newconcept2: ['A2'],
  newconcept3: ['B1'],
  newconcept4: ['B2']
};
const FALLBACK_CATALOG_COUNTS = {
  newconcept1: 76,
  newconcept2: 96,
  newconcept3: 60,
  newconcept4: 48
};
let runtimeCatalogs = null;
let runtimeCatalogExpiresAt = 0;
let runtimeCatalogDebug = null;
let staticCatalogMapCache = null;
let runtimeDurationTrackMaps = {};
let runtimeDurationTrackMapExpiresAt = {};
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

function inferPeppaDurationFromFileSize(size) {
  const byteSize = Number(size || 0);
  if (!Number.isFinite(byteSize) || byteSize <= 1024) {
    return 0;
  }
  // 线上 Peppa MP3 均为 128kbps CBR；扣除文件头后可得到真实播放秒数。
  return Math.max(1, Math.round((byteSize - 1024) / 16000));
}

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
  durationSec: inferPeppaDurationFromFileSize(peppaSeason1Sizes[item.fileName]) || peppaDurationOverrides[item.fileName] || 300,
  coverTone: 'sunrise',
  transcriptTrackId: item.trackId || null,
  textSource: {
    sourceType: 'pdf',
    title: 'Peppa Pig Season 1 Script',
    filePath: buildCloudAssetUrl('A1/Peppa/第1季/PeppaPig第1季英文剧本台词.pdf')
  }
}));

const peppaSeason23Tasks = peppaSeason23Manifest.map((item) => {
  const season = Number(item.season);
  const codeMatch = String(item.fileName || '').match(/^S(\d)(\d{2})/i);
  const episode = codeMatch ? Number(codeMatch[2]) : 0;
  const audioCloudPath = `A1/Peppa/第${season}季/${item.fileName}.mp3`;
  return {
    taskId: `peppa-s${season}-${episode}`,
    category: 'peppa',
    title: item.fileName,
    subtitle: `Peppa Pig Season ${season}`,
    audioUrl: buildCloudAssetUrl(audioCloudPath),
    audioCloudPath,
    audioFileId: buildCloudFileId(audioCloudPath),
    audioSource: 'static-cloud-url',
    repeatTarget: 3,
    durationSec: inferPeppaDurationFromFileSize(item.size),
    coverTone: 'mint',
    transcriptTrackId: `track-peppa-s${season}${String(episode).padStart(2, '0')}`,
    transcriptStatus: season === 2 ? 'ready' : 'pending',
    transcriptBatch: season,
    syncGranularity: 'word',
    textSource: {
      sourceType: 'transcript-bundle',
      title: `Peppa Pig Season ${season} Script`,
      filePath: ''
    }
  };
});

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
    subtitle: `Unlock 1 听口 第二版 第 ${index + 1} 条`,
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

function buildStaticManifestTasks(category) {
  const rows = staticCatalogManifests && staticCatalogManifests.categories && staticCatalogManifests.categories[category];
  return (Array.isArray(rows) ? rows : []).map((item) => Object.assign({}, item, {
    category,
    audioUrl: buildCloudAssetUrl(item.audioCloudPath),
    audioFileId: buildCloudFileId(item.audioCloudPath),
    audioSource: item.audioSource || 'static-cloud-url'
  }));
}

const songTasks = buildStaticManifestTasks('song');
const newConcept1Tasks = buildStaticManifestTasks('newconcept1');
const newConcept2Tasks = buildStaticManifestTasks('newconcept2');
const newConcept3Tasks = buildStaticManifestTasks('newconcept3');
const newConcept4Tasks = buildStaticManifestTasks('newconcept4');
const littleBearTasks = buildStaticManifestTasks('littlebear');
const junieBJonesTasks = buildStaticManifestTasks('juniebjones');
const peteTheCatTasks = buildStaticManifestTasks('petethecat');
const magicTreeHouseTasks = buildStaticManifestTasks('magictreehouse');
const magicTreeHouseB1Tasks = buildStaticManifestTasks('magictreehouseb1');
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

const STANDALONE_LEVEL_CATEGORIES = ['littlebear', 'juniebjones', 'petethecat', 'magictreehouse', 'magictreehouseb1', 'unlock1thirdedition', 'unlock1workbookthirdedition', 'unlock1workbook', 'newconcept2', 'unlock2', 'unlock2thirdedition', 'unlock2workbookthirdedition', 'unlock2workbook', 'newconcept3', 'unlock3textbook', 'unlock3thirdedition', 'unlock3workbookthirdedition', 'unlock3', 'newconcept4', 'unlock4', 'unlock4thirdedition', 'unlock4workbookthirdedition', 'unlock4workbook'];
const NEW_CONCEPT_CATEGORIES = ['newconcept1', 'newconcept2', 'newconcept3', 'newconcept4'];
const UNLOCK_SERIES_CATEGORIES = ['unlock1', 'unlock1thirdedition', 'unlock1workbookthirdedition', 'unlock1workbook', 'unlock2', 'unlock2thirdedition', 'unlock2workbookthirdedition', 'unlock2workbook', 'unlock3textbook', 'unlock3thirdedition', 'unlock3workbookthirdedition', 'unlock3', 'unlock4', 'unlock4thirdedition', 'unlock4workbookthirdedition', 'unlock4workbook'];
const UNLOCK_WORKBOOK_CATEGORIES = ['unlock1workbookthirdedition', 'unlock1workbook', 'unlock2workbookthirdedition', 'unlock2workbook', 'unlock3workbookthirdedition', 'unlock3', 'unlock4workbookthirdedition', 'unlock4workbook'];
const MANIFEST_ONLY_CATEGORIES = ['newconcept1', 'newconcept2', 'newconcept3', 'newconcept4', 'peppa', 'littlebear', 'juniebjones', 'petethecat', 'magictreehouse', 'magictreehouseb1', 'unlock1thirdedition', 'unlock2', 'unlock2thirdedition', 'unlock2workbook', 'unlock2workbookthirdedition', 'unlock3textbook', 'unlock3thirdedition', 'unlock3', 'unlock3workbookthirdedition', 'unlock4', 'unlock4thirdedition', 'unlock4workbook', 'unlock4workbookthirdedition', 'song'];

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
  if (!NEW_CONCEPT_CATEGORIES.includes(category)) {
    return null;
  }
  const levelNumber = category.replace('newconcept', '') || '1';
  const levelId = category === 'newconcept1' ? 'A1' : category === 'newconcept2' ? 'A2' : category === 'newconcept3' ? 'B1' : 'B2';
  const seriesSlug = category === 'newconcept1' ? 'new-concept-1-us' : `new-concept-${levelNumber}`;
  const shortSeriesSlug = category === 'newconcept1' ? 'nce1-us' : `nce${levelNumber}`;
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

function getUnlockSeriesLevel(category) {
  if (category === 'unlock1') return 'A1';
  if (category === 'unlock1thirdedition') return 'A1';
  if (category === 'unlock1workbook' || category === 'unlock1workbookthirdedition') return 'A1';
  if (category === 'unlock2') return 'A2';
  if (category === 'unlock2thirdedition') return 'A2';
  if (category === 'unlock2workbook' || category === 'unlock2workbookthirdedition') return 'A2';
  if (category === 'unlock3textbook') return 'B1';
  if (category === 'unlock3thirdedition') return 'B1';
  if (category === 'unlock3') return 'B1';
  if (category === 'unlock4') return 'B2';
  if (category === 'unlock4thirdedition') return 'B2';
  if (category === 'unlock3workbookthirdedition') return 'B1';
  if (category === 'unlock4workbook' || category === 'unlock4workbookthirdedition') return 'B2';
  return '';
}

function getUnlockSeriesNumber(category) {
  if (category === 'unlock1') return 1;
  if (category === 'unlock1thirdedition') return 1;
  if (category === 'unlock1workbook' || category === 'unlock1workbookthirdedition') return 1;
  if (category === 'unlock2') return 2;
  if (category === 'unlock2thirdedition') return 2;
  if (category === 'unlock2workbook' || category === 'unlock2workbookthirdedition') return 2;
  if (category === 'unlock3textbook') return 3;
  if (category === 'unlock3thirdedition') return 3;
  if (category === 'unlock3') return 3;
  if (category === 'unlock4') return 4;
  if (category === 'unlock4thirdedition') return 4;
  if (category === 'unlock3workbookthirdedition') return 3;
  if (category === 'unlock4workbook' || category === 'unlock4workbookthirdedition') return 4;
  return 0;
}

function isUnlockWorkbookCategory(category) {
  return UNLOCK_WORKBOOK_CATEGORIES.includes(category);
}

function getUnlockMaterialType(category) {
  if (category === 'unlock1thirdedition' || category === 'unlock2thirdedition' || category === 'unlock3thirdedition' || category === 'unlock4thirdedition') return '第三版';
  if (category.includes('workbookthirdedition')) return '练习册 第三版';
  return isUnlockWorkbookCategory(category) ? '练习册' : '课本';
}

function parseUnlockAudioOrder(value, options = {}) {
  const baseName = getBaseName(value).replace(/\.[^.]+$/i, '');
  const upper = baseName.toUpperCase();
  const allowTermTests = !!options.allowTermTests;
  if (allowTermTests && (/\bMID\b|_MID_|-MID-/.test(upper))) {
    const tailMatch = upper.match(/(?:MID[_-])?(\d+)$/);
    return { group: 4.5, unit: 4, track: 500 + Number((tailMatch && tailMatch[1]) || 0), special: 1 };
  }
  if (allowTermTests && (/\bEND\b|_END_|-END-/.test(upper))) {
    const tailMatch = upper.match(/(?:END[_-])?(\d+)$/);
    return { group: 99, unit: 99, track: Number((tailMatch && tailMatch[1]) || 0), special: 2 };
  }
  const unitMatch = upper.match(/(?:^|[_\s-])U0*(\d+)(?:[_\s-]|$)/);
  const unit = unitMatch ? Number(unitMatch[1]) : 0;
  const numberMatches = Array.from(upper.matchAll(/(?:^|[_\s-])(\d+)\.(\d+)(?:[_\s-]|$)/g));
  const numberMatch = numberMatches[numberMatches.length - 1] || null;
  const inferredUnit = unit || Number((numberMatch && numberMatch[1]) || 0);
  const trackCodeMatch = upper.match(/(?:^|[_\s-])T0*(\d+)$/);
  const track = Number((numberMatch && numberMatch[2]) || (trackCodeMatch && trackCodeMatch[1]) || 0);
  if (inferredUnit > 0) {
    return { group: inferredUnit, unit: inferredUnit, track, special: 0 };
  }
  return { group: 999, unit: 999, track: 999, special: 9 };
}

function compareUnlockAudioOrder(leftValue, rightValue, category) {
  const options = { allowTermTests: isUnlockWorkbookCategory(category) };
  const left = parseUnlockAudioOrder(leftValue, options);
  const right = parseUnlockAudioOrder(rightValue, options);
  return (left.group - right.group)
    || (left.unit - right.unit)
    || (left.special - right.special)
    || (left.track - right.track);
}

function buildUnlockSeriesTasks(category) {
  const manifest = unlockSeriesManifests[category] || null;
  const tracks = (Array.isArray(manifest && manifest.tracks) ? manifest.tracks : []).slice().sort((left, right) => (
    compareUnlockAudioOrder(left.normalizedFileName || left.title, right.normalizedFileName || right.title, category)
      || String(left.normalizedFileName || left.title || '').localeCompare(String(right.normalizedFileName || right.title || ''), 'zh-Hans-CN', {
        numeric: true,
        sensitivity: 'base'
      })
  ));
  const level = getUnlockSeriesLevel(category);
  const seriesNumber = getUnlockSeriesNumber(category);
  return tracks.map((item, index) => {
    const taskId = `${category}-${index + 1}`;
    const title = item.title || item.normalizedFileName || taskId;
    const trackSlug = slugifyTrackIdPart(item.normalizedFileName || title);
    const transcriptTrackId = item.transcriptTrackId || `track-${category}-${trackSlug}`;
    return {
      taskId,
      category,
      title,
      subtitle: `Unlock ${seriesNumber} ${getUnlockMaterialType(category)} 第 ${index + 1} 条`,
      audioUrl: buildCloudAssetUrl(item.cloudPath),
      audioCloudPath: item.cloudPath,
      audioFileId: buildCloudFileId(item.cloudPath),
      audioSource: 'static-cloud-url',
      audioSegments: Array.isArray(item.audioSegments) ? item.audioSegments : [],
      audioSegmentVersion: item.audioSegmentVersion || '',
      repeatTarget: 3,
      durationSec: Number(item.durationSec || 0) || 180,
      coverTone: index % 2 === 0 ? 'peach' : 'berry',
      transcriptTrackId,
      transcriptTrackCandidates: [
        transcriptTrackId,
        `track-${category}-${trackSlug}`,
        `${category}-${trackSlug}`,
        title,
        item.normalizedFileName,
        item.cloudPath
      ].filter(Boolean),
      transcriptStatus: 'pending',
      transcriptBatch: Math.floor(index / 12) + 1,
      syncGranularity: 'line',
      textSource: {
        sourceType: 'transcript-bundle',
        title: `${level} Unlock ${seriesNumber} Listening and Speaking`,
        filePath: ''
      }
    };
  });
}

function inferPeppaTaskMeta(audioBaseName, cloudPath, index) {
  const match = String(audioBaseName || '').match(/^S(\d)(\d{2})\s*(.*)$/i);
  const folderText = String(cloudPath || '');
  const season = match
    ? Number(match[1])
    : (folderText.includes('第3季') || /season\s*3/i.test(folderText)
      ? 3
      : (folderText.includes('第2季') || /season\s*2/i.test(folderText) ? 2 : 1));
  const episode = match ? Number(match[2]) : (index + 1);
  if (!Number.isFinite(season) || !Number.isFinite(episode) || season < 1 || episode < 1) {
    return null;
  }
  const episodeText = String(episode).padStart(2, '0');
  const code = `s${season}${episodeText}`;
  const title = match ? `S${season}${episodeText} ${String(match[3] || '').trim()}`.trim() : audioBaseName;
  const trackId = `track-peppa-${code}`;
  const candidates = Array.from(new Set([
    trackId,
    `peppa-${code}`,
    `peppa-s${season}-${episode}`,
    `peppa-s${season}-${episodeText}`,
    audioBaseName,
    getBaseName(cloudPath)
  ].filter(Boolean)));
  return {
    taskId: season === 1 ? `peppa-${episode}` : `peppa-s${season}-${episode}`,
    title,
    subtitle: `Peppa Pig Season ${season}`,
    transcriptTrackId: trackId,
    transcriptTrackCandidates: candidates,
    transcriptBatch: season,
    syncGranularity: 'word',
    coverTone: season === 1 ? 'sunrise' : 'mint',
    textSource: {
      sourceType: 'transcript-bundle',
      title: `Peppa Pig Season ${season} Script`,
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
  return NEW_CONCEPT_CATEGORIES.includes(category) || UNLOCK_SERIES_CATEGORIES.includes(category);
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
  if (staticCatalogMapCache) return staticCatalogMapCache;
  staticCatalogMapCache = {
    newconcept1: newConcept1Tasks,
    newconcept2: newConcept2Tasks,
    newconcept3: newConcept3Tasks,
    newconcept4: newConcept4Tasks,
    peppa: peppaTasks.concat(peppaSeason23Tasks),
    littlebear: littleBearTasks,
    juniebjones: junieBJonesTasks,
    petethecat: peteTheCatTasks,
    magictreehouse: magicTreeHouseTasks,
    magictreehouseb1: magicTreeHouseB1Tasks,
    unlock1: unlockTasks,
    unlock1thirdedition: buildUnlockSeriesTasks('unlock1thirdedition'),
    unlock1workbook: buildUnlockSeriesTasks('unlock1workbook'),
    unlock1workbookthirdedition: buildUnlockSeriesTasks('unlock1workbookthirdedition'),
    unlock2: buildUnlockSeriesTasks('unlock2'),
    unlock2thirdedition: buildUnlockSeriesTasks('unlock2thirdedition'),
    unlock2workbook: buildUnlockSeriesTasks('unlock2workbook'),
    unlock2workbookthirdedition: buildUnlockSeriesTasks('unlock2workbookthirdedition'),
    unlock3textbook: buildUnlockSeriesTasks('unlock3textbook'),
    unlock3thirdedition: buildUnlockSeriesTasks('unlock3thirdedition'),
    unlock3: buildUnlockSeriesTasks('unlock3'),
    unlock3workbookthirdedition: buildUnlockSeriesTasks('unlock3workbookthirdedition'),
    unlock4: buildUnlockSeriesTasks('unlock4'),
    unlock4thirdedition: buildUnlockSeriesTasks('unlock4thirdedition'),
    unlock4workbook: buildUnlockSeriesTasks('unlock4workbook'),
    unlock4workbookthirdedition: buildUnlockSeriesTasks('unlock4workbookthirdedition'),
    song: songTasks
  };
  return staticCatalogMapCache;
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

function isAudioStorageFile(category, item) {
  const cloudPath = item && item.cloudPath;
  if (AUDIO_FILE_PATTERN.test(cloudPath)) {
    return true;
  }
  if (!NEW_CONCEPT_CATEGORIES.includes(category) || NON_AUDIO_FILE_PATTERN.test(cloudPath)) {
    return false;
  }
  return Number((item && item.size) || 0) >= NEW_CONCEPT_AUDIO_MIN_SIZE;
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePathSearchText(value) {
  return normalizeCloudPath(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[_-]+/g, '')
    .replace(/[()（）【】\[\]{}]/g, '');
}

function getChineseNumber(value) {
  return {
    1: '一',
    2: '二',
    3: '三',
    4: '四'
  }[String(value)] || String(value);
}

function isNewConceptPathForCategory(category, cloudPath) {
  if (!NEW_CONCEPT_CATEGORIES.includes(category)) {
    return false;
  }
  const levelNumber = category.replace('newconcept', '') || '1';
  const chineseNumber = getChineseNumber(levelNumber);
  const text = normalizePathSearchText(cloudPath);
  return [
    `newconcept${levelNumber}`,
    `newconcept${levelNumber}us`,
    `newconceptenglish${levelNumber}`,
    `newconceptenglish${levelNumber}us`,
    `newconcept-${levelNumber}`,
    `nce${levelNumber}`,
    `新概念英语第${levelNumber}册`,
    `新概念英语第${chineseNumber}册`,
    `新概念第${levelNumber}册`,
    `新概念第${chineseNumber}册`,
    `新概念${levelNumber}`,
    `新概念${chineseNumber}`
  ].some((term) => text.includes(normalizePathSearchText(term)));
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

function getTrackDurationSec(track) {
  const durationMs = Number(track && (track.durationMs || track.duration || track.audioDurationMs));
  if (Number.isFinite(durationMs) && durationMs > 0) {
    return Math.max(1, Math.round(durationMs / 1000));
  }
  const durationSec = Number(track && (track.durationSec || track.audioDurationSec));
  if (Number.isFinite(durationSec) && durationSec > 0) {
    return Math.max(1, Math.round(durationSec));
  }
  const lines = Array.isArray(track && track.lines) ? track.lines : [];
  const maxEndMs = lines.reduce((max, line) => {
    const endMs = Number(line && line.endMs);
    return Number.isFinite(endMs) ? Math.max(max, endMs) : max;
  }, 0);
  return maxEndMs > 0 ? Math.max(1, Math.ceil(maxEndMs / 1000)) : 0;
}

async function getDurationTrackMap(category) {
  const key = String(category || '').trim();
  if (!key) {
    return {};
  }
  const now = Date.now();
  if (runtimeDurationTrackMaps[key] && runtimeDurationTrackMapExpiresAt[key] > now) {
    return runtimeDurationTrackMaps[key];
  }
  const paths = Array.isArray(TRANSCRIPT_BUNDLE_PATHS[key]) ? TRANSCRIPT_BUNDLE_PATHS[key] : [TRANSCRIPT_BUNDLE_PATHS[key]];
  let trackMap = {};
  for (const cloudPath of (paths || []).filter(Boolean)) {
    try {
      const nextMap = await downloadCloudJson(cloudPath);
      trackMap = Object.assign(trackMap, nextMap || {});
      if (key !== 'peppa') {
        break;
      }
    } catch (error) {
      // try next
    }
  }
  runtimeDurationTrackMaps[key] = trackMap;
  runtimeDurationTrackMapExpiresAt[key] = now + 5 * 60 * 1000;
  return trackMap;
}

async function getTranscriptDurationLookup(category) {
  if (![...NEW_CONCEPT_CATEGORIES, ...UNLOCK_SERIES_CATEGORIES, 'peppa', 'littlebear', 'juniebjones', 'petethecat', 'magictreehouse', 'magictreehouseb1', 'song'].includes(category)) {
    return {};
  }
  const trackMap = await getDurationTrackMap(category);
  return Object.keys(trackMap || {}).reduce((lookup, trackId) => {
    const durationSec = getTrackDurationSec(trackMap[trackId]);
    if (durationSec > 0) {
      lookup[trackId] = durationSec;
    }
    return lookup;
  }, {});
}

function getDurationFromLookup(durationLookup, trackId, candidates) {
  const keys = [trackId].concat(candidates || []).filter(Boolean);
  for (const key of keys) {
    const durationSec = Number(durationLookup && durationLookup[key]);
    if (Number.isFinite(durationSec) && durationSec > 0) {
      return durationSec;
    }
  }
  return 0;
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

function sortFilesByPath(left, right, category) {
  const leftPath = normalizeCloudPath(left.cloudPath);
  const rightPath = normalizeCloudPath(right.cloudPath);
  if (UNLOCK_SERIES_CATEGORIES.includes(category)) {
    const unlockOrder = compareUnlockAudioOrder(leftPath, rightPath, category);
    if (unlockOrder) {
      return unlockOrder;
    }
  }
  return leftPath.localeCompare(rightPath, 'zh-Hans-CN', {
    numeric: true,
    sensitivity: 'base'
  });
}

async function buildCloudCatalogFromRoot(category, rootPath, staticItems, options) {
  const files = await listDirectoryFiles(rootPath);
  const durationLookup = (options && options.durationLookup) || {};
  const pathFilter = options && typeof options.pathFilter === 'function' ? options.pathFilter : null;
  const audioFiles = files
    .filter((item) => isAudioStorageFile(category, item))
    .filter((item) => !pathFilter || pathFilter(item))
    .sort((left, right) => sortFilesByPath(left, right, category));
  const pdfByFolder = {};
  files.filter((item) => /\.pdf$/i.test(item.cloudPath)).forEach((item) => {
    pdfByFolder[getParentFolder(item.cloudPath)] = item;
  });
  const staticLookup = buildStaticTaskLookup(staticItems);
  const trainingPool = options && options.trainingPool;
  const useUnlock1TrainingPool = category === 'unlock1' && shouldUseUnlock1TrainingPool(trainingPool);
  const isFilteredUnlockSeries = UNLOCK_SERIES_CATEGORIES.includes(category);
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
    })).filter((entry) => !isFilteredUnlockSeries || !!entry.matchedStatic);
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
    const inferredPeppaTask = category === 'peppa' ? inferPeppaTaskMeta(audioBaseName, file.cloudPath, index) : null;
    const inferredNewConceptTask = inferNewConceptTaskMeta(category, audioBaseName, index);
    const title = matchedStatic
      ? matchedStatic.title
      : ((trainingRecord && trainingRecord.title) || (inferredSongTask && inferredSongTask.title) || (inferredPeppaTask && inferredPeppaTask.title) || (inferredNewConceptTask && inferredNewConceptTask.title) || audioBaseName);
    const subtitle = matchedStatic
      ? matchedStatic.subtitle
      : ((inferredSongTask && inferredSongTask.subtitle) || (inferredPeppaTask && inferredPeppaTask.subtitle) || (inferredNewConceptTask && inferredNewConceptTask.subtitle) || getParentFolder(file.cloudPath).split('/').pop() || rootPath.split('/').pop());
    const transcriptTrackId = matchedStatic
      ? matchedStatic.transcriptTrackId
      : ((inferredSongTask && inferredSongTask.transcriptTrackId) || (inferredPeppaTask && inferredPeppaTask.transcriptTrackId) || (inferredNewConceptTask && inferredNewConceptTask.transcriptTrackId));
    const transcriptTrackCandidates = (inferredPeppaTask && inferredPeppaTask.transcriptTrackCandidates) || (inferredNewConceptTask && inferredNewConceptTask.transcriptTrackCandidates) || undefined;
    const transcriptDurationSec = getDurationFromLookup(durationLookup, transcriptTrackId, transcriptTrackCandidates);
    const peppaFileDurationSec = category === 'peppa' ? inferPeppaDurationFromFileSize(file.size) : 0;
    const syncGranularity = matchedStatic
      ? String(matchedStatic.syncGranularity || 'word')
      : ((inferredSongTask && inferredSongTask.syncGranularity) || (inferredPeppaTask && inferredPeppaTask.syncGranularity) || (inferredNewConceptTask && inferredNewConceptTask.syncGranularity) || 'word');
    return buildCloudTask(matchedStatic, {
      taskId: matchedStatic
        ? matchedStatic.taskId
        : ((inferredSongTask && inferredSongTask.taskId) || (inferredPeppaTask && inferredPeppaTask.taskId) || (inferredNewConceptTask && inferredNewConceptTask.taskId) || `${category}-${index + 1}`),
      category,
      title,
      subtitle,
      repeatTarget: matchedStatic ? matchedStatic.repeatTarget : 3,
      durationSec: trainingRecord ? trainingRecord.durationSec : (transcriptDurationSec || peppaFileDurationSec || (matchedStatic ? matchedStatic.durationSec : 180)),
      coverTone: matchedStatic ? matchedStatic.coverTone : ((inferredPeppaTask && inferredPeppaTask.coverTone) || (inferredNewConceptTask && inferredNewConceptTask.coverTone) || (category === 'song' ? 'mint' : 'sunrise')),
      transcriptTrackId,
      transcriptStatus: matchedStatic ? matchedStatic.transcriptStatus : (transcriptTrackId ? 'ready' : (folderPdf ? 'pending' : 'none')),
      transcriptBatch: matchedStatic ? matchedStatic.transcriptBatch : ((inferredSongTask && inferredSongTask.transcriptBatch) || (inferredPeppaTask && inferredPeppaTask.transcriptBatch) || (inferredNewConceptTask && inferredNewConceptTask.transcriptBatch) || null),
      transcriptTrackCandidates,
      syncGranularity,
      audioTitle: (trainingRecord && trainingRecord.title) || audioBaseName,
      audioUrl: buildCloudAssetUrl(file.cloudPath),
      audioCloudPath: file.cloudPath,
      audioFileId: file.fileId,
      audioSource: 'static-cloud-url',
      textSource: inferredPeppaTask
        ? inferredPeppaTask.textSource
        : inferredNewConceptTask
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
      pathFilter: pathFilter ? 'newconcept-discovery' : '',
      audioFallbackMode: NEW_CONCEPT_CATEGORIES.includes(category) ? 'extension-or-size' : 'extension',
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
  if (MANIFEST_ONLY_CATEGORIES.includes(category) && staticItems.length) {
    return {
      tasks: staticItems,
      debug: {
        root: STORAGE_ROOTS[category],
        selectedRoot: STORAGE_ROOTS[category],
        rootCandidates: STORAGE_ROOT_CANDIDATES[category] || [],
        audioCount: staticItems.length,
        scanMode: 'static-manifest',
        listMode: 'static-manifest',
        scanError: ''
      }
    };
  }
  const roots = STORAGE_ROOT_CANDIDATES[category] || [STORAGE_ROOTS[category]];
  const durationLookup = await getTranscriptDurationLookup(category);
  let trainingPool = category === 'unlock1'
    ? await getEligibleUnlock1TrainingPool()
    : null;
  let bootstrapState = null;
  if (category === 'unlock1' && !shouldUseUnlock1TrainingPool(trainingPool)) {
    const ensured = await ensureUnlock1TrainingPoolPrepared(trainingPool);
    trainingPool = ensured.trainingPool;
    bootstrapState = ensured.bootstrapState;
  }
  if (category === 'peppa') {
    const errors = [];
    const emptyScans = [];
    const tasks = [];
    const seenPaths = new Set();
    let selectedRoot = '';
    let firstDebug = null;
    for (let index = 0; index < roots.length; index += 1) {
      const rootPath = roots[index];
      try {
        const result = await buildCloudCatalogFromRoot(category, rootPath, staticItems, {
          trainingPool,
          durationLookup
        });
        if (!firstDebug) {
          firstDebug = result.debug;
        }
        if (result.tasks.length) {
          selectedRoot = selectedRoot || rootPath;
          result.tasks.forEach((task) => {
            const pathKey = normalizeCloudPath(task.audioCloudPath || task.audioUrl || task.taskId);
            if (!seenPaths.has(pathKey)) {
              seenPaths.add(pathKey);
              tasks.push(task);
            }
          });
        } else {
          emptyScans.push(result.debug);
        }
      } catch (error) {
        errors.push(`${rootPath}: ${formatStorageError(error)}`);
      }
    }
    if (tasks.length) {
      return {
        tasks: tasks.sort((left, right) => sortFilesByPath({
          cloudPath: left.audioCloudPath || left.title
        }, {
          cloudPath: right.audioCloudPath || right.title
        })),
        debug: Object.assign({}, firstDebug || {}, {
          selectedRoot,
          rootCandidates: roots,
          audioCount: tasks.length,
          scanError: errors.join(' | '),
          emptyRoots: emptyScans.map((item) => item.root)
        })
      };
    }
  }
  const errors = [];
  const emptyScans = [];
  for (let index = 0; index < roots.length; index += 1) {
    const rootPath = roots[index];
    try {
      const result = await buildCloudCatalogFromRoot(category, rootPath, staticItems, {
        trainingPool,
        durationLookup
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
  if (NEW_CONCEPT_CATEGORIES.includes(category)) {
    const discoveryRoots = NEW_CONCEPT_DISCOVERY_ROOTS[category] || [];
    for (const rootPath of discoveryRoots) {
      try {
        const result = await buildCloudCatalogFromRoot(category, rootPath, staticItems, {
          trainingPool,
          durationLookup,
          pathFilter: (item) => isNewConceptPathForCategory(category, item.cloudPath)
        });
        if (result.tasks.length) {
          return {
            tasks: result.tasks,
            debug: Object.assign({}, result.debug, {
              selectedRoot: rootPath,
              rootCandidates: roots.concat(discoveryRoots),
              scanMode: 'manager-discovery',
              listMode: 'manager-discovery',
              emptyRoots: emptyScans.map((item) => item.root)
            })
          };
        }
        emptyScans.push(result.debug);
      } catch (error) {
        errors.push(`${rootPath}: ${formatStorageError(error)}`);
      }
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
  const requestedCategories = Array.from(new Set((categories && categories.length ? categories : ['newconcept1', 'peppa', 'littlebear', 'juniebjones', 'petethecat', 'magictreehouse', 'magictreehouseb1', 'unlock1', 'unlock1thirdedition', 'unlock1workbook', 'song']).filter(Boolean)));
  const staticMap = getStaticCatalogMap();
  if (!runtimeCatalogs) runtimeCatalogs = staticMap;
  const targetCategories = requestedCategories.filter((category) => !STATIC_MANIFEST_ONLY_CATEGORIES.includes(category));
  if (!targetCategories.length) {
    monitor.logPerf('cloudfn', 'refreshRuntimeCatalogs', Date.now() - startedAt, {
      categories: requestedCategories.join(','),
      mode: 'static-manifest'
    });
    return runtimeCatalogs;
  }
  const hasAllRequested = runtimeCatalogs && targetCategories.every((category) => {
    const catalog = runtimeCatalogs[category];
    if (!Array.isArray(catalog)) {
      return false;
    }
    return !NEW_CONCEPT_CATEGORIES.includes(category) || catalog.length > 0;
  });
  if (!force && hasAllRequested && runtimeCatalogExpiresAt > now) {
    return runtimeCatalogs;
  }
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
    } else if (NEW_CONCEPT_CATEGORIES.includes(category)) {
      nextCatalogs[category] = result.tasks.length ? result.tasks : (nextCatalogs[category] || staticMap[category] || []);
    } else {
      const currentCatalog = nextCatalogs[category];
      const fallbackCatalog = Array.isArray(currentCatalog) && currentCatalog.length
        ? currentCatalog
        : (staticMap[category] || []);
      nextCatalogs[category] = result.tasks.length ? result.tasks : fallbackCatalog;
    }
    nextDebug[category] = result.debug;
  });
  runtimeCatalogs = nextCatalogs;
  runtimeCatalogDebug = summarizeRuntimeCatalogDebug(nextDebug);
  runtimeCatalogExpiresAt = now + RUNTIME_CATALOG_TTL_MS;
  monitor.logPerf('cloudfn', 'refreshRuntimeCatalogs', Date.now() - startedAt, {
    categories: targetCategories.join(',')
  });
  return runtimeCatalogs;
}

function getResourceDebugSnapshot() {
  return Object.assign({}, runtimeCatalogDebug || summarizeRuntimeCatalogDebug({}));
}

const CATEGORY_ORDER = ['littlebear', 'juniebjones', 'song', 'newconcept1', 'peppa', 'unlock1', 'unlock1thirdedition', 'unlock1workbookthirdedition', 'unlock1workbook', 'newconcept2', 'petethecat', 'magictreehouse', 'unlock2', 'unlock2thirdedition', 'unlock2workbookthirdedition', 'unlock2workbook', 'newconcept3', 'magictreehouseb1', 'unlock3textbook', 'unlock3thirdedition', 'unlock3workbookthirdedition', 'unlock3', 'newconcept4', 'unlock4', 'unlock4thirdedition', 'unlock4workbookthirdedition', 'unlock4workbook'];
const CATEGORY_LABELS = {
  newconcept1: 'New Concept 1',
  newconcept2: 'New Concept 2',
  newconcept3: 'New Concept 3',
  newconcept4: 'New Concept 4',
  peppa: 'Peppa',
  littlebear: 'Little Bear',
  juniebjones: 'Junie B. Jones',
  petethecat: 'Pete the Cat',
  magictreehouse: 'Magic Tree House',
  magictreehouseb1: 'Magic Tree House',
  unlock1: 'Unlock 1 听口 第二版',
  unlock1thirdedition: 'Unlock 1 听口 第三版',
  unlock1workbook: 'Unlock 1 听口 练习册 第二版',
  unlock1workbookthirdedition: 'Unlock 1 听口练习册 第三版',
  unlock2: 'Unlock 2 课本',
  unlock2thirdedition: 'Unlock 2 听口 第三版',
  unlock2workbook: 'Unlock 2 练习册',
  unlock2workbookthirdedition: 'Unlock 2 听口练习册 第三版',
  unlock3textbook: 'Unlock3 听口 第二版',
  unlock3thirdedition: 'Unlock3 听口 第三版',
  unlock3: 'Unlock3 听口练习册 第二版',
  unlock3workbookthirdedition: 'Unlock3 听口练习册 第三版',
  unlock4: 'Unlock 4 课本',
  unlock4thirdedition: 'Unlock 4 听口 第三版',
  unlock4workbook: 'Unlock 4 练习册',
  unlock4workbookthirdedition: 'Unlock 4 听口练习册 第三版',
  song: 'Songs'
};

function getCatalog(category) {
  const staticCatalogs = getStaticCatalogMap();
  const catalogs = runtimeCatalogs || {};
  if (category === 'newconcept1') {
    return Object.prototype.hasOwnProperty.call(catalogs, 'newconcept1') ? (catalogs.newconcept1 || []) : staticCatalogs.newconcept1;
  }
  if (STANDALONE_LEVEL_CATEGORIES.includes(category)) {
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

function getCatalogSummary(category) {
  const catalogs = runtimeCatalogs || {};
  const runtimeCatalog = catalogs[category];
  if (Array.isArray(runtimeCatalog)) {
    if (!runtimeCatalog.length && NEW_CONCEPT_CATEGORIES.includes(category) && FALLBACK_CATALOG_COUNTS[category]) {
      return {
        totalCount: Number(FALLBACK_CATALOG_COUNTS[category] || 0),
        enabled: true
      };
    }
    return {
      totalCount: runtimeCatalog.length,
      enabled: runtimeCatalog.length > 0
    };
  }
  const staticCatalog = getStaticCatalogMap()[category] || [];
  const totalCount = staticCatalog.length || Number(FALLBACK_CATALOG_COUNTS[category] || 0);
  return {
    totalCount,
    enabled: totalCount > 0
  };
}


module.exports = {
  AUDIO_FILE_PATTERN,
  STORAGE_ROOTS,
  STORAGE_ROOT_CANDIDATES,
  CATEGORY_LABELS,
  buildCloudAssetUrl,
  getBaseName,
  listDirectoryFiles,
  sortFilesByPath,
  inferNewConceptTaskMeta,
  inferPeppaDurationFromFileSize,
  buildCloudTask,
  getStaticCatalogMap,
  refreshRuntimeCatalogs,
  getResourceDebugSnapshot,
  getCatalog,
  getCatalogSummary,
  getTranscriptBundle,
  songPlaceholder
};
