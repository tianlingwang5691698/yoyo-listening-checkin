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
  const vnaLoader = fs.readFileSync(path.join(__dirname, '../grammar-package/components/grammar-vna-loader/index.js'), 'utf8');
  assert.doesNotMatch(vnaLoader, /third-person-course/);
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
  const files = ['word-courses', 'word-formation-courses', 'verb-numeral-article-courses', 'adjective-adverb-courses', 'preposition-conjunction-interjection-courses', 'sentence-elements-courses', 'basic-sentence-patterns-courses', 'predicate-system-courses', 'nonfinite-system-courses', 'special-structures-courses', 'coordination-courses', 'noun-clauses-courses', 'relative-clauses-courses', 'adverbial-clauses-courses', 'reported-speech-courses', 'cohesion-reference-courses', 'information-order-courses', 'punctuation-courses', 'common-expression-courses'];
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
    assert.ok(bundle.course.reduce((sum, lesson) => sum + lesson.rules.length, 0) >= 81);
    assert.ok(bundle.course.reduce((sum, lesson) => sum + lesson.examples.length, 0) >= 84);
    assert.ok(bundle.course.reduce((sum, lesson) => sum + lesson.questions.length, 0) >= 84);
    bundle.course.forEach((lesson) => {
      assert.ok(lesson.rules.length > 0);
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
});

