const pick = (english, zh, en) => english ? en : zh;
const INCLUDE_RULE_COVERAGE = typeof GRAMMAR_RUNTIME === 'undefined' || !GRAMMAR_RUNTIME;
const part = (english, text, role, zh, en) => ({ text, role, label: pick(english, zh, en) });
const example = (english, parts, mode = '', zhNote = '', enNote = '') => ({
  text: parts.map((item) => item[0]).join(' '),
  analysis: parts.map((item) => part(english, item[0], item[1], item[2], item[3])),
  note: mode ? {
    visible: true,
    mode,
    title: pick(english, mode === 'translation' ? '语序翻译' : '规则观察', mode === 'translation' ? 'Word-order translation' : 'Rule focus'),
    body: pick(english, zhNote, enNote),
    detail: ''
  } : { visible: false, mode: '', title: '', body: '', detail: '' }
});
const question = (english, prompt, a, b, answer, zhWhy, enWhy) => ({
  question: Array.isArray(prompt) ? pick(english, prompt[0], prompt[1]) : prompt,
  options: [{ key: 'A', text: a }, { key: 'B', text: b }],
  answer,
  correct: pick(english, zhWhy, enWhy),
  wrong: pick(english, `再看规则：${zhWhy}`, `Check the rule: ${enWhy}`)
});
const RULE_COVERAGE = INCLUDE_RULE_COVERAGE ? {
  'adjective-jobs': [[[0, 1, 2], [0, 1, 2]], [[0, 1, 2], [0, 1, 2]]],
  'adjective-position': [[[0], [0]], [[1], [1]], [[2], [2]]],
  'adjective-degree': [[[0, 2], [0, 2]], [[1], [1]]],
  'adjective-comparative-form': [[[0], [4]], [[3], [3]], [[1], [0]], [[2], [1]], [[4], [2]]],
  'adjective-comparison': [[[0], [0]], [[1], [1]], [[2], [2]], [[3], [3]]],
  'adjective-superlative': [[[0, 1, 2], [0]], [[0, 1, 2], [1]], [[0, 1, 2], [0]], [[2], [2]]],
  'participle-adjectives': [[[0, 2], [0]], [[1, 2], [1, 2]], [[0, 1, 2], [0, 1, 2]]],
  'adjective-order': [[[0, 1, 2, 3], [0, 1, 2, 3]], [[0, 1, 2, 3], [0, 1, 2, 3]]],
  'adjective-nominal': [[[0], [0]], [[1], [1]], [[2], [2]]],
  'adverb-jobs': [[[0], [0]], [[1], [1]], [[3], [3]], [[2], [2]]],
  'adverb-types': [[[0], [3]], [[0], [0]], [[1], [4]], [[1], [1]], [[2], [2]], [[3], [5]]],
  'adverb-position': [[[0], [0]], [[1], [1]], [[3], [3]], [[2], [2]], [[2], [4]]],
  'adjective-or-adverb': [[[0], [0]], [[1], [1]], [[2], [2]], [[3], [3]]],
  'adverb-comparison': [[[0, 2], [1]], [[1], [0]], [[3], [2]]],
  'degree-patterns': [[[0], [0]], [[1], [1]], [[3], [3]], [[2], [2]]],
  'adverb-scope': [[[0, 1], [0]], [[2], [1]], [[3], [3]], [[3], [2]]],
  'adverb-traps': [[[0, 1], [0]], [[1], [1]], [[2, 3], [2, 3]], [[2, 3], [2, 3]]]
} : null;
function lesson(english, id, zhTitle, enTitle, zhMeta, enMeta, examples, rules, questions) {
  const coverage = INCLUDE_RULE_COVERAGE ? RULE_COVERAGE[id] : null;
  return {
    id,
    title: pick(english, zhTitle, enTitle),
    meta: pick(english, zhMeta, enMeta),
    examples: examples.map((item) => item.text),
    analyses: examples.map((item) => item.analysis),
    exampleNotes: examples.map((item) => item.note),
    rules: rules.map((item) => pick(english, item[0], item[1])),
    ruleCoverage: INCLUDE_RULE_COVERAGE ? coverage.map((item) => ({ exampleIndexes: item[0], questionIndexes: item[1] })) : [],
    questions
  };
}
function groupCourse(english, lessons, zhTitle, enTitle, coreCount, sectionDefs) {
  const course = lessons.map((item, index) => Object.assign({}, item, {
    no: String(index + 1).padStart(2, '0'),
    level: index < coreCount ? 'core' : 'advanced'
  }));
  const sections = (sectionDefs || []).map((item) => ({
    id: item[0],
    title: pick(english, item[1], item[2]),
    copy: pick(english, item[3], item[4]),
    lessonIds: item[5].slice(),
    lessonCount: item[5].length
  }));
  const assignedIds = sections.reduce((ids, section) => ids.concat(section.lessonIds), []);
  const courseIds = course.map((lesson) => lesson.id);
  if (assignedIds.length !== courseIds.length
    || new Set(assignedIds).size !== assignedIds.length
    || courseIds.some((id) => !assignedIds.includes(id))) {
    throw new Error(`${enTitle} sections must assign every lesson exactly once`);
  }
  return {
    title: pick(english, `${zhTitle} · ${course.length} 节微课`, `${enTitle} · ${course.length} lessons`),
    copy: pick(english, '先掌握核心规则，再处理复杂语境。', 'Master the core rules, then handle complex contexts.'),
    course,
    sections,
    groups: [
      { id: 'core', title: pick(english, `核心必学 · ${coreCount} 节`, `Core · ${coreCount} essential lessons`), copy: pick(english, '所有学生必须掌握。', 'Complete these first.'), lessons: course.slice(0, coreCount) },
      { id: 'advanced', title: pick(english, `进阶挑战 · ${course.length - coreCount} 节`, `Advanced · ${course.length - coreCount} challenge lessons`), copy: pick(english, '特殊结构与综合辨析。', 'Special structures and mixed practice.'), lessons: course.slice(coreCount) }
    ]
  };
}

