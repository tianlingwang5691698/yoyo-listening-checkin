const appConfig = require('./app-config');
const { peppaTranscriptTracks, peppaTranscriptBuildStatus } = require('./transcripts/peppa/index');
const { unlockTranscriptTracks, unlockTranscriptBuildStatus } = require('./transcripts/unlock1/index');

function buildCloudAssetUrl(cloudPath) {
  const baseUrl = String(appConfig.cloudAssetBaseUrl || '').replace(/\/+$/, '');
  const normalizedPath = String(cloudPath || '').replace(/^\/+/, '');
  if (!baseUrl || !normalizedPath) {
    return '';
  }
  return `${baseUrl}/${encodeURI(normalizedPath)}`;
}

function buildCloudFileId(cloudPath) {
  const envId = String(appConfig.cloudEnvId || '').trim();
  const bucket = String(appConfig.cloudBucket || '').trim();
  const normalizedPath = String(cloudPath || '').replace(/^\/+/, '');
  if (!envId || !bucket || !normalizedPath) {
    return '';
  }
  return `cloud://${envId}.${bucket}/${normalizedPath}`;
}

const childProfiles = [
  {
    childId: 'child-yoyo',
    nickname: '佑佑',
    avatarText: 'YY',
    currentLevel: 'A1',
    totalCompleted: 0,
    ageLabel: '启蒙阶段',
    welcomeLine: '今天听三遍，小耳朵慢慢就会越来越灵。'
  }
];

const levels = [
  {
    levelId: 'A1',
    name: 'A1 纯音频听力',
    description: '每天三项音频任务，每条固定听 3 遍，有文本的条目从第一遍就能边听边看。'
  }
];

const peppaScriptSource = {
  sourceType: 'pdf',
  title: 'Peppa Pig Season 1 Script',
  filePath: buildCloudAssetUrl('A1/Peppa/第1季/PeppaPig第1季英文剧本台词.pdf')
};

const unlockAudioRoot = 'A1/Unlock1/Unlock1 听口音频 Class Audio';

const unlockScriptSource = {
  sourceType: 'pdf',
  title: 'Unlock 2e Listening and Speaking 1 Scripts',
  filePath: buildCloudAssetUrl(`${unlockAudioRoot}/Unlock 2e Listening and Speaking 1 Scripts.pdf`)
};

const songLyricsSource = {
  sourceType: 'transcript-bundle',
  title: 'Super Simple Songs Lyrics',
  filePath: ''
};

const transcriptTracks = [...peppaTranscriptTracks, ...unlockTranscriptTracks];
const peppaDurationOverrides = {
  'S101 Muddy Puddles': 311
};

const peppaTasks = peppaTranscriptBuildStatus.map((transcriptStatus, index) => {
  const fileName = transcriptStatus.fileName;
  const durationSec = peppaDurationOverrides[fileName] || 300;
  return {
    taskId: transcriptStatus.taskId || `peppa-${index + 1}`,
    category: 'peppa',
    title: fileName,
    subtitle: 'Peppa Pig Season 1',
    audioUrl: buildCloudAssetUrl(`A1/Peppa/第1季/${fileName}.mp3`),
    audioCloudPath: `A1/Peppa/第1季/${fileName}.mp3`,
    audioFileId: buildCloudFileId(`A1/Peppa/第1季/${fileName}.mp3`),
    audioSource: 'static-cloud-url',
    repeatTarget: 3,
    durationSec,
    coverTone: 'sunrise',
    transcriptTrackId: transcriptStatus.trackId,
    transcriptStatus: transcriptStatus.status || 'pending',
    transcriptBatch: transcriptStatus.batch || null,
    textSource: peppaScriptSource
  };
});

const unlockAudioFiles = [
  ['Unlock2e_A1_1.2.mp3', 85],
  ['Unlock2e_A1_1.5.mp3', 145],
  ['Unlock2e_A1_2.2.mp3', 120],
  ['Unlock2e_A1_2.3.mp3', 65],
  ['Unlock2e_A1_2.5.mp3', 132],
  ['Unlock2e_A1_3.3.mp3', 160],
  ['Unlock2e_A1_3.5.mp3', 156],
  ['Unlock2e_A1_3.6.mp3', 64],
  ['Unlock2e_A1_4.2.mp3', 163],
  ['Unlock2e_A1_4.3.mp3', 89],
  ['Unlock2e_A1_4.4.mp3', 165],
  ['Unlock2e_A1_4.9.mp3', 62],
  ['Unlock2e_A1_5.3.mp3', 158],
  ['Unlock2e_A1_5.6.mp3', 156],
  ['Unlock2e_A1_6.2.mp3', 215],
  ['Unlock2e_A1_6.5.mp3', 184],
  ['Unlock2e_A1_6.6.mp3', 93],
  ['Unlock2e_A1_7.2.mp3', 66],
  ['Unlock2e_A1_7.3.mp3', 200],
  ['Unlock2e_A1_7.4.mp3', 176],
  ['Unlock2e_A1_7.9.mp3', 68],
  ['Unlock2e_A1_8.3.mp3', 177],
  ['Unlock2e_A1_8.5.mp3', 159],
  ['Unlock2e_A1_8.6.mp3', 69]
];

const unlockTasks = unlockAudioFiles.map(([fileName, durationSec], index) => {
  const taskId = `unlock1-${index + 1}`;
  const transcriptStatus = unlockTranscriptBuildStatus.find((item) => item.taskId === taskId) || null;
  return {
    taskId,
    category: 'unlock1',
    title: fileName.replace(/\.mp3$/i, ''),
    subtitle: `Unlock 1 第 ${index + 1} 条`,
    audioUrl: buildCloudAssetUrl(`${unlockAudioRoot}/${fileName}`),
    audioCloudPath: `${unlockAudioRoot}/${fileName}`,
    audioFileId: buildCloudFileId(`${unlockAudioRoot}/${fileName}`),
    audioSource: 'static-cloud-url',
    repeatTarget: 3,
    durationSec,
    coverTone: index % 2 === 0 ? 'peach' : 'berry',
    transcriptTrackId: transcriptStatus ? transcriptStatus.trackId : null,
    transcriptStatus: transcriptStatus ? transcriptStatus.status : 'pending',
    transcriptBatch: transcriptStatus ? transcriptStatus.batch : null,
    textSource: unlockScriptSource
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

module.exports = {
  childProfiles,
  levels,
  peppaTasks,
  unlockTasks,
  songTasks,
  songPlaceholder,
  transcriptTracks,
  peppaTranscriptBuildStatus,
  unlockTranscriptBuildStatus
};
