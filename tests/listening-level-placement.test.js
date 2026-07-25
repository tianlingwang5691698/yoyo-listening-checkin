const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('新客户端只在 Pre A1 展示 Peppa 并隔离旧 A1 缓存', () => {
  ['pages/level/index.js', 'pages/listening-plan/index.js'].forEach((file) => {
    const source = read(file);
    const preA1Block = source.match(/'Pre A1':\s*\[([\s\S]*?)\],\s*A1:/)[1];
    const a1Block = source.match(/\bA1:\s*\[([\s\S]*?)\],\s*A2:/)[1];
    const a2Block = source.match(/\bA2:\s*\[([\s\S]*?)\],\s*B1:/)[1];

    assert.match(preA1Block, /category: 'peppa'/);
    assert.match(preA1Block, /category: 'littlebear'/);
    assert.match(a1Block, /category: 'juniebjones'/);
    assert.doesNotMatch(a1Block, /category: 'littlebear'/);
    assert.doesNotMatch(a2Block, /category: 'littlebear'/);
    assert.doesNotMatch(a1Block, /category: 'peppa'/);
    assert.doesNotMatch(a2Block, /category: 'peppa'/);
    assert.match(source, /listeningPlanOverviewSnapshotV8/);
    assert.match(source, /levelId === 'A1' && item\.category === 'peppa'/);
    assert.match(source, /Peppa Pig · 第1–3季/);
  });
  const stageSource = read('pages/level-stage/index.js');
  assert.match(stageSource, /category: 'juniebjones'/);

  const detailSource = read('pages/listening-material/index.js');
  assert.match(detailSource, /category === 'littlebear' \|\| category === 'peppa' \? 'Pre A1'/);

  const catalog = require('../utils/i18n-catalog-home');
  assert.equal(catalog.level['zh-CN'].peppaSeasons, 'Peppa Pig · 第1–3季');
  assert.equal(catalog.level.en.peppaSeasons, 'Peppa Pig · Seasons 1–3');
});

test('Peppa 保留旧分类、任务 ID 和线上存储路径', () => {
  const engine = read('cloudfunctions/yoyo/lib/listening-plan-engine.js');
  const catalogEngine = read('cloudfunctions/yoyo/lib/catalog-engine.js');
  assert.match(engine, /category: 'peppa', levelIds: \['Pre A1', 'A1'\]/);
  assert.match(catalogEngine, /`peppa-\$\{index \+ 1\}`/);
  assert.match(catalogEngine, /`peppa-s\$\{season\}-\$\{episode\}`/);
  assert.match(catalogEngine, /A1\/Peppa\/第1季/);
  assert.match(catalogEngine, /A1\/Peppa\/第\$\{season\}季/);
  assert.doesNotMatch(catalogEngine, /Pre A1\/Peppa/);
});

