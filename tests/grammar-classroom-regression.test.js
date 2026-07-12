const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const wordCourses = require('../domain/grammar-classroom/word-courses');
const vnaCourses = require('../domain/grammar-classroom/verb-numeral-article-courses');
const modifierCourses = require('../domain/grammar-classroom/adjective-adverb-courses');
const relationCourses = require('../domain/grammar-classroom/preposition-conjunction-interjection-courses');
const allBuilders = Object.assign({}, wordCourses, vnaCourses, modifierCourses, relationCourses);

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
  const wordCategory = home.categories.find((item) => item.id === 'word');
  assert.equal(wordCategory.children.length, 10);
  assert.ok(wordCategory.children.every((item) => item.ready));
  assert.ok(home.verbGroups.some((group) => group.items.some((item) => item.id === 'complete-verb' && item.ready)));
  assert.equal(getClassroomCourse(home, 'noun').course.length, 0);
  assert.equal(getClassroomCourse(home, 'pronoun').course.length, 0);
  assert.equal(wordCourses.buildNounCourse(false).course.length, 9);
  assert.equal(wordCourses.buildPronounCourse(false).course.length, 9);
  assert.equal(getClassroomCourse(home, 'verb').course.length, 9);

  const grammarPage = fs.readFileSync(path.join(__dirname, '../pages/grammar/index.js'), 'utf8');
  assert.doesNotMatch(grammarPage, /require\('\.\.\/\.\.\/data\/grammar-classroom\/word-courses'\)/);
  assert.match(grammarPage, /onWordCourseLoaded/);
  const loader = fs.readFileSync(path.join(__dirname, '../components/grammar-word-loader/index.js'), 'utf8');
  assert.match(loader, /^const wordCourses = require\('\.\.\/\.\.\/domain\/grammar-classroom\/word-courses'\)/);
  const projectConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../project.config.json'), 'utf8'));
  const ignoredFolders = (projectConfig.packOptions && projectConfig.packOptions.ignore || []).filter((item) => item.type === 'folder').map((item) => item.value);
  assert.ok(!ignoredFolders.some((folder) => 'domain/grammar-classroom'.startsWith(folder)));
  assert.match(loader, /lifetimes:[\s\S]*ready\(\)[\s\S]*loadWordCourse/);
  ['grammar-vna-loader', 'grammar-modifier-loader', 'grammar-relation-loader'].forEach((name) => {
    const source = fs.readFileSync(path.join(__dirname, `../components/${name}/index.js`), 'utf8');
    assert.match(source, /^const courses = require\('\.\.\/\.\.\/domain\/grammar-classroom\//);
  });
  const grammarConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../pages/grammar/index.json'), 'utf8'));
  Object.values(grammarConfig.usingComponents).forEach((request) => {
    const base = path.resolve(__dirname, '../pages/grammar', request);
    ['.js', '.json', '.wxml', '.wxss'].forEach((extension) => assert.ok(fs.existsSync(`${base}${extension}`)));
  });
  const appConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8'));
  assert.equal(appConfig.lazyCodeLoading, 'requiredComponents');
});

test('十大词性课程中英文内容、练习和两套主题完整', () => {
  [false, true].forEach((english) => {
    Object.values(allBuilders).map((build) => build(english)).forEach((bundle) => {
      assert.ok(bundle.title && bundle.copy);
      assert.ok(bundle.groups.some((group) => group.id === 'core'));
      assert.ok(bundle.groups.some((group) => group.id === 'advanced'));
      bundle.course.forEach((lesson) => {
        assert.ok(lesson.rules.length > 0);
        assert.ok(lesson.examples.length >= 3);
        assert.equal(lesson.exampleNotes.length, lesson.examples.length);
        assert.ok(lesson.questions.length >= 3);
        lesson.questions.forEach((question) => {
          assert.ok(question.options.some((option) => option.key === question.answer));
          assert.ok(question.correct && question.wrong);
        });
      });
    });
  });
  Object.values(Object.assign({}, vnaCourses, modifierCourses, relationCourses)).forEach((build) => {
    build(true).course.forEach((lesson) => lesson.questions.forEach((question) => {
      assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
      question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
    }));
  });
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/grammar/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(__dirname, '../pages/grammar/index.wxss'), 'utf8');
  assert.match(wxml, /theme-\{\{theme\}\}/);
  assert.match(wxml, /language-\{\{language\}\}/);
  assert.match(wxss, /theme-library/);
  ['subject', 'predicate', 'object', 'attribute', 'adverbial', 'auxiliary', 'modal', 'conjunction', 'preposition', 'complement', 'interjection'].forEach((role) => assert.match(wxss, new RegExp(`role-${role}`)));
});
