const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const wordCourses = require('../grammar-package/domain/grammar-classroom/word-courses');
const vnaCourses = require('../grammar-package/domain/grammar-classroom/verb-numeral-article-courses');
const modifierCourses = require('../grammar-package/domain/grammar-classroom/adjective-adverb-courses');
const relationCourses = require('../grammar-package/domain/grammar-classroom/preposition-conjunction-interjection-courses');
const sourceWordCourses = require('../data/grammar-classroom/course-sources/word-courses');
const sourceVnaCourses = require('../data/grammar-classroom/course-sources/verb-numeral-article-courses');
const sourceModifierCourses = require('../data/grammar-classroom/course-sources/adjective-adverb-courses');
const sourceRelationCourses = require('../data/grammar-classroom/course-sources/preposition-conjunction-interjection-courses');
const sourceThirdPersonCourse = require('../data/grammar-classroom/course-sources/third-person-course');
const allBuilders = Object.assign({}, sourceWordCourses, sourceVnaCourses, sourceModifierCourses, sourceRelationCourses);
const withoutCoverage = (value) => JSON.parse(JSON.stringify(value, (key, item) => key === 'ruleCoverage' ? undefined : item));

function loadBuilders(language = 'zh-CN') {
  const source = fs.readFileSync('data/grammar-classroom/page-source/index.js', 'utf8');
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
  buildClassroomText(true).thirdPersonCourse.forEach((lesson) => {
    assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
    lesson.ruleCoverage.forEach((coverage) => {
      assert.ok(coverage.exampleIndexes.length && coverage.questionIndexes.length);
      coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
      coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
    });
  });

  const grammarPage = fs.readFileSync(path.join(__dirname, '../data/grammar-classroom/page-source/index.js'), 'utf8');
  assert.doesNotMatch(grammarPage, /require\('\.\.\/\.\.\/data\/grammar-classroom\/word-courses'\)/);
  assert.match(grammarPage, /onWordCourseLoaded/);
  const loader = fs.readFileSync(path.join(__dirname, '../grammar-package/components/grammar-word-loader/index.js'), 'utf8');
  assert.match(loader, /^const wordCourses = require\('\.\.\/\.\.\/domain\/grammar-classroom\/word-courses'\)/);
  const projectConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../project.config.json'), 'utf8'));
  const ignoredFolders = (projectConfig.packOptions && projectConfig.packOptions.ignore || []).filter((item) => item.type === 'folder').map((item) => item.value);
  assert.ok(!ignoredFolders.some((folder) => 'domain/grammar-classroom'.startsWith(folder)));
  assert.match(loader, /lifetimes:[\s\S]*ready\(\)[\s\S]*loadWordCourse/);
  ['grammar-vna-loader', 'grammar-modifier-loader', 'grammar-relation-loader'].forEach((name) => {
    const source = fs.readFileSync(path.join(__dirname, `../grammar-package/components/${name}/index.js`), 'utf8');
    assert.match(source, /^const courses = require\('\.\.\/\.\.\/domain\/grammar-classroom\//);
  });
  const grammarConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.json'), 'utf8'));
  Object.values(grammarConfig.usingComponents).forEach((request) => {
    const base = path.resolve(__dirname, '../grammar-package/pages/classroom', request);
    ['.js', '.json', '.wxml', '.wxss'].forEach((extension) => assert.ok(fs.existsSync(`${base}${extension}`)));
  });
  const appConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8'));
  assert.equal(appConfig.lazyCodeLoading, 'requiredComponents');
  assert.ok(appConfig.subPackages.some((pack) => pack.root === 'grammar-package' && pack.pages.includes('pages/classroom/index')));
  assert.match(grammarPage, /\/grammar-package\/pages\/classroom\/index/);
  const runtimePage = fs.readFileSync(path.join(__dirname, '../pages/grammar/index.js'), 'utf8');
  assert.match(runtimePage, /Page\(\{/);
  assert.ok(Buffer.byteLength(runtimePage) < Buffer.byteLength(grammarPage));
});

test('课程可读源文件与打包运行时文件保持一致', () => {
  const files = ['word-courses', 'verb-numeral-article-courses', 'adjective-adverb-courses', 'preposition-conjunction-interjection-courses', 'third-person-course'];
  files.forEach((file) => {
    const source = require(`../data/grammar-classroom/course-sources/${file}`);
    const runtime = require(`../grammar-package/domain/grammar-classroom/${file}`);
    Object.keys(source).forEach((name) => [false, true].forEach((english) => assert.deepEqual(withoutCoverage(runtime[name](english)), withoutCoverage(source[name](english)))));
  });
});

test('十大词性课程中英文内容、练习和两套主题完整', () => {
  [false, true].forEach((english) => {
    Object.values(allBuilders).map((build) => build(english)).forEach((bundle) => {
      assert.ok(bundle.title && bundle.copy);
      assert.ok(bundle.groups.some((group) => group.id === 'core'));
      assert.ok(bundle.groups.some((group) => group.id === 'advanced'));
      bundle.course.forEach((lesson) => {
        assert.ok(lesson.rules.length > 0);
        assert.ok(lesson.examples.length > 0);
        assert.equal(lesson.exampleNotes.length, lesson.examples.length);
        assert.ok(lesson.questions.length > 0);
        assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
        lesson.ruleCoverage.forEach((coverage) => {
          assert.ok(Array.isArray(coverage.exampleIndexes) && coverage.exampleIndexes.length > 0);
          assert.ok(Array.isArray(coverage.questionIndexes) && coverage.questionIndexes.length > 0);
          coverage.exampleIndexes.forEach((index) => assert.ok(Number.isInteger(index) && index >= 0 && index < lesson.examples.length));
          coverage.questionIndexes.forEach((index) => assert.ok(Number.isInteger(index) && index >= 0 && index < lesson.questions.length));
        });
        lesson.questions.forEach((question) => {
          assert.ok(question.options.some((option) => option.key === question.answer));
          assert.ok(question.correct && question.wrong);
        });
      });
    });
  });
  const adverbJobs = sourceModifierCourses.buildAdverbCourse(false).course.find((lesson) => lesson.id === 'adverb-jobs');
  assert.ok(adverbJobs.rules.some((rule) => rule.includes('修饰另一个副词')));
  assert.ok(adverbJobs.examples.some((example) => /remarkably\s+quickly/.test(example)));
  assert.ok(adverbJobs.questions.some((question) => /extremely/.test(question.question)));
  Object.values(Object.assign({}, sourceVnaCourses, sourceModifierCourses, sourceRelationCourses)).forEach((build) => {
    build(true).course.forEach((lesson) => lesson.questions.forEach((question) => {
      assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
      question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
    }));
  });
  const wxml = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxss'), 'utf8');
  assert.match(wxml, /theme-\{\{theme\}\}/);
  assert.match(wxml, /language-\{\{language\}\}/);
  assert.match(wxss, /theme-library/);
  assert.match(wxml, /selectThirdPersonCourse/);
  ['subject', 'predicate', 'object', 'attribute', 'adverbial', 'auxiliary', 'modal', 'conjunction', 'preposition', 'complement', 'interjection'].forEach((role) => assert.match(wxss, new RegExp(`role-${role}`)));
});
