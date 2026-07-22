const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('阅读写作听力和连续打卡统一使用公共两段式完成反馈', () => {
  const effects = read('utils/effects.js');
  assert.match(effects, /COMPLETE_SFX_VOLUME = 0\.55/);
  assert.match(effects, /COMPLETE_VOICE_VOLUME = 0\.9/);
  assert.match(effects, /options && options\.voiceKey[\s\S]*?!item\.includesVoice/);
  assert.match(read('pages/reading/detail/index.js'), /voiceKey: 'readingComplete'/);
  assert.match(read('pages/writing/detail/index.js'), /voiceKey: 'writingComplete'/);
  assert.match(read('pages/lesson/index.js'), /voiceKey: 'listeningComplete'/);
  assert.match(read('pages/record/index.js'), /voiceKey: 'streakMilestone'/);
});
