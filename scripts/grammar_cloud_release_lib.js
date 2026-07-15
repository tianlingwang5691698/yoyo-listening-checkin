const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'data/grammar-classroom/course-sources');
const RELEASES_DIR = path.join(ROOT, 'data/grammar-classroom/cloud-releases');
const SCHEMA_VERSION = 1;
const MAX_TOPIC_BYTES = 1024 * 1024;

const TOPICS = [
  ['noun', 'word-courses.js', 'buildNounCourse', 10],
  ['pronoun', 'word-courses.js', 'buildPronounCourse', 15],
  ['verb', 'verb-numeral-article-courses.js', 'buildVerbCourse', 36],
  ['numeral', 'verb-numeral-article-courses.js', 'buildNumeralCourse', 12],
  ['article', 'verb-numeral-article-courses.js', 'buildArticleCourse', 15],
  ['adjective', 'adjective-adverb-courses.js', 'buildAdjectiveCourse', 15],
  ['adverb', 'adjective-adverb-courses.js', 'buildAdverbCourse', 16],
  ['preposition', 'preposition-conjunction-interjection-courses.js', 'buildPrepositionCourse', 25],
  ['conjunction', 'conjunction-courses.js', 'buildConjunctionCourse', 14],
  ['interjection', 'interjection-courses.js', 'buildInterjectionCourse', 10],
  ['word-formation', 'word-formation-courses.js', 'buildWordFormationCourse', 18],
  ['sentence-elements', 'sentence-elements-courses.js', 'buildSentenceElementsCourse', 23],
  ['basic-patterns', 'basic-sentence-patterns-courses.js', 'buildBasicSentencePatternsCourse', 16],
  ['predicate-system', 'predicate-system-courses.js', 'buildPredicateSystemCourse', 20],
  ['nonfinite-system', 'nonfinite-system-courses.js', 'buildNonfiniteSystemCourse', 19],
  ['special-structures', 'special-structures-courses.js', 'buildSpecialStructuresCourse', 28],
  ['coordination', 'coordination-courses.js', 'buildCoordinationCourse', 22],
  ['noun-clauses', 'noun-clauses-courses.js', 'buildNounClausesCourse', 22],
  ['relative-clauses', 'relative-clauses-courses.js', 'buildRelativeClausesCourse', 21],
  ['adverbial-clauses', 'adverbial-clauses-courses.js', 'buildAdverbialClausesCourse', 20],
  ['reported-speech', 'reported-speech-courses.js', 'buildReportedSpeechCourse', 21],
  ['cohesion-reference', 'cohesion-reference-courses.js', 'buildCohesionReferenceCourse', 22],
  ['information-order', 'information-order-courses.js', 'buildInformationOrderCourse', 22],
  ['punctuation', 'punctuation-courses.js', 'buildPunctuationCourse', 21],
  ['common-expression', 'common-expression-courses.js', 'buildCommonExpressionCourse', 21]
].map(([topicId, sourceFile, builderName, lessonCount]) => ({ topicId, sourceFile, builderName, lessonCount }));

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function canonical(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value)).digest('hex');
}

