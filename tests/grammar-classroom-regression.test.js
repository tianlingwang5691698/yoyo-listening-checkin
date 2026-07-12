const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const wordCourses = require('../data/grammar-classroom/word-courses');

function loadBuilders(language = 'zh-CN') {
  const source = fs.readFileSync('pages/grammar/index.js', 'utf8');
  const start = source.indexOf('function buildThirdPersonPractice');
  const end = source.indexOf('function canUseDictionaryVoice');
  const context = { i18n: { getLanguage: () => language }, wordCourses };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)};result={buildClassroomText,getClassroomCourse};`, context);
  return context.result;
}

test('语法课堂首屏不构建完整课程，点击后按专题加载', () => {
  const { buildClassroomText, getClassroomCourse } = loadBuilders();
  const home = buildClassroomText();
  assert.equal(home.thirdPersonCourse.length, 0);
  assert.equal(home.thirdPersonCourseGroups.length, 0);
  assert.equal(home.nounCourse, undefined);
  assert.equal(home.pronounCourse, undefined);
  assert.ok(Buffer.byteLength(JSON.stringify(home)) < 20000);
  assert.equal(getClassroomCourse(home, 'noun').course.length, 9);
  assert.equal(getClassroomCourse(home, 'pronoun').course.length, 9);
  assert.equal(getClassroomCourse(home, 'verb').course.length, 9);
});
