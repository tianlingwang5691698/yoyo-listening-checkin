const pick = (english, zh, en) => english ? en : zh;
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
function lesson(english, id, zhTitle, enTitle, zhMeta, enMeta, examples, rules, questions) {
  return {
    id,
    title: pick(english, zhTitle, enTitle),
    meta: pick(english, zhMeta, enMeta),
    examples: examples.map((item) => item.text),
    analyses: examples.map((item) => item.analysis),
    exampleNotes: examples.map((item) => item.note),
    rules: rules.map((item) => pick(english, item[0], item[1])),
    questions
  };
}
function groupCourse(english, lessons, zhTitle, enTitle, coreCount) {
  const course = lessons.map((item, index) => Object.assign({}, item, {
    no: String(index + 1).padStart(2, '0'),
    level: index < coreCount ? 'core' : 'advanced'
  }));
  return {
    title: pick(english, `${zhTitle} · ${course.length} 节微课`, `${enTitle} · ${course.length} lessons`),
    copy: pick(english, '先掌握核心规则，再处理复杂语境。', 'Master the core rules, then handle complex contexts.'),
    course,
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
      e([['I', 'subject', '主语', 'Subject'], ['need', 'predicate', '谓语动词', 'Predicate verb'], ['something', 'object', '宾语中心词', 'Object head'], ['useful.', 'attribute', '形容词作后置定语', 'Postpositive adjective'] ], 'translation', '形容词 useful 在英语中放在不定代词 something 后，中文通常前移为“有用的东西”。', 'useful follows the indefinite pronoun in English; Chinese moves it before 东西.'),
      e([['The students', 'subject', '主语', 'Subject'], ['present', 'attribute', '形容词作后置定语', 'Postpositive adjective'], ['were', 'predicate', '系动词', 'Linking verb'], ['quiet.', 'object', '形容词作表语', 'Adjective complement']], 'translation', 'present 后置表示“在场的”，中文通常译为“在场的学生”。', 'present follows students meaning “in attendance”; Chinese places 在场的 before 学生.')
    ], [
      ['单个形容词作定语通常放在名词前。', 'A single attributive adjective normally comes before its noun.'],
      ['形容词修饰 something、anything、nothing 等不定代词时必须后置；部分固定意义也要求后置。', 'An adjective must follow indefinite pronouns such as something, anything and nothing; some fixed meanings are also postpositive.']
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
      e([['This', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['the most useful', 'attribute', '形容词最高级作前置定语', 'Superlative attribute'], ['tool', 'object', '表语中心词', 'Complement head'], ['here.', 'adverbial', '地点状语', 'Place adverbial']])
    ], [
      ['短词通常加 -er/-est；重读闭音节双写末字母；辅音字母+y 变 y 为 i；长词通常用 more/most。', 'Short adjectives usually add -er/-est; stressed CVC forms double the final consonant; consonant+y changes y to i; long adjectives usually use more/most.'],
      ['good–better–best、bad–worse–worst、many/much–more–most 要单独记忆。', 'Memorize good–better–best, bad–worse–worst and many/much–more–most.']
    ], [
      q(['happy 的比较级是 ___。', 'The comparative of happy is ___.'], 'happier', 'more happy', 'A', '辅音字母+y 变 y 为 i，再加 er。', 'Consonant+y changes to i before -er.'),
      q(['useful 的最高级是 ___。', 'The superlative of useful is ___.'], 'the most useful', 'the usefulest', 'A', '多音节形容词通常用 most。', 'A long adjective normally uses most.'),
      q(['good 的比较级是 ___。', 'The comparative of good is ___.'], 'better', 'gooder', 'A', 'good 的比较级是不规则形式 better。', 'better is the irregular comparative of good.')
    ]),
    lesson(english, 'adjective-comparison', '怎样比较两个对象', 'Comparing two things', 'than · as...as · less', 'than · as...as · less', [
      e([['Leo', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['taller', 'object', '形容词比较级作表语', 'Comparative complement'], ['than Max.', 'adverbial', '比较对象', 'Comparison phrase']]),
      e([['This box', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['as', 'adverbial', '同级程度标记', 'Equality degree marker'], ['heavy', 'object', '形容词原级作表语', 'Base adjective complement'], ['as that one.', 'adverbial', '比较对象', 'Comparison phrase']]),
      e([['The blue route', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['less', 'adverbial', '较低程度标记', 'Lower-degree marker'], ['dangerous', 'object', '形容词原级作表语', 'Base adjective complement'], ['than the red route.', 'adverbial', '比较对象', 'Comparison phrase']])
    ], [
      ['比较级 + than 表示一方程度更高；as + 原级 + as 表示程度相同。', 'Comparative + than shows a higher degree; as + base adjective + as shows equality.'],
      ['less + 原级 + than 表示一方程度较低；比较对象必须在逻辑上同类。', 'less + base adjective + than shows a lower degree; compare logically equivalent things.']
    ], [
      q('My room is ___ than yours.', 'larger', 'large', 'A', 'than 前使用比较级 larger。', 'Use the comparative larger before than.'),
      q('Ben is as ___ as Sam.', 'careful', 'more careful', 'A', 'as...as 中使用形容词原级。', 'Use the base adjective inside as...as.'),
      q('This plan is ___ expensive than that one.', 'less', 'least', 'A', 'less...than 表示程度较低。', 'less...than expresses a lower degree.')
    ]),
    lesson(english, 'adjective-superlative', '怎样在三者以上选最高', 'Choosing the highest degree', '最高级 · 范围 · 序数词', 'Superlative · range · ordinal', [
      e([['Mia', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['the tallest', 'object', '形容词最高级作表语', 'Superlative complement'], ['in her class.', 'adverbial', '比较范围', 'Comparison range']]),
      e([['This', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['the most exciting game', 'object', '最高级修饰表语中心词', 'Superlative modifying complement'], ['of the three.', 'adverbial', '比较范围', 'Comparison range']]),
      e([['The Yellow River', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['the second longest river', 'object', '序数词 + 最高级作表语', 'Ordinal + superlative complement'], ['in China.', 'adverbial', '地点兼比较范围', 'Place and comparison range']])
    ], [
      ['三者或以上比较通常用最高级，并用 in/of 短语交代范围。', 'Use the superlative for three or more, usually with an in/of range.'],
      ['最高级前通常有 the；“第几最……”用序数词 + 最高级。', 'Superlatives normally take the; use ordinal + superlative for rankings.']
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
      ['-ing 形容词通常说明人或事物“令人产生某种感受”；-ed 形容词通常说明人“感到……”。', '-ing adjectives usually describe what causes a feeling; -ed adjectives usually describe the experiencer.'],
      ['选择形式要看被描述对象的语义角色，不只看它是人还是物。', 'Choose by semantic role, not simply whether the noun is a person or thing.']
    ], [
      q('The film was ___.', 'exciting', 'excited', 'A', '电影带来兴奋感，用 exciting。', 'The film causes excitement, so use exciting.'),
      q('We were ___ by the result.', 'surprised', 'surprising', 'A', 'we 是感受者，用 surprised。', 'We experience the feeling, so use surprised.'),
      q('The ___ audience cheered loudly.', 'excited', 'exciting', 'A', '观众感到兴奋，用 excited。', 'The audience experiences excitement.')
    ]),
    lesson(english, 'adjective-order', '多个形容词怎样排序', 'Ordering multiple adjectives', '限定、评价、大小、年龄、颜色、来源、材料、用途', 'Determiner · opinion · size · age · color · origin · material · purpose', [
      e([['She', 'subject', '主语', 'Subject'], ['bought', 'predicate', '谓语动词', 'Predicate verb'], ['a lovely small old house.', 'object', '宾语：评价 + 大小 + 年龄 + 名词', 'Object: opinion + size + age + noun']]),
      e([['He', 'subject', '主语', 'Subject'], ['wears', 'predicate', '谓语动词', 'Predicate verb'], ['a new black Italian coat.', 'object', '宾语：年龄 + 颜色 + 来源 + 名词', 'Object: age + color + origin + noun']]),
      e([['We', 'subject', '主语', 'Subject'], ['sat at', 'predicate', '谓语与介词', 'Predicate and preposition'], ['a beautiful round wooden table.', 'object', '介词宾语：评价 + 形状 + 材料 + 名词', 'Prepositional object: opinion + shape + material + noun']])
    ], [
      ['常见顺序为：限定词—评价—大小—形状—年龄—颜色—来源—材料—用途—名词。', 'A common order is determiner–opinion–size–shape–age–color–origin–material–purpose–noun.'],
      ['真实表达通常只用少量形容词；排序规则用于判断自然语序，不鼓励堆砌。', 'Natural writing usually uses only a few adjectives; the order guides natural phrasing, not adjective piling.']
    ], [
      q('Choose the natural order.', 'a beautiful old stone bridge', 'a stone old beautiful bridge', 'A', '评价在前，年龄居中，材料靠近名词。', 'Opinion comes first; material stays closest to the noun.'),
      q('Choose the natural order.', 'a small red bag', 'a red small bag', 'A', '大小通常在颜色之前。', 'Size normally precedes color.'),
      q('Choose the natural order.', 'an expensive Japanese camera', 'a Japanese expensive camera', 'A', '评价通常在来源之前。', 'Opinion normally precedes origin.')
    ]),
    lesson(english, 'adjective-nominal', '形容词的特殊用法', 'Special adjective structures', 'the + 形容词 · 数量表达 · 平行比较', 'the + adjective · measurement · parallel comparison', [
      e([['The rich', 'subject', 'the + 形容词作复数概念主语', 'the + adjective as plural subject'], ['should', 'helper', '情态动词', 'Modal verb'], ['help', 'predicate', '谓语动词', 'Predicate verb'], ['the poor.', 'object', 'the + 形容词作宾语', 'the + adjective as object']]),
      e([['The wall', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['two metres', 'adverbial', '度量状语', 'Measurement adverbial'], ['high.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['The more careful', 'object', '前置的比较级表语', 'Fronted comparative complement'], ['you', 'subject', '第一分句主语', 'First-clause subject'], ['are,', 'predicate', '第一分句系动词', 'First-clause linking verb'], ['the fewer mistakes', 'object', '前置的比较级宾语', 'Fronted comparative object'], ['you', 'subject', '第二分句主语', 'Second-clause subject'], ['make.', 'predicate', '第二分句谓语', 'Second-clause predicate']], 'translation', 'the more..., the fewer... 按“越……，越……”理解，两个比较级形成联动关系。', 'the more..., the fewer... expresses a linked “the more..., the less...” relationship.')
    ], [
      ['the + 形容词可表示一类人，通常具有复数意义，如 the elderly。', 'the + adjective can refer to a class of people and normally has plural meaning, as in the elderly.'],
      ['“数量 + 单位 + 形容词”表达尺寸；the + 比较级..., the + 比较级... 表示联动变化。', 'Measurement + adjective expresses dimensions; the + comparative..., the + comparative... expresses linked change.']
    ], [
      q('The elderly ___ special care.', 'need', 'needs', 'A', 'the elderly 表示一类人，谓语用复数。', 'the elderly has plural meaning and takes need.'),
      q('The river is 200 metres ___.', 'wide', 'widely', 'A', '数量短语后用形容词 wide 表尺寸。', 'Use the adjective wide after a measurement.'),
      q('The harder you work, the ___ you become.', 'stronger', 'strongest', 'A', '联动比较结构两部分都用比较级。', 'Both halves of the correlative structure use comparatives.')
    ])
  ], '形容词', 'Adjectives', 7);
}

function buildAdverbCourse(english) {
  const e = (parts, mode = '', zh = '', en = '') => example(english, parts, mode, zh, en);
  const q = (...args) => question(english, ...args);
  return groupCourse(english, [
    lesson(english, 'adverb-jobs', '副词在句中做什么', 'What adverbs do', '修饰动词、形容词、副词或全句', 'Modify verbs, adjectives, adverbs or clauses', [
      e([['Mia', 'subject', '主语', 'Subject'], ['answered', 'predicate', '谓语动词', 'Predicate verb'], ['politely.', 'adverbial', '方式状语：修饰动词', 'Manner adverbial modifying verb']]),
      e([['The water', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['very', 'adverbial', '程度状语：修饰形容词', 'Degree adverbial modifying adjective'], ['cold.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['Fortunately,', 'adverbial', '评注性句子副词', 'Comment adverb modifying clause'], ['everyone', 'subject', '主语', 'Subject'], ['arrived', 'predicate', '谓语动词', 'Predicate verb'], ['safely.', 'adverbial', '方式状语', 'Manner adverbial']])
    ], [
      ['副词主要修饰动词、形容词、其他副词或整个句子。', 'Adverbs mainly modify verbs, adjectives, other adverbs or whole clauses.'],
      ['判断副词作用时，要先找它具体修饰的词或范围。', 'Identify the exact word or scope an adverb modifies.']
    ], [
      q('She spoke ___.', 'clearly', 'clear', 'A', 'clearly 修饰动词 spoke，作方式状语。', 'clearly modifies the verb spoke.'),
      q('The test is ___ easy.', 'quite', 'quiet', 'A', 'quite 是程度副词，修饰 easy。', 'quite is a degree adverb modifying easy.'),
      q('___, nobody was hurt.', 'Luckily', 'Lucky', 'A', 'Luckily 评价整个句子。', 'Luckily comments on the whole clause.')
    ]),
    lesson(english, 'adverb-types', '副词有哪些类别', 'Types of adverbs', '时间、地点、方式、频率、程度', 'Time · place · manner · frequency · degree', [
      e([['We', 'subject', '主语', 'Subject'], ['will meet', 'predicate', '谓语动词', 'Predicate verb'], ['outside', 'adverbial', '地点状语', 'Place adverbial'], ['tomorrow.', 'adverbial', '时间状语', 'Time adverbial']], 'translation', '英语常把地点放在时间前；中文更常说“明天在外面见”。', 'English commonly places place before time; Chinese more often puts 明天 before the place phrase.'),
      e([['She', 'subject', '主语', 'Subject'], ['often', 'adverbial', '频率状语', 'Frequency adverbial'], ['reads', 'predicate', '谓语动词', 'Predicate verb'], ['quietly', 'adverbial', '方式状语', 'Manner adverbial'], ['here.', 'adverbial', '地点状语', 'Place adverbial']]),
      e([['The bag', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['too', 'adverbial', '程度状语', 'Degree adverbial'], ['heavy.', 'object', '形容词作表语', 'Adjective complement']])
    ], [
      ['副词按意义可分时间、地点、方式、频率、程度和评注等类别。', 'By meaning, adverbs include time, place, manner, frequency, degree and comment adverbs.'],
      ['类别决定常见位置，但信息重点和语境也会影响语序。', 'Type influences normal position, though information focus and context can change order.']
    ], [
      q('We met ___ yesterday.', 'there', 'very', 'A', 'there 是地点副词。', 'there is a place adverb.'),
      q('He ___ walks to school.', 'usually', 'careful', 'A', 'usually 是频率副词。', 'usually is a frequency adverb.'),
      q('The box is ___ small.', 'quite', 'outside', 'A', 'quite 是程度副词。', 'quite is a degree adverb.')
    ]),
    lesson(english, 'adverb-position', '副词放在哪里', 'Where adverbs go', '中位、句尾与句首', 'Mid, end and front positions', [
      e([['Lily', 'subject', '主语', 'Subject'], ['usually', 'adverbial', '频率状语：置于实义动词前', 'Frequency adverbial before main verb'], ['walks', 'predicate', '谓语动词', 'Predicate verb'], ['to school.', 'adverbial', '方向状语', 'Direction adverbial']]),
      e([['Lily', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['always', 'adverbial', '频率状语：置于 be 后', 'Frequency adverbial after be'], ['kind.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['Yesterday,', 'adverbial', '时间状语置于句首', 'Fronted time adverbial'], ['we', 'subject', '主语', 'Subject'], ['finished', 'predicate', '谓语动词', 'Predicate verb'], ['the work', 'object', '宾语', 'Object'], ['quickly.', 'adverbial', '方式状语置于句尾', 'End-position manner adverbial']])
    ], [
      ['频率副词通常放在实义动词前、be 动词后；有助动词时常放在第一个助动词后。', 'Frequency adverbs normally precede main verbs, follow be, and come after the first auxiliary.'],
      ['方式副词常放句尾；时间副词可放句首或句尾，句首时常用逗号隔开。', 'Manner adverbs often come at the end; time adverbs may be fronted or placed at the end, usually with a comma when fronted.']
    ], [
      q('Tom ___ gets up early.', 'often', 'gets often', 'A', 'often 通常放在实义动词 gets 前。', 'often normally comes before the main verb gets.'),
      q('She is ___ late.', 'never', 'late never', 'A', '频率副词置于 be 动词之后。', 'A frequency adverb follows be.'),
      q('He completed the task ___.', 'carefully', 'careful', 'A', '方式副词 carefully 常放句尾。', 'The manner adverb carefully naturally comes at the end.')
    ]),
    lesson(english, 'adjective-or-adverb', '形容词还是副词', 'Adjective or adverb?', '系动词、行为动词与同形词', 'Linking verbs, action verbs and flat adverbs', [
      e([['The flowers', 'subject', '主语', 'Subject'], ['smell', 'predicate', '系动词', 'Linking verb'], ['sweet.', 'object', '形容词作表语', 'Adjective complement']]),
      e([['The child', 'subject', '主语', 'Subject'], ['smelled', 'predicate', '行为动词', 'Action verb'], ['the flower', 'object', '宾语', 'Object'], ['carefully.', 'adverbial', '方式状语', 'Manner adverbial']]),
      e([['The train', 'subject', '主语', 'Subject'], ['moves', 'predicate', '谓语动词', 'Predicate verb'], ['fast.', 'adverbial', '同形副词作方式状语', 'Flat adverb of manner']])
    ], [
      ['系动词后用形容词说明主语；行为动词通常由副词修饰。', 'Use an adjective after a linking verb to describe the subject; use an adverb to modify an action verb.'],
      ['fast、hard、late、early 等可直接作副词，不加 -ly；friendly、lovely 虽以 -ly 结尾却通常是形容词。', 'fast, hard, late and early can be adverbs without -ly; friendly and lovely end in -ly but are normally adjectives.']
    ], [
      q('The music sounds ___.', 'beautiful', 'beautifully', 'A', 'sound 作系动词，后用形容词。', 'sound is linking here and takes an adjective.'),
      q('She sings ___.', 'beautifully', 'beautiful', 'A', '副词 beautifully 修饰行为动词 sings。', 'beautifully modifies the action verb sings.'),
      q('He works ___.', 'hard', 'hardly', 'A', 'hard 表示“努力地”；hardly 表示“几乎不”。', 'hard means “with effort”; hardly means “almost not”.')
    ]),
    lesson(english, 'adverb-comparison', '副词也能比较吗', 'Comparing adverbs', '比较级、最高级与同级比较', 'Comparative, superlative and equality', [
      e([['Amy', 'subject', '主语', 'Subject'], ['runs', 'predicate', '谓语动词', 'Predicate verb'], ['faster', 'adverbial', '方式副词比较级', 'Comparative adverb of manner'], ['than Sue.', 'adverbial', '比较对象', 'Comparison phrase']]),
      e([['Ben', 'subject', '主语', 'Subject'], ['answered', 'predicate', '谓语动词', 'Predicate verb'], ['more carefully', 'adverbial', '方式副词比较级', 'Comparative adverb of manner'], ['than I did.', 'adverbial', '比较分句', 'Comparison clause']]),
      e([['Of all the runners,', 'adverbial', '比较范围', 'Comparison range'], ['Leo', 'subject', '主语', 'Subject'], ['ran', 'predicate', '谓语动词', 'Predicate verb'], ['the fastest.', 'adverbial', '方式副词最高级', 'Superlative adverb of manner']])
    ], [
      ['短副词常加 -er/-est；多数 -ly 副词用 more/most；well–better–best、badly–worse–worst 不规则。', 'Short adverbs often add -er/-est; most -ly adverbs use more/most; well–better–best and badly–worse–worst are irregular.'],
      ['副词最高级前的 the 有时可省略，但教学和正式表达中保留通常更清晰。', 'the may sometimes be omitted before an adverb superlative, but retaining it is often clearer in teaching and formal use.']
    ], [
      q('Jane speaks ___ than before.', 'more clearly', 'clearlier', 'A', '-ly 副词通常用 more 构成比较级。', 'An -ly adverb normally forms its comparative with more.'),
      q('Tom runs ___ of the three.', 'the fastest', 'faster', 'A', '三者范围使用副词最高级。', 'Use the adverb superlative for a group of three.'),
      q('She did ___ than yesterday.', 'better', 'more well', 'A', 'well 的比较级是不规则形式 better。', 'better is the irregular comparative of well.')
    ]),
    lesson(english, 'degree-patterns', '程度副词怎样搭配', 'Degree adverb patterns', 'enough · too · so · such', 'enough · too · so · such', [
      e([['The room', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['warm', 'object', '形容词作表语', 'Adjective complement'], ['enough', 'adverbial', '后置程度状语', 'Postposed degree adverbial'], ['for the baby.', 'adverbial', '对象状语', 'Reference phrase']]),
      e([['The box', 'subject', '主语', 'Subject'], ['is', 'predicate', '系动词', 'Linking verb'], ['too', 'adverbial', '程度状语', 'Degree adverbial'], ['heavy', 'object', '形容词作表语', 'Adjective complement'], ['for me to lift.', 'adverbial', '动作执行者与结果结构', 'Agent and infinitive result']]),
      e([['It', 'subject', '形式主语', 'Dummy subject'], ['was', 'predicate', '系动词', 'Linking verb'], ['such', 'attribute', '程度限定词', 'Degree predeterminer'], ['a', 'attribute', '冠词', 'Article'], ['difficult', 'attribute', '形容词作前置定语', 'Prepositive adjective'], ['question', 'object', '表语中心词', 'Complement head'], ['that nobody answered it.', 'adverbial', '结果状语从句', 'Result clause']])
    ], [
      ['enough 修饰形容词或副词时后置；too 放在形容词或副词前，常表示“过于……而不能……”。', 'enough follows an adjective or adverb; too precedes it and often means “excessively...to...”.'],
      ['so 修饰形容词/副词，such 修饰名词短语：so difficult，such a difficult task。', 'so modifies adjectives/adverbs; such modifies noun phrases: so difficult, such a difficult task.']
    ], [
      q('She is old ___ to travel alone.', 'enough', 'too', 'A', 'enough 修饰形容词时放在其后。', 'enough follows the adjective it modifies.'),
      q('The water is ___ hot to drink.', 'too', 'enough', 'A', 'too...to 表示过热而不能喝。', 'too...to means excessively hot to drink.'),
      q('It was ___ an exciting match.', 'such', 'so', 'A', 'an exciting match 是名词短语，前用 such。', 'Use such before the noun phrase an exciting match.')
    ]),
    lesson(english, 'adverb-scope', '副词修饰范围会改变意思', 'Adverb scope changes meaning', 'only · even · almost · 句子副词', 'only · even · almost · sentence adverbs', [
      e([['Only Mia', 'subject', 'only 限定主语', 'only focusing the subject'], ['solved', 'predicate', '谓语动词', 'Predicate verb'], ['the puzzle.', 'object', '宾语', 'Object']], 'translation', 'Only Mia 表示“只有米娅（别人没有）”，only 的位置决定被限定的信息。', 'Only Mia means Mia and nobody else; the position of only determines its focus.'),
      e([['Mia', 'subject', '主语', 'Subject'], ['only solved', 'predicate', 'only 限定动作', 'only focusing the action'], ['the puzzle.', 'object', '宾语', 'Object']], 'translation', 'only solved 强调“只解出了”，没有做更多事情；与 Only Mia 的焦点不同。', 'only solved focuses on the action and differs from Only Mia.'),
      e([['Frankly,', 'adverbial', '评注性句子副词', 'Comment sentence adverb'], ['the plan', 'subject', '主语', 'Subject'], ['will', 'helper', '助动词', 'Auxiliary verb'], ['probably', 'adverbial', '可能性状语', 'Probability adverbial'], ['fail.', 'predicate', '谓语动词', 'Predicate verb']])
    ], [
      ['only、even、almost 等聚焦副词应尽量靠近被修饰成分，位置变化可能改变意思。', 'Focusing adverbs such as only, even and almost should stand near their focus; position can change meaning.'],
      ['句子副词表达说话者态度、判断或把握程度，作用范围是全句。', 'Sentence adverbs express the speaker’s attitude, judgment or certainty and scope over the clause.']
    ], [
      q(['哪一句表示“只有李华通过了考试”？', 'Which sentence means that Li Hua—and nobody else—passed the exam?'], 'Only Li Hua passed the exam.', 'Li Hua only passed the exam.', 'A', 'only 紧靠 Li Hua，限定“谁”。', 'only next to Li Hua focuses on who passed.'),
      q('___, I disagree with the decision.', 'Honestly', 'Honest', 'A', 'Honestly 是评注性句子副词。', 'Honestly is a comment adverb modifying the clause.'),
      q('She ___ missed the bus; she arrived just in time.', 'almost', 'always', 'A', 'almost missed 表示“差点错过但没有”。', 'almost missed means it nearly happened but did not.')
    ]),
    lesson(english, 'adverb-traps', '易混副词与连接副词', 'Adverb traps and linking adverbs', 'hard/hardly · late/lately · however/therefore', 'hard/hardly · late/lately · however/therefore', [
      e([['He', 'subject', '主语', 'Subject'], ['works', 'predicate', '谓语动词', 'Predicate verb'], ['hard', 'adverbial', '方式状语：努力地', 'Manner adverb: with effort'], ['every day.', 'adverbial', '时间状语', 'Time adverbial']]),
      e([['I', 'subject', '主语', 'Subject'], ['have', 'helper', '助动词', 'Auxiliary verb'], ['hardly', 'adverbial', '近乎否定的频度状语', 'Near-negative frequency adverbial'], ['seen', 'predicate', '谓语动词', 'Predicate verb'], ['her', 'object', '宾语', 'Object'], ['lately.', 'adverbial', '时间状语：最近', 'Time adverb: recently']]),
      e([['The road', 'subject', '第一分句主语', 'First-clause subject'], ['was', 'predicate', '第一分句系动词', 'First-clause linking verb'], ['closed;', 'object', '第一分句表语', 'First-clause complement'], ['therefore,', 'adverbial', '连接副词：表示结果', 'Linking adverb: result'], ['we', 'subject', '第二分句主语', 'Second-clause subject'], ['took', 'predicate', '第二分句谓语', 'Second-clause predicate'], ['another route.', 'object', '第二分句宾语', 'Second-clause object']])
    ], [
      ['hard 是“努力地/猛烈地”，hardly 是“几乎不”；late 是“迟”，lately 是“最近”。', 'hard means “with effort/intensely”, hardly “almost not”; late means “after the expected time”, lately “recently”.'],
      ['however、therefore 等连接副词不是并列连词；连接两个独立分句时通常用分号或句号，并用逗号隔开连接副词。', 'Linking adverbs such as however and therefore are not coordinating conjunctions; between independent clauses they normally follow a semicolon or period and take a comma.']
    ], [
      q('She studies ___.', 'hard', 'hardly', 'A', 'hard 表示“努力地”。', 'hard means “with effort”.'),
      q('Have you seen Tom ___?', 'lately', 'late', 'A', 'lately 表示“最近”。', 'lately means “recently”.'),
      q('The shop was closed; ___, we went home.', 'therefore', 'because', 'A', 'therefore 是表示结果的连接副词，分号用法正确。', 'therefore is a result-linking adverb correctly following a semicolon.')
    ])
  ], '副词', 'Adverbs', 6);
}

module.exports = { buildAdjectiveCourse, buildAdverbCourse };
