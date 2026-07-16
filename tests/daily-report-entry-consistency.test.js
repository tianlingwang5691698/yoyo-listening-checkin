const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const recordSource = fs.readFileSync(path.join(root, 'pages/record/index.js'), 'utf8');
const recordTemplate = fs.readFileSync(path.join(root, 'pages/record/index.wxml'), 'utf8');
const parentSource = fs.readFileSync(path.join(root, 'pages/parent/index.js'), 'utf8');
const parentDetailSource = fs.readFileSync(path.join(root, 'pages/parent/detail/index.js'), 'utf8');
const parentDetailTemplate = fs.readFileSync(path.join(root, 'pages/parent/detail/index.wxml'), 'utf8');
const reportServiceSource = fs.readFileSync(path.join(root, 'cloudfunctions/yoyo/services/report.service.js'), 'utf8');
const route = require('../utils/daily-report-route');

test('成长记录和日报使用同一个日期详情入口', () => {
  assert.equal(route.buildDailyReportDetailUrl('2026-07-16'), '/pages/parent/detail/index?date=2026-07-16');
  assert.match(recordSource, /dailyReportRoute\.buildDailyReportDetailUrl\(date\)/);
  assert.match(parentSource, /dailyReportRoute\.buildDailyReportDetailUrl\(date\)/);
  assert.equal((recordTemplate.match(/bindtap="openDailyDetail"/g) || []).length, 2);
  assert.equal((recordTemplate.match(/bindtap="selectDate"/g) || []).length, 2);
});

test('成长页不再自行请求、合并或渲染日报详情', () => {
  assert.doesNotMatch(recordSource, /getDailyReportByDate|getStudyCompletions/);
  assert.doesNotMatch(recordSource, /selectedDayReport|loadSelectedDay|openReportItem|playAttempt/);
  assert.doesNotMatch(recordTemplate, /selectedDayReport|loadSelectedDay|openReportItem|playAttempt/);
});

test('日报详情只用真实进度并支持返回原课程', () => {
  assert.match(reportServiceSource, /getChildProgressRecordsByDate\(scope, date\)/);
  assert.match(reportServiceSource, /getCompletionItemsByDate\(scope, date\)/);
  assert.match(reportServiceSource, /recordSourceVersion: 'daily-progress-v1'/);
  assert.match(parentDetailSource, /openReportItem\(event\)/);
  assert.match(parentDetailSource, /planRunType: 'preview'/);
  assert.match(parentDetailSource, /buildGrammarClassroomUrl\(item, \{ review: false \}\)/);
  assert.equal((parentDetailTemplate.match(/bindtap="openReportItem"/g) || []).length, 2);
});
