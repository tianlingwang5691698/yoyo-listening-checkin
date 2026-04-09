const cloud = require('wx-server-sdk');
const CloudBaseManager = require('@cloudbase/manager-node');
const { parseBuffer } = require('music-metadata');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const CLOUD_ENV_ID = process.env.TCB_ENV || process.env.SCF_NAMESPACE || cloud.DYNAMIC_CURRENT_ENV;
const UNLOCK1_AUDIO_ROOT = 'A1/Unlock1/Unlock1 听口音频 Class Audio';
const TRAINING_POOL_COLLECTION = 'unlock1AudioTrainingPool';
const AUDIO_FILE_PATTERN = /\.(mp3|m4a|wav)$/i;
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
  const result = await manager.storage.listDirectoryFiles(normalizeCloudPath(cloudPath));
  const rawFiles = Array.isArray(result) ? result : ((((result || {}).data || {}).files || []));
  return rawFiles
    .map(extractStorageFile)
    .filter(Boolean);
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

async function downloadAudioBuffer(fileID) {
  const response = await cloud.downloadFile({
    fileID
  });
  const fileContent = response && response.fileContent;
  if (!fileContent) {
    throw new Error('download-empty');
  }
  if (Buffer.isBuffer(fileContent)) {
    return fileContent;
  }
  return Buffer.from(fileContent);
}

async function readDurationSec(file) {
  const fileBuffer = await downloadAudioBuffer(file.fileID);
  const metadata = await parseBuffer(fileBuffer, getFileExt(file.cloudPath), {
    duration: true
  });
  const duration = Number((((metadata || {}).format || {}).duration) || 0);
  if (!duration || !Number.isFinite(duration)) {
    throw new Error('duration-unavailable');
  }
  return Math.round(duration);
}

function buildTrainingRecord(file, durationSec, now) {
  const isExcluded = durationSec <= 30;
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
  const rootPath = UNLOCK1_AUDIO_ROOT;
  const scannedFiles = await listDirectoryFiles(rootPath);
  const audioFiles = scannedFiles.filter(isAudioCandidate);
  const now = Date.now();
  const stats = {
    ok: true,
    action: 'scanUnlock1Audio',
    rootPath,
    scannedCount: scannedFiles.length,
    supportedAudioCount: audioFiles.length,
    eligibleCount: 0,
    excludedShortCount: 0,
    durationReadFailedCount: 0,
    upsertedCount: 0,
    skippedCount: 0,
    createdCount: 0,
    updatedCount: 0
  };

  for (let index = 0; index < audioFiles.length; index += 1) {
    const file = audioFiles[index];
    try {
      const durationSec = await readDurationSec(file);
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
      stats.durationReadFailedCount += 1;
      stats.skippedCount += 1;
    }
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
