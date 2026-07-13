const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const nounCourses = require('../grammar-package/domain/grammar-classroom/noun-courses');
const pronounCourses = require('../grammar-package/domain/grammar-classroom/pronoun-courses');
const wordCourses = Object.assign({}, nounCourses, pronounCourses);
const verbCourses = require('../grammar-package/domain/grammar-classroom/verb-courses');
const numeralCourses = require('../grammar-package/domain/grammar-classroom/numeral-courses');
const articleCourses = require('../grammar-package/domain/grammar-classroom/article-courses');
const vnaCourses = Object.assign({}, verbCourses, numeralCourses, articleCourses);
const adjectiveCourses = require('../grammar-package/domain/grammar-classroom/adjective-courses');
const adverbCourses = require('../grammar-package/domain/grammar-classroom/adverb-courses');
const modifierCourses = Object.assign({}, adjectiveCourses, adverbCourses);
const prepositionCourses = require('../grammar-package/domain/grammar-classroom/preposition-courses');
const conjunctionCourses = require('../grammar-package/domain/grammar-classroom/conjunction-courses');
const interjectionCourses = require('../grammar-package/domain/grammar-classroom/interjection-courses');
const relationCourses = Object.assign({}, prepositionCourses, conjunctionCourses, interjectionCourses);
const sourceWordCourses = require('../data/grammar-classroom/course-sources/word-courses');
const sourceVnaCourses = require('../data/grammar-classroom/course-sources/verb-numeral-article-courses');
const sourceModifierCourses = require('../data/grammar-classroom/course-sources/adjective-adverb-courses');
const sourcePrepositionCourses = require('../data/grammar-classroom/course-sources/preposition-conjunction-interjection-courses');
const sourceConjunctionCourses = require('../data/grammar-classroom/course-sources/conjunction-courses');
const sourceInterjectionCourses = require('../data/grammar-classroom/course-sources/interjection-courses');
const sourceRelationCourses = Object.assign({}, sourcePrepositionCourses, sourceConjunctionCourses, sourceInterjectionCourses);
const sourceThirdPersonCourse = require('../data/grammar-classroom/course-sources/third-person-course');
const sourceWordFormationCourses = require('../data/grammar-classroom/course-sources/word-formation-courses');
const sourceSentenceElementsCourses = require('../data/grammar-classroom/course-sources/sentence-elements-courses');
const sourceBasicSentencePatternsCourses = require('../data/grammar-classroom/course-sources/basic-sentence-patterns-courses');
const sourcePredicateSystemCourses = require('../data/grammar-classroom/course-sources/predicate-system-courses');
const sourceNonfiniteSystemCourses = require('../data/grammar-classroom/course-sources/nonfinite-system-courses');
const sourceSpecialStructuresCourses = require('../data/grammar-classroom/course-sources/special-structures-courses');
const sourceCoordinationCourses = require('../data/grammar-classroom/course-sources/coordination-courses');
const sourceNounClausesCourses = require('../data/grammar-classroom/course-sources/noun-clauses-courses');
const sourceRelativeClausesCourses = require('../data/grammar-classroom/course-sources/relative-clauses-courses');
const sourceAdverbialClausesCourses = require('../data/grammar-classroom/course-sources/adverbial-clauses-courses');
const sourceReportedSpeechCourses = require('../data/grammar-classroom/course-sources/reported-speech-courses');
const sourceCohesionReferenceCourses = require('../data/grammar-classroom/course-sources/cohesion-reference-courses');
const sourceInformationOrderCourses = require('../data/grammar-classroom/course-sources/information-order-courses');
const sourcePunctuationCourses = require('../data/grammar-classroom/course-sources/punctuation-courses');
const sourceCommonExpressionCourses = require('../data/grammar-classroom/course-sources/common-expression-courses');
const allBuilders = Object.assign({}, sourceWordCourses, sourceVnaCourses, sourceModifierCourses, sourceRelationCourses);
const allSectionBuilders = Object.assign({}, allBuilders, sourceWordFormationCourses, sourceSentenceElementsCourses, sourceBasicSentencePatternsCourses, sourcePredicateSystemCourses, sourceNonfiniteSystemCourses, sourceSpecialStructuresCourses, sourceCoordinationCourses, sourceNounClausesCourses, sourceRelativeClausesCourses, sourceAdverbialClausesCourses, sourceReportedSpeechCourses, sourceCohesionReferenceCourses, sourceInformationOrderCourses, sourcePunctuationCourses, sourceCommonExpressionCourses);
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

test('语法微课堂首屏不构建完整课程，点击后按专题加载', () => {
  const { buildClassroomText, getClassroomCourse } = loadBuilders();
  const home = buildClassroomText();
  assert.equal(home.tab, '语法微课堂');
  assert.equal(loadBuilders('en').buildClassroomText().tab, 'Micro-Lessons');
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
  assert.equal(wordCourses.buildNounCourse(false).course.length, 10);
  assert.equal(wordCourses.buildPronounCourse(false).course.length, 15);
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
  const pronounLoader = fs.readFileSync(path.join(__dirname, '../grammar-package/components/grammar-pronoun-loader/index.js'), 'utf8');
  assert.match(loader, /^const nounCourses = require\('\.\.\/\.\.\/domain\/grammar-classroom\/noun-courses'\)/);
  assert.doesNotMatch(loader, /pronoun-courses|buildPronounCourse/);
  assert.match(pronounLoader, /^const pronounCourses = require\('\.\.\/\.\.\/domain\/grammar-classroom\/pronoun-courses'\)/);
  assert.doesNotMatch(pronounLoader, /domain\/grammar-classroom\/noun-courses|buildNounCourse/);
  const projectConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../project.config.json'), 'utf8'));
  const ignoredFolders = (projectConfig.packOptions && projectConfig.packOptions.ignore || []).filter((item) => item.type === 'folder').map((item) => item.value);
  assert.ok(!ignoredFolders.some((folder) => 'domain/grammar-classroom'.startsWith(folder)));
  assert.match(loader, /lifetimes:[\s\S]*ready\(\)[\s\S]*loadWordCourse/);
  ['grammar-verb-loader', 'grammar-numeral-loader', 'grammar-article-loader'].forEach((name) => {
    const source = fs.readFileSync(path.join(__dirname, `../grammar-package/components/${name}/index.js`), 'utf8');
    assert.match(source, /^const courses = require\('\.\.\/\.\.\/domain\/grammar-classroom\//);
  });
  const adjectiveLoader = fs.readFileSync(path.join(__dirname, '../grammar-package/components/grammar-adjective-loader/index.js'), 'utf8');
  const adverbLoader = fs.readFileSync(path.join(__dirname, '../grammar-package/components/grammar-adverb-loader/index.js'), 'utf8');
  assert.match(adjectiveLoader, /adjective-courses/);
  assert.doesNotMatch(adjectiveLoader, /adverb-courses|buildAdverbCourse/);
  assert.match(adverbLoader, /adverb-courses/);
  assert.doesNotMatch(adverbLoader, /adjective-courses|buildAdjectiveCourse/);
  [['grammar-preposition-loader','preposition-courses'],['grammar-conjunction-loader','conjunction-courses'],['grammar-interjection-loader','interjection-courses']].forEach(([name,file]) => {
    const source = fs.readFileSync(path.join(__dirname, `../grammar-package/components/${name}/index.js`), 'utf8');
    assert.match(source, new RegExp(file));
  });
  const sentenceElementsLoader = fs.readFileSync(path.join(__dirname, '../grammar-package/components/grammar-sentence-elements-loader/index.js'), 'utf8');
  const basicPatternsLoader = fs.readFileSync(path.join(__dirname, '../grammar-package/components/grammar-basic-patterns-loader/index.js'), 'utf8');
  assert.match(sentenceElementsLoader, /require\('\.\.\/\.\.\/domain\/grammar-classroom\/sentence-elements-courses'\)/);
  assert.doesNotMatch(sentenceElementsLoader, /basic-sentence-patterns-courses/);
  assert.match(basicPatternsLoader, /require\('\.\.\/\.\.\/domain\/grammar-classroom\/basic-sentence-patterns-courses'\)/);
  assert.doesNotMatch(basicPatternsLoader, /sentence-elements-courses/);
  [
    ['grammar-predicate-system-loader', 'predicate-system-courses'],
    ['grammar-nonfinite-system-loader', 'nonfinite-system-courses'],
    ['grammar-special-structures-loader', 'special-structures-courses']
  ].forEach(([loaderName, courseName]) => {
    const source = fs.readFileSync(path.join(__dirname, `../grammar-package/components/${loaderName}/index.js`), 'utf8');
    assert.match(source, new RegExp(`require\\('\\.\\.\\/\\.\\.\\/domain\\/grammar-classroom\\/${courseName}'\\)`));
  });
  [
    ['grammar-cohesion-reference-loader', 'cohesion-reference-courses'],
    ['grammar-information-order-loader', 'information-order-courses'],
    ['grammar-punctuation-loader', 'punctuation-courses'],
    ['grammar-common-expression-loader', 'common-expression-courses']
  ].forEach(([loaderName, courseName]) => {
    const source = fs.readFileSync(path.join(__dirname, `../grammar-package/components/${loaderName}/index.js`), 'utf8');
    assert.match(source, new RegExp(`require\\('\\.\\.\\/\\.\\.\\/domain\\/grammar-classroom\\/${courseName}'\\)`));
  });
  [
    ['grammar-relative-clauses-loader', 'relative-clauses-courses'],
    ['grammar-adverbial-clauses-loader', 'adverbial-clauses-courses'],
    ['grammar-reported-speech-loader', 'reported-speech-courses']
  ].forEach(([loaderName, courseName]) => {
    const source = fs.readFileSync(path.join(__dirname, `../grammar-package/components/${loaderName}/index.js`), 'utf8');
    assert.match(source, new RegExp(`require\\('\\.\\.\\/\\.\\.\\/domain\\/grammar-classroom\\/${courseName}'\\)`));
  });
  [
    ['grammar-coordination-loader', 'coordination-courses'],
    ['grammar-noun-clauses-loader', 'noun-clauses-courses']
  ].forEach(([loaderName, courseName]) => {
    const source = fs.readFileSync(path.join(__dirname, `../grammar-package/components/${loaderName}/index.js`), 'utf8');
    assert.match(source, new RegExp(`require\\('\\.\\.\\/\\.\\.\\/domain\\/grammar-classroom\\/${courseName}'\\)`));
  });
  const verbLoader = fs.readFileSync(path.join(__dirname, '../grammar-package/components/grammar-verb-loader/index.js'), 'utf8');
  assert.doesNotMatch(verbLoader, /third-person-course|numeral-courses|article-courses/);
  const grammarConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.json'), 'utf8'));
  assert.equal(grammarConfig.navigationBarTitleText, '语法微课堂');
  const classroomWxml = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxml'), 'utf8');
  assert.match(classroomWxml, /Grammar Micro-Lessons/);
  assert.match(classroomWxml, /语法微课堂/);
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
  [false, true].forEach((english) => {
    assert.deepEqual(withoutCoverage(nounCourses.buildNounCourse(english)), withoutCoverage(sourceWordCourses.buildNounCourse(english)));
    assert.deepEqual(withoutCoverage(pronounCourses.buildPronounCourse(english)), withoutCoverage(sourceWordCourses.buildPronounCourse(english)));
  });
  Object.keys(sourceVnaCourses).forEach((name) => [false, true].forEach((english) => assert.deepEqual(withoutCoverage(vnaCourses[name](english)), withoutCoverage(sourceVnaCourses[name](english)))));
  Object.keys(sourceModifierCourses).forEach((name) => [false, true].forEach((english) => assert.deepEqual(withoutCoverage(modifierCourses[name](english)), withoutCoverage(sourceModifierCourses[name](english)))));
  Object.keys(sourceRelationCourses).forEach((name) => [false, true].forEach((english) => assert.deepEqual(withoutCoverage(relationCourses[name](english)), withoutCoverage(sourceRelationCourses[name](english)))));
  const files = ['word-formation-courses', 'sentence-elements-courses', 'basic-sentence-patterns-courses', 'predicate-system-courses', 'nonfinite-system-courses', 'special-structures-courses', 'coordination-courses', 'noun-clauses-courses', 'relative-clauses-courses', 'adverbial-clauses-courses', 'reported-speech-courses', 'cohesion-reference-courses', 'information-order-courses', 'punctuation-courses', 'common-expression-courses'];
  files.forEach((file) => {
    const source = require(`../data/grammar-classroom/course-sources/${file}`);
    const runtime = require(`../grammar-package/domain/grammar-classroom/${file}`);
    Object.keys(source).forEach((name) => [false, true].forEach((english) => assert.deepEqual(withoutCoverage(runtime[name](english)), withoutCoverage(source[name](english)))));
  });
});

test('名词与代词使用独立运行时和独立懒加载组件', () => {
  assert.equal(fs.existsSync(path.join(__dirname, '../grammar-package/domain/grammar-classroom/word-courses.js')), false);
  const nounRuntimePath = path.join(__dirname, '../grammar-package/domain/grammar-classroom/noun-courses.js');
  const pronounRuntimePath = path.join(__dirname, '../grammar-package/domain/grammar-classroom/pronoun-courses.js');
  const nounRuntime = fs.readFileSync(nounRuntimePath, 'utf8');
  const pronounRuntime = fs.readFileSync(pronounRuntimePath, 'utf8');
  assert.deepEqual(Object.keys(nounCourses), ['buildNounCourse']);
  assert.deepEqual(Object.keys(pronounCourses), ['buildPronounCourse']);
  assert.doesNotMatch(nounRuntime, /代词的定义与本质|pronoun-essence/);
  assert.doesNotMatch(pronounRuntime, /名词的定义与本质|noun-job/);
  assert.ok(Buffer.byteLength(nounRuntime) < 30000);
  assert.ok(Buffer.byteLength(pronounRuntime) < 60000);
  const page = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxml'), 'utf8');
  assert.match(page, /topic === 'noun'\) return 'word'/);
  assert.match(page, /topic === 'pronoun'\) return 'pronoun'/);
  assert.match(wxml, /grammar-word-loader wx:if="\{\{loaderKind === 'word'\}\}"/);
  assert.match(wxml, /grammar-pronoun-loader wx:if="\{\{loaderKind === 'pronoun'\}\}"/);
});

