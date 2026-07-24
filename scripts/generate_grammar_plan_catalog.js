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
const SYNTAX_TOPICS = [
  ['sentence-elements', '句子成分'],
  ['basic-patterns', '基本句型'],
  ['predicate-system', '谓语系统'],
  ['nonfinite-system', '非谓语系统'],
  ['special-structures', '特殊句式']
];

function buildCatalog(topics, domain, domainLabel) {
  return topics.flatMap(([topic, topicLabel]) => {
    const filePath = path.join(ROOT, 'data/grammar-classroom/cloud-releases', RELEASE_ID, 'topics', `${topic}.json`);
    const release = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const course = release.bundles && release.bundles['zh-CN'] && release.bundles['zh-CN'].course || [];
    return course.map((lesson, index) => ({
      taskId: `grammar-${topic}-${index + 1}`,
      domain,
      domainLabel,
      topic,
      topicLabel,
      lessonId: lesson.id,
      lessonNumber: index + 1,
      title: lesson.title,
      meta: lesson.meta || ''
    }));
  });
}

const catalog = buildCatalog(TOPICS, 'lexical', '词法');
const syntaxCatalog = buildCatalog(SYNTAX_TOPICS, 'syntax', '句法');

const outputPath = path.join(ROOT, 'cloudfunctions/yoyo/data/grammar-plan-catalog.json');
const syntaxOutputPath = path.join(ROOT, 'cloudfunctions/yoyo/data/grammar-syntax-plan-catalog.json');
fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
fs.writeFileSync(syntaxOutputPath, `${JSON.stringify(syntaxCatalog, null, 2)}\n`);
console.log(`generated ${catalog.length} grammar plan lessons -> ${outputPath}`);
console.log(`generated ${syntaxCatalog.length} grammar syntax lessons -> ${syntaxOutputPath}`);
