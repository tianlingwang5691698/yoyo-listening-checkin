#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'data/grammar-classroom/course-sources');
const outputPath = path.join(root, 'cloudfunctions/yoyo/data/grammar-narration-manifest.json');
const sourceFiles = [
  'word-courses.js',
  'verb-numeral-article-courses.js',
  'word-formation-courses.js',
  'adjective-adverb-courses.js',
  'preposition-conjunction-interjection-courses.js',
  'conjunction-courses.js',
  'interjection-courses.js',
  'sentence-elements-courses.js',
  'basic-sentence-patterns-courses.js',
  'predicate-system-courses.js',
  'nonfinite-system-courses.js',
  'special-structures-courses.js',
  'coordination-courses.js',
  'noun-clauses-courses.js',
  'relative-clauses-courses.js',
  'adverbial-clauses-courses.js',
  'reported-speech-courses.js',
  'cohesion-reference-courses.js',
  'information-order-courses.js',
  'punctuation-courses.js',
  'common-expression-courses.js'
];
const legacyHashes = {
  'preposition:prep-essence:v1:zh-CN': '18e438f2df994dbe73bc048cd2d926401ae92aaf007df233f036f773b3a14792',
  'preposition:prep-essence:v2:zh-CN': '566b67c46c72910e8b679307cc234c5b83145b223be268ada98981bbba36c18a',
  'preposition:prep-essence:v3:zh-CN': '5b9548bef9b62f64838d0ef9e5dd91caae3a797cc427d715501861404619eba2',
  'preposition:prep-essence:v4:zh-CN': 'ad55bc1889020d139e8355348e5deff8e7cdd556ba988453db2ee72a9041ed58',
  'preposition:prep-essence:v5:zh-CN': '2e69f034eb6c4722a10844586aa4b90ce4b40c48d1b7e16f17ba4d91bbf202c8',
  'preposition:prep-essence:v6:zh-CN': '20ea797dd0980665800ff6fae80bc82924b7ae41cc7674966fd274a335fc99aa',
  'preposition:prep-essence:v1:en': '7742c616aaf5bd88bb8d2df644226a9e63e85f40321f3122944388dfa511655f'
};

function hash(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

function validateNarrationAgainstLesson(fileName, builderName, lesson, narration) {
  const examples = (lesson.examples || []).map((example) => String(example).toLowerCase().replace(/[^a-z0-9]/g, ''));
  const normalizedNarration = narration.text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  const hasDisplayedExample = (lesson.examples || []).some((example) => {
    const normalizedExample = String(example).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
    return normalizedExample.length >= 4 && normalizedNarration.includes(normalizedExample);
  });
  const order = [];
  const runs = narration.text.match(/[A-Za-z][A-Za-z'’]*(?:(?:[\s,.'’!?-]+)[A-Za-z][A-Za-z'’]*){2,}/g) || [];
  runs.forEach((run) => {
    const normalizedRun = run.toLowerCase().replace(/[^a-z0-9]/g, '');
    const exampleIndex = examples.findIndex((example) => example.includes(normalizedRun));
    if (normalizedRun.length >= 6 && exampleIndex < 0) throw new Error(`Narration uses a page-external example: ${fileName}/${builderName}/${lesson.id}: ${run}`);
    if (exampleIndex >= 0 && order[order.length - 1] !== exampleIndex) order.push(exampleIndex);
  });
  if (!hasDisplayedExample) throw new Error(`Narration does not explain a displayed example: ${fileName}/${builderName}/${lesson.id}`);
  if (order.some((exampleIndex, index) => index > 0 && exampleIndex < order[index - 1])) throw new Error(`Narration explains examples out of page order: ${fileName}/${builderName}/${lesson.id}`);
}

const hashes = Object.assign({}, legacyHashes);
const lessons = [];

sourceFiles.forEach((fileName) => {
  const exportsObject = require(path.join(sourceDir, fileName));
  Object.entries(exportsObject).forEach(([builderName, builder]) => {
    if (typeof builder !== 'function' || !builderName.startsWith('build')) return;
    const zhBundle = builder(false);
    const enBundle = builder(true);
    const zhCourse = zhBundle && zhBundle.course || [];
    const enCourse = enBundle && enBundle.course || [];
    const zhLesson = zhCourse[0];
    const narration = zhLesson && zhLesson.narration;
    if (!narration || !narration.id || !narration.version || !String(narration.text || '').trim()) {
      throw new Error(`Missing first-lesson narration: ${fileName}/${builderName}`);
    }
    zhCourse.forEach((courseLesson, lessonIndex) => {
      if (!courseLesson.narration) return;
      const englishLesson = enCourse[lessonIndex];
      const lessonNarration = courseLesson.narration;
      if (!lessonNarration.id || !lessonNarration.version || !String(lessonNarration.text || '').trim()) {
        throw new Error(`Invalid narration: ${fileName}/${builderName}/${courseLesson.id}`);
      }
      validateNarrationAgainstLesson(fileName, builderName, courseLesson, lessonNarration);
      if (!englishLesson || englishLesson.id !== courseLesson.id || JSON.stringify(englishLesson.narration) !== JSON.stringify(lessonNarration)) {
        throw new Error(`English interface must reuse Chinese narration: ${fileName}/${builderName}/${courseLesson.id}`);
      }
      const key = `${lessonNarration.id}:${lessonNarration.version}:zh-CN`;
      if (hashes[key] && hashes[key] !== hash(lessonNarration.text)) throw new Error(`Narration key collision: ${key}`);
      hashes[key] = hash(lessonNarration.text);
      lessons.push({ id: lessonNarration.id, version: lessonNarration.version, lessonId: courseLesson.id, source: fileName });
    });
  });
});

lessons.sort((left, right) => left.id.localeCompare(right.id));
if (lessons.length !== 205) throw new Error(`Expected 205 grammar narrations, received ${lessons.length}`);
if (new Set(lessons.map((lesson) => lesson.id)).size !== lessons.length) throw new Error('Duplicate grammar narration id');
const orderedHashes = Object.fromEntries(Object.entries(hashes).sort(([left], [right]) => left.localeCompare(right)));
fs.writeFileSync(outputPath, `${JSON.stringify({ version: 1, lessons, hashes: orderedHashes }, null, 2)}\n`);
console.log(`Generated ${lessons.length} grammar narrations: ${outputPath}`);
