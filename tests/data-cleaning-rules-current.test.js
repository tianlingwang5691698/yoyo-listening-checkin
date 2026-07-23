const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('跨模块清洗规则包含当前结构与最终标记口径', () => {
  const agents = read('AGENTS.md');
  const rules = read('docs/DATA_CLEANING_RULES.md');
  assert.match(agents, /禁止代码与规则文档分开漂移/);
  assert.match(rules, /当前基线（2026-07-23）/);
  assert.match(rules, /同一次提交中更新本文件和对应专项规则/);
  assert.match(rules, /articleTitle/);
  assert.match(rules, /articleParagraphs\[\]/);
  assert.match(rules, /77 个真实正文段落/);
  assert.match(rules, /Directions → 写作任务 → 标题 → 正文/);
  assert.match(rules, /只在提交\/完成时保存最终状态/);
  assert.match(rules, /不新建集合/);
});

test('口语专项规则已接入项目并固定正式评分链路', () => {
  const agents = read('AGENTS.md');
  const rules = read('docs/SPEAKING_PRACTICE_RULES.md');
  assert.match(agents, /SPEAKING_PRACTICE_RULES\.md/);
  assert.match(rules, /级别 → 系列 → 音频 → 段落 → 句子/);
  assert.match(rules, /腾讯 SOE/);
  assert.match(rules, /gpt-5\.6-sol/);
  assert.match(rules, /240000ms/);
  assert.match(rules, /planRunType: normal/);
  assert.match(rules, /planRunType: preview/);
});

test('上海真题和音频专项规则使用最新门禁', () => {
  const junior = read('docs/SHANGHAI_EM2_STRUCTURING_RULES.md');
  const senior = read('docs/SHANGHAI_SENIOR_STRUCTURING_RULES.md');
  const audio = read('docs/AUDIO_UPLOAD_STANDARD.md');
  assert.doesNotMatch(junior, /GPT-5\.5/);
  assert.match(junior, /badPrompt=0/);
  assert.match(senior, /14 个独立标题、4 篇无标题原文、77 个真实正文段落/);
  assert.match(senior, /contentRevision: 2/);
  assert.match(senior, /Directions → 写作任务 → 标题 → 正文/);
  assert.match(audio, /16kHz、64kbps/);
  assert.match(audio, /评分成功\/失败均保留本地录音/);
});
