const cloud = require('wx-server-sdk');
const CloudBaseManager = require('@cloudbase/manager-node');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const CLOUD_ENV_ID = process.env.TCB_ENV || process.env.SCF_NAMESPACE || cloud.DYNAMIC_CURRENT_ENV;
const CLOUD_ASSET_BASE_URL = 'https://796f-youshengenglish-6glk12rd6c6e719b-1419984942.tcb.qcloud.la';
const CLOUD_BUCKET = '796f-youshengenglish-6glk12rd6c6e719b-1419984942';
const UNLOCK1_AUDIO_ROOT = 'A1/Unlock1/Unlock1 听口音频 Class Audio';
const UNLOCK1_SCRIPT_PATH = `${UNLOCK1_AUDIO_ROOT}/Unlock 2e Listening and Speaking 1 Scripts.pdf`;
const STORAGE_ROOTS = {
  peppa: 'A1/Peppa',
  unlock1: UNLOCK1_AUDIO_ROOT,
  song: 'A1/Super simple songs'
};
const STORAGE_ROOT_CANDIDATES = {
  peppa: [STORAGE_ROOTS.peppa],
  unlock1: [UNLOCK1_AUDIO_ROOT, 'A1/Unlock1'],
  song: [STORAGE_ROOTS.song, 'A1/Super simple song']
};
const REQUIRED_COLLECTIONS = [
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
let runtimeCatalogs = null;
let runtimeCatalogExpiresAt = 0;
let runtimeCatalogDebug = null;
let storageManager = null;
let storageDebugShapes = {};

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

const peppaTasks = [
  ['S101 Muddy Puddles', 311, 'track-peppa-s101'],
  ['S102 Mr Dinosaur Is Lost', 300],
  ['S103 Best Friend', 300],
  ['S104 Polly Parrot', 300],
  ['S105 Hide and Seek', 300],
  ['S106 The Playgroup', 300],
  ['S107 Mummy Pig at Work', 300],
  ['S108 Piggy in the Middle', 300],
  ['S109 Daddy Loses his Glasses', 300],
  ['S110 Gardening', 300],
  ['S111 Hiccups', 300],
  ['S112 Bicycles', 300],
  ['S113 Secrets', 300],
  ['S114 Flying a Kite', 300],
  ['S115 Picnic', 300],
  ['S116 Musical Instruments', 300]
].map((item, index) => ({
  taskId: `peppa-${index + 1}`,
  category: 'peppa',
  title: item[0],
  subtitle: 'Peppa Pig Season 1',
  audioUrl: buildCloudAssetUrl(`A1/Peppa/第1季/${item[0]}.mp3`),
  audioCloudPath: `A1/Peppa/第1季/${item[0]}.mp3`,
  audioFileId: buildCloudFileId(`A1/Peppa/第1季/${item[0]}.mp3`),
  audioSource: 'static-cloud-url',
  repeatTarget: 3,
  durationSec: item[1],
  coverTone: 'sunrise',
  transcriptTrackId: item[2] || null,
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
  title: '每日歌曲',
  subtitle: '检查云端歌曲目录',
  audioUrl: '',
  audioCloudPath: '',
  audioFileId: '',
  audioSource: 'none',
  repeatTarget: 3,
  durationSec: 0,
  coverTone: 'mint',
  transcriptTrackId: null,
  textSource: null
};

function getStaticCatalogMap() {
  return {
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
  if (!CLOUD_ENV_ID) {
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

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function buildStaticTaskLookup(items) {
  const map = {};
  items.forEach((item) => {
    map[normalizeKey(item.title)] = item;
    map[normalizeKey(getBaseName(item.audioCloudPath || item.audioUrl))] = item;
  });
  return map;
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

async function buildCloudCatalogFromRoot(category, rootPath, staticItems) {
  const files = await listDirectoryFiles(rootPath);
  const audioFiles = files.filter((item) => AUDIO_FILE_PATTERN.test(item.cloudPath)).sort(sortFilesByPath);
  const pdfByFolder = {};
  files.filter((item) => /\.pdf$/i.test(item.cloudPath)).forEach((item) => {
    pdfByFolder[getParentFolder(item.cloudPath)] = item;
  });
  const staticLookup = buildStaticTaskLookup(staticItems);

  const tasks = audioFiles.map((file, index) => {
    const audioBaseName = getBaseName(file.cloudPath);
    const matchedStatic = staticLookup[normalizeKey(audioBaseName)] || staticItems[index] || null;
    const folderPdf = findNearestParentPdf(pdfByFolder, file.cloudPath);
    const title = matchedStatic ? matchedStatic.title : audioBaseName;
    const subtitle = matchedStatic
      ? matchedStatic.subtitle
      : (getParentFolder(file.cloudPath).split('/').pop() || rootPath.split('/').pop());
    return buildCloudTask(matchedStatic, {
      taskId: matchedStatic ? matchedStatic.taskId : `${category}-${index + 1}`,
      category,
      title,
      subtitle,
      repeatTarget: matchedStatic ? matchedStatic.repeatTarget : 3,
      durationSec: matchedStatic ? matchedStatic.durationSec : 180,
      coverTone: matchedStatic ? matchedStatic.coverTone : (category === 'song' ? 'mint' : 'sunrise'),
      transcriptTrackId: matchedStatic ? matchedStatic.transcriptTrackId : null,
      transcriptStatus: matchedStatic ? matchedStatic.transcriptStatus : (folderPdf ? 'pending' : 'none'),
      transcriptBatch: matchedStatic ? matchedStatic.transcriptBatch : null,
      audioUrl: buildCloudAssetUrl(file.cloudPath),
      audioCloudPath: file.cloudPath,
      audioFileId: file.fileId,
      audioSource: 'static-cloud-url',
      textSource: createCloudTextSource(folderPdf, `${title} Script`)
    });
  });
  return {
    tasks,
    debug: {
      root: rootPath,
      audioCount: audioFiles.length,
      samplePath: audioFiles[0] ? audioFiles[0].cloudPath : '',
      pdfCount: Object.keys(pdfByFolder).length,
      rawStorageShape: (storageDebugShapes[normalizeCloudPath(rootPath)] || []).join(','),
      scanMode: 'manager-scan',
      scanError: ''
    }
  };
}

async function buildCloudCatalogForCategory(category, staticItems) {
  const roots = STORAGE_ROOT_CANDIDATES[category] || [STORAGE_ROOTS[category]];
  const errors = [];
  const emptyScans = [];
  for (let index = 0; index < roots.length; index += 1) {
    const rootPath = roots[index];
    try {
      const result = await buildCloudCatalogFromRoot(category, rootPath, staticItems);
      if (result.tasks.length) {
        return {
          tasks: result.tasks,
          debug: Object.assign({}, result.debug, {
            selectedRoot: rootPath,
            rootCandidates: roots
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
      emptyRoots: emptyScans.map((item) => item.root)
    }
  };
}

function summarizeRuntimeCatalogDebug(categoryDebugMap) {
  const categories = Object.values(categoryDebugMap || {});
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
    songRoot: song.selectedRoot || song.root || '',
    songAudioCount: song.audioCount || 0,
    songSamplePath: song.samplePath || ''
  };
}

async function refreshRuntimeCatalogs(force) {
  const now = Date.now();
  if (!force && runtimeCatalogs && runtimeCatalogExpiresAt > now) {
    return runtimeCatalogs;
  }
  const staticMap = getStaticCatalogMap();
  const [peppaCatalog, unlockCatalog, songCatalog] = await Promise.all([
    buildCloudCatalogForCategory('peppa', staticMap.peppa),
    buildCloudCatalogForCategory('unlock1', staticMap.unlock1),
    buildCloudCatalogForCategory('song', staticMap.song)
  ]);
  runtimeCatalogs = {
    peppa: peppaCatalog.tasks.length ? peppaCatalog.tasks : staticMap.peppa,
    unlock1: unlockCatalog.tasks.length ? unlockCatalog.tasks : staticMap.unlock1,
    song: songCatalog.tasks
  };
  runtimeCatalogDebug = summarizeRuntimeCatalogDebug({
    peppa: peppaCatalog.debug,
    unlock1: unlockCatalog.debug,
    song: songCatalog.debug
  });
  runtimeCatalogExpiresAt = now + 5 * 60 * 1000;
  return runtimeCatalogs;
}

function getResourceDebugSnapshot() {
  return Object.assign({}, runtimeCatalogDebug || summarizeRuntimeCatalogDebug({}));
}

const CATEGORY_ORDER = ['peppa', 'unlock1', 'song'];
const CATEGORY_LABELS = {
  peppa: 'Peppa',
  unlock1: 'Unlock 1',
  song: '歌曲'
};

function getCatalog(category) {
  const catalogs = runtimeCatalogs || getStaticCatalogMap();
  if (category === 'peppa') return catalogs.peppa || [];
  if (category === 'unlock1') return catalogs.unlock1 || [];
  if (category === 'song') return catalogs.song || [];
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
  if (task.category === 'unlock1') {
    const match = title.match(/Unlock2e_A1_(\d+\.\d+)/i);
    return {
      displayTitle: match ? match[1] : title,
      displaySubtitle: 'A1 Listen & Speak',
      coverVariant: 'unlock',
      coverBadge: 'Unlock-1'
    };
  }
  return {
    displayTitle: 'Daily Song',
    displaySubtitle: '等待歌曲音频',
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
    rewardTitle: progress && progress.completedToday ? '歌曲小星星到手了' : '歌曲星星线',
    rewardCopy: progress && progress.completedToday ? '今天这首歌已经完成。' : '放入歌曲后就会开始轮换。'
  };
}

function decorateTask(task, progress, category) {
  if (!task) {
    const base = getTaskPresentation(songPlaceholder);
    return Object.assign({}, songPlaceholder, base, {
      category,
      categoryLabel: getCategoryLabel(category),
      audioCompactTitle: '',
      playCount: 0,
      playStepText: '0/3',
      currentPass: 1,
      textUnlocked: false,
      completedToday: false,
      isPendingAsset: true,
      note: '把歌曲音频放进来后，这里就会开始轮换。',
      rewardBadge: 'SONG 1',
      rewardTitle: '歌曲星星线',
      rewardCopy: '把歌曲音频放进来后，这条奖励线就会亮起来。'
    });
  }
  const base = getTaskPresentation(task);
  const reward = getTaskReward(category, progress, task);
  const completedCount = Math.min(progress.playCount, task.repeatTarget);
  const currentPass = progress.completedToday ? task.repeatTarget : Math.min(progress.playCount + 1, task.repeatTarget);
  const textUnlocked = progress.playCount >= task.repeatTarget - 1 || progress.completedToday;
  return Object.assign({}, task, base, {
    category,
    categoryLabel: getCategoryLabel(category),
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
    completedToday: progress.completedToday,
    transcriptStatus: task.transcriptStatus || (task.transcriptTrackId ? 'ready' : task.textSource ? 'pending' : 'none'),
    transcriptBatch: task.transcriptBatch || null,
    note: currentPass < task.repeatTarget ? `先完成第 ${currentPass} 遍。`
      : (task.transcriptTrackId ? '最后一遍会带文本。' : task.textSource ? '最后一遍这条的逐句高亮还在准备中。' : '最后一遍按纯听力完成。'),
    rewardBadge: reward.rewardBadge,
    rewardTitle: reward.rewardTitle,
    rewardCopy: reward.rewardCopy
  });
}

function makeInviteCode() {
  return `YOYO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function getMember(openId) {
  const res = await db.collection('familyMembers').where({ openId }).limit(1).get();
  return res.data[0] || null;
}

async function getFamily(familyId) {
  const res = await db.collection('families').doc(familyId).get().catch(() => ({ data: null }));
  return res.data || null;
}

async function getChild(familyId) {
  const res = await db.collection('children').where({ familyId }).limit(1).get();
  return res.data[0] || null;
}

async function ensureBootstrap(openId) {
  let member = await getMember(openId);
  if (!member) {
    const familyId = `family-${Date.now()}`;
    const familyDoc = {
      familyId,
      name: '佑佑一家',
      inviteCode: makeInviteCode(),
      ownerOpenId: openId,
      createdAt: new Date().toISOString()
    };
    await db.collection('families').doc(familyId).set({ data: familyDoc });
    member = {
      familyId,
      memberId: `member-${Date.now()}`,
      openId,
      role: 'owner',
      displayName: '我',
      subscriptionEnabled: false,
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
        familyId
      })
    });
  }
  const family = await getFamily(member.familyId);
  const child = await getChild(member.familyId);
  const members = (await db.collection('familyMembers').where({ familyId: member.familyId }).get()).data;
  const subscriptionPreference = (await db.collection('subscriptionPreferences').where({ memberId: member.memberId }).limit(1).get()).data[0] || {
    memberId: member.memberId,
    familyId: member.familyId,
    dailyReportEnabled: !!member.subscriptionEnabled,
    lastAuthorizedAt: ''
  };
  return { family, member, child, members, subscriptionPreference };
}

async function getProgressRecord(familyId, childId, category, date) {
  const progressId = `${familyId}_${childId}_${date}_${category}`;
  const res = await db.collection('dailyTaskProgress').where({ progressId }).limit(1).get();
  return res.data[0] || null;
}

async function saveProgressRecord(record) {
  const existing = await db.collection('dailyTaskProgress').where({ progressId: record.progressId }).limit(1).get();
  if (existing.data[0]) {
    await db.collection('dailyTaskProgress').doc(existing.data[0]._id).update({ data: record });
  } else {
    await db.collection('dailyTaskProgress').add({ data: record });
  }
}

async function getChildProgressRecords(familyId, childId) {
  return (await db.collection('dailyTaskProgress').where({ familyId, childId }).get()).data;
}

async function getCheckins(familyId, childId) {
  return (await db.collection('dailyCheckins').where({ familyId, childId }).get()).data;
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

function getSelectedTask(progressRecords, childId, category, date, cursors) {
  const catalog = getCatalog(category);
  if (!catalog.length) return null;
  const existing = progressRecords.find((item) => item.childId === childId && item.category === category && item.date === date);
  if (existing && existing.taskId) {
    return catalog.find((item) => item.taskId === existing.taskId) || catalog[0];
  }
  const index = (cursors[category] || 0) % catalog.length;
  return catalog[index];
}

function getTaskSummary(progressRecords, childId, category, date, cursors) {
  const task = getSelectedTask(progressRecords, childId, category, date, cursors);
  if (!task) return decorateTask(null, { playCount: 0, textUnlocked: false, completedToday: false }, category);
  const progress = progressRecords.find((item) => item.childId === childId && item.category === category && item.date === date) || {
    playCount: 0,
    textUnlocked: false,
    completedToday: false
  };
  return decorateTask(task, progress, category);
}

function buildStats(progressRecords, checkins, childId) {
  const completedProgress = progressRecords.filter((item) => item.childId === childId && item.completedToday);
  const totalMinutes = completedProgress.reduce((sum, item) => {
    const task = getCatalog(item.category).find((entry) => entry.taskId === item.taskId);
    return task ? sum + Math.round((task.durationSec * task.repeatTarget) / 60) : sum;
  }, 0);
  const today = new Date().toISOString().slice(0, 10);
  return {
    streakDays: computeStreak(checkins, today),
    completedDays: checkins.length,
    completedLessons: checkins.length,
    completedTasks: completedProgress.length,
    totalMinutes
  };
}

async function maybeCreateCheckin(familyId, childId, progressRecords, date) {
  const activeCategories = CATEGORY_ORDER.filter((category) => getCatalog(category).length > 0);
  const allDone = activeCategories.every((category) => {
    const item = progressRecords.find((record) => record.category === category && record.date === date);
    return item && item.completedToday;
  });
  if (!allDone) return null;
  const checkins = await getCheckins(familyId, childId);
  const recordId = `${familyId}_${childId}_${date}`;
  const existing = checkins.find((item) => item.recordId === recordId);
  const streakSnapshot = computeStreak(checkins.filter((item) => item.recordId !== recordId), date) + (existing ? 0 : 1);
  const next = {
    recordId,
    familyId,
    childId,
    date,
    completedAt: new Date().toISOString(),
    streakSnapshot,
    completedCategories: activeCategories
  };
  if (existing) {
    await db.collection('dailyCheckins').doc(existing._id).update({ data: next });
  } else {
    await db.collection('dailyCheckins').add({ data: next });
  }
  await upsertDailyReport(familyId, childId, date);
  return next;
}

async function upsertDailyReport(familyId, childId, date) {
  const progressRecords = await getChildProgressRecords(familyId, childId);
  const checkins = await getCheckins(familyId, childId);
  const cursors = {};
  CATEGORY_ORDER.forEach((category) => {
    const completed = progressRecords
      .filter((item) => item.category === category && item.completedToday)
      .sort((a, b) => a.date.localeCompare(b.date));
    cursors[category] = completed.length % Math.max(1, getCatalog(category).length || 1);
  });
  const items = CATEGORY_ORDER.map((category) => {
    const task = getTaskSummary(progressRecords, childId, category, date, cursors);
    return {
      category,
      categoryLabel: task.categoryLabel,
      taskId: task.taskId,
      title: task.audioCompactTitle || task.displayTitle || task.title,
      playCount: task.playCount || 0,
      repeatTarget: task.repeatTarget || 3,
      completedToday: !!task.completedToday
    };
  });
  const report = {
    reportId: `${familyId}_${childId}_${date}`,
    familyId,
    childId,
    date,
    completedCategories: items.filter((item) => item.completedToday).map((item) => item.category),
    totalMinutes: items.reduce((sum, item) => {
      if (!item.completedToday) {
        return sum;
      }
      const task = getCatalog(item.category).find((entry) => entry.taskId === item.taskId);
      return task ? sum + Math.round((task.durationSec * task.repeatTarget) / 60) : sum;
    }, 0),
    streakSnapshot: (checkins.find((item) => item.date === date) || {}).streakSnapshot || 0,
    items,
    pushStatus: 'in-app-ready',
    inAppVisible: true,
    updatedAt: new Date().toISOString()
  };
  const subscribers = (await db.collection('familyMembers').where({ familyId, subscriptionEnabled: true }).get()).data;
  if (subscribers.length) {
    report.pushStatus = 'subscription-ready';
  }
  const existing = await db.collection('dailyReports').where({ reportId: report.reportId }).limit(1).get();
  if (existing.data[0]) {
    await db.collection('dailyReports').doc(existing.data[0]._id).update({ data: report });
  } else {
    await db.collection('dailyReports').add({ data: report });
  }
  return report;
}

async function getDashboardData(ctx) {
  const today = new Date().toISOString().slice(0, 10);
  const progressRecords = await getChildProgressRecords(ctx.family.familyId, ctx.child.childId);
  const checkins = await getCheckins(ctx.family.familyId, ctx.child.childId);
  const cursors = {};
  CATEGORY_ORDER.forEach((category) => {
    const categoryRecords = progressRecords.filter((item) => item.category === category && item.completedToday);
    cursors[category] = categoryRecords.length % Math.max(getCatalog(category).length || 1, 1);
  });
  const dailyTasks = CATEGORY_ORDER.map((category) => getTaskSummary(progressRecords, ctx.child.childId, category, today, cursors));
  const activeTaskCount = dailyTasks.filter((item) => !item.isPendingAsset).length;
  const completedTaskCountToday = dailyTasks.filter((item) => item.completedToday).length;
  return {
    family: ctx.family,
    child: Object.assign({}, ctx.child, {
      totalCompleted: checkins.length,
      streakDays: buildStats(progressRecords, checkins, ctx.child.childId).streakDays
    }),
    stats: buildStats(progressRecords, checkins, ctx.child.childId),
    peppaTask: dailyTasks.find((item) => item.category === 'peppa'),
    unlockTask: dailyTasks.find((item) => item.category === 'unlock1'),
    songTask: dailyTasks.find((item) => item.category === 'song'),
    dailyTasks,
    activeTaskCount,
    completedTaskCountToday,
    allDailyDone: activeTaskCount > 0 && activeTaskCount === completedTaskCountToday
  };
}

async function handleAction(event, context) {
  await refreshRuntimeCatalogs(false);
  await ensureRequiredCollectionsReady();
  const { OPENID } = cloud.getWXContext();
  const ctx = await ensureBootstrap(OPENID);
  const today = new Date().toISOString().slice(0, 10);

  if (event.action === 'bootstrap') {
    return ctx;
  }
  if (event.action === 'getDashboard') {
    return getDashboardData(ctx);
  }
  if (event.action === 'getLevelOverview') {
    const dashboard = await getDashboardData(ctx);
    return {
      child: ctx.child,
      level,
      stats: dashboard.stats,
      categories: CATEGORY_ORDER.map((category) => {
        const task = dashboard.dailyTasks.find((item) => item.category === category);
        return {
          category,
          categoryLabel: getCategoryLabel(category),
          totalCount: getCatalog(category).length,
          completedCount: (dashboard.stats.completedTasks || 0),
          todayTask: task,
          isPendingAsset: task.isPendingAsset
        };
      })
    };
  }
  if (event.action === 'getTaskDetail') {
    const dashboard = await getDashboardData(ctx);
    const task = dashboard.dailyTasks.find((item) => item.category === event.payload.category);
    const progressRecords = await getChildProgressRecords(ctx.family.familyId, ctx.child.childId);
    const history = progressRecords
      .filter((item) => item.category === event.payload.category && item.completedToday)
      .map((item) => ({
        date: item.date,
        taskTitle: item.taskId,
        playCount: item.playCount
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    const todayRecord = (await getCheckins(ctx.family.familyId, ctx.child.childId)).find((item) => item.date === today) || null;
    return {
      child: ctx.child,
      stats: dashboard.stats,
      task,
      progress: {
        playCount: task.playCount,
        playStepText: task.playStepText,
        currentPass: task.currentPass,
        repeatTarget: task.repeatTarget,
        textUnlocked: task.textUnlocked,
        completedToday: task.completedToday
      },
      scriptSource: task.textSource || null,
      todayRecord,
      history
    };
  }
  if (event.action === 'markTaskListened') {
    const category = event.payload.category;
    const progressRecords = await getChildProgressRecords(ctx.family.familyId, ctx.child.childId);
    const cursors = {};
    CATEGORY_ORDER.forEach((item) => {
      const categoryDone = progressRecords.filter((record) => record.category === item && record.completedToday).length;
      cursors[item] = categoryDone % Math.max(getCatalog(item).length || 1, 1);
    });
    const task = getTaskSummary(progressRecords, ctx.child.childId, category, today, cursors);
    if (!task || task.isPendingAsset || task.completedToday) {
      return handleAction({ action: 'getTaskDetail', payload: { category } }, context);
    }
    const nextPlayCount = Math.min((task.playCount || 0) + 1, task.repeatTarget);
    const record = {
      progressId: `${ctx.family.familyId}_${ctx.child.childId}_${today}_${category}`,
      familyId: ctx.family.familyId,
      childId: ctx.child.childId,
      category,
      date: today,
      taskId: task.taskId,
      playCount: nextPlayCount,
      repeatTarget: task.repeatTarget,
      textUnlocked: nextPlayCount >= task.repeatTarget - 1,
      completedToday: nextPlayCount >= task.repeatTarget
    };
    await saveProgressRecord(record);
    const nextProgressRecords = await getChildProgressRecords(ctx.family.familyId, ctx.child.childId);
    await maybeCreateCheckin(ctx.family.familyId, ctx.child.childId, nextProgressRecords, today);
    return handleAction({ action: 'getTaskDetail', payload: { category } }, context);
  }
  if (event.action === 'getProfileData') {
    const dashboard = await getDashboardData(ctx);
    return {
      child: Object.assign({}, ctx.child, dashboard.stats),
      level,
      familyReady: true,
      family: ctx.family,
      members: ctx.members,
      currentMember: ctx.member,
      subscriptionPreference: ctx.subscriptionPreference
    };
  }
  if (event.action === 'getHeatmap') {
    const days = Number(event.payload.days || 28);
    const records = await getCheckins(ctx.family.familyId, ctx.child.childId);
    const counts = {};
    records.forEach((item) => {
      counts[item.date] = (counts[item.date] || 0) + 1;
    });
    const heatmap = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = addDays(today, -i);
      const count = counts[date] || 0;
      heatmap.push({
        date,
        shortDate: date.slice(5),
        count,
        intensity: Math.min(count, 3)
      });
    }
    return { heatmap };
  }
  if (event.action === 'getParentDashboard') {
    const dashboard = await getDashboardData(ctx);
    const recentReports = [];
    for (let i = 0; i < 7; i += 1) {
      const date = addDays(today, -i);
      recentReports.push(await upsertDailyReport(ctx.family.familyId, ctx.child.childId, date));
    }
    return {
      family: ctx.family,
      child: ctx.child,
      stats: dashboard.stats,
      todayReport: recentReports[0],
      recentReports,
      members: ctx.members,
      subscriptionPreference: ctx.subscriptionPreference
    };
  }
  if (event.action === 'getFamilyPage') {
    return {
      family: ctx.family,
      currentMember: ctx.member,
      members: ctx.members,
      child: ctx.child,
      subscriptionPreference: ctx.subscriptionPreference
    };
  }
  if (event.action === 'refreshInviteCode') {
    const inviteCode = makeInviteCode();
    await db.collection('families').doc(ctx.family.familyId).update({ data: { inviteCode } });
    return handleAction({ action: 'getFamilyPage', payload: {} }, context);
  }
  if (event.action === 'joinFamily') {
    const inviteCode = String((event.payload && event.payload.inviteCode) || '').trim();
    const target = (await db.collection('families').where({ inviteCode }).limit(1).get()).data[0];
    if (!target) {
      throw new Error('邀请码不正确');
    }
    const displayName = String((event.payload && event.payload.displayName) || '').trim() || '新家长';
    const memberRes = await db.collection('familyMembers').where({ openId: OPENID }).limit(1).get();
    if (memberRes.data[0]) {
      await db.collection('familyMembers').doc(memberRes.data[0]._id).update({
        data: {
          familyId: target.familyId,
          displayName
        }
      });
    } else {
      await db.collection('familyMembers').add({
        data: {
          memberId: `member-${Date.now()}`,
          familyId: target.familyId,
          openId: OPENID,
          role: 'parent',
          displayName,
          subscriptionEnabled: false,
          createdAt: new Date().toISOString()
        }
      });
    }
    return handleAction({ action: 'getFamilyPage', payload: {} }, context);
  }
  if (event.action === 'updateSubscription') {
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
  throw new Error(`unsupported action: ${event.action}`);
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