test('动词、数词与冠词使用独立运行时和独立懒加载组件', () => {
  const runtimes = {
    verb: fs.readFileSync(path.join(__dirname, '../grammar-package/domain/grammar-classroom/verb-courses.js'), 'utf8'),
    numeral: fs.readFileSync(path.join(__dirname, '../grammar-package/domain/grammar-classroom/numeral-courses.js'), 'utf8'),
    article: fs.readFileSync(path.join(__dirname, '../grammar-package/domain/grammar-classroom/article-courses.js'), 'utf8')
  };
  assert.deepEqual(Object.keys(verbCourses), ['buildVerbCourse']);
  assert.deepEqual(Object.keys(numeralCourses), ['buildNumeralCourse']);
  assert.deepEqual(Object.keys(articleCourses), ['buildArticleCourse']);
  assert.match(runtimes.verb, /verb-jobs/);
  assert.doesNotMatch(runtimes.verb, /numeral-essence|article-essence/);
  assert.match(runtimes.numeral, /numeral-essence/);
  assert.doesNotMatch(runtimes.numeral, /verb-jobs|article-essence/);
  assert.match(runtimes.article, /article-essence/);
  assert.doesNotMatch(runtimes.article, /verb-jobs|numeral-essence/);
  assert.ok(!fs.existsSync(path.join(__dirname, '../grammar-package/domain/grammar-classroom/verb-numeral-article-courses.js')));
  assert.ok(!fs.existsSync(path.join(__dirname, '../grammar-package/components/grammar-vna-loader/index.js')));
  const page = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxml'), 'utf8');
  assert.match(page, /topic === 'verb' \|\| topic === 'numeral' \|\| topic === 'article'\) return topic/);
  ['verb','numeral','article'].forEach((topic) => assert.match(wxml, new RegExp(`grammar-${topic}-loader wx:if="\\{\\{loaderKind === '${topic}'\\}\\}"`)));
});

test('形容词与副词使用独立运行时和独立懒加载组件', () => {
  const adjectiveRuntime = fs.readFileSync(path.join(__dirname, '../grammar-package/domain/grammar-classroom/adjective-courses.js'), 'utf8');
  const adverbRuntime = fs.readFileSync(path.join(__dirname, '../grammar-package/domain/grammar-classroom/adverb-courses.js'), 'utf8');
  assert.deepEqual(Object.keys(adjectiveCourses), ['buildAdjectiveCourse']);
  assert.deepEqual(Object.keys(adverbCourses), ['buildAdverbCourse']);
  assert.match(adjectiveRuntime, /adjective-essence/);
  assert.doesNotMatch(adjectiveRuntime, /adverb-jobs/);
  assert.match(adverbRuntime, /adverb-jobs/);
  assert.doesNotMatch(adverbRuntime, /adjective-essence/);
  assert.ok(Buffer.byteLength(adverbRuntime) < 55000);
  assert.ok(!fs.existsSync(path.join(__dirname, '../grammar-package/domain/grammar-classroom/adjective-adverb-courses.js')));
  const wxml = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxml'), 'utf8');
  assert.match(wxml, /grammar-adjective-loader wx:if="\{\{loaderKind === 'adjective'\}\}"/);
  assert.match(wxml, /grammar-adverb-loader wx:if="\{\{loaderKind === 'adverb'\}\}"/);
});

test('介词、连词与感叹词使用独立运行时和独立懒加载组件', () => {
  const runtimes = Object.fromEntries(['preposition','conjunction','interjection'].map((topic) => [topic, fs.readFileSync(path.join(__dirname, `../grammar-package/domain/grammar-classroom/${topic}-courses.js`), 'utf8')]));
  assert.deepEqual(Object.keys(prepositionCourses), ['buildPrepositionCourse']);
  assert.deepEqual(Object.keys(conjunctionCourses), ['buildConjunctionCourse']);
  assert.deepEqual(Object.keys(interjectionCourses), ['buildInterjectionCourse']);
  assert.match(runtimes.preposition, /prep-essence/);
  assert.doesNotMatch(runtimes.preposition, /conj-essence|interj-essence/);
  assert.match(runtimes.conjunction, /conj-essence/);
  assert.doesNotMatch(runtimes.conjunction, /prep-essence|interj-essence/);
  assert.match(runtimes.interjection, /interj-essence/);
  assert.doesNotMatch(runtimes.interjection, /prep-essence|conj-essence/);
  assert.ok(!fs.existsSync(path.join(__dirname, '../grammar-package/domain/grammar-classroom/preposition-conjunction-interjection-courses.js')));
  const wxml = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxml'), 'utf8');
  ['preposition','conjunction','interjection'].forEach((topic) => assert.match(wxml, new RegExp(`grammar-${topic}-loader wx:if="\\{\\{loaderKind === '${topic}'\\}\\}"`)));
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
  const classroomPage = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  const wxss = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxss'), 'utf8');
  assert.match(wxml, /theme-\{\{theme\}\}/);
  assert.match(wxml, /language-\{\{language\}\}/);
  assert.match(wxss, /theme-library/);
  assert.doesNotMatch(wxml, /selectThirdPersonCourse|9 节专项课|9 lessons/);
  assert.doesNotMatch(classroomPage, /screen:\s*'verb-map'/);
  assert.doesNotMatch(classroomPage, /third-person|thirdPerson|selectThirdPerson/);
  assert.match(classroomPage, /this\.fullCourse = course/);
  assert.match(classroomPage, /course: courseSummaries/);
  ['subject', 'predicate', 'object', 'attribute', 'adverbial', 'auxiliary', 'modal', 'conjunction', 'preposition', 'complement', 'interjection'].forEach((role) => assert.match(wxss, new RegExp(`role-${role}`)));
});