test('语法课堂按体系分层并逐层返回', () => {
  const source = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.js'), 'utf8');
  const context = { captured: null, Page: (config) => { context.captured = config; }, wx: {}, setTimeout, clearTimeout };
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
  assert.ok(page.data.ui.domainMaps.syntax.some((item) => item.id === 'special-structures' && item.ready && /27/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.clauses.some((item) => item.id === 'coordination' && item.ready && /22/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.clauses.some((item) => item.id === 'noun-clauses' && item.ready && /22/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.clauses.some((item) => item.id === 'relative-clauses' && item.ready && /20/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.clauses.some((item) => item.id === 'adverbial-clauses' && item.ready && /20/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.clauses.some((item) => item.id === 'reported-speech' && item.ready && /20/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.discourse.some((item) => item.id === 'cohesion-reference' && item.ready && /21/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.discourse.some((item) => item.id === 'information-order' && item.ready && /20/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.discourse.some((item) => item.id === 'punctuation' && item.ready && /20/.test(item.status)));
  assert.ok(page.data.ui.domainMaps.discourse.some((item) => item.id === 'common-expression' && item.ready && /20/.test(item.status)));
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
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.rules.length, lesson.examples.length);
      assert.equal(lesson.rules.length, lesson.questions.length);
      assert.equal(lesson.analyses.length, lesson.examples.length);
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
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.rules.length, lesson.examples.length);
      assert.equal(lesson.rules.length, lesson.questions.length);
      assert.equal(lesson.analyses.length, lesson.examples.length);
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
      required: ['finite-boundary','auxiliary-chain','operator','agreement-basic','agreement-head','agreement-proximity-meaning','tense-viewpoint','simple-progressive','perfect-system','past-sequence','future-system','voice-focus','passive-chain','modal-system','semi-modal-system','negation-questions','emphatic-do','short-answers-substitution','predicate-sharing-ellipsis','predicate-integration']
    },
    {
      build: sourceNonfiniteSystemCourses.buildNonfiniteSystemCourse,
      count: 19, groups: [13, 6], sections: [4, 4, 4, 3, 2, 2], total: 69,
      required: ['finite-nonfinite-boundary','infinitive-forms','infinitive-subject-predicative','infinitive-object-attribute-complement','infinitive-adverbials','bare-infinitive','gerund-form-logical-subject','gerund-functions','participle-voice-time','participle-attribute-predicative','participle-adverbials','participle-object-complements','verb-complement-patterns','doing-to-do-meaning','perception-causative','absolute-with-construction','dangling-modifiers','nonfinite-clause-conversion','nonfinite-integrated']
    },
    {
      build: sourceSpecialStructuresCourses.buildSpecialStructuresCourse,
      count: 27, groups: [13, 14], sections: [3, 2, 5, 4, 4, 5, 3, 1], total: 81,
      required: ['imperative-affirmative','imperative-negative','imperative-let','exclamation-what','exclamation-how','question-yes-no','question-wh','question-alternative','question-tag-basic','question-tag-special','inversion-foundation','inversion-negative','inversion-only-so-neither','inversion-full-locative','emphasis-do','emphasis-it-cleft','emphasis-wh-cleft','focus-fronting','ellipsis-coordination','ellipsis-adverbial','ellipsis-infinitive','substitution-one-ones','substitution-do-so-not','parentheticals','subjunctive-wish','subjunctive-suggestion','integrated-special-structures']
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
    bundle.course.forEach((lesson) => {
      assert.equal(lesson.analyses.length, lesson.examples.length);
      assert.equal(lesson.ruleCoverage.length, lesson.rules.length);
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
      count: 22, groups: [14, 8], sections: [3, 4, 3, 4, 3, 4, 1], total: 72,
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
    bundle.course.forEach((lesson) => lesson.questions.forEach((question) => {
      assert.ok(question.options.some((option) => option.key === question.answer));
      if (english) {
        assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
        question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
      }
    }));
  }));
  const wxss = fs.readFileSync(path.join(__dirname, '../grammar-package/pages/classroom/index.wxss'), 'utf8');
  ['coordinand','nounClause','dummySubject','dummyObject'].forEach((role) => assert.match(wxss, new RegExp(`role-${role}`)));
});

test('定语从句、状语从句与直接间接引语完整覆盖关系、逻辑和转述变化', () => {
  const specs = [
    {
      build: sourceRelativeClausesCourses.buildRelativeClausesCourse,
      count: 20, groups: [15, 5], sections: [2, 5, 4, 3, 3, 3], total: 60,
      required: ['relative-boundary','relative-internal-role','who-whom','whose','which','that-relative','object-relative-omission','relative-when','relative-where','relative-why','preposition-relative','restrictive-relative','nonrestrictive-relative','that-constraints','sentential-as-which','what-boundary','relative-agreement','reduced-relatives','relative-nesting-ambiguity','relative-integration']
    },
    {
      build: sourceAdverbialClausesCourses.buildAdverbialClausesCourse,
      count: 20, groups: [14, 6], sections: [5, 4, 2, 2, 2, 3, 2], total: 64,
      required: ['adverbial-function-position','time-when-while-as','time-before-after','time-until-since','time-immediate-once','place-where-wherever','reason-because-since-as','purpose-clauses','result-so-such','condition-if','condition-unless-provided','concession-although-even','concession-while-no-matter','comparison-clauses','manner-as-as-if','future-present-rule','tense-relations','paired-conjunction-boundaries','ellipsis-participle','adverbial-integration']
    },
    {
      build: sourceReportedSpeechCourses.buildReportedSpeechCourse,
      count: 20, groups: [15, 5], sections: [4, 5, 3, 1, 2, 2, 3], total: 61,
      required: ['direct-form-punctuation','reported-form-foundation','statements-that','say-tell-verbs','yes-no-questions','wh-questions','commands-requests','advice-suggestion','exclamations-responses','backshift-present','backshift-past-future','modal-changes','no-backshift-boundaries','person-possessive','deictic-time-place','reporting-clause-position','indirect-to-direct','layered-reporting','ambiguity-boundaries','integrated-rewrite']
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
    bundle.course.forEach((lesson) => lesson.questions.forEach((question) => {
      assert.ok(question.options.some((option) => option.key === question.answer));
      if (english) {
        assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
        question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
      }
    }));
  }));
  const reported = sourceReportedSpeechCourses.buildReportedSpeechCourse(false);
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
      count: 21, groups: [16, 5], sections: [6, 2, 4, 2, 4, 2, 1], total: 63,
      required: ['personal-reference-chain','possessive-reference','forward-reference','reference-agreement','reference-clarity','discourse-this-that','these-those-reference','one-ones-substitution','do-substitution','so-not-substitution','ellipsis-substitution-boundary','keyword-repetition','lexical-relations','basic-logical-connectors','conjunctive-adverb-punctuation','sequence-connectors','example-summary-connectors','articles-given-new','paragraph-topic-chain','reference-distance','cohesion-integration']
    },
    {
      build: sourceInformationOrderCourses.buildInformationOrderCourse,
      count: 20, groups: [14, 6], sections: [3, 3, 4, 2, 3, 2, 3], total: 63,
      required: ['skeleton-vs-topic','given-new-flow','end-weight-short-long','dummy-subject','dummy-object','existential-new-information','basic-adverbial-position','frequency-adverbs','multiple-adverbials','modifier-order','double-object-order','passive-focus','fronting-boundary','inversion-focus','cleft-focus','focus-particles','negation-scope','paragraph-progression','avoid-chinglish','information-rewrite']
    },
    {
      build: sourcePunctuationCourses.buildPunctuationCourse,
      count: 20, groups: [16, 4], sections: [3, 5, 3, 3, 2, 3, 1], total: 60,
      required: ['terminal-marks','fragments','run-ons-comma-splices','comma-coordination','comma-adverbial','comma-nonrestrictive','comma-apposition-parenthetical','comma-lists','semicolon','colon','dash-parentheses','apostrophe-possession','apostrophe-contractions','quotation-punctuation','hyphens','capitalization-basics','capitalization-dates-titles','numbers-abbreviations','quote-style-boundary','integrated-proofreading']
    },
    {
      build: sourceCommonExpressionCourses.buildCommonExpressionCourse,
      count: 20, groups: [17, 3], sections: [4, 4, 3, 2, 3, 4], total: 60,
      required: ['explicit-subject','topic-to-subject','inanimate-subject','people-general-subject','be-not-shi','verb-centred-expression','light-verb-collocations','possession-existence','time-age-duration','quantity-countability','double-object-order','attribute-order-expression','adverbial-order-expression','cause-result-expression','contrast-concession-expression','negation-scope-expression','question-order-expression','active-passive-choice','nominalization-concision','integrated-expression']
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
    bundle.course.forEach((lesson) => lesson.questions.forEach((question) => {
      assert.ok(question.options.some((option) => option.key === question.answer));
      if (english) {
        assert.doesNotMatch(question.question, /[\u4e00-\u9fff]/);
        question.options.forEach((option) => assert.doesNotMatch(option.text, /[\u4e00-\u9fff]/));
      }
    }));
  }));
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