function buildAdjectiveCourse(english) {
  const e = (parts, mode = '', zh = '', en = '') => example(english, parts, mode, zh, en);
  const q = (...args) => question(english, ...args);
  return groupCourse(english, [
    lesson(english, 'adjective-jobs', '形容词在句中做什么', 'What adjectives do', '定语 · 表语 · 宾语补足语', 'Attribute · complement · object complement', [
      e([['The', 'attribute', '限定词', 'Determiner'], ['kind', 'attribute', '前置定语', 'Attributive adjective'], ['teacher', 'subject', '主语', 'Subject'], ['helped', 'predicate', '谓语动词', 'Predicate verb'], ['us.', 'object', '宾语', 'Object']]),
      e([['The sky', 'subject', '主语', 'Subject'], ['looks', 'predicate', '系动词', 'Linking verb'], ['blue.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['The news', 'subject', '主语', 'Subject'], ['made', 'predicate', '谓语动词', 'Predicate verb'], ['her', 'object', '宾语', 'Object'], ['happy.', 'attribute', '形容词作宾语补足语', 'Adjective object complement']])
    ], [
      ['形容词描述人或事物的性质、状态和特征。', 'Adjectives describe qualities, states and characteristics.'],
      ['形容词可作定语、表语或宾语补足语；作表语时常跟在系动词后。', 'Adjectives can be attributes, subject complements or object complements; complements often follow linking verbs.']
    ], [
      q('The ___ dog is friendly.', 'brown', 'brownly', 'A', 'brown 修饰名词 dog，作定语。', 'brown modifies dog as an adjective.'),
      q('The soup tastes ___.', 'delicious', 'deliciously', 'A', 'taste 是系动词，后接形容词作表语。', 'taste is a linking verb and takes an adjective complement.'),
      q('The joke made everyone ___.', 'happy', 'happily', 'A', 'happy 说明宾语 everyone 的状态。', 'happy describes the object everyone.')
    ]),
    lesson(english, 'adjective-position', '形容词放在哪里', 'Where adjectives go', '前置定语与后置定语', 'Prepositive and postpositive attributes', [
      e([['She', 'subject', '主语', 'Subject'], ['bought', 'predicate', '谓语动词', 'Predicate verb'], ['a', 'attribute', '限定词', 'Determiner'], ['beautiful', 'attribute', '形容词作前置定语', 'Prepositive adjective'], ['dress.', 'object', '宾语中心词', 'Object head']]),
      e([['I', 'subject', '主语', 'Subject'], ['need', 'predicate', '谓语动词', 'Predicate verb'], ['something', 'object', '宾语中心词', 'Object head'], ['useful.', 'attribute', '形容词作后置定语', 'Postpositive adjective'] ], 'translation', '形容词 useful 在英语中放在不定代词 something 后，中文通常前移为“有用的东西”。', 'useful follows the indefinite pronoun in English; Chinese normally moves the modifier before the word meaning “thing”.'),
      e([['The students', 'subject', '主语', 'Subject'], ['present', 'attribute', '形容词作后置定语', 'Postpositive adjective'], ['were', 'predicate', '系动词', 'Linking verb'], ['quiet.', 'object', '形容词作表语', 'Adjective complement']], 'translation', 'present 后置表示“在场的”，中文通常译为“在场的学生”。', 'present follows students meaning “in attendance”; Chinese normally places the equivalent modifier before “students”.')
    ], [
      ['单个形容词作定语通常放在名词前。', 'A single attributive adjective normally comes before its noun.'],
      ['形容词修饰 something、anything、nothing 等不定代词时必须后置。', 'An adjective must follow indefinite pronouns such as something, anything and nothing.'],
      ['部分形容词在特定义项中要求后置，如 the students present 中 present 表示“在场的”。', 'Some adjectives are postpositive in particular senses, as present meaning “in attendance” in the students present.']
    ], [
      q('We saw a ___ bird.', 'small', 'smallly', 'A', '单个形容词 small 放在名词 bird 前。', 'small comes before the noun bird.'),
      q('Is there anything ___?', 'interesting', 'interestingly', 'A', '形容词修饰 anything 时放在其后。', 'An adjective follows anything.'),
      q('The people ___ must sign here.', 'present', 'presently', 'A', 'present 后置表示“在场的”。', 'postpositive present means “in attendance”.')
    ]),
    lesson(english, 'adjective-degree', '形容词有程度差别吗', 'Can adjectives vary in degree?', '可分级与不可分级形容词', 'Gradable and non-gradable adjectives', [
      e([['The room', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['very', 'adverbial', '程度状语', 'Degree adverbial'], ['cold.', 'object', '可分级形容词作表语', 'Gradable adjective complement']]),
      e([['The answer', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['absolutely', 'adverbial', '强调程度状语', 'Intensifying degree adverbial'], ['correct.', 'object', '不可分级形容词作表语', 'Non-gradable adjective complement']]),
      e([['This task', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['slightly', 'adverbial', '程度状语', 'Degree adverbial'], ['difficult.', 'object', '可分级形容词作表语', 'Gradable adjective complement']])
    ], [
      ['可分级形容词能表示不同程度，可与 very、slightly、quite 等连用。', 'Gradable adjectives allow degrees and combine with very, slightly and quite.'],
      ['表示极限或绝对状态的形容词通常用 absolutely、completely 等强调，规范表达中避免 very perfect。', 'Extreme or absolute adjectives usually take absolutely or completely; avoid very perfect in careful usage.']
    ], [
      q('The water is ___ warm.', 'slightly', 'absolute', 'A', 'warm 可分级，可用 slightly 修饰。', 'warm is gradable and can take slightly.'),
      q('Your answer is ___ correct.', 'absolutely', 'veryly', 'A', 'correct 表示正确状态，常用 absolutely 强调。', 'absolutely naturally intensifies correct.'),
      q('The film was ___ interesting.', 'very', 'completely', 'A', 'interesting 是典型可分级形容词。', 'interesting is a typical gradable adjective.')
    ]),
    lesson(english, 'adjective-comparative-form', '比较级和最高级怎样变', 'Forming comparatives and superlatives', '规则拼写与不规则变化', 'Regular spelling and irregular forms', [
      e([['This road', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['longer', 'object', '形容词比较级作表语', 'Comparative complement'], ['than that one.', 'adverbial', '比较对象', 'Comparison phrase']]),
      e([['Amy', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['happier', 'object', '形容词比较级作表语', 'Comparative complement'], ['today.', 'adverbial', '时间状语', 'Time adverbial']]),
      e([['This', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['the most useful', 'attribute', '形容词最高级作前置定语', 'Superlative attribute'], ['tool', 'object', '表语中心词', 'Complement head'], ['here.', 'adverbial', '地点状语', 'Place adverbial']]),
      e([['My bag', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['bigger', 'object', '双写末字母的比较级作表语', 'Comparative with doubled final consonant'], ['than yours.', 'adverbial', '比较对象', 'Comparison phrase']]),
      e([['Today', 'adverbial', '时间状语', 'Time adverbial'], ['is', 'predicate', '系动词', 'Linking verb'], ['better', 'object', '不规则比较级作表语', 'Irregular comparative complement'], ['than yesterday.', 'adverbial', '比较对象', 'Comparison phrase']])
    ], [
      ['一般的单音节形容词直接加 -er/-est。', 'Most one-syllable adjectives add -er/-est.'],
      ['“辅音—元音—辅音”结尾的重读单音节词通常双写末字母，再加 -er/-est。', 'A stressed one-syllable adjective ending consonant–vowel–consonant normally doubles the final consonant before -er/-est.'],
      ['辅音字母+y 结尾时，变 y 为 i，再加 -er/-est。', 'For consonant+y, change y to i before adding -er/-est.'],
      ['多音节形容词通常在前面加 more/most。', 'Longer adjectives normally form comparison with more/most.'],
      ['good–better–best、bad–worse–worst、many/much–more–most 要单独记忆。', 'Memorize good–better–best, bad–worse–worst and many/much–more–most.']
    ], [
      q(['happy 的比较级是 ___。', 'The comparative of happy is ___.'], 'happier', 'more happy', 'A', '辅音字母+y 变 y 为 i，再加 er。', 'Consonant+y changes to i before -er.'),
      q(['useful 的最高级是 ___。', 'The superlative of useful is ___.'], 'the most useful', 'the usefulest', 'A', '多音节形容词通常用 most。', 'A long adjective normally uses most.'),
      q(['good 的比较级是 ___。', 'The comparative of good is ___.'], 'better', 'gooder', 'A', 'good 的比较级是不规则形式 better。', 'better is the irregular comparative of good.'),
      q(['big 的比较级是 ___。', 'The comparative of big is ___.'], 'bigger', 'biger', 'A', 'big 是重读闭音节词，双写 g 再加 er。', 'big doubles its final g before -er.'),
      q(['long 的比较级是 ___。', 'The comparative of long is ___.'], 'longer', 'more long', 'A', '一般单音节形容词 long 直接加 er。', 'The one-syllable adjective long adds -er.')
    ]),
    lesson(english, 'adjective-comparison', '怎样比较两个对象', 'Comparing two things', 'than · as...as · less', 'than · as...as · less', [
      e([['Leo', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['taller', 'object', '形容词比较级作表语', 'Comparative complement'], ['than Max.', 'adverbial', '比较对象', 'Comparison phrase']]),
      e([['This box', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['as', 'adverbial', '同级程度标记', 'Equality degree marker'], ['heavy', 'object', '形容词原级作表语', 'Base adjective complement'], ['as that one.', 'adverbial', '比较对象', 'Comparison phrase']]),
      e([['The blue route', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['less', 'adverbial', '较低程度标记', 'Lower-degree marker'], ['dangerous', 'object', '形容词原级作表语', 'Base adjective complement'], ['than the red route.', 'adverbial', '比较对象', 'Comparison phrase']]),
      e([['My bag', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['heavier', 'object', '形容词比较级作表语', 'Comparative complement'], ['than yours.', 'adverbial', '同类比较对象', 'Like-for-like comparison']])
    ], [
      ['比较级 + than 表示一方程度更高。', 'Comparative + than shows a higher degree.'],
      ['as + 原级 + as 表示程度相同。', 'as + base adjective + as shows equality.'],
      ['less + 原级 + than 表示一方程度较低。', 'less + base adjective + than shows a lower degree.'],
      ['比较对象必须在逻辑上同类，必要时用 yours、that 等替代重复名词。', 'The compared items must be logically equivalent; use forms such as yours or that to avoid repeating a noun.']
    ], [
      q('My room is ___ than yours.', 'larger', 'large', 'A', 'than 前使用比较级 larger。', 'Use the comparative larger before than.'),
      q('Ben is as ___ as Sam.', 'careful', 'more careful', 'A', 'as...as 中使用形容词原级。', 'Use the base adjective inside as...as.'),
      q('This plan is ___ expensive than that one.', 'less', 'least', 'A', 'less...than 表示程度较低。', 'less...than expresses a lower degree.'),
      q('Choose the logical comparison.', 'My bag is heavier than yours.', 'My bag is heavier than you.', 'A', 'bag 应与 bag 比较，yours 相当于 your bag。', 'A bag must be compared with a bag; yours means your bag.')
    ]),
    lesson(english, 'adjective-superlative', '怎样在三者以上选最高', 'Choosing the highest degree', '最高级 · 范围 · 序数词', 'Superlative · range · ordinal', [
      e([['Mia', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['the tallest', 'object', '形容词最高级作表语', 'Superlative complement'], ['in her class.', 'adverbial', '比较范围', 'Comparison range']]),
      e([['This', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['the most exciting game', 'object', '最高级修饰表语中心词', 'Superlative modifying complement'], ['of the three.', 'adverbial', '比较范围', 'Comparison range']]),
      e([['The Yellow River', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['the second longest river', 'object', '序数词 + 最高级作表语', 'Ordinal + superlative complement'], ['in China.', 'adverbial', '地点兼比较范围', 'Place and comparison range']])
    ], [
      ['三者或以上比较通常用最高级。', 'Use the superlative for three or more.'],
      ['用 in + 地点/群体或 of + 限定数量交代比较范围。', 'Use in + place/group or of + defined set to state the comparison range.'],
      ['形容词最高级前通常有 the。', 'An adjective superlative normally takes the.'],
      ['“第几最……”用序数词 + 最高级。', 'Use ordinal + superlative for a ranking such as “the second longest”.']
    ], [
      q('She is ___ runner on the team.', 'the fastest', 'faster', 'A', '在全队范围内选最高，使用 the fastest。', 'Use the superlative within the whole team.'),
      q('This is the best ___ the four plans.', 'of', 'than', 'A', '有限个体范围通常用 of。', 'Use of for a defined set.'),
      q('It is the ___ largest city.', 'third', 'three', 'A', '排名使用序数词 third。', 'A ranking uses the ordinal third.')
    ]),
    lesson(english, 'participle-adjectives', '-ing 与 -ed 形容词', '-ing and -ed adjectives', '引起感受与产生感受', 'Cause and experience of feelings', [
      e([['The lesson', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['interesting.', 'object', '-ing 形容词作表语', '-ing adjective complement']]),
      e([['The students', 'subject', '主语', 'Subject'], ['are', 'predicate', '系动词', 'Linking verb'], ['interested', 'object', '-ed 形容词作表语', '-ed adjective complement'], ['in the lesson.', 'adverbial', '对象状语', 'Target phrase']]),
      e([['The frightening noise', 'subject', '-ing 形容词作前置定语的主语', 'Subject with -ing attribute'], ['made', 'predicate', '谓语动词', 'Predicate verb'], ['the child', 'object', '宾语', 'Object'], ['frightened.', 'attribute', '-ed 形容词作宾语补足语', '-ed object complement']])
    ], [
      ['-ing 形容词通常说明人或事物“令人产生某种感受”。', '-ing adjectives usually describe what causes a feeling.'],
      ['-ed 形容词通常说明感受者“感到……”。', '-ed adjectives usually describe the experiencer.'],
      ['选择形式要看被描述对象的语义角色，不只看它是人还是物。', 'Choose by semantic role, not simply whether the noun is a person or thing.']
    ], [
      q('The film was ___.', 'exciting', 'excited', 'A', '电影带来兴奋感，用 exciting。', 'The film causes excitement, so use exciting.'),
      q('We were ___ by the result.', 'surprised', 'surprising', 'A', 'we 是感受者，用 surprised。', 'We experience the feeling, so use surprised.'),
      q('The ___ audience cheered loudly.', 'excited', 'exciting', 'A', '观众感到兴奋，用 excited。', 'The audience experiences excitement.')
    ]),
    lesson(english, 'adjective-order', '多个形容词怎样排序', 'Ordering multiple adjectives', '限定、评价、大小、年龄、颜色、来源、材料、用途', 'Determiner · opinion · size · age · color · origin · material · purpose', [
      e([['She', 'subject', '主语', 'Subject'], ['bought', 'predicate', '谓语动词', 'Predicate verb'], ['a lovely small old house.', 'object', '宾语：评价 + 大小 + 年龄 + 名词', 'Object: opinion + size + age + noun']]),
      e([['He', 'subject', '主语', 'Subject'], ['wears', 'predicate', '谓语动词', 'Predicate verb'], ['a new black Italian coat.', 'object', '宾语：年龄 + 颜色 + 来源 + 名词', 'Object: age + color + origin + noun']]),
      e([['We', 'subject', '主语', 'Subject'], ['sat at', 'predicate', '谓语与介词', 'Predicate and preposition'], ['a beautiful round wooden table.', 'object', '介词宾语：评价 + 形状 + 材料 + 名词', 'Prepositional object: opinion + shape + material + noun']]),
      e([['She', 'subject', '主语', 'Subject'], ['chose', 'predicate', '谓语动词', 'Predicate verb'], ['a lovely old wooden dining table.', 'object', '宾语：评价 + 年龄 + 材料 + 用途 + 名词', 'Object: opinion + age + material + purpose + noun']])
    ], [
      ['常见顺序为：限定词—评价—大小—形状—年龄—颜色—来源—材料—用途—名词。', 'A common order is determiner–opinion–size–shape–age–color–origin–material–purpose–noun.'],
      ['评价词通常靠前，材料和用途通常最靠近中心名词。', 'Opinion adjectives normally come early, while material and purpose stay closest to the head noun.']
    ], [
      q('Choose the natural order.', 'a beautiful old stone bridge', 'a stone old beautiful bridge', 'A', '评价在前，年龄居中，材料靠近名词。', 'Opinion comes first; material stays closest to the noun.'),
      q('Choose the natural order.', 'a small red bag', 'a red small bag', 'A', '大小通常在颜色之前。', 'Size normally precedes color.'),
      q('Choose the natural order.', 'an expensive Japanese camera', 'a Japanese expensive camera', 'A', '评价通常在来源之前。', 'Opinion normally precedes origin.'),
      q('Choose the natural order.', 'a wooden dining table', 'a dining wooden table', 'A', '材料 wooden 通常放在用途 dining 之前。', 'Material wooden normally precedes purpose dining.')
    ]),
    lesson(english, 'adjective-nominal', '形容词的特殊用法', 'Special adjective structures', 'the + 形容词 · 数量表达 · 平行比较', 'the + adjective · measurement · parallel comparison', [
      e([['The rich', 'subject', 'the + 形容词作复数概念主语', 'the + adjective as plural subject'], ['should', 'helper', '情态动词', 'Modal verb'], ['help', 'predicate', '谓语动词', 'Predicate verb'], ['the poor.', 'object', 'the + 形容词作宾语', 'the + adjective as object']]),
      e([['The wall', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['two metres', 'adverbial', '度量状语', 'Measurement adverbial'], ['high.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['The more careful', 'object', '前置的比较级表语', 'Fronted comparative complement'], ['you', 'subject', '第一分句主语', 'First-clause subject'], ['are,', 'predicate', '第一分句系动词', 'First-clause linking verb'], ['the fewer mistakes', 'object', '前置的比较级宾语', 'Fronted comparative object'], ['you', 'subject', '第二分句主语', 'Second-clause subject'], ['make.', 'predicate', '第二分句谓语', 'Second-clause predicate']], 'translation', 'the more..., the fewer... 按“越……，越……”理解，两个比较级形成联动关系。', 'the more..., the fewer... expresses a linked “the more..., the less...” relationship.')
    ], [
      ['the + 形容词可表示一类人，通常具有复数意义，如 the elderly。', 'the + adjective can refer to a class of people and normally has plural meaning, as in the elderly.'],
      ['“数量 + 单位 + 形容词”表达尺寸。', 'Measurement + adjective expresses dimensions.'],
      ['the + 比较级..., the + 比较级... 表示联动变化。', 'the + comparative..., the + comparative... expresses linked change.']
    ], [
      q('The elderly ___ special care.', 'need', 'needs', 'A', 'the elderly 表示一类人，谓语用复数。', 'the elderly has plural meaning and takes need.'),
      q('The river is 200 metres ___.', 'wide', 'widely', 'A', '数量短语后用形容词 wide 表尺寸。', 'Use the adjective wide after a measurement.'),
      q('The harder you work, the ___ you become.', 'stronger', 'strongest', 'A', '联动比较结构两部分都用比较级。', 'Both halves of the correlative structure use comparatives.')
    ])
  ], '形容词', 'Adjectives', 7, [
    ['adjective-function', '作用与位置', 'Jobs and position', '先判断形容词修饰谁、在句中承担什么任务。', 'Identify what an adjective describes and the job it performs in the sentence.', ['adjective-jobs', 'adjective-position']],
    ['adjective-comparison', '程度与比较', 'Degree and comparison', '从可分级性出发，掌握比较级、最高级的形式和结构。', 'Start with gradability, then master comparative and superlative forms and structures.', ['adjective-degree', 'adjective-comparative-form', 'adjective-comparison', 'adjective-superlative']],
    ['adjective-advanced-forms', '形式辨析与特殊结构', 'Form choices and special structures', '处理分词形容词、多个形容词排序及名词化等特殊用法。', 'Handle participial adjectives, adjective order, nominal uses and other special structures.', ['participle-adjectives', 'adjective-order', 'adjective-nominal']]
  ]);
}

function buildAdverbCourse(english) {
  const e = (parts, mode = '', zh = '', en = '') => example(english, parts, mode, zh, en);
  const q = (...args) => question(english, ...args);
  return groupCourse(english, [
    lesson(english, 'adverb-jobs', '副词在句中做什么', 'What adverbs do', '修饰动词、形容词、副词或全句', 'Modify verbs, adjectives, adverbs or clauses', [
      e([['Mia', 'subject', '主语', 'Subject'], ['answered', 'predicate', '谓语动词', 'Predicate verb'], ['politely.', 'adverbial', '方式状语：修饰动词', 'Manner adverbial modifying verb']]),
      e([['The water', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['very', 'adverbial', '程度状语：修饰形容词', 'Degree adverbial modifying adjective'], ['cold.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['Fortunately,', 'adverbial', '评注性句子副词', 'Comment adverb modifying clause'], ['everyone', 'subject', '主语', 'Subject'], ['arrived', 'predicate', '谓语动词', 'Predicate verb'], ['safely.', 'adverbial', '方式状语', 'Manner adverbial']]),
      e([['He', 'subject', '主语', 'Subject'], ['finished', 'predicate', '谓语动词', 'Predicate verb'], ['the task', 'object', '宾语', 'Object'], ['remarkably', 'adverbial', '程度副词：修饰副词 quickly', 'Degree adverb modifying quickly'], ['quickly.', 'adverbial', '方式副词：修饰动词 finished', 'Manner adverb modifying finished']])
    ], [
      ['副词可以修饰动词，说明动作的方式等信息。', 'An adverb can modify a verb, for example to show manner.'],
      ['程度副词可以修饰形容词。', 'A degree adverb can modify an adjective.'],
      ['程度副词也可以修饰另一个副词。', 'A degree adverb can also modify another adverb.'],
      ['句子副词可以评价或限定整个句子。', 'A sentence adverb can comment on or qualify a whole clause.']
    ], [
      q('She spoke ___.', 'clearly', 'clear', 'A', 'clearly 修饰动词 spoke，作方式状语。', 'clearly modifies the verb spoke.'),
      q('The test is ___ easy.', 'quite', 'quiet', 'A', 'quite 是程度副词，修饰 easy。', 'quite is a degree adverb modifying easy.'),
      q('___, nobody was hurt.', 'Luckily', 'Lucky', 'A', 'Luckily 评价整个句子。', 'Luckily comments on the whole clause.'),
      q('She completed the work extremely ___.', 'carefully', 'careful', 'A', 'extremely 修饰副词 carefully；carefully 再修饰 completed。', 'extremely modifies the adverb carefully, which modifies completed.')
    ]),
    lesson(english, 'adverb-types', '副词有哪些类别', 'Types of adverbs', '时间、地点、方式、频率、程度', 'Time · place · manner · frequency · degree', [
      e([['We', 'subject', '主语', 'Subject'], ['will meet', 'predicate', '谓语动词', 'Predicate verb'], ['outside', 'adverbial', '地点状语', 'Place adverbial'], ['tomorrow.', 'adverbial', '时间状语', 'Time adverbial']], 'translation', '英语常把地点放在时间前；中文更常说“明天在外面见”。', 'English commonly places place before time; Chinese more often puts the time expression before the place expression.'),
      e([['She', 'subject', '主语', 'Subject'], ['often', 'adverbial', '频率状语', 'Frequency adverbial'], ['reads', 'predicate', '谓语动词', 'Predicate verb'], ['quietly', 'adverbial', '方式状语', 'Manner adverbial'], ['here.', 'adverbial', '地点状语', 'Place adverbial']]),
      e([['The bag', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['too', 'adverbial', '程度状语', 'Degree adverbial'], ['heavy.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['Fortunately,', 'adverbial', '评注性句子副词', 'Comment adverb'], ['the rain', 'subject', '主语', 'Subject'], ['stopped', 'predicate', '谓语动词', 'Predicate verb'], ['soon.', 'adverbial', '时间状语', 'Time adverbial']])
    ], [
      ['时间副词说明动作发生的时间。', 'Time adverbs say when an action happens.'],
      ['地点副词说明动作发生的地点或方向。', 'Place adverbs say where an action happens or points.'],
      ['方式副词说明动作怎样发生。', 'Manner adverbs say how an action happens.'],
      ['频率副词说明动作发生得多频繁。', 'Frequency adverbs say how often an action happens.'],
      ['程度副词说明性质、状态或动作的程度。', 'Degree adverbs express the degree of a quality, state or action.'],
      ['评注性副词表达说话者对全句的态度或判断。', 'Comment adverbs express the speaker’s attitude or judgment toward a whole clause.']
    ], [
      q('We met ___ yesterday.', 'there', 'very', 'A', 'there 是地点副词。', 'there is a place adverb.'),
      q('He ___ walks to school.', 'usually', 'careful', 'A', 'usually 是频率副词。', 'usually is a frequency adverb.'),
      q('The box is ___ small.', 'quite', 'outside', 'A', 'quite 是程度副词。', 'quite is a degree adverb.'),
      q('We will leave ___.', 'tomorrow', 'carefully', 'A', 'tomorrow 是时间副词。', 'tomorrow is a time adverb.'),
      q('She answered ___.', 'politely', 'yesterday', 'A', 'politely 是方式副词。', 'politely is a manner adverb.'),
      q('___, the key was still there.', 'Luckily', 'Outside', 'A', 'Luckily 是评价全句的评注性副词。', 'Luckily is a comment adverb modifying the whole clause.')
    ]),
    lesson(english, 'adverb-position', '副词放在哪里', 'Where adverbs go', '中位、句尾与句首', 'Mid, end and front positions', [
      e([['Lily', 'subject', '主语', 'Subject'], ['usually', 'adverbial', '频率状语：置于实义动词前', 'Frequency adverbial before main verb'], ['walks', 'predicate', '谓语动词', 'Predicate verb'], ['to school.', 'adverbial', '方向状语', 'Direction adverbial']]),
      e([['Lily', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['always', 'adverbial', '频率状语：置于 be 后', 'Frequency adverbial after be'], ['kind.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['Yesterday,', 'adverbial', '时间状语置于句首', 'Fronted time adverbial'], ['we', 'subject', '主语', 'Subject'], ['finished', 'predicate', '谓语动词', 'Predicate verb'], ['the work', 'object', '宾语', 'Object'], ['quickly.', 'adverbial', '方式状语置于句尾', 'End-position manner adverbial']]),
      e([['She', 'subject', '主语', 'Subject'], ['has', 'helper', '助动词', 'Auxiliary verb'], ['never', 'adverbial', '频率状语：置于第一个助动词后', 'Frequency adverbial after first auxiliary'], ['visited', 'predicate', '谓语动词', 'Predicate verb'], ['London.', 'object', '宾语', 'Object']])
    ], [
      ['频率副词通常放在实义动词前。', 'Frequency adverbs normally precede main verbs.'],
      ['频率副词通常放在 be 动词后。', 'Frequency adverbs normally follow be.'],
      ['有助动词时，频率副词通常放在第一个助动词后。', 'With auxiliaries, a frequency adverb normally follows the first auxiliary.'],
      ['方式副词常放在动词及其宾语之后。', 'A manner adverb often follows the verb and its object.'],
      ['时间副词可放句首或句尾；放在句首时常用逗号隔开。', 'A time adverb may come first or last; a fronted time adverb is commonly followed by a comma.']
    ], [
      q('Tom ___ gets up early.', 'often', 'gets often', 'A', 'often 通常放在实义动词 gets 前。', 'often normally comes before the main verb gets.'),
      q('She is ___ late.', 'never', 'late never', 'A', '频率副词置于 be 动词之后。', 'A frequency adverb follows be.'),
      q('He completed the task ___.', 'carefully', 'careful', 'A', '方式副词 carefully 常放在宾语之后。', 'The manner adverb carefully naturally follows the object.'),
      q('She has ___ seen snow.', 'never', 'seen never', 'A', 'never 放在第一个助动词 has 后。', 'never follows the first auxiliary has.'),
      q('Choose the natural time-adverb position.', 'Yesterday, we stayed home.', 'We yesterday stayed home.', 'A', '时间副词可置于句首，并用逗号隔开。', 'A time adverb can be fronted and followed by a comma.')
    ]),
    lesson(english, 'adjective-or-adverb', '形容词还是副词', 'Adjective or adverb?', '系动词、行为动词与同形词', 'Linking verbs, action verbs and flat adverbs', [
      e([['The flowers', 'subject', '主语', 'Subject'], ['smell', 'predicate', '系动词', 'Linking verb'], ['sweet.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['The child', 'subject', '主语', 'Subject'], ['smelled', 'predicate', '行为动词', 'Action verb'], ['the flower', 'object', '宾语', 'Object'], ['carefully.', 'adverbial', '方式状语', 'Manner adverbial']]),
      e([['The train', 'subject', '主语', 'Subject'], ['moves', 'predicate', '谓语动词', 'Predicate verb'], ['fast.', 'adverbial', '同形副词作方式状语', 'Flat adverb of manner']]),
      e([['Our new neighbour', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['friendly.', 'object', '以 -ly 结尾的形容词作表语', 'Adjective ending in -ly as complement']])
    ], [
      ['系动词后用形容词说明主语。', 'Use an adjective after a linking verb to describe the subject.'],
      ['行为动词通常由副词修饰。', 'Use an adverb to modify an action verb.'],
      ['fast、hard、late、early 等可直接作副词，不加 -ly。', 'fast, hard, late and early can be adverbs without -ly.'],
      ['friendly、lovely 等虽然以 -ly 结尾，却通常是形容词。', 'friendly and lovely end in -ly but are normally adjectives.']
    ], [
      q('The music sounds ___.', 'beautiful', 'beautifully', 'A', 'sound 作系动词，后用形容词。', 'sound is linking here and takes an adjective.'),
      q('She sings ___.', 'beautifully', 'beautiful', 'A', '副词 beautifully 修饰行为动词 sings。', 'beautifully modifies the action verb sings.'),
      q('He works ___.', 'hard', 'hardly', 'A', 'hard 可直接作副词，表示“努力地”。', 'hard is an adverb here meaning “with effort”.'),
      q('She gave me a ___ smile.', 'friendly', 'friendlily', 'A', 'friendly 是形容词，修饰名词 smile。', 'friendly is an adjective modifying smile.')
    ]),
    lesson(english, 'adverb-comparison', '副词也能比较吗', 'Comparing adverbs', '比较级、最高级与同级比较', 'Comparative, superlative and equality', [
      e([['Amy', 'subject', '主语', 'Subject'], ['runs', 'predicate', '谓语动词', 'Predicate verb'], ['faster', 'adverbial', '方式副词比较级', 'Comparative adverb of manner'], ['than Sue.', 'adverbial', '比较对象', 'Comparison phrase']]),
      e([['Ben', 'subject', '主语', 'Subject'], ['answered', 'predicate', '谓语动词', 'Predicate verb'], ['more carefully', 'adverbial', '方式副词比较级', 'Comparative adverb of manner'], ['than I did.', 'adverbial', '比较分句', 'Comparison clause']]),
      e([['Of all the runners,', 'adverbial', '比较范围', 'Comparison range'], ['Leo', 'subject', '主语', 'Subject'], ['ran', 'predicate', '谓语动词', 'Predicate verb'], ['the fastest.', 'adverbial', '方式副词最高级', 'Superlative adverb of manner']]),
      e([['Nora', 'subject', '主语', 'Subject'], ['performed', 'predicate', '谓语动词', 'Predicate verb'], ['better', 'adverbial', '不规则副词比较级', 'Irregular comparative adverb'], ['than before.', 'adverbial', '比较对象', 'Comparison phrase']])
    ], [
      ['短副词常加 -er/-est 构成比较级和最高级。', 'Short adverbs often add -er/-est to form comparatives and superlatives.'],
      ['多数 -ly 副词用 more/most 构成比较级和最高级。', 'Most -ly adverbs form comparison with more/most.'],
      ['well–better–best、badly–worse–worst 等是不规则变化。', 'Forms such as well–better–best and badly–worse–worst are irregular.']
    ], [
      q('Jane speaks ___ than before.', 'more clearly', 'clearlier', 'A', '-ly 副词通常用 more 构成比较级。', 'An -ly adverb normally forms its comparative with more.'),
      q('Tom runs ___ of the three.', 'the fastest', 'faster', 'A', '三者范围使用副词最高级。', 'Use the adverb superlative for a group of three.'),
      q('She did ___ than yesterday.', 'better', 'more well', 'A', 'well 的比较级是不规则形式 better。', 'better is the irregular comparative of well.')
    ]),
    lesson(english, 'degree-patterns', '程度副词怎样搭配', 'Degree adverb patterns', 'enough · too · so · such', 'enough · too · so · such', [
      e([['The room', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['warm', 'object', '形容词作表语', 'Adjective complement'], ['enough', 'adverbial', '后置程度状语', 'Postposed degree adverbial'], ['for the baby.', 'adverbial', '对象状语', 'Reference phrase']]),
      e([['The box', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['too', 'adverbial', '程度状语', 'Degree adverbial'], ['heavy', 'object', '形容词作表语', 'Adjective complement'], ['for me to lift.', 'adverbial', '动作执行者与结果结构', 'Agent and infinitive result']]),
      e([['It', 'subject', '形式主语', 'Dummy subject'], ['was', 'predicate', '系动词', 'Linking verb'], ['such', 'attribute', '程度限定词', 'Degree predeterminer'], ['a', 'attribute', '冠词', 'Article'], ['difficult', 'attribute', '形容词作前置定语', 'Prepositive adjective'], ['question', 'object', '表语中心词', 'Complement head'], ['that nobody answered it.', 'adverbial', '结果状语从句', 'Result clause']]),
      e([['The question', 'subject', '主语', 'Subject'], ['was', 'predicate', '系动词', 'Linking verb'], ['so', 'adverbial', '程度状语', 'Degree adverbial'], ['difficult', 'object', '形容词作表语', 'Adjective complement'], ['that nobody answered it.', 'adverbial', '结果状语从句', 'Result clause']])
    ], [
      ['enough 修饰形容词或副词时放在其后。', 'enough follows the adjective or adverb it modifies.'],
      ['too 放在形容词或副词前，常表示“过于……而不能……”。', 'too precedes an adjective or adverb and often means “excessively...to...”.'],
      ['so 修饰形容词或副词，如 so difficult。', 'so modifies an adjective or adverb, as in so difficult.'],
      ['such 修饰名词短语，如 such a difficult task。', 'such modifies a noun phrase, as in such a difficult task.']
    ], [
      q('She is old ___ to travel alone.', 'enough', 'too', 'A', 'enough 修饰形容词时放在其后。', 'enough follows the adjective it modifies.'),
      q('The water is ___ hot to drink.', 'too', 'enough', 'A', 'too...to 表示过热而不能喝。', 'too...to means excessively hot to drink.'),
      q('It was ___ an exciting match.', 'such', 'so', 'A', 'an exciting match 是名词短语，前用 such。', 'Use such before the noun phrase an exciting match.'),
      q('The film was ___ exciting that we watched it twice.', 'so', 'such', 'A', 'exciting 是形容词，前用 so。', 'exciting is an adjective, so use so.')
    ]),
    lesson(english, 'adverb-scope', '副词修饰范围会改变意思', 'Adverb scope changes meaning', 'only · even · almost · 句子副词', 'only · even · almost · sentence adverbs', [
      e([['Only Mia', 'subject', 'only 限定主语', 'only focusing the subject'], ['solved', 'predicate', '谓语动词', 'Predicate verb'], ['the puzzle.', 'object', '宾语', 'Object']], 'translation', 'Only Mia 表示“只有米娅（别人没有）”，only 的位置决定被限定的信息。', 'Only Mia means Mia and nobody else; the position of only determines its focus.'),
      e([['Mia', 'subject', '主语', 'Subject'], ['only solved', 'predicate', 'only 限定动作', 'only focusing the action'], ['the puzzle.', 'object', '宾语', 'Object']], 'translation', 'only solved 强调“只解出了”，没有做更多事情；与 Only Mia 的焦点不同。', 'only solved focuses on the action and differs from Only Mia.'),
      e([['Frankly,', 'adverbial', '评注性句子副词', 'Comment sentence adverb'], ['the plan', 'subject', '主语', 'Subject'], ['will', 'helper', '助动词', 'Auxiliary verb'], ['probably', 'adverbial', '可能性状语', 'Probability adverbial'], ['fail.', 'predicate', '谓语动词', 'Predicate verb']]),
      e([['Even', 'adverbial', '聚焦副词：强调出乎意料', 'Focusing adverb marking surprise'], ['Ben', 'subject', '主语', 'Subject'], ['almost', 'adverbial', '接近程度副词', 'Approximating adverb'], ['missed', 'predicate', '谓语动词', 'Predicate verb'], ['the bus.', 'object', '宾语', 'Object']])
    ], [
      ['only 应尽量靠近被限定成分，位置变化可能改变句意。', 'only should stand near its focus; a position change can alter meaning.'],
      ['句子副词表达说话者态度、判断或把握程度，作用范围是全句。', 'Sentence adverbs express the speaker’s attitude, judgment or certainty and scope over the clause.'],
      ['even 强调出乎意料的焦点。', 'even marks an unexpected focus.'],
      ['almost 表示某事接近发生但实际没有发生。', 'almost says an event came close to happening but did not.']
    ], [
      q(['哪一句表示“只有李华通过了考试”？', 'Which sentence means that Li Hua—and nobody else—passed the exam?'], 'Only Li Hua passed the exam.', 'Li Hua only passed the exam.', 'A', 'only 紧靠 Li Hua，限定“谁”。', 'only next to Li Hua focuses on who passed.'),
      q('___, I disagree with the decision.', 'Honestly', 'Honest', 'A', 'Honestly 是评注性句子副词。', 'Honestly is a comment adverb modifying the clause.'),
      q('She ___ missed the bus; she arrived just in time.', 'almost', 'always', 'A', 'almost missed 表示“差点错过但没有”。', 'almost missed means it nearly happened but did not.'),
      q('___ Ben understood the difficult puzzle.', 'Even', 'Very', 'A', 'Even 聚焦 Ben，强调结果出乎预料。', 'Even focuses Ben and marks the result as unexpected.')
    ]),
    lesson(english, 'adverb-traps', '易混副词与连接副词', 'Adverb traps and linking adverbs', 'hard/hardly · late/lately · however/therefore', 'hard/hardly · late/lately · however/therefore', [
      e([['He', 'subject', '主语', 'Subject'], ['works', 'predicate', '谓语动词', 'Predicate verb'], ['hard', 'adverbial', '方式状语：努力地', 'Manner adverb: with effort'], ['every day.', 'adverbial', '时间状语', 'Time adverbial']]),
      e([['I', 'subject', '主语', 'Subject'], ['have', 'helper', '助动词', 'Auxiliary verb'], ['hardly', 'adverbial', '近乎否定的频度状语', 'Near-negative frequency adverbial'], ['seen', 'predicate', '谓语动词', 'Predicate verb'], ['her', 'object', '宾语', 'Object'], ['lately.', 'adverbial', '时间状语：最近', 'Time adverb: recently']]),
      e([['The road', 'subject', '第一分句主语', 'First-clause subject'], ['was', 'predicate', '第一分句系动词', 'First-clause linking verb'], ['closed;', 'object', '第一分句表语', 'First-clause complement'], ['therefore,', 'adverbial', '连接副词：表示结果', 'Linking adverb: result'], ['we', 'subject', '第二分句主语', 'Second-clause subject'], ['took', 'predicate', '第二分句谓语', 'Second-clause predicate'], ['another route.', 'object', '第二分句宾语', 'Second-clause object']]),
      e([['The task', 'subject', '第一分句主语', 'First-clause subject'], ['was', 'predicate', '第一分句系动词', 'First-clause linking verb'], ['difficult;', 'object', '第一分句表语', 'First-clause complement'], ['however,', 'adverbial', '连接副词：表示转折', 'Linking adverb: contrast'], ['we', 'subject', '第二分句主语', 'Second-clause subject'], ['finished', 'predicate', '第二分句谓语', 'Second-clause predicate'], ['it.', 'object', '第二分句宾语', 'Second-clause object']])
    ], [
      ['hard 是“努力地/猛烈地”，hardly 是“几乎不”。', 'hard means “with effort/intensely”, while hardly means “almost not”.'],
      ['late 是“迟”，lately 是“最近”。', 'late means “after the expected time”, while lately means “recently”.'],
      ['therefore 表示结果，however 表示转折；它们是连接副词，不是并列连词。', 'therefore marks a result and however a contrast; they are linking adverbs, not coordinating conjunctions.'],
      ['连接副词连接两个独立分句时，前面通常用分号或句号，其后用逗号。', 'When a linking adverb connects independent clauses, it normally follows a semicolon or period and is followed by a comma.']
    ], [
      q('She studies ___.', 'hard', 'hardly', 'A', 'hard 表示“努力地”。', 'hard means “with effort”.'),
      q('Have you seen Tom ___?', 'lately', 'late', 'A', 'lately 表示“最近”。', 'lately means “recently”.'),
      q('The shop was closed; ___, we went home.', 'therefore', 'because', 'A', 'therefore 是表示结果的连接副词。', 'therefore is a linking adverb marking a result.'),
      q('Choose the correctly punctuated contrast.', 'It was raining; however, we left.', 'It was raining, however we left.', 'A', '两个独立分句之间用分号，however 后用逗号。', 'Use a semicolon between the independent clauses and a comma after however.')
    ])
  ], '副词', 'Adverbs', 6, [
    ['adverb-function', '作用、类别与位置', 'Jobs, types and position', '先确定副词修饰范围，再按意义类别判断常见位置。', 'Identify an adverb’s scope, then use its meaning class to judge its usual position.', ['adverb-jobs', 'adverb-types', 'adverb-position']],
    ['adverb-form-degree', '形副辨析与程度比较', 'Adjective–adverb form and degree', '辨清形容词与副词形式，掌握比较和程度结构。', 'Distinguish adjective and adverb forms, then master comparison and degree patterns.', ['adjective-or-adverb', 'adverb-comparison', 'degree-patterns']],
    ['adverb-scope-linking', '范围、语义与连接', 'Scope, meaning and linking', '进阶处理聚焦范围、易混副词和连接副词。', 'Handle focus scope, easily confused adverbs and linking adverbs.', ['adverb-scope', 'adverb-traps']]
  ]);
}

module.exports = { buildAdjectiveCourse, buildAdverbCourse };