test('动词完整课程覆盖中学核心与进阶知识边界', () => {
  const requiredLessonIds = [
    'verb-jobs', 'five-sentence-patterns', 'transitivity', 'linking', 'double-object-complement',
    'verb-five-forms', 'third-person-form', 'past-forms', 'ing-forms', 'subject-verb-agreement',
    'auxiliary-system', 'modal-meanings', 'present-simple', 'past-simple', 'future-forms',
    'present-progressive', 'past-progressive', 'perfect-vs-past', 'past-time-sequence',
    'future-in-clauses', 'voice', 'passive-tenses', 'infinitive', 'gerund', 'participles',
    'causative-perception', 'gerund-infinitive-meaning', 'nonfinite-advanced',
    'agreement-complex', 'phrasal', 'special-verb-patterns', 'verb-complements'
  ];
  [false, true].forEach((english) => {
    const bundle = sourceVnaCourses.buildVerbCourse(english);
    const ids = bundle.course.map((lesson) => lesson.id);
    assert.ok(bundle.course.length >= 36);
    requiredLessonIds.forEach((id) => assert.ok(ids.includes(id), `missing verb lesson: ${id}`));
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(bundle.groups.flatMap((group) => group.lessons.map((lesson) => lesson.id)), ids);
    assert.deepEqual(bundle.course.map((lesson) => lesson.no), bundle.course.map((_, index) => String(index + 1).padStart(2, '0')));
    assert.ok(bundle.course.reduce((sum, lesson) => sum + lesson.rules.length, 0) >= 106);
    assert.ok(bundle.course.reduce((sum, lesson) => sum + lesson.examples.length, 0) >= 116);
    assert.ok(bundle.course.reduce((sum, lesson) => sum + lesson.questions.length, 0) >= 116);
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), [25, 11]);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), [5, 3, 7, 9, 7, 5]);
    assert.match(bundle.course[0].title, english ? /Definition and core/ : /定义与本质/);
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.exampleNotes.length, lesson.examples.length);
      assert.ok(lesson.exampleNotes.every((note) => note.visible && (note.body || note.detail)));
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
      lesson.ruleCoverage.forEach((coverage) => {
        assert.ok(coverage.exampleIndexes.length && coverage.questionIndexes.length);
        coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
        coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
      });
      lesson.questions.forEach((question) => {
        assert.ok(question.options.some((option) => option.key === question.answer));
        if (english) {
          assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
          question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
        }
      });
    });
    const summaries = bundle.course.map(({ id, no, level, title, meta }) => ({ id, no, level, title, meta }));
    assert.ok(Buffer.byteLength(JSON.stringify(summaries)) < 12000);
  });
  const classroomPage = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  assert.match(classroomPage, /\['verb', 'Verbs',[^\n]+, 36\]/);
  assert.match(classroomPage, /\['verb', '动词',[^\n]+, 36\]/);
  const thirdPersonLesson = sourceVnaCourses.buildVerbCourse(false).course.find((lesson) => lesson.id === 'third-person-form');
  assert.ok(thirdPersonLesson.rules.some((rule) => rule.includes('/s/')));
  assert.ok(thirdPersonLesson.rules.some((rule) => rule.includes('/z/')));
  assert.ok(thirdPersonLesson.rules.some((rule) => rule.includes('/ɪz/')));
  const verbBundle = sourceVnaCourses.buildVerbCourse(false);
  const roles = verbBundle.course.flatMap((lesson) => lesson.analyses.flat()).map((part) => part.role);
  ['predicative','directObject','indirectObject','preposition','prepositionalObject','objectComplement'].forEach((role) => assert.ok(roles.includes(role)));
  assert.match(verbBundle.sections.at(-1).title, /补足关系/);
  assert.ok(!verbBundle.course.find((lesson) => lesson.id === 'verb-complements').rules.some((rule) => rule.includes('固定搭配')));
});

test('形容词课程从性质本质到比较范围与补足关系完整闭环', () => {
  const requiredIds = ['adjective-essence','adjective-jobs','adjective-position','adjective-restrictions','adjective-complements','adjective-degree','adjective-comparative-form','adjective-comparison','comparative-modifiers','adjective-superlative','comparison-boundaries','participle-adjectives','compound-adjectives','adjective-order','adjective-nominal'];
  [false, true].forEach((english) => {
    const bundle = sourceModifierCourses.buildAdjectiveCourse(english);
    assert.deepEqual(bundle.course.map((lesson) => lesson.id), requiredIds);
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), [10, 5]);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), [2, 3, 2, 4, 3, 1]);
    assert.match(bundle.course[0].title, english ? /Definition and core/ : /定义与本质/);
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.exampleNotes.length, lesson.examples.length);
      assert.ok(lesson.exampleNotes.every((note) => note.visible && (note.body || note.detail)));
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
      lesson.ruleCoverage.forEach((coverage) => {
        assert.ok(coverage.exampleIndexes.length && coverage.questionIndexes.length);
        coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
        coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
      });
      if (english) lesson.questions.forEach((question) => {
        assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
        question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
      });
    });
  });
  const bundle = sourceModifierCourses.buildAdjectiveCourse(false);
  const roles = bundle.course.flatMap((lesson) => lesson.analyses.flat()).map((part) => part.role);
  ['attribute','predicative','objectComplement'].forEach((role) => assert.ok(roles.includes(role)));
  const page = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  assert.match(page, /\['adjective', '形容词',[^\n]+, 15\]/);
  assert.match(page, /\['adjective', 'Adjectives',[^\n]+, 15\]/);
});

test('副词课程从修饰本质到范围、位置、否定与连接完整闭环', () => {
  const requiredIds = ['adverb-essence','adverb-jobs','adverbial-boundary','adverb-types','adverb-formation','adverb-position','multiple-adverb-order','adjective-or-adverb','adverb-comparison','degree-patterns','adverb-scope','sentence-adverbs','interrogative-relative-adverbs','negative-limiting-adverbs','conjunctive-adverbs','adverb-traps'];
  [false, true].forEach((english) => {
    const bundle = sourceModifierCourses.buildAdverbCourse(english);
    assert.deepEqual(bundle.course.map((lesson) => lesson.id), requiredIds);
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), [11, 5]);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), [3, 3, 2, 2, 3, 3]);
    assert.match(bundle.course[0].title, english ? /Definition and core/ : /定义与本质/);
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.exampleNotes.length, lesson.examples.length);
      assert.ok(lesson.exampleNotes.every((note) => note.visible && (note.body || note.detail)));
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
      lesson.ruleCoverage.forEach((coverage) => {
        assert.ok(coverage.exampleIndexes.length && coverage.questionIndexes.length);
        coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
        coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
      });
      if (english) lesson.questions.forEach((question) => {
        assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
        question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
      });
    });
  });
  const bundle = sourceModifierCourses.buildAdverbCourse(false);
  assert.match(bundle.course.find((lesson) => lesson.id === 'adverbial-boundary').rules[0], /副词是词类；状语是句子成分/);
  assert.equal(bundle.course.find((lesson) => lesson.id === 'adverb-traps').examples.length, 2);
  assert.ok(bundle.course.find((lesson) => lesson.id === 'conjunctive-adverbs').rules.some((rule) => rule.includes('不是并列连词')));
  const relationRoles = bundle.course.find((lesson) => lesson.id === 'interrogative-relative-adverbs').analyses.flat().map((part) => part.role);
  ['predicative','attribute','indirectObject','directObject'].forEach((role) => assert.ok(relationRoles.includes(role)));
  const page = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  assert.match(page, /\['adverb', '副词',[^\n]+, 16\]/);
  assert.match(page, /\['adverb', 'Adverbs',[^\n]+, 16\]/);
});

test('名词课程从定义、句法功能到数量和关系完整闭环', () => {
  const requiredIds = ['noun-job','noun-functions','countability','regular-plural','irregular-plural','possessive','noun-modifier','noun-types','collective-noun','noun-boss'];
  [false, true].forEach((english) => {
    const bundle = sourceWordCourses.buildNounCourse(english);
    assert.deepEqual(bundle.course.map((lesson) => lesson.id), requiredIds);
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), [7, 3]);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), [2, 3, 2, 2, 1]);
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.exampleNotes.length, lesson.examples.length);
      assert.ok(lesson.exampleNotes.every((note) => note.visible && (note.body || note.detail)));
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
      lesson.ruleCoverage.forEach((coverage) => {
        assert.ok(coverage.exampleIndexes.length && coverage.questionIndexes.length);
        coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
        coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
      });
    });
    if (english) bundle.course.forEach((lesson) => lesson.questions.forEach((question) => {
      assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
      question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
    }));
  });
  const nounFunctions = sourceWordCourses.buildNounCourse(false).course.find((lesson) => lesson.id === 'noun-functions');
  const roles = nounFunctions.analyses.flat().map((part) => part.role);
  ['predicative','indirectObject','directObject','objectComplement'].forEach((role) => assert.ok(roles.includes(role)));
  const possessive = sourceWordCourses.buildNounCourse(false).course.find((lesson) => lesson.id === 'possessive');
  assert.ok(possessive.rules.some((rule) => rule.includes('不是简单的“有生命/无生命”二分')));
  const nounModifier = sourceWordCourses.buildNounCourse(false).course.find((lesson) => lesson.id === 'noun-modifier');
  assert.ok(!nounModifier.rules.some((rule) => rule.includes('固定搭配')));
  const collective = sourceWordCourses.buildNounCourse(false).course.find((lesson) => lesson.id === 'collective-noun');
  assert.ok(collective.rules.some((rule) => rule.includes('英式英语')));
  const page = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  assert.match(page, /\['noun', 'Nouns',[^\n]+, 10\]/);
  assert.match(page, /\['noun', '名词',[^\n]+, 10\]/);
});

