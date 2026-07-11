const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'pages/grammar/index.js'), 'utf8');
const template = fs.readFileSync(path.join(root, 'pages/grammar/index.wxml'), 'utf8');
const storeSource = fs.readFileSync(path.join(root, 'utils/store.js'), 'utf8');
const serviceSource = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/grammar.service.js'), 'utf8');

test('语法答题后自动加载缓存优先的 AI 讲解', () => {
  assert.match(source, /recordGrammarCompleted\(this\.data, answeredCount\);\s*this\.loadExplanationById\(questionId\);/);
  assert.match(source, /store\.explainGrammarQuestion\(question, \{[\s\S]*?force,[\s\S]*?personalOnly:/);
  assert.match(source, /regenerateExplanation[\s\S]*?loadExplanationById\(questionId, \{ force: true, personalOnly: true \}\)/);
});

test('语法失败兜底不冒充完整 AI 讲解', () => {
  assert.match(source, /source === 'fallback'/);
  assert.match(source, /explanationError:[\s\S]*?explainUnavailable/);
  assert.equal((template.match(/wx:if="\{\{item\.explanationError\}\}"/g) || []).length, 2);
});

test('语法重新讲只写当前学生进度，不覆盖公共解析', () => {
  assert.match(storeSource, /personalOnly:\s*Boolean\(options\.personalOnly\)/);
  assert.match(serviceSource, /const personalOnly = Boolean\(payload\.personalOnly\)/);
  assert.match(serviceSource, /personalOnly \? false : await saveExplanation/);
  assert.match(serviceSource, /persisted: !personalOnly/);
});

test('语法提交后只用颜色区分正确与错误，不显示文字线', () => {
  const wxss = fs.readFileSync(path.join(root, 'pages/grammar/index.wxss'), 'utf8');
  assert.match(wxss, /\.option-item\.is-correct \.option-text \{[\s\S]*?color: #195f52;[\s\S]*?text-decoration: none/);
  assert.match(wxss, /\.option-item\.is-wrong \.option-text \{[\s\S]*?color: #96382b;[\s\S]*?text-decoration: none/);
  assert.match(wxss, /\.library-option\.is-correct \.library-option-text \{[\s\S]*?color: #2f5d2b;[\s\S]*?text-decoration: none/);
  assert.match(wxss, /\.library-option\.is-wrong \.library-option-text \{[\s\S]*?color: #873229;[\s\S]*?text-decoration: none/);
  assert.match(wxss, /\.lookup-token \{[\s\S]*?border-bottom: 0;[\s\S]*?text-decoration: none/);
  assert.match(wxss, /\.library-lookup-token \{[\s\S]*?border-bottom: 0;[\s\S]*?text-decoration: none/);
});

test('语法标准答案始终使用正确项绿色背景', () => {
  const wxss = fs.readFileSync(path.join(root, 'pages/grammar/index.wxss'), 'utf8');
  assert.equal((template.match(/class="standard-answer"/g) || []).length, 2);
  assert.match(wxss, /\.answer-line \.standard-answer \{[\s\S]*?background: rgba\(78, 169, 147, 0\.34\);[\s\S]*?color: #195f52/);
  assert.match(wxss, /\.library-answer-line \.standard-answer \{[\s\S]*?background: rgba\(104, 148, 92, 0\.34\);[\s\S]*?color: #2f5d2b/);
});