test('静谧图书馆听力学习包限制三栏和单按钮宽度', () => {
  const js = read('pages/lesson/index.js');
  const wxml = read('pages/lesson/index.wxml');
  const wxss = read('pages/lesson/index.wxss');

  assert.equal((wxml.match(/audio-study-actions is-single/g) || []).length, 1);
  assert.match(wxss, /\.audio-study-tabs\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(wxss, /\.audio-study-tab\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(wxss, /\.audio-study-actions\.has-three\s*\{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(wxss, /\.audio-study-actions\.is-single\s*\{[\s\S]*?width:\s*82rpx/);
  assert.match(wxss, /\.audio-study-drawer,[\s\S]*?max-width:\s*100%/);
  assert.equal((wxml.match(/<view class="audio-mini-action/g) || []).length, 6);
  assert.doesNotMatch(wxml, /<button class="audio-mini-action/);
  assert.match(wxss, /\.audio-mini-action\.is-added\s*\{[\s\S]*?opacity:\s*1/);
  assert.match(wxml, /lessonStudyExpanded \? texts\.collapse : texts\.expand/);
  assert.match(wxml, /wx:else[^>]*bindtap="loadLessonStudyPack">\{\{texts\.generate\}\}<\/button>/);
  assert.equal((wxml.match(/bindtap="toggleTranscript">\{\{texts\.expandTranscript\}\}/g) || []).length, 2);
  assert.equal((wxml.match(/bindtap="toggleTranscript">\{\{texts\.collapse\}\}/g) || []).length, 2);
  assert.doesNotMatch(wxml, /bindtouchstart="pauseTranscriptAutoFollow"|回到当前句|transcript-scroll|audio-transcript-scroll/);
  assert.equal((wxml.match(/{{prevLine\.text}}/g) || []).length, 2);
  assert.equal((wxml.match(/{{nextLine\.text}}/g) || []).length, 2);
  assert.doesNotMatch(wxml, /progress && \(progress\.transcriptVisible \|\| transcriptManualVisible\)/);
  assert.equal((wxml.match(/\? texts\.play : texts\.speak/g) || []).length, 2);
  assert.doesNotMatch(js.match(/async loadLessonSecondaryData[\s\S]*?\n  },/)[0], /loadCachedLessonStudyPack/);
  assert.equal((wxml.match(/task\.durationSec <= 480/g) || []).length, 2);
  assert.match(js, /LESSON_STUDY_PACK_MAX_DURATION_SEC = 8 \* 60/);
  assert.match(js, /Number\(task\.durationSec \|\| 0\) > LESSON_STUDY_PACK_MAX_DURATION_SEC\) return/);
});

test('听力计划数量单位使用集与每集遍数', () => {
  const catalog = read('utils/i18n-catalog-home.js');

  assert.match(catalog, /dailyCount: '每天几集'/);
  assert.match(catalog, /repeatCount: '每集几遍'/);
  assert.match(catalog, /dailyItems: '每天 \{count\} 集'/);
  assert.doesNotMatch(catalog, /dailyCount: '每天几条'|repeatCount: '每条几遍'/);
});

test('Unlock 听口练习册第三版不会被空翻译截断', () => {
  const i18n = require('../utils/i18n');

  assert.equal(i18n.getPageText('level', 'listeningWorkbook3', 'zh-CN'), '听口练习册第三版');
  assert.equal(i18n.getPageText('level', 'listeningWorkbook3', 'en'), 'Listening & Speaking Workbook, 3rd Ed.');
  assert.equal(i18n.getPageText('listeningPlan', 'listeningWorkbook3', 'zh-CN'), '听口练习册第三版');
  assert.equal(i18n.getPageText('listeningPlan', 'listeningWorkbook3', 'en'), 'Listening & Speaking Workbook, 3rd Ed.');
});

test('连续播放切换下一集后保留文本与学习包入口', () => {
  const js = read('pages/lesson/index.js');
  const switchTask = js.match(/async switchContinuousQueueTask[\s\S]*?\n  },\n  async handleContinuousAudioEnded/)[0];

  assert.match(switchTask, /transcriptPendingLoad:\s*!normalizedTask\.isPendingAsset/);
  assert.match(switchTask, /lessonStudyCompleted,/);
  assert.match(switchTask, /lessonStudyExpanded:\s*false/);
  assert.match(switchTask, /transcriptExpanded:\s*false/);
  assert.match(switchTask, /await this\.updatePassQuestion\(normalizedTask, progress\)/);
  assert.doesNotMatch(switchTask, /transcriptPendingLoad:\s*false/);
});

test('计划音频支持同设备断点续播', () => {
  const js = read('pages/lesson/index.js');

  assert.match(js, /LISTENING_RESUME_SAVE_INTERVAL_SEC\s*=\s*5/);
  assert.match(js, /LISTENING_RESUME_REWIND_SEC\s*=\s*0/);
  assert.match(js, /innerAudioContext\.onTimeUpdate[\s\S]*?saveListeningResumeCheckpoint\(\)/);
  assert.match(js, /innerAudioContext\.onCanplay[\s\S]*?restoreListeningResumeCheckpoint\(\)/);
  assert.match(js, /innerAudioContext\.onPause[\s\S]*?saveListeningResumeCheckpoint\(\{ force: true \}\)/);
  assert.match(js, /innerAudioContext\.onError[\s\S]*?saveListeningResumeCheckpoint\(\{ force: true \}\)/);
  assert.match(js, /onHide\(\)[\s\S]*?saveListeningResumeCheckpoint\(\{ force: true \}\)/);
  assert.match(js, /innerAudioContext\.onEnded[\s\S]*?trackEffectiveListening/);
  assert.match(js, /markCurrentTaskListened[\s\S]*?clearListeningResumeCheckpoint\(completedTask\)/);
  assert.match(js, /Math\.max\(0, positionSec - LISTENING_RESUME_REWIND_SEC\)/);
  assert.match(js, /\['normal', 'catchup'\]\.includes/);
});