test('代词课程从指代本质到一致与歧义完整闭环', () => {
  const requiredIds = ['pronoun-essence','personal-pronoun','possessive-pronoun','reflexive','demonstrative','interrogative','indefinite-some-any','indefinite-quantity','it-reference','relative-pronoun','reciprocal','substitute-pronoun','pronoun-agreement','pronoun-ambiguity','pronoun-boss'];
  [false, true].forEach((english) => {
    const bundle = sourceWordCourses.buildPronounCourse(english);
    assert.deepEqual(bundle.course.map((lesson) => lesson.id), requiredIds);
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), [13, 2]);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), [1, 3, 4, 2, 2, 2, 1]);
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.exampleNotes.length, lesson.examples.length);
      assert.ok(lesson.exampleNotes.every((note) => note.visible && (note.body || note.detail)));
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
      lesson.ruleCoverage.forEach((coverage) => {
        assert.ok(coverage.exampleIndexes.length && coverage.questionIndexes.length);
        coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
        coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
      });
      if (english) lesson.questions.forEach((question) => {
        assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
        question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
      });
    });
  });
  const essence = sourceWordCourses.buildPronounCourse(false).course[0];
  assert.equal(essence.id, 'pronoun-essence');
  assert.ok(essence.rules.some((rule) => rule.includes('指向语境')));
  assert.ok(essence.rules.some((rule) => rule.includes('限定词')));
  assert.ok(essence.analyses[1].some((part) => part.text === 'I' && part.role === 'subject'));
  assert.ok(essence.analyses[1].some((part) => part.text === 'saw' && part.role === 'predicate'));
  assert.deepEqual(essence.ruleCoverage[1], { exampleIndexes: [0, 1], questionIndexes: [0, 1] });
  const personal = sourceWordCourses.buildPronounCourse(false).course.find((lesson) => lesson.id === 'personal-pronoun');
  assert.ok(personal.analyses[1].some((part) => part.text === 'to' && part.role === 'preposition'));
  assert.ok(personal.analyses[1].some((part) => part.text === 'him.' && part.role === 'object'));
  const reflexive = sourceWordCourses.buildPronounCourse(false).course.find((lesson) => lesson.id === 'reflexive');
  const emphasisExample = reflexive.analyses.find((analysis) => analysis.some((part) => part.text === 'myself.'));
  assert.ok(emphasisExample.some((part) => part.text === 'the cake' && part.role === 'object'));
  assert.ok(emphasisExample.some((part) => part.text === 'myself.' && part.role === 'emphasis'));
  const relative = sourceWordCourses.buildPronounCourse(false).course.find((lesson) => lesson.id === 'relative-pronoun');
  assert.ok(relative.rules.some((rule) => rule.includes('关系副词')));
  const interrogative = sourceWordCourses.buildPronounCourse(false).course.find((lesson) => lesson.id === 'interrogative');
  assert.ok(interrogative.analyses[2].some((part) => part.text === 'Whose bag' && part.role === 'predicative'));
  assert.ok(interrogative.analyses[2].some((part) => part.text === 'this?' && part.role === 'subject'));
  const agreement = sourceWordCourses.buildPronounCourse(false).course.find((lesson) => lesson.id === 'pronoun-agreement');
  assert.ok(agreement.rules.some((rule) => rule.includes('单数 they')));
  assert.equal(agreement.level, 'core');
  const quantity = sourceWordCourses.buildPronounCourse(false).course.find((lesson) => lesson.id === 'indefinite-quantity');
  assert.equal(quantity.rules.length, 6);
  assert.equal(quantity.examples.length, 8);
  assert.equal(quantity.questions.length, 8);
  assert.deepEqual(quantity.ruleCoverage, [
    { exampleIndexes: [0], questionIndexes: [0] },
    { exampleIndexes: [1], questionIndexes: [1] },
    { exampleIndexes: [2], questionIndexes: [2] },
    { exampleIndexes: [3], questionIndexes: [3] },
    { exampleIndexes: [4, 5], questionIndexes: [4, 5] },
    { exampleIndexes: [6, 7], questionIndexes: [6, 7] }
  ]);
  quantity.ruleCoverage.forEach((coverage) => {
    assert.ok(coverage.exampleIndexes.length > 0);
    assert.ok(coverage.questionIndexes.length > 0);
  });
  const itReference = sourceWordCourses.buildPronounCourse(false).course.find((lesson) => lesson.id === 'it-reference');
  assert.deepEqual(itReference.ruleCoverage[1], { exampleIndexes: [1, 2, 3], questionIndexes: [1, 2, 3] });
  assert.deepEqual(itReference.ruleCoverage[2], { exampleIndexes: [4, 5], questionIndexes: [4, 5] });
  const reciprocal = sourceWordCourses.buildPronounCourse(false).course.find((lesson) => lesson.id === 'reciprocal');
  assert.equal(reciprocal.title, '相互代词');
  assert.ok(!reciprocal.examples.some((example) => /new one|Give me another/.test(example)));
  const page = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  assert.match(page, /\['pronoun', 'Pronouns',[^\n]+, 15\]/);
  assert.match(page, /\['pronoun', '代词',[^\n]+, 15\]/);
});

test('数词课程从数量本质到功能读法与一致完整闭环', () => {
  const requiredIds = [
    'numeral-essence', 'numeral-functions', 'cardinals', 'ordinals', 'large-numbers',
    'fractions', 'decimals-percent', 'date-time', 'labels-years', 'approximate',
    'multiples-ratios', 'number-agreement'
  ];
  [false, true].forEach((english) => {
    const bundle = sourceVnaCourses.buildNumeralCourse(english);
    assert.deepEqual(bundle.course.map((lesson) => lesson.id), requiredIds);
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), [10, 2]);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), [2, 3, 2, 2, 2, 1]);
    assert.ok(bundle.course.reduce((sum, lesson) => sum + lesson.rules.length, 0) >= 35);
    assert.ok(bundle.course.reduce((sum, lesson) => sum + lesson.examples.length, 0) >= 36);
    assert.ok(bundle.course.reduce((sum, lesson) => sum + lesson.questions.length, 0) >= 36);
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.exampleNotes.length, lesson.examples.length);
      assert.ok(lesson.exampleNotes.every((note) => note.visible && (note.body || note.detail)));
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
      lesson.ruleCoverage.forEach((coverage) => {
        assert.ok(coverage.exampleIndexes.length && coverage.questionIndexes.length);
        coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
        coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
      });
      lesson.questions.forEach((question) => assert.ok(question.options.some((option) => option.key === question.answer)));
    });
    if (english) bundle.course.forEach((lesson) => lesson.questions.forEach((question) => {
      assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
      question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
    }));
  });
  const essence = sourceVnaCourses.buildNumeralCourse(false).course.find((lesson) => lesson.id === 'numeral-essence');
  assert.ok(essence.rules.some((rule) => rule.includes('数量关系')));
  assert.ok(essence.exampleNotes.some((note) => note.body.includes('公交线路命名')));
  const numeralZh = sourceVnaCourses.buildNumeralCourse(false);
  const functions = numeralZh.course.find((lesson) => lesson.id === 'numeral-functions');
  assert.ok(functions.examples.some((example) => example.includes('The first chapter')));
  const ordinals = numeralZh.course.find((lesson) => lesson.id === 'ordinals');
  assert.ok(ordinals.examples.some((example) => example.includes('The third runner')));
  const largeNumbers = numeralZh.course.find((lesson) => lesson.id === 'large-numbers');
  assert.ok(largeNumbers.examples.some((example) => example.includes('(BrE)') && example.includes('(AmE)')));
  const dateTime = numeralZh.course.find((lesson) => lesson.id === 'date-time');
  assert.equal(dateTime.rules.length, 4);
  assert.ok(dateTime.rules.some((rule) => rule.startsWith('past')));
  assert.ok(dateTime.rules.some((rule) => rule.startsWith('to')));
  const page = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  assert.match(page, /\['numeral', 'Numerals',[^\n]+, 12\]/);
  assert.match(page, /\['numeral', '数词',[^\n]+, 12\]/);
});

test('冠词课程从指称本质到零冠词与意义变化完整闭环', () => {
  const requiredIds = [
    'article-essence', 'article-determiner-boundary', 'indefinite-reference', 'a-an',
    'the-known', 'the-context-chain', 'unique-superlative', 'zero-basic',
    'institutions-meals', 'activity-conventions', 'names-places', 'generic-contrast',
    'article-countability-shift', 'article-meaning', 'article-groups'
  ];
  [false, true].forEach((english) => {
    const bundle = sourceVnaCourses.buildArticleCourse(english);
    assert.deepEqual(bundle.course.map((lesson) => lesson.id), requiredIds);
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), [12, 3]);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), [3, 1, 3, 4, 1, 3]);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.rules.length, 0), 48);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.examples.length, 0), 59);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.questions.length, 0), 59);
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.exampleNotes.length, lesson.examples.length);
      assert.ok(lesson.exampleNotes.every((note) => note.visible && (note.body || note.detail)));
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
      lesson.ruleCoverage.forEach((coverage) => {
        assert.ok(coverage.exampleIndexes.length && coverage.questionIndexes.length);
        coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
        coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
      });
      lesson.questions.forEach((question) => assert.ok(question.options.some((option) => option.key === question.answer)));
      if (english) lesson.questions.forEach((question) => {
        assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
        question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
      });
    });
  });
  const zh = sourceVnaCourses.buildArticleCourse(false);
  const essence = zh.course.find((lesson) => lesson.id === 'article-essence');
  assert.ok(essence.rules.some((rule) => rule.includes('听者')));
  const sound = zh.course.find((lesson) => lesson.id === 'a-an');
  ['an hour','a university','an MBA student','a one-year course','a useful book'].forEach((text) => assert.ok(sound.examples.some((example) => example.includes(text))));
  const context = zh.course.find((lesson) => lesson.id === 'the-context-chain');
  assert.ok(context.rules.some((rule) => rule.includes('未必能锁定')));
  const institution = zh.course.find((lesson) => lesson.id === 'institutions-meals');
  assert.ok(institution.rules.some((rule) => rule.includes('英美差异')));
  assert.ok(institution.analyses[0].some((part) => part.text === 'at school.' && part.role === 'predicative'));
  assert.ok(institution.analyses[2].some((part) => part.text === 'in bed.' && part.role === 'predicative'));
  const known = zh.course.find((lesson) => lesson.id === 'the-known');
  assert.ok(known.analyses[1].some((part) => part.text === 'is waiting' && part.role === 'predicate'));
  assert.ok(known.analyses[1].some((part) => part.text === 'outside.' && part.role === 'adverbial'));
  const zero = zh.course.find((lesson) => lesson.id === 'zero-basic');
  assert.ok(zero.analyses[0].some((part) => part.text === 'us' && part.role === 'indirectObject'));
  assert.ok(zero.analyses[0].some((part) => part.text === 'a lot.' && part.role === 'directObject'));
  assert.ok(zero.analyses[2].some((part) => part.text === 'to' && part.role === 'preposition'));
  assert.ok(zero.analyses[2].some((part) => part.text === 'Mia.' && part.role === 'prepObject'));
  const countShift = zh.course.find((lesson) => lesson.id === 'article-countability-shift');
  assert.ok(countShift.analyses[0].some((part) => part.text === 'me' && part.role === 'object'));
  assert.ok(countShift.analyses[0].some((part) => part.text === 'awake.' && part.role === 'objectComplement'));
  const articleQuestionText = zh.course.flatMap((lesson) => lesson.questions.flatMap((question) => question.options.map((option) => option.text))).join(' | ');
  ['in a hospital building only','play piano only','coffee only','The whales is a mammal.'].forEach((bad) => assert.doesNotMatch(articleQuestionText, new RegExp(bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  const names = zh.course.find((lesson) => lesson.id === 'names-places');
  assert.ok(names.rules.some((rule) => rule.includes('错误规则')));
  const generic = zh.course.find((lesson) => lesson.id === 'generic-contrast');
  assert.ok(generic.rules.some((rule) => rule.includes('默认选择')));
  const page = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  assert.match(page, /\['article', 'Articles',[^\n]+, 15\]/);
  assert.match(page, /\['article', '冠词',[^\n]+, 15\]/);
});

test('连词课程从连接本质到并列、从属、边界与平行结构完整闭环', () => {
  const requiredIds = ['conj-essence','conj-and-or','conj-but-so','conj-for-nor-yet','conj-time','conj-reason-condition','conj-concession-purpose','conj-place-manner-comparison','conj-correlative','conj-near-agreement','conj-boundary','conj-punctuation','conj-parallel','conj-integration'];
  [false, true].forEach((english) => {
    const bundle = sourceConjunctionCourses.buildConjunctionCourse(english);
    assert.deepEqual(bundle.course.map((lesson) => lesson.id), requiredIds);
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), [9, 5]);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), [4, 4, 2, 4]);
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.exampleNotes.length, lesson.examples.length);
      assert.ok(lesson.exampleNotes.every((note) => note.visible && (note.body || note.detail)));
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
      lesson.ruleCoverage.forEach((coverage) => {
        coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
        coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
      });
      if (english) lesson.questions.forEach((question) => {
        assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
        question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
      });
    });
  });
  const page = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  assert.match(page, /\['conjunction', '连词',[^\n]+, 14\]/);
  assert.match(page, /\['conjunction', 'Conjunctions',[^\n]+, 14\]/);
});

