const cloud = require('wx-server-sdk');
const CloudBaseManager = require('@cloudbase/manager-node');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const CLOUD_ENV_ID = process.env.TCB_ENV || process.env.SCF_NAMESPACE || cloud.DYNAMIC_CURRENT_ENV;
const UNLOCK1_AUDIO_ROOT = 'A1/Unlock1/Unlock1 听口音频 Class Audio';
const UNLOCK1_ROOT_CANDIDATES = [UNLOCK1_AUDIO_ROOT, 'A1/Unlock1'];
const TRAINING_POOL_COLLECTION = 'unlock1AudioTrainingPool';
const AUDIO_FILE_PATTERN = /\.(mp3|m4a|wav)$/i;
const KNOWN_UNLOCK1_DURATIONS = {
  'unlock2e_a1_1.2': 85,
  'unlock2e_a1_1.5': 145,
  'unlock2e_a1_2.2': 120,
  'unlock2e_a1_2.3': 65,
  'unlock2e_a1_2.5': 132,
  'unlock2e_a1_3.3': 160,
  'unlock2e_a1_3.5': 156,
  'unlock2e_a1_3.6': 64,
  'unlock2e_a1_4.2': 163,
  'unlock2e_a1_4.3': 89,
  'unlock2e_a1_4.4': 165,
  'unlock2e_a1_4.9': 62,
  'unlock2e_a1_5.3': 158,
  'unlock2e_a1_5.6': 156,
  'unlock2e_a1_6.2': 215,
  'unlock2e_a1_6.5': 184,
  'unlock2e_a1_6.6': 93,
  'unlock2e_a1_7.2': 66,
  'unlock2e_a1_7.3': 200,
  'unlock2e_a1_7.4': 176,
  'unlock2e_a1_7.9': 68,
  'unlock2e_a1_8.3': 177,
  'unlock2e_a1_8.5': 159,
  'unlock2e_a1_8.6': 69
};
const STATUS = {
  EXCLUDED_SHORT_AUDIO: 'excluded_short_audio',
  ELIGIBLE: 'eligible',
  TRANSCRIPT_PENDING: 'transcript_pending',
  TRANSCRIPT_ALIGNED: 'transcript_aligned',
  TRANSCRIPT_GENERATED: 'transcript_generated',
  TRANSCRIPT_FAILED: 'transcript_failed'
};
const TRANSCRIPT_MODE = {
  NONE: 'none',
  ALIGNED: 'aligned',
  GENERATED: 'generated'
};
const SOURCE_TYPE = 'unlock1_cloud_scan';
const SCAN_VERSION = 1;
const TRANSCRIPT_STATUSES = new Set([
  STATUS.TRANSCRIPT_PENDING,
  STATUS.TRANSCRIPT_ALIGNED,
  STATUS.TRANSCRIPT_GENERATED,
  STATUS.TRANSCRIPT_FAILED
]);

let storageManager = null;
let storageDebugShapes = {};

function normalizeCloudPath(path) {
  return String(path || '').replace(/^\/+|\/+$/g, '');
}

function getStorageManager() {
  if (storageManager) {
    return storageManager;
  }
  const secretId = process.env.TENCENTCLOUD_SECRETID || process.env.SECRETID;
  const secretKey = process.env.TENCENTCLOUD_SECRETKEY || process.env.SECRETKEY;
  const token = process.env.TENCENTCLOUD_SESSIONTOKEN || process.env.TOKEN;
  if (!CLOUD_ENV_ID) {
    throw new Error('cloud-env-unavailable');
  }
  storageManager = new CloudBaseManager({
    secretId,
    secretKey,
    token,
    envId: CLOUD_ENV_ID
  });
  return storageManager;
}

function extractStorageFile(item) {
  const cloudPath = normalizeCloudPath(item.cloud_path || item.cloudPath || item.Key || '');
  if (!cloudPath) {
    return null;
  }
  return {
    cloudPath,
    fileID: item.fileid || item.fileID || item.fileId || `cloud://${CLOUD_ENV_ID}.${item.bucket || ''}/${cloudPath}`,
    size: Number(item.size || item.Size || 0)
  };
}

