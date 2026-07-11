#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');

const appConfig = require('../app-config');
const { TRANSCRIPT_BUNDLE_PATHS } = require('../cloudfunctions/yoyo/lib/constants');

let CloudBaseManager;
try {
  CloudBaseManager = require('../cloudfunctions/yoyo/node_modules/@cloudbase/manager-node');
} catch (error) {
  CloudBaseManager = require('@cloudbase/manager-node');
}

const AUDIO_FILE_PATTERN = /\.(mp3|m4a|aac|wav)$/i;
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'cloud-catalog.generated.js');

const ROOT_CANDIDATES = {
  newconcept1: ['A1/NewConcept1-US', 'A1/NewConcept1', 'A1/New Concept 1', 'A1/new-concept-1-us'],
  peppa: ['A1/Peppa'],
  unlock1: ['A1/Unlock1/Unlock1 听口音频 Class Audio', 'A1/Unlock1/Unlock1 听口音频Class Audio', 'A1/Unlock1'],
  song: ['A1/Super simple songs', 'A1/Super simple song']
};

function normalizeCloudPath(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

function getBaseName(value) {
  return normalizeCloudPath(value).split('/').pop().replace(/\.[^.]+$/i, '');
}

function getParentFolder(value) {
  const parts = normalizeCloudPath(value).split('/');
  parts.pop();
  return parts.join('/');
}

function buildCloudAssetUrl(cloudPath) {
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  return `${baseUrl}/${encodeURI(normalizeCloudPath(cloudPath))}`;
}

function buildCloudFileId(cloudPath) {
  return `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${normalizeCloudPath(cloudPath)}`;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/i, '')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sortFiles(left, right) {
  return normalizeCloudPath(left.cloudPath).localeCompare(normalizeCloudPath(right.cloudPath), 'zh-Hans-CN', {
    numeric: true,
    sensitivity: 'base'
  });
}

function inferSongMeta(baseName) {
  const match = baseName.replace(/^0+/, '').match(/^(\d+)(?:[.\s_-]+)(.+)$/);
  if (!match) {
    return null;
  }
  const number = Number(match[1]);
  const padded = String(number).padStart(3, '0');
  return {
    taskId: `super-simple-songs-${number}`,
    title: `${padded} ${match[2].trim()}`,
    subtitle: 'Super Simple Songs',
    transcriptTrackId: `track-sss-${padded}`,
    transcriptBatch: Math.floor((number - 1) / 100) + 1,
    syncGranularity: 'line'
  };
}

function inferNewConceptMeta(category, baseName, index) {
  const slug = slugify(baseName);
  const ordinal = String(index + 1).padStart(3, '0');
  return {
    taskId: `${category}-${index + 1}`,
    title: baseName,
    subtitle: 'New Concept English 1',
    transcriptTrackId: `track-new-concept-1-us-${slug || ordinal}`,
    transcriptTrackCandidates: [
      `track-new-concept-1-us-${slug || ordinal}`,
      `new-concept-1-us-${slug || ordinal}`,
      `track-nce1-us-${ordinal}`,
      `nce1-us-${ordinal}`,
      baseName
    ],
    transcriptBatch: Math.floor(index / 24) + 1,
    syncGranularity: 'line',
    coverTone: 'peach',
    textSource: {
      sourceType: 'transcript-bundle',
      title: 'A1 New Concept English 1',
      filePath: ''
    }
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

function downloadCloudJson(cloudPath) {
  return new Promise((resolve, reject) => {
    https.get(buildCloudAssetUrl(cloudPath), (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`download failed: ${response.statusCode}`));
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

async function getTranscriptDurationLookup(category) {
  const paths = Array.isArray(TRANSCRIPT_BUNDLE_PATHS[category]) ? TRANSCRIPT_BUNDLE_PATHS[category] : [TRANSCRIPT_BUNDLE_PATHS[category]];
  let trackMap = {};
  for (const cloudPath of (paths || []).filter(Boolean)) {
    try {
      const nextMap = await downloadCloudJson(cloudPath);
      trackMap = Object.assign(trackMap, nextMap || {});
      if (category !== 'peppa') {
        break;
      }
    } catch (error) {
      // try next bundle
    }
  }
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

async function listDirectoryFiles(manager, root) {
  const result = await manager.storage.listDirectoryFiles(normalizeCloudPath(root));
  const rawFiles = Array.isArray(result) ? result : ((((result || {}).data || {}).files || []));
  return rawFiles.map((item) => {
    const cloudPath = normalizeCloudPath(item.cloud_path || item.cloudPath || item.Key || '');
    return {
      cloudPath,
      fileId: item.fileid || item.fileID || item.fileId || buildCloudFileId(cloudPath),
      size: Number(item.size || item.Size || 0)
    };
  }).filter((item) => item.cloudPath);
}

async function scanCategory(manager, category) {
  const roots = ROOT_CANDIDATES[category] || [];
  const errors = [];
  const durationLookup = await getTranscriptDurationLookup(category);
  for (const root of roots) {
    try {
      const files = await listDirectoryFiles(manager, root);
      const audioFiles = files.filter((item) => AUDIO_FILE_PATTERN.test(item.cloudPath)).sort(sortFiles);
      if (!audioFiles.length) {
        continue;
      }
      const pdfByFolder = {};
      files.filter((item) => /\.pdf$/i.test(item.cloudPath)).forEach((item) => {
        pdfByFolder[getParentFolder(item.cloudPath)] = item;
      });
      const tasks = audioFiles.map((file, index) => {
        const baseName = getBaseName(file.cloudPath);
        const folderPdf = pdfByFolder[getParentFolder(file.cloudPath)] || null;
        const songMeta = category === 'song' ? inferSongMeta(baseName) : null;
        const nceMeta = category === 'newconcept1' ? inferNewConceptMeta(category, baseName, index) : null;
        const durationSec = getDurationFromLookup(durationLookup, (songMeta && songMeta.transcriptTrackId) || (nceMeta && nceMeta.transcriptTrackId), nceMeta && nceMeta.transcriptTrackCandidates);
        return Object.assign({}, songMeta || nceMeta || {}, {
          taskId: (songMeta && songMeta.taskId) || (nceMeta && nceMeta.taskId) || `${category}-${index + 1}`,
          category,
          title: (songMeta && songMeta.title) || (nceMeta && nceMeta.title) || baseName,
          subtitle: (songMeta && songMeta.subtitle) || (nceMeta && nceMeta.subtitle) || getParentFolder(file.cloudPath).split('/').pop(),
          audioUrl: buildCloudAssetUrl(file.cloudPath),
          audioCloudPath: file.cloudPath,
          audioFileId: file.fileId,
          audioSource: 'static-cloud-url',
          repeatTarget: 3,
          durationSec: durationSec || 180,
          coverTone: (nceMeta && nceMeta.coverTone) || (category === 'song' ? 'mint' : 'sunrise'),
          transcriptStatus: ((songMeta && songMeta.transcriptTrackId) || (nceMeta && nceMeta.transcriptTrackId)) ? 'ready' : (folderPdf ? 'pending' : 'none'),
          textSource: (nceMeta && nceMeta.textSource) || (category === 'song' ? {
            sourceType: 'transcript-bundle',
            title: 'Super Simple Songs Lyrics',
            filePath: ''
          } : (folderPdf ? {
            sourceType: 'pdf',
            title: getBaseName(folderPdf.cloudPath),
            filePath: folderPdf.cloudPath,
            fileId: folderPdf.fileId
          } : null))
        });
      });
      return { root, tasks };
    } catch (error) {
      errors.push(`${root}: ${error.message || error}`);
    }
  }
  return { root: roots[0] || '', tasks: [], errors };
}

function getManager() {
  const secretId = process.env.TENCENTCLOUD_SECRETID || process.env.SECRETID;
  const secretKey = process.env.TENCENTCLOUD_SECRETKEY || process.env.SECRETKEY;
  const token = process.env.TENCENTCLOUD_SESSIONTOKEN || process.env.TOKEN;
  if (!secretId || !secretKey) {
    throw new Error('缺少 TENCENTCLOUD_SECRETID / TENCENTCLOUD_SECRETKEY');
  }
  return new CloudBaseManager({
    secretId,
    secretKey,
    token,
    envId: appConfig.cloudEnvId
  });
}

async function main() {
  const manager = getManager();
  const result = {};
  for (const category of Object.keys(ROOT_CANDIDATES)) {
    result[category] = await scanCategory(manager, category);
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    categories: Object.fromEntries(Object.entries(result).map(([category, item]) => [category, {
      root: item.root,
      count: item.tasks.length,
      errors: item.errors || []
    }])),
    tasks: Object.fromEntries(Object.entries(result).map(([category, item]) => [category, item.tasks]))
  };
  fs.writeFileSync(OUTPUT_PATH, `// Generated by scripts/sync_cloud_catalog.js. Do not edit by hand.\nmodule.exports = ${JSON.stringify(payload, null, 2)};\n`);
  Object.entries(payload.categories).forEach(([category, item]) => {
    console.log(`${category}: ${item.count} (${item.root || 'not found'})`);
    if (item.errors.length) {
      console.log(`  ${item.errors.join(' | ')}`);
    }
  });
  console.log(`written: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