test('感叹词课程从即时反应本质到语境、语体与词类边界完整闭环', () => {
  const requiredIds = ['interj-essence','interj-independence-position','interj-vs-exclamative','interj-emotions','interj-context-tone','interj-interaction','interj-discourse-markers','interj-punctuation','interj-register-politeness','interj-wordclass-sounds'];
  [false, true].forEach((english) => {
    const bundle = sourceInterjectionCourses.buildInterjectionCourse(english);
    assert.deepEqual(bundle.course.map((lesson) => lesson.id), requiredIds);
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), [8, 2]);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), [3, 2, 2, 2, 1]);
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.exampleNotes.length, lesson.examples.length);
      assert.ok(lesson.exampleNotes.every((note) => note.visible && (note.body || note.detail)));
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
      lesson.ruleCoverage.forEach((coverage) => {
        coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
        coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
      });
      if (english) lesson.questions.forEach((question) => {
        assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
        question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
      });
    });
  });
  const page = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  assert.match(page, /\['interjection', '感叹词',[^\n]+, 10\]/);
  assert.match(page, /\['interjection', 'Interjections',[^\n]+, 10\]/);
});

test('介词系统课程覆盖形式、语义关系、句法功能与易混结构', () => {
  const requiredLessonIds = [
    'prep-essence', 'prep-forms', 'prep-object', 'prep-form-contrast',
    'prep-time', 'prep-time-deadline', 'prep-time-contrast',
    'prep-place', 'prep-relative-place', 'prep-direction', 'prep-movement-path', 'prep-source-separation',
    'prep-means', 'prep-medium-language', 'prep-cause-purpose', 'prep-material-comparison',
    'prep-topic-content', 'prep-adverbial-functions', 'prep-postmodifier', 'prep-predicative',
    'prep-complements', 'prep-collocation', 'prep-collocation-meaning', 'prep-complex-objects', 'prep-integration'
  ];
  [false, true].forEach((english) => {
    const bundle = sourceRelationCourses.buildPrepositionCourse(english);
    const ids = bundle.course.map((lesson) => lesson.id);
    assert.equal(bundle.course.length, 25);
    assert.equal(ids[0], 'prep-essence');
    requiredLessonIds.forEach((id) => assert.ok(ids.includes(id), `missing preposition lesson: ${id}`));
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), [20, 5]);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), [4, 3, 5, 5, 4, 2, 2]);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.rules.length, 0), 82);
    assert.ok(bundle.course.reduce((sum, lesson) => sum + lesson.examples.length, 0) >= 84);
    assert.ok(bundle.course.reduce((sum, lesson) => sum + lesson.questions.length, 0) >= 84);
    bundle.course.forEach((lesson) => {
      assert.ok(lesson.rules.length > 0);
      assert.equal(lesson.exampleNotes.length, lesson.examples.length);
      lesson.exampleNotes.forEach((note) => {
        assert.equal(note.visible, true);
        assert.ok(note.body || note.detail);
      });
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
      lesson.ruleCoverage.forEach((coverage) => {
        assert.ok(coverage.exampleIndexes.length > 0);
        assert.ok(coverage.questionIndexes.length > 0);
        coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
        coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
      });
      lesson.questions.forEach((question) => assert.ok(question.options.some((option) => option.key === question.answer)));
    });
  });
  const page = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  assert.match(page, /\['preposition', 'Prepositions',[^\n]+, 25\]/);
  assert.match(page, /\['preposition', '介词',[^\n]+, 25\]/);
  const zhEssence = sourceRelationCourses.buildPrepositionCourse(false).course.find((lesson) => lesson.id === 'prep-essence');
  assert.deepEqual(zhEssence.exampleNotes.map((note) => note.visible), [true, true, true]);
  assert.match(zhEssence.exampleNotes[1].body, /after.+met.+lunch/);
  assert.match(zhEssence.exampleNotes[2].body, /spoke.+her teacher/);
  assert.ok(zhEssence.rules.length > 0);
  assert.match(zhEssence.rules[0], /after.+met.+lunch/);
  assert.ok(zhEssence.rules.some((rule) => rule.includes('参照对象')));
  assert.ok(zhEssence.exampleNotes.filter((note) => note.visible).every((note) => note.title === ''));
  assert.notEqual(zhEssence.hideRuleCard, true);
  const enEssence = sourceRelationCourses.buildPrepositionCourse(true).course.find((lesson) => lesson.id === 'prep-essence');
  assert.deepEqual(enEssence.exampleNotes.map((note) => note.visible), [true, true, true]);
  assert.deepEqual(sourceRelationCourses.buildPrepositionCourse(false).course.filter((lesson) => lesson.narration).map((lesson) => lesson.id), ['prep-essence']);
  assert.equal(zhEssence.narration.id, 'preposition:prep-essence');
  assert.equal(zhEssence.narration.version, 'v6');
  assert.equal(enEssence.narration.version, 'v1');
  assert.equal(Array.from(zhEssence.narration.text.replace(/\s/g, '')).length, 500);
  assert.doesNotMatch(zhEssence.narration.text, /同学们|这节课|先看第一句|再看第二句/);
  assert.equal((zhEssence.narration.text.match(/<#0\.[78]#>/g) || []).length, 4);
  assert.match(zhEssence.narration.text, /主干是 She spoke，也就是“她说话”。<#0\.6#>介词是 with/);
  assert.doesNotMatch(zhEssence.narration.text, /在……上|在……之后|和……一起/);
  assert.equal(enEssence.narration.text.trim().split(/\s+/).length, 264);
  assert.equal(prepositionCourses.buildPrepositionCourse(false).course[0].narration.text, zhEssence.narration.text);
  const zhRelationChoice = sourceRelationCourses.buildPrepositionCourse(false).course.find((lesson) => lesson.id === 'prep-collocation');
  assert.ok(zhRelationChoice.rules.some((rule) => rule.includes('to 常把动作或事物指向目标')));
  assert.ok(zhRelationChoice.rules.some((rule) => rule.includes('语言习惯')));
  assert.ok(`${zhRelationChoice.exampleNotes[2].body} ${zhRelationChoice.exampleNotes[2].detail}`.includes('指向并对应'));
  assert.ok(!zhRelationChoice.rules.some((rule) => rule.includes('固定搭配')));
  const lessonTemplate = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxml'), 'utf8');
  assert.match(lessonTemplate, /wx:if="\{\{!activeLesson\.hideRuleCard\}\}"/);
  assert.match(lessonTemplate, /bindtap="rewindNarration"/);
  assert.match(lessonTemplate, /bindtap="forwardNarration"/);
  assert.equal((lessonTemplate.match(/narration-seek-value">15/g) || []).length, 2);
  assert.doesNotMatch(lessonTemplate, /10s|↶|↷/);
  assert.match(lessonTemplate, /bindtap="replayNarration"/);
  assert.match(lessonTemplate, /bindchange="seekNarration"/);
  assert.doesNotMatch(lessonTemplate, /<button class="narration-/);
  assert.match(lessonTemplate, /<view class="narration-button/);
  const classroomStyle = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxss'), 'utf8');
  assert.match(classroomStyle, /\.narration-controls \{[^}]*display: grid;[^}]*grid-template-columns: 124rpx minmax\(0, 1fr\) 124rpx/);
  assert.match(classroomStyle, /\.narration-replay \{[^}]*grid-column: 1 \/ 4/);
  assert.match(page, /narrationPlaying\)[\s\S]*\.pause\(\)[\s\S]*return/);
  ['seekNarrationTo', 'rewindNarration', 'forwardNarration', 'replayNarration', 'previewNarrationSeek'].forEach((method) => assert.match(page, new RegExp(`${method}\\(`)));
  const storeSource = fs.readFileSync(path.join(__dirname, '../utils/store.js'), 'utf8');
  const cloudIndex = fs.readFileSync(path.join(__dirname, '../cloudfunctions/yoyo/index.js'), 'utf8');
  const cloudClient = fs.readFileSync(path.join(__dirname, '../domain/cloud/index.js'), 'utf8');
  const grammarService = fs.readFileSync(path.join(__dirname, '../cloudfunctions/yoyo/services/grammar.service.js'), 'utf8');
  assert.match(storeSource, /getGrammarNarrationAudio/);
  assert.match(cloudIndex, /getGrammarNarrationAudio/);
  assert.match(cloudClient, /gradeWritingAttempt' \|\| action === 'getGrammarNarrationAudio'\)[\s\S]*timeoutMs = 180000/);
  assert.match(grammarService, /grammarLessonNarrationAudios/);
  assert.match(grammarService, /getCachedNarrationAudio/);
  assert.match(grammarService, /runTransaction/);
  assert.match(grammarService, /status: 'generating'/);
  assert.match(grammarService, /status: 'ready'/);
  assert.match(page, /result && result\.generating[\s\S]*setTimeout\(requestAudio, retryAfterMs\)/);
});

test('语法微课堂按体系分层并逐层返回', () => {
  const source = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  const context = { captured: null, Page: (config) => { context.captured = config; }, wx: {}, require: () => ({}), setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(`${source};englishUi=uiText(true);`, context);
  const page = context.captured;
  assert.equal(page.data.screen, 'system');
  assert.deepEqual(Array.from(page.data.ui.domains, (item) => item.id), ['morphology', 'syntax', 'clauses', 'discourse']);
  assert.deepEqual(Array.from(context.englishUi.domains, (item) => item.id), ['morphology', 'syntax', 'clauses', 'discourse']);
  assert.ok(page.data.ui.domainMaps.morphology.some((item) => item.id === 'parts-of-speech' && item.ready));
  assert.ok(page.data.ui.domainMaps.morphology.some((item) => item.id === 'word-formation' && item.ready && /18/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.syntax.some((item) => item.id === 'sentence-elements' && item.ready && /23/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.syntax.some((item) => item.id === 'basic-patterns' && item.ready && /16/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.syntax.some((item) => item.id === 'predicate-system' && item.ready && /20/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.syntax.some((item) => item.id === 'nonfinite-system' && item.ready && /19/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.syntax.some((item) => item.id === 'special-structures' && item.ready && /28/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.clauses.some((item) => item.id === 'coordination' && item.ready && /22/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.clauses.some((item) => item.id === 'noun-clauses' && item.ready && /22/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.clauses.some((item) => item.id === 'relative-clauses' && item.ready && /21/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.clauses.some((item) => item.id === 'adverbial-clauses' && item.ready && /20/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.clauses.some((item) => item.id === 'reported-speech' && item.ready && /21/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.discourse.some((item) => item.id === 'cohesion-reference' && item.ready && /22/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.discourse.some((item) => item.id === 'information-order' && item.ready && /22/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.discourse.some((item) => item.id === 'punctuation' && item.ready && /21/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.discourse.some((item) => item.id === 'common-expression' && item.ready && /21/.test(item.status)));
  assert.match(source, /handleTopBack\(\)[\s\S]*screen === 'lesson'[\s\S]*screen === 'course-map'[\s\S]*screen === 'directory'[\s\S]*screen === 'domain-map'/);
  const wxml = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxml'), 'utf8');
  assert.match(wxml, /bindtap="handleTopBack"/);
  assert.match(wxml, /bindtap="backToSystem"/);
  assert.match(wxml, /bindtap="backToDomainMap"/);
  assert.match(wxml, /bindtap="backFromCourseMap"/);
  assert.match(wxml, /bindtap="backToCourseMap"/);
  assert.match(wxml, /grammar-sentence-elements-loader/);
  assert.match(wxml, /grammar-basic-patterns-loader/);
  assert.match(wxml, /grammar-predicate-system-loader/);
  assert.match(wxml, /grammar-nonfinite-system-loader/);
  assert.match(wxml, /grammar-special-structures-loader/);
  assert.match(wxml, /grammar-coordination-loader/);
  assert.match(wxml, /grammar-noun-clauses-loader/);
  assert.match(wxml, /grammar-relative-clauses-loader/);
  assert.match(wxml, /grammar-adverbial-clauses-loader/);
  assert.match(wxml, /grammar-reported-speech-loader/);
  assert.match(wxml, /grammar-cohesion-reference-loader/);
  assert.match(wxml, /grammar-information-order-loader/);
  assert.match(wxml, /grammar-punctuation-loader/);
  assert.match(wxml, /grammar-common-expression-loader/);
  assert.match(wxml, /domainBackText/);
});

test('句子成分课程完整覆盖成分边界、核心成分、修饰语和复杂层级', () => {
  const requiredIds = ['element-levels','subject','predicate-boundary','direct-object','indirect-object','preposition-object','predicative','object-complement','attributes','adverbial-time-place-frequency','adverbial-manner-degree','adverbial-cause-purpose-result','adverbial-condition-concession-comment','apposition','dummy-it-subject','dummy-it-object','existential-there','subject-complement-passive','nonfinite-elements','clauses-as-elements','coordination-sharing-ellipsis','nested-analysis','integrated-analysis'];
  [false, true].forEach((english) => {
    const bundle = sourceSentenceElementsCourses.buildSentenceElementsCourse(english);
    assert.deepEqual(bundle.course.map((lesson) => lesson.id), requiredIds);
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), [17, 6]);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), [3, 5, 5, 4, 1, 2, 3]);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.rules.length, 0), 69);
    assert.match(bundle.course[0].title, english ? /Definition and core/ : /定义与本质/);
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.rules.length, lesson.examples.length);
      assert.equal(lesson.rules.length, lesson.questions.length);
      assert.equal(lesson.analyses.length, lesson.examples.length);
      assert.equal(lesson.exampleNotes.length, lesson.examples.length);
      assert.ok(lesson.exampleNotes.every((note) => note.visible && (note.body || note.detail)));
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
      lesson.ruleCoverage.forEach((coverage) => {
        assert.ok(coverage.exampleIndexes.length && coverage.questionIndexes.length);
        coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
        coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
      });
      if (english) lesson.questions.forEach((question) => {
        assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
        question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
      });
    });
  });
});

test('基本句型课程完整覆盖五大句型、存在句、转换和判型边界', () => {
  const requiredIds = ['find-predicate-skeleton','pattern-sv','pattern-svc','pattern-svo','pattern-svoo','pattern-svoc','existential-there-be','obligatory-adverbial','linking-transitivity','svoo-vs-svoc','modifiers-preserve-skeleton','transformations-skeleton','one-verb-many-patterns','coordination-sharing','integrated-pattern-choice','pattern-boundaries'];
  [false, true].forEach((english) => {
    const bundle = sourceBasicSentencePatternsCourses.buildBasicSentencePatternsCourse(english);
    assert.deepEqual(bundle.course.map((lesson) => lesson.id), requiredIds);
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), [11, 5]);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), [2, 5, 2, 2, 3, 2]);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.rules.length, 0), 48);
    assert.match(bundle.course[0].title, english ? /core of basic patterns/ : /基本句型的本质/);
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.rules.length, lesson.examples.length);
      assert.equal(lesson.rules.length, lesson.questions.length);
      assert.equal(lesson.analyses.length, lesson.examples.length);
      assert.equal(lesson.exampleNotes.length, lesson.examples.length);
      assert.ok(lesson.exampleNotes.every((note) => note.visible && (note.body || note.detail)));
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
      lesson.ruleCoverage.forEach((coverage) => {
        assert.ok(coverage.exampleIndexes.length && coverage.questionIndexes.length);
        coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
        coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
      });
      if (english) lesson.questions.forEach((question) => {
        assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
        question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
      });
    });
  });
  const english = sourceBasicSentencePatternsCourses.buildBasicSentencePatternsCourse(true);
  const svo = english.course.find((lesson) => lesson.id === 'pattern-svo');
  assert.ok(svo.examples.some((example) => /understood the question/.test(example)));
  assert.ok(!svo.examples.some((example) => /looked at/.test(example)));
});

test('谓语、非谓语与特殊句式课程完整覆盖各自知识边界', () => {
  const specs = [
    {
      build: sourcePredicateSystemCourses.buildPredicateSystemCourse,
      count: 20, groups: [15, 5], sections: [3, 3, 5, 4, 3, 2], total: 60,
      titleZh: /定义与限定核心/, titleEn: /Definition and finite core/,
      required: ['finite-boundary','auxiliary-chain','operator','agreement-basic','agreement-head','agreement-proximity-meaning','tense-viewpoint','simple-progressive','perfect-system','past-sequence','future-system','voice-focus','passive-chain','modal-system','semi-modal-system','negation-questions','emphatic-do','short-answers-substitution','predicate-sharing-ellipsis','predicate-integration']
    },
    {
      build: sourceNonfiniteSystemCourses.buildNonfiniteSystemCourse,
      count: 19, groups: [13, 6], sections: [4, 4, 4, 3, 2, 2], total: 69,
      titleZh: /定义与本质/, titleEn: /Definition and core/,
      required: ['finite-nonfinite-boundary','infinitive-forms','infinitive-subject-predicative','infinitive-object-attribute-complement','infinitive-adverbials','bare-infinitive','gerund-form-logical-subject','gerund-functions','participle-voice-time','participle-attribute-predicative','participle-adverbials','participle-object-complements','verb-complement-patterns','doing-to-do-meaning','perception-causative','absolute-with-construction','dangling-modifiers','nonfinite-clause-conversion','nonfinite-integrated']
    },
    {
      build: sourceSpecialStructuresCourses.buildSpecialStructuresCourse,
      count: 28, groups: [14, 14], sections: [4, 2, 5, 4, 4, 5, 3, 1], total: 84,
      titleZh: /定义与本质/, titleEn: /Definition and core/,
      required: ['special-structure-essence','imperative-affirmative','imperative-negative','imperative-let','exclamation-what','exclamation-how','question-yes-no','question-wh','question-alternative','question-tag-basic','question-tag-special','inversion-foundation','inversion-negative','inversion-only-so-neither','inversion-full-locative','emphasis-do','emphasis-it-cleft','emphasis-wh-cleft','focus-fronting','ellipsis-coordination','ellipsis-adverbial','ellipsis-infinitive','substitution-one-ones','substitution-do-so-not','parentheticals','subjunctive-wish','subjunctive-suggestion','integrated-special-structures']
    }
  ];
  specs.forEach((spec) => [false, true].forEach((english) => {
    const bundle = spec.build(english);
    assert.equal(bundle.course.length, spec.count);
    spec.required.forEach((id) => assert.ok(bundle.course.some((lesson) => lesson.id === id), `missing syntax lesson: ${id}`));
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), spec.groups);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), spec.sections);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.rules.length, 0), spec.total);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.examples.length, 0), spec.total);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.questions.length, 0), spec.total);
    if (spec.titleZh) assert.match(bundle.course[0].title, english ? spec.titleEn : spec.titleZh);
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.analyses.length, lesson.examples.length);
      assert.equal(lesson.exampleNotes.length, lesson.examples.length);
      assert.ok(lesson.exampleNotes.every((note) => note.visible && (note.body || note.detail)));
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
      lesson.ruleCoverage.forEach((coverage) => {
        assert.ok(coverage.exampleIndexes.length && coverage.questionIndexes.length);
        coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
        coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
      });
      if (english) lesson.questions.forEach((question) => {
        assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
        question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
      });
    });
  }));
  const wxss = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxss'), 'utf8');
  ['operator','marker','negator','infinitive','gerund','presentParticiple','pastParticiple','focus','parenthetical','omitted'].forEach((role) => assert.match(wxss, new RegExp(`role-${role}`)));
});

