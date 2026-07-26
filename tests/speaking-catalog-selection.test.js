const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadSpeakingPage(store, wx = {}) {
  const source = fs.readFileSync(path.join(root, 'pages/speaking/index.js'), 'utf8');
  let definition = null;
  const context = {
    clearTimeout,
    console,
    Date,
    Page(value) {
      definition = value;
    },
    require(request) {
      if (request === '../../utils/page') {
        return {
          createCloudPageData: (data) => data,
          startPagePerf: () => ({ ready() {} }),
          syncTheme() {}
        };
      }
      if (request === '../../utils/store') return store;
      if (request === '../../utils/effects') return {};
      if (request === '../../utils/i18n') {
        return { getPageText: (pageId, key, params, fallback) => fallback };
      }
      if (request === '../../utils/labels') {
        return { decodeHtmlEntities: (value) => String(value || '').replace(/&#39;/g, "'") };
      }
      if (request === '../../utils/ielts-speaking-report-download') {
        return { openIeltsSpeakingReportPdf: async () => {} };
      }
      if (request === '../../app-config') return { cloudAssetBaseUrl: 'https://example.test' };
      throw new Error(`Unexpected require: ${request}`);
    },
    setTimeout,
    wx
  };
  vm.runInNewContext(source, context, { filename: 'pages/speaking/index.js' });
  return definition;
}

function createPageInstance(definition) {
  const instance = Object.assign({}, definition, {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch, callback) {
      Object.assign(this.data, patch);
      if (callback) callback();
    }
  });
  instance.repeatCatalogCache = {};
  instance.repeatRequestToken = 0;
  instance.questionPlaybackRequestToken = 0;
  instance.ieltsIntroPlaybackRequestToken = 0;
  return instance;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('分级跟读按级别、系列、音频、段落逐层按需加载', async () => {
  const tasks = Array.from({ length: 6 }, (_, index) => ({
    taskId: `newconcept2-${index + 1}`,
    category: 'newconcept2',
    displayTitle: `Lesson ${index + 1}`,
    durationSec: 60
  }));
  const transcriptLines = [
    { lineId: 'l1', text: 'Hello.', startMs: 1000, endMs: 2200 },
    { lineId: 'l2', text: 'How are you?', startMs: 2400, endMs: 4000 },
    { lineId: 'l3', text: 'I am fine.', startMs: 4300, endMs: 5600 },
    { lineId: 'l4', text: 'Thank you.', startMs: 8000, endMs: 9200 },
    { lineId: 'l5', text: 'See you.', startMs: 9400, endMs: 10400 },
    { lineId: 'l6', text: 'Goodbye.', startMs: 10600, endMs: 11600 }
  ];
  const store = {
    async getListeningMaterialCatalog() {
      return { tasks };
    },
    async getTaskDetail(category, taskId, options) {
      return { task: Object.assign({}, options.taskSnapshot, { audioUrl: 'https://example.test/audio.mp3' }) };
    },
    async getTaskTranscript() {
      return { transcriptLines };
    }
  };
  const page = createPageInstance(loadSpeakingPage(store));

  await page.loadRepeatLevel('A2');
  assert.equal(page.data.selectedSeriesId, '');
  assert.equal(page.data.repeatAudios.length, 0);
  assert.equal(page.data.repeatParagraphs.length, 0);

  page.openRepeatSeriesPicker();
  assert.equal(page.data.audioPickerType, 'series');
  assert.equal(page.data.audioPickerAudios.length, 7);
  await page.selectRepeatPickerItem({ currentTarget: { dataset: { pickerId: 'newconcept2', pickerIndex: '0' } } });

  assert.equal(page.data.repeatAudios.length, 6);
  assert.equal(page.data.selectedAudioId, '');
  assert.equal(page.data.repeatParagraphs.length, 0);

  page.openRepeatAudioPicker();
  assert.equal(page.data.audioPickerVisible, true);
  assert.equal(page.data.audioPickerAudios.length, 6);
  page.filterRepeatAudios({ detail: { value: 'Lesson 5' } });
  assert.equal(page.data.audioPickerAudios.length, 1);
  assert.equal(page.data.audioPickerListHeight, '180rpx');
  await page.selectRepeatPickerItem({ currentTarget: { dataset: { pickerId: 'newconcept2-5', pickerIndex: '4' } } });
  assert.equal(page.data.selectedAudioId, 'newconcept2-5');
  assert.equal(page.data.audioPickerVisible, false);
  assert.equal(page.data.repeatParagraphs.length, 2);
  assert.equal(page.data.selectedParagraphId, '');
  assert.equal(page.data.repeatParagraphs[1].sentences[0].text, 'Thank you.');

  page.openRepeatParagraphPicker();
  assert.equal(page.data.audioPickerType, 'paragraph');
  assert.equal(page.data.audioPickerAudios.length, 2);
  page.selectRepeatPickerItem({ currentTarget: { dataset: { pickerId: page.data.repeatParagraphs[1].id, pickerIndex: '1' } } });
  assert.equal(page.data.selectedParagraphId, page.data.repeatParagraphs[1].id);
});

test('分级跟读目录先完成，选择音频后才读取 transcript', async () => {
  let releaseDetail;
  const detailPending = new Promise((resolve) => { releaseDetail = resolve; });
  const page = createPageInstance(loadSpeakingPage({
    async getListeningMaterialCatalog() {
      return { tasks: [{ taskId: 'newconcept2-1', category: 'newconcept2', title: 'Lesson 1', durationSec: 60 }] };
    },
    async getTaskDetail(category, taskId, options) {
      await detailPending;
      return { task: Object.assign({}, options.taskSnapshot, { audioUrl: 'https://example.test/audio.mp3' }) };
    },
    async getTaskTranscript() {
      return { transcriptLines: [{ lineId: 'l1', text: 'Loaded later.', startMs: 0, endMs: 1000 }] };
    }
  }));

  await page.loadRepeatLevel('A2');
  await page.selectRepeatSeries({ currentTarget: { dataset: { seriesId: 'newconcept2' } } });

  assert.equal(page.data.repeatAudioLoading, false);
  assert.equal(page.data.repeatAudios.length, 1);
  assert.equal(page.data.repeatParagraphLoading, false);
  assert.equal(page.data.repeatParagraphs.length, 0);

  const selectingAudio = page.selectRepeatAudio({ currentTarget: { dataset: { audioIndex: '0' } } });
  assert.equal(page.data.repeatParagraphLoading, true);
  assert.equal(page.data.repeatParagraphs.length, 0);

  releaseDetail();
  await selectingAudio;
  assert.equal(page.data.repeatParagraphLoading, false);
  assert.equal(page.data.repeatParagraphs.length, 1);
  assert.equal(page.data.selectedParagraphId, '');
});

test('分级跟读系列触摸预取与点击复用同一目录请求', async () => {
  let requestCount = 0;
  let releaseRequest;
  const pending = new Promise((resolve) => { releaseRequest = resolve; });
  const page = createPageInstance(loadSpeakingPage({
    async getListeningMaterialCatalog() {
      requestCount += 1;
      await pending;
      return { tasks: [{ taskId: 'newconcept2-1', category: 'newconcept2', title: 'Lesson 1' }] };
    }
  }));
  page.data.selectedLevel = 'A2';
  page.data.repeatSeries = [{ id: 'newconcept2', title: 'New Concept 2' }];
  const event = { currentTarget: { dataset: { seriesId: 'newconcept2' } } };

  page.prefetchRepeatSeries(event);
  const selected = page.loadRepeatCatalog('A2', page.data.repeatSeries[0]);
  assert.equal(requestCount, 1);
  releaseRequest();
  await selected;
  assert.equal(requestCount, 1);
});

test('逐句练习纵向展示全文，播放完成后在当前句内跟读', async () => {
  const definition = loadSpeakingPage({});
  const page = createPageInstance(definition);
  let replayCount = 0;
  page.replayQuestion = () => {
    replayCount += 1;
  };
  page.data.selectedParagraph = {
    id: 'paragraph-1',
    sentences: [
      { text: 'Read me.', startMs: 0, endMs: 1000 },
      { text: 'Then read me.', startMs: 1200, endMs: 2400 }
    ]
  };
  page.selectedRepeatTask = { audioUrl: 'https://example.test/audio.mp3' };

  page.startSelectedRepeat();
  assert.equal(page.data.repeatPromptReady, false);
  await wait(150);
  assert.equal(replayCount, 1);

  page.questionAudioContext = { stop() {} };
  page.data.repeatPromptReady = true;
  page.data.result = { score: 88 };
  page.selectExercise({ currentTarget: { dataset: { id: page.data.exercises[1].id } } });
  assert.equal(page.data.activeId, page.data.exercises[1].id);
  assert.equal(page.data.repeatPromptReady, false);
  assert.equal(page.data.result, null);
  await wait(150);
  assert.equal(replayCount, 2);

  let recordStarts = 0;
  let recordStops = 0;
  page.recorderManager = {
    start() { recordStarts += 1; },
    stop() { recordStops += 1; }
  };
  page.data.repeatPromptReady = true;
  page.toggleRepeatRecording();
  assert.equal(page.data.recording, true);
  assert.equal(recordStarts, 1);
  page.toggleRepeatRecording();
  assert.equal(recordStops, 1);

  page.setData({ recording: false, tempFilePath: '/tmp/repeat.mp3', recordDurationMs: 1200, recordDurationText: '1 秒' });
  page.restartRepeatRecording();
  assert.equal(page.data.tempFilePath, '');
  assert.equal(page.data.recording, true);
  assert.equal(recordStarts, 2);

  let scoreCount = 0;
  page.submitPronunciation = () => { scoreCount += 1; };
  page.setData({ recording: true, ieltsMode: false, tempFilePath: '' });
  page.handleRecordingStopped({ tempFilePath: '/tmp/repeat.mp3', duration: 1400 });
  assert.equal(scoreCount, 1);
  assert.equal(page.data.tempFilePath, '/tmp/repeat.mp3');

  const wxml = fs.readFileSync(path.join(root, 'pages/speaking/index.wxml'), 'utf8');
  assert.match(wxml, /repeat-sentence-list/);
  assert.match(wxml, /wx:for="\{\{exercises\}\}"[^>]+wx:key="id"/);
  assert.match(wxml, /repeat-sentence-main[^>]+bindtap="selectExercise"/);
  assert.match(wxml, /repeat-inline-actions[^>]+repeatPromptReady/);
  assert.match(wxml, /repeat-inline-record[^>]+bindtap="toggleRepeatRecording"/);
  assert.match(wxml, /bindtap="restartRepeatRecording"/);
  assert.match(wxml, /bindtap="replayRepeatRecording"/);
  assert.doesNotMatch(wxml, /bindtap="scoreRepeatRecording"/);
  assert.doesNotMatch(wxml, /holdToRecordStart|holdToRecordEnd|bindtouchstart="(?:hold|startRecord)|bindtouchend/);
  assert.doesNotMatch(wxml, /library-task-tabs|library-record-desk|task-dial|record-orbit/);
  assert.doesNotMatch(wxml, /class="(?:library-)?listen-button/);
  assert.doesNotMatch(wxml, /<picker[^>]+selectRepeatAudio/);
  assert.match(wxml, /repeat-audio-drawer[^>]+catchtap="stopPickerEvent"/);

  const source = fs.readFileSync(path.join(root, 'pages/speaking/index.js'), 'utf8');
  assert.match(source, /handleRecordingStopped[\s\S]+submitPronunciation/);
});

test('每日跟读只打开当天未完成句子', async () => {
  const completedIds = [
    'unlock1workbook-2-paragraph-4-sentence-1',
    'unlock1workbook-2-paragraph-4-sentence-2'
  ];
  let navigateBackCount = 0;
  const wx = {
    showToast() {},
    navigateBack() { navigateBackCount += 1; }
  };
  const store = {
    getDeviceStudyRole: () => 'student',
    async getSpeakingAttempts() {
      return {
        attempts: completedIds.concat(completedIds).map((taskId) => ({
          category: 'speaking',
          attemptType: 'standalone_sentence_repeat',
          taskId
        }))
      };
    }
  };
  const page = createPageInstance(loadSpeakingPage(store, wx));
  page.repeatPlanRequest = {
    audioTaskId: 'unlock1workbook-2',
    paragraphIndex: 4,
    sentenceStartIndex: 1,
    sentenceEndIndex: 4
  };
  page.data.selectedAudio = { taskId: 'unlock1workbook-2' };
  page.data.selectedParagraph = {
    id: 'unlock1workbook-2-paragraph-4',
    sentences: Array.from({ length: 4 }, (_, index) => ({
      text: `Sentence ${index + 1}.`,
      startMs: index * 1000,
      endMs: (index + 1) * 1000
    }))
  };
  page.selectedRepeatTask = { taskId: 'unlock1workbook-2', audioUrl: 'https://example.test/audio.mp3' };

  await page.startSelectedRepeat();
  assert.deepEqual(Array.from(page.data.exercises, (item) => item.id), [
    'unlock1workbook-2-paragraph-4-sentence-3',
    'unlock1workbook-2-paragraph-4-sentence-4'
  ]);
  assert.deepEqual(Array.from(page.data.exercises, (item) => item.sentenceNumber), [3, 4]);

  completedIds.push(
    'unlock1workbook-2-paragraph-4-sentence-3',
    'unlock1workbook-2-paragraph-4-sentence-4'
  );
  await page.startSelectedRepeat();
  await wait(550);
  assert.equal(navigateBackCount, 1);
});

test('分级跟读把说话人标签与评分正文分离', () => {
  const page = createPageInstance(loadSpeakingPage({}));
  page.queueQuestionAutoPlay = () => {};
  page.data.selectedParagraph = {
    id: 'paragraph-speakers',
    sentences: [
      { text: 'Student 1: Is she a businesswoman?', startMs: 0, endMs: 1200 },
      { text: 'Marie: No, she is not.', startMs: 1300, endMs: 2400 },
      { text: 'Kerry:Is she from Turkey?', startMs: 2500, endMs: 3500 },
      { text: 'Teacher:', startMs: 3600, endMs: 3700 }
    ]
  };
  page.selectedRepeatTask = { audioUrl: 'https://example.test/audio.mp3' };

  page.startSelectedRepeat();

  assert.equal(page.data.exercises.length, 3);
  assert.equal(page.data.exercises[0].speakerLabel, 'Student 1');
  assert.equal(page.data.exercises[0].prompt, 'Is she a businesswoman?');
  assert.equal(page.data.exercises[1].speakerLabel, 'Marie');
  assert.equal(page.data.exercises[1].prompt, 'No, she is not.');
  assert.equal(page.data.exercises[2].speakerLabel, 'Kerry');
  assert.equal(page.data.exercises[2].prompt, 'Is she from Turkey?');

  const wxml = fs.readFileSync(path.join(root, 'pages/speaking/index.wxml'), 'utf8');
  assert.equal((wxml.match(/class="repeat-sentence-speaker"/g) || []).length, 2);
});

test('分句原音不把 cloud 文件标识直接交给真机播放器', async () => {
  const definition = loadSpeakingPage({});
  const page = createPageInstance(definition);
  page.queueQuestionAutoPlay = () => {};
  page.data.selectedParagraph = {
    id: 'paragraph-cloud-audio',
    sentences: [{ text: 'Cloud audio sentence.', startMs: 500, endMs: 1800 }]
  };
  page.selectedRepeatTask = {
    audioUrl: 'cloud://test-env/A1/audio.mp3',
    audioFileId: 'cloud://test-env/A1/audio.mp3',
    audioCloudPath: 'A1/audio.mp3'
  };

  page.startSelectedRepeat();

  assert.equal(page.data.exercises[0].audioUrl, 'https://example.test/A1/audio.mp3');
  assert.equal(page.data.exercises[0].audioFileId, 'cloud://test-env/A1/audio.mp3');
  assert.equal(page.data.exercises[0].audioStartSec, 0.5);
  assert.equal(page.data.exercises[0].audioEndSec, 1.8);
});

test('原句首次播放前不调用空播放器停止', () => {
  const page = createPageInstance(loadSpeakingPage({}));
  let stopCount = 0;
  page.questionAudioContext = {
    src: '',
    stop() { stopCount += 1; }
  };
  page.questionPlaybackRequested = true;

  page.playOriginalQuestionClip({
    audioUrl: 'https://example.test/audio.mp3',
    audioStartSec: 0,
    audioEndSec: 1.2
  });

  assert.equal(stopCount, 0);
  assert.equal(page.questionAudioContext.src, 'https://example.test/audio.mp3');
  assert.ok(page.pendingQuestionClip);
});

test('分句公开地址播放失败时自动切换 CloudBase 临时地址', async () => {
  const page = createPageInstance(loadSpeakingPage({
    async getTempFileURL() { return 'https://temp.example.test/audio.mp3'; }
  }));
  let stopCount = 0;
  page.questionAudioContext = {
    src: 'https://public.example.test/audio.mp3',
    stop() { stopCount += 1; }
  };
  page.questionPlaybackRequestToken = 3;
  page.questionPlaybackRequested = true;
  page.pendingQuestionClip = {
    src: 'https://public.example.test/audio.mp3',
    audioFileId: 'cloud://test-env/audio.mp3',
    fallbackTried: false,
    seekRequested: true,
    started: false
  };

  await page.handleQuestionAudioError({ errCode: 10001 });

  assert.equal(stopCount, 0);
  assert.equal(page.pendingQuestionClip.fallbackTried, true);
  assert.equal(page.pendingQuestionClip.src, 'https://temp.example.test/audio.mp3');
  assert.equal(page.questionAudioContext.src, 'https://temp.example.test/audio.mp3');
  assert.equal(page.data.errorText, '');
});

test('无有效原句播放请求的错误回调不会污染页面', async () => {
  const page = createPageInstance(loadSpeakingPage({}));
  page.questionPlaybackRequested = false;
  page.data.errorText = '';

  await page.handleQuestionAudioError({ errCode: 10001 });

  assert.equal(page.data.errorText, '');
});

test('分级跟读以预览模式评分并保留录音', async () => {
  const calls = [];
  const page = createPageInstance(loadSpeakingPage({
    async createSpeakingUploadUrl(payload) {
      calls.push(['upload-url', payload]);
      return { cloudPath: '_speaking/test.mp3' };
    },
    async uploadSpeakingAudio(cloudPath, filePath) {
      calls.push(['upload', { cloudPath, filePath }]);
      return 'cloud://test/repeat.mp3';
    },
    async evaluateSpeakingPronunciation(payload) {
      calls.push(['evaluate', payload]);
      return {
        pronunciation: {
          score: 91,
          accuracy: 92,
          fluency: 89,
          completion: 100,
          feedback: '整体完成良好。按意群朗读，减少不必要的停顿并注意连读。'
        }
      };
    }
  }));
  page.playScoreEffect = () => {};
  page.setData({
    activeExercise: { id: 'sentence-1', prompt: 'Read this sentence.' },
    activeId: 'sentence-1',
    exercises: [
      { id: 'sentence-1', prompt: 'Read this sentence.' },
      { id: 'sentence-2', prompt: 'Read the next sentence.' }
    ],
    tempFilePath: '/tmp/repeat.mp3',
    recordDurationMs: 1800,
    recordDurationText: '1 秒'
  });

  await page.submitPronunciation();

  assert.equal(calls[0][1].planRunType, 'preview');
  assert.equal(calls[2][1].planRunType, 'preview');
  assert.equal(page.data.tempFilePath, '/tmp/repeat.mp3');
  assert.equal(page.data.result.score, 91);
  assert.match(page.data.result.feedback, /意群朗读/);
  assert.equal(page.data.exercises[0].repeatResult.score, 91);
  assert.match(page.data.exercises[0].repeatResult.feedback, /意群朗读/);

  page.questionAudioContext = { stop() {} };
  page.queueQuestionAutoPlay = () => {};
  page.selectExercise({ currentTarget: { dataset: { id: 'sentence-2' } } });
  assert.equal(page.data.result, null);
  page.selectExercise({ currentTarget: { dataset: { id: 'sentence-1' } } });
  assert.equal(page.data.result.score, 91);
  assert.equal(page.data.tempFilePath, '/tmp/repeat.mp3');
});

test('学生分级跟读使用正常记录模式', async () => {
  const calls = [];
  const page = createPageInstance(loadSpeakingPage({
    getDeviceStudyRole() { return 'student'; },
    async createSpeakingUploadUrl(payload) {
      calls.push(payload);
      return { cloudPath: '_speaking/student.mp3' };
    },
    async uploadSpeakingAudio() { return 'cloud://test/student.mp3'; },
    async evaluateSpeakingPronunciation(payload) {
      calls.push(payload);
      return { pronunciation: { score: 93 } };
    }
  }));
  page.playScoreEffect = () => {};
  page.setData({
    activeExercise: { id: 'sentence-student', prompt: 'Student repeat sentence.' },
    tempFilePath: '/tmp/student.mp3',
    recordDurationMs: 1500
  });

  await page.submitPronunciation();

  assert.equal(calls[0].planRunType, 'normal');
  assert.equal(calls[1].planRunType, 'normal');
});

test('上一句后台评分时可以切换并录制下一句，结果仍回到原句', async () => {
  let finishScoring;
  const scorePending = new Promise((resolve) => { finishScoring = resolve; });
  const page = createPageInstance(loadSpeakingPage({
    async createSpeakingUploadUrl() { return { cloudPath: '_speaking/background.mp3' }; },
    async uploadSpeakingAudio() { return 'cloud://test/background.mp3'; },
    async evaluateSpeakingPronunciation() {
      await scorePending;
      return { pronunciation: { score: 88, accuracy: 90, fluency: 84, completion: 100 } };
    }
  }));
  let scoreEffects = 0;
  page.playScoreEffect = () => { scoreEffects += 1; };
  page.queueQuestionAutoPlay = () => {};
  page.questionAudioContext = { stop() {} };
  page.recorderManager = { start() {}, stop() {} };
  page.setData({
    activeId: 'sentence-1',
    activeExercise: { id: 'sentence-1', prompt: 'First sentence.' },
    exercises: [
      { id: 'sentence-1', prompt: 'First sentence.' },
      { id: 'sentence-2', prompt: 'Second sentence.' }
    ],
    tempFilePath: '/tmp/first.mp3',
    recordDurationMs: 1600,
    recordDurationText: '1 秒',
    repeatPromptReady: true
  });

  const scoring = page.submitPronunciation();
  await wait(0);
  assert.equal(page.data.submitting, false);
  assert.equal(page.data.exercises[0].repeatScoring, true);

  page.selectExercise({ currentTarget: { dataset: { id: 'sentence-2' } } });
  assert.equal(page.data.activeId, 'sentence-2');
  page.setData({ repeatPromptReady: true });
  page.toggleRepeatRecording();
  assert.equal(page.data.recording, true);

  finishScoring();
  await scoring;
  assert.equal(page.data.activeId, 'sentence-2');
  assert.equal(page.data.result, null);
  assert.equal(page.data.exercises[0].repeatScoring, false);
  assert.equal(page.data.exercises[0].repeatResult.score, 88);
  assert.equal(scoreEffects, 0);

  page.setData({ recording: false });
  page.selectExercise({ currentTarget: { dataset: { id: 'sentence-1' } } });
  assert.equal(page.data.result.score, 88);
  assert.equal(page.data.tempFilePath, '/tmp/first.mp3');
});

test('分级跟读评分后可以回放或停止自己的录音', () => {
  const page = createPageInstance(loadSpeakingPage({}));
  let playCount = 0;
  let stopCount = 0;
  page.questionAudioContext = { stop() {} };
  page.answerAudioContext = {
    src: '',
    play() { playCount += 1; },
    stop() { stopCount += 1; }
  };
  page.setData({ tempFilePath: '/tmp/repeat.mp3', recording: false, submitting: false, answerPlaying: false });

  page.replayRepeatRecording();
  assert.equal(page.answerAudioContext.src, '/tmp/repeat.mp3');
  assert.equal(playCount, 1);

  page.data.answerPlaying = true;
  page.replayRepeatRecording();
  assert.equal(stopCount, 1);
});

test('开始跟读时停止旧回放不会误报录音回放失败', () => {
  const page = createPageInstance(loadSpeakingPage({}));
  let stopCount = 0;
  page.answerPlaybackRequested = true;
  page.data.answerPlaying = true;
  page.data.activeExercise = { id: 'sentence-1', maxDurationSec: 20 };
  page.questionAudioContext = { stop() {} };
  page.answerAudioContext = {
    stop() {
      stopCount += 1;
      page.handleAnswerPlaybackError();
    }
  };
  page.recorderManager = { start() {} };

  page.startRecord();

  assert.equal(stopCount, 1);
  assert.equal(page.data.recording, true);
  assert.equal(page.data.errorText, '');
  assert.equal(page.answerPlaybackRequested, false);

  page.handleAnswerPlaybackError();
  assert.equal(page.data.errorText, '');
});

test('用户主动回放失败时仍显示真实错误', () => {
  const page = createPageInstance(loadSpeakingPage({}));
  page.answerPlaybackRequested = true;
  page.data.recording = false;

  page.handleAnswerPlaybackError();

  assert.equal(page.data.answerPlaying, false);
  assert.match(page.data.errorText, /录音回放失败/);
});

test('雅思口语按分册和 Test 逐层进入且只渲染当前层', async () => {
  let indexRequests = 0;
  let detailRequests = 0;
  const page = createPageInstance(loadSpeakingPage({
    async getMaterialIndex() { indexRequests += 1; return { speakingIelts: [] }; },
    async getMaterialItem() { detailRequests += 1; return { item: null }; }
  }));

  await page.openIeltsSpeaking();

  assert.equal(page.data.viewMode, 'ielts-books');
  assert.equal(page.data.ieltsBooks.length, 12);
  assert.deepEqual(Array.from(page.data.ieltsBooks, (item) => item.bookNumber), [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
  assert.equal(page.data.selectedIeltsTests.length, 0);
  assert.equal(indexRequests, 0);
  assert.equal(detailRequests, 0);

  page.selectIeltsBook({ currentTarget: { dataset: { bookNumber: 10 } } });
  assert.equal(page.data.viewMode, 'ielts-tests');
  assert.deepEqual(Array.from(page.data.selectedIeltsTests, (item) => item.testNumber), [1, 2, 3, 4]);
  assert.equal(indexRequests, 0);
  assert.equal(detailRequests, 0);

  page.backToSpeakingHome();
  assert.equal(page.data.viewMode, 'ielts-books');
  page.backToSpeakingHome();
  assert.equal(page.data.viewMode, 'home');

  const wxml = fs.readFileSync(path.join(root, 'pages/speaking/index.wxml'), 'utf8');
  assert.doesNotMatch(wxml, /ieltsExpanded/);
  assert.match(wxml, /viewMode === 'ielts-books'/);
  assert.match(wxml, /viewMode === 'ielts-tests'/);
});

test('雅思口语按 Part 和 topic 展示结构化题目且不显示原图入口', async () => {
  const itemId = 'ielts-academic-20-test-4-speaking';
  const exercises = [
    { id: `${itemId}-part-1-1`, part: 1, title: 'Part 1 · 1', meta: '45 秒', prompt: 'Collapsed Part 1 prompt.' },
    { id: `${itemId}-part-2-1`, part: 2, title: 'Part 2 · 1', meta: '120 秒', prompt: 'Collapsed Part 2 prompt.' },
    { id: `${itemId}-part-3-1`, part: 3, title: 'Part 3 · 1', meta: '60 秒', prompt: 'Collapsed Part 3 prompt.' }
  ];
  const store = {
    async getMaterialItem() {
      return {
        item: {
          exercises,
          images: [{ src: 'https://example.test/original.jpg' }],
          parts: [
            { part: 1, label: 'PART 1', topics: [{ title: 'Personal qualities', questions: [
              { exerciseId: exercises[0].id, prompt: 'What are your best personal qualities?' },
              { exerciseId: exercises[0].id, prompt: 'Are you similar to your parents?' }
            ] }] },
            { part: 2, label: 'PART 2', tasks: [{ exerciseId: exercises[1].id, task: 'Describe a discussion.', cuePoints: ['what it was about', 'who joined it', 'what people thought'], closingPrompt: 'and explain why it was long.' }] },
            { part: 3, label: 'PART 3', topics: [{ title: 'The news', questions: [{ exerciseId: exercises[2].id, prompt: 'How do people find news?' }] }] }
          ]
        }
      };
    }
  };
  const page = createPageInstance(loadSpeakingPage(store));
  page.data.theme = 'library';
  page.queueIeltsIntroAutoPlay = () => {};
  let questionAutoPlayCount = 0;
  page.queueQuestionAutoPlay = () => { questionAutoPlayCount += 1; };

  await page.selectIeltsTest({ currentTarget: { dataset: { itemId } } });

  assert.equal(page.data.ieltsParts.length, 3);
  assert.equal(page.data.ieltsParts[0].topics[0].questions.length, 2);
  assert.equal(page.data.ieltsParts[1].tasks[0].cuePoints.length, 3);
  assert.equal(page.data.ieltsParts[2].topics[0].title, 'The news');
  assert.equal(page.data.activeExercise.prompt, 'What are your best personal qualities?');
  assert.equal(page.data.ieltsSessionStarted, false);
  assert.equal(page.data.ieltsQuestionSequence.length, 4);
  assert.equal(page.data.activeIeltsQuestion.topicTitle, 'Personal qualities');
  assert.match(page.data.ieltsIntroText, /Let's talk about Personal qualities/);
  assert.equal(page.data.ieltsSourceExpanded, undefined);

  page.startIeltsSession();
  assert.equal(page.data.ieltsSessionStarted, true);
  assert.equal(questionAutoPlayCount, 1);

  const second = page.data.ieltsParts[0].topics[0].questions[1];
  page.selectIeltsQuestion({ currentTarget: { dataset: { exerciseId: second.exerciseId, viewKey: second.viewKey, prompt: second.prompt } } });
  assert.equal(page.data.activeExercise.id, exercises[0].id);
  assert.equal(page.data.activeExercise.prompt, 'Are you similar to your parents?');
  assert.equal(page.data.activeIeltsQuestion.viewKey, second.viewKey);
  assert.equal(page.data.ieltsQuestionIndex, 1);

  const wxml = fs.readFileSync(path.join(root, 'pages/speaking/index.wxml'), 'utf8');
  const libraryTemplate = wxml.split('<view class="theme-{{theme}} language-{{language}} page-shell speaking-page"')[0];
  assert.match(libraryTemplate, /class="ielts-cue-point /);
  assert.doesNotMatch(wxml, /ieltsSource|查看原题图片|previewIeltsSource/);
  assert.match(libraryTemplate, /class="ielts-session-intro"/);
  assert.match(libraryTemplate, /ielts-intro-script[^>]+bindtap="playIeltsIntro"/);
  assert.doesNotMatch(libraryTemplate, /ielts-intro-audio/);
  assert.match(libraryTemplate, /bindtap="startIeltsSession"/);
  assert.match(libraryTemplate, /class="ielts-focus"/);
  assert.match(libraryTemplate, /class="ielts-answer-zone"/);
  assert.match(libraryTemplate, /class="ielts-question-nav"/);
  assert.match(libraryTemplate, /catchtap="selectIeltsQuestion"/);
  assert.match(libraryTemplate, /catchtap="playIeltsQuestion"/);
  assert.match(libraryTemplate, /ielts-play-button/);
  assert.match(libraryTemplate, /ieltsCueLineIndex === cueItemIndex \+ 2/);
  assert.doesNotMatch(libraryTemplate, /ielts-cue-card prompt-replay/);
  assert.doesNotMatch(libraryTemplate, /recording && activeId !== questionItem\.viewKey/);
  assert.doesNotMatch(libraryTemplate, /library-prompt-sheet \{\{recording/);
  const standardTemplate = wxml.split('<view class="theme-{{theme}} language-{{language}} page-shell speaking-page"')[1] || '';
  assert.match(standardTemplate, /class="ielts-exam-sheet"/);
  assert.match(standardTemplate, /class="ielts-session-intro"/);
  assert.match(standardTemplate, /class="ielts-focus"/);
  assert.match(standardTemplate, /class="ielts-answer-zone"/);
  assert.match(standardTemplate, /class="ielts-question-nav"/);
  assert.doesNotMatch(standardTemplate, /class="ielts-structure"/);
  assert.match(wxml, /catchtap="toggleIeltsAnswer"/);
  assert.match(wxml, /catchtap="scoreIeltsAnswer"/);
  assert.doesNotMatch(standardTemplate, /questionReadingHidden/);
  assert.doesNotMatch(wxml, /holdIeltsQuestionStart|holdIeltsQuestionEnd/);
  assert.match(wxml, /repeat-sentence-list[^>]+wx:if="\{\{!ieltsMode\}\}"/);
  const wxss = fs.readFileSync(path.join(root, 'pages/speaking/index.wxss'), 'utf8');
  assert.match(wxss, /\.theme-warm \.ielts-exam-sheet/);
  assert.match(wxss, /\.theme-library \.ielts-session-intro/);
  assert.match(wxss, /\.theme-voyage \.ielts-exam-sheet/);
  assert.match(wxss, /\.theme-dragon \.ielts-exam-sheet/);
  assert.match(wxss, /\.theme-warm \.repeat-sentence-item\.is-active/);
  assert.match(wxss, /\.repeat-sentence-list\.is-library/);
  assert.match(wxss, /\.theme-voyage \.repeat-sentence-item\.is-active/);
  assert.match(wxss, /\.theme-dragon \.repeat-sentence-item\.is-active/);

  let startCount = 0;
  let stopCount = 0;
  page.recorderManager = {
    start() { startCount += 1; },
    stop() { stopCount += 1; }
  };
  page.questionAudioContext = { stop() {} };
  page.data.recording = false;
  page.data.submitting = false;
  const answerEvent = { currentTarget: { dataset: {
    exerciseId: second.exerciseId,
    viewKey: second.viewKey,
    prompt: second.prompt
  } } };
  page.data.ieltsPromptReady = true;
  page.toggleIeltsAnswer(answerEvent);
  assert.equal(page.data.activeId, second.viewKey);
  assert.equal(page.data.activeExercise.prompt, second.prompt);
  assert.equal(page.data.recording, true);
  assert.equal(startCount, 1);

  page.toggleIeltsAnswer(answerEvent);
  assert.equal(stopCount, 1);

  let scoreCount = 0;
  page.data.recording = false;
  page.data.tempFilePath = '/tmp/answer.mp3';
  page.submitIeltsSpeaking = () => { scoreCount += 1; };
  page.scoreIeltsAnswer();
  assert.equal(scoreCount, 1);
});

test('四套主题雅思开场使用独立音频，结束前不触发第1题状态', async () => {
  const calls = [];
  const page = createPageInstance(loadSpeakingPage({
    async synthesizeIeltsPromptAudio(payload) {
      calls.push(payload);
      return { audioUrl: 'https://example.test/ielts-intro.mp3' };
    }
  }));
  let playCount = 0;
  page.ieltsIntroAudioContext = {
    src: '',
    stop() {},
    play() { playCount += 1; }
  };
  page.data.theme = 'dragon';
  page.data.ieltsMode = true;
  page.data.ieltsItemId = 'ielts-academic-20-test-4-speaking';
  page.data.ieltsSessionStarted = false;
  page.data.ieltsIntroText = "Now, in this first part, let's talk about hairstyles.";

  await page.playIeltsIntro();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].text, page.data.ieltsIntroText);
  assert.equal(calls[0].itemId, page.data.ieltsItemId);
  assert.equal(calls[0].promptType, 'intro');
  assert.equal(page.ieltsIntroAudioContext.src, 'https://example.test/ielts-intro.mp3');
  assert.equal(playCount, 1);
  assert.equal(page.data.ieltsPromptReady, false);

  page.setData({ ieltsIntroLoading: false, ieltsIntroPlaying: false });
  await page.playIeltsIntro();
  assert.equal(calls.length, 2);
  assert.equal(playCount, 2);
});

test('雅思试卷触摸预取与点击复用同一详情请求', async () => {
  let requestCount = 0;
  let releaseRequest;
  const pending = new Promise((resolve) => { releaseRequest = resolve; });
  const page = createPageInstance(loadSpeakingPage({
    async getMaterialItem() {
      requestCount += 1;
      await pending;
      return { item: null };
    }
  }));
  page.ieltsItemCache = {};
  page.ieltsItemInflight = {};
  const event = { currentTarget: { dataset: { itemId: 'ielts-academic-21-test-1-speaking' } } };

  page.prefetchIeltsTest(event);
  const selected = page.loadIeltsItem(event.currentTarget.dataset.itemId);
  assert.equal(requestCount, 1);
  releaseRequest();
  await selected;
  assert.equal(requestCount, 1);
});

test('Part 2 播放进度只高亮当前句', () => {
  const page = createPageInstance(loadSpeakingPage({}));
  page.data.ieltsMode = true;
  page.data.questionPlaying = true;
  page.data.activeId = 'sample-part-2-task-1';
  page.data.activeExercise = { prompt: 'Describe a trip.\nYou should say:\n• where you went\n• who went with you\nand explain why it was memorable.' };
  page.questionAudioContext = { currentTime: 7, duration: 20 };

  page.syncIeltsCueLineHighlight();

  assert.equal(page.data.ieltsCueLineIndex, 2);
});

test('雅思问题使用共享 TTS 音频并在播放结束后开放回答', async () => {
  const calls = [];
  const page = createPageInstance(loadSpeakingPage({
    async synthesizeIeltsPromptAudio(payload) {
      calls.push(payload);
      return { audioUrl: 'https://example.test/shared-question.mp3', cached: true };
    }
  }));
  let playCount = 0;
  page.questionAudioContext = {
    src: '',
    stop() {},
    play() { playCount += 1; }
  };
  page.data.viewMode = 'practice';
  page.data.ieltsMode = true;
  page.data.ieltsItemId = 'ielts-academic-20-test-4-speaking';
  page.data.activeExercise = { id: 'ielts-academic-20-test-4-speaking-part-1-1', prompt: 'What do you do?' };

  await page.playQuestion();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].itemId, page.data.ieltsItemId);
  assert.equal(calls[0].text, 'What do you do?');
  assert.equal(page.questionAudioContext.src, 'https://example.test/shared-question.mp3');
  assert.equal(playCount, 1);

  const serviceSource = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/speaking.service.js'), 'utf8');
  assert.match(serviceSource, /speech-2\.8-turbo/);
  assert.match(serviceSource, /ieltsSpeakingPromptAudios/);
  assert.match(serviceSource, /collectApprovedIeltsPrompts/);
  assert.match(serviceSource, /collectApprovedIeltsIntroPrompts/);
  assert.match(serviceSource, /promptType === 'intro'/);
  assert.match(serviceSource, /bitrate:\s*64000/);
  assert.match(serviceSource, /contentHash\.slice\(0, 20\)/);
});

test('跟读评分必须收到腾讯 SOE 有效结果', () => {
  const storeSource = fs.readFileSync(path.join(root, 'utils/store.js'), 'utf8');
  assert.match(storeSource, /async function evaluateSpeakingPronunciation[\s\S]*result\.syncMode === 'cloud-error'/);
  assert.match(storeSource, /async function evaluateSpeakingPronunciation[\s\S]*!result\.pronunciation/);

  const engineSource = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/lib/speaking-engine.js'), 'utf8');
  assert.match(engineSource, /SPEAKING_PRONUNCIATION_PROVIDER/);
  assert.match(engineSource, /evaluateWithTencentSoeNew/);
  assert.match(engineSource, /sampleRate:\s*16000|server_engine_type/);
});

test('雅思评分提交 Part 并展示官方四项 Band', async () => {
  let submitted = null;
  const page = createPageInstance(loadSpeakingPage({
    getDeviceStudyRole() { return 'student'; },
    async createSpeakingUploadUrl() { return { cloudPath: '_speaking/ielts-answer.mp3' }; },
    async uploadSpeakingAudio() { return 'cloud://test/ielts-answer.mp3'; },
    async submitSpeakingAttempt(payload) {
      submitted = payload;
      return {
        attempt: {
          status: 'scored',
          ieltsPart: 3,
          ieltsOverallBand: 7.5,
          ieltsFluencyCoherenceBand: 7,
          ieltsLexicalResourceBand: 8,
          ieltsGrammaticalRangeAccuracyBand: 7,
          ieltsPronunciationBand: 8,
          feedback: '观点展开清楚，下一步增加更灵活的复杂句。'
        }
      };
    }
  }));
  page.playScoreEffect = () => {};
  page.data.tempFilePath = '/tmp/ielts-answer.mp3';
  page.data.recordDurationMs = 42000;
  page.data.activeId = 'ielts-21-part-3-topic-1-question-2';
  page.data.activeExercise = { id: 'ielts-21-part-3', prompt: 'Why do cities need public parks?' };
  page.data.activeIeltsQuestion = { part: 3 };

  await page.submitIeltsSpeaking();

  assert.equal(submitted.ieltsPart, 3);
  assert.equal(submitted.questionViewKey, 'ielts-21-part-3-topic-1-question-2');
  assert.equal(page.data.result.overallBand, 7.5);
  assert.equal(page.data.result.lexicalResourceBand, 8);
  assert.equal(page.data.result.pronunciationBand, 8);
});

test('佑佑每日跟读直达指定段落片段而不是整段', () => {
  const page = createPageInstance(loadSpeakingPage({}));
  page.queueQuestionAutoPlay = () => {};
  page.data.selectedAudio = { taskId: 'unlock1workbook-1' };
  page.selectedRepeatTask = { taskId: 'unlock1workbook-1', audioUrl: 'https://example.test/workbook.mp3' };
  page.data.selectedParagraph = {
    id: 'unlock1workbook-1-paragraph-1',
    sentences: Array.from({ length: 5 }, (_, index) => ({
      text: `Sentence ${index + 1}`,
      startMs: index * 1000,
      endMs: (index + 1) * 1000
    }))
  };
  page.repeatPlanRequest = {
    audioTaskId: 'unlock1workbook-1',
    paragraphIndex: 1,
    sentenceStartIndex: 2,
    sentenceEndIndex: 4
  };

  page.startSelectedRepeat();

  assert.deepEqual(page.data.exercises.map((item) => item.id), [
    'unlock1workbook-1-paragraph-1-sentence-2',
    'unlock1workbook-1-paragraph-1-sentence-3',
    'unlock1workbook-1-paragraph-1-sentence-4'
  ]);
});