async function listDirectoryFiles(cloudPath) {
  const manager = getStorageManager();
  const normalizedRoot = normalizeCloudPath(cloudPath);
  const result = await manager.storage.listDirectoryFiles(normalizedRoot);
  const rawFiles = Array.isArray(result) ? result : ((((result || {}).data || {}).files || []));
  const firstItem = rawFiles[0] || null;
  storageDebugShapes[normalizedRoot] = firstItem ? Object.keys(firstItem).sort() : [];
  return rawFiles
    .map(extractStorageFile)
    .filter(Boolean);
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

function getBaseName(cloudPath) {
  const fileName = normalizeCloudPath(cloudPath).split('/').pop() || '';
  return fileName.replace(/\.[^.]+$/i, '');
}

function getFileExt(cloudPath) {
  const match = normalizeCloudPath(cloudPath).match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

function isAudioCandidate(file) {
  return AUDIO_FILE_PATTERN.test(file.cloudPath);
}

async function ensureCollectionReady(collectionName) {
  try {
    await db.collection(collectionName).limit(1).get();
  } catch (error) {
    const message = String((error && (error.errMsg || error.message)) || '');
    if (
      message.includes('DATABASE_COLLECTION_NOT_EXIST')
      || message.includes('database collection not exists')
      || message.includes('collection.get:fail')
    ) {
      const envMessage = `缺少 collection: ${collectionName}，请先在 CloudBase 控制台手动创建空集合`;
      const nextError = new Error(envMessage);
      nextError.code = 'collection-not-ready';
      nextError.collectionName = collectionName;
      throw nextError;
    }
    throw error;
  }
}

function normalizeDurationLookupKey(value) {
  return getBaseName(value).trim().toLowerCase();
}

function readDurationSec(file) {
  const duration = KNOWN_UNLOCK1_DURATIONS[normalizeDurationLookupKey(file.cloudPath)];
  if (!duration || !Number.isFinite(duration)) {
    return 0;
  }
  return Math.round(duration);
}

function buildTrainingRecord(file, durationSec, now) {
  const isExcluded = durationSec < 60;
  return {
    fileID: file.fileID,
    cloudPath: file.cloudPath,
    title: getBaseName(file.cloudPath),
    durationSec,
    status: isExcluded ? STATUS.EXCLUDED_SHORT_AUDIO : STATUS.ELIGIBLE,
    transcriptMode: TRANSCRIPT_MODE.NONE,
    transcriptText: '',
    transcriptSegments: [],
    sourceType: SOURCE_TYPE,
    category: 'unlock1',
    fileExt: getFileExt(file.cloudPath),
    size: file.size || 0,
    scanVersion: SCAN_VERSION,
    lastScanAt: now,
    createdAt: now,
    updatedAt: now
  };
}

async function upsertTrainingRecord(record) {
  const existing = await db.collection(TRAINING_POOL_COLLECTION).where({
    fileID: record.fileID
  }).limit(1).get();
  if (existing.data[0]) {
    const current = existing.data[0];
    const preserveTranscriptState = TRANSCRIPT_STATUSES.has(current.status);
    const nextRecord = Object.assign({}, record, {
      status: preserveTranscriptState ? current.status : record.status,
      transcriptMode: preserveTranscriptState ? (current.transcriptMode || TRANSCRIPT_MODE.NONE) : record.transcriptMode,
      transcriptText: preserveTranscriptState ? (current.transcriptText || '') : record.transcriptText,
      transcriptSegments: preserveTranscriptState ? (current.transcriptSegments || []) : record.transcriptSegments,
      createdAt: current.createdAt || record.createdAt,
      updatedAt: record.updatedAt
    });
    await db.collection(TRAINING_POOL_COLLECTION).doc(current._id).update({
      data: nextRecord
    });
    return 'updated';
  }
  await db.collection(TRAINING_POOL_COLLECTION).add({
    data: record
  });
  return 'created';
}

function buildNotImplemented(action) {
  return {
    ok: false,
    code: 'not_implemented',
    action,
    message: 'reserved for future transcript pipeline'
  };
}

async function scanUnlock1Audio() {
  await ensureCollectionReady(TRAINING_POOL_COLLECTION);
  const rootCandidates = UNLOCK1_ROOT_CANDIDATES.slice();
  let rootPath = rootCandidates[0];
  let scannedFiles = [];
  let scanError = '';

  for (let index = 0; index < rootCandidates.length; index += 1) {
    const candidate = rootCandidates[index];
    try {
      const files = await listDirectoryFiles(candidate);
      if (files.length) {
        rootPath = candidate;
        scannedFiles = files;
        scanError = '';
        break;
      }
      if (!scannedFiles.length) {
        rootPath = candidate;
      }
    } catch (error) {
      scanError = `${candidate}: ${formatStorageError(error)}`;
    }
  }

  const audioFiles = scannedFiles.filter(isAudioCandidate);
  const now = Date.now();
  const rawStorageShape = (storageDebugShapes[normalizeCloudPath(rootPath)] || []).join(',');
  const samplePath = audioFiles[0] ? audioFiles[0].cloudPath : (scannedFiles[0] ? scannedFiles[0].cloudPath : '');
  const stats = {
    ok: true,
    action: 'scanUnlock1Audio',
    rootPath,
    rootCandidates,
    scannedCount: scannedFiles.length,
    supportedAudioCount: audioFiles.length,
    samplePath,
    rawStorageShape,
    scanError,
    eligibleCount: 0,
    excludedShortCount: 0,
    durationResolvedByStaticMapCount: 0,
    durationReadFailedCount: 0,
    upsertedCount: 0,
    skippedCount: 0,
    createdCount: 0,
    updatedCount: 0
  };

  for (let index = 0; index < audioFiles.length; index += 1) {
    const file = audioFiles[index];
    try {
      const durationSec = readDurationSec(file);
      if (durationSec > 0) {
        stats.durationResolvedByStaticMapCount += 1;
      } else {
        stats.durationReadFailedCount += 1;
        stats.skippedCount += 1;
        continue;
      }
      const record = buildTrainingRecord(file, durationSec, now);
      const upsertAction = await upsertTrainingRecord(record);
      stats.upsertedCount += 1;
      if (upsertAction === 'created') {
        stats.createdCount += 1;
      } else {
        stats.updatedCount += 1;
      }
      if (record.status === STATUS.EXCLUDED_SHORT_AUDIO) {
        stats.excludedShortCount += 1;
      } else {
        stats.eligibleCount += 1;
      }
    } catch (error) {
      stats.skippedCount += 1;
      scanError = scanError || formatStorageError(error);
    }
  }

  if (!stats.scannedCount) {
    stats.ok = false;
    stats.message = scanError
      ? `未扫描到存储文件：${scanError}`
      : `未扫描到存储文件，请检查目录 ${rootCandidates.join(' / ')}`;
  } else if (!stats.supportedAudioCount) {
    stats.ok = false;
    stats.message = '扫描到了文件，但没有识别到可支持的音频格式';
  } else if (!stats.upsertedCount) {
    stats.ok = false;
    stats.message = '扫描到了音频，但没有任何记录写入训练池';
  } else {
    stats.message = '训练池扫描并写库完成';
  }

  return stats;
}

async function handleAction(event) {
  const action = String((event && event.action) || 'scanUnlock1Audio');
  if (action === 'scanUnlock1Audio') {
    return scanUnlock1Audio();
  }
  if (action === 'alignTranscriptWithAudio') {
    return buildNotImplemented(action);
  }
  if (action === 'generateTranscriptFromAudio') {
    return buildNotImplemented(action);
  }
  throw new Error(`unsupported action: ${action}`);
}

exports.main = async (event) => {
  return handleAction(event || {});
};