test('并列句与名词性从句课程完整覆盖连接、标点、语序和句法功能', () => {
  const specs = [
    {
      build: sourceCoordinationCourses.buildCoordinationCourse,
      count: 22, groups: [17, 5], sections: [7, 3, 3, 5, 4], total: 66,
      required: ['coordination-boundary','coordination-subordination','and-relations','but-yet','or-relations','so-for','nor-coordination','imperative-and-or','correlative-basic','not-only','comma-coordinator','semicolon-coordination','conjunctive-adverbs','parallel-structure','correlative-parallelism','shared-elements','coordination-ellipsis','coordination-agreement','comma-splice-runon','coordination-fragments','semantic-choice','coordination-rewrite']
    },
    {
      build: sourceNounClausesCourses.buildNounClausesCourse,
      count: 22, groups: [16, 6], sections: [3, 4, 3, 4, 3, 4, 1], total: 74,
      required: ['clause-as-noun-slot','connector-system','declarative-order','subject-clauses','dummy-it-subject','object-clauses','dummy-it-object','predicative-clauses','appositive-clauses','preposition-noun-clauses','that-omission','whether-if-boundaries','connector-pronouns','connector-adverbs','what-vs-that','appositive-vs-relative','tense-sequence-facts','negative-raising','subject-clause-agreement','wh-ever-nominal','reported-speech-boundary','noun-clause-integration']
    }
  ];
  specs.forEach((spec) => [false, true].forEach((english) => {
    const bundle = spec.build(english);
    assert.equal(bundle.course.length, spec.count);
    spec.required.forEach((id) => assert.ok(bundle.course.some((lesson) => lesson.id === id), `missing clause lesson: ${id}`));
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), spec.groups);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), spec.sections);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.rules.length, 0), spec.total);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.examples.length, 0), spec.total);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.questions.length, 0), spec.total);
    if (spec.build === sourceCoordinationCourses.buildCoordinationCourse || spec.build === sourceNounClausesCourses.buildNounClausesCourse) {
      assert.match(bundle.course[0].title, english ? /Definition.*core/ : /定义.*本质/);
    }
    bundle.course.forEach((lesson) => lesson.questions.forEach((question) => {
      assert.ok(question.options.some((option) => option.key === question.answer));
      if (english) {
        assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
        question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
      }
    }));
    if (spec.build === sourceCoordinationCourses.buildCoordinationCourse || spec.build === sourceNounClausesCourses.buildNounClausesCourse) {
      bundle.course.forEach((lesson) => {
        assert.equal(lesson.analyses.length, lesson.examples.length);
        assert.equal(lesson.exampleNotes.length, lesson.examples.length);
        assert.ok(lesson.exampleNotes.every((note) => note.visible && (note.body || note.detail)));
        assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
        lesson.ruleCoverage.forEach((coverage) => {
          assert.ok(coverage.exampleIndexes.length && coverage.questionIndexes.length);
          coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
          coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
        });
      });
      assert.deepEqual(bundle.sections.flatMap((section) => section.lessonIds), bundle.course.map((lesson) => lesson.id));
    }
  }));
  const coordination = sourceCoordinationCourses.buildCoordinationCourse(false);
  assert.ok(coordination.course.flatMap((lesson) => lesson.analyses).flat().some((part) => part.role === 'predicative'));
  const nounClauses = sourceNounClausesCourses.buildNounClausesCourse(false);
  assert.equal(nounClauses.course.find((lesson) => lesson.id === 'what-vs-that').level, 'core');
  assert.equal(nounClauses.course.find((lesson) => lesson.id === 'subject-clause-agreement').level, 'core');
  ['indirectObject','directObject','prepObject','dummySubject','dummyObject'].forEach((role) => {
    assert.ok(nounClauses.course.flatMap((lesson) => lesson.analyses).flat().some((part) => part.role === role));
  });
  const wxss = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxss'), 'utf8');
  ['coordinand','nounClause','dummySubject','dummyObject'].forEach((role) => assert.match(wxss, new RegExp(`role-${role}`)));
});

