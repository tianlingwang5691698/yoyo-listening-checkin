const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const wordCourses = require('../data/grammar-classroom/word-courses');

function loadBuilders(language = 'zh-CN') {
  const source = fs.readFileSync('pages/grammar/index.js', 'utf8');
  const start = source.indexOf('function buildThirdPersonPractice');
  const end = source.indexOf('function canUseDictionaryVoice');
  const context = { i18n: { getLanguage: () => language }, require: () => wordCourses };
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
  assert.equal(getClassroomCourse(home, 'noun').course.length, 0);
  assert.equal(getClassroomCourse(home, 'pronoun').course.length, 0);
  assert.equal(wordCourses.buildNounCourse(false).course.length, 9);
  assert.equal(wordCourses.buildPronounCourse(false).course.length, 9);
  assert.equal(getClassroomCourse(home, 'verb').course.length, 9);

  const grammarPage = fs.readFileSync(path.join(__dirname, '../pages/grammar/index.js'), 'utf8');
  assert.ok(grammarPage.indexOf('Page({') < grammarPage.indexOf("require('../../data/grammar-classroom/word-courses')"));
  assert.match(grammarPage, /selectClassroomTopic[\s\S]*buildNounCourse/);
  assert.match(grammarPage, /selectClassroomTopic[\s\S]*buildPronounCourse/);
});

test('名词与代词课程中英文内容、练习和两套主题完整', () => {
  [false, true].forEach((english) => {
    [wordCourses.buildNounCourse(english), wordCourses.buildPronounCourse(english)].forEach((bundle) => {
      assert.ok(bundle.title && bundle.copy);
      assert.ok(bundle.groups.some((group) => group.id === 'core'));
      assert.ok(bundle.groups.some((group) => group.id === 'advanced'));
      bundle.course.forEach((lesson) => {
        assert.ok(lesson.rules.length > 0);
        assert.ok(lesson.examples.length >= 3);
        assert.ok(lesson.questions.length >= 3);
        lesson.questions.forEach((question) => {
          assert.ok(question.options.some((option) => option.key === question.answer));
          assert.ok(question.correct && question.wrong);
        });
      });
    });
  });
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/grammar/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(__dirname, '../pages/grammar/index.wxss'), 'utf8');
  assert.match(wxml, /theme-\{\{theme\}\}/);
  assert.match(wxml, /language-\{\{language\}\}/);
  assert.match(wxss, /theme-library/);
});