function jsonBody(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateBundle(topic, zh, en, narrationIds) {
  assert(zh && en && Array.isArray(zh.course) && Array.isArray(en.course), `invalid-bundle:${topic.topicId}`);
  assert(zh.course.length === topic.lessonCount, `lesson-count:${topic.topicId}:zh:${zh.course.length}:${topic.lessonCount}`);
  assert(en.course.length === topic.lessonCount, `lesson-count:${topic.topicId}:en:${en.course.length}:${topic.lessonCount}`);
  assert(new Set(zh.course.map((lesson) => lesson.id)).size === topic.lessonCount, `duplicate-lesson-id:${topic.topicId}:zh`);
  assert(new Set(en.course.map((lesson) => lesson.id)).size === topic.lessonCount, `duplicate-lesson-id:${topic.topicId}:en`);

  zh.course.forEach((lesson, index) => {
    const englishLesson = en.course[index];
    assert(lesson.id && englishLesson && englishLesson.id === lesson.id, `lesson-order:${topic.topicId}:${index}`);
    const zhNarration = lesson.narration || null;
    const enNarration = englishLesson.narration || null;
    assert(canonical(zhNarration) === canonical(enNarration), `narration-not-shared:${topic.topicId}:${lesson.id}`);
    if (!zhNarration) return;
    assert(zhNarration.id && zhNarration.version && String(zhNarration.text || '').trim(), `invalid-narration:${topic.topicId}:${lesson.id}`);
    assert(!narrationIds.has(zhNarration.id), `duplicate-narration-id:${zhNarration.id}`);
    narrationIds.add(zhNarration.id);
  });
}

function buildRelease() {
  assert(TOPICS.length === 25, `topic-count:${TOPICS.length}:25`);
  const narrationIds = new Set();
  const built = TOPICS.map((topic) => {
    const sourcePath = path.join(SOURCE_DIR, topic.sourceFile);
    delete require.cache[require.resolve(sourcePath)];
    const builder = require(sourcePath)[topic.builderName];
    assert(typeof builder === 'function', `builder-missing:${topic.sourceFile}:${topic.builderName}`);
    const zh = builder(false);
    const en = builder(true);
    validateBundle(topic, zh, en, narrationIds);
    const core = {
      schemaVersion: SCHEMA_VERSION,
      topicId: topic.topicId,
      bundles: { 'zh-CN': zh, en }
    };
    const contentHash = sha256(canonical(core));
    return { topic, core, contentHash, contentVersion: `sha256-${contentHash.slice(0, 16)}` };
  });

  const releaseHash = sha256(canonical(built.map(({ topic, contentHash }) => ({ topicId: topic.topicId, contentHash }))));
  const releaseId = `grammar-${releaseHash.slice(0, 20)}`;
  const files = built.map(({ topic, core, contentHash, contentVersion }) => {
    const value = { ...core, releaseId, contentVersion, contentHash };
    const body = jsonBody(value);
    const bytes = Buffer.byteLength(body);
    assert(bytes < MAX_TOPIC_BYTES, `topic-over-1mb:${topic.topicId}:${bytes}`);
    return {
      topicId: topic.topicId,
      fileName: `${topic.topicId}.json`,
      relativePath: `topics/${topic.topicId}.json`,
      lessonCount: topic.lessonCount,
      narrationCount: core.bundles['zh-CN'].course.filter((lesson) => lesson.narration).length,
      contentVersion,
      contentHash,
      fileHash: sha256(body),
      bytes,
      value,
      body
    };
  });
  const manifestCore = {
    schemaVersion: SCHEMA_VERSION,
    releaseId,
    releaseHash,
    topicCount: files.length,
    lessonCount: files.reduce((sum, file) => sum + file.lessonCount, 0),
    narrationCount: narrationIds.size,
    topics: files.map(({ topicId, relativePath, lessonCount, narrationCount, contentVersion, contentHash, fileHash, bytes }) => ({
      topicId, relativePath, lessonCount, narrationCount, contentVersion, contentHash, fileHash, bytes
    }))
  };
  const manifestHash = sha256(canonical(manifestCore));
  const manifest = { ...manifestCore, manifestHash };
  return { releaseId, releaseHash, manifest, manifestBody: jsonBody(manifest), files };
}

function writeRelease(release) {
  fs.mkdirSync(RELEASES_DIR, { recursive: true });
  const targetDir = path.join(RELEASES_DIR, release.releaseId);
  const expected = new Map([
    ['release-manifest.json', release.manifestBody],
    ...release.files.map((file) => [file.relativePath, file.body])
  ]);
  if (fs.existsSync(targetDir)) {
    expected.forEach((body, relativePath) => {
      const targetPath = path.join(targetDir, relativePath);
      assert(fs.existsSync(targetPath) && fs.readFileSync(targetPath, 'utf8') === body, `immutable-release-conflict:${release.releaseId}:${relativePath}`);
    });
    const actualFiles = fs.readdirSync(path.join(targetDir, 'topics')).filter((name) => name.endsWith('.json'));
    assert(actualFiles.length === release.files.length, `immutable-release-extra-files:${release.releaseId}`);
    return { targetDir, reused: true };
  }
  const temporaryDir = `${targetDir}.tmp-${process.pid}`;
  fs.mkdirSync(path.join(temporaryDir, 'topics'), { recursive: true });
  try {
    release.files.forEach((file) => fs.writeFileSync(path.join(temporaryDir, file.relativePath), file.body, { flag: 'wx' }));
    fs.writeFileSync(path.join(temporaryDir, 'release-manifest.json'), release.manifestBody, { flag: 'wx' });
    fs.renameSync(temporaryDir, targetDir);
  } catch (error) {
    fs.rmSync(temporaryDir, { recursive: true, force: true });
    throw error;
  }
  return { targetDir, reused: false };
}

function validateReleaseDirectory(releaseId) {
  assert(/^grammar-[a-f0-9]{20}$/.test(releaseId), `invalid-release-id:${releaseId}`);
  const releaseDir = path.join(RELEASES_DIR, releaseId);
  const manifestPath = path.join(releaseDir, 'release-manifest.json');
  assert(fs.existsSync(manifestPath), `release-manifest-missing:${releaseId}`);
  const manifestBody = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestBody);
  assert(manifest.releaseId === releaseId && manifest.schemaVersion === SCHEMA_VERSION, `release-manifest-invalid:${releaseId}`);
  assert(manifest.topicCount === 25 && Array.isArray(manifest.topics) && manifest.topics.length === 25, `release-topic-count:${releaseId}`);
  assert(new Set(manifest.topics.map((topic) => topic.topicId)).size === 25, `release-topic-duplicate:${releaseId}`);
  const expectedTopics = new Map(TOPICS.map((topic) => [topic.topicId, topic]));
  const narrationIds = new Set();
  let lessonCount = 0;
  const files = manifest.topics.map((entry) => {
    const topic = expectedTopics.get(entry.topicId);
    assert(topic, `release-topic-unknown:${entry.topicId}`);
    const filePath = path.join(releaseDir, entry.relativePath);
    assert(entry.relativePath === `topics/${entry.topicId}.json` && fs.existsSync(filePath), `release-topic-file:${entry.topicId}`);
    const body = fs.readFileSync(filePath, 'utf8');
    assert(Buffer.byteLength(body) === entry.bytes && entry.bytes < MAX_TOPIC_BYTES, `release-topic-size:${entry.topicId}`);
    assert(sha256(body) === entry.fileHash, `release-file-hash:${entry.topicId}`);
    const value = JSON.parse(body);
    assert(value.releaseId === releaseId && value.topicId === entry.topicId && value.schemaVersion === SCHEMA_VERSION, `release-topic-header:${entry.topicId}`);
    const core = { schemaVersion: value.schemaVersion, topicId: value.topicId, bundles: value.bundles };
    assert(sha256(canonical(core)) === value.contentHash && value.contentHash === entry.contentHash, `release-content-hash:${entry.topicId}`);
    assert(value.contentVersion === `sha256-${value.contentHash.slice(0, 16)}` && value.contentVersion === entry.contentVersion, `release-content-version:${entry.topicId}`);
    validateBundle(topic, value.bundles['zh-CN'], value.bundles.en, narrationIds);
    lessonCount += topic.lessonCount;
    return { ...entry, filePath, body };
  });
  assert(lessonCount === manifest.lessonCount, `release-lesson-count:${lessonCount}:${manifest.lessonCount}`);
  assert(narrationIds.size === manifest.narrationCount, `release-narration-count:${narrationIds.size}:${manifest.narrationCount}`);
  const manifestCore = { ...manifest };
  delete manifestCore.manifestHash;
  assert(sha256(canonical(manifestCore)) === manifest.manifestHash, `release-manifest-hash:${releaseId}`);
  const expectedReleaseHash = sha256(canonical(manifest.topics.map(({ topicId, contentHash }) => ({ topicId, contentHash }))));
  assert(expectedReleaseHash === manifest.releaseHash && releaseId === `grammar-${expectedReleaseHash.slice(0, 20)}`, `release-hash:${releaseId}`);
  return { releaseDir, manifestPath, manifestBody, manifest, files };
}

module.exports = {
  ROOT,
  RELEASES_DIR,
  SCHEMA_VERSION,
  TOPICS,
  buildRelease,
  sha256,
  validateReleaseDirectory,
  writeRelease
};