test('定语从句、状语从句与直接间接引语完整覆盖关系、逻辑和转述变化', () => {
  const specs = [
    {
      build: sourceRelativeClausesCourses.buildRelativeClausesCourse,
      count: 21, groups: [16, 5], sections: [2, 5, 5, 3, 3, 3], total: 66,
      required: ['relative-boundary','relative-internal-role','who-whom','whose','which','that-relative','object-relative-omission','relative-when','relative-where','relative-why','preposition-relative','relative-way','restrictive-relative','nonrestrictive-relative','that-constraints','sentential-as-which','what-boundary','relative-agreement','reduced-relatives','relative-nesting-ambiguity','relative-integration']
    },
    {
      build: sourceAdverbialClausesCourses.buildAdverbialClausesCourse,
      count: 20, groups: [14, 6], sections: [1, 4, 1, 1, 1, 1, 2, 2, 1, 1, 3, 2], total: 68,
      required: ['adverbial-function-position','time-when-while-as','time-before-after','time-until-since','time-immediate-once','place-where-wherever','reason-because-since-as','purpose-clauses','result-so-such','condition-if','condition-unless-provided','concession-although-even','concession-while-no-matter','comparison-clauses','manner-as-as-if','future-present-rule','tense-relations','paired-conjunction-boundaries','ellipsis-participle','adverbial-integration']
    },
    {
      build: sourceReportedSpeechCourses.buildReportedSpeechCourse,
      count: 21, groups: [16, 5], sections: [5, 5, 3, 1, 2, 2, 3], total: 65,
      required: ['reported-speech-essence','direct-form-punctuation','reported-form-foundation','statements-that','say-tell-verbs','yes-no-questions','wh-questions','commands-requests','advice-suggestion','exclamations-responses','backshift-present','backshift-past-future','modal-changes','no-backshift-boundaries','person-possessive','deictic-time-place','reporting-clause-position','indirect-to-direct','layered-reporting','ambiguity-boundaries','integrated-rewrite']
    }
  ];
  specs.forEach((spec) => [false, true].forEach((english) => {
    const bundle = spec.build(english);
    assert.equal(bundle.course.length, spec.count);
    spec.required.forEach((id) => assert.ok(bundle.course.some((lesson) => lesson.id === id), `missing clause lesson: ${id}`));
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), spec.groups);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), spec.sections);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.rules.length, 0), spec.total);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.examples.length, 0), spec.total);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.questions.length, 0), spec.total);
    assert.match(bundle.course[0].title, english ? /Definition.*core/ : /定义.*本质/);
    assert.deepEqual(bundle.sections.flatMap((section) => section.lessonIds), bundle.course.map((lesson) => lesson.id));
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.analyses.length, lesson.examples.length);
      assert.equal(lesson.exampleNotes.length, lesson.examples.length);
      assert.ok(lesson.exampleNotes.every((note) => note.visible && (note.body || note.detail)));
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
      lesson.ruleCoverage.forEach((coverage) => {
        assert.ok(coverage.exampleIndexes.length && coverage.questionIndexes.length);
        coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
        coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
      });
    });
    bundle.course.forEach((lesson) => lesson.questions.forEach((question) => {
      assert.ok(question.options.some((option) => option.key === question.answer));
      if (english) {
        assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
        question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
      }
    }));
  }));
  const relativeClauses = sourceRelativeClausesCourses.buildRelativeClausesCourse(false);
  assert.equal(relativeClauses.course.find((lesson) => lesson.id === 'relative-way').level, 'core');
  assert.ok(relativeClauses.course.flatMap((lesson) => lesson.analyses).flat().some((part) => part.outerRole === 'postmodifier'));
  assert.ok(relativeClauses.course.flatMap((lesson) => lesson.analyses).flat().some((part) => /介词.*宾语/.test(part.relationRole || '')));
  const adverbialClauses = sourceAdverbialClausesCourses.buildAdverbialClausesCourse(false);
  assert.deepEqual(new Set(adverbialClauses.course.flatMap((lesson) => lesson.questions.map((question) => question.answer))), new Set(['A','B']));
  assert.ok(adverbialClauses.course.find((lesson) => lesson.id === 'concession-although-even').rules.some((rule) => /even though.+even if/.test(rule)));
  assert.ok(adverbialClauses.course.find((lesson) => lesson.id === 'future-present-rule').rules.some((rule) => /will.+意愿/.test(rule)));
  const reported = sourceReportedSpeechCourses.buildReportedSpeechCourse(false);
  assert.deepEqual(new Set(reported.course.flatMap((lesson) => lesson.questions.map((question) => question.answer))), new Set(['A','B']));
  assert.ok(reported.course.every((lesson) => lesson.analyses.every((analysis) => analysis.every((part) => part.role !== 'complement' && part.label !== '补足成分'))));
  const suggestion = reported.course.find((lesson) => lesson.id === 'advice-suggestion');
  assert.ok(suggestion.rules.some((rule) => /suggest.+doing/.test(rule)));
  assert.ok(suggestion.rules.some((rule) => /suggest.+that/.test(rule)));
  assert.ok(suggestion.rules.some((rule) => /suggest sb to do/.test(rule)));
  const wxss = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxss'), 'utf8');
  ['antecedent','relative','adverbialClause','quote','reported','reporting'].forEach((role) => assert.match(wxss, new RegExp(`role-${role}`)));
});

