const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_ID = 'grammar-5b0a1361a5a93aab8f1c';
const TOPICS = [
  ['noun', '名词'],
  ['pronoun', '代词'],
  ['numeral', '数词'],
  ['article', '冠词'],
  ['verb', '动词'],
  ['adjective', '形容词'],
  ['adverb', '副词'],
  ['preposition', '介词'],
  ['conjunction', '连词'],
  ['interjection', '感叹词']
];

const catalog = TOPICS.flatMap(([topic, topicLabel]) => {
  const filePath = path.join(ROOT, 'data/grammar-classroom/cloud-releases', RELEASE_ID, 'topics', `${topic}.json`);
  const release = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const course = release.bundles && release.bundles['zh-CN'] && release.bundles['zh-CN'].course || [];
  return course.map((lesson, index) => ({
    taskId: `grammar-${topic}-${index + 1}`,
    topic,
    topicLabel,
    lessonId: lesson.id,
    lessonNumber: index + 1,
    title: lesson.title,
    meta: lesson.meta || ''
  }));
});

const outputPath = path.join(ROOT, 'cloudfunctions/yoyo/data/grammar-plan-catalog.json');
fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`generated ${catalog.length} grammar plan lessons -> ${outputPath}`);