test('表达与标点课程完整覆盖衔接、信息顺序、书写规范和中英转换', () => {
  const specs = [
    {
      build: sourceCohesionReferenceCourses.buildCohesionReferenceCourse,
      count: 22, groups: [19, 3], sections: [7, 2, 4, 2, 4, 2, 1], total: 66,
      required: ['cohesion-reference-essence','personal-reference-chain','possessive-reference','forward-reference','reference-agreement','reference-clarity','discourse-this-that','these-those-reference','one-ones-substitution','do-substitution','so-not-substitution','ellipsis-substitution-boundary','keyword-repetition','lexical-relations','basic-logical-connectors','conjunctive-adverb-punctuation','sequence-connectors','example-summary-connectors','articles-given-new','paragraph-topic-chain','reference-distance','cohesion-integration']
    },
    {
      build: sourceInformationOrderCourses.buildInformationOrderCourse,
      count: 22, groups: [17, 5], sections: [4, 3, 4, 2, 3, 3, 3], total: 70,
      required: ['information-order-essence','skeleton-vs-topic','given-new-flow','end-weight-short-long','dummy-subject','dummy-object','existential-new-information','basic-adverbial-position','frequency-adverbs','multiple-adverbials','modifier-order','double-object-order','passive-focus','fronting-boundary','inversion-focus','cleft-focus','focus-particles','negation-scope','scope-ambiguity','paragraph-progression','avoid-chinglish','information-rewrite']
    },
    {
      build: sourcePunctuationCourses.buildPunctuationCourse,
      count: 21, groups: [17, 4], sections: [4, 5, 3, 3, 2, 3, 1], total: 63,
      required: ['punctuation-capitalization-essence','terminal-marks','fragments','run-ons-comma-splices','comma-coordination','comma-adverbial','comma-nonrestrictive','comma-apposition-parenthetical','comma-lists','semicolon','colon','dash-parentheses','apostrophe-possession','apostrophe-contractions','quotation-punctuation','hyphens','capitalization-basics','capitalization-dates-titles','numbers-abbreviations','quote-style-boundary','integrated-proofreading']
    },
    {
      build: sourceCommonExpressionCourses.buildCommonExpressionCourse,
      count: 21, groups: [18, 3], sections: [5, 4, 3, 2, 3, 4], total: 63,
      required: ['common-expression-essence','explicit-subject','topic-to-subject','inanimate-subject','people-general-subject','be-not-shi','verb-centred-expression','light-verb-collocations','possession-existence','time-age-duration','quantity-countability','double-object-order','attribute-order-expression','adverbial-order-expression','cause-result-expression','contrast-concession-expression','negation-scope-expression','question-order-expression','active-passive-choice','nominalization-concision','integrated-expression']
    }
  ];
  specs.forEach((spec) => [false, true].forEach((english) => {
    const bundle = spec.build(english);
    assert.equal(bundle.course.length, spec.count);
    spec.required.forEach((id) => assert.ok(bundle.course.some((lesson) => lesson.id === id), `missing discourse lesson: ${id}`));
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), spec.groups);
    assert.deepEqual(bundle.sections.map((section) => section.lessonCount), spec.sections);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.rules.length, 0), spec.total);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.examples.length, 0), spec.total);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.questions.length, 0), spec.total);
    if (spec.build === sourceCohesionReferenceCourses.buildCohesionReferenceCourse || spec.build === sourceInformationOrderCourses.buildInformationOrderCourse || spec.build === sourcePunctuationCourses.buildPunctuationCourse || spec.build === sourceCommonExpressionCourses.buildCommonExpressionCourse) {
      assert.match(bundle.course[0].title, english ? /Definition.*core/ : /定义.*本质/);
      assert.deepEqual(bundle.sections.flatMap((section) => section.lessonIds), bundle.course.map((lesson) => lesson.id));
      bundle.course.forEach((lesson) => {
        assert.equal(lesson.analyses.length, lesson.examples.length);
        assert.equal(lesson.exampleNotes.length, lesson.examples.length);
        assert.ok(lesson.exampleNotes.every((note) => note.visible && (note.body || note.detail)));
        assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
        lesson.ruleCoverage.forEach((coverage) => {
          assert.ok(coverage.exampleIndexes.length && coverage.questionIndexes.length);
          coverage.exampleIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.examples.length));
          coverage.questionIndexes.forEach((index) => assert.ok(index >= 0 && index < lesson.questions.length));
        });
      });
      assert.deepEqual(new Set(bundle.course.flatMap((lesson) => lesson.questions.map((question) => question.answer))), new Set(['A','B']));
    }
    bundle.course.forEach((lesson) => lesson.questions.forEach((question) => {
      assert.ok(question.options.some((option) => option.key === question.answer));
      if (english) {
        assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
        question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
      }
    }));
  }));
  const cohesion = sourceCohesionReferenceCourses.buildCohesionReferenceCourse(false);
  cohesion.course.forEach((lesson) => lesson.analyses.forEach((analysis) => {
    assert.ok(analysis.some((part) => part.role === 'subject'));
    assert.ok(analysis.some((part) => part.role === 'predicate'));
  }));
  const informationOrder = sourceInformationOrderCourses.buildInformationOrderCourse(false);
  const conditionalInversion = informationOrder.course.find((lesson) => lesson.id === 'inversion-focus').analyses.flat();
  ['auxiliary','subject','predicate'].forEach((role) => assert.ok(conditionalInversion.some((part) => part.role === role)));
  const punctuation = sourcePunctuationCourses.buildPunctuationCourse(false);
  assert.ok(punctuation.course[0].rules.some((rule) => /句子边界、分句关系和信息层级/.test(rule)));
  assert.ok(punctuation.course.find((lesson) => lesson.id === 'quote-style-boundary').rules.some((rule) => /英式|美式/.test(rule)));
  assert.ok(punctuation.course.every((lesson) => lesson.title.indexOf('擇号') < 0 && lesson.rules.every((rule) => rule.indexOf('擇号') < 0)));
  const commonExpression = sourceCommonExpressionCourses.buildCommonExpressionCourse(false);
  ['dummySubject','indirectObject','directObject','preposition','prepObject','predicative'].forEach((role) => {
    assert.ok(commonExpression.course.flatMap((lesson) => lesson.analyses).flat().some((part) => part.role === role));
  });
  assert.ok(commonExpression.course.find((lesson) => lesson.id === 'attribute-order-expression').exampleNotes.some((note) => note.mode === 'translation'));
  const wxss = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxss'), 'utf8');
  ['reference','forward','given','new','connector','ellipsis','keyword','lexical','substitute','topic'].forEach((role) => assert.match(wxss, new RegExp(`role-${role}`)));
});

test('课程按知识关系分层且核心进阶只作为难度标签', () => {
  [false, true].forEach((english) => {
    Object.values(allSectionBuilders).forEach((build) => {
      const bundle = build(english);
      const lessonIds = bundle.course.map((lesson) => lesson.id);
      const sectionIds = bundle.sections.flatMap((section) => section.lessonIds);
      assert.ok(bundle.sections.length > 0);
      bundle.sections.forEach((section) => {
        assert.ok(section.id && section.title && section.copy);
        assert.equal(section.lessonCount, section.lessonIds.length);
      });
      assert.equal(new Set(sectionIds).size, sectionIds.length);
      assert.deepEqual(new Set(sectionIds), new Set(lessonIds));
    });
  });
  assert.equal(sourceVnaCourses.buildVerbCourse(false).sections.length, 6);
  assert.equal(sourceWordFormationCourses.buildWordFormationCourse(false).sections.length, 5);
  const page = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxml'), 'utf8');
  assert.match(page, /const hasSectionMap = sections\.length > 1/);
  assert.doesNotMatch(page, /course\.length <= 5/);
  assert.match(wxml, /screen === 'section-map'/);
  assert.match(wxml, /bindtap="openSection"/);
  assert.match(wxml, /bindtap="backFromSectionMap"/);
  assert.match(wxml, /level-\{\{lesson\.level\}\}/);
  assert.match(wxml, /\{\{lessonPosition\}\} \/ \{\{course\.length\}\}/);
  const verbTenseSection = sourceVnaCourses.buildVerbCourse(false).sections.find((section) => section.id === 'tense-aspect');
  assert.equal(verbTenseSection.title, '动作的时间与状态');
  assert.match(verbTenseSection.copy, /时态看.+时间.+体看.+状态/);
});

test('构词法课程系统覆盖且逐条闭环', () => {
  const requiredLessonIds = [
    'word-parts', 'derivation-inflection', 'negative-prefixes', 'meaning-prefixes',
    'person-noun-suffixes', 'abstract-noun-suffixes', 'adjective-suffixes',
    'participial-adjectives', 'adverb-suffix', 'verb-suffixes', 'conversion', 'compounds',
    'word-class-slots', 'prefix-assimilation', 'suffix-spelling', 'suffix-sound-stress',
    'layered-derivation', 'word-inference'
  ];
  [false, true].forEach((english) => {
    const bundle = sourceWordFormationCourses.buildWordFormationCourse(english);
    const ids = bundle.course.map((lesson) => lesson.id);
    assert.deepEqual(ids, requiredLessonIds);
    assert.deepEqual(bundle.groups.map((group) => group.lessons.length), [13, 5]);
    assert.deepEqual(bundle.groups.flatMap((group) => group.lessons.map((lesson) => lesson.id)), ids);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.rules.length, 0), 61);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.examples.length, 0), 61);
    assert.equal(bundle.course.reduce((sum, lesson) => sum + lesson.questions.length, 0), 61);
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.exampleNotes.length, lesson.examples.length);
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
      lesson.ruleCoverage.forEach((coverage, index) => {
        assert.deepEqual(coverage.exampleIndexes, [index]);
        assert.deepEqual(coverage.questionIndexes, [index]);
      });
      lesson.questions.forEach((question) => {
        assert.ok(question.options.some((option) => option.key === question.answer));
        if (english) {
          assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
          question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
        }
      });
    });
  });
  const classroomPage = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  const loader = fs.readFileSync(path.join(__dirname, '../grammar-package/components/grammar-word-formation-loader/index.js'), 'utf8');
  assert.match(classroomPage, /item === 'word-formation'[\s\S]*return this\.loadCourse\(item\)/);
  assert.match(classroomPage, /selectedTopic === 'word-formation'[\s\S]*return this\.backToDomainMap\(\)/);
  assert.match(loader, /require\('\.\.\/\.\.\/domain\/grammar-classroom\/word-formation-courses'\)/);
});
